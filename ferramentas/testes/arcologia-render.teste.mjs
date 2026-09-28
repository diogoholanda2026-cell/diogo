// Testes do render da Arcologia (X1a e SEDE2): as torres gêmeas da D64 (500 e 452 m pelo mesmo gerador, recuos a 49,
// 70 e 91%, a fenda de 10 m, orçamento por perfil, LOD1 com a mesma caixa, sombra dentro do vidro), a sede v2 da D63
// (o anel de 481 por 358 m com os pórticos, o lago com a ilha, as fontes), a cúpula da D65 (240 por 80 m), os planos
// da D59 como dados, nada fora da gleba, os tetos de triângulos da D66 e a garantia de que nenhum material da
// Arcologia muda de programa entre o dia, a noite, os LODs e o fantasma. Sem navegador.
// Roda sozinho: node ferramentas/testes/arcologia-render.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  malhasTorre, malhasTorreLod1, malhaSombraTorre, malhasPar, malhaSombraPar, trechosCorpo, contornoTrecho, medidasTorre,
  NIVEL, Malha, triangular, areaPoli, DIST_LOD0, LUZ_NOITE, torno, cilindro, materiais, descartarMateriais,
  atualizarArcologia, UNIFORMES, CHAVES, criarPar, criarTorre, criarAquecimento, VIDRO, LUZ, malhaJato, FONTES,
} from '../../fonte/render/arcologia/torre.js';
import { ganchos } from '../../fonte/render/motor/ganchos.js';
import { assentarHora } from '../../fonte/render/cenas/torre.js';
import { VISTAS_SEDE, TETO_ARCOLOGIA } from '../../fonte/render/cenas/planos.js';
import { malhasDoPlano, pontoDentro, tocaGleba, pontoNaAgua, DIST_PARTES_LOD0 } from '../../fonte/render/arcologia/planos.js';
import { ORCAMENTO } from '../../fonte/contratos/render.js';
import { montarParte, deslocar, PECAS_COM_LOD } from '../../fonte/render/arcologia/partes.js';
import { cavarTerreno, descavar, materialAgua } from '../../fonte/render/arcologia/lago.js';
import { materialFantasma } from '../../fonte/render/arcologia/fantasma.js';
import {
  TORRE_LAMINA as TL, TORRE_IRMA, especTorre, RECUOS, GEMEAS, torresGemeas, PLANOS, PARTES_ORDEM, GLEBA_ENVELOPE,
  cavaDoPlano, POUSO, TORRE_POSICAO, HELIPONTO_LOCAL, torreParaMundo, suavizar, CAMERA_ARCOLOGIA,
} from '../../fonte/data/arcologia-plano.js';
import { pontoNoPoligono, distPoligono } from '../../fonte/comum/vetor.js';

const caixaDe = (...ms) => {
  const bs = ms.map((m) => m.caixa()).filter(Boolean);
  return [0, 1, 2].map((e) => Math.min(...bs.map((b) => b[e]))).concat([3, 4, 5].map((e) => Math.max(...bs.map((b) => b[e]))));
};
const tris = (...ms) => ms.reduce((a, m) => a + (m?.triangulos ?? 0), 0);
const trisDe = (o) => tris(...Object.values(o).filter((m) => m instanceof Malha));

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

// ------------------------------------------------------------------------------------------------ as torres (D64)

test('torres: 500 e 452 m, recuos a 49, 70 e 91% da altura, espelhados, heliponto e mastro só na maior', () => {
  assert.equal(TL.altura, 500);
  assert.equal(TORRE_IRMA.altura, 452);
  for (const s of SPECS) {
    const topos = s.laminas.map((l) => l.topo);
    // lâmina 1 (a mais alta) a 91%, a 2 a 70%, a 3 a 49%: arredondados ao pavimento de 4,2 m
    [RECUOS[2], RECUOS[1], RECUOS[0]].forEach((f, i) => assert.ok(Math.abs(topos[i] / s.altura - f) < 0.01, `${s.nome}: lâmina ${i + 1} a ${(topos[i] / s.altura).toFixed(3)}`));
    // a conta dos pavimentos fecha, os andares de vento ficam no terraço da 3 e logo abaixo do da 2
    const corpo = topos[0] - s.podio.altura - s.andaresDeVento.reduce((a, v) => a + v.altura, 0);
    assert.equal(Math.round(corpo / s.pavimentos.altura), s.pavimentos.n);
    assert.equal(s.andaresDeVento[0].base, topos[2]);
    assert.ok(Math.abs(s.andaresDeVento[1].base + s.andaresDeVento[1].altura - topos[1]) < 1e-6);
    assert.ok(Math.abs(s.coroa.base + s.coroa.altura - s.altura) < 1e-6, `${s.nome}: a coroa fecha no topo`);
    assert.deepEqual([s.planta.largura, s.planta.comprimento], [36, 50]);
  }
  assert.equal(TL.heliponto.cota, 500);
  assert.equal(TL.mastro.topo, 520);
  assert.equal(TORRE_IRMA.heliponto, null);
  assert.equal(TORRE_IRMA.mastro, null);
  assert.equal(medidasTorre(TORRE_IRMA).HELI, null);
  // o gerador é um só: a mesma função dá a torre de qualquer altura
  const t330 = especTorre(330);
  assert.deepEqual(t330.laminas.map((l) => l.topo), [301, 229.6, 163]);
});

test('torres: topo de cada uma na altura dela (a Lâmina no tabuleiro do heliponto, a irmã no aro) e o mastro', () => {
  for (const s of SPECS) {
    const m = malhasTorre({ nivel: 1, spec: s, gemea: true });
    const cx = caixaDe(m.vidro, m.opaco);
    if (s.mastro) assert.equal(cx[4], s.mastro.topo, `${s.nome}: topo do mastro`);
    else assert.ok(Math.abs(cx[4] - (s.altura + 0.7)) < 0.01, `${s.nome}: topo ${cx[4]} (aro e luzes de obstáculo)`);
  }
  // o topo do tabuleiro do heliponto da Lâmina é a cota 500 (vértices virados para cima perto do centro)
  const m = malhasTorre({ nivel: 1, spec: TL, gemea: true });
  let topoHeli = -Infinity;
  for (let i = 0; i < m.opaco.p.length; i += 3) {
    const y = m.opaco.p[i + 1];
    if (m.opaco.n[i + 1] > 0.99 && Math.hypot(m.opaco.p[i] - HELIPONTO_LOCAL.x, m.opaco.p[i + 2] - HELIPONTO_LOCAL.z) < 6 && y < 510) topoHeli = Math.max(topoHeli, y);
  }
  assert.ok(Math.abs(topoHeli - 500) < 0.05, `topo do heliponto em ${topoHeli}`);
});

