// Caminhões das entregas (espelho.entregas, D47; R3b): o caminhão da Holding (ou o do frete contratado, nas entregas
// visuais do Depósito e da importação) pelo `caminho` da entrega, no ritmo da viagem da simulação.
//   rota      cada passo do caminho (aresta e sentido; ~e é b para a) com o comprimento e o tempo dele na velocidade
//             do caminhão (a da via vezes 0,9, a mesma conta de sim/holding/logistica.js); o tempo que sobra da viagem
//             (a ida do armazém até o nó e do nó ao canteiro) fica metade antes e metade depois da rua
//   na rua    perto da câmera o caminhão anda no trânsito (trafego.seguir): fila, semáforo e a vez nos cruzamentos,
//             acelerando um pouco se a viagem está atrasada; longe dele, ou numa curva de nó, vai na posição da
//             viagem, pela faixa da direita
//   corpo     pela carga (geracao/caminhoes.js, sob demanda): basculante com o monte do material, carroceria com os
//             paletes (um por unidade), betoneira com o balão girando, baú; cabine da cor da Holding
// Uma chamada por carroceria e LOD que aparece (família 'vida').
import * as THREE from 'three';
import { perfilVia, ALTURA, alturaNaSecao } from '../geracao/perfilVia.js';
import { faixasOrdenadas, naFaixa, curvaEntre, pontoCurva, fimDaFaixa, inicioDaFaixa, matrizGiroY } from './trafego.js';
import { alturaEm } from '../../comum/altura.js';
import { porPerfil } from '../motor/perfis.js';

/** Alcance do desenho (m da câmera) e do LOD0, por perfil. */
export const PERFIL_CAMINHOES = Object.freeze({
  ultra: { raio: 3000, lod0: 160, max: 64 },
  alta: { raio: 2400, lod0: 120, max: 48 },
  media: { raio: 1600, lod0: 90, max: 32 },
  leve: { raio: 900, lod0: 60, max: 16 },
});
/** Carrocerias (a ordem de geracao/caminhoes.js, CORPOS). */
export const CORPOS = Object.freeze(['basculante', 'carroceria', 'betoneira', 'bau']);
/** Medidas do caminhão no trânsito (as de geracao/caminhoes.js, CAMINHAO; o teste confere). */
export const MODELO_CAMINHAO = Object.freeze({ c: 8.6, l: 2.5 });
/** Fator da velocidade do caminhão sobre a da via (data/holding.js, PRODUCAO.caminhao.fatorVelocidade). */
export const FATOR_VELOCIDADE = 0.9;
/** Cabine do frete contratado (as entregas visuais). */
const BRANCO = [236, 236, 232];

/** Os passos de um caminho de entrega: [{ e, sentido }] (idx para a → b, ~idx para b → a). */
export function passosDoCaminho(caminho) {
  return Array.from(caminho ?? [], (r) => (r < 0 ? { e: ~r, sentido: -1 } : { e: r, sentido: 1 }));
}

/**
 * Rota de uma entrega sobre a rede do render: os passos, as arestas, o comprimento acumulado (cum) e o tempo
 * acumulado (s) de cada passo na velocidade do caminhão. null se uma aresta não existe ou o caminho não emenda.
 */
export function planoDaRota(rede, caminho) {
  const passos = passosDoCaminho(caminho);
  if (!passos.length) return null;
  const ars = [];
  const cum = [0];
  const tempos = [0];
  let no = null;
  for (const p of passos) {
    const ar = rede.arestas.get(p.e);
    if (!ar) return null;
    const ini = p.sentido > 0 ? ar.a : ar.b;
    if (no !== null && ini !== no) return null;
    no = p.sentido > 0 ? ar.b : ar.a;
    ars.push(ar);
    cum.push(cum[cum.length - 1] + ar.L);
    tempos.push(tempos[tempos.length - 1] + ar.L / ((perfilVia(ar.tipo).velocidade / 3.6) * FATOR_VELOCIDADE));
  }
  return { passos, ars, cum, tempos, L: cum[cum.length - 1], T: tempos[tempos.length - 1], curvas: [], versao: rede.versao };
}

