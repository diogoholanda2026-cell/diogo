// Testes da X1a (render da Arcologia): Torre Lâmina da D27 (orçamento por perfil, cotas, recuos, LOD1 com a mesma
// caixa, volume de sombra dentro do vidro), os três planos da D59 como dados (partes, gleba, portões, vias, cava) e as
// malhas de cada plano (sem NaN, dentro da gleba, orçamento da Arcologia em LOD1). Sem navegador.
// Roda sozinho: node ferramentas/testes/arcologia-render.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  malhasTorre, malhasTorreLod1, malhaSombraTorre, trechosCorpo, contornoTrecho, NIVEL, Malha, triangular, areaPoli,
  DIST_LOD0, LUZ_NOITE, torno, cilindro,
} from '../../fonte/render/arcologia/torre.js';
import { assentarHora } from '../../fonte/render/cenas/torre.js';
import { malhasDoPlano, pontoDentro, tocaGleba } from '../../fonte/render/arcologia/planos.js';
import { ORCAMENTO } from '../../fonte/contratos/render.js';
import { montarParte, deslocar } from '../../fonte/render/arcologia/partes.js';
import { cavarTerreno, descavar } from '../../fonte/render/arcologia/lago.js';
import {
  TORRE_LAMINA as TL, PLANOS, PARTES_ORDEM, GLEBA_ENVELOPE, cavaDoPlano, POUSO, TORRE_POSICAO, HELIPONTO_LOCAL, torreParaMundo,
  suavizar,
} from '../../fonte/data/arcologia-plano.js';
import { pontoNoPoligono, distPoligono } from '../../fonte/comum/vetor.js';

const caixaDe = (...ms) => {
  const bs = ms.map((m) => m.caixa()).filter(Boolean);
  return [0, 1, 2].map((e) => Math.min(...bs.map((b) => b[e]))).concat([3, 4, 5].map((e) => Math.max(...bs.map((b) => b[e]))));
};
const tris = (...ms) => ms.reduce((a, m) => a + m.triangulos, 0);

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

// ------------------------------------------------------------------------------------------------ Torre

test('Torre: orçamento da D27 por perfil (LOD0 com a esplanada que vai junto, LOD1, sombra)', () => {
  const faixa = TL.triangulos.lod0;
  for (const perfil of ['media', 'alta', 'ultra']) {
    const m = malhasTorre({ nivel: NIVEL[perfil], comEsplanada: true });
    const n = tris(m.vidro, m.opaco);
    assert.ok(n >= faixa[perfil][0] && n <= faixa[perfil][1], `LOD0 ${perfil}: ${n} triângulos (D27: ${faixa[perfil].join(' a ')})`);
  }
  const l1 = malhasTorreLod1({ comEsplanada: true });
  const n1 = tris(l1.vidro, l1.opaco);
  assert.ok(n1 >= TL.triangulos.lod1[0] && n1 <= TL.triangulos.lod1[1], `LOD1: ${n1} (D27: ${TL.triangulos.lod1.join(' a ')})`);
  const s = malhaSombraTorre();
  assert.ok(s.triangulos > 50 && s.triangulos < 400, `sombra: ${s.triangulos}`);
  // leve: abaixo da média (celular fraco)
  const lv = malhasTorre({ nivel: 0, comEsplanada: true });
  assert.ok(tris(lv.vidro, lv.opaco) < faixa.media[0], 'leve deve ficar abaixo da média');
});

test('Torre: malhas sem NaN, normais boas e índices no lugar, em todos os níveis', () => {
  for (const nivel of [0, 1, 2, 3]) {
    const m = malhasTorre({ nivel, comEsplanada: true });
    conferirMalha(m.vidro, `LOD0 ${nivel} vidro`);
    conferirMalha(m.opaco, `LOD0 ${nivel} opaco`);
  }
  const l1 = malhasTorreLod1();
  conferirMalha(l1.vidro, 'LOD1 vidro');
  conferirMalha(l1.opaco, 'LOD1 opaco');
  conferirMalha(malhaSombraTorre(), 'sombra');
});

