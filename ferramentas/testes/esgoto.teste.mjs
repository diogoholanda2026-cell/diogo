// Testes do esgoto separado e da ETE (S2b; D50, seção 8.2 do desenho da simulação): a terceira rede (a água devolvida),
// que só existe com o M1b; sem ETE todo prédio fica sem esgoto (alerta da cidade, sem abandono), com a ETE ligada o
// esgoto é tratado, o racionamento corta os mais distantes, o bem-estar perde 15 sem esgoto, o nível 2 pede esgoto e a
// camada Esgoto mostra o estado de cada prédio. Antes do M1b nada disso existe (nenhum prédio fica sem esgoto).
// Roda sozinho: node ferramentas/testes/esgoto.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDIO } from '../../fonte/contratos/flags.js';
import { SERVICOS } from '../../fonte/data/servicos.js';
import { sistemaRedes, consumoDe, estadoRede } from '../../fonte/sim/redes.js';
import { calcularBemEstar, penalidadeEsgoto, BEM } from '../../fonte/sim/bemestar.js';
import { OBJETIVOS } from '../../fonte/data/objetivos.js';
import { registrar as registrarTextosS2b } from '../../fonte/ui/textos/s2b.js';
import { registrar as registrarTextosS3 } from '../../fonte/ui/textos/s3.js';
import { faltaParaNivel } from '../../fonte/sim/zonas/crescimento.js';
import { AV } from '../../fonte/sim/predios.js';
import { abrirM1b, ruaComRedes, povoar, servicoPronto, rodadas } from './apoio-m1b.mjs';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { SERVICOS_ORDEM } from '../../fonte/data/servicos.js';
import { criarEstrategia } from '../robo/robo-sim.mjs';

const sem = (sim, i, bit) => !!(sim.tabelas.predios.flags[i] & bit);
const soma = (sim, lista, rec) => lista.reduce((s, i) => s + consumoDe(sim, i, rec), 0);

test('antes do M1b a rede de esgoto não existe: nenhum prédio fica sem esgoto e o bem-estar não muda', () => {
  const { sim } = ruaComRedes('esgoto-m1a');
  const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
  assert.ok(casas.length >= 4);
  sistemaRedes(sim);
  for (const i of casas) assert.ok(!sem(sim, i, PREDIO.SEM_ESGOTO) && !sem(sim, i, PREDIO.SEM_AGUA));
  assert.deepEqual(sim.agregados.redes.esgoto, { oferta: 0, demanda: 0 });
  assert.equal(sim.q.predio(sim.tabelas.predios.ref(casas[0])).servicos.esgoto, null);
  const fatores = [];
  calcularBemEstar(sim, casas[0], fatores);
  assert.ok(!fatores.some((f) => f.id === 'esgoto'));
  const c = sim.q.camada('esgoto');
  assert.equal(c.id, 'esgoto');
  assert.ok(c.dados.every((v) => v === 0), 'a camada vem vazia');
});

