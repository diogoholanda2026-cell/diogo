// Testes da R1b (entrada completa, campo de alturas, sombra de longe, HAO e noite), sem navegador: a meia precisão e a
// rasterização das peças LOD1 no campo; a composição dos ladrilhos e o nível 1 da pirâmide de máximos; a marcha da
// sombra de longe que acha uma torre fina nos passos longos sem engordar a sombra (e a marcha ingênua que a pula); os
// degraus de 3 graus do sol e o retângulo que um prédio novo suja; a oclusão do céu no chão (HAO) numa rua estreita e
// numa praça; os postes, o brilho da cidade, a luz no chão suavizada e a força da noite; a colisão da câmera com a
// cidade pela grade da CPU; o voo pelo caminho ótimo de van Wijk e Nuij; e o árbitro de gestos (80 ms, mira 56 px
// acima do dedo, borda, cancelamento, toque curto e longo, dois dedos que inclinam ou aproximam, o cursor parado do
// mouse). Roda sozinho:
//   node --test ferramentas/testes/luz-e-entrada.teste.mjs (o simular --testes descobre)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Campo, VAZIO, DILATA, NIVEIS, paraMeia, rasterizarPeca, ladrilhoDasPecas, unirRet } from '../../fonte/render/ambiente/campoAlturas.js';
import { alturaDaSombra, haoNoCampo, degrauDaHora, direcaoDoDegrau, retanguloAfetado, ALCANCE, DEGRAU_HORAS, DEGRAUS_DIA } from '../../fonte/render/ambiente/sombraLonge.js';
import { postesDasVias, brilhoDosPostes, forcaNoite, forcaJanelas, POSTES, SUAVE, pesosSuaves, NOITE_LUZ } from '../../fonte/render/ambiente/luzNoite.js';
import { MARCHA, PASSO_NIVEL1, distanciaDaMarcha } from '../../fonte/render/materiais/shaders/sombra.glsl.js';
import { criarEntrada, GESTOS } from '../../fonte/render/camera/entrada.js';
import { criarCamera, caminhoVoo } from '../../fonte/render/camera/camera.js';
import { terrenoPlano } from '../../fonte/sim/substitutos.js';
import { VIAS_ORDEM } from '../../fonte/data/vias.js';

const RAD = Math.PI / 180;

/** Meia precisão de volta para número (para conferir paraMeia). */
function deMeia(h) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

/** Um campo com o chão plano em 0 (sem terreno: refazerChao com T nulo dá o nível do mar). */
function campoPlano(N = 256, tam = 2048) {
  const c = new Campo({ N, tam });
  c.refazerChao(null, 0, [0, 0, N - 1, N - 1]);
  return c;
}

/** Peça em caixa no formato de rasterizarPeca (forma 0). */
const caixa = (cx, cz, w, d, h, giro = 0, forma = 0) => ({ cx, cz, hw: w / 2, hd: d / 2, cg: Math.cos(giro), sg: Math.sin(giro), y0: 0, y1: h, forma });

// ------------------------------------------------------------------------------------------------ campo de alturas

test('campo: meia precisão ida e volta (alturas, o vazio e o teto)', () => {
  for (const v of [0, 1, -1, 0.5, 123.25, 250.5, 480, VAZIO, 65504]) assert.equal(deMeia(paraMeia(v)), v, `valor ${v}`);
  // arredonda para o mais perto: 300,1 cai em 300,0 (passo de 0,25 entre 256 e 512)
  assert.equal(deMeia(paraMeia(300.1)), 300);
  assert.equal(deMeia(paraMeia(1e6)), Infinity);
});

