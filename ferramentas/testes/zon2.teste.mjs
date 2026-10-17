// Testes da ZON2 (D112 e D113): o Distrito Industrial e a Zona de Utilidades (onde ficam, a sotavento, longe do centro, com a
// Mina onde sempre esteve, a Vila e a orla de fora), a indústria que só se pinta no distrito, as utilidades que só se
// colocam na zona (com a rede de longo alcance paga por metro), o vento predominante, o modo de crescimento da zona
// (Automático ou Manual por lote: comandos, consultas, ritmo, determinismo e save com a migração da v3 para a v4) e o robô
// nos dois modos.
// Roda sozinho: node ferramentas/testes/zon2.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { idxDaRef, refDe } from '../../fonte/contratos/espelho.js';
import { PREDIO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { ORDEM } from '../../fonte/contratos/interno.js';
import { CODIGOS } from '../../fonte/contratos/codigos.js';
import { SAVE } from '../../fonte/contratos/save.js';
import { ZONAS_ORDEM, indiceZona, definirParteAtual } from '../../fonte/data/zonas.js';
import { MAPA_HELDOPOLIS } from '../../fonte/data/mapa-heldopolis.js';
import { SEDE_CENTRO } from '../../fonte/data/arcologia-plano.js';
import { SERVICOS, SERVICOS_ORDEM } from '../../fonte/data/servicos.js';
import {
  DISTRITO_INDUSTRIAL, ZONA_UTILIDADES, VENTO_PREDOMINANTE, LONGO_ALCANCE, LOTE_MAX, definirRegrasDeLugar, REGRAS_DE_LUGAR,
} from '../../fonte/data/zon2.js';
import { noDistrito, naUtilidades, ehUtilidade, ehIndustrial } from '../../fonte/sim/zon2.js';
import { ventoDoMes } from '../../fonte/sim/ambiente.js';
import { terminarObra } from '../../fonte/sim/zonas/crescimento.js';
import { montarSave, lerSave, migrar, aplicarSave, MIGRACOES } from '../../fonte/sim/salvar/formato.js';
import { registrar as registrarTextos } from '../../fonte/ui/textos/zon2.js';
import { t as frase, temTexto } from '../../fonte/ui/textos.js';
import { pontoNoPoligono } from '../../fonte/comum/vetor.js';
import { rodarRobo } from '../robo/robo-sim.mjs';

const novaSim = (semente = 'zon2') => criarSimulacao({ semente, modo: 'livre' });
const plano = (c) => Float64Array.from(c.flat());

const rua = (sim, pontos, tipo = 'rua', encaixe = false) => {
  const r = sim.cmd('via.construir', { plano: { modo: 'reta', tipo, pontos, sessao: 1, ...(encaixe ? {} : { encaixe: false }) } });
  assert.ok(r.ok, `${JSON.stringify(pontos)}: ${JSON.stringify(r)}`);
  return r;
};
const pincel = (x, z, x2, z2) => ({ modo: 'retangulo', x, z, x2, z2 });

/** Demanda fixa em 100 nas zonas dadas (um sistema do teste antes do crescimento), como a crescimento.teste. */
function demandaFixa(sim, zonas) {
  sim.registrarSistema(1, 0, (s) => {
    for (const z of zonas) s.json.cidade.demanda[z] = 100;
  }, 1, { nome: 'teste: demanda fixa', ordem: ORDEM.zonas - 1 });
}

/** Prédios de zona de uma zona no bairro do teste (x > 900; a Vila tem as casas dela): { prontos, obras, total }. */
function contar(sim, zona) {
  const P = sim.tabelas.predios;
  const z = indiceZona(zona);
  let obras = 0;
  let prontos = 0;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || P.zona[i] !== z || P.x[i] < 900) continue;
    if (P.flags[i] & PREDIO.OBRA) obras++;
    else prontos++;
  }
  return { prontos, obras, total: prontos + obras };
}

// ------------------------------------------------------------------------------------------------ o mapa

