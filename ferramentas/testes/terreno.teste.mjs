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
import { AGUA, TIPO_PREDIO, CELULA, ETAPA } from '../../fonte/contratos/flags.js';
import {
  alturaComoGLSL, distanciaAgua, codificarAgua, prepararDados, piramideAlturas, limitesAltura, mipsDeMinimos,
  selecionarNos, faixasCDLOD, rasterizarUso, rasterizarCelulas, estacaoSeca, caixaCelula, PERFIL_TERRENO, RAIZ_CDLOD,
  COPA_ALTURA, COPA_MAX, limitesLonge, pesoCompleto, dividirNos, inclinacaoMaxima, INCL_ENCOSTA, LONGE_PIXEL,
  ORDEM_TERRENO, criarMaterialTerreno, criarUniformes, alcanceRelevo, LADO_ALCANCE_RELEVO, memoriaAssadoMB, definesCuboUV,
  seguirVersao, inclEncosta, limitarAssado, usoDaSede, partesDaSedeNoChao, parquePintado, chaveDaSede, MATA_DA_SEDE,
  AmbienteChao,
} from '../../fonte/render/mundo/terreno.js';
import { PLANOS, PLANO_PADRAO, SEDE_CENTRO, PRACA, MERIDIAN, GLEBA_ENVELOPE, mataDaSede } from '../../fonte/data/arcologia-plano.js';
import { partesProntas } from '../../fonte/render/arcologia/planos.js';
import { gerarLadrilho, PASSO_ARVORE, LADRILHO } from '../../fonte/render/mundo/vegetacao.js';
import { preprocessar, contarPrograma } from '../../fonte/render/motor/capacidades.js';
import { ORDEM_FUNDO } from '../../fonte/render/ambiente/ceu.js';
import { lerManifesto, conferirLicencas, normalizarFatia, TETO_BYTES } from '../codificar-texturas.mjs';
import { geometriaAgua, faixasDeMar, curvaDoRio, abrirContorno } from '../../fonte/render/mundo/agua.js';
import {
  PALETA_CHAO, CORES_APOIO, GLSL_TER_VERTICE, GLSL_TER_FRAGMENTO, GLSL_ASSAR, GLSL_GERAR_CAMADAS, GLSL_GERAR_RUIDO,
  NIVEIS_CDLOD, GRADE_NO, GLSL_TER_CAMADAS, GLSL_ASSAR_RELEVO, GLSL_AMB_CHAO, GLSL_AMB_PASSE, AMB_LADO, AMB_NIVEIS,
  TER_RELEVO_MAX,
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
  // (o das copas, assado ou por pixel, pelo fator comum tFatorCopa, que tem o corte)
  assert.match(cor, /float tFatorCopa = [^;]*tPix[^;]*;/);
  for (const termo of ['tRelVeg', 'tRelRocha', 'tCopaRel']) {
    const atribs = [...cor.matchAll(new RegExp(`(?:float )?${termo} \\+?= ([^;]+);`, 'g'))].filter((m) => m[1].trim() !== '0.0');
    assert.ok(atribs.length > 0, `${termo} atribuído no fragmento`);
    for (const a of atribs) assert.ok(/tPix|tFatorCopa|tWAssado/.test(a[1]), `${termo} sem o corte pelo tamanho do pixel`);
  }
  assert.ok(!/length\( abs\( tDx \) \+ abs\( tDy \) \)/.test(cor), 'corte pelo pixel só em x e z (falha na encosta)');
  assert.match(cor, /tRelH = tRel \+ tRelRocha \+ tRelVeg;/);
  assert.match(cor, /tRelH \+= tCopaRel \* 0\.65;/);
  assert.match(cor, /terRelevo\( tN, tRelH \* uTerDetalhe\.z, tPx, tPy \)/);
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
  assert.match(cam, /float vegBruta = terVegetacao\( e, cv \);/);
  assert.match(cam, /float veg = terCobVeg\( vegBruta, cv \);/);
  assert.match(GLSL_TER_FRAGMENTO.cor, /tAlb = mix\( tAlb, cVeg, terCobVeg\( tVeg, cVeg \) \* tMed \* max\( kP, tIngreme \) \);/);
  // a conta em JavaScript: vão (luminância 0,01) com cobertura 1 continua; com cobertura 0,5 quase some
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cobVeg = (cob, lum) => cob * (1 - (1 - ss(0.013, 0.026, lum)) * (1 - ss(0.4, 0.95, cob)));
  assert.equal(cobVeg(1, 0.01), 1);
  assert.equal(cobVeg(0.5, 0.05), 0.5);
  assert.ok(cobVeg(0.5, 0.01) < 0.05);
});

