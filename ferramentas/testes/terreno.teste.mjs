// Testes do chão, do mar e da lagoa (R2a): ruído puro e periódico, paridade da altura do GLSL com alturaEm (D4),
// distância à água, dados por amostra, pirâmides de alturas, escolha dos nós do CDLOD (orçamento e vizinhos com no
// máximo um nível de diferença), uso do solo, geometria da água, paleta (albedo real, sem verde-limão, D44 e A9).
// Também o caminho CC0 do A/B (D46): manifesto das fotos, licenças e o KTX2 de arte/materiais/.
// Roda sozinho: node ferramentas/testes/terreno.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { hash2, hashF, valor, gradiente, fbm, worley, copas, texturaOndas, espectroOndas } from '../../fonte/render/geracao/ruido.js';
import { alturaEm } from '../../fonte/comum/altura.js';
import { AGUA, TIPO_PREDIO, CELULA } from '../../fonte/contratos/flags.js';
import {
  alturaComoGLSL, distanciaAgua, codificarAgua, prepararDados, piramideAlturas, limitesAltura, mipsDeMinimos,
  selecionarNos, faixasCDLOD, rasterizarUso, rasterizarCelulas, estacaoSeca, caixaCelula, PERFIL_TERRENO, RAIZ_CDLOD,
  COPA_ALTURA, COPA_MAX,
} from '../../fonte/render/mundo/terreno.js';
import { lerManifesto, conferirLicencas, normalizarFatia, TETO_BYTES } from '../codificar-texturas.mjs';
import { geometriaAgua, faixasDeMar, curvaDoRio, abrirContorno } from '../../fonte/render/mundo/agua.js';
import {
  PALETA_CHAO, CORES_APOIO, GLSL_TER_VERTICE, GLSL_TER_FRAGMENTO, GLSL_ASSAR, GLSL_GERAR_CAMADAS, GLSL_GERAR_RUIDO,
  NIVEIS_CDLOD, GRADE_NO,
} from '../../fonte/render/materiais/shaders/terreno.glsl.js';
import { GLSL_AGUA_FRAGMENTO, AGUAS } from '../../fonte/render/materiais/shaders/agua.glsl.js';
import { soltarComAlvo } from '../../fonte/render/materiais/texturas-chao.js';
import { CORES_COPA } from '../../fonte/render/materiais/shaders/folha.glsl.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { gerarCidadeSintetica, SINTETICA } from '../cidade-sintetica.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// cidade sintética uma vez só (1 a 2 s)
let sintetica = null;
function espelhoSintetico() {
  if (!sintetica) {
    const sim = criarSimulacao({ semente: SINTETICA.semente, dominios: false });
    gerarCidadeSintetica({ sim });
    sintetica = sim.espelho;
  }
  return sintetica;
}

/** Grade de teste: plano inclinado com um vale, n x n a 8 m. */
function gradeTeste(n = 65, f = (x, z) => 0.05 * x + 3 * Math.sin(z / 40)) {
  const origem = [-(n - 1) * 4, -(n - 1) * 4];
  const altura = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) altura[j * n + i] = f(origem[0] + i * 8, origem[1] + j * 8);
  return { n, passo: 8, origem, altura, agua: new Uint8Array(n * n) };
}

// ------------------------------------------------------------------------------------------------ ruído

test('ruído: determinístico e periódico', () => {
  assert.equal(hash2(3, 7, 1), hash2(3, 7, 1));
  assert.notEqual(hash2(3, 7, 1), hash2(7, 3, 1));
  for (let k = 0; k < 50; k++) {
    const x = hashF(k, 1, 9) * 20;
    const z = hashF(k, 2, 9) * 20;
    assert.ok(Math.abs(valor(x, z, 3, 8) - valor(x + 8, z - 16, 3, 8)) < 1e-12, 'valor periódico');
    assert.ok(Math.abs(gradiente(x, z, 3, 5) - gradiente(x - 5, z + 10, 3, 5)) < 1e-12, 'gradiente periódico');
    assert.ok(Math.abs(fbm(x, z, { s: 2, periodo: 4 }) - fbm(x + 4, z, { s: 2, periodo: 4 })) < 1e-12, 'fbm periódico');
    const v = valor(x, z, 5);
    assert.ok(v >= 0 && v <= 1);
    const w = worley(x, z, 4, 6);
    assert.ok(w.f1 <= w.f2 && w.f1 < 1.5);
    const c = copas(x / 20, z / 20, 1);
    assert.ok(c >= 0 && c <= 1);
    assert.ok(Math.abs(c - copas(x / 20 + 1, z / 20 - 2, 1)) < 1e-12, 'copas periódicas');
  }
  const o = texturaOndas(32, 7);
  assert.equal(o.length, 32 * 32 * 4);
  let soma = 0;
  for (let i = 0; i < o.length; i += 4) {
    const nx = o[i] / 127.5 - 1;
    const nz = o[i + 1] / 127.5 - 1;
    assert.ok(nx * nx + nz * nz <= 1.02, 'normal das ondas dentro da esfera');
    soma += o[i];
  }
  assert.ok(Math.abs(soma / (32 * 32) - 127.5) < 8, 'ondas sem inclinação média');
});

