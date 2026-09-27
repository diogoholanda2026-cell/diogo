// Testes dos contratos e dos dados da F0: regras do dono com os números exatos, listas fechadas (códigos, comandos,
// consultas, eventos, flags, camadas), formato de q.barra, invariantes do espelho na cidade sintética (e que eles
// pegam erro), dados de vias, zonas, prédios e da Torre, o contrato interno e a árvore 3.1 da parte da F0-A.
// Roda sozinho: node ferramentas/testes/contratos.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REGRAS_DONO, tarifaDoBemEstar, faixaDaTarifa, tempoDoLote, CAIXA_INICIAL } from '../../fonte/data/economia.js';
import { CODIGOS, ehCodigo } from '../../fonte/contratos/codigos.js';
import { COMANDOS } from '../../fonte/contratos/comandos.js';
import { CONSULTAS, EXEMPLO_BARRA } from '../../fonte/contratos/consultas.js';
import { EVENTOS } from '../../fonte/contratos/eventos.js';
import { PREDIO, ARESTA } from '../../fonte/contratos/flags.js';
import { CAMADAS } from '../../fonte/contratos/camadas.js';
import { COLUNAS, angDaCelula, progressoObra, faseObra, REF_BASE } from '../../fonte/contratos/espelho.js';
import { criarAgregados, SERVICOS_INTERNOS } from '../../fonte/contratos/interno.js';
import { API_RENDER, ORCAMENTO, GUARDA_MALI, FAMILIAS, statsVazio } from '../../fonte/contratos/render.js';
import { SAVE } from '../../fonte/contratos/save.js';
import { TAREFAS } from '../../fonte/contratos/tarefas.js';
import { VIAS, VIAS_ORDEM } from '../../fonte/data/vias.js';
import { ZONAS, ZONAS_ORDEM } from '../../fonte/data/zonas.js';
import { PREDIOS, PREDIOS_ORDEM, modelosDaZona } from '../../fonte/data/predios.js';
import { TORRE_LAMINA, GLEBA_ENVELOPE, TORRE_POSICAO } from '../../fonte/data/arcologia-plano.js';
import { criarSim } from '../../fonte/sim/nucleo.js';
import { criarSimulacao, DOMINIOS } from '../../fonte/sim/estado.js';
import { funcoesDoTrabalhador, responder } from '../../fonte/sim/trabalhador.js';
import { gerarCidadeSintetica, conferirSintetica, SINTETICA } from '../cidade-sintetica.mjs';
import { semComentarios } from '../guarda-texto.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// ------------------------------------------------------------------------------------------------ regras do dono

test('REGRAS_DONO: números exatos do dono, congelados', () => {
  assert.deepEqual(REGRAS_DONO.lote, { min: 1, max: 10, fatorTempo: 0.8 });
  assert.equal(REGRAS_DONO.deposito.venda, 1.5);
  assert.equal(REGRAS_DONO.deposito.precoBase, 'catalogo');
  assert.equal(REGRAS_DONO.deposito.vendasPorJanela, 100);
  assert.equal(REGRAS_DONO.deposito.janelaTiques, 14400);
  assert.equal(REGRAS_DONO.deposito.janelaHoras * 3600, REGRAS_DONO.deposito.janelaTiques);
  assert.deepEqual(REGRAS_DONO.emprestimo, { porAno: 50000, taxaAno: 0.1, dividaMax: 500000, passo: 1000, prazoAnos: 10, mora: 0.2 });
  assert.deepEqual(REGRAS_DONO.renda.tarifas, [5, 8, 11]);
  assert.deepEqual(REGRAS_DONO.renda.limiares, [30.5, 60.5]);
  assert.equal(REGRAS_DONO.renda.tarifaPor, 'cidade');
  assert.equal(REGRAS_DONO.renda.horaTiques, 3600);
  // congelado em todos os níveis
  assert.ok(Object.isFrozen(REGRAS_DONO) && Object.isFrozen(REGRAS_DONO.emprestimo) && Object.isFrozen(REGRAS_DONO.renda.tarifas));
  assert.throws(() => {
    'use strict';
    REGRAS_DONO.emprestimo.porAno = 1;
  });
  assert.equal(REGRAS_DONO.emprestimo.porAno, 50000);
  assert.equal(CAIXA_INICIAL, 300000);
});

