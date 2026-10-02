// Modelos dos serviços da cidade (R5, D60): cada um desenha no montador (pecas.js) a obra real da referência, no
// espaço do lote (frente para +z, a via; w de frente e d de fundo), com a mesma composição no LOD0 e no LOD1 (o LOD1 é
// o volume com as peças { l1 } e { so1 }). Puro: sem three. Referências (data/colocaveis.js): Marina Barrage, torres
// d'água modernistas, Pirapora e Noor Ouarzazate, calçadão de Copacabana, Rede Sarah, CEU, Palácio Capanema, Vitra Fire
// Station, Newtown Creek, CopenHill, CEU e FDE, marquise do Ibirapuera, Sarah com o Kampung Admiralty e Aterro do
// Flamengo.
import { mat, F, ENTERRA } from './pecas.js';

const TAU = Math.PI * 2;

/** Cores dos serviços (sRGB; albedo real, nada saturado). */
export const COR = Object.freeze({
  concreto: '#b4aea3', concretoClaro: '#c7c2b7', concretoEscuro: '#8f897f', branco: '#ddd9d0', brancoSarah: '#e2e0da',
  inox: '#c4c7ca', aco: '#9aa0a5', grafite: '#3c4043', vidro: '#2f3d48', caixilho: '#5c6267', grama: '#56603f',
  gramaEscura: '#4a5636', piso: '#a29c91', pisoEscuro: '#7d776d', pedraClara: '#d3ccbd', basalto: '#3a3937',
  terra: '#8a7a64', cascalho: '#8b857a', madeira: '#7b5b40', azulejo: '#7d93a8', comporta: '#5d6f7f',
  vermelho: '#8e2f28', ocre: '#b98a5f',
});

/** O chão do lote: uma laje que cobre a planta (topo em 0,05 m, bordas até ENTERRA abaixo). */
export function lote(b, m) {
  b.caixa(0, -ENTERRA, 0, b.w, ENTERRA + 0.05, b.d, m, { l1: true, topo: m });
}

/** Pontos de um arco de (cx, cz), raio r, de a0 a a1 (radianos; 0 = +x, sentido de +x para -z como no torno). */
function arco(cx, cz, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cz - r * Math.sin(a)]);
  }
  return pts;
}

/** Curva suave (Catmull-Rom) pelos pontos de controle, com k passos por trecho. */
export function curva(ctrl, k) {
  const out = [];
  for (let i = 0; i + 1 < ctrl.length; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b2, c, d2) => 0.5 * (2 * b2 + (-a + c) * t + (2 * a - 5 * b2 + 4 * c - d2) * t2 + (-a + 3 * b2 - 3 * c + d2) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

/** Guarda-corpo: um pano fino de metal entre dois pontos na cota y (altura 1,1 m). */
function guarda(b, xa, za, xb, zb, y, m, op = {}) {
  if (b.fora(op)) return;
  b.parede(xa, za, xb, zb, y, y + 1.1, m, { l1: true });
  b.parede(xb, zb, xa, za, y, y + 1.1, m, { l1: true, ao: 0.8 });
}

/** Caixa d'água em torre (CEU e escolas da FDE): fuste, transição e reservatório cilíndrico. */
function torreCaixa(b, x, z, alt, m, op = {}) {
  const r0 = op.fuste ?? 1.6;
  const r1 = op.tanque ?? 3.4;
  const hT = op.altTanque ?? 6;
  b.torno(x, z, [[r0, -ENTERRA], [r0, alt - hT - 1.6], [r1, alt - hT], [r1, alt], [r1 * 0.94, alt + 0.3]], m, { topo: mat(F.LAJE, '#8f8b84'), l1: true });
  if (b.lod === 0) {
    // faixa de cor do reservatório e a escada de marinheiro
    b.torno(x, z, [[r1 + 0.04, alt - hT * 0.55], [r1 + 0.04, alt - hT * 0.35]], op.faixa ?? mat(F.METAL, COR.vermelho), { topo: false });
    b.caixa(x, -0.1, z + r0 + 0.12, 0.6, alt - hT - 1.6, 0.2, mat(F.METAL, COR.grafite), { topo: false });
  }
}

// ------------------------------------------------------------------------------------------------ captação

/**
 * Captação (Marina Barrage): pavilhão de vidro curvo sob um teto verde em rampa, a barragem no fundo com pilares
 * brancos, comportas de aço azul-acinzentado, o tabuleiro com a passarela e as casas de manobra; a câmara de tomada
 * d'água e os canos até as bombas.
 */
function captacao(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, COR.piso);
  const grama = mat(F.VERDE, COR.grama);
  const concreto = mat(F.CONCRETO, COR.concretoClaro, { v: 2 });
  const vidro = mat(F.CORTINA, '#9aa1a6', { a: 4.4, v: 1.6, c2: COR.caixilho, vd: 0.25, uso: 2 });
  const aco = mat(F.METAL, COR.comporta);
  const branco = mat(F.METAL, '#d5d4ce');
  const agua = mat(F.AGUA, '#2a5a5e');
  lote(b, piso);
  // pavilhão: frente curva de vidro, teto verde subindo de 1,6 m (esquerda) a 7 m (direita)
  const zt = -hd * 0.12;
  const n = b.lod ? 4 : b.ultra ? 14 : 8;
  const xm = hw - 1.2;
  const frente = [];
  for (let i = 0; i <= n; i++) {
    const x = -xm + (2 * xm * i) / n;
    frente.push([x, hd - 4.6 + 2.4 * (1 - (x / xm) ** 2)]);
  }
  const pts = [...frente, [xm, zt], [-xm, zt]];
  const alt = (x) => 1.6 + ((x + hw) / b.w) * 5.4;
  b.prisma(pts, 0, 7, concreto, { hTopo: pts.map(([x]) => alt(x)), topo: grama, faces: (k) => (k < n ? vidro : concreto), l1: true });
  // barragem: soleira, pilares, comportas e tabuleiro
  const zb0 = -hd;
  const zb1 = -hd + 7.5;
  const np = 5;
  const lp = 1.4;
  const yt = 5.2;
  b.caixa(0, -ENTERRA, (zb0 + zb1) / 2, b.w, ENTERRA + 1.2, zb1 - zb0, concreto, { l1: true });
  for (let i = 0; i < np; i++) {
    const x = -hw + lp / 2 + ((b.w - lp) * i) / (np - 1);
    b.caixa(x, 1.2, (zb0 + zb1) / 2, lp, yt - 1.2, zb1 - zb0, concreto, {});
    // casa de manobra da comporta sobre o pilar
    if (i > 0 && i < np - 1) b.caixa(x, yt + 0.6, (zb0 + zb1) / 2 + 1.2, 2.2, 2.6, 3.2, branco, { topo: mat(F.METAL, '#9fa3a4'), l1: true });
  }
  // comportas entre os pilares: chapa curva (três faces) recuada no meio
  const vao = (b.w - lp) / (np - 1) - lp;
  for (let i = 0; i < np - 1; i++) {
    const xc = -hw + lp + ((b.w - lp) * i) / (np - 1) + vao / 2;
    const zc = (zb0 + zb1) / 2 - 0.8;
    b.prisma([[xc - vao / 2, zc + 0.3], [xc + vao / 2, zc + 0.3], [xc + vao / 2, zc - 0.3], [xc, zc - 0.9], [xc - vao / 2, zc - 0.3]], 1.2, yt - 1.5, aco, { topo: aco });
  }
  // volume da barragem no LOD1 (os pilares e as comportas juntos)
  b.caixa(0, 1.2, (zb0 + zb1) / 2, b.w, yt - 1.2, zb1 - zb0 - 1, aco, { so1: true });
  // tabuleiro e passarela de pedestres com guarda-corpo
  b.laje(0, yt + 0.6, (zb0 + zb1) / 2 + 1.2, b.w, 4.6, 0.6, concreto, { l1: true });
  guarda(b, -hw, zb1 - 0.2, hw, zb1 - 0.2, yt + 0.6, branco);
  guarda(b, hw, zb0 + 1.6, -hw, zb0 + 1.6, yt + 0.6, branco);
  // câmara de tomada d'água: tanque elevado com a água à vista
  const zc0 = zb1;
  const zc1 = zt - 1.2;
  const cw = b.w * 0.62;
  if (zc1 - zc0 > 2) {
    b.caixa(-hw * 0.18, 0, (zc0 + zc1) / 2, cw, 1.5, zc1 - zc0, concreto, { topo: false, l1: true });
    b.plano(-hw * 0.18 - cw / 2 + 0.3, zc0 + 0.3, -hw * 0.18 + cw / 2 - 0.3, zc1 - 0.3, 1.15, agua, { l1: true });
    // a passarela de aço: da crista do teto verde ao tabuleiro, por cima da câmara
    const xp = hw - 3.2;
    b.viga([xp, alt(xp) - 0.2, zt + 0.5], [xp, yt + 0.4, zb1 - 0.4], 2.2, 0.5, mat(F.METAL, '#cfcfca'), {});
    if (b.lod === 0) for (const s of [-1, 1]) b.viga([xp + s * 1.05, alt(xp) + 0.85, zt + 0.5], [xp + s * 1.05, yt + 1.45, zb1 - 0.4], 0.06, 1.1, branco, {});
  }
  // canos da câmara até as bombas no pavilhão
  for (const x of [-hw * 0.55, -hw * 0.25]) b.tubo([x, 0.75, zc0 + 0.5], [x, 0.75, zt + 0.3], 0.55, mat(F.METAL, COR.aco), {});
  // frente: árvores pequenas, postes e a placa
  for (let i = 0; i < 3; i++) b.arvore(-hw + 3 + i * 3.2, 0.05, hd - 2.4, { alt: b.entre(10 + i, 5.2, 6.4), raio: 1.9, especie: 'oiti' });
  b.poste(hw - 1, 0.05, hd - 1, 5);
  b.caixa(hw - 4, 0.05, hd - 0.8, 3, 1.2, 0.3, mat(F.LETREIRO, '#2e4a63'), { topo: mat(F.METAL, COR.grafite) });
}

// ------------------------------------------------------------------------------------------------ poço

/**
 * Poço (torres d'água modernistas, Olinda): torre prismática de cobogó sobre pilotis com o reservatório em cima e a
 * laje em balanço; casa de bombas baixa de cobogó com a laje fina; a boca do poço e o cano que sobe a torre.
 */
function poco(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, COR.piso);
  const grama = mat(F.VERDE, COR.grama);
  const cobogo = mat(F.COBOGO, '#d8d2c4', { a: 3, v: 2.4, uso: 3 });
  const liso = mat(F.LISO, '#d9d4c8');
  const concreto = mat(F.CONCRETO, COR.concretoClaro);
  const laje = mat(F.LAJE, '#8f8b84');
  lote(b, piso);
  b.plano(-hw + 0.5, -hd + 0.5, -hw + 6.5, hd - 0.5, 0.07, grama, {});
  // torre: pilotis, fuste de cobogó com a faixa lisa da escada, reservatório e a laje de cobertura em balanço
  const tx = -hw + 4.6;
  const tz = -hd + 4.6;
  const L = 4.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.caixa(tx + sx * (L / 2 - 0.3), -ENTERRA, tz + sz * (L / 2 - 0.3), 0.5, ENTERRA + 4, 0.5, concreto, { topo: false });
  b.caixa(tx, 3.6, tz, L + 0.4, 0.4, L + 0.4, concreto, {});
  b.caixa(tx, 4, tz, L, 14.5, L, cobogo, { faces: { nx: liso }, topo: false, vBase: 4 });
  b.caixa(tx, 18.5, tz, L + 1.2, 5, L + 1.2, liso, { topo: false, vBase: 18.5 });
  b.laje(tx, 24.2, tz, L + 2.4, L + 2.4, 0.5, concreto, {});
  b.caixa(tx, -ENTERRA, tz, L + 2.4, 24.2 + ENTERRA, L + 2.4, liso, { so1: true, topo: laje });
  // cano que sobe a torre
  b.tubo([tx + L / 2 + 0.35, 0.3, tz + 0.8], [tx + L / 2 + 0.35, 18.5, tz + 0.8], 0.18, mat(F.METAL, COR.aco), {});
  // casa de bombas: frente de cobogó, laje fina com beiral
  const cx = hw - 4.4;
  const cz = hd - 4.2;
  b.caixa(cx, 0, cz, 7, 3.4, 5, liso, { faces: { pz: cobogo, nx: cobogo }, topo: false, l1: true });
  b.laje(cx, 3.75, cz, 8.4, 6.2, 0.35, concreto, { topo: laje, l1: true });
  b.caixa(cx + 1.6, 0.05, cz + 2.55, 1.4, 2.3, 0.12, mat(F.PORTA, '#5a5f62', { c2: '#3c4043' }), { topo: false });
  // boca do poço e o cano até a casa de bombas
  b.cilindro(cx - 1, 0.05, -hd + 3.6, 0.7, 0.8, concreto, {});
  b.tubo([cx - 1, 0.5, -hd + 3.6], [cx - 1, 0.5, cz - 2.5], 0.16, mat(F.METAL, COR.aco), {});
  b.tubo([cx - 3.5, 0.6, cz - 1], [tx + L / 2 + 0.35, 0.6, tz + 0.8], 0.18, mat(F.METAL, COR.aco), {});
  // muro baixo de fundo e uma árvore
  b.caixa(0, 0, -hd + 0.15, b.w, 1.6, 0.3, liso, {});
  b.arvore(hw - 2.4, 0.05, -hd + 3, { alt: 7, raio: 2.4, especie: 'oiti' });
}

