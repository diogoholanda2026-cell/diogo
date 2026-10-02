// Objetivos e história (dona: S3a): 3 objetivos abertos (D58), recompensa e o próximo; "Onde você parou"; as 3
// decisões do Ato 1 no M1a com data no calendário, marca gravada, adiamento, prazo e opção padrão; os choques do
// calendário (Bloqueio do Canal de Seshat); o Mural; e nenhum nome real nos textos da história.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECISOES, EVENTOS, tiqueDaData } from '../../fonte/data/historia.js';
import { OBJETIVOS } from '../../fonte/data/objetivos.js';
import { CONSELHEIROS, EXECUTIVOS, JOGADOR } from '../../fonte/data/nomes.js';
import { condicoesImportacao } from '../../fonte/sim/holding/mercado.js';
import { registrar as registrarTextosS3 } from '../../fonte/ui/textos/s3.js';
import { simS3a, predioHolding, fixarCidade } from '../robo/cidade-faz-de-conta.mjs';

const ok = (r) => assert.equal(r.ok, true, JSON.stringify(r));

test('sempre 3 objetivos abertos, um por domínio; feito dá recompensa e abre o próximo', () => {
  const sim = simS3a({ semente: 'objetivos', populacao: 400, bemEstar: 45 });
  const ev = [];
  sim.on('objetivo', (d) => ev.push(`${d.id}:${d.estado}`));
  let o = sim.q.objetivos();
  assert.deepEqual(o.map((x) => x.dominio), ['cidade', 'holding', 'arcologia']);
  assert.deepEqual(o.map((x) => x.id), ['cidade.avenida', 'holding.escritorio', 'arcologia.lago']);
  for (const x of o) for (const k of ['id', 'texto', 'params', 'paramsChave', 'quem', 'dominio', 'feito', 'total', 'alvo', 'recompensa']) assert.ok(k in x, k);
  assert.deepEqual(sim.q.barra().objetivos.map((x) => x.id), o.map((x) => x.id));
  // o Escritório de Obra conclui o primeiro da Holding (XP 20) e abre "Pedreira e Areal"
  predioHolding(sim, 'escritorioObra', 0, 0);
  sim.rodar(20, { sincrono: true });
  o = sim.q.objetivos();
  assert.equal(o[1].id, 'holding.pedreiraAreal');
  assert.equal(sim.json.progresso.motivos.objetivos, 20);
  assert.ok(ev.includes('holding.escritorio:feito') && ev.includes('holding.pedreiraAreal:aberto'));
  // contínuo: nunca fica sem objetivo, mesmo no fim das listas
  for (let k = 0; k < 30; k++) {
    sim.rodar(200, { sincrono: true });
    assert.equal(sim.q.objetivos().length, 3);
  }
  assert.ok(OBJETIVOS.filter((x) => x.total === undefined).length >= 3, 'um contínuo por domínio');
});

test('q.retomar: o objetivo menos adiantado e o problema mais grave', () => {
  const sim = simS3a({ semente: 'retomar', populacao: 300, bemEstar: 40 });
  sim.custos.registrar('servicos.teste', () => 90000);
  sim.holding.pagar(sim.holding.caixa() - 10, 'teste');
  sim.rodar(40, { sincrono: true });
  const r = sim.q.retomar();
  assert.ok(r.objetivo && r.objetivo.id);
  assert.equal(r.problema.codigo, 'caixaZerado');
  assert.equal(r.desde, 0);
});

test('vila.agua no marco 0 (minuto 3): marca gravada, Legado, objetivo da captação na frente; adiar uma vez', () => {
  const sim = simS3a({ semente: 'vila', populacao: 350, bemEstar: 25 });
  const abertas = [];
  sim.on('decisao', (d) => abertas.push(d.id));
  sim.rodar(170, { sincrono: true });
  assert.equal(sim.q.decisoes().length, 0);
  sim.rodar(40, { sincrono: true });
  const d = sim.q.decisoes();
  assert.deepEqual(d.map((x) => x.id), ['vila.agua']);
  assert.deepEqual(abertas, ['vila.agua']);
  assert.deepEqual(d[0].quem, ['cida', 'tome']);
  assert.deepEqual([d[0].data.ano, d[0].data.mes], [2020, 1]);
  assert.deepEqual(d[0].opcoes.map((o) => o.id), ['captacao', 'reservatorio']);
  assert.equal(sim.q.barra().decisoesPendentes, 1);
  // adiar uma vez só
  const prazo = d[0].prazo;
  ok(sim.cmd('decisao.adiar', { id: 'vila.agua' }));
  assert.equal(sim.q.decisoes()[0].prazo, prazo + 600);
  assert.equal(sim.cmd('decisao.adiar', { id: 'vila.agua' }).codigo, 'prazo');
  assert.equal(sim.cmd('decisao.escolher', { id: 'vila.agua', opcao: 'nenhuma' }).codigo, 'inexistente');
  assert.equal(sim.cmd('decisao.escolher', { id: 'inventada', opcao: 'x' }).codigo, 'inexistente');
  ok(sim.cmd('decisao.escolher', { id: 'vila.agua', opcao: 'captacao' }));
  assert.equal(sim.q.holding().legado, 5);
  assert.deepEqual(sim.json.historia.marcas, ['vila.agua:captacao']);
  assert.equal(sim.cmd('decisao.escolher', { id: 'vila.agua', opcao: 'reservatorio' }).codigo, 'prazo');
  assert.equal(sim.q.objetivos()[0].id, 'cidade.captacao');
  assert.ok(sim.q.mural().some((p) => p.texto === 's3.mural.decisao.vila.agua.captacao' && p.autor === 'cida'));
  assert.equal(sim.q.decisoes({ historico: true })[0].opcao, 'captacao');
});

