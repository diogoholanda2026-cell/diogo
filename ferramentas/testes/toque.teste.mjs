// Testes da TOQ1 (D99): o toque no Poco X7. Sem navegador: a entrada, a câmera e o raio de verdade, com um canvas falso e
// um relógio simulado em que os quadros são lentos (120 ms, 8 qps) e os eventos chegam juntos, como no celular.
//   - um raio por quadro (não por evento), sem salto e com o teto de deslocamento do quadro (inclusive num penhasco);
//   - a soltura medida no tempo do hardware (os coalescidos), com teto, parada limpa e inércia desligável;
//   - os limiares da pinça e do giro contra o tremor de dois dedos, medidos num modelo de dedo com semente fixa;
//   - a sensibilidade (Configurações), o dedo fantasma, o gesto do sistema embaixo e o registro ?toque=1;
//   - a câmera: inércia exata (o mesmo caminho em quadros de 16 e de 250 ms), teto e parada na borda;
//   - a resolução em movimento e a dinâmica que enxerga quadros lentos (antes ignorava os de mais de 250 ms).
// Roda sozinho: node --test ferramentas/testes/toque.teste.mjs (o simular --testes descobre)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { criarEntrada } from '../../fonte/render/camera/entrada.js';
import { criarCamera, DESLIZE, AMORTECE } from '../../fonte/render/camera/camera.js';
import { raioDoContexto, projetarNaTela } from '../../fonte/render/camera/raio.js';
import {
  GESTOS, SOLTURA, Rastro, limiarPinca, limiarGiro, ehPinca, ehGiro, pontoDaPinca, pontoDoGiro, opcoesDoToque, limitarVetor, tetoDoQuadro, aplicarTeto, metrosPorPxEm, TOQUE_PADRAO,
} from '../../fonte/render/camera/gesto.js';
import { criarLogToque } from '../../fonte/render/camera/toque-log.js';
import { Resolucao, MOVIMENTO } from '../../fonte/render/motor/resolucao.js';
import { PERFIS, degrausDoPerfil } from '../../fonte/render/motor/perfis.js';
import { terrenoPlano } from '../../fonte/sim/substitutos.js';

const W = 986;
const H = 443;
const CAM0 = Object.freeze({ x: 0, z: 0, dist: 1500, guinada: 0, inclinacao: 45 });

// ------------------------------------------------------------------------------------------------ montagem

function montar({ T = terrenoPlano(), cam0 = CAM0, prefs = {}, L = W, A = H } = {}) {
  const ouvintes = new Map();
  const canvas = {
    clientWidth: L,
    clientHeight: A,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: L, height: A }),
    setPointerCapture() {},
    addEventListener: (t, fn) => ouvintes.set(t, fn),
    removeEventListener: (t) => ouvintes.delete(t),
  };
  const camera3 = new THREE.PerspectiveCamera(40, L / A, 1, 20000);
  const ctx = { canvas, tela: { w: L, h: A }, camera: camera3, sim: { espelho: { terreno: T, mapa: { tam: 8192 } } }, semClip: false, pr: 1 };
  const cam = criarCamera(ctx, cam0);
  cam.atualizar(0);
  const cont = { raios: 0 };
  ctx.raio = (x, y) => {
    cont.raios++;
    return raioDoContexto(ctx, x, y);
  };
  const E = criarEntrada(ctx, cam);
  E.opcoes(opcoesDoToque(prefs));
  const ev = (tipo, id, x, y, t, extra = {}) =>
    ouvintes.get(tipo)?.({ type: tipo, pointerId: id, clientX: x, clientY: y, timeStamp: t, pointerType: 'touch', button: 0, isPrimary: id === 1, preventDefault() {}, ...extra });
  // o que o jogo faz em cada quadro: a câmera (fazerQuadro) e depois os domínios, a entrada entre eles
  const quadro = (t) => {
    cam.atualizar(t);
    E.quadro(t);
  };
  const proj = (p) => projetarNaTela(camera3, L, A, p);
  return { ctx, cam, E, ev, quadro, proj, cont, camera3, ouvintes };
}

/**
 * Um gesto de um dedo no relógio simulado: o hardware amostra o dedo a hz; os quadros chegam em tFrames; as amostras que
 * se acumularam entre dois quadros chegam juntas (um pointermove com os coalescidos, ou, sem coalescer, um por amostra);
 * a soltura chega no primeiro quadro depois dela. Depois da soltura, roda quadros até a vista parar (ou 5 s).
 * @returns {{ quadros: object[], ref: number[], solta: object }}
 */
function gestoUmDedo(M, { de, para, dur, hz = 120, dtQuadro = 120, coalescer = true, parar = 0, t0 = 1000 }) {
  const { ev, quadro, proj } = M;
  const f = (s) => {
    const k = Math.min(1, s / dur);
    return [de[0] + (para[0] - de[0]) * k, de[1] + (para[1] - de[1]) * k];
  };
  const amostras = [];
  for (let s = 0; s <= dur; s += 1000 / hz) amostras.push({ t: t0 + s, x: f(s)[0], y: f(s)[1] });
  const tSolta = t0 + dur + parar;
  const ref = M.ctx.raio(de[0], de[1]);
  ev('pointerdown', 1, de[0], de[1], t0);
  let i = 1;
  let solta = false;
  const quadros = [];
  let ant = null;
  let dedoAnt = de;
  let pos = f(0);
  const passo = (T) => {
    const novas = [];
    while (i < amostras.length && amostras[i].t <= T) novas.push(amostras[i++]);
    if (novas.length) {
      const u = novas[novas.length - 1];
      pos = [u.x, u.y];
      if (coalescer) ev('pointermove', 1, u.x, u.y, u.t, { getCoalescedEvents: () => novas.map((n) => ({ clientX: n.x, clientY: n.y, timeStamp: n.t })) });
      else for (const n of novas) ev('pointermove', 1, n.x, n.y, n.t);
    }
    if (!solta && tSolta <= T && i >= amostras.length) {
      solta = true;
      ev('pointerup', 1, pos[0], pos[1], tSolta);
    }
    const r0 = M.cont.raios;
    quadro(T);
    const p = proj(ref);
    const shift = ant ? Math.hypot(p.x - ant.x, p.y - ant.y) : 0;
    const dedo = Math.hypot(pos[0] - dedoAnt[0], pos[1] - dedoAnt[1]);
    quadros.push({ t: T, shift, dedo, raios: M.cont.raios - r0, solta, px: p.x, py: p.y, gesto: M.E.gesto, movendo: M.cam.movendo, pos: [...pos] });
    ant = p;
    dedoAnt = pos;
  };
  let T = t0;
  while (!solta || i < amostras.length) {
    T += dtQuadro;
    passo(T);
    if (T > t0 + dur + parar + 20000) break;
  }
  const tFim = T + 5000;
  while (M.cam.movendo && T < tFim) {
    T += dtQuadro;
    passo(T);
  }
  return { quadros, ref, solta: { vel: M.cam.velocidade } };
}

