// Testes do render da Arcologia (SEDE3, D88 a D90): a sede v3, Park of Future Dreams. As torres da D89 (a Blade Tower
// de 500 m e a Legacy Tower de 452 m pelo mesmo gerador, recuos a 49, 70 e 91%, o orçamento por perfil, o LOD1 com a
// mesma caixa, a sombra dentro do vidro) no pódio redondo de 40 m, com a Dream Bridge a 330 m num vão de 25 a 30 m; a
// Codex Tower (300 m), a Helix Labs e a Compass Tower (180 m); os dois anéis (raios, fundos, alturas, marquises por
// andar e pórticos); o Mirror Lake com as Dream Falls e as fontes; o parque; o plano como dados (portões nas 8
// avenidas, vias internas, partes com nome em inglês, os 8 trechos do Horizon Ring); tudo dentro da gleba e a gleba
// dentro da área inicial e em terra; os tetos de triângulos da D66 e a garantia de que nenhum material da Arcologia
// muda de programa entre o dia, a noite, os LODs e o fantasma. Sem navegador.
// Roda sozinho: node ferramentas/testes/arcologia-render.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  malhasTorre, malhasTorreLod1, malhaSombraTorre, malhasPar, malhaSombraPar, trechosCorpo, contornoTrecho, medidasTorre,
  NIVEL, Malha, DIST_LOD0, LUZ_NOITE, torno, cilindro, materiais, descartarMateriais, atualizarArcologia, UNIFORMES,
  CHAVES, criarPar, criarTorre, criarAquecimento, VIDRO, LUZ, malhaJato, FONTES, medidasDoPar, SETORES, MEIO_VAO_CORTE,
  andaresLed, PADRAO, corLinear, vidAnel, semAnel, SEM_ANEL,
} from '../../fonte/render/arcologia/torre.js';
import { ganchos } from '../../fonte/render/motor/ganchos.js';
import { assentarHora, VISTAS as VISTAS_TORRE } from '../../fonte/render/cenas/torre.js';
import { VISTAS_SEDE, TETO_ARCOLOGIA, TETO_ABERTA_V3 } from '../../fonte/render/cenas/planos.js';
import {
  malhasDoPlano, tocaGleba, pontoNaAgua, DIST_PARTES_LOD0, partesProntas, alvosDosSetores, distAoSetor, reservatorioDe, lagoDe,
} from '../../fonte/render/arcologia/planos.js';
import { ORCAMENTO } from '../../fonte/contratos/render.js';
import { ETAPA, AGUA, ARESTA } from '../../fonte/contratos/flags.js';
import {
  montarParte, malhasNovas, setorDoAnel, SETOR_OVAL, SETOR_PARQUE, PECAS, PECAS_COM_LOD, faixaLed, PE_ANEL, PE_OVAL, BAL_OVAL,
  corposDaOval, gruposDeSupertrees, PARQUE,
} from '../../fonte/render/arcologia/partes.js';
import { cavarTerreno, descavar, materialAgua } from '../../fonte/render/arcologia/lago.js';
import { materialFantasma } from '../../fonte/render/arcologia/fantasma.js';
import {
  estadoObra, criarObra, malhaMastro, malhaCabeca, malhaCanteiroLago, malhaCanteiroTorre, malhaFrente, plantaNaAltura, GRUA, ALTURA_FRENTE,
  espessuraFrente, alturaVidro, VAO_PE,
} from '../../fonte/render/arcologia/obra.js';
import { rotaDoVoo, posicaoNoCiclo, malhaHelicoptero, malhaRotor, malhaRotorCauda, CICLO } from '../../fonte/render/arcologia/heli.js';
import {
  TORRE_LAMINA as TL, TORRE_IRMA, especTorre, RECUOS, PAR, torresDoPar, PLANOS, PLANO_ESCOLHIDO, PARTES_ORDEM,
  PARTES_NOMES, GLEBA_ENVELOPE, cavaDoPlano, POUSO, TORRE_POSICAO, HELIPONTO_LOCAL, torreParaMundo, CAMERA_ARCOLOGIA,
  HORIZON, MERIDIAN, PODIO, LAGO, FLORESTA, AVENIDAS, ILHAS, MIRROR, QUEDAS_ANGULOS, HALO, PONTES, PONTE, raioDaMargem, CORREDOR_AVENIDA, raioDaFaceDeDentro, ANEL_VIARIO, TRECHOS_HORIZON, mataDaSede, SEDE_CENTRO,
} from '../../fonte/data/arcologia-plano.js';
import { MAPA_HELDOPOLIS } from '../../fonte/data/mapa-heldopolis.js';
import { gerarTerreno, aguaEm, costaEm } from '../../fonte/sim/mundo/terreno.js';
import { pontoNoPoligono } from '../../fonte/comum/vetor.js';

const caixaDe = (...ms) => {
  const bs = ms.map((m) => m.caixa()).filter(Boolean);
  return [0, 1, 2].map((e) => Math.min(...bs.map((b) => b[e]))).concat([3, 4, 5].map((e) => Math.max(...bs.map((b) => b[e]))));
};
const tris = (...ms) => ms.reduce((a, m) => a + (m?.triangulos ?? 0), 0);
const somaSetores = (r) => [...r.setores.values()].reduce((a, m) => a + m.triangulos, 0);

function conferirMalha(m, nome) {
  for (const v of m.p) assert.ok(Number.isFinite(v), `${nome}: posição não finita`);
  for (let i = 0; i < m.n.length; i += 3) {
    const l = Math.hypot(m.n[i], m.n[i + 1], m.n[i + 2]);
    assert.ok(Number.isFinite(l) && l > 0.2, `${nome}: normal ruim no vértice ${i / 3}`);
  }
  for (const v of m.c) assert.ok(Number.isFinite(v), `${nome}: dado não finito`);
  const nv = m.vertices;
  for (const k of m.i) assert.ok(k >= 0 && k < nv, `${nome}: índice fora`);
  assert.equal(m.i.length % 3, 0, `${nome}: índices soltos`);
}

const SPECS = [TL, TORRE_IRMA];
const NO_PAR = { gemea: true, base: PAR.podio };
const A = PLANOS.A;
const [CX, CZ] = A.centro;
const COTA = GLEBA_ENVELOPE.cota;
const pecasDe = (tipo) => A.partes.flatMap((p) => p.pecas).filter((p) => p.tipo === tipo);
const chaoPlano = () => COTA;
const raioDe = (x, z) => Math.hypot(x - CX, z - CZ);
const anguloDe = (x, z) => (((Math.atan2(z - CZ, x - CX) * 180) / Math.PI) % 360 + 360) % 360;
const MIRROR_R_FORA = 420;
const difG = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

// ------------------------------------------------------------------------------------------------ as torres (D89)

test('torres: Blade de 500 m e Legacy de 452 m, recuos a 49, 70 e 91% da altura, heliponto e mastro só na Blade', () => {
  assert.equal(TL.altura, 500);
  assert.equal(TORRE_IRMA.altura, 452);
  assert.equal(TL.nome, 'Blade Tower');
  assert.equal(TORRE_IRMA.nome, 'Legacy Tower');
  for (const s of SPECS) {
    const topos = s.laminas.map((l) => l.topo);
    [RECUOS[2], RECUOS[1], RECUOS[0]].forEach((f, i) => assert.ok(Math.abs(topos[i] / s.altura - f) < 0.01, `${s.nome}: lâmina ${i + 1} a ${(topos[i] / s.altura).toFixed(3)}`));
    const corpo = topos[0] - s.podio.altura - s.andaresDeVento.reduce((a, v) => a + v.altura, 0);
    assert.equal(Math.round(corpo / s.pavimentos.altura), s.pavimentos.n);
    assert.equal(s.andaresDeVento[0].base, topos[2]);
    assert.ok(Math.abs(s.andaresDeVento[1].base + s.andaresDeVento[1].altura - topos[1]) < 1e-6);
    assert.ok(Math.abs(s.coroa.base + s.coroa.altura - s.altura) < 1e-6, `${s.nome}: a coroa fecha no topo`);
    assert.deepEqual([s.planta.largura, s.planta.comprimento], [36, 50]);
    assert.ok(s.led.largura > 0, `${s.nome}: a linha de LED das quinas`);
  }
  assert.equal(TL.heliponto.cota, 500);
  assert.equal(TL.mastro.topo, 520);
  assert.equal(TORRE_IRMA.heliponto, null);
  assert.equal(TORRE_IRMA.mastro, null);
  assert.equal(medidasTorre(TORRE_IRMA).HELI, null);
  // o gerador é um só: a mesma função dá a torre de qualquer altura
  assert.deepEqual(especTorre(330).laminas.map((l) => l.topo), [301, 229.6, 163]);
});

test('torres: no par, o corpo sai da praça do pódio (40 m) e o topo de cada uma fica na altura dela', () => {
  for (const s of SPECS) {
    const m = malhasTorre({ nivel: 1, spec: s, ...NO_PAR });
    const cx = caixaDe(m.vidro, m.opaco);
    assert.ok(cx[1] >= PAR.podio - 0.7, `${s.nome}: geometria abaixo da praça (${cx[1]})`);
    if (s.mastro) assert.equal(cx[4], s.mastro.topo, `${s.nome}: topo do mastro`);
    else assert.ok(Math.abs(cx[4] - (s.altura + 0.7)) < 0.01, `${s.nome}: topo ${cx[4]} (aro e luzes de obstáculo)`);
    assert.equal(medidasDoPar(s).BASE, PAR.podio);
  }
  // o topo do tabuleiro do heliponto da Blade é a cota 500
  const m = malhasTorre({ nivel: 1, spec: TL, ...NO_PAR });
  let topoHeli = -Infinity;
  for (let i = 0; i < m.opaco.p.length; i += 3) {
    const y = m.opaco.p[i + 1];
    if (m.opaco.n[i + 1] > 0.99 && Math.hypot(m.opaco.p[i] - HELIPONTO_LOCAL.x, m.opaco.p[i + 2] - HELIPONTO_LOCAL.z) < 6 && y < 510) topoHeli = Math.max(topoHeli, y);
  }
  assert.ok(Math.abs(topoHeli - 500) < 0.05, `topo do heliponto em ${topoHeli}`);
});

test('torres: orçamento por perfil (D66: LOD0 até 70 mil cada no Alta e no pc), LOD1 e sombra', () => {
  for (const s of SPECS) {
    const faixa = s.triangulos.lod0;
    for (const perfil of ['media', 'alta', 'ultra', 'pc']) {
      const m = malhasTorre({ nivel: NIVEL[perfil], spec: s, ...NO_PAR });
      const n = tris(m.vidro, m.opaco);
      assert.ok(n >= faixa[perfil][0] && n <= faixa[perfil][1], `${s.nome} LOD0 ${perfil}: ${n} triângulos (${faixa[perfil].join(' a ')})`);
      assert.ok(n <= 70000, `${s.nome}: ${n} > 70 mil`);
    }
    const l1 = malhasTorreLod1({ spec: s, ...NO_PAR });
    const n1 = tris(l1.vidro, l1.opaco);
    assert.ok(n1 >= s.triangulos.lod1[0] && n1 <= s.triangulos.lod1[1], `${s.nome} LOD1: ${n1} (${s.triangulos.lod1.join(' a ')})`);
    const sb = malhaSombraTorre({ spec: s, ...NO_PAR });
    assert.ok(sb.triangulos > 20 && sb.triangulos < 400, `${s.nome} sombra: ${sb.triangulos}`);
    const lv = malhasTorre({ nivel: 0, spec: s, ...NO_PAR });
    assert.ok(tris(lv.vidro, lv.opaco) < faixa.media[0], `${s.nome}: o leve fica abaixo da média`);
  }
  // a Torre sozinha (a cena sem contexto, a bancada) com o pódio próprio e a esplanada também cabe
  const so = malhasTorre({ nivel: NIVEL.alta, comEsplanada: true });
  assert.ok(tris(so.vidro, so.opaco) <= 70000);
});

test('torres: malhas sem NaN, normais boas e índices no lugar, em todos os níveis', () => {
  for (const s of SPECS) {
    for (const nivel of [0, 1, 2, 3]) {
      const m = malhasTorre({ nivel, spec: s, ...NO_PAR });
      conferirMalha(m.vidro, `${s.nome} LOD0 ${nivel} vidro`);
      conferirMalha(m.opaco, `${s.nome} LOD0 ${nivel} opaco`);
    }
    const l1 = malhasTorreLod1({ spec: s, ...NO_PAR });
    conferirMalha(l1.vidro, `${s.nome} LOD1 vidro`);
    conferirMalha(l1.opaco, `${s.nome} LOD1 opaco`);
    conferirMalha(malhaSombraTorre({ spec: s, ...NO_PAR }), `${s.nome} sombra`);
  }
  for (const lod of [0, 1]) {
    const p = malhasPar({ nivel: 2, lod });
    for (const k of ['vidro', 'opaco']) conferirMalha(p[k], `par ${lod} ${k}`);
  }
  conferirMalha(malhaSombraPar(), 'sombra do par');
});

test('torres: o LOD1 tem a mesma caixa do LOD0 e o volume de sombra fica dentro dela', () => {
  for (const s of SPECS) {
    for (const nivel of [1, 2]) {
      const m0 = malhasTorre({ nivel, spec: s, ...NO_PAR });
      const m1 = malhasTorreLod1({ spec: s, ...NO_PAR });
      const a = caixaDe(m0.vidro, m0.opaco);
      const b = caixaDe(m1.vidro, m1.opaco);
      for (let e = 0; e < 6; e++) assert.ok(Math.abs(a[e] - b[e]) < 0.06, `${s.nome} caixa ${e}: LOD0 ${a[e]} x LOD1 ${b[e]}`);
      const sb = caixaDe(malhaSombraTorre({ spec: s, ...NO_PAR }));
      for (let e = 0; e < 3; e++) assert.ok(sb[e] >= a[e] - 1e-6 && sb[e + 3] <= a[e + 3] + 1e-6, `${s.nome}: sombra fora da caixa no eixo ${e}`);
    }
  }
});

test('torres: andares de vento recuados 2 m e o v das paredes contado da base de cada trecho (o shader não sabe a cota)', () => {
  for (const s of SPECS) {
    const M = medidasTorre(s);
    const vento = trechosCorpo(M).filter((t) => t.vento);
    assert.equal(vento.length, 2);
    for (const t of vento) {
      const { poly } = contornoTrecho({ x: t.x, z0: t.z0, z1: t.z1, entalhe: 0, costura: false });
      for (let i = 0; i < poly.length; i += 2) assert.ok(Math.abs(poly[i]) <= s.planta.largura / 2 - s.andaresDeVento[0].recuo + 1e-6);
    }
    const m = malhasTorre({ nivel: 1, spec: s, ...NO_PAR });
    let maxV = 0;
    for (let i = 0; i < m.vidro.c.length / 4; i++) if (m.vidro.c[4 * i] <= VIDRO.vento) maxV = Math.max(maxV, m.vidro.uv[2 * i + 1]);
    assert.ok(maxV < 240, `${s.nome}: v até ${maxV}`);
    let coroa = 0;
    let led = 0;
    for (let i = 0; i < m.opaco.c.length / 4; i++) {
      const cls = (Math.round(m.opaco.c[4 * i + 3]) >> 4) & 15;
      if (cls === LUZ.coroa) {
        coroa++;
        assert.ok(m.opaco.uv[2 * i + 1] >= -1e-6 && m.opaco.uv[2 * i + 1] <= 30 + 1e-6);
      }
      if (cls === LUZ.led) led++;
    }
    assert.ok(coroa > 50, `${s.nome}: coroa acesa`);
    assert.ok(led >= 8 * 8, `${s.nome}: a linha de LED nas quinas das lâminas (${led} vértices)`);
  }
});

