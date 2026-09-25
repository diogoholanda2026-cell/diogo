// Ciclo de dia e noite no estilo do SimCity BuildIt: quadros-chave por hora do jogo (amanhecer rosa e
// laranja, dia claro das 8h às 16h30, pôr do sol laranja e lilás, crepúsculo violeta e noite azul-violeta
// legível), interpolados sem degraus, e o caminho do sol (arco leste → oeste) e da lua. Nada aqui aloca por
// quadro: amostrar() escreve num vetor reaproveitado e as direções vão em vetores de quem chama.
import * as THREE from 'three';

const GRAU = Math.PI / 180;
// O sol nasce às 5h30 à frente e à direita da vista padrão, passa alto à esquerda ao meio-dia (luz "de cima à
// esquerda") e se põe às 18h30 atrás e à esquerda, sobre o mar: o brilho do poente fica no alto da tela.
export const SOL = { nasce: 5.5, poe: 18.5, elMax: 62 * GRAU, azNasce: 40 * GRAU, azPoe: -140 * GRAU, elMin: 9 * GRAU };
// A lua (luz principal da noite) fica alta e à frente da câmera, fria: as fachadas voltadas para o jogador
// continuam legíveis.
export const LUA = { elBase: 30 * GRAU, elArco: 28 * GRAU, az0: 55 * GRAU, az1: -55 * GRAU };

// fases do contrato (env.fase)
export function faseDe(h) { h = ((h % 24) + 24) % 24; return h >= 4.4 && h < 8 ? 'amanhecer' : h >= 8 && h < 16.5 ? 'dia' : h >= 16.5 && h < 19.7 ? 'entardecer' : 'noite'; }