test('o Distrito Industrial e a Zona de Utilidades são áreas nomeadas do mapa, longe do centro, sem a Vila nem a orla', () => {
  const sim = novaSim();
  const ids = sim.espelho.areas.map((a) => a.id);
  assert.ok(ids.includes('distritoIndustrial') && ids.includes('zonaUtilidades'));
  assert.ok(MAPA_HELDOPOLIS.areas.some((a) => a.id === DISTRITO_INDUSTRIAL.id));
  const [cx, cz] = SEDE_CENTRO;
  const centro = (poli) => {
    const xs = poli.contorno.map((p) => p[0]);
    const zs = poli.contorno.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
  };
  for (const area of [DISTRITO_INDUSTRIAL, ZONA_UTILIDADES]) {
    const [x, z] = centro(area);
    assert.ok(Math.hypot(x - cx, z - cz) > 1000, `${area.id} a ${Math.round(Math.hypot(x - cx, z - cz))} m do centro da sede`);
  }
  // de fora: a Vila, a orla e o disco da sede (todo vértice e o centro das áreas ficam fora dos dois polígonos)
  const D = plano(DISTRITO_INDUSTRIAL.contorno);
  const U = plano(ZONA_UTILIDADES.contorno);
  for (const id of ['vila', 'orla', 'gleba']) {
    const a = sim.espelho.areas.find((x) => x.id === id);
    for (let k = 0; k < a.contorno.length; k += 2) {
      assert.equal(pontoNoPoligono(a.contorno[k], a.contorno[k + 1], D), false, `${id} dentro do distrito`);
      assert.equal(pontoNoPoligono(a.contorno[k], a.contorno[k + 1], U), false, `${id} dentro da zona de utilidades`);
    }
  }
  // as duas áreas não se tocam
  for (const p of DISTRITO_INDUSTRIAL.contorno) assert.equal(pontoNoPoligono(p[0], p[1], U), false);
  for (const p of ZONA_UTILIDADES.contorno) assert.equal(pontoNoPoligono(p[0], p[1], D), false);
});

test('a Mina fica onde sempre esteve: o calcário do ladrilho (5, 5) está dentro do Distrito Industrial', () => {
  const D = plano(DISTRITO_INDUSTRIAL.contorno);
  for (const [x, z] of MAPA_HELDOPOLIS.calcario) assert.ok(pontoNoPoligono(x, z, D), `calcário em (${x}, ${z}) fora do distrito`);
  const [i, j] = [Math.floor((-1300 - MAPA_HELDOPOLIS.origem[0]) / MAPA_HELDOPOLIS.ladrilho), Math.floor((-1340 - MAPA_HELDOPOLIS.origem[1]) / MAPA_HELDOPOLIS.ladrilho)];
  assert.deepEqual([i, j], [5, 5]);
  // a prévia da Mina no calcário não recusa por 'distrito' (recusa só por ainda não ter o ladrilho), e a Cimenteira no centro recusa
  const antes = definirParteAtual('M1b');
  try {
    const sim = novaSim('zon2-mina');
    const mina = sim.q.construir.previa({ tipo: 'mina', x: -1300, z: -1340, rot: 0 });
    assert.notEqual(mina.codigo, 'distrito');
    assert.notEqual(mina.codigo, 'utilidades');
    const cim = sim.q.construir.previa({ tipo: 'cimenteira', x: -600, z: 0, rot: 0 });
    assert.equal(cim.codigo, 'distrito');
    assert.ok(ehIndustrial('mina') && ehIndustrial('cimenteira') && !ehIndustrial('pedreira'));
  } finally {
    definirParteAtual(antes);
  }
});

test('o vento predominante sopra para o distrito: a média do ano aponta para ele e o distrito está a sotavento do centro', () => {
  let sx = 0;
  let sz = 0;
  for (let m = 0; m < 96; m++) {
    const [vx, vz] = ventoDoMes('zon2-vento', m * 20 * 60 * 24 * 30);
    sx += vx;
    sz += vz;
  }
  const media = Math.atan2(sz, sx);
  const dif = Math.abs(Math.atan2(Math.sin(media - VENTO_PREDOMINANTE.angulo), Math.cos(media - VENTO_PREDOMINANTE.angulo)));
  assert.ok(dif < 0.35, `o vento médio foge ${dif.toFixed(2)} rad do predominante`);
  // a direção do centro da sede ao distrito tem de estar dentro da dispersão do vento
  const [cx, cz] = SEDE_CENTRO;
  const xs = DISTRITO_INDUSTRIAL.contorno.map((p) => p[0]);
  const zs = DISTRITO_INDUSTRIAL.contorno.map((p) => p[1]);
  const dir = Math.atan2((Math.min(...zs) + Math.max(...zs)) / 2 - cz, (Math.min(...xs) + Math.max(...xs)) / 2 - cx);
  const d2 = Math.abs(Math.atan2(Math.sin(dir - VENTO_PREDOMINANTE.angulo), Math.cos(dir - VENTO_PREDOMINANTE.angulo)));
  assert.ok(d2 < VENTO_PREDOMINANTE.dispersao * 0.6, `o distrito está a ${d2.toFixed(2)} rad do vento predominante`);
});

