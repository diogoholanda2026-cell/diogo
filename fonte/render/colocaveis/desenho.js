// Domínio 'colocaveis' (R5, D39, D43, D60): os serviços e os prédios da Holding no mundo, com o material `edificio` da
// R4a (o mesmo programa do LOD0 da cidade: nenhuma compilação nova). Vem sob demanda (dominio.js). Sem o domínio da
// R4a (a vista de depuração da F0) não desenha nada: a caixa da depuração já mostra os colocáveis.
//   LOD1  uma malha só com todos os colocáveis (o gerador na oficina, fundida e quantizada): uma chamada no mapa
//         inteiro. Cada colocável é um trecho contínuo dos índices; os que estão no LOD0 de perto saem do índice
//         visível (reescrito só quando o conjunto de setores de perto muda), e a sombra própria usa o índice inteiro.
//   LOD0  por setor de 256 m perto da câmera (o alcance do LOD0 do perfil), uma malha por setor, com cache.
//   Obra  o corte no vértice da R4b: ctx.dominio('predios').alturaObra(idx, H) com a altura do modelo.
//   Detalhe pela tabela DETALHE_COLOCAVEIS (Média ou Ultra, data/colocaveis.js); trocar a qualidade refaz tudo.
// Publica em ctx.dominio('colocaveis'): preparar(), pronto(), medidas(), caixa(idx), silhueta(tipo, nivel) (a
// geometria do LOD1 para o fantasma da ferramenta de colocar, X2).
import * as THREE from 'three';
import { gerarColocaveis, pedidoColocaveis, modelar, CAIXA_C, PASSO_ARV, ESPECIES_ARVORE } from './gerador.js';
import { COLOCAVEIS, DETALHE_COLOCAVEIS, tipoColocavel } from '../../data/colocaveis.js';
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { GradeSetores, LADO_SETOR, distCaixa, assinatura } from '../mundo/setores.js';
import { oficinaDe } from '../mundo/oficina.js';
import { porPerfil } from '../motor/perfis.js';
import { pedeTudo } from '../ponte.js';
import { Construtor } from '../geracao/malhaPredio.js';

/** Setores de LOD0 guardados no cache (os mais recentes). */
const CACHE_LOD0 = 12;
/** Pedidos de LOD0 no ar ao mesmo tempo. */
const NO_AR = 2;
/** Espera (ms) depois de uma mudança antes de pedir o LOD1 de novo (junta as mudanças). */
const ESPERA_LOD1 = 250;
/** Folga (fração) para sair do LOD0: não fica trocando na borda. */
const HISTERESE = 0.12;

const agoraMs = () => (typeof performance !== 'undefined' ? performance.now() : 0);

function soltarCopia() {
  this.array = { byteLength: this.array.byteLength, length: this.array.length };
}

/** Atributos quantizados da oficina (quantizar.js) numa BufferGeometry do three (o formato do LOD0 da R4a). */
function geometriaQuantizada(m, { soltar = true, indice = true } = {}) {
  const A = m.atributos;
  const g = new THREE.BufferGeometry();
  const at = (arr, k, norm) => {
    const a = new THREE.BufferAttribute(arr, k, norm);
    if (soltar) a.onUpload(soltarCopia);
    return a;
  };
  g.setAttribute('position', at(A.posicao, 3, true));
  g.setAttribute('normal', at(A.normal, 2, true));
  const fuv = new THREE.Float16BufferAttribute(A.facUV, 4);
  if (soltar) fuv.onUpload(soltarCopia);
  g.setAttribute('aFacUV', fuv);
  g.setAttribute('aFac', at(A.fac, 4, false));
  g.setAttribute('aCorA', at(A.corA, 4, false));
  g.setAttribute('aCorB', at(A.corB, 4, false));
  g.setAttribute('aId', at(A.id, 1, false));
  g.setAttribute('aAO', at(A.ao, 1, true));
  if (indice) g.setIndex(at(m.indices, 1, false));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3) * 1.01);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1.01, -1.01, -1.01), new THREE.Vector3(1.01, 1.01, 1.01));
  return g;
}

