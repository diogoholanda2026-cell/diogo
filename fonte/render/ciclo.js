// Ciclo de dia e noite no estilo do SimCity BuildIt: quadros-chave por hora do jogo (amanhecer rosa e
// laranja, dia claro das 8h às 16h30, pôr do sol laranja e lilás, crepúsculo violeta e noite azul-violeta
// legível), interpolados sem degraus, e o caminho do sol (arco leste → oeste) e da lua. Nada aqui aloca por
// quadro: amostrar() escreve num vetor reaproveitado e as direções vão em vetores de quem chama.
import * as THREE from 'three';

const GRAU = Math.PI / 180;
// Como no BuildIt, a luz vem sempre da esquerda da tela e as sombras caem para a direita, à vista: o sol nasce
// à esquerda e à frente (-40°), passa alto à esquerda ao meio-dia e se põe à esquerda e um pouco atrás (-100°).
// Assim a manhã e o fim de tarde mudam a altura e a cor da luz sem deixar as fachadas viradas para o
// jogador na contraluz.
export const SOL = { nasce: 5.5, poe: 18.5, elMax: 60 * GRAU, azNasce: -40 * GRAU, azPoe: -100 * GRAU, elMin: 9 * GRAU };
// A lua (luz principal da noite) fica alta e à frente da câmera, fria: as fachadas voltadas para o jogador
// continuam legíveis.
export const LUA = { elBase: 30 * GRAU, elArco: 28 * GRAU, az0: 55 * GRAU, az1: -55 * GRAU };

// fases do contrato (env.fase)
export function faseDe(h) { h = ((h % 24) + 24) % 24; return h >= 4.4 && h < 8 ? 'amanhecer' : h >= 8 && h < 16.5 ? 'dia' : h >= 16.5 && h < 19.7 ? 'entardecer' : 'noite'; }

