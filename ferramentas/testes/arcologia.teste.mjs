// Arcologia jogável (dona: X1b; D26, D49, D51, D59, D88 a D90): a cadeia de etapas com marco e códigos, as entregas
// pela frota, os efeitos da D49 etapa a etapa, a cava do Mirror Lake como forma do aplainar, os portões nas 8 avenidas
// (com a via da cidade que chegou antes), o requisito do marco 7, salvar no meio da obra e o robô que pula a Arcologia
// terminando mais pobre (A2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { componentes, noPerto } from '../../fonte/sim/vias/grafo.js';
import { ETAPA, ARESTA } from '../../fonte/contratos/flags.js';
import { ETAPAS, ETAPAS_M2, EQUIPES_OBRA, etapaDe, dependenciasAbertas, alturaBlade, alturaLegacy, avancoLegacy, ALTURA_PONTE } from '../../fonte/data/arcologia.js';
import { PLANOS, PLANO_ESCOLHIDO, GLEBA_ENVELOPE, LAGO, SEDE_CENTRO, TORRE_LAMINA, TORRE_IRMA, cavaDoPlano } from '../../fonte/data/arcologia-plano.js';
import { REF_CAVA } from '../../fonte/sim/arcologia.js';
import { contribuicaoHora } from '../../fonte/sim/economia.js';
import { REGRAS_DONO } from '../../fonte/data/economia.js';
import { MARCOS } from '../../fonte/data/marcos.js';
import { criarEstrategia } from '../robo/robo-sim.mjs';

const ok = (r) => assert.equal(r.ok, true, JSON.stringify(r));
const LIMIARES = MARCOS.map((m) => m.xp);
const plano = PLANOS[PLANO_ESCOLHIDO];

/** XP até o marco n (o sistema de progresso alcança na rodada). */
function ateMarco(sim, n) {
  sim.progresso.xp(Math.max(0, LIMIARES[n] - sim.json.progresso.xp), 'teste');
  sim.rodar(20, { sincrono: true });
  assert.ok(sim.progresso.marco().n >= Math.min(n, 6), `marco ${sim.progresso.marco().n}`);
}

/** Põe no estoque da Holding o que a etapa pede. */
function abastecer(sim, id) {
  for (const [item, n] of Object.entries(etapaDe(id).materiais)) sim.json.producao.estoque[item] = (sim.json.producao.estoque[item] ?? 0) + n;
}

/** Roda até a etapa ficar pronta (ou o limite); devolve os tiques. */
function ateFicarPronta(sim, id, limite = 4000) {
  let t = 0;
  while (sim.q.arcologia().partes.flatMap((p) => p.etapas).find((e) => e.id === id).estado !== ETAPA.PRONTA && t < limite) {
    sim.rodar(20, { sincrono: true });
    t += 20;
  }
  return t;
}

const etapa = (sim, id) => sim.q.arcologia().partes.flatMap((p) => p.etapas).find((e) => e.id === id);
const arestasArcologia = (sim) => {
  const A = sim.tabelas.arestas;
  const l = [];
  for (let e = 0; e < A.n; e++) if (A.viva[e] && A.flags[e] & ARESTA.ARCOLOGIA) l.push(e);
  return l;
};