/**
 * Onde a viagem está (m ao longo da rota) no tique `agora` (com a fração), ou null antes de entrar na rua e depois de
 * sair dela. O tempo da viagem que passa do da rua fica metade antes e metade depois (as pontas fora da via).
 */
export function distanciaDaViagem(ent, pl, agora) {
  const dur = Math.max(1, ent.tFim - ent.tIni);
  let tr;
  if (pl.T <= dur) tr = agora - (ent.tIni + (dur - pl.T) / 2);
  else tr = ((agora - ent.tIni) / dur) * pl.T;
  if (!(tr >= 0) || tr > pl.T) return null;
  let k = 0;
  while (k + 1 < pl.passos.length && pl.tempos[k + 1] <= tr) k++;
  const f = (tr - pl.tempos[k]) / Math.max(1e-9, pl.tempos[k + 1] - pl.tempos[k]);
  return pl.cum[k] + Math.min(1, Math.max(0, f)) * (pl.cum[k + 1] - pl.cum[k]);
}

/** Onde a faixa (da direita) de um passo começa e acaba, em metros desde o nó de onde o passo sai. */
const iniLoc = (ar, sentido) => (sentido > 0 ? ar.cIni : ar.cFim);
const fimLoc = (ar, sentido) => (sentido > 0 ? ar.L - ar.cFim : ar.L - ar.cIni);
const faixaDireita = (ar, sentido) => faixasOrdenadas(ar.tipo, ar.mao, sentido).at(-1) ?? null;

/**
 * Pose na posição da viagem (d m ao longo da rota): na faixa da direita, ou na curva do nó entre dois passos.
 * out: { x, z, hx, hz, k, curva, ar, u }.
 */
export function poseDaViagem(pl, d, out = {}) {
  let k = 0;
  while (k + 1 < pl.passos.length && pl.cum[k + 1] <= d) k++;
  const ar = pl.ars[k];
  const { sentido } = pl.passos[k];
  const f = faixaDireita(ar, sentido);
  const u = f?.u ?? 0;
  const loc = Math.max(0, Math.min(ar.L, d - pl.cum[k]));
  const curva = (j) => {
    if (!pl.curvas[j]) {
      const a = pl.ars[j];
      const b = pl.ars[j + 1];
      const sa = pl.passos[j].sentido;
      const sb = pl.passos[j + 1].sentido;
      pl.curvas[j] = curvaEntre(a, faixaDireita(a, sa)?.u ?? 0, sa, b, faixaDireita(b, sb)?.u ?? 0, sb);
    }
    return pl.curvas[j];
  };
  out.k = k;
  out.ar = ar;
  out.u = u;
  out.curva = false;
  const i0 = iniLoc(ar, sentido);
  const i1 = fimLoc(ar, sentido);
  if (loc < i0 && k > 0) {
    // na curva do nó, vindo do passo de antes
    const a = pl.ars[k - 1];
    const sa = pl.passos[k - 1].sentido;
    const ini = pl.cum[k - 1] + fimLoc(a, sa);
    const t = (d - ini) / Math.max(0.1, pl.cum[k] + i0 - ini);
    pontoCurva(curva(k - 1).p, Math.min(1, Math.max(0, t)), out);
    out.curva = true;
    return out;
  }
  if (loc > i1 && k + 1 < pl.passos.length) {
    const ini = pl.cum[k] + i1;
    const t = (d - ini) / Math.max(0.1, pl.cum[k + 1] + iniLoc(pl.ars[k + 1], pl.passos[k + 1].sentido) - ini);
    pontoCurva(curva(k).p, Math.min(1, Math.max(0, t)), out);
    out.curva = true;
    return out;
  }
  const lc = Math.min(i1, Math.max(i0, loc));
  naFaixa(ar, u, sentido > 0 ? lc : ar.L - lc, sentido, out);
  out.s = sentido > 0 ? lc : ar.L - lc;
  return out;
}

// ------------------------------------------------------------------------------------------------ material

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`caminhão: shader sem '${alvo}'`);
  return src.replace(alvo, novo);
}

