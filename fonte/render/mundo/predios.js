// Prédios da cidade (desenho do render 5, D39, D43): troca o substituto de caixas da F0 (domínio 'predios').
//   LOD0  por setor de 256 m: a malha fundida que a oficina gera (fundir.js), um Mesh por setor perto da câmera, com
//         cache LRU e teto de memória por perfil
//   LOD1  instâncias de forma (caixa, chanfro, cilindro, duas águas) com a fachada inteira no shader; LOD2 é o mesmo
//         buffer só com a peça principal de cada prédio; os buffers são montados com os setores visíveis. Com as duas
//         faixas de profundidade (?semClip=1, sem EXT_clip_control) os setores além do corte vão numa segunda lista,
//         só da faixa de longe, e os de perto numa só da faixa de perto: a cidade não é desenhada duas vezes
//   sombra própria (D43): listas de projetores com o LOD1 dos setores cuja sombra cai no chão da cascata
//         (ctx.sombra.regiao), cujos buffers de instância o gêmeo da cena de sombra compartilha (o LOD0 nunca projeta)
//   tabela de prédios na GPU: RGBA8 512² (R camada, G bits, B agenda) e RG32F 512² (início e fim da obra, R4b)
// Publica para as outras parcelas: criarMaterialEdificio(ctx) (X1a, R5), uniformesEdificio, e no domínio
// ctx.dominio('predios'): { tabela, obra, material, preparar(), pronto(), caixaDoPredio(idx), medidas() }.
import * as THREE from 'three';
import { GradeSetores, pedidoDoSetor, assinatura, distCaixa, LADO_SETOR } from './setores.js';
import { ListaCompactada } from './instancias.js';
import { oficinaDe } from './oficina.js';
import { formaUnitaria, FORMAS, BITS_TABELA } from '../geracao/malhaPredio.js';
import { CAIXA, gerarSetor } from '../geracao/fundir.js';
import * as SH from '../materiais/shaders/fachada.glsl.js';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { refDe, idxDaRef } from '../../contratos/espelho.js';
import { LOD_PREDIOS } from '../../data/estilos.js';
import { PRIORIDADE } from '../camera/selecao.js';
import { pedeTudo } from '../ponte.js';
import { carregarDetalheCC0 } from '../materiais/texturas-predio.js';
import { modoMateriais } from '../materiais/texturas-chao.js';
import { CAMADA_LONGE } from '../motor/faixas.js';

/** Lado das tabelas de prédios na GPU (262.144 vagas, D19). */
export const LADO_TABELA = 512;
/**
 * Na primeira leitura do espelho e quando o diário pede tudo de novo (carga, cena fixa, save aberto) o LOD1 da cidade
 * inteira sai na thread principal, na hora: a cidade aparece completa no primeiro quadro, sem esperar a fila da
 * oficina (12 mil prédios em 0,15 a 0,3 s no PC). Acima deste número de prédios a carga segue pela oficina.
 */
const LOD1_NA_CARGA = 40000;
const BYTES_INST = ['aFac', 'aCorA', 'aCorB', 'aTopo'];
/** Folga (m) em volta do chão da cascata para escolher os setores que projetam sombra. */
const FOLGA_SOMBRA = 60;
/** Alcance máximo (m) da sombra de um setor com o sol baixo. */
const SOMBRA_MAX = 600;

/**
 * Corte entre as duas faixas de profundidade (?semClip=1): a mesma conta de motor/faixas.js (Faixas.desenhar), que
 * só a faz na hora de desenhar; aqui ela escolhe a lista de cada setor antes.
 */
export const limiteFaixas = (dist) => Math.max(3000, dist * 1.6);

/** Distância do ponto (px, pz) ao retângulo [x0, x1] x [z0, z1] no chão (0 dentro). */
function distRet(px, pz, x0, z0, x1, z1) {
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dz = pz < z0 ? z0 - pz : pz > z1 ? pz - z1 : 0;
  return Math.hypot(dx, dz);
}

/**
 * A sombra do setor alcança o círculo (cx, cz, raio)? O setor varrido para longe do sol (ux, uz: direção do sol no
 * chão) por até `alcance` m: a distância do centro ao retângulo que anda é convexa, então 5 amostras bastam com a folga.
 */
export function sombraAlcanca(x0, z0, lado, cx, cz, raio, ux, uz, alcance) {
  for (let k = 0; k <= 4; k++) {
    const t = (alcance * k) / 4;
    if (distRet(cx + ux * t, cz + uz * t, x0, z0, x0 + lado, z0 + lado) <= raio) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ material

/** Uniformes do material `edificio` (um objeto só: mudar o valor vale para todos os prédios). */
export const uniformesEdificio = {
  gPredTab: { value: null },
  gDetalhe: { value: null },
  gHora: { value: 10 },
  gNoite: { value: 0 },
  gSelecionado: { value: -1 },
  gPrediosMascara: { value: 0 },
  gCeuLigado: { value: 1 },
  gCeuZen: { value: new THREE.Color(0.28, 0.42, 0.62) },
  gCeuHor: { value: new THREE.Color(0.62, 0.7, 0.8) },
  gCeuChao: { value: new THREE.Color(0.16, 0.16, 0.15) },
};

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`edificio: shader sem '${alvo}' (o three mudou?)`);
  return src.replace(alvo, novo);
}