// ------------------------------------------------------------------------------------------------ usina solar

/**
 * Usina solar (Pirapora; o prédio de controle de Noor Ouarzazate): fileiras de rastreadores de um eixo (mesa de dois
 * módulos em retrato sobre o tubo de torque e as estacas), inversores, o prédio de controle de reboco cor de terra com
 * janelas fundas e beiral, a subestação e o mastro.
 */
function solar(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const brita = mat(F.PISO, COR.cascalho);
  const painel = mat(F.SOLAR, '#20262e', { c2: '#9aa0a6' });
  const chapa = mat(F.METAL, '#8c9196');
  const aco = mat(F.METAL, COR.aco);
  const reboco = mat(F.JANELA, '#bf9a72', { a: 4.6, v: 2.6, uso: 2, c2: '#4b3f35', dg: 0.4 });
  const terra = mat(F.LISO, '#bf9a72', { dg: 0.4 });
  const laje = mat(F.LAJE, '#8a8379');
  lote(b, brita);
  // campo: fileiras ao longo de z (norte-sul), giradas para o sol da tarde
  const z0 = -hd + 1.5;
  const z1 = hd - 15;
  const passo = b.ultra ? 4.4 : 5.2;
  const nf = Math.max(2, Math.floor((b.w - 4) / passo));
  const larg = 3.4;
  const giro = 0.36;
  const yEixo = 2.1;
  const ca = Math.cos(giro);
  const sa = Math.sin(giro);
  const estacas = Math.max(2, Math.round((z1 - z0) / (b.ultra ? 5 : 8)) + 1);
  for (let i = 0; i < nf; i++) {
    const x = -((nf - 1) * passo) / 2 + i * passo;
    const ex = (larg / 2) * ca;
    const ey = (larg / 2) * sa;
    const a = [x - ex, yEixo - ey, z1];
    const bb = [x - ex, yEixo - ey, z0];
    const c = [x + ex, yEixo + ey, z0];
    const dd = [x + ex, yEixo + ey, z1];
    b.placa(a, bb, c, dd, 0.06, painel, { baixo: chapa, l1: true });
    b.tubo([x, yEixo - 0.18, z0 + 0.3], [x, yEixo - 0.18, z1 - 0.3], 0.07, aco, { lados: 4 });
    for (let k = 0; k < estacas; k++) {
      const z = z0 + 0.6 + ((z1 - z0 - 1.2) * k) / (estacas - 1);
      b.tubo([x, -0.3, z], [x, yEixo - 0.2, z], 0.09, aco, { lados: 4 });
    }
  }
  // inversores (contêineres brancos entre as fileiras)
  for (const [x, z] of [[-hw * 0.5, z1 + 2.8], [hw * 0.45, z1 + 2.8]]) b.caixa(x, 0.05, z, 6, 2.6, 2.4, mat(F.METAL, '#d0d0ca'), { topo: chapa });
  // prédio de controle: volume baixo de terra, janelas fundas, laje com beiral e o pórtico de entrada
  const pz = hd - 7.5;
  b.caixa(-hw * 0.28, 0, pz, 18, 4.6, 8, reboco, { faces: { nx: terra, px: terra }, topo: laje, l1: true });
  b.laje(-hw * 0.28, 5.1, pz, 20.4, 10, 0.4, mat(F.CONCRETO, '#a69c8f'), { l1: true });
  b.caixa(-hw * 0.28 - 6, 0, pz + 4.6, 0.6, 4.7, 0.6, terra, {});
  b.caixa(-hw * 0.28 + 6, 0, pz + 4.6, 0.6, 4.7, 0.6, terra, {});
  // painéis no teto do prédio
  if (b.lod === 0) for (let k = 0; k < 3; k++) b.placa([-hw * 0.28 - 7 + k * 5, 5.9, pz + 2.5], [-hw * 0.28 - 3 + k * 5, 5.9, pz + 2.5], [-hw * 0.28 - 3 + k * 5, 6.5, pz - 0.5], [-hw * 0.28 - 7 + k * 5, 6.5, pz - 0.5], 0.05, painel, { baixo: chapa });
  // subestação: transformadores, pórtico de saída e cerca
  const sx = hw - 7;
  b.caixa(sx, 0.05, pz, 10, 0.3, 9, mat(F.PISO, COR.pisoEscuro), {});
  for (const dz of [-2.2, 2.2]) {
    b.caixa(sx - 1.5, 0.35, pz + dz, 2.6, 2.4, 1.8, mat(F.METAL, '#7d8489'), {});
    for (let k = 0; k < 3; k++) b.cilindro(sx - 2.3 + k * 0.8, 2.75, pz + dz, 0.12, 1.1, mat(F.METAL, '#b8b3a5'), { lados: 4 });
  }
  for (const dx of [-0.5, 3.6]) {
    b.tubo([sx + dx, 0.3, pz - 3.6], [sx + dx, 7, pz - 3.6], 0.15, aco, { lados: 4 });
    b.tubo([sx + dx, 0.3, pz + 3.6], [sx + dx, 7, pz + 3.6], 0.15, aco, { lados: 4 });
    b.viga([sx + dx, 6.8, pz - 3.6], [sx + dx, 6.8, pz + 3.6], 0.3, 0.4, aco, {});
  }
  // mastro de medição (o mais alto)
  b.tubo([-hw + 1.5, -0.3, hd - 1.5], [-hw + 1.5, 9, hd - 1.5], 0.12, aco, { lados: 4, l1: true });
  // cerca do perímetro (Ultra): mourões a cada 6 m e o arame de cima
  if (b.ultra) {
    const cantos = [[-hw + 0.3, hd - 0.3], [-hw + 0.3, -hd + 0.3], [hw - 0.3, -hd + 0.3], [hw - 0.3, hd - 0.3]];
    for (let k = 0; k < 3; k++) {
      const [xa, za] = cantos[k];
      const [xb, zb] = cantos[k + 1];
      const L = Math.hypot(xb - xa, zb - za);
      const nm = Math.round(L / 6);
      for (let i = 0; i <= nm; i++) b.tubo([xa + ((xb - xa) * i) / nm, -0.2, za + ((zb - za) * i) / nm], [xa + ((xb - xa) * i) / nm, 2.1, za + ((zb - za) * i) / nm], 0.05, aco, { lados: 4 });
      b.tubo([xa, 2, za], [xb, 2, zb], 0.03, aco, { lados: 4 });
    }
  }
}