test('torres: orçamento por perfil (D66: LOD0 até 70 mil cada no Alta), LOD1 e sombra', () => {
  for (const s of SPECS) {
    const faixa = s.triangulos.lod0;
    for (const perfil of ['media', 'alta', 'ultra']) {
      const m = malhasTorre({ nivel: NIVEL[perfil], spec: s, gemea: true });
      const n = tris(m.vidro, m.opaco);
      assert.ok(n >= faixa[perfil][0] && n <= faixa[perfil][1], `${s.nome} LOD0 ${perfil}: ${n} triângulos (${faixa[perfil].join(' a ')})`);
      assert.ok(n <= 70000, `${s.nome}: ${n} > 70 mil`);
    }
    const l1 = malhasTorreLod1({ spec: s, gemea: true });
    const n1 = tris(l1.vidro, l1.opaco);
    assert.ok(n1 >= s.triangulos.lod1[0] && n1 <= s.triangulos.lod1[1], `${s.nome} LOD1: ${n1} (${s.triangulos.lod1.join(' a ')})`);
    const sb = malhaSombraTorre({ spec: s, gemea: true });
    assert.ok(sb.triangulos > 40 && sb.triangulos < 400, `${s.nome} sombra: ${sb.triangulos}`);
    const lv = malhasTorre({ nivel: 0, spec: s, gemea: true });
    assert.ok(tris(lv.vidro, lv.opaco) < faixa.media[0], `${s.nome}: o leve fica abaixo da média`);
  }
  // a Torre sozinha (planos B e C) com a esplanada também cabe
  const so = malhasTorre({ nivel: NIVEL.alta, comEsplanada: true });
  assert.ok(tris(so.vidro, so.opaco) <= 70000);
});

test('torres: malhas sem NaN, normais boas e índices no lugar, em todos os níveis', () => {
  for (const s of SPECS) {
    for (const nivel of [0, 1, 2, 3]) {
      const m = malhasTorre({ nivel, spec: s, gemea: true });
      conferirMalha(m.vidro, `${s.nome} LOD0 ${nivel} vidro`);
      conferirMalha(m.opaco, `${s.nome} LOD0 ${nivel} opaco`);
    }
    const l1 = malhasTorreLod1({ spec: s, gemea: true });
    conferirMalha(l1.vidro, `${s.nome} LOD1 vidro`);
    conferirMalha(l1.opaco, `${s.nome} LOD1 opaco`);
    conferirMalha(malhaSombraTorre({ spec: s }), `${s.nome} sombra`);
  }
  const p = malhasPar({ nivel: 1, lod: 0 });
  for (const k of ['vidro', 'opaco', 'efeitos']) conferirMalha(p[k], `par ${k}`);
});