// ---------------------------------------------------------------- quadros-chave
// cores em sRGB (hex), convertidas para linear na carga; P é a gradação do motor
const NOITE = {
  luz: [0xa4b6ff, 0.95], ceuH: 0x6668d2, chaoH: 0x302a48, hemi: 1.12, env: 0.66,
  zen: 0x0f1440, hor: 0x383e82, baixo: 0x1c1c38, brilho: [0x000000, 0], nevoa: [130, 540], nuvem: [0x4e548f, 0x272b5c],
  noite: 1, estrelas: 1, sombra: 0.55, hao: 1, lua: 1, cidade: 1,
  P: { exposure: 1.95, saturation: 1.0, contrast: 1.04, vignette: 0.12, wb: [1.0, 0.99, 1.01], shadowTint: [0.004, 0.0, 0.012], highTint: [0.012, 0.008, -0.004], threshold: 0.72, bloomStrength: 1.4 },
};
const CREP_MANHA = {
  luz: [0xc4a0ff, 0.6], ceuH: 0x8a88d6, chaoH: 0x3e3850, hemi: 0.98, env: 0.68,
  zen: 0x2c327c, hor: 0xbc8cb8, baixo: 0x302a44, brilho: [0xff8c78, 0.55], nevoa: [120, 500], nuvem: [0xdc9cba, 0x5c4c8a],
  noite: 0.8, estrelas: 0.35, sombra: 0.5, hao: 0.9, lua: 0.4, cidade: 0.6,
  P: { exposure: 1.5, saturation: 1.06, contrast: 1.04, vignette: 0.1, wb: [0.99, 0.97, 1.04], shadowTint: [0.004, 0.0, 0.01], highTint: [0.012, 0.004, -0.002], threshold: 0.85, bloomStrength: 1.1 },
};
const AMANHECER = {
  luz: [0xffb07c, 2.3], ceuH: 0xc4b6e6, chaoH: 0x6c6258, hemi: 1.02, env: 0.85,
  zen: 0x6c92dc, hor: 0xffbaa0, baixo: 0x5c5260, brilho: [0xffa070, 1.25], nevoa: [110, 470], nuvem: [0xffcab4, 0x9c8aba],
  noite: 0.12, estrelas: 0, sombra: 0.72, hao: 0.8, lua: 0, cidade: 0,
  P: { exposure: 1.16, saturation: 1.12, contrast: 1.05, vignette: 0.08, wb: [1.03, 1.0, 0.98], shadowTint: [0.002, 0.0, 0.008], highTint: [0.01, 0.004, -0.004], threshold: 1.0, bloomStrength: 0.7 },
};
const DIA = {
  luz: [0xfff3de, 3.3], ceuH: 0xa9d4ff, chaoH: 0x8aa860, hemi: 1.1, env: 1.05,
  zen: 0x3f84e8, hor: 0xd2e8fa, baixo: 0x6e7e5e, brilho: [0xfff2d8, 0.45], nevoa: [115, 470], nuvem: [0xffffff, 0xb6c6e0],
  noite: 0, estrelas: 0, sombra: 0.82, hao: 0.6, lua: 0, cidade: 0,
  P: { exposure: 1.05, saturation: 1.13, contrast: 1.05, vignette: 0.06, wb: [1.0, 1.0, 1.0], shadowTint: [0.0, 0.002, 0.006], highTint: [0.006, 0.003, -0.004], threshold: 1.15, bloomStrength: 0.35 },
};
const DIA_TARDE = { ...DIA, luz: [0xffe9c8, 3.1], hor: 0xdae6f2, brilho: [0xffe4b8, 0.6], P: { ...DIA.P, wb: [1.02, 1.0, 0.98] } };
const POR_DO_SOL = {
  luz: [0xffa458, 2.7], ceuH: 0x9ea6e8, chaoH: 0x6a5c4c, hemi: 1.02, env: 0.88,
  zen: 0x5a66c6, hor: 0xffb07c, baixo: 0x5c4c5a, brilho: [0xff8a48, 1.4], nevoa: [110, 470], nuvem: [0xffba8e, 0x8a7cb6],
  noite: 0.35, estrelas: 0, sombra: 0.74, hao: 0.8, lua: 0, cidade: 0.2,
  P: { exposure: 1.16, saturation: 1.12, contrast: 1.06, vignette: 0.09, wb: [1.03, 1.0, 0.97], shadowTint: [0.004, 0.0, 0.01], highTint: [0.014, 0.004, -0.006], threshold: 0.95, bloomStrength: 0.85 },
};
const CREPUSCULO = {
  luz: [0xb89cff, 0.62], ceuH: 0x8a8cde, chaoH: 0x3a3650, hemi: 0.98, env: 0.72,
  zen: 0x322e82, hor: 0xc892c0, baixo: 0x322c4a, brilho: [0xff7262, 0.6], nevoa: [120, 500], nuvem: [0xcc92c2, 0x4c428a],
  noite: 0.85, estrelas: 0.3, sombra: 0.5, hao: 0.9, lua: 0.5, cidade: 0.7,
  P: { exposure: 1.5, saturation: 1.06, contrast: 1.04, vignette: 0.1, wb: [0.98, 0.97, 1.05], shadowTint: [0.004, 0.0, 0.012], highTint: [0.012, 0.006, -0.002], threshold: 0.82, bloomStrength: 1.2 },
};
// [hora, quadro] em ordem; 0 e 24 são a mesma noite (o ciclo fecha sem costura)
const QUADROS = [[0, NOITE], [4.4, NOITE], [5.4, CREP_MANHA], [6.5, AMANHECER], [8, DIA], [16.5, DIA_TARDE], [17.8, POR_DO_SOL], [18.8, CREPUSCULO], [19.7, NOITE], [24, NOITE]];

// Vetor plano de parâmetros (interpola tudo de uma vez, sem objetos): índices em I
export const I = { luz: 0, luzK: 3, ceuH: 4, chaoH: 7, hemi: 10, env: 11, zen: 12, hor: 15, baixo: 18, brilho: 21, brilhoK: 24, nevoaPerto: 25, nevoaLonge: 26,
  nuvem: 27, nuvemSombra: 30, noite: 33, estrelas: 34, sombra: 35, hao: 36, exposure: 37, saturation: 38, contrast: 39, vignette: 40, wb: 41, shadowTint: 44, highTint: 47,
  threshold: 50, bloomStrength: 51, lua: 52, cidade: 53 };