// ------------------------------------------------------------------------------------------------ indústria só no distrito

test('indústria só se pinta dentro do Distrito Industrial; pincel misto pula as células de fora; outras zonas ficam livres', () => {
  const sim = novaSim('zon2-pintar');
  // uma rua dentro do distrito, em cima do corredor plano da rodovia, e uma fora, junto da Vila
  rua(sim, [[-985, -1128], [-835, -1128]], 'rua', true);
  rua(sim, [[-880, 164], [-768, 164]]);
  const ind = indiceZona('industria');
  // fora do distrito: recusa com 'distrito' e nada muda
  const fora = sim.cmd('zona.pintar', { pincel: pincel(-880, 100, -768, 230), zona: ind });
  assert.equal(fora.ok, false);
  assert.equal(fora.codigo, 'distrito');
  assert.equal(sim.tabelas.celulas.zona.some((z) => z === ind), false, 'a recusa não pinta nada');
  const pv0 = sim.q.zona.previa({ pincel: pincel(-880, 100, -768, 230), zona: ind });
  assert.equal(pv0.celulas.length, 0);
  assert.ok(pv0.foraDoDistrito > 0);
  // dentro: pinta
  const dentro = sim.cmd('zona.pintar', { pincel: pincel(-985, -1190, -835, -1070), zona: ind });
  assert.ok(dentro.ok, JSON.stringify(dentro));
  assert.ok(dentro.dados.n > 50);
  const C = sim.tabelas.celulas;
  for (let c = 0; c < C.n; c++) if (C.viva[c] && C.zona[c] === ind) assert.ok(noDistrito(C.x[c], C.z[c]), `célula industrial fora do distrito em (${C.x[c]}, ${C.z[c]})`);
  // pincel que passa da borda sul do distrito (z = -1080): pinta o que está dentro e conta o que ficou de fora
  const misto = sim.cmd('zona.pintar', { pincel: pincel(-985, -1130, -835, -1030), zona: ind });
  assert.ok(misto.ok === true || misto.codigo === 'nada', JSON.stringify(misto));
  const pv = sim.q.zona.previa({ pincel: pincel(-985, -1190, -835, -1030), zona: indiceZona('resBaixa') });
  assert.equal(pv.foraDoDistrito, 0, 'a residencial não tem restrição de lugar');
  // outras zonas pintam em qualquer lugar (inclusive fora do distrito)
  const res = sim.cmd('zona.pintar', { pincel: pincel(-880, 100, -768, 230), zona: indiceZona('resBaixa') });
  assert.ok(res.ok, JSON.stringify(res));
  assert.deepEqual(sim.erros, []);
});

test('com as regras de lugar desligadas (só os testes de outras parcelas) a indústria pinta em qualquer lugar', () => {
  const antes = definirRegrasDeLugar(false);
  try {
    assert.equal(REGRAS_DE_LUGAR, false);
    const sim = novaSim('zon2-livre-de-regra');
    rua(sim, [[-880, 164], [-768, 164]]);
    assert.ok(sim.cmd('zona.pintar', { pincel: pincel(-880, 100, -768, 230), zona: indiceZona('industria') }).ok);
  } finally {
    definirRegrasDeLugar(antes);
  }
  assert.equal(REGRAS_DE_LUGAR, true);
});

// ------------------------------------------------------------------------------------------------ utilidades só na zona

