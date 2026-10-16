// Testes do ambiente do M1b (S2b; seção 10.1 do desenho da simulação, D50): poluição do ar e ruído com fontes na
// indústria zoneada, na Pedreira, na Mina de calcário, na Cimenteira, na termelétrica e nas vias grandes; o vento do mês;
// a rodada em 4 faixas de linhas; o efeito no bem-estar (ar até -15, ruído até -10), no valor do terreno (ar x 1,0 e
// ruído x 0,6), o aviso do prédio e o alerta da cidade; as camadas Ar, Ruído e Empregos; salvar e carregar no meio da
// rodada; e que antes do M1b nada disso existe (as grades ficam em zero e o bem-estar não muda).
// Roda sozinho: node ferramentas/testes/ambiente.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDIO } from '../../fonte/contratos/flags.js';
import { AMBIENTE, FONTES, GRADE_AMBIENTE } from '../../fonte/data/ambiente.js';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { sistemaAmbiente, ventoDoMes, arEm, ruidoEm, termoAmbiente, penalidadeValor } from '../../fonte/sim/ambiente.js';
import { calcularBemEstar } from '../../fonte/sim/bemestar.js';
import { valorEm } from '../../fonte/sim/zonas/demanda.js';
import { AV } from '../../fonte/sim/predios.js';
import { montarSave, lerSave, migrar, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { MES } from '../../fonte/comum/relogio.js';
import { abrirM1b, ruaComRedes, povoar, pintar, servicoPronto, holdingPronto, rodadas } from './apoio-m1b.mjs';

const N = GRADE_AMBIENTE.n;
const maior = (d) => d.reduce((m, v) => (v > m ? v : m), 0);
/** Maior valor da grade na área dos testes (x de -1000 a -100, z de -800 a -200): fora dela passam a rodovia e a Vila. */
function pico(sim, id) {
  let m = 0;
  for (let j = Math.floor((-800 + 4096) / 64); j <= Math.floor((-200 + 4096) / 64); j++) {
    for (let i = Math.floor((-1000 + 4096) / 64); i <= Math.floor((-100 + 4096) / 64); i++) m = Math.max(m, sim.grades[id].dados[j * N + i]);
  }
  return m;
}
const soma = (d) => d.reduce((s, v) => s + v, 0);

/** Congela o mercado de trabalho (ocupação cheia) para o porte das fontes não depender da cidade ainda vazia. */
function ocupacaoCheia(sim) {
  sim._sistemas.find((s) => s.nome === 'cidadaos').ativo = false;
  sim.json.cidade.ocupacao = [1, 1, 1, 1];
}

/** Ar e ruído no ponto, pelas grades (sem passar pela parte do jogo). */
const lerGrade = (sim, id, x, z) => sim.grades[id].dados[Math.floor((z + 4096) / 64) * N + Math.floor((x + 4096) / 64)];

test('antes do M1b as grades ficam em zero, nada se calcula e o bem-estar não muda', () => {
  const { sim } = ruaComRedes('amb-m1a');
  ocupacaoCheia(sim);
  const ind = povoar(sim, 'industria', -330, -460, 36, 4);
  const casas = povoar(sim, 'resBaixa', -450, -460, 36, 4);
  holdingPronto(sim, 'cimenteira', -600);
  assert.ok(ind.length >= 1 && casas.length >= 1);
  const antes = [];
  calcularBemEstar(sim, casas[0], antes);
  rodadas(sim, 12);
  assert.equal(maior(sim.grades.ar.dados), 0);
  assert.equal(maior(sim.grades.ruido.dados), 0);
  assert.equal(arEm(sim, -330, -460), 0);
  const depois = [];
  calcularBemEstar(sim, casas[0], depois);
  assert.ok(!depois.some((f) => f.id === 'ar' || f.id === 'ruido'));
  assert.deepEqual(termoAmbiente(sim, -330, -460), { ar: 0, ruido: 0 });
  assert.equal(penalidadeValor(sim, -330, -460), 0);
  assert.equal(sim.q.cidade().ambiente, undefined);
  assert.deepEqual(sim.erros, []);
});

test('a indústria zoneada solta ar e ruído que caem com a distância, e a nuvem some quando a fábrica sai', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('amb-industria');
    ocupacaoCheia(sim);
    const ind = povoar(sim, 'industria', -330, -460, 60, 6);
    assert.ok(ind.length >= 3, `${ind.length} fábricas`);
    const P = sim.tabelas.predios;
    rodadas(sim, 50);
    const x = P.x[ind[0]];
    const z = P.z[ind[0]];
    const ar0 = arEm(sim, x, z);
    assert.ok(ar0 >= AMBIENTE.aviso.ar, `ar no meio da fábrica: ${ar0}`);
    // cai para longe (o vento puxa para um lado: olha o mais fraco dos quatro lados a 192 m e a 448 m)
    const lados = (d) => [[d, 0], [-d, 0], [0, d], [0, -d]].map(([a, b]) => arEm(sim, x + a, z + b));
    assert.ok(Math.min(...lados(192)) < ar0 / 2, `a 192 m: ${lados(192)}`);
    assert.ok(Math.max(...lados(448)) < ar0 / 6, `a 448 m: ${lados(448)}`);
    assert.ok(ruidoEm(sim, x, z) > 40, 'ruído na fábrica');
    assert.ok(ruidoEm(sim, x + 200, z) < ruidoEm(sim, x, z));
    assert.ok(sim.grades.ar.dados.length === N * N && sim.espelho.grades.ar === sim.grades.ar);
    // o resumo da rodada: pico igual ao máximo da grade
    assert.equal(sim.json.ambiente.picoAr, maior(sim.grades.ar.dados));
    assert.equal(sim.json.ambiente.picoRuido, maior(sim.grades.ruido.dados));
    // as fábricas saem (e a zona sai do chão, senão a demanda faz nascer outras): a nuvem some pelo decaimento de 10% e
    // pelo piso do byte, o ruído some na rodada seguinte
    assert.ok(sim.cmd('demolir', { refs: ind.map((i) => P.ref(i)) }).ok);
    pintar(sim, -330, -460, 90, '');
    rodadas(sim, 90);
    assert.equal(pico(sim, 'ar'), 0, 'ar limpo');
    assert.equal(pico(sim, 'ruido'), 0, 'sem ruído');
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('a indústria polui menos quando sobe de nível', () => {
  const fecha = abrirM1b();
  try {
    const pico = (nivel) => {
      const { sim } = ruaComRedes('amb-nivel');
      ocupacaoCheia(sim);
      const [i] = povoar(sim, 'industria', -330, -460, 36, 1);
      const P = sim.tabelas.predios;
      P.nivel[i] = nivel;
      // fixa o porte: o nível troca as vagas, e aqui só o nível conta
      P.empregos[i] = 60;
      sim._sistemas.find((s) => s.nome === 'predios').ativo = false;
      rodadas(sim, 40);
      return pico(sim, 'ar');
    };
    const n1 = pico(1);
    const n3 = pico(3);
    const n5 = pico(5);
    assert.ok(n1 > n3 && n3 > n5 && n5 > 0, `${n1} > ${n3} > ${n5}`);
    assert.ok(n5 < 0.65 * n1, 'o nível 5 solta bem menos');
  } finally {
    fecha();
  }
});

test('Pedreira, Mina de calcário, Cimenteira e termelétrica são fontes de ar e ruído; em obra ou abandonada, não', () => {
  const fecha = abrirM1b();
  try {
    const rodar = (cria) => {
      const { sim } = ruaComRedes('amb-fontes');
      const i = cria(sim);
      rodadas(sim, 50);
      const P = sim.tabelas.predios;
      return { sim, i, ar: lerGrade(sim, 'ar', P.x[i], P.z[i]), ru: lerGrade(sim, 'ruido', P.x[i], P.z[i]) };
    };
    const r = {
      pedreira: rodar((s) => holdingPronto(s, 'pedreira', -520)),
      mina: rodar((s) => holdingPronto(s, 'mina', -520)),
      cimenteira: rodar((s) => holdingPronto(s, 'cimenteira', -520)),
      termica: rodar((s) => servicoPronto(s, 'termica', -520)),
    };
    for (const [id, x] of Object.entries(r)) {
      assert.ok(x.ar >= 60 && x.ru >= 40, `${id}: ar ${x.ar}, ruído ${x.ru}`);
      assert.deepEqual(x.sim.erros, []);
    }
    // a ordem dos dados: a cimenteira queima (mais ar), a pedreira detona (mais ruído)
    assert.ok(r.cimenteira.ar > r.pedreira.ar && r.cimenteira.ar > r.mina.ar, 'a Cimenteira é a que mais suja o ar');
    assert.ok(r.pedreira.ru > r.cimenteira.ru && r.pedreira.ru > r.mina.ru, 'a Pedreira é a que mais faz barulho');
    assert.ok(FONTES.cimenteira.ar > FONTES.pedreira.ar && FONTES.pedreira.ruido > FONTES.mina.ruido);
    // a obra não polui (ainda não funciona)
    const { sim } = ruaComRedes('amb-obra');
    const i = holdingPronto(sim, 'cimenteira', -520);
    sim.tabelas.predios.flags[i] |= PREDIO.OBRA;
    sim.tabelas.predios.obraFim[i] = 1e9;
    rodadas(sim, 20);
    assert.equal(pico(sim, 'ar'), 0);
    assert.equal(pico(sim, 'ruido'), 0);
    // abandonada (a Holding não abandona, mas o bit apaga a fonte do mesmo jeito)
    sim.tabelas.predios.flags[i] = PREDIO.ABANDONADO;
    rodadas(sim, 20);
    assert.equal(pico(sim, 'ar'), 0);
  } finally {
    fecha();
  }
});

test('vias grandes fazem ruído (e um pouco de ar) pelo tipo e pelo fluxo; rua comum não', () => {
  const fecha = abrirM1b();
  try {
    const montar = (tipo, fluxo = null) => {
      const sim = criarSimulacao({ semente: 'amb-vias', modo: 'livre' });
      assert.ok(sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos: [[-760, -560], [-280, -560]], sessao: 1, encaixe: false } }).ok);
      if (fluxo !== null) {
        const A = sim.tabelas.arestas;
        sim.espelho.fluxos = { versao: 1, ida: new Float32Array(A.n).fill(fluxo), volta: new Float32Array(A.n).fill(fluxo), vel: new Float32Array(A.n).fill(1) };
      }
      // direto no sistema (a S1c troca espelho.fluxos a cada resultado dela): 30 rodadas sem o tique do resto
      for (let r = 0; r < 30; r++) for (let k = 0; k < AMBIENTE.fatias; k++) sistemaAmbiente(sim, k, AMBIENTE.fatias);
      return { ar: lerGrade(sim, 'ar', -520, -560), ru: lerGrade(sim, 'ruido', -520, -560), sim };
    };
    const rua = montar('rua');
    const avenida = montar('avenida');
    const grande = montar('avenidaG');
    assert.equal(rua.ru, 0);
    assert.equal(rua.ar, 0);
    assert.ok(avenida.ru > 20 && grande.ru > avenida.ru, `${avenida.ru} < ${grande.ru}`);
    assert.ok(grande.ar > 0, 'a avenida grande solta um pouco de ar');
    // o fluxo da S1c: mais carros, mais ruído (0,35 a 1,5 vezes)
    const vazia = montar('avenidaG', 0);
    const cheia = montar('avenidaG', 2400);
    assert.ok(vazia.ru < grande.ru && grande.ru < cheia.ru, `${vazia.ru} < ${grande.ru} < ${cheia.ru}`);
    assert.ok(Math.abs(vazia.ru / grande.ru - 0.35) < 0.08, 'sem carros, 35% do ruído');
    for (const x of [rua, avenida, grande, vazia, cheia]) assert.deepEqual(x.sim.erros, []);
  } finally {
    fecha();
  }
});