test('ondas: espectro de muitas componentes em todas as escalas, sem uma que desenhe o azulejo', () => {
  const c = espectroOndas(7, { kMax: 42 });
  assert.ok(c.length >= 100, `${c.length} componentes (com poucas aparece a rede regular)`);
  const k = c.map((w) => Math.hypot(w.kx, w.kz));
  assert.ok(Math.min(...k) <= 3 && Math.max(...k) >= 30, 'do marulho à ondulação curta');
  for (const w of c) assert.ok(Number.isInteger(w.kx) && Number.isInteger(w.kz), 'vetor de onda inteiro (emenda)');
  // nenhuma componente com mais de 12% da energia de inclinação (a que sobressai vira a rede repetida no mar)
  const e = c.map((w) => (w.amp * Math.hypot(w.kx, w.kz)) ** 2);
  const total = e.reduce((a, b) => a + b, 0);
  assert.ok(Math.max(...e) / total < 0.12, `componente com ${((100 * Math.max(...e)) / total).toFixed(1)}% da energia`);
  // sem a mesma onda duas vezes (nem com o sinal trocado)
  const chaves = new Set(c.map((w) => (w.kx < 0 || (w.kx === 0 && w.kz < 0) ? `${-w.kx},${-w.kz}` : `${w.kx},${w.kz}`)));
  assert.equal(chaves.size, c.length);
});

// ------------------------------------------------------------------------------------------------ alturas

test('paridade: a conta do GLSL (Float32) dá alturaEm com erro abaixo de 1 cm', () => {
  const T = espelhoSintetico().terreno;
  let pior = 0;
  for (let k = 0; k < 2000; k++) {
    const x = T.origem[0] - 50 + hashF(k, 1, 3) * (T.passo * (T.n - 1) + 100);
    const z = T.origem[1] - 50 + hashF(k, 2, 3) * (T.passo * (T.n - 1) + 100);
    pior = Math.max(pior, Math.abs(alturaComoGLSL(T, x, z) - alturaEm(T, x, z)));
  }
  assert.ok(pior < 0.01, `erro ${pior}`);
  // nas amostras, exato
  const G = gradeTeste();
  assert.equal(alturaComoGLSL(G, G.origem[0] + 16, G.origem[1] + 24), G.altura[3 * G.n + 2]);
});

test('distância à água e a marca do mar', () => {
  const n = 33;
  const agua = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (j >= 28) agua[j * n + i] = AGUA.MAR; // mar ao sul
    else if (i === 5 && j < 20) agua[j * n + i] = AGUA.RIO; // rio estreito a oeste
  }
  const { dist, mar } = distanciaAgua(agua, n);
  assert.equal(dist[27 * n + 20], 1); // terra colada no mar
  assert.equal(mar[27 * n + 20], 1);
  assert.equal(dist[10 * n + 7], 2); // terra a 2 amostras do rio
  assert.equal(mar[10 * n + 7], 0);
  assert.equal(dist[30 * n + 20], 3); // mar a 3 amostras da terra
  assert.equal(mar[30 * n + 20], 1);
  assert.equal(dist[10 * n + 5], 1); // o próprio rio: 1 amostra até a margem
  assert.equal(mar[10 * n + 5], 0);
  assert.equal(codificarAgua(0, 1), 128);
  assert.equal(codificarAgua(40, 0), 20);
  assert.equal(codificarAgua(1000, 1), 255);
  assert.equal(codificarAgua(1000, 0), 127);
});