test('captação, poço, usina, ETE e termelétrica só se colocam na Zona de Utilidades; praça e clínica não têm a restrição', () => {
  for (const t of ['captacao', 'poco', 'solar', 'ete', 'termica', 'tratamentoAgua', 'hidreletrica', 'subestacao', 'dataCenter']) assert.ok(ehUtilidade(t), t);
  for (const t of ['praca', 'clinica', 'escolaF', 'pedreira']) assert.ok(!ehUtilidade(t), t);
  const sim = novaSim('zon2-util');
  // a ponta da rua principal da Vila (rua com redes) fica fora da zona; a margem do rio, dentro dela
  const longe = sim.q.construir.previa({ tipo: 'solar', x: -700, z: 600, rot: 0 });
  assert.equal(longe.ok, false);
  assert.equal(longe.codigo, 'utilidades');
  assert.equal(longe.dados.area, 'zonaUtilidades');
  const cmd = sim.cmd('construir', { tipo: 'solar', x: -700, z: 600, rot: 0 });
  assert.equal(cmd.ok, false);
  assert.equal(cmd.codigo, 'utilidades');
  assert.ok(Object.hasOwn(CODIGOS, 'utilidades') && Object.hasOwn(CODIGOS, 'distrito') && Object.hasOwn(CODIGOS, 'modo'));
  // dentro da zona: a captação sugerida e a usina sugerida passam
  for (const id of ['captacao', 'usina']) {
    const s = sim.q.sugestoes().find((x) => x.id === id);
    const p = sim.q.construir.previa({ tipo: s.construir, x: s.x, z: s.z, rot: s.rot });
    assert.ok(p.ok, `${id}: ${p.codigo}`);
    assert.ok(naUtilidades(p.x, p.z));
    assert.ok(sim.cmd('construir', { tipo: s.construir, x: p.x, z: p.z, rot: p.rot }).ok);
  }
  // serviços comuns fora da zona seguem livres
  assert.notEqual(sim.q.construir.previa({ tipo: 'praca', x: -700, z: 600, rot: 0 }).codigo, 'utilidades');
});

test('rede de longo alcance: o produtor da zona numa estrada de terra liga ao nó mais perto de uma via com redes, e a linha se paga por metro', () => {
  const sim = novaSim('zon2-rede');
  // a estrada de terra do barreiro tem acesso e fica dentro da zona; a rua principal da Vila é a via com redes mais perto
  const p = sim.q.construir.previa({ tipo: 'solar', x: -1000, z: 170, rot: 0 });
  assert.ok(p.ok, `${p.codigo} ${JSON.stringify(p.dados)}`);
  assert.ok(p.longoAlcance, 'a prévia diz a linha');
  assert.equal(p.longoAlcance.rec, 'energia');
  assert.ok(p.longoAlcance.alcanca && p.longoAlcance.metros > 50 && p.longoAlcance.metros < LONGO_ALCANCE.alcanceMax);
  assert.equal(p.longoAlcance.custo, Math.round(p.longoAlcance.metros * LONGO_ALCANCE.custoPorMetro.energia));
  assert.equal(p.custo, SERVICOS.solar.custo + p.longoAlcance.custo, 'o custo da prévia soma o da linha');
  assert.equal(p.semRede, false, 'com a linha de longo alcance liga');
  const caixa0 = sim.holding.caixa();
  const r = sim.cmd('construir', { tipo: 'solar', x: p.x, z: p.z, rot: p.rot });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.dados.longoAlcance.metros, p.longoAlcance.metros);
  assert.equal(Math.round(caixa0 - sim.holding.caixa()), p.custo, 'o caixa paga a obra e a linha');
  assert.equal(sim.json.zon2.linhas[r.id].custo, p.longoAlcance.custo, 'a linha paga fica no save');
  terminarObra(sim, idxDaRef(r.id));
  sim.rodar(3 * 20, { sincrono: true });
  assert.ok(sim.agregados.redes.energia.oferta >= SERVICOS.solar.capacidade, `oferta ${sim.agregados.redes.energia.oferta}`);
  // demolir tira a linha do registro
  assert.ok(sim.cmd('demolir', { refs: [r.id] }).ok);
  assert.equal(sim.json.zon2.linhas[r.id], undefined);
  // fora da zona o produtor não ganha linha
  assert.equal(sim.q.construir.previa({ tipo: 'poco', x: -700, z: 600, rot: 0 }).longoAlcance ?? null, null);
  assert.deepEqual(sim.erros, []);
});

// ------------------------------------------------------------------------------------------------ modo de crescimento

