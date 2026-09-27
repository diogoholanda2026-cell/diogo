// Vista de depuração (F0): o que faz o jogo andar desde o começo, antes das parcelas de verdade. Cada parte é um
// SUBSTITUTO que sai sozinho quando a dona registra o domínio com o mesmo nome:
//   'terreno'  chão pela grade de alturas do espelho, amostrada a 32 m, com água e mata em cor; liso em 2 triângulos,
//              sem os quadrados sob o plano do mar e, sem mar, com uma moldura de chão até 20 km (R2a troca)
//   'predios'  uma caixa instanciada por prédio (planta w x d, altura pelos andares do catálogo), que também projeta a
//              sombra própria pelo gêmeo na cena de sombra (R4a troca)
//   'vias'     faixas planas com a largura do tipo ao longo da Bézier de cada aresta (R3a troca)
//   'ceu'      sol pela latitude, dia e hora (D9) numa DirectionalLight sem sombra do three, hemisfério e a cor do céu
//              e da neblina pela altura do sol (R1a troca)
// E as peças básicas que a R1a substitui por registro: câmera em órbita (10 m a 9 km, 3 a 88 graus), entrada (arrastar,
// roda, pinça, dois dedos) e o raio contra a grade de alturas (alturaEm, D4).
// Cores em albedo de material real (concreto, reboco, asfalto, gramado seco), nada saturado.
import * as THREE from 'three';
import { alturaEm, amostrar } from '../comum/altura.js';
import { AGUA, PREDIO, TIPO_PREDIO } from '../contratos/flags.js';
import { refDe } from '../contratos/espelho.js';
import { modeloPredio, PE_DIREITO } from '../data/predios.js';
import { ZONAS_ORDEM, ZONAS } from '../data/zonas.js';
import { VIAS_ORDEM, VIAS } from '../data/vias.js';
import { PRIORIDADE } from './camera/selecao.js';
import { pedeTudo } from './ponte.js';

const RAD = Math.PI / 180;
const cor = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------------------------------------ sol e céu

/**
 * Direção PARA o sol (x leste, y cima, z sul) pela hora do céu, o dia do ano e a latitude (D9). Norte em -z.
 * @returns {THREE.Vector3} unitário; y < 0 com o sol abaixo do horizonte
 */
export function direcaoDoSol(hora, diaDoAno, latitude = -23.5, alvo = new THREE.Vector3()) {
  const dec = 23.44 * RAD * Math.sin((2 * Math.PI * (284 + diaDoAno)) / 365);
  const h = (hora - 12) * 15 * RAD;
  const lat = latitude * RAD;
  const sEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sEl)));
  const az = Math.atan2(-Math.sin(h) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(h));
  return alvo.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).normalize();
}

const CEU_DIA = cor('#8fb3d6');
const CEU_POR = cor('#d9a577');
const CEU_NOITE = cor('#0c1422');
const NEB_DIA = cor('#b9c7d4');
const NEB_NOITE = cor('#1a2332');

/** Hora das fases forçadas (R.tempo.forcar({ fase })): a interface nunca mostra a hora (D42). */
export const HORA_DA_FASE = Object.freeze({ manha: 9, tarde: 14, fimDeTarde: 17.5, noite: 21.5 });

function criarCeu(ctx) {
  const { cena } = ctx;
  const sol = new THREE.DirectionalLight(0xffffff, 3);
  sol.castShadow = false;
  const hemi = new THREE.HemisphereLight(0xbcd0e6, 0x5c5446, 1);
  cena.add(sol, sol.target, hemi);
  cena.background = CEU_DIA.clone();
  const dir = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Color();
  return {
    nome: 'ceu',
    substituto: true,
    quadro(tMs, c) {
      const hora = c.horaDoCeu();
      const t = c.sim.espelho.tempo;
      direcaoDoSol(hora, t?.diaDoAno ?? 0, c.sim.espelho.mapa?.latitude ?? -23.5, dir);
      const dia = THREE.MathUtils.smoothstep(dir.y, -0.08, 0.12);
      const baixo = 1 - THREE.MathUtils.smoothstep(dir.y, 0.05, 0.35);
      // de noite a luz direta é a da lua (azulada e fraca), no sentido oposto ao sol
      const luz = dia > 0.02 ? dir : tmpLua.copy(dir).negate().setY(Math.max(0.35, -dir.y));
      c.sol.dir.copy(luz).normalize();
      sol.position.copy(c.sol.dir).multiplyScalar(1000).add(c.camera.position);
      sol.target.position.copy(c.camera.position);
      sol.color.setRGB(1, 0.97 - 0.3 * baixo, 0.92 - 0.5 * baixo);
      sol.intensity = 3.2 * dia + 0.12 * (1 - dia);
      if (dia <= 0.02) sol.color.setRGB(0.55, 0.65, 0.9);
      hemi.intensity = 0.08 + 0.9 * dia;
      tmp.copy(CEU_DIA).lerp(CEU_POR, baixo * dia).lerp(CEU_NOITE, 1 - dia);
      cena.background.copy(tmp);
      c.ganchos.uniformes.gNeblinaCor.value.copy(NEB_DIA).lerp(CEU_POR, 0.5 * baixo * dia).lerp(NEB_NOITE, 1 - dia);
      c.sol.dia = dia;
    },
    descartar() {
      cena.remove(sol, sol.target, hemi);
    },
  };
}
const tmpLua = new THREE.Vector3();