test('tarifa arredondada antes da faixa (D11): 30,4 dá 5; 30,5 dá 8; 60,4 dá 8; 60,5 dá 11', () => {
  assert.deepEqual([30.4, 30.5, 60.4, 60.5].map(tarifaDoBemEstar), [5, 8, 8, 11]);
  assert.deepEqual([0, 30, 31, 60, 61, 100].map(tarifaDoBemEstar), [5, 5, 8, 8, 11, 11]);
  assert.deepEqual(faixaDaTarifa(64), { faixa: [61, 100], margem: { degrau: 61, delta: 3 } });
  assert.deepEqual(faixaDaTarifa(45.2), { faixa: [31, 60], margem: { degrau: 31, delta: 14 } });
  assert.deepEqual(faixaDaTarifa(12), { faixa: [0, 30], margem: { degrau: null, delta: null } });
  // sem número (cidade vazia, 0/0) é a tarifa de 5, nunca a de 11; fora de 0 a 100 fica preso na borda
  assert.deepEqual([NaN, undefined, -3, 140].map(tarifaDoBemEstar), [5, 5, 5, 11]);
  assert.deepEqual(faixaDaTarifa(NaN), { faixa: [0, 30], margem: { degrau: null, delta: null } });
  assert.deepEqual(faixaDaTarifa(-3).faixa, [0, 30]);
  assert.deepEqual(faixaDaTarifa(120), { faixa: [61, 100], margem: { degrau: 61, delta: 39 } });
  assert.equal(tempoDoLote(70, 10), 8 * tempoDoLote(70, 1)); // lote de 10 leva 8 vezes o de 1
  assert.equal(tempoDoLote(70, 1), 70);
});

// ------------------------------------------------------------------------------------------------ listas fechadas

test('comandos: códigos no contrato, exemplos em JSON puro, donos definidos', () => {
  for (const [nome, c] of Object.entries(COMANDOS)) {
    assert.ok(c.dono, `${nome} sem dono`);
    for (const k of c.codigos) assert.ok(ehCodigo(k), `${nome}: código ${k} fora de codigos.js`);
    assert.deepEqual(JSON.parse(JSON.stringify(c.exemplo)), c.exemplo, `${nome}: exemplo não é JSON puro`);
  }
  for (const nome of ['velocidade', 'via.construir', 'zona.pintar', 'construir', 'demolir', 'linha.ordem', 'deposito.vender', 'emprestimo.tomar', 'arcologia.iniciar', 'acelerar', 'holding.identidade']) {
    assert.ok(COMANDOS[nome], `falta o comando ${nome}`);
  }
  assert.equal(COMANDOS.velocidade.livro, false);
  assert.ok(Object.keys(CODIGOS).length >= 30);
});

test('núcleo: registros só aceitam nomes do contrato; F0 publica velocidade, barra, hash e camada', () => {
  const sim = criarSim();
  assert.throws(() => sim.registrarComando('inventado', () => {}), /fora do contrato/);
  assert.throws(() => sim.registrarConsulta('inventada', () => {}), /fora do contrato/);
  assert.throws(() => sim.on('inventado', () => {}), /fora do contrato/);
  assert.throws(() => sim.emitir('inventado', {}), /fora do contrato/);
  assert.throws(() => sim.registrarComando('velocidade', () => {}), /repetido/);
  // substituto troca sem erro
  sim.registrarComando('holding.identidade', () => ({ ok: true }));
  for (const nome of ['barra', 'hash', 'camada']) assert.ok(CONSULTAS[nome] && typeof sim.q[nome] === 'function');
  assert.equal(sim.cmd('velocidade', { v: 4 }).codigo, 'valor');
  let ouvido = null;
  sim.on('velocidade', (d) => (ouvido = d.v));
  assert.equal(sim.cmd('velocidade', { v: 3 }).ok, true);
  assert.equal(ouvido, 3);
  assert.equal(sim.espelho.tempo.mult, 4);
  // consulta com ponto vira objeto
  sim.registrarConsulta('via.previa', (s, x) => x * 2);
  assert.equal(sim.q.via.previa(21), 42);
  for (const nome of Object.keys(EVENTOS)) assert.equal(typeof EVENTOS[nome], 'string');
});