const somaDeslize = (q) => q.filter((f) => f.solta && f.gesto === null).reduce((a, f) => a + f.shift, 0);

// ------------------------------------------------------------------------------------------------ arrasto

test('arrasto: com quadros de 120 ms (8 qps) o ponto preso segue o dedo sem pular e com um raio por quadro', () => {
  const M = montar();
  const g = gestoUmDedo(M, { de: [700, 330], para: [400, 290], dur: 1200, hz: 120, dtQuadro: 120, parar: 160 });
  const arr = g.quadros.filter((f) => f.gesto === 'arrastar');
  assert.ok(arr.length >= 8, `quadros de arrasto ${arr.length}`);
  for (const f of arr) {
    assert.ok(f.raios <= 1, `um raio por quadro, não um por evento: ${f.raios}`);
    assert.ok(f.shift <= SOLTURA.tetoQuadro * (f.dedo + SOLTURA.folgaQuadroPx) + 1, `salto ${f.shift.toFixed(1)} px com o dedo andando ${f.dedo.toFixed(1)}`);
  }
  // o ponto do chão que estava sob o dedo continua sob ele (a meio quadro de distância do dedo, no máximo uns 4 px)
  const ult = arr.at(-1);
  assert.ok(Math.hypot(ult.px - ult.pos[0], ult.py - ult.pos[1]) < 4, `o chão escorregou: (${ult.px.toFixed(1)}, ${ult.py.toFixed(1)}) contra o dedo (${ult.pos})`);
  assert.ok(g.quadros.filter((f) => f.solta && f.gesto === null).every((f) => f.raios === 0), 'depois de soltar o deslize não lança raio');
});

test('arrasto: dez eventos entre dois quadros custam um raio (os eventos só guardam o dedo)', () => {
  const M = montar();
  M.ev('pointerdown', 1, 500, 300, 1000);
  M.ev('pointermove', 1, 520, 300, 1016); // passou de 10 px: o árbitro decide e prende a âncora (um raio)
  const r0 = M.cont.raios;
  for (let k = 1; k <= 10; k++) M.ev('pointermove', 1, 520 + 6 * k, 300 + k, 1016 + 4 * k);
  assert.equal(M.cont.raios, r0, 'nenhum raio dentro dos eventos');
  M.quadro(1100);
  assert.equal(M.cont.raios - r0, 1, 'um raio no quadro');
  const antes = M.cam.estado().x;
  M.quadro(1116);
  assert.equal(M.cam.estado().x, antes, 'sem evento novo o quadro não anda a câmera');
});

test('arrasto: num penhasco (o chão salta 120 m) o quadro anda no máximo o teto e a vista converge sem pulo', () => {
  const T = terrenoPlano();
  for (let j = 0; j < T.n; j++) for (let i = 0; i < T.n; i++) if (T.origem[0] + i * T.passo > 150) T.altura[j * T.n + i] = 140;
  const M = montar({ T, cam0: { x: -150, z: 0, dist: 900, guinada: 0, inclinacao: 30 } });
  M.ev('pointerdown', 1, 480, 260, 1000);
  M.ev('pointermove', 1, 495, 260, 1020);
  M.quadro(1040);
  let maior = 0;
  let max = 0;
  for (let k = 0; k < 6; k++) {
    // o dedo anda só 6 px por quadro, mas o raio dele passa a acertar o alto do penhasco
    M.ev('pointermove', 1, 495 + 6 * (k + 1), 260, 1060 + 40 * k);
    const a = M.cam.estado();
    M.quadro(1080 + 40 * k);
    const b = M.cam.estado();
    const passo = Math.hypot(b.x - a.x, b.z - a.z);
    const mpp = (2 * 900 * Math.tan(20 * (Math.PI / 180))) / H / Math.sin(30 * (Math.PI / 180)); // o px no chão, com folga
    maior = Math.max(maior, passo);
    max = Math.max(max, SOLTURA.tetoQuadro * (6 + SOLTURA.folgaQuadroPx) * mpp * 2.5);
  }
  assert.ok(maior <= max, `o quadro andou ${maior.toFixed(0)} m, teto ${max.toFixed(0)} m`);
  // o dedo para: a correção que sobrou (o teto a segurou) é aplicada em poucos quadros e a vista assenta
  let pos0 = M.cam.estado();
  let parou = -1;
  for (let k = 0; k < 40; k++) {
    M.ev('pointermove', 1, 531, 260, 1400 + 40 * k); // o mesmo ponto: o quadro ainda aplica o que falta
    M.quadro(1420 + 40 * k);
    const p = M.cam.estado();
    if (Math.hypot(p.x - pos0.x, p.z - pos0.z) < 0.05 && parou < 0) parou = k;
    pos0 = p;
  }
  assert.ok(parou >= 0 && parou < 40, `a vista não assentou: ${parou}`);
});

test('arrasto: a sensibilidade escala o que o mundo anda por px do dedo (0,5 anda a metade, 1,5 uma vez e meia)', () => {
  const anda = (sens) => {
    const M = montar({ prefs: { toqueArrasto: sens } });
    const g = gestoUmDedo(M, { de: [500, 300], para: [700, 300], dur: 400, hz: 120, dtQuadro: 17, parar: 200 });
    assert.ok(g.quadros.some((f) => f.gesto === 'arrastar'));
    return Math.abs(M.cam.estado().x);
  };
  const base = anda(1);
  assert.ok(base > 100, `base ${base}`);
  assert.ok(Math.abs(anda(0.5) / base - 0.5) < 0.12, `0,5: ${anda(0.5) / base}`);
  assert.ok(Math.abs(anda(1.5) / base - 1.5) < 0.2, `1,5: ${anda(1.5) / base}`);
  assert.equal(opcoesDoToque({ toqueArrasto: 99 }).sensArrasto, 2, 'a sensibilidade tem teto');
  assert.equal(opcoesDoToque({ toqueGiro: 'x' }).sensGiro, 1, 'valor torto vale o padrão');
  assert.deepEqual(opcoesDoToque({}), { sensArrasto: 1, sensPinca: 1, sensGiro: 1, inercia: true });
  assert.equal(TOQUE_PADRAO.inercia, true);
});

// ------------------------------------------------------------------------------------------------ soltura