test('torres: o LOD1 tem a mesma caixa do LOD0 e o volume de sombra fica dentro dela', () => {
  for (const s of SPECS) {
    for (const nivel of [1, 2]) {
      const m0 = malhasTorre({ nivel, spec: s, gemea: true });
      const m1 = malhasTorreLod1({ spec: s, gemea: true });
      const a = caixaDe(m0.vidro, m0.opaco);
      const b = caixaDe(m1.vidro, m1.opaco);
      // (a rede de proteção do heliponto, só no LOD0, passa 5 cm da face lisa)
      for (let e = 0; e < 6; e++) assert.ok(Math.abs(a[e] - b[e]) < 0.06, `${s.nome} caixa ${e}: LOD0 ${a[e]} x LOD1 ${b[e]}`);
      const sb = caixaDe(malhaSombraTorre({ spec: s, gemea: true }));
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
    // nenhum vidro do corpo passa de 240 m de v (o trecho mais longo: 55 andares de 4,2 m), mesmo na torre de 500 m
    const m = malhasTorre({ nivel: 1, spec: s, gemea: true });
    let maxV = 0;
    for (let i = 0; i < m.vidro.c.length / 4; i++) if (m.vidro.c[4 * i] <= VIDRO.vento) maxV = Math.max(maxV, m.vidro.uv[2 * i + 1]);
    assert.ok(maxV < 240, `${s.nome}: v até ${maxV}`);
    // as peças acesas da coroa levam o v de 0 a 30 (o brilho sobe igual nas duas coroas)
    let coroa = 0;
    for (let i = 0; i < m.opaco.c.length / 4; i++) {
      const pk = Math.round(m.opaco.c[4 * i + 3]);
      if (((pk >> 4) & 15) === LUZ.coroa) {
        coroa++;
        assert.ok(m.opaco.uv[2 * i + 1] >= -1e-6 && m.opaco.uv[2 * i + 1] <= 30 + 1e-6);
      }
    }
    assert.ok(coroa > 50, `${s.nome}: coroa acesa`);
  }
});

test('par: fenda de 10 m no eixo norte-sul, faces lisas de frente uma para a outra, lâminas espelhadas para fora', () => {
  assert.equal(GEMEAS.fenda, 10);
  const [lam, irma] = torresGemeas({ x: 0, z: 0, rot: 0 });
  assert.equal(lam.spec, TL);
  assert.equal(irma.spec, TORRE_IRMA);
  assert.ok(lam.x > 0 && irma.x < 0, 'a Lâmina a leste, a irmã a oeste');
  // a face lisa (z local = -25) de cada uma fica na borda da fenda
  for (const t of [lam, irma]) {
    const p = torreParaMundo(t, 0, 0, -25);
    assert.ok(Math.abs(Math.abs(p.x) - GEMEAS.fenda / 2) < 1e-6, `face lisa em x = ${p.x}`);
    const pen = torreParaMundo(t, 0, 0, 25);
    assert.ok(Math.abs(pen.x) > 50, 'as penas olham para fora');
  }
  // no par de verdade: acima da ponte, nada do vidro entra na fenda e ele encosta nela (x = ±5)
  const p = malhasPar({ nivel: 1, lod: 0 });
  let minVidro = Infinity;
  for (let i = 0; i < p.vidro.p.length; i += 3) if (p.vidro.p[i + 1] > 60) minVidro = Math.min(minVidro, Math.abs(p.vidro.p[i]));
  assert.ok(Math.abs(minVidro - GEMEAS.fenda / 2) < 0.01, `vidro a ${minVidro} do eixo`);
  let minOpaco = Infinity;
  for (let i = 0; i < p.opaco.p.length; i += 3) if (p.opaco.p[i + 1] > 60 && p.opaco.p[i + 1] < 440) minOpaco = Math.min(minOpaco, Math.abs(p.opaco.p[i]));
  assert.ok(minOpaco > GEMEAS.fenda / 2 - 0.5, `montantes a ${minOpaco} do eixo (só os 35 cm das aletas da face lisa)`);
  // a ponte a 45 m cruza a fenda e a cachoeira cai dela até o poço, com os dutos subindo
  const b = caixaDe(p.efeitos);
  assert.ok(Math.abs(b[4] - (GEMEAS.ponte.cota - 0.3)) < 0.5 || b[4] > GEMEAS.ponte.cota - 4, 'a água parte da ponte');
  assert.ok(b[1] <= GEMEAS.poco.nivel + 0.1, 'e chega ao poço');
  let dutos = 0;
  for (let i = 0; i < p.efeitos.c.length; i += 4) if (p.efeitos.c[i] === 1) dutos++;
  assert.ok(dutos > 40, 'dutos de vidro com a água subindo');
  conferirMalha(malhaSombraPar(), 'sombra do par');
});

test('torres: pouso do helicóptero no centro do heliponto da Lâmina, no mundo, dentro da gleba', () => {
  const p = torreParaMundo(TORRE_POSICAO, HELIPONTO_LOCAL.x, HELIPONTO_LOCAL.y, HELIPONTO_LOCAL.z);
  assert.ok(Math.abs(p.x - POUSO.x) < 1e-6 && Math.abs(p.z - POUSO.z) < 1e-6 && p.y === 500);
  assert.ok(pontoNoPoligono(POUSO.x, POUSO.z, GLEBA_ENVELOPE.contorno));
  // a Torre do plano A é a Lâmina do par: 30 m a leste do meio da fenda, olhando para leste
  const [lam] = torresGemeas(PLANOS.A.torre);
  assert.ok(Math.abs(TORRE_POSICAO.x - lam.x) < 0.01 && Math.abs(TORRE_POSICAO.z - lam.z) < 0.01);
});

test('torres: malhas determinísticas (a mesma entrada dá os mesmos números)', () => {
  const a = malhasPar({ nivel: 2, lod: 0 });
  const b = malhasPar({ nivel: 2, lod: 0 });
  assert.deepEqual(a.opaco.p, b.opaco.p);
  assert.deepEqual(a.vidro.c, b.vidro.c);
  assert.deepEqual(a.efeitos.uv, b.efeitos.uv);
});

test('torres: LOD0 só de perto (aletas e montantes finos não fazem moiré) e LOD1 com as aletas do corpo no shader', () => {
  const ordem = ['leve', 'media', 'alta', 'ultra'];
  for (let i = 1; i < ordem.length; i++) assert.ok(DIST_LOD0[ordem[i]] > DIST_LOD0[ordem[i - 1]], 'distâncias crescem com o perfil');
  const pixel = (d) => (2 * d * Math.tan((20 * Math.PI) / 180)) / 1080;
  assert.ok(TL.aletas.espessura / pixel(DIST_LOD0.media) >= 0.5);
  const X = TL.planta.largura / 2;
  for (const s of SPECS) {
    const l1 = malhasTorreLod1({ spec: s });
    let corpo = 0;
    for (let i = 0; i < l1.opaco.p.length; i += 3) {
      const [x, y] = [Math.abs(l1.opaco.p[i]), l1.opaco.p[i + 1]];
      if (x > X + 0.05 && x < X + TL.aletas.fundo + 0.05 && y > s.podio.altura + 20 && y < s.laminas[2].topo - 20) corpo++;
    }
    assert.equal(corpo, 0, `${s.nome}: aletas do corpo em geometria no LOD1`);
  }
});

test('torres: luz da noite calibrada para a exposição da R1a (janela quente sem estourar, lanterna e aro acendem o bloom)', () => {
  const tela = (v) => v * LUZ_NOITE.exposicaoNoite;
  assert.ok(tela(LUZ_NOITE.janela) > 0.8 && tela(LUZ_NOITE.janela) < 2, `janela ${tela(LUZ_NOITE.janela)}`);
  assert.ok(tela(LUZ_NOITE.forro) > tela(LUZ_NOITE.janela) && tela(LUZ_NOITE.forro) < 4);
  assert.ok(tela(LUZ_NOITE.lanterna) > tela(LUZ_NOITE.forro));
  assert.ok(tela(LUZ_NOITE.aro) > 4 && tela(LUZ_NOITE.aro) < 16);
});

// ------------------------------------------------------------------------------------------------ programas (D66)

/** Contexto falso de render (sem WebGL): o bastante para montar materiais, a Torre, o par e o aquecimento. */
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
  // um conjunto fixo, criado de uma vez: pedir de novo devolve os mesmos objetos
  assert.equal(materiais(ctx), m);
  assert.deepEqual(new Set(lista.map((x) => x.name)), new Set(['arcologia:vidro', 'arcologia:opaco', 'arcologia:claro', 'arcologia:cascata', 'arcologia:jato']));
  // as variantes de um mesmo material (LOD0 e LOD1, a Torre e as partes) têm a mesma chave e o mesmo código: um
  // programa só; o que muda entre elas são uniformes
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
  // o dia e a noite, com e sem a luz do ambiente da cena, não tocam em material nenhum (nem envMap, nem needsUpdate)
  const versoes = lista.map((x) => x.version);
  const chaves = lista.map((x) => x.customProgramCacheKey());
  for (const [env, noite] of [[null, 0], [null, 1], [{ isTexture: true }, 0], [{ isTexture: true }, 1], [null, 0.5]]) {
    ctx.cena.environment = env;
    atualizarArcologia(ctx, 1000 * noite, { noite, hora: noite ? 21 : 12 });
    assert.equal(UNIFORMES.uNoite.value, noite);
  }
  assert.deepEqual(lista.map((x) => x.version), versoes, 'needsUpdate em tempo de jogo recompila');
  assert.deepEqual(lista.map((x) => x.customProgramCacheKey()), chaves);
  for (const x of lista) assert.equal(x.envMap, null, `${x.name}: envMap próprio (o reflexo é o da cena)`);
  // os transparentes de dois lados numa passada só: o three desenha os outros em duas chamadas e troca o lado com
  // needsUpdate a cada quadro
  for (const x of [m.cascata, m.jato]) assert.ok(x.side !== THREE.DoubleSide || x.forceSinglePass, `${x.name}: duas passadas por quadro`);
  UNIFORMES.uNoite.value = 0;
  descartarMateriais(ctx);
});

