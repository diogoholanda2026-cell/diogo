// Testes da vegetação, do rio e do mundo de fora (R2b): as espécies com silhueta própria (palmeira-imperial, oiti, a
// mata com a embaúba e a moita) nos dois LODs dentro dos tetos, cor real sem verde-limão, a copa que não é bola; a
// rede de copas igual à da GPU (o hash bit a bit) e a pintura da vegetação do chão; o atlas de impostores e a escolha
// das vistas; os LODs pelos tetos; os ladrilhos da cidade sintética; o rio que corre (coordenadas e sentido); o anel
// do mundo de fora; o assado de 16 bits e os ajustes do terreno de longe.
// Roda sozinho: node ferramentas/testes/geracao-arvores.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  ESPECIES, ESPECIE, N_ESPECIES, CELULA, TETO_TRIS, gerarArvore, gerarTodas, gerarParaOficina, hashGPU, copaDaCelula,
  copasNoRetangulo, valorCopas, vegetacaoPintada, arvoreDaCopa, moitaDaCopa, alturaDossel, REDES_COPA, SUBREDES,
} from '../../fonte/render/geracao/arvores.js';
import { QUADROS, AZIMUTES, ANEIS, direcaoDoQuadro, quadrosDaVista, dispor, celulaDoQuadro, cameraDoQuadro } from '../../fonte/render/geracao/impostor.js';
import {
  GLSL_GERAR_FOLHAS, GLSL_ARVORE, GLSL_ARV_SOMBRA, GLSL_IMP_ASSAR, GLSL_IMPOSTOR, GLSL_IMP_QUADROS, LADO_FOLHAS, CORES_COPA,
} from '../../fonte/render/materiais/shaders/folha.glsl.js';
import { escolherLods, esmaecer, matrizArvore, gerarLadrilho, plantaveis, PERFIL_VEGETACAO, PASSO_ARVORE, LADRILHO } from '../../fonte/render/mundo/vegetacao.js';
import { terraPorDirecao, geometriaFora, alturaFora, sementeFora, ANEL_FORA } from '../../fonte/render/mundo/fora.js';
import { geometriaAgua, sentidoDoRio } from '../../fonte/render/mundo/agua.js';
import { GLSL_AGUA_FRAGMENTO, AGUAS, RIO } from '../../fonte/render/materiais/shaders/agua.glsl.js';
import { prepararDados, distanciaAgua, criarUniformes, memoriaAssadoMB, PERFIL_TERRENO } from '../../fonte/render/mundo/terreno.js';
import { GLSL_TER_VERTICE, GLSL_TER_FRAGMENTO, GLSL_ASSAR, GLSL_TER_CAMADAS } from '../../fonte/render/materiais/shaders/terreno.glsl.js';
import { criarDespachante } from '../../fonte/render/mundo/oficina.worker.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { gerarCidadeSintetica, SINTETICA } from '../cidade-sintetica.mjs';

let sintetica = null;
function espelhoSintetico() {
  if (!sintetica) {
    const sim = criarSimulacao({ semente: SINTETICA.semente, dominios: false });
    gerarCidadeSintetica({ sim });
    sintetica = sim.espelho;
  }
  return sintetica;
}

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

// ------------------------------------------------------------------------------------------------ espécies

test('espécies: as três do M1 (palmeira-imperial, oiti, mata com embaúba) e a moita, nos dois LODs', () => {
  const ids = ESPECIES.map((e) => e.id);
  for (const id of ['palmeira', 'oiti', 'mata1', 'mata2', 'mata3', 'embauba', 'moita']) assert.ok(ids.includes(id), `falta ${id}`);
  assert.equal(N_ESPECIES, ids.length);
  for (let e = 0; e < N_ESPECIES; e++) {
    const m0 = gerarArvore(e, 0);
    const m1 = gerarArvore(e, 1);
    const teto0 = ESPECIES[e].id === 'palmeira' ? TETO_TRIS.lod0.palmeira : TETO_TRIS.lod0.outras;
    assert.ok(m0.tris <= teto0, `${ESPECIES[e].id} LOD0 com ${m0.tris} triângulos`);
    assert.ok(m1.tris <= TETO_TRIS.lod1, `${ESPECIES[e].id} LOD1 com ${m1.tris} triângulos`);
    assert.ok(m1.tris < m0.tris / 2.5, `${ESPECIES[e].id}: o LOD1 não reduz`);
    // a silhueta do LOD1 fica perto da do LOD0 (a troca não salta)
    assert.ok(Math.abs(m1.medidas.altura / m0.medidas.altura - 1) < 0.12, `${ESPECIES[e].id}: altura do LOD1`);
    assert.ok(Math.abs(m1.medidas.raioH / m0.medidas.raioH - 1) < 0.2, `${ESPECIES[e].id}: largura do LOD1`);
    // atributos coerentes
    const a = m0.atributos;
    const nv = a.posicao.length / 3;
    assert.equal(a.normal.length, nv * 3);
    assert.equal(a.uv.length, nv * 2);
    assert.equal(a.cor.length, nv * 3);
    assert.equal(a.arv.length, nv * 2);
    for (let k = 0; k < m0.indices.length; k++) assert.ok(m0.indices[k] < nv);
    for (let v = 0; v < nv; v++) {
      const cel = a.arv[2 * v];
      assert.ok(Number.isInteger(cel) && cel >= 0 && cel <= 7, 'célula do atlas');
      assert.ok(a.arv[2 * v + 1] >= 0 && a.arv[2 * v + 1] <= 1, 'peso do vento');
      // as folhas ficam na célula (uv 0 a 1); a casca repete
      if (cel !== CELULA.casca) assert.ok(a.uv[2 * v] >= 0 && a.uv[2 * v] <= 1 && a.uv[2 * v + 1] >= 0 && a.uv[2 * v + 1] <= 1);
      assert.ok(Number.isFinite(a.posicao[3 * v]) && Number.isFinite(a.normal[3 * v + 1]));
    }
  }
});