test('campo: a peça girada, o cilindro e as duas águas na grade (com a dilatação)', () => {
  const N = 64;
  const passo = 4;
  const g = new Float32Array(N * N).fill(VAZIO);
  rasterizarPeca(caixa(128, 128, 40, 12, 30, 30 * RAD), g, 0, 0, N, N, 0, 0, passo);
  const em = (x, z) => g[Math.floor(z / passo) * N + Math.floor(x / passo)];
  assert.equal(em(128, 128), 30, 'centro');
  assert.equal(em(128 + 15 * Math.cos(30 * RAD), 128 - 15 * Math.sin(30 * RAD)), 30, 'ao longo do eixo girado');
  assert.equal(em(128 + 15 * Math.sin(30 * RAD), 128 + 15 * Math.cos(30 * RAD)), VAZIO, 'fora pela largura');
  // cilindro de raio 10: o canto da caixa que o contém fica de fora
  const c = new Float32Array(N * N).fill(VAZIO);
  rasterizarPeca(caixa(64, 64, 20, 20, 50, 0, 2), c, 0, 0, N, N, 0, 0, passo);
  assert.equal(c[Math.floor(64 / passo) * N + Math.floor(64 / passo)], 50);
  assert.equal(c[Math.floor(73 / passo) * N + Math.floor(73 / passo)], VAZIO, 'o canto fica fora do cilindro');
  // duas águas: cumeeira no meio (y1), beiral mais baixo (perto de y0)
  const a = new Float32Array(N * N).fill(VAZIO);
  rasterizarPeca({ ...caixa(64, 64, 20, 16, 0, 0, 3), y0: 3, y1: 7 }, a, 0, 0, N, N, 0, 0, passo);
  const meio = a[Math.floor(64 / passo) * N + Math.floor(64 / passo)];
  const beiral = a[Math.floor(71 / passo) * N + Math.floor(64 / passo)];
  assert.ok(meio > beiral && meio <= 7 && beiral >= 3, `cumeeira ${meio}, beiral ${beiral}`);
  // a dilatação: a borda passa DILATA x passo além da peça
  assert.ok(DILATA > 0 && DILATA < 0.5);
});

test('campo: ladrilhos compostos pelo máximo, a pirâmide de máximos, o topo e a troca', () => {
  const c = campoPlano();
  const L1 = ladrilhoDasPecas([caixa(100, 100, 30, 30, 60)], c.N, c.passo, c.gx, c.gz);
  const L2 = ladrilhoDasPecas([caixa(110, 100, 10, 10, 90), caixa(-600, 300, 8, 8, 200)], c.N, c.passo, c.gx, c.gz);
  let r = unirRet(c.trocarLadrilho('a', L1), c.trocarLadrilho('b', L2));
  c.compor(r);
  assert.equal(c.topo(100, 100), 60);
  assert.equal(c.topo(110, 100), 90, 'o maior dos dois ladrilhos');
  assert.equal(c.topo(-600, 300), 200);
  assert.equal(c.topo(400, 400), -Infinity, 'sem prédio');
  assert.equal(c.topo(1e5, 0), -Infinity, 'fora do mapa');
  // pirâmide: cada célula do nível L é o maior das 4 do nível L - 1
  assert.equal(c.niveis.length, NIVEIS);
  for (let L = 1; L < c.niveis.length; L++) {
    const A = c.niveis[L - 1];
    const B = c.niveis[L];
    assert.equal(B.n, A.n / 2);
    for (let k = 0; k < 200; k++) {
      const i = (k * 37) % B.n;
      const j = (k * 53) % B.n;
      const a = 2 * j * A.n + 2 * i;
      assert.equal(B.f[j * B.n + i], Math.max(A.f[a], A.f[a + 1], A.f[a + A.n], A.f[a + A.n + 1]));
      assert.equal(B.h[j * B.n + i], paraMeia(B.f[j * B.n + i]));
    }
  }
  const n1 = (x, z) => c.maximo(1, Math.floor((x - c.gx) / (2 * c.passo)), Math.floor((z - c.gz) / (2 * c.passo)));
  assert.equal(n1(-600, 300), 200, 'a torre no nível 1');
  assert.deepEqual(c.sujosNiveis.map(([L]) => L), c.niveis.map((_, L) => L), 'um retângulo sujo por nível');
  // a torre de 200 m sai: a célula volta ao chão, e o nível 1 também
  r = c.trocarLadrilho('b', ladrilhoDasPecas([caixa(110, 100, 10, 10, 90)], c.N, c.passo, c.gx, c.gz));
  c.compor(r);
  assert.equal(c.topo(-600, 300), -Infinity);
  assert.equal(c.altura(-600, 300), 0);
  assert.equal(n1(-600, 300), 0);
  assert.equal(n1(110, 100), 90);
  const v = c.versao;
  c.compor(c.retDoMundo(0, 0, 10, 10));
  assert.equal(c.versao, v + 1);
});

// ------------------------------------------------------------------------------------------------ sombra de longe

/** A marcha ingênua (uma amostra bilinear por passo, sem a do meio nem o nível 1), para mostrar a torre pulada. */
function sombraIngenua(campo, x, z, dir) {
  let s = -1e4;
  let t = 0;
  for (let k = 0; k < MARCHA.passos; k++) {
    const f = k / (MARCHA.passos - 1);
    t += MARCHA.primeiro + (MARCHA.ultimo - MARCHA.primeiro) * f * f;
    s = Math.max(s, campo.altura(x + dir[0] * t, z + dir[1] * t) - t * dir[2]);
  }
  return s;
}