// ------------------------------------------------------------------------------------------------ praça

/**
 * Praça (calçadão de Copacabana, Burle Marx): pedra portuguesa clara com as ondas de basalto, canteiros redondos com
 * as árvores (da vegetação), bancos, postes e um quiosque de vidro.
 */
function praca(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  // pedra portuguesa: as pedrinhas de uns 8 cm pelo piso em escala fina
  const clara = mat(F.PISO, COR.pedraClara);
  const escura = mat(F.PISO, COR.basalto);
  const concreto = mat(F.CONCRETO, '#bdb7ab');
  lote(b, mat(F.PISO, '#b9b2a4'));
  b.plano(-hw + 0.25, -hd + 0.25, hw - 0.25, hd - 0.25, 0.06, clara, { escalaUV: 10, l1: true });
  // ondas: faixas escuras senoidais paralelas, como o calçadão da orla
  const ondas = 5;
  const passos = b.ultra ? 48 : 24;
  const lam = b.w / 2.5;
  const A = 1.25;
  for (let k = 0; k < ondas; k++) {
    const zc = -hd + ((k + 0.5) * b.d) / ondas;
    const pts = [];
    for (let i = 0; i <= passos; i++) {
      const x = -hw + 1.1 + ((b.w - 2.2) * i) / passos;
      pts.push([x, zc + A * Math.sin((TAU * x) / lam + k * 0.4)]);
    }
    b.faixa(pts, 0.07, 0.95, escura, { escalaUV: 10 });
  }
  // canteiros com árvores de copa redonda e um oiti no canto (os ipês quando a vegetação tiver a espécie)
  const arvores = [[-hw + 5, -hd + 5], [hw - 5, -hd + 5], [-hw + 5, hd - 5], [hw - 5, hd - 5], [0, -hd + 6.5], [0, hd - 6.5], [-hw + 6.5, 0], [hw - 6.5, 0]];
  arvores.forEach(([x, z], k) => {
    b.cilindro(x, 0.05, z, 1.7, 0.45, concreto, { topo: mat(F.VERDE, COR.gramaEscura), lados: b.lod ? 8 : 12 });
    b.arvore(x, 0.5, z, { alt: b.entre(30 + k, 8.2, 10.6), raio: b.entre(40 + k, 2.8, 3.6), especie: k === 7 ? 'oiti' : 'mata2' });
  });
  // bancos em volta do centro e postes
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.PI / 8;
    b.banco(Math.cos(a) * 7.2, 0.05, -Math.sin(a) * 7.2, a + Math.PI / 2);
  }
  for (const [x, z] of [[-hw + 1.2, hd - 1.2], [hw - 1.2, hd - 1.2], [-hw + 1.2, -hd + 1.2], [hw - 1.2, -hd + 1.2]]) b.poste(x, 0.05, z, 6, { l1: true });
  // quiosque de vidro com a cobertura leve
  const qx = hw - 9;
  const qz = hd - 3.6;
  b.cilindro(qx, 0.05, qz, 1.8, 3, mat(F.CORTINA, '#a3a8aa', { a: 3, v: 1.2, c2: '#d8d6d0', uso: 1 }), { topo: false, lados: 12, lados1: 6, l1: true });
  b.torno(qx, qz, [[3, 3], [3, 3.25], [0.4, 3.6], [0, 3.6]], mat(F.METAL, '#d8d6d0'), { lados: 12, lados1: 6, l1: true });
}

// ------------------------------------------------------------------------------------------------ clínica

/** Pavilhão da Rede Sarah: alas brancas em volta de um jardim, sheds curvos de chapa branca e a marquise curva. */
function alasSarah(b, x0, x1, z0, z1, pz0, pz1, px0, px1, alt, op = {}) {
  const parede = mat(F.FITA, COR.brancoSarah, { a: alt, v: 1.4, c2: '#d6d8d6', uso: 2, dg: 0.15 });
  const chapa = mat(F.TELHA_METAL, '#dedcd5');
  const vidro = mat(F.VIDRO, '#4a5a66');
  const oitao = mat(F.LISO, COR.brancoSarah);
  const laje = mat(F.LAJE, '#a9a49b');
  // as quatro alas: frente, fundo e os lados (o pátio [px0, px1] x [pz0, pz1] fica aberto)
  const alas = [
    [x0, x1, pz1, z1],
    [x0, x1, z0, pz0],
    [x0, px0, pz0, pz1],
    [px1, x1, pz0, pz1],
  ];
  const y0 = op.y0 ?? 0;
  const terraco = mat(F.VERDE, COR.grama);
  alas.forEach(([a0, a1, c0, c1], k) => {
    if (a1 - a0 < 1 || c1 - c0 < 1) return;
    // a ala com terraço (o teto-parque do Kampung Admiralty) fica sem sheds
    const ehTerraco = op.terraco?.includes(k);
    b.caixa((a0 + a1) / 2, y0, (c0 + c1) / 2, a1 - a0, alt, c1 - c0, parede, { topo: ehTerraco ? terraco : laje, l1: true });
    if (ehTerraco) return;
    // sheds ao longo de z, com 3 a 5 m de passo
    const ns = Math.max(1, Math.round((c1 - c0) / 4.2));
    b.shedsCurvos(a0 + 0.4, a1 - 0.4, c0 + 0.3, c1 - 0.3, y0 + alt, op.hShed ?? 2.2, ns, chapa, vidro, oitao, {});
    b.caixa((a0 + a1) / 2, y0 + alt, (c0 + c1) / 2, a1 - a0 - 0.8, op.hShed ?? 2.2, c1 - c0 - 0.6, chapa, { so1: true });
  });
}

