// Ato 1 completo, cimento e Modo livre (dona: S3b): as 3 decisões novas do M1b (Crise da Energia, licença da Mina, futuro da
// Vila) com os efeitos na simulação, a cadeia do cimento (Mina, Cimenteira, Concreteira e a cadeia da D48), a Vila nova
// (objetivo de Legado que requalifica as casas pelo gancho da D95), a cadeia de alimentos para o comércio, o Modo livre
// (D56), e que o M1a segue como era sem a PARTE_ATUAL aberta. Roda sozinho (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECISOES, EVENTOS, tiqueDaData, VILA_NOVA, MODO_LIVRE } from '../../fonte/data/historia.js';
import { OBJETIVOS } from '../../fonte/data/objetivos.js';
import { MARCOS } from '../../fonte/data/marcos.js';
import { PREDIOS_HOLDING, HOLDING_ORDEM, HOLDING_M1B, ITENS, ITENS_ORDEM, CADEIA_M1A } from '../../fonte/data/holding.js';
import { PREDIOS_ORDEM, REQUALIFICACAO_VILA, PREDIOS } from '../../fonte/data/predios.js';
import * as zonas from '../../fonte/data/zonas.js';
import { TIPO_PREDIO, PREDIO } from '../../fonte/contratos/flags.js';
import { refDe } from '../../fonte/contratos/espelho.js';
import { porEstoque, folhaHolding } from '../../fonte/sim/holding/producao.js';
import { itensDaCadeia, ITENS_DA_CADEIA } from '../../fonte/sim/holding/mercado.js';
import { casasDaVila, estadoVila, requalificarVila } from '../../fonte/sim/holding/vila.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { registrar as registrarTextosS3 } from '../../fonte/ui/textos/s3.js';
import { registrar as registrarTextosS3b } from '../../fonte/ui/textos/s3b.js';
import { simS3a, predioHolding, fixarCidade } from '../robo/cidade-faz-de-conta.mjs';

const ok = (r) => assert.equal(r.ok, true, JSON.stringify(r));
const abertas = (sim) => sim.q.decisoes().map((d) => d.id);

/** Roda fn com o M1b aberto (PARTE_ATUAL) e devolve a parte como estava. */
function comM1b(fn) {
  assert.equal(typeof zonas.definirParteAtual, 'function', 'data/zonas.js precisa de definirParteAtual (S2b)');
  const antes = zonas.definirParteAtual('M1b');
  try {
    return fn();
  } finally {
    zonas.definirParteAtual(antes);
  }
}

/** Dá XP até o marco n (sem requisito). */
function ateMarco(sim, n) {
  sim.progresso.xp(Math.max(0, MARCOS[n].xp - sim.json.progresso.xp), 'teste');
  sim.rodar(20, { sincrono: true });
  assert.equal(sim.progresso.marco().n, n);
}

/** Produtividade de cada prédio da Holding, por tipo. */
const produtividades = (sim) => Object.fromEntries(sim.q.producao().predios.map((p) => [p.tipo, p.produtividade]));

// ------------------------------------------------------------------------------------------------ dados

test('dados: 6 decisões no Ato 1, uma voz para cada conselheiro; as novas são do M1b e todo texto existe', () => {
  assert.equal(DECISOES.length, 6);
  assert.deepEqual(DECISOES.filter((d) => d.parte === 'M1b').map((d) => d.id), ['energia.2022', 'mina.licenca', 'vila.futuro']);
  const vozes = new Set(DECISOES.flatMap((d) => d.quem));
  assert.deepEqual([...vozes].sort(), ['caio', 'cida', 'iris', 'livia', 'nara', 'tome']);
  for (const d of DECISOES) assert.ok(d.opcoes.every((o) => (o.influencia > 0) !== (o.legado > 0)), `${d.id}: cada opção puxa um medidor`);
  const ev = EVENTOS.find((e) => e.id === 'energia2022');
  assert.equal(ev.m1b.decisao, 'energia.2022');
  const textos = {};
  registrarTextosS3((p, m) => Object.assign(textos, m));
  registrarTextosS3b((p, m) => Object.assign(textos, m));
  for (const tipo of HOLDING_ORDEM) assert.ok(textos[`s3.holding.${tipo}`] && textos[`s3.holding.${tipo}.faz`], `texto do prédio ${tipo}`);
  for (const k of ITENS_ORDEM) assert.ok(textos[`s3.item.${k}`], `texto do item ${k}`);
  for (const m of ['reformar', 'substituir']) assert.ok(textos[`s3.mural.vilaNova.${m}`]);
  for (const t of Object.values(textos)) assert.ok(!/[–—]/.test(t), 'sem travessão');
});

test('dados: Mina 15 mil e Cimenteira 40 mil, a cadeia do cimento fecha e os prédios novos acabam no fim da ordem', () => {
  assert.equal(PREDIOS_HOLDING.mina.custo, 15000);
  assert.equal(PREDIOS_HOLDING.cimenteira.custo, 40000);
  assert.deepEqual(ITENS.cimento.req, { calcario: 2, argila: 1 });
  assert.equal(ITENS.calcario.predio, 'mina');
  assert.deepEqual(ITENS.concreto.req, { cimento: 1, brita: 2, areia: 1 });
  assert.deepEqual(HOLDING_M1B, ['mina', 'cimenteira', 'vidraria', 'serraria', 'manejo', 'fazenda', 'agroindustria']);
  assert.deepEqual(HOLDING_ORDEM.slice(-2), ['fazenda', 'agroindustria'], 'índices antigos intactos (predios.modelo)');
  // todo prédio do M1b tem os níveis 2 e 3 (com marco, custo e materiais)
  for (const tipo of HOLDING_M1B) {
    const n = PREDIOS_HOLDING[tipo].niveis;
    assert.ok(n[1]?.custo > 0 && n[2]?.custo > 0, tipo);
    assert.ok(n[1].marco <= n[2].marco, tipo);
  }
  // o marco que abre cada um (m1b) bate com o do prédio
  for (const tipo of HOLDING_M1B) {
    const m = MARCOS.find((x) => (x.m1b ?? []).includes(`holding.${tipo}`));
    assert.equal(m?.n, PREDIOS_HOLDING[tipo].marco, tipo);
  }
  assert.deepEqual(ITENS_DA_CADEIA, CADEIA_M1A);
});