test('dados por amostra: normal do plano, floresta pela média das células', () => {
  const G = gradeTeste(33, (x) => 0.25 * x);
  const F = { n: 32, passo: 8, dens: new Uint8Array(32 * 32).fill(200) };
  const da = { dist: new Float32Array(33 * 33).fill(10), mar: new Uint8Array(33 * 33).fill(1) };
  const d = prepararDados(G, F, da);
  const k = 4 * (16 * 33 + 16);
  const nx = -0.25 / Math.hypot(0.25, 1);
  assert.ok(Math.abs(d[k] / 255 - (0.5 + 0.5 * nx)) < 0.006);
  assert.ok(Math.abs(d[k + 1] - 127.5) <= 1);
  assert.equal(d[k + 2], 200);
  assert.equal(d[k + 3], codificarAgua(80, 1));
  // refazer um pedaço dá o mesmo
  const d2 = prepararDados(G, F, da, new Uint8Array(d.length), [10, 10, 20, 20]);
  assert.equal(d2[k], d[k]);
});

test('pirâmides: mínimos por mip e limites que contêm as amostras', () => {
  const T = espelhoSintetico().terreno;
  const mips = mipsDeMinimos(T);
  let lado = T.n;
  mips.forEach((m, l) => {
    assert.equal(m.width, Math.max(1, Math.floor(T.n / 2 ** (l + 1))), `tamanho da mip ${l + 1}`);
    lado = m.width;
  });
  assert.equal(lado, 1);
  // o mínimo da mip 1 nunca passa das amostras que ele cobre
  const m1 = mips[0];
  for (let k = 0; k < 300; k++) {
    const i = Math.floor(hashF(k, 5, 1) * m1.width);
    const j = Math.floor(hashF(k, 6, 1) * m1.width);
    const v = m1.data[j * m1.width + i];
    assert.ok(v <= T.altura[2 * j * T.n + 2 * i] + 1e-6);
    assert.ok(v <= T.altura[(2 * j + 1) * T.n + 2 * i + 1] + 1e-6);
  }
  const P = piramideAlturas(T);
  for (let k = 0; k < 200; k++) {
    const x0 = T.origem[0] + hashF(k, 1, 7) * 7000;
    const z0 = T.origem[1] + hashF(k, 2, 7) * 7000;
    const s = 64 + hashF(k, 3, 7) * 1000;
    const [lo, hi] = limitesAltura(P, x0, z0, x0 + s, z0 + s);
    for (let q = 0; q < 20; q++) {
      const h = alturaEm(T, x0 + hashF(q, k, 1) * s, z0 + hashF(q, k, 2) * s);
      assert.ok(h >= lo - 1e-4 && h <= hi + 1e-4, `altura ${h} fora de [${lo}, ${hi}]`);
    }
  }
});

// ------------------------------------------------------------------------------------------------ CDLOD

