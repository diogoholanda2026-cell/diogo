// Testes do LOTE1: o pátio do lote se molda ao relevo (terraplenagem natural). A plataforma sob cada construção fica plana
// na pegada (o prédio é rígido e a cota é o chão no centro), sobe a um plano inclinado ajustado por mínimos quadrados com
// corte/aterro limitado e mistura o pátio com o terreno natural num talude de largura proporcional ao desnível.
//   - declive forte, côncavo, convexo e sela: o declive do chão nunca passa de um limiar (sem degrau) e o chão se mexe menos
//     que no perfil antigo (plataforma sem plano, que continua valendo para os saves de antes);
//   - perto de via e de outro lote: o talude não cria degrau novo onde duas formas se encontram;
//   - a escolha entre formas segue sem depender da ordem de registro, o plano entra no save e no hash, o custo do aplainar
//     soma o volume do pátio e a leitura do chão no centro do prédio continua igual à cota;
//   - o contorno do lote pintado no chão (render) é arredondado e a lista de árvores e carros respeita a mesma forma.
// Roda sozinho: node ferramentas/testes/lote-curva.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { alturaEm } from '../../fonte/comum/altura.js';
import { normalizarForma } from '../../fonte/sim/formas.js';
import { aplainar, ajustarPlano, alturaDaPlataforma, volumeDoPatio, LOTE, ALCANCE } from '../../fonte/sim/mundo/aplainar.js';
import { montarSave, lerSave, migrar, aplicarSave, hashEstado } from '../../fonte/sim/salvar/formato.js';
import { distLote, raioDoCanto, contornoDoLote } from '../../fonte/comum/lote.js';

// grade fina de teste (2 m) para ver o perfil: 161 x 161 amostras, de -160 a 160
const N = 161;
const PASSO = 2;
const ORIGEM = [-160, -160];
const RET = [-160, -160, 160, 160];

function grade(f) {
  const altura = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) altura[j * N + i] = f(ORIGEM[0] + i * PASSO, ORIGEM[1] + j * PASSO);
  return { n: N, passo: PASSO, origem: ORIGEM, altura };
}

const retangulo = (cx, cz, w, d) => [cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, cx - w / 2, cz + d / 2];

function rodar(base, formas) {
  const out = Float32Array.from(base.altura);
  aplainar(base, formas, RET, out);
  return out;
}

/** Maior declive entre amostras vizinhas (m por m) e onde. */
function declive(out) {
  let m = 0;
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      for (const k of [1, N]) {
        const g = Math.abs(out[j * N + i + k] - out[j * N + i]) / PASSO;
        if (g > m) m = g;
      }
    }
  }
  return m;
}

/** Maior mudança do chão em relação ao natural (m): a terra que o lote mexe. */
function desvio(base, out) {
  let m = 0;
  for (let k = 0; k < out.length; k++) m = Math.max(m, Math.abs(out[k] - base.altura[k]));
  return m;
}

const cotaNoCentro = (base, cx, cz) => Math.floor(alturaEm(base, cx, cz) * 100) / 100;

/** A plataforma nova (com plano) e a antiga (sem), no mesmo contorno e na mesma cota. */
function par(base, cx, cz, w, d, ref = 1) {
  const contorno = retangulo(cx, cz, w, d);
  const cota = cotaNoCentro(base, cx, cz);
  const plano = ajustarPlano(base, Float64Array.from(contorno), cota);
  return {
    contorno, cota, plano,
    nova: normalizarForma({ tipo: 'plataforma', ref, contorno, cota, plano }),
    velha: normalizarForma({ tipo: 'plataforma', ref, contorno, cota }),
  };
}

// declive que o jogo deixa construir com aplainar: 20% do lado (conferirLugar), então 0,2 m por m na pegada
const TERRENOS = {
  'declive forte': (x, z) => 0.22 * x + 0.05 * z,
  'côncavo (bacia)': (x, z) => 0.0016 * (x * x + z * z),
  'convexo (colina)': (x, z) => 20 - 0.0016 * (x * x + z * z),
  sela: (x, z) => 0.0016 * (x * x - z * z),
};
/** Quanto o declive pode passar do natural: o talude acrescenta no máximo isto. */
const EXCESSO = 0.3;