function clinica(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const grama = mat(F.VERDE, COR.grama);
  const piso = mat(F.PISO, '#b0aa9f');
  const branco = mat(F.CONCRETO, COR.brancoSarah);
  lote(b, grama);
  // calçada e o acesso coberto
  b.plano(-hw + 0.3, hd - 7, hw - 0.3, hd - 0.3, 0.08, piso, {});
  const x0 = -hw + 2;
  const x1 = hw - 2;
  const z0 = -hd + 2;
  const z1 = hd - 9;
  alasSarah(b, x0, x1, z0, z1, z0 + 11, z1 - 10, x0 + 9, x1 - 9, 4.6, {});
  // jardim interno: gramado, espelho d'água e árvores
  const jx = (x0 + x1) / 2;
  const jz = (z0 + 11 + z1 - 10) / 2;
  b.plano(jx - 5, jz - 3, jx + 5, jz + 1, 0.1, mat(F.AGUA, '#2a5a5e'), {});
  b.arvore(jx - 5.6, 0.05, jz + 3, { alt: 7.5, raio: 2.6, especie: 'oiti' });
  b.arvore(jx + 5.2, 0.05, jz - 4.2, { alt: 6.8, raio: 2.3, especie: 'mata2' });
  // marquise curva de Lelé sobre o acesso, em pilares finos
  const n = b.lod ? 4 : b.ultra ? 16 : 10;
  const linha = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    linha.push([-hw + 4 + t * (b.w - 8), hd - 4.6 + 1.6 * Math.sin(t * Math.PI)]);
  }
  b.faixa(linha, 3.9, 1.9, branco, { esp: 0.25, l1: true });
  if (b.lod === 0) for (let i = 1; i < n; i += 2) b.tubo([linha[i][0], 0.05, linha[i][1]], [linha[i][0], 3.65, linha[i][1]], 0.12, branco, { lados: 6 });
  // árvores na frente e no fundo
  for (let k = 0; k < 4; k++) b.arvore(-hw + 4 + k * ((b.w - 8) / 3), 0.05, -hd + 2.6, { alt: b.entre(50 + k, 6.5, 8), raio: 2.2, especie: 'mata2' });
}

// ------------------------------------------------------------------------------------------------ escolas (CEU, FDE)

/** Bloco didático sobre pilotis: térreo livre com o núcleo envidraçado, dois andares de janelas em fita e a laje. */
function blocoDidatico(b, cx, cz, w, d, andares, op = {}) {
  const pe = 3.6;
  const piloti = op.piloti ?? 4.2;
  const fita = mat(F.FITA, '#cdc8bd', { a: pe, v: 1.5, c2: op.cor ?? COR.vermelho, uso: 2, dg: 0.3 });
  const concreto = mat(F.CONCRETO, '#b9b3a8');
  const laje = mat(F.LAJE, '#8f8b84');
  const nucleo = mat(F.CORTINA, '#9ba3a8', { a: piloti, v: 1.8, c2: '#555c61', uso: 2 });
  const h = andares * pe;
  // pilotis em duas fileiras
  const nc = Math.max(2, Math.round(w / 6) + 1);
  if (b.lod === 0) for (let i = 0; i < nc; i++) {
    const x = cx - w / 2 + 0.6 + ((w - 1.2) * i) / (nc - 1);
    for (const s of [-1, 1]) b.caixa(x, -ENTERRA, cz + s * (d / 2 - 0.6), 0.7, piloti + ENTERRA, 0.7, concreto, { topo: false });
  }
  b.caixa(cx - w * 0.15, 0, cz, w * 0.4, piloti, d - 3, nucleo, { topo: false, l1: true });
  b.caixa(cx, piloti, cz, w, h, d, fita, { faces: { px: concreto, nx: concreto }, topo: laje, vt: h - 0.9, vBase: piloti, l1: true });
  // escada e elevador numa torre de concreto na ponta
  b.caixa(cx + w / 2 + 2, 0, cz, 4, piloti + h + 1.2, 5, concreto, { topo: laje, l1: true });
  b.caixa(cx, -ENTERRA, cz, w, piloti + ENTERRA, d - 1.4, concreto, { so1: true, topo: false });
}

/** Quadra coberta: piso esportivo, pilares e a abóbada de chapa. */
function quadraCoberta(b, cx, cz, w, d, op = {}) {
  const pilar = mat(F.CONCRETO, '#bfb9ae');
  const chapa = mat(F.TELHA_METAL, op.cor ?? '#a7adb0');
  const quadra = mat(F.PISO, '#6d7c71');
  const h = op.alt ?? 7.5;
  b.plano(cx - w / 2 + 1, cz - d / 2 + 1, cx + w / 2 - 1, cz + d / 2 - 1, 0.08, quadra, { escalaUV: 0.5 });
  const np = Math.max(2, Math.round(w / 8) + 1);
  for (let i = 0; i < np; i++) {
    const x = cx - w / 2 + 0.5 + ((w - 1) * i) / (np - 1);
    for (const s of [-1, 1]) b.caixa(x, -ENTERRA, cz + s * (d / 2 - 0.5), 0.6, h + ENTERRA, 0.6, pilar, { topo: false });
  }
  b.abobada(cx, h, cz, w, d, d * 0.16, chapa, { esp: 0.15, l1: true });
}

/**
 * Escola fundamental (CEU): o bloco didático longo sobre pilotis no fundo, a quadra coberta em abóbada, a piscina, a
 * caixa d'água em torre e o pátio.
 */
function escolaF(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, '#a7a196');
  const grama = mat(F.VERDE, COR.grama);
  lote(b, piso);
  b.plano(-hw + 0.5, hd - 10, hw - 0.5, hd - 0.5, 0.08, grama, {});
  blocoDidatico(b, -2.5, -hd + 8, b.w - 11, 11, 2, { cor: '#9a4636' });
  quadraCoberta(b, -hw + 13.5, 3, 25, 18, {});
  // piscina com o deck
  const px = hw - 8;
  const pz = 1;
  b.plano(px - 6.5, pz - 7.5, px + 6.5, pz + 7.5, 0.1, mat(F.PISO, '#c4bdb0'), {});
  b.plano(px - 4.2, pz - 6, px + 4.2, pz + 6, 0.13, mat(F.AGUA, '#2f6a70'), {});
  torreCaixa(b, hw - 4.5, hd - 5, 27, mat(F.CONCRETO, '#c2bcb1'), { faixa: mat(F.METAL, '#9a4636') });
  for (let k = 0; k < 4; k++) b.arvore(-hw + 4 + k * 7, 0.05, hd - 4, { alt: b.entre(60 + k, 6.5, 8.5), raio: 2.4, especie: 'mata2' });
}

/** Escola de ensino médio (CEU com os blocos da FDE): dois blocos ligados por passarela e o pátio coberto. */
function escolaM(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, '#a7a196');
  const grama = mat(F.VERDE, COR.grama);
  const chapa = mat(F.TELHA_METAL, '#aeb3b4');
  const pilar = mat(F.METAL, '#5c6266');
  const vidro = mat(F.CORTINA, '#9aa3a8', { a: 3.6, v: 1.5, c2: '#5c6266', uso: 2 });
  lote(b, piso);
  b.plano(-hw + 0.5, hd - 8, hw - 0.5, hd - 0.5, 0.08, grama, {});
  blocoDidatico(b, -3, -hd + 7, b.w - 12, 10, 2, { cor: '#3f5a78' });
  blocoDidatico(b, -3, -hd + 27, b.w - 12, 10, 2, { cor: '#9a6a3a', piloti: 4.2 });
  // passarela coberta no segundo andar, entre os dois blocos
  b.caixa(4, 4.2 + 3.6, -hd + 17, 3.2, 3, 10, vidro, { topo: mat(F.LAJE, '#8f8b84') });
  // pátio coberto entre os blocos: chapa leve em pilares finos
  b.laje(-3, 5, -hd + 17, b.w - 18, 8.6, 0.2, chapa, {});
  if (b.lod === 0) for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.tubo([-3 - (b.w - 20) / 2 + ((b.w - 20) * i) / 5, 0.05, -hd + 17 + s * 4], [-3 - (b.w - 20) / 2 + ((b.w - 20) * i) / 5, 4.8, -hd + 17 + s * 4], 0.12, pilar, { lados: 4 });
  quadraCoberta(b, -hw + 14, hd - 19, 26, 20, { cor: '#9fa6a9' });
  torreCaixa(b, hw - 5, hd - 6, 28, mat(F.CONCRETO, '#c2bcb1'), { faixa: mat(F.METAL, '#3f5a78') });
  for (let k = 0; k < 3; k++) b.arvore(hw - 4, 0.05, hd - 16 - k * 7, { alt: b.entre(70 + k, 7, 9), raio: 2.6, especie: 'mata2' });
}