test('programas: a Torre e o par usam só o conjunto fixo, trocar o perfil refaz a geometria e nunca solta o programa', () => {
  const ctx = ctxFalso();
  const m = materiais(ctx);
  const antes = [...m.lista];
  const usados = (g) => {
    const s = new Set();
    g.traverse((o) => o.material && s.add(o.material));
    return s;
  };
  for (const perfil of ['media', 'alta']) {
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
  criarPar(ctx).descartar();
  assert.equal(soltos, 0, 'descartar a Torre soltou um material (o programa sairia e compilaria de novo)');
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
  // espera a luz do ambiente: sem ela o programa sairia com outra chave (é o que o vidro fazia)
  assert.equal(a.quadro(), false);
  ctx.cena.environment = { isTexture: true };
  assert.equal(a.quadro(), true);
  assert.equal(a.quadro(), true);
  assert.equal(a.quadro(), false);
  assert.ok(a.feito && !a.grupo.visible);
  a.descartar();
  descartarMateriais(ctx);
});

// ------------------------------------------------------------------------------------------------ planos (dados)

const DENTRO = GLEBA_ENVELOPE.contorno;
const PARTES_D59 = ['torre', 'lago', 'sede', 'anel', 'biblioteca', 'vida', 'escola', 'universidade', 'fisica'];
const pecasDe = (P, tipo) => P.partes.flatMap((p) => p.pecas).filter((p) => p.tipo === tipo);

test('planos: os três da D59 com todas as partes; o A é a sede v2 (anel, gêmeas, lago circular, cúpula)', () => {
  assert.deepEqual(Object.keys(PLANOS).sort(), ['A', 'B', 'C']);
  assert.deepEqual([...PARTES_ORDEM], PARTES_D59);
  for (const [id, P] of Object.entries(PLANOS)) {
    assert.equal(P.id, id);
    assert.deepEqual(P.partes.map((p) => p.id).sort(), [...PARTES_D59].sort(), `${id}: partes`);
    const tipos = (parte) => P.partes.find((p) => p.id === parte).pecas.map((p) => p.tipo);
    assert.ok(tipos('lago').includes('reservatorio'), `${id}: reservatório`);
    assert.ok(tipos('vida').includes('supertree'), `${id}: Supertrees`);
    assert.ok(P.referencias.length >= 2 && P.ideia, `${id}: referências reais`);
    if (id === 'A') continue;
    assert.equal(tipos('sede').filter((t) => t === 'conselho').length, 2, `${id}: duas Torres do Conselho`);
    assert.ok(tipos('vida').includes('vida'), `${id}: a casca da Vida`);
  }
  const A = PLANOS.A;
  assert.ok(A.torre.gemeas, 'o A tem as torres gêmeas');
  const [sede] = pecasDe(A, 'sedeAnel');
  assert.equal(2 * sede.rFora, 481);
  assert.equal(2 * sede.rDentro, 358);
  assert.equal(sede.andares, 4);
  assert.equal(sede.altura, 30);
  assert.deepEqual([...sede.portais].sort((a, b) => a - b), [0, 90, 180, 270]);
  assert.deepEqual([sede.vao, sede.pe], [40, 18]);
  const [lago] = pecasDe(A, 'reservatorio');
  assert.equal(lago.forma, 'circulo');
  assert.equal(2 * lago.raio, 270);
  assert.deepEqual([lago.cx, lago.cz], [250, 570]);
  assert.deepEqual([A.torre.x, A.torre.z], [250, 570], 'as torres na ilha, no centro do lago');
  const [cup] = pecasDe(A, 'cupula');
  assert.deepEqual([cup.diametro, cup.altura, cup.x, cup.z], [240, 80, -175, 570]);
  // as Supertrees ao sul da cúpula
  for (const s of pecasDe(A, 'supertree')) assert.ok(s.z > cup.z + cup.diametro / 2, 'Supertree fora do bosque ao sul');
  assert.equal(A.portoes.find((p) => p.id === 'norte').x, 250, 'portão norte no eixo');
  assert.deepEqual(CAMERA_ARCOLOGIA.x, 250);
});

test('planos: torres, portões e vias dentro da gleba; portões na borda; as torres fora da água', () => {
  for (const [id, P] of Object.entries(PLANOS)) {
    assert.ok(pontoNoPoligono(P.torre.x, P.torre.z, DENTRO), `${id}: Torre fora da gleba`);
    for (const g of P.portoes) assert.ok(distPoligono(g.x, g.z, DENTRO) < 1, `${id}: portão ${g.id} fora da borda`);
    for (const v of P.vias) for (let i = 0; i < v.pontos.length; i += 2) {
      const x = v.pontos[i];
      const z = v.pontos[i + 1];
      assert.ok(pontoNoPoligono(x, z, DENTRO) || distPoligono(x, z, DENTRO) < 1, `${id}: via fora da gleba em ${x}, ${z}`);
    }
    const res = P.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
    const c = Math.cos(P.torre.rot);
    const s = Math.sin(P.torre.rot);
    // o pódio da Torre (ou os dois pódios do par) não cai na água
    const pontos = P.torre.gemeas ? [[-69, -27], [69, -27], [69, 27], [-69, 27], [30, 0], [-30, 0]] : [[-26, -31], [26, -31], [26, 39], [-26, 39], [0, 0]];
    for (const [lx, lz] of pontos) {
      const x = P.torre.x + c * lx + s * lz;
      const z = P.torre.z - s * lx + c * lz;
      assert.ok(!pontoNoPoligono(x, z, res.contorno), `${id}: pódio da Torre dentro do reservatório`);
    }
    assert.ok(Math.abs(areaPoli(res.contorno)) > 5000, `${id}: reservatório pequeno demais`);
    for (let i = 0; i < res.contorno.length; i += 2) assert.ok(pontoNoPoligono(res.contorno[i], res.contorno[i + 1], DENTRO), `${id}: reservatório sai da gleba`);
    assert.ok(res.fundo < res.nivel && res.nivel < 0, `${id}: nível e fundo relativos à gleba`);
  }
});

test('planos: margens de água macias (nenhuma quina de polígono nos reservatórios)', () => {
  const quina = (P, i) => {
    const n = P.length / 2;
    const a = [P[2 * i] - P[2 * ((i + n - 1) % n)], P[2 * i + 1] - P[2 * ((i + n - 1) % n) + 1]];
    const b = [P[2 * ((i + 1) % n)] - P[2 * i], P[2 * ((i + 1) % n) + 1] - P[2 * i + 1]];
    const c = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1);
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  };
  for (const id of ['B', 'C']) {
    const r = PLANOS[id].partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
    let pior = 0;
    for (let i = 0; i < r.contorno.length / 2; i++) pior = Math.max(pior, quina(r.contorno, i));
    assert.ok(pior < 45, `${id}: quina de ${pior.toFixed(1)} graus`);
  }
  // o A é um círculo com a ilha: a margem de fora (os 97 primeiros pontos, antes da fresta que liga o círculo à ilha)
  // não tem quina; as quinas que sobram são as da fresta e as do poço com a escada d'água, sob a água
  const r = PLANOS.A.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  let pior = 0;
  for (let i = 1; i < 96; i++) pior = Math.max(pior, quina(r.contorno, i));
  assert.ok(pior < 10, `A: quina de ${pior.toFixed(1)} graus na margem`);
  let quinas = 0;
  for (let i = 0; i < r.contorno.length / 2; i++) if (quina(r.contorno, i) > 30) quinas++;
  assert.ok(quinas <= 8, `A: ${quinas} quinas`);
  const { pontos, valores } = suavizar([0, 0, 100, 0, 100, 100], { fechado: false, voltas: 2, valores: [10, 20, 30] });
  assert.deepEqual(pontos.slice(0, 2), [0, 0]);
  assert.deepEqual(pontos.slice(-2), [100, 100]);
  assert.equal(valores.length, pontos.length / 2);
});

test('planos: as peças pousam em terra (o centro de cada uma fora da cava do reservatório)', () => {
  for (const [id, P] of Object.entries(PLANOS)) {
    const res = P.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
    for (const parte of P.partes) {
      for (const p of parte.pecas) {
        if (p.x === undefined) continue;
        const folga = p.tipo === 'vida' || p.tipo === 'cupula' ? p.diametro / 2 : 0;
        assert.ok(!pontoNoPoligono(p.x, p.z, res.contorno) && distPoligono(p.x, p.z, res.contorno) > folga, `${id}: ${p.tipo} em ${p.x}, ${p.z} dentro da água`);
      }
    }
  }
});