test('Torre: o LOD1 tem a mesma caixa do LOD0 (sem a esplanada) e o volume de sombra fica dentro dela', () => {
  for (const nivel of [1, 2]) {
    const m0 = malhasTorre({ nivel });
    const m1 = malhasTorreLod1();
    const a = caixaDe(m0.vidro, m0.opaco);
    const b = caixaDe(m1.vidro, m1.opaco);
    for (let e = 0; e < 6; e++) assert.ok(Math.abs(a[e] - b[e]) < 0.01, `caixa ${e}: LOD0 ${a[e]} x LOD1 ${b[e]}`);
    const s = caixaDe(malhaSombraTorre());
    for (let e = 0; e < 3; e++) assert.ok(s[e] >= a[e] - 1e-6 && s[e + 3] <= a[e + 3] + 1e-6, `sombra fora da caixa no eixo ${e}`);
  }
});

test('Torre: cotas da D27 (pódio 16, lâminas 163/238/301, heliponto 330, mastro 350) e 65 pavimentos', () => {
  const { pavimentos, andaresDeVento, podio, laminas, heliponto, mastro, coroa } = TL;
  // a conta dos pavimentos fecha
  const corpo = laminas[0].topo - podio.altura - andaresDeVento.reduce((a, v) => a + v.altura, 0);
  assert.equal(Math.round(corpo / pavimentos.altura), pavimentos.n);
  assert.equal(coroa.base + coroa.altura, heliponto.cota);
  const m = malhasTorre({ nivel: 1 });
  const cx = caixaDe(m.vidro, m.opaco);
  assert.equal(cx[4], mastro.topo, 'topo do mastro');
  // o topo do tabuleiro do heliponto é a cota 330 (vértices virados para cima perto do centro)
  let topoHeli = -Infinity;
  for (let i = 0; i < m.opaco.p.length; i += 3) {
    const y = m.opaco.p[i + 1];
    if (m.opaco.n[i + 1] > 0.99 && Math.hypot(m.opaco.p[i] - HELIPONTO_LOCAL.x, m.opaco.p[i + 2] - HELIPONTO_LOCAL.z) < 6 && y < 340) topoHeli = Math.max(topoHeli, y);
  }
  assert.ok(Math.abs(topoHeli - heliponto.cota) < 0.05, `topo do heliponto em ${topoHeli}`);
  // cada lâmina fecha num terraço (há piso virado para cima na cota do topo, na faixa z da lâmina)
  const z1 = -TL.planta.comprimento / 2 + laminas[0].fundo;
  const z2 = z1 + laminas[1].fundo;
  const faixas = [[-7, z1], [z1, z2], [z2, TL.planta.comprimento / 2]];
  laminas.forEach((l, i) => {
    const [za, zb] = faixas[i];
    let achou = false;
    for (let k = 0; k < m.opaco.p.length && !achou; k += 3) {
      const [x, y, z] = [m.opaco.p[k], m.opaco.p[k + 1], m.opaco.p[k + 2]];
      if (Math.abs(y - l.topo) < 0.01 && m.opaco.n[k + 1] > 0.99 && z > za && z < zb && Math.abs(x) < 18) achou = true;
    }
    assert.ok(achou, `terraço da lâmina ${i + 1} em ${l.topo}`);
  });
});