test('sombra de longe: acha a torre fina nos passos longos sem engordar a sombra', () => {
  const c = campoPlano(512, 4096); // 8 m por célula, como no Média
  const tx = 404;
  const tz = -300;
  const H = 220;
  c.compor(c.trocarLadrilho('t', ladrilhoDasPecas([caixa(tx, tz, 6, 6, H)], c.N, c.passo, c.gx, c.gz)));
  assert.ok(Math.abs(distanciaDaMarcha(MARCHA.passos) - ALCANCE) < 1e-9 && ALCANCE > 850 && ALCANCE < 1000, `alcance ${ALCANCE}`);
  assert.ok(MARCHA.ultimo > PASSO_NIVEL1 * 8, 'os passos longos leem o nível 1');
  const tan = 0.3; // sol a 16,7 graus: a sombra da torre tem 733 m
  const acertos = { perto: [0, 0], longe: [0, 0], ingenua: [0, 0] };
  for (let ang = 0; ang < 360; ang += 17) {
    // receptores atrás da torre; o sol na linha do centro da célula ao da torre
    for (let D = 60; D < H / tan - 40; D += 13) {
      const [i, j] = c.celula(tx - Math.cos(ang * RAD) * D, tz - Math.sin(ang * RAD) * D);
      const x0 = c.gx + (i + 0.5) * c.passo;
      const z0 = c.gz + (j + 0.5) * c.passo;
      const d = Math.hypot(tx - x0, tz - z0);
      const dir = [(tx - x0) / d, (tz - z0) / d, tan, 1];
      const s = alturaDaSombra(c, i, j, dir);
      const esperado = H - d * tan;
      const faixa = d < 450 ? acertos.perto : acertos.longe;
      faixa[1]++;
      if (s > 0.25 * esperado) faixa[0]++;
      acertos.ingenua[1]++;
      if (sombraIngenua(c, x0, z0, dir) > 0.25 * esperado) acertos.ingenua[0]++;
      // nunca mais alta que a da torre vista da célula do nível 1 (16 m) antes dela
      assert.ok(s <= H - (d - 24) * tan + 1e-3, `ângulo ${ang}, D ${d.toFixed(0)}: sombra alta demais ${s.toFixed(1)}`);
      // um raio que passa a 32 m ao lado da torre não acha sombra nenhuma (a sombra não engorda)
      const lado = [-dir[1] * 32, dir[0] * 32];
      const [il, jl] = c.celula(x0 + lado[0], z0 + lado[1]);
      const dl = [(tx + lado[0] - (c.gx + (il + 0.5) * c.passo)), (tz + lado[1] - (c.gz + (jl + 0.5) * c.passo))];
      const nl = Math.hypot(dl[0], dl[1]);
      assert.ok(alturaDaSombra(c, il, jl, [dl[0] / nl, dl[1] / nl, tan, 1]) < 0.5, `ângulo ${ang}, D ${d.toFixed(0)}: sombra a 32 m da torre`);
    }
  }
  const taxa = ([a, n]) => a / n;
  assert.ok(taxa(acertos.perto) > 0.95, `até 450 m: ${JSON.stringify(acertos)}`);
  assert.ok(taxa(acertos.longe) > 0.75, `de 450 m ao fim da sombra: ${JSON.stringify(acertos)}`);
  assert.ok(taxa(acertos.ingenua) < 0.6, `a marcha ingênua pula a torre fina: ${JSON.stringify(acertos)}`);
  // do outro lado da torre (contra o sol), nada
  const dir = [1, 0, tan, 1];
  const [i, j] = c.celula(tx + 200, tz);
  assert.ok(alturaDaSombra(c, i, j, dir) < 0, 'sem sombra na frente da torre');
  assert.equal(alturaDaSombra(c, i, j, [1, 0, tan, 0]), -1e4, 'sem sol, sem sombra');
});