test('espécies: determinístico pela semente, e a semente muda o desenho', () => {
  const a = gerarArvore('mata2', 0, 3);
  const b = gerarArvore('mata2', 0, 3);
  const c = gerarArvore('mata2', 0, 4);
  assert.deepEqual(a.atributos.posicao, b.atributos.posicao);
  assert.notDeepEqual(a.atributos.posicao, c.atributos.posicao);
});

/** Raio das folhas por setor de azimute (só cartas da copa) e a variação entre setores. */
function perfilDaCopa(m, setores = 16) {
  const a = m.atributos;
  const r = new Float64Array(setores);
  for (let v = 0; v < a.posicao.length / 3; v++) {
    if (a.arv[2 * v] === CELULA.casca) continue;
    const x = a.posicao[3 * v];
    const z = a.posicao[3 * v + 2];
    const s = Math.floor(((Math.atan2(z, x) / (2 * Math.PI) + 1) % 1) * setores);
    r[s] = Math.max(r[s], Math.hypot(x, z));
  }
  const media = r.reduce((p, q) => p + q, 0) / setores;
  return { max: Math.max(...r), min: Math.min(...r), media };
}

test('silhueta real: a copa folhosa é recortada (lóbulos), não uma bola; a palmeira abre as palmas', () => {
  for (const id of ['oiti', 'mata1', 'mata2', 'mata3']) {
    const p = perfilDaCopa(gerarArvore(id, 0));
    assert.ok(p.max / p.min > 1.15, `${id}: copa redonda demais (${(p.max / p.min).toFixed(2)})`);
  }
  // o oiti e a mata 2 abrem mais que a altura da copa; a emergente é mais larga que alta na copa; a secundária é estreita
  const lar = (id) => 2 * gerarArvore(id, 0).medidas.raioH;
  const alt = (id) => gerarArvore(id, 0).medidas.altura;
  assert.ok(lar('mata1') / alt('mata1') > 0.8);
  assert.ok(lar('mata3') / alt('mata3') < 0.85);
  // a palmeira: estipe de 17 a 19 m até o palmito, coroa larga de palmas caindo
  const palm = gerarArvore('palmeira', 0);
  assert.ok(palm.medidas.altura > 20 && palm.medidas.altura < 26);
  assert.ok(2 * palm.medidas.raioH > 7, 'coroa de palmas estreita');
  // a embaúba: as folhas grandes quase deitadas na ponta dos galhos (o guarda-chuva)
  const emb = gerarArvore('embauba', 0).atributos;
  let deitadas = 0;
  let folhas = 0;
  for (let v = 0; v < emb.posicao.length / 3; v++) {
    if (emb.arv[2 * v] !== CELULA.embauba) continue;
    folhas++;
    if (emb.normal[3 * v + 1] > 0.6) deitadas++;
  }
  assert.ok(folhas > 0 && deitadas / folhas > 0.6, 'folhas da embaúba em pé');
});

test('cor: folhagem e casca em albedo real (0,02 a 0,25 linear), sem verde-limão', () => {
  for (const e of ESPECIES) {
    for (const hex of [e.folha, e.casca]) {
      const L = lum(hex);
      assert.ok(L >= 0.015 && L <= 0.35, `${e.id}: ${hex} com albedo ${L.toFixed(3)}`);
      const { h, s } = hsv(hex);
      assert.ok(!(h >= 68 && h <= 95 && s > 0.55), `${e.id}: ${hex} verde-limão`);
    }
    assert.ok(lum(e.folha) <= 0.14, `${e.id}: folha clara demais`);
  }
  // as folhas da mata na faixa da copa pintada no chão (a troca de perto para longe não muda a cor)
  const copa = Object.values(CORES_COPA).slice(1, 5).map(lum);
  const mata = ['mata1', 'mata2', 'mata3'].map((id) => lum(ESPECIES[ESPECIE[id]].folha));
  for (const L of mata) assert.ok(L >= Math.min(...copa) * 0.7 && L <= Math.max(...copa) * 1.6);
});