/** Uma rua com duas faixas de residencial baixa pintadas e a demanda fixa em 100: cresce sozinha no Automático. */
function bairro(semente, { manual = false } = {}) {
  const sim = novaSim(semente);
  for (const z of [-380, -250]) rua(sim, [[1000, z], [1560, z]]);
  sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: 5000, no: refNo(sim, 1000, -380) });
  sim.redes.produtor({ tipo: 'energia', ref: 2, capacidade: 50000, no: refNo(sim, 1000, -380) });
  const r = sim.cmd('zona.pintar', { pincel: pincel(1000, -440, 1560, -190), zona: indiceZona('resBaixa'), ...(manual ? { modo: 'manual' } : {}) });
  assert.ok(r.ok, JSON.stringify(r));
  demandaFixa(sim, ['resBaixa']);
  return sim;
}
function refNo(sim, x, z) {
  const N = sim.tabelas.nos;
  let m = -1;
  let md = Infinity;
  for (let i = 0; i < N.n; i++) {
    if (!N.viva[i]) continue;
    const d = Math.hypot(N.x[i] - x, N.z[i] - z);
    if (d < md) {
      md = d;
      m = i;
    }
  }
  return refDe(m, N.ger[m]);
}

test('modo de crescimento: o padrão é Automático; zona.modo valida, troca e recusa o que não muda', () => {
  const sim = novaSim('zon2-modo');
  const z = indiceZona('resBaixa');
  const c0 = sim.q.zona.crescimento({ zona: z });
  assert.deepEqual([c0.modo, c0.pedido, c0.espera, c0.id], ['automatico', 0, 0, 'resBaixa']);
  assert.equal(sim.q.zona.crescimento().length, ZONAS_ORDEM.filter((id) => id && ['resBaixa', 'resMedia', 'comBaixa', 'industria'].includes(id)).length, 'só as zonas da parte em curso');
  assert.equal(sim.q.zona.crescimento({ zona: 99 }), null);
  for (const ruim of [{ zona: 0, modo: 'manual' }, { zona: 99, modo: 'manual' }, { zona: z, modo: 'x' }, { zona: z }, {}, { zona: 'resBaixa', modo: 3 }]) {
    assert.equal(sim.cmd('zona.modo', ruim).codigo, 'valor', JSON.stringify(ruim));
  }
  assert.equal(sim.cmd('zona.modo', { zona: z, modo: 'automatico' }).codigo, 'nada', 'já está nesse modo');
  const r = sim.cmd('zona.modo', { zona: 'resBaixa', modo: 'manual' });
  assert.ok(r.ok);
  assert.deepEqual(r.dados, { zona: z, id: 'resBaixa', modo: 'manual', cancelados: 0 });
  assert.equal(sim.q.zona.crescimento({ zona: z }).modo, 'manual');
  assert.equal(sim.q.zona.crescimento({ zona: indiceZona('comBaixa') }).modo, 'automatico', 'vale por zona');
  assert.equal(sim.cmd('zona.modo', { zona: z, modo: 'manual' }).codigo, 'nada');
  assert.ok(sim.cmd('zona.modo', { zona: z, modo: 'automatico' }).ok, 'troca a qualquer hora');
  assert.equal(sim.q.zona.crescimento({ zona: z }).modo, 'automatico');
});