// ------------------------------------------------------------------------------------------------ terreno

const PASSO_CHAO = 4; // amostras da grade por vértice (8 m x 4 = 32 m)
const COR_CHAO = { grama: cor('#7b7a5c'), mata: cor('#465238'), rocha: cor('#8a857d'), areia: cor('#b3a68a'), agua: cor('#34505e'), plano: cor('#8a8672') };

/** Altura da malha grossa do chão (a mesma grade amostrada a cada PASSO_CHAO), para as vias assentarem nela. */
const grossas = new WeakMap();
function alturaGrossa(T, x, z) {
  const n = (T.n - 1) / PASSO_CHAO + 1;
  let G = grossas.get(T);
  if (!G) {
    G = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) G[j * n + i] = T.altura[j * PASSO_CHAO * T.n + i * PASSO_CHAO];
    grossas.set(T, G);
  }
  return amostrar(G, n, T.passo * PASSO_CHAO, T.origem[0], T.origem[1], x, z);
}

function criarTerreno(ctx) {
  const mat = ctx.ganchos.aplicar(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), ['sombra', 'neblina']);
  const matMar = ctx.ganchos.aplicar(new THREE.MeshStandardMaterial({ color: COR_CHAO.agua, roughness: 0.25, metalness: 0 }), ['sombra', 'neblina']);
  let malha = null;
  let mar = null;
  let moldura = null;
  let versaoFeita = null;
  let pendente = false;
  let tUltimo = -1e9;
  function montar(esp) {
    const T = esp.terreno;
    if (!T) return;
    grossas.delete(T);
    // chão liso (o substituto plano até a S1a): uma cota só e nenhuma água cabem em 2 triângulos, não em 131 mil
    const liso = T.altura.every((h) => h === T.altura[0]) && (!T.agua || T.agua.every((a) => a === AGUA.TERRA));
    const s = liso ? T.n - 1 : PASSO_CHAO;
    const n = (T.n - 1) / s + 1;
    const pos = new Float32Array(n * n * 3);
    const cores = new Float32Array(n * n * 3);
    const marV = new Uint8Array(n * n); // vértice no mar: o quadrado todo no mar fica com o plano do mar
    const F = esp.floresta;
    let temMar = false;
    let plano = true;
    const h0 = T.altura[0];
    const c = new THREE.Color();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * s * T.n + i * s;
        const x = T.origem[0] + i * s * T.passo;
        const z = T.origem[1] + j * s * T.passo;
        const h = T.altura[k];
        if (h !== h0) plano = false;
        const v = j * n + i;
        pos[3 * v] = x;
        pos[3 * v + 1] = h;
        pos[3 * v + 2] = z;
        const agua = T.agua ? T.agua[k] : 0;
        if (agua === AGUA.MAR) {
          temMar = true;
          marV[v] = h <= (esp.mapa?.nivelMar ?? 0) ? 1 : 0;
        }
        if (agua !== AGUA.TERRA) c.copy(COR_CHAO.agua);
        else {
          c.copy(COR_CHAO.grama);
          if (h < 2.5 && temAguaPerto(T, k)) c.copy(COR_CHAO.areia);
          const rocha = THREE.MathUtils.smoothstep(h, 90, 220);
          if (F) {
            const fi = Math.min(F.n - 1, Math.round((x - (F.origem?.[0] ?? -4096)) / F.passo));
            const fj = Math.min(F.n - 1, Math.round((z - (F.origem?.[1] ?? -4096)) / F.passo));
            const dens = fi >= 0 && fj >= 0 ? F.dens[fj * F.n + fi] / 255 : 0;
            c.lerp(COR_CHAO.mata, dens * 0.9);
          }
          c.lerp(COR_CHAO.rocha, rocha * 0.6);
        }
        cores[3 * v] = c.r;
        cores[3 * v + 1] = c.g;
        cores[3 * v + 2] = c.b;
      }
    }
    if (plano) for (let v = 0; v < n * n; v++) {
      cores[3 * v] = COR_CHAO.plano.r;
      cores[3 * v + 1] = COR_CHAO.plano.g;
      cores[3 * v + 2] = COR_CHAO.plano.b;
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let q = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        if (marV[a] && marV[a + 1] && marV[a + n] && marV[a + n + 1]) continue; // o plano do mar cobre
        idx[q++] = a;
        idx[q++] = a + n;
        idx[q++] = a + 1;
        idx[q++] = a + 1;
        idx[q++] = a + n;
        idx[q++] = a + n + 1;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    g.setIndex(new THREE.BufferAttribute(idx.slice(0, q), 1));
    g.computeVertexNormals();
    if (malha) {
      malha.geometry.dispose();
      malha.geometry = g;
    } else {
      malha = ctx.medidas.familia(new THREE.Mesh(g, mat), 'terreno');
      malha.name = 'depuracao:chao';
      malha.frustumCulled = false;
      ctx.cena.add(malha);
    }
    if (temMar && !mar) {
      const gm = new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2);
      mar = ctx.medidas.familia(new THREE.Mesh(gm, matMar), 'resto');
      mar.name = 'depuracao:mar';
      mar.position.y = esp.mapa?.nivelMar ?? 0;
      mar.frustumCulled = false;
      ctx.cena.add(mar);
    } else if (!temMar && mar) {
      ctx.cena.remove(mar);
      mar = null;
    }
    // sem mar, uma moldura de chão até 20 km em volta do mapa: a borda do mapa não vira a beira de uma mesa
    if (moldura) {
      ctx.cena.remove(moldura);
      moldura.geometry.dispose();
      moldura = null;
    }
    if (!temMar) {
      const x0 = T.origem[0];
      const z0 = T.origem[1];
      const lado = (T.n - 1) * T.passo;
      let soma = 0;
      for (let i = 0; i < n; i++) soma += pos[3 * i + 1] + pos[3 * ((n - 1) * n + i) + 1] + pos[3 * (i * n) + 1] + pos[3 * (i * n + n - 1) + 1];
      const corBorda = plano ? COR_CHAO.plano : COR_CHAO.grama;
      moldura = ctx.medidas.familia(new THREE.Mesh(geometriaMoldura(x0, z0, x0 + lado, z0 + lado, 20000, soma / (4 * n), corBorda), mat), 'terreno');
      moldura.name = 'depuracao:moldura';
      moldura.frustumCulled = false;
      ctx.cena.add(moldura);
    }
    ctx.sombra.marcar();
  }
  return {
    nome: 'terreno',
    substituto: true,
    aplicar(d, esp, c) {
      if (!esp.terreno) return;
      if (esp.terreno !== versaoFeita || pedeTudo(d, 'terreno')) pendente = true;
      if (d.terreno?.length || d.floresta?.length || d.tudo?.floresta) pendente = true;
      const agora = performance.now();
      if (pendente && (!malha || agora - tUltimo > 500)) {
        montar(esp);
        versaoFeita = esp.terreno;
        pendente = false;
        tUltimo = agora;
      }
    },
    descartar() {
      if (malha) ctx.cena.remove(malha);
      if (mar) ctx.cena.remove(mar);
      if (moldura) ctx.cena.remove(moldura);
    },
  };
}