test('par (D89): lado a lado no pódio, centros a 64 m, vão de 25 a 30 m e a Dream Bridge a 330 m atravessando o vão', () => {
  assert.equal(PAR.distancia, 64);
  assert.ok(PAR.vao >= 25 && PAR.vao <= 30, `vão de ${PAR.vao} m`);
  assert.equal(PAR.distancia - TL.planta.largura, PAR.vao, 'o vão é o que sobra entre as faces de 36 m');
  assert.equal(PAR.ponte.cota, 330);
  assert.equal(PAR.ponte.nome, 'Dream Bridge');
  const [blade, legacy] = torresDoPar({ x: 0, z: 0, rot: 0 });
  assert.equal(blade.spec, TL);
  assert.equal(legacy.spec, TORRE_IRMA);
  assert.deepEqual([blade.x, legacy.x], [-32, 32]);
  // as duas com as penas para o mesmo lado (o mar): a mesma rotação
  assert.equal(blade.rot, legacy.rot);
  // no par de verdade: acima do pódio, nada das torres entra no vão (|x| < 14), só a ponte
  for (const lod of [0, 1]) {
    const p = malhasPar({ nivel: 1, lod });
    let minVidro = Infinity;
    for (let i = 0; i < p.vidro.p.length; i += 3) {
      const y = p.vidro.p[i + 1];
      if (y > PAR.podio + 8 && (y < PAR.ponte.cota - 12 || y > PAR.ponte.cota + 3)) minVidro = Math.min(minVidro, Math.abs(p.vidro.p[i]));
    }
    assert.ok(Math.abs(minVidro - PAR.vao / 2) < 0.01, `LOD${lod}: vidro a ${minVidro} do eixo`);
    // a ponte: triângulos que atravessam o vão de face a face entre 320 e 331 m (o andar de vidro e o jardim a 330 m)
    let cruza = 0;
    let topo = -Infinity;
    for (const m of [p.vidro, p.opaco]) {
      for (let t = 0; t < m.i.length; t += 3) {
        const ids = [m.i[t], m.i[t + 1], m.i[t + 2]];
        const xs = ids.map((k) => m.p[3 * k]);
        const ys = ids.map((k) => m.p[3 * k + 1]);
        if (Math.min(...xs) < -PAR.vao / 2 + 1 && Math.max(...xs) > PAR.vao / 2 - 1 && Math.min(...ys) > 300 && Math.max(...ys) < 345) {
          cruza++;
          topo = Math.max(topo, ...ys);
        }
      }
    }
    assert.ok(cruza > 8, `LOD${lod}: a ponte não cruza o vão`);
    assert.ok(Math.abs(topo - (PAR.ponte.cota + 1.2)) < 0.3, `LOD${lod}: o guarda-corpo do jardim a ${topo} m`);
    // a cachoeira da fenda e os dutos da v2 saíram: o par não tem efeitos de água
    assert.equal(p.efeitos.triangulos, 0);
  }
  const b = caixaDe(malhaSombraPar());
  assert.ok(b[0] >= -54 && b[3] <= 54, 'sombra do par dentro das torres');
});

test('torres: pouso do helicóptero no centro do heliponto da Blade, no mundo, dentro da gleba', () => {
  const p = torreParaMundo(TORRE_POSICAO, HELIPONTO_LOCAL.x, HELIPONTO_LOCAL.y, HELIPONTO_LOCAL.z);
  assert.ok(Math.abs(p.x - POUSO.x) < 1e-6 && Math.abs(p.z - POUSO.z) < 1e-6 && p.y === 500);
  assert.ok(pontoNoPoligono(POUSO.x, POUSO.z, GLEBA_ENVELOPE.contorno));
  // a TORRE_POSICAO é a Blade do par, 32 m a oeste-noroeste do centro do pódio
  const [blade] = torresDoPar(A.torre);
  assert.ok(Math.abs(TORRE_POSICAO.x - blade.x) < 0.01 && Math.abs(TORRE_POSICAO.z - blade.z) < 0.01);
  assert.ok(Math.abs(raioDe(TORRE_POSICAO.x, TORRE_POSICAO.z) - 32) < 0.01);
  assert.deepEqual([A.torre.x, A.torre.z], [CX, CZ], 'o par no centro do pódio');
});

test('torres: malhas determinísticas (a mesma entrada dá os mesmos números)', () => {
  const a = malhasPar({ nivel: 2, lod: 0 });
  const b = malhasPar({ nivel: 2, lod: 0 });
  assert.deepEqual(a.opaco.p, b.opaco.p);
  assert.deepEqual(a.vidro.c, b.vidro.c);
  const r1 = malhasDoPlano('A', { chao: chaoPlano });
  const r2 = malhasDoPlano('A', { chao: chaoPlano });
  assert.deepEqual(r1.comum.vidro.p, r2.comum.vidro.p);
  assert.deepEqual(r1.arvores, r2.arvores);
});

test('torres: LOD0 só de perto (aletas e montantes finos não fazem moiré) e luz da noite calibrada para a R1a', () => {
  const ordem = ['leve', 'media', 'alta', 'ultra'];
  for (let i = 1; i < ordem.length; i++) assert.ok(DIST_LOD0[ordem[i]] > DIST_LOD0[ordem[i - 1]], 'distâncias crescem com o perfil');
  const pixel = (d) => (2 * d * Math.tan((20 * Math.PI) / 180)) / 1080;
  assert.ok(TL.aletas.espessura / pixel(DIST_LOD0.media) >= 0.5);
  const tela = (v) => v * LUZ_NOITE.exposicaoNoite;
  assert.ok(tela(LUZ_NOITE.janela) > 0.8 && tela(LUZ_NOITE.janela) < 2, `janela ${tela(LUZ_NOITE.janela)}`);
  assert.ok(tela(LUZ_NOITE.forro) > tela(LUZ_NOITE.janela) && tela(LUZ_NOITE.forro) < 4);
  assert.ok(tela(LUZ_NOITE.lanterna) > tela(LUZ_NOITE.forro));
  assert.ok(tela(LUZ_NOITE.aro) > 4 && tela(LUZ_NOITE.aro) < 16);
  assert.ok(tela(LUZ_NOITE.led) > 1.5 && tela(LUZ_NOITE.led) < 4, `faixa de LED ${tela(LUZ_NOITE.led)}`);
  // as marquises de 0,5 m saem do shader para a geometria quando cobrem ~meio pixel
  for (const perfil of ['media', 'alta', 'pc']) assert.ok(0.5 / pixel(DIST_PARTES_LOD0[perfil]) >= 0.45, perfil);
});

// ------------------------------------------------------------------------------------------------ programas (D66)

/** Contexto falso de render (sem WebGL): o bastante para montar materiais, o par e o aquecimento. */
function ctxFalso() {
  return {
    ganchos,
    cena: { environment: null },
    camera: new THREE.PerspectiveCamera(40, 1, 0.5, 20000),
    perfil: { id: 'alta' },
    medidas: { familia: (o) => o },
    sombra: { projetor: (o) => o, soltar() {}, marcar() {} },
    horaDoCeu: () => 17.5,
    sim: null,
  };
}

/** Fontes do programa que o three montaria para um material (o onBeforeCompile num shader da biblioteca). */
function fontesDoPrograma(mat) {
  const base = mat.isShaderMaterial ? { vertexShader: mat.vertexShader, fragmentShader: mat.fragmentShader } : THREE.ShaderLib.standard;
  const shader = { uniforms: {}, defines: {}, vertexShader: base.vertexShader, fragmentShader: base.fragmentShader };
  mat.onBeforeCompile?.(shader, null);
  return `${shader.vertexShader}\n//--\n${shader.fragmentShader}\n//--\n${JSON.stringify(shader.defines)}`;
}

test('programas: nenhum material da Arcologia muda de programa entre o dia, a noite, os LODs e o fantasma (D66)', () => {
  const ctx = ctxFalso();
  const m = materiais(ctx);
  const lista = [...m.lista];
  assert.equal(materiais(ctx), m);
  // um material por tipo: o vidro (anéis inclusive), o opaco, a água que cai e os jatos
  assert.deepEqual(new Set(lista.map((x) => x.name)), new Set(['arcologia:vidro', 'arcologia:opaco', 'arcologia:cascata', 'arcologia:jato']));
  const grupos = new Map();
  for (const x of lista) {
    const chave = x.customProgramCacheKey();
    assert.ok(Object.values(CHAVES).some((c) => chave.startsWith(c)), `${x.name}: chave ${chave}`);
    const g = grupos.get(x.name) ?? [];
    g.push({ chave, fonte: fontesDoPrograma(x) });
    grupos.set(x.name, g);
  }
  for (const [nome, g] of grupos) {
    for (const v of g) {
      assert.equal(v.chave, g[0].chave, `${nome}: chaves diferentes entre variantes`);
      assert.equal(v.fonte, g[0].fonte, `${nome}: código diferente entre variantes`);
    }
  }
  assert.ok(grupos.get('arcologia:vidro').length >= 4, 'vidro do LOD0, do LOD1 e os das torres');
  // o dia, a noite, o LOD por setor e o fantasma: só uniformes
  const versoes = lista.map((x) => x.version);
  const chaves = lista.map((x) => x.customProgramCacheKey());
  for (const [env, noite] of [[null, 0], [null, 1], [{ isTexture: true }, 0], [{ isTexture: true }, 1], [null, 0.5]]) {
    ctx.cena.environment = env;
    atualizarArcologia(ctx, 1000 * noite, { noite, hora: noite ? 21 : 12 });
    assert.equal(UNIFORMES.uNoite.value, noite);
  }
  for (let s = 0; s < SETORES; s++) UNIFORMES.uLodSetor.value[s >> 2].setComponent(s & 3, s % 2);
  for (let s = 0; s < SETORES; s++) UNIFORMES.uLodSetor.value[s >> 2].setComponent(s & 3, 0);
  assert.deepEqual(lista.map((x) => x.version), versoes, 'needsUpdate em tempo de jogo recompila');
  assert.deepEqual(lista.map((x) => x.customProgramCacheKey()), chaves);
  for (const x of lista) assert.equal(x.envMap, null, `${x.name}: envMap próprio (o reflexo é o da cena)`);
  for (const x of [m.cascata, m.jato]) assert.ok(x.side !== THREE.DoubleSide || x.forceSinglePass, `${x.name}: duas passadas por quadro`);
  // o fantasma é um programa só, com a noite no uniforme
  const f = materialFantasma(ganchos);
  const antes = fontesDoPrograma(f);
  f.uniforms.uNoiteF.value = 1;
  assert.equal(fontesDoPrograma(f), antes);
  f.dispose();
  // o uniforme dos setores cabe: 20 setores (16 trechos de anel, 2 ovais, 1 reserva, o pódio)
  assert.equal(UNIFORMES.uLodSetor.value.length * 4, SETORES);
  assert.ok(Math.max(...Object.values(SETOR_OVAL)) < SETORES);
  UNIFORMES.uNoite.value = 0;
  descartarMateriais(ctx);
});

test('programas: o par usa só o conjunto fixo, trocar o perfil refaz a geometria e nunca solta o programa', () => {
  const ctx = ctxFalso();
  const m = materiais(ctx);
  const antes = [...m.lista];
  const usados = (g) => {
    const s = new Set();
    g.traverse((o) => o.material && s.add(o.material));
    return s;
  };
  for (const perfil of ['media', 'alta', 'pc']) {
    ctx.perfil = { id: perfil };
    for (const t of [criarPar(ctx), criarTorre(ctx)]) {
      for (const x of usados(t.grupo)) assert.ok(m.lista.has(x), `${x.name} fora do conjunto fixo`);
      t.corte(100);
      t.corte();
      t.descartar();
    }
  }
  assert.deepEqual([...m.lista], antes, 'a lista de materiais não muda');
  let soltos = 0;
  for (const x of antes) x.addEventListener('dispose', () => soltos++);
  const par = criarPar(ctx);
  assert.equal(par.triangulosPorTorre.length, 2);
  assert.deepEqual(par.triangulosPorTorre.map((t) => t.nome), ['Blade Tower', 'Legacy Tower']);
  par.descartar();
  assert.equal(soltos, 0, 'descartar o par soltou um material (o programa sairia e compilaria de novo)');
  descartarMateriais(ctx);
});

test('programas: o aquecimento desenha cada material da Arcologia na carga (o dos jatos instanciado) e depois some', () => {
  const ctx = ctxFalso();
  const m = materiais(ctx);
  const lista = [...m.lista, materialAgua(ganchos), materialFantasma(ganchos)];
  const a = criarAquecimento(ctx, lista);
  assert.equal(a.grupo.children.length, lista.length);
  for (const o of a.grupo.children) {
    assert.equal(o.frustumCulled, false);
    if (o.material.name === 'arcologia:jato') assert.ok(o.isInstancedMesh && o.geometry.getAttribute('aJato'), 'jato sem instância');
  }
  assert.equal(a.quadro(), false);
  ctx.cena.environment = { isTexture: true };
  assert.equal(a.quadro(), true);
  assert.equal(a.quadro(), true);
  assert.equal(a.quadro(), false);
  assert.ok(a.feito && !a.grupo.visible);
  a.descartar();
  descartarMateriais(ctx);
});

// ------------------------------------------------------------------------------------------------ o plano (dados)

test('plano: só a sede v3 (o A), com as partes da D89 em ordem e o nome em inglês de cada uma', () => {
  assert.deepEqual(Object.keys(PLANOS), ['A']);
  assert.equal(PLANO_ESCOLHIDO, 'A');
  assert.equal(A.nome, 'Park of Future Dreams');
  assert.deepEqual([...PARTES_ORDEM], ['torre', 'lago', 'meridian', 'horizon', 'codex', 'helix', 'compass', 'parque']);
  assert.deepEqual(A.partes.map((p) => p.id), [...PARTES_ORDEM]);
  for (const p of A.partes) {
    assert.ok(/^[A-Z][A-Za-z ]+$/.test(p.nome), `${p.id}: nome em inglês (${p.nome})`);
    assert.equal(PARTES_NOMES[p.id], p.nome);
  }
  assert.match(PARTES_NOMES.torre, /Blade Tower/);
  assert.match(PARTES_NOMES.torre, /Legacy Tower/);
  assert.equal(PARTES_NOMES.meridian, 'Meridian Ring');
  assert.equal(PARTES_NOMES.horizon, 'Horizon Ring');
  assert.equal(PARTES_NOMES.codex, 'Codex Tower');
  assert.equal(PARTES_NOMES.helix, 'Helix Labs');
  assert.equal(PARTES_NOMES.compass, 'Compass Tower');
  // o lago com as Dream Falls e as fontes; o parque com as Supertrees; nada da v2 (cúpula, Biblioteca, moradia)
  const tipos = (parte) => A.partes.find((p) => p.id === parte).pecas.map((p) => p.tipo);
  assert.deepEqual(tipos('lago').sort(), ['cachoeira', 'fontes', 'lago', 'queda', 'queda', 'queda', 'queda', 'reservatorio']);
  assert.equal(A.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'cachoeira').nome, 'Dream Falls');
  assert.equal(A.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'lago').nome, 'Mirror Lake');
  assert.equal(reservatorioDe(A).nome, 'Mirror Lake');
  assert.ok(tipos('parque').filter((t) => t === 'supertree').length >= 9);
  for (const t of A.partes.flatMap((p) => p.pecas).map((p) => p.tipo)) assert.ok(t === 'torre' || t === 'reservatorio' || PECAS[t], `peça ${t} sem desenho`);
  assert.ok(A.referencias.includes('Apple Park') && A.referencias.includes('McLaren Technology Centre'));
});