test('q.barra segue o formato do contrato', () => {
  const sim = criarSimulacao({ semente: 'barra', dominios: false });
  const b = sim.q.barra();
  const chaves = (o) => Object.keys(o).sort();
  assert.deepEqual(chaves(b), chaves(EXEMPLO_BARRA));
  for (const k of ['margem', 'demanda', 'data', 'marco']) assert.deepEqual(chaves(b[k]), chaves(EXEMPLO_BARRA[k]), k);
  assert.equal(b.creditos, CAIXA_INICIAL);
  assert.deepEqual(b.data, { mes: 1, ano: 1, fracMes: 0, fase: 'manha' });
  assert.equal(b.marco.nome, 'Canteiro');
  // a parte da barra de outra parcela completa o objeto
  sim.registrarParteBarra('teste', (x) => {
    x.divida = 10;
  });
  assert.equal(sim.q.barra().divida, 10);
  // caixa zerado vira alerta grave
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  const z = sim.q.barra();
  assert.equal(z.caixaZerado, true);
  assert.equal(z.alertas[0].gravidade, 'grave');
});

test('flags: bits distintos e potências de 2; camadas 6 + 7 (D29)', () => {
  for (const grupo of [PREDIO, ARESTA]) {
    const v = Object.values(grupo);
    assert.equal(new Set(v).size, v.length);
    for (const x of v) assert.equal(x & (x - 1), 0);
  }
  assert.equal(PREDIO.SEM_MATERIAL, 1 << 10);
  const ids = Object.keys(CAMADAS);
  assert.equal(ids.length, 13);
  assert.deepEqual(ids.filter((k) => CAMADAS[k].parte === 'M1a').sort(), ['agua', 'bemEstar', 'energia', 'recursos', 'servicos', 'zonas']);
});

test('render, save e tarefas: listas do contrato', () => {
  for (const k of ['quadro', 'camera.irPara', 'selecionar', 'projetar', 'raio', 'camadas.mostrar', 'ferramenta.fantasma', 'marcadores.definir', 'stats', 'bancada', 'capa', 'voo']) {
    assert.ok(API_RENDER[k], k);
  }
  assert.deepEqual(GUARDA_MALI, { amostradoresPorEstagio: 12, varyings: 12, uniformesF: 200, atributos: 14 });
  assert.deepEqual([ORCAMENTO.media.calls, ORCAMENTO.media.tris, ORCAMENTO.ultra.calls, ORCAMENTO.ultra.tris, ORCAMENTO.leve.calls, ORCAMENTO.leve.tris], [300, 900000, 1500, 5000000, 200, 500000]);
  const alvo = Object.values(ORCAMENTO.media.familias).reduce((s, f) => s + f.alvo, 0);
  assert.ok(alvo >= 600000 && alvo <= 640000, `alvo do Média ${alvo}`);
  assert.deepEqual(Object.keys(ORCAMENTO.media.familias).sort(), [...FAMILIAS].sort());
  assert.deepEqual(Object.keys(statsVazio().familias), [...FAMILIAS]);
  assert.equal(SAVE.magica, 'HELD');
  assert.equal(SAVE.formato, 1);
  assert.equal(TAREFAS.transito.K, 60);
  const fns = funcoesDoTrabalhador();
  const { resposta, transferir } = responder(fns, { id: 3, nome: 'prova', tique: 0, entrada: { valores: new Float64Array([1, 2, 3]) } });
  assert.equal(resposta.id, 3);
  assert.equal(resposta.saida.n, 3);
  assert.equal(transferir.length, 1);
  assert.match(responder(fns, { id: 4, nome: 'nada', entrada: {} }).resposta.erro, /desconhecida/);
});