// ------------------------------------------------------------------------------------------------ M1a intacto

test('sem o M1b no jogo nada muda: as decisões novas não abrem, o choque da energia não chega, o M1b fica trancado', () => {
  assert.equal(zonas.PARTE_ATUAL, 'M1a');
  const sim = simS3a({ semente: 'm1a-intacto', populacao: 1500, bemEstar: 55 });
  ateMarco(sim, 3);
  sim.rodar(tiqueDaData(2022, 6) - sim.tique, { sincrono: true });
  assert.ok(!abertas(sim).includes('energia.2022') && !abertas(sim).includes('mina.licenca') && !abertas(sim).includes('vila.futuro'));
  assert.equal(sim.economia.efeitos('custoLigacao').length, 0);
  assert.ok(sim.json.historia.eventos.includes('energia2022'), 'a nota no Mural segue');
  assert.ok(sim.q.mural().some((p) => p.texto === 's3.mural.evento.energia2022'));
  assert.equal(sim.progresso.liberado('holding.mina'), false);
  assert.equal(sim.progresso.liberado('item.cimento'), true, 'o cimento importado do marco 3 segue como era');
  assert.equal(sim.progresso.liberado('item.graos'), false);
  assert.equal(sim.progresso.liberado('holding.agroindustria'), false);
  assert.deepEqual(sim.json.historia.eventosM1b, []);
  assert.equal(sim.q.catalogo('empresas').some((c) => c.tipo === 'mina'), false);
  assert.deepEqual(sim.validar(), []);
});

test('abrir o M1b depois: o choque e a decisão do evento que já passou entram na hora', () => {
  const sim = simS3a({ semente: 'm1b-tarde', populacao: 1500, bemEstar: 55 });
  sim.rodar(tiqueDaData(2022, 6), { sincrono: true });
  assert.equal(sim.economia.efeitos('custoLigacao').length, 0);
  comM1b(() => {
    sim.rodar(20, { sincrono: true });
    assert.deepEqual(sim.json.historia.eventosM1b, ['energia2022']);
    assert.ok(abertas(sim).includes('energia.2022'));
    assert.equal(sim.economia.efeitos('custoLigacao').length, 1);
  });
});

// ------------------------------------------------------------------------------------------------ as 3 decisões do M1b

test('Crise da Energia (fev. 2022): a energia da rodovia fica 60% mais cara; contrato anula, usina solar baixa a conta', () => {
  comM1b(() => {
    const monta = (semente) => {
      const sim = simS3a({ semente, populacao: 1500, bemEstar: 55 });
      sim.custos.registrar('ligacao', () => 1000);
      sim.custos.registrar('servicos.teste', () => 400);
      sim.rodar(tiqueDaData(2022, 2) - 40, { sincrono: true });
      assert.equal(sim.q.orcamento().despesas.ligacao, 1000, 'antes da crise');
      sim.rodar(100, { sincrono: true });
      return sim;
    };
    // contrato de longo prazo: o choque (energia e importação) é anulado
    let sim = monta('energia-contrato');
    assert.ok(abertas(sim).includes('energia.2022'));
    assert.equal(sim.q.orcamento().despesas.ligacao, 1600, 'a conta da ligação sobe 60%');
    assert.equal(sim.q.deposito().itens.find((i) => i.item === 'brita').precoImportacao, 20 * 1.6 * 1.1, 'a importação sobe 10%');
    const c0 = sim.holding.caixa();
    const inf0 = sim.q.holding().influencia;
    ok(sim.cmd('decisao.escolher', { id: 'energia.2022', opcao: 'contrato' }));
    assert.equal(c0 - sim.holding.caixa(), 30000);
    sim.rodar(20, { sincrono: true });
    assert.equal(sim.q.orcamento().despesas.ligacao, 1000);
    assert.equal(sim.q.holding().influencia - inf0, 6);
    assert.ok(sim.json.historia.marcas.includes('energia.2022:contrato'));
    // usina solar da Holding: o choque corre por 12 meses e a conta cai 30% por 5 anos
    sim = monta('energia-solar');
    const leg0 = sim.q.holding().legado;
    ok(sim.cmd('decisao.escolher', { id: 'energia.2022', opcao: 'solar' }));
    sim.rodar(20, { sincrono: true });
    assert.equal(sim.q.holding().legado - leg0, 6);
    assert.ok(Math.abs(sim.q.orcamento().despesas.ligacao - 1120) < 1e-6, '1,6 x 0,7');
    sim.rodar(12 * 600, { sincrono: true });
    assert.ok(Math.abs(sim.q.orcamento().despesas.ligacao - 700) < 1e-6, 'o choque acabou, a usina segue');
    sim.rodar(48 * 600, { sincrono: true });
    assert.equal(sim.q.orcamento().despesas.ligacao, 1000, 'cinco anos depois');
    // prazo: vale a padrão (contrato)
    sim = monta('energia-prazo');
    sim.rodar(3 * 600 + 40, { sincrono: true });
    const dec = sim.json.historia.decididas.find((d) => d.id === 'energia.2022');
    assert.deepEqual([dec.opcao, dec.auto], ['contrato', true]);
    assert.deepEqual(sim.validar(), []);
  });
});