test('planos: a cava do lago como forma do aplainar (D5); no A, o anel de água em volta da ilha', () => {
  for (const id of Object.keys(PLANOS)) {
    const f = cavaDoPlano(id, 12, 7);
    assert.equal(f.tipo, 'cava');
    assert.equal(f.ref, 7);
    assert.ok(f.contorno.length >= 8 && f.contorno.length % 2 === 0);
    assert.ok(f.cota < f.nivel && f.nivel < 12, `${id}: leito abaixo da água, água abaixo da gleba`);
    assert.ok(triangular(f.contorno).indices.length >= 6);
  }
  const f = cavaDoPlano('A');
  assert.ok(pontoNoPoligono(250, 570 + 100, f.contorno), 'água ao sul da ilha');
  assert.ok(pontoNoPoligono(250 - 118, 570, f.contorno), 'água a oeste da ilha');
  assert.ok(!pontoNoPoligono(250 - 30, 570 - 20, f.contorno), 'a ilha fica fora da cava');
  assert.ok(pontoNoPoligono(250, 570, f.contorno) && pontoNoPoligono(250, 570 + 45, f.contorno), 'o poço e a escada d\'água na base da fenda, sim');
  assert.ok(!pontoNoPoligono(250 + 60, 570 + 10, f.contorno), 'o pódio da Lâmina em terra');
  assert.ok(!pontoNoPoligono(250, 570 - 150, f.contorno), 'o parque fora');
  const res = pecasDe(PLANOS.A, 'reservatorio')[0];
  const [ax, az] = pontoNaAgua(res);
  assert.ok(pontoNoPoligono(ax, az, f.contorno));
});

test('planos: as fontes dançam na água (entre a ilha e a margem), em arco no lado sul', () => {
  const A = PLANOS.A;
  const res = pecasDe(A, 'reservatorio')[0];
  const d = { chao: () => 12, vidro: new Malha('vidro'), opaco: new Malha('opaco'), jatos: [] };
  montarParte({ id: 'lago', pecas: pecasDe(A, 'fontes') }, d);
  assert.ok(d.jatos.length >= 64);
  for (const j of d.jatos) {
    assert.ok(Math.hypot(j.x - res.cx, j.z - res.cz) < res.raio - 12, 'jato na margem');
    assert.ok(((j.x - res.cx) / res.ilha.rx) ** 2 + ((j.z - res.cz) / res.ilha.rz) ** 2 > 1.3, 'jato na ilha');
    assert.ok(j.z > res.cz, 'no lado sul');
    assert.ok(j.f >= 0 && j.f <= 1 && (j.tipo === 0 || j.tipo === 1));
  }
  assert.ok(FONTES.altura >= 50 && FONTES.altura <= 150, 'jatos à escala das torres');
  assert.equal(malhaJato().triangulos, 32);
});

test('planos: no A, nenhuma via interna atravessa uma parte (a avenida do portão leste entra pelo vão da moradia)', () => {
  const A = PLANOS.A;
  const dSeg = (x, z, ax, az, bx, bz) => {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
  };
  const dPoli = (x, z, P) => {
    let m = Infinity;
    for (let i = 0; i + 3 < P.length; i += 2) m = Math.min(m, dSeg(x, z, P[i], P[i + 1], P[i + 2], P[i + 3]));
    return m;
  };
  for (const parte of A.partes) {
    if (parte.id === 'torre' || parte.id === 'lago') continue;
    const d = { chao: () => 12, vidro: new Malha('vidro'), opaco: new Malha('opaco'), claro: new Malha('claro'), lod: 1 };
    montarParte(parte, d);
    for (const m of [d.vidro, d.opaco, d.claro]) {
      for (let i = 0; i < m.p.length; i += 3) {
        if (m.p[i + 1] < 12.5) continue; // pisos e calçadas no chão
        for (const [k, v] of A.vias.entries()) {
          const folga = dPoli(m.p[i], m.p[i + 2], v.pontos) - v.largura / 2;
          assert.ok(folga > 3, `via ${k} passa ${folga.toFixed(1)} m dentro de ${parte.id} em ${m.p[i].toFixed(0)}, ${m.p[i + 2].toFixed(0)}`);
        }
      }
    }
  }
});

test('seleção: as caixas da Sede em anel seguem a curva (nenhuma cobre o lago) e a das fontes não chega ao anel', () => {
  const r = malhasDoPlano('A', { chao: () => GLEBA_ENVELOPE.cota, prontas: 'todas', paisagem: false, nivel: 1 });
  const [sede] = pecasDe(PLANOS.A, 'sedeAnel');
  const [lago] = pecasDe(PLANOS.A, 'reservatorio');
  const dentro = (b, x, z) => x >= b[0] && x <= b[3] && z >= b[2] && z <= b[5];
  const caixasSede = r.caixas.filter((c) => c.parte === 'sede').map((c) => c.caixa);
  assert.ok(caixasSede.length >= 16);
  let cobre = 0;
  let noAnel = 0;
  for (let a = 0; a < 360; a += 3) {
    const [c, s] = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
    // a água, da ilha à margem, fica fora das caixas da Sede
    for (let rr = 70; rr <= lago.raio; rr += 5) if (caixasSede.some((b) => dentro(b, lago.cx + rr * c, lago.cz + rr * s))) cobre++;
    // e o anel inteiro fica dentro de alguma
    const rm = (sede.rFora + sede.rDentro) / 2;
    if (caixasSede.some((b) => dentro(b, sede.cx + rm * c, sede.cz + rm * s))) noAnel++;
  }
  assert.equal(cobre, 0, 'caixa da Sede sobre a água');
  assert.equal(noAnel, 120, 'trecho do anel sem caixa');
  // a caixa das fontes: justa no arco dos jatos, longe da face de dentro do anel
  const fontes = r.caixas.filter((c) => c.parte === 'lago').map((c) => c.caixa).filter((b) => Math.abs(b[4] - b[1] - 20) < 1e-6);
  assert.equal(fontes.length, 1);
  const b = fontes[0];
  for (const [x, z] of [[b[0], b[2]], [b[3], b[2]], [b[0], b[5]], [b[3], b[5]]]) assert.ok(Math.hypot(x - sede.cx, z - sede.cz) < sede.rDentro, 'caixa das fontes na Sede');
});

// ------------------------------------------------------------------------------------------------ planos (malhas)

const chaoPlano = () => GLEBA_ENVELOPE.cota;

/** Todos os vértices das malhas de um resultado de malhasDoPlano (e as posições dos jatos). */
function* vertices(r) {
  for (const g of [r.comum, r.lod0, r.lod1, { agua: r.agua, efeitos: r.efeitos }]) {
    for (const m of Object.values(g)) {
      if (!(m instanceof Malha)) continue;
      for (let i = 0; i < m.p.length; i += 3) yield [m.p[i], m.p[i + 1], m.p[i + 2]];
    }
  }
  for (const j of r.jatos) yield [j.x, 0, j.z];
}