test('CDLOD: a caixa de cada nó cobre a copa mais alta que o vértice levanta (senão o corte pela vista come copa)', () => {
  // (R2b) de longe o fator usa a média 0,5 no lugar do ruído das copas: o máximo continua o do ruído em 1
  const m = GLSL_TER_VERTICE.normal.match(/tCopa \*= uTerCopaV\.x \* \( ([\d.]+) \+ ([\d.]+) \* mix\( tRc\.z, 0\.5,/);
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

// ------------------------------------------------------------------------------------------------ LOD do sombreador (PC2)

test('LOD do sombreador: o caminho barato é escolhido de longe e o completo de perto, pela distância e pela tela', () => {
  // um assado de 2 m por texel (o do PC antes do PC3; o de 1 m está no teste do PC3)
  const pc = { ...PERFIL_TERRENO.alta, cor: 4096, relevo: 0 };
  // no PC do dono (2070 x 1001, 40 graus): o pixel visto de frente cobre 0,6 texel de 2 m a ~1,65 km
  const ang = (2 * Math.tan(Math.PI / 9)) / 1001;
  const [l0, l1] = limitesLonge(pc, 8192, ang);
  assert.ok(Math.abs(l0 - (LONGE_PIXEL[0] * 2) / ang) < 1 && Math.abs(l0 - 1651) < 5, `início ${l0}`);
  assert.ok(Math.abs(l1 - 2477) < 5, `fim ${l1}`);
  // sem a tela, o mínimo do perfil (de perto, até uns 600 m, fica tudo)
  assert.deepEqual(limitesLonge(pc, 8192, 0), pc.longe);
  for (const id of Object.keys(PERFIL_TERRENO)) assert.ok(PERFIL_TERRENO[id].longe[0] >= 250 && PERFIL_TERRENO[id].longe[1] > PERFIL_TERRENO[id].longe[0], id);
  // o peso do caminho completo (kP do GLSL): 1 perto, 0 de longe, suave no meio; fora do mapa sempre completo
  assert.equal(pesoCompleto(300, [l0, l1]), 1);
  assert.equal(pesoCompleto(3000, [l0, l1]), 0);
  const meio = pesoCompleto((l0 + l1) / 2, [l0, l1]);
  assert.ok(meio > 0.4 && meio < 0.6);
  assert.equal(pesoCompleto(9000, [l0, l1], false), 1);
  // o GLSL faz a mesma conta e a variante de longe tem o peso constante (o compilador tira o caminho completo)
  const cor = GLSL_TER_FRAGMENTO.cor;
  assert.match(cor, /float kP = tDentro && uTerMascara < 0\.5 \? 1\.0 - smoothstep\( uTerLonge\.x, uTerLonge\.y, tDist \) : 1\.0;/);
  const longe = preprocessar(`#define TER_LONGE\n${cor}`).texto;
  const perto = preprocessar(cor).texto;
  assert.match(longe, /const float kP = 0\.0;/);
  assert.match(longe, /const bool tEncosta = false;/);
  assert.ok(!longe.includes('terMisturaLinear') && perto.includes('terMisturaLinear'), 'a mistura de fora do mapa só no completo');
  assert.ok(!longe.includes('terGramado') && perto.includes('terGramado'), 'o passe da máscara só no completo');
});

test('LOD do sombreador: os nós além da transição vão para a malha barata; perto, fora do mapa e encosta íngreme não', () => {
  const T = espelhoSintetico().terreno;
  const dados = prepararDados(T, espelhoSintetico().floresta, distanciaAgua(T.agua, T.n));
  const P = piramideAlturas(T, dados);
  const mapa = { ox: T.origem[0], oz: T.origem[1], lado: T.passo * (T.n - 1) };
  // a inclinação máxima de um bloco cobre a de cada amostra dentro dele
  for (let k = 0; k < 60; k++) {
    const x0 = mapa.ox + hashF(k, 11, 3) * 7800;
    const z0 = mapa.oz + hashF(k, 12, 3) * 7800;
    const m = inclinacaoMaxima(P, x0, z0, x0 + 256, z0 + 256);
    const i = Math.round((x0 + 128 - mapa.ox) / T.passo);
    const j = Math.round((z0 + 128 - mapa.oz) / T.passo);
    const q = 4 * (j * T.n + i);
    const nx = (dados[q] / 255) * 2 - 1;
    const nz = (dados[q + 1] / 255) * 2 - 1;
    assert.ok(1 - Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz)) <= m + 1e-6, 'amostra mais íngreme que o bloco');
  }
  assert.equal(inclinacaoMaxima(P, mapa.ox - 256, 0, mapa.ox, 256), 1, 'fora do mapa conta como íngreme');
  // quatro nós: um perto, um longe e plano, um longe fora do mapa e um longe na encosta mais íngreme do mapa
  let ingreme = null;
  for (let bj = 0; bj < P.niveis[0].lado && !ingreme; bj++) {
    for (let bi = 0; bi < P.niveis[0].lado; bi++) {
      if (P.niveis[0].incl[bj * P.niveis[0].lado + bi] > 0.45) {
        ingreme = [mapa.ox + bi * P.bloco, mapa.oz + bj * P.bloco];
        break;
      }
    }
  }
  assert.ok(ingreme, 'a cidade sintética tem encosta íngreme (morros)');
  let plano = null;
  for (let bj = 0; bj < P.niveis[0].lado && !plano; bj++) {
    for (let bi = 0; bi < P.niveis[0].lado; bi++) {
      if (P.niveis[0].incl[bj * P.niveis[0].lado + bi] < 0.05) {
        plano = [mapa.ox + bi * P.bloco, mapa.oz + bj * P.bloco];
        break;
      }
    }
  }
  const nos = new Float32Array([
    plano[0], plano[1], 128, 0,
    plano[0], plano[1], 128, 0,
    mapa.ox - 512, mapa.oz, 256, 1,
    ingreme[0], ingreme[1], 128, 0,
  ]);
  const perto = new Float32Array(16);
  const longe = new Float32Array(16);
  // com a câmera no nó plano, ele fica perto
  let r = dividirNos(nos, 1, { x: plano[0] + 64, y: 300, z: plano[1] + 64 }, mapa, 2000, perto, longe, P);
  assert.deepEqual(r, { perto: 1, longe: 0, medio: 0 });
  // a 9 km dele: o plano vai para a barata; o de fora do mapa e o da encosta íngreme ficam na completa (a mata e a
  // pedra na projeção lateral)
  const c = { x: plano[0] + 9000, y: 300, z: plano[1] };
  r = dividirNos(nos.subarray(4), 3, c, mapa, 2000, perto, longe, P);
  assert.deepEqual(r, { perto: 2, longe: 1, medio: 0 });
  assert.deepEqual([...longe.subarray(0, 4)], [plano[0], plano[1], 128, 0]);
  assert.ok(INCL_ENCOSTA > 0.15 && INCL_ENCOSTA < 0.3);
  // o corte infinito (o passe da máscara) põe tudo perto
  r = dividirNos(nos, 4, c, mapa, Infinity, perto, longe, P);
  assert.equal(r.longe, 0);
});

test('LOD do sombreador: o chão por último entre os opacos e o céu depois dele, as duas malhas com o mesmo vértice', () => {
  assert.ok(ORDEM_TERRENO > 0, 'o terreno depois dos prédios e da água (ordem 0)');
  assert.ok(ORDEM_FUNDO > ORDEM_TERRENO, 'o céu depois do chão, no plano distante');
  const U = criarUniformes();
  assert.ok('uTerLonge' in U);
  const ganchos = { aplicar: (m) => m };
  const perto = criarMaterialTerreno(ganchos, U, { detalhe: true });
  const longe = criarMaterialTerreno(ganchos, U, { detalhe: true, longe: true });
  assert.ok('TER_DETALHE' in perto.defines && !('TER_LONGE' in perto.defines));
  assert.ok('TER_LONGE' in longe.defines && !('TER_DETALHE' in longe.defines), 'de longe sem as camadas de detalhe');
  assert.notEqual(perto.customProgramCacheKey(), longe.customProgramCacheKey());
  const sh = (m) => {
    const s = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    m.onBeforeCompile(s);
    return s;
  };
  const a = sh(perto);
  const b = sh(longe);
  assert.equal(a.vertexShader, b.vertexShader, 'o mesmo vértice (sem rachadura entre perto e longe)');
  assert.ok('uTerLonge' in a.uniforms && 'uTerLonge' in b.uniforms);
});

test('assado: o mapa de cor leva as manchas do campo (o chão de longe não as pinta por pixel) com o mesmo ruído do perto', () => {
  const f = GLSL_ASSAR.fragmento;
  assert.match(f, /vec4 m = terMistura\( e, true, mA, mB \);/);
  assert.match(f, /mA = texture\( uTerRuido, TER_ROT_A \* w \* \( 1\.0 \/ 23\.0 \) \+ vec2\( 0\.13, 0\.71 \) \)/);
  assert.match(GLSL_TER_FRAGMENTO.cor, /mA = textureGrad\( uTerRuido, TER_ROT_A \* tW \* \( 1\.0 \/ 23\.0 \) \+ vec2\( 0\.13, 0\.71 \)/);
  // de perto as manchas só na parte pintada pelas camadas (a do assado já as tem)
  assert.match(GLSL_TER_FRAGMENTO.cor, /tAlb \+= aPerto \* \( terManchas\( p, asf, tVeg, mA, mB \) - 1\.0 \) \* \( tPerto \* tMed \);/);
});

// ------------------------------------------------------------------------------------------------ PC3

/**
 * O corpo do fragmento do terreno de um dos três programas, com o pré-processador (os defines de cada malha): as
 * chamadas que cada um faz (as funções sem chamada o compilador tira).
 */
const programaTerreno = (defines) => preprocessar(`${defines.map((d) => `#define ${d}\n`).join('')}${GLSL_TER_FRAGMENTO.cor}`).texto;

test('PC3: três programas do chão, de perto com as camadas, do meio sem elas e de longe só o assado e o relevo assado', () => {
  const perto = programaTerreno(['TER_DETALHE']);
  const medio = programaTerreno([]);
  const longe = programaTerreno(['TER_LONGE', 'TER_RELEVO_ASSADO']);
  // de perto: as camadas do chão, as manchas por pixel e a escolha das duas camadas
  for (const t of ['terDetalhe( k1', 'terManchas( p, asf, tVeg, mA, mB )', 'terPesos( tE, p, asf, jar )']) assert.ok(perto.includes(t), `perto sem ${t}`);
  // o meio não carrega nada que dê peso zero fora do alcance do detalhe (as camadas, as manchas por pixel)
  for (const t of ['terDetalhe(', 'terManchas(', 'terCores(', 'uTerCamadas']) assert.ok(!medio.includes(t), `meio com ${t}`);
  // mas tem a mata nítida, os tufos, a pedra e o relevo das copas por pixel
  for (const t of ['tVeg = terVegetacao( tE, cVeg )', 'tufoV', 'granito', 'copaRelevo( terR2, terR3, terR1']) assert.ok(medio.includes(t), `meio sem ${t}`);
  // de longe: nem o ruído nem a vegetação por pixel; o relevo das copas vem do assado de relevo
  for (const t of ['terRuidosGrad', 'terVegetacao( tE', 'copaCor(', 'terAguaExata( tW )']) assert.ok(!longe.includes(t), `longe com ${t}`);
  assert.match(longe, /textureGrad\( uTerRelevo, tUVM/);
  assert.match(longe, /float tWAssado = max\( tWRel - kP, 0\.0 \) \* tFatorCopa;/);
  // o de perto não lê o assado de relevo: o pixel faz a parte dele (a mesma soma de pesos, kP + max( tWRel - kP, 0 ))
  assert.ok(!perto.includes('uTerRelevo') && !medio.includes('uTerRelevo'), 'relevo assado sem TER_RELEVO_ASSADO');
  assert.match(perto, /float tPesoCopa = max\( kP, tWRel \);/);
  assert.match(programaTerreno(['TER_RELEVO_ASSADO']), /float tPesoCopa = kP;/);
  // nenhum vetor local indexado por variável (no Direct3D vai para a memória temporária): as duas camadas de perto
  // saem de um laço desenrolado com índices fixos
  assert.ok(!/\b(?:c|p|TER_RUG|TER_RELEVO|TER_ESC|uTerGanho)\[ i[12] \]/.test(perto), 'índice variável no vetor das camadas');
  // a vegetação pintada sai uma vez por pixel (antes: no detalhe de perto e de novo na mata nítida)
  assert.equal((perto.match(/terVegetacao\( tE, cVeg \)/g) ?? []).length, 1);
  assert.ok(!perto.includes('terAcabamento( tE'), 'o detalhe reusa a vegetação (terAcabamentoV)');
});

test('PC3: os ramos caros do chão só rodam onde o peso deles não é zero (a mesma imagem)', () => {
  const cor = GLSL_TER_FRAGMENTO.cor;
  // os tufos (pixel até 1,4 m) e o relevo das copas (até 2,5 m) pelo tamanho do pixel
  assert.match(cor, /bool tComManchas = kP > 0\.0 && tPix < 1\.4;/);
  assert.match(cor, /float pertoV = \( 1\.0 - smoothstep\( 0\.4, 1\.4, tPix \) \)/);
  assert.match(cor, /if \( kP > 0\.0 && tPix < 2\.5 \) \{/);
  assert.match(cor, /tFatorCopa = tMed \* \( 1\.0 - smoothstep\( 0\.9, 2\.5, tPix \) \)/);
  // a água exata só perto da água (a distância satura em 254 m; longe dela a filtrada é a mesma)
  assert.match(cor, /if \( tDentro && tAgua\.x < 250\.0 \) tAgua = terAguaExata\( tW \);/);
  // a restinga, a mata ciliar e a encosta do mar zeram a 200 m da água: o ramo longe dela dá o mesmo
  const veg = GLSL_TER_CAMADAS.slice(GLSL_TER_CAMADAS.indexOf('float terVegetacao('));
  assert.match(veg, /bool pertoAgua = e\.agua < 200\.0;/);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let k = 0; k < 50; k++) {
    const r2x = hashF(k, 1, 7);
    const r3x = hashF(k, 2, 7);
    const lim = 16 + 30 * r2x + 10 * hashF(k, 3, 7);
    // restinga, ciliar, encosta e areal a 200 m da água
    assert.equal(1 - ss(lim + 40 + 45 * r2x, lim + 80 + 60 * r2x, 200), 0);
    assert.equal(1 - ss(22 + 20 * r3x, 40 + 30 * r3x, 200), 0);
    assert.equal(1 - ss(70, 170, 200), 0);
    assert.equal(1 - ss(25, 90, 200), 0);
  }
  // o costão, o fim da praia e a margem saem uma vez (terPreparar), não em cada função
  assert.equal((GLSL_TER_CAMADAS.match(/terCostaoBase\(/g) ?? []).length, 1);
});

test('PC3: o assado de 1 m do PC e o alcance do relevo das copas, o mesmo de antes', () => {
  const pc = PERFIL_TERRENO.alta; // o 'pc' herda do Alta (porPerfil)
  assert.equal(pc.cor, 8192, 'o PC assa o chão a 1 m por texel');
  const media = PERFIL_TERRENO.media; // sem o assado de relevo
  const ang = (2 * Math.tan(Math.PI / 9)) / 1001; // o PC do dono: 2070 x 1001, 40 graus
  const [l0, l1] = limitesLonge(pc, 8192, ang);
  // o caminho barato começa na metade da distância (texel de 1 m): na abertura do jogo (1,6 km) a tela inteira
  assert.ok(Math.abs(l0 - 825) < 3 && Math.abs(l1 - 1238) < 3, `${l0} ${l1}`);
  // o relevo das copas vai até onde ia com o assado de 2 m
  const [r0, r1] = alcanceRelevo(pc, 8192, ang);
  const [a0, a1] = limitesLonge({ ...pc, cor: LADO_ALCANCE_RELEVO }, 8192, ang);
  assert.deepEqual([r0, r1], [a0, a1]);
  assert.ok(Math.abs(r0 - 1651) < 5 && Math.abs(r1 - 2477) < 5);
  // no Média (sem o assado de relevo) o alcance é o próprio caminho completo: o peso do relevo assado fica zero
  assert.deepEqual(alcanceRelevo(media, 8192, ang), limitesLonge(media, 8192, ang));
  // a memória: 8.192² em RGB565 e o relevo em R8, com os mipmaps (256 MiB); o Média segue com 21,3
  assert.ok(Math.abs(memoriaAssadoMB(pc) - 256) < 0.1, `${memoriaAssadoMB(pc)}`);
  assert.ok(Math.abs(memoriaAssadoMB(media) - 21.33) < 0.05);
  // a soma dos pesos do relevo das copas (por pixel e assado) é a de antes: kP + max(antes - kP, 0)
  for (const d of [300, 900, 1200, 1700, 2100, 2400, 3000]) {
    const kP = pesoCompleto(d, [l0, l1]);
    const antes = pesoCompleto(d, [r0, r1]);
    assert.ok(Math.abs(kP + Math.max(antes - kP, 0) - antes) < 1e-9, `${d} m`);
  }
  // a encosta de uns 37 a 57 graus (1 - normal y de 0,2 a 0,45) de longe fica com o assado de 1 m (só as paredes no
  // caminho completo)
  assert.equal(inclEncosta(pc), 0.45);
  assert.equal(inclEncosta(media), INCL_ENCOSTA);
  // o assado de relevo: a mesma altura das copas grandes e a mesma cobertura do fragmento, na escala do R8
  const f = GLSL_ASSAR_RELEVO.fragmento;
  assert.match(f, /copaRelevo\( terR2, terR3, terR1, 0\.0 \) \* cob \/ 4\.0/);
  assert.match(f, /max\( terCopa\( e\.mata \) \* \( 1\.0 - smoothstep\( 0\.35, 0\.8, terCst \) \) \* \( 1\.0 - terParedao\( 1\.0 - e\.n\.y, terR3\.x \) \), veg \* 0\.8 \)/);
  assert.match(GLSL_TER_FRAGMENTO.cor, /max\( terCopa\( tE\.mata \) \* \( 1\.0 - smoothstep\( 0\.35, 0\.8, tCostaoP \) \) \* \( 1\.0 - tParedao \), tVeg \* 0\.8 \)/);
  assert.equal(TER_RELEVO_MAX, 4);
  // a maior altura das copas grandes cabe: 2,6 x 1,4
  assert.ok(2.6 * 1.4 <= TER_RELEVO_MAX);
});

test('PC3: a luz do ambiente do chão pelo atlas é a mesma conta do textureCubeUV do three', () => {
  // os mips do PMREM (roughnessToMip do three) nos trechos de 1 a 0,4, contados do nível 0 do atlas (mip -2)
  const mipThree = (r) => (r >= 0.8 ? ((1 - r) * (-1 - -2)) / (1 - 0.8) + -2 : ((0.8 - r) * (2 - -1)) / (0.8 - 0.4) + -1);
  const nivel = (r) => Math.min(AMB_NIVEIS - 1, Math.max(0, r >= 0.8 ? (1 - r) * 5 : (0.8 - r) * 7.5 + 1));
  for (let r = 0.4; r <= 1.0001; r += 0.01) assert.ok(Math.abs(nivel(r) - (mipThree(r) + 2)) < 1e-9, `rugosidade ${r}`);
  assert.match(GLSL_AMB_CHAO.pars, /r >= 0\.8 \? \( 1\.0 - r \) \* 5\.0 : \( 0\.8 - r \) \* 7\.5 \+ 1\.0/);
  // irradiância: pi vezes o mip -2 (nível 0); reflexão: dois níveis vizinhos misturados pela fração do mip
  assert.match(GLSL_AMB_CHAO.luz, /iblIrradiance \+= 3\.141592653589793 \* terAmb\(/);
  assert.match(GLSL_AMB_CHAO.luz, /radiance \+= mix\( terAmb\( tRefl, tN0 \), terAmb\( tRefl, min\( tN0 \+ 1\.0/);
  // o passe lê o cubo UV pela mesma função do three, nos mips -2 a 2
  assert.match(GLSL_AMB_PASSE.fragmento, /bilinearCubeUV\( envMap, envMapRotation \* terOctDir\( o \), nivel - 2\.0 \) \* envMapIntensity/);
  // os defines do cubo UV como o generateCubeUVSize do three (PMREM de 128: 384 x 512)
  const d = definesCuboUV(512);
  assert.equal(d.CUBEUV_TEXEL_HEIGHT, 1 / 512);
  assert.equal(d.CUBEUV_TEXEL_WIDTH, 1 / 384);
  assert.equal(d.CUBEUV_MAX_MIP, '7.0');
  // o octaedro (y para cima no centro) volta à mesma direção: a conta do GLSL em JavaScript
  const sinal = (v) => (v >= 0 ? 1 : -1);
  const oct = ([x, y, z]) => {
    const l = Math.abs(x) + Math.abs(y) + Math.abs(z);
    let p = [x / l, z / l];
    if (y < 0) p = [(1 - Math.abs(p[1])) * sinal(p[0]), (1 - Math.abs(p[0])) * sinal(p[1])];
    return [p[0] * 0.5 + 0.5, p[1] * 0.5 + 0.5];
  };
  const dir = ([u, v]) => {
    const p = [u * 2 - 1, v * 2 - 1];
    const d3 = [p[0], 1 - Math.abs(p[0]) - Math.abs(p[1]), p[1]];
    if (d3[1] < 0) [d3[0], d3[2]] = [(1 - Math.abs(d3[2])) * sinal(d3[0]), (1 - Math.abs(d3[0])) * sinal(d3[2])];
    const l = Math.hypot(...d3);
    return d3.map((c) => c / l);
  };
  for (let k = 0; k < 200; k++) {
    const a = hashF(k, 4, 9) * 2 * Math.PI;
    const y = hashF(k, 5, 9) * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    const d0 = [r * Math.cos(a), y, r * Math.sin(a)];
    const d1 = dir(oct(d0));
    assert.ok(Math.hypot(d1[0] - d0[0], d1[1] - d0[1], d1[2] - d0[2]) < 1e-9, `direção ${d0}`);
  }
  // o atlas: um ladrilho por nível, o centro do texel nas bordas (o passe e o chão leem igual)
  assert.equal(AMB_NIVEIS, 5);
  assert.ok(AMB_LADO >= 32);
  assert.match(GLSL_AMB_CHAO.pars, new RegExp(`terOct\\( d \\) \\* ${AMB_LADO - 1}\\.0 \\+ 0\\.5 \\) / ${AMB_LADO}\\.0`));
});

test('PC3: a malha do meio da frente para trás e o material do meio segue o de perto (a pintura da via, R3a)', () => {
  const T = espelhoSintetico().terreno;
  const dados = prepararDados(T, espelhoSintetico().floresta, distanciaAgua(T.agua, T.n));
  const P = piramideAlturas(T, dados);
  const mapa = { ox: T.origem[0], oz: T.origem[1], lado: T.passo * (T.n - 1) };
  // nós planos em fila, do mais longe ao mais perto da câmera: saem na ordem da distância, e cada um na malha do
  // seu alcance (perto do detalhe, no meio e de longe)
  let plano = null;
  for (let bj = 0; bj < P.niveis[0].lado && !plano; bj++) {
    for (let bi = 0; bi < P.niveis[0].lado - 40; bi++) {
      let ok = true;
      for (let q = 0; q < 40 && ok; q++) ok = P.niveis[0].incl[bj * P.niveis[0].lado + bi + q] < 0.15;
      if (ok) {
        plano = [mapa.ox + bi * P.bloco, mapa.oz + bj * P.bloco];
        break;
      }
    }
  }
  assert.ok(plano, 'uma fila de blocos planos na cidade sintética');
  const xs = [30, 12, 4, 0, 20, 2];
  const nos = new Float32Array(xs.flatMap((k) => [plano[0] + k * 128, plano[1], 128, 0]));
  const cam = { x: plano[0] + 64, y: 300, z: plano[1] + 64 };
  const perto = new Float32Array(32);
  const medio = new Float32Array(32);
  const longe = new Float32Array(32);
  const r = dividirNos(nos, xs.length, cam, mapa, 2000, perto, longe, P, 400, medio);
  // perto: 0 e 2 (a menos de 400 m); meio: 4 e 12 (até 2 km); longe: 20 e 30
  assert.deepEqual(r, { perto: 2, longe: 2, medio: 2 });
  const ordem = (saida, n) => Array.from({ length: n }, (_, k) => Math.round((saida[4 * k] - plano[0]) / 128));
  assert.deepEqual(ordem(perto, 2), [0, 2]);
  assert.deepEqual(ordem(medio, 2), [4, 12]);
  assert.deepEqual(ordem(longe, 2), [20, 30]);
  // o material do meio: os mesmos trechos do de perto (com o que outro domínio pendurou nele depois), sem o detalhe
  const U = criarUniformes();
  const ganchos = { aplicar: (m) => m };
  const mestre = criarMaterialTerreno(ganchos, U, { detalhe: true });
  const meio = criarMaterialTerreno(ganchos, U, { detalhe: false, mestre });
  assert.ok(!('TER_DETALHE' in meio.defines) && 'TER_DETALHE' in mestre.defines);
  const antes = mestre.onBeforeCompile;
  mestre.onBeforeCompile = (sh, rz) => {
    antes.call(mestre, sh, rz);
    sh.fragmentShader += '\n// gancho de outro domínio';
  };
  const chave = mestre.customProgramCacheKey.bind(mestre);
  mestre.customProgramCacheKey = () => `${chave()}|outro`;
  mestre.needsUpdate = true;
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  meio.onBeforeCompile(sh);
  assert.ok(sh.fragmentShader.includes('gancho de outro domínio'), 'o meio segue o onBeforeCompile do mestre');
  assert.ok(meio.customProgramCacheKey().includes('|outro') && meio.customProgramCacheKey() !== mestre.customProgramCacheKey());
  // o mestre mudou depois: o meio refaz o programa uma vez
  const v0 = meio.version;
  assert.equal(seguirVersao(meio), true);
  assert.ok(meio.version > v0);
  assert.equal(seguirVersao(meio), false);
  // no Leve (sem as camadas do chão) o meio tem os mesmos defines do de perto: a mesma chave, o mesmo programa
  const mestreLeve = criarMaterialTerreno(ganchos, U, { detalhe: false });
  const meioLeve = criarMaterialTerreno(ganchos, U, { detalhe: false, mestre: mestreLeve });
  assert.equal(meioLeve.customProgramCacheKey(), mestreLeve.customProgramCacheKey());
  // com o assado de relevo só no meio (o 'pc' sem as camadas, se um dia), a chave volta a ser outra
  const meioRel = criarMaterialTerreno(ganchos, U, { detalhe: false, mestre: mestreLeve, relevo: true });
  assert.notEqual(meioRel.customProgramCacheKey(), mestreLeve.customProgramCacheKey());
  // a luz do ambiente pelo atlas e o relevo assado entram nos três
  for (const m of [mestre, meio, criarMaterialTerreno(ganchos, U, { longe: true })]) {
    const s2 = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    m.onBeforeCompile(s2);
    assert.ok(!s2.fragmentShader.includes('#include <lights_fragment_maps>') && s2.fragmentShader.includes('terAmb('), m.name);
    assert.ok('uTerAmb' in s2.uniforms && 'uTerRelevo' in s2.uniforms, m.name);
  }
});

test('PC3: os programas do chão não passam os amostradores de antes (a guarda do Mali, 12 por estágio)', () => {
  // o fragmento do chão com os trechos do three resolvidos (sem os ganchos, que somam o mesmo nos três): antes do PC3,
  // 8 no de perto e 7 no de longe; com os ganchos, 12 e 11 no navegador
  const resolver = (t) => t.replace(/^[ \t]*#include +<([\w./]+)>/gm, (_, n) => resolver(THREE.ShaderChunk[n] ?? ''));
  const U = criarUniformes();
  const ganchos = { aplicar: (m) => m };
  const contar = (op) => {
    const m = criarMaterialTerreno(ganchos, U, op);
    const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
    m.onBeforeCompile(sh);
    const defs = { ...m.defines, USE_ENVMAP: '', ENVMAP_TYPE_CUBE_UV: '', CUBEUV_TEXEL_WIDTH: '0.0', CUBEUV_TEXEL_HEIGHT: '0.0', CUBEUV_MAX_MIP: '8.0' };
    const pre = Object.entries(defs).map(([k, v]) => `#define ${k} ${v}`).join('\n');
    const c = contarPrograma(`${pre}\n${resolver(sh.vertexShader)}`, `${pre}\n${resolver(sh.fragmentShader)}`);
    return { m, sh, f: c.amostradores.f };
  };
  const perto = contar({ detalhe: true, relevo: true });
  assert.ok(!('TER_RELEVO_ASSADO' in perto.m.defines), 'o de perto sem o assado de relevo');
  assert.ok(perto.f <= 8, `perto: ${perto.f}`);
  assert.ok(!/uniform\s+sampler2D\s+envMap/.test(resolver(perto.sh.fragmentShader)), 'o envMap do three sem uso sai');
  for (const op of [{ detalhe: false, relevo: true }, { longe: true, relevo: true }]) {
    const r = contar(op);
    assert.ok('TER_RELEVO_ASSADO' in r.m.defines, r.m.name);
    assert.ok(r.f <= 8, `${r.m.name}: ${r.f}`);
  }
  // sem o assado de relevo (o Média, o celular): os de antes
  for (const op of [{ detalhe: false }, { longe: true }]) assert.ok(contar(op).f <= 7, JSON.stringify(op));
});

test('PC3: a divisão dos nós mede em 3D, como o sombreador (a câmera alta manda o chão da frente para a malha barata)', () => {
  const T = espelhoSintetico().terreno;
  const dados = prepararDados(T, espelhoSintetico().floresta, distanciaAgua(T.agua, T.n));
  const P = piramideAlturas(T, dados);
  const mapa = { ox: T.origem[0], oz: T.origem[1], lado: T.passo * (T.n - 1) };
  // um bloco plano dentro do mapa
  let no = null;
  for (let bj = 0; bj < P.niveis[0].lado && !no; bj++) {
    for (let bi = 0; bi < P.niveis[0].lado && !no; bi++) {
      if (P.niveis[0].incl[bj * P.niveis[0].lado + bi] < 0.1) no = [mapa.ox + bi * P.bloco, mapa.oz + bj * P.bloco];
    }
  }
  assert.ok(no, 'um bloco plano na cidade sintética');
  const [, topo] = limitesAltura(P, no[0], no[1], no[0] + 128, no[1] + 128, true);
  const nos = new Float32Array([no[0], no[1], 128, 0]);
  const saidas = () => [new Float32Array(4), new Float32Array(4), new Float32Array(4)];
  // a 900 m no chão e 1.300 m acima do topo (a vista do jogo): o ponto mais perto fica a ~1.581 m em 3D, além do
  // corte de 1.238 m; medido só no chão (900 m) ia para a do meio, com o peso do caminho completo zero em todo pixel
  const alto = { x: no[0] + 128 + 900, y: topo + 1300, z: no[1] + 64 };
  let [pe, lo, me] = saidas();
  assert.deepEqual(dividirNos(nos, 1, alto, mapa, 1238, pe, lo, P, 400, me, 0.45), { perto: 0, longe: 1, medio: 0 });
  // a mesma posição no chão, com a câmera baixa: fica na do meio (o sombreador ainda desenha o caminho completo)
  [pe, lo, me] = saidas();
  assert.deepEqual(dividirNos(nos, 1, { ...alto, y: topo + 20 }, mapa, 1238, pe, lo, P, 400, me, 0.45), { perto: 0, longe: 0, medio: 1 });
  // e o detalhe pela mesma conta: em cima do nó a 300 m de altura fica perto; a 500 m, o detalhe (400 m) já é zero
  const sobre = { x: no[0] + 64, z: no[1] + 64 };
  [pe, lo, me] = saidas();
  assert.deepEqual(dividirNos(nos, 1, { ...sobre, y: topo + 300 }, mapa, 1238, pe, lo, P, 400, me, 0.45), { perto: 1, longe: 0, medio: 0 });
  [pe, lo, me] = saidas();
  assert.deepEqual(dividirNos(nos, 1, { ...sobre, y: topo + 500 }, mapa, 1238, pe, lo, P, 400, me, 0.45), { perto: 0, longe: 0, medio: 1 });
  // a câmera abaixo do nó (num vale olhando o morro) não conta a altura: o chão desenhado pode descer abaixo do
  // mínimo da pirâmide perto d'água, então só a distância no chão (conservadora)
  [pe, lo, me] = saidas();
  assert.deepEqual(dividirNos(nos, 1, { ...sobre, y: -5000 }, mapa, 1238, pe, lo, P, 400, me, 0.45), { perto: 1, longe: 0, medio: 0 });
  // o sombreador mede a distância do chão (sem a copa) até a câmera: nunca menos que a conta da divisão
  for (const y of [topo + 50, topo + 400, topo + 1300]) {
    const cam = { ...alto, y };
    const dx = cam.x - (no[0] + 128);
    const limite = Math.hypot(dx, Math.max(0, y - topo));
    for (let k = 0; k < 20; k++) {
      const px = no[0] + 128 * hashF(k, 1, 3);
      const pz = no[1] + 128 * hashF(k, 2, 3);
      const h = alturaComoGLSL(T, px, pz);
      assert.ok(h <= topo + 1e-3, 'o chão do nó abaixo do topo da pirâmide');
      assert.ok(Math.hypot(cam.x - px, cam.y - h, cam.z - pz) >= limite - 1e-6);
    }
  }
});

test('PC3: o assado de 8.192² só com a placa que aceita a textura (MAX_TEXTURE_SIZE)', () => {
  const pc = PERFIL_TERRENO.alta;
  assert.equal(limitarAssado(pc, 16384), pc);
  assert.equal(limitarAssado(pc, 8192), pc);
  assert.equal(limitarAssado(pc, undefined), pc);
  // numa placa de 4.096 o mapa de cor volta aos 2 m por texel, sem o assado de relevo e com a encosta de antes
  const p4 = limitarAssado(pc, 4096);
  assert.deepEqual([p4.cor, p4.relevo, inclEncosta(p4)], [4096, 0, INCL_ENCOSTA]);
  assert.ok(Math.abs(memoriaAssadoMB(p4) - 42.67) < 0.05);
  assert.deepEqual(alcanceRelevo(p4, 8192, 0.001), limitesLonge(p4, 8192, 0.001));
  // o Média (2.048) cabe em qualquer placa WebGL2
  assert.equal(limitarAssado(PERFIL_TERRENO.media, 2048), PERFIL_TERRENO.media);
});

// ------------------------------------------------------------------------------------------------ a sede (VIS1c)

/** Chão plano em volta da sede (a gleba a 12 m), a grade da floresta e o espelho dela, sem nada pronto. */
function chaoDaSede() {
  const [cx, cz] = SEDE_CENTRO;
  const n = 257;
  const passo = 8;
  const origem = [cx - 1024, cz - 1024];
  const T = { n, passo, origem, altura: new Float32Array(n * n).fill(12), agua: new Uint8Array(n * n).fill(AGUA.TERRA) };
  const F = { n: 256, passo, origem, dens: new Uint8Array(256 * 256) };
  return { esp: { terreno: T, floresta: F, arcologia: { plano: PLANO_PADRAO, etapas: [] } }, mapa: { ox: origem[0], oz: origem[1], lado: passo * (n - 1) } };
}

/** Pinta a mata do parque na grade como a S1a e as cenas (render/cenas/torre.js, pintarMataDaSede). */
function pintarParque(F) {
  for (let j = 0; j < F.n; j++) {
    for (let i = 0; i < F.n; i++) {
      const d = mataDaSede(F.origem[0] + (i + 0.5) * F.passo, F.origem[1] + (j + 0.5) * F.passo);
      if (d !== null) F.dens[j * F.n + i] = Math.round(d * 255);
    }
  }
}

test('VIS1c: mataDaSede devolve 0 nos gramados e nas clareiras, e a mata dos bosques segue', () => {
  const [cx, cz] = SEDE_CENTRO;
  let gramados = 0;
  let mata = 0;
  for (let r = PRACA.r1 + 10; r < MERIDIAN.raio - 40; r += 7) {
    for (let a = 0; a < 360; a += 3) {
      const v = mataDaSede(cx + r * Math.cos((a * Math.PI) / 180), cz + r * Math.sin((a * Math.PI) / 180));
      assert.ok(v === 0 || v >= 0.8, `no parque, ${v} a ${r} m e ${a} graus: ou gramado (0) ou mata`);
      if (v === 0) gramados++;
      else mata++;
    }
  }
  assert.ok(gramados > 0 && mata > 0);
  // o caminho em anel de 290 m e as clareiras das torres do bosque
  assert.equal(mataDaSede(cx + 290, cz + 3), 0);
  assert.ok(mataDaSede(cx + 107, cz) > 0.9, 'o anel de floresta');
});

test('VIS1c: a sede no uso do solo (as partes prontas; com o parque, gramado onde a grade não tem mata)', () => {
  const { esp, mapa } = chaoDaSede();
  const plano = PLANOS[PLANO_PADRAO];
  const [cx, cz] = SEDE_CENTRO;
  // nada pronto: a sede não mexe no chão
  assert.equal(partesDaSedeNoChao(esp).size, 0);
  assert.equal(parquePintado(esp.floresta), false);
  assert.equal(usoDaSede(plano, cx + 130, cz, new Set()), null);
  // as partes prontas pela mesma regra do render (partesProntas), com os trechos do Horizon Ring
  const etapas = [
    { id: 'torre.e4', estado: ETAPA.PRONTA }, { id: 'lago.e1', estado: ETAPA.PRONTA }, { id: 'meridian.e1', estado: ETAPA.PRONTA },
    { id: 'meridian.e2', estado: ETAPA.EM_OBRA }, { id: 'horizon.3.e1', estado: ETAPA.PRONTA }, { id: 'codex.e1', estado: ETAPA.PRONTA },
  ];
  const comEtapas = { ...esp, arcologia: { plano: PLANO_PADRAO, etapas } };
  assert.deepEqual([...partesDaSedeNoChao(comEtapas)].sort(), [...partesProntas(comEtapas)].sort());
  const P = partesDaSedeNoChao(comEtapas);
  const ponto = (r, graus) => [cx + r * Math.cos((graus * Math.PI) / 180), cz + r * Math.sin((graus * Math.PI) / 180)];
  const uso = (r, graus, partes, mata = 0) => usoDaSede(plano, ...ponto(r, graus), partes, mata);
  assert.deepEqual(uso(40, 10, P), [0, 1, 0, 0], 'o pódio com a torre pronta');
  assert.deepEqual(uso(92, 10, P), [0, 1, 0, 0], 'o leito do lago');
  assert.deepEqual(uso(130, 10, P), [0, 1, 0, 0], 'a praça com o lago');
  assert.equal(uso(MERIDIAN.raio, 10, P), null, 'o Meridian Ring ainda em obra');
  assert.deepEqual(uso(729, 100, P), [0, 1, 0, 0], 'o trecho III do Horizon Ring (de 90 a 135 graus)');
  assert.equal(uso(729, 10, P), null, 'o trecho I, ainda não');
  assert.equal(uso(250, 10, P), null, 'sem o parque o jardim fica com o chão de antes');
  // as vias internas (o anel viário, os portões e as avenidas) com o lago pronto, como a X1b liga no grafo: nas cenas
  // as vias do plano são desenhadas sem o grafo, e sem isto o pasto e as moitas saíam no meio delas
  assert.deepEqual(uso(300, 45, P), [0, 1, 0, 0], 'a avenida de 45 graus');
  assert.deepEqual(uso(300 / Math.cos((2 * Math.PI) / 180), 47, P), [0, 1, 0, 0], 'a 10 m do eixo da avenida');
  assert.equal(uso(300, 50, P), null, 'a 26 m do eixo, fora da avenida');
  assert.deepEqual(uso(795, 100, P), [0, 1, 0, 0], 'o anel viário');
  assert.deepEqual(uso(805, 270, P), [0, 1, 0, 0], 'o portão norte');
  assert.equal(uso(300, 45, new Set(['torre'])), null, 'sem o lago as vias internas ainda não existem');
  // com o parque (a mata dele pintada na grade): gramado onde a grade não tem mata; a mata fica com a copa pintada
  pintarParque(esp.floresta);
  assert.equal(parquePintado(esp.floresta), true);
  const comParque = partesDaSedeNoChao(esp);
  assert.deepEqual([...comParque], ['parque']);
  assert.notEqual(chaveDaSede(esp), '');
  assert.deepEqual(uso(130, 10, comParque), [0, 1, 0, 0], 'a praça do pódio');
  assert.deepEqual(uso(250, 10, comParque, 0), [0, 0, 0, 1], 'gramado');
  assert.equal(uso(107, 10, comParque, 0.92), null, 'o anel de floresta fica com a mata');
  assert.equal(uso(590, 10, comParque, MATA_DA_SEDE + 0.1), null, 'a mata do bosque');
  assert.equal(usoDaSede(plano, cx + GLEBA_ENVELOPE.raio + 5, cz, comParque, 0), null, 'fora do disco');
  // a grade com outra mata (a natural de antes) não conta como o parque pintado
  const outra = { ...esp.floresta, dens: esp.floresta.dens.map((v) => (v > 150 ? 255 : v)) };
  assert.equal(parquePintado(outra), false);
});

test('VIS1c: nada de moita nem árvore solta nas praças e nos gramados da sede; a mata do parque segue', () => {
  const { esp, mapa } = chaoDaSede();
  pintarParque(esp.floresta);
  const T = esp.terreno;
  const dados = prepararDados(T, esp.floresta, distanciaAgua(T.agua, T.n));
  // um ruído que pinta moita e árvore solta no pasto (o da GPU é lido de volta no jogo)
  const nr = 64;
  const ruido = new Uint8Array(nr * nr * 4);
  for (let k = 0; k < nr * nr * 4; k++) ruido[k] = Math.floor(hashF(k, 3, 91) * 255);
  const lado = 512; // 4 m
  // a mata da grade na célula do ponto (a que o uso do solo lê): a moita na borda de um maciço é da mata, não do gramado
  const F = esp.floresta;
  const mataNaCelula = (x, z) => F.dens[Math.floor((z - F.origem[1]) / F.passo) * F.n + Math.floor((x - F.origem[0]) / F.passo)] / 255;
  const contar = (buf) => {
    const A = { T, dados, uso: buf, ladoUso: lado, mapa, ruido, ladoRuido: nr };
    const n = { gramado: 0, mata: 0 };
    const [cx, cz] = SEDE_CENTRO;
    // uma faixa de oeste a leste pelo centro: o parque, o anel de floresta, a praça, os anéis e os bosques
    for (let x0 = Math.floor((cx - 800) / LADRILHO) * LADRILHO; x0 < cx + 800; x0 += LADRILHO) {
      const L = gerarLadrilho(A, x0, Math.floor(cz / LADRILHO) * LADRILHO);
      for (const l of [L.arvores, L.moitas]) {
        for (let o = 0; o < l.length; o += PASSO_ARVORE) {
          // (a borda do disco fica de fora: o texel de 4 m do uso do solo cruza a borda)
          if (mataDaSede(l[o], l[o + 2]) === null || Math.hypot(l[o] - cx, l[o + 2] - cz) > GLEBA_ENVELOPE.raio - 4) continue;
          if (mataNaCelula(l[o], l[o + 2]) >= MATA_DA_SEDE) n.mata++;
          else n.gramado++;
        }
      }
    }
    return n;
  };
  // sem a sede no uso do solo, o pasto pintava moitas e árvores soltas nos gramados (o defeito)
  const antes = contar(new Uint8Array(lado * lado * 4));
  assert.ok(antes.gramado > 0, `antes: ${antes.gramado} no gramado`);
  const buf = new Uint8Array(lado * lado * 4);
  rasterizarUso(esp, buf, lado, mapa);
  const depois = contar(buf);
  assert.equal(depois.gramado, 0, 'nenhuma moita nem árvore solta nos gramados, nas praças e nos caminhos');
  assert.ok(depois.mata > 10, `a mata do parque com ${depois.mata} árvores`);
  // refazer só um pedaço dá o mesmo que refazer tudo
  const pedaco = Uint8Array.from(buf);
  pedaco.fill(7, 0, 4 * lado * 200);
  rasterizarUso(esp, pedaco, lado, mapa, [mapa.ox, mapa.oz, mapa.ox + mapa.lado, mapa.oz + 200 * 4 - 1]);
  assert.deepEqual(pedaco, buf);
});

test('VIS1d: o chão lê a luz do ambiente com o fator do sol baixo (cena.environmentIntensity), como a água e as fachadas', () => {
  const U = { uTerAmb: { value: null } };
  const amb = new AmbienteChao(U);
  const env = new THREE.Texture();
  env.mapping = THREE.CubeUVReflectionMapping;
  env.image = { width: 384, height: 512 };
  const cena = new THREE.Scene();
  cena.environment = env;
  const desenhos = [];
  const renderer = { getRenderTarget: () => null, setRenderTarget() {}, render: (c) => desenhos.push(c) };
  for (const k of [1, 0.42, 0.7]) {
    cena.environmentIntensity = k;
    assert.equal(amb.passe(renderer, cena), true);
    assert.equal(amb.mat.uniforms.envMapIntensity.value, k, `atlas com o fator ${k}`);
  }
  assert.equal(desenhos.length, 3, 'refeito a cada quadro: o fator muda sem esperar o PMREM');
  assert.match(GLSL_AMB_PASSE.fragmento, /\* envMapIntensity/);
  amb.alvo.dispose();
  amb.mat.dispose();
});