test('licença da Mina (marco 2): recuperar rende 10% menos e dá Legado; acelerar rende 20% mais na Mina e na Cimenteira', () => {
  comM1b(() => {
    const monta = (semente) => {
      const sim = simS3a({ semente, populacao: 4000, bemEstar: 55 });
      predioHolding(sim, 'escritorioObra', 0, 0);
      predioHolding(sim, 'mina', 200, 0);
      predioHolding(sim, 'cimenteira', 400, 0);
      predioHolding(sim, 'pedreira', 600, 0);
      ateMarco(sim, 2);
      return sim;
    };
    let sim = monta('mina-base');
    assert.ok(abertas(sim).includes('mina.licenca'), 'abre no marco 2');
    const base = produtividades(sim);
    assert.ok(base.mina > 0.9 && base.mina === base.pedreira && base.cimenteira === base.pedreira, JSON.stringify(base));
    // recuperar: a Mina 10% menos, a Cimenteira e a Pedreira iguais
    sim = monta('mina-recuperar');
    const c0 = sim.holding.caixa();
    ok(sim.cmd('decisao.escolher', { id: 'mina.licenca', opcao: 'recuperar' }));
    assert.equal(c0 - sim.holding.caixa(), 10000);
    sim.rodar(20, { sincrono: true });
    let p = produtividades(sim);
    assert.ok(Math.abs(p.mina - base.mina * 0.9) < 1e-9 && p.cimenteira === base.cimenteira && p.pedreira === base.pedreira, JSON.stringify(p));
    assert.equal(sim.q.holding().legado, 6);
    // acelerar: a Mina e a Cimenteira 20% mais, a Pedreira igual
    sim = monta('mina-acelerar');
    ok(sim.cmd('decisao.escolher', { id: 'mina.licenca', opcao: 'acelerar' }));
    sim.rodar(20, { sincrono: true });
    p = produtividades(sim);
    assert.ok(Math.abs(p.mina - base.mina * 1.2) < 1e-9 && Math.abs(p.cimenteira - base.cimenteira * 1.2) < 1e-9 && p.pedreira === base.pedreira, JSON.stringify(p));
    assert.equal(sim.q.holding().influencia, 5);
    // sem caixa para a opção: recusa com 'creditos'
    sim = monta('mina-sem-caixa');
    sim.holding.pagar(sim.holding.caixa() - 100, 'teste');
    assert.equal(sim.cmd('decisao.escolher', { id: 'mina.licenca', opcao: 'acelerar' }).codigo, 'creditos');
    assert.deepEqual(sim.validar(), []);
  });
});

// ------------------------------------------------------------------------------------------------ a Vila nova

/** Sim só com a S3a e uma "Vila" de faz de conta: casas de autoconstrução na tabela, com a lista em json.mapa.predios. */
function simComVila(semente, { casas = ['casa', 'sobrado', 'casaFundo', 'casa', 'casaEsquina', 'casaGeminada'], loja = true } = {}) {
  const sim = simS3a({ semente, populacao: 2500, bemEstar: 62 });
  const P = sim.tabelas.predios;
  const refs = [];
  const novo = (modelo, x, z, moradores) => {
    const i = P.alocar();
    P.tipo[i] = TIPO_PREDIO.ZONA;
    P.modelo[i] = PREDIOS_ORDEM.indexOf(modelo);
    P.zona[i] = 1;
    P.x[i] = x;
    P.z[i] = z;
    P.w[i] = PREDIOS[modelo].planta[0] * 8;
    P.d[i] = PREDIOS[modelo].planta[1] * 8;
    P.nivel[i] = 2;
    P.semente[i] = 7000 + i;
    P.flags[i] = 0;
    P.moradores[i] = moradores;
    P.marcar(i);
    refs.push(refDe(i, P.ger[i]));
    return i;
  };
  casas.forEach((c, k) => novo(c, 100 + 30 * k, 50, 4));
  if (loja) novo('loja', 400, 50, 0);
  sim.registrarJson('mapa', { predios: refs });
  return { sim, refs };
}