test('etapas: a cadeia do M1a, os marcos e os códigos de arcologia.iniciar; o M2 fica só em dados', () => {
  const sim = criarSimulacao({ semente: 'arco-cadeia' });
  const a = sim.q.arcologia();
  assert.equal(a.plano, 'A');
  assert.equal(a.nome, 'Park of Future Dreams');
  assert.deepEqual(a.partes.map((p) => p.id), ['torre', 'lago', 'meridian', 'horizon', 'codex', 'helix', 'compass', 'parque']);
  assert.equal(a.partes[0].nome, 'Blade Tower and Legacy Tower');
  assert.equal(a.partes[1].nome, 'Mirror Lake');
  assert.deepEqual(sim.espelho.arcologia.etapas.map((e) => e.id), ['lago.e1', 'torre.e1', 'torre.e2', 'torre.e3', 'torre.e4']);
  assert.equal(etapa(sim, 'lago.e1').estado, ETAPA.DISPONIVEL, 'lago.e1 no marco 0');
  assert.equal(etapa(sim, 'torre.e1').estado, ETAPA.TRANCADA);
  // códigos
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'torre.e1' }).codigo, 'marco');
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'inventada' }).codigo, 'valor');
  assert.equal(sim.cmd('arcologia.iniciar', {}).codigo, 'valor');
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'meridian.e1' }).codigo, 'trancado', 'o M2 não joga no M1a');
  ateMarco(sim, 3);
  // D98: a fundação da torre não depende do lago no chão (as duas andam juntas); a torre.e2 espera a e1 pronta
  sim.rodar(40, { sincrono: true });
  assert.equal(etapa(sim, 'torre.e1').estado, ETAPA.DISPONIVEL);
  assert.equal(etapa(sim, 'torre.e1').recusa, null);
  assert.deepEqual(etapa(sim, 'torre.e2').depende, ['torre.e1']);
  assert.equal(etapa(sim, 'torre.e2').requisito, 'torre.e1');
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'torre.e2' }).codigo, 'marco', 'a torre.e2 abre no marco 4');
  // sem caixa: recusa e não muda nada
  const caixa = sim.holding.caixa();
  sim.holding.pagar(caixa, 'teste');
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }).codigo, 'creditos');
  assert.equal(etapa(sim, 'lago.e1').estado, ETAPA.DISPONIVEL);
  sim.holding.receber(caixa, 'teste');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  assert.equal(sim.holding.caixa(), caixa - etapaDe('lago.e1').creditos);
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }).codigo, 'emObra');
  // o M2 (D89): Meridian Ring, as três torres, o parque e os 8 trechos do Horizon Ring, com o prazo da história
  const fut = sim.q.arcologia().partes.flatMap((p) => p.futuras);
  assert.equal(fut.length, ETAPAS_M2.length);
  assert.equal(fut.filter((f) => f.prazo.ano === 2026).length, 8, 'o Meridian, as torres, o parque e 2 trechos até jun. 2026');
  assert.equal(fut.filter((f) => f.id.startsWith('horizon.') && f.prazo.ano === 2032).length, 6);
  assert.deepEqual(sim.erros, []);
});