test('Febre Aurora (mar. 2020): abre com o evento; comprar custa 40 mil, dá licença e Influência; prazo vence com a padrão', () => {
  assert.equal(tiqueDaData(2020, 3), 1200);
  const sim = simS3a({ semente: 'aurora', populacao: 1000, bemEstar: 50 });
  sim.rodar(1220, { sincrono: true });
  assert.ok(sim.q.decisoes().some((x) => x.id === 'febre.aurora'));
  assert.ok(sim.q.mural().some((p) => p.texto === 's3.mural.evento.febreAurora'));
  // sem caixa, comprar é recusado
  const caixa = sim.holding.caixa();
  sim.holding.pagar(caixa - 30000, 'teste');
  assert.equal(sim.cmd('decisao.escolher', { id: 'febre.aurora', opcao: 'comprar' }).codigo, 'creditos');
  sim.holding.receber(caixa, 'teste');
  const c0 = sim.holding.caixa();
  ok(sim.cmd('decisao.escolher', { id: 'febre.aurora', opcao: 'comprar' }));
  assert.equal(c0 - sim.holding.caixa(), 40000);
  assert.equal(sim.q.holding().influencia, 8);
  assert.equal(sim.economia.efeitos('produtividade').length, 1);
  // a outra decisão (vila.agua) vence o prazo e fica com a padrão
  sim.rodar(1800, { sincrono: true });
  const h = sim.q.decisoes({ historico: true });
  assert.ok(h.some((x) => x.id === 'vila.agua' && x.opcao === 'captacao' && x.auto));
  // proteger põe o efeito de bem-estar na Vila para a S2a ler
  const b = simS3a({ semente: 'aurora2', populacao: 1000, bemEstar: 50 });
  b.rodar(1220, { sincrono: true });
  ok(b.cmd('decisao.escolher', { id: 'febre.aurora', opcao: 'proteger' }));
  assert.deepEqual(b.economia.efeitos('bemArea').map((e) => [e.area, e.v]), [['vila', 4]]);
  assert.equal(b.q.holding().legado, 8);
});

test('Bloqueio do Canal de Seshat (mar. 2021): importação a 200% e lenta por 6 meses; navios próprios anulam', () => {
  const sim = simS3a({ semente: 'seshat', populacao: 1000, bemEstar: 50 });
  sim.rodar(tiqueDaData(2021, 3) + 20, { sincrono: true });
  assert.ok(sim.q.decisoes().some((x) => x.id === 'canal.seshat'));
  let c = condicoesImportacao(sim);
  assert.ok(Math.abs(c.fator - 2) < 1e-9);
  assert.equal(c.entregaTiques, 120);
  ok(sim.cmd('decisao.escolher', { id: 'canal.seshat', opcao: 'navios' }));
  c = condicoesImportacao(sim);
  assert.deepEqual([c.fator, c.entregaTiques], [1.6, 40]);
  const b = simS3a({ semente: 'seshat2', populacao: 1000, bemEstar: 50 });
  b.rodar(tiqueDaData(2021, 3) + 20, { sincrono: true });
  ok(b.cmd('decisao.escolher', { id: 'canal.seshat', opcao: 'local' }));
  assert.ok(Math.abs(condicoesImportacao(b).fator - 2) < 1e-9);
  b.rodar(6 * 600, { sincrono: true });
  assert.equal(condicoesImportacao(b).fator, 1.6, 'o choque acaba em 6 meses');
});

test('dados da história: 3 decisões com data, opções e padrão; textos de toda chave; nenhum nome real', () => {
  assert.equal(DECISOES.length, 3);
  const textos = {};
  registrarTextosS3((parcela, mapa) => Object.assign(textos, mapa));
  const chaves = [];
  for (const d of DECISOES) {
    assert.ok(d.opcoes.some((o) => o.id === d.padrao), d.id);
    assert.ok(d.opcoes.every((o) => (o.influencia > 0) !== (o.legado > 0)), `${d.id}: cada opção puxa um medidor`);
    chaves.push(`s3.decisao.${d.id}.titulo`, `s3.decisao.${d.id}.texto`);
    for (const o of d.opcoes) chaves.push(`s3.decisao.${d.id}.${o.id}`, `s3.decisao.${d.id}.${o.id}.ganho`, `s3.decisao.${d.id}.${o.id}.custo`, `s3.mural.decisao.${d.id}.${o.id}`);
  }
  for (const e of EVENTOS) if (e.mural) chaves.push(e.mural.chave);
  for (const o of OBJETIVOS) chaves.push(`s3.objetivo.${o.id}`);
  for (const c of chaves) assert.ok(textos[c], `falta o texto ${c}`);
  assert.equal(JOGADOR.nome, 'Diogo Holanda');
  assert.deepEqual(Object.values(CONSELHEIROS).map((c) => c.nome), ['Íris Valverde', 'Tomé Carvalho', 'Nara Guimarães', 'Caio Montenegro', 'Dona Cida (Aparecida Moura)', 'Lívia Andrade']);
  assert.equal(EXECUTIVOS.length, 20);
  // proposta de palavras proibidas para a guarda de texto (nomes reais de empresa, país, doença ou pessoa)
  const PROIBIDAS = /\b(google|alphabet|swift|covid|corona|sars|wuhan|suez|ever given|ucr[aâ]nia|r[uú]ssia|crimeia|putin|trump|biden|obama|china|chin[eê]s|estados unidos|eua|brasil|tail[aâ]ndia|nvidia|openai|chatgpt|microsoft|apple|amazon|lehman|silicon valley bank|svb)\b/i;
  const ruins = Object.entries(textos).filter(([, v]) => PROIBIDAS.test(v)).map(([k]) => k);
  assert.deepEqual(ruins, []);
});