test('LOTE1: a pegada fica plana na cota do prédio e o chão no centro é a cota', () => {
  for (const [nome, f] of Object.entries(TERRENOS)) {
    const base = grade(f);
    const p = par(base, 0, 0, 24, 16);
    const out = rodar(base, [p.nova]);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = ORIGEM[0] + i * PASSO;
        const z = ORIGEM[1] + j * PASSO;
        if (Math.abs(x) <= 12 && Math.abs(z) <= 8) assert.equal(out[j * N + i], Math.fround(p.cota), `${nome}: pegada plana em ${x}, ${z}`);
      }
    }
  }
});

test('LOTE1: sem degrau entre a plataforma e o terreno (declive e terra movida menores que no perfil antigo)', () => {
  const resumo = [];
  for (const [nome, f] of Object.entries(TERRENOS)) {
    const base = grade(f);
    const natural = declive(base.altura);
    const p = par(base, 0, 0, 24, 16);
    const nova = rodar(base, [p.nova]);
    const velha = rodar(base, [p.velha]);
    const gn = declive(nova);
    const gv = declive(velha);
    resumo.push(`${nome}: natural ${natural.toFixed(2)} novo ${gn.toFixed(2)} antigo ${gv.toFixed(2)} | terra ${desvio(base, nova).toFixed(2)} x ${desvio(base, velha).toFixed(2)}`);
    assert.ok(gn <= natural + EXCESSO, `${nome}: declive ${gn.toFixed(3)} passa do natural ${natural.toFixed(3)} + ${EXCESSO}`);
    assert.ok(gn <= gv + 1e-6, `${nome}: o perfil novo não pode ser mais íngreme que o antigo (${gn.toFixed(3)} x ${gv.toFixed(3)})`);
    assert.ok(desvio(base, nova) <= desvio(base, velha) + 1e-6, `${nome}: o pátio novo move menos terra`);
    // o chão volta ao natural no alcance: nada além de 24 m do contorno muda
    for (let k = 0; k < nova.length; k++) {
      const x = ORIGEM[0] + (k % N) * PASSO;
      const z = ORIGEM[1] + Math.floor(k / N) * PASSO;
      const fx = Math.max(Math.abs(x) - 12, 0);
      const fz = Math.max(Math.abs(z) - 8, 0);
      if (Math.hypot(fx, fz) >= ALCANCE) assert.equal(nova[k], base.altura[k], `${nome}: fora do alcance o chão é natural`);
    }
  }
  assert.ok(resumo.length === 4);
});

test('LOTE1: no declive forte o ganho é grande (antigo: patamar de 8 m e rampa íngreme)', () => {
  const base = grade(TERRENOS['declive forte']);
  const p = par(base, 0, 0, 24, 16);
  const gn = declive(rodar(base, [p.nova]));
  const gv = declive(rodar(base, [p.velha]));
  assert.ok(gn < 0.6, `declive novo ${gn}`);
  assert.ok(gv > 0.7, `declive antigo ${gv}`);
  assert.ok(Math.abs(p.plano[0] - 0.22) < 0.01 && Math.abs(p.plano[1] - 0.05) < 0.01, `plano ${p.plano}`);
});

test('LOTE1: o plano ajustado é o do terreno (mínimos quadrados) e fica preso ao declive máximo', () => {
  const plano = grade((x, z) => 0.1 * x - 0.07 * z);
  const p = par(plano, 20, -10, 24, 16);
  assert.ok(Math.abs(p.plano[0] - 0.1) < 1e-3 && Math.abs(p.plano[1] + 0.07) < 1e-3, `plano ${p.plano}`);
  assert.deepEqual([p.plano[2], p.plano[3]], [20, -10], 'o centro do contorno');
  // terreno plano: sem inclinação, e o talude some (não há desnível a mistura)
  const chato = grade(() => 5);
  const q = par(chato, 0, 0, 24, 16);
  assert.deepEqual([q.plano[0], q.plano[1]], [0, 0]);
  assert.equal(desvio(chato, rodar(chato, [q.nova])), 0);
  // paredão: o declive do plano é limitado
  const parede = grade((x) => 3 * x);
  const r = par(parede, 0, 0, 24, 16);
  assert.ok(Math.hypot(r.plano[0], r.plano[1]) <= LOTE.inclinacaoMax + 1e-9);
  // o corte/aterro do pátio nunca passa do limite, mesmo com o plano muito inclinado
  const alto = { tipo: 'plataforma', cota: 0, plano: [0.5, 0, 0, 0] };
  assert.ok(Math.abs(alturaDaPlataforma(alto, 60, 0, LOTE.margem, 30)) <= LOTE.corte + 1e-9, 'o pátio respeita o corte máximo');
});