test('obra: sem material o trabalho para; os caminhões levam o estoque; a data da etapa no calendário', () => {
  const sim = criarSimulacao({ semente: 'arco-obra' });
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  sim.rodar(200, { sincrono: true });
  let e = etapa(sim, 'lago.e1');
  assert.equal(e.progresso, 0, 'sem brita nem areia a obra não anda');
  assert.equal(e.parada, 'material');
  assert.equal(e.ini.ano, 2020);
  assert.equal(e.ini.mes, 1);
  abastecer(sim, 'lago.e1');
  sim.rodar(40, { sincrono: true });
  e = etapa(sim, 'lago.e1');
  assert.ok(e.materiais.every((m) => m.aCaminho + m.entregue === m.pede), 'os pedidos saem do armazém');
  assert.equal(sim.holding.estoque('brita'), 0, 'o estoque sai no pedido (D47)');
  assert.ok(sim.q.producao().frota.usados > 0, 'a frota leva');
  const t = ateFicarPronta(sim, 'lago.e1');
  e = etapa(sim, 'lago.e1');
  assert.equal(e.estado, ETAPA.PRONTA, `pronta em ${t} tiques`);
  assert.ok(e.fim.tique > e.ini.tique);
  assert.ok(sim.json.progresso.motivos.arcologia >= 300, 'XP da etapa (300)');
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('efeitos da D49: vias e água, licença, sede operacional, moradores de luxo e demanda, Legado e o marco 7', () => {
  const sim = criarSimulacao({ semente: 'arco-efeitos' });
  sim.holding.receber(2000000, 'teste');
  // lago.e1: as vias internas no grafo com a flag ARCOLOGIA, o reservatório na rede e o valor em volta
  abastecer(sim, 'lago.e1');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  ateFicarPronta(sim, 'lago.e1');
  assert.equal(arestasArcologia(sim).length, plano.vias.length, 'o anel, os portões e as radiais');
  const agua = sim.redes.produtores('agua').find((p) => p.ref === 'lago.e1');
  assert.ok(agua && agua.capacidade === 36, 'o reservatório dá água a 6 mil moradores (a captação dá 30 a 5 mil)');
  assert.ok(sim.json.cidade.efeitos['arcologia.lago.e1.valor']?.valor > 0, 'valor do terreno em volta');
  // torre.e1: uma licença de ladrilho
  ateMarco(sim, 3);
  const lic = sim.json.ladrilhos.licencas;
  abastecer(sim, 'torre.e1');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'torre.e1' }));
  ateFicarPronta(sim, 'torre.e1');
  assert.equal(sim.json.ladrilhos.licencas, lic + 1);
  // torre.e2: +15% nas linhas, +6 caminhões, 1.200 vagas nos níveis 2 e 3 (a Holding contrata primeiro)
  ateMarco(sim, 4);
  const frota = sim.q.producao().frota.total;
  const ocup = sim.holding.ocupados();
  abastecer(sim, 'torre.e2');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'torre.e2' }));
  ateFicarPronta(sim, 'torre.e2');
  assert.deepEqual(sim.json.holding.efeitos['torre.e2'], { produtividade: 0.15, caminhoes: 6 });
  assert.equal(sim.q.producao().frota.total, frota + 6);
  const ocup2 = sim.holding.ocupados();
  assert.deepEqual([ocup2[2] - ocup[2], ocup2[3] - ocup[3]], [600, 600]);
  // torre.e3: 400 moradores de luxo pagam a Contribuição e a residencial média ganha demanda em 1,5 km
  ateMarco(sim, 5);
  abastecer(sim, 'torre.e3');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'torre.e3' }));
  ateFicarPronta(sim, 'torre.e3');
  const ef = sim.json.cidade.efeitos['arcologia.torre.e3.demanda'];
  assert.deepEqual([ef.raio, ef.demanda.resMedia], [1500, 20]);
  const a3 = sim.q.arcologia();
  assert.equal(a3.efeitos.moradoresLuxo, 400);
  assert.equal(a3.efeitos.contribuicaoLuxoHora, 400 * 11, 'faixa de 11 (bem-estar de luxo)');
  // a Contribuição deles entra com a dos moradores (receita 'moradores' e saldo por hora), não em 'outras'
  const cidadeHora = () => contribuicaoHora(REGRAS_DONO, sim.agregados);
  assert.ok(Math.abs(sim.q.orcamento().receitas.moradores - cidadeHora() - 4400) < 1e-6, 'q.orcamento soma os 4.400 por hora');
  const outras = sim.json.economia.livro.totais.receitas.outras ?? 0;
  let esperado = 0;
  const antes = sim.json.economia.livro.totais.receitas.moradores ?? 0;
  for (let t = 0; t < 360; t++) {
    esperado += (cidadeHora() + 4400) / 3600;
    sim.rodar(1, { sincrono: true });
  }
  const depois = sim.json.economia.livro.totais.receitas.moradores ?? 0;
  assert.ok(Math.abs(depois - antes - esperado) < 1, `em 0,1 h entram ${esperado.toFixed(2)} (${(depois - antes).toFixed(2)})`);
  assert.equal(sim.json.economia.livro.totais.receitas.outras ?? 0, outras, 'nada em outras');
  // torre.e4: Legado +5, atratividade, valor em 1,5 km; o marco 7 só com ela pronta
  ateMarco(sim, 6);
  sim.progresso.xp(LIMIARES[7] - sim.json.progresso.xp + 10, 'teste');
  sim.rodar(40, { sincrono: true });
  assert.equal(sim.progresso.marco().n, 6, 'sem a Torre pronta o marco 7 espera');
  const legado = sim.q.holding().legado;
  abastecer(sim, 'torre.e4');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'torre.e4' }));
  ateFicarPronta(sim, 'torre.e4');
  sim.rodar(40, { sincrono: true });
  assert.equal(sim.q.holding().legado, legado + 5);
  assert.equal(sim.json.cidade.efeitos['arcologia.torre.e4.atratividade'].atratividade, 5);
  assert.deepEqual([sim.json.cidade.efeitos['arcologia.torre.e4.valor'].raio > 0, sim.json.cidade.efeitos['arcologia.torre.e4.valor'].raio], [true, 1500], 'valor em 1,5 km (D49)');
  assert.equal(sim.progresso.marco().n, 7, 'Arcologia inaugurada em fase inicial');
  const a4 = sim.q.arcologia();
  assert.equal(a4.inaugurada, true);
  assert.equal(a4.progressoTotal, 1);
  assert.ok(a4.valor >= ETAPAS.reduce((s, e) => s + e.creditos, 0), 'o valor da obra conta os créditos pagos');
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('a cava do Mirror Lake é forma do aplainar desde o começo da lago.e1', () => {
  const sim = criarSimulacao({ semente: 'arco-cava' });
  const res = plano.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  const [ax, az] = [res.cx, res.cz + (res.r0 + res.r1) / 2];
  const antes = sim.alturaEm(ax, az);
  assert.ok(Math.abs(antes - GLEBA_ENVELOPE.cota) < 0.5, `o platô plano antes (${antes})`);
  assert.equal(sim.formas.lista().filter((f) => f.tipo === 'cava').length, 0);
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  const cavas = sim.formas.lista().filter((f) => f.tipo === 'cava');
  assert.equal(cavas.length, 1);
  const esperada = cavaDoPlano(PLANO_ESCOLHIDO, GLEBA_ENVELOPE.cota, REF_CAVA);
  assert.equal(cavas[0].ref, REF_CAVA);
  assert.equal(cavas[0].cota, esperada.cota);
  assert.deepEqual(Array.from(cavas[0].contorno), esperada.contorno);
  const fundo = sim.alturaEm(ax, az);
  assert.ok(fundo < GLEBA_ENVELOPE.cota + LAGO.nivel - 0.5, `o leito fica abaixo da água (${fundo})`);
  // o pódio no meio fica na cota da gleba
  assert.ok(Math.abs(sim.alturaEm(SEDE_CENTRO[0], SEDE_CENTRO[1]) - GLEBA_ENVELOPE.cota) < 0.5);
  // salvar e carregar refaz o chão com a cava
  const C = criarSimulacao({ semente: 'arco-cava' });
  aplicarSave(C, migrar(lerSave(montarSave(sim))));
  assert.ok(Math.abs(C.alturaEm(ax, az) - fundo) < 1e-6);
  assert.equal(C.q.hash(), sim.q.hash());
});