test('sombra de longe: degraus de 3 graus, direção do sol e o retângulo sujo', () => {
  assert.equal(DEGRAU_HORAS * 15, 3, '3 graus de ângulo horário');
  assert.equal(DEGRAUS_DIA, 120);
  const { k, t } = degrauDaHora(17.5);
  assert.equal(k, 87);
  assert.ok(Math.abs(t - 0.5) < 1e-9);
  assert.deepEqual(degrauDaHora(-0.1).k, 119, 'hora negativa dá a volta');
  const tempo = { diaDoAno: 80, mes: 3, ano: 1 };
  const mapa = { latitude: -23.5, norteAz: 0 };
  const a = direcaoDoDegrau('sol', 87, tempo, mapa);
  const b = direcaoDoDegrau('sol', 88, tempo, mapa);
  assert.ok(Math.abs(Math.hypot(a[0], a[1]) - 1) < 1e-9 && a[3] === 1, 'sol unitário no chão e acima do horizonte');
  // fim da tarde no equinócio: o sol a oeste (x negativo), baixo, e a tangente cai de um degrau ao seguinte
  assert.ok(a[0] < -0.9 && a[2] > b[2] && a[2] < 0.5, JSON.stringify({ a, b }));
  const ang = Math.acos(a[0] * b[0] + a[1] * b[1]) / RAD;
  assert.ok(ang < 3.5, `o azimute anda menos de 3,5 graus por degrau: ${ang}`);
  assert.equal(direcaoDoDegrau('sol', 5, tempo, mapa)[3], 0, 'às 1h o sol está abaixo do horizonte');
  // um prédio novo suja a oclusão em volta e a sombra dele, para longe do sol
  const r = retanguloAfetado([100, 100, 101, 101], [a], 8, 1024);
  assert.ok(r[0] <= 91 && r[1] <= 91 && r[3] >= 110, JSON.stringify(r));
  assert.ok(r[2] >= 100 + Math.floor((ALCANCE / 8) * 0.9), `a sombra vai para o leste (longe do sol a oeste): ${r}`);
  assert.deepEqual(retanguloAfetado([0, 0, 2, 2], [], 8, 1024).slice(0, 2), [0, 0], 'preso à grade');
});

test('HAO: céu aberto no chão plano e na praça, fechado no fundo de uma rua estreita entre torres', () => {
  const c = campoPlano(256, 2048);
  // duas lâminas de 60 m com uma rua de 16 m no meio (x de -8 a 8), e uma praça de 200 m mais ao sul
  const pecas = [caixa(-40, 0, 64, 300, 60), caixa(40, 0, 64, 300, 60)];
  c.compor(c.trocarLadrilho('r', ladrilhoDasPecas(pecas, c.N, c.passo, c.gx, c.gz)));
  const alt = (x, z) => c.altura(x, z);
  const plano = haoNoCampo(alt, 600, 600, c.passo);
  assert.ok(Math.abs(plano.v - 1) < 1e-9 && plano.chao === 0, JSON.stringify(plano));
  const rua = haoNoCampo(alt, 0, 0, c.passo);
  assert.ok(rua.v < 0.5 && rua.chao === 0, `rua estreita: ${rua.v}`);
  const praca = haoNoCampo(alt, 0, 260, c.passo);
  assert.ok(praca.v > 0.85, `praça: ${praca.v}`);
  const pe = haoNoCampo(alt, 0, 170, c.passo);
  assert.ok(pe.v < praca.v && pe.v > rua.v, `perto do fim da rua: ${pe.v}`);
});

// ------------------------------------------------------------------------------------------------ noite

