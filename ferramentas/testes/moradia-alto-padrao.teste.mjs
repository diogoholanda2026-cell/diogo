// Testes da moradia de alto padrão (R4c, D95): nas zonas do jogador nada abaixo da classe média alta; a casa de
// autoconstrução só existe na Vila de Santa Cida (área 'vila'); casas em lote grande até a mansão, prédios de padrão
// alto e torres de luxo com heliponto; a renda por morador não muda e a capacidade dos lares fica registrada.
// Roda sozinho: node ferramentas/testes/moradia-alto-padrao.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDIOS, PREDIOS_ORDEM, modelosDaZona, ehDaVila, modelosDaVila, REQUALIFICACAO_VILA, nivelDoModelo } from '../../fonte/data/predios.js';
import { PALETAS, TIPOLOGIAS } from '../../fonte/data/estilos.js';
import { planoPredio, caixaDasPecas } from '../../fonte/render/geracao/planoPredio.js';
import { FACHADA } from '../../fonte/render/geracao/malhaPredio.js';
import { REGRAS_DONO } from '../../fonte/data/economia.js';

const semente = (k) => (Math.imul(k + 1, 2654435761) ^ 0x1234567) >>> 0;
const POPULARES = new Set(['vila', 'casa', 'sobradoGeminado', 'pilotis', 'varandas', 'torrePodio']);
const plano = (id, nivel, k, estilo = k % 4) => {
  const m = PREDIOS[id];
  return planoPredio({ w: m.planta[0] * 8, d: m.planta[1] * 8, modelo: id, nivel, estilo, semente: semente(k) });
};

test('catálogo: as zonas do jogador só têm tipologia de alto padrão; a Vila tem a de autoconstrução (D95)', () => {
  for (const zona of ['resBaixa', 'resMedia', 'resAlta']) {
    const ms = modelosDaZona(zona);
    assert.ok(ms.length >= 2, `${zona}: modelos do jogador`);
    for (const id of ms) {
      assert.ok(!ehDaVila(id), `${id} é da Vila`);
      for (const nv of PREDIOS[id].niveis) assert.ok(!POPULARES.has(nv.tipologia), `${id}: tipologia ${nv.tipologia} abaixo da classe média alta`);
    }
  }
  const vila = modelosDaVila();
  assert.deepEqual(vila.slice().sort(), ['casa', 'casaEsquina', 'casaFundo', 'casaGeminada', 'sobrado']);
  for (const id of vila) {
    assert.equal(PREDIOS[id].zona, 'resBaixa');
    assert.equal(PREDIOS[id].niveis[0].tipologia, 'vila', `${id}: o nível 1 da Vila é a casa de autoconstrução`);
    assert.ok(PREDIOS_ORDEM.includes(REQUALIFICACAO_VILA[id]) && !ehDaVila(REQUALIFICACAO_VILA[id]), `${id}: gancho da S3b para um modelo de alto padrão`);
  }
  // os índices antigos não mexem: os modelos novos entram no fim
  assert.deepEqual(PREDIOS_ORDEM.slice(0, 3), ['casaEsquina', 'casaGeminada', 'casa']);
  assert.deepEqual(PREDIOS_ORDEM.slice(-5), ['casaJardim', 'sobradoAlto', 'casaPatio', 'casaTerreno', 'mansaoLote']);
});

test('lote grande: a casa ocupa ao menos 16 x 24 m e a mansão chega a 40 x 40 m', () => {
  for (const id of modelosDaZona('resBaixa')) assert.ok(PREDIOS[id].planta[0] * PREDIOS[id].planta[1] >= 6, `${id} em lote pequeno`);
  assert.deepEqual(PREDIOS.mansaoLote.planta, [5, 5]);
  assert.equal(nivelDoModelo('mansaoLote', 5).tipologia, 'mansao');
  assert.equal(nivelDoModelo('casaJardim', 1).tipologia, 'casaAltoPadrao');
  assert.equal(nivelDoModelo('predioMedio', 1).tipologia, 'edificioPedraVidro');
  assert.equal(nivelDoModelo('torreRes', 5).tipologia, 'torreVidro');
});