test('LOTE1: a largura do talude cresce com o desnível', () => {
  // o mesmo pátio a cota 0 e o terreno natural em 1 m e em 4 m acima: o talude largo precisa de mais distância para chegar
  const f = { tipo: 'plataforma', cota: 0, plano: [0, 0, 0, 0] };
  const chegada = (hb) => {
    for (let d = LOTE.margem; d <= ALCANCE; d += 0.25) if (Math.abs(alturaDaPlataforma(f, 0, 0, d, hb) - hb) < 0.02 * hb) return d;
    return ALCANCE;
  };
  assert.ok(chegada(4) > chegada(1) + 3, `${chegada(1)} x ${chegada(4)}`);
  assert.ok(chegada(8) <= ALCANCE, 'sempre chega ao natural dentro do alcance');
  assert.equal(alturaDaPlataforma(f, 0, 0, LOTE.margem, 5), 0, 'o pátio colado na pegada segue na cota');
  // contínua: nenhum salto ao andar 0,1 m
  for (const hb of [0.3, 2, 6]) {
    let ant = alturaDaPlataforma(f, 0, 0, 0, hb);
    for (let d = 0.1; d <= ALCANCE + 1; d += 0.1) {
      const v = alturaDaPlataforma(f, 0, 0, d, hb);
      assert.ok(Math.abs(v - ant) <= 0.1 * 0.8 * Math.max(1, hb) / 4 + 0.05, `salto em d ${d}: ${ant} -> ${v}`);
      ant = v;
    }
  }
});

test('LOTE1: perto de uma via a mistura não cria degrau que o perfil antigo não tivesse', () => {
  // rua ao longo de z (x = 26), na cota do chão de lá menos 0,15; o lote a 4 m da borda da pista
  const f = TERRENOS['declive forte'];
  const base = grade(f);
  const eixo = [];
  for (let z = -160; z <= 160; z += 8) eixo.push(26, z, f(26, z) - 0.15);
  const via = normalizarForma({ tipo: 'via', ref: 90, eixo, meiaLargura: 6 });
  const p = par(base, 0, 0, 24, 16);
  const nova = rodar(base, [via, p.nova]);
  const velha = rodar(base, [via, p.velha]);
  assert.ok(declive(nova) <= declive(velha) + 1e-6, `${declive(nova)} x ${declive(velha)}`);
  // o eixo da rua segue na cota dela (a rua manda dentro dela) e o lote na dele, mesmo a 8 m uma da outra
  const k = (80) * N + (26 - ORIGEM[0]) / PASSO;
  assert.ok(Math.abs(nova[k] - (f(26, 0) - 0.15)) < 1e-3, `eixo ${nova[k]}`);
  assert.equal(nova[80 * N + 80], Math.fround(p.cota));
  // a ordem de registro não muda um bit
  const inversa = rodar(base, [p.nova, via]);
  assert.deepEqual(Array.from(inversa), Array.from(nova));
});

test('LOTE1: perto de outro lote (lado a lado, com cotas diferentes) o declive fica no limiar e a ordem não importa', () => {
  const f = TERRENOS['declive forte'];
  const base = grade(f);
  const a = par(base, -30, 0, 24, 16, 1);
  const b = par(base, 30, 0, 24, 16, 2);
  const c = par(base, 0, 28, 20, 12, 3);
  const nova = rodar(base, [a.nova, b.nova, c.nova]);
  const velha = rodar(base, [a.velha, b.velha, c.velha]);
  assert.ok(declive(nova) <= declive(velha) + 1e-6, `${declive(nova)} x ${declive(velha)}`);
  assert.ok(declive(nova) <= declive(base.altura) + 0.5, `declive ${declive(nova)}`);
  const inversa = rodar(base, [c.nova, b.nova, a.nova]);
  assert.deepEqual(Array.from(inversa), Array.from(nova), 'comutativo');
  // lotes encostados (4 m): as pegadas seguem planas
  const d = par(base, 28, 0, 24, 16, 4);
  const colado = rodar(base, [a.nova, d.nova]);
  assert.equal(colado[(80) * N + 80 + Math.round(-30 / PASSO)], Math.fround(a.cota));
});