test('noite: postes pelas vias (sódio e LED, determinístico), brilho da cidade, força e janelas pela hora', () => {
  const n = 3;
  const A = {
    n,
    viva: Uint8Array.from([1, 1, 0]),
    tipo: Uint8Array.from([VIAS_ORDEM.indexOf('rua'), VIAS_ORDEM.indexOf('avenida'), 0]),
    comp: Float32Array.from([280, 320, 100]),
    corte: Float32Array.from([0, 1, 0.1, 0.9, 0, 1]),
    // Bézier cúbica (x, z) de cada aresta: uma reta leste-oeste e uma norte-sul
    p: Float32Array.from([0, 0, 93, 0, 187, 0, 280, 0, 500, 0, 500, 107, 500, 213, 500, 320, 0, 0, 0, 0, 0, 0, 0, 0]),
  };
  const p = postesDasVias(A);
  const q = postesDasVias(A);
  assert.deepEqual(Array.from(p), Array.from(q), 'determinístico');
  const k = p.length / 6;
  // rua: 10 postes alternando lados; avenida: 8 x 2 (corte de 0,1 a 0,9 com o passo de 32 m) = 20 (a morta não conta)
  assert.equal(k, Math.round(280 / POSTES.rua.passo) + 2 * Math.round(320 / POSTES.avenida.passo));
  for (let i = 0; i < k; i++) {
    const [x, z, raio, r, g, b] = p.slice(6 * i, 6 * i + 6);
    assert.ok(Number.isFinite(x) && Number.isFinite(z) && raio >= 6 && r > 0 && g > 0 && b > 0);
    if (i < 10) assert.ok(Math.abs(z) > 0.5 && Math.abs(z) < 8, `rua: poça por dentro do meio-fio (${z})`);
    else assert.ok(z > 30 && z < 290, `avenida: dentro do corte (${z})`);
  }
  assert.ok(brilhoDosPostes(0) > 0 && brilhoDosPostes(100) < brilhoDosPostes(1000) && brilhoDosPostes(1e6) === 1);
  assert.equal(forcaNoite(10 * RAD), 0, 'dia: sem a luz da noite');
  assert.equal(forcaNoite(-5 * RAD), 1, 'noite cheia');
  let ant = 0;
  for (let e = 6; e >= -6; e -= 0.5) {
    const f = forcaNoite(e * RAD);
    assert.ok(f >= ant - 1e-12, 'a força só cresce com o sol descendo');
    ant = f;
  }
  assert.ok(forcaJanelas(20) > forcaJanelas(3) && forcaJanelas(3) > forcaJanelas(12) - 1e-9, 'as janelas acendem de noite');
  assert.ok(forcaJanelas(20) <= 1 && forcaJanelas(19.99) > forcaJanelas(17.5));
  // a luz no chão: suavização normalizada e simétrica que emenda poças de postes a 30 m (a soma de duas gaussianas de
  // 6 m, suavizadas, não cai abaixo de 40% entre elas) e cobre mais de 2 desvios
  const w = pesosSuaves();
  assert.equal(w.length, SUAVE.amostras);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  for (let i = 0; i < w.length; i++) assert.ok(Math.abs(w[i] - w[w.length - 1 - i]) < 1e-15);
  assert.ok(((SUAVE.amostras - 1) / 2) * SUAVE.passo >= 2 * SUAVE.desvio);
  const sigma = Math.hypot(6, SUAVE.desvio);
  const poca = (x) => Math.exp(-0.5 * (x / sigma) ** 2);
  assert.ok((2 * poca(15)) / (poca(0) + poca(30)) > 0.4, 'a rua entre dois postes não fica escura');
  assert.ok(NOITE_LUZ.rua > 0 && NOITE_LUZ.rua <= 1 && NOITE_LUZ.alturaRua >= 6);
});

// ------------------------------------------------------------------------------------------------ câmera e voo

test('câmera: a colisão pela grade da cidade sobe a vista pela órbita, sem pular para o telhado da rua', () => {
  const c = campoPlano(256, 2048);
  c.compor(c.trocarLadrilho('t', ladrilhoDasPecas([caixa(0, 0, 40, 40, 150)], c.N, c.passo, c.gx, c.gz)));
  const ctx = { camera: new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 20000), sim: { espelho: { terreno: terrenoPlano(), mapa: { tam: 8192 } } } };
  ctx.alturaCidade = (x, z) => c.topo(x, z);
  // alvo na rua ao lado da torre, olhando para o leste: a câmera cairia dentro da torre
  const cam = criarCamera(ctx, { x: 60, z: 0, dist: 80, guinada: 90, inclinacao: 10 });
  cam.atualizar(0);
  const p = ctx.camera.position;
  assert.ok(p.y >= Math.max(0, c.topo(p.x, p.z)) + 2 - 1e-6, `fora da torre: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}`);
  assert.ok(cam.inclinacaoEfetiva > 30 && cam.inclinacaoEfetiva < 88, `a vista subiu pela órbita: ${cam.inclinacaoEfetiva}`);
  // só o necessário (bissecção): 1/4 de grau abaixo, a câmera ainda estaria dentro da torre
  const ic = (cam.inclinacaoEfetiva - 0.25) * RAD;
  const px = 60 - 80 * Math.cos(ic) * Math.sin(90 * RAD);
  assert.ok(80 * Math.sin(ic) < Math.max(0, c.topo(px, 0)) + 2, 'a inclinação efetiva é a mínima livre');
  assert.equal(cam.estado().inclinacao, 10, 'o estado guarda a inclinação pedida');
  assert.ok(Math.abs(Math.hypot(p.x - 60, p.y, p.z) - 80) < 1e-6, 'na mesma distância do alvo');
  // longe da torre, a inclinação pedida vale
  cam.definir({ x: 600, z: 600 });
  cam.atualizar(16);
  assert.equal(cam.inclinacaoEfetiva, 10);
  // a câmera no meio de uma rua de 16 m não sobe para o telhado: a célula, não o vizinho mais alto
  assert.equal(c.topo(0, 30), -Infinity);
});