// ------------------------------------------------------------------------------------------------ delegacia

/**
 * Delegacia (Palácio Capanema): a lâmina alta sobre pilotis de 6,5 m com a face de brise-soleil horizontal para a rua
 * e a de vidro para o fundo, empenas de pedra, o bloco baixo de azulejo com o jardim no teto e o saguão de vidro.
 */
function delegacia(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const pedra = mat(F.PEDRA, '#d0c9bb', { v: 1.2 });
  const piso = mat(F.PISO, '#b3ad9f');
  const brise = mat(F.BRISE_H, '#c9c4b8', { a: 3.4, v: 1.6, c2: '#71879a', uso: 2, dg: 0.25 });
  const pele = mat(F.CORTINA, '#8d979e', { a: 3.4, v: 1.4, c2: '#4f575c', uso: 2, vd: 0.3 });
  const empena = mat(F.PEDRA, '#b8b0a2', { v: 0.8 });
  const concreto = mat(F.CONCRETO, '#c9c3b7');
  const laje = mat(F.LAJE, '#8f8b84');
  const azulejo = mat(F.PASTILHA, COR.azulejo, { a: 5, v: 40, c2: COR.azulejo, uso: 2 });
  const verde = mat(F.VERDE, COR.grama);
  lote(b, piso);
  // a lâmina: 28 m de frente, 10 de fundo, 6 andares sobre pilotis
  const lw = b.w - 4;
  const ld = 10;
  const lz = -hd + 9;
  const yp = 6.5;
  const pe = 3.4;
  const and = 6;
  const yt = yp + and * pe;
  b.caixa(0, yp, lz, lw, and * pe, ld, brise, { faces: { nz: pele, px: empena, nx: empena }, topo: laje, vBase: yp, l1: true });
  b.laje(0, yt + 0.5, lz, lw + 0.4, ld + 0.4, 0.5, concreto, { l1: true });
  // pilotis redondos em duas fileiras e o saguão de vidro recuado
  const nc = 7;
  if (b.lod === 0) for (let i = 0; i < nc; i++) {
    const x = -lw / 2 + 1.2 + ((lw - 2.4) * i) / (nc - 1);
    for (const s of [-1, 1]) b.cilindro(x, -ENTERRA, lz + s * (ld / 2 - 1.4), 0.45, yp + ENTERRA, concreto, { topo: false, lados: b.ultra ? 12 : 8 });
  }
  b.caixa(2, 0, lz, lw * 0.45, 4.2, ld - 4, pele, { topo: laje, l1: true });
  b.caixa(0, -ENTERRA, lz, lw, yp + ENTERRA, ld - 2.4, concreto, { so1: true, topo: false });
  // casa de máquinas curva no teto (a caixa d'água de linhas curvas do Capanema)
  b.prisma([[-6, lz + 2.5], [1, lz + 2.5], [1, lz - 2.5], [-6, lz - 2.5]], yt + 0.5, 3.4, concreto, { topo: laje, l1: true });
  b.cilindro(1, yt + 0.5, lz, 2.5, 3.4, concreto, { topo: laje, l1: true });
  // bloco baixo perpendicular: azulejo azul e branco, jardim no teto
  const bx = -hw + 7.5;
  const bz = lz + ld / 2 + 8;
  b.caixa(bx, 0, bz, 11, 5, 16, azulejo, { faces: { px: pele }, topo: verde, l1: true });
  for (let k = 0; k < 3; k++) b.arvore(bx - 2.5 + k * 2.6, 5.05, bz - 5 + k * 4.5, { alt: 3.2, raio: 1.3, especie: 'moita' });
  // jardim de chão de Burle Marx (canteiros curvos) e a placa da delegacia
  const n = b.lod ? 3 : 12;
  const canteiro = [];
  for (let i = 0; i <= n; i++) canteiro.push([2 + (i / n) * (hw - 4), hd - 4 + 1.6 * Math.sin((i / n) * Math.PI * 2)]);
  b.faixa(canteiro, 0.12, 1.6, verde, {});
  b.caixa(hw - 3, 0.05, hd - 1, 3.2, 1.1, 0.35, mat(F.LETREIRO, '#2e4a63'), { topo: concreto });
  // viaturas no pátio da frente
  b.veiculo(-1, 0.05, hd - 2.2, Math.PI / 2, { comp: 4.6, larg: 1.8, alt: 0.8, cor: '#dcdcd8', corCabine: '#dcdcd8' });
  b.veiculo(4, 0.05, hd - 2.2, Math.PI / 2, { comp: 4.6, larg: 1.8, alt: 0.8, cor: '#2e4a63', corCabine: '#dcdcd8' });
}

// ------------------------------------------------------------------------------------------------ bombeiros

/**
 * Quartel de bombeiros (Vitra Fire Station): volumes longos em cunha de concreto liso com as paredes inclinadas, a
 * marquise em lâmina que avança em balanço sobre o pátio, as portas das viaturas, a torre de treino e os caminhões.
 */
function bombeiros(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, '#9d978c');
  const conc = mat(F.CONCRETO, '#c5c0b6', { v: 2 });
  const vidro = mat(F.CORTINA, '#7d878e', { a: 3.6, v: 2, c2: '#3c4144', uso: 2 });
  const porta = mat(F.GARAGEM, '#a33a30', { v: 4.5 });
  const laje = mat(F.LAJE, '#9a958c');
  const grama = mat(F.VERDE, COR.grama);
  lote(b, piso);
  b.plano(-hw + 0.5, -hd + 0.5, -hw + 7, hd - 9, 0.08, grama, {});
  // volume A: o salão das viaturas, em cunha, aberto para a rua com as portas
  const A = [[-hw + 3, hd - 11], [hw - 4, hd - 9.5], [hw - 6, 1], [-hw + 5, -1]];
  b.prisma(A, 0, 7.5, conc, { hTopo: [7.2, 8.2, 8.2, 7.2], faces: (k) => (k === 0 ? porta : k === 2 ? vidro : conc), topo: laje, l1: true });
  // volume B: o corpo longo atrás, com as paredes que se inclinam
  const B = [[-hw + 2, -1.5], [hw - 2, -3], [hw - 6, -8.5], [-hw + 6, -6]];
  const Bc = [[-hw + 2.8, -1.7], [hw - 1.2, -3.4], [hw - 5.2, -8.1], [-hw + 6.6, -5.8]];
  b.prisma(B, 0, 10.5, conc, { cima: Bc, hTopo: [9.6, 11.2, 11.2, 9.6], faces: (k) => (k === 0 ? vidro : conc), topo: laje, l1: true });
  // a lâmina em balanço: ponta aguda sobre o pátio, apoiada por colunas finas inclinadas
  const M = [[-hw - 0.5 + 1, hd - 3.5], [hw - 1, hd - 6.8], [hw - 3, hd - 9.2], [-hw + 9, hd - 8.2]];
  b.prisma(M, 6.9, 0.45, conc, { topo: conc, base: conc, l1: true });
  if (b.lod === 0) {
    for (const [x, z, dx] of [[-hw + 4, hd - 5, 0.8], [-hw + 6.2, hd - 5.4, -0.6], [-hw + 9, hd - 6.4, 0.5]]) b.tubo([x, 0.05, z], [x + dx, 6.95, z - 0.6], 0.09, mat(F.METAL, '#3c4043'), { lados: 4 });
  }
  // volume C: a torre de treino, uma cunha alta e fina no fundo
  const C = [[hw - 9, -10], [hw - 4.5, -10.5], [hw - 3.5, -hd + 2], [hw - 7.5, -hd + 2.6]];
  b.prisma(C, 0, 18, conc, { hTopo: [17, 18, 18, 17.4], faces: (k) => (k === 1 ? vidro : conc), topo: laje, l1: true });
  // viaturas na frente das portas
  for (let k = 0; k < 2; k++) b.veiculo(-hw + 9 + k * 7.5, 0.05, hd - 5.8 + k * 0.6, -0.06, { comp: 8.4, larg: 2.5, alt: 2.4, cor: '#9a2f28', corCabine: '#9a2f28' });
}