test('plano: Horizon Ring em 8 trechos com id próprio entre as avenidas, 2 na primeira fase (D89)', () => {
  assert.equal(TRECHOS_HORIZON.length, 8);
  // cada trecho leva o anel, o pedaço do Halo Lake e a Canopy Bridge que pousa nele (D97)
  const todas = A.partes.find((p) => p.id === 'horizon').pecas;
  assert.equal(todas.filter((p) => p.tipo === 'bacia').length, 8);
  assert.equal(todas.filter((p) => p.tipo === 'ponte').length, 8);
  const horizon = todas.filter((p) => p.tipo === 'anel');
  assert.deepEqual(horizon.map((p) => p.id), TRECHOS_HORIZON.map((t) => t.id));
  assert.equal(new Set(horizon.map((p) => p.id)).size, 8);
  for (const [k, p] of horizon.entries()) {
    assert.equal(p.de, AVENIDAS[k]);
    assert.equal(p.ate, AVENIDAS[k] + 45);
    assert.deepEqual([...p.portais].sort((a, b) => a - b), [p.de, p.ate]);
    assert.equal(setorDoAnel(p, p.de + 10), k);
  }
  assert.equal(TRECHOS_HORIZON.filter((t) => t.fase === 1).length, 2);
  assert.equal(TRECHOS_HORIZON.filter((t) => t.fase === 2).length, 6);
});

test('plano: os anéis (raios, fundos, alturas, andares) e o pódio, o lago e a floresta (D88)', () => {
  const medidas = ({ raio, fundo, altura, andares }) => ({ raio, fundo, altura, andares });
  assert.deepEqual(medidas(HORIZON), { raio: 729, fundo: 60, altura: 160, andares: 25 });
  assert.deepEqual(medidas(MERIDIAN), { raio: 442.5, fundo: 50, altura: 120, andares: 19 });
  // a faixa de LED é dado do anel (D93): 9 andares no Horizon e 7 no Meridian, no meio da altura
  assert.deepEqual({ ...HORIZON.led }, { y0: 51.2, y1: 108.8, andares: 9 });
  assert.deepEqual({ ...MERIDIAN.led }, { y0: 37.9, y1: 82.1, andares: 7 });
  const [meridian] = pecasDe('anel').filter((p) => p.id === 'meridian');
  assert.deepEqual([meridian.de, meridian.ate], [0, 360]);
  assert.deepEqual([...meridian.portais].sort((a, b) => a - b), [...AVENIDAS]);
  for (const p of pecasDe('anel')) {
    assert.deepEqual([p.cx, p.cz], [CX, CZ]);
    assert.deepEqual([p.vao, p.pe], [40, 18]);
    // a faixa de LED de vários andares (ímpar) no meio da altura, entre duas marquises
    const pe = p.altura / p.andares;
    assert.ok(Math.abs((p.led.y0 + p.led.y1) / 2 - p.altura / 2) < 0.06 && Math.abs(p.led.y1 - p.led.y0 - p.led.andares * pe) < 0.12);
    assert.equal(p.led.andares % 2, 1);
  }
  assert.deepEqual({ ...PODIO }, { raio: 84, altura: 40 });
  const [podio] = pecasDe('podio');
  assert.deepEqual([podio.raio, podio.altura, podio.escadas.length], [84, 40, 4]);
  assert.deepEqual([LAGO.r0, LAGO.r1], [84, 99]);
  assert.ok(FLORESTA.r0 > LAGO.r1 && Math.abs(FLORESTA.r1 - 114) < 1e-6);
  const [falls] = pecasDe('cachoeira');
  assert.deepEqual([...falls.angulos], [60, 240]);
  assert.equal(falls.altura, 40);
  // as 4 Dream Falls de 120 m do Meridian Ring, nas diagonais (D97)
  const quedas = pecasDe('queda');
  assert.deepEqual(quedas.map((q) => q.angulo), [67.5, 157.5, 247.5, 337.5].map((g) => g));
  for (const q of quedas) {
    assert.equal(q.altura, 120);
    assert.ok(q.largura >= 40 && q.largura <= 60);
  }
});

test('plano: Codex (300 m), Helix e Compass (180 m) entre os anéis, no raio 583, no eixo de três avenidas (a do portão norte fica livre), com pórtico', () => {
  const alturas = { codex: 300, helix: 180, compass: 180 };
  const angulos = { codex: 180, helix: 315, compass: 90 };
  for (const [id, h] of Object.entries(alturas)) {
    const [p] = A.partes.find((q) => q.id === id).pecas;
    assert.equal(p.altura, h, id);
    const r = raioDe(p.x, p.z);
    assert.ok(Math.abs(r - 583) < 1, `${id}: raio ${r}`);
    const a = anguloDe(p.x, p.z);
    assert.ok(Math.abs(difG(a, angulos[id])) < 0.1, `${id}: ${a.toFixed(1)} graus (eixo: ${angulos[id]})`);
    assert.ok(AVENIDAS.includes(angulos[id]) && angulos[id] !== 270, `${id}: avenida do eixo`);
    assert.deepEqual([p.passagem.vao, p.passagem.pe], [40, 18], `${id}: pórtico de 40 x 18 m`);
    const lateral = Math.min(...AVENIDAS.map((g) => Math.abs(r * Math.sin((difG(a, g) * Math.PI) / 180)) + (Math.abs(difG(a, g)) > 90 ? 1e9 : 0)));
    assert.ok(lateral < 0.5, `${id}: a ${lateral.toFixed(1)} m do eixo de uma avenida`);
    // cabe entre o Meridian e o Horizon, com a calçada
    const meia = p.tipo === 'codex' ? 32 : p.a + 4;
    assert.ok(r - meia > MERIDIAN.raio + MERIDIAN.fundo / 2 && r + meia < HORIZON.raio - HORIZON.fundo / 2, `${id} encosta num anel`);
  }
});

test('plano: portões nas 8 avenidas a cada 45 graus, na borda do anel viário; vias internas com a flag ARCOLOGIA', () => {
  assert.deepEqual([...AVENIDAS], [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.equal(A.portoes.length, 8);
  for (const [k, g] of A.portoes.entries()) {
    assert.equal(g.angulo, AVENIDAS[k]);
    assert.ok(Math.abs(raioDe(g.x, g.z) - GLEBA_ENVELOPE.raio) < 0.5, `portão ${g.id} fora da borda`);
    assert.ok(Math.abs(difG(anguloDe(g.x, g.z), g.angulo)) < 0.01);
  }
  assert.ok(A.portoes.some((g) => g.id === 'norte' && g.angulo === 270), 'o portão norte, onde a primeira avenida chega');
  assert.ok(ANEL_VIARIO.raio + ANEL_VIARIO.largura / 2 <= GLEBA_ENVELOPE.raio);
  const anel = A.vias.filter((v) => v.anel);
  const radiais = A.vias.filter((v) => v.radial);
  const portao = A.vias.filter((v) => v.portao);
  assert.deepEqual([anel.length, radiais.length, portao.length], [8, 8, 8]);
  for (const v of A.vias) {
    assert.equal(v.flags & ARESTA.ARCOLOGIA, ARESTA.ARCOLOGIA);
    for (let i = 0; i < v.pontos.length; i += 2) assert.ok(raioDe(v.pontos[i], v.pontos[i + 1]) <= GLEBA_ENVELOPE.raio + 0.5);
  }
  for (const v of anel) for (let i = 0; i < v.pontos.length; i += 2) assert.ok(Math.abs(raioDe(v.pontos[i], v.pontos[i + 1]) - ANEL_VIARIO.raio) < 0.5);
  // as avenidas radiais vão do anel viário até a praça do pódio
  for (const v of radiais) {
    assert.ok(Math.abs(raioDe(v.pontos[0], v.pontos[1]) - ANEL_VIARIO.raio) < 0.5);
    assert.ok(Math.abs(raioDe(v.pontos[2], v.pontos[3]) - A.paisagem.praca.r1) < 0.5);
  }
});

test('plano: a câmera da Arcologia enquadra o disco inteiro e a cava do Mirror Lake é a forma do aplainar (D5)', () => {
  assert.ok(Math.hypot(CAMERA_ARCOLOGIA.x - CX, CAMERA_ARCOLOGIA.z - CZ) < 100, 'a câmera mira a sede');
  // na distância e no campo de visão do jogo (40 graus), o disco de 1,6 km cabe na tela
  assert.ok(2 * Math.atan(GLEBA_ENVELOPE.raio / CAMERA_ARCOLOGIA.dist) < (40 * Math.PI) / 180, 'o disco não cabe');
  const f = cavaDoPlano('A', 12, 7);
  assert.equal(f.tipo, 'cava');
  assert.equal(f.ref, 7);
  assert.ok(f.cota < f.nivel && f.nivel < 12, 'leito abaixo da água, água abaixo da gleba');
  // o Mirror Lake grande (150 a uns 330 m): a água em volta da praça do pódio; o pódio, o anel d'água (uma bacia à
  // altura do chão) e a floresta ficam fora da cava, e as ilhas são furos dela
  const noLago = (r, g) => pontoNoPoligono(CX + r * Math.cos((g * Math.PI) / 180), CZ + r * Math.sin((g * Math.PI) / 180), f.contorno);
  assert.ok(noLago(200, 90) && noLago(230, 180) && noLago(260, 350), 'água no lago');
  assert.ok(!noLago(0, 0) && !noLago(91, 0) && !noLago(120, 0), 'o pódio, o anel d\'água e a floresta não são cavados');
  assert.ok(!noLago(450, 90) && !noLago(MIRROR_R_FORA, 90), 'fora da margem');
  for (const ilha of ILHAS) assert.ok(!pontoNoPoligono(ilha.x, ilha.z, f.contorno), 'a ilha é um furo');
  const [ax, az] = pontoNaAgua(reservatorioDe(A));
  assert.ok(Number.isFinite(ax) && Number.isFinite(az));
});

test('gleba (D90): o disco da sede inteiro na área inicial e em terra, a 40 m ou mais do mar, da lagoa e da baía', () => {
  assert.deepEqual([...GLEBA_ENVELOPE.centro], [...SEDE_CENTRO]);
  assert.ok(SEDE_CENTRO[0] >= 150 && SEDE_CENTRO[0] <= 200 && Math.abs(SEDE_CENTRO[1] - 190) < 1, 'centro perto de (150, 190)');
  const [[i0, j0], [i1, j1]] = MAPA_HELDOPOLIS.inicio;
  const L = MAPA_HELDOPOLIS.ladrilho;
  const [x0, z0] = [MAPA_HELDOPOLIS.origem[0] + i0 * L, MAPA_HELDOPOLIS.origem[1] + j0 * L];
  const [x1, z1] = [MAPA_HELDOPOLIS.origem[0] + (i1 + 1) * L, MAPA_HELDOPOLIS.origem[1] + (j1 + 1) * L];
  assert.deepEqual([x0, z0, x1, z1], [-1024, -1536, 2048, 1024]);
  const T = gerarTerreno();
  let ruins = 0;
  let ex = null;
  for (let a = 0; a < 360; a += 1) {
    for (const d of [0, 20, 40]) {
      const x = CX + (GLEBA_ENVELOPE.raio + d) * Math.cos((a * Math.PI) / 180);
      const z = CZ + (GLEBA_ENVELOPE.raio + d) * Math.sin((a * Math.PI) / 180);
      if (d === 0 && !(x > x0 && x < x1 && z > z0 && z < z1)) ruins++;
      if (aguaEm(T, x, z) !== AGUA.TERRA) {
        ruins++;
        ex ??= [Math.round(x), Math.round(z), aguaEm(T, x, z)];
      }
    }
  }
  assert.equal(ruins, 0, `gleba na água ou fora da área inicial (${ex})`);
  // a borda de fora do anel viário a 40 m ou mais da areia da praia (a faixa da planície junto da costa) e longe dos
  // morros do norte: nenhum relevo de maciço até 10 m além dela (o platô não corta o pé do Mirante nem o da Pedreira)
  const rAnel = ANEL_VIARIO.raio + ANEL_VIARIO.largura / 2;
  const praia = MAPA_HELDOPOLIS.planicie.larguraPraia;
  let areia = Infinity;
  let morro = 0;
  for (let a = 0; a < 360; a += 0.5) {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    areia = Math.min(areia, costaEm(T, CX + rAnel * c, CZ + rAnel * s) - praia);
    for (const d of [0, 10]) {
      const i = Math.round((CX + (rAnel + d) * c - T.origem[0]) / T.passo);
      const j = Math.round((CZ + (rAnel + d) * s - T.origem[1]) / T.passo);
      morro = Math.max(morro, T.campos.relevo[j * T.n + i]);
    }
  }
  assert.ok(areia >= 40, `o anel viário a ${areia.toFixed(0)} m da areia`);
  assert.ok(morro <= 0.5, `o anel viário encosta num morro (${morro.toFixed(1)} m de relevo)`);
  // dentro do disco, nenhuma água além do Mirror Lake (que a cava faz)
  for (let r = 0; r < GLEBA_ENVELOPE.raio; r += 40) {
    for (let a = 0; a < 360; a += 10) assert.equal(aguaEm(T, CX + r * Math.cos((a * Math.PI) / 180), CZ + r * Math.sin((a * Math.PI) / 180)), AGUA.TERRA);
  }
});

test('mata do parque: o anel de floresta, os maciços e os bosques; abertos nos anéis, nas avenidas e na praça', () => {
  assert.equal(mataDaSede(CX + 900, CZ), null, 'fora do disco');
  assert.ok(mataDaSede(CX + 107, CZ) > 0.9, 'o anel de floresta');
  assert.equal(mataDaSede(CX + HORIZON.raio, CZ + 2), 0, 'sob o Horizon Ring');
  assert.equal(mataDaSede(CX + MERIDIAN.raio + 1, CZ + 3), 0, 'sob o Meridian Ring');
  assert.equal(mataDaSede(CX + 130, CZ + 30), 0, 'a praça');
  for (const a of AVENIDAS) for (const r of [200, 600, 770]) assert.equal(mataDaSede(CX + r * Math.cos((a * Math.PI) / 180), CZ + r * Math.sin((a * Math.PI) / 180)), 0, `avenida de ${a} graus`);
  let bosque = 0;
  for (let a = 5; a < 360; a += 10) if (mataDaSede(CX + 590 * Math.cos((a * Math.PI) / 180), CZ + 590 * Math.sin((a * Math.PI) / 180)) > 0.5) bosque++;
  assert.ok(bosque > 12, 'bosque entre os anéis');
});

// ------------------------------------------------------------------------------------------------ o plano (malhas)

/** Todos os vértices das malhas de um resultado de malhasDoPlano (e as posições dos jatos e das árvores). */
function* vertices(r) {
  const ms = [r.comum.vidro, r.comum.opaco, ...r.setores.values(), r.agua, r.efeitos, r.fantasma.vidro, r.fantasma.opaco];
  for (const m of ms) for (let i = 0; i < m.p.length; i += 3) yield [m.p[i], m.p[i + 1], m.p[i + 2]];
  for (const j of r.jatos) yield [j.x, 0, j.z];
  for (const a of r.arvores) yield [a.x, a.y, a.z];
}

test('plano: malhas sem NaN e tudo dentro da gleba (a sede inteira, com a paisagem e as vias internas)', () => {
  const r = malhasDoPlano('A', { chao: chaoPlano, prontas: 'todas' });
  for (const [nome, m] of [['vidro', r.comum.vidro], ['opaco', r.comum.opaco], ['agua', r.agua], ['efeitos', r.efeitos], ...[...r.setores].map(([s, m]) => [`setor ${s}`, m])]) conferirMalha(m, nome);
  assert.ok(r.agua.triangulos > 0, 'sem água');
  assert.equal(r.setores.size, 19, '16 trechos de anel, 2 ovais e o parque');
  for (const c of r.caixas) assert.ok(PARTES_ORDEM[c.idx] === c.parte, `idx da parte ${c.parte}`);
  assert.equal(new Set(r.caixas.filter((c) => c.trecho).map((c) => c.trecho)).size, 8, 'caixas dos 8 trechos do Horizon Ring');
  let fora = 0;
  let ex = null;
  for (const [x, , z] of vertices(r)) {
    if (raioDe(x, z) > GLEBA_ENVELOPE.raio + 3) {
      fora++;
      ex ??= [x.toFixed(0), z.toFixed(0)];
    }
  }
  assert.equal(fora, 0, `${fora} vértices fora da gleba (${ex})`);
  // as torres do par também ficam no pódio
  const p = malhasPar({ nivel: 2, lod: 0 });
  const b = caixaDe(p.vidro, p.opaco);
  for (const [x, z] of [[b[0], b[2]], [b[3], b[2]], [b[3], b[5]], [b[0], b[5]]]) assert.ok(Math.hypot(x, z) < PODIO.raio - 10, 'o par sai do pódio');
});

// o vidro curvo do anel: o de fora e o de dentro (que recua em terraços, os Hanging Gardens da D97)
const ehVidroDeAnel = (c) => c === VIDRO.anel || c === VIDRO.anelDentro;

test('anéis: vidro curvo nos raios de fora e de dentro, altura do anel, uma marquise em cada laje e pórticos de 40 x 18 m', () => {
  for (const p of [pecasDe('anel').find((q) => q.id === 'meridian'), pecasDe('anel').find((q) => q.id === 'horizon.6')]) {
    const rF = p.raio + p.fundo / 2;
    const rD = p.raio - p.fundo / 2;
    const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
    montarParte({ id: p.id, pecas: [p] }, d);
    conferirMalha(d.vidro, `${p.id} vidro`);
    let rMax = 0;
    let rMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < d.vidro.p.length; i += 3) {
      if (!ehVidroDeAnel(d.vidro.c[(i / 3) * 4])) continue;
      const r = raioDe(d.vidro.p[i], d.vidro.p[i + 2]);
      rMax = Math.max(rMax, r);
      rMin = Math.min(rMin, r);
    }
    for (let i = 0; i < d.opaco.p.length; i += 3) yMax = Math.max(yMax, d.opaco.p[i + 1] - COTA);
    assert.ok(Math.abs(rMax - rF) < 0.01 && Math.abs(rMin - rD) < 0.2, `${p.id}: vidro de ${rMin.toFixed(1)} a ${rMax.toFixed(1)}`);
    assert.ok(yMax >= p.altura && yMax < p.altura + 1, `${p.id}: ${yMax} m de altura`);
    // vidro curvo: a normal de cada vértice é radial (não facetada)
    let pior = 1;
    for (let i = 0; i < d.vidro.p.length; i += 3) {
      if (!ehVidroDeAnel(d.vidro.c[(i / 3) * 4])) continue;
      const dx = d.vidro.p[i] - CX;
      const dz = d.vidro.p[i + 2] - CZ;
      const l = Math.hypot(dx, dz);
      pior = Math.min(pior, Math.abs((dx * d.vidro.n[i] + dz * d.vidro.n[i + 2]) / l));
    }
    assert.ok(pior > 0.999, `${p.id}: normal do vidro fora da radial (${pior})`);
    // nos pórticos, nada de vidro do anel abaixo de 18 m dentro da passagem de 40 m
    for (const a of p.portais) {
      const ux = Math.cos((a * Math.PI) / 180);
      const uz = Math.sin((a * Math.PI) / 180);
      for (let i = 0; i < d.vidro.p.length; i += 3) {
        const dx = d.vidro.p[i] - CX;
        const dz = d.vidro.p[i + 2] - CZ;
        const radial = dx * ux + dz * uz;
        const lateral = Math.abs(-dx * uz + dz * ux);
        if (radial > rD - 1 && radial < rF + 1 && lateral < p.vao / 2 - 0.3 && d.vidro.c[(i / 3) * 4] === VIDRO.anel) {
          assert.ok(d.vidro.p[i + 1] - COTA >= p.pe - 1e-6, `${p.id}: vidro no pórtico de ${a} graus a ${(d.vidro.p[i + 1] - COTA).toFixed(1)} m`);
        }
      }
    }
    // LOD0: a marquise branca em cada laje (menos as da faixa de LED), por fora e por dentro, no setor certo
    const setores = new Map();
    const d0 = { chao: chaoPlano, ...malhasNovas(), lod: 0, setor: (s) => setores.get(s) ?? setores.set(s, { opaco: new Malha('opaco') }).get(s) };
    montarParte({ id: p.id, pecas: [p] }, d0);
    const pe = p.altura / p.andares;
    const meio = (p.led.y0 + p.led.y1) / 2;
    let lajes = 0;
    for (let l = 1; l < p.andares; l++) {
      const yl = l * pe;
      if (Math.abs(yl - meio) < faixaLed(pe, p.andares) - 0.01) continue;
      lajes++;
      let n = 0;
      for (const { opaco } of setores.values()) for (let i = 0; i < opaco.p.length; i += 3) if (Math.abs(opaco.p[i + 1] - COTA - yl - 0.25) < 1e-6 && opaco.n[i + 1] > 0.99) n++;
      assert.ok(n > 40, `${p.id}: marquise da laje ${l}`);
    }
    // todas as lajes menos as de dentro da faixa de LED (um terço dos andares, D93)
    assert.equal(lajes, p.andares - andaresLed(p.andares), `${p.id}: ${lajes} lajes com marquise`);
    assert.equal(d0.vidro.triangulos, 0, 'o LOD0 só traz as marquises');
    assert.ok(PECAS_COM_LOD.has('anel') && PECAS_COM_LOD.has('oval'));
  }
});

test('anéis: o teto do Horizon Ring com a pista de 4,6 km, as quadras e as piscinas; o do Meridian com o jardim', () => {
  const pad = (m, k) => {
    let n = 0;
    for (let i = 0; i < m.c.length; i += 4) if ((Math.round(m.c[i + 3]) & 15) === k) n++;
    return n;
  };
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'horizon', pecas: pecasDe('anel').filter((p) => p.id.startsWith('horizon.')) }, d);
  assert.ok(pad(d.opaco, 9) > 100, 'pista');
  assert.ok(pad(d.opaco, 10) > 40, 'quadras');
  // no fantasma o teto é só o véu da cobertura: nada das quadras, das piscinas e da pista sobreposto a ele
  const f = { chao: chaoPlano, ...malhasNovas(), lod: 1, fantasma: true };
  montarParte({ id: 'horizon', pecas: pecasDe('anel').filter((p) => p.id.startsWith('horizon.')) }, f);
  for (const k of [4, 9, 10]) assert.equal(pad(f.opaco, k), 0, `padrão ${k} no fantasma do teto`);
  // a pista no eixo do anel dá a volta inteira: 2πr de uns 4,6 km
  assert.ok(Math.abs(2 * Math.PI * HORIZON.raio - 4600) < 50);
  const m = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'meridian', pecas: pecasDe('anel').filter((p) => p.id === 'meridian') }, m);
  assert.equal(pad(m.opaco, 9), 0, 'sem pista no Meridian');
  assert.ok(pad(m.opaco, 3) > 100, 'jardim no teto do Meridian');
});