// ---------------------------------------------------------------- quadros-chave
// cores em sRGB (hex), convertidas para linear na carga; P é a gradação do motor
const NOITE = {
  luz: [0xa8bcff, 0.95], ceuH: 0x34449a, chaoH: 0x10141c, hemi: 0.55, env: 0.4,
  zen: 0x08103a, hor: 0x243278, baixo: 0x10122a, brilho: [0x000000, 0], nevoa: [240, 760], nuvem: [0x3a4686, 0x1c2250],
  noite: 1, estrelas: 1, sombra: 0.6, hao: 1, lua: 1, cidade: 1, rim: [0x8ea4ff, 0.22], nuvK: 0,
  P: { exposure: 1.85, saturation: 1.15, contrast: 1.14, vignette: 0.12, wb: [0.97, 1.0, 1.04], shadowTint: [0.002, 0.0, 0.012], highTint: [0.016, 0.008, -0.004], threshold: 0.7, bloomStrength: 1.6 },
};
const CREP_MANHA = {
  luz: [0xc4a0ff, 0.7], ceuH: 0x5a62c0, chaoH: 0x241e34, hemi: 0.72, env: 0.55,
  zen: 0x1c2470, hor: 0xb07cb0, baixo: 0x241e38, brilho: [0xff8c78, 0.6], nevoa: [200, 700], nuvem: [0xc890b4, 0x4c3e7e],
  noite: 0.8, estrelas: 0.35, sombra: 0.55, hao: 0.95, lua: 0.4, cidade: 0.6, rim: [0xd0a4ff, 0.22], nuvK: 0.04,
  P: { exposure: 1.9, saturation: 1.1, contrast: 1.1, vignette: 0.1, wb: [0.99, 0.97, 1.04], shadowTint: [0.004, 0.0, 0.01], highTint: [0.012, 0.004, -0.002], threshold: 0.8, bloomStrength: 1.3 },
};
const AMANHECER = {
  luz: [0xffa86c, 2.6], ceuH: 0x9aa6e0, chaoH: 0x5c5248, hemi: 0.85, env: 0.8,
  zen: 0x5a86d8, hor: 0xffb496, baixo: 0x54485a, brilho: [0xffa070, 1.3], nevoa: [140, 520], nuvem: [0xffc4ac, 0x9484b6],
  noite: 0.12, estrelas: 0, sombra: 0.82, hao: 0.8, lua: 0, cidade: 0, rim: [0xffc090, 0.32], nuvK: 0.24,
  P: { exposure: 1.25, saturation: 1.12, contrast: 1.09, vignette: 0.08, wb: [1.04, 1.0, 0.97], shadowTint: [0.002, 0.0, 0.01], highTint: [0.012, 0.004, -0.004], threshold: 1.0, bloomStrength: 0.75 },
};
// (dia claro do BuildIt, com o contraste da foto: exposição um pouco menor, contraste e sombras mais fortes,
// oclusão cheia e névoa mais perto; a saturação fica em 1,06 para o verde continuar vivo)
const DIA = {
  luz: [0xfff0d6, 3.7], ceuH: 0xa6d0ff, chaoH: 0x6f9050, hemi: 0.95, env: 0.95,
  zen: 0x3f84e8, hor: 0xd2e8fa, baixo: 0x6e7e5e, brilho: [0xfff2d8, 0.45], nevoa: [85, 400], nuvem: [0xffffff, 0xb6c6e0],
  noite: 0, estrelas: 0, sombra: 0.95, hao: 1.0, lua: 0, cidade: 0, rim: [0xcfe6ff, 0.3], nuvK: 0.42,
  P: { exposure: 1.12, saturation: 1.06, contrast: 1.12, vignette: 0.06, wb: [1.0, 1.0, 1.0], shadowTint: [0.0, 0.002, 0.006], highTint: [0.006, 0.003, -0.004], threshold: 1.15, bloomStrength: 0.35 },
};
const DIA_TARDE = { ...DIA, luz: [0xffecc8, 3.6], hor: 0xdae6f2, brilho: [0xffe4b8, 0.6], P: { ...DIA.P, wb: [1.02, 1.0, 0.98] } };
// hora dourada (manhã e fim de tarde): sol baixo, quente e forte, sombras longas e céu ainda azul
const DOURADA_MANHA = {
  luz: [0xffc47e, 3.8], ceuH: 0xb8c6dc, chaoH: 0x8a9458, hemi: 0.95, env: 0.82,
  zen: 0x5a8ee0, hor: 0xffe2c4, baixo: 0x6a6a5a, brilho: [0xffb060, 0.9], nevoa: [110, 470], nuvem: [0xfff0dc, 0xb8b8d0],
  noite: 0, estrelas: 0, sombra: 0.86, hao: 0.8, lua: 0, cidade: 0, rim: [0xffd8a0, 0.3], nuvK: 0.36,
  P: { exposure: 1.18, saturation: 1.08, contrast: 1.08, vignette: 0.07, wb: [1.04, 1.0, 0.95], shadowTint: [0.0, 0.002, 0.008], highTint: [0.012, 0.005, -0.006], threshold: 1.05, bloomStrength: 0.5 },
};
const DOURADA_TARDE = { ...DOURADA_MANHA, luz: [0xffbe72, 3.9], hor: 0xffdcb4, brilho: [0xffa050, 1.0], rim: [0xffd090, 0.32], nuvK: 0.36 };
const POR_DO_SOL = {
  luz: [0xffb25e, 3.2], ceuH: 0x92a2ea, chaoH: 0x5e5244, hemi: 0.88, env: 0.8,
  zen: 0x4a58c0, hor: 0xffa870, baixo: 0x54445a, brilho: [0xff8a48, 1.5], nevoa: [140, 520], nuvem: [0xffb088, 0x8274b0],
  noite: 0.35, estrelas: 0, sombra: 0.84, hao: 0.8, lua: 0, cidade: 0.25, rim: [0xffb070, 0.45], nuvK: 0.18,
  P: { exposure: 1.42, saturation: 1.12, contrast: 1.1, vignette: 0.09, wb: [1.02, 1.0, 0.97], shadowTint: [0.004, 0.0, 0.012], highTint: [0.016, 0.005, -0.006], threshold: 0.9, bloomStrength: 0.95 },
};
const CREPUSCULO = {
  luz: [0xa890ff, 0.85], ceuH: 0x5e68c8, chaoH: 0x221c32, hemi: 0.8, env: 0.55,
  zen: 0x1e2272, hor: 0xb07ab4, baixo: 0x221c38, brilho: [0xff7262, 0.65], nevoa: [200, 700], nuvem: [0xc28abc, 0x40367e],
  noite: 0.88, estrelas: 0.3, sombra: 0.55, hao: 0.95, lua: 0.5, cidade: 0.75, rim: [0xc8a0ff, 0.25], nuvK: 0.05,
  P: { exposure: 2.2, saturation: 1.12, contrast: 1.1, vignette: 0.1, wb: [0.98, 0.97, 1.05], shadowTint: [0.004, 0.0, 0.012], highTint: [0.014, 0.006, -0.002], threshold: 0.78, bloomStrength: 1.4 },
};
// [hora, quadro] em ordem; 0 e 24 são a mesma noite (o ciclo fecha sem costura)
const QUADROS = [[0, NOITE], [4.4, NOITE], [5.4, CREP_MANHA], [6.3, AMANHECER], [7.2, DOURADA_MANHA], [8, DIA], [16.5, DIA_TARDE], [17.1, DOURADA_TARDE], [17.9, POR_DO_SOL], [18.8, CREPUSCULO], [19.7, NOITE], [24, NOITE]];
// fronteiras dos quadros (o mapa de reflexos é refeito só quando a hora cruza uma delas)
export const FRONTEIRAS = QUADROS.slice(1, -1).map((q) => q[0]).filter((h, i, a) => a.indexOf(h) === i);