/** Material dos caminhões: as partes e a carga no shader, a cabine e a carga da instância (SH: geracao/caminhoes.js). */
export function criarMaterialCaminhao(ganchos, U, SH) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0 });
  m.name = 'caminhao';
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    let vs = s.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.CAMINHAO_VERTICE_PARS}`);
    vs = trocar(vs, '#include <beginnormal_vertex>', SH.CAMINHAO_VERTICE_NORMAL);
    vs = trocar(vs, '#include <begin_vertex>', SH.CAMINHAO_VERTICE_MAIN);
    let fs = s.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.CAMINHAO_FRAGMENTO_PARS}`);
    fs = trocar(fs, '#include <color_fragment>', SH.CAMINHAO_FRAGMENTO_COR);
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.CAMINHAO_FRAGMENTO_RUGOSIDADE);
    fs = trocar(fs, '#include <metalnessmap_fragment>', SH.CAMINHAO_FRAGMENTO_METAL);
    fs = trocar(fs, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SH.CAMINHAO_FRAGMENTO_EMISSIVO}`);
    s.vertexShader = vs;
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'caminhao-2';
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada'));
}

/** Geometria de um caminhão ({ posicao, normal, parte, indices }) ou o lugar dela até o gerador chegar. */
function geometriaCaminhao(g, v) {
  g.setAttribute('position', new THREE.BufferAttribute(v ? v.posicao : new Float32Array(9), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(v ? v.normal : new Float32Array(9), 3));
  g.setAttribute('aParte2', new THREE.BufferAttribute(v ? v.parte : new Float32Array(6), 2));
  g.setIndex(new THREE.BufferAttribute(v ? v.indices : Uint16Array.of(0, 1, 2), 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return g;
}

const corDe = (hex) => {
  const c = parseInt(String(hex ?? '#c9a86a').replace('#', ''), 16);
  return Number.isFinite(c) ? [(c >> 16) & 255, (c >> 8) & 255, c & 255] : [201, 168, 106];
};

// ------------------------------------------------------------------------------------------------ domínio

function criarCaminhoes(ctx) {
  const { cena, medidas } = ctx;
  const U = {
    gCamNoite: { value: 0 },
    gCamTempo: { value: 0 },
    gCamTambor: { value: new THREE.Vector4(1.95, 1.85, 2.55, -3.6) },
    gCamPiso: { value: 1.28 },
  };
  let material = null;
  const perfil = () => porPerfil(PERFIL_CAMINHOES, ctx.perfil);
  let mod = null;
  const malhas = [];
  function montarMalhas() {
    for (const M of malhas) {
      cena.remove(M.mesh);
      M.mesh.geometry.dispose();
      M.mesh.dispose();
    }
    malhas.length = 0;
    if (!mod) return;
    const cap = perfil().max;
    CORPOS.forEach((corpo, ci) => {
      for (const lod of [0, 1]) {
        const g = geometriaCaminhao(new THREE.BufferGeometry(), mod.malhaCaminhao(corpo, lod));
        const cab = new THREE.InstancedBufferAttribute(new Uint8Array(cap * 4), 4, false);
        const carga = new THREE.InstancedBufferAttribute(new Uint8Array(cap * 4), 4, false);
        cab.setUsage(THREE.DynamicDrawUsage);
        carga.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('aCab', cab);
        g.setAttribute('aCarga', carga);
        const mesh = new THREE.InstancedMesh(g, material, cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `caminhoes:${corpo}:${lod}`;
        medidas.familia(mesh, 'vida');
        cena.add(mesh);
        malhas.push({ ci, lod, mesh, cab, carga, cap, tris: mod.malhaCaminhao(corpo, lod).tris });
      }
    });
  }
  let perfilMontado = ctx.perfil.id;
  // modelo e GLSL sob demanda; o programa compila no aquecimento da carga (D66). Chegando depois da rodada final
  // (máquina ocupada), pede uma rodada a mais, como as árvores
  const fonteAquecer = () => malhas.map((M) => M.mesh);
  const carga = import('../geracao/caminhoes.js').then((m) => {
    mod = m;
    material = criarMaterialCaminhao(ctx.ganchos, U, m);
    U.gCamTambor.value.set(m.TAMBOR.y0, m.TAMBOR.z0, m.TAMBOR.y1, m.TAMBOR.z1);
    U.gCamPiso.value = m.CAMINHAO.piso;
    perfilMontado = ctx.perfil.id;
    montarMalhas();
    const aq = ctx.quadro?.aquecer;
    if (aq?.pronto) {
      aq.delete?.(fonteAquecer);
      aq.add?.(fonteAquecer);
    }
    return m;
  });
  // a falha do import não prende o aquecimento da carga (motor/quadro.js, AQUECER.sobDemanda): pronto() conta como chegada
  let falhou = false;
  carga.catch((e) => {
    falhou = true;
    console.error('caminhoes: o modelo dos caminhões não carregou', e);
  });

  const planos = new Map(); // id da entrega → { pl, caminho }
  const conhecidos = new Map(); // id → { item, n, visual } (o caminhão que ainda anda depois de a entrega sair)
  const estados = new Map(); // id → a última pose (testes)
  let tAnt = null;
  let tempo = 0;
  let animar = null;
  // cenas: entregas de mostra (só desenho, como as da simulação) e o relógio da cena com a simulação parada
  let amostras = [];
  let tCena = 0;
  let desenhados = 0;
  let naRua = 0;
  const pose = { x: 0, z: 0, hx: 1, hz: 0 };

  function planoDe(rede, ent) {
    const ja = planos.get(ent.id);
    if (ja && ja.caminho === ent.caminho && ja.pl?.versao === rede.versao) return ja.pl;
    const pl = planoDaRota(rede, ent.caminho);
    planos.set(ent.id, { pl, caminho: ent.caminho });
    return pl;
  }

  const dom = {
    nome: 'caminhoes',
    quadro(tMs, c) {
      const vias = c.dominio('vias');
      if (!vias?.rede || !mod) return;
      if (perfilMontado !== c.perfil.id) {
        perfilMontado = c.perfil.id;
        montarMalhas();
      }
      const esp = c.sim.espelho;
      const T = esp.terreno;
      const P = perfil();
      const traf = c.dominio('trafego');
      const t = esp.tempo;
      const anda = animar ?? (t?.velocidade ?? 1) > 0;
      const dt = tAnt === null ? 0 : (Math.min(100, tMs - tAnt) / 1000) * (anda ? Math.max(1, t?.mult ?? 1) : 0);
      tAnt = tMs;
      tempo += dt;
      if (animar === true && !((t?.velocidade ?? 0) > 0)) tCena += dt;
      U.gCamTempo.value = tempo;
      U.gCamNoite.value = Math.min(1, Math.max(0, 1 - (c.sol?.dia ?? 1) * 1.4));
      const agora = (t?.tique ?? 0) + (t?.frac ?? 0) + tCena;
      const corHolding = corDe(esp.holding?.cor);
      const cp = c.camera.position;
      const cont = malhas.map(() => 0);
      const vistos = new Set();
      desenhados = 0;
      naRua = 0;
      const desenhar = (id, info, x, y, z, hx, hz, freio) => {
        const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z);
        if (d > P.raio) return;
        const cg = mod.cargaDe(info.item);
        const ci = CORPOS.indexOf(cg.corpo);
        const k = ci * 2 + (d < P.lod0 ? 0 : 1);
        const M = malhas[k];
        const j = cont[k];
        if (j >= M.cap) return;
        cont[k]++;
        desenhados++;
        matrizGiroY(M.mesh.instanceMatrix.array, j * 16, x, y, z, hx, hz);
        const cab = info.visual ? BRANCO : corHolding;
        const luz = (U.gCamNoite.value > 0.25 ? 1 : 0) | (freio ? 2 : 0);
        M.cab.array.set([cab[0], cab[1], cab[2], luz + 4 * (id % 64)], 4 * j);
        M.carga.array.set([cg.cor[0], cg.cor[1], cg.cor[2], Math.max(0, Math.min(10, Math.round(info.n ?? 10)))], 4 * j);
      };
      for (const ent of amostras.length ? [...(esp.entregas ?? []), ...amostras] : esp.entregas ?? []) {
        if (!ent?.caminho?.length) continue;
        vistos.add(ent.id);
        const info = { item: ent.item, n: ent.n, visual: !!ent.visual };
        conhecidos.set(ent.id, info);
        if (traf?.chegou?.(ent.id)) continue; // o caminhão já chegou aqui; a simulação ainda conta a viagem
        const pl = planoDe(vias.rede, ent);
        if (!pl) continue;
        const d = distanciaDaViagem(ent, pl, agora);
        let car = traf?.externo?.(ent.id) ?? null;
        if (d === null && !car) continue;
        // perto da câmera, no trânsito; longe, ou numa curva de nó, na posição da viagem. A viagem da simulação
        // acabou e o caminhão ainda está na rua (atrasado nos semáforos): termina a rota
        car = traf?.seguir?.(ent.id, pl, d ?? pl.L, MODELO_CAMINHAO) ?? car;
        if (car) {
          naRua++;
          estados.set(ent.id, { agente: true, k: car.externo?.k ?? 0, x: car.x, z: car.z, e: car.e, curva: !!car.curva, d });
          desenhar(ent.id, info, car.x, car.y, car.z, car.hx, car.hz, car.freio);
          continue;
        }
        poseDaViagem(pl, d, pose);
        const P2 = perfilVia(pose.ar.tipo);
        const dy = pose.curva ? ALTURA.pista + 0.03 : alturaNaSecao(P2, pose.u);
        const y = pose.ar.ponte && !pose.curva ? pose.ar.cotas[0] + ((pose.ar.cotas[1] - pose.ar.cotas[0]) * pose.s) / pose.ar.L + dy - ALTURA.pista : (T ? alturaEm(T, pose.x, pose.z) : 0) + dy;
        estados.set(ent.id, { agente: false, k: pose.k, x: pose.x, z: pose.z, e: pose.ar.e, curva: pose.curva, d });
        desenhar(ent.id, info, pose.x, y, pose.z, pose.hx, pose.hz, false);
      }
      // a entrega saiu do espelho: o caminhão que ainda anda na rua termina a rota; os outros somem
      for (const [id, info] of conhecidos) {
        if (vistos.has(id)) continue;
        const car = traf?.externo?.(id);
        const pl = planos.get(id)?.pl;
        if (!car || !pl) {
          conhecidos.delete(id);
          planos.delete(id);
          estados.delete(id);
          traf?.esquecer?.(id);
          continue;
        }
        traf.seguir(id, pl, pl.L, MODELO_CAMINHAO);
        naRua++;
        desenhar(id, info, car.x, car.y, car.z, car.hx, car.hz, car.freio);
      }
      malhas.forEach((M, k) => {
        const n = cont[k];
        M.mesh.count = n;
        M.mesh.visible = n > 0;
        if (!n) return;
        const im = M.mesh.instanceMatrix;
        im.clearUpdateRanges();
        im.addUpdateRange(0, n * 16);
        im.needsUpdate = true;
        for (const a of [M.cab, M.carga]) {
          a.clearUpdateRanges();
          a.addUpdateRange(0, n * 4);
          a.needsUpdate = true;
        }
      });
    },
    animar(b) {
      animar = b;
    },
    preparar: () => carga,
    /** O modelo e o material chegaram, ou falharam (o aquecimento da carga espera por isso). */
    pronto: () => !!mod || falhou,
    /** Cenas: entregas de mostra ([{ id, item, n, caminho, tIni, tFim, visual }]), desenhadas como as da simulação. */
    amostras(lista) {
      amostras = lista ?? [];
    },
    /** O relógio das viagens (tique, com a fração e o da cena). */
    agora(c = ctx) {
      const t = c.sim.espelho.tempo;
      return (t?.tique ?? 0) + (t?.frac ?? 0) + tCena;
    },
    /** Pose do caminhão de uma entrega (testes e a cena): agente no trânsito ou na posição da viagem. */
    estado: (id) => estados.get(id) ?? null,
    medidas() {
      let tris = 0;
      for (const M of malhas) tris += M.mesh.count * M.tris;
      return { entregas: conhecidos.size, naRua, desenhados, tris };
    },
    descartar() {
      ctx.quadro?.aquecer?.delete?.(fonteAquecer);
      for (const M of malhas) {
        cena.remove(M.mesh);
        M.mesh.geometry.dispose();
        M.mesh.dispose();
      }
      material?.dispose();
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('caminhoes', criarCaminhoes);
}