test('o vento do mês é função da semente e do mês; fica entre o mínimo e o máximo e muda de um mês para o outro', () => {
  const v = (s, t) => ventoDoMes(s, t);
  assert.deepEqual(v('s', 100), v('s', 100 + MES - 101), 'mesmo mês, mesmo vento');
  const velo = (w) => Math.hypot(w[0], w[1]);
  const velocidades = [];
  const angulos = new Set();
  for (let m = 0; m < 24; m++) {
    const w = v('amb-vento', m * MES);
    velocidades.push(velo(w));
    angulos.add(Math.round(Math.atan2(w[1], w[0]) * 10));
  }
  const { min, max } = AMBIENTE.ar.vento;
  assert.ok(velocidades.every((x) => x >= min - 1e-9 && x <= max + 1e-9), velocidades.join(' '));
  assert.ok(angulos.size >= 12, 'direções diferentes ao longo do ano');
  assert.notDeepEqual(v('amb-vento', 0), v('outra-semente', 0));
});

test('cada fatia refaz só a sua faixa de 32 linhas (a rodada em 4 tiques leves)', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('amb-fatias');
    // a Cimenteira em z = -517 cai na linha (z + 4096) / 64 = 55: a faixa 1 (linhas 32 a 63)
    holdingPronto(sim, 'cimenteira', -520);
    const linhas = (k) => [k * 32, (k + 1) * 32];
    const mudou = () => {
      const d = sim.grades.ar.dados;
      const js = new Set();
      for (let k = 0; k < d.length; k++) if (d[k]) js.add(Math.floor(k / N));
      return [...js];
    };
    sistemaAmbiente(sim, 0, 4);
    assert.deepEqual(mudou(), [], 'a faixa 0 não tem fonte');
    sistemaAmbiente(sim, 1, 4);
    const js = mudou();
    assert.ok(js.length > 0 && js.every((j) => j >= linhas(1)[0] && j < linhas(1)[1]), js.join(','));
    sistemaAmbiente(sim, 2, 4);
    sistemaAmbiente(sim, 3, 4);
    // as outras faixas só recebem o que a difusão leva pela fronteira (poucas linhas)
    assert.ok(mudou().every((j) => j >= 32 - 4 && j <= 63 + 4), mudou().join(','));
    // as quatro fatias marcam as grades no diário só no fim
    const v0 = sim.mudancas.versao;
    sistemaAmbiente(sim, 0, 4);
    assert.equal(sim.mudancas.versao, v0);
    sistemaAmbiente(sim, 3, 4);
    assert.ok(sim.mudancas.versao > v0);
    assert.ok(sim.mudancas.desde(v0).grades.includes('ar') && sim.mudancas.desde(v0).grades.includes('ruido'));
  } finally {
    fecha();
  }
});