test('Torre: andares de vento recuados 2 m (o vidro deles fica dentro da linha do corpo) e sem faixa escura', () => {
  const trechos = trechosCorpo();
  const vento = trechos.filter((t) => t.vento);
  assert.equal(vento.length, 2);
  for (const t of vento) {
    const { poly } = contornoTrecho({ x: t.x, z0: t.z0, z1: t.z1, entalhe: 0, costura: false });
    for (let i = 0; i < poly.length; i += 2) {
      assert.ok(Math.abs(poly[i]) <= TL.planta.largura / 2 - TL.andaresDeVento[0].recuo + 1e-6, 'vidro do vento passa do recuo em x');
    }
  }
  const m = malhasTorre({ nivel: 1 });
  // o vidro dos andares de vento é do tipo 'vento' (claro, forro aceso: o shader nunca o deixa mais escuro que o corpo)
  let vidroVento = 0;
  for (let i = 0; i < m.vidro.c.length; i += 4) if (m.vidro.c[i] === 2) vidroVento++;
  assert.ok(vidroVento > 0, 'sem vidro de andar de vento');
});

test('Torre: pouso do helicóptero no centro do heliponto, no mundo', () => {
  const p = torreParaMundo(TORRE_POSICAO, HELIPONTO_LOCAL.x, HELIPONTO_LOCAL.y, HELIPONTO_LOCAL.z);
  assert.ok(Math.abs(p.x - POUSO.x) < 1e-6 && Math.abs(p.z - POUSO.z) < 1e-6 && p.y === TL.heliponto.cota);
});

test('Torre: malhas determinísticas (a mesma entrada dá os mesmos números)', () => {
  const a = malhasTorre({ nivel: 2, comEsplanada: true });
  const b = malhasTorre({ nivel: 2, comEsplanada: true });
  assert.deepEqual(a.opaco.p, b.opaco.p);
  assert.deepEqual(a.vidro.c, b.vidro.c);
});

test('Torre: LOD0 só de perto (aletas e montantes finos não fazem moiré) e LOD1 com as aletas do corpo no shader', () => {
  // o LOD0 troca pelo LOD1 enquanto a aleta de 0,26 m ainda cobre perto de meio pixel numa tela de 1080 linhas a 40 graus
  const ordem = ['leve', 'media', 'alta', 'ultra'];
  for (let i = 1; i < ordem.length; i++) assert.ok(DIST_LOD0[ordem[i]] > DIST_LOD0[ordem[i - 1]], 'distâncias crescem com o perfil');
  const pixel = (d) => (2 * d * Math.tan((20 * Math.PI) / 180)) / 1080;
  assert.ok(TL.aletas.espessura / pixel(DIST_LOD0.media) >= 0.5, `aleta com ${(TL.aletas.espessura / pixel(DIST_LOD0.media)).toFixed(2)} px no Média`);
  // no LOD1 não há aleta em geometria no corpo (entre o pódio e o terraço da lâmina 3): só as penas e a coroa
  const X = TL.planta.largura / 2;
  const l1 = malhasTorreLod1();
  let corpo = 0;
  for (let i = 0; i < l1.opaco.p.length; i += 3) {
    const [x, y] = [Math.abs(l1.opaco.p[i]), l1.opaco.p[i + 1]];
    if (x > X + 0.05 && x < X + TL.aletas.fundo + 0.05 && y > TL.podio.altura + 20 && y < TL.laminas[2].topo - 20) corpo++;
  }
  assert.equal(corpo, 0, 'aletas do corpo em geometria no LOD1');
  // e as penas continuam lá (a silhueta de lado)
  let penas = 0;
  for (let i = 0; i < l1.opaco.p.length; i += 3) if (Math.abs(l1.opaco.p[i]) > X + 0.05 && l1.opaco.p[i + 1] > TL.laminas[2].topo + 1) penas++;
  assert.ok(penas > 100, 'penas das lâminas no LOD1');
});