/**
 * Material `edificio` (desenho do render 9.1): MeshStandardMaterial com a fachada no shader e os ganchos comuns. O
 * mesmo material serve ao LOD0 fundido (atributos quantizados por vértice) e ao LOD1 instanciado (o three compila as
 * duas variantes). Para X1a e R5: escrever a malha no formato de malhaPredio.js e usar este material.
 */
export function criarMaterialEdificio(ctx, { ganchos = null } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.name = 'edificio';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformesEdificio);
    let vs = shader.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.VERTICE_PARS}`);
    vs = trocar(vs, '#include <beginnormal_vertex>', SH.VERTICE_NORMAL);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${SH.VERTICE_MAIN}`);
    let fs = shader.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.FRAGMENTO_PARS}`);
    fs = trocar(fs, '#include <color_fragment>', SH.FRAGMENTO_COR);
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.FRAGMENTO_RUGOSIDADE);
    fs = trocar(fs, '#include <metalnessmap_fragment>', SH.FRAGMENTO_METAL);
    fs = trocar(fs, '#include <normal_fragment_maps>', SH.FRAGMENTO_NORMAL);
    fs = trocar(fs, '#include <emissivemap_fragment>', SH.FRAGMENTO_EMISSIVO);
    fs = trocar(fs, '#include <lights_fragment_maps>', SH.FRAGMENTO_CEU);
    fs = trocar(fs, '#include <aomap_fragment>', SH.FRAGMENTO_AO);
    fs = trocar(fs, '#include <dithering_fragment>', SH.FRAGMENTO_MASCARA);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'edificio-1';
  m.userData.edificio = true;
  const g = ganchos ?? ctx.ganchos;
  g.aplicar(m, g.nomes());
  return m;
}

/** Geometria de uma forma unitária do LOD1 (posição, normal, aUnit e índices). */
function geometriaForma(f) {
  const u = formaUnitaria(f);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(u.posicao, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(u.normal, 3));
  g.setAttribute('aUnit', new THREE.BufferAttribute(u.unit, 4));
  g.setIndex(new THREE.BufferAttribute(u.indices, 1));
  return { g, tris: u.tris };
}

// depois do envio à GPU a cópia JS sai; fica o tamanho, para a conta de memória de geometria (medidas.js)
function soltarCopia() {
  this.array = { byteLength: this.array.byteLength, length: this.array.length };
}

// ------------------------------------------------------------------------------------------------ domínio

function criarPredios(ctx) {
  const { cena, medidas } = ctx;
  const esp0 = ctx.sim.espelho;
  const grade = new GradeSetores({ tam: esp0.mapa?.tam ?? 8192, origem: esp0.mapa?.origem ?? [-4096, -4096] });
  const oficina = oficinaDe(ctx);
  const material = criarMaterialEdificio(ctx);

  // tabelas na GPU
  const dadosTab = new Uint8Array(LADO_TABELA * LADO_TABELA * 4);
  const tabela = new THREE.DataTexture(dadosTab, LADO_TABELA, LADO_TABELA, THREE.RGBAFormat, THREE.UnsignedByteType);
  tabela.magFilter = tabela.minFilter = THREE.NearestFilter;
  tabela.generateMipmaps = false;
  tabela.name = 'predios:tabela';
  // RG32F (2.4): início e fim da obra em tiques; o progresso sai no vértice, nenhum envio por quadro
  const dadosObra = new Float32Array(LADO_TABELA * LADO_TABELA * 2);
  const obra = new THREE.DataTexture(dadosObra, LADO_TABELA, LADO_TABELA, THREE.RGFormat, THREE.FloatType);
  obra.magFilter = obra.minFilter = THREE.NearestFilter;
  obra.generateMipmaps = false;
  obra.name = 'predios:obra';
  // até o primeiro envio (e depois de um 'tudo') a tabela vai inteira; depois, só as vagas que mudaram
  let tabelaInteira = true;
  let obraInteira = true;
  tabela.onUpdate = () => {
    tabelaInteira = false;
  };
  obra.onUpdate = () => {
    obraInteira = false;
  };
  uniformesEdificio.gPredTab.value = tabela;
  uniformesEdificio.gDetalhe.value = ctx.textura('fachadaDetalhe');
  // A/B dos materiais (D46): com ?materiais=cc0 a fachada usa o detalhe fotográfico quando a montagem o traz
  if (modoMateriais() === 'cc0') {
    carregarDetalheCC0({ renderer: ctx.renderer, THREE }).then((t) => {
      if (t) uniformesEdificio.gDetalhe.value = t;
    });
  }
  const mascara = typeof location !== 'undefined' && new URLSearchParams(location.search).get('passe') === 'mascara';
  uniformesEdificio.gPrediosMascara.value = mascara ? 1 : 0;

  // listas do LOD1/LOD2 visível e dos projetores de sombra, uma por forma; com as duas faixas de profundidade
  // (ctx.semClip), 'vis' fica só na faixa de perto e 'longe' (os setores além do corte) só na de longe
  const duasFaixas = !!ctx.semClip;
  const naCena = (faixa) => (m, velha) => {
    if (velha) cena.remove(velha);
    medidas.familia(m, 'predios');
    if (faixa === 'longe') m.layers.set(CAMADA_LONGE);
    if (faixa) m.userData.faixa = faixa;
    cena.add(m);
  };
  const formas = FORMAS.map((nome, f) => {
    const { g, tris } = geometriaForma(f);
    const gs = new THREE.BufferGeometry();
    gs.setAttribute('position', g.attributes.position);
    gs.setIndex(g.index);
    const vis = new ListaCompactada({ geometria: g, material, nome: `predios:lod1:${nome}`, bytes: BYTES_INST, comId: true, cap: 2048 });
    const sombra = new ListaCompactada({ geometria: gs, material: null, nome: `predios:sombra:${nome}`, cap: 1024 });
    vis.aoCriar = naCena(duasFaixas ? 'perto' : null);
    vis.aoCriar(vis.malha, null);
    let longe = null;
    if (duasFaixas) {
      longe = new ListaCompactada({ geometria: g, material, nome: `predios:lod2:${nome}`, bytes: BYTES_INST, comId: true, cap: 2048 });
      longe.aoCriar = naCena('longe');
      longe.aoCriar(longe.malha, null);
    }
    sombra.aoCriar = (m, velha) => {
      if (velha) ctx.sombra.soltar(velha);
      medidas.familia(ctx.sombra.projetor(m), 'sombra');
    };
    sombra.aoCriar(sombra.malha, null);
    return { vis, longe, sombra, tris };
  });

  const setores = new Map();
  let setorDe = new Int32Array(0);
  let sig = new Uint32Array(0);
  let iniciado = false;
  let carga = false; // o próximo passo gera o LOD1 que falta na thread principal
  let quadros = 0;
  const recebidos = [];
  let pendentes1 = 0;
  let pendentes0 = 0;
  let chaveVis = -1;
  let chaveSombra = -1;
  let nLod0 = 0;
  let bytesLod0 = 0;
  let msEnvio = 0;
  const frustum = new THREE.Frustum();
  const mProj = new THREE.Matrix4();
  const caixa = new THREE.Box3();
  const alvo = new THREE.Vector3();

  const novoSetor = (s) => {
    const [x0, z0] = grade.canto(s);
    return { s, x0, z0, lista: [], versao: 1, lod1: null, lista1: null, v1: 0, pedido1: 0, lod0: null, pedido0: 0, ymin: -2, ymax: 40, usado: 0, modo: 1, vis: false };
  };
  const setorPara = (s) => {
    let st = setores.get(s);
    if (!st) {
      st = novoSetor(s);
      setores.set(s, st);
    }
    return st;
  };

  function crescer(cap) {
    if (setorDe.length >= cap) return;
    const a = new Int32Array(cap).fill(-1);
    a.set(setorDe);
    setorDe = a;
    const b = new Uint32Array(cap);
    b.set(sig);
    sig = b;
  }

  function escreverTabela(P, i) {
    if (i >= LADO_TABELA * LADO_TABELA) return;
    const k = 4 * i;
    const viva = i < P.n && P.viva[i];
    const f = viva ? P.flags[i] : 0;
    let g = 0;
    if (f & PREDIO.ABANDONADO) g |= BITS_TABELA.ABANDONADO;
    if (f & PREDIO.OBRA) g |= BITS_TABELA.OBRA;
    if (viva && (f & PREDIO.HOLDING || P.tipo[i] === TIPO_PREDIO.HOLDING)) g |= BITS_TABELA.HOLDING;
    dadosTab[k + 1] = g;
    dadosTab[k + 2] = viva ? (Math.imul(P.semente[i] ^ 0x5bd1e995, 0x9e3779b1) >>> 24) & 255 : 0;
    dadosObra[2 * i] = viva ? P.obraIni[i] : 0;
    dadosObra[2 * i + 1] = viva ? P.obraFim[i] : 0;
    if (!tabelaInteira) tabela.addUpdateRange(k, 4);
    if (!obraInteira) obra.addUpdateRange(2 * i, 2);
  }

  function tirar(st, i) {
    const j = st.lista.indexOf(i);
    if (j >= 0) {
      st.lista.splice(j, 1);
      st.versao++;
    }
  }

  /** Espelho para os setores: quem mudou de setor, de lote ou de aparência pede o setor de novo. */
  function aplicar(d, esp) {
    const P = esp.predios;
    if (!P) return;
    crescer(P.cap);
    const tudo = !iniciado || pedeTudo(d, 'predios');
    // primeira leitura ou tudo de novo (um save aberto): o LOD1 sai na hora no próximo passo
    if (tudo) carga = true;
    iniciado = true;
    if (tudo) {
      const novas = new Map();
      for (let i = 0; i < P.n; i++) {
        if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
        const s = grade.indice(P.x[i], P.z[i]);
        if (s < 0) continue;
        let l = novas.get(s);
        if (!l) novas.set(s, (l = []));
        l.push(i);
      }
      for (const s of new Set([...setores.keys(), ...novas.keys()])) {
        const st = setorPara(s);
        const l = novas.get(s) ?? [];
        let igual = l.length === st.lista.length;
        for (let k = 0; igual && k < l.length; k++) igual = l[k] === st.lista[k] && sig[l[k]] === assinatura(P, l[k]);
        if (!igual) {
          st.lista = l;
          st.versao++;
        }
      }
      setorDe.fill(-1);
      for (const [s, l] of novas) for (const i of l) {
        setorDe[i] = s;
        sig[i] = assinatura(P, i);
      }
      tabelaInteira = true;
      obraInteira = true;
      tabela.clearUpdateRanges();
      obra.clearUpdateRanges();
      for (let i = 0; i < Math.min(P.cap, LADO_TABELA * LADO_TABELA); i++) escreverTabela(P, i);
      tabela.needsUpdate = true;
      obra.needsUpdate = true;
      return;
    }
    if (!d.predios?.length) return;
    for (const i of d.predios) {
      const velho = setorDe[i];
      const vivo = i < P.n && P.viva[i] && P.tipo[i] === TIPO_PREDIO.ZONA;
      const novo = vivo ? grade.indice(P.x[i], P.z[i]) : -1;
      const sg = vivo ? assinatura(P, i) : 0;
      if (velho !== novo) {
        if (velho >= 0) tirar(setorPara(velho), i);
        if (novo >= 0) {
          const st = setorPara(novo);
          st.lista.push(i);
          st.lista.sort((a, b) => a - b);
          st.versao++;
        }
      } else if (novo >= 0 && sig[i] !== sg) setorPara(novo).versao++;
      setorDe[i] = novo;
      sig[i] = sg;
      escreverTabela(P, i);
    }
    tabela.needsUpdate = true;
    obra.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------------------------- pedidos

  function pedir(st, lod0) {
    const P = ctx.sim.espelho.predios;
    const lista = st.lista.slice();
    const versao = st.versao;
    const { dados, transferir } = pedidoDoSetor(P, lista, grade, st.s, lod0);
    if (lod0) {
      st.pedido0 = versao;
      pendentes0++;
    } else {
      st.pedido1 = versao;
      pendentes1++;
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    oficina.pedir('setor', dados, { chave: st.s, transferir }).then((r) => {
      if (lod0) pendentes0--;
      else pendentes1--;
      recebidos.push({ st, r, lista, versao, lod0, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 });
    });
  }

  function receberLod1(st, r, lista, versao) {
    st.lod1 = r.lod1;
    st.lista1 = lista;
    st.caixas = r.caixas;
    st.v1 = versao;
    // altura do setor pelas caixas (para a distância e o descarte)
    let y0 = Infinity;
    let y1 = -Infinity;
    const P = ctx.sim.espelho.predios;
    for (let k = 0; k < lista.length; k++) {
      const i = lista[k];
      const yb = P.y[i];
      y0 = Math.min(y0, yb + r.caixas[CAIXA * k + 4]);
      y1 = Math.max(y1, yb + r.caixas[CAIXA * k + 5]);
    }
    st.ymin = Number.isFinite(y0) ? y0 : -2;
    st.ymax = Number.isFinite(y1) ? y1 : 10;
  }

  function soltarLod0(st) {
    if (!st.lod0) return;
    cena.remove(st.lod0.mesh);
    st.lod0.mesh.geometry.dispose();
    nLod0--;
    bytesLod0 -= st.lod0.bytes;
    st.lod0 = null;
  }

  function receberLod0(st, r, versao) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    soltarLod0(st);
    const m = r.malhas?.[0];
    if (!m) {
      st.lod0 = { mesh: new THREE.Object3D(), versao, bytes: 0 };
      nLod0++;
      return;
    }
    const A = m.atributos;
    const g = new THREE.BufferGeometry();
    const at = (arr, k, norm) => new THREE.BufferAttribute(arr, k, norm).onUpload(soltarCopia);
    g.setAttribute('position', at(A.posicao, 3, true));
    g.setAttribute('normal', at(A.normal, 2, true));
    const fuv = new THREE.Float16BufferAttribute(A.facUV, 4);
    fuv.onUpload(soltarCopia);
    g.setAttribute('aFacUV', fuv);
    g.setAttribute('aFac', at(A.fac, 4, false));
    g.setAttribute('aCorA', at(A.corA, 4, false));
    g.setAttribute('aCorB', at(A.corB, 4, false));
    g.setAttribute('aId', at(A.id, 1, false));
    g.setAttribute('aAO', at(A.ao, 1, true));
    g.setIndex(at(m.indices, 1, false));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3) * 1.01);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.01, -1.01, -1.01), new THREE.Vector3(1.01, 1.01, 1.01));
    const mesh = new THREE.Mesh(g, material);
    const [cx, cy, cz, s] = m.escala;
    mesh.position.set(st.x0 + cx, cy, st.z0 + cz);
    mesh.scale.setScalar(s);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.name = `predios:lod0:${st.s}`;
    medidas.familia(mesh, 'predios');
    cena.add(mesh);
    let bytes = m.indices.byteLength;
    for (const a of Object.values(A)) bytes += a.byteLength;
    st.lod0 = { mesh, versao, bytes, tris: m.tris };
    nLod0++;
    bytesLod0 += bytes;
    msEnvio = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }

  /** Recebe o que a oficina entregou: LOD1 todos, LOD0 até `max` (um por quadro no jogo). */
  function receber(max) {
    let feitos0 = 0;
    for (let k = 0; k < recebidos.length; ) {
      const { st, r, lista, versao, lod0 } = recebidos[k];
      if (r.erro) {
        if (lod0) st.pedido0 = 0;
        else st.pedido1 = 0;
        recebidos.splice(k, 1);
        continue;
      }
      if (lod0 && feitos0 >= max) {
        k++;
        continue;
      }
      recebidos.splice(k, 1);
      // uma resposta velha não passa por cima de uma mais nova
      if (!st.lod1 || versao >= st.v1) receberLod1(st, r, lista, versao);
      if (lod0 && (!st.lod0 || versao >= st.lod0.versao)) {
        receberLod0(st, r, versao);
        feitos0++;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- quadro

  const perfilLod = () => ({ lod0: ctx.perfil.lod0, ...(LOD_PREDIOS[ctx.perfil.id] ?? LOD_PREDIOS.media) });

  /**
   * Escolhe o LOD de cada setor, faz os pedidos e monta as listas visíveis e de sombra. O LOD1 é leve (só o plano e as
   * instâncias): na carga sai inteiro aqui (LOD1_NA_CARGA); depois, com o worker, os setores que mudaram vão para a
   * fila de uma vez. O LOD0 segue com 2 na fila e 1 envio à GPU por quadro.
   */
  function passo({ envio = 1, pedidos1 = oficina.worker ? 1024 : 6, pedidos0 = 2 } = {}) {
    quadros++;
    receber(envio);
    const cam = ctx.camera;
    cam.updateMatrixWorld();
    mProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(mProj);
    const L = perfilLod();
    const cp = cam.position;
    const cand1 = [];
    const cand0 = [];
    let hv = 0x811c9dc5;
    const vis = [];
    let quer0 = 0;
    let lod0Vis = 0;
    const lim = duasFaixas ? limiteFaixas(ctx.cameraApi?.estado?.().dist ?? cp.length()) : Infinity;
    // carga: o LOD1 que falta sai aqui mesmo, sem a oficina
    if (carga) {
      carga = false;
      const faltam = [...setores.values()].filter((st) => st.lista.length && (!st.lod1 || st.v1 < st.versao));
      if (faltam.reduce((a, st) => a + st.lista.length, 0) <= LOD1_NA_CARGA) {
        const P = ctx.sim.espelho.predios;
        for (const st of faltam) {
          const lista = st.lista.slice();
          receberLod1(st, gerarSetor(pedidoDoSetor(P, lista, grade, st.s, false).dados), lista, st.versao);
        }
      }
    }
    for (const st of setores.values()) {
      if (!st.lista.length) {
        // setor que esvaziou: nada a desenhar
        if (st.lod0) soltarLod0(st);
        st.lod1 = null;
        st.lista1 = null;
        st.v1 = st.versao;
        continue;
      }
      const d = distCaixa(cp.x, cp.y, cp.z, st.x0, st.ymin, st.z0, st.x0 + LADO_SETOR, st.ymax, st.z0 + LADO_SETOR);
      st.dist = d;
      // histerese de 10% nas duas trocas
      const perto = st.modo === 0 ? d < L.lod0 * 1.1 : d < L.lod0 * 0.9;
      const longe = st.modo === 2 ? d > L.lod2 * 0.9 : d > L.lod2 * 1.1;
      st.modo = perto ? 0 : longe ? 2 : 1;
      if ((!st.lod1 || st.v1 < st.versao) && st.pedido1 !== st.versao) cand1.push(st);
      caixa.min.set(st.x0 - 40, st.ymin, st.z0 - 40);
      caixa.max.set(st.x0 + LADO_SETOR + 40, st.ymax + 5, st.z0 + LADO_SETOR + 40);
      st.vis = frustum.intersectsBox(caixa);
      if (st.modo === 0) {
        if ((!st.lod0 || st.lod0.versao < st.versao) && st.pedido0 !== st.versao && st.lista.length) cand0.push(st);
        if (st.lod0) st.usado = quadros;
      }
      const mostra0 = st.modo === 0 && st.lod0;
      if (st.lod0) st.lod0.mesh.visible = !!mostra0 && st.vis;
      if (st.modo === 0) quer0++;
      if (mostra0 && st.vis) lod0Vis++;
      if (st.vis && st.lod1 && !mostra0) {
        // faixa de profundidade: perto se algo do setor fica antes do corte da de perto, longe se algo passa do
        // começo da de longe (o setor na emenda vai nas duas)
        let fx = 1;
        if (duasFaixas) {
          const ex = Math.max(Math.abs(cp.x - st.x0), Math.abs(cp.x - st.x0 - LADO_SETOR));
          const ey = Math.max(Math.abs(cp.y - st.ymin), Math.abs(cp.y - st.ymax));
          const ez = Math.max(Math.abs(cp.z - st.z0), Math.abs(cp.z - st.z0 - LADO_SETOR));
          fx = (d < lim * 1.02 ? 1 : 0) | (Math.sqrt(ex * ex + ey * ey + ez * ez) > lim * 0.9 ? 2 : 0);
        }
        st.faixa = fx;
        vis.push(st);
        hv = Math.imul(hv ^ st.s, 0x01000193);
        hv = Math.imul(hv ^ (st.modo * 7919 + st.v1 * 4 + fx), 0x01000193);
      }
    }
    // pedidos: os mais perto primeiro
    cand1.sort((a, b) => a.dist - b.dist);
    for (const st of cand1) {
      if (pendentes1 >= pedidos1) break;
      pedir(st, false);
    }
    cand0.sort((a, b) => a.dist - b.dist);
    for (const st of cand0) {
      if (pendentes0 >= pedidos0) break;
      pedir(st, true);
    }
    // listas visíveis do LOD1 (todas as peças) e do LOD2 (só as principais)
    if (hv !== chaveVis) {
      chaveVis = hv;
      let n = 0;
      formas.forEach((F, f) => {
        const perto = [];
        const longe = [];
        for (const st of vis) {
          const x = st.lod1[f];
          const k = st.modo === 2 ? x.np : x.n;
          if (!k) continue;
          const p = { mat: x.mat, ids: x.ids, bytes: x.bytes, n: k };
          if (st.faixa & 1) perto.push(p);
          if (st.faixa & 2) longe.push(p);
        }
        n += F.vis.compactar(perto);
        if (F.longe) n += F.longe.compactar(longe);
      });
      ctx.stats.instancias.predios = n;
    }
    // projetores de sombra (D43): os setores cuja sombra cai no chão da cascata (ctx.sombra.regiao: o foco que a R1a
    // puxa para baixo da câmera nas vistas rasantes, não o alvo), varridos para longe do sol pela altura do setor;
    // antes do primeiro passe, em volta do alvo da câmera
    const reg = ctx.sombra?.regiao;
    let rx;
    let rz;
    let raio;
    if (reg) {
      rx = reg.x;
      rz = reg.z;
      raio = reg.raio + FOLGA_SOMBRA;
    } else {
      ctx.cameraApi?.alvo?.(alvo);
      rx = alvo.x;
      rz = alvo.z;
      raio = Math.min(ctx.perfil.sombra.raioMax, Math.max(60, 0.6 * cp.distanceTo(alvo))) + FOLGA_SOMBRA;
    }
    const sd = ctx.sol?.dir;
    const sh = sd ? Math.hypot(sd.x, sd.z) : 0;
    const ux = sh > 1e-4 ? sd.x / sh : 0;
    const uz = sh > 1e-4 ? sd.z / sh : 0;
    // cotangente da elevação do sol, com o sol no mínimo a ~11 graus (abaixo disso a sombra some na luz da tarde)
    const cot = sd ? sh / Math.max(0.2, sd.y) : 0;
    // de perto do foco todas as peças; mais longe só a principal de cada prédio (o texel da sombra já passa de 1 m)
    let hs = 0x811c9dc5;
    const somb = [];
    for (const st of setores.values()) {
      if (!st.lod1) continue;
      const alcance = Math.min(SOMBRA_MAX, Math.max(0, st.ymax - st.ymin) * cot);
      if (!sombraAlcanca(st.x0, st.z0, LADO_SETOR, rx, rz, raio, ux, uz, alcance)) continue;
      st.sombraToda = distRet(rx, rz, st.x0, st.z0, st.x0 + LADO_SETOR, st.z0 + LADO_SETOR) < 250;
      somb.push(st);
      hs = Math.imul(hs ^ st.s, 0x01000193);
      hs = Math.imul(hs ^ (st.v1 * 2 + (st.sombraToda ? 1 : 0)), 0x01000193);
    }
    if (hs !== chaveSombra) {
      chaveSombra = hs;
      formas.forEach((F, f) => F.sombra.compactar(somb.map((st) => ({ mat: st.lod1[f].mat, ids: null, bytes: null, n: st.sombraToda ? st.lod1[f].n : st.lod1[f].np }))));
      ctx.sombra.marcar();
    }
    // cache LRU do LOD0 e teto de memória
    const capCache = Math.max(L.cache, quer0);
    if (nLod0 > capCache || bytesLod0 > L.memoriaMB * 1048576 * 0.6) {
      const velhos = [...setores.values()].filter((st) => st.lod0 && st.modo !== 0).sort((a, b) => a.usado - b.usado);
      for (const st of velhos) {
        if (nLod0 <= capCache && bytesLod0 <= L.memoriaMB * 1048576 * 0.6) break;
        soltarLod0(st);
      }
    }
    const S = ctx.stats.setores;
    S.lod0 = lod0Vis;
    S.msEnvio = +msEnvio.toFixed(2);
  }

  /** Hora, noite e o céu de reserva do reflexo. */
  function uniformes(c) {
    uniformesEdificio.gHora.value = c.horaDoCeu();
    const dia = c.sol?.dia ?? 1;
    uniformesEdificio.gNoite.value = Math.min(1, Math.max(0, 1 - dia * 1.25));
    uniformesEdificio.gCeuLigado.value = c.cena.environment ? 0 : 1;
    const hor = c.ganchos.uniformes.gNeblinaCor?.value;
    if (hor) uniformesEdificio.gCeuHor.value.copy(hor);
    const bg = c.cena.background;
    if (bg?.isColor) uniformesEdificio.gCeuZen.value.copy(bg).multiplyScalar(0.85);
    else uniformesEdificio.gCeuZen.value.copy(uniformesEdificio.gCeuHor.value).multiply(new THREE.Color(0.55, 0.68, 0.95));
    uniformesEdificio.gCeuChao.value.copy(uniformesEdificio.gCeuHor.value).multiplyScalar(0.28);
  }

  // camadas (X3a): o valor por prédio no canal R da tabela; seleção: realce pelo idx
  const paraDesligar = [
    ctx.ouvir('camadas', (c) => {
      const P = ctx.sim.espelho.predios;
      if (!P) return;
      const liga = c && c.fonte === 'predios' && c.dados;
      const min = c?.min ?? 0;
      const max = c?.max ?? 1;
      const n = Math.min(P.n, LADO_TABELA * LADO_TABELA);
      for (let i = 0; i < n; i++) {
        const v = liga ? (c.dados[i] - min) / (max - min || 1) : 0;
        dadosTab[4 * i] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
      tabelaInteira = true;
      tabela.clearUpdateRanges();
      tabela.needsUpdate = true;
    }),
    ctx.ouvir('selecionado', (ref) => {
      uniformesEdificio.gSelecionado.value = ref === null || ref === undefined ? -1 : idxDaRef(ref);
    }),
  ];

  /** Seleção pela caixa de cada prédio (a mesma do plano), sem ler a GPU. */
  function selecionar(raio, esp) {
    const P = esp.predios;
    if (!P) return null;
    const o = raio.origem;
    const dv = raio.dir;
    let melhor = null;
    for (const st of setores.values()) {
      if (!st.lod1 || !st.lista1) continue;
      if (raioNaCaixaAlinhada(o, dv, st.x0 - 40, st.ymin, st.z0 - 40, st.x0 + LADO_SETOR + 40, st.ymax, st.z0 + LADO_SETOR + 40) === null) continue;
      const cx = st.caixas;
      for (let k = 0; k < st.lista1.length; k++) {
        const i = st.lista1[k];
        if (i >= P.n || !P.viva[i]) continue;
        const b = CAIXA * k;
        const t = raioNaCaixaGirada(o, dv, P.x[i], P.y[i], P.z[i], P.rot[i], cx[b], cx[b + 4], cx[b + 1], cx[b + 2], cx[b + 5], cx[b + 3]);
        if (t !== null && (!melhor || t < melhor.dist)) {
          melhor = { tipo: 'predio', idx: i, ref: refDe(i, P.ger[i]), dist: t, ponto: [o[0] + dv[0] * t, o[1] + dv[1] * t, o[2] + dv[2] * t] };
        }
      }
    }
    return melhor;
  }

  function prontoAgora() {
    if (pendentes0 || pendentes1 || recebidos.length) return false;
    for (const st of setores.values()) {
      if (st.lista.length && (!st.lod1 || st.v1 < st.versao)) return false;
      if (st.modo === 0 && st.vis && st.lista.length && (!st.lod0 || st.lod0.versao < st.versao)) return false;
    }
    return true;
  }

  const dom = {
    nome: 'predios',
    material,
    tabela,
    obra,
    aplicar(d, esp) {
      aplicar(d, esp);
    },
    quadro(tMs, c) {
      uniformes(c);
      passo();
    },
    selecionar,
    /** true quando todos os setores têm o LOD pedido pela vista atual. */
    pronto: prontoAgora,
    /**
     * Para as cenas fixas e as capturas: lê o espelho, põe a câmera em dia e espera a oficina entregar tudo o que a
     * vista pede (sem o limite de um setor por quadro). Devolve as medidas.
     */
    async preparar({ teto = 120000 } = {}) {
      const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const t0 = agora();
      ctx.cameraApi?.atualizar?.(t0);
      if (!iniciado) aplicar(ctx.sim.mudancas.desde(-1), ctx.sim.espelho);
      uniformes(ctx);
      while (agora() - t0 < teto) {
        passo({ envio: 64, pedidos1: 1024, pedidos0: 4 });
        if (prontoAgora()) break;
        if (oficina.worker) await new Promise((ok) => setTimeout(ok, 30));
        else {
          oficina.rodarLocal(4);
          await Promise.resolve();
        }
      }
      passo({ envio: 64 });
      return dom.medidas();
    },
    medidas() {
      let inst = 0;
      let tris1 = 0;
      formas.forEach((F) => {
        const c = F.vis.count + (F.longe?.count ?? 0);
        inst += c;
        tris1 += c * F.tris;
      });
      let tris0 = 0;
      for (const st of setores.values()) if (st.lod0?.tris && st.lod0.mesh.visible) tris0 += st.lod0.tris;
      return {
        setores: setores.size, lod0: nLod0, lod0Visiveis: ctx.stats.setores.lod0, instancias: inst, trisLod1: tris1, trisLod0: tris0,
        memoriaLod0MB: +(bytesLod0 / 1048576).toFixed(2), sombra: formas.reduce((a, F) => a + F.sombra.count * F.tris, 0),
      };
    },
    /** Caixa de um prédio no espaço do lote ([x0, z0, x1, z1, y0, y1]) ou null (âncoras, câmera). */
    caixaDoPredio(i) {
      const st = setores.get(setorDe[i]);
      if (!st?.lista1) return null;
      const k = st.lista1.indexOf(i);
      return k < 0 ? null : Array.from(st.caixas.subarray(CAIXA * k, CAIXA * k + 6));
    },
    descartar() {
      for (const f of paraDesligar) f?.();
      for (const st of setores.values()) soltarLod0(st);
      for (const F of formas) {
        cena.remove(F.vis.malha);
        if (F.longe) {
          cena.remove(F.longe.malha);
          F.longe.descartar();
        }
        ctx.sombra.soltar(F.sombra.malha);
        F.vis.descartar();
        F.sombra.descartar();
      }
      tabela.dispose();
      obra.dispose();
      material.dispose();
    },
  };
  return dom;
}

// ------------------------------------------------------------------------------------------------ raio

function raioNaCaixaAlinhada(o, d, x0, y0, z0, x1, y1, z1) {
  let t0 = 0;
  let t1 = Infinity;
  const eixo = (oo, dd, lo, hi) => {
    if (Math.abs(dd) < 1e-9) return oo >= lo && oo <= hi;
    let a = (lo - oo) / dd;
    let b = (hi - oo) / dd;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!eixo(o[0], d[0], x0, x1) || !eixo(o[1], d[1], y0, y1) || !eixo(o[2], d[2], z0, z1)) return null;
  return t0;
}

/** Raio contra a caixa [x0, x1] x [y0, y1] x [z0, z1] do lote girado por rot em torno de (cx, cy, cz). */
function raioNaCaixaGirada(o, d, cx, cy, cz, rot, x0, y0, z0, x1, y1, z1) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // mundo para o lote: inverso de x = xl c + zl s, z = -xl s + zl c
  const ox = o[0] - cx;
  const oz = o[2] - cz;
  const lo = [ox * c - oz * s, o[1] - cy, ox * s + oz * c];
  const ld = [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c];
  return raioNaCaixaAlinhada(lo, ld, x0, y0, z0, x1, y1, z1);
}

/** Registra o domínio (troca o substituto da F0) e a seleção dos prédios. */
export function registrar(api) {
  api.registrarDominio('predios', criarPredios);
  api.registrarSelecionavel('predios', (raio, ctx) => ctx.dominio('predios')?.selecionar?.(raio, ctx.sim.espelho) ?? null, { prioridade: PRIORIDADE.mundo });
}