test('zona.lote: só no Manual, de 1 a 1000 inteiro, soma ao que faltava até 1000; 0 cancela', () => {
  const sim = novaSim('zon2-lote');
  const z = indiceZona('resBaixa');
  assert.equal(sim.cmd('zona.lote', { zona: z, n: 10 }).codigo, 'modo', 'no Automático não há lote');
  assert.ok(sim.cmd('zona.modo', { zona: z, modo: 'manual' }).ok);
  for (const ruim of [{}, { zona: z }, { zona: z, n: 1.5 }, { zona: z, n: '10' }, { zona: 0, n: 10 }, { zona: z, n: null }]) {
    assert.equal(sim.cmd('zona.lote', ruim).codigo, 'valor', JSON.stringify(ruim));
  }
  for (const n of [-1, LOTE_MAX + 1, 5000]) assert.equal(sim.cmd('zona.lote', { zona: z, n }).codigo, 'lote', `n = ${n}`);
  assert.equal(sim.cmd('zona.lote', { zona: z, n: 0 }).codigo, 'nada', 'nada a cancelar');
  assert.deepEqual(sim.cmd('zona.lote', { zona: z, n: 10 }).dados, { zona: z, id: 'resBaixa', pedido: 10, cancelados: 0 });
  assert.equal(sim.cmd('zona.lote', { zona: 'resBaixa', n: 15 }).dados.pedido, 25, 'soma');
  assert.equal(sim.cmd('zona.lote', { zona: z, n: LOTE_MAX }).codigo, 'lote', 'passa de 1000 no total');
  assert.equal(sim.cmd('zona.lote', { zona: z, n: LOTE_MAX - 25 }).dados.pedido, LOTE_MAX);
  assert.equal(sim.q.zona.crescimento({ zona: z }).pedido, LOTE_MAX);
  const c = sim.cmd('zona.lote', { zona: z, n: 0 });
  assert.deepEqual(c.dados, { zona: z, id: 'resBaixa', pedido: 0, cancelados: LOTE_MAX });
  assert.equal(sim.q.zona.crescimento({ zona: z }).pedido, 0);
});

test('Manual por lote: a demanda só acumula; o lote pedido começa, ao ritmo de sempre, e para quando acaba; o Automático ao lado cresce sozinho', () => {
  const sim = bairro('zon2-manual', { manual: true });
  const comBaixa = indiceZona('comBaixa');
  const z = indiceZona('resBaixa');
  assert.equal(sim.q.zona.crescimento({ zona: z }).modo, 'manual', 'zona.pintar com modo já deixa a zona em Manual');
  sim.rodar(400, { sincrono: true });
  assert.equal(contar(sim, 'resBaixa').total, 0, 'sem lote nada nasce, mesmo com demanda 100');
  const c1 = sim.q.zona.crescimento({ zona: z });
  assert.ok(c1.espera > 5, `a demanda acumulou ${c1.espera}`);
  assert.ok(c1.frentes > 20 && c1.demanda === 100);
  // pede 12: nascem 12, no máximo 3 por tique, e o lote acaba
  assert.ok(sim.cmd('zona.lote', { zona: z, n: 12 }).ok);
  let maxTique = 0;
  let antes = 0;
  for (let t = 0; t < 40; t++) {
    sim.rodar(1, { sincrono: true });
    const n = contar(sim, 'resBaixa').total;
    maxTique = Math.max(maxTique, n - antes);
    antes = n;
  }
  assert.equal(contar(sim, 'resBaixa').total, 12);
  assert.ok(maxTique <= 3, `${maxTique} num tique`);
  const c2 = sim.q.zona.crescimento({ zona: z });
  assert.equal(c2.pedido, 0);
  assert.ok(c2.espera < c1.espera + 5, 'o lote gasta a espera (cada construção tira uma)');
  sim.rodar(200, { sincrono: true });
  assert.equal(contar(sim, 'resBaixa').total, 12, 'depois do lote nada mais nasce');
  // a zona ao lado, em Automático, cresce pela demanda sem pedir nada
  assert.equal(sim.q.zona.crescimento({ zona: comBaixa }).modo, 'automatico');
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
});

test('Automático como sempre: a demanda faz nascer sozinha; trocar para Manual para o nascimento e voltar para Automático cancela o lote', () => {
  const sim = bairro('zon2-troca');
  const z = indiceZona('resBaixa');
  sim.rodar(300, { sincrono: true });
  const n1 = contar(sim, 'resBaixa').total;
  assert.ok(n1 > 15, `nasceram ${n1} no Automático`);
  assert.ok(sim.cmd('zona.modo', { zona: z, modo: 'manual' }).ok);
  sim.rodar(300, { sincrono: true });
  assert.equal(contar(sim, 'resBaixa').total, n1, 'em Manual nada nasce sem lote');
  assert.ok(sim.q.zona.crescimento({ zona: z }).espera > 5);
  assert.ok(sim.cmd('zona.lote', { zona: z, n: 400 }).ok);
  const volta = sim.cmd('zona.modo', { zona: z, modo: 'automatico' });
  assert.ok(volta.ok);
  assert.equal(volta.dados.cancelados, 400, 'o lote que faltava foi cancelado');
  assert.equal(sim.q.zona.crescimento({ zona: z }).pedido, 0);
  sim.rodar(300, { sincrono: true });
  console.log('DBG', n1, contar(sim, 'resBaixa').total, JSON.stringify(sim.q.zona.crescimento({ zona: z })), sim.json.cidade.acum.resBaixa);
  assert.ok(contar(sim, 'resBaixa').total > n1, 'de volta ao Automático a demanda faz nascer');
  assert.deepEqual(sim.erros, []);
});

