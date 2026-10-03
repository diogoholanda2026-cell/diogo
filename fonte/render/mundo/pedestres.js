// Gente nas calçadas (desenho do render 8, R3b): uma amostra perto da câmera, pela atividade dos prédios.
//   frentes   cada prédio vivo (sem obra, não abandonado) põe gente na calçada da frente dele, pela atividade (os
//             moradores, quem trabalha e os clientes do comércio, espelho.predios) e pela hora do céu; a gente nasce e
//             some nas portas (as células da frente)
//   andar     pela faixa de andar da calçada (longe do meio-fio, dos postes e das árvores), mantendo a direita de quem
//             anda; na esquina vira para a calçada do outro braço, ou atravessa pela faixa de pedestres: no semáforo,
//             no vermelho dos carros daquele braço, se dá tempo; sem semáforo, quando nenhum carro vem. Enquanto
//             alguém atravessa, o carro espera (trafego.js pergunta faixaOcupada)
//   grupos    um em cada cinco anda em dupla; alguns ficam parados conversando na porta
//   corpo     a figura de geracao/pessoas.js (sob demanda) com a caminhada no vértice (shaders/pessoa.glsl.js); a fase
//             do passo anda com a distância; altura, roupa, tom de pele e cabelo de cada um pela semente
// Tetos por perfil (Média 420, Alta e o 'pc' 900), só até o raio da câmera; uma chamada por LOD (família 'vida').
import * as THREE from 'three';
import { estacao, hashF } from '../geracao/malhaVia.js';
import { perfilVia, ALTURA, alturaNaSecao } from '../geracao/perfilVia.js';
import { grupoSemaforo, defasagemSemaforo } from '../geracao/cruzamento.js';
import { restaVermelho, pontoCurva, matrizGiroY } from './trafego.js';
import { alturaEm } from '../../comum/altura.js';
import { maisPerto, arcoDoT } from '../../comum/bezier.js';
import { CELULA, PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { porPerfil } from '../motor/perfis.js';

/** Tetos por perfil (desenho do render 2.10): pessoas, raio da amostra em volta do alvo e o alcance do LOD0. */
export const PERFIL_PEDESTRES = Object.freeze({
  ultra: { pessoas: 1600, raio: 250, lod0: 45 },
  alta: { pessoas: 900, raio: 250, lod0: 38 },
  media: { pessoas: 420, raio: 200, lod0: 28 },
  leve: { pessoas: 150, raio: 120, lod0: 18 },
});

/** Tipos de via com faixa de pedestres no cruzamento (os mesmos de vias.js). */
const COM_ZEBRA = new Set(['rua', 'ruaMao', 'avenida', 'avenidaG']);
/** Distância da boca ao meio da faixa de pedestres (m; a zebra do shader vai de 0,8 a 4,8). */
export const MEIO_ZEBRA = 2.8;
/** Faixa de andar na calçada: do meio-fio (m), longe dos postes (0,55) e das árvores (1,0). */
export const FAIXA_ANDAR = Object.freeze({ de: 1.55, folgaFora: 0.35 });

/** Fração da atividade na calçada pela hora do céu, por família de zona (0 a 1). */
export function fatorRua(fam, h) {
  const g = (c, s) => Math.exp(-((((h - c + 36) % 24) - 12) ** 2) / (2 * s * s));
  if (fam === 'res') return Math.min(1, 0.04 + Math.max(0.7 * g(7.5, 1.3), g(18.5, 2.2), 0.45 * g(12.5, 3), 0.4 * g(15.5, 3)));
  if (fam === 'com') return Math.min(1, 0.04 + Math.max(0.55 * g(9, 1.5), g(12.5, 2.2), 0.9 * g(17.5, 2.6), 0.55 * g(20.5, 1.6)));
  if (fam === 'esc') return Math.min(1, 0.02 + Math.max(0.9 * g(8.3, 1), g(12.5, 1.3), 0.9 * g(17.8, 1.2), 0.35 * g(15, 2.5)));
  return Math.min(1, 0.03 + 0.4 * Math.max(g(6, 0.8), g(14, 0.8), g(22, 0.8)));
}

/** Gente na calçada de um prédio (pessoas, sem teto): moradores, quem trabalha e os clientes do comércio. */
export function genteDoPredio(fam, moradores, empregos, h) {
  const f = fatorRua(fam, h);
  if (fam === 'res') return 0.045 * moradores * f;
  if (fam === 'com') return 0.4 * empregos * f;
  if (fam === 'esc') return 0.08 * empregos * f;
  return 0.02 * empregos * f;
}

/** u (do eixo da via) da faixa de andar, a `off` m do meio-fio, na calçada do lado (da aresta); null sem calçada. */
export function uDaCalcada(P, lado, off) {
  const c = P.calcadas.find((k) => k.lado === lado);
  if (!c) return null;
  const meioFio = lado > 0 ? c.u0 : c.u1;
  return meioFio + lado * Math.max(0.3, Math.min(off, c.largura - FAIXA_ANDAR.folgaFora));
}

/** Largura útil da faixa de andar do lado (m, a partir de FAIXA_ANDAR.de), ou 0. */
const larguraAndar = (P, lado) => {
  const c = P.calcadas.find((k) => k.lado === lado);
  return c ? Math.max(0, c.largura - FAIXA_ANDAR.folgaFora - FAIXA_ANDAR.de) : 0;
};

/** Chave numérica (nunca 0) da faixa de pedestres do braço e no nó n: sem texto novo a cada pergunta do tráfego. */
export const chaveFaixa = (n, e) => n * 1048576 + e + 1;

/** Boca de uma aresta num nó: s onde a calçada acaba (a do fim, se a aresta chega ao nó pelo b). */
const bocaDe = (ar, noFim) => (noFim ? ar.L - ar.cFim : ar.cIni);

// ------------------------------------------------------------------------------------------------ material

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`pessoa: shader sem '${alvo}'`);
  return src.replace(alvo, novo);
}