test('cor: a copa inteira (a cor por vértice, com a oclusão das cartas de dentro) na faixa da folhagem, não preta', () => {
  // desenho 9.2: folhagem de 0,05 a 0,12 linear. O atlas de folhas multiplica em torno de 1 (0,5 = 1): a média da cor
  // das folhas por vértice é o albedo da copa. Com a folha escura e a oclusão por cima, o oiti saía a 0,02 (preto na tela)
  for (const lod of [0, 1]) {
    for (const e of ESPECIES) {
      const a = gerarArvore(e.id, lod).atributos;
      let s = 0;
      let n = 0;
      for (let v = 0; v < a.posicao.length / 3; v++) {
        if (a.arv[2 * v] === CELULA.casca) continue;
        s += 0.2126 * a.cor[3 * v] + 0.7152 * a.cor[3 * v + 1] + 0.0722 * a.cor[3 * v + 2];
        n++;
      }
      const L = s / n;
      assert.ok(L >= 0.05 && L <= 0.125, `${e.id} LOD${lod}: copa com albedo ${L.toFixed(3)}`);
    }
  }
});

test('oficina: o gerador "arvores" responde todas as espécies nos dois LODs, ou uma', () => {
  const d = criarDespachante();
  assert.ok(d.tipos().includes('arvores'));
  const { resposta } = d.responder({ id: 1, tipo: 'arvores', chave: 'x', dados: {} });
  assert.equal(resposta.malhas.length, N_ESPECIES * 2);
  const um = gerarParaOficina({ especie: 'oiti', lod: 1 });
  assert.equal(um.malhas.length, 1);
  assert.equal(um.malhas[0].material, 'arvore:oiti:1');
  assert.equal(gerarTodas().length, N_ESPECIES * 2);
});

// ------------------------------------------------------------------------------------------------ copas do chão

/** O gHash do GLSL em BigInt (referência independente do Math.imul). */
function hashRef(cx, cy, s) {
  const M = 0xffffffffn;
  let h = ((BigInt(cx) * 1597334677n) & M) ^ ((BigInt(cy) * 3812015801n) & M) ^ ((BigInt(s) * 2654435769n) & M);
  h ^= h >> 16n;
  h = (h * 2246822519n) & M;
  h ^= h >> 13n;
  h = (h * 3266489917n) & M;
  h ^= h >> 16n;
  return Number(h);
}

test('copas: o hash é o da GPU bit a bit (multiplicação de 32 bits sem sinal)', () => {
  for (let k = 0; k < 300; k++) {
    const i = (k * 7) % 26;
    const j = (k * 13) % 26;
    const s = 7303 + (k % 70);
    const esperado = Math.fround(Math.fround(hashRef(i, j, s)) * Math.fround(1 / 4294967295));
    assert.equal(hashGPU(i, j, s), esperado, `hash de ${i}, ${j}, ${s}`);
  }
});

test('copas: rede periódica, determinística, densidade de dossel e sem copa repetida entre ladrilhos vizinhos', () => {
  // a célula repete no período da textura
  const a = copaDaCelula(3, 5, SUBREDES[0]);
  const b = copaDaCelula(3 + 16, 5 - 16, SUBREDES[0]);
  assert.equal(a.alt, b.alt);
  assert.equal(a.u + 1, b.u);
  // densidade: copas grandes de 6 a 22 m, uns 70 a 160 por hectare
  const L = REDES_COPA.grande.periodo;
  const c = copasNoRetangulo('grande', 0, 0, L, L);
  const porHa = c.length / ((L * L) / 10000);
  assert.ok(porHa > 70 && porHa < 160, `${porHa.toFixed(0)} copas por hectare`);
  for (const q of c) {
    assert.ok(2 * q.raio > 4 && 2 * q.raio < 26, `copa de ${(2 * q.raio).toFixed(1)} m`);
    // o pico da copa é o canal B da textura no centro dela
    const v = valorCopas(q.x / L + REDES_COPA.grande.desloc[0], q.z / L + REDES_COPA.grande.desloc[1]);
    assert.ok(Math.abs(v - q.alt) < 1e-6 || v > q.alt, 'copa dominada saiu');
  }
  // dois ladrilhos vizinhos somam o retângulo inteiro
  const esq = copasNoRetangulo('grande', 100, 100, 164, 164);
  const dir = copasNoRetangulo('grande', 164, 100, 228, 164);
  const tudo = copasNoRetangulo('grande', 100, 100, 228, 164);
  assert.equal(esq.length + dir.length, tudo.length);
  assert.deepEqual(copasNoRetangulo('pequena', -50, 20, 14, 84), copasNoRetangulo('pequena', -50, 20, 14, 84));
});