// Vetor plano de parâmetros (interpola tudo de uma vez, sem objetos): índices em I
export const I = { luz: 0, luzK: 3, ceuH: 4, chaoH: 7, hemi: 10, env: 11, zen: 12, hor: 15, baixo: 18, brilho: 21, brilhoK: 24, nevoaPerto: 25, nevoaLonge: 26,
  nuvem: 27, nuvemSombra: 30, noite: 33, estrelas: 34, sombra: 35, hao: 36, exposure: 37, saturation: 38, contrast: 39, vignette: 40, wb: 41, shadowTint: 44, highTint: 47,
  threshold: 50, bloomStrength: 51, lua: 52, cidade: 53, rim: 54, rimK: 57, nuvK: 58 };
export const N_PARAM = 59;
const _c = new THREE.Color();
function lin(hex, out, o) { _c.setHex(hex); out[o] = _c.r; out[o + 1] = _c.g; out[o + 2] = _c.b; } // setHex: sRGB → linear
function plano(q) {
  const v = new Float32Array(N_PARAM);
  lin(q.luz[0], v, I.luz); v[I.luzK] = q.luz[1]; lin(q.ceuH, v, I.ceuH); lin(q.chaoH, v, I.chaoH); v[I.hemi] = q.hemi; v[I.env] = q.env;
  lin(q.zen, v, I.zen); lin(q.hor, v, I.hor); lin(q.baixo, v, I.baixo); lin(q.brilho[0], v, I.brilho); v[I.brilhoK] = q.brilho[1];
  v[I.nevoaPerto] = q.nevoa[0]; v[I.nevoaLonge] = q.nevoa[1]; lin(q.nuvem[0], v, I.nuvem); lin(q.nuvem[1], v, I.nuvemSombra);
  v[I.noite] = q.noite; v[I.estrelas] = q.estrelas; v[I.sombra] = q.sombra; v[I.hao] = q.hao; v[I.lua] = q.lua; v[I.cidade] = q.cidade;
  lin(q.rim[0], v, I.rim); v[I.rimK] = q.rim[1]; v[I.nuvK] = q.nuvK;
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