test('soltura: a velocidade vem dos eventos coalescidos (tempo do hardware): quadros de 120 ms ainda deslizam', () => {
  // o dedo anda 1500 px/s; o Chrome entrega um pointermove por quadro de 120 ms com os coalescidos dentro
  const M = montar();
  const g = gestoUmDedo(M, { de: [800, 300], para: [350, 290], dur: 300, hz: 120, dtQuadro: 120, parar: 0 });
  const desliza = somaDeslize(g.quadros);
  // o ponto sob o dedo desliza uns v x tau (1500 x 0,25 = 375 px, na escala do chão sob o dedo)
  assert.ok(desliza > 200 && desliza < 700, `deslizou ${desliza.toFixed(0)} px`);
  // o primeiro quadro depois da soltura não "voa": anda o que o dedo andava em um quadro de 120 ms (uns 180 px), não mais
  const primeiro = g.quadros.find((f) => f.solta && f.gesto === null);
  assert.ok(primeiro.shift < 1500 * 0.12 * 1.35 + 20, `primeiro quadro livre: ${primeiro.shift.toFixed(0)} px`);
  assert.ok(!M.cam.movendo, 'e a vista parou sozinha');
});

test('soltura: o arremesso tem teto (3000 px/s no dedo, 2200 px/s no centro) e o deslize termina limpo', () => {
  const M = montar();
  // 12000 px/s no dedo (um arremesso de mentira): o teto do dedo e o da câmera seguram
  const g = gestoUmDedo(M, { de: [900, 300], para: [100, 300], dur: 66, hz: 240, dtQuadro: 17 });
  const desliza = somaDeslize(g.quadros);
  assert.ok(desliza < SOLTURA.maxPxS * AMORTECE.pan * 1.45, `deslizou ${desliza.toFixed(0)} px`);
  const vmax = DESLIZE.velMaxPx * M.cam.metrosPorPx();
  assert.ok(Math.hypot(M.cam.velocidade.vx, M.cam.velocidade.vz) <= vmax + 1e-6);
  assert.ok(g.quadros.length < 400 && !M.cam.movendo, 'para sozinha (parada limpa)');
  assert.deepEqual(M.cam.velocidade, { vx: 0, vz: 0, vg: 0, vi: 0 });
});

test('soltura: o dedo parado antes de soltar não desliza; arrasto lento (abaixo de 60 px/s) também não', () => {
  const M = montar();
  const g = gestoUmDedo(M, { de: [700, 300], para: [500, 300], dur: 600, hz: 120, dtQuadro: 17, parar: 220 });
  assert.equal(somaDeslize(g.quadros), 0, 'parou 220 ms antes de soltar');
  const L = montar();
  const lento = gestoUmDedo(L, { de: [700, 300], para: [680, 300], dur: 1000, hz: 120, dtQuadro: 17 });
  assert.equal(somaDeslize(lento.quadros) < 6, true, '20 px em 1 s (20 px/s) não vira deslize');
});

test('soltura: com a inércia desligada (Configurações) a vista fica onde o dedo soltou', () => {
  const M = montar({ prefs: { toqueInercia: false } });
  const g = gestoUmDedo(M, { de: [800, 300], para: [350, 300], dur: 300, hz: 120, dtQuadro: 17 });
  const solto = g.quadros.filter((f) => f.solta && f.gesto === null);
  // o único movimento depois da soltura é o último pedaço do que o dedo andou (a vista chega onde o dedo soltou)
  assert.ok(somaDeslize(g.quadros) <= 1500 * 0.017 * 1.3 + 2, `${somaDeslize(g.quadros)}`);
  assert.ok(solto.slice(1).every((f) => f.shift === 0 && !f.movendo), 'e para: nada de deslize');
  assert.equal(M.cam.movendo, false);
  assert.deepEqual(M.cam.velocidade, { vx: 0, vz: 0, vg: 0, vi: 0 });
});

test('soltura: velocidade por mínimos quadrados (o Rastro) com tremor, quadro lento e dedo parado', () => {
  const r = new Rastro();
  for (let k = 0; k <= 12; k++) r.push(1000 + k * 8.3, 100 + 12.5 * k * 8.3 * 0.1 + (k % 2 ? 0.8 : -0.8), 200);
  const v = r.velocidade(1000 + 12 * 8.3 + 5);
  assert.ok(Math.abs(v.vx - 1250) < 90, `vx ${v.vx}`);
  assert.ok(Math.abs(v.vy) < 40, `vy ${v.vy}`);
  assert.deepEqual(r.velocidade(1000 + 12 * 8.3 + 200), { vx: 0, vy: 0 }, 'parado 200 ms antes de soltar');
  // um quadro lento: as duas últimas amostras a 120 ms uma da outra (sem coalescidos): usa as duas
  const l = new Rastro();
  l.push(1000, 100, 100);
  l.push(1070, 190, 100);
  const vl = l.velocidade(1075);
  assert.ok(Math.abs(vl.vx - 1286) < 10, `quadro lento ${vl.vx}`);
  // colados no mesmo instante: troca a amostra; para trás: ignora; sem 12 ms de movimento: null
  const c = new Rastro();
  c.push(1000, 0, 0);
  c.push(1000, 5, 0);
  c.push(999, 50, 0);
  assert.equal(c.a.length, 1);
  c.push(1004, 9, 0);
  assert.equal(c.velocidade(1006), null, 'amostras coladas: sem medida');
  assert.equal(new Rastro().velocidade(0), null);
  const [x, y] = limitarVetor(6000, 8000, 3000);
  assert.ok(Math.abs(Math.hypot(x, y) - 3000) < 1e-9 && Math.abs(x / y - 0.75) < 1e-9, 'teto na direção');
  assert.deepEqual(limitarVetor(10, 20, 3000), [10, 20]);
});

// ------------------------------------------------------------------------------------------------ limiares