test('vegetação pintada: a mata fechada pinta copa, a cidade nada, o pasto árvore solta e moita, o rio mata ciliar', () => {
  const r = (x) => [x, x, x, x];
  const mata = vegetacaoPintada({ h: 80, ny: 0.95, mata: 1, agua: 250, mar: 0, urb: 0 }, r(0.5), r(0.5), r(0.5));
  assert.ok(mata.copa > 0.9);
  const cidade = vegetacaoPintada({ h: 10, ny: 1, mata: 1, agua: 250, mar: 0, urb: 1 }, r(0.5), r(0.5), r(0.5));
  assert.equal(cidade.copa + cidade.moita + cidade.arvore + cidade.ciliar, 0);
  const pasto = vegetacaoPintada({ h: 10, ny: 1, mata: 0, agua: 250, mar: 0, urb: 0 }, [0.9, 0.9, 0.5, 0.5], [0.9, 0.9, 0.9, 0.9], [0.5, 0.5, 0.9, 0.9]);
  assert.ok(pasto.arvore > 0.5 && pasto.moita > 0.5);
  const beira = vegetacaoPintada({ h: 2, ny: 1, mata: 0.1, agua: 12, mar: 0, urb: 0 }, r(0.5), r(0.7), [0.3, 0.5, 0.8, 0.5]);
  assert.ok(beira.ciliar > 0.5);
  // árvore na copa: a mata vira espécie da mata com a altura do dossel pintado; a moita debaixo da mata é sub-bosque
  const copa = { alt: 0.8, raio: 8, sub: 0, id: 0.3 };
  const a = arvoreDaCopa(copa, mata, 0.9);
  assert.ok([ESPECIE.mata1, ESPECIE.mata2, ESPECIE.mata3, ESPECIE.embauba].includes(a.especie));
  assert.ok(Math.abs(a.altura - alturaDossel(0.8)) < 1e-9);
  assert.equal(arvoreDaCopa(copa, cidade, 0.5), null);
  const sub = moitaDaCopa({ alt: 0.6, raio: 1.5 }, mata, 0.1);
  assert.ok(sub && sub.subBosque && sub.altura >= 2.5);
  assert.equal(moitaDaCopa({ alt: 0.6, raio: 1.5 }, mata, 0.9), null);
});

test('ladrilhos: árvores na mata e no campo da cidade sintética, nenhuma no meio da cidade, determinístico', () => {
  const esp = espelhoSintetico();
  const T = esp.terreno;
  const dist = distanciaAgua(T.agua, T.n);
  const dados = prepararDados(T, esp.floresta, dist);
  const A = { T, dados, uso: null, ladoUso: 0, mapa: { ox: T.origem[0], oz: T.origem[1], lado: T.passo * (T.n - 1) }, ruido: null, ladoRuido: 0 };
  // morros do noroeste: mata fechada
  const mata = gerarLadrilho(A, -2600, -2600);
  assert.ok(mata.arvores.length / PASSO_ARVORE > 10, `mata com ${mata.arvores.length / PASSO_ARVORE} árvores`);
  for (let o = 0; o < mata.arvores.length; o += PASSO_ARVORE) {
    const x = mata.arvores[o];
    const z = mata.arvores[o + 2];
    assert.ok(x >= -2600 && x < -2600 + LADRILHO && z >= -2600 && z < -2600 + LADRILHO);
    assert.ok(mata.arvores[o + 4] > 8 && mata.arvores[o + 4] < 25, 'altura do dossel');
  }
  assert.deepEqual(gerarLadrilho(A, -2600, -2600), mata);
  // o mar não tem árvore
  const mar = gerarLadrilho(A, 2500, 2800);
  assert.equal(mar.arvores.length + mar.moitas.length, 0);
});

// ------------------------------------------------------------------------------------------------ impostores

test('impostor: 8 azimutes em 2 anéis e a vista de cima; cada vista escolhe a si mesma; o atlas não sobrepõe', () => {
  assert.equal(QUADROS, AZIMUTES * ANEIS.length + 1);
  for (let k = 0; k < QUADROS; k++) {
    const d = direcaoDoQuadro(k);
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
    const q = quadrosDaVista(d);
    assert.equal(q.a, k, `vista ${k}`);
    assert.ok(q.peso < 1e-9);
  }
  // no meio de duas vistas o peso é meio
  const meio = quadrosDaVista([Math.cos(Math.PI / 8), 0.1, Math.sin(Math.PI / 8)]);
  assert.equal(meio.a, 0);
  assert.equal(meio.b, 1);
  assert.ok(Math.abs(meio.peso - 0.5) < 1e-6);
  const D = dispor(N_ESPECIES, 128);
  assert.equal(D.largura, QUADROS * 128);
  const vistos = new Set();
  for (let e = 0; e < N_ESPECIES; e++) for (let k = 0; k < QUADROS; k++) vistos.add(celulaDoQuadro(N_ESPECIES, e, k).join(','));
  assert.equal(vistos.size, N_ESPECIES * QUADROS);
  const c = cameraDoQuadro(3, 8, 10);
  assert.ok(Math.abs(Math.hypot(c.posicao[0], c.posicao[1] - 8, c.posicao[2]) - 30) < 1e-9);
  // o GLSL usa as mesmas constantes
  assert.match(GLSL_IMP_QUADROS, new RegExp(`IMP_AZ = ${AZIMUTES}\\.0`));
  assert.match(GLSL_IMP_QUADROS, new RegExp(`IMP_QUADROS = ${QUADROS}\\.0`));
});