test('portões nas 8 avenidas: a via da cidade que chegou ao portão norte antes do lago fica ligada ao centro', () => {
  const sim = criarSimulacao({ semente: 'arco-portoes' });
  const norte = plano.portoes.find((p) => p.id === 'norte');
  const pv = sim.q.via.previa({ modo: 'reta', tipo: 'avenida', pontos: [[200, -720], [norte.x, norte.z]] });
  assert.equal(pv.ok, true, JSON.stringify(pv.erros ?? pv.codigo));
  ok(sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'avenida', pontos: [[200, -720], [norte.x, norte.z]], sessao: 't.1' } }));
  const G = sim.grafo;
  const noNorte = noPerto(G, norte.x, norte.z, 1.5);
  assert.ok(noNorte >= 0, 'a via da cidade termina no portão');
  abastecer(sim, 'lago.e1');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  ateFicarPronta(sim, 'lago.e1');
  assert.equal(noPerto(G, norte.x, norte.z, 1.5), noNorte, 'o mesmo nó (não nasce outro no portão)');
  // cada portão tem o seu nó com a avenida interna, na borda da gleba
  for (const p of plano.portoes) {
    const n = noPerto(G, p.x, p.z, 1.5);
    assert.ok(n >= 0, `portão ${p.id}`);
    let arco = 0;
    for (let k = 0; k < 6; k++) {
      const e = G.nos.lig[6 * n + k];
      if (e >= 0 && G.arestas.viva[e] && G.arestas.flags[e] & ARESTA.ARCOLOGIA) arco++;
    }
    assert.equal(arco, 1, `portão ${p.id}: uma avenida interna`);
    assert.ok(Math.abs(Math.hypot(p.x - SEDE_CENTRO[0], p.z - SEDE_CENTRO[1]) - GLEBA_ENVELOPE.raio) < 1);
  }
  assert.equal(G.nos.grau[noNorte], 2, 'no portão norte: a via da cidade e a avenida interna');
  // a cidade chega à praça do pódio pelas vias internas
  const { comp } = componentes(G);
  const radial = plano.vias.find((v) => v.radial);
  const praca = noPerto(G, radial.pontos[2], radial.pontos[3], 1.5);
  const fora = noPerto(G, 200, -720, 2);
  assert.ok(praca >= 0 && fora >= 0);
  assert.equal(comp[praca], comp[fora]);
  // cada via vai pelo próprio traçado: o portão até o anel (17 m), a radial até a praça e o arco de 45 graus
  const A = G.arestas;
  let total = 0;
  for (const e of arestasArcologia(sim)) {
    total += A.comp[e];
    assert.ok(A.comp[e] < 700, `via interna de ${Math.round(A.comp[e])} m (corda atravessando a sede?)`);
  }
  for (const p of plano.portoes) {
    const n = noPerto(G, p.x, p.z, 1.5);
    for (let k = 0; k < 6; k++) {
      const e = G.nos.lig[6 * n + k];
      if (e >= 0 && A.viva[e] && A.flags[e] & ARESTA.ARCOLOGIA) assert.ok(A.comp[e] < 30, `portão ${p.id}: ${Math.round(A.comp[e])} m até o anel`);
    }
  }
  assert.ok(Math.abs(total - 10300) < 300, `as 24 vias internas somam ${Math.round(total)} m`);
  // o jogador não demole a via interna
  const e = arestasArcologia(sim)[0];
  assert.equal(sim.cmd('via.demolir', { arestas: [G.arestas.ref(e)] }).codigo, 'arcologia');
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('a obra do par: a Legacy um passo atrás, a Dream Bridge quando as duas passam de 330 m, a grua até uns 540 m', () => {
  // as duas sobem juntas no pódio (torre.e1) e a Legacy fica um quarto de etapa atrás no corpo
  assert.equal(alturaBlade(1), alturaLegacy(1));
  assert.ok(alturaLegacy(2.5) < alturaBlade(2.5));
  assert.equal(avancoLegacy(4), 4, 'as duas ficam prontas juntas');
  assert.equal(alturaBlade(4), TORRE_LAMINA.mastro.topo);
  assert.equal(alturaLegacy(4), TORRE_IRMA.altura);
  // a ponte (330 m) só depois de as duas passarem dela, e nunca antes de a Blade passar
  let ponte = -1;
  for (let g = 0; g <= 4; g += 0.01) {
    if (Math.min(alturaBlade(g), alturaLegacy(g)) >= ALTURA_PONTE) {
      ponte = g;
      break;
    }
  }
  assert.ok(ponte > 2 && ponte < 4, `a ponte entra no avanço ${ponte.toFixed(2)}`);
  assert.ok(alturaBlade(ponte) > 330 && alturaLegacy(ponte) > 330);
  // monotonia: a obra nunca desce
  let hb = 0;
  let hl = 0;
  for (let g = 0; g <= 4; g += 0.005) {
    assert.ok(alturaBlade(g) >= hb - 1e-9 && alturaLegacy(g) >= hl - 1e-9);
    hb = alturaBlade(g);
    hl = alturaLegacy(g);
  }
});