// ------------------------------------------------------------------------------------------------ ETE

/** Ovo digestor (Newtown Creek): perfil de ovo de aço inox, sobre o anel de base. */
function ovo(b, x, z, R, H, op = {}) {
  const inox = mat(F.METAL, COR.inox);
  const base = mat(F.CONCRETO, '#b7b1a6');
  b.cilindro(x, -ENTERRA, z, R * 0.62, ENTERRA + 1.6, base, { topo: false, l1: true });
  const P = b.lod
    ? [[R * 0.3, 1.5], [R * 0.85, H * 0.2], [R, H * 0.42], [R * 0.82, H * 0.74], [0, H]]
    : [[R * 0.3, 1.5], [R * 0.62, H * 0.1], [R * 0.85, H * 0.2], [R * 0.97, H * 0.31], [R, H * 0.42], [R * 0.96, H * 0.54], [R * 0.82, H * 0.74], [R * 0.56, H * 0.88], [R * 0.26, H * 0.97], [0, H]];
  b.torno(x, z, P, inox, { liso: true, l1: true, ladosBase: 16 });
  if (b.lod === 0 && op.costuras) for (const t of [0.31, 0.54]) b.torno(x, z, [[R * (t === 0.31 ? 0.97 : 0.96) + 0.05, H * t - 0.12], [R * (t === 0.31 ? 0.97 : 0.96) + 0.05, H * t + 0.12]], mat(F.METAL, '#9fa3a6'), { topo: false });
}

/** ETE (Newtown Creek): quatro ovos digestores ligados por uma ponte no alto, decantadores redondos e a casa de controle. */
function ete(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, '#a39d92');
  const conc = mat(F.CONCRETO, '#bdb7ac');
  const agua = mat(F.AGUA, '#34565a');
  const aco = mat(F.METAL, COR.aco);
  const vidro = mat(F.CORTINA, '#8d979e', { a: 3.6, v: 1.6, c2: '#4f575c', uso: 3 });
  lote(b, piso);
  const R = Math.min(5.4, b.w / 8.4);
  const H = 22;
  const ovos = [[-R * 1.25, -hd + R + 2.5], [R * 1.25, -hd + R + 2.5], [-R * 1.25, -hd + 3 * R + 5], [R * 1.25, -hd + 3 * R + 5]];
  for (const [x, z] of ovos) ovo(b, x, z, R, H, { costuras: b.ultra });
  // ponte de aço no alto ligando os ovos e a torre de escada no meio
  const zm = (ovos[0][1] + ovos[2][1]) / 2;
  b.caixa(0, 0, zm, 3.2, H + 2.4, 3.2, vidro, { topo: mat(F.LAJE, '#8f8b84'), l1: true });
  b.viga([-R * 1.25, H - 1.2, zm], [R * 1.25, H - 1.2, zm], 2.2, 1.4, mat(F.CORTINA, '#9aa1a6', { a: 2, v: 1.4, c2: '#cfd0cc', uso: 3 }), {});
  b.viga([0, H - 1.2, ovos[0][1]], [0, H - 1.2, ovos[2][1]], 2.2, 1.4, mat(F.CORTINA, '#9aa1a6', { a: 2, v: 1.4, c2: '#cfd0cc', uso: 3 }), {});
  // decantadores redondos na frente: parede baixa, água, coluna central e a ponte que gira
  const rt = Math.min(7.5, b.w / 6.6);
  for (const s of [-1, 1]) {
    const x = s * (rt + 1.2);
    const z = hd - rt - 2.5;
    b.cilindro(x, -ENTERRA, z, rt, ENTERRA + 2.2, conc, { topo: false, l1: true });
    b.torno(x, z, [[rt - 0.25, 1.9], [0, 1.9]], agua, { topo: false, ladosBase: 24 });
    b.cilindro(x, 1.9, z, 0.9, 1.6, conc, {});
    b.viga([x, 3.3, z], [x + Math.cos(0.7 * s) * rt, 3.3, z - Math.sin(0.7 * s) * rt], 1.2, 0.5, aco, {});
  }
  // casa de controle e canos entre os ovos e os tanques
  b.caixa(hw - 6, 0, -hd + 9, 8, 6, 9, mat(F.FITA, '#cbc5b9', { a: 3, v: 1.5, c2: '#5c6267', uso: 3 }), { topo: mat(F.LAJE, '#8f8b84'), l1: true });
  for (const s of [-1, 1]) b.tubo([s * R * 1.25, 1.2, ovos[2][1] + R * 0.7], [s * (rt + 1.2), 1.2, hd - rt * 2 - 2], 0.4, aco, {});
}

// ------------------------------------------------------------------------------------------------ termelétrica

/**
 * Termelétrica (CopenHill): a caixa de alumínio claro com o teto em rampa verde (a pista de esqui, com a mata nas
 * bordas) e o mirante plano no alto; as fachadas de "tijolos" de alumínio empilhados, com as frestas de vidro em
 * degraus e as linhas de sombra de cada fiada; o saguão de vidro na ponta baixa e a chaminé.
 */