test('contrato interno: substitutos e implementar()', () => {
  const sim = criarSimulacao({ semente: 'interno', dominios: false });
  assert.deepEqual(Object.keys(sim.agregados).sort(), Object.keys(criarAgregados()).sort());
  for (const [nome, def] of Object.entries(SERVICOS_INTERNOS)) {
    if (!def.funcoes.length) continue;
    for (const f of def.funcoes) assert.equal(typeof sim[nome][f], 'function', `${nome}.${f}`);
  }
  assert.equal(sim.progresso.liberado('qualquer'), true);
  const id = sim.holding.entregar({ item: 'brita', n: 10, aoChegar: (e) => (sim._chegou = e.n) });
  assert.equal(id, 1);
  assert.equal(sim._chegou, 10);
  assert.equal(sim.substitutoAtivo('economia'), true);
  sim.implementar('economia', {});
  assert.equal(sim.substitutoAtivo('economia'), false);
  sim.implementar('holding', { caixa: () => 7 });
  assert.equal(sim.q.barra().creditos, 7);
  assert.throws(() => sim.implementar('holding', { inventada: () => 0 }), /contrato interno/);
  // custos por hora entram no saldo da barra
  sim.custos.registrar('vias', () => 360);
  assert.equal(sim.custos.total(), 360);
  assert.equal(sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: 5000, no: 0 }), 1);
  assert.throws(() => sim.redes.produtor({ tipo: 'gas' }));
  assert.equal(sim.travessia.consultar({}), null);
  sim.travessia.registrar(() => ({ ponte: true }));
  assert.deepEqual(sim.travessia.consultar({}), { ponte: true });
});

// ------------------------------------------------------------------------------------------------ dados

test('vias: perfil transversal soma a largura; tipos da D22', () => {
  assert.deepEqual([...VIAS_ORDEM].sort(), Object.keys(VIAS).sort());
  const largura = { rua: 16, ruaMao: 16, avenida: 24, avenidaG: 32, rodovia: 28, terra: 10 };
  for (const [id, v] of Object.entries(VIAS)) {
    assert.equal(v.largura, largura[id], id);
    const soma = v.perfil.reduce((s, p) => s + p.largura, 0);
    assert.ok(Math.abs(soma - v.largura) < 1e-9, `${id}: perfil ${soma} x largura ${v.largura}`);
    const ida = v.perfil.filter((p) => p.parte === 'faixa' && p.sentido === 1).length;
    const volta = v.perfil.filter((p) => p.parte === 'faixa' && p.sentido === -1).length;
    assert.deepEqual([ida, volta], v.faixas, `${id}: faixas`);
  }
  assert.equal(VIAS.terra.redes, false);
  assert.deepEqual(VIAS.terra.melhoraPara, ['rua']);
});

test('zonas e prédios: 4 + 3 zonas, catálogo com 5 níveis por modelo (D20, D23)', () => {
  assert.equal(ZONAS_ORDEM[0], '');
  assert.deepEqual(ZONAS_ORDEM.slice(1).sort(), Object.keys(ZONAS).sort());
  assert.equal(Object.values(ZONAS).filter((z) => z.parte === 'M1a').length, 4);
  assert.equal(ZONAS.resBaixa.cor, '#199e70');
  assert.equal(ZONAS.industria.cor, '#c98500');
  for (const z of Object.keys(ZONAS)) assert.ok(modelosDaZona(z).length >= 2, `zona ${z} sem modelos`);
  for (const id of PREDIOS_ORDEM) {
    const m = PREDIOS[id];
    assert.ok(ZONAS[m.zona], id);
    assert.ok(m.planta[0] >= 1 && m.planta[1] >= 1 && m.planta[1] <= 6, `${id}: planta`);
    assert.equal(m.niveis.length, 5);
    const res = m.zona.startsWith('res');
    m.niveis.forEach((n, k) => {
      assert.ok(n.andares[0] <= n.andares[1], `${id} nível ${k + 1}: andares`);
      if (res) assert.ok(n.moradores > 0 && n.lares > 0 && n.empregos.every((e) => e === 0));
      else assert.ok(n.moradores === 0 && n.empregos.reduce((a, b) => a + b, 0) > 0);
      assert.ok(Object.keys(n.materiais).length > 0);
      if (k) assert.ok((res ? n.moradores : n.empregos.reduce((a, b) => a + b, 0)) >= (res ? m.niveis[k - 1].moradores : m.niveis[k - 1].empregos.reduce((a, b) => a + b, 0)));
    });
  }
});