/** mat2 do GLSL (colunas (a, b) e (c, d)) a partir do texto dos 4 termos, com cos e sen do giro. */
function mat2DoGlsl(txt, nomes, c, s) {
  const termos = txt.split(',').map((t) => t.trim());
  assert.equal(termos.length, 4, `mat2( ${txt} )`);
  const val = (t) => {
    const neg = t.startsWith('-');
    const n = neg ? t.slice(1).trim() : t;
    const v = n === nomes[0] ? c : n === nomes[1] ? s : NaN;
    assert.ok(Number.isFinite(v), `termo ${t}`);
    return neg ? -v : v;
  };
  const [a, b, cc, d] = termos.map(val);
  return (x, y) => [a * x + cc * y, b * x + d * y];
}

test('impostor: o giro da carta é o mesmo da árvore instanciada (LOD0 e LOD1), na direção e na normal', () => {
  const vert = GLSL_IMPOSTOR.vertice.match(/mat2 aRot = mat2\(([^;]+)\);/);
  const frag = GLSL_IMPOSTOR.mapa.match(/aNl\.xz = mat2\(([^;]+)\) \* aNl\.xz;/);
  assert.ok(vert && frag, 'as duas rotações do impostor');
  const m = new Float32Array(16);
  for (const giro of [0.4, 1.3, 2.9, -2.2]) {
    matrizArvore(m, 0, 0, 0, 0, giro, 1, 1);
    const c = Math.cos(giro);
    const s = Math.sin(giro);
    const paraLocal = mat2DoGlsl(vert[1], ['aCg', 'aSg'], c, s);
    const paraMundo = mat2DoGlsl(frag[1], ['vImpGiro.x', 'vImpGiro.y'], c, s);
    for (const [lx, lz] of [[1, 0], [0, 1], [0.6, -0.8]]) {
      // a instância leva o ponto local ao mundo (coluna maior: x' = m0 x + m8 z, z' = m2 x + m10 z)
      const wx = m[0] * lx + m[8] * lz;
      const wz = m[2] * lx + m[10] * lz;
      const [ax, az] = paraLocal(wx, wz);
      assert.ok(Math.abs(ax - lx) < 1e-6 && Math.abs(az - lz) < 1e-6, `direção no espaço da árvore com giro ${giro}`);
      const [bx, bz] = paraMundo(lx, lz);
      assert.ok(Math.abs(bx - wx) < 1e-6 && Math.abs(bz - wz) < 1e-6, `normal no mundo com giro ${giro}`);
    }
  }
});

// ------------------------------------------------------------------------------------------------ LOD e tetos

test('LOD: perto no LOD0 dentro do teto de triângulos, depois o LOD1, depois o impostor, e nada além do teto', () => {
  const pv = { lod0: 50, lod1: 150, tris0: 3000, tris1: 1000, impostores: 3 };
  const tris = [new Float32Array(N_ESPECIES).fill(1000), new Float32Array(N_ESPECIES).fill(100)];
  const dist = Float32Array.from([5, 10, 20, 30, 60, 70, 80, 200, 210, 220, 230, 240, 250, 260, 270, 280]);
  const esp = new Uint8Array(dist.length);
  const lod = escolherLods(dist, esp, dist.length, pv, tris);
  assert.deepEqual([...lod.slice(0, 4)], [0, 0, 0, 1]);
  const n = (L) => [...lod].filter((x) => x === L).length;
  // 3 no LOD0 (o teto de 3 mil), os outros até 150 m no LOD1, 3 impostores (o teto) e o resto sai
  assert.equal(n(0), 3);
  assert.equal(n(1), 4);
  assert.equal(n(2), 3);
  assert.equal(n(-1), 6);
  // o teto do LOD1 também corta: com 2 de espaço, o resto até 150 m vira impostor
  const lod2 = escolherLods(dist, esp, dist.length, { ...pv, tris1: 200, impostores: 99 }, tris);
  assert.equal([...lod2].filter((x) => x === 1).length, 2);
  // tetos do perfil do PC (herdados do Alta): a soma cabe na família 'arvores' do orçamento do 'pc' (300 mil)
  const alta = PERFIL_VEGETACAO.alta;
  assert.ok(alta.tris0 + alta.tris1 + alta.impostores * 2 <= 300000);
  assert.ok(PERFIL_VEGETACAO.media.tris0 + PERFIL_VEGETACAO.media.tris1 + PERFIL_VEGETACAO.media.impostores * 2 <= 110000);
  assert.equal(esmaecer(100, 650, 150), 1);
  assert.equal(esmaecer(650, 650, 150), 0);
  const m = new Float32Array(16);
  matrizArvore(m, 0, 1, 2, 3, Math.PI / 2, 2, 3);
  assert.ok(Math.abs(m[5] - 3) < 1e-6 && Math.abs(m[12] - 1) < 1e-6 && Math.abs(Math.hypot(m[0], m[2]) - 2) < 1e-6);
});