test('lote maior que o chão pintado espera as frentes (não perde o pedido) e as consultas não mudam o hash', () => {
  const sim = bairro('zon2-espera', { manual: true });
  const z = indiceZona('resBaixa');
  assert.ok(sim.cmd('zona.lote', { zona: z, n: 1000 }).ok);
  sim.rodar(600, { sincrono: true });
  const c = sim.q.zona.crescimento({ zona: z });
  assert.ok(c.construidos + c.emObra > 40, `nasceram ${c.construidos + c.emObra}`);
  assert.ok(c.pedido > 0 && c.pedido < 1000, `faltam ${c.pedido}`);
  const h = sim.q.hash();
  sim.q.zona.crescimento();
  sim.q.zona.regras();
  sim.q.zona.lugar({ x: -900, z: -1130 });
  sim.q.zona.previa({ pincel: pincel(1000, -440, 1100, -190), zona: z });
  assert.equal(sim.q.hash(), h, 'consulta é pura');
  assert.deepEqual(sim.erros, []);
});

test('zona.regras e zona.lugar dizem as áreas, o vento, os tipos restritos, o custo da linha e os limites do lote', () => {
  const sim = novaSim('zon2-regras');
  const r = sim.q.zona.regras();
  assert.equal(r.ligadas, true);
  assert.equal(r.distrito.id, 'distritoIndustrial');
  assert.deepEqual(r.distrito.zonas, ['industria']);
  assert.ok(r.distrito.tipos.includes('mina') && r.distrito.tipos.includes('cimenteira'));
  assert.equal(r.utilidades.id, 'zonaUtilidades');
  for (const t of ['captacao', 'poco', 'solar', 'ete', 'termica', 'subestacao', 'dataCenter']) assert.ok(r.utilidades.tipos.includes(t), t);
  assert.ok(r.distrito.contorno.every((p) => p.length === 2));
  assert.equal(r.vento.para, 'norte-noroeste');
  assert.deepEqual(r.modos, ['automatico', 'manual']);
  assert.deepEqual(r.lote, { min: 1, max: 1000 });
  assert.ok(r.longoAlcance.custoPorMetro.energia > 0 && r.longoAlcance.alcanceMax > 0);
  assert.deepEqual(sim.q.zona.lugar({ x: -900, z: -1130 }), { distrito: true, utilidades: false });
  assert.deepEqual(sim.q.zona.lugar({ x: -1000, z: 0 }), { distrito: false, utilidades: true });
  assert.deepEqual(sim.q.zona.lugar({ x: 200, z: 190 }), { distrito: false, utilidades: false });
  assert.deepEqual(sim.q.zona.lugar({}), { distrito: false, utilidades: false });
});

// ------------------------------------------------------------------------------------------------ determinismo e save

test('determinismo: duas partidas com o mesmo roteiro de modos e lotes dão o mesmo hash; salvar no meio e carregar segue igual', () => {
  const partida = () => {
    const sim = bairro('zon2-det');
    sim.rodar(120, { sincrono: true });
    sim.cmd('zona.modo', { zona: 'resBaixa', modo: 'manual' });
    sim.rodar(200, { sincrono: true });
    sim.cmd('zona.lote', { zona: 'resBaixa', n: 30 });
    sim.rodar(7, { sincrono: true });
    return sim;
  };
  const A = partida();
  const B = partida();
  assert.equal(A.q.hash(), B.q.hash());
  assert.ok(A.json.zon2.pedido.resBaixa > 0, 'o lote ainda estava em andamento ao salvar');
  const lido = migrar(lerSave(montarSave(A)));
  const C = bairro('zon2-det');
  aplicarSave(C, lido);
  assert.equal(C.q.hash(), A.q.hash());
  assert.deepEqual(C.json.zon2, A.json.zon2);
  A.rodar(300, { sincrono: true });
  C.rodar(300, { sincrono: true });
  assert.equal(C.q.hash(), A.q.hash());
  assert.equal(C.json.zon2.pedido.resBaixa ?? 0, A.json.zon2.pedido.resBaixa ?? 0);
  assert.deepEqual(A.erros, []);
  assert.deepEqual(C.erros, []);
});