test('salvar no meio da obra e carregar segue igual (entregas a caminho, trabalho e efeitos)', () => {
  const A = criarSimulacao({ semente: 'arco-save' });
  abastecer(A, 'lago.e1');
  ok(A.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  A.rodar(80, { sincrono: true });
  const C = criarSimulacao({ semente: 'arco-save' });
  aplicarSave(C, migrar(lerSave(montarSave(A))));
  assert.equal(C.q.hash(), A.q.hash());
  assert.deepEqual(C.espelho.arcologia, A.espelho.arcologia);
  ateFicarPronta(A, 'lago.e1');
  ateFicarPronta(C, 'lago.e1');
  assert.equal(C.tique, A.tique, 'pronta no mesmo tique');
  A.rodar(100, { sincrono: true });
  C.rodar(100, { sincrono: true });
  assert.equal(C.q.hash(), A.q.hash(), 'as entregas que estavam a caminho chegam na carregada (o tratador pelo nome)');
  assert.equal(arestasArcologia(C).length, plano.vias.length);
  assert.deepEqual(C.erros, []);
});

test('save mais velho: a seção sem uma etapa nem os avisos de altura carrega completa e o jogo segue', () => {
  const A = criarSimulacao({ semente: 'arco-save-velho' });
  abastecer(A, 'lago.e1');
  ok(A.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  A.rodar(60, { sincrono: true });
  // como um save de antes de a etapa existir nos dados
  delete A.json.arcologia.etapas['torre.e4'];
  delete A.json.arcologia.marcos;
  delete A.json.arcologia.efeitos.luxo;
  const C = criarSimulacao({ semente: 'arco-save-velho' });
  aplicarSave(C, migrar(lerSave(montarSave(A))));
  assert.equal(C.json.arcologia.etapas['torre.e4'].estado, ETAPA.TRANCADA);
  assert.deepEqual(C.json.arcologia.marcos, []);
  assert.equal(C.json.arcologia.efeitos.luxo, 0);
  assert.equal(C.espelho.arcologia.etapas.length, ETAPAS.length);
  assert.equal(ateFicarPronta(C, 'lago.e1') < 4000, true);
  assert.deepEqual(C.validar(), []);
  assert.deepEqual(C.erros, []);
});

// C1a: na cidade viva da S2a (a de faz de conta era a ponte enquanto a S2a não publicava; com ela o reservatório do
// Mirror Lake e os efeitos da torre não chegavam a moradores de verdade)
test('A2: o robô que pula a Arcologia termina mais pobre (cidade da S2a, 6 h de jogo, 6 sementes)', () => {
  // D92: uma semente só oscila uns 0,2 na razão da Contribuição; o critério é a média de 6 sementes, e a riqueza em todas
  const jogar = (semente, pular) => {
    const sim = criarSimulacao({ semente });
    if (pular) {
      const cmd = sim.cmd.bind(sim);
      sim.cmd = (n, a) => (n === 'arcologia.iniciar' ? { ok: false, codigo: 'trancado' } : cmd(n, a));
    }
    const est = criarEstrategia(sim, {});
    for (let t = 0; t < 6 * 3600; t++) {
      if (t % 20 === 0) est.passo();
      sim.rodar(1, { sincrono: true });
    }
    assert.deepEqual(sim.erros, []);
    // patrimônio: o valuation (caixa, dívida, prédios, estoque e, pela D49, o valor da obra da Arcologia)
    return {
      riqueza: sim.q.holding().valuation,
      contribuicao: sim.json.economia.livro.totais.receitas.moradores ?? 0,
      populacao: sim.agregados.populacao,
      marco: sim.progresso.marco().n,
      etapas: sim.espelho.arcologia.etapas.filter((e) => e.estado === ETAPA.PRONTA).length,
    };
  };
  const SEMENTES = ['robo-arco', 'robo-1', 'semente-a', 'semente-b', 'semente-c', 'semente-d'];
  let razaoC = 0;
  let razaoP = 0;
  let marcoCom = 0;
  let marcoSem = 0;
  for (const semente of SEMENTES) {
    const com = jogar(semente, false);
    const sem = jogar(semente, true);
    assert.ok(com.etapas >= 1, `${semente}: o robô fez a Arcologia`);
    assert.equal(sem.etapas, 0);
    assert.ok(com.riqueza > sem.riqueza, `${semente}: riqueza com a Arcologia ${Math.round(com.riqueza)}, sem ${Math.round(sem.riqueza)}`);
    razaoC += com.contribuicao / Math.max(1, sem.contribuicao) / SEMENTES.length;
    razaoP += com.populacao / Math.max(1, sem.populacao) / SEMENTES.length;
    marcoCom += com.marco;
    marcoSem += sem.marco;
  }
  // a obra não vale só no papel (o valor dela conta o que foi pago): a cidade rende mais e cresce mais com as etapas (o
  // reservatório, o XP e os marcos que elas adiantam), então o patrimônio a mais não é o próprio gasto devolvido
  assert.ok(razaoC >= 1.05, `Contribuição com / sem, média de ${SEMENTES.length} sementes: ${razaoC.toFixed(3)}`);
  assert.ok(razaoP >= 1.05, `moradores com / sem, média de ${SEMENTES.length} sementes: ${razaoP.toFixed(3)}`);
  assert.ok(marcoCom >= marcoSem, `marcos somados com ${marcoCom}, sem ${marcoSem}`);
});

// ------------------------------------------------------------------------------------------------ obras em paralelo (D98)

test('paralelo (D98): o lago e a fundação da torre andam juntos; a torre sobe uma etapa de cada vez; as equipes limitam', () => {
  const sim = criarSimulacao({ semente: 'arco-paralelo' });
  ateMarco(sim, 4);
  abastecer(sim, 'lago.e1');
  abastecer(sim, 'torre.e1');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  // a segunda obra começa com a primeira em andamento: ninguém prende ninguém
  ok(sim.cmd('arcologia.iniciar', { etapa: 'torre.e1' }));
  assert.deepEqual(sim.q.arcologia().equipes, { total: EQUIPES_OBRA, ocupadas: 2 });
  assert.deepEqual(etapa(sim, 'lago.e1').emParalelo, ['torre.e1']);
  assert.deepEqual(etapa(sim, 'torre.e1').emParalelo, ['lago.e1']);
  // a torre.e2 pede a e1 pronta: a ordem física vale onde a obra depende da outra
  assert.equal(etapa(sim, 'torre.e2').recusa, 'trancado');
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'torre.e2' }).codigo, 'trancado');
  // as duas andam no mesmo tique, cada uma com os materiais dela e o progresso do total soma as duas
  let juntas = false;
  for (let t = 0; t < 600 && !juntas; t += 20) {
    sim.rodar(20, { sincrono: true });
    juntas = etapa(sim, 'lago.e1').progresso > 0 && etapa(sim, 'torre.e1').progresso > 0 && etapa(sim, 'lago.e1').estado === ETAPA.EM_OBRA && etapa(sim, 'torre.e1').estado === ETAPA.EM_OBRA;
  }
  assert.ok(juntas, 'as duas etapas em obra progridem juntas');
  const a = sim.q.arcologia();
  const soma = (etapa(sim, 'lago.e1').progresso + etapa(sim, 'torre.e1').progresso) / ETAPAS.length;
  assert.ok(Math.abs(a.progressoTotal - soma) < 1e-9, `progresso total ${a.progressoTotal} contra ${soma}`);
  // save no meio das duas obras: o hash e o fim das duas batem
  const C = criarSimulacao({ semente: 'arco-paralelo' });
  aplicarSave(C, migrar(lerSave(montarSave(sim))));
  assert.equal(C.q.hash(), sim.q.hash());
  assert.deepEqual(C.q.arcologia().equipes, { total: EQUIPES_OBRA, ocupadas: 2 });
  ateFicarPronta(sim, 'torre.e1');
  ateFicarPronta(C, 'torre.e1');
  assert.equal(C.tique, sim.tique);
  assert.equal(C.q.hash(), sim.q.hash());
  // pronta a e1, a e2 abre (sem esperar o lago): o estado dela vira disponível e o comando aceita
  sim.rodar(40, { sincrono: true });
  assert.equal(etapa(sim, 'torre.e2').estado, ETAPA.DISPONIVEL);
  assert.equal(etapa(sim, 'torre.e2').recusa, null);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(sim.erros, []);
});