function termica(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const piso = mat(F.PISO, '#9f998e');
  const alum = mat(F.METAL, '#b3b6b4');
  const fiada = mat(F.METAL, '#c2c4c1');
  const fresta = mat(F.VIDRO, '#39444b');
  const saguao = mat(F.CORTINA, '#8d979c', { a: 4, v: 2.2, c2: '#c9cbc8', uso: 3, vd: 0.35 });
  const verde = mat(F.VERDE, '#56603f');
  const pista = mat(F.VERDE, '#6d785a');
  const laje = mat(F.LAJE, '#8f8b84');
  lote(b, piso);
  const x0 = -hw + 3;
  const x1 = hw - 3;
  const z0 = -hd + 3;
  const z1 = hd - 8;
  const yF = 12;
  const yB = 48;
  // a rampa desce do mirante (z0 a zk, plano) até a ponta baixa na frente (z1)
  const zk = z0 + 7;
  const yz = (z) => (z <= zk ? yB : yF + ((z1 - z) / (z1 - zk)) * (yB - yF));
  const sai = 0.3;
  // o volume: paredes de alumínio, o teto em duas placas (o mirante e a rampa)
  b.prisma([[x0, z1], [x1, z1], [x1, zk], [x1, z0], [x0, z0], [x0, zk]], 0, yB, alum, { hTopo: [yF, yF, yB, yB, yB, yB], topo: false });
  b.prisma([[x0 - sai, z1 + sai], [x1 + sai, z1 + sai], [x1 + sai, zk], [x1 + sai, z0 - sai], [x0 - sai, z0 - sai], [x0 - sai, zk]], 0, yB, alum, { hTopo: [yF, yF, yB, yB, yB, yB], topo: false, so1: true });
  b.placa([x0, yB, zk], [x1, yB, zk], [x1, yF, z1], [x0, yF, z1], 0, verde, { l1: true });
  b.plano(x0, z0, x1, zk, yB, laje, { l1: true });
  // a pista: faixa mais clara descendo a rampa, e a trilha de subida em zigue-zague na borda
  b.placa([-5, yB + 0.08, zk + 1.5], [5, yB + 0.08, zk + 1.5], [7, yF + 0.08, z1 - 0.6], [-7, yF + 0.08, z1 - 0.6], 0, pista, {});
  const tx = x0 + 5;
  const passos = 6;
  for (let k = 0; k < passos; k++) {
    const za = z1 - 1 - ((z1 - zk - 2) * k) / passos;
    const zb = z1 - 1 - ((z1 - zk - 2) * (k + 1)) / passos;
    const xa = k % 2 ? tx + 6 : tx;
    const xb = k % 2 ? tx : tx + 6;
    b.placa([xa - 0.8, yz(za) + 0.1, za], [xa + 0.8, yz(za) + 0.1, za], [xb + 0.8, yz(zb) + 0.1, zb], [xb - 0.8, yz(zb) + 0.1, zb], 0, mat(F.PISO, '#a49e92'), {});
  }
  // a mata das bordas da rampa (plantada pela vegetação) e as moitas do mirante
  for (let k = 0; k < 7; k++) {
    const z = zk + 3 + ((z1 - zk - 6) * k) / 6;
    for (const x of [x1 - 3.2 - b.entre(200 + k, 0, 2.5), x0 + 12 + b.entre(210 + k, 0, 2)]) {
      b.arvore(x, yz(z) + 0.1, z, { alt: b.entre(220 + k, 3, 5.5), raio: 1.6, especie: k % 3 ? 'mata3' : 'moita' });
    }
  }
  // o mirante: guarda-corpo de vidro e o bar
  guarda(b, x0 + 0.4, zk - 0.3, x0 + 0.4, z0 + 0.4, yB, mat(F.VIDRO, '#56646d'));
  guarda(b, x1 - 0.4, z0 + 0.4, x1 - 0.4, zk - 0.3, yB, mat(F.VIDRO, '#56646d'));
  b.caixa(x0 + 8, yB, z0 + 3.4, 10, 3.2, 5, mat(F.CORTINA, '#8d979c', { a: 3.2, v: 1.6, c2: '#c9cbc8', uso: 1 }), { topo: laje, l1: true });
  // os tijolos de alumínio: em cada fiada de 2,4 m a linha de sombra (o tijolo que avança) e as frestas de vidro em
  // degraus, desencontradas de uma fiada para a outra; nas laterais as fiadas acabam na rampa
  const passoF = 2.4;
  const nF = Math.floor((yB - 3) / passoF);
  const ladoF = (xa, za, xb, zb, k, y, topoDe) => {
    // uma fiada na parede de (xa, za) a (xb, zb) (normal para fora à direita), até onde o teto deixa
    const L = Math.hypot(xb - xa, zb - za);
    const ux = (xb - xa) / L;
    const uz = (zb - za) / L;
    const nx = uz;
    const nz = -ux;
    let fim = L;
    while (fim > 0 && topoDe(xa + ux * fim, za + uz * fim) < y + 1.6) fim -= 1.1;
    if (fim < 3) return;
    // a sombra da fiada: o tijolo de 1,2 m que avança 0,3 m
    const cx = xa + ux * (fim / 2) + nx * (sai / 2);
    const cz = za + uz * (fim / 2) + nz * (sai / 2);
    const giro = Math.atan2(-uz, ux);
    b.caixa(cx, y, cz, fim, 1.2, sai, fiada, { giro, sem: 8, topo: fiada });
    // as frestas: 3,3 m de vidro a cada 6,6 m, a fiada seguinte desencontrada
    const des = (k % 2) * 3.3 + b.entre(300 + k, 0, 1.2);
    for (let t = des + 0.6; t + 3.3 < fim - 0.4; t += 6.6) {
      if (b.r(400 + k * 31 + Math.round(t)) < 0.18) continue;
      const pa = [xa + ux * t + nx * 0.03, za + uz * t + nz * 0.03];
      const pb = [xa + ux * (t + 3.3) + nx * 0.03, za + uz * (t + 3.3) + nz * 0.03];
      b.parede(pa[0], pa[1], pb[0], pb[1], y + 1.25, y + 2.3, fresta, {});
    }
  };
  for (let k = 0; k < nF; k++) {
    const y = 1.6 + k * passoF;
    // lado +x (de z1 para z0), lado -x (de z0 para z1), fundo (de x1 para x0) e frente (de x0 para x1, acima do saguão)
    ladoF(x1, z1, x1, z0, k, y, (x, z) => yz(z));
    ladoF(x0, z0, x0, z1, k, y, (x, z) => yz(z));
    ladoF(x1, z0, x0, z0, k, y, () => yB);
    if (y > 5.5) ladoF(x0, z1, x1, z1, k, y, () => yF);
  }
  // o saguão de vidro na ponta baixa, com a marquise
  b.parede(x0 + 4, z1 + 0.05, x1 - 4, z1 + 0.05, 0, 5, saguao, { l1: true });
  b.laje(0, 5.6, z1 + 2.5, x1 - x0 - 6, 5, 0.35, mat(F.CONCRETO, '#b6b0a6'), { l1: true });
  // a chaminé sai do alto, atrás do mirante, com o anel do topo
  const cx = x1 - 6;
  const cz = z0 + 4;
  b.cilindro(cx, yB - 1, cz, 2.4, 70 - yB + 1, mat(F.CONCRETO, '#a8a39a'), { topo: laje, l1: true });
  b.torno(cx, cz, [[2.55, 66.5], [2.55, 68.5]], alum, { topo: false });
  b.caixa(hw - 3, 0.05, hd - 1.2, 4, 1.2, 0.3, mat(F.LETREIRO, '#3d5c48'), { topo: alum });
}

// ------------------------------------------------------------------------------------------------ parque

/** Parque (marquise do Ibirapuera): a laje sinuosa em pilares finos, o lago, o gramado, os caminhos e as árvores. */
function parque(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const grama = mat(F.VERDE, COR.grama);
  const caminho = mat(F.PISO, '#b9b2a5');
  const branco = mat(F.CONCRETO, '#d7d3ca');
  const agua = mat(F.AGUA, '#2f585c');
  lote(b, grama);
  // lago livre no fundo à esquerda
  const nl = b.lod ? 8 : b.ultra ? 28 : 16;
  const lago = [];
  for (let i = 0; i < nl; i++) {
    const a = (i / nl) * TAU;
    const r = 1 + 0.18 * Math.sin(3 * a + 0.6) + 0.1 * Math.cos(5 * a);
    lago.push([-hw * 0.42 + Math.cos(a) * hw * 0.38 * r, -hd * 0.45 - Math.sin(a) * hd * 0.26 * r]);
  }
  b.piso(lago, 0.09, agua, { l1: true });
  // caminhos
  const n = b.lod ? 3 : 10;
  b.faixa(curva([[-hw + 1, hd - 4], [-hw * 0.2, hd * 0.35], [hw * 0.35, hd * 0.05], [hw - 1, -hd * 0.3]], n), 0.08, 1.4, caminho, { escalaUV: 1 });
  b.faixa(curva([[hw * 0.1, hd - 1], [hw * 0.15, hd * 0.2], [hw * 0.05, -hd * 0.2], [hw * 0.3, -hd + 1]], n), 0.08, 1.2, caminho, {});
  // a marquise: linha livre, largura que varia, colunas alternadas
  const ctrl = [[-hw + 6, hd - 7], [-hw * 0.3, hd * 0.42], [hw * 0.1, hd * 0.05], [hw * 0.5, hd * 0.25], [hw - 6, -hd * 0.15], [hw * 0.55, -hd + 6]];
  const linha = curva(ctrl, b.lod ? 2 : b.ultra ? 9 : 5);
  const ml = linha.map((_, i) => 3.2 + 1.6 * Math.sin(i * 0.9));
  b.faixa(linha, 4.4, ml.map((m) => [m, m]), branco, { esp: 0.35, l1: true });
  if (b.lod === 0) {
    for (let i = 1; i < linha.length - 1; i += 2) {
      const [x, z] = linha[i];
      b.cilindro(x, -0.5, z, 0.22, 4.6, branco, { topo: false, lados: b.ultra ? 8 : 4 });
    }
  }
  // árvores: grupos grandes nas bordas
  const arv = [[-hw + 4, -hd + 4], [-hw + 9, -hd + 3.5], [hw - 5, hd - 5], [hw - 11, hd - 4], [hw - 4, -hd + 5], [-hw + 4, 2], [-hw + 4, 9], [hw - 4, 4],
    [hw * 0.2, -hd + 4], [-hw * 0.05, -hd + 5], [hw - 14, -hd + 4], [-4, hd - 4]];
  arv.forEach(([x, z], k) => {
    const R = b.entre(90 + k, 3, 4.6);
    const cx = Math.max(-hw + R + 0.3, Math.min(hw - R - 0.3, x));
    const cz = Math.max(-hd + R + 0.3, Math.min(hd - R - 0.3, z));
    b.arvore(cx, 0.05, cz, { alt: b.entre(80 + k, 9, 14), raio: R, especie: k % 4 === 0 ? 'mata3' : 'mata2' });
  });
}