test('Vila nova (D95): vila.futuro põe o objetivo na frente; ao cumprir, a Holding paga e as casas passam ao padrão alto', () => {
  comM1b(() => {
    const { sim, refs } = simComVila('vila-nova');
    const P = sim.tabelas.predios;
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
    ateMarco(sim, 3);
    assert.ok(abertas(sim).includes('vila.futuro'), 'abre no marco 3');
    assert.equal(sim.q.objetivos().find((o) => o.dominio === 'cidade').id !== 'cidade.vilaNova', true, 'antes da decisão não aparece');
    assert.equal(casasDaVila(sim).length, 6, 'a loja não é casa de autoconstrução');
    const antes = casasDaVila(sim).map((i) => ({ i, modelo: PREDIOS_ORDEM[P.modelo[i]], semente: P.semente[i], w: P.w[i], d: P.d[i], nivel: P.nivel[i], moradores: P.moradores[i] }));
    const caixa0 = sim.holding.caixa();
    ok(sim.cmd('decisao.escolher', { id: 'vila.futuro', opcao: 'reformar' }));
    assert.equal(sim.q.holding().legado, 3);
    const obj = () => sim.q.objetivos().find((o) => o.dominio === 'cidade');
    assert.equal(obj().id, 'cidade.vilaNova', 'a decisão pôs o objetivo na frente');
    assert.deepEqual([obj().feito, obj().total], [3, 3], 'rede, bem-estar e caixa: tudo pronto');
    const v = sim.q.holding().vilaNova;
    assert.deepEqual([v.restantes, v.custo, v.metodo, v.pronta], [6, 6 * 600, 'reformar', true]);
    // a rodada do objetivo requalifica
    sim.rodar(40, { sincrono: true });
    assert.ok(sim.json.objetivos.feitos.includes('cidade.vilaNova'));
    assert.equal(caixa0 - sim.holding.caixa() > 0, true);
    for (const a of antes) {
      assert.equal(PREDIOS_ORDEM[P.modelo[a.i]], REQUALIFICACAO_VILA[a.modelo], `${a.modelo} vira ${REQUALIFICACAO_VILA[a.modelo]}`);
      assert.equal(P.semente[a.i], a.semente, 'a semente (o desenho) fica');
      assert.deepEqual([P.w[a.i], P.d[a.i], P.nivel[a.i]], [a.w, a.d, a.nivel], 'o lote e o nível ficam');
      assert.ok(P.moradores[a.i] <= a.moradores, 'a família que estava continua, até a capacidade');
      assert.ok(P.flags[a.i] & PREDIO.OBRA && P.flags[a.i] & PREDIO.OBRA_NIVEL, 'obra de reforma: a casa segue funcionando');
      assert.equal(P.obraFim[a.i] - P.obraIni[a.i], VILA_NOVA.metodos.reformar.obraTiques);
    }
    // a loja e as casas fora do mapa da Vila não mudam
    assert.equal(PREDIOS_ORDEM[P.modelo[refs[6] % 1048576]], 'loja');
    assert.equal(casasDaVila(sim).length, 0);
    assert.equal(sim.q.holding().legado, 3 + VILA_NOVA.legado);
    assert.equal(sim.json.historia.vilaNova.casas, 6);
    assert.equal(sim.json.historia.vilaNova.custo, 3600);
    assert.ok(sim.q.mural().some((p) => p.texto === 's3.mural.vilaNova.reformar' && p.autor === 'cida' && p.params.n === 6));
    assert.equal(sim.q.holding().vilaNova.feita.casas, 6);
    assert.equal(sim.json.progresso.motivos.objetivos >= 120, true, 'XP do objetivo');
    // não repete
    const caixa1 = sim.holding.caixa();
    assert.equal(requalificarVila(sim), false);
    sim.rodar(60, { sincrono: true });
    assert.ok(Math.abs(sim.holding.caixa() - caixa1) < 5e5, 'sem nova cobrança');
    assert.deepEqual(sim.validar(), []);
    assert.deepEqual(sim.erros, []);
  });
});

test('Vila nova: o método da decisão muda o custo e o prazo; sem caixa, bem-estar ou rede o objetivo espera', () => {
  comM1b(() => {
    const { sim } = simComVila('vila-nova-substituir');
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
    ateMarco(sim, 3);
    const P = sim.tabelas.predios;
    ok(sim.cmd('decisao.escolher', { id: 'vila.futuro', opcao: 'substituir' }));
    assert.equal(sim.q.holding().influencia, 5);
    assert.equal(sim.economia.efeitos('demanda').find((e) => e.zona === 'comBaixa').v, 8);
    const obj = () => sim.q.objetivos().find((o) => o.dominio === 'cidade');
    assert.equal(obj().id, 'cidade.vilaNova');
    assert.equal(sim.q.holding().vilaNova.custo, 6 * 1000);
    // sem caixa: 2 de 3, nada muda
    const guardado = sim.holding.caixa();
    sim.holding.pagar(guardado - 5000, 'teste');
    assert.deepEqual([obj().feito, obj().total], [2, 3]);
    sim.rodar(60, { sincrono: true });
    assert.equal(sim.json.historia.vilaNova, null);
    assert.equal(casasDaVila(sim).length, 6);
    // sem rede: a água some
    sim.holding.receber(guardado, 'teste');
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 0, energia: 4000 });
    assert.equal(estadoVila(sim).criterios.rede, false);
    sim.rodar(60, { sincrono: true });
    assert.equal(sim.json.historia.vilaNova, null);
    // bem-estar baixo
    fixarCidade(sim, { populacao: 2500, bemEstar: 50, agua: 5000, energia: 4000 });
    assert.equal(estadoVila(sim).criterios.bemEstar, false);
    sim.rodar(60, { sincrono: true });
    assert.equal(sim.json.historia.vilaNova, null);
    // tudo certo: cumpre com o prazo do método
    sim.json.agregados.bemEstarMedio = 62;
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
    sim.rodar(60, { sincrono: true });
    assert.equal(sim.json.historia.vilaNova.metodo, 'substituir');
    const i = refsDaObra(sim)[0];
    assert.equal(P.obraFim[i] - P.obraIni[i], 300);
    assert.deepEqual(sim.validar(), []);
  });
});

/** Idx das casas em obra de reforma. */
function refsDaObra(sim) {
  const P = sim.tabelas.predios;
  const out = [];
  for (let i = 0; i < P.n; i++) if (P.viva[i] && P.flags[i] & PREDIO.OBRA_NIVEL) out.push(i);
  return out;
}