test('LOTE1: plataforma sem plano (save antigo) segue o perfil de antes: patamar de 8 m e smoothstep de 16 m', () => {
  const base = grade(TERRENOS['declive forte']);
  const v = normalizarForma({ tipo: 'plataforma', ref: 1, contorno: retangulo(0, 0, 24, 16), cota: 0 });
  assert.equal(v.plano, undefined);
  const out = rodar(base, [v]);
  // 6 m além do lado de 12: dentro da faixa plana de 8 m
  const i = (12 + 6 - ORIGEM[0]) / PASSO;
  const j = (0 - ORIGEM[1]) / PASSO;
  assert.equal(out[j * N + i], 0);
});

test('LOTE1: o formato da forma valida o plano e o ganho não muda quem registra sem ele', () => {
  assert.throws(() => normalizarForma({ tipo: 'plataforma', ref: 1, contorno: retangulo(0, 0, 8, 8), cota: 0, plano: [0, 1] }));
  const ok = normalizarForma({ tipo: 'plataforma', ref: 1, contorno: retangulo(0, 0, 8, 8), cota: 0, plano: [0.1, 0, 0, 0] });
  assert.deepEqual(ok.plano, [0.1, 0, 0, 0]);
  // via e cava não levam plano
  const cava = normalizarForma({ tipo: 'cava', ref: 1, contorno: retangulo(0, 0, 8, 8), cota: 0, plano: [0.1, 0, 0, 0] });
  assert.equal(cava.plano, undefined);
});

// ------------------------------------------------------------------------------------------------ na simulação

/** Um lugar do mapa autoral com declive entre 8% e 18% numa pegada de 24 x 16. */
function lugarInclinado(sim) {
  const T = sim.espelho.terreno;
  for (let z = -1200; z < 1200; z += 32) {
    for (let x = -1000; x < 2000; x += 32) {
      const dh = alturaEm(T, x + 12, z) - alturaEm(T, x - 12, z);
      if (Math.abs(dh) / 24 > 0.1 && Math.abs(dh) / 24 < 0.18 && alturaEm(T, x, z) > 3) return { x, z };
    }
  }
  return null;
}

test('LOTE1: na simulação a plataforma ganha o plano, o chão no centro é a cota e o save leva o plano (hash igual)', () => {
  const sim = criarSimulacao({ semente: 'lote1', modo: 'livre' });
  const lugar = lugarInclinado(sim);
  assert.ok(lugar, 'o mapa tem encosta');
  const T = sim.espelho.terreno;
  const cota = Math.floor(alturaEm(T, lugar.x, lugar.z) * 100) / 100;
  const id = sim.formas.registrar({ tipo: 'plataforma', ref: 5000007, contorno: retangulo(lugar.x, lugar.z, 24, 16), cota });
  const f = sim.formas.porId.get(id);
  assert.equal(f.plano.length, 4);
  assert.ok(Math.hypot(f.plano[0], f.plano[1]) > 0.05, `plano ${f.plano}`);
  assert.ok(Math.abs(alturaEm(T, lugar.x, lugar.z) - cota) < 0.2, 'o centro fica perto da cota');
  // a mesma forma registrada de novo (ordem diferente) dá o mesmo plano: nada depende de sorteio
  const sim2 = criarSimulacao({ semente: 'lote1', modo: 'livre' });
  const f2 = sim2.formas.porId.get(sim2.formas.registrar({ tipo: 'plataforma', ref: 5000007, contorno: retangulo(lugar.x, lugar.z, 24, 16), cota }));
  assert.deepEqual(f2.plano, f.plano);
  // save e carga: o plano volta e o chão refeito é o mesmo bit a bit
  const C = criarSimulacao({ semente: 'lote1', modo: 'livre' });
  aplicarSave(C, migrar(lerSave(montarSave(sim))));
  assert.deepEqual([...C.formas.porId.values()].find((g) => g.tipo === 'plataforma' && g.ref === 5000007).plano, f.plano);
  assert.equal(hashEstado(C), hashEstado(sim));
  assert.deepEqual(Array.from(C.espelho.terreno.altura), Array.from(T.altura));
  // sai a forma: o chão volta ao natural
  const antes = Float32Array.from(sim2.espelho.terreno.altura);
  sim2.formas.removerRef('plataforma', 5000007);
  assert.ok(Array.from(sim2.espelho.terreno.altura).some((v, k) => v !== antes[k]));
});