test('planos: malhas de cada plano sem NaN e nada fora da gleba (o A inteiro, com a paisagem, com 3 m de folga)', () => {
  const [x0, z0, x1, z1] = GLEBA_ENVELOPE.caixa;
  for (const id of Object.keys(PLANOS)) {
    const r = malhasDoPlano(id, { chao: chaoPlano, prontas: 'todas', nivel: 1 });
    for (const g of [r.comum, r.lod0, r.lod1]) for (const [nome, m] of Object.entries(g)) conferirMalha(m, `${id} ${nome}`);
    conferirMalha(r.agua, `${id} água`);
    assert.ok(r.agua.triangulos > 0, `${id}: sem água`);
    assert.ok(r.caixas.length >= PARTES_D59.length - 1, `${id}: caixas de seleção`);
    for (const c of r.caixas) assert.ok(PARTES_ORDEM[c.idx] === c.parte, `${id}: idx da parte ${c.parte}`);
    const folga = id === 'A' ? 3 : 40;
    let fora = 0;
    let ex = null;
    for (const [x, , z] of vertices(r)) {
      if (x < x0 - folga || x > x1 + folga || z < z0 - folga || z > z1 + folga) {
        fora++;
        ex ??= [x, z];
      }
    }
    assert.equal(fora, 0, `${id}: ${fora} vértices fora da gleba (${ex})`);
  }
  // as torres do par também: o pódio, a ponte e a cachoeira ficam dentro da ilha
  const p = malhasPar({ nivel: 2, lod: 0 });
  const b = caixaDe(p.vidro, p.opaco, p.efeitos);
  const [ilha] = pecasDe(PLANOS.A, 'reservatorio').map((r) => r.ilha);
  assert.ok(b[0] > -ilha.rx && b[3] < ilha.rx && b[2] > -ilha.rz && b[5] < ilha.rz, `o par sai da ilha: ${b.map((v) => v.toFixed(0))}`);
});

test('planos: com o lago cavado (o centro e o poço descem), o anel, as torres e a ilha ficam na cota da gleba', () => {
  const f = cavaDoPlano('A');
  // o chão como o aplainar deixa: o leito na cava, a gleba fora
  const chao = (x, z) => (pontoNoPoligono(x, z, f.contorno) || distPoligono(x, z, f.contorno) < 8 ? f.cota : 12);
  const r = malhasDoPlano('A', { chao, prontas: 'todas', paisagem: false, nivel: 1 });
  assert.equal(r.cota, 12, 'a cota do plano se mede fora do poço');
  let minSede = Infinity;
  for (let i = 0; i < r.lod1.vidro.p.length; i += 3) minSede = Math.min(minSede, r.lod1.vidro.p[i + 1]);
  assert.ok(minSede >= 12 - 1e-6, `o anel afundou: ${minSede}`);
  assert.ok(r.agua.triangulos > 0 && Math.abs(r.nivelAgua - 10) < 1e-6);
});

test('sede v2: o anel de 481 por 358 m, 4 andares em 30 m, marquises em cada laje e os pórticos de 40 por 18 m', () => {
  const [p] = pecasDe(PLANOS.A, 'sedeAnel');
  for (const lod of [0, 1]) {
    const d = { chao: () => 12, vidro: new Malha('vidro'), opaco: new Malha('opaco'), lod };
    montarParte({ id: 'sede', pecas: [p] }, d);
    conferirMalha(d.vidro, `sede ${lod} vidro`);
    conferirMalha(d.opaco, `sede ${lod} opaco`);
    let rMax = 0;
    let rMin = Infinity;
    let yMax = -Infinity;
    for (const m of [d.vidro, d.opaco]) for (let i = 0; i < m.p.length; i += 3) {
      if (m.p[i + 1] < 12 + 1) continue; // a calçada em volta
      const r = Math.hypot(m.p[i] - p.cx, m.p[i + 2] - p.cz);
      rMax = Math.max(rMax, r);
      rMin = Math.min(rMin, r);
      yMax = Math.max(yMax, m.p[i + 1] - 12);
    }
    assert.ok(Math.abs(2 * rMax - 481) < 1.5, `LOD${lod}: ${(2 * rMax).toFixed(1)} m por fora`);
    assert.ok(Math.abs(2 * rMin - 358) < 1.5, `LOD${lod}: ${(2 * rMin).toFixed(1)} m por dentro`);
    assert.ok(Math.abs(yMax - 30) < 0.01, `LOD${lod}: ${yMax} m de altura`);
    // nos pórticos, nada de vidro abaixo de 18 m dentro da passagem de 40 m
    for (const a of p.portais) {
      const ux = Math.cos((a * Math.PI) / 180);
      const uz = Math.sin((a * Math.PI) / 180);
      for (let i = 0; i < d.vidro.p.length; i += 3) {
        const dx = d.vidro.p[i] - p.cx;
        const dz = d.vidro.p[i + 2] - p.cz;
        const radial = dx * ux + dz * uz;
        const lateral = Math.abs(-dx * uz + dz * ux);
        if (radial > p.rDentro + 4 && radial < p.rFora - 4 && lateral < p.vao / 2 - 0.3) {
          assert.ok(d.vidro.p[i + 1] - 12 >= p.pe - 1e-6, `vidro no pórtico de ${a} graus a ${(d.vidro.p[i + 1] - 12).toFixed(1)} m`);
        }
      }
    }
    // o vidro é o da sede (curvo, com as marquises no shader do LOD1)
    for (let i = 0; i < d.vidro.c.length; i += 4) assert.ok(d.vidro.c[i] === VIDRO.sede || d.vidro.c[i] === VIDRO.saguao);
    if (lod === 0) {
      // marquises em geometria: faces viradas para cima nas três lajes (7,5, 15 e 22,5 m), por fora e por dentro
      for (const yl of [7.5, 15, 22.5]) {
        let n = 0;
        for (let i = 0; i < d.opaco.p.length; i += 3) if (Math.abs(d.opaco.p[i + 1] - 12 - yl - 0.25) < 1e-6 && d.opaco.n[i + 1] > 0.99) n++;
        assert.ok(n > 400, `marquise da laje de ${yl} m`);
      }
    }
  }
  assert.ok(PECAS_COM_LOD.has('sedeAnel') && PECAS_COM_LOD.has('cupula'));
});