/** Gerador de números com semente (mulberry32): o modelo de dedo é o mesmo em toda rodada. */
function semente(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dois dedos que andam juntos (um arrasto de dois dedos) com tremor de 1,5 px e um dedo andando de 0 a 20% menos que o
 * outro: o vão e o ângulo mudam sem que a mão queira pinçar nem girar. Devolve, para a regra de antes (12 px, 6 graus) e
 * para a de agora (limiar do vão e domínio sobre o que o meio andou), se algum quadro do gesto teria virado pinça ou giro.
 */
function doisDedosQueAndam(rnd) {
  const d0 = 140 + rnd() * 260; // o vão: de 140 a 400 px
  const alvo = 150 + rnd() * 250; // o arrasto: de 150 a 400 px
  const lag = rnd() * 0.2;
  const ang0 = rnd() * Math.PI; // o eixo dos dedos e a direção do arrasto: quaisquer
  const dir = rnd() * 2 * Math.PI;
  const r = { antesPinca: false, antesGiro: false, pinca: false, giro: false };
  for (let k = 1; k <= 20; k++) {
    const s = (k / 20) * alvo;
    const a = [-(d0 / 2) * Math.cos(ang0) + s * Math.cos(dir) + (rnd() - 0.5) * 3, -(d0 / 2) * Math.sin(ang0) + s * Math.sin(dir) + (rnd() - 0.5) * 3];
    const b = [(d0 / 2) * Math.cos(ang0) + s * (1 - lag) * Math.cos(dir) + (rnd() - 0.5) * 3, (d0 / 2) * Math.sin(ang0) + s * (1 - lag) * Math.sin(dir) + (rnd() - 0.5) * 3];
    const dVao = Math.hypot(b[0] - a[0], b[1] - a[1]) - d0;
    let da = Math.atan2(b[1] - a[1], b[0] - a[0]) - ang0;
    da = (Math.atan2(Math.sin(da), Math.cos(da)) / Math.PI) * 180;
    const viaja = Math.hypot((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); // o meio dos dedos começou na origem
    if (Math.abs(dVao) > 12) r.antesPinca = true;
    if (Math.abs(da) > 6) r.antesGiro = true;
    if (ehPinca(dVao, d0, viaja)) r.pinca = true;
    if (ehGiro(da, d0, viaja)) r.giro = true;
  }
  return r;
}

test('limiares: dois dedos que andam juntos não viram pinça nem giro (a regra de antes, 12 px e 6 graus, virava)', () => {
  const rnd = semente(20261006);
  const c = { antesPinca: 0, antesGiro: 0, pinca: 0, giro: 0 };
  const N = 600;
  for (let k = 0; k < N; k++) {
    const r = doisDedosQueAndam(rnd);
    for (const q of Object.keys(c)) if (r[q]) c[q]++;
  }
  const f = (n) => (n / N) * 100;
  assert.ok(f(c.antesPinca) > 30 && f(c.antesGiro) > 10, `antes: pinça ${f(c.antesPinca).toFixed(1)}%, giro ${f(c.antesGiro).toFixed(1)}%`);
  assert.ok(f(c.pinca) < 3, `pinça sem querer ${f(c.pinca).toFixed(1)}% (antes ${f(c.antesPinca).toFixed(1)}%)`);
  assert.ok(f(c.giro) < 3, `giro sem querer ${f(c.giro).toFixed(1)}% (antes ${f(c.antesGiro).toFixed(1)}%)`);
  // uma pinça de verdade (de 200 para 330 px, o meio parado) e um giro de verdade (30 graus) passam com folga
  assert.equal(ehPinca(130, 200, 0), true);
  assert.equal(ehPinca(-90, 300, 15), true, 'aproximar também');
  assert.equal(ehGiro(30, 200, 0), true);
  assert.equal(ehGiro(-25, 260, 10), true);
  // pinça com a mão andando junto (pinça e arrasto): o vão muda bem mais que 30% do que o meio andou
  assert.equal(ehPinca(120, 200, 150), true);
  // limites sãos
  assert.equal(limiarPinca(100), GESTOS.pincaPx);
  assert.ok(limiarPinca(400) > 36 && limiarPinca(400) <= 40.001);
  assert.ok(limiarGiro(40) > GESTOS.giroGraus && limiarGiro(40) <= 30, 'vão pequeno: giro mais difícil, mas finito');
  assert.ok(limiarGiro(400) >= GESTOS.giroGraus && limiarGiro(400) < 10);
});

test('limiares: a pinça e o giro perdem só o limiar, em quadros de 16 ms ou de 200 ms (o limiar passa no meio de um quadro lento)', () => {
  const pinca = (dtQuadro) => {
    const M = montar();
    const e0 = M.cam.estado();
    M.ev('pointerdown', 1, 393, 230, 1000);
    M.ev('pointerdown', 2, 593, 230, 1010);
    let proximo = 1010 + dtQuadro;
    for (let s = 16; s <= 640; s += 16) {
      const k = Math.min(1, s / 600);
      M.ev('pointermove', 1, 393 - 100 * k, 230, 1010 + s);
      M.ev('pointermove', 2, 593 + 100 * k, 230, 1010 + s);
      if (1010 + s >= proximo) {
        M.quadro(1010 + s);
        proximo += dtQuadro;
      }
    }
    M.quadro(1010 + 640 + dtQuadro);
    return M.cam.estado().dist / e0.dist;
  };
  const rapido = pinca(16);
  const lento = pinca(208);
  // de 200 para 400 px: o limiar da pinça é 20 px (10% do vão), então a vista fica com (200 + 20) / 400
  assert.ok(Math.abs(rapido - 0.55) < 0.02, `quadros de 16 ms: ${rapido.toFixed(3)}`);
  assert.ok(Math.abs(lento - rapido) < 0.02, `quadros de 208 ms: ${lento.toFixed(3)} contra ${rapido.toFixed(3)}`);
  // o ponto do limiar: a mudança do vão cortada no limiar (ou na mudança de agora, se for menor), com o sinal
  assert.equal(pontoDaPinca(130, 200, 0), limiarPinca(200));
  assert.equal(pontoDaPinca(-90, 300, 0), -limiarPinca(300));
  assert.equal(pontoDaPinca(15, 200, 0), 15, 'nunca passa da mudança de agora');
  assert.equal(pontoDaPinca(120, 200, 150), GESTOS.dominio * 150, 'com a mão andando junto o limiar é o dos 30% do que o meio andou');
  assert.equal(pontoDoGiro(30, 200, 0), limiarGiro(200));
  assert.equal(pontoDoGiro(-25, 260, 0), -limiarGiro(260));
});

test('limiares: um arrasto de dois dedos com tremor, no jogo, não aproxima nem gira a vista', () => {
  const M = montar();
  const rnd = semente(7);
  const base = M.cam.estado();
  M.ev('pointerdown', 1, 400, 250, 1000);
  M.ev('pointerdown', 2, 600, 252, 1010);
  for (let k = 1; k <= 24; k++) {
    const s = 8 * k;
    M.ev('pointermove', 1, 400 + s + (rnd() - 0.5) * 3, 250 + (rnd() - 0.5) * 3, 1010 + 16 * k);
    M.ev('pointermove', 2, 600 + s * 0.88 + (rnd() - 0.5) * 3, 252 + (rnd() - 0.5) * 3, 1010 + 16 * k);
    M.quadro(1011 + 16 * k);
  }
  const e = M.cam.estado();
  assert.ok(Math.abs(e.dist / base.dist - 1) < 0.005, `zoom sem querer: ${e.dist}`);
  assert.ok(Math.abs(e.guinada - base.guinada) < 0.5, `giro sem querer: ${e.guinada}`);
  assert.ok(Math.abs(e.x - base.x) + Math.abs(e.z - base.z) > 50, 'mas a vista andou com os dedos');
});

// ------------------------------------------------------------------------------------------------ estável

test('estável: o dedo fantasma (pointerup perdido) não vira pinça: um toque primário limpa os dedos velhos', () => {
  const M = montar();
  M.ev('pointerdown', 4, 300, 200, 1000, { isPrimary: true });
  M.ev('pointermove', 4, 330, 200, 1020);
  // a aba foi para o fundo com o dedo na tela: nenhum pointerup chegou. O jogador volta e toca de novo
  M.ev('pointerdown', 9, 600, 200, 5000, { isPrimary: true });
  assert.equal(M.E.gesto, 'espera', 'um dedo só: não é pinça');
  M.ev('pointerup', 9, 600, 200, 5050);
  assert.equal(M.E.gesto, null);
  // sem o isPrimary (o segundo dedo de verdade), o par vale
  M.ev('pointerdown', 10, 300, 200, 6000, { isPrimary: true });
  M.ev('pointerdown', 11, 500, 200, 6020, { isPrimary: false });
  assert.equal(M.E.gesto, 'dois');
  // perder o foco cancela tudo, e a ferramenta em curso recebe o fim cancelado
  const fer = montar();
  const eventos = [];
  fer.E.modo('ferramenta');
  fer.E.aoFerramenta((e) => eventos.push(e));
  fer.ev('pointerdown', 1, 400, 250, 1000);
  fer.ev('pointermove', 1, 430, 250, 1020);
  fer.quadro(1100);
  assert.equal(fer.E.gesto, 'ferramenta');
  fer.E.cancelar();
  assert.equal(fer.E.gesto, null);
  assert.equal(eventos.at(-1).fase, 'fim');
  assert.equal(eventos.at(-1).cancelado, true);
});

test('estável: um toque nos 12 px de baixo (a barra de gestos do Android) não começa nada', () => {
  const M = montar();
  M.ev('pointerdown', 1, 500, H - 6, 1000);
  assert.equal(M.E.gesto, null);
  M.ev('pointermove', 1, 500, H - 6, 1020);
  M.ev('pointerup', 1, 500, H - 6, 1040);
  assert.equal(M.E.gesto, null);
  M.ev('pointerdown', 1, 500, H - 30, 2000);
  assert.equal(M.E.gesto, 'espera', 'um pouco acima vale');
});

test('registro ?toque=1: por quadro o salto, o dt, os eventos e o custo do raio; o resumo traz a tabela', () => {
  globalThis.location = { search: '?x=1&toque=1' };
  globalThis.window = {};
  try {
    const M = montar();
    const log = M.E.registro;
    assert.ok(log && globalThis.window.__toque === log, 'window.__toque');
    const g = gestoUmDedo(M, { de: [900, 300], para: [300, 290], dur: 700, hz: 120, dtQuadro: 100 });
    assert.ok(g.quadros.length > 6);
    const r = log.resumo();
    assert.ok(r.quadrosArrasto >= 3 && r.eventosMove >= 3, JSON.stringify(r));
    assert.ok(r.dtMedioMs >= 90 && r.dtMedioMs <= 110, `dt ${r.dtMedioMs}`);
    assert.equal(r.quadrosMais50ms, r.quadrosArrasto, 'todos os quadros de 100 ms passam de 50');
    assert.ok(r.maiorSaltoPx > 20 && r.maiorSaltoPx <= 400, `salto ${r.maiorSaltoPx}`);
    assert.ok(r.deslizePx > 100 && r.deslizeMs > 100, `deslize ${r.deslizePx} px em ${r.deslizeMs} ms`);
    assert.ok(r.raiosPorQuadro > 0 && r.raiosPorQuadro <= 1.5, `raios por quadro ${r.raiosPorQuadro}`);
    assert.ok(r.solta && r.solta.pxs > 500, JSON.stringify(r.solta));
    log.limpar();
    assert.equal(log.quadros.length, 0);
    M.E.descartar();
    assert.equal(globalThis.window.__toque, undefined);
  } finally {
    delete globalThis.location;
    delete globalThis.window;
  }
  // sem o parâmetro não há registro
  assert.equal(montar().E.registro, null);
  // o registro sozinho (a sonda de ferramentas/ usa o mesmo módulo)
  const l = criarLogToque({ projetar: (p) => ({ x: p[0], y: p[2] }), estado: () => ({ x: 0, z: 0, dist: 100, guinada: 0 }) });
  l.referencia([10, 0, 10]);
  l.quadro(0, { fase: 'arrastar', dedo: [0, 0] });
  l.quadro(16, { fase: 'arrastar', dedo: [3, 4] });
  assert.equal(l.resumo().quadrosArrasto, 1);
  assert.equal(l.resumo().dtMedioMs, 16);
});

test('gesto.js: o teto do quadro, a escala do px no chão e o redutor do vetor', () => {
  assert.equal(tetoDoQuadro(100, 4), SOLTURA.tetoQuadro * (100 + SOLTURA.folgaQuadroPx) * 4);
  assert.equal(tetoDoQuadro(100, 4, 9), SOLTURA.tetoQuadro * (100 + SOLTURA.folgaQuadroPx) * 9, 'vale o maior px do quadro e do anterior');
  assert.deepEqual(aplicarTeto(30, 40, 100), [30, 40, false]);
  const [x, z, lim] = aplicarTeto(30, 40, 25);
  assert.ok(lim && Math.abs(x - 15) < 1e-9 && Math.abs(z - 20) < 1e-9);
  // de cima (90 graus) o px vale a distância x o tamanho angular; rasante, até 11 vezes mais
  const cima = metrosPorPxEm({ x: 0, y: 1000, z: 0 }, [0, 0, 0], 40, 443);
  assert.ok(Math.abs(cima - (2 * 1000 * Math.tan((20 * Math.PI) / 180)) / 443) < 1e-6);
  // a 20 km do pé da câmera o raio raspa o chão (menos de 5 graus: vale o piso de 5) e o px vale muito mais
  const raso = metrosPorPxEm({ x: 0, y: 1000, z: 0 }, [20000, 0, 0], 40, 443);
  const dist = Math.hypot(20000, 1000);
  assert.ok(Math.abs(raso - (cima * dist) / 1000 / Math.sin((5 * Math.PI) / 180)) < 1e-6, `raso ${raso / cima}`);
  const meio = metrosPorPxEm({ x: 0, y: 1000, z: 0 }, [1000, 0, 0], 40, 443);
  assert.ok(Math.abs(meio - (cima * Math.hypot(1000, 1000)) / 1000 / (1000 / Math.hypot(1000, 1000))) < 1e-6, 'a 45 graus');
  assert.equal(metrosPorPxEm({ x: 0, y: 0, z: 0 }, [0, 0, 0], 40, 443), 0);
});

// ------------------------------------------------------------------------------------------------ câmera

test('câmera: a inércia é exata (o mesmo caminho em quadros de 16 ms e de 250 ms), tem teto e para limpa', () => {
  const caminho = (dtMs) => {
    const M = montar();
    M.cam.impulso({ vx: 2000, vz: -500 });
    let t = 0;
    let passos = 0;
    while (M.cam.movendo && passos++ < 2000) M.cam.atualizar((t += dtMs));
    return { ...M.cam.estado(), t, passos };
  };
  const a = caminho(16);
  const b = caminho(250);
  const c = caminho(100);
  assert.ok(Math.abs(a.x - b.x) < 3 && Math.abs(a.z - b.z) < 1, `16 ms: ${a.x.toFixed(1)} e 250 ms: ${b.x.toFixed(1)}`);
  assert.ok(Math.abs(a.x - c.x) < 3);
  // o total é v x tau (menos o que sobra abaixo da velocidade de parada)
  assert.ok(Math.abs(a.x - 2000 * AMORTECE.pan) < 15 && a.x < 2000 * AMORTECE.pan, `total ${a.x}`);
  assert.ok(a.t < 3000, `para em ${a.t} ms`);
  // o teto: 2200 px de tela no centro por segundo
  const M = montar();
  M.cam.impulso({ vx: 1e9, vz: 0 });
  const tetoM = DESLIZE.velMaxPx * M.cam.metrosPorPx();
  assert.ok(Math.abs(M.cam.velocidade.vx - tetoM) < 1e-6, `teto ${M.cam.velocidade.vx} contra ${tetoM}`);
  M.cam.impulso({ vx: NaN, vz: Infinity, vg: 1e6, vi: -1e6 });
  assert.equal(M.cam.velocidade.vx, 0);
  assert.equal(M.cam.velocidade.vg, DESLIZE.giroMax);
  assert.equal(M.cam.velocidade.vi, -DESLIZE.inclinaMax);
});

test('câmera: no limite do mapa a velocidade zera (nada empurra a parede) e a vista para', () => {
  const M = montar({ cam0: { x: 4000, z: 0, dist: 1500, guinada: 0, inclinacao: 45 } });
  M.cam.impulso({ vx: 3000, vz: 0 });
  let t = 0;
  for (let k = 0; k < 20; k++) M.cam.atualizar((t += 16));
  assert.equal(M.cam.estado().x, 4096);
  assert.equal(M.cam.velocidade.vx, 0, 'a velocidade guardada zerou na parede');
  assert.equal(M.cam.movendo, false);
});

// ------------------------------------------------------------------------------------------------ resolução

test('resolução em movimento: baixa a 72% com o quadro perto do alvo e volta 280 ms depois de a vista parar', () => {
  const ctx = { perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } };
  const r = new Resolucao(ctx, { fixa: false });
  Object.defineProperty(r, 'dpr', { value: 2.75 });
  r.conferir();
  // 3 s de espera e quadros de 30 ms (perto dos 33 ms do alvo de 30 qps)
  let t = 0;
  for (; t < 3500; t += 30) r.medir(t, 'livre');
  const antes = ctx.pr;
  assert.equal(antes, 1.3);
  assert.equal(r.movimento(true, t), true);
  assert.ok(Math.abs(ctx.pr - 1.3 * MOVIMENTO.escala) < 1e-9, `caiu para ${ctx.pr}`);
  assert.ok(r.cas > 0.6, `a nitidez cobre a queda: ${r.cas}`);
  assert.equal(r.ultimaTroca.modo, 'movimento');
  // enquanto a vista se mexe, fica; parou, espera a folga e volta à resolução de antes
  assert.equal(r.movimento(true, t + 100), false);
  assert.equal(r.movimento(false, t + 200), false, 'ainda dentro da folga');
  assert.equal(ctx.pr < antes, true);
  assert.equal(r.movimento(false, t + 200 + MOVIMENTO.folgaMs + 5), true);
  assert.equal(ctx.pr, antes);
  assert.equal(r.cas, 0, 'a nitidez volta ao normal');
  // o quadro folgado (12 ms) não perde nitidez à toa
  const folgado = new Resolucao({ perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } }, { fixa: false });
  Object.defineProperty(folgado, 'dpr', { value: 2.75 });
  folgado.conferir();
  for (let u = 0; u < 3500; u += 12) folgado.medir(u, 'livre');
  assert.equal(folgado.movimento(true, 3600), false);
  // o PC (cronômetro da placa, nativo) e a dinâmica travada não mexem
  const pc = new Resolucao({ perfil: PERFIS.pc, pr: 1, tela: { w: 1280, h: 720 } }, { fixa: false });
  for (let u = 0; u < 3500; u += 40) pc.medir(u, 'livre');
  assert.equal(pc.movimento(true, 3600), false);
  const trav = new Resolucao({ perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } }, { fixa: true });
  for (let u = 0; u < 3500; u += 30) trav.medir(u, 'livre');
  assert.equal(trav.movimento(true, 3600), false);
  // a medida de um janela com a resolução baixada não vale: a dinâmica não desce por causa da queda do movimento
  const ctx2 = { perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } };
  const r2 = new Resolucao(ctx2, { fixa: false });
  Object.defineProperty(r2, 'dpr', { value: 2.75 });
  r2.conferir();
  let u = 0;
  for (; u < 3500; u += 30) r2.medir(u, 'livre');
  r2.movimento(true, u);
  const pr = ctx2.pr;
  for (let k = 0; k < 120; k++, u += 30) {
    r2.movimento(true, u);
    r2.medir(u, 'livre');
  }
  assert.equal(ctx2.pr, pr, 'em movimento só o movimento mexe na resolução');
});