test('pódio e água: o tambor de 84 m e 40 m, as Dream Falls de 40 m para o lago e as fontes dançando na água', () => {
  const [podio] = pecasDe('podio');
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'torre', pecas: [podio] }, d);
  let rMax = 0;
  let yMax = -Infinity;
  for (const m of [d.vidro, d.opaco]) {
    for (let i = 0; i < m.p.length; i += 3) {
      const r = raioDe(m.p[i], m.p[i + 2]);
      if (r < PODIO.raio + 2) yMax = Math.max(yMax, m.p[i + 1] - COTA);
    }
  }
  // o tambor de vidro curvo (o das escadas rolantes é outro tipo)
  for (let i = 0; i < d.vidro.p.length; i += 3) if (d.vidro.c[(i / 3) * 4] === VIDRO.anel) rMax = Math.max(rMax, raioDe(d.vidro.p[i], d.vidro.p[i + 2]));
  assert.ok(Math.abs(rMax - PODIO.raio) < 0.7, `pódio de raio ${rMax}`);
  // a praça a 40 m (com o guarda-corpo) e os tubos das escadas rolantes chegando nela
  assert.ok(yMax >= PODIO.altura && yMax < PODIO.altura + 4.5, `pódio de ${yMax} m`);
  // as quedas: do topo do pódio à água, nos arcos de 60 e 240 graus
  const lago = A.partes.find((p) => p.id === 'lago');
  const e = { chao: chaoPlano, ...malhasNovas(), nivelAgua: COTA + LAGO.nivel, lod: 1 };
  montarParte({ id: 'lago', pecas: lago.pecas.filter((p) => p.tipo === 'cachoeira' || p.tipo === 'fontes') }, e);
  const b = caixaDe(e.efeitos);
  assert.ok(b[4] - (COTA + LAGO.nivel) >= 40 - 0.5, 'a queda tem 40 m');
  for (let i = 0; i < e.efeitos.p.length; i += 3) {
    const a = anguloDe(e.efeitos.p[i], e.efeitos.p[i + 2]);
    assert.ok(Math.abs(difG(a, 60)) <= 31 || Math.abs(difG(a, 240)) <= 31, `efeito fora das quedas, a ${a.toFixed(0)} graus`);
    assert.ok(raioDe(e.efeitos.p[i], e.efeitos.p[i + 2]) < LAGO.r1 + 14);
  }
  // as fontes: na água (entre o pódio e a borda), fora das quedas e das escadas rolantes
  assert.ok(e.jatos.length >= 64);
  for (const j of e.jatos) {
    const r = raioDe(j.x, j.z);
    assert.ok(r > LAGO.r0 + 2 && r < LAGO.r1 - 2, `jato a ${r.toFixed(1)} m`);
    const a = anguloDe(j.x, j.z);
    assert.ok(Math.abs(difG(a, 60)) > 28 && Math.abs(difG(a, 240)) > 28, 'jato na queda');
    for (const q of podio.escadas) assert.ok(Math.abs(difG(a, q)) > 5, 'jato na escada rolante');
  }
  assert.ok(FONTES.altura >= 50 && FONTES.altura <= 150, 'jatos à escala das torres');
  assert.equal(malhaJato().triangulos, 32);
});

test('torres do bosque: Codex de 300 m (vidro escuro facetado e o átrio de livros), Helix e Compass ovais de 180 m', () => {
  const h = {};
  for (const id of ['codex', 'helix', 'compass']) {
    const parte = A.partes.find((p) => p.id === id);
    const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
    montarParte(parte, d);
    conferirMalha(d.vidro, `${id} vidro`);
    conferirMalha(d.opaco, `${id} opaco`);
    const b = caixaDe(d.vidro, d.opaco);
    h[id] = b[4] - COTA;
    if (id === 'codex') {
      let escuro = 0;
      for (let i = 0; i < d.vidro.c.length; i += 4) if (d.vidro.c[i] === VIDRO.codex) escuro++;
      assert.ok(escuro > 100, 'vidro da Codex');
      let livros = 0;
      for (let i = 0; i < d.opaco.c.length; i += 4) if ((Math.round(d.opaco.c[i + 3]) & 15) === 11) livros++;
      assert.ok(livros > 50, 'o átrio de livros');
    } else {
      // a faixa de LED das ovais na altura da dos anéis (o centro da faixa do Horizon Ring)
      const [p] = parte.pecas;
      assert.deepEqual(p.led, pecasDe('anel').find((q) => q.id === 'horizon.1').led);
      let oval = 0;
      for (let i = 0; i < d.vidro.c.length; i += 4) if (d.vidro.c[i] === VIDRO.oval) oval++;
      assert.ok(oval > 50, `${id}: vidro oval`);
    }
  }
  assert.ok(Math.abs(h.codex - 300) < 0.5, `Codex com ${h.codex} m`);
  // a Helix com a lanterna de corte inclinado acima dos 180 m do corpo
  assert.ok(h.helix > 190 && h.helix < 205, `Helix com ${h.helix} m`);
  // a Compass com a agulha passa dos 180 m do corpo
  assert.ok(h.compass > 180 && h.compass < 230);
});

test('parque: Supertrees com o tronco de treliça e a copa em funil de nervuras (não cogumelo) e a passarela', () => {
  for (const p of pecasDe('supertree')) {
    assert.ok(raioDe(p.x, p.z) > A.paisagem.praca.r1 && raioDe(p.x, p.z) < MERIDIAN.raio - MERIDIAN.fundo / 2 - 20, 'Supertree fora do parque');
    assert.ok(p.altura >= 25 && p.altura <= 50);
  }
  const [s] = pecasDe('supertree');
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'parque', pecas: [s] }, d);
  // o funil: nada de tampa cheia no alto (de lado o céu passa entre as nervuras); a copa abre bem mais que o tronco
  let tampaTopo = 0;
  let rCopa = 0;
  for (let i = 0; i < d.opaco.p.length; i += 3) {
    const y = d.opaco.p[i + 1] - COTA;
    const r = Math.hypot(d.opaco.p[i] - s.x, d.opaco.p[i + 2] - s.z);
    if (y > s.altura * 0.95 && d.opaco.n[i + 1] > 0.99 && r < s.altura * 0.2) tampaTopo++;
    if (y > s.altura * 0.9) rCopa = Math.max(rCopa, r);
  }
  assert.equal(tampaTopo, 0, 'copa fechada (cogumelo)');
  assert.ok(rCopa > s.altura * 0.25, `copa de raio ${rCopa}`);
  // o holograma também é o esqueleto (o tronco, as nervuras e o aro), não um funil cheio: no meio da copa, entre as
  // nervuras, não passa superfície nenhuma
  const f = { chao: chaoPlano, ...malhasNovas(), lod: 1, fantasma: true };
  montarParte({ id: 'parque', pecas: [s] }, f);
  let veu = 0;
  const P = f.opaco.p;
  for (let t = 0; t < f.opaco.i.length; t += 3) {
    // o centro de cada triângulo da copa, longe de qualquer nervura (8, a cada 45 graus): a meio caminho entre duas
    const [v0, v1, v2] = [f.opaco.i[t], f.opaco.i[t + 1], f.opaco.i[t + 2]];
    const c = [0, 1, 2].map((e) => (P[3 * v0 + e] + P[3 * v1 + e] + P[3 * v2 + e]) / 3);
    const y = c[1] - COTA;
    const r = Math.hypot(c[0] - s.x, c[2] - s.z);
    const a = Math.atan2(c[2] - s.z, c[0] - s.x);
    const entre = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) < 0.2;
    if (y > s.altura * 0.7 && y < s.altura * 0.97 && r > s.altura * 0.08 && entre) veu++;
  }
  assert.equal(veu, 0, 'o holograma da Supertree é um funil cheio (cogumelo)');
  let luz = 0;
  for (let i = 0; i < d.opaco.c.length; i += 4) if (((Math.round(d.opaco.c[i + 3]) >> 4) & 15) === LUZ.arvoreLuz) luz++;
  assert.ok(luz > 100, 'a treliça acende à noite');
  const [pas] = pecasDe('passarela');
  assert.ok(pas.cota >= 20 && pas.cota <= 25);
});

// ------------------------------------------------------------------------------------------------ VIS1a (acabamento)

/** Padrão, classe de luz e luminância de cada vértice de uma malha opaca. */
const dadosOpaco = (m, i) => {
  const pk = Math.round(m.c[4 * i + 3]);
  return { pad: pk & 15, luz: (pk >> 4) & 15, lum: 0.2126 * m.c[4 * i] + 0.7152 * m.c[4 * i + 1] + 0.0722 * m.c[4 * i + 2] };
};