test('Torre: luz da noite calibrada para a exposição da R1a (janela quente sem estourar, lanterna e aro acendem o bloom)', () => {
  const tela = (v) => v * LUZ_NOITE.exposicaoNoite;
  assert.ok(tela(LUZ_NOITE.janela) > 0.8 && tela(LUZ_NOITE.janela) < 2, `janela ${tela(LUZ_NOITE.janela)}`);
  assert.ok(tela(LUZ_NOITE.forro) > tela(LUZ_NOITE.janela) && tela(LUZ_NOITE.forro) < 4, 'andar de vento acima das janelas');
  assert.ok(tela(LUZ_NOITE.lanterna) > tela(LUZ_NOITE.forro), 'a lanterna é a luz mais forte da torre');
  assert.ok(tela(LUZ_NOITE.aro) > 4 && tela(LUZ_NOITE.aro) < 16, 'aro do heliponto');
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

// ------------------------------------------------------------------------------------------------ planos (dados)

const DENTRO = GLEBA_ENVELOPE.contorno;
const PARTES_D59 = ['torre', 'lago', 'sede', 'anel', 'biblioteca', 'vida', 'escola', 'universidade', 'fisica'];

test('planos: os três da D59 com todas as partes, na ordem de PARTES_ORDEM', () => {
  assert.deepEqual(Object.keys(PLANOS).sort(), ['A', 'B', 'C']);
  assert.deepEqual([...PARTES_ORDEM], PARTES_D59);
  for (const [id, P] of Object.entries(PLANOS)) {
    assert.equal(P.id, id);
    assert.deepEqual(P.partes.map((p) => p.id).sort(), [...PARTES_D59].sort(), `${id}: partes`);
    const tipos = (parte) => P.partes.find((p) => p.id === parte).pecas.map((p) => p.tipo);
    assert.ok(tipos('lago').includes('reservatorio'), `${id}: reservatório`);
    assert.equal(tipos('sede').filter((t) => t === 'conselho').length, 2, `${id}: duas Torres do Conselho`);
    assert.ok(tipos('sede').includes('sede'), `${id}: a Sede`);
    assert.ok(tipos('vida').includes('vida') && tipos('vida').includes('supertree'), `${id}: Vida com Supertrees`);
    assert.ok(P.referencias.length >= 2 && P.ideia, `${id}: referências reais`);
  }
});

test('planos: Torre, portões e vias dentro da gleba; portões na borda; a Torre fora da água', () => {
  for (const [id, P] of Object.entries(PLANOS)) {
    assert.ok(pontoNoPoligono(P.torre.x, P.torre.z, DENTRO), `${id}: Torre fora da gleba`);
    for (const g of P.portoes) assert.ok(distPoligono(g.x, g.z, DENTRO) < 1, `${id}: portão ${g.id} fora da borda`);
    for (const v of P.vias) for (let i = 0; i < v.pontos.length; i += 2) {
      const x = v.pontos[i];
      const z = v.pontos[i + 1];
      assert.ok(pontoNoPoligono(x, z, DENTRO) || distPoligono(x, z, DENTRO) < 1, `${id}: via fora da gleba em ${x}, ${z}`);
    }
    const res = P.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
    // o pódio da Torre (52 x 70 com a esplanada de 24 m) não cai na água
    const c = Math.cos(P.torre.rot);
    const s = Math.sin(P.torre.rot);
    for (const [lx, lz] of [[-26, -31], [26, -31], [26, 39], [-26, 39], [0, 0]]) {
      const x = P.torre.x + c * lx + s * lz;
      const z = P.torre.z - s * lx + c * lz;
      assert.ok(!pontoNoPoligono(x, z, res.contorno), `${id}: pódio da Torre dentro do reservatório`);
    }
    assert.ok(Math.abs(areaPoli(res.contorno)) > 5000, `${id}: reservatório pequeno demais`);
    for (let i = 0; i < res.contorno.length; i += 2) assert.ok(pontoNoPoligono(res.contorno[i], res.contorno[i + 1], DENTRO), `${id}: reservatório sai da gleba`);
    assert.ok(res.fundo < res.nivel && res.nivel < 0, `${id}: nível e fundo relativos à gleba`);
  }
});

test('planos: margens de água macias (Chaikin): nenhuma quina de polígono nos reservatórios (a mais viva, na barragem)', () => {
  const quina = (P, i) => {
    const n = P.length / 2;
    const a = [P[2 * i] - P[2 * ((i + n - 1) % n)], P[2 * i + 1] - P[2 * ((i + n - 1) % n) + 1]];
    const b = [P[2 * ((i + 1) % n)] - P[2 * i], P[2 * ((i + 1) % n) + 1] - P[2 * i + 1]];
    const c = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b) || 1);
    return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  };
  for (const id of ['A', 'C']) {
    const r = PLANOS[id].partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
    let pior = 0;
    for (let i = 0; i < r.contorno.length / 2; i++) pior = Math.max(pior, quina(r.contorno, i));
    assert.ok(pior < 45, `${id}: quina de ${pior.toFixed(1)} graus`);
  }
  // aberta: mantém as pontas e leva os valores junto
  const { pontos, valores } = suavizar([0, 0, 100, 0, 100, 100], { fechado: false, voltas: 2, valores: [10, 20, 30] });
  assert.deepEqual(pontos.slice(0, 2), [0, 0]);
  assert.deepEqual(pontos.slice(-2), [100, 100]);
  assert.equal(valores.length, pontos.length / 2);
  assert.equal(valores[0], 10);
  assert.equal(valores[valores.length - 1], 30);
});