/**
 * Moldura plana em volta do retângulo [x0, x1] x [z0, z1] até ±R, na cota y: 8 vértices e 8 triângulos virados para
 * cima (quatro trapézios entre a borda de fora e a de dentro, sem sobrepor o chão do mapa).
 */
export function geometriaMoldura(x0, z0, x1, z1, R, y, cor) {
  const fora = [[-R, -R], [R, -R], [R, R], [-R, R]];
  const dentro = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const pos = new Float32Array(24);
  const cores = new Float32Array(24);
  const normais = new Float32Array(24);
  [...fora, ...dentro].forEach(([x, z], v) => {
    pos.set([x, y, z], 3 * v);
    cores.set([cor.r, cor.g, cor.b], 3 * v);
    normais.set([0, 1, 0], 3 * v);
  });
  const idx = [];
  for (let a = 0; a < 4; a++) {
    const b = (a + 1) % 4;
    idx.push(a, 4 + a, b, b, 4 + a, 4 + b); // (fora A, dentro A, fora B) e (fora B, dentro A, dentro B): normal +y
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normais, 3));
  g.setIndex(idx);
  return g;
}

function temAguaPerto(T, k) {
  const n = T.n;
  for (const o of [-8, 8, -8 * n, 8 * n]) {
    const a = T.agua[k + o];
    if (a === AGUA.MAR) return true;
  }
  return false;
}