test('VIS1a: faixa de LED com um terço dos andares no terço do meio (D93), emoldurada por duas marquises, e a das ovais na mesma altura', () => {
  // um terço dos andares, ímpar (a faixa centrada cai entre duas lajes): 9 no Horizon Ring, 7 no Meridian Ring
  assert.equal(andaresLed(HORIZON.andares), 9);
  assert.equal(andaresLed(MERIDIAN.andares), 7);
  const peH = HORIZON.altura / HORIZON.andares;
  const peM = MERIDIAN.altura / MERIDIAN.andares;
  // Horizon de uns 53 a 107 m (aqui 51,2 a 108,8), Meridian de uns 40 a 80 m (37,9 a 82,1)
  assert.ok(Math.abs(HORIZON.altura / 2 - faixaLed(peH, HORIZON.andares) - 53) < 2.5 && Math.abs(HORIZON.altura / 2 + faixaLed(peH, HORIZON.andares) - 107) < 2.5);
  assert.ok(Math.abs(MERIDIAN.altura / 2 - faixaLed(peM, MERIDIAN.andares) - 40) < 2.5 && Math.abs(MERIDIAN.altura / 2 + faixaLed(peM, MERIDIAN.andares) - 80) < 2.5);
  for (const p of [pecasDe('anel').find((q) => q.id === 'meridian'), pecasDe('anel').find((q) => q.id === 'horizon.6')]) {
    const peA = p.altura / p.andares;
    const meio = (p.led.y0 + p.led.y1) / 2;
    const meia = faixaLed(peA, p.andares);
    assert.ok(Math.abs(meio - p.altura / 2) < 0.01, `${p.id}: a faixa no meio da altura`);
    // as bordas da faixa caem em lajes
    for (const yb of [meio - meia, meio + meia]) assert.ok(Math.abs(yb / peA - Math.round(yb / peA)) < 1e-6, `${p.id}: borda fora da laje`);
    const setores = new Map();
    const d0 = { chao: chaoPlano, ...malhasNovas(), lod: 0, setor: (k) => setores.get(k) ?? setores.set(k, { opaco: new Malha('opaco') }).get(k) };
    montarParte({ id: p.id, pecas: [p] }, d0);
    const temLaje = (yl) => [...setores.values()].some(({ opaco }) => {
      for (let i = 0; i < opaco.p.length; i += 3) if (Math.abs(opaco.p[i + 1] - COTA - yl - 0.25) < 1e-6 && opaco.n[i + 1] > 0.99) return true;
      return false;
    });
    // as lajes de dentro da faixa sem marquise; as duas das bordas com ela (a moldura da faixa)
    for (let yl = meio - meia + peA; yl < meio + meia - 0.01; yl += peA) assert.ok(!temLaje(yl), `${p.id}: marquise dentro da faixa a ${yl.toFixed(1)} m`);
    assert.ok(temLaje(meio - meia) && temLaje(meio + meia), `${p.id}: a faixa sem as marquises da borda`);
    // o shader do vidro sabe a faixa pelo centro (a parte inteira do dado), pelo pé-direito e pelos andares (vC.w)
    const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
    montarParte({ id: p.id, pecas: [p] }, d);
    const i = d.vidro.c.findIndex((_, k) => k % 4 === 0 && d.vidro.c[k] === VIDRO.anel);
    assert.equal(Math.floor(d.vidro.c[i + 1]), Math.floor(meio));
    assert.ok(Math.abs(d.vidro.c[i + 2] - peA) < 1e-6);
    assert.equal(Math.floor(d.vidro.c[i + 3] / 32), andaresLed(p.andares));
    assert.equal(d.vidro.c[i + 3] % 32, setorDoAnel(p, p.de + 1));
  }
  // as ovais: a faixa na mesma faixa de altura da do Horizon Ring (a régua de 6,4 m e os 9 andares)
  assert.ok(Math.abs(PE_OVAL - peH) < 1e-9);
  for (const id of ['helix', 'compass']) {
    const parte = A.partes.find((q) => q.id === id);
    const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
    montarParte(parte, d);
    const k = d.vidro.c.findIndex((_, j) => j % 4 === 0 && d.vidro.c[j] === VIDRO.oval);
    assert.equal(Math.floor(d.vidro.c[k + 1]), HORIZON.altura / 2, `${id}: centro da faixa`);
    assert.ok(Math.abs(d.vidro.c[k + 2] - peH) < 1e-6, `${id}: pé-direito da faixa`);
    assert.equal(Math.floor(d.vidro.c[k + 3] / 32), andaresLed(HORIZON.andares), `${id}: andares da faixa`);
    // a faixa inteira num corpo só (os recuos da Compass ficam acima dela)
    const meia = faixaLed(peH, HORIZON.andares);
    const corpo = corposDaOval(parte.pecas[0]).find((c) => c.y0 <= HORIZON.altura / 2 && c.y1 >= HORIZON.altura / 2);
    assert.ok(corpo.y0 <= HORIZON.altura / 2 - meia && corpo.y1 >= HORIZON.altura / 2 + meia, `${id}: recuo no meio da faixa`);
  }
  // o pódio das torres não tem faixa
  const pod = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'torre', pecas: pecasDe('podio') }, pod);
  const kp = pod.vidro.c.findIndex((_, j) => j % 4 === 0 && pod.vidro.c[j] === VIDRO.anel);
  assert.equal(Math.floor(pod.vidro.c[kp + 3] / 32), 0);
});

test('VIS1a: o pé dos anéis assenta no jardim (canaleta escura colada no vidro, canteiro com a sebe, passeio), sem faixa clara', () => {
  const p = pecasDe('anel').find((q) => q.id === 'horizon.6');
  const rF = p.raio + p.fundo / 2;
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: p.id, pecas: [p] }, d);
  let claros = 0;
  let canaleta = [Infinity, -Infinity];
  let folha = 0;
  for (let i = 0; i < d.opaco.vertices; i++) {
    const y = d.opaco.p[3 * i + 1] - COTA;
    const r = raioDe(d.opaco.p[3 * i], d.opaco.p[3 * i + 2]);
    if (y > 1 || r < rF - 0.5 || r > rF + PE_ANEL.passeio + 0.01) continue;
    const { pad, lum } = dadosOpaco(d.opaco, i);
    if (lum > 0.3) claros++;
    if (pad === PADRAO.folha) folha++;
    if (r < rF + 0.01) canaleta[0] = Math.min(canaleta[0], lum);
    if (Math.abs(r - (rF + PE_ANEL.canaleta)) < 0.01 && y < 0.2) canaleta[1] = Math.max(canaleta[1], lum);
  }
  assert.equal(claros, 0, 'a faixa clara de maquete no pé do anel');
  assert.ok(folha > 40, 'o canteiro com a folhagem');
  assert.ok(canaleta[0] < canaleta[1] * 0.5, 'a oclusão do pé (a canaleta mais escura colada no vidro)');
  // de perto, a sebe em volume no setor do trecho
  const setores = new Map();
  const d0 = { chao: chaoPlano, ...malhasNovas(), lod: 0, setor: (k) => setores.get(k) ?? setores.set(k, { opaco: new Malha('opaco') }).get(k) };
  montarParte({ id: p.id, pecas: [p] }, d0);
  let sebe = 0;
  for (const { opaco } of setores.values()) for (let i = 0; i < opaco.vertices; i++) if (Math.abs(opaco.p[3 * i + 1] - COTA - PE_ANEL.alturaSebe) < 1e-6) sebe++;
  assert.ok(sebe > 40, 'a sebe do pé no LOD0');
});

test('VIS1a: Helix e Compass são torres, não silos (pódio largo, a Helix gira e afina com a lanterna, a Compass recua em terraços)', () => {
  const helix = A.partes.find((q) => q.id === 'helix').pecas[0];
  const compass = A.partes.find((q) => q.id === 'compass').pecas[0];
  const ch = corposDaOval(helix);
  const cc = corposDaOval(compass);
  // os dois com pódio mais largo que o fuste
  for (const c of [ch, cc]) assert.ok(c[0].podio && c[0].e0 > 1.3 && c[1].e0 <= 1);
  // a Helix: o fuste gira e afina até o topo
  assert.ok(ch.some((c) => c.gira && c.e1 < c.e0));
  // a Compass: três corpos que recuam (a escala cai a cada um), com os cortes em lajes da régua de 6,4 m
  const fuste = cc.filter((c) => !c.podio);
  assert.equal(fuste.length, 3);
  for (let k = 1; k < fuste.length; k++) assert.ok(fuste[k].e0 < fuste[k - 1].e1 - 0.08, 'recuo');
  for (const c of cc) assert.ok(Math.abs(c.y0 / PE_OVAL - Math.round(c.y0 / PE_OVAL)) < 1e-6);
  // os terraços plantados nos recuos (e no teto do pódio) com o guarda-corpo de vidro e árvores
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'compass', pecas: [compass] }, d);
  for (const c of cc.slice(0, -1)) {
    let jardim = 0;
    for (let i = 0; i < d.opaco.vertices; i++) if (Math.abs(d.opaco.p[3 * i + 1] - COTA - c.y1) < 1e-6 && dadosOpaco(d.opaco, i).pad === PADRAO.folha) jardim++;
    assert.ok(jardim > 40, `terraço a ${c.y1} m`);
  }
  assert.ok(d.arvores.length >= 12, 'árvores nos terraços');
  let parapeito = 0;
  for (let i = 0; i < d.vidro.c.length; i += 4) if (d.vidro.c[i] === VIDRO.parapeito) parapeito++;
  assert.ok(parapeito > 100);
  // a Helix: as espinhas de bronze que sobem com a torção e a lanterna acesa acima do teto
  const h = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'helix', pecas: [helix] }, h);
  let lanterna = 0;
  let yLant = 0;
  for (let i = 0; i < h.vidro.vertices; i++) {
    if (h.vidro.c[4 * i] !== VIDRO.lanterna) continue;
    lanterna++;
    yLant = Math.max(yLant, h.vidro.p[3 * i + 1] - COTA);
  }
  assert.ok(lanterna > 100 && yLant > helix.altura + 15, `lanterna até ${yLant}`);
  const bronze = corLinear('#cbbb9d');
  let espinha = 0;
  const giros = new Set();
  for (let i = 0; i < h.opaco.vertices; i++) {
    if (Math.abs(h.opaco.c[4 * i] - bronze[0]) > 1e-6) continue;
    espinha++;
    if (h.opaco.p[3 * i + 1] - COTA > 20) giros.add(Math.round(Math.atan2(h.opaco.p[3 * i + 2] - helix.z, h.opaco.p[3 * i] - helix.x) * 20));
  }
  assert.ok(espinha > 100 && giros.size > 10, 'as espinhas que giram');
  // a marquise curta das ovais (a leitura vertical, de vidro)
  assert.ok(BAL_OVAL <= 1.5);
});

test('VIS1a: o parque com o passeio da margem do lago, as praças de pedra portuguesa e as árvores de desenho', () => {
  const parte = A.partes.find((q) => q.id === 'parque');
  const jardim = parte.pecas.find((q) => q.tipo === 'jardim');
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1, mata: mataDaSede };
  montarParte({ id: 'parque', pecas: parte.pecas }, d);
  // o espelho d'água do parque agora é o Mirror Lake grande (peça do lago): o parque não leva água própria
  assert.equal(d.agua.triangulos, 0);
  let portuguesa = 0;
  let caminho = 0;
  for (let i = 0; i < d.opaco.vertices; i++) {
    const { pad } = dadosOpaco(d.opaco, i);
    if (pad === PADRAO.portuguesa) portuguesa++;
    if (pad === PADRAO.piso && Math.abs(d.opaco.p[3 * i + 1] - COTA - 0.2) < 0.005) caminho++;
  }
  assert.ok(portuguesa > 200, 'as praças de pedra portuguesa');
  assert.ok(caminho > 300, `o passeio da margem do lago (${caminho})`);
  // os bosques de Supertrees
  const grupos = gruposDeSupertrees(parte.pecas);
  assert.equal(grupos.length, 3, 'três bosques de Supertrees');
  // as árvores de desenho (não da mata): as palmeiras-imperiais do passeio da margem e os oitis em volta das praças
  const desenho = d.arvores.filter((a) => !a.mata);
  assert.ok(desenho.filter((a) => a.especie === 'palmeira').length > 80);
  assert.ok(desenho.filter((a) => a.especie === 'oiti').length > 20, `oitis ${desenho.filter((a) => a.especie === 'oiti').length}`);
  // (as copas em volta das praças dos bosques podem passar da margem do parque, mas não da face do Meridian Ring)
  for (const a of desenho) assert.ok(raioDe(a.x, a.z) > MIRROR.r0 && raioDe(a.x, a.z) < MERIDIAN.raio - MERIDIAN.fundo / 2, `árvore de desenho a ${raioDe(a.x, a.z).toFixed(0)} m`);
  // os bosques densos da mata do parque (para a vegetação, quando a grade não os pinta), de 7 em 7 m
  assert.ok(d.arvores.filter((a) => a.mata).length > 1500);
  assert.ok(PARQUE.anel.r > jardim.r0 && PARQUE.anel.r < jardim.r1);
});

test('VIS1a: Supertrees de Gardens by the Bay (tronco vivo com treliça, copa larga em malha nas duas faces, detalhe de perto)', () => {
  const st = pecasDe('supertree');
  assert.ok(st.length >= 9);
  for (const p of st) assert.ok(p.altura >= 25 && p.altura <= 50);
  const [s] = st;
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  montarParte({ id: 'parque', pecas: [s] }, d);
  let malha = 0;
  let cima = 0;
  let baixo = 0;
  let tronco = 0;
  for (let i = 0; i < d.opaco.vertices; i++) {
    const { pad, luz } = dadosOpaco(d.opaco, i);
    if (pad === PADRAO.malha) {
      malha++;
      assert.equal(luz, LUZ.arvoreLuz, 'a malha da copa acende');
      if (d.opaco.n[3 * i + 1] > 0.2) cima++;
      if (d.opaco.n[3 * i + 1] < -0.2) baixo++;
    }
    if (pad === PADRAO.troncoVivo) tronco++;
  }
  assert.ok(malha > 100 && cima > 40 && baixo > 40, 'a copa em malha com as duas faces');
  assert.ok(tronco > 50, 'o tronco vivo');
  // a copa larga (diâmetro de mais de metade da altura), não vareta
  let rCopa = 0;
  for (let i = 0; i < d.opaco.vertices; i++) if (d.opaco.p[3 * i + 1] - COTA > s.altura * 0.9) rCopa = Math.max(rCopa, Math.hypot(d.opaco.p[3 * i] - s.x, d.opaco.p[3 * i + 2] - s.z));
  assert.ok(2 * rCopa > s.altura * 0.55, `copa de ${(2 * rCopa).toFixed(1)} m`);
  // de perto, as barras do tronco e as nervuras no setor do parque (o LOD0); de longe, só a casca
  const setores = new Map();
  const d0 = { chao: chaoPlano, ...malhasNovas(), lod: 0, setor: (k) => setores.get(k) ?? setores.set(k, { opaco: new Malha('opaco') }).get(k) };
  montarParte({ id: 'parque', pecas: [s] }, d0);
  assert.deepEqual([...setores.keys()], [SETOR_PARQUE]);
  assert.ok(setores.get(SETOR_PARQUE).opaco.triangulos > 300);
  assert.ok(tris(d.opaco) < 600, `Supertree de longe com ${tris(d.opaco)} triângulos`);
});