test('planos: a cava do reservatório como forma do aplainar (D5)', () => {
  for (const id of Object.keys(PLANOS)) {
    const f = cavaDoPlano(id, 12, 7);
    assert.equal(f.tipo, 'cava');
    assert.equal(f.ref, 7);
    assert.ok(f.contorno.length >= 8 && f.contorno.length % 2 === 0);
    assert.ok(f.cota < f.nivel && f.nivel < 12, `${id}: leito abaixo da água, água abaixo da gleba`);
    assert.ok(triangular(f.contorno).indices.length >= 6);
  }
});

// ------------------------------------------------------------------------------------------------ planos (malhas)

const chaoPlano = () => GLEBA_ENVELOPE.cota;

test('planos: malhas de cada plano sem NaN e dentro da gleba (com a folga do passeio)', () => {
  for (const id of Object.keys(PLANOS)) {
    const r = malhasDoPlano(id, { chao: chaoPlano, prontas: 'todas', nivel: 1 });
    for (const [nome, m] of Object.entries(r.real)) conferirMalha(m, `${id} ${nome}`);
    const [x0, , z0, x1, , z1] = GLEBA_ENVELOPE.caixa.length === 4 ? [GLEBA_ENVELOPE.caixa[0], 0, GLEBA_ENVELOPE.caixa[1], GLEBA_ENVELOPE.caixa[2], 0, GLEBA_ENVELOPE.caixa[3]] : GLEBA_ENVELOPE.caixa;
    const b = caixaDe(r.real.vidro, r.real.opaco);
    const folga = 40;
    assert.ok(b[0] >= x0 - folga && b[3] <= x1 + folga && b[2] >= z0 - folga && b[5] <= z1 + folga, `${id}: plano sai da gleba ${b.map((v) => v.toFixed(0))}`);
    assert.ok(r.real.agua.triangulos > 0, `${id}: sem água`);
    assert.ok(r.caixas.length >= PARTES_D59.length - 1, `${id}: caixas de seleção`);
    for (const c of r.caixas) assert.ok(PARTES_ORDEM[c.idx] === c.parte, `${id}: idx da parte ${c.parte}`);
  }
});