test('paralelo (D98): as equipes de obra limitam as etapas ao mesmo tempo, com a recusa ocupado e sem trancar', () => {
  const sim = criarSimulacao({ semente: 'arco-equipes' });
  ateMarco(sim, 3);
  sim.json.arcologia.equipes = 1; // uma equipe só (uma decisão do Conselho pode mudar, e vai no save)
  abastecer(sim, 'lago.e1');
  abastecer(sim, 'torre.e1');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'lago.e1' }));
  assert.deepEqual(sim.q.arcologia().equipes, { total: 1, ocupadas: 1 });
  assert.equal(etapa(sim, 'torre.e1').recusa, 'ocupado');
  const caixa = sim.holding.caixa();
  assert.equal(sim.cmd('arcologia.iniciar', { etapa: 'torre.e1' }).codigo, 'ocupado');
  assert.equal(sim.holding.caixa(), caixa, 'recusa sem cobrar');
  sim.rodar(40, { sincrono: true });
  assert.equal(etapa(sim, 'torre.e1').estado, ETAPA.DISPONIVEL, 'ocupado não tranca: segue disponível, esperando uma equipe');
  ateFicarPronta(sim, 'lago.e1');
  sim.rodar(40, { sincrono: true });
  assert.equal(etapa(sim, 'torre.e1').recusa, null, 'a equipe voltou');
  ok(sim.cmd('arcologia.iniciar', { etapa: 'torre.e1' }));
  assert.deepEqual(sim.validar(), []);
  // um save de antes das equipes carrega com o padrão
  delete sim.json.arcologia.equipes;
  const C = criarSimulacao({ semente: 'arco-equipes' });
  aplicarSave(C, migrar(lerSave(montarSave(sim))));
  assert.equal(C.json.arcologia.equipes, EQUIPES_OBRA);
  assert.deepEqual(sim.erros, []);
});