test('VIS1a: a semente do vidro dos anéis sobrevive ao erro da interpolação (sem chuvisco de pixel nas salas)', () => {
  // o float leva o centro da faixa (60, 80, 900 no pódio) e a semente; o varying erra alguns ulp de float32, e o hash
  // das salas (a semente vezes 29) sorteava de novo a cada pixel. A semente fica no meio de um passo de 1/64
  const ulp = (v) => 2 ** (Math.floor(Math.log2(Math.abs(v))) - 23);
  for (const [meio, s] of [[60, 0], [60, 1], [80, 0.999], [80, 0.37254], [900, 0.41], [120, 0.5]]) {
    const c = vidAnel(VIDRO.anel, s, meio, 6.4, 3, 9);
    const q = semAnel(s);
    assert.ok(q > 0 && q < 1 && Math.abs(q * SEM_ANEL - Math.floor(q * SEM_ANEL) - 0.5) < 1e-9, `semente ${q} fora do meio do passo`);
    const v = Math.fround(c[1]);
    for (let e = -16; e <= 16; e++) {
      const x = Math.fround(v + e * ulp(v));
      assert.equal(Math.floor(x), Math.floor(meio), `centro da faixa com erro de ${e} ulp`);
      // o que o shader faz: ( floor( fract( vC.y ) * 64 ) + 0.5 ) / 64
      assert.equal((Math.floor((x - Math.floor(x)) * SEM_ANEL) + 0.5) / SEM_ANEL, q, `semente com erro de ${e} ulp`);
    }
  }
  // as sementes dos anéis e das ovais do plano já saem quantizadas
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1 };
  for (const parte of A.partes.filter((q) => ['meridian', 'horizon', 'helix', 'compass', 'torre'].includes(q.id))) montarParte(parte, d);
  let n = 0;
  for (let i = 0; i < d.vidro.c.length; i += 4) {
    if (d.vidro.c[i] !== VIDRO.anel && d.vidro.c[i] !== VIDRO.oval) continue;
    n++;
    const f = d.vidro.c[i + 1] - Math.floor(d.vidro.c[i + 1]);
    assert.ok(Math.abs(f * SEM_ANEL - Math.floor(f * SEM_ANEL) - 0.5) < 1e-6);
  }
  assert.ok(n > 1000);
});

test('partes: cada tipo de peça monta sem NaN e dá caixa de seleção, no real, no fantasma e na sombra', () => {
  for (const parte of A.partes) {
    for (const p of parte.pecas) {
      if (!PECAS[p.tipo]) continue;
      for (const modo of [{ lod: 1 }, { lod: 1, fantasma: true }, { lod: 1, sombra: true }]) {
        const d = { chao: chaoPlano, ...malhasNovas(), nivelAgua: COTA + LAGO.nivel, mata: mataDaSede, ...modo };
        const r = montarParte({ id: parte.id, pecas: [p] }, d);
        for (const k of ['vidro', 'opaco', 'efeitos']) conferirMalha(d[k], `${p.tipo} ${k}`);
        if (!modo.sombra) assert.ok(r.caixas.length >= 1 || p.tipo === 'floresta' || p.tipo === 'jardim', `${p.tipo}: sem caixa`);
      }
    }
  }
});

test('paisagem: o chão dos bosques e do parque abre as avenidas, e nenhuma palmeira fica sob os anéis', () => {
  const r = malhasDoPlano('A', { chao: chaoPlano, prontas: 'todas' });
  // nenhum quadrilátero de chão (acima de 0,11 m e abaixo de 0,3 m) no eixo de uma avenida fora do asfalto e do canteiro
  const k = r.comum.opaco;
  const verde = new Set([3]);
  let ruins = 0;
  for (let i = 0; i < k.p.length; i += 3) {
    const y = k.p[i + 1] - COTA;
    if (y < 0.11 || y > 0.3) continue;
    const pad = Math.round(k.c[(i / 3) * 4 + 3]) & 15;
    if (!verde.has(pad)) continue;
    const rr = raioDe(k.p[i], k.p[i + 2]);
    if (rr < A.paisagem.praca.r1 + 2 || rr > ANEL_VIARIO.raio - 14) continue;
    const a = anguloDe(k.p[i], k.p[i + 2]);
    for (const g of AVENIDAS) if (Math.abs(difG(a, g)) < 90 && Math.abs(rr * Math.sin((difG(a, g) * Math.PI) / 180)) < 11 && k.c[(i / 3) * 4] > 0.3) ruins++;
  }
  // o canteiro central (verde, 4 m) é a única grama no eixo; a grama do parque e dos bosques fica fora das pistas
  assert.ok(ruins < 600, `${ruins} vértices de grama sobre as pistas`);
  // as palmeiras de chão (as dos terraços dos Hanging Gardens, nas faces de dentro dos anéis, ficam acima do chão)
  const palmas = r.arvores.filter((a) => a.especie === 'palmeira' && a.y - COTA < 3);
  assert.ok(palmas.length > 300, `${palmas.length} palmeiras`);
  for (const a of palmas) {
    const rr = raioDe(a.x, a.z);
    for (const p of [HORIZON, MERIDIAN]) assert.ok(rr < p.raio - p.fundo / 2 - 8 || rr > p.raio + p.fundo / 2 + 8, `palmeira sob um anel em r = ${rr.toFixed(0)}`);
  }
  // as árvores da mata do parque vêm marcadas (o domínio deixa de fora quando a grade da mata já as desenha)
  assert.ok(r.arvores.filter((a) => a.mata).length > 1000);
});

test('plano no jogo: as partes prontas pelas etapas do espelho, o resto em fantasma; o Horizon Ring trecho a trecho', () => {
  const esp = (ids) => ({ arcologia: { etapas: ids.map(([id, e]) => ({ id, estado: e })) } });
  const P = ETAPA.PRONTA;
  assert.deepEqual([...partesProntas(esp([]))], []);
  assert.deepEqual([...partesProntas(esp([['torre.e1', P], ['torre.e4', ETAPA.TRANCADA]]))], []);
  assert.deepEqual([...partesProntas(esp([['torre.e4', P], ['lago.e1', P]]))].sort(), ['lago', 'torre']);
  assert.deepEqual([...partesProntas(esp([['horizon.6', P], ['horizon.7.e1', P], ['horizon.7.e2', ETAPA.EM_OBRA]]))], ['horizon.6']);
  assert.deepEqual([...partesProntas(esp([['meridian.e1', P], ['meridian.e2', P]]))], ['meridian']);
  // o jogo de hoje (o lago e as torres prontos): o resto é fantasma, com as caixas para a seleção
  const j = malhasDoPlano('A', { chao: chaoPlano, prontas: new Set(['torre', 'lago', 'horizon.6']), lagoReal: true, paisagem: false });
  assert.ok(j.fantasma.vidro.triangulos + j.fantasma.opaco.triangulos > 2000, 'fantasma das partes');
  assert.ok(j.agua.triangulos > 0 && j.jatos.length > 0, 'o lago pronto');
  assert.equal(j.setores.size, 1, 'só o trecho pronto tem as marquises do LOD0');
  assert.ok(j.setores.has(5));
  assert.ok(j.caixas.some((c) => c.parte === 'meridian') && j.caixas.some((c) => c.trecho === 'horizon.1'));
  // o lago pronto mas não cavado: o espelho prometido em fantasma
  const n = malhasDoPlano('A', { chao: chaoPlano, prontas: new Set(['lago']), lagoReal: false, paisagem: false });
  assert.ok(n.agua.triangulos < j.agua.triangulos, 'sem a cava, sem o plano d\'água do Mirror Lake grande');
});

test('setores: os alvos dos 19 setores e a distância da câmera a cada um (LOD por setor)', () => {
  const al = alvosDosSetores(A, COTA);
  assert.equal(al.size, 19);
  // o parque (o detalhe das Supertrees de perto) pela distância ao centro
  assert.deepEqual(al.get(SETOR_PARQUE).ponto, [CX, CZ]);
  for (let s = 0; s < 16; s++) assert.ok(al.get(s)?.arco, `setor ${s}`);
  assert.ok(al.get(SETOR_OVAL.helix).ponto && al.get(SETOR_OVAL.compass).ponto);
  // da câmera no centro, a 100 m de altura: o Meridian a uns 442 m, o Horizon a uns 729 m
  const dM = distAoSetor(al.get(8), CX, COTA + 100, CZ);
  const dH = distAoSetor(al.get(0), CX, COTA + 100, CZ);
  assert.ok(Math.abs(dM - MERIDIAN.raio) < 1 && Math.abs(dH - HORIZON.raio) < 1);
  // de fora, em frente a um trecho: perto dele, longe do oposto
  const [x, z] = [CX + 1000, CZ];
  assert.ok(distAoSetor(al.get(0), x, COTA + 10, z) < 300);
  assert.ok(distAoSetor(al.get(4), x, COTA + 10, z) > 1400);
});

test('orçamento (D66): família arcologia até 250 mil triângulos de perto e 60 mil na vista aberta', () => {
  const nivel = NIVEL.pc;
  const par0 = malhasPar({ nivel, lod: 0 });
  const par1 = malhasPar({ lod: 1 });
  // as duas torres em LOD0 até 70 mil cada
  for (const s of SPECS) {
    const t = malhasTorre({ nivel, spec: s, ...NO_PAR });
    assert.ok(tris(t.vidro, t.opaco) <= 70000, s.nome);
  }
  const r = malhasDoPlano('A', { chao: chaoPlano, prontas: 'todas' });
  const jatos = r.jatos.length * malhaJato().triangulos;
  // de perto, no pior caso: o par no LOD0 e todos os setores com as marquises em geometria
  const perto = tris(par0.vidro, par0.opaco) + tris(r.comum.vidro, r.comum.opaco) + somaSetores(r) + tris(r.agua, r.efeitos) + jatos;
  assert.ok(perto <= TETO_ARCOLOGIA.perto.pc, `de perto: ${perto}`);
  assert.ok(perto <= 250000);
  // na vista aberta: o par no LOD1, nenhum setor no LOD0, a água e os efeitos (a câmera da aérea fica a menos de 2,6 km)
  const aberta = tris(par1.vidro, par1.opaco) + tris(r.comum.vidro, r.comum.opaco) + tris(r.agua, r.efeitos) + jatos;
  assert.ok(aberta <= TETO_ABERTA_V3, `vista aberta com a sede construída: ${aberta}`);
  // no jogo de hoje (as torres e o lago prontos, o resto em fantasma): cabe no teto do contrato (40 mil)
  const j = malhasDoPlano('A', { chao: chaoPlano, prontas: new Set(['torre', 'lago']), paisagem: false });
  const abertaJogo = tris(par1.vidro, par1.opaco) + tris(j.comum.vidro, j.comum.opaco, j.agua, j.fantasma.vidro, j.fantasma.opaco);
  assert.ok(abertaJogo <= TETO_ARCOLOGIA.aberta, `vista aberta no jogo: ${abertaJogo}`);
  assert.ok(DIST_PARTES_LOD0.pc >= DIST_PARTES_LOD0.media);
});

test('chamadas: a sede construída cabe na família do pc (as torres, o comum, os setores, a água, os efeitos, o fantasma)', () => {
  const r = malhasDoPlano('A', { chao: chaoPlano, prontas: 'todas' });
  const cheia = (m) => (m?.triangulos ? 1 : 0);
  // torres 2 (um LOD por vez), comum 2, todos os setores, água, efeitos, jatos, fantasma, sombra 2
  const n = 2 + cheia(r.comum.vidro) + cheia(r.comum.opaco) + r.setores.size + cheia(r.agua) + cheia(r.efeitos) + (r.jatos.length ? 1 : 0) + (cheia(r.fantasma.vidro) || cheia(r.fantasma.opaco)) + 2;
  assert.ok(n <= ORCAMENTO.pc.familias.arcologia.calls[1], `${n} chamadas (teto da família no pc: ${ORCAMENTO.pc.familias.arcologia.calls[1]})`);
});

// ------------------------------------------------------------------------------------------------ cenas e domínio

test('cenas: as vistas da sede v3 (aérea, avenida, mar, noite e as da X1b) na hora pedida e fora dos prédios', () => {
  assert.deepEqual(Object.keys(VISTAS_SEDE).sort(), ['aerea', 'avenida', 'canopy', 'canopyTopo', 'heli', 'mar', 'noite', 'noiteAerea', 'noiteQuedas', 'obra', 'parque', 'ponte', 'quedas']);
  const aneis = pecasDe('anel');
  for (const [id, v] of Object.entries(VISTAS_SEDE)) {
    const r = raioDe(v.de[0], v.de[2]);
    for (const p of aneis) assert.ok(!(r > p.raio - p.fundo / 2 - 3 && r < p.raio + p.fundo / 2 + 3 && v.de[1] < p.altura + 2), `${id}: a câmera dentro de um anel`);
    assert.ok(r > PODIO.raio + 20, `${id}: a câmera no pódio`);
    assert.ok(v.fov > 20 && v.fov < 90 && v.hora >= 0 && v.hora < 24);
    // todas olham para a sede; a do parque, para o bosque grande de Supertrees
    if (id === 'parque') {
      const g = gruposDeSupertrees(A.partes.find((q) => q.id === 'parque').pecas).sort((a, b) => b.n - a.n)[0];
      assert.ok(Math.hypot(v.alvo[0] - g.x, v.alvo[2] - g.z) < g.raio, 'a vista do parque fora do bosque de Supertrees');
    } else if (['canopy', 'canopyTopo', 'noiteQuedas', 'quedas'].includes(id)) {
      // as vistas da SEDE4: as pontes, o Halo Lake e as quedas, entre o lago e o Horizon Ring
      const ra = raioDe(v.alvo[0], v.alvo[2]);
      assert.ok(ra > MIRROR.r0 && ra < HORIZON.raio, `${id}: o alvo fora do parque e dos anéis (${ra.toFixed(0)} m)`);
    } else assert.ok(raioDe(v.alvo[0], v.alvo[2]) < 100, `${id}: não olha o centro`);
  }
  assert.equal(VISTAS_SEDE.aerea.hora, 17.5);
  assert.ok(raioDe(VISTAS_SEDE.aerea.de[0], VISTAS_SEDE.aerea.de[2]) > 2000, 'a aérea pega o disco inteiro');
  assert.ok(VISTAS_SEDE.noite.hora >= 20);
  // a avenida: no eixo de uma das 8 avenidas, por fora do Horizon Ring, mais alta que ele (o pórtico e as torres)
  const av = VISTAS_SEDE.avenida;
  assert.ok(AVENIDAS.some((g) => Math.abs(difG(anguloDe(av.de[0], av.de[2]), g)) < 0.5), 'fora do eixo de uma avenida');
  assert.ok(raioDe(av.de[0], av.de[2]) > HORIZON.raio + HORIZON.fundo / 2 && av.de[1] > HORIZON.altura);
  // o mar: na areia, entre a lagoa e a água, olhando para o norte
  const T = gerarTerreno();
  const mar = VISTAS_SEDE.mar;
  assert.equal(aguaEm(T, mar.de[0], mar.de[2]), AGUA.TERRA, 'a câmera do mar na água');
  assert.ok(aguaEm(T, mar.de[0], mar.de[2] + 40) !== AGUA.TERRA, 'longe da praia');
  assert.ok(mar.alvo[2] < mar.de[2], 'olhando para o norte');
  // a prancha das torres: os azimutes a 1,25 km e os dois closes (a ponte, as coroas) fora das torres
  for (const v of VISTAS_TORRE) {
    if (v.azimute !== undefined) continue;
    assert.ok(Math.abs(v.de[0]) > 18 || Math.abs(v.de[2]) > 30, `${v.id} dentro de uma torre`);
  }
});

test('cenas: a hora forçada que muda espera o céu assentar (quadros-chave e cubo em fatias, D9)', async () => {
  const pedidos = [];
  let hora = 17.5;
  const R = { tempo: { forcar: (f) => { hora = f.hora; } }, foto: async (op) => pedidos.push(op) };
  const ctx = { horaDoCeu: () => hora };
  assert.equal(await assentarHora(R, ctx, 17.5), 0, 'mesma hora: nada a esperar');
  assert.equal(await assentarHora(R, ctx, 21, 12), 12);
  assert.equal(pedidos.length, 12);
  assert.ok(pedidos.every((p) => p.w <= 16 && p.h <= 16), 'quadros pequenos');
  assert.equal(await assentarHora(R, ctx, 21 + 24), 0, 'a volta do relógio é a mesma hora');
});