test('Torre Lâmina (D27): as contas das cotas fecham', () => {
  const T = TORRE_LAMINA;
  assert.deepEqual([T.planta.largura, T.planta.comprimento], [36, 50]);
  assert.equal(T.laminas.reduce((s, l) => s + l.fundo, 0), 50);
  assert.deepEqual(T.laminas.map((l) => l.topo), [301, 238, 163]);
  const alturaCorpo = T.pavimentos.n * T.pavimentos.altura + T.andaresDeVento.reduce((s, a) => s + a.altura, 0);
  assert.ok(Math.abs(T.podio.altura + alturaCorpo - 301) < 1e-9);
  assert.equal(T.coroa.base + T.coroa.altura, T.heliponto.cota);
  assert.equal(T.heliponto.cota, 330);
  assert.equal(T.mastro.topo, 350);
  // os andares de vento ficam no topo das lâminas 3 e 2
  assert.equal(T.andaresDeVento[0].base, T.laminas[2].topo);
  assert.equal(T.andaresDeVento[1].base + T.andaresDeVento[1].altura, T.laminas[1].topo);
  // a Torre fica dentro do envelope da gleba, que fica dentro da área inicial de 4 x 4 ladrilhos
  const [x0, z0, x1, z1] = GLEBA_ENVELOPE.caixa;
  assert.ok(TORRE_POSICAO.x > x0 && TORRE_POSICAO.x < x1 && TORRE_POSICAO.z > z0 && TORRE_POSICAO.z < z1);
  for (const v of GLEBA_ENVELOPE.contorno) assert.ok(v >= -1024 && v <= 1024);
});

test('espelho: convenções e invariantes (que pegam erro)', () => {
  assert.equal(REF_BASE, 2 ** 20);
  // célula à direita de uma via que vai para leste fica ao sul e olha para o norte
  assert.ok(Math.abs(angDaCelula(1, 0, 1) - Math.PI) < 1e-12);
  assert.ok(Math.abs(angDaCelula(1, 0, -1)) < 1e-12);
  assert.equal(progressoObra(150, 0, 100, 200), 0.5);
  assert.equal(faseObra(0.05), 0);
  assert.equal(faseObra(0.5), 2);
  // as colunas da seção 2.4 estão todas lá
  const esperadas = {
    nos: ['x', 'y', 'z', 'grau', 'raio'],
    arestas: ['a', 'b', 'tipo', 'p', 'y', 'comp', 'corte', 'mao', 'flags', 'idade'],
    celulas: ['x', 'z', 'y', 'ang', 'zona', 'estado', 'predio', 'aresta', 'lado', 'linha'],
    predios: ['tipo', 'modelo', 'zona', 'x', 'z', 'y', 'rot', 'w', 'd', 'nivel', 'estilo', 'semente', 'flags', 'obraIni', 'obraFim', 'cor', 'moradores', 'empregos'],
  };
  for (const [t, cols] of Object.entries(esperadas)) for (const c of cols) assert.ok(COLUNAS[t][c], `${t}.${c}`);
});