test('planos: a Arcologia inteira em LOD1 perto de 25 mil triângulos', () => {
  const torre1 = malhasTorreLod1({ comEsplanada: true });
  const tTorre = tris(torre1.vidro, torre1.opaco);
  for (const id of Object.keys(PLANOS)) {
    // no jogo: a Torre e o reservatório de verdade, o resto em fantasma (uma chamada)
    const j = malhasDoPlano(id, { chao: chaoPlano, prontas: new Set(['lago']), paisagem: false, nivel: 1 });
    const total = tTorre + tris(j.real.vidro, j.real.opaco, j.real.agua) + tris(j.fantasma.vidro, j.fantasma.opaco, j.fantasma.arvores);
    assert.ok(total <= 30000, `${id}: Arcologia em LOD1 com ${total} triângulos`);
    // construída (maquete): volumes sem a paisagem
    const c = malhasDoPlano(id, { chao: chaoPlano, prontas: 'todas', paisagem: false, nivel: 1 });
    const volumes = tTorre + tris(c.real.vidro, c.real.opaco, c.real.agua);
    assert.ok(volumes <= 32000, `${id}: plano construído com ${volumes} triângulos de volume`);
  }
});

test('planos: chamadas da Arcologia dentro da família do Média (malhas não vazias de cada vista)', () => {
  // cada malha não vazia vira uma chamada: a Torre 2 (um LOD por vez), as partes (vidro, opaco, árvores, água), o
  // fantasma 1 e a sombra (Torre 1 e partes prontas 1)
  const cheia = (m) => (m.triangulos ? 1 : 0);
  const teto = ORCAMENTO.media.familias.arcologia.calls[1];
  for (const id of Object.keys(PLANOS)) {
    for (const [nome, op] of [['jogo', { prontas: new Set(['lago']), paisagem: false }], ['plano', { prontas: 'todas', paisagem: true }]]) {
      const r = malhasDoPlano(id, { chao: chaoPlano, nivel: 1, ...op });
      const fant = cheia(r.fantasma.vidro) || cheia(r.fantasma.opaco) || cheia(r.fantasma.arvores);
      const sombra = 1 + (cheia(r.sombra.vidro) || cheia(r.sombra.opaco));
      const n = 2 + cheia(r.real.vidro) + cheia(r.real.opaco) + cheia(r.real.arvores) + cheia(r.real.agua) + fant + sombra;
      assert.ok(n <= teto, `${id} ${nome}: ${n} chamadas (teto da família: ${teto})`);
    }
  }
});

test('domínio: só o chão da gleba refaz a Arcologia (vias e lotes no resto da cidade não)', () => {
  const [x0, z0, x1, z1] = GLEBA_ENVELOPE.caixa;
  assert.equal(tocaGleba([]), false);
  assert.equal(tocaGleba(undefined), false);
  assert.equal(tocaGleba([[x0 + 10, z0 + 10, x0 + 30, z0 + 30]]), true, 'dentro da gleba');
  assert.equal(tocaGleba([[x1 + 20, z1 + 20, x1 + 40, z1 + 40]]), true, 'na folga do passeio e da transição');
  assert.equal(tocaGleba([[-3000, -3000, -2900, -2900]]), false, 'longe, do outro lado do mapa');
  assert.equal(tocaGleba([[-3000, -3000, -2900, -2900], [x0, z0, x0 + 1, z0 + 1]]), true, 'um basta');
});