test('LOTE1: o aplainar com custo soma o volume do pátio e do talude, e em terreno plano o pátio não custa nada', () => {
  const sim = criarSimulacao({ semente: 'lote1', modo: 'livre' });
  const lugar = lugarInclinado(sim);
  const base = grade((x, z) => 0.15 * x);
  const contorno = retangulo(0, 0, 24, 16);
  const cota = 0;
  const v = volumeDoPatio(base, { tipo: 'plataforma', ref: 1, contorno, cota });
  assert.ok(v > 0, 'em encosta o pátio move terra');
  const chato = grade(() => 3);
  assert.equal(Math.round(volumeDoPatio(chato, { tipo: 'plataforma', ref: 1, contorno, cota: 3 })), 0);
  // mais declive, mais terra
  const v2 = volumeDoPatio(grade((x, z) => 0.3 * x), { tipo: 'plataforma', ref: 1, contorno, cota });
  assert.ok(v2 > v);
  assert.ok(lugar);
});

// ------------------------------------------------------------------------------------------------ o contorno no render

test('LOTE1: o contorno do lote é arredondado (cantos), igual dentro da pegada e cresce para fora', () => {
  const hw = 12;
  const hd = 8;
  const r = raioDoCanto(hw * 2, hd * 2);
  assert.ok(r >= 2 && r <= 6, `raio ${r}`);
  assert.ok(distLote(0, 0, hw, hd, r) < -hd + 0.01, 'dentro é negativo e vale a distância à borda');
  assert.ok(Math.abs(distLote(hw + 3, 0, hw, hd, r) - 3) < 1e-9, 'no meio do lado a distância é a reta');
  // no canto o lote é cortado: a distância ao contorno é maior que a do retângulo
  const reta = Math.hypot(5, 5);
  const canto = distLote(hw + 5, hd + 5, hw, hd, r);
  assert.ok(Math.abs(canto - (reta + (Math.SQRT2 - 1) * r)) < 1e-9, 'o canto é um quarto de círculo de raio r');
  assert.ok(distLote(hw, hd, hw, hd, r) > 0, 'o vértice do retângulo fica fora do lote arredondado');
});

test('LOTE1: a marcação do lote no chão é o contorno arredondado (todos os pontos na borda, sem cantos retos)', () => {
  const w = 30;
  const d = 20;
  const r = raioDoCanto(w, d);
  const c = contornoDoLote(w, d);
  assert.equal(c.length, 4 * 5);
  for (const [x, z] of c) assert.ok(Math.abs(distLote(x, z, w / 2, d / 2, r)) < 1e-9, `${x}, ${z}`);
  // nenhum ponto no canto do retângulo
  assert.ok(c.every(([x, z]) => Math.hypot(Math.abs(x) - w / 2, Math.abs(z) - d / 2) > 1));
});

test('LOTE1: junto da via o pátio só abaixa o chão: nunca terra do lote acima da rua', () => {
  // lote mais alto que a rua (a rua em corte): o aterro do pátio não passa do chão da rua dentro de 8 m da pista
  const base = grade(() => 10);
  const eixo = [];
  for (let z = -160; z <= 160; z += 8) eixo.push(-30, z, 8);
  const via = normalizarForma({ tipo: 'via', ref: 90, eixo, meiaLargura: 5 });
  const pat = normalizarForma({ tipo: 'plataforma', ref: 1, contorno: retangulo(0, 0, 24, 16), cota: 10, plano: [0, 0.2, 0, 0] });
  const out = rodar(base, [via, pat]);
  for (let u = 0; u <= 6; u += PASSO) {
    const i = (-24 + u - ORIGEM[0]) / PASSO;
    for (const z of [-20, 0, 20]) assert.ok(out[((z - ORIGEM[1]) / PASSO) * N + i] <= 8 + 1e-6, `u ${u}, z ${z}: ${out[((z - ORIGEM[1]) / PASSO) * N + i]}`);
  }
});