// ------------------------------------------------------------------------------------------------ prédios

const COR_FAMILIA = { res: cor('#c4b9a6'), com: cor('#a9b0b6'), esc: cor('#93a0ad'), ind: cor('#9d978a') };
const COR_SERVICO = cor('#d2cec6');
const COR_OBRA = cor('#b09f7e');
const COR_ABANDONO = cor('#5f5b55');

/** Altura da caixa de um prédio: andares pela semente dentro da faixa do nível, vezes o pé-direito da família. */
export function alturaDaCaixa(P, i) {
  if (P.tipo[i] !== TIPO_PREDIO.ZONA) return 14;
  const m = modeloPredio(P.modelo[i]);
  const z = ZONAS[m?.zona ?? ZONAS_ORDEM[P.zona[i]]];
  if (!m || !z) return 8;
  const [a0, a1] = m.niveis[Math.max(1, Math.min(5, P.nivel[i])) - 1].andares;
  const andares = a0 + (P.semente[i] % (a1 - a0 + 1));
  const fam = z.familia;
  return andares * (PE_DIREITO[fam] ?? 3.2) + (fam === 'ind' ? 2 : 1.2);
}

function corDaCaixa(P, i, alvo, holding) {
  const f = P.flags[i];
  if (f & PREDIO.ABANDONADO) return alvo.copy(COR_ABANDONO);
  if (f & PREDIO.OBRA) return alvo.copy(COR_OBRA);
  if (P.tipo[i] === TIPO_PREDIO.HOLDING) return alvo.copy(holding);
  if (P.tipo[i] === TIPO_PREDIO.SERVICO) return alvo.copy(COR_SERVICO);
  const z = ZONAS[ZONAS_ORDEM[P.zona[i]]];
  alvo.copy(COR_FAMILIA[z?.familia] ?? COR_SERVICO);
  const k = 0.9 + ((P.semente[i] >>> 8) % 21) / 100; // 0,90 a 1,10
  return alvo.multiplyScalar(k);
}

function criarPredios(ctx) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = ctx.ganchos.aplicar(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 }), ['sombra', 'neblina']);
  let malha = null;
  let gemeo = null;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const holding = new THREE.Color();
  function garantir(cap) {
    if (malha && malha.instanceMatrix.count >= cap) return false;
    const nova = Math.max(1024, 2 ** Math.ceil(Math.log2(Math.max(1, cap))));
    if (malha) {
      ctx.cena.remove(malha);
      ctx.sombra.soltar(malha);
      malha.dispose();
    }
    malha = ctx.medidas.familia(new THREE.InstancedMesh(geo, mat, nova), 'predios');
    malha.name = 'depuracao:predios';
    malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    malha.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nova * 3), 3);
    malha.frustumCulled = false;
    malha.count = 0;
    ctx.cena.add(malha);
    gemeo = ctx.medidas.familia(ctx.sombra.projetor(malha), 'sombra');
    return true;
  }
  function escrever(P, i) {
    if (!P.viva[i]) {
      malha.setMatrixAt(i, zero);
      return;
    }
    const h = alturaDaCaixa(P, i);
    const base = P.y[i] - 2; // fundação: a caixa entra 2 m no chão
    e.set(0, P.rot[i], 0);
    q.setFromEuler(e);
    p.set(P.x[i], base, P.z[i]);
    s.set(Math.max(1, P.w[i] - 1), h + 2, Math.max(1, P.d[i] - 1));
    m4.compose(p, q, s);
    malha.setMatrixAt(i, m4);
    malha.setColorAt(i, corDaCaixa(P, i, c, holding));
  }
  return {
    nome: 'predios',
    substituto: true,
    aplicar(d, esp) {
      const P = esp.predios;
      if (!P) return;
      holding.set(esp.holding?.cor ?? '#c9a86a');
      const novo = garantir(P.n);
      const tudo = novo || pedeTudo(d, 'predios') || d.holding;
      if (tudo) for (let i = 0; i < P.n; i++) escrever(P, i);
      else for (const i of d.predios) if (i < malha.instanceMatrix.count) escrever(P, i);
      if (tudo || d.predios.length) {
        malha.count = P.n;
        gemeo.count = P.n;
        malha.instanceMatrix.needsUpdate = true;
        malha.instanceColor.needsUpdate = true;
        ctx.sombra.marcar();
        ctx.stats.instancias.predios = P.n;
      }
    },
    selecionar(raio, esp) {
      const P = esp.predios;
      if (!P) return null;
      let melhor = null;
      const o = raio.origem;
      const dv = raio.dir;
      for (let i = 0; i < P.n; i++) {
        if (!P.viva[i]) continue;
        const h = alturaDaCaixa(P, i);
        const t = raioNaCaixa(o, dv, P.x[i], P.y[i] - 2, P.z[i], P.rot[i], P.w[i] / 2, h + 2, P.d[i] / 2);
        if (t !== null && (!melhor || t < melhor.dist)) {
          const tipo = P.tipo[i] === TIPO_PREDIO.ZONA ? 'predio' : 'colocavel';
          melhor = { tipo, idx: i, ref: refDe(i, P.ger[i]), dist: t, ponto: [o[0] + dv[0] * t, o[1] + dv[1] * t, o[2] + dv[2] * t] };
        }
      }
      return melhor;
    },
    descartar() {
      if (malha) {
        ctx.cena.remove(malha);
        ctx.sombra.soltar(malha);
      }
    },
  };
}