test('um save da versão 3 migra para a 4: a seção zon2 nasce vazia e tudo fica em Automático', () => {
  assert.equal(SAVE.versaoSave, 4);
  assert.equal(typeof MIGRACOES[3], 'function');
  const sim = bairro('zon2-migra');
  sim.rodar(150, { sincrono: true });
  const lido = lerSave(montarSave(sim));
  assert.equal(lido.cab.versaoSave, 4);
  lido.cab.versaoSave = 3;
  delete lido.cab.json.zon2;
  migrar(lido);
  assert.equal(lido.cab.versaoSave, 4);
  const C = bairro('zon2-migra');
  aplicarSave(C, lido);
  assert.deepEqual(C.json.zon2, { modo: {}, pedido: {}, espera: {}, linhas: {} });
  assert.equal(C.q.zona.crescimento({ zona: indiceZona('resBaixa') }).modo, 'automatico');
  C.rodar(100, { sincrono: true });
  assert.deepEqual(C.erros, []);
});

// ------------------------------------------------------------------------------------------------ textos

test('toda chave de texto da ZON2 existe, sem travessão, e os códigos novos têm frase', () => {
  const mapa = {};
  registrarTextos((_, m) => Object.assign(mapa, m));
  assert.ok(Object.keys(mapa).length > 30);
  for (const [k, v] of Object.entries(mapa)) {
    assert.ok(!/[—–]/.test(v), `${k}: travessão`);
    assert.ok(temTexto(k), `${k} não está registrada em ui/textos.js`);
  }
  for (const c of ['distrito', 'utilidades', 'modo']) assert.ok(frase(`codigo.${c}`).length > 10, c);
  assert.equal(frase('zon2.lote.pedido', { n: 7 }), 'Faltam 7 construções do lote');
});

// ------------------------------------------------------------------------------------------------ o robô

for (const modo of ['automatico', 'manual']) {
  test(`o robô chega longe no modo ${modo}: a indústria nasce no distrito, as utilidades na zona, sem erro`, () => {
    const { R, sim } = rodarRobo({ horas: 3, semente: 'zon2-robo', modo });
    assert.deepEqual(R.erros, []);
    assert.ok(R.marcoFim.n >= 3, `marco ${R.marcoFim.n}`);
    assert.ok(R.moradores > 1500, `${R.moradores} moradores`);
    const ind = indiceZona('industria');
    const C = sim.tabelas.celulas;
    let celulas = 0;
    for (let c = 0; c < C.n; c++) {
      if (!C.viva[c] || C.zona[c] !== ind) continue;
      celulas++;
      assert.ok(noDistrito(C.x[c], C.z[c]), 'célula industrial fora do distrito');
    }
    assert.ok(celulas > 100, `${celulas} células industriais`);
    const P = sim.tabelas.predios;
    let industriais = 0;
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i]) continue;
      if (P.tipo[i] === TIPO_PREDIO.ZONA && P.zona[i] === ind) {
        industriais++;
        assert.ok(noDistrito(P.x[i], P.z[i]));
      }
    }
    assert.ok(industriais >= 5, `${industriais} prédios industriais`);
    const c = sim.q.zona.crescimento({ zona: ind });
    assert.equal(c.modo, modo);
    for (const z of sim.q.zona.crescimento()) if (z.frentes + z.construidos > 0) assert.equal(z.modo, modo, z.id);
    assert.ok(Object.values(sim.json.zon2.linhas).length >= 0);
    // toda usina e captação construídas estão na zona de utilidades
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.SERVICO) continue;
      const id = SERVICOS_ORDEM[P.modelo[i]];
      if (ehUtilidade(id)) assert.ok(naUtilidades(P.x[i], P.z[i]), `${id} em (${Math.round(P.x[i])}, ${Math.round(P.z[i])}) fora da Zona de Utilidades`);
    }
    assert.deepEqual(sim.erros, []);
  });
}