test('resolução: quadros lentos de verdade (400 ms) agora contam e descem direto ao degrau que cabe', () => {
  const ctx = { perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } };
  const r = new Resolucao(ctx, { fixa: false });
  Object.defineProperty(r, 'dpr', { value: 2.75 });
  r.conferir();
  assert.deepEqual(degrausDoPerfil(PERFIS.media, 2.75), [0.85, 1, 1.15, 1.3]);
  let t = 0;
  let trocou = false;
  for (let k = 0; k < 40 && !trocou; k++, t += 400) {
    r.medir(t, 'livre');
    trocou = ctx.pr !== 1.3;
  }
  assert.ok(trocou, 'o controle enxerga quadros de 400 ms (antes ignorava os de mais de 250)');
  assert.equal(ctx.pr, 0.85, `400 ms é severo: foi direto ao piso (${ctx.pr})`);
  // uma pausa (aba no fundo, 5 s) não é lentidão
  const ctx3 = { perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } };
  const r3 = new Resolucao(ctx3, { fixa: false });
  Object.defineProperty(r3, 'dpr', { value: 2.75 });
  r3.conferir();
  let u = 0;
  for (; u < 3500; u += 25) r3.medir(u, 'livre');
  for (let k = 0; k < 6; k++) r3.medir((u += 5000), 'livre');
  assert.equal(ctx3.pr, 1.3, 'cinco segundos entre quadros são pausa');
  // um soluço no meio de quadros bons (a mediana) não derruba
  const ctx4 = { perfil: PERFIS.media, pr: 1.3, tela: { w: 986, h: 443 } };
  const r4 = new Resolucao(ctx4, { fixa: false });
  Object.defineProperty(r4, 'dpr', { value: 2.75 });
  r4.conferir();
  let v = 0;
  for (; v < 3500; v += 25) r4.medir(v, 'livre');
  for (let j = 0; j < 8; j++) {
    for (let k = 0; k < 30; k++) r4.medir((v += 25), 'livre');
    r4.medir((v += 600), 'livre');
  }
  assert.equal(ctx4.pr, 1.3, 'um soluço de 600 ms por janela não derruba a resolução');
});