test('cúpula (D65): 240 m por 80 m, malha diagonal em geometria no LOD0 e no shader no LOD1, floresta por dentro', () => {
  const [p] = pecasDe(PLANOS.A, 'cupula');
  const res = {};
  for (const lod of [0, 1]) {
    const d = { chao: () => 12, vidro: new Malha('vidro'), opaco: new Malha('opaco'), claro: new Malha('claro'), arvores: new Malha('opaco'), efeitos: new Malha('cascata'), lod };
    montarParte({ id: 'vida', pecas: [p] }, d);
    for (const k of ['opaco', 'claro', 'arvores', 'efeitos']) conferirMalha(d[k], `cúpula ${lod} ${k}`);
    let rMax = 0;
    let yMax = -Infinity;
    for (let i = 0; i < d.claro.p.length; i += 3) {
      rMax = Math.max(rMax, Math.hypot(d.claro.p[i] - p.x, d.claro.p[i + 2] - p.z));
      yMax = Math.max(yMax, d.claro.p[i + 1] - 12);
    }
    assert.ok(Math.abs(2 * rMax - 240) < 1, `LOD${lod}: ${(2 * rMax).toFixed(1)} m de diâmetro`);
    const cx = caixaDe(d.opaco, d.claro);
    assert.ok(Math.abs(cx[4] - 12 - 80) < 1, `LOD${lod}: ${(cx[4] - 12).toFixed(1)} m de altura`);
    // o vidro leva o lado da célula da malha principal em metros (as barras do shader têm largura em metros)
    for (let i = 0; i < d.claro.c.length; i += 4) assert.ok(d.claro.c[i] > 0.5 && d.claro.c[i] < 30);
    assert.ok(d.arvores.triangulos > 0, 'floresta nos terraços');
    res[lod] = d;
  }
  assert.ok(res[0].opaco.triangulos > res[1].opaco.triangulos + 4000, 'as barras da malha diagonal só no LOD0');
  assert.ok(res[0].claro.triangulos > res[1].claro.triangulos, 'o vidro do LOD1 mais leve');
  // o fantasma e a sombra: sem a floresta nem o vidro (a cúpula não faz sombra chapada sobre a floresta)
  const s = { chao: () => 12, vidro: new Malha('vidro'), opaco: new Malha('opaco'), claro: new Malha('claro'), sombra: true };
  montarParte({ id: 'vida', pecas: [p] }, s);
  assert.equal(s.claro.triangulos + s.vidro.triangulos, 0);
});

test('orçamento (D66): Arcologia até 250 mil triângulos no Alta de perto e 40 mil na vista aberta', () => {
  const nivel = NIVEL.alta;
  const par0 = malhasPar({ nivel, lod: 0 });
  const par1 = malhasPar({ lod: 1 });
  const construido = malhasDoPlano('A', { chao: chaoPlano, prontas: 'todas', paisagem: true, nivel });
  const jatos = construido.jatos.length * malhaJato().triangulos;
  const perto = trisDe(par0) + tris(construido.comum.vidro, construido.comum.opaco) + tris(construido.lod0.vidro, construido.lod0.opaco, construido.lod0.claro) + tris(construido.agua, construido.efeitos) + jatos;
  assert.ok(perto <= TETO_ARCOLOGIA.perto.alta, `de perto: ${perto}`);
  // na vista aberta: tudo no LOD1 e os efeitos de água somem (menores que um pixel)
  const aberta = tris(par1.vidro, par1.opaco) + tris(construido.comum.vidro, construido.comum.opaco) + tris(construido.lod1.vidro, construido.lod1.opaco, construido.lod1.claro) + tris(construido.agua);
  assert.ok(aberta <= TETO_ARCOLOGIA.aberta, `vista aberta com o plano construído: ${aberta}`);
  // no jogo, antes das etapas: o lago pronto e o resto em fantasma (as torres também)
  const jogo = malhasDoPlano('A', { chao: chaoPlano, prontas: new Set(['lago']), paisagem: false, nivel });
  const fantTorres = tris(par1.vidro, par1.opaco);
  const abertaJogo = fantTorres + tris(jogo.comum.vidro, jogo.comum.opaco, jogo.agua) + tris(jogo.fantasma.vidro, jogo.fantasma.opaco);
  assert.ok(abertaJogo <= TETO_ARCOLOGIA.aberta, `vista aberta no jogo: ${abertaJogo}`);
  // e os planos B e C seguem cabendo na família do Média
  for (const id of ['B', 'C']) {
    const j = malhasDoPlano(id, { chao: chaoPlano, prontas: new Set(['lago']), paisagem: false, nivel: 1 });
    const t1 = malhasTorreLod1({ comEsplanada: true });
    assert.ok(tris(t1.vidro, t1.opaco) + tris(j.comum.vidro, j.comum.opaco, j.agua) + tris(j.fantasma.vidro, j.fantasma.opaco) <= ORCAMENTO.media.familias.arcologia.teto, id);
  }
  assert.ok(DIST_PARTES_LOD0.alta > DIST_PARTES_LOD0.media);
});

test('planos: chamadas da Arcologia (malhas não vazias de cada vista) dentro da família do Média', () => {
  const cheia = (m) => (m?.triangulos ? 1 : 0);
  const teto = ORCAMENTO.media.familias.arcologia.calls[1];
  for (const id of Object.keys(PLANOS)) {
    for (const [nome, op] of [['jogo', { prontas: new Set(['lago']), paisagem: false }], ['plano', { prontas: 'todas', paisagem: true }]]) {
      const r = malhasDoPlano(id, { chao: chaoPlano, nivel: 1, ...op });
      // as torres 2 (um LOD por vez) mais os efeitos; as partes: comum 3, um LOD por vez (até 4), a água, os efeitos, os
      // jatos, o fantasma 1 e a sombra (torres 1 e partes prontas 1)
      const lod = Math.max(...[r.lod0, r.lod1].map((g) => cheia(g.vidro) + cheia(g.opaco) + cheia(g.claro) + cheia(g.arvores)));
      const fant = cheia(r.fantasma.vidro) || cheia(r.fantasma.opaco) || cheia(r.fantasma.arvores);
      const sombra = 1 + (cheia(r.sombra.vidro) || cheia(r.sombra.opaco));
      const n = 3 + cheia(r.comum.vidro) + cheia(r.comum.opaco) + cheia(r.comum.arvores) + lod + cheia(r.agua) + cheia(r.efeitos) + (r.jatos.length ? 1 : 0) + fant + sombra;
      assert.ok(n <= teto + 3, `${id} ${nome}: ${n} chamadas (teto da família: ${teto})`);
    }
  }
});