test('Vila nova: o padrão da decisão (reformar) vale se o prazo passa; o objetivo não abre no M1a', () => {
  // M1a: o objetivo não existe para quem não abriu o M1b
  const a = simComVila('vila-m1a');
  fixarCidade(a.sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
  ateMarco(a.sim, 3);
  assert.equal(abertas(a.sim).includes('vila.futuro'), false);
  assert.ok(!a.sim.q.objetivos().some((o) => o.id === 'cidade.vilaNova'));
  comM1b(() => {
    const { sim } = simComVila('vila-prazo');
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
    ateMarco(sim, 3);
    sim.rodar(3 * 600 + 40, { sincrono: true });
    assert.ok(sim.json.historia.decididas.some((d) => d.id === 'vila.futuro' && d.opcao === 'reformar' && d.auto === true));
    assert.ok(sim.json.historia.marcas.includes('vila.futuro:reformar'));
    assert.equal(sim.json.historia.vilaNova?.metodo, 'reformar', 'a rede, o bem-estar e o caixa já estavam prontos');
  });
});

test('Vila nova: sem casa de autoconstrução (demolida ou ausente) e sem a requalificação, o objetivo não cumpre de graça', () => {
  comM1b(() => {
    // Vila sem casas de autoconstrução (só a loja): a decisão põe o objetivo na frente, mas não há o que reformar
    const { sim } = simComVila('vila-sem-casas', { casas: [] });
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
    ateMarco(sim, 3);
    ok(sim.cmd('decisao.escolher', { id: 'vila.futuro', opcao: 'reformar' }));
    const xp0 = sim.json.progresso.xp;
    const legado0 = sim.q.holding().legado;
    const caixa0 = sim.holding.caixa();
    assert.equal(estadoVila(sim).restantes, 0);
    sim.rodar(120, { sincrono: true });
    assert.ok(!sim.json.objetivos.feitos.includes('cidade.vilaNova'), 'não fecha sem obra');
    assert.equal(sim.json.historia.vilaNova, null);
    assert.equal(sim.q.holding().legado, legado0, 'sem Legado');
    assert.ok(sim.json.progresso.xp - xp0 < 120, 'sem os 120 de XP');
    assert.ok(sim.holding.caixa() >= caixa0 - 1, 'nada foi pago');
    // a medida nunca passa de 2 de 3 e o objetivo sai da lista (não trava o domínio da cidade)
    assert.ok(!sim.q.objetivos().some((o) => o.id === 'cidade.vilaNova'));
    assert.equal(requalificarVila(sim), false);
    assert.deepEqual(sim.erros, []);
  });
  comM1b(() => {
    // as casas demolidas depois da decisão: o objetivo (já aberto) para de valer sem dar nada
    const { sim, refs } = simComVila('vila-demolida');
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 0, energia: 4000 });
    ateMarco(sim, 3);
    ok(sim.cmd('decisao.escolher', { id: 'vila.futuro', opcao: 'reformar' }));
    assert.equal(sim.q.objetivos().find((o) => o.dominio === 'cidade').id, 'cidade.vilaNova');
    const P = sim.tabelas.predios;
    for (const r of refs) if (P.vivaRef(r) && PREDIOS_ORDEM[P.modelo[r % 1048576]] !== 'loja') P.viva[r % 1048576] = 0;
    fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
    sim.rodar(120, { sincrono: true });
    assert.equal(estadoVila(sim).restantes, 0);
    assert.ok(!sim.json.objetivos.feitos.includes('cidade.vilaNova'));
    assert.equal(sim.json.historia.vilaNova, null);
  });
});

// ------------------------------------------------------------------------------------------------ a cadeia do cimento

test('cadeia do cimento: Mina, Olaria e Cimenteira alimentam a Concreteira; o concreto sai do calcário', () => {
  comM1b(() => {
    const sim = simS3a({ semente: 'cadeia-cimento', populacao: 6000, bemEstar: 55 });
    predioHolding(sim, 'escritorioObra', 0, 0);
    predioHolding(sim, 'pedreira', 150, 0);
    predioHolding(sim, 'areal', 300, 0);
    ateMarco(sim, 3);
    predioHolding(sim, 'olaria', 450, 0);
    predioHolding(sim, 'mina', 600, 0);
    predioHolding(sim, 'cimenteira', 750, 0);
    predioHolding(sim, 'concreteira', 900, 0);
    // a Cimenteira e a Mina nascem com a linha 0 no item que fazem, lote 10 e Auto
    const folha = (tipo) => sim.q.producao().predios.find((p) => p.tipo === tipo);
    assert.deepEqual(folha('mina').linhas.map((l) => [l.item, l.n, l.auto]), [['calcario', 10, true]]);
    assert.deepEqual(folha('cimenteira').linhas.map((l) => [l.item, l.n, l.auto]), [['cimento', 10, true]]);
    sim.rodar(6000, { sincrono: true });
    const p = sim.json.producao;
    assert.ok(p.feitos.calcario >= 20, `calcário ${p.feitos.calcario}`);
    assert.ok(p.feitos.argila >= 10, `argila ${p.feitos.argila}`);
    assert.ok(p.feitos.cimento >= 10, `cimento ${p.feitos.cimento}`);
    assert.ok(p.feitos.concreto >= 10, `concreto ${p.feitos.concreto}`);
    // a conta fecha: cada cimento gastou 2 de calcário e 1 de argila; cada concreto, 1 de cimento
    assert.equal(p.consumidos.calcario, 2 * p.feitos.cimento + 2 * (sim.q.producao().predios.find((x) => x.tipo === 'cimenteira').linhas[0].rodando ? 10 : 0), 'o calcário vai todo para o cimento, 2 por unidade');
    assert.ok(p.consumidos.cimento >= p.feitos.concreto);
    assert.deepEqual(sim.validar(), []);
  });
});

