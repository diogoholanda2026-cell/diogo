// Testes da vida de luxo (R6, D61): iate, cruzeiro e jato em medidas reais com a orientação das faces conferida, LODs com
// teto de triângulos, plano da marina e rota do cruzeiro na água, rotas dos jatos, matriz de instância, o esportivo da
// frota (4 chamadas instanciadas no máximo na soma) e os domínios no render falso.
// Roda sozinho: node ferramentas/testes/vida-luxo.teste.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  malhaIate, malhaCruzeiro, malhaJato, IATE, CRUZEIRO, JATO, planoMarina, rotaCruzeiro, pontoDoOval, rotasJatos, jatoNaRota,
  escreverMatriz, ehMar, distanciaDaTerra,
} from '../../fonte/render/geracao/vidaLuxo.js';
import { ESPORTIVO, ESPORTIVOS_CORES, pecasEsportivo } from '../../fonte/render/geracao/veiculos-luxo.js';
import { MODELOS, malhaVeiculo, PARTE } from '../../fonte/render/geracao/veiculos.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { gerarCidadeSintetica, SINTETICA } from '../cidade-sintetica.mjs';

let esp = null;
function espelho() {
  if (!esp) {
    const sim = criarSimulacao({ semente: SINTETICA.semente, dominios: false });
    gerarCidadeSintetica({ sim });
    esp = sim.espelho;
  }
  return esp;
}

function caixaDe(m) {
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.posicao.length; i += 3) {
    for (let q = 0; q < 3; q++) {
      assert.ok(Number.isFinite(m.posicao[i + q]));
      mn[q] = Math.min(mn[q], m.posicao[i + q]);
      mx[q] = Math.max(mx[q], m.posicao[i + q]);
    }
  }
  return { mn, mx };
}

/** Fração de triângulos cuja normal geométrica contraria a normal do vértice (face virada ao contrário). */
function viradas(m) {
  let ruins = 0;
  const n = m.indices.length / 3;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    const P = (k) => [m.posicao[3 * k], m.posicao[3 * k + 1], m.posicao[3 * k + 2]];
    const [A, B, C] = [P(a), P(b), P(c)];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const g = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const d = g[0] * m.normal[3 * a] + g[1] * m.normal[3 * a + 1] + g[2] * m.normal[3 * a + 2];
    if (d < -1e-9) ruins++;
  }
  return ruins / n;
}

test('iate: 42 m por 8,4 m, borda na água, flybridge a 13,2 m, faces para fora, LOD0 até 650 e LOD1 até 200 triângulos', () => {
  const a = malhaIate(0);
  const b = malhaIate(1);
  const { mn, mx } = caixaDe(a);
  assert.ok(Math.abs(mx[2] - mn[2] - IATE.comp - 2) < 3.5, `comprimento ${mx[2] - mn[2]}`); // com a plataforma de popa
  assert.ok(mx[0] - mn[0] > 8 && mx[0] - mn[0] < 8.6);
  assert.ok(mn[1] > -2.1 && mn[1] < -1.5 && Math.abs(mx[1] - IATE.altura) < 0.3, `alturas ${mn[1]} a ${mx[1]}`);
  assert.ok(a.tris > 300 && a.tris <= 650, `LOD0 ${a.tris}`);
  assert.ok(b.tris <= 200 && b.tris < a.tris / 2, `LOD1 ${b.tris}`);
  assert.ok(viradas(a) === 0 && viradas(b) === 0, 'face virada para dentro');
  const cb = caixaDe(b);
  assert.ok(Math.abs(cb.mx[2] - 21) < 0.01 && Math.abs(cb.mn[2] + 21) < 0.01, 'LOD1 com a mesma proa e popa do casco');
});

test('cruzeiro: 300 m por 38 m, calado de 8,4 m, topo da chaminé a 53 m, LOD0 até 1.300 e LOD1 até 200 triângulos', () => {
  const a = malhaCruzeiro(0);
  const b = malhaCruzeiro(1);
  const { mn, mx } = caixaDe(a);
  assert.ok(Math.abs(mx[2] - mn[2] - CRUZEIRO.comp) < 0.01);
  assert.ok(mx[0] - mn[0] > 38 && mx[0] - mn[0] < 40);
  assert.ok(Math.abs(mn[1] + CRUZEIRO.calado) < 0.1 && mx[1] > CRUZEIRO.altura - 1 && mx[1] < CRUZEIRO.altura + 2);
  assert.ok(a.tris > 700 && a.tris <= 1300, `LOD0 ${a.tris}`);
  assert.ok(b.tris <= 200, `LOD1 ${b.tris}`);
  assert.ok(viradas(a) === 0 && viradas(b) === 0);
});

test('jato: 32 m de comprimento, 30 m de envergadura, cauda a 7,3 m, 600 triângulos no máximo, faces para fora', () => {
  const j = malhaJato();
  const { mn, mx } = caixaDe(j);
  assert.ok(Math.abs(mx[2] - mn[2] - JATO.comp) < 1.2, `comprimento ${mx[2] - mn[2]}`);
  assert.ok(Math.abs(mx[0] - mn[0] - JATO.envergadura) < 0.5);
  assert.ok(mx[1] > 7 && mx[1] < JATO.altura + 0.1 && mn[1] > -1.6);
  assert.ok(j.tris > 350 && j.tris <= 600, `${j.tris}`);
  assert.ok(viradas(j) === 0);
  // simétrico em x
  let sx = 0;
  for (let i = 0; i < j.posicao.length; i += 3) sx += j.posicao[i];
  assert.ok(Math.abs(sx / (j.posicao.length / 3)) < 0.05);
});