test('M1b sem ETE: todo prédio fica sem esgoto, a falta é um alerta da cidade e não conta para o abandono', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-sem-ete');
    const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
    assert.ok(casas.length >= 4);
    sistemaRedes(sim);
    const P = sim.tabelas.predios;
    for (const i of casas) {
      assert.ok(sem(sim, i, PREDIO.SEM_ESGOTO) && !sem(sim, i, PREDIO.SEM_AGUA) && !sem(sim, i, PREDIO.SEM_ENERGIA));
      assert.equal(estadoRede(sim, i, 'esgoto'), 'sem');
    }
    const ag = sim.agregados.redes;
    assert.equal(ag.esgoto.oferta, 0);
    // o esgoto é a água devolvida: a demanda da rede de esgoto é a da água (menos a de quem a rede de água não atende)
    const dem = soma(sim, [...Array(P.n).keys()].filter((i) => P.viva[i]), 'esgoto');
    assert.ok(Math.abs(ag.esgoto.demanda - dem) < 0.05 && ag.esgoto.demanda > 0, `${ag.esgoto.demanda} contra ${dem}`);
    assert.equal(consumoDe(sim, casas[0], 'esgoto'), consumoDe(sim, casas[0], 'agua'));
    // alerta da cidade (um só)
    const alerta = sim.q.avisos({ limite: 50 }).filter((a) => a.id === 'esgoto');
    assert.equal(alerta.length, 1);
    assert.equal(alerta[0].codigo, 'faltaEsgoto');
    assert.equal(alerta[0].glifo, 'esgoto');
    assert.equal(alerta[0].params.n >= casas.length, true);
    // o bem-estar do prédio perde 15 (o fator aparece) quando o povoado já passou da rampa (1.500 moradores)
    sim.agregados.populacao = BEM.esgotoRampa.ate;
    const fatores = [];
    calcularBemEstar(sim, casas[0], fatores);
    assert.equal(fatores.find((f) => f.id === 'esgoto')?.v, BEM.semEsgoto);
    assert.equal(BEM.semEsgoto, -15);
    // sem nenhuma ETE a falta é da cidade inteira: o contador do abandono não anda (10 minutos de jogo e mais um pouco)
    rodadas(sim, 40);
    for (const i of casas) {
      assert.ok(P.viva[i] && !sem(sim, i, PREDIO.ABANDONADO), 'não abandona');
      assert.equal(P.problema[i] ?? 0, 0);
      // o aviso do prédio só vale com ETE na cidade
      assert.ok(!(P.avisos[i] & AV.SEM_ESGOTO));
    }
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('com a ETE ligada o esgoto é tratado, a camada mostra o produtor e demolir a ETE volta a faltar', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-ete');
    const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
    const ete = servicoPronto(sim, 'ete', -300);
    sistemaRedes(sim);
    const P = sim.tabelas.predios;
    for (const i of casas) assert.ok(!sem(sim, i, PREDIO.SEM_ESGOTO) && !sem(sim, i, PREDIO.RACIONADO), `casa ${i}`);
    const ag = sim.agregados.redes.esgoto;
    // a oferta é a capacidade da ETE vezes o quadro de pessoal (0,6 a 1)
    assert.ok(ag.oferta > 0 && ag.oferta <= SERVICOS.ete.capacidade, `${ag.oferta}`);
    assert.ok(ag.demanda > 0 && ag.demanda < ag.oferta);
    assert.equal(estadoRede(sim, casas[0], 'esgoto'), 'ok');
    // a camada: a ETE é o produtor (4), as casas estão com esgoto (1)
    const camada = sim.q.camada('esgoto');
    assert.equal(camada.dados[ete], 4);
    assert.ok(casas.every((i) => camada.dados[i] === 1));
    assert.equal(camada.resumo.chave, 'camada.esgoto.resumo');
    assert.equal(camada.escala.unidade, 'm³/h');
    // com a ETE o bem-estar não tem o termo do esgoto
    const fatores = [];
    calcularBemEstar(sim, casas[0], fatores);
    assert.ok(!fatores.some((f) => f.id === 'esgoto'));
    // demolir a ETE: volta a faltar para todos
    assert.ok(sim.cmd('demolir', { refs: [P.ref(ete)] }).ok);
    sistemaRedes(sim);
    for (const i of casas) assert.ok(sem(sim, i, PREDIO.SEM_ESGOTO));
    assert.equal(sim.agregados.redes.esgoto.oferta, 0);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('ETE pequena para a cidade: racionamento dos mais distantes; e com falta de verdade o abandono conta', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-racao');
    const casas = povoar(sim, 'resBaixa', -520, -460, 90, 40);
    assert.ok(casas.length >= 10);
    const ete = servicoPronto(sim, 'ete', -760 + 60); // junto da ponta oeste
    const P = sim.tabelas.predios;
    // o pagamento da manutenção (D41) em fração: a ETE trata 40% do que as casas devolvem
    const total = soma(sim, casas, 'esgoto');
    sim.economia.eficiencia = () => (0.4 * total) / (0.6 * SERVICOS.ete.capacidade);
    sistemaRedes(sim);
    const cortadas = casas.filter((i) => sem(sim, i, PREDIO.SEM_ESGOTO));
    const ligadas = casas.filter((i) => !sem(sim, i, PREDIO.SEM_ESGOTO));
    assert.ok(cortadas.length > 0 && ligadas.length > 0, `${cortadas.length} cortadas, ${ligadas.length} ligadas`);
    for (const i of cortadas) assert.ok(sem(sim, i, PREDIO.RACIONADO), 'racionado, não sem rede');
    // o corte vai dos mais distantes da ETE: toda casa ligada está mais perto (em x) do que a mais próxima das cortadas
    const dist = (i) => Math.abs(P.x[i] - P.x[ete]);
    assert.ok(Math.max(...ligadas.map(dist)) <= Math.min(...cortadas.map(dist)) + 24, 'as pontas ficam sem');
    // com ETE na cidade a falta já conta: o aviso do prédio aparece depois de uma rodada dos prédios
    rodadas(sim, 2);
    assert.ok(cortadas.some((i) => P.avisos[i] & AV.SEM_ESGOTO), 'o aviso do prédio');
    assert.ok(cortadas.some((i) => P.problema[i] > 0), 'o contador do abandono anda');
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('o nível 2 pede esgoto, como a água e a energia', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-nivel');
    const casas = povoar(sim, 'resBaixa', -520, -460, 40, 4);
    sistemaRedes(sim);
    assert.deepEqual(faltaParaNivel(sim, casas[0], 2), ['esgoto']);
    servicoPronto(sim, 'ete', -300);
    sistemaRedes(sim);
    assert.deepEqual(faltaParaNivel(sim, casas[0], 2), []);
  } finally {
    fecha();
  }
});

test('a falta de ETE pesa aos poucos: nada num povoado pequeno, o -15 inteiro a partir de 1.500 moradores', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('esgoto-rampa');
    const casas = povoar(sim, 'resBaixa', -520, -460, 60, 12);
    assert.ok(casas.length >= 4);
    sistemaRedes(sim);
    assert.ok(sem(sim, casas[0], PREDIO.SEM_ESGOTO));
    const { de, ate } = BEM.esgotoRampa;
    assert.ok(de > 0 && ate > de);
    const termo = (pop) => {
      sim.agregados.populacao = pop;
      const f = [];
      calcularBemEstar(sim, casas[0], f);
      return f.find((x) => x.id === 'esgoto')?.v ?? 0;
    };
    assert.equal(termo(0), 0);
    assert.equal(termo(de), 0, 'a Vila (uns 350 moradores) mal sente');
    const meio = termo((de + ate) / 2);
    assert.ok(meio < 0 && meio > BEM.semEsgoto, `${meio}`);
    assert.ok(Math.abs(meio - BEM.semEsgoto / 2) < 0.1, `metade da rampa, metade do peso: ${meio}`);
    assert.equal(termo(ate), BEM.semEsgoto);
    assert.equal(termo(5 * ate), BEM.semEsgoto, 'não passa de -15');
    // cresce com a população (a função pura e o fator do prédio dizem o mesmo)
    let antes = 0;
    for (const pop of [0, 300, 600, 900, 1200, 1500, 2000]) {
      sim.agregados.populacao = pop;
      const v = penalidadeEsgoto(sim);
      assert.ok(v <= antes + 1e-9, `${pop}: ${v}`);
      antes = v;
    }
    // a ETE ligada zera o termo em qualquer população
    servicoPronto(sim, 'ete', -300);
    sistemaRedes(sim);
    assert.equal(termo(5 * ate), 0);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('o jogador acha a ETE: liberada no Canteiro, custa o mesmo que a captação, o alerta diz o que fazer e há um objetivo', () => {
  // desbloqueio e custo (a ETE é a captação do esgoto: cada m³/h de água volta como esgoto)
  assert.equal(SERVICOS.ete.marco, 0, 'liberada desde o Canteiro');
  assert.ok(SERVICOS.ete.custo <= SERVICOS.captacao.custo, 'não custa mais que a captação');
  assert.ok(SERVICOS.ete.manutencaoHora <= SERVICOS.captacao.manutencaoHora);
  assert.equal(SERVICOS.ete.capacidade, SERVICOS.captacao.capacidade, 'uma ETE por captação');
  assert.ok(SERVICOS.ete.custo <= 20000, 'cabe no caixa do começo (300 mil)');
  // o alerta da cidade diz o que fazer; o objetivo leva à ferramenta Serviços
  const textos = {};
  registrarTextosS2b((parcela, mapa) => Object.assign(textos, mapa));
  registrarTextosS3((parcela, mapa) => Object.assign(textos, mapa));
  assert.match(textos['aviso.faltaEsgoto'], /\{n\}/);
  assert.match(textos['aviso.faltaEsgoto'], /ETE/);
  assert.match(textos['s3.objetivo.cidade.esgoto'], /ETE/);
  assert.ok(!/—/.test(textos['aviso.faltaEsgoto'] + textos['s3.objetivo.cidade.esgoto']), 'sem travessão');
  const obj = OBJETIVOS.find((o) => o.id === 'cidade.esgoto');
  assert.ok(obj, 'objetivo da ETE');
  assert.equal(obj.parte, 'M1b');
  assert.equal(obj.medida, 'servico:ete');
  assert.equal(obj.alvo, 'ferramenta:servicos');
  const cidade = OBJETIVOS.filter((o) => o.dominio === 'cidade').map((o) => o.id);
  assert.ok(cidade.indexOf('cidade.esgoto') > cidade.indexOf('cidade.zonas'), 'depois de zonear a primeira quadra');
  assert.ok(cidade.indexOf('cidade.esgoto') < cidade.indexOf('cidade.mil'), 'antes de a cidade passar de mil moradores');
  // no M1a o objetivo não abre; no M1b abre quando os de antes estão feitos e fecha com a ETE em pé
  const abertoCidade = (sim) => sim.q.objetivos().find((o) => o.dominio === 'cidade')?.id;
  const antesDoEsgoto = cidade.slice(0, cidade.indexOf('cidade.esgoto'));
  const preparar = (semente) => {
    const { sim } = ruaComRedes(semente);
    sim.json.objetivos.feitos.push(...antesDoEsgoto);
    return sim;
  };
  const m1a = preparar('esgoto-obj-m1a');
  assert.notEqual(abertoCidade(m1a), 'cidade.esgoto', 'no M1a não há esgoto');
  const fecha = abrirM1b();
  try {
    const sim = preparar('esgoto-obj-m1b');
    assert.equal(abertoCidade(sim), 'cidade.esgoto');
    const o = sim.q.objetivos().find((x) => x.id === 'cidade.esgoto');
    assert.equal(o.feito, 0);
    assert.equal(o.total, 1);
    assert.equal(o.texto, 's3.objetivo.cidade.esgoto');
    servicoPronto(sim, 'ete', -300);
    assert.equal(sim.q.objetivos().find((x) => x.id === 'cidade.esgoto')?.feito, 1);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('no meio da rampa (cidade do robô sem ETE, uns 900 moradores) salvar e carregar dá a mesma cidade', () => {
  const fecha = abrirM1b();
  try {
    const a = criarSimulacao({ semente: 'robo-1' });
    const est = criarEstrategia(a, { m1b: true });
    const P = a.tabelas.predios;
    const etes = [];
    const achar = () => {
      etes.length = 0;
      for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] === TIPO_PREDIO.SERVICO && P.modelo[i] === SERVICOS_ORDEM.indexOf('ete')) etes.push(P.ref(i));
    };
    // roda até a cidade do robô ter a ETE e uns 900 moradores (o ritmo do robô muda com a ZON2: não vale um tique fixo)
    for (let t = 0; t < 4800; t++) {
      if (t % 20 === 0) est.passo();
      a.rodar(1, { sincrono: true });
      if (t % 20 === 0 && a.agregados.populacao >= 900) {
        achar();
        if (etes.length) break;
      }
    }
    achar();
    assert.ok(etes.length > 0, 'o robô fez a ETE');
    assert.ok(a.cmd('demolir', { refs: etes }).ok);
    a.rodar(200, { sincrono: true });
    const pop = a.agregados.populacao;
    assert.ok(pop > BEM.esgotoRampa.de && pop < BEM.esgotoRampa.ate, `população ${pop} dentro da rampa`);
    let visto = 0;
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || !P.moradores[i] || !(P.flags[i] & PREDIO.SEM_ESGOTO)) continue;
      const f = [];
      calcularBemEstar(a, i, f);
      const v = f.find((x) => x.id === 'esgoto')?.v;
      assert.ok(v < 0 && v > BEM.semEsgoto, `casa ${i}: ${v}`);
      visto++;
    }
    assert.ok(visto > 10, `${visto} casas sentem o esgoto pela metade`);
    const C = criarSimulacao({ semente: 'robo-1' });
    aplicarSave(C, migrar(lerSave(montarSave(a))));
    assert.equal(C.q.hash(), a.q.hash());
    a.rodar(300, { sincrono: true });
    C.rodar(300, { sincrono: true });
    assert.equal(C.q.hash(), a.q.hash());
    assert.deepEqual(a.erros, []);
    assert.deepEqual(C.erros, []);
  } finally {
    fecha();
  }
});