test('dados (D98): toda dependência física existe, não há ciclo, a torre sobe em cadeia, o parque pede o lago e o resto é independente', () => {
  const todas = [...ETAPAS, ...ETAPAS_M2];
  const ids = new Set(todas.map((e) => e.id));
  for (const e of todas) {
    assert.ok(Array.isArray(e.depende), `${e.id}: depende`);
    for (const d of e.depende) {
      assert.ok(ids.has(d), `${e.id} depende de ${d}, que não existe`);
      assert.notEqual(d, e.id);
    }
  }
  // sem ciclo: a ordenação topológica consome todas
  const falta = new Map(todas.map((e) => [e.id, new Set(e.depende)]));
  let andou = true;
  while (andou && falta.size) {
    andou = false;
    for (const [id, deps] of [...falta]) {
      if ([...deps].every((d) => !falta.has(d))) {
        falta.delete(id);
        andou = true;
      }
    }
  }
  assert.equal(falta.size, 0, `ciclo entre ${[...falta.keys()].join(', ')}`);
  assert.deepEqual(['lago.e1', 'torre.e1'].map((id) => etapaDe(id).depende), [[], []], 'o lago e a fundação da torre andam em paralelo');
  assert.deepEqual(['torre.e2', 'torre.e3', 'torre.e4'].map((id) => etapaDe(id).depende), [['torre.e1'], ['torre.e2'], ['torre.e3']]);
  assert.deepEqual(ETAPAS_M2.find((e) => e.id === 'parque.e1').depende, ['lago.e1']);
  assert.ok(ETAPAS_M2.filter((e) => e.id.startsWith('horizon.')).every((e) => e.depende.length === 0), 'os trechos do Horizon Ring são independentes');
  assert.deepEqual(dependenciasAbertas(etapaDe('torre.e3'), (id) => id === 'torre.e2'), []);
  assert.deepEqual(dependenciasAbertas(etapaDe('torre.e3'), () => false), ['torre.e2']);
});