test('voo: caminho ótimo de van Wijk e Nuij (afasta, anda, aproxima) e só zoom quando o lugar é o mesmo', () => {
  const v = caminhoVoo(400, 400, 5000);
  const a = v.em(0);
  const b = v.em(1);
  assert.ok(Math.abs(a.u) < 1e-9 && Math.abs(a.w - 400) < 1e-6, JSON.stringify(a));
  assert.ok(Math.abs(b.u - 1) < 1e-9 && Math.abs(b.w - 400) < 1e-6, JSON.stringify(b));
  let ant = -1;
  let wMax = 0;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const m = v.em(Math.min(1, t));
    assert.ok(m.u >= ant - 1e-12, 'anda só para a frente');
    ant = m.u;
    wMax = Math.max(wMax, m.w);
  }
  assert.ok(wMax > 1500, `afasta no meio: ${wMax}`);
  assert.ok(caminhoVoo(400, 400, 100).em(0.5).w < 600, 'perto, quase não afasta');
  const z = caminhoVoo(300, 2400, 0);
  assert.ok(Math.abs(z.em(1).w - 2400) < 1e-6 && Math.abs(z.em(0.5).w - Math.sqrt(300 * 2400)) < 1e-6, 'zoom puro: geométrico');
});

// ------------------------------------------------------------------------------------------------ entrada

function montarEntrada({ modo = 'camera' } = {}) {
  const ouvintes = new Map();
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    setPointerCapture() {},
    addEventListener: (t, fn) => ouvintes.set(t, fn),
    removeEventListener: (t) => ouvintes.delete(t),
  };
  const est = { x: 0, z: 0, dist: 500, guinada: 0, inclinacao: 45 };
  const chamadas = { mover: 0, impulso: [], zoom: [], definir: [] };
  const camera = {
    estado: () => ({ ...est }),
    definir(n) {
      chamadas.definir.push({ ...n });
      Object.assign(est, n);
    },
    mover(dx, dz) {
      est.x += dx;
      est.z += dz;
      chamadas.mover++;
    },
    atualizar() {},
    parar() {},
    impulso: (v) => chamadas.impulso.push(v),
    zoom: (f) => chamadas.zoom.push(f),
    girar() {},
  };
  // raio: 1 px da tela = 1 m no chão em volta do alvo
  const ctx = { canvas, tela: { w: 800, h: 600 }, camera: { fov: 40 }, raio: (x, y) => [est.x + x - 400, 0, est.z + y - 300] };
  const E = criarEntrada(ctx, camera);
  E.modo(modo);
  const eventos = [];
  E.aoFerramenta((e) => eventos.push(e));
  const toques = [];
  E.aoToque((t) => toques.push(t));
  const ev = (tipo, id, x, y, t, extra = {}) =>
    ouvintes.get(tipo)?.({ type: tipo, pointerId: id, clientX: x, clientY: y, timeStamp: t, pointerType: 'touch', button: 0, preventDefault() {}, ...extra });
  return { E, ev, est, chamadas, eventos, toques, ouvintes };
}