// ------------------------------------------------------------------------------------------------ app estável

/** Armazenamento de sessão falso. */
const armazem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};

test('estável: a retomada guarda a câmera e a velocidade e vence em 5 minutos; torta vira nada', async () => {
  const { guardarRetomada, lerRetomada, limparRetomada, RETOMADA, enderecoDaRetomada } = await import('../../fonte/app/estavel.js');
  const s = armazem();
  assert.equal(lerRetomada(s, 1000), null, 'sem nada guardado');
  const cam = { x: -300, z: -80, dist: 2300, guinada: 346, inclinacao: 33 };
  assert.equal(guardarRetomada(s, { camera: cam, velocidade: 2 }, 1000), true);
  assert.deepEqual(lerRetomada(s, 5000), { camera: cam, velocidade: 2, t: 1000 });
  assert.equal(lerRetomada(s, 1000 + RETOMADA.validadeMs + 1), null, 'depois de 5 minutos a retomada venceu');
  s.setItem('heldopolis.retomada', JSON.stringify({ v: 1, camera: { x: 'a' }, velocidade: 3, t: 1000 }));
  assert.deepEqual(lerRetomada(s, 2000), { camera: null, velocidade: 0, t: 1000 }, 'câmera torta e velocidade que não existe: só o tempo se salva');
  s.setItem('heldopolis.retomada', '{nao e json');
  assert.equal(lerRetomada(s, 2000), null);
  limparRetomada(s);
  assert.equal(s.getItem('heldopolis.retomada'), null);
  const quebrado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); }, removeItem() { throw new Error('bloqueado'); } };
  assert.equal(guardarRetomada(quebrado, {}), false);
  assert.equal(lerRetomada(quebrado), null);
  assert.doesNotThrow(() => limparRetomada(quebrado));
  // o endereço da recarga: continuar, sem pisar numa cena nem no ?menu=0
  assert.equal(enderecoDaRetomada('https://x.github.io/diogo/previa/'), 'https://x.github.io/diogo/previa/?menu=continuar');
  assert.equal(enderecoDaRetomada('https://x/p/?q=media'), 'https://x/p/?q=media&menu=continuar');
  assert.equal(enderecoDaRetomada('https://x/p/?menu=nova&q=leve'), 'https://x/p/?menu=continuar&q=leve', 'a recarga continua a partida de agora, não abre outra');
  assert.equal(enderecoDaRetomada('https://x/p/?menu=0'), 'https://x/p/?menu=0');
  assert.equal(enderecoDaRetomada('https://x/p/?cena=aberta'), 'https://x/p/?cena=aberta');
});