export const N_PARAM = 54;
const _c = new THREE.Color();
function lin(hex, out, o) { _c.setHex(hex); out[o] = _c.r; out[o + 1] = _c.g; out[o + 2] = _c.b; } // setHex: sRGB → linear
function plano(q) {
  const v = new Float32Array(N_PARAM);
  lin(q.luz[0], v, I.luz); v[I.luzK] = q.luz[1]; lin(q.ceuH, v, I.ceuH); lin(q.chaoH, v, I.chaoH); v[I.hemi] = q.hemi; v[I.env] = q.env;
  lin(q.zen, v, I.zen); lin(q.hor, v, I.hor); lin(q.baixo, v, I.baixo); lin(q.brilho[0], v, I.brilho); v[I.brilhoK] = q.brilho[1];
  v[I.nevoaPerto] = q.nevoa[0]; v[I.nevoaLonge] = q.nevoa[1]; lin(q.nuvem[0], v, I.nuvem); lin(q.nuvem[1], v, I.nuvemSombra);
  v[I.noite] = q.noite; v[I.estrelas] = q.estrelas; v[I.sombra] = q.sombra; v[I.hao] = q.hao; v[I.lua] = q.lua; v[I.cidade] = q.cidade;
  const P = q.P; v[I.exposure] = P.exposure; v[I.saturation] = P.saturation; v[I.contrast] = P.contrast; v[I.vignette] = P.vignette;
  v.set(P.wb, I.wb); v.set(P.shadowTint, I.shadowTint); v.set(P.highTint, I.highTint); v[I.threshold] = P.threshold; v[I.bloomStrength] = P.bloomStrength;
  return v;
}
const HORAS = QUADROS.map((q) => q[0]), VALS = QUADROS.map((q) => plano(q[1]));

// Amostra o ciclo na hora h (0..24): interpolação suave (smoothstep) entre os quadros vizinhos, em out
export function amostrar(h, out) {
  h = ((h % 24) + 24) % 24;
  let i = 0; while (i < HORAS.length - 2 && h >= HORAS[i + 1]) i++;
  const t = Math.min(1, Math.max(0, (h - HORAS[i]) / (HORAS[i + 1] - HORAS[i]))), s = t * t * (3 - 2 * t);
  const a = VALS[i], b = VALS[i + 1];
  for (let k = 0; k < N_PARAM; k++) out[k] = a[k] + (b[k] - a[k]) * s;
  return out;
}

// Direção do sol (de onde vem a luz) na hora h, em out; devolve a elevação verdadeira em radianos (negativa
// abaixo do horizonte: o brilho do céu usa a verdadeira; a luz usa no mínimo SOL.elMin)
export function dirSol(h, out) {
  h = ((h % 24) + 24) % 24; const dur = SOL.poe - SOL.nasce;
  let f = (h - SOL.nasce) / dur; if (f < -0.5 * (24 - dur) / dur) f += 24 / dur; // a noite continua o seno por baixo
  const el = SOL.elMax * Math.sin(Math.PI * f); const az = SOL.azNasce + (SOL.azPoe - SOL.azNasce) * Math.min(1.25, Math.max(-0.25, f));
  out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  return el;
}
// Direção da lua: do pôr do sol ao nascer, sobe a ~58° à frente da câmera e desce do outro lado
export function dirLua(h, out) {
  h = ((h % 24) + 24) % 24; const dur = 24 - (SOL.poe - SOL.nasce);
  const f = Math.min(1, Math.max(0, (((h - SOL.poe) % 24) + 24) % 24 / dur));
  const el = LUA.elBase + LUA.elArco * Math.sin(Math.PI * f), az = LUA.az0 + (LUA.az1 - LUA.az0) * f;
  out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  return el;
}
// Luz principal: o sol (visível de -1° para cima, crescendo até 5°) ou a lua (entra quando o sol passa de -1°
// para baixo, cheia a -7°). Na troca as duas intensidades são zero, então a sombra muda de lado sem salto.
// Escreve a direção de luz (elevação mínima SOL.elMin) em out e devolve o fator de intensidade (0..1).
const _s = new THREE.Vector3();
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function luzPrincipal(h, out, info) {
  const el = dirSol(h, _s);
  if (el >= -1 * GRAU) {
    const k = sst(-1 * GRAU, 2.5 * GRAU, el); const e2 = Math.max(el, SOL.elMin), c = Math.cos(e2) / Math.max(1e-6, Math.hypot(_s.x, _s.z));
    out.set(_s.x * c, Math.sin(e2), _s.z * c); if (info) { info.lua = false; info.el = el; }
    return k;
  }
  dirLua(h, out); if (info) { info.lua = true; info.el = el; }
  return sst(-1 * GRAU, -7 * GRAU, el);
}