test('cadeia do cimento na D48: com a Cimenteira na partida o cimento entra na cadeia; a obra de nível 3 espera por ele', () => {
  comM1b(() => {
    const sim = simS3a({ semente: 'cadeia-d48', populacao: 3000, bemEstar: 55 });
    predioHolding(sim, 'escritorioObra', 0, 0);
    ateMarco(sim, 3);
    assert.deepEqual(itensDaCadeia(sim), CADEIA_M1A, 'sem fábrica, só os da D92');
    // sem Cimenteira a obra de nível 3 importa o cimento sozinha: não espera
    assert.equal(sim.holding.comprarParaObra(-1, 3, { cimento: 4, tijolo: 1 }).espera, false);
    predioHolding(sim, 'cimenteira', 300, 0);
    predioHolding(sim, 'serraria', 500, 0);
    assert.deepEqual(itensDaCadeia(sim), ['brita', 'areia', 'argila', 'tijolo', 'serrada', 'cimento', 'concreto'].sort((a, b) => ITENS_ORDEM.indexOf(a) - ITENS_ORDEM.indexOf(b)));
    assert.ok(!itensDaCadeia(sim).includes('calcario') && !itensDaCadeia(sim).includes('graos'));
    // agora a Holding supre: sem estoque, importa a 160% e vende a 100% (perda), ou espera se a importação está desligada
    ok(sim.cmd('cidade.importarAuto', { sim: false }));
    const r = sim.holding.comprarParaObra(-1, 3, { cimento: 4 });
    assert.equal(r.espera, true);
    sim.rodar(20, { sincrono: true });
    assert.equal(sim.q.producao().esperando.cimento, 4);
    ok(sim.cmd('cidade.importarAuto', { sim: true }));
    const c0 = sim.holding.caixa();
    const r2 = sim.holding.comprarParaObra(-1, 3, { cimento: 4 });
    assert.deepEqual([r2.espera, r2.importadas], [false, 4]);
    assert.ok(Math.abs(c0 - sim.holding.caixa() - 4 * 90 * 0.6) < 1e-6, 'perde 60% de 4 cimentos');
    // com estoque a obra compra da Holding a 100%
    porEstoque(sim, 'cimento', 10);
    const c1 = sim.holding.caixa();
    const r3 = sim.holding.comprarParaObra(-1, 3, { cimento: 4 });
    assert.deepEqual([r3.espera, r3.vendidas], [false, 4]);
    assert.ok(Math.abs(sim.holding.caixa() - c1 - 4 * 90) < 1e-6);
    assert.equal(sim.json.producao.estoque.cimento, 6);
  });
});

// ------------------------------------------------------------------------------------------------ itens e níveis do M1b

test('Fazenda e Agroindústria: grãos e alimentos; os prédios do M1b sobem de nível pelas regras de sempre', () => {
  comM1b(() => {
    const sim = simS3a({ semente: 'alimentos-linha', populacao: 5000, bemEstar: 55 });
    predioHolding(sim, 'escritorioObra', 0, 0);
    ateMarco(sim, 3);
    const faz = predioHolding(sim, 'fazenda', 200, 0);
    const agro = predioHolding(sim, 'agroindustria', 400, 0);
    assert.deepEqual(sim.q.predio(faz).holding.produz, ['graos']);
    assert.deepEqual(sim.q.predio(agro).holding.linhas.map((l) => l.item), ['alimentos']);
    sim.rodar(4000, { sincrono: true });
    const p = sim.json.producao;
    assert.ok(p.feitos.graos >= 10 && p.feitos.alimentos >= 5, JSON.stringify(p.feitos));
    assert.equal(p.consumidos.graos, 2 * p.feitos.alimentos + (sim.q.predio(agro).holding.linhas[0].rodando ? 20 : 0), 'os grãos vão todos para os alimentos, 2 por unidade');
    // nível 2 da Fazenda: marco 3, custo e materiais
    ok(sim.cmd('linha.parar', { predio: faz, linha: 0 }));
    porEstoque(sim, 'brita', 15);
    porEstoque(sim, 'serrada', 10);
    const c0 = sim.holding.caixa();
    ok(sim.cmd('predio.nivel', { ref: faz }));
    assert.equal(c0 - sim.holding.caixa(), PREDIOS_HOLDING.fazenda.niveis[1].custo);
    assert.equal(folhaHolding(sim, faz).linhas.length, 2);
    // a listagem de itens mostra os do M1b só com o M1b no jogo
    assert.ok(sim.q.producao().itens.some((i) => i.item === 'alimentos'));
  });
  const m1a = simS3a({ semente: 'alimentos-m1a', populacao: 100, bemEstar: 55 });
  assert.ok(!m1a.q.producao().itens.some((i) => ['alimentos', 'graos', 'calcario', 'madeira'].includes(i.item)));
});