test('estável: a perda do contexto pausa o tempo e a volta recarrega pelo continuar levando a câmera; guarda contra laço', async () => {
  const { ligarContexto, podeRecarregar, RETOMADA, lerRetomada } = await import('../../fonte/app/estavel.js');
  const ouvintes = new Map();
  const canvas = { addEventListener: (n, f) => ouvintes.set(n, f), removeEventListener: (n) => ouvintes.delete(n) };
  const s = armazem();
  const avisos = [];
  const recargas = [];
  const agendados = [];
  let relogio = 100000;
  let pausou = 0;
  const cam = { x: 10, z: 20, dist: 800, guinada: 90, inclinacao: 40 };
  const L = ligarContexto({
    canvas, storage: s, agora: () => relogio, href: () => 'https://x/p/', avisar: (f) => avisos.push(f), recarregar: (u) => recargas.push(u),
    estado: () => ({ camera: cam, velocidade: 0 }), pausar: () => ((pausou += 1), 4),
    agendar: (fn, ms) => (agendados.push({ fn, ms }), agendados.length), cancelar: () => {},
  });
  ouvintes.get('webglcontextlost')();
  assert.equal(L.perdido(), true);
  assert.equal(pausou, 1, 'o tempo pausa');
  assert.deepEqual(avisos, ['perdeu']);
  assert.equal(agendados[0].ms, RETOMADA.esperaVoltaMs, 'se a volta não vem em 8 s, recarrega do mesmo jeito');
  ouvintes.get('webglcontextrestored')();
  assert.deepEqual(avisos, ['perdeu', 'voltou']);
  assert.deepEqual(recargas, ['https://x/p/?menu=continuar']);
  const r = lerRetomada(s, relogio);
  assert.deepEqual(r.camera, cam);
  assert.equal(r.velocidade, 4, 'a velocidade é a de antes de pausar');
  // perdeu de novo e a volta não veio: o tempo de espera recarrega
  ouvintes.get('webglcontextlost')();
  agendados.at(-1).fn();
  assert.equal(recargas.length, 2);
  // um terceiro em 60 s não recarrega (laço de recargas)
  ouvintes.get('webglcontextlost')();
  ouvintes.get('webglcontextrestored')();
  assert.equal(recargas.length, 2, 'a guarda segura a terceira recarga');
  assert.equal(avisos.at(-1), 'seguiu', 'e o aviso de tela cheia sai: o jogo segue');
  // depois da janela volta a poder
  relogio += RETOMADA.janelaMs + 1;
  assert.equal(podeRecarregar(s, relogio), true);
  L.desligar();
  assert.equal(ouvintes.size, 0);
});

test('estável: perder o contexto com o tempo já pausado pelo fundo leva a velocidade de antes do fundo, não zero', async () => {
  const { ligarContexto, lerRetomada } = await import('../../fonte/app/estavel.js');
  const caso = (pausarDevolve, estadoVelocidade) => {
    const ouvintes = new Map();
    const canvas = { addEventListener: (n, f) => ouvintes.set(n, f), removeEventListener: (n) => ouvintes.delete(n) };
    const s = armazem();
    ligarContexto({
      canvas, storage: s, agora: () => 1000, href: () => 'https://x/p/', recarregar() {}, agendar: () => 1, cancelar() {},
      estado: () => ({ camera: null, velocidade: estadoVelocidade }), pausar: () => pausarDevolve,
    });
    ouvintes.get('webglcontextlost')();
    ouvintes.get('webglcontextrestored')();
    return lerRetomada(s, 1000).velocidade;
  };
  assert.equal(caso(0, 2), 2, 'o laço já pausou no fundo (pausar devolve 0): vale a velocidade de antes do fundo que o estado traz');
  assert.equal(caso(0, 0), 0, 'sem velocidade nenhuma: abre pausado');
  assert.equal(caso(4, 0), 4, 'a perda pausou o tempo agora: vale a de antes de pausar');
  assert.equal(caso(1, 2), 2, 'o jogador já retomou outra velocidade: vale a de agora');
});