test('cidade sintética pelas APIs: 12 mil prédios de todas as zonas e níveis, invariantes do espelho', () => {
  const t0 = performance.now();
  const { sim, resumo } = gerarCidadeSintetica({ cronometro: () => performance.now() });
  const ms = performance.now() - t0;
  assert.equal(resumo.predios, SINTETICA.predios);
  assert.equal(Object.keys(resumo.porZona).length, 7, JSON.stringify(resumo.porZona));
  assert.ok(resumo.porNivel.every((n) => n > 0));
  assert.ok(Object.keys(resumo.porTipo).length >= 5, JSON.stringify(resumo.porTipo));
  assert.ok(resumo.ligacoes > 5);
  const esp = sim.espelho;
  const aguas = new Set(esp.terreno.agua);
  for (const a of [0, 1, 2, 3]) assert.ok(aguas.has(a), `água ${a}`);
  assert.ok(esp.floresta.dens.some((d) => d > 200));
  assert.ok(esp.arcologia.etapas.find((e) => e.id === 'torre.e4').estado === 3);
  assert.ok(esp.entregas.length > 0 && esp.entregas[0].caminho.length > 3);
  const A = esp.vias.arestas;
  let arcologia = 0;
  let rodovia = 0;
  let curvas = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    if (A.flags[e] & ARESTA.ARCOLOGIA) arcologia++;
    if (A.flags[e] & ARESTA.RODOVIA) rodovia++;
    // curva: um ponto de controle a mais de 1 m da corda
    const o = 8 * e;
    const dx = A.p[o + 6] - A.p[o];
    const dz = A.p[o + 7] - A.p[o + 1];
    const L = Math.hypot(dx, dz);
    const desvio = (k) => Math.abs((A.p[o + k] - A.p[o]) * dz - (A.p[o + k + 1] - A.p[o + 1]) * dx) / L;
    if (Math.max(desvio(2), desvio(4)) > 1) curvas++;
  }
  assert.ok(arcologia >= 4 && rodovia >= 4 && curvas > 500, `${arcologia} ${rodovia} ${curvas}`);
  // prédios em obra e abandonados para o render
  const P = esp.predios;
  let obras = 0;
  let abandonados = 0;
  for (let i = 0; i < P.n; i++) {
    if (P.flags[i] & PREDIO.OBRA) obras++;
    if (P.flags[i] & PREDIO.ABANDONADO) abandonados++;
  }
  assert.ok(obras > 50 && abandonados > 20);
  assert.deepEqual(conferirSintetica(sim), []);
  assert.deepEqual(sim.validar(), []);
  // a mesma semente dá a mesma cidade
  const outra = gerarCidadeSintetica();
  assert.equal(outra.sim.q.hash(), sim.q.hash());
  // os invariantes pegam erro: prédio girado, ponta da aresta fora do nó, cota errada
  const i = [...Array(P.n).keys()].find((k) => P.viva[k]);
  const rot = P.rot[i];
  P.rot[i] = rot + Math.PI / 2;
  assert.ok(conferirSintetica(sim).some((e) => e.regra === 'frente' || e.regra === 'dentro'));
  P.rot[i] = rot;
  P.y[i] += 1;
  assert.ok(conferirSintetica(sim).some((e) => e.regra === 'cota'));
  P.y[i] -= 1;
  const e = [...Array(A.n).keys()].find((k) => A.viva[k]);
  A.p[8 * e] += 0.5;
  assert.ok(conferirSintetica(sim).some((x) => x.regra === 'p0'));
  A.p[8 * e] -= 0.5;
  // planta maior que as células (as células continuam dentro dela): só a contagem pega
  P.w[i] += 8;
  assert.ok(conferirSintetica(sim).some((x) => x.regra === 'celulas' && x.idx === i));
  P.w[i] -= 8;
  assert.deepEqual(conferirSintetica(sim), []);
  console.log(`cidade sintética: ${resumo.predios} prédios, ${resumo.arestas} arestas, ${resumo.celulas.total} células, ${resumo.populacao} moradores em ${ms.toFixed(0)} ms`);
});

// ------------------------------------------------------------------------------------------------ árvore 3.1