/**
 * Material `pessoa`: a caminhada e a cor no vértice sobre o MeshStandardMaterial com os ganchos. SH: os trechos de
 * shaders/pessoa.glsl.js (sob demanda, com o gerador).
 */
export function criarMaterialPessoa(ganchos, SH) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  m.name = 'pessoa';
  m.onBeforeCompile = (s) => {
    let vs = s.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.PESSOA_VERTICE_PARS}`);
    vs = trocar(vs, '#include <beginnormal_vertex>', SH.PESSOA_VERTICE_NORMAL);
    vs = trocar(vs, '#include <begin_vertex>', SH.PESSOA_VERTICE_MAIN);
    let fs = s.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.PESSOA_FRAGMENTO_PARS}`);
    fs = trocar(fs, '#include <color_fragment>', SH.PESSOA_FRAGMENTO_COR);
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.PESSOA_FRAGMENTO_RUGOSIDADE);
    s.vertexShader = vs;
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'pessoa-1';
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada'));
}

/** Geometria de uma figura ({ posicao, normal, corpo, variacao, indices }) ou o lugar dela (mínima) até o gerador chegar. */
function geometriaPessoa(g, v) {
  const nv = v ? v.posicao.length / 3 : 3;
  g.setAttribute('position', new THREE.BufferAttribute(v ? v.posicao : new Float32Array(9), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(v ? v.normal : new Float32Array(9), 3));
  g.setAttribute('aCorpo', new THREE.BufferAttribute(v ? v.corpo : new Float32Array(2 * nv), 2));
  g.setAttribute('aVar', new THREE.BufferAttribute(v ? v.variacao : new Float32Array(3 * nv), 3));
  g.setIndex(new THREE.BufferAttribute(v ? v.indices : Uint16Array.of(0, 1, 2), 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return g;
}

// ------------------------------------------------------------------------------------------------ domínio

function criarPedestres(ctx) {
  const { cena, medidas } = ctx;
  let material = null;
  const perfil = () => porPerfil(PERFIL_PEDESTRES, ctx.perfil);
  let mod = null; // geracao/pessoas.js, sob demanda
  const malhas = [];
  function montarMalhas() {
    for (const M of malhas) {
      cena.remove(M.mesh);
      M.mesh.geometry.dispose();
      M.mesh.dispose();
    }
    malhas.length = 0;
    if (!mod) return;
    const cap = Math.max(16, perfil().pessoas + 8);
    for (const lod of [0, 1]) {
      const g = geometriaPessoa(new THREE.BufferGeometry(), mod.malhaPessoa(lod));
      const pessoa = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      const roupa = new THREE.InstancedBufferAttribute(new Uint8Array(cap * 4), 4, false);
      const roupa2 = new THREE.InstancedBufferAttribute(new Uint8Array(cap * 4), 4, false);
      for (const a of [pessoa, roupa, roupa2]) a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aPessoa', pessoa);
      g.setAttribute('aRoupa', roupa);
      g.setAttribute('aRoupa2', roupa2);
      const mesh = new THREE.InstancedMesh(g, material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.name = `pessoas:${lod}`;
      medidas.familia(mesh, 'vida');
      cena.add(mesh);
      malhas.push({ lod, mesh, pessoa, roupa, roupa2, cap, tris: mod.malhaPessoa(lod).tris });
    }
  }
  let perfilMontado = ctx.perfil.id;
  // a figura e o GLSL sob demanda; o programa compila no aquecimento da carga (D66). Chegando depois da rodada final
  // (máquina ocupada), pede uma rodada a mais, como as árvores
  const fonteAquecer = () => malhas.map((M) => M.mesh);
  const carga = Promise.all([import('../geracao/pessoas.js'), import('../materiais/shaders/pessoa.glsl.js')]).then(([m, sh]) => {
    mod = m;
    material = criarMaterialPessoa(ctx.ganchos, sh);
    perfilMontado = ctx.perfil.id;
    montarMalhas();
    const aq = ctx.quadro?.aquecer;
    if (aq?.pronto) {
      aq.delete?.(fonteAquecer);
      aq.add?.(fonteAquecer);
    }
    return m;
  });

  // ---------------------------------------------------------------------------------------------- estado
  const gente = [];
  let frentes = [];
  /** As portas (s) de cada calçada com gente: aresta * 2 + (lado > 0), das frentes do momento. */
  let portas = new Map();
  let somaPeso = 0;
  let alvoFrentes = null;
  let tFrentes = -1e9;
  let seq = 1;
  let animar = null;
  let corpos = 0;
  const alvo = new THREE.Vector3();
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  const q = { x: 0, z: 0, hx: 0, hz: 0 };
  /** Faixas de pedestres com gente atravessando (chaveFaixa do nó e do braço). */
  const naFaixa = new Set();
  /** Longe da câmera (fora do LOD0): ali a figura pode sumir sem que se veja. */
  const foraDoLod0 = (p) => {
    const cp = ctx.camera.position;
    const l = perfil().lod0;
    return (p.x - cp.x) ** 2 + (p.y - cp.y) ** 2 + (p.z - cp.z) ** 2 > l * l;
  };

  /** As frentes (calçada de um lado de uma aresta) com a gente esperada e as portas, perto do alvo. */
  function montarFrentes(esp, rede, hora) {
    const C = esp.celulas;
    const Pr = esp.predios;
    frentes = [];
    somaPeso = 0;
    if (!C || !Pr) return;
    const R = perfil().raio + 40;
    const lista = [];
    const nFrente = new Map();
    for (let c = 0; c < C.n; c++) {
      if (!C.viva[c] || C.estado[c] !== CELULA.OCUPADA || C.linha[c] !== 0) continue;
      const dx = C.x[c] - alvo.x;
      const dz = C.z[c] - alvo.z;
      if (Math.abs(dx) > R || Math.abs(dz) > R || dx * dx + dz * dz > R * R) continue;
      const p = C.predio[c];
      if (p < 0 || p >= Pr.n || !Pr.viva[p] || Pr.flags[p] & (PREDIO.OBRA | PREDIO.ABANDONADO)) continue;
      nFrente.set(p, (nFrente.get(p) ?? 0) + 1);
      lista.push(c);
    }
    const mapa = new Map();
    const mp = { t: 0, d: 0, x: 0, z: 0 };
    for (const c of lista) {
      const p = C.predio[c];
      const ar = rede.arestas.get(C.aresta[c]);
      if (!ar) continue;
      const lado = C.lado[c] >= 0 ? 1 : -1;
      const P = perfilVia(ar.tipo);
      if (larguraAndar(P, lado) <= 0) continue;
      const fam = Pr.tipo[p] === TIPO_PREDIO.ZONA ? ZONAS[ZONAS_ORDEM[Pr.zona[p]]]?.familia ?? 'res' : Pr.tipo[p] === TIPO_PREDIO.SERVICO ? 'esc' : 'ind';
      const w = genteDoPredio(fam, Pr.moradores[p], Pr.empregos[p], hora) / nFrente.get(p);
      if (!(w > 0)) continue;
      maisPerto(ar.p, C.x[c], C.z[c], 0, mp);
      const s = arcoDoT(ar.tab, mp.t);
      if (s < ar.cIni + 2 || s > ar.L - ar.cFim - 2) continue;
      const k = `${ar.e}:${lado}`;
      let f = mapa.get(k);
      if (!f) mapa.set(k, (f = { e: ar.e, lado, w: 0, portas: [] }));
      f.w += w;
      f.portas.push(s);
    }
    frentes = [...mapa.values()];
    portas = new Map(frentes.map((f) => [f.e * 2 + (f.lado > 0 ? 1 : 0), f.portas]));
    for (const f of frentes) somaPeso += f.w;
    alvoFrentes = alvo.clone();
  }

  /** Uma entidade nova (uma pessoa ou uma dupla) numa porta. */
  function nascer(rede, h0) {
    if (!frentes.length || somaPeso <= 0 || !mod) return null;
    const id = seq++;
    let a = hashF(id, 1, h0) * somaPeso;
    let f = frentes[frentes.length - 1];
    for (const x of frentes) {
      a -= x.w;
      if (a < 0) {
        f = x;
        break;
      }
    }
    const ar = rede.arestas.get(f.e);
    if (!ar) return null;
    const P = perfilVia(ar.tipo);
    const s = f.portas[Math.floor(hashF(id, 2) * f.portas.length) % f.portas.length];
    const dir = hashF(id, 3) < 0.5 ? 1 : -1;
    const larg = larguraAndar(P, f.lado);
    const parado = hashF(id, 8) < 0.12;
    // mantém a direita de quem anda (a direita é +u vezes o sentido); quem para fica junto da fachada
    const fora = dir * f.lado > 0;
    const off = parado ? FAIXA_ANDAR.de + larg + 0.2 : FAIXA_ANDAR.de + larg * (fora ? 0.55 + 0.3 * hashF(id, 4) : 0.02 + 0.3 * hashF(id, 4));
    const n = hashF(id, 5) < 0.2 ? 2 : 1;
    const corposN = [];
    for (let k = 0; k < n; k++) {
      const ap = mod.aparencia((j) => hashF(id, 20 + j, k + 1));
      corposN.push({ ...ap, escala: ap.altura / mod.ALTURA_MODELO, fase: hashF(id, 6, k), passo: 1.42 * (ap.altura / 1.7) });
    }
    const velho = (corposN[0].bits & 3) === 3;
    const v = velho ? 0.95 + 0.2 * hashF(id, 7) : 1.15 + 0.35 * hashF(id, 7);
    return {
      id, corpos: corposN, estado: parado ? 'parado' : 'anda', e: f.e, lado: f.lado, s, dir, off, v, vAgora: parado ? 0 : v,
      restante: 40 + 200 * hashF(id, 9), tParado: parado ? 15 + 45 * hashF(id, 10) : 0, plano: null, k: 0, t: 0, espera: 0,
      x: 0, z: 0, y: 0, hx: 1, hz: 0, cruza: null, u: 0, dy: 0, uAr: null, uTipo: -1, uLado: 0, uOff: -1,
    };
  }

  /** Ponto na calçada (x, z, a direção de quem anda) e a cota. */
  function naCalcada(p, ar, T) {
    // o u e a cota da faixa de andar só mudam com a calçada (aresta, tipo, lado) ou a faixa (off): guardados na pessoa
    if (p.uAr !== ar || p.uTipo !== ar.tipo || p.uLado !== p.lado || p.uOff !== p.off) {
      const P = perfilVia(ar.tipo);
      p.u = uDaCalcada(P, p.lado, p.off);
      p.dy = alturaNaSecao(P, p.u);
      p.uAr = ar;
      p.uTipo = ar.tipo;
      p.uLado = p.lado;
      p.uOff = p.off;
    }
    const u = p.u;
    const dy = p.dy;
    estacao(ar.p, ar.tab, p.s, est);
    p.x = est.x - est.tz * u;
    p.z = est.z + est.tx * u;
    p.hx = est.tx * p.dir;
    p.hz = est.tz * p.dir;
    p.y = ar.ponte ? ar.cotas[0] + ((ar.cotas[1] - ar.cotas[0]) * p.s) / ar.L + dy - ALTURA.pista : (T ? alturaEm(T, p.x, p.z) : 0) + dy;
  }

  /** Cúbica de (a, ha) a (b, hb), com as alças nas direções; o comprimento pela média da corda e do polígono. */
  function cubica(ax, az, hax, haz, bx, bz, hbx, hbz) {
    const d = Math.hypot(bx - ax, bz - az);
    const h = d * 0.4;
    const p = [ax, az, ax + hax * h, az + haz * h, bx - hbx * h, bz - hbz * h, bx, bz];
    const poli = Math.hypot(p[2] - p[0], p[3] - p[1]) + Math.hypot(p[4] - p[2], p[5] - p[3]) + Math.hypot(p[6] - p[4], p[7] - p[5]);
    return { p, L: Math.max(0.5, (d + poli) / 2) };
  }

  /** Ponto da faixa de andar (ou da borda da faixa de pedestres, off pequeno) de um lado de uma aresta em s. */
  function ponto(ar, lado, s, off, out) {
    const u = uDaCalcada(perfilVia(ar.tipo), lado, off);
    estacao(ar.p, ar.tab, s, est);
    out.x = est.x - est.tz * u;
    out.z = est.z + est.tx * u;
    out.tx = est.tx;
    out.tz = est.tz;
    return out;
  }

  const A = { x: 0, z: 0, tx: 0, tz: 0 };
  const B = { x: 0, z: 0, tx: 0, tz: 0 };

  /**
   * Chegou à ponta da calçada, no nó: vira para a calçada do braço vizinho ou atravessa a faixa de pedestres dele e
   * segue pelo braço seguinte; na ponta sem saída, volta. Monta o plano (pernas em cúbicas) e o lugar de chegada.
   */
  function esquina(rede, p, ar) {
    const noFim = p.dir > 0;
    const n = noFim ? ar.b : ar.a;
    const no = rede.nos.get(n);
    const B0 = no?.analise.bracos;
    const i = B0 ? B0.findIndex((b) => b.e === ar.e && b.inverte === noFim) : -1;
    if (!no || i < 0 || no.tipo === 'ponta' || B0.length < 2) {
      p.dir = -p.dir;
      return;
    }
    const nb = B0.length;
    const relOut = B0[i].inverte ? -p.lado : p.lado; // +1: à direita de quem sai do nó pelo braço
    const rot = relOut > 0 ? 1 : -1;
    const lugar = (b, rel) => {
      const a2 = rede.arestas.get(b.e);
      if (!a2) return null;
      const lado = b.inverte ? -rel : rel;
      const P = perfilVia(a2.tipo);
      if (larguraAndar(P, lado) <= 0) return null;
      return { ar: a2, lado, dir: b.inverte ? -1 : 1, boca: bocaDe(a2, b.inverte), b };
    };
    const C = B0[(i + rot + nb) % nb];
    const vira = lugar(C, -rot);
    let cruza = null;
    if (nb >= 3 && no.zebra && COM_ZEBRA.has(C.P.id)) {
      const D = B0[(i + 2 * rot + 2 * nb) % nb];
      const aqui = lugar(C, -rot);
      const la = lugar(C, rot);
      const depois = D !== B0[i] ? lugar(D, -rot) : null;
      if (aqui && la && depois) cruza = { aqui, la, depois };
    }
    const opcoes = [];
    if (vira) opcoes.push(['vira', 1]);
    if (cruza) opcoes.push(['cruza', 1.2]);
    if (!opcoes.length) {
      p.dir = -p.dir;
      return;
    }
    const soma = opcoes.reduce((a, [, w]) => a + w, 0);
    let h = hashF(p.id, 31, p.k++) * soma;
    let esc = opcoes[opcoes.length - 1][0];
    for (const [o, w] of opcoes) {
      h -= w;
      if (h < 0) {
        esc = o;
        break;
      }
    }
    // de onde sai: a ponta da faixa de andar desta calçada
    ponto(ar, p.lado, bocaDe(ar, noFim), p.off, A);
    const hax = A.tx * p.dir;
    const haz = A.tz * p.dir;
    const pernas = [];
    let fim;
    let desiste = null;
    if (esc === 'vira') {
      const off = FAIXA_ANDAR.de + larguraAndar(perfilVia(vira.ar.tipo), vira.lado) * (p.off - FAIXA_ANDAR.de) / Math.max(0.01, larguraAndar(perfilVia(ar.tipo), p.lado));
      ponto(vira.ar, vira.lado, vira.boca, off, B);
      pernas.push({ ...cubica(A.x, A.z, hax, haz, B.x, B.z, B.tx * vira.dir, B.tz * vira.dir), y: ALTURA.calcada });
      fim = { e: vira.ar.e, lado: vira.lado, s: vira.boca, dir: vira.dir, off };
    } else {
      const { aqui, la, depois } = cruza;
      const sZ = aqui.boca + aqui.dir * MEIO_ZEBRA;
      // a borda da calçada na faixa de pedestres (perto do meio-fio, na rampa)
      ponto(aqui.ar, aqui.lado, sZ, 0.5, B);
      // chega à borda olhando para a rua (a direita da aresta é +u: a rua fica do lado -lado)
      pernas.push({ ...cubica(A.x, A.z, hax, haz, B.x, B.z, aqui.lado * B.tz, -aqui.lado * B.tx), y: ALTURA.calcada });
      const P1 = { x: B.x, z: B.z };
      ponto(la.ar, la.lado, sZ, 0.5, B);
      const P2 = { x: B.x, z: B.z };
      const dx = P2.x - P1.x;
      const dz = P2.z - P1.z;
      const l = Math.hypot(dx, dz) || 1;
      // a perna da espera (parado na borda) e a travessia
      pernas.push({ espera: true, n, e: aqui.ar.e, semaforo: !!no.semaforos, grupo: grupoSemaforo(aqui.b.theta), defas: defasagemSemaforo(n), dist: l, p: [P1.x, P1.z, P1.x, P1.z, P1.x, P1.z, P1.x, P1.z], L: 0.01, hx: dx / l, hz: dz / l, y: ALTURA.calcada });
      pernas.push({ p: [P1.x, P1.z, P1.x + dx / 3, P1.z + dz / 3, P1.x + (2 * dx) / 3, P1.z + (2 * dz) / 3, P2.x, P2.z], L: l, y: ALTURA.pista, rampa: true, cruza: chaveFaixa(n, aqui.ar.e) });
      const off = FAIXA_ANDAR.de + larguraAndar(perfilVia(depois.ar.tipo), depois.lado) * 0.5;
      ponto(depois.ar, depois.lado, depois.boca, off, B);
      pernas.push({ ...cubica(P2.x, P2.z, dx / l, dz / l, B.x, B.z, B.tx * depois.dir, B.tz * depois.dir), y: ALTURA.calcada });
      fim = { e: depois.ar.e, lado: depois.lado, s: depois.boca, dir: depois.dir, off };
      // se desistir de atravessar: segue pela calçada de cá do braço, saindo do nó
      desiste = { e: aqui.ar.e, lado: aqui.lado, s: sZ, dir: aqui.dir, off: FAIXA_ANDAR.de + larguraAndar(perfilVia(aqui.ar.tipo), aqui.lado) * 0.5 };
    }
    p.estado = 'esquina';
    p.plano = { pernas, fim, desiste };
    p.perna = 0;
    p.t = 0;
    p.espera = 0;
  }

  /** Pode atravessar agora? No semáforo, o vermelho dos carros do braço com tempo para chegar; sem, ninguém vindo. */
  function podeAtravessar(perna, p, tempo) {
    const traf = ctx.dominio('trafego');
    if (traf?.cruzandoFaixa?.(perna.n, perna.e, !perna.semaforo)) return false;
    if (!perna.semaforo) return true;
    return restaVermelho(tempo, perna.grupo, perna.defas) > perna.dist / (p.v * 1.1) + 1.5;
  }

  /** Um passo de uma entidade. Devolve false se ela sai (entrou num prédio, a calçada sumiu). */
  function passo(rede, p, dt, tempo, T) {
    if (p.estado === 'parado') {
      p.tParado -= dt;
      p.vAgora = 0;
      const ar = rede.arestas.get(p.e);
      if (!ar) return false;
      naCalcada(p, ar, T);
      // parado olhando para a rua (a rua fica do lado -lado da calçada)
      p.hx = p.lado * est.tz;
      p.hz = -p.lado * est.tx;
      if (p.tParado <= 0) {
        p.estado = 'anda';
        p.off = FAIXA_ANDAR.de + larguraAndar(perfilVia(ar.tipo), p.lado) * 0.5;
      }
      return true;
    }
    if (p.estado === 'esquina') {
      const perna = p.plano.pernas[p.perna];
      if (perna.espera) {
        p.vAgora = 0;
        p.x = perna.p[0];
        p.z = perna.p[1];
        p.hx = perna.hx;
        p.hz = perna.hz;
        p.y = (T ? alturaEm(T, p.x, p.z) : 0) + perna.y;
        p.espera += dt;
        // esperou demais (um cruzamento travado): desiste e vira pela calçada
        if (p.espera > 70 && p.plano.desiste) {
          p.plano.fim = p.plano.desiste;
          return entrarNaCalcada(rede, p, T);
        } else if (podeAtravessar(perna, p, tempo)) {
          p.perna++;
          p.t = 0;
          naFaixa.add(p.plano.pernas[p.perna].cruza);
        }
        return true;
      }
      const v = perna.cruza ? p.v * 1.1 : p.v;
      p.vAgora = v;
      p.t += (v * dt) / perna.L;
      if (perna.cruza) naFaixa.add(perna.cruza);
      if (p.t >= 1) {
        p.perna++;
        p.t = 0;
        if (p.perna >= p.plano.pernas.length) return entrarNaCalcada(rede, p, T);
        return true;
      }
      pontoCurva(perna.p, p.t, q);
      p.x = q.x;
      p.z = q.z;
      p.hx = q.hx;
      p.hz = q.hz;
      // na travessia, a rampa do meio-fio nas duas pontas
      let y = perna.y;
      if (perna.rampa) {
        const d = Math.min(p.t, 1 - p.t) * perna.L;
        y = ALTURA.pista + (ALTURA.calcada - ALTURA.pista) * Math.max(0, 1 - d / 1.2);
      }
      p.y = (T ? alturaEm(T, p.x, p.z) : 0) + y;
      return true;
    }
    // na calçada
    const ar = rede.arestas.get(p.e);
    if (!ar) return false;
    const fim = p.dir > 0 ? ar.L - ar.cFim : ar.cIni;
    const v = p.vAgora;
    const d = v * dt;
    p.s += d * p.dir;
    p.restante -= d;
    // chegou: entra na primeira porta desta calçada por onde passar; sem porta nesta calçada (ou passado muito do
    // destino), só some fora do LOD0, onde não se vê a figura sumir no meio da calçada
    if (p.restante <= 0) {
      const ps = portas.get(p.e * 2 + (p.lado > 0 ? 1 : 0));
      if (ps?.some((s) => Math.abs(s - p.s) < Math.max(0.6, d))) return false;
      if ((!ps || p.restante < -90) && foraDoLod0(p)) return false;
    }
    if ((fim - p.s) * p.dir <= 0) {
      p.s = fim;
      esquina(rede, p, ar);
      if (p.estado === 'esquina') return passo(rede, p, 0, tempo, T);
    }
    naCalcada(p, ar, T);
    return true;
  }

  function entrarNaCalcada(rede, p, T) {
    const f = p.plano.fim;
    Object.assign(p, { e: f.e, lado: f.lado, s: f.s, dir: f.dir, off: f.off, estado: 'anda', plano: null, perna: 0, t: 0 });
    const ar = rede.arestas.get(p.e);
    if (!ar) return false;
    p.s += p.dir * 0.05;
    naCalcada(p, ar, T);
    return true;
  }

  /** Quem anda na mesma calçada, no mesmo sentido e na mesma faixa, não passa por dentro do da frente. */
  function seguir() {
    const grupos = new Map();
    for (const p of gente) {
      if (p.estado !== 'anda') continue;
      const k = p.e * 4 + (p.lado > 0 ? 2 : 0) + (p.dir > 0 ? 1 : 0);
      let g = grupos.get(k);
      if (!g) grupos.set(k, (g = []));
      g.push(p);
    }
    for (const g of grupos.values()) {
      g.sort((a, b) => a.s * a.dir - b.s * b.dir);
      for (let i = 0; i < g.length; i++) {
        const p = g[i];
        p.vAgora = p.v;
        for (let j = i + 1; j < g.length && j < i + 4; j++) {
          const o = g[j];
          const gap = (o.s - p.s) * p.dir;
          if (gap > 2.2) break;
          if (Math.abs(o.off - p.off) < (p.corpos.length + o.corpos.length) * 0.35) p.vAgora = Math.min(p.vAgora, gap < 1 ? 0 : o.vAgora);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- desenho

  function desenhar() {
    const P = perfil();
    const cp = ctx.camera.position;
    const cont = [0, 0];
    const raio2 = P.raio * P.raio;
    const lod0 = P.lod0 * P.lod0;
    corpos = 0;
    for (const p of gente) {
      const n = p.corpos.length;
      for (let k = 0; k < n; k++) {
        const b = p.corpos[k];
        // a dupla lado a lado (parada: um de frente para o outro)
        let x = p.x;
        let z = p.z;
        let hx = p.hx;
        let hz = p.hz;
        if (n === 2) {
          const lado = k === 0 ? -0.3 : 0.3;
          x += -p.hz * lado;
          z += p.hx * lado;
          // parados: um de frente para o outro
          if (p.estado === 'parado') {
            hx = k === 0 ? -p.hz : p.hz;
            hz = k === 0 ? p.hx : -p.hx;
          }
        }
        const d2 = (x - cp.x) ** 2 + (p.y - cp.y) ** 2 + (z - cp.z) ** 2;
        if (d2 > raio2) continue;
        const lod = d2 < lod0 ? 0 : 1;
        const M = malhas[lod];
        const j = cont[lod];
        if (j >= M.cap) continue;
        cont[lod]++;
        corpos++;
        matrizGiroY(M.mesh.instanceMatrix.array, j * 16, x, p.y, z, hx, hz, b.escala);
        const a = M.pessoa.array;
        a[4 * j] = b.fase % 1;
        a[4 * j + 1] = Math.min(1, p.vAgora / 1.2);
        a[4 * j + 2] = b.fem;
        a[4 * j + 3] = 0;
        const r = M.roupa.array;
        r[4 * j] = b.cima[0];
        r[4 * j + 1] = b.cima[1];
        r[4 * j + 2] = b.cima[2];
        r[4 * j + 3] = b.bits;
        const r2 = M.roupa2.array;
        r2[4 * j] = b.baixo[0];
        r2[4 * j + 1] = b.baixo[1];
        r2[4 * j + 2] = b.baixo[2];
        r2[4 * j + 3] = b.pele;
      }
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
      for (const at of [M.pessoa, M.roupa, M.roupa2]) {
        at.clearUpdateRanges();
        at.addUpdateRange(0, n * 4);
        at.needsUpdate = true;
      }
    });
    ctx.stats.instancias.pessoas = corpos;
  }

  /** Povoa até o alvo (corpos), com as tentativas dadas. */
  function encher(rede, alvoN, tentativas, T, h0 = 0) {
    let n = gente.reduce((a, p) => a + p.corpos.length, 0);
    for (let k = 0; k < tentativas && n < alvoN; k++) {
      const p = nascer(rede, h0);
      if (!p) continue;
      const ar = rede.arestas.get(p.e);
      naCalcada(p, ar, T);
      gente.push(p);
      n += p.corpos.length;
    }
  }

  /**
   * Um passo de todos: nasce gente nas portas até o alvo, sai quem ficou longe do alvo (e, se passou dele, quem está
   * andando fora do LOD0; ninguém some no meio da travessia nem à vista) e os outros andam.
   */
  function andarTodos(rede, dt, tempo, T, P, h0) {
    const alvoN = Math.min(P.pessoas, Math.round(somaPeso));
    encher(rede, alvoN, 10, T, h0);
    naFaixa.clear();
    seguir();
    let sobra = gente.reduce((a, p) => a + p.corpos.length, 0) - (alvoN + 8);
    for (let i = gente.length - 1; i >= 0; i--) {
      const p = gente[i];
      const longe = (p.x - alvo.x) ** 2 + (p.z - alvo.z) ** 2 > (P.raio + 40) ** 2;
      // passou do alvo: sai quem anda fora do LOD0 (perto da câmera, a gente só entra nas portas)
      const sai = longe || (sobra > 0 && p.estado === 'anda' && foraDoLod0(p));
      if (sai || !passo(rede, p, dt, tempo, T)) {
        if (sai && !longe) sobra -= p.corpos.length;
        gente.splice(i, 1);
        continue;
      }
      for (const b of p.corpos) b.fase += (dt * p.vAgora) / b.passo;
    }
  }

  let tAnt = null;
  const dom = {
    nome: 'pedestres',
    quadro(tMs, c) {
      const vias = c.dominio('vias');
      if (!vias?.rede || !mod) return;
      if (perfilMontado !== c.perfil.id) {
        perfilMontado = c.perfil.id;
        montarMalhas();
        gente.length = 0;
      }
      const esp = c.sim.espelho;
      const T = esp.terreno;
      const P = perfil();
      const t = esp.tempo;
      const anda = animar ?? (t?.velocidade ?? 1) > 0;
      const dt = tAnt === null ? 0 : (Math.min(100, tMs - tAnt) / 1000) * (anda ? Math.max(1, t?.mult ?? 1) : 0);
      tAnt = tMs;
      c.cameraApi?.alvo?.(alvo);
      if (!alvoFrentes || alvo.distanceTo(alvoFrentes) > 50 || tMs - tFrentes > 6000) {
        montarFrentes(esp, vias.rede, c.horaDoCeu());
        tFrentes = tMs;
      }
      andarTodos(vias.rede, dt, c.relogioRua ?? tMs / 1000, T, P, tMs);
      desenhar();
    },
    /** Cenas: anda (true), para (false) ou segue o jogo (null). */
    animar(b) {
      animar = b;
    },
    /** Espera o gerador (sob demanda) e povoa de uma vez. */
    async povoar(ctxQ = ctx) {
      await carga;
      const vias = ctxQ.dominio('vias');
      if (!vias?.rede) return 0;
      ctxQ.cameraApi?.alvo?.(alvo);
      montarFrentes(ctxQ.sim.espelho, vias.rede, ctxQ.horaDoCeu());
      const alvoN = Math.min(perfil().pessoas, Math.round(somaPeso));
      encher(vias.rede, alvoN, alvoN * 3, ctxQ.sim.espelho.terreno);
      return gente.reduce((a, p) => a + p.corpos.length, 0);
    },
    preparar: () => carga,
    /** A figura e o material chegaram (o aquecimento da carga pode esperar por isso). */
    pronto: () => !!mod,
    /** Cenas: adianta a gente `seg` segundos sem desenhar (junto com trafego.avancar, quadro a quadro). */
    avancarUm(dt, ctxQ = ctx) {
      const vias = ctxQ.dominio('vias');
      if (!vias?.rede || !mod) return;
      const tempo = ctxQ.relogioRua ?? 0;
      andarTodos(vias.rede, dt, tempo, ctxQ.sim.espelho.terreno, perfil(), Math.round(tempo * 10));
    },
    /** A faixa de pedestres do braço e do nó n tem gente atravessando? (trafego.js) */
    faixaOcupada(n, e) {
      return naFaixa.has(chaveFaixa(n, e));
    },
    medidas() {
      let tris = 0;
      for (const M of malhas) tris += M.mesh.count * M.tris;
      return { pessoas: corpos, grupos: gente.length, alvo: Math.round(somaPeso), frentes: frentes.length, atravessando: naFaixa.size, tris };
    },
    /** Cópia do estado (testes): posição, estado, aresta, lado e a travessia. */
    amostra() {
      return gente.map((p) => ({
        id: p.id, estado: p.estado, e: p.e, lado: p.lado, s: p.s, off: p.off, x: p.x, y: p.y, z: p.z, n: p.corpos.length, v: p.vAgora,
        cruza: p.estado === 'esquina' ? p.plano.pernas[p.perna]?.cruza ?? null : null,
      }));
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
  api.registrarDominio('pedestres', criarPedestres);
}