test('estável: o laço pausa a simulação no fundo, retoma a velocidade ao voltar e recomeça o relógio do quadro', async () => {
  const { criarLaco } = await import('../../fonte/app/laco.js');
  const ouv = new Map();
  const antes = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  const doc = { visibilityState: 'visible', addEventListener: (n, f) => ouv.set(n, f), removeEventListener: (n) => ouv.delete(n) };
  globalThis.document = doc;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try {
    let vel = 2;
    const dts = [];
    const sim = { avancar: (dt) => (dts.push(dt), vel ? 1 : 0) };
    const fundo = [];
    const L = criarLaco({
      obterSim: () => sim, R: { quadro() {} }, ui: null,
      pausar: () => { const v = vel; vel = 0; return v; }, retomar: (v) => (vel = v), aoSegundoPlano: (o) => fundo.push(o),
    });
    L.iniciar();
    L.quadro(1000);
    L.quadro(1016);
    doc.visibilityState = 'hidden';
    ouv.get('visibilitychange')();
    assert.equal(vel, 0, 'a simulação pausou no fundo');
    doc.visibilityState = 'visible';
    ouv.get('visibilitychange')();
    assert.equal(vel, 2, 'e voltou na velocidade de antes');
    assert.deepEqual(fundo, [true, false]);
    assert.equal(L.velocidadeAntesDoFundo, null, 'com a aba à vista não há velocidade de antes do fundo');
    L.quadro(600000); // dez minutos depois: o primeiro quadro não leva o tempo do fundo
    assert.equal(dts.at(-1), 16.7, 'o relógio do quadro recomeçou');
    // fundo duas vezes seguidas não perde a velocidade de antes
    doc.visibilityState = 'hidden';
    ouv.get('visibilitychange')();
    assert.equal(L.velocidadeAntesDoFundo, 2, 'no fundo o laço guarda a velocidade (a recarga da perda do contexto a leva)');
    ouv.get('visibilitychange')();
    doc.visibilityState = 'visible';
    ouv.get('visibilitychange')();
    assert.equal(vel, 2);
    L.parar();
    assert.equal(ouv.size, 0);
  } finally {
    for (const [k, v] of Object.entries({ document: antes.document, requestAnimationFrame: antes.raf, cancelAnimationFrame: antes.caf })) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
});

test('estável: no celular (Média e Leve) o laço roda a 60 por segundo numa tela de 120 Hz; o PC segue a tela', async () => {
  const { criarLaco, LIMITE_HZ_CELULAR } = await import('../../fonte/app/laco.js');
  const antes = { document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame };
  let cb = null;
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = (f) => ((cb = f), 1);
  globalThis.cancelAnimationFrame = () => {};
  try {
    const rodar = (perfil, hz, ms) => {
      let n = 0;
      const L = criarLaco({ obterSim: () => null, R: { quadro: () => n++, perfil: () => ({ id: perfil }) }, ui: null });
      L.iniciar();
      for (let t = 1000; t < 1000 + ms; t += 1000 / hz) cb(t);
      L.parar();
      return n;
    };
    assert.equal(LIMITE_HZ_CELULAR, 60);
    const m120 = rodar('media', 120, 2000);
    assert.ok(Math.abs(m120 - 120) <= 3, `Média a 120 Hz: ${m120} quadros em 2 s`);
    const l144 = rodar('leve', 144, 2000);
    assert.ok(Math.abs(l144 - 120) <= 4, `Leve a 144 Hz: ${l144} quadros em 2 s`);
    const m60 = rodar('media', 60, 2000);
    assert.ok(m60 >= 119, `Média a 60 Hz não perde quadro: ${m60}`);
    assert.ok(rodar('pc', 120, 2000) >= 239, 'o PC segue a tela');
    assert.ok(rodar('ultra', 144, 2000) >= 286, 'Ultra também');
  } finally {
    for (const [k, v] of Object.entries({ document: antes.document, requestAnimationFrame: antes.raf, cancelAnimationFrame: antes.caf })) {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    }
  }
});

test('instalação: o manifesto abre em tela cheia na horizontal, o service worker trata o fetch e a página segura o toque', () => {
  const ler = (p) => readFileSync(new URL(`../../fonte/web/${p}`, import.meta.url), 'utf8');
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.display, 'fullscreen');
  assert.deepEqual(m.display_override, ['fullscreen', 'standalone']);
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.ok(m.id && m.name && m.short_name && m.background_color && m.theme_color);
  const tam = (x) => m.icons.filter((i) => i.sizes === x).map((i) => i.purpose);
  assert.ok(tam('192x192').includes('any') && tam('512x512').includes('any') && tam('512x512').includes('maskable'), 'ícones de 192 e 512 e o mascarável');
  const sw = ler('sw.js');
  assert.match(sw, /addEventListener\('fetch'/);
  assert.match(sw, /addEventListener\('install'/);
  assert.match(sw, /addEventListener\('activate'/);
  assert.match(sw, /clients\.claim\(\)/);
  const h = ler('index.html');
  assert.match(h, /viewport-fit=cover/);
  assert.match(h, /user-scalable=no/);
  assert.match(h, /#mundo\{[^}]*touch-action:none/, 'o canvas não deixa o navegador roubar o gesto');
  assert.match(h, /overscroll-behavior:none/, 'puxar para recarregar fica desligado');
  assert.match(h, /name="mobile-web-app-capable"/);
});

test('estável: o salvamento grava o diário e o save ao ir para o fundo e o diário em pagehide e freeze (conferido no navegador em 06/10)', () => {
  const src = readFileSync(new URL('../../fonte/app/salvamento.js', import.meta.url), 'utf8');
  assert.match(src, /app\.aoSegundoPlano\(\(oculto\) => \{\s*if \(oculto\) \{\s*gravarJa\(\);[\s\S]*S\.salvar\('auto'/, 'o fundo grava o diário e o save automático');
  assert.match(src, /addEventListener\('pagehide', gravarJa\)/);
  assert.match(src, /addEventListener\('freeze', gravarJa\)/);
  // e quem avisa o fundo é o laço (visibilitychange), que pausa o tempo antes de avisar
  const laco = readFileSync(new URL('../../fonte/app/laco.js', import.meta.url), 'utf8');
  assert.match(laco, /addEventListener\('visibilitychange', visibilidade\)/);
  assert.match(laco, /if \(oculto && pausar && antesDoFundo === null\) antesDoFundo = pausar\(\);\s*try \{\s*aoSegundoPlano\?\.\(oculto\)/);
});