test('alimentos para o comércio: a Holding vende ao comércio, a cidade importa menos mercadoria', () => {
  comM1b(() => {
    const sim = simS3a({ semente: 'alimentos-comercio', populacao: 3000, bemEstar: 55 });
    predioHolding(sim, 'escritorioObra', 0, 0);
    // a mercadoria da S2b: consumo de 1.000 por hora, a cidade produz 200 e importa 800
    const mercadoria = () => (sim.agregados.mercadoria = { producao: 200, consumo: 1000, importada: 800, excedente: 0 });
    mercadoria();
    // sem estoque de alimentos nada sai, a conta da cidade fica como veio da S2b
    sim.rodar(200, { sincrono: true });
    assert.equal(sim.agregados.mercadoria.importada, 800);
    assert.equal(sim.q.producao().alimentos.vendidos, 0);
    porEstoque(sim, 'alimentos', 100);
    const c0 = sim.holding.caixa();
    // pede 1.000 x 35% = 350 por hora de mercadoria = 17,5 alimentos por hora = 0,097 por rodada
    for (let k = 0; k < 30; k++) {
      sim.rodar(20, { sincrono: true });
      mercadoria(); // a S2b reescreve o objeto a cada rodada; a Holding aplica a oferta de novo
    }
    sim.rodar(1, { sincrono: true });
    const a = sim.q.producao().alimentos;
    assert.ok(a.vendidos >= 1 && a.vendidos <= 4, `vendidos ${a.vendidos}`);
    assert.equal(sim.json.producao.estoque.alimentos, 100 - a.vendidos);
    assert.ok(Math.abs(a.receita - a.vendidos * 70) < 1e-9);
    assert.ok(sim.holding.caixa() > c0 - 1e6, 'a venda entra no caixa');
    assert.ok(a.fornecidoHora > 0);
    const m = sim.agregados.mercadoria;
    assert.ok(m.producao > 200 && m.importada < 800, JSON.stringify(m));
    assert.equal(m.importada, Math.round(Math.max(0, 1000 - m.producao) * 10) / 10);
    assert.ok(Math.abs(m.producao - 200 - m.alimentos) < 0.11);
    // tirar o item da venda à cidade para a oferta
    ok(sim.cmd('estoque.vendeCidade', { item: 'alimentos', sim: false }));
    const antes = a.vendidos;
    for (let k = 0; k < 40; k++) {
      sim.rodar(20, { sincrono: true });
      mercadoria();
    }
    assert.equal(sim.q.producao().alimentos.vendidos, antes);
    sim.rodar(1, { sincrono: true });
    assert.equal(sim.agregados.mercadoria.importada, 800 - Math.min(800, 0), 'sem oferta a cidade importa tudo');
  });
});

// ------------------------------------------------------------------------------------------------ Modo livre

test('Modo livre (D56): o caixa não acaba, tudo liberado, a Holding constrói de qualquer marco; o normal não muda', () => {
  const sim = simS3a({ semente: 'livre-s3', populacao: 1500, bemEstar: 55 });
  ok(sim.cmd('holding.identidade', { nome: 'Held', cor: '#c9a86a', modo: 'livre' }));
  assert.equal(sim.json.partida.modo, 'livre');
  sim.rodar(2, { sincrono: true });
  const cheio = () => sim.holding.caixa() >= MODO_LIVRE.caixa && sim.holding.caixa() < MODO_LIVRE.caixa + 1e5;
  assert.ok(cheio(), `caixa ${sim.holding.caixa()}`);
  assert.equal(sim.progresso.marco().n, 0);
  assert.equal(sim.progresso.liberado('holding.concreteira'), true);
  assert.equal(sim.progresso.liberado('item.vidro'), true);
  // gasta além do caixa de uma partida normal: a próxima rodada devolve o caixa cheio
  sim.holding.pagar(MODO_LIVRE.caixa - 10, 'teste');
  sim.rodar(2, { sincrono: true });
  assert.ok(cheio(), `caixa ${sim.holding.caixa()}`);
  // linha da Holding com o salário pago e a importação sem limite: 1.000 de aço de uma vez
  predioHolding(sim, 'escritorioObra', 0, 0);
  ok(sim.cmd('importar', { item: 'aco', n: 1000 }));
  sim.rodar(60, { sincrono: true });
  assert.equal(sim.json.producao.estoque.aco, 1000);
  assert.equal(sim.q.orcamento().caixaZerado, false);
  // o modo livre não volta ao normal
  assert.equal(sim.cmd('holding.identidade', { nome: 'Held', cor: '#c9a86a', modo: 'normal' }).codigo, 'valor');
  // a partida normal segue com o caixa de sempre e a trava de marco
  const normal = simS3a({ semente: 'normal-s3', populacao: 1500, bemEstar: 55 });
  normal.rodar(40, { sincrono: true });
  assert.ok(normal.holding.caixa() < 1e7);
  assert.equal(normal.progresso.liberado('holding.concreteira'), false);
});