/** Distância do raio até a caixa girada (base em y0, altura h, meias medidas hw e hd), ou null. */
function raioNaCaixa(o, d, cx, y0, cz, rot, hw, h, hd) {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  // para o espaço da caixa: gira -rot em torno de y (convenção do three: x' = x cos + z sen)
  const ox = o[0] - cx;
  const oz = o[2] - cz;
  const lox = ox * cs - oz * sn;
  const loz = ox * sn + oz * cs;
  const ldx = d[0] * cs - d[2] * sn;
  const ldz = d[0] * sn + d[2] * cs;
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
  if (!eixo(lox, ldx, -hw, hw)) return null;
  if (!eixo(o[1], d[1], y0, y0 + h)) return null;
  if (!eixo(loz, ldz, -hd, hd)) return null;
  return t0;
}

// ------------------------------------------------------------------------------------------------ vias

const COR_VIA = { asfalto: cor('#3b3d40'), terra: cor('#7d6a52'), rodovia: cor('#333538') };

function criarVias(ctx) {
  const mat = ctx.ganchos.aplicar(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    ['sombra', 'neblina'],
  );
  let malha = null;
  let pendente = true;
  let tUltimo = -1e9;
  const pt = [0, 0];
  const tg = [0, 0];
  function montar(esp) {
    const A = esp.vias?.arestas;
    const T = esp.terreno;
    if (!A || !T) return;
    const pos = [];
    const cores = [];
    const idx = [];
    for (let e = 0; e < A.n; e++) {
      if (!A.viva[e]) continue;
      const tipo = VIAS[VIAS_ORDEM[A.tipo[e]]] ?? VIAS.rua;
      const meia = tipo.largura / 2;
      const c = tipo === VIAS.terra ? COR_VIA.terra : tipo === VIAS.rodovia ? COR_VIA.rodovia : COR_VIA.asfalto;
      const k = Math.max(2, Math.ceil((A.comp[e] || 50) / 12));
      const o = 8 * e;
      const base = pos.length / 3;
      for (let s = 0; s <= k; s++) {
        const t = s / k;
        bezier(A.p, o, t, pt, tg);
        const l = Math.hypot(tg[0], tg[1]) || 1;
        const nx = -tg[1] / l;
        const nz = tg[0] / l;
        for (const lado of [-1, 1]) {
          const x = pt[0] + nx * meia * lado;
          const z = pt[1] + nz * meia * lado;
          pos.push(x, alturaGrossa(T, x, z) + 0.35, z);
          cores.push(c.r, c.g, c.b);
        }
        if (s < k) {
          const a = base + 2 * s;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    if (malha) {
      malha.geometry.dispose();
      malha.geometry = g;
    } else {
      malha = ctx.medidas.familia(new THREE.Mesh(g, mat), 'vias');
      malha.name = 'depuracao:vias';
      malha.frustumCulled = false;
      malha.renderOrder = 1;
      ctx.cena.add(malha);
    }
  }
  return {
    nome: 'vias',
    substituto: true,
    aplicar(d, esp) {
      if (pedeTudo(d, 'vias') || pedeTudo(d, 'arestas') || d.arestas?.length || d.tudo?.terreno) pendente = true;
      const agora = performance.now();
      if (pendente && agora - tUltimo > 250) {
        montar(esp);
        pendente = false;
        tUltimo = agora;
      }
    },
    descartar() {
      if (malha) ctx.cena.remove(malha);
    },
  };
}

/** Ponto e tangente da Bézier cúbica de 8 números a partir de p[o]. */
function bezier(p, o, t, pt, tg) {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  pt[0] = b0 * p[o] + b1 * p[o + 2] + b2 * p[o + 4] + b3 * p[o + 6];
  pt[1] = b0 * p[o + 1] + b1 * p[o + 3] + b2 * p[o + 5] + b3 * p[o + 7];
  const d0 = 3 * u * u;
  const d1 = 6 * u * t;
  const d2 = 3 * t * t;
  tg[0] = d0 * (p[o + 2] - p[o]) + d1 * (p[o + 4] - p[o + 2]) + d2 * (p[o + 6] - p[o + 4]);
  tg[1] = d0 * (p[o + 3] - p[o + 1]) + d1 * (p[o + 5] - p[o + 3]) + d2 * (p[o + 7] - p[o + 5]);
}

// ------------------------------------------------------------------------------------------------ câmera, entrada e raio

export const LIMITES_CAMERA = Object.freeze({ distMin: 10, distMax: 9000, incMin: 3, incMax: 88 });

const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Câmera em órbita em volta de um alvo no chão (contrato em fonte/contratos/render.js): guinada 0 olha para o norte
 * (-z) e cresce no sentido horário visto de cima; inclinação acima do horizonte.
 */
export function criarCameraBasica(ctx, inicial = {}) {
  const L = LIMITES_CAMERA;
  const e = { x: 0, z: 0, dist: 1200, guinada: 20, inclinacao: 38, ...inicial };
  let voo = null;
  const cam = ctx.camera;
  const limitar = () => {
    e.dist = Math.min(L.distMax, Math.max(L.distMin, e.dist));
    e.inclinacao = Math.min(L.incMax, Math.max(L.incMin, e.inclinacao));
    e.guinada = ((e.guinada % 360) + 360) % 360;
    // o alvo não sai do mapa (8.192 m, D3)
    const m = (ctx.sim?.espelho?.mapa?.tam ?? 8192) / 2;
    e.x = Math.min(m, Math.max(-m, e.x));
    e.z = Math.min(m, Math.max(-m, e.z));
  };
  // um voo interrompido (definir, outro irPara) resolve a Promise dele: quem espera não fica preso
  const encerrarVoo = () => {
    if (!voo) return;
    const { ok } = voo;
    voo = null;
    ok();
  };
  const api = {
    estado: () => ({ x: e.x, z: e.z, dist: e.dist, guinada: e.guinada, inclinacao: e.inclinacao }),
    definir(n = {}) {
      encerrarVoo();
      for (const k of ['x', 'z', 'dist', 'guinada', 'inclinacao']) if (Number.isFinite(n[k])) e[k] = n[k];
      limitar();
    },
    irPara(alvo = {}, ms = 800) {
      encerrarVoo();
      const de = api.estado();
      const para = { ...de };
      for (const k of ['x', 'z', 'dist', 'guinada', 'inclinacao']) if (Number.isFinite(alvo[k])) para[k] = alvo[k];
      let dg = ((para.guinada - de.guinada + 540) % 360) - 180;
      para.guinada = de.guinada + dg;
      if (!(ms > 0)) {
        api.definir(para);
        return Promise.resolve();
      }
      return new Promise((ok) => {
        voo = { t0: performance.now(), ms, de, para, ok };
      });
    },
    /** Alvo no chão (y pelo terreno). */
    alvo(v = new THREE.Vector3()) {
      const T = ctx.sim.espelho.terreno;
      return v.set(e.x, T ? alturaEm(T, e.x, e.z) : 0, e.z);
    },
    atualizar(tMs) {
      if (voo) {
        const k = Math.min(1, (tMs - voo.t0) / voo.ms);
        const s = suave(k);
        for (const c of ['x', 'z', 'dist', 'guinada', 'inclinacao']) e[c] = voo.de[c] + (voo.para[c] - voo.de[c]) * s;
        if (k >= 1) encerrarVoo();
      }
      limitar();
      const alvo = api.alvo(tmpAlvo);
      const gu = e.guinada * RAD;
      const inc = e.inclinacao * RAD;
      cam.position.set(alvo.x - e.dist * Math.cos(inc) * Math.sin(gu), alvo.y + e.dist * Math.sin(inc), alvo.z + e.dist * Math.cos(inc) * Math.cos(gu));
      // não entra no chão
      const T = ctx.sim.espelho.terreno;
      if (T) {
        const chao = alturaEm(T, cam.position.x, cam.position.z) + 2;
        if (cam.position.y < chao) cam.position.y = chao;
      }
      cam.lookAt(alvo);
      const acima = Math.max(1, cam.position.y - (T ? alturaEm(T, cam.position.x, cam.position.z) : 0));
      cam.near = Math.min(30, Math.max(0.2, acima * 0.02));
      cam.far = Math.min(60000, Math.max(4000, e.dist * 12));
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    },
    get voando() {
      return !!voo;
    },
  };
  limitar();
  return api;
}
const tmpAlvo = new THREE.Vector3();

/** Raio da tela (px CSS) em coordenadas do mundo: { origem, dir }. */
export function raioDaTela(camera, largura, altura, x, y) {
  const v = new THREE.Vector3((x / largura) * 2 - 1, -(y / altura) * 2 + 1, 0.5).unproject(camera);
  const o = camera.position;
  const d = v.sub(o).normalize();
  return { origem: [o.x, o.y, o.z], dir: [d.x, d.y, d.z] };
}

/** Raio contra a grade de alturas (alturaEm, D4): anda com passo crescente e refina por bisseção. */
export function raioNoChao(T, raio, maxDist = 30000) {
  const [ox, oy, oz] = raio.origem;
  const [dx, dy, dz] = raio.dir;
  const acima = (t) => oy + dy * t - (T ? alturaEm(T, ox + dx * t, oz + dz * t) : 0);
  if (acima(0) < 0) return null;
  let t0 = 0;
  let t = 1;
  while (t < maxDist) {
    if (acima(t) <= 0) {
      let a = t0;
      let b = t;
      for (let k = 0; k < 24; k++) {
        const m = (a + b) / 2;
        if (acima(m) > 0) a = m;
        else b = m;
      }
      const s = (a + b) / 2;
      return [ox + dx * s, oy + dy * s, oz + dz * s];
    }
    t0 = t;
    t += Math.max(1, t * 0.02);
  }
  return null;
}

/**
 * Entrada básica (a R1a troca pela completa, com o árbitro de gestos): 1 dedo ou botão esquerdo arrasta o chão sob o
 * dedo; roda e pinça aproximam; botão direito ou 2 dedos giram e inclinam; toque curto chama aoToque. No modo
 * 'ferramenta', 1 dedo vai para a ferramenta ({ fase, x, y, ponto, dedos }) e 2 dedos movem a câmera sem inclinar.
 */
export function criarEntradaBasica(ctx, camera) {
  const canvas = ctx.canvas;
  const dedos = new Map();
  const st = { modo: 'camera', aoFerramenta: null, aoToque: [], opcoes: { deslocY: 56, bordaPx: 48 } };
  let gesto = null;
  const ptr = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const chao = (x, y) => ctx.raio(x, y);
  // no toque a mira fica acima do dedo (deslocY); no mouse, no cursor
  const ferramenta = (fase, p, n, tipo) => {
    const y = p.y - (tipo === 'touch' ? st.opcoes.deslocY : 0);
    st.aoFerramenta?.({ fase, x: p.x, y, ponto: chao(p.x, y), dedos: n });
  };
  function inicio(ev) {
    try {
      canvas.setPointerCapture?.(ev.pointerId);
    } catch (e) {
      // ponteiro que já saiu (ou sintético): segue sem captura
    }
    const p = ptr(ev);
    dedos.set(ev.pointerId, { ...p, x0: p.x, y0: p.y, botao: ev.button });
    const n = dedos.size;
    if (n === 1) {
      if (st.modo === 'ferramenta' && ev.button === 0) {
        gesto = { tipo: 'ferramenta', t0: performance.now() };
        ferramenta('inicio', p, 1, ev.pointerType);
        return;
      }
      const girar = ev.button === 2 || ev.ctrlKey;
      gesto = { tipo: girar ? 'girar' : 'arrastar', t0: performance.now(), ancora: chao(p.x, p.y), px: p.x, py: p.y, moveu: false, e0: camera.estado() };
    } else if (n === 2) {
      if (gesto?.tipo === 'ferramenta') ferramenta('fim', p, 1, ev.pointerType);
      const [a, b] = [...dedos.values()];
      gesto = { tipo: 'dois', d0: Math.hypot(a.x - b.x, a.y - b.y), ang0: Math.atan2(b.y - a.y, b.x - a.x), my0: (a.y + b.y) / 2, e0: camera.estado() };
    }
  }
  function move(ev) {
    const d = dedos.get(ev.pointerId);
    if (!d) return;
    const p = ptr(ev);
    d.x = p.x;
    d.y = p.y;
    if (!gesto) return;
    if (gesto.tipo === 'ferramenta') {
      ferramenta('move', p, 1, ev.pointerType);
      return;
    }
    if (gesto.tipo === 'arrastar' || gesto.tipo === 'girar') {
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 6) gesto.moveu = true;
      if (!gesto.moveu) return;
      if (gesto.tipo === 'girar') {
        camera.definir({ ...gesto.e0, guinada: gesto.e0.guinada + (p.x - d.x0) * 0.3, inclinacao: gesto.e0.inclinacao + (p.y - d.y0) * 0.2 });
        return;
      }
      // o ponto do chão fica sob o dedo. A câmera do three é posta em dia na hora: vários pointermove chegam entre dois
      // quadros, e o raio de cada um precisa sair da câmera já movida (senão o deslocamento se soma e a vista dispara)
      const agora = chao(p.x, p.y);
      if (gesto.ancora && agora) {
        const e = camera.estado();
        camera.definir({ ...e, x: e.x + gesto.ancora[0] - agora[0], z: e.z + gesto.ancora[2] - agora[2] });
        camera.atualizar(performance.now());
      }
      return;
    }
    if (gesto.tipo === 'dois' && dedos.size >= 2) {
      const [a, b] = [...dedos.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const my = (a.y + b.y) / 2;
      const e0 = gesto.e0;
      const n = { ...camera.estado(), dist: e0.dist * (gesto.d0 / Math.max(1, dist)), guinada: e0.guinada - ((ang - gesto.ang0) * 180) / Math.PI };
      if (st.modo !== 'ferramenta') n.inclinacao = e0.inclinacao + (my - gesto.my0) * 0.25;
      camera.definir(n);
    }
  }
  function fim(ev) {
    const d = dedos.get(ev.pointerId);
    dedos.delete(ev.pointerId);
    if (!d || !gesto) return;
    const p = ptr(ev);
    if (gesto.tipo === 'ferramenta') {
      ferramenta('fim', p, 1, ev.pointerType);
      gesto = null;
      return;
    }
    if (ev.type !== 'pointercancel' && (gesto.tipo === 'arrastar' || gesto.tipo === 'girar') && !gesto.moveu && dedos.size === 0) {
      const longo = performance.now() - gesto.t0 > 500;
      for (const fn of st.aoToque) fn({ x: p.x, y: p.y, longo, botao: d.botao });
    }
    if (dedos.size === 0) gesto = null;
  }
  canvas.addEventListener('pointerdown', inicio);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', fim);
  canvas.addEventListener('pointercancel', fim);
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const e = camera.estado();
      camera.definir({ ...e, dist: e.dist * Math.exp(ev.deltaY * 0.0012) });
    },
    { passive: false },
  );
  return {
    modo(m) {
      st.modo = m === 'ferramenta' ? 'ferramenta' : 'camera';
    },
    aoFerramenta(fn) {
      st.aoFerramenta = fn;
    },
    aoToque(fn) {
      st.aoToque.push(fn);
      return () => {
        st.aoToque = st.aoToque.filter((f) => f !== fn);
      };
    },
    opcoes(o = {}) {
      Object.assign(st.opcoes, o);
    },
    get estado() {
      return st.modo;
    },
  };
}

// ------------------------------------------------------------------------------------------------ registro

/** Registra os substitutos da depuração (o índice do render chama antes de todos os outros módulos). */
export function registrar(api) {
  api.registrarDominio('ceu', criarCeu, { substituto: true });
  api.registrarDominio('terreno', criarTerreno, { substituto: true });
  api.registrarDominio('vias', criarVias, { substituto: true });
  api.registrarDominio('predios', criarPredios, { substituto: true });
  api.registrarSelecionavel(
    'predios',
    (raio, ctx) => ctx.dominio('predios')?.selecionar?.(raio, ctx.sim.espelho) ?? null,
    { prioridade: PRIORIDADE.mundo },
  );
}