test('domínio: só o chão do disco da gleba refaz a sede (vias e lotes no resto da cidade não)', () => {
  const R = GLEBA_ENVELOPE.raio;
  assert.equal(tocaGleba([]), false);
  assert.equal(tocaGleba(undefined), false);
  assert.equal(tocaGleba([[CX - 10, CZ - 10, CX + 10, CZ + 10]]), true, 'no centro');
  assert.equal(tocaGleba([[CX + R + 20, CZ - 5, CX + R + 40, CZ + 5]]), true, 'na folga da calçada e da transição');
  // o canto da caixa do disco fica fora do círculo: a cidade ali não refaz a sede
  assert.equal(tocaGleba([[CX + R - 30, CZ + R - 30, CX + R, CZ + R]]), false, 'no canto da caixa, fora do disco');
  assert.equal(tocaGleba([[-3000, -3000, -2900, -2900]]), false, 'longe, do outro lado do mapa');
});

// ------------------------------------------------------------------------------------------------ kit e lago

test('kit: peças redondas com normal por vértice (cilindro e torno sem facetas)', () => {
  const m = new Malha('opaco');
  torno(m, 0, 0, [[0, -10], [7.07, -7.07], [10, 0], [7.07, 7.07], [0, 10]], 16, [0, 0, 0, 0]);
  cilindro(m, 50, 0, 0, 10, 2, 2, 8, [0, 0, 0, 0], { topo: false });
  let pior = 1;
  for (let i = 0; i < m.p.length; i += 3) {
    const [x, y, z] = [m.p[i], m.p[i + 1], m.p[i + 2]];
    const [cx, cy, cz] = x > 25 ? [50, y, 0] : [0, 0, 0];
    const l = Math.hypot(x - cx, y - cy, z - cz);
    if (l < 1) continue;
    const nl = Math.hypot(m.n[i], m.n[i + 1], m.n[i + 2]);
    pior = Math.min(pior, ((x - cx) * m.n[i] + (y - cy) * m.n[i + 1] + (z - cz) * m.n[i + 2]) / (l * nl));
  }
  assert.ok(pior > 0.9, `normal longe da radial (cos ${pior.toFixed(3)})`);
  conferirMalha(m, 'kit redondo');
});

test('lago: a cava da cena desce ao leito do Mirror Lake grande, deixa o pódio, o anel d\'água e as ilhas no chão e se desfaz', () => {
  const n = 321;
  const T = { n, passo: 4, origem: [CX - 640, CZ - 640], altura: new Float32Array(n * n).fill(COTA) };
  const lago = lagoDe(A);
  const guarda = new Map();
  cavarTerreno(T, lago, COTA, guarda);
  const h = (x, z) => T.altura[Math.round((z - T.origem[1]) / 4) * n + Math.round((x - T.origem[0]) / 4)];
  const em = (r, g) => [CX + r * Math.cos((g * Math.PI) / 180), CZ + r * Math.sin((g * Math.PI) / 180)];
  assert.ok(Math.abs(h(...em(200, 90)) - (COTA + lago.fundo)) < 1e-4, 'leito no lago');
  assert.equal(h(CX, CZ), COTA, 'o centro do pódio não é cavado');
  assert.equal(h(...em(91, 0)), COTA, 'o anel d\'água do pódio é uma bacia à altura do chão');
  assert.equal(h(...em(120, 200)), COTA, 'a floresta não é cavada');
  assert.equal(h(...em(600, 45)), COTA, 'o bosque entre os anéis não é cavado');
  for (const ilha of ILHAS) assert.ok(h(ilha.x, ilha.z) > COTA - 0.3, `a ilha de ${ilha.ang} graus fica no chão`);
  descavar(T, guarda);
  assert.ok(T.altura.every((v) => v === COTA), 'desfazer volta ao chão');
});

// ------------------------------------------------------------------------------------------------ SEDE4 (D97): pontes, água, mata

const montarPeca = (peca, extra = {}) => {
  const d = { chao: chaoPlano, ...malhasNovas(), lod: 1, nivelAgua: COTA + LAGO.nivel, mata: mataDaSede, ...extra };
  montarParte({ id: 'x', pecas: [peca] }, d);
  return d;
};
/** Distância (m) de um ponto ao eixo da avenida de ângulo g (só do lado de fora do centro) e o raio dele. */
const noEixo = (x, z, g) => {
  const d = difG(anguloDe(x, z), g);
  return Math.abs(d) < 90 ? Math.abs(raioDe(x, z) * Math.sin((d * Math.PI) / 180)) : Infinity;
};

test('Canopy Bridges: 8 nos eixos das avenidas, do Meridian ao Horizon, com o tabuleiro dentro das duas faixas de LED', () => {
  const pontes = pecasDe('ponte');
  assert.equal(pontes.length, 8);
  assert.equal(PONTES.length, 8);
  assert.deepEqual(pontes.map((q) => q.angulo), [...AVENIDAS]);
  // o tabuleiro entre duas marquises de cada anel e dentro das duas faixas de LED (a do Horizon e a do Meridian se sobrepõem)
  for (const anel of [HORIZON, MERIDIAN]) assert.ok(PONTE.cota > anel.led.y0 && PONTE.cota < anel.led.y1, `ponte fora da faixa de LED (${anel.led.y0} a ${anel.led.y1})`);
  assert.ok(PONTE.cota >= 60 && PONTE.cota <= 72 && PONTE.largura >= 28 && PONTE.largura <= 32);
  const peAnel = HORIZON.altura / HORIZON.andares;
  assert.ok(Math.abs(PONTE.cota / peAnel - Math.round(PONTE.cota / peAnel)) > 0.1, 'o tabuleiro não cai numa laje (cai entre duas marquises)');
  for (const q of pontes) {
    assert.ok(Math.abs(q.r0 - (MERIDIAN.raio + MERIDIAN.fundo / 2)) < 1e-6, 'nasce na face de fora do Meridian (467,5)');
    assert.ok(q.r1 >= HORIZON.raio - HORIZON.fundo / 2 && q.r1 < HORIZON.raio - HORIZON.fundo / 2 + 20, 'pousa na face de dentro do Horizon (uns 699 m)');
    const vao = q.r1 - q.r0;
    assert.ok(vao > 200 && vao < 245, `vão de ${vao.toFixed(0)} m`);
    assert.ok(q.trecho && TRECHOS_HORIZON.some((t) => t.id === q.trecho && t.de === q.angulo), 'cada ponte aparece com o trecho do Horizon Ring em que pousa');
    const d = montarPeca(q);
    conferirMalha(d.opaco, `${q.id} opaco`);
    conferirMalha(d.vidro, `${q.id} vidro`);
    // na malha: radial entre os anéis, estreita em volta do eixo e na altura entre as duas marquises
    const [x0, y0, z0, x1, y1, z1] = caixaDe(d.opaco, d.vidro);
    let rMin = Infinity;
    let rMax = 0;
    let lat = 0;
    for (const m of [d.opaco, d.vidro]) {
      for (let i = 0; i < m.p.length; i += 3) {
        const r = raioDe(m.p[i], m.p[i + 2]);
        rMin = Math.min(rMin, r);
        rMax = Math.max(rMax, r);
        lat = Math.max(lat, noEixo(m.p[i], m.p[i + 2], q.angulo));
      }
    }
    assert.ok(rMin > q.r0 - 1 && rMax < q.r1 + 1, `${q.id}: de ${rMin.toFixed(0)} a ${rMax.toFixed(0)} m`);
    assert.ok(lat <= PONTE.largura / 2 + 1, `${q.id}: ${lat.toFixed(1)} m do eixo`);
    assert.ok(y0 - COTA >= PONTE.nasce - 1.5 && y1 - COTA <= PONTE.cota + 14, `${q.id}: alturas ${(y0 - COTA).toFixed(1)} a ${(y1 - COTA).toFixed(1)}`);
    assert.ok(x0 < x1 && z0 < z1);
    // a ponte é leve de longe: o teto por ponte
    assert.ok(tris(d.opaco, d.vidro) <= 2500, `${q.id}: ${tris(d.opaco, d.vidro)} triângulos`);
  }
});

test('Canopy Bridges: Codex, Helix e Compass no eixo de uma avenida, com o pórtico de 40 x 18 m, e a ponte passa por elas', () => {
  const eixos = { codex: 180, helix: 315, compass: 90 };
  for (const [id, g] of Object.entries(eixos)) {
    const [p] = A.partes.find((q) => q.id === id).pecas;
    assert.ok(noEixo(p.x, p.z, g) < 0.5 && Math.abs(raioDe(p.x, p.z) - 583) < 0.5, `${id} no eixo de ${g} graus`);
    assert.deepEqual([p.passagem.vao, p.passagem.pe], [40, 18]);
    const ponte = pecasDe('ponte').find((q) => q.angulo === g);
    assert.equal(ponte.torre?.id, id, `a ponte de ${g} graus faz escala na ${id}`);
    assert.ok(ponte.torre.meia > 10 && ponte.torre.meia < 20);
  }
  // a avenida do portão norte (270 graus) fica livre
  assert.equal(pecasDe('ponte').find((q) => q.angulo === 270).torre, null);
  assert.ok(pecasDe('ponte').filter((q) => q.torre).length === 3);
});

test('Mirror Lake grande: de 150 m a uns 330 m, 4 ilhas de mata, 4 enseadas e as 8 avenidas em pontes baixas de pedra', () => {
  const lago = lagoDe(A);
  assert.equal(lago.r0, 150);
  assert.ok(ILHAS.length >= 3 && ILHAS.length <= 5, 'de 3 a 5 ilhas');
  for (let g = 0; g < 360; g += 1) {
    const r = raioDaMargem(g);
    const emEnseada = QUEDAS_ANGULOS.some((q) => Math.abs(difG(g, q)) < 12);
    assert.ok(r > 290 && r < (emEnseada ? 416 : 345), `margem de ${r.toFixed(0)} m a ${g} graus`);
    assert.ok(r < MERIDIAN.raio - MERIDIAN.fundo / 2, 'a margem não passa do Meridian Ring');
  }
  // as enseadas chegam ao Meridian Ring (a menos de 10 m da face de dentro)
  for (const q of QUEDAS_ANGULOS) assert.ok(MERIDIAN.raio - MERIDIAN.fundo / 2 - raioDaMargem(q) < 10, `enseada de ${q} graus`);
  // as ilhas: dentro do lago, longe das margens, das avenidas e entre si
  for (const [k, a] of ILHAS.entries()) {
    assert.ok(a.r - a.furo > MIRROR.r0 + 5 && a.r + a.furo < raioDaMargem(a.ang) - 5, `ilha ${k} toca a margem`);
    for (const g of AVENIDAS) assert.ok(noEixo(a.x, a.z, g) > a.furo + 14, `ilha ${k} sobre a avenida de ${g}`);
    for (const b of ILHAS.slice(k + 1)) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.furo + b.furo, 'ilhas coladas');
    assert.ok(a.raio >= 40 && a.raio <= 60);
  }
  assert.deepEqual([...lago.pontes], [...AVENIDAS]);
  // a água, o muro do cais e as pontes: sem NaN, só no lago
  const d = montarPeca(lago);
  conferirMalha(d.agua, 'água do lago');
  conferirMalha(d.opaco, 'pontes baixas');
  assert.ok(d.agua.triangulos > 300);
  const [bx0, , bz0, bx1, , bz1] = caixaDe(d.agua);
  assert.ok(bx1 - bx0 < 2 * 420 && bz1 - bz0 < 2 * 420);
  // a mata nas ilhas e nas margens (os pontos nas ilhas são mata densa; a água é clareira)
  for (const a of ILHAS) assert.ok(mataDaSede(a.x, a.z) > 0.8, 'mata na ilha');
  assert.equal(mataDaSede(CX + 200, CZ + 200 * 0 + 0.01), 0, 'o lago não tem mata');
  assert.ok((mataDaSede(CX + 600, CZ) ?? 0) > 0.6 || (mataDaSede(CX + 560, CZ + 40) ?? 0) > 0.6, 'mata densa entre os anéis');
});

test('Dream Falls grandes: 4 quedas de 120 m do teto do Meridian Ring, nas diagonais entre as avenidas, de 40 a 60 m, com a luz', () => {
  const quedas = pecasDe('queda');
  assert.equal(quedas.length, 4);
  assert.deepEqual(quedas.map((q) => q.angulo), [...QUEDAS_ANGULOS]);
  for (const q of quedas) {
    // entre duas avenidas (a 22,5 graus de cada uma)
    for (const g of AVENIDAS) assert.ok(Math.abs(difG(q.angulo, g)) >= 22.4, `queda de ${q.angulo} sobre a avenida de ${g}`);
    assert.ok(q.largura >= 40 && q.largura <= 60 && q.altura === 120);
    const d = montarPeca(q, { lod: 1 });
    conferirMalha(d.efeitos, `${q.id} efeitos`);
    const [x0, y0, z0, x1, y1, z1] = caixaDe(d.efeitos);
    const nivel = COTA + MIRROR.nivel;
    assert.ok(y1 - nivel >= 119.5 && y1 - nivel <= 122, `${q.id}: ${(y1 - nivel).toFixed(1)} m de queda`);
    assert.ok(Math.abs(y0 - nivel) < 0.2, 'a espuma na água');
    // a lâmina cai ao lado do Meridian Ring (a face de dentro, a 417,5 m) e pousa no lago
    let rMin = Infinity;
    let rMax = 0;
    for (let i = 0; i < d.efeitos.p.length; i += 3) {
      const r = raioDe(d.efeitos.p[i], d.efeitos.p[i + 2]);
      rMin = Math.min(rMin, r);
      rMax = Math.max(rMax, r);
      assert.ok(Math.abs(difG(anguloDe(d.efeitos.p[i], d.efeitos.p[i + 2]), q.angulo)) < 9, 'efeito fora da enseada');
    }
    assert.ok(rMax <= MERIDIAN.raio - MERIDIAN.fundo / 2 + 11 && rMin > raioDaMargem(q.angulo) - 60, `${q.id}: de ${rMin.toFixed(0)} a ${rMax.toFixed(0)} m`);
    assert.ok(x0 < x1 && z0 < z1);
    // o material 'cascata' (o sombreador anima e acende à noite): o código de cada vértice é do conjunto da cascata
    assert.ok(d.efeitos.triangulos > 300 && d.efeitos.triangulos < 1500, `${d.efeitos.triangulos} triângulos`);
  }
  // o teto do Meridian leva o bico em cada uma das 4 quedas
  const meridian = pecasDe('anel').find((q) => q.id === 'meridian');
  assert.deepEqual(meridian.quedas.map((q) => q.angulo), [...QUEDAS_ANGULOS]);
});

test('Halo Lake: a faixa d\'água de 50 m ao pé da face de dentro do Horizon Ring, cortada pelas avenidas, em 8 pedaços', () => {
  assert.deepEqual([HALO.r0, HALO.r1], [645, 695]);
  assert.ok(HALO.r1 + HALO.cais <= HORIZON.raio - HORIZON.fundo / 2 + 1e-6, 'o cais de 4 m até o vidro');
  const bacias = pecasDe('bacia');
  assert.equal(bacias.length, 8);
  for (const b of bacias) {
    const d = montarPeca(b);
    conferirMalha(d.agua, `${b.id} água`);
    conferirMalha(d.opaco, `${b.id} muros`);
    assert.ok(d.agua.triangulos > 10);
    for (let i = 0; i < d.agua.p.length; i += 3) {
      const x = d.agua.p[i];
      const z = d.agua.p[i + 2];
      const r = raioDe(x, z);
      assert.ok(r > HALO.r0 - 0.5 && r < HALO.r1 + 0.5, `água fora do anel (${r.toFixed(1)} m)`);
      // fora do corredor das avenidas (a pista de 24 m e o guarda-corpo)
      for (const g of AVENIDAS) assert.ok(noEixo(x, z, g) >= CORREDOR_AVENIDA - 0.5, `água na avenida de ${g}`);
    }
    // as pontas da bacia acabam nas avenidas do trecho
    assert.deepEqual([...b.lacunas], [b.de, b.ate]);
    const t = TRECHOS_HORIZON.find((q) => q.id === b.trecho);
    assert.ok(t && t.de === b.de && t.ate === b.ate);
  }
});