test('efeitos: o bem-estar perde até 15 pelo ar e até 10 pelo ruído, o valor do terreno cai e o prédio ganha o aviso', () => {
  const fecha = abrirM1b();
  try {
    const montar = (comFonte) => {
      const { sim } = ruaComRedes('amb-efeitos');
      ocupacaoCheia(sim);
      const perto = povoar(sim, 'resBaixa', -470, -460, 30, 1);
      const longe = povoar(sim, 'resBaixa', -720, -460, 24, 1);
      if (comFonte) holdingPronto(sim, 'cimenteira', -440);
      rodadas(sim, 60);
      return { sim, perto: perto[0], longe: longe[0] };
    };
    const { sim, perto, longe } = montar(true);
    const controle = montar(false);
    const P = sim.tabelas.predios;
    assert.ok(perto >= 0 && longe >= 0 && Math.abs(P.x[perto] - -440) < 90);
    const fp = [];
    const fl = [];
    const bp = calcularBemEstar(sim, perto, fp);
    const bl = calcularBemEstar(sim, longe, fl);
    const termo = (f, id) => f.find((x) => x.id === id)?.v ?? 0;
    assert.ok(termo(fp, 'ar') < 0 && termo(fp, 'ar') >= AMBIENTE.bemEstar.ar.max, `ar ${termo(fp, 'ar')}`);
    assert.ok(termo(fp, 'ruido') < 0 && termo(fp, 'ruido') >= AMBIENTE.bemEstar.ruido.max, `ruído ${termo(fp, 'ruido')}`);
    assert.equal(termo(fl, 'ar'), 0);
    assert.ok(bp < bl, `perto ${bp}, longe ${bl}`);
    // o bem-estar do mesmo prédio sem a fonte
    assert.ok(bp < calcularBemEstar(controle.sim, controle.perto), 'a fonte tira bem-estar');
    // valor do terreno: mais baixo perto da fonte (a grade é de 32 m) e igual longe
    const vp = valorEm(sim, P.x[perto], P.z[perto]);
    const vc = valorEm(controle.sim, P.x[perto], P.z[perto]);
    assert.ok(vp < vc - 20, `valor ${vp} contra ${vc} sem a fonte`);
    assert.ok(Math.abs(valorEm(sim, -720, -460) - valorEm(controle.sim, -720, -460)) < 2, 'longe não muda');
    // a razão do desenho: o ar pesa 1, o ruído 0,6 (em pontos por unidade do índice)
    assert.ok(Math.abs(AMBIENTE.valor.ruido / AMBIENTE.valor.ar - 0.6) < 1e-9);
    // aviso no prédio e alerta da cidade
    assert.ok(P.avisos[perto] & AV.POLUICAO, 'aviso de poluição');
    assert.ok(!(P.avisos[longe] & AV.POLUICAO));
    const q = sim.q.predio(P.ref(perto));
    assert.ok(q.avisos.some((a) => a.codigo === 'poluicao') && q.ambiente.ar > AMBIENTE.aviso.ar - 1);
    const alerta = sim.q.avisos({ limite: 50 }).find((a) => a.id === 'poluicao');
    assert.ok(alerta, 'alerta da cidade: metade dos moradores no ar pesado');
    assert.ok(['poluicaoAr', 'poluicaoRuido'].includes(alerta.codigo) && alerta.params.pct >= 15);
    assert.equal(sim.q.cidade().ambiente.moradores, sim.json.ambiente.moradores);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('camadas Ar, Ruído (grade 128 x 128) e Empregos (prédios, divergente)', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('amb-camadas');
    ocupacaoCheia(sim);
    const casas = povoar(sim, 'resBaixa', -620, -460, 30, 2);
    const lojas = povoar(sim, 'comBaixa', -400, -460, 36, 2);
    const clinica = servicoPronto(sim, 'praca', -300, -480, 1);
    holdingPronto(sim, 'pedreira', -520);
    rodadas(sim, 30);
    for (const id of ['ar', 'ruido']) {
      const c = sim.q.camada(id);
      assert.equal(c.fonte, 'grade');
      assert.equal(c.tipo, 'seq');
      assert.equal(c.dados.length, N * N);
      assert.deepEqual(c.grade, { n: N, passo: 64, origem: [-4096, -4096] });
      assert.deepEqual(c.escala, { min: 0, max: 255, unidade: '' });
      assert.equal(c.resumo.chave, `camada.${id}.resumo`);
      assert.deepEqual(c.legenda.map((x) => x.chave), [`camada.${id}.limpo`, `camada.${id}.aviso`, `camada.${id}.alto`]);
      assert.equal(maior(c.dados), id === 'ar' ? sim.json.ambiente.picoAr : sim.json.ambiente.picoRuido);
      assert.ok(c.resumo.params.pico > 0);
    }
    const e = sim.q.camada('empregos');
    assert.equal(e.fonte, 'predios');
    assert.equal(e.tipo, 'div');
    assert.deepEqual(e.escala, { min: -1, max: 1, meio: 0, unidade: '' });
    assert.equal(e.dados.length, sim.tabelas.predios.n);
    assert.equal(e.resumo.chave, 'camada.empregos.resumo');
    // moradia: menos o desemprego (-1 a 0); trabalho: as vagas abertas (0 a 1); o resto sem dado (-2)
    for (const i of casas) assert.ok(e.dados[i] <= 0 && e.dados[i] >= -1);
    for (const i of lojas) assert.ok(e.dados[i] >= 0 && e.dados[i] <= 1);
    assert.equal(e.dados[clinica], -2);
    // sem trabalhadores nenhum o comércio fica com todas as vagas abertas
    sim.json.cidade.ocupacao = [0, 0, 0, 0];
    assert.ok(sim.q.camada('empregos').dados[lojas[0]] >= 0.99);
    // sem desemprego as casas valem zero; todo mundo desempregado, -1
    sim.json.cidade.desemprego = [1, 1, 1, 1];
    assert.ok(sim.q.camada('empregos').dados[casas[0]] <= -0.99);
    sim.json.cidade.desemprego = [0, 0, 0, 0];
    assert.equal(sim.q.camada('empregos').dados[casas[0]], 0);
    assert.deepEqual(sim.erros, []);
  } finally {
    fecha();
  }
});

test('salvar e carregar no meio da rodada dá a mesma partida (as grades, o resumo e o hash)', () => {
  const fecha = abrirM1b();
  try {
    const { sim } = ruaComRedes('amb-save');
    ocupacaoCheia(sim);
    povoar(sim, 'industria', -330, -460, 40, 4);
    povoar(sim, 'resBaixa', -560, -460, 40, 6);
    holdingPronto(sim, 'cimenteira', -440);
    servicoPronto(sim, 'termica', -700);
    // 7 rodadas e 13 tiques: entre a fatia 2 e a 3 da rodada
    sim.rodar(7 * 20 + 13, { sincrono: true });
    assert.ok(maior(sim.grades.ar.dados) > 0);
    const C = criarSimulacao({ semente: 'amb-save', modo: 'livre' });
    aplicarSave(C, migrar(lerSave(montarSave(sim))));
    assert.equal(C.q.hash(), sim.q.hash());
    assert.deepEqual([...C.grades.ar.dados], [...sim.grades.ar.dados]);
    assert.deepEqual(C.json.ambiente, sim.json.ambiente);
    // a carga troca o mercado de trabalho fixo: o mesmo na partida carregada
    C._sistemas.find((s) => s.nome === 'cidadaos').ativo = false;
    sim.rodar(260, { sincrono: true });
    C.rodar(260, { sincrono: true });
    assert.equal(C.q.hash(), sim.q.hash(), 'segue igual');
    assert.deepEqual([...C.grades.ruido.dados], [...sim.grades.ruido.dados]);
    assert.deepEqual(sim.erros, []);
    assert.deepEqual(C.erros, []);
    assert.ok(soma(C.grades.ar.dados) > 0);
  } finally {
    fecha();
  }
});

test('duas partidas iguais dão a mesma grade de ar e de ruído, tique a tique', () => {
  const fecha = abrirM1b();
  try {
    const partida = () => {
      const { sim } = ruaComRedes('amb-det');
      ocupacaoCheia(sim);
      povoar(sim, 'industria', -330, -460, 40, 5);
      holdingPronto(sim, 'pedreira', -600);
      return sim;
    };
    const a = partida();
    const b = partida();
    for (let k = 0; k < 6; k++) {
      a.rodar(37, { sincrono: true });
      b.rodar(37, { sincrono: true });
      assert.equal(a.q.hash(), b.q.hash(), `tique ${a.tique}`);
    }
  } finally {
    fecha();
  }
});