const ARVORE_SIM = [
  'nucleo.js', 'estado.js', 'tabela.js', 'grade.js', 'agregados.js', 'substitutos.js', 'tarefas.js', 'trabalhador.js', 'livro.js',
  'formas.js', 'consultas/barra.js', 'salvar/formato.js', 'vias/grafo.js',
  'mundo/terreno.js', 'mundo/agua.js', 'mundo/recursos.js', 'mundo/floresta.js', 'mundo/ladrilhos.js', 'mundo/aplainar.js',
  'mundo/vila.js', 'mundo/areas.js', 'vias/ferramenta.js', 'vias/encaixe.js', 'vias/validar.js', 'vias/demolir.js',
  'vias/nomes.js', 'zonas/blocos.js', 'zonas/pincel.js', 'transito.js', 'tarefas/transito.js', 'vias/ponte.js',
  'zonas/demanda.js', 'zonas/crescimento.js', 'predios.js', 'cidadaos.js', 'bemestar.js', 'servicos.js', 'redes.js',
  'ambiente.js', 'mercadoria.js', 'economia.js', 'progresso.js', 'objetivos.js', 'historia.js', 'holding/producao.js',
  'holding/mercado.js', 'holding/logistica.js', 'arcologia.js',
];
const ARVORE_OUTROS = [
  'comum/rng.js', 'comum/hash.js', 'comum/relogio.js', 'comum/bezier.js', 'comum/heap.js', 'comum/caminhos.js', 'comum/altura.js',
  'comum/vetor.js', 'comum/util.js', 'contratos/codigos.js', 'contratos/comandos.js', 'contratos/consultas.js',
  'contratos/eventos.js', 'contratos/flags.js', 'contratos/camadas.js', 'contratos/espelho.js', 'contratos/interno.js',
  'contratos/render.js', 'contratos/save.js', 'contratos/tarefas.js', 'data/vias.js', 'data/zonas.js', 'data/predios.js',
  'data/mapa-heldopolis.js', 'data/servicos.js', 'data/colocaveis.js', 'data/economia.js', 'data/holding.js', 'data/marcos.js',
  'data/historia.js', 'data/nomes.js', 'data/objetivos.js', 'data/arcologia-plano.js', 'data/arcologia.js', 'data/estilos.js',
];

test('árvore 3.1 (parte da F0-A): todo arquivo existe; os de fonte/sim exportam registrar e entram no índice', async () => {
  for (const f of ARVORE_OUTROS) assert.ok(existsSync(join(RAIZ, 'fonte', f)), `falta fonte/${f}`);
  const noIndice = new Set(DOMINIOS.map(([c]) => `${c}.js`));
  const nucleoF0 = new Set(['nucleo.js', 'estado.js', 'tabela.js', 'grade.js', 'agregados.js', 'substitutos.js', 'tarefas.js', 'trabalhador.js', 'livro.js', 'formas.js', 'consultas/barra.js', 'salvar/formato.js', 'vias/grafo.js']);
  for (const f of ARVORE_SIM) {
    const arq = join(RAIZ, 'fonte/sim', f);
    assert.ok(existsSync(arq), `falta fonte/sim/${f}`);
    const m = await import(pathToFileURL(arq).href);
    if (nucleoF0.has(f)) continue;
    assert.equal(typeof m.registrar, 'function', `fonte/sim/${f} sem registrar()`);
    assert.ok(noIndice.has(f), `fonte/sim/${f} fora do índice de estado.js`);
    const src = readFileSync(arq, 'utf8');
    assert.match(src.split('\n')[0], /^\/\/ .+(dona|F0)/, `fonte/sim/${f}: primeira linha diz o que é e quem é a dona`);
  }
  assert.equal(noIndice.size, DOMINIOS.length);
  // a simulação completa monta com todos os domínios
  const sim = criarSimulacao({ semente: 'arvore' });
  assert.equal(sim.rodar(60), 60);
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
});

test('matemática determinística: fonte/sim, fonte/comum e contratos sem Math trigonométrica, exp, log, pow nem **', () => {
  // essas funções mudam de bits entre versões do V8 (o Chromium de teste já diverge do Node no cosseno); use
  // sen, cos, atan, atan2, hipot, exp, log e pot de fonte/comum/util.js. O integrador pode levar esta regra à guarda.
  const proibido = /\bMath\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|hypot|cbrt)\b|[^*/]\*\*[^*/]/;
  const falhas = [];
  const varrer = (dir) => {
    for (const nome of readdirSync(dir).sort()) {
      const f = join(dir, nome);
      if (statSync(f).isDirectory()) varrer(f);
      else if (/\.m?js$/.test(nome) && !f.endsWith(join('comum', 'util.js'))) {
        semComentarios(readFileSync(f, 'utf8')).split('\n').forEach((l, i) => {
          if (proibido.test(l)) falhas.push(`${f.slice(RAIZ.length + 1)}:${i + 1}: ${l.trim().slice(0, 80)}`);
        });
      }
    }
  };
  for (const d of ['fonte/sim', 'fonte/comum', 'fonte/contratos']) varrer(join(RAIZ, d));
  assert.deepEqual(falhas, []);
});