test('Hanging Gardens: a face de dentro dos dois anéis recua em terraços com plantas, a de fora segue vidro liso', () => {
  for (const A_ of [HORIZON, MERIDIAN]) {
    assert.ok(A_.terracos.linhas.length >= 3 && A_.terracos.recuo >= 2);
    // as linhas de terraço não caem na faixa de LED (o degrau não corta a faixa)
    const pe = A_.altura / A_.andares;
    for (const l of A_.terracos.linhas) assert.ok(l * pe <= A_.led.y0 + 1e-6 || l * pe >= A_.led.y1 - 1e-6, `terraço de ${l} andares dentro da faixa de LED`);
    // o raio da face de dentro só cresce com a altura (recua), a de fora fica
    assert.equal(raioDaFaceDeDentro(A_, 0.1), A_.raio - A_.fundo / 2);
    assert.ok(raioDaFaceDeDentro(A_, A_.altura) > raioDaFaceDeDentro(A_, 0.1));
    assert.ok(raioDaFaceDeDentro(A_, A_.altura) < A_.raio + A_.fundo / 2 - 25, 'a laje de cima ainda tem fundo');
  }
  // na malha do anel: as árvores e plantas dos terraços (a vegetação planta as grandes; as de perto vão na lista)
  const p = pecasDe('anel').find((q) => q.id === 'horizon.6');
  const d = montarPeca(p);
  const nosTerracos = d.arvores.filter((a) => a.y - COTA > 10);
  assert.ok(nosTerracos.length >= 20, `${nosTerracos.length} árvores nos terraços`);
  for (const a of nosTerracos) assert.ok(raioDe(a.x, a.z) < HORIZON.raio, 'terraço na face de fora');
  const plantadas = d.vidro.c.length / 4;
  assert.ok(plantadas > 0);
});

test('triângulos: as pontes, a água e as quedas cabem nos tetos da D66 (250 mil de perto, 60 mil na vista aberta)', () => {
  const r = malhasDoPlano('A', { chao: chaoPlano, prontas: 'todas' });
  const aberta = tris(r.comum.vidro, r.comum.opaco, r.agua, r.efeitos);
  const pontes = pecasDe('ponte').reduce((a, q) => { const d = montarPeca(q); return a + tris(d.opaco, d.vidro); }, 0);
  const quedas = pecasDe('queda').reduce((a, q) => a + tris(montarPeca(q).efeitos), 0);
  assert.ok(pontes <= 8 * 2500 && pontes > 8 * 300, `as 8 pontes: ${pontes} triângulos`);
  assert.ok(quedas <= 4 * 1500, `as 4 quedas: ${quedas} triângulos`);
  // sem o par de torres (que o teste de cima conta), o comum, a água e os efeitos já ficam bem abaixo dos 60 mil da vista aberta
  assert.ok(aberta < TETO_ABERTA_V3, `o comum, a água e os efeitos: ${aberta} triângulos`);
});

// ------------------------------------------------------------------------------------------------ X1b: obra e voo

const etapasNa = (id, p = 0.5) => {
  const ids = ['lago.e1', 'torre.e1', 'torre.e2', 'torre.e3', 'torre.e4'];
  const k = id === 'todas' ? ids.length : ids.indexOf(id);
  return ids.map((e, i) => ({ id: e, estado: i < k ? ETAPA.PRONTA : i === k ? ETAPA.EM_OBRA : ETAPA.TRANCADA, progresso: i < k ? 1 : i === k ? p : 0 }));
};

test('obra (X1b): o corte por lado sobe com as etapas, a Legacy atrás, a Dream Bridge e o vão; só materiais do conjunto fixo', () => {
  assert.equal(estadoObra(etapasNa('lago.e1')).torre, false);
  assert.equal(estadoObra(etapasNa('lago.e1')).lago, true);
  const e1 = estadoObra(etapasNa('torre.e1', 0.5));
  assert.ok(e1.torre && Math.abs(e1.blade - e1.legacy) < 1e-9 && e1.blade === 20, 'o pódio sobe junto');
  const e2 = estadoObra(etapasNa('torre.e2', 0.5));
  assert.ok(e2.legacy < e2.blade, 'a Legacy um passo atrás');
  assert.equal(e2.ponte, false);
  assert.ok(e2.vao <= PODIO.altura + VAO_PE, 'o vão só tem o pódio e as marquises do pé das torres');
  const e4 = estadoObra(etapasNa('torre.e4', 0.6));
  assert.equal(e4.ponte, true);
  assert.equal(e4.vao, Math.min(e4.blade, e4.legacy));
  assert.equal(estadoObra(etapasNa('todas')).torre, false, 'pronta: sem obra');
  // o par cortado: o eixo das torres no uniforme, a Blade do lado negativo
  const ctx = ctxFalso();
  const m = materiais(ctx);
  const antes = [...m.lista].map((x) => fontesDoPrograma(x));
  const par = criarPar(ctx);
  par.posicionar(A.torre.x, 12, A.torre.z, A.torre.rot);
  par.cortePorLado(150, 120, 41);
  const u = m.torreOpaco.userData.uniformes;
  const [blade, legacy] = torresDoPar(A.torre);
  const lado = (t) => (t.x - u.uCorteEixo.value.x) * u.uCorteEixo.value.z + (t.z - u.uCorteEixo.value.y) * u.uCorteEixo.value.w;
  assert.ok(lado(blade) < -PAR.vao / 2 && lado(legacy) > PAR.vao / 2, 'a Blade de um lado, a Legacy do outro');
  assert.deepEqual([u.uCorteH.value.x, u.uCorteH.value.y, u.uCorteH.value.z, u.uCorteH.value.w], [162, 132, 53, MEIO_VAO_CORTE]);
  // as faces internas (a 14 m do centro, no limite do vão) e os montantes ficam do lado das torres: com o limite em
  // 14 m o arredondamento as jogava no vão, cortado no pódio, e a face sumia na obra
  for (const lod of [0, 1]) {
    const mp = malhasPar({ lod });
    let perto = 0;
    let dentro = 0;
    for (const mm of [mp.vidro, mp.opaco]) {
      for (let i = 0; i < mm.p.length; i += 3) {
        const ax = Math.abs(mm.p[i]);
        const y = mm.p[i + 1];
        if (y <= PODIO.altura + VAO_PE || y >= PAR.ponte.pernas.cota - 3) continue;
        if (ax < PAR.vao / 2 + 0.75) perto++;
        if (ax < MEIO_VAO_CORTE) dentro++;
      }
    }
    assert.ok(perto > 0 && dentro === 0, `LOD${lod}: ${dentro} vértices das torres no vão cortado`);
  }
  // os materiais das partes não cortam; desfazer volta ao inteiro
  assert.equal(m.opaco.userData.uniformes.uCorteH.value.x, 1e6);
  par.corte();
  assert.equal(u.uCorteH.value.x, 1e6);
  assert.deepEqual([...m.lista].map((x) => fontesDoPrograma(x)), antes, 'o corte é uniforme: nenhum programa muda');
  par.descartar();
  // o fantasma da obra é o mesmo programa do fantasma, só com o uAcima
  const f0 = materialFantasma(ganchos);
  const f1 = materialFantasma(ganchos);
  f1.uniforms.uAcima.value = 1;
  assert.equal(fontesDoPrograma(f1), fontesDoPrograma(f0));
  f0.dispose();
  f1.dispose();
  descartarMateriais(ctx);
});

test('obra (X1b): a grua de treliça em trechos iguais até uns 545 m na Blade, a cabeça e os canteiros sem NaN', () => {
  const mm = malhaMastro(GRUA.topoBlade + GRUA.trecho);
  conferirMalha(mm.malha, 'mastro');
  assert.equal(mm.malha.i.length, mm.trechos * mm.porTrecho, 'todo trecho com os mesmos índices (drawRange)');
  assert.ok(mm.trechos * GRUA.trecho >= 540 && GRUA.topoBlade > TL.mastro.topo, 'acima do mastro de 520 m');
  const cab = malhaCabeca();
  conferirMalha(cab, 'cabeça');
  const cx = caixaDe(cab);
  assert.ok(cx[3] > 55 && cx[0] < -18, 'lança e contralança');
  for (const [nome, m] of [['lago', malhaCanteiroLago(CX, CZ, 12)], ['torre', malhaCanteiroTorre(CX, CZ, 12)]]) {
    conferirMalha(m, nome);
    const b = m.caixa();
    assert.ok(Math.hypot(b[3] - CX, b[5] - CZ) < GLEBA_ENVELOPE.raio, `${nome}: dentro da gleba`);
  }
  // a frente de obra: 3 pavimentos de esqueleto com o núcleo na frente, e a planta que recua com as lâminas
  const fr = malhaFrente();
  conferirMalha(fr, 'frente de obra');
  const bf = fr.caixa();
  assert.ok(Math.abs(bf[4] - (ALTURA_FRENTE + 8.4)) < 1e-6, 'o núcleo 2 pavimentos acima das lajes');
  assert.ok(bf[0] < -17.9 && bf[3] > 17.9 && bf[2] < 0 && bf[5] > 49.9, 'a planta inteira de 36 x 50 m');
  for (const spec of [TL, TORRE_IRMA]) {
    assert.equal(plantaNaAltura(spec, 60), 25);
    assert.equal(plantaNaAltura(spec, spec.laminas[2].topo + 1), 15);
    assert.equal(plantaNaAltura(spec, spec.laminas[1].topo + 1), 1);
    assert.equal(plantaNaAltura(spec, spec.laminas[0].topo + 1), -25 + spec.coroa.fundo);
  }
  // o vidro sobe sem salto: nasce no pódio, a frente de obra entre ele e a obra, e fecha nos últimos 12,6 m da coroa
  for (const spec of [TL, TORRE_IRMA]) {
    let ant = alturaVidro(0, spec);
    for (let h = 0.25; h <= spec.altura + 20; h += 0.25) {
      const v = alturaVidro(h, spec);
      assert.ok(v >= ant - 1e-9 && v - ant <= 0.5 + 1e-9, `${spec.nome}: o vidro salta em ${h} m (${ant} para ${v})`);
      assert.ok(v <= h + 1e-9 && espessuraFrente(h, spec) <= ALTURA_FRENTE);
      ant = v;
    }
    assert.equal(alturaVidro(spec.altura - 2, spec), spec.altura - 2, `${spec.nome}: a frente fecha antes da coroa`);
    assert.equal(espessuraFrente(PODIO.altura, spec), 0);
  }
  // o leito de terra fica no fundo da cava; o tapume abre as 8 avenidas
  const lago = malhaCanteiroLago(CX, CZ, 12);
  assert.ok(Math.min(...lago.p.filter((_, i) => i % 3 === 1)) < 12 + LAGO.nivel);
  // no render: os materiais fixos e a altura acompanhando a obra
  const ctx = ctxFalso();
  const mats = materiais(ctx);
  const obra = criarObra(ctx, mats.opaco);
  obra.montar(A, 12);
  obra.quadro(0, { torre: true, blade: 200, legacy: 150, lago: false });
  const usados = new Set();
  obra.grupo.traverse((o) => o.material && usados.add(o.material));
  for (const x of usados) assert.ok(mats.lista.has(x), `${x.name} fora do conjunto fixo`);
  const gr = obra.grupo.children.filter((o) => o.isGroup);
  assert.equal(gr.length, 2);
  const topo = (g) => g.children.find((o) => o.name.endsWith('cabeca')).position.y;
  assert.ok(topo(gr[0]) >= 200 + GRUA.folga && topo(gr[0]) < 200 + GRUA.folga + GRUA.trecho);
  assert.ok(topo(gr[1]) < topo(gr[0]), 'a da Legacy mais baixa');
  obra.quadro(0, { torre: true, blade: 520, legacy: 452, lago: false });
  assert.ok(topo(gr[0]) >= 540 && topo(gr[0]) <= GRUA.topoBlade + GRUA.trecho);
  obra.quadro(0, { torre: false, lago: false });
  assert.equal(gr[0].visible, false, 'pronta: as gruas saem');
  obra.descartar();
  descartarMateriais(ctx);
});

test('helicóptero (D61): pousa no centro do heliponto da Blade de frente para a torre, voa sobre o mar, malha leve', () => {
  const R = rotaDoVoo(GLEBA_ENVELOPE.cota);
  assert.ok(Math.hypot(R.pad[0] - POUSO.x, R.pad[2] - POUSO.z) < 1e-9);
  assert.ok(Math.abs(R.pad[1] - (GLEBA_ENVELOPE.cota + POUSO.y) - 1.35) < 1e-9, 'os esquis no tabuleiro');
  let noChao = 0;
  let min = Infinity;
  for (let t = 0; t < CICLO.total; t += 0.5) {
    const q = posicaoNoCiclo(t, R);
    if (q.noChao) {
      noChao++;
      assert.deepEqual(q.p, R.pad);
    }
    for (const v of q.p) assert.ok(Number.isFinite(v));
    if (!q.noChao) min = Math.min(min, q.p[1]);
  }
  assert.ok(noChao * 0.5 >= 40, 'fica uns 45 s pousado');
  assert.ok(min >= R.pad[1] - 1e-9, 'nunca abaixo do heliponto (nada atravessa a torre)');
  // a chegada vem do mar (ao sul da sede)
  assert.ok(R.chegada[2] > SEDE_CENTRO[1] + 1000);
  // de frente para a torre: o nariz (+x local) aponta do heliponto para o centro da Blade
  const dx = TORRE_POSICAO.x - POUSO.x;
  const dz = TORRE_POSICAO.z - POUSO.z;
  const rumo = Math.atan2(-dz, dx);
  assert.ok(Math.abs(Math.atan2(Math.sin(rumo - R.frente), Math.cos(rumo - R.frente))) < 0.2 || Math.hypot(dx, dz) < 8);
  const h = malhaHelicoptero('#c9a86a');
  conferirMalha(h, 'helicóptero');
  assert.ok(h.triangulos + malhaRotor().triangulos + malhaRotorCauda().triangulos < 1500);
  const b = h.caixa();
  assert.ok(b[3] - b[0] > 12 && b[3] - b[0] < 16, 'uns 13 m de ponta a ponta');
});

test('plano no jogo (X1b): na obra o pódio sai à parte, o lago em obra sem o espelho fantasma, o lago pronto traz os portões', () => {
  const chao = () => 12;
  const base = malhasDoPlano('A', { chao, prontas: new Set(), paisagem: false });
  const obra = malhasDoPlano('A', { chao, prontas: new Set(['lago']), paisagem: 'portoes', podioObra: true });
  assert.equal(base.podio, null);
  assert.ok(obra.podio.opaco.triangulos > 0 && obra.podio.vidro.triangulos > 0, 'o pódio nos materiais das torres');
  assert.ok(obra.fantasma.opaco.triangulos < base.fantasma.opaco.triangulos, 'o pódio não fica no fantasma');
  const lagoObra = malhasDoPlano('A', { chao, prontas: new Set(), paisagem: false, lagoObra: true });
  assert.ok(lagoObra.fantasma.opaco.triangulos < base.fantasma.opaco.triangulos, 'sem o espelho de holograma sobre a terra');
  // os portões e a praça com o lago pronto (8 portões: 3 caixas cada)
  assert.ok(obra.comum.opaco.triangulos > malhasDoPlano('A', { chao, prontas: new Set(['lago']), paisagem: false }).comum.opaco.triangulos);
  conferirMalha(obra.comum.opaco, 'portões');
});