/** Mesh na escala da quantização: o centro da caixa (somado à origem do pedido) e a meia aresta. */
function posicionar(mesh, m, ox, oz) {
  const [cx, cy, cz, s] = m.escala;
  mesh.position.set(ox + cx, cy, oz + cz);
  mesh.scale.setScalar(s);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

/** Bytes de uma malha quantizada (memória de geometria). */
function bytesDe(m) {
  let b = m.indices.byteLength;
  for (const a of Object.values(m.atributos)) b += a.byteLength;
  return b;
}

/** Domínio sem desenho (sem o material da R4a, na vista de depuração da F0). */
function dominioVazio() {
  return { nome: 'colocaveis', aplicar() {}, quadro() {}, pronto: () => true, preparar: async () => null, medidas: () => null, caixa: () => null, silhueta: () => null, descartar() {} };
}

/** Cria o domínio (a fábrica de dominio.js chama quando este módulo chega). */
export function criarColocaveis(ctx) {
  const { cena, medidas } = ctx;
  const esp0 = ctx.sim.espelho;
  const grade = new GradeSetores({ tam: esp0.mapa?.tam ?? 8192, origem: esp0.mapa?.origem ?? [-4096, -4096] });
  const oficina = oficinaDe(ctx);
  // o material do LOD0 da cidade (o mesmo programa, já aquecido)
  const predios = () => ctx.dominio('predios');
  const material = predios()?.material ?? null;
  if (!material) return dominioVazio();
  let detalhe = porPerfil(DETALHE_COLOCAVEIS, ctx.perfil);

  const itens = new Map(); // idx -> { i, tipo, s, sig, obra, H }
  const setores = new Map(); // s -> { s, x0, z0, lista: Set, versao, lod0, pedido, quer, usado, ymin, ymax }
  let iniciado = false;
  let versaoItens = 0; // sobe a cada mudança que o LOD1 precisa ver
  const fila = []; // respostas a montar no próximo quadro
  let noAr = 0;
  let quadros = 0;
  const caixas = new Map(); // idx -> Float32Array(6) [x0, z0, x1, z1, y0, y1] no espaço do lote
  let arvores = 0; // árvores plantadas na vegetação
  // LOD1 da cidade inteira
  const longe = { versao: -1, pedida: -1, tPedido: -Infinity, mesh: null, sombra: null, geoTudo: null, indices: null, faixas: new Map(), chave: '', tris: 0, bytes: 0, pendente: false, tMudou: -Infinity };
  // a malha vazia do aquecimento (o programa existe desde a carga mesmo sem nenhum colocável)
  const mAq = gerarColocaveis({ lod: 1, detalhe, n: 1, num: new Float32Array([0, -1000, 0, 0, 16, 16]), ints: new Uint32Array([0, 1, 1, 1]) }).malhas[0];
  const geoAq = geometriaQuantizada(mAq, { soltar: false });
  const aquecer = new THREE.Mesh(geoAq, material);
  aquecer.name = 'colocaveis:aquecer';
  ctx.quadro?.aquecer?.add?.(aquecer);

  // ---------------------------------------------------------------------------------------------- espelho

  const setorPara = (s) => {
    let st = setores.get(s);
    if (!st) {
      const [x0, z0] = grade.canto(s);
      st = { s, x0, z0, lista: new Set(), versao: 1, lod0: null, pedido: 0, quer: false, usado: 0, ymin: -2, ymax: 40, dist: Infinity };
      setores.set(s, st);
    }
    return st;
  };

  function tirar(i) {
    const it = itens.get(i);
    if (!it) return;
    itens.delete(i);
    caixas.delete(i);
    const st = setores.get(it.s);
    if (st) {
      st.lista.delete(i);
      st.versao++;
    }
    versaoItens++;
    longe.tMudou = agoraMs();
  }

  function por(P, i) {
    const tipo = tipoColocavel(P.tipo[i], P.modelo[i]);
    if (!tipo) return tirar(i);
    const s = grade.indice(P.x[i], P.z[i]);
    if (s < 0) return tirar(i);
    const sig = (assinatura(P, i) ^ Math.imul(P.tipo[i] + 1, 0x9e3779b1)) >>> 0;
    const obra = !!(P.flags[i] & PREDIO.OBRA) && !(P.flags[i] & PREDIO.OBRA_NIVEL);
    const velho = itens.get(i);
    if (velho && velho.sig === sig && velho.s === s) {
      if (velho.obra !== obra) {
        velho.obra = obra;
        corte(velho);
        // as árvores do lote só nascem com a obra pronta (o LOD1 traz a lista de novo)
        versaoItens++;
        longe.tMudou = agoraMs();
      }
      return;
    }
    if (velho && velho.s !== s) {
      const sv = setores.get(velho.s);
      if (sv) {
        sv.lista.delete(i);
        sv.versao++;
      }
    }
    const it = { i, tipo, s, sig, obra, H: COLOCAVEIS[tipo]?.altura ?? 12 };
    itens.set(i, it);
    const st = setorPara(s);
    st.lista.add(i);
    st.versao++;
    versaoItens++;
    longe.tMudou = agoraMs();
    corte(it);
  }

  /** O corte da obra no vértice (R4b): a altura do modelo enquanto a obra dura. */
  function corte(it) {
    const p = predios();
    if (!p?.alturaObra) return;
    if (it.obra) p.alturaObra(it.i, it.H);
  }

  function aplicar(d, esp) {
    const P = esp.predios;
    if (!P) return;
    const tudo = !iniciado || pedeTudo(d, 'predios');
    iniciado = true;
    if (tudo) {
      for (const i of [...itens.keys()]) tirar(i);
      for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] !== TIPO_PREDIO.ZONA) por(P, i);
      return;
    }
    if (!d.predios?.length) return;
    for (const i of d.predios) {
      if (i < P.n && P.viva[i] && P.tipo[i] !== TIPO_PREDIO.ZONA) por(P, i);
      else if (itens.has(i)) tirar(i);
    }
  }

  // ---------------------------------------------------------------------------------------------- pedidos

  function listaDe(idxs) {
    const out = [];
    for (const i of idxs) {
      const it = itens.get(i);
      if (it) out.push({ i, tipo: it.tipo });
    }
    out.sort((a, b) => a.i - b.i);
    return out;
  }

  function pedir(dados, transferir) {
    if (oficina.worker) return oficina.pedir('colocavel', dados, { chave: dados.chave, transferir });
    // sem worker: o gerador já está aqui (este módulo veio sob demanda), na thread principal
    return Promise.resolve().then(() => gerarColocaveis(dados));
  }

  function pedirSetor(st) {
    const P = ctx.sim.espelho.predios;
    const lista = listaDe(st.lista);
    const versao = st.versao;
    const { dados, transferir } = pedidoColocaveis(P, lista, { ox: st.x0, oz: st.z0, lod: 0, detalhe });
    st.pedido = versao;
    noAr++;
    const det = detalhe;
    pedir({ ...dados, chave: st.s }, transferir).then((r) => {
      noAr--;
      fila.push({ tipo: 'lod0', st, r, lista, versao, det });
    });
  }

  function pedirLongo() {
    const P = ctx.sim.espelho.predios;
    const lista = listaDe(itens.keys());
    const versao = versaoItens;
    longe.pedida = versao;
    longe.pendente = true;
    longe.tPedido = agoraMs();
    const { dados, transferir } = pedidoColocaveis(P, lista, { ox: 0, oz: 0, lod: 1, detalhe, semArvores: (i) => !!itens.get(i)?.obra });
    const det = detalhe;
    pedir({ ...dados, chave: -1 }, transferir).then((r) => {
      longe.pendente = false;
      fila.push({ tipo: 'lod1', r, lista, versao, det });
    });
  }

  // ---------------------------------------------------------------------------------------------- respostas

  function soltarLod0(st) {
    if (!st.lod0) return;
    cena.remove(st.lod0.mesh);
    st.lod0.mesh.geometry.dispose();
    st.lod0 = null;
  }

  function receberLod0({ st, r, lista, versao, det }) {
    if (det !== detalhe || !setores.has(st.s)) return;
    soltarLod0(st);
    const m = r.malhas?.[0];
    if (!m) {
      st.lod0 = { mesh: new THREE.Object3D(), versao, tris: 0, bytes: 0 };
      return;
    }
    const mesh = posicionar(new THREE.Mesh(geometriaQuantizada(m), material), m, st.x0, st.z0);
    mesh.name = `colocaveis:lod0:${st.s}`;
    medidas.familia(mesh, 'colocaveis');
    mesh.visible = false;
    cena.add(mesh);
    st.lod0 = { mesh, versao, tris: m.tris, bytes: bytesDe(m) };
    guardarCaixas(lista, r.caixas);
  }

  function guardarCaixas(lista, cx) {
    if (!cx) return;
    lista.forEach(({ i }, k) => {
      const c = cx.subarray(CAIXA_C * k, CAIXA_C * k + 6);
      caixas.set(i, Float32Array.from(c));
      const it = itens.get(i);
      if (it && Number.isFinite(c[5]) && c[5] > 0) {
        const H = c[5];
        if (Math.abs(H - it.H) > 0.01) {
          it.H = H;
          corte(it);
        }
      }
    });
    // a altura dos setores (distância e descarte) pelas caixas
    for (const st of setores.values()) {
      let y1 = -Infinity;
      for (const i of st.lista) {
        const c = caixas.get(i);
        const P = ctx.sim.espelho.predios;
        if (c && i < P.n) y1 = Math.max(y1, P.y[i] + c[5]);
      }
      if (Number.isFinite(y1)) st.ymax = y1;
    }
  }

  function receberLod1({ r, lista, versao, det }) {
    if (det !== detalhe) return;
    const velhoTudo = longe.geoTudo;
    const velhaVis = longe.mesh?.geometry;
    if (longe.sombra) ctx.sombra.soltar(longe.sombra);
    longe.faixas.clear();
    const m = r.malhas?.[0];
    if (!m) {
      if (longe.mesh) {
        cena.remove(longe.mesh);
        longe.mesh = null;
      }
      longe.sombra = null;
      longe.geoTudo = null;
      longe.indices = null;
      longe.tris = 0;
      longe.bytes = 0;
    } else {
      const indices = m.indices.slice();
      const geoTudo = geometriaQuantizada(m);
      const geoVis = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(geoTudo.attributes)) geoVis.setAttribute(k, a);
      geoVis.boundingSphere = geoTudo.boundingSphere;
      geoVis.boundingBox = geoTudo.boundingBox;
      const ind = new THREE.BufferAttribute(indices.slice(), 1);
      ind.setUsage(THREE.DynamicDrawUsage);
      geoVis.setIndex(ind);
      longe.indices = indices;
      if (!longe.mesh) {
        longe.mesh = new THREE.Mesh(geoVis, material);
        longe.mesh.name = 'colocaveis:lod1';
        medidas.familia(longe.mesh, 'colocaveis');
        cena.add(longe.mesh);
      } else longe.mesh.geometry = geoVis;
      posicionar(longe.mesh, m, 0, 0);
      // a sombra própria (D43): o LOD1 inteiro, com o índice completo
      const fonte = posicionar(new THREE.Mesh(geoTudo, material), m, 0, 0);
      fonte.name = 'colocaveis:sombra';
      longe.sombra = fonte;
      medidas.familia(ctx.sombra.projetor(fonte), 'sombra');
      longe.geoTudo = geoTudo;
      longe.tris = m.tris;
      longe.bytes = bytesDe(m);
      lista.forEach(({ i }, k) => longe.faixas.set(i, [r.faixas[2 * k], r.faixas[2 * k + 1]]));
      guardarCaixas(lista, r.caixas);
    }
    velhoTudo?.dispose();
    if (velhaVis && velhaVis !== longe.mesh?.geometry) velhaVis.dispose();
    plantar(r.arvores);
    longe.versao = versao;
    longe.chave = '';
    ctx.sombra.marcar();
  }

  /** As árvores dos lotes (do LOD1, no espaço do mundo) na vegetação da R2b, com as espécies dela. */
  function plantar(A) {
    const veg = ctx.vegetacao;
    if (!veg?.plantar) return;
    const lista = [];
    for (let k = 0; A && k + PASSO_ARV <= A.length; k += PASSO_ARV) {
      lista.push({ x: A[k], y: A[k + 1], z: A[k + 2], especie: ESPECIES_ARVORE[A[k + 3]] ?? 'oiti', altura: A[k + 4], largura: A[k + 5] });
    }
    veg.plantar('colocaveis', lista);
    arvores = lista.length;
  }

  // ---------------------------------------------------------------------------------------------- quadro

  const cam = new THREE.Vector3();

  /** O índice visível do LOD1: tudo menos os colocáveis dos setores no LOD0 de perto. */
  function filtrar(perto) {
    if (!longe.mesh || !longe.indices) return;
    const chave = [...perto].sort((a, b) => a - b).join(',');
    if (chave === longe.chave) return;
    longe.chave = chave;
    const fora = new Set();
    for (const s of perto) for (const i of setores.get(s)?.lista ?? []) fora.add(i);
    const ind = longe.mesh.geometry.index;
    const dst = ind.array;
    let n = 0;
    if (!fora.size) {
      dst.set(longe.indices);
      n = longe.indices.length;
    } else {
      for (const [i, [a, c]] of longe.faixas) {
        if (fora.has(i)) continue;
        dst.set(longe.indices.subarray(a, a + c), n);
        n += c;
      }
    }
    ind.clearUpdateRanges();
    ind.addUpdateRange(0, Math.max(1, n));
    ind.needsUpdate = true;
    longe.mesh.geometry.setDrawRange(0, n);
    longe.mesh.visible = n > 0;
  }

  function passo({ pedidos0 = 1 } = {}) {
    quadros++;
    while (fila.length) {
      const x = fila.shift();
      if (x.tipo === 'lod0') receberLod0(x);
      else receberLod1(x);
    }
    // LOD1 da cidade: depois de uma mudança, junta por ESPERA_LOD1 e pede tudo de novo
    const t = agoraMs();
    if (!longe.pendente && longe.pedida !== versaoItens && t - longe.tMudou >= ESPERA_LOD1) pedirLongo();
    // LOD0 por setor
    ctx.camera.getWorldPosition(cam);
    const alcance = Math.max(200, ctx.perfil?.lod0 ?? 350);
    const perto = [];
    let pedidos = 0;
    for (const st of setores.values()) {
      if (!st.lista.size) {
        soltarLod0(st);
        continue;
      }
      st.dist = distCaixa(cam.x, cam.y, cam.z, st.x0, st.ymin, st.z0, st.x0 + LADO_SETOR, st.ymax, st.z0 + LADO_SETOR);
      st.quer = st.dist < alcance * (st.quer ? 1 + HISTERESE : 1);
      if (!st.quer) {
        if (st.lod0) st.lod0.mesh.visible = false;
        continue;
      }
      st.usado = quadros;
      if ((!st.lod0 || st.lod0.versao !== st.versao) && st.pedido !== st.versao && noAr < NO_AR && pedidos < pedidos0) {
        pedirSetor(st);
        pedidos++;
      }
      const ok = st.lod0 && st.lod0.versao === st.versao;
      if (st.lod0) st.lod0.mesh.visible = !!ok;
      if (ok) perto.push(st.s);
    }
    filtrar(perto);
    // cache: solta os LOD0 mais antigos fora da vista
    const guardados = [...setores.values()].filter((st) => st.lod0 && !st.quer).sort((a, b) => b.usado - a.usado);
    for (const st of guardados.slice(CACHE_LOD0)) soltarLod0(st);
    // setores vazios saem
    for (const [s, st] of setores) if (!st.lista.size && !st.lod0) setores.delete(s);
  }

  function prontoAgora() {
    if (fila.length || noAr || longe.pendente) return false;
    if (longe.pedida !== versaoItens) return false;
    for (const st of setores.values()) if (st.quer && st.lista.size && (!st.lod0 || st.lod0.versao !== st.versao)) return false;
    return true;
  }

  // troca de qualidade: o detalhe novo refaz tudo
  const desligar = ctx.ouvir?.('qualidade', () => {
    const novo = porPerfil(DETALHE_COLOCAVEIS, ctx.perfil);
    if (novo === detalhe) return;
    detalhe = novo;
    for (const st of setores.values()) {
      soltarLod0(st);
      st.versao++;
      st.pedido = 0;
    }
    versaoItens++;
    longe.tMudou = -Infinity;
  });

  // ---------------------------------------------------------------------------------------------- api

  const dom = {
    nome: 'colocaveis',
    material,
    aplicar,
    quadro() {
      passo();
    },
    pronto: prontoAgora,
    /** Cenas e capturas: lê o espelho e espera a oficina entregar o LOD1 e os LOD0 que a vista pede. */
    async preparar({ teto = 60000 } = {}) {
      const t0 = agoraMs();
      ctx.cameraApi?.atualizar?.(t0);
      if (!iniciado) aplicar(ctx.sim.mudancas.desde(-1), ctx.sim.espelho);
      longe.tMudou = -Infinity;
      while (agoraMs() - t0 < teto) {
        passo({ pedidos0: 8 });
        if (prontoAgora()) break;
        if (oficina.worker) await new Promise((ok) => setTimeout(ok, 20));
        else await Promise.resolve();
      }
      passo({ pedidos0: 0 });
      return dom.medidas();
    },
    medidas() {
      let tris0 = 0;
      let bytes = longe.bytes;
      let lod0 = 0;
      for (const st of setores.values()) {
        if (!st.lod0) continue;
        bytes += st.lod0.bytes;
        if (st.lod0.mesh.visible) {
          tris0 += st.lod0.tris;
          lod0++;
        }
      }
      const vis = longe.mesh?.visible ? (longe.mesh.geometry.drawRange.count === Infinity ? longe.tris : longe.mesh.geometry.drawRange.count / 3) : 0;
      return { itens: itens.size, setores: setores.size, lod0, trisLod0: tris0, trisLod1: Math.round(vis), trisLod1Total: longe.tris, arvores, memoriaMB: +(bytes / 1048576).toFixed(2), detalhe };
    },
    /** Caixa de um colocável no espaço do lote ([x0, z0, x1, z1, y0, y1]) ou null. */
    caixa: (i) => (caixas.has(i) ? Array.from(caixas.get(i)) : null),
    /**
     * Geometria do LOD1 de um tipo (no espaço do lote, base em y = 0), para o fantasma da ferramenta de colocar (X2):
     * posição Float32 e normal, sem os atributos da fachada.
     */
    silhueta(tipo, nivel = 1) {
      const K = new Construtor(256);
      K.predio(0, 0, 0, 0, 0);
      const peg = COLOCAVEIS[tipo]?.pegada ?? [24, 24];
      modelar(K, { tipo, w: peg[0], d: peg[1], nivel, lod: 1, detalhe });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(K.pos.slice(0, 3 * K.nv), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(K.nor.slice(0, 3 * K.nv), 3));
      g.setIndex(new THREE.BufferAttribute(K.idx.slice(0, K.ni), 1));
      return g;
    },
    descartar() {
      desligar?.();
      for (const st of setores.values()) soltarLod0(st);
      if (longe.mesh) cena.remove(longe.mesh);
      if (longe.sombra) ctx.sombra.soltar(longe.sombra);
      longe.mesh?.geometry.dispose();
      longe.geoTudo?.dispose();
      ctx.quadro?.aquecer?.delete?.(aquecer);
      aquecer.geometry.dispose();
      ctx.vegetacao?.plantar?.('colocaveis', null);
    },
  };
  return dom;
}