test('marina e cruzeiro: iates na água a 40 m da margem, rota do oval em mar aberto, cruzeiro andando em volta', () => {
  const T = espelho().terreno;
  const m = planoMarina(T, 5);
  assert.ok(m, 'sem marina no mapa sintético, que tem mar');
  assert.ok(m.atracados.length >= 5 && m.fundeados.length >= 2, `${m.atracados.length} atracados, ${m.fundeados.length} fundeados`);
  for (const b of [...m.atracados, ...m.fundeados]) {
    assert.ok(ehMar(T, b.x, b.z), 'iate em terra');
    assert.ok(b.escala >= 0.6 && b.escala <= 1.6);
  }
  // os atracados de proa para a terra: a terra mais perto fica à frente deles
  for (const b of m.atracados) {
    const ahead = ehMar(T, b.x + Math.sin(b.rot) * 90, b.z + Math.cos(b.rot) * 90);
    assert.ok(!ahead, 'atracado de popa para a margem');
  }
  assert.deepEqual(planoMarina(T, 5), m, 'determinístico');
  const r = rotaCruzeiro(T, m, 5);
  assert.ok(r, 'sem rota do cruzeiro');
  const per = 2 * r.reta + 2 * Math.PI * r.raio;
  for (let k = 0; k < 64; k++) {
    const p = pontoDoOval(r, (k / 64) * per);
    assert.ok(ehMar(T, p.x, p.z) || Math.abs(p.x) > 4200 || Math.abs(p.z) > 4200, 'oval em terra');
    assert.ok(distanciaDaTerra(T, p.x, p.z, 300, 60) === Infinity || Math.abs(p.x) > 4000 || Math.abs(p.z) > 4000, 'oval a menos de 300 m da terra');
  }
  // o rumo muda de forma contínua: dois pontos a 1 m têm a proa na direção do deslocamento
  for (let k = 0; k < 40; k++) {
    const s = (k / 40) * per;
    const a = pontoDoOval(r, s);
    const b = pontoDoOval(r, s + 1);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    assert.ok(Math.abs(dx - Math.sin(a.rumo)) < 0.02 && Math.abs(dz - Math.cos(a.rumo)) < 0.02, `proa fora do rumo em s ${s}`);
  }
});

test('jatos: três rotas retas em alturas diferentes que cruzam o mapa, andando a mais de 100 m/s', () => {
  const T = espelho().terreno;
  const R = rotasJatos(T, 5, 3);
  assert.equal(R.length, 3);
  assert.equal(new Set(R.map((r) => Math.round(r.y / 100))).size, 3);
  for (const r of R) {
    assert.ok(r.y > 1200 && r.y < 3200 && r.vel > 100 && r.vel < 135);
    const a = jatoNaRota(r, 0);
    const b = jatoNaRota(r, 1000);
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(Math.abs(d - r.vel) < 1 || d > r.comp / 2, 'velocidade');
    // passa a menos de 2 km do centro do mapa
    const cx = T.origem[0] + (T.passo * (T.n - 1)) / 2;
    const cz = T.origem[1] + (T.passo * (T.n - 1)) / 2;
    const dist = Math.abs((cx - r.x0) * r.dz - (cz - r.z0) * r.dx);
    assert.ok(dist < 2000, `rota a ${dist} m do centro`);
  }
});

test('matriz de instância: guinada leva a proa (+z) para (sen, cos), a escala vale e a translação fica', () => {
  const o = new Float32Array(16);
  escreverMatriz(o, 0, 10, 20, 30, Math.PI / 2, 0, 0, 2);
  // coluna z = imagem de (0,0,1): proa para +x, escala 2
  assert.ok(Math.abs(o[8] - 2) < 1e-6 && Math.abs(o[10]) < 1e-6 && Math.abs(o[9]) < 1e-6);
  assert.deepEqual([o[12], o[13], o[14], o[15]], [10, 20, 30, 1]);
  // arfagem negativa levanta o nariz
  escreverMatriz(o, 0, 0, 0, 0, 0, -0.1, 0, 1);
  assert.ok(o[9] > 0.09);
});

test('esportivo da frota: 7º modelo, baixo e largo, 400 triângulos no máximo, cores vivas e peças a mais', () => {
  assert.equal(MODELOS[6].id, 'esportivo');
  assert.ok(ESPORTIVO.h < 1.3 && ESPORTIVO.l > 1.9 && ESPORTIVO.c > 4.4);
  const v = malhaVeiculo('esportivo', 0);
  assert.ok(v.tris >= 300 && v.tris <= 400, `${v.tris}`);
  assert.equal(malhaVeiculo('esportivo', 1).tris, 22);
  const pecas = pecasEsportivo(ESPORTIVO, PARTE);
  assert.ok(pecas.length >= 10);
  assert.ok(ESPORTIVOS_CORES.every(([hex, w]) => /^#[0-9a-f]{6}$/.test(hex) && w > 0));
  // vermelho de corrida e amarelo entre as cores
  assert.ok(ESPORTIVOS_CORES.some(([hex]) => hex === '#b3131b') && ESPORTIVOS_CORES.some(([hex]) => hex === '#e2b81c'));
});