test('entrada: a ferramenta no polegar com a mira 56 px acima do dedo e o ponto do chão sob a mira', () => {
  const { E, ev, eventos, chamadas } = montarEntrada({ modo: 'ferramenta' });
  ev('pointerdown', 1, 400, 300, 1000);
  assert.equal(eventos.length, 0, 'nos primeiros 80 ms o dedo ainda não é gesto');
  ev('pointermove', 1, 405, 302, 1010);
  assert.equal(eventos.length, 0, 'andar menos de 8 px não decide');
  E.quadro(1060);
  assert.equal(eventos.length, 0);
  E.quadro(1081);
  assert.deepEqual(eventos.map((e) => e.fase), ['inicio', 'move'], 'aos 80 ms vira ferramenta, do ponto em que tocou');
  assert.equal(eventos[0].x, 400);
  assert.equal(eventos[0].y, 300 - 56);
  assert.deepEqual(eventos[0].ponto, [0, 0, 300 - 56 - 300]);
  assert.equal(eventos[1].dedoY, 302);
  ev('pointermove', 1, 450, 350, 1100);
  const m = eventos.at(-1);
  assert.deepEqual([m.fase, m.x, m.y, m.dedos, m.tipo], ['move', 450, 294, 1, 'toque']);
  ev('pointerup', 1, 450, 350, 1150);
  assert.equal(eventos.at(-1).fase, 'fim');
  assert.equal(eventos.at(-1).cancelado, undefined);
  assert.equal(chamadas.mover, 0, 'a câmera não andou');
  // a mira nunca sai da tela e o deslocamento fica entre 0 e 72 px
  E.opcoes({ deslocY: 200 });
  ev('pointerdown', 2, 100, 20, 2000);
  ev('pointermove', 2, 100, 40, 2010);
  assert.equal(eventos.at(-2).y, 0, 'no alto da tela a mira fica na borda');
  ev('pointerup', 2, 100, 40, 2020);
  E.opcoes({ deslocY: -5 });
  ev('pointerdown', 3, 300, 300, 3000);
  ev('pointermove', 3, 300, 320, 3010);
  assert.equal(eventos.at(-1).y, 320, 'deslocamento 0');
  ev('pointerup', 3, 300, 320, 3020);
});

test('entrada: o segundo dedo nos primeiros 80 ms é câmera (a pinça não risca a via); depois cancela a ferramenta', () => {
  const a = montarEntrada({ modo: 'ferramenta' });
  a.ev('pointerdown', 1, 300, 300, 1000);
  a.ev('pointerdown', 2, 500, 300, 1040);
  a.E.quadro(1100);
  assert.equal(a.eventos.length, 0, 'a ferramenta nem começa');
  assert.equal(a.E.gesto, 'dois');
  // afasta os dedos: pinça (depois do limiar de 12 px) aproxima a câmera
  a.ev('pointermove', 1, 250, 300, 1120);
  a.ev('pointermove', 2, 550, 300, 1120);
  a.ev('pointermove', 1, 200, 300, 1140);
  a.ev('pointermove', 2, 600, 300, 1140);
  assert.ok(a.est.dist < 500, `aproximou: ${a.est.dist}`);
  assert.equal(a.est.inclinacao, 45, 'no modo ferramenta os dois dedos não inclinam');
  a.ev('pointerup', 1, 200, 300, 1200);
  a.ev('pointerup', 2, 600, 300, 1200);
  assert.equal(a.eventos.length, 0);
  // com a ferramenta em curso, o segundo dedo a cancela e vira câmera
  const b = montarEntrada({ modo: 'ferramenta' });
  b.ev('pointerdown', 1, 300, 300, 1000);
  b.ev('pointermove', 1, 330, 300, 1030);
  b.ev('pointerdown', 2, 500, 300, 1200);
  assert.deepEqual(b.eventos.map((e) => e.fase), ['inicio', 'move', 'fim']);
  assert.equal(b.eventos.at(-1).cancelado, true);
  assert.equal(b.E.gesto, 'dois');
  // trocar de modo no meio do gesto também cancela
  const c = montarEntrada({ modo: 'ferramenta' });
  c.ev('pointerdown', 1, 300, 300, 1000);
  c.ev('pointermove', 1, 330, 300, 1030);
  c.E.modo('camera');
  assert.equal(c.eventos.at(-1).fase, 'fim');
  assert.equal(c.eventos.at(-1).cancelado, true);
});

test('entrada: toque curto seleciona, toque longo abre o menu, arrasto prende o chão sob o dedo e desliza ao soltar', () => {
  const { E, ev, toques, est, chamadas } = montarEntrada();
  ev('pointerdown', 1, 400, 300, 1000);
  ev('pointerup', 1, 401, 301, 1120);
  assert.deepEqual(toques.map((t) => t.longo), [false]);
  ev('pointerdown', 1, 200, 200, 2000);
  E.quadro(2300);
  assert.equal(toques.length, 1);
  E.quadro(2000 + GESTOS.longoMs + 1);
  assert.deepEqual(toques.map((t) => t.longo), [false, true]);
  ev('pointerup', 1, 200, 200, 2600);
  assert.equal(toques.length, 2, 'soltar depois do toque longo não seleciona');
  // arrasto: o ponto do chão que estava sob o dedo continua sob ele
  ev('pointerdown', 1, 400, 300, 3000);
  for (let k = 1; k <= 6; k++) ev('pointermove', 1, 400 + 20 * k, 300, 3000 + 16 * k);
  assert.ok(Math.abs(est.x - -120) < 1e-9, `o mundo andou com o dedo: ${est.x}`);
  ev('pointerup', 1, 520, 300, 3100);
  assert.equal(chamadas.impulso.length, 1, 'soltar em movimento desliza');
  assert.ok(chamadas.impulso[0].vx < -500, JSON.stringify(chamadas.impulso[0]));
});