// ------------------------------------------------------------------------------------------------ hospital

/**
 * Hospital (Rede Sarah com o sanduíche do Kampung Admiralty): o pódio de atendimento com sheds curvos em volta de um
 * jardim, o teto-parque com árvores e a lâmina de internação em cima, com varandas e o heliponto.
 */
function hospital(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const grama = mat(F.VERDE, COR.grama);
  const piso = mat(F.PISO, '#b0aa9f');
  const branco = mat(F.CONCRETO, COR.brancoSarah);
  const laje = mat(F.LAJE, '#9a958c');
  const internacao = mat(F.VARANDA, '#d9d6cd', { a: 3.6, v: 3.4, c2: '#6f7a80', uso: 0, dg: 0.2 });
  const empena = mat(F.BRISE_V, '#d6d3ca', { a: 3.6, v: 1.2, c2: '#5f676c', uso: 0 });
  lote(b, grama);
  b.plano(-hw + 0.3, hd - 9, hw - 0.3, hd - 0.3, 0.08, piso, {});
  const x0 = -hw + 3;
  const x1 = hw - 3;
  const z0 = -hd + 3;
  const z1 = hd - 11;
  // pódio de dois andares (9 m) com sheds; a ala do fundo leva a lâmina
  alasSarah(b, x0, x1, z0, z1, z0 + 16, z1 - 14, x0 + 16, x1 - 16, 9, { hShed: 2.6, terraco: [1] });
  // jardim no meio
  const jx = 0;
  const jz = (z0 + 16 + z1 - 14) / 2;
  b.plano(jx - 7, jz - 4, jx + 7, jz + 2, 0.1, mat(F.AGUA, '#2a5a5e'), {});
  for (let k = 0; k < 3; k++) b.arvore(jx - 9 + k * 9, 0.05, jz + 5 - (k % 2) * 9, { alt: b.entre(100 + k, 7, 9), raio: 2.8, especie: 'oiti' });
  // lâmina de internação (8 andares) sobre a ala do fundo, com o teto-parque na frente dela
  const lz = z0 + 6.5;
  const yb = 9 + 0.6;
  const nA = 8;
  const pe = 3.6;
  b.caixa(0, yb, lz, x1 - x0 - 8, nA * pe, 12, internacao, { faces: { px: empena, nx: empena, nz: empena }, topo: laje, vBase: yb, l1: true });
  const yt = yb + nA * pe;
  b.caixa(-8, yt, lz, 6, 3.4, 6, branco, { topo: laje, l1: true });
  // heliponto: disco sobre pilaretes, com o aro
  b.cilindro(8, yt + 1.4, lz, 7, 0.4, mat(F.CONCRETO, '#5d5f60'), { topo: mat(F.LETREIRO, '#4a4c4d'), l1: true, lados: b.lod ? 8 : 20 });
  if (b.lod === 0) for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) b.caixa(8 + dx, yt, lz + dz, 0.5, 1.4, 0.5, branco, { topo: false });
  // teto-parque: árvores e canteiros sobre o pódio, na frente da lâmina
  for (let k = 0; k < 5; k++) b.arvore(x0 + 6 + k * ((x1 - x0 - 12) / 4), 9.05, z0 + 14.2, { alt: 4.2, raio: 1.5, especie: 'mata3' });
  guarda(b, x0 + 0.3, z0 + 16 - 0.2, x1 - 0.3, z0 + 16 - 0.2, 9.05, mat(F.VIDRO, '#56646d'));
  // acesso: marquise curva
  const n = b.lod ? 3 : 12;
  const linha = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    linha.push([-hw + 8 + t * (b.w - 16), hd - 6.5 + 2 * Math.sin(t * Math.PI)]);
  }
  b.faixa(linha, 4.2, 2.6, branco, { esp: 0.3, l1: true });
  if (b.lod === 0) for (let i = 1; i < n; i += 2) b.tubo([linha[i][0], 0.05, linha[i][1]], [linha[i][0], 3.9, linha[i][1]], 0.15, branco, { lados: 6 });
}

// ------------------------------------------------------------------------------------------------ parque da orla

/**
 * Parque da orla (Aterro do Flamengo): o calçadão de pedra portuguesa com o desenho de Burle Marx, os gramados em
 * ilhas, os renques de palmeiras imperiais, os postes altos de luz e um pavilhão baixo.
 */
function parqueG(b) {
  const hw = b.w / 2;
  const hd = b.d / 2;
  const grama = mat(F.VERDE, COR.grama);
  const ilha = mat(F.VERDE, COR.gramaEscura);
  const clara = mat(F.PISO, COR.pedraClara);
  const escura = mat(F.PISO, COR.basalto);
  const caminho = mat(F.PISO, '#bdb6a8');
  lote(b, grama);
  // calçadão na frente com as faixas abstratas de basalto
  b.plano(-hw + 0.3, hd - 9, hw - 0.3, hd - 0.3, 0.07, clara, { escalaUV: 10, l1: true });
  const passos = b.ultra ? 48 : 24;
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= passos; i++) {
      const x = -hw + 0.6 + ((b.w - 1.2) * i) / passos;
      pts.push([x, hd - 2.2 - k * 2.4 + 0.9 * Math.sign(Math.sin((TAU * x) / 9 + k)) * Math.min(1, Math.abs(Math.sin((TAU * x) / 9 + k)) * 3)]);
    }
    b.faixa(pts, 0.08, 0.45, escura, { escalaUV: 10 });
  }
  // ilhas de gramado com as bordas curvas e um caminho sinuoso entre elas
  const n = b.lod ? 6 : b.ultra ? 18 : 12;
  for (const [cx, cz, rx, rz] of [[-hw * 0.5, -hd * 0.25, hw * 0.34, hd * 0.42], [hw * 0.42, -hd * 0.3, hw * 0.4, hd * 0.36]]) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = 1 + 0.12 * Math.sin(2 * a + cx);
      pts.push([cx + Math.cos(a) * rx * r, cz - Math.sin(a) * rz * r]);
    }
    b.prisma(pts, 0.05, 0.35, ilha, { topo: ilha });
  }
  b.faixa(curva([[-hw + 2, hd - 10], [-hw * 0.1, -hd * 0.05], [hw * 0.05, -hd * 0.55], [hw * 0.35, -hd + 3]], b.lod ? 3 : 10), 0.08, 1.5, caminho, {});
  // palmeiras imperiais em renque ao longo do calçadão e um bosque
  const np = 9;
  for (let i = 0; i < np; i++) b.palmeira(-hw + 5 + ((b.w - 10) * i) / (np - 1), 0.05, hd - 10.5, { alt: b.entre(110 + i, 16, 19), larg: 7 });
  for (let k = 0; k < 6; k++) b.arvore(-hw * 0.5 + b.entre(120 + k, -8, 8), 0.4, -hd * 0.25 + b.entre(130 + k, -6, 6), { alt: b.entre(140 + k, 8, 11), raio: 3, especie: k % 2 ? 'embauba' : 'mata2' });
  // postes altos de luz (os do Aterro), com o anel de refletores
  for (const x of [-hw * 0.62, 0, hw * 0.62]) {
    b.tubo([x, -0.5, hd - 6], [x, 30, hd - 6], 0.45, mat(F.CONCRETO, '#c8c3b9'), { lados: 4, l1: true });
    b.torno(x, hd - 6, [[0.5, 29], [1.6, 29.6], [1.6, 30.3], [0, 30.5]], mat(F.METAL, '#5c6266'), { l1: true });
  }
  // pavilhão baixo de laje fina
  b.laje(hw * 0.55, 3.4, hd * 0.18, 14, 8, 0.3, mat(F.CONCRETO, '#d3cec4'), {});
  b.caixa(hw * 0.55, 0.05, hd * 0.18, 8, 3.1, 4.5, mat(F.CORTINA, '#9aa3a8', { a: 3.1, v: 1.5, c2: '#d0cec8', uso: 1 }), { topo: false });
}

/** Geradores dos serviços (o id é o de data/servicos.js). */
export const MODELOS_SERVICOS = Object.freeze({
  captacao, poco, solar, praca, clinica, escolaF, delegacia, bombeiros, ete, termica, escolaM, parque, hospital, parqueG,
});