test('cenas: as vistas da sede v2 (aérea, eixo, mar, noite) ficam na hora pedida e fora dos prédios', () => {
  assert.deepEqual(Object.keys(VISTAS_SEDE).sort(), ['aerea', 'eixo', 'mar', 'noite']);
  const [sede] = pecasDe(PLANOS.A, 'sedeAnel');
  for (const [id, v] of Object.entries(VISTAS_SEDE)) {
    const d = Math.hypot(v.de[0] - sede.cx, v.de[2] - sede.cz);
    assert.ok(!(d > sede.rDentro - 1 && d < sede.rFora + 1 && v.de[1] < 31), `${id}: a câmera dentro do anel`);
    assert.ok(v.fov > 20 && v.fov < 90 && v.hora >= 0 && v.hora < 24);
  }
  assert.equal(VISTAS_SEDE.aerea.hora, 17.5);
  assert.ok(VISTAS_SEDE.noite.hora >= 20);
  assert.ok(VISTAS_SEDE.mar.de[2] > 930, 'da praia');
  assert.ok(VISTAS_SEDE.mar.alvo[2] < VISTAS_SEDE.mar.de[2], 'olhando para o norte');
  assert.ok(Math.abs(VISTAS_SEDE.eixo.de[0] - 250) < 1 && VISTAS_SEDE.eixo.de[2] < 200, 'do portão norte, no eixo');
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

test('domínio: só o chão da gleba refaz a Arcologia (vias e lotes no resto da cidade não)', () => {
  const [x0, z0, x1, z1] = GLEBA_ENVELOPE.caixa;
  assert.equal(tocaGleba([]), false);
  assert.equal(tocaGleba(undefined), false);
  assert.equal(tocaGleba([[x0 + 10, z0 + 10, x0 + 30, z0 + 30]]), true, 'dentro da gleba');
  assert.equal(tocaGleba([[x1 + 20, z1 + 20, x1 + 40, z1 + 40]]), true, 'na folga do passeio e da transição');
  assert.equal(tocaGleba([[-3000, -3000, -2900, -2900]]), false, 'longe, do outro lado do mapa');
});

// ------------------------------------------------------------------------------------------------ kit e peças

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

test('partes: cada tipo de peça monta sem NaN e dá caixa de seleção', () => {
  const peças = [
    { tipo: 'conselho', x: 0, z: 0, altura: 150, olhar: [100, 100] },
    { tipo: 'sede', arco: { cx: 0, cz: 0, r: 300, de: 280, ate: 320 }, fundo: 26, altura: 33 },
    { tipo: 'sedeAnel', cx: 0, cz: 0, rFora: 240.5, rDentro: 179, andares: 4, altura: 30, portais: [270, 90], vao: 40, pe: 18 },
    { tipo: 'anel', arco: { cx: 0, cz: 0, r: 300, de: 160, ate: 250 }, fundo: 28, alturas: [34, 66] },
    { tipo: 'anel', caminho: [0, 0, 100, 60, 200, 90], fundo: 26, alturas: [60, 30], lado: 'esquerda' },
    { tipo: 'biblioteca', x: 0, z: 0, olhar: [0, 100] },
    { tipo: 'biblioteca', x: 0, z: 0, olhar: [0, 100], lado: 64 },
    { tipo: 'vida', x: 0, z: 0, rot: 0.5, diametro: 96, altura: 70 },
    { tipo: 'cupula', x: 0, z: 0, diametro: 240, altura: 80, oculo: 14 },
    { tipo: 'supertree', x: 0, z: 0, altura: 40 },
    { tipo: 'escola', x: 0, z: 0, rot: 0.3 },
    { tipo: 'universidade', x: 0, z: 0, rot: 0.1 },
    { tipo: 'fisica', arco: { cx: 0, cz: 0, r: 500, de: 260, ate: 290 }, raioTubo: 7, altura: 9 },
    { tipo: 'fisica', arco: { cx: 0, cz: 0, r: 44, de: 0, ate: 360 }, raioTubo: 6, altura: 7, ondasLargura: 14 },
    { tipo: 'podio', altura: 18, contorno: [0, 0, 100, 0, 110, 80, 0, 90] },
    { tipo: 'barragem', de: [0, 0], ate: [120, 60], largura: 26 },
    { tipo: 'fontes', cx: 0, cz: 0, r: 110, de: 28, ate: 152, n: 16 },
  ];
  for (const p of peças) {
    for (const lod of [0, 1]) {
      const d = { chao: () => 10, vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco'), claro: new Malha('claro'), efeitos: new Malha('cascata'), jatos: [], nivelAgua: 8, lod };
      const r = montarParte({ id: 'x', pecas: [p] }, d);
      for (const k of ['vidro', 'opaco', 'arvores', 'claro', 'efeitos']) conferirMalha(d[k], `${p.tipo} ${k}`);
      assert.ok(d.vidro.triangulos + d.opaco.triangulos + d.arvores.triangulos + d.claro.triangulos + d.jatos.length > 20, `${p.tipo}: vazio`);
      assert.ok(r.caixas.length >= 1, `${p.tipo}: sem caixa`);
    }
  }
  // o síncrotron fechado não passa de 6 mil triângulos (um trecho a cada ~6 m)
  const d = { chao: () => 10, vidro: new Malha('vidro'), opaco: new Malha('opaco') };
  montarParte({ id: 'fisica', pecas: [peças[13]] }, d);
  assert.ok(d.opaco.triangulos < 6000, `física em anel: ${d.opaco.triangulos}`);
});

test('partes: o anel de moradia é uma faixa contínua (juntas de 3 m) e abre os portais pedidos', () => {
  const montar = (extra) => {
    const d = { chao: () => 10, vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco'), nivelAgua: 8 };
    return montarParte({ id: 'anel', pecas: [{ tipo: 'anel', arco: { cx: 0, cz: 0, r: 372, de: 168, ate: 262 }, fundo: 28, alturas: [34, 66], ...extra }] }, d);
  };
  const cheio = montar({}).caixas;
  const comto = 372 * ((262 - 168) * Math.PI) / 180;
  assert.ok(cheio.length >= Math.floor(comto / 40), `${cheio.length} vãos em ${comto.toFixed(0)} m`);
  const alturas = cheio.map((c) => c[4] - c[1]);
  for (let i = 1; i < alturas.length; i++) assert.ok(Math.abs(alturas[i] - alturas[i - 1]) <= 3.15 * 3 + 1e-6);
  const comPortal = montar({ portais: [0.5] }).caixas;
  assert.ok(comPortal.length < cheio.length, 'o portal abre um vão');
});

test('lago: a cava da cena desce ao leito dentro do contorno e volta ao chão depois de 24 m (e se desfaz)', () => {
  const n = 129;
  const T = { n, passo: 8, origem: [-512, -512], altura: new Float32Array(n * n).fill(12) };
  const res = PLANOS.C.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  const [mx, mz] = pontoDentro(res.contorno);
  const peca = { ...res, contorno: res.contorno.map((v, i) => v - (i % 2 ? mz : mx)) };
  const guarda = new Map();
  cavarTerreno(T, peca, 12, guarda);
  const h = (x, z) => T.altura[Math.round((z + 512) / 8) * n + Math.round((x + 512) / 8)];
  const [cx, cz] = pontoDentro(peca.contorno);
  assert.ok(Math.abs(h(cx, cz) - (12 + peca.fundo)) < 1e-4, 'leito dentro');
  const longe = deslocar(peca.contorno, 40);
  assert.equal(h(longe[0], longe[1]), 12, 'chão original longe da borda');
  descavar(T, guarda);
  assert.ok(T.altura.every((v) => v === 12), 'desfazer volta ao chão');
  // o lago da sede v2: a ilha no meio fica no chão (a cava é o anel de água)
  const A = pecasDe(PLANOS.A, 'reservatorio')[0];
  const pa = { ...A, contorno: A.contorno.map((v, i) => v - (i % 2 ? A.cz : A.cx)) };
  const g2 = new Map();
  cavarTerreno(T, pa, 12, g2);
  assert.equal(h(40, -8), 12, 'o miolo da ilha, sob os pódios, não é cavado');
  assert.ok(h(0, 0) < 12, 'o poço na base da fenda é');
  assert.ok(Math.abs(h(0, 100) - (12 + A.fundo)) < 1e-4, 'o lago ao sul da ilha é');
  descavar(T, g2);
});