test('entrada: dois dedos juntos na vertical inclinam (modo decidido e mantido); a pinça aproxima em volta do meio', () => {
  const { ev, est } = montarEntrada();
  ev('pointerdown', 1, 300, 300, 1000);
  ev('pointerdown', 2, 500, 300, 1010);
  for (let k = 1; k <= 8; k++) {
    ev('pointermove', 1, 300, 300 + 5 * k, 1010 + 15 * k);
    ev('pointermove', 2, 500, 300 + 5 * k, 1010 + 15 * k);
  }
  assert.ok(est.inclinacao > 50, `inclinou: ${est.inclinacao}`);
  assert.equal(est.dist, 500, 'sem zoom');
  // no meio do gesto os dedos se afastam: o modo não troca
  ev('pointermove', 1, 200, 340, 1200);
  ev('pointermove', 2, 600, 340, 1200);
  assert.equal(est.dist, 500, 'o modo inclinar não vira pinça no meio');
  ev('pointerup', 1, 200, 340, 1250);
  ev('pointerup', 2, 600, 340, 1250);
  const p = montarEntrada();
  p.ev('pointerdown', 1, 300, 300, 1000);
  p.ev('pointerdown', 2, 500, 300, 1010);
  p.ev('pointermove', 1, 250, 300, 1030);
  p.ev('pointermove', 2, 550, 300, 1030);
  p.ev('pointermove', 1, 150, 300, 1060);
  p.ev('pointermove', 2, 650, 300, 1060);
  assert.ok(p.est.dist < 400 && p.est.inclinacao === 45, `pinça: ${p.est.dist}`);
  assert.ok(Math.abs(p.est.x) < 1e-9, 'o meio dos dedos não andou: o alvo fica');
});

test('entrada: rolagem pela borda com a ferramenta (a vista anda e a ferramenta recebe o ponto novo) e o cursor parado', () => {
  const { E, ev, est, eventos } = montarEntrada({ modo: 'ferramenta' });
  ev('pointerdown', 1, 780, 380, 1000);
  ev('pointermove', 1, 795, 380, 1010);
  const antes = eventos.length;
  let t = 1010;
  for (let k = 0; k < 10; k++) E.quadro((t += 16));
  assert.ok(est.x > 5, `a vista anda para a borda da direita: ${est.x}`);
  assert.ok(eventos.length >= antes + 9 && eventos.at(-1).fase === 'move', 'a ferramenta segue o ponto');
  assert.ok(eventos.at(-1).ponto[0] > eventos[antes - 1].ponto[0], 'o ponto do chão anda com a vista');
  const x = est.x;
  ev('pointermove', 1, 400, 380, t + 5);
  E.quadro((t += 16));
  E.quadro((t += 16));
  assert.equal(est.x, x, 'fora da faixa a vista para');
  ev('pointerup', 1, 400, 380, t + 5);
  // mouse: o cursor sobre o canvas sem botão manda 'move' com dedos 0 no quadro, sem deslocar a mira
  const n = eventos.length;
  ev('pointermove', 9, 320, 240, t + 10, { pointerType: 'mouse' });
  E.quadro((t += 16));
  assert.equal(eventos.length, n + 1);
  assert.deepEqual([eventos.at(-1).fase, eventos.at(-1).dedos, eventos.at(-1).y, eventos.at(-1).tipo], ['move', 0, 240, 'mouse']);
  E.quadro((t += 16));
  assert.equal(eventos.length, n + 1, 'o cursor parado não repete o evento');
  // mouse com a ferramenta: o botão esquerdo usa a ferramenta na hora, sem árbitro
  ev('pointerdown', 9, 320, 240, t + 20, { pointerType: 'mouse' });
  assert.equal(eventos.at(-1).fase, 'inicio');
  assert.equal(eventos.at(-1).y, 240);
  ev('pointerup', 9, 330, 240, t + 40, { pointerType: 'mouse' });
  assert.equal(eventos.at(-1).fase, 'fim');
  E.descartar();
});