test('Modo livre na cidade inteira: ladrilho sem licença nem preço, Mina sobre o calcário do ladrilho vizinho, sem custo', () => {
  comM1b(() => {
    const sim = criarSimulacao({ semente: 'livre-mina', modo: 'livre' });
    sim.rodar(40, { sincrono: true });
    assert.equal(sim.json.ladrilhos.licencas, 0);
    // o calcário fica no ladrilho (5, 5), colado à área inicial pelo oeste: compra sem licença e sem pagar
    const caixa0 = sim.holding.caixa();
    const r = sim.cmd('ladrilho.comprar', { i: 5, j: 5 });
    ok(r);
    assert.equal(r.dados.valor, 0);
    assert.equal(sim.holding.caixa(), caixa0);
    // acha um lugar para a Mina sobre o calcário, com uma rua ao lado (livre: via sem custo)
    const E = sim.espelho.recursos;
    const [ox, oz] = E.origem;
    const candidatos = [];
    for (let j = 0; j < E.n; j++) {
      for (let i = 0; i < E.n; i++) {
        if (E.calcario[j * E.n + i] >= 100) candidatos.push({ x: ox + (i + 0.5) * E.passo, z: oz + (j + 0.5) * E.passo });
      }
    }
    assert.ok(candidatos.length > 40, 'há calcário no ladrilho (5, 5)');
    let pv = null;
    for (const c of candidatos) {
      const via = sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'rua', pontos: [[c.x - 100, c.z + 60], [c.x + 100, c.z + 60]], sessao: `mina${c.x}${c.z}` } });
      if (!via.ok) continue;
      sim.rodar(40, { sincrono: true });
      const p = sim.q.construir.previa({ tipo: 'mina', x: c.x, z: c.z, rot: 0, aplainar: true });
      if (p.ok) {
        pv = p;
        break;
      }
    }
    assert.ok(pv, 'a Mina cabe sobre o calcário do ladrilho vizinho, de frente para uma rua');
    const m = sim.cmd('construir', { tipo: 'mina', x: pv.x, z: pv.z, rot: pv.rot, aplainar: true });
    ok(m);
    assert.equal(sim.progresso.marco().n, 0, 'no marco 0 e sem licença: o Modo livre libera tudo');
    assert.ok(sim.json.producao.predios.some((e) => e.tipo === 'mina'));
    assert.deepEqual(sim.erros, []);
  });
  // no jogo normal o mesmo pedido volta recusado: sem licença e sem o marco 2
  const normal = criarSimulacao({ semente: 'normal-mina' });
  assert.equal(normal.cmd('ladrilho.comprar', { i: 5, j: 5 }).codigo, 'licenca');
});

// ------------------------------------------------------------------------------------------------ save e determinismo

function comTudo(semente) {
  const { sim } = simComVila(semente);
  fixarCidade(sim, { populacao: 2500, bemEstar: 62, agua: 5000, energia: 4000 });
  sim.custos.registrar('ligacao', () => 1000);
  predioHolding(sim, 'escritorioObra', 0, 0);
  predioHolding(sim, 'mina', 200, 0);
  predioHolding(sim, 'agroindustria', 400, 0);
  porEstoque(sim, 'alimentos', 50);
  sim.agregados.mercadoria = { producao: 200, consumo: 1000, importada: 800, excedente: 0 };
  sim.rodar(tiqueDaData(2022, 2) - sim.tique + 40, { sincrono: true });
  ok(sim.cmd('decisao.escolher', { id: 'energia.2022', opcao: 'solar' }));
  ateMarco(sim, 3);
  ok(sim.cmd('decisao.escolher', { id: 'mina.licenca', opcao: 'acelerar' }));
  assert.ok(abertas(sim).includes('vila.futuro'), 'a da Vila fica pendente no save');
  return sim;
}

test('save e hash cobrem o estado novo: efeitos, marcas, Vila nova e alimentos voltam iguais e seguem iguais', () => {
  comM1b(() => {
    const sim = comTudo('save-s3b');
    sim.rodar(600, { sincrono: true });
    assert.equal(sim.json.historia.eventosM1b[0], 'energia2022');
    // a Vila nova no meio: o save leva o estado da requalificação
    ok(sim.cmd('decisao.escolher', { id: 'vila.futuro', opcao: 'reformar' }));
    sim.rodar(60, { sincrono: true });
    assert.ok(sim.json.historia.vilaNova);
    const nova = comTudo('save-s3b');
    nova.rodar(600, { sincrono: true });
    ok(nova.cmd('decisao.escolher', { id: 'vila.futuro', opcao: 'reformar' }));
    nova.rodar(60, { sincrono: true });
    assert.equal(nova.q.hash(), sim.q.hash(), 'duas partidas iguais dão o mesmo hash (determinismo)');
    // salva e carrega numa simulação nova com a mesma Vila de faz de conta
    const { sim: destino } = simComVila('save-s3b');
    aplicarSave(destino, migrar(lerSave(montarSave(sim))));
    assert.equal(destino.q.hash(), sim.q.hash(), 'o hash do carregado é o do salvo');
    for (const s of [sim, destino]) s.custos.registrar('ligacao', () => 1000);
    sim.rodar(1800, { sincrono: true });
    destino.rodar(1800, { sincrono: true });
    assert.equal(destino.q.hash(), sim.q.hash(), 'e seguem iguais');
    assert.deepEqual(destino.json.historia.efeitos, sim.json.historia.efeitos);
    assert.deepEqual(sim.validar(), []);
  });
});

test('save de antes da S3b (sem eventosM1b, vilaNova e alimentos) carrega e segue', () => {
  const sim = simS3a({ semente: 'save-antigo', populacao: 1500, bemEstar: 55 });
  sim.rodar(200, { sincrono: true });
  delete sim.json.historia.eventosM1b;
  delete sim.json.historia.vilaNova;
  delete sim.json.mercado.alimentos;
  const nova = simS3a({ semente: 'save-antigo' });
  aplicarSave(nova, migrar(lerSave(montarSave(sim))));
  nova.rodar(400, { sincrono: true });
  assert.deepEqual(nova.erros, []);
  assert.deepEqual(nova.json.historia.eventosM1b, []);
  assert.equal(nova.q.producao().alimentos.vendidos, 0);
  assert.equal(nova.q.holding().vilaNova.restantes, 0, 'sem Vila nem prédios no sim só da S3a');
});