test('plantar: só as árvores válidas entram (espécie da tabela, coordenadas e tamanho finitos)', () => {
  const l = plantaveis([
    { x: 1, y: 2, z: 3, especie: 'oiti', altura: 8 },
    { x: 4, y: 0, z: 5, especie: ESPECIE.palmeira, altura: 20, largura: 8, giro: 1, tom: 0.3 },
    { x: 6, y: 0, z: 7, especie: 'ipe-inexistente', altura: 8 },
    { x: 6, y: 0, z: 7, especie: 99, altura: 8 },
    { x: NaN, y: 0, z: 7, especie: 'oiti', altura: 8 },
    { x: 6, y: 0, z: 7, especie: 'oiti', altura: 0 },
    { x: 8, y: 1, z: 9 },
  ]);
  assert.equal(l.length, 3 * PASSO_ARVORE);
  assert.deepEqual([...l.slice(0, 4)], [1, 2, 3, ESPECIE.oiti]);
  assert.equal(l[PASSO_ARVORE + 3], ESPECIE.palmeira);
  assert.equal(l[2 * PASSO_ARVORE + 3], ESPECIE.oiti, 'sem espécie, o oiti');
  for (const v of l) assert.ok(Number.isFinite(v));
  // no formato das listas: a válida passa sem cópia; com uma inválida no meio, sai uma cópia sem ela
  const boa = Float32Array.from([0, 0, 0, ESPECIE.mata2, 15, 14, 0, 0.5, 0.5]);
  assert.equal(plantaveis(boa), boa);
  const mista = Float32Array.from([...boa, 1, 1, 1, 12, 15, 14, 0, 0.5, 0.5, 2, 2, 2, ESPECIE.moita, 2, 2, 0, 0.5, 0.5]);
  const f = plantaveis(mista);
  assert.equal(f.length, 2 * PASSO_ARVORE);
  assert.equal(f[PASSO_ARVORE + 3], ESPECIE.moita);
});

// ------------------------------------------------------------------------------------------------ shaders

test('shaders: nenhuma precisão média; folhas, árvores, sombra e impostores com poucas leituras', () => {
  const proibida = ['med', 'iump'].join('');
  const textos = [GLSL_GERAR_FOLHAS.fragmento, ...Object.values(GLSL_ARVORE), ...Object.values(GLSL_ARV_SOMBRA), GLSL_IMP_ASSAR.fragmento, ...Object.values(GLSL_IMPOSTOR), GLSL_AGUA_FRAGMENTO.cor];
  for (const t of textos) assert.ok(!t.includes(proibida));
  const amostradores = (t) => (t.match(/uniform\s+highp\s+sampler\w+/g) ?? []).length;
  assert.equal(amostradores(GLSL_ARVORE.fragmentoPars), 1);
  assert.equal(amostradores(GLSL_IMPOSTOR.fragmentoPars), 2);
  // as 8 células do atlas de folhas
  for (let k = 0; k < 7; k++) assert.match(GLSL_GERAR_FOLHAS.fragmento, new RegExp(`k == ${k}`));
  assert.ok(LADO_FOLHAS.alta >= 1024 && LADO_FOLHAS.leve <= 512);
});

// ------------------------------------------------------------------------------------------------ rio, fora e terreno

