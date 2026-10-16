// Testes da mercadoria agregada (S2b; seção 6.4 do desenho da simulação, D48): a indústria zoneada produz (empregos
// ocupados x 1 un./h, mais 8% por nível), o comércio consome (empregos ocupados x 1 un./h), a falta é importada a 160% do
// preço base como despesa corrente da ligação externa, o fator "mercadoria que o comércio pede" da demanda da indústria
// segue a parte importada, o painel de demanda mostra os números e a cidade avisa quando importa a maior parte. Antes do
// M1b nada disso existe (mercadoria null, nenhuma despesa, a demanda da indústria pelas vagas do M1a).
// Roda sozinho: node ferramentas/testes/mercadoria.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MERCADORIA } from '../../fonte/data/mercadoria.js';
import { ECONOMIA, REGRAS_DONO } from '../../fonte/data/economia.js';
import { balancoMercadoria, sistemaMercadoria, custoImportacao } from '../../fonte/sim/mercadoria.js';
import { calcularDemanda, sistemaDemanda, DEMANDA } from '../../fonte/sim/zonas/demanda.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { abrirM1b, ruaComRedes, povoar, pintar, rodadas } from './apoio-m1b.mjs';

/** Mercado de trabalho fixo (ocupação cheia): a mercadoria sai das vagas dos prédios, sem a cidade de moradores. */
function ocupacaoCheia(sim, frac = 1) {
  sim._sistemas.find((s) => s.nome === 'cidadaos').ativo = false;
  sim.json.cidade.ocupacao = [frac, frac, frac, frac];
}

/** Uma cidade com `ind` fábricas e `com` lojas prontas (as vagas vêm do catálogo no nível 1). */
function cidade(semente, ind, com) {
  const { sim } = ruaComRedes(semente);
  ocupacaoCheia(sim);
  const f = ind ? povoar(sim, 'industria', -330, -460, 50, ind) : [];
  const l = com ? povoar(sim, 'comBaixa', -560, -460, 80, com) : [];
  // as zonas já cumpriram a tarefa de pôr os prédios: sem demanda nascendo outros no meio da conta
  if (ind) pintar(sim, -330, -460, 90, '');
  if (com) pintar(sim, -560, -460, 120, '');
  return { sim, f, l };
}

const vagas = (sim, lista) => lista.reduce((s, i) => s + sim.tabelas.predios.empregos[i], 0);

test('antes do M1b a mercadoria não existe: null, nenhuma despesa e a demanda da indústria pelas vagas', () => {
  const { sim, f, l } = cidade('merc-m1a', 2, 3);
  assert.ok(f.length >= 1 && l.length >= 1);
  sistemaMercadoria(sim);
  rodadas(sim, 3);
  assert.equal(sim.agregados.mercadoria, null);
  assert.equal(custoImportacao(sim), 0);
  assert.equal(sim.q.demanda().mercadoria, null);
  // a lista de custos não ganha nada: o que já existia no M1a segue igual
  assert.ok(sim.custos.lista().every((c) => c.nome !== 'ligacao.mercadoria' || c.valor === 0));
  const d = calcularDemanda(sim);
  const bens = d.fatores.ind.find((x) => x.id === 'bens');
  assert.ok(bens, 'fator do M1a pelas vagas do comércio contra as da indústria');
});