function cameraDe({ x, z, dist, guinada, inclinacao }, T, far = 60000) {
  const cam = new THREE.PerspectiveCamera(40, 1376 / 768, 1, far);
  const g = (guinada * Math.PI) / 180;
  const i = (inclinacao * Math.PI) / 180;
  const y = alturaEm(T, x, z);
  cam.position.set(x - dist * Math.cos(i) * Math.sin(g), y + dist * Math.sin(i), z + dist * Math.cos(i) * Math.cos(g));
  cam.lookAt(x, y, z);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

function nosPara(cam, T, perfil = 'media') {
  const P = piramideAlturas(T);
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const b = new THREE.Box3();
  const visivel = (c) => fr.intersectsBox(b.set(new THREE.Vector3(c.x0, c.y0, c.z0), new THREE.Vector3(c.x1, c.y1, c.z1)));
  return selecionarNos({ cam: cam.position, visivel, faixas: faixasCDLOD(PERFIL_TERRENO[perfil].r0), P });
}

test('CDLOD: orçamento do Média (até 120 mil triângulos) nas vistas da bancada', () => {
  const T = espelhoSintetico().terreno;
  const vistas = {
    aberta: { x: 60, z: 240, dist: 3400, guinada: 18, inclinacao: 30 },
    bairro: { x: 0, z: 0, dist: 400, guinada: 45, inclinacao: 45 },
    horizonte: { x: 0, z: 800, dist: 150, guinada: 0, inclinacao: 3 },
    rua: { x: 200, z: 300, dist: 12, guinada: 90, inclinacao: 5 },
    costa: { x: -2150, z: 1790, dist: 520, guinada: 292, inclinacao: 16 },
  };
  for (const [nome, v] of Object.entries(vistas)) {
    const nos = nosPara(cameraDe(v, T), T);
    const tris = nos.n * GRADE_NO * GRADE_NO * 2;
    assert.ok(nos.n > 0, `${nome}: nenhum nó`);
    assert.ok(tris <= 120000, `${nome}: ${tris} triângulos`);
  }
});

test('CDLOD: nós sem sobreposição e vizinhos com no máximo um nível de diferença', () => {
  const T = espelhoSintetico().terreno;
  const nos = nosPara(cameraDe({ x: -500, z: 500, dist: 900, guinada: 30, inclinacao: 25 }, T), T);
  const lista = [];
  for (let k = 0; k < nos.n; k++) lista.push({ x0: nos[4 * k], z0: nos[4 * k + 1], s: nos[4 * k + 2], l: nos[4 * k + 3] });
  // sem sobreposição (interiores disjuntos)
  for (let a = 0; a < lista.length; a++) {
    for (let b = a + 1; b < lista.length; b++) {
      const A = lista[a];
      const B = lista[b];
      const cruza = A.x0 < B.x0 + B.s && B.x0 < A.x0 + A.s && A.z0 < B.z0 + B.s && B.z0 < A.z0 + A.s;
      assert.ok(!cruza, `nós ${a} e ${b} se sobrepõem`);
    }
  }
  // vizinhos: um ponto logo fora de cada borda cai num nó de nível parecido (o "morph" cobre um degrau só)
  const achar = (x, z) => lista.find((n) => x >= n.x0 && x < n.x0 + n.s && z >= n.z0 && z < n.z0 + n.s);
  const nivelDe = (n) => Math.log2(n.s / 128);
  for (const n of lista) {
    for (const [x, z] of [[n.x0 - 1, n.z0 + n.s / 2], [n.x0 + n.s + 1, n.z0 + n.s / 2], [n.x0 + n.s / 2, n.z0 - 1], [n.x0 + n.s / 2, n.z0 + n.s + 1]]) {
      const v = achar(x, z);
      if (v) assert.ok(Math.abs(nivelDe(v) - nivelDe(n)) <= 1, `salto de nível entre ${JSON.stringify(n)} e ${JSON.stringify(v)}`);
    }
  }
  assert.equal(faixasCDLOD(256).length, NIVEIS_CDLOD);
  assert.equal(RAIZ_CDLOD.lado, 128 * 2 ** (NIVEIS_CDLOD - 1));
});

// ------------------------------------------------------------------------------------------------ uso do solo

test('uso do solo: via, lote e recorte por retângulo', () => {
  const mapa = { ox: -512, oz: -512, lado: 1024 };
  const lado = 256; // 4 m
  const esp = {
    vias: { arestas: { n: 1, viva: [1], tipo: [0], comp: [400], p: Float64Array.from([-200, 0, -66, 0, 66, 0, 200, 0]) } },
    predios: { n: 1, viva: [1], x: [0], z: [60], rot: [0], w: [24], d: [32], flags: [0], tipo: [TIPO_PREDIO.ZONA], zona: [4], nivel: [1], semente: [7] },
  };
  const buf = new Uint8Array(lado * lado * 4);
  rasterizarUso(esp, buf, lado, mapa);
  const texel = (x, z) => 4 * (Math.floor((z - mapa.oz) / 4) * lado + Math.floor((x - mapa.ox) / 4));
  assert.equal(buf[texel(0, 0)], 255, 'pista da rua');
  assert.ok(buf[texel(0, 7) + 1] > 200, 'calçada');
  assert.equal(buf[texel(0, 30)], 0, 'fora da via');
  assert.ok(buf[texel(2, 60) + 1] > 150, 'piso do lote comercial');
  assert.equal(buf[texel(300, 300)] + buf[texel(300, 300) + 1], 0, 'longe de tudo');
  // refazer só um canto limpa e repinta só ali
  buf[texel(-100, 0)] = 0;
  buf[texel(100, 0)] = 0;
  rasterizarUso(esp, buf, lado, mapa, [-120, -20, -80, 20]);
  assert.equal(buf[texel(-100, 0)], 255);
  assert.equal(buf[texel(100, 0)], 0);
  // células de zona: zona mais 8 se ocupada
  const cel = { celulas: { n: 2, viva: [1, 1], estado: [0, 1], zona: [1, 4], x: [0, 40], z: [-40, -40], ang: [0, 0] } };
  const z = rasterizarCelulas(cel, new Uint8Array(lado * lado), lado, mapa);
  assert.equal(z[Math.floor((-40 - mapa.oz) / 4) * lado + Math.floor((0 - mapa.ox) / 4)], 1);
  assert.equal(z[Math.floor((-40 - mapa.oz) / 4) * lado + Math.floor((40 - mapa.ox) / 4)], 12);
});

test('uso do solo: célula vazia é terreno baldio, ocupada é quintal, sem zona ou inválida não pinta', () => {
  const mapa = { ox: -256, oz: -256, lado: 512 };
  const lado = 128; // 4 m
  const C = {
    n: 4, viva: [1, 1, 1, 1], zona: [1, 1, 0, 2], estado: [CELULA.LIVRE, CELULA.OCUPADA, CELULA.LIVRE, CELULA.INVALIDA],
    x: [-100, 0, 100, 0], z: [0, 0, 0, 100], ang: [0, 0.4, 0, 0], linha: [0, 0, 0, 0],
  };
  const buf = new Uint8Array(lado * lado * 4);
  rasterizarUso({ celulas: C }, buf, lado, mapa);
  const texel = (x, z) => 4 * (Math.floor((z - mapa.oz) / 4) * lado + Math.floor((x - mapa.ox) / 4));
  const vazia = texel(-100, 0);
  const ocupada = texel(0, 0);
  assert.ok(buf[vazia + 2] > buf[vazia + 1], 'baldio: mais terra que piso');
  assert.ok(buf[ocupada + 1] > buf[ocupada + 2], 'quintal: mais piso que terra');
  assert.equal(buf[vazia], 0, 'célula não é via');
  for (const k of [texel(100, 0), texel(0, 100)]) assert.equal(buf[k] + buf[k + 1] + buf[k + 2] + buf[k + 3], 0);
  assert.equal(caixaCelula(C, 2), null);
  assert.equal(caixaCelula(C, 3), null);
  assert.ok(caixaCelula(C, 0)[2] - caixaCelula(C, 0)[0] >= 8);
});

// ------------------------------------------------------------------------------------------------ água

test('água: tudo virado para cima, rio e lagoa acima do leito, mar cobrindo o mar da grade', () => {
  const T = espelhoSintetico().terreno;
  const g = geometriaAgua(T, 0);
  const p = g.attributes.position.array;
  const tipo = g.attributes.aAgua.array;
  const idx = g.index.array;
  const vistos = new Set();
  for (let k = 0; k < idx.length; k += 3) {
    const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
    const ny = (p[3 * b + 2] - p[3 * a + 2]) * (p[3 * c] - p[3 * a]) - (p[3 * b] - p[3 * a]) * (p[3 * c + 2] - p[3 * a + 2]);
    assert.ok(ny >= 0, 'triângulo virado para baixo');
    vistos.add(tipo[a]);
    if (tipo[a] !== AGUAS.mar.tipo) {
      const cx = (p[3 * a] + p[3 * b] + p[3 * c]) / 3;
      const cz = (p[3 * a + 2] + p[3 * b + 2] + p[3 * c + 2]) / 3;
      // o centro fica acima do leito quando está dentro da água da grade
      const i = Math.round((cx - T.origem[0]) / T.passo);
      const j = Math.round((cz - T.origem[1]) / T.passo);
      if (T.agua[j * T.n + i] !== AGUA.TERRA) assert.ok(p[3 * a + 1] >= alturaEm(T, cx, cz) - 0.01, 'água abaixo do leito');
    }
  }
  assert.deepEqual([...vistos].sort(), [0, 1, 2]);
  assert.ok(idx.length / 3 < 20000, `água com ${idx.length / 3} triângulos (teto 20 mil)`);
  // toda amostra de mar dentro de uma faixa de mar
  const faixas = faixasDeMar(T);
  for (let k = 0; k < 400; k++) {
    const i = Math.floor(hashF(k, 1, 2) * T.n);
    const j = Math.floor(hashF(k, 2, 2) * T.n);
    if (T.agua[j * T.n + i] !== AGUA.MAR) continue;
    const x = T.origem[0] + i * T.passo;
    const z = T.origem[1] + j * T.passo;
    assert.ok(faixas.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1), `mar sem malha em ${x}, ${z}`);
  }
  // rio pela poligonal, contorno da lagoa aberto para fora
  const c = curvaDoRio(Float64Array.from([0, 0, -0.5, 40, 100, 0, -0.5, 40]), 10);
  assert.equal(c.length, 11);
  assert.deepEqual(c[5].slice(0, 2), [50, 0]);
  const quad = Float64Array.from([0, 0, 10, 0, 10, 10, 0, 10]);
  const aberto = abrirContorno(quad, 2);
  assert.ok(aberto[0] < 0 && aberto[1] < 0, 'canto aberto para fora');
});