test('nenhum prédio do jogador tem fibrocimento, caixa d\'água azul, esperas nem chapisco; o da Vila sim', () => {
  const popular = (pl) => pl.pecas.some((p) => p.mat?.t === FACHADA.FIBRO || p.topo?.t === FACHADA.FIBRO || PALETAS.caixaAgua.includes(p.mat?.c1) || PALETAS.chapisco.includes(p.mat?.c1));
  for (const zona of ['resBaixa', 'resMedia', 'resAlta']) {
    for (const id of modelosDaZona(zona)) {
      for (let nivel = 1; nivel <= 5; nivel++) for (let k = 0; k < 24; k++) assert.ok(!popular(plano(id, nivel, k)), `${id} nível ${nivel} semente ${k}: cara de autoconstrução`);
    }
  }
  let vila = 0;
  for (let k = 0; k < 60; k++) if (popular(plano('casa', 1, k, 2))) vila++;
  assert.ok(vila >= 20, `a Vila perdeu a autoconstrução (${vila} de 60)`);
});

test('torre de luxo: heliponto no nível 5 sempre e no 4 em parte; mansão com pórtico e pedra clara; prédio baixo com empena de pedra', () => {
  const temHeli = (pl) => pl.pecas.filter((p) => p.forma === 'cilindro' && p.lod1 && p.h === 0.5).length;
  for (let k = 0; k < 20; k++) assert.equal(temHeli(plano('torreRes', 5, k)), 1, `torre nível 5 semente ${k}: heliponto`);
  let n4 = 0;
  for (let k = 0; k < 60; k++) n4 += temHeli(plano('torreEstreita', 4, k));
  assert.ok(n4 >= 15 && n4 <= 50, `torre de luxo nível 4: heliponto em ${n4} de 60`);
  let colunas = 0;
  let pedra = 0;
  for (let k = 0; k < 40; k++) {
    const pl = plano('mansaoLote', 5, k, 3);
    if (pl.pecas.filter((p) => p.forma === 'coluna').length >= 4) colunas++;
  }
  assert.ok(colunas >= 20, `mansão clássica com colunas em ${colunas} de 40`);
  for (let k = 0; k < 40; k++) if (plano('predioBaixo', 1, k).pecas.some((p) => p.mat?.t === FACHADA.PEDRA && p.h > 10)) pedra++;
  assert.ok(pedra >= 30, `empena de pedra em ${pedra} de 40 prédios baixos`);
});

test('lote da casa de alto padrão: jardim, piscina e muro de pedra, tudo dentro do lote', () => {
  let piscinas = 0;
  for (let k = 0; k < 40; k++) {
    const pl = planoPredio({ w: 32, d: 32, modelo: 'casaTerreno', nivel: 3, estilo: k % 4, semente: semente(k + 77) });
    if (pl.pecas.some((p) => p.mat?.t === FACHADA.AGUA)) piscinas++;
    assert.ok(pl.pecas.some((p) => p.mat?.t === FACHADA.VERDE), 'gramado');
    const b = caixaDasPecas(pl.pecas);
    assert.ok(b[0] >= -16.01 && b[3] <= 16.01 && b[2] >= -16.01, 'dentro do lote');
  }
  assert.ok(piscinas >= 30, `piscina em ${piscinas} de 40`);
});

test('regras do dono intactas e a capacidade dos lares registrada (D95)', () => {
  assert.deepEqual(REGRAS_DONO.renda.tarifas, [5, 8, 11]);
  // os modelos de alto padrão abrigam uma família com a equipe da casa; a densidade por célula é menor que a da Vila
  for (const id of ['casaJardim', 'casaPatio', 'casaTerreno', 'mansaoLote']) {
    const m = PREDIOS[id];
    assert.ok(m.niveis[0].moradores >= 4 && m.niveis[4].moradores <= 12, `${id}: ${m.niveis[0].moradores} a ${m.niveis[4].moradores} moradores`);
    assert.ok(m.niveis[4].moradores >= m.niveis[0].moradores, `${id} cresce com o nível`);
  }
  assert.equal(TIPOLOGIAS.mansao.recuo[0] >= 8, true);
});