test('rio: corre para o nível mais baixo, s cresce rio abaixo, o lado através é coerente; turvo e barrento', () => {
  assert.equal(sentidoDoRio(Float64Array.from([0, 0, 1, 40, 100, 0, -0.5, 40])), 1);
  assert.equal(sentidoDoRio(Float64Array.from([0, 0, -0.5, 40, 100, 0, 1, 40])), -1);
  const T = { n: 9, passo: 8, origem: [0, 0], altura: new Float32Array(81), agua: new Uint8Array(81), lagoas: [], rios: [{ pontos: Float64Array.from([0, 0, -0.5, 40, 0, 100, 1, 40]) }] };
  const g = geometriaAgua(T, 0);
  const r = g.attributes.aRio.array;
  const f = g.attributes.aFluxo.array;
  const p = g.attributes.position.array;
  const nv = r.length / 3;
  // nível maior no fim: o rio corre de z = 100 para z = 0 (fluxo -z), e s cresce para z menor
  for (let v = 0; v < nv; v++) assert.ok(f[2 * v + 1] < 0);
  // s cresce rio abaixo (para z menor)
  for (let v = 2; v < nv; v += 2) assert.ok((r[3 * v] - r[3 * (v - 2)]) * (p[3 * v + 2] - p[3 * (v - 2) + 2]) < 0);
  for (let v = 0; v < nv; v += 2) {
    // os dois vértices do par: aRio.y > 0 do lado (fz, -fx) da correnteza, em relação ao meio do par
    const mx = (p[3 * v] + p[3 * v + 3]) / 2;
    const mz = (p[3 * v + 2] + p[3 * v + 5]) / 2;
    for (const w of [v, v + 1]) {
      const lado = (p[3 * w] - mx) * f[2 * w + 1] - (p[3 * w + 2] - mz) * f[2 * w];
      assert.equal(Math.sign(lado), Math.sign(r[3 * w + 1]));
      assert.equal(r[3 * w + 2], 20);
    }
  }
  // barrento: mais vermelho que azul no espalhamento, e mais turvo que o mar
  assert.ok(AGUAS.rio.espalha[0] > AGUAS.rio.espalha[2] * 1.8);
  assert.ok(AGUAS.rio.absorcao[2] > AGUAS.mar.absorcao[0]);
  assert.ok(RIO.velMeio > RIO.velMargem);
  assert.match(GLSL_AGUA_FRAGMENTO.cor, /rEspuma/);
  // o bloco do rio só no programa da água de dentro (grupo 1); o mar (grupo 0) não o carrega
  assert.match(GLSL_AGUA_FRAGMENTO.cor, /#ifdef AGUA_RIO[\s\S]*rEspuma[\s\S]*#endif/);
  assert.deepEqual(g.groups.map((x) => x.materialIndex), [1]);
  assert.equal(g.groups[0].start, 0);
  assert.equal(g.groups[0].count, g.index.count);
});

test('mundo de fora: serra nas direções de terra, mar nas de mar, anel virado para cima e dentro do plano distante', () => {
  const T = espelhoSintetico().terreno;
  const tab = terraPorDirecao(T, 36);
  // a sintética tem mar ao sul (+z, 90 graus) e a leste (+x, 0); terra a oeste (180) e ao norte (270)
  assert.ok(tab[9] < 0.2 && tab[0] < 0.2);
  assert.ok(tab[18] > 0.8 && tab[27] > 0.8);
  const G = geometriaFora(T, { az: 64, rad: 8 });
  const p = G.posicao;
  let hMax = -Infinity;
  for (let k = 0; k < G.indices.length; k += 3) {
    const [a, b, c] = [G.indices[k], G.indices[k + 1], G.indices[k + 2]];
    const ny = (p[3 * b + 2] - p[3 * a + 2]) * (p[3 * c] - p[3 * a]) - (p[3 * b] - p[3 * a]) * (p[3 * c + 2] - p[3 * a + 2]);
    assert.ok(ny > 0, 'triângulo do anel virado para baixo');
  }
  for (let v = 0; v < p.length / 3; v++) {
    hMax = Math.max(hMax, p[3 * v + 1]);
    assert.ok(Math.hypot(p[3 * v], p[3 * v + 2]) <= ANEL_FORA.r1 + 10);
  }
  assert.ok(hMax > 600 && hMax < 2000, `serra de ${hMax.toFixed(0)} m`);
  assert.ok(alturaFora(30000, 0, 0) < 400, 'mar aberto com serra');
  // a semente vem do texto inteiro do mapa (antes, o tamanho dele: mapas com sementes do mesmo tamanho repetiam a
  // serra, e uma semente numérica dava NaN)
  assert.notEqual(sementeFora('sintetica-1'), sementeFora('sintetica-2'));
  assert.equal(sementeFora('sintetica-1'), sementeFora('sintetica-1'));
  for (const sm of [42, undefined, '']) assert.ok(Number.isInteger(sementeFora(sm)) && sementeFora(sm) > 0);
  assert.ok(ANEL_FORA.r1 < 60000, 'além do plano distante da faixa de longe');
});

test('terreno: assado de 16 bits no Alta e no PC (metade da memória), a vegetação pintada some perto, longe sem buracos', () => {
  const a4k = { ...PERFIL_TERRENO.alta, cor: 4096, relevo: 0 }; // o assado de 2 m por texel (o Alta antes do PC3)
  assert.ok(Math.abs(memoriaAssadoMB(a4k) - 42.67) < 0.05);
  assert.ok(Math.abs(memoriaAssadoMB({ ...a4k, cor16: false }) - 85.33) < 0.05);
  assert.ok(PERFIL_TERRENO.alta.cor16);
  assert.ok(!PERFIL_TERRENO.media.cor16);
  const U = criarUniformes();
  assert.ok(U.uTerVegPerto && U.uTerAssado16);
  assert.match(GLSL_TER_CAMADAS, /moita \*= terKMoita/);
  assert.match(GLSL_TER_FRAGMENTO.cor, /terKArv = smoothstep/);
  assert.match(GLSL_ASSAR.fragmento, /uTerAssado16/);
  // de longe a copa sai da média do passo do vértice; a distância à água saturada não afunda o vértice; o mar desce
  // pela distância à terra; a sombra de longe lê o chão debaixo da copa
  assert.match(GLSL_TER_VERTICE.normal, /textureLod\( uTerDados, terUVDados\( tW \), tNivelMin \)/);
  assert.match(GLSL_TER_VERTICE.normal, /min\( 2\.0 \* tPassoEf, 230\.0 \)/);
  assert.match(GLSL_TER_VERTICE.normal, /-0\.3 \* tAguaV\.x/);
  assert.match(GLSL_TER_VERTICE.fim, /vGPosMundo\.y \+= vTer\.w - vTer\.y;/);
  // a folga: só no vértice ao sol do campo, 1/5 da copa e a flecha da malha grossa
  assert.match(GLSL_TER_VERTICE.normal, /tLuzV \* \( 0\.20 \* tCopa \+ min\( 0\.12 \* tPassoEf, 16\.0 \) \)/);
  assert.match(GLSL_TER_VERTICE.pars, /uniform sampler2D gCampoMapa;/);
  // com o sol baixo, nenhuma folga (a sombra longa inteira)
  assert.match(GLSL_TER_VERTICE.normal, /float tLuzV = smoothstep\( 0\.4, 0\.65, uTerCopaV\.w \);/);
});

test('A1: o GLSL das árvores vem sob demanda (só o domínio o importa, por import dinâmico)', async () => {
  const ler = (p) => readFileSync(new URL(`../../fonte/render/${p}`, import.meta.url), 'utf8');
  const estatico = /^import[^;]*from '[^']*folha\.glsl\.js'/m;
  for (const p of ['materiais/shaders/terreno.glsl.js', 'materiais/shaders/agua.glsl.js', 'mundo/vegetacao.js', 'mundo/terreno.js', 'mundo/agua.js']) {
    assert.doesNotMatch(ler(p), estatico, `${p} importa folha.glsl.js de saída`);
  }
  assert.match(ler('mundo/vegetacao.js'), /import\('\.\.\/materiais\/shaders\/folha\.glsl\.js'\)/);
  // a cor da copa continua a mesma para quem lia de folha.glsl.js
  const F = await import('../../fonte/render/materiais/shaders/folha.glsl.js');
  const T = await import('../../fonte/render/materiais/shaders/terreno.glsl.js');
  assert.equal(F.CORES_COPA, T.CORES_COPA);
  assert.equal(F.GLSL_COPA, T.GLSL_COPA);
});