test('produção e consumo pelos empregos ocupados, com a falta importada e a sobra anotada', () => {
  const fecha = abrirM1b();
  try {
    const { sim, f, l } = cidade('merc-balanco', 2, 4);
    assert.ok(f.length >= 1 && l.length >= 2);
    const P = sim.tabelas.predios;
    sistemaMercadoria(sim);
    const m = sim.agregados.mercadoria;
    const empInd = vagas(sim, f);
    const empCom = vagas(sim, l);
    assert.ok(empInd > 0 && empCom > 0);
    // nível 1: sem o acréscimo do nível; ocupação 1: todas as vagas
    assert.ok(Math.abs(m.producao - empInd * MERCADORIA.producaoPorEmprego) <= 0.15, `${m.producao} contra ${empInd}`);
    assert.ok(Math.abs(m.consumo - empCom * MERCADORIA.consumoPorEmprego) <= 0.15);
    assert.equal(m.importada, Math.round(Math.max(0, m.consumo - m.producao) * 10) / 10);
    assert.equal(m.excedente, Math.round(Math.max(0, m.producao - m.consumo) * 10) / 10);
    assert.ok(m.importada === 0 || m.excedente === 0, 'ou falta ou sobra');
    // ocupação pela metade: metade da produção e do consumo (o balanço lê os empregos ocupados, não as vagas)
    ocupacaoCheia(sim, 0.5);
    const b = balancoMercadoria(sim);
    assert.ok(Math.abs(b.producao - m.producao / 2) < 0.6 && Math.abs(b.consumo - m.consumo / 2) < 0.6);
    // o nível sobe a produção em 8% por nível
    ocupacaoCheia(sim, 1);
    const antes = balancoMercadoria(sim).producao;
    for (const i of f) P.nivel[i] = 3;
    const depois = balancoMercadoria(sim).producao;
    assert.ok(Math.abs(depois / antes - (1 + 2 * MERCADORIA.nivelProducao)) < 0.02, `${depois / antes}`);
    // fábrica em obra ou abandonada não produz
    for (const i of f) P.flags[i] |= 1;
    assert.equal(balancoMercadoria(sim).producao, 0);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('a falta é importada a 160% do preço base: despesa corrente da ligação externa; a sobra não rende nada', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = cidade('merc-custo', 1, 5);
    sistemaMercadoria(sim);
    const m = sim.agregados.mercadoria;
    assert.ok(m.importada > 0, `importada ${m.importada}`);
    const esperado = m.importada * MERCADORIA.preco * ECONOMIA.importacao.fator;
    assert.equal(MERCADORIA.fatorImportacao, 1.6);
    assert.ok(Math.abs(custoImportacao(sim) - esperado) < 1e-9);
    const c = sim.custos.lista().find((x) => x.nome === 'ligacao.mercadoria');
    assert.ok(c && Math.abs(c.valor - esperado) < 1e-9);
    // o orçamento da economia põe a despesa em "ligação" (a regex da economia pega 'ligacao')
    const hora = sim.q.orcamento ? sim.q.orcamento() : null;
    if (hora?.despesas) assert.ok(hora.despesas.ligacao >= esperado - 1e-6, JSON.stringify(hora.despesas));
    // a regra do dono não mudou: o Depósito, o lote e as faixas da Contribuição
    assert.equal(REGRAS_DONO.deposito.venda, 1.5);
    assert.deepEqual(REGRAS_DONO.renda.tarifas, [5, 8, 11]);
    // indústria de sobra: nada importado, sobra anotada e despesa zero
    const { sim: s2 } = cidade('merc-sobra', 4, 1);
    sistemaMercadoria(s2);
    const m2 = s2.agregados.mercadoria;
    assert.equal(m2.importada, 0);
    assert.ok(m2.excedente > 0);
    assert.equal(custoImportacao(s2), 0);
  } finally {
    fecha();
  }
});

test('o fator "mercadoria que o comércio pede" segue a parte importada; o painel de demanda traz os números', () => {
  const fecha = abrirM1b();
  try {
    const fator = (sim) => {
      sistemaMercadoria(sim);
      return calcularDemanda(sim).fatores.ind.find((x) => x.id === 'bens').v;
    };
    // sem indústria nenhuma: tudo é importado, o fator vai ao teto (25)
    const { sim: sem } = cidade('merc-demanda-0', 0, 4);
    assert.equal(fator(sem), DEMANDA.ind.bens);
    // com indústria que cobre o consumo: o fator some
    const { sim: cheia } = cidade('merc-demanda-1', 5, 1);
    assert.equal(fator(cheia), 0);
    // no meio: proporcional à parte importada
    const { sim } = cidade('merc-demanda-2', 1, 5);
    const v = fator(sim);
    const m = sim.agregados.mercadoria;
    assert.ok(v > 0 && v < DEMANDA.ind.bens);
    assert.ok(Math.abs(v - Math.round(((DEMANDA.ind.bens * m.importada) / m.consumo) * 10) / 10) < 0.11, `${v}`);
    // o painel (q.demanda): os números da mercadoria e o fator na lista da indústria
    sistemaDemanda(sim);
    const q = sim.q.demanda();
    assert.deepEqual(q.mercadoria, m);
    assert.deepEqual(Object.keys(q.mercadoria).sort(), ['consumo', 'excedente', 'importada', 'producao']);
    assert.ok(q.fatores.industria.some((x) => x.id === 'bens' && x.v > 0));
    // a cidade (q.cidade) não perde nada e a barra segue igual
    assert.equal(sim.q.cidade().demanda.fatores, undefined);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('o alerta da cidade: o comércio importa a maior parte', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = cidade('merc-alerta', 0, 5);
    sistemaMercadoria(sim);
    const a = sim.q.avisos({ limite: 50 }).find((x) => x.id === 'mercadoria');
    assert.ok(a, 'avisa');
    assert.equal(a.codigo, 'mercadoriaImportada');
    assert.equal(a.glifo, 'semMercadoria');
    assert.equal(a.params.pct, 100);
    // com a indústria que cobre, o aviso sai
    const { sim: ok } = cidade('merc-alerta-2', 5, 1);
    sistemaMercadoria(ok);
    assert.ok(!ok.q.avisos({ limite: 50 }).some((x) => x.id === 'mercadoria'));
    // consumo pequeno demais não vale um aviso
    const { sim: pouco } = cidade('merc-alerta-3', 0, 1);
    sistemaMercadoria(pouco);
    assert.ok(pouco.agregados.mercadoria.consumo < MERCADORIA.alerta.consumoMin);
    assert.ok(!pouco.q.avisos({ limite: 50 }).some((x) => x.id === 'mercadoria'));
  } finally {
    fecha();
  }
});

test('a rodada escreve a mercadoria sozinha; salvar e carregar e duas partidas iguais dão o mesmo hash', () => {
  const fecha = abrirM1b();
  try {
    const partida = () => cidade('merc-save', 2, 4).sim;
    const a = partida();
    const b = partida();
    rodadas(a, 2);
    assert.ok(a.agregados.mercadoria && a.agregados.mercadoria.consumo > 0, 'o sistema da rodada escreve');
    rodadas(b, 2);
    assert.equal(a.q.hash(), b.q.hash());
    a.rodar(33, { sincrono: true });
    b.rodar(33, { sincrono: true });
    const C = criarSimulacao({ semente: 'merc-save', modo: 'livre' });
    aplicarSave(C, migrar(lerSave(montarSave(a))));
    assert.equal(C.q.hash(), a.q.hash());
    assert.deepEqual(C.agregados.mercadoria, a.agregados.mercadoria);
    C._sistemas.find((s) => s.nome === 'cidadaos').ativo = false;
    a.rodar(100, { sincrono: true });
    C.rodar(100, { sincrono: true });
    b.rodar(100, { sincrono: true });
    assert.equal(C.q.hash(), a.q.hash());
    assert.equal(b.q.hash(), a.q.hash());
    assert.deepEqual(a.erros, []);
  } finally {
    fecha();
  }
});