// ------------------------------------------------------------------------------------------------ paleta e shaders

const linear = (hex) => [1, 3, 5].map((k) => {
  const c = parseInt(hex.slice(k, k + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const lum = (hex) => {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function hsv(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0 };
}

test('paleta: albedo real (desenho 9.2), nada acima de 0,80 e nada verde-limão', () => {
  const faixa = { grama: [0.08, 0.18], capim: [0.18, 0.3], terraRoxa: [0.1, 0.18], terraClara: [0.2, 0.28], granito: [0.18, 0.35], areia: [0.35, 0.45], folhico: [0.04, 0.12], concreto: [0.28, 0.4] };
  for (const c of PALETA_CHAO) {
    const L = lum(c.cor);
    const [a, b] = faixa[c.id];
    assert.ok(L >= a && L <= b, `${c.id}: albedo ${L.toFixed(3)} fora de [${a}, ${b}]`);
  }
  const todas = [...PALETA_CHAO.map((c) => c.cor), ...Object.values(CORES_APOIO), ...Object.values(CORES_COPA)];
  for (const hex of todas) {
    assert.ok(Math.max(...linear(hex)) <= 0.8, `${hex} acima de 0,80`);
    const { h, s } = hsv(hex);
    assert.ok(!(h >= 68 && h <= 95 && s > 0.55), `${hex} é verde-limão (matiz ${h.toFixed(0)}, saturação ${s.toFixed(2)})`);
  }
  // a espuma e a água também ficam abaixo de 0,80
  for (const a of Object.values(AGUAS)) assert.ok(Math.max(...a.espalha) < 0.2);
});

test('shaders: nenhuma precisão média, amostradores do terreno dentro da guarda do Mali (D44)', () => {
  const textos = [GLSL_TER_VERTICE.pars, GLSL_TER_VERTICE.normal, GLSL_TER_FRAGMENTO.pars, GLSL_TER_FRAGMENTO.cor, GLSL_ASSAR.fragmento,
    GLSL_GERAR_CAMADAS.fragmento, GLSL_GERAR_RUIDO.fragmento, GLSL_AGUA_FRAGMENTO.pars, GLSL_AGUA_FRAGMENTO.cor];
  const proibida = ['med', 'iump'].join('');
  for (const t of textos) assert.ok(!t.includes(proibida));
  const amostradores = (t) => (t.match(/uniform\s+highp\s+sampler\w+/g) ?? []).length;
  // o terreno deixa folga para os ganchos comuns (sombra, sombra de longe, noite) e o IBL: até 8 próprios no A/B
  assert.ok(amostradores(GLSL_TER_FRAGMENTO.pars) <= 8, `fragmento do terreno com ${amostradores(GLSL_TER_FRAGMENTO.pars)}`);
  assert.ok(amostradores(GLSL_TER_VERTICE.pars) <= 4);
  assert.ok(amostradores(GLSL_AGUA_FRAGMENTO.pars) <= 6);
});

test('relevo fino do fragmento: cada termo some pelo pixel em 3D (na encosta a projeção em x e z subestima o pixel)', () => {
  const cor = GLSL_TER_FRAGMENTO.cor;
  assert.match(cor, /float tPix = max\( length\( tPx \), length\( tPy \) \);/);
  // os termos que entram em terRelevo por derivada de tela: sem o corte pelo pixel viram quadradinhos de 2 x 2 pixels
  for (const termo of ['tRelVeg', 'tRelRocha', 'tCopaRel']) {
    const atribs = [...cor.matchAll(new RegExp(`(?:float )?${termo} = ([^;]+);`, 'g'))].filter((m) => m[1].trim() !== '0.0');
    assert.ok(atribs.length > 0, `${termo} atribuído no fragmento`);
    for (const a of atribs) assert.ok(a[1].includes('tPix'), `${termo} sem o corte pelo tamanho do pixel`);
  }
  assert.ok(!/length\( abs\( tDx \) \+ abs\( tDy \) \)/.test(cor), 'corte pelo pixel só em x e z (falha na encosta)');
  assert.match(cor, /terRelevo\( tN, \( tRel \+ tCopaRel \* 0\.65 \+ tRelRocha \+ tRelVeg \)/);
});

test('relevo fino: inclinação limitada e sem NaN (a parede da copa levantada leva o det a zero)', () => {
  const pars = GLSL_TER_FRAGMENTO.pars;
  const i0 = pars.indexOf('vec3 terRelevo(');
  const corpo = pars.slice(i0, pars.indexOf('\n}', i0));
  assert.match(corpo, /if \( lg > 1\.2 \* ad \) g \*= 1\.2 \* ad \/ lg;/, 'sem o limite da inclinação');
  assert.match(corpo, /dot\( r, r \) > 1e-24 \? normalize\( r \) : n/, 'normalize de vetor nulo dá NaN');
});

test('água: a inclinação de cada mapa de ondas girado volta ao mundo pela transposta do mesmo giro', () => {
  const cor = GLSL_AGUA_FRAGMENTO.cor;
  // aN0 a aN3: o giro da leitura (mat2 antes de aW) e o da inclinação (mat2 depois de aNk.xy) têm de ser o mesmo
  for (let k = 0; k < 4; k++) {
    const leitura = cor.match(new RegExp(`aN${k} = texture\\( uAguaOndas, (mat2\\([^)]*\\))? ?\\*? ?aW`));
    assert.ok(leitura, `leitura de aN${k}`);
    const giro = leitura[1] ?? null;
    const inc = cor.match(new RegExp(`\\( aN${k}\\.xy \\* 2\\.0 - 1\\.0 \\)( \\* (mat2\\([^)]*\\)))?`));
    assert.ok(inc, `inclinação de aN${k}`);
    assert.equal(inc[2] ?? null, giro, `aN${k}: giro da leitura ${giro} e da inclinação ${inc[2]}`);
  }
});

test('texturas do chão: soltar a textura de um alvo de render solta o alvo (o three só apaga pela do alvo)', () => {
  const alvo = new THREE.WebGLRenderTarget(4, 4);
  let soltou = 0;
  alvo.addEventListener('dispose', () => soltou++);
  soltarComAlvo(alvo.texture, alvo);
  alvo.texture.dispose();
  assert.equal(soltou, 1);
  assert.equal(alvo.texture.userData.alvo, alvo);
});

test('vegetação: na borda (cobertura parcial) o vão escuro entre as copas mostra o chão; a mata fechada fica igual', () => {
  const cam = GLSL_TER_FRAGMENTO.pars;
  assert.match(cam, /float terCobVeg\( float cob, vec3 cor \)/);
  // a mesma regra no assado e no pintado por pixel (senão o perto e o longe mudam de cor na troca)
  assert.match(cam, /float veg = terCobVeg\( terVegetacao\( e, cv \), cv \);/);
  assert.match(GLSL_TER_FRAGMENTO.cor, /tAlb = mix\( tAlb, cVeg, terCobVeg\( tVeg, cVeg \) \* tMed \);/);
  // a conta em JavaScript: vão (luminância 0,01) com cobertura 1 continua; com cobertura 0,5 quase some
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cobVeg = (cob, lum) => cob * (1 - (1 - ss(0.013, 0.026, lum)) * (1 - ss(0.4, 0.95, cob)));
  assert.equal(cobVeg(1, 0.01), 1);
  assert.equal(cobVeg(0.5, 0.05), 0.5);
  assert.ok(cobVeg(0.5, 0.01) < 0.05);
});

test('CDLOD: a caixa de cada nó cobre a copa mais alta que o vértice levanta (senão o corte pela vista come copa)', () => {
  const m = GLSL_TER_VERTICE.normal.match(/tCopa \*= uTerCopaV\.x \* \( ([\d.]+) \+ ([\d.]+) \* tRc\.z \);/);
  assert.ok(m, 'fator da copa no vértice');
  assert.ok(COPA_MAX >= COPA_ALTURA * (Number(m[1]) + Number(m[2])) - 1e-9, `COPA_MAX ${COPA_MAX} abaixo da copa do GLSL`);
});

test('estação: capim seco no inverno (julho), verde no verão (janeiro)', () => {
  assert.ok(estacaoSeca(212) > 0.99);
  assert.ok(estacaoSeca(15) < 0.05);
});

// ------------------------------------------------------------------------------------------------ materiais CC0 (D46)

test('CC0: manifesto com as 8 camadas, sha256 e espelhos; material de cada uma em LICENCAS.md', () => {
  const m = lerManifesto(RAIZ);
  assert.ok(m, 'falta arte/materiais/fontes.json');
  const licencas = readFileSync(join(RAIZ, 'arte/LICENCAS.md'), 'utf8');
  for (const c of PALETA_CHAO) {
    const e = m.camadas[c.id];
    assert.ok(e, `${c.id} fora do manifesto`);
    assert.match(e.ambientcg, /^[A-Za-z]+\d{3}[A-Z]?$/, `${c.id}: id da ambientCG`);
    assert.ok(licencas.includes(e.ambientcg), `${e.ambientcg} fora de LICENCAS.md`);
    for (const papel of ['cor', 'altura']) {
      if (!e[papel]) continue;
      assert.match(e[papel].sha256, /^[0-9a-f]{64}$/);
      assert.ok(e[papel].espelhos.length >= 1);
      for (const esp of e[papel].espelhos) assert.ok(esp.includes(e.ambientcg), `${esp}: espelho de outro material`);
    }
  }
  assert.ok(m.camadas.grama.cor, 'a cor é obrigatória');
});

test('CC0: a conferência de licença recusa arquivo sem licença ou com sha256 diferente', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'r2a-'));
  try {
    const foto = join(pasta, 'grama.jpg');
    writeFileSync(foto, 'não é a foto');
    const manifesto = { camadas: { grama: { ambientcg: 'Grass004', cor: { sha256: '0'.repeat(64), espelhos: [] } } } };
    assert.match(conferirLicencas([{ id: 'grama', foto }], 'Grass004', manifesto).join(), /sha256/);
    assert.match(conferirLicencas([{ id: 'grama', foto }], '', manifesto).join(), /LICENCAS/);
    assert.match(conferirLicencas([{ id: 'capim', foto }], '', null).join(), /sem licença/);
    assert.deepEqual(conferirLicencas([{ id: 'capim', foto }], '| grama.jpg |', null), []);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test('CC0: a fatia normalizada tem média 0,5 por canal (o detalhe não muda a cor da paleta)', () => {
  const n = 64 * 64;
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[4 * i] = 40 + (hash2(i, 1, 3) % 80);
    rgba[4 * i + 1] = 90 + (hash2(i, 2, 3) % 60);
    rgba[4 * i + 2] = 20 + (hash2(i, 3, 3) % 30);
    rgba[4 * i + 3] = 255;
  }
  const f = normalizarFatia(rgba);
  for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += f[4 * i + c];
    assert.ok(Math.abs(s / n / 255 - 0.5) < 0.02, `canal ${c}: média ${(s / n / 255).toFixed(3)}`);
  }
});

test('CC0: arte/materiais/chao-camadas.ktx2 é um KTX2 de 8 fatias de 1024, até 8 MB (A1)', () => {
  const arq = join(RAIZ, 'arte/materiais/chao-camadas.ktx2');
  if (!existsSync(arq)) return; // sem o arquivo o chão fica procedural (e o A/B avisa)
  assert.ok(statSync(arq).size <= TETO_BYTES, 'passa do teto de 8 MB');
  const b = readFileSync(arq);
  assert.deepEqual([...b.subarray(0, 12)], [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 'identificador KTX2');
  const u32 = (o) => b.readUInt32LE(o);
  assert.equal(u32(20), 1024, 'largura');
  assert.equal(u32(24), 1024, 'altura');
  assert.equal(u32(32), PALETA_CHAO.length, 'fatias');
  assert.ok(u32(40) >= 10, 'mipmaps');
});