test('PC3: os programas da sombra das árvores e do assado dos impostores são pequenos e compilam antes do uso', async () => {
  // no PC do dono, 'arvore-sombra' e 'arvores:assar-impostores' mediam uns 2,2 s cada (um ou outro por rodada): o
  // primeiro programa usado de forma síncrona logo depois do aquecimento esperava a fila dele. Os dois são pequenos
  // (sem laço, sem vetor indexado, sem derivada em ramo que muda por pixel) e compilam em paralelo antes do primeiro
  // desenho
  const sombra = Object.values(GLSL_ARV_SOMBRA).join('\n');
  const assar = Object.values(GLSL_IMP_ASSAR).join('\n');
  for (const [nome, t] of [['arvore-sombra', sombra], ['arvores:assar-impostores', assar]]) {
    assert.ok(!/\bfor\s*\(|\bwhile\s*\(/.test(t), `${nome} com laço`);
    assert.ok(!/\w\[\s*[a-z]\w*\s*\]/.test(t), `${nome} com vetor indexado por variável`);
    assert.ok(t.length < 2200, `${nome} com ${t.length} caracteres`);
    // as derivadas só no começo da folha (arvFolha), antes de qualquer ramo
    const corpo = t.slice(t.indexOf('vec4 arvFolha('));
    const i = corpo.indexOf('dFdx');
    assert.ok(i > 0 && i < corpo.indexOf('?'), `${nome}: derivada depois de um ramo`);
  }
  const fonte = readFileSync(new URL('../../fonte/render/mundo/vegetacao.js', import.meta.url), 'utf8');
  // o material do assado nasce com o GLSL (não no próprio assado) e os três grupos compilam já, cada um no seu alvo
  assert.match(fonte, /assador = criarAssadorImpostores\(U, modelos\[0\]\[0\]\.geo\);/);
  assert.match(fonte, /aq\.compilar\(sombras\.map\(\(b\) => b\.malha\), \{ sombra: true \}\)/);
  assert.match(fonte, /aq\.compilar\(\[assador\.cena\], \{ alvo: alvoAssar, cena: assador\.cena \}\)/);
  // e nada desenha antes de prontos: nem as árvores (a sombra delas) nem o assado; o aquecimento final espera
  assert.match(fonte, /if \(!comGlsl \|\| !programasProntos\) return;/);
  assert.match(fonte, /pronto: \(\) => \(comGlsl && programasProntos\) \|\| glslFalhou \|\| morto,/);
  assert.ok(!/function assarImpostores[\s\S]*?new THREE\.ShaderMaterial[\s\S]*?\n}\n/.test(fonte.slice(fonte.indexOf('function assarImpostores'), fonte.indexOf('// ----', fonte.indexOf('function assarImpostores')))), 'o assado não cria o material');
});