test('kit: peças redondas com normal por vértice (cilindro e torno sem facetas)', () => {
  const m = new Malha('opaco');
  torno(m, 0, 0, [[0, -10], [7.07, -7.07], [10, 0], [7.07, 7.07], [0, 10]], 16, [0, 0, 0, 0]);
  cilindro(m, 50, 0, 0, 10, 2, 2, 8, [0, 0, 0, 0], { topo: false });
  // na esfera a normal de cada vértice aponta para fora a partir do centro (quase igual à direção do ponto)
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
    { tipo: 'anel', arco: { cx: 0, cz: 0, r: 300, de: 160, ate: 250 }, fundo: 28, alturas: [34, 66] },
    { tipo: 'anel', caminho: [0, 0, 100, 60, 200, 90], fundo: 26, alturas: [60, 30], lado: 'esquerda' },
    { tipo: 'biblioteca', x: 0, z: 0, olhar: [0, 100] },
    { tipo: 'vida', x: 0, z: 0, rot: 0.5, diametro: 96, altura: 70 },
    { tipo: 'supertree', x: 0, z: 0, altura: 40 },
    { tipo: 'escola', x: 0, z: 0, rot: 0.3 },
    { tipo: 'universidade', x: 0, z: 0, rot: 0.1 },
    { tipo: 'fisica', arco: { cx: 0, cz: 0, r: 500, de: 260, ate: 290 }, raioTubo: 7, altura: 9 },
    { tipo: 'podio', altura: 18, contorno: [0, 0, 100, 0, 110, 80, 0, 90] },
    { tipo: 'barragem', de: [0, 0], ate: [120, 60], largura: 26 },
  ];
  for (const p of peças) {
    const d = { chao: () => 10, vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco'), nivelAgua: 8 };
    const r = montarParte({ id: 'x', pecas: [p] }, d);
    conferirMalha(d.vidro, `${p.tipo} vidro`);
    conferirMalha(d.opaco, `${p.tipo} opaco`);
    assert.ok(d.vidro.triangulos + d.opaco.triangulos + d.arvores.triangulos > 20, `${p.tipo}: vazio`);
    assert.equal(r.caixas.length >= 1, true, `${p.tipo}: sem caixa`);
  }
});

test('partes: o anel é uma faixa contínua (juntas de 3 m) e abre os portais pedidos', () => {
  const montar = (extra) => {
    const d = { chao: () => 10, vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco'), nivelAgua: 8 };
    return montarParte({ id: 'anel', pecas: [{ tipo: 'anel', arco: { cx: 0, cz: 0, r: 372, de: 168, ate: 262 }, fundo: 28, alturas: [34, 66], ...extra }] }, d);
  };
  const cheio = montar({}).caixas;
  const comto = 372 * ((262 - 168) * Math.PI) / 180;
  // vãos de ~31 m: de longe lê como faixa contínua (a soma dos vãos cobre mais de 85% do arco)
  assert.ok(cheio.length >= Math.floor(comto / 40), `${cheio.length} vãos em ${comto.toFixed(0)} m`);
  const alturas = cheio.map((c) => c[4] - c[1]);
  for (let i = 1; i < alturas.length; i++) assert.ok(Math.abs(alturas[i] - alturas[i - 1]) <= 3.15 * 3 + 1e-6, 'vãos vizinhos diferem até 3 andares');
  assert.ok(alturas[alturas.length - 1] > alturas[0], 'o anfiteatro sobe de uma ponta à outra');
  const comPortal = montar({ portais: [0.5] }).caixas;
  assert.ok(comPortal.length < cheio.length, 'o portal abre um vão');
});

test('lago: a cava da cena desce ao leito dentro do contorno e volta ao chão depois de 24 m (e se desfaz)', () => {
  const n = 129;
  const T = { n, passo: 8, origem: [-512, -512], altura: new Float32Array(n * n).fill(12) };
  const res = PLANOS.A.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  // desloca o contorno para dentro da grade de teste
  const peca = { ...res, contorno: res.contorno.map((v, i) => v - (i % 2 ? 770 : 240)) };
  const guarda = new Map();
  cavarTerreno(T, peca, 12, guarda);
  const h = (x, z) => T.altura[Math.round((z + 512) / 8) * n + Math.round((x + 512) / 8)];
  const [cx, cz] = pontoDentro(peca.contorno);
  assert.ok(Math.abs(h(cx, cz) - (12 + peca.fundo)) < 1e-4, 'leito dentro');
  const longe = deslocar(peca.contorno, 40);
  assert.equal(h(longe[0], longe[1]), 12, 'chão original longe da borda');
  descavar(T, guarda);
  assert.ok(T.altura.every((v) => v === 12), 'desfazer volta ao chão');
});
