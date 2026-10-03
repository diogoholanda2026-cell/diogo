// Testes do mundo (S1a): mapa autoral, grade de alturas no tempo, relevo assado (controles, codec, emenda do detalhe,
// declives de serra de verdade, sai igual do assador), rio com meandros até a costa e sempre abaixo das margens, área
// inicial num componente de terra (D53), água, aplainar puro e comutativo igual ao de referência bit a bit (D5), chão
// do espelho em dia e depois de carregar, Vila e rodovia, ladrilhos (D3), mata e desmate, recursos e camada, áreas e
// sugestões (D36, D55), save de ida e volta.
// Roda sozinho: node ferramentas/testes/mundo.teste.mjs (o simular --testes descobre e roda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { criarSim } from '../../fonte/sim/nucleo.js';
import { conferirEspelho } from '../../fonte/contratos/espelho.js';
import { AGUA, ARESTA, LADRILHO, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { CAMADAS } from '../../fonte/contratos/camadas.js';
import { alturaEm } from '../../fonte/comum/altura.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';
import { pontoNoPoligono } from '../../fonte/comum/vetor.js';
import { aplainarReferencia } from '../../fonte/sim/substitutos.js';
import { normalizarForma } from '../../fonte/sim/formas.js';
import { montarSave, lerSave, aplicarSave } from '../../fonte/sim/salvar/formato.js';
import { VIAS_ORDEM } from '../../fonte/data/vias.js';
import { MAPA_HELDOPOLIS } from '../../fonte/data/mapa-heldopolis.js';
import { MARCOS } from '../../fonte/data/marcos.js';
import { GLEBA_ENVELOPE, PLANOS, PLANO_ESCOLHIDO } from '../../fonte/data/arcologia-plano.js';
import { gerarTerreno, esquecerTerreno, terrenoBase, rioEm, aguaEm, costaEm } from '../../fonte/sim/mundo/terreno.js';
import { aplainar, aplainarTudo, formaDaAresta } from '../../fonte/sim/mundo/aplainar.js';
import { concederLicencas, preco, ladrilhoDe } from '../../fonte/sim/mundo/ladrilhos.js';
import { extrair, RECURSOS, recursoNoPoligono } from '../../fonte/sim/mundo/recursos.js';
import { densidadeEm } from '../../fonte/sim/mundo/floresta.js';
import { nivelAguaEm, contarAgua } from '../../fonte/sim/mundo/agua.js';
import { readFileSync } from 'node:fs';
import { conferirMapa, assar, ARQUIVO_ASSADO } from '../mapa.mjs';
import { RELEVO_ASSADO } from '../../fonte/sim/mundo/relevo-assado.js';
import { hashControles, decodificar, ESCALA_RELEVO, VERSAO_ASSADO } from '../../fonte/sim/mundo/relevo.js';
import { codificar } from '../../fonte/sim/mundo/erosao.js';

const agora = () => performance.now();

// sorteio próprio dos testes (fora da simulação)
function sorteio(semente = 1) {
  let a = semente >>> 0 || 1;
  return () => {
    a ^= a << 13;
    a >>>= 0;
    a ^= a >>> 17;
    a ^= a << 5;
    a >>>= 0;
    return a / 4294967296;
  };
}

const hashGrade = (g) => fnv1aTipado(new Uint8Array(g.buffer, g.byteOffset, g.byteLength));
const hexDe = (g) => (fnv1aTipado(g) >>> 0).toString(16).padStart(8, '0');
const simDoMapa = (semente = 'mundo') => criarSimulacao({ semente });

// ------------------------------------------------------------------------------------------------ grade

test('mapa: grade 1025² a 8 m gerada em até 150 ms (motor aquecido), determinística, finita e em faixas reais', () => {
  const a = gerarTerreno();
  const hA = hashGrade(a.altura);
  // motor aquecido: duas gerações a mais antes de medir (o otimizador do JavaScript termina de compilar os laços)
  for (let r = 0; r < 2; r++) {
    esquecerTerreno(MAPA_HELDOPOLIS.id);
    gerarTerreno();
  }
  // tempo de CPU da thread principal (a máquina de teste roda outras parcelas junto: o relógio de parede mede a fila,
  // e o do processo soma as threads do coletor e do compilador); o melhor de 6
  const cpu = process.threadCpuUsage ? () => process.threadCpuUsage() : () => process.cpuUsage();
  const medidas = [];
  const paredes = [];
  let b = null;
  for (let r = 0; r < 6; r++) {
    esquecerTerreno(MAPA_HELDOPOLIS.id);
    const c0 = cpu();
    const t0 = agora();
    b = gerarTerreno();
    paredes.push(agora() - t0);
    const c1 = cpu();
    medidas.push((c1.user - c0.user + c1.system - c0.system) / 1000);
  }
  const melhor = Math.min(...medidas);
  console.log(`# grade 1025²: CPU ${medidas.map((m) => m.toFixed(0)).join(', ')} ms; relógio ${paredes.map((m) => m.toFixed(0)).join(', ')} ms`);
  assert.ok(melhor <= 150, `grade em ${melhor.toFixed(0)} ms de CPU (meta 150)`);
  assert.equal(b.n, 1025);
  assert.equal(b.passo, 8);
  assert.deepEqual(b.origem, [-4096, -4096]);
  assert.equal(hashGrade(b.altura), hA, 'duas gerações dão a mesma grade bit a bit');
  assert.equal(hashGrade(b.agua), hashGrade(a.agua));
  let mn = Infinity;
  let mx = -Infinity;
  for (const h of b.altura) {
    assert.ok(Number.isFinite(h));
    if (h < mn) mn = h;
    if (h > mx) mx = h;
  }
  assert.ok(mn > -40 && mn < -10, `fundo do mar ${mn.toFixed(1)} m`);
  assert.ok(mx > 380 && mx < 560, `ponto mais alto ${mx.toFixed(1)} m`);
  const c = contarAgua(b);
  for (const k of ['terra', 'mar', 'rio', 'lagoa']) assert.ok(c[k] > 200, `${k}: ${c[k]} amostras`);
});

test('relevo assado: é deste mapa e dos controles atuais; o codec volta igual; a emenda do detalhe não tem degrau', () => {
  // quem muda serras, morros, costa, rio ou rodovia sem rodar `node ferramentas/mapa.mjs --assar` cai aqui
  assert.ok(RELEVO_ASSADO, 'sem relevo assado');
  assert.equal(RELEVO_ASSADO.versao, VERSAO_ASSADO, 'assado de outra versão do assador: rode node ferramentas/mapa.mjs --assar');
  assert.equal(RELEVO_ASSADO.controles, hashControles(MAPA_HELDOPOLIS), 'assado velho: rode node ferramentas/mapa.mjs --assar');
  const T = gerarTerreno();
  assert.equal(T.assado, true);
  assert.equal(hexDe(decodificar(RELEVO_ASSADO)), RELEVO_ASSADO.hash);
  assert.equal(hexDe(decodificar(RELEVO_ASSADO.detalhe)), RELEVO_ASSADO.detalhe.hash);
  // codec: ida e volta dentro de meia unidade da escala, com zeros, degraus e rampas
  const r = sorteio(3);
  const n = 33;
  const rel = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) rel[j * n + i] = i < 6 ? 0 : j > 20 ? 400 * r() : 3 * i + 2 * j + r();
  const volta = decodificar(codificar(rel, n));
  for (let k = 0; k < n * n; k++) assert.ok(Math.abs(volta[k] - rel[k]) <= ESCALA_RELEVO / 2 + 1e-6, `célula ${k}`);
  // emenda: ao longo da borda da janela do detalhe, o salto entre amostras vizinhas de 8 m não passa do que se vê no
  // resto da encosta (a mesma estatística dentro e na borda)
  const D = RELEVO_ASSADO.detalhe;
  const lado = (D.n - 1) * D.passo;
  let maxBorda = 0;
  for (let t = 0; t <= lado; t += 8) {
    for (const [x, z, dx, dz] of [[D.x0 + t, D.z0, 0, 8], [D.x0 + t, D.z0 + lado, 0, 8], [D.x0, D.z0 + t, 8, 0], [D.x0 + lado, D.z0 + t, 8, 0]]) {
      const a = alturaEm(T, x - dx, z - dz);
      const b = alturaEm(T, x + dx, z + dz);
      const f = (alturaEm(T, x + dx, z + dz) - alturaEm(T, x, z)) - (alturaEm(T, x, z) - alturaEm(T, x - dx, z - dz));
      if (Math.abs(b - a) < 40) maxBorda = Math.max(maxBorda, Math.abs(f));
    }
  }
  assert.ok(maxBorda < 6, `quebra de declive de ${maxBorda.toFixed(1)} m na emenda do detalhe`);
});

test('relevo: serras com declive de Mata Atlântica (sem paredão contínuo) e vales que entalham a encosta', () => {
  const T = gerarTerreno();
  // a frente do Maciço do Held sobre a cidade: declive médio de 40% a 70%, pouca parede acima de 100%
  let n = 0;
  let soma = 0;
  let parede = 0;
  for (let z = -2400; z < -1300; z += 16) {
    for (let x = -2000; x < 2000; x += 16) {
      if (alturaEm(T, x, z) < 60) continue;
      const hx = (alturaEm(T, x + 8, z) - alturaEm(T, x - 8, z)) / 16;
      const hz = (alturaEm(T, x, z + 8) - alturaEm(T, x, z - 8)) / 16;
      const d = Math.sqrt(hx * hx + hz * hz);
      n++;
      soma += d;
      if (d > 1) parede++;
    }
  }
  const medio = soma / n;
  assert.ok(medio > 0.38 && medio < 0.72, `declive médio da serra ${(medio * 100).toFixed(0)}%`);
  assert.ok(parede / n < 0.12, `${((parede / n) * 100).toFixed(1)}% da serra acima de 100%`);
  // vales: ao longo de uma curva de nível a meia encosta a altura sobe e desce (espigões e grotas), não é uma rampa lisa
  let trocas = 0;
  let antes = null;
  let sinal = 0;
  for (let x = -1800; x <= 1800; x += 16) {
    let z = -2400;
    while (z < -1300 && alturaEm(T, x, z) > 180) z += 8;
    if (antes !== null && z !== antes) {
      const s = z > antes ? 1 : -1;
      if (sinal && s !== sinal) trocas++;
      sinal = s;
    }
    antes = z;
  }
  assert.ok(trocas > 20, `a curva de 180 m só serpenteia ${trocas} vezes (encosta lisa)`);
});

test('relevo assado: sai igual do assador (a erosão é determinística e o código não mudou sem assar de novo)', () => {
  // o hash dos controles só vê o mapa; quem muda a planície, o rio ou a erosão no código cai aqui (uns 3 s)
  assert.equal(readFileSync(ARQUIVO_ASSADO, 'utf8'), assar().texto, 'o relevo assado não confere: rode node ferramentas/mapa.mjs --assar');
});

test('rio: a água corre no leito, abaixo das duas margens, da borda do mapa à foz (nada de lâmina no ar)', () => {
  const T = gerarTerreno();
  const R = T.rios[0].pontos;
  const lim = ((T.n - 1) * T.passo) / 2 - 16;
  let margens = 0;
  let pior = Infinity;
  let onde = '';
  for (let q = 4; q + 4 < R.length; q += 4) {
    const [x, z, nivel, larg] = [R[q], R[q + 1], R[q + 2], R[q + 3]];
    if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
    assert.ok(alturaEm(T, x, z) < nivel, `leito acima da água em (${x.toFixed(0)}, ${z.toFixed(0)})`);
    let tx = R[q + 4] - R[q - 4];
    let tz = R[q + 5] - R[q - 3];
    const t = Math.hypot(tx, tz);
    tx /= t;
    tz /= t;
    for (const lado of [1, -1]) {
      const mx = x - tz * lado * (larg / 2 + 16);
      const mz = z + tx * lado * (larg / 2 + 16);
      const h = alturaEm(T, mx, mz);
      if (h < 0.5) continue; // a foz, no mar
      margens++;
      if (h - nivel < pior) {
        pior = h - nivel;
        onde = `(${mx.toFixed(0)}, ${mz.toFixed(0)}): margem ${h.toFixed(1)} m, água ${nivel.toFixed(1)} m`;
      }
    }
  }
  assert.ok(margens > 300, `${margens} margens conferidas`);
  assert.ok(pior > 0, `margem abaixo da água em ${onde}`);
});

test('rio: meandros na várzea (sinuosidade acima de 1,25) e a foz na linha da costa', () => {
  const T = gerarTerreno();
  const R = T.rios[0].pontos;
  // da ponte da BR até a foz: comprimento pelo rio sobre a distância em linha reta
  let ini = -1;
  for (let q = 0; q < R.length; q += 4) if (ini < 0 && R[q + 1] > -1200) ini = q;
  let comp = 0;
  for (let q = ini + 4; q < R.length; q += 4) comp += Math.hypot(R[q] - R[q - 4], R[q + 1] - R[q - 3]);
  const reta = Math.hypot(R[R.length - 4] - R[ini], R[R.length - 3] - R[ini + 1]);
  assert.ok(comp / reta > 1.25, `sinuosidade ${(comp / reta).toFixed(2)}`);
  // a foz fica na costa: o último ponto a menos de 40 m da linha d'água do mar
  const sd = costaEm(T, R[R.length - 4], R[R.length - 3]);
  assert.ok(Math.abs(sd) < 40, `foz a ${sd.toFixed(0)} m da costa`);
});

test('mapa: morros de 150 a 400 m, Pedra do Farol perto de 396 m, platô em disco da sede na cota da gleba (D90)', () => {
  const T = gerarTerreno();
  const topo = (m) => {
    let h = -Infinity;
    for (let dz = -16; dz <= 16; dz += 8) for (let dx = -16; dx <= 16; dx += 8) h = Math.max(h, alturaEm(T, m.x + dx, m.z + dz));
    return h;
  };
  for (const m of MAPA_HELDOPOLIS.morros) {
    const h = topo(m);
    assert.ok(Math.abs(h - m.h) < Math.max(18, m.h * 0.12), `${m.id}: topo ${h.toFixed(0)} m, esperado ${m.h}`);
  }
  // o platô é um disco que cobre o anel viário (até 807 m do centro); a borda desce suave até o terreno natural
  const { cx, cz } = MAPA_HELDOPOLIS.plato.disco;
  for (let a = 0; a < 360; a += 15) {
    for (const r of [0, 300, 600, 810]) {
      const x = cx + r * Math.cos((a * Math.PI) / 180);
      const z = cz + r * Math.sin((a * Math.PI) / 180);
      assert.ok(Math.abs(alturaEm(T, x, z) - MAPA_HELDOPOLIS.plato.cota) < 0.01, `platô em (${x.toFixed(0)}, ${z.toFixed(0)})`);
    }
  }
});

test('água: fundo abaixo do nível em toda amostra de água; mar ligado ao aberto; rio descendo até a foz; lagoas', () => {
  const sim = simDoMapa();
  const T = sim.espelho.terreno;
  const tb = terrenoBase(sim);
  const lagoa = MAPA_HELDOPOLIS.lagoa.nivel;
  let ruins = 0;
  for (let j = 0; j < T.n; j += 3) {
    for (let i = 0; i < T.n; i += 3) {
      const k = j * T.n + i;
      const a = tb.base.agua[k];
      if (!a) continue;
      const h = tb.base.altura[k];
      const x = T.origem[0] + i * T.passo;
      const z = T.origem[1] + j * T.passo;
      const nivel = a === AGUA.MAR ? 0 : a === AGUA.LAGOA ? nivelAguaEm(sim, x, z) : rioEm(tb.base, x, z).nivel;
      if (!(h < nivel)) ruins++;
    }
  }
  assert.equal(ruins, 0, `${ruins} amostras de água com o fundo acima do nível`);
  // todo mar liga ao mar aberto (a borda sul), por água; nada de poça de mar solta em terra
  const ag = tb.base.agua;
  const n = T.n;
  const visto = new Uint8Array(n * n);
  const fila = new Int32Array(n * n);
  let fim = 0;
  for (let i = 0; i < n; i++) {
    const k = (n - 1) * n + i;
    if (ag[k] === AGUA.MAR) {
      visto[k] = 1;
      fila[fim++] = k;
    }
  }
  for (let ini = 0; ini < fim; ini++) {
    const q = fila[ini];
    const i = q % n;
    for (const v of [i > 0 ? q - 1 : -1, i < n - 1 ? q + 1 : -1, q - n, q + n]) {
      if (v < 0 || v >= n * n || visto[v] || ag[v] === AGUA.TERRA) continue;
      visto[v] = 1;
      fila[fim++] = v;
    }
  }
  let solto = 0;
  for (let k = 0; k < n * n; k++) if (ag[k] === AGUA.MAR && !visto[k]) solto++;
  assert.equal(solto, 0, `${solto} amostras de mar sem ligação com o mar aberto`);
  const R = T.rios[0].pontos;
  assert.ok(R.length / 4 > 50);
  for (let q = 4; q < R.length; q += 4) assert.ok(R[q + 2] <= R[q - 2] + 1e-9, 'o nível do rio só desce');
  assert.equal(T.lagoas[0].nivel, lagoa);
  // as lagoas marginais (meandros abandonados) ficam na várzea, fora da área inicial, com água de verdade na grade
  assert.ok(T.lagoas.length >= 3, `${T.lagoas.length} lagoas`);
  for (const l of T.lagoas.slice(1)) {
    const xs = l.contorno.filter((_, q) => q % 2 === 0);
    const zs = l.contorno.filter((_, q) => q % 2 === 1);
    assert.ok(Math.max(...xs) < -1024, `${l.id} dentro da área inicial`);
    let agua = 0;
    for (let z = Math.min(...zs); z <= Math.max(...zs); z += 8) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x += 8) {
        if (aguaEm(T, x, z) === AGUA.LAGOA) {
          agua++;
          assert.equal(nivelAguaEm(sim, x, z), l.nivel, `nível da ${l.id}`);
        }
      }
    }
    assert.ok(agua > 50, `${l.id}: ${agua} amostras de água`);
  }
  assert.equal(nivelAguaEm(sim, 600, 2000), 0);
  assert.equal(nivelAguaEm(sim, -600, 820), lagoa);
  assert.equal(nivelAguaEm(sim, 0, 0), null);
});

test('mapa: área inicial num componente só de terra (D53); rocha, areia e argila dentro, calcário fora (D3), orla dentro (D90)', () => {
  const r = conferirMapa(simDoMapa());
  assert.deepEqual(r.falhas, []);
  assert.equal(r.medidas.componentes, 1);
  // o rio é a borda oeste: corre fora da área inicial, com a margem leste encostando nela (a captação e o Areal
  // chegam na água), e nunca entra mais que 30 m
  const T = gerarTerreno();
  let rioLonge = 0;
  let rioMargem = 0;
  let rioFora = 0;
  const [, z0Ini, x1Ini, z1Ini] = limitesInicio();
  for (let z = z0Ini; z < z1Ini; z += 8) {
    for (let x = -1024; x < x1Ini; x += 8) {
      if (aguaEm(T, x, z) !== AGUA.RIO) continue;
      if (x < -994) rioMargem++;
      else rioLonge++;
    }
    for (let x = -1300; x < -1024; x += 8) if (aguaEm(T, x, z) === AGUA.RIO) rioFora++;
  }
  assert.equal(rioLonge, 0);
  assert.ok(rioMargem > 20, 'a margem leste do rio chega na área inicial');
  assert.ok(rioFora > rioMargem * 3);
});

/** Limites da área inicial no mundo [x0, z0, x1, z1] (D90: 6 x 5 ladrilhos, de x -1.024 a 2.048 e de z -1.536 a 1.024). */
function limitesInicio(mapa = MAPA_HELDOPOLIS) {
  const [[i0, j0], [i1, j1]] = mapa.inicio;
  const L = mapa.ladrilho;
  return [mapa.origem[0] + i0 * L, mapa.origem[1] + j0 * L, mapa.origem[0] + (i1 + 1) * L, mapa.origem[1] + (j1 + 1) * L];
}

test('área inicial (D90): 6 x 5 ladrilhos de x -1.024 a 2.048 e de z -1.536 a 1.024, com o disco da sede dentro', () => {
  assert.deepEqual(limitesInicio(), [-1024, -1536, 2048, 1024]);
  const { centro, raio, contorno } = GLEBA_ENVELOPE;
  for (let k = 0; k < contorno.length; k += 2) {
    const [x, z] = [contorno[k], contorno[k + 1]];
    assert.ok(x > -1024 && x < 2048 && z > -1536 && z < 1024, `gleba fora da área inicial em ${x}, ${z}`);
  }
  // o disco e o platô no mesmo centro; o nó de entrada fica fora do disco, ao norte do portão norte
  assert.deepEqual([MAPA_HELDOPOLIS.plato.disco.cx, MAPA_HELDOPOLIS.plato.disco.cz], centro);
  assert.ok(MAPA_HELDOPOLIS.plato.disco.r >= raio + 40);
  const { x, z } = MAPA_HELDOPOLIS.entrada;
  assert.ok(Math.hypot(x - centro[0], z - centro[1]) > raio + 40 && z < centro[1] - raio);
});

// ------------------------------------------------------------------------------------------------ aplainar

test('aplainar: comutativo e igual ao de referência da F0 bit a bit, com save no meio e cava (D5)', () => {
  const T = gerarTerreno();
  const r = sorteio(7);
  const formas = [];
  for (let k = 0; k < 7; k++) {
    const cx = -300 + r() * 600;
    const cz = -400 + r() * 500;
    if (k % 3 === 0) {
      formas.push({ tipo: 'via', ref: 100 + k, eixo: [cx - 120, cz, 12 + r() * 4, cx, cz + 30, 11, cx + 140, cz + 10, 13], meiaLargura: 8 });
    } else {
      const w = 12 + r() * 30;
      formas.push({ tipo: k % 3 === 1 ? 'plataforma' : 'cava', ref: 10 + k, contorno: [cx, cz, cx + w, cz, cx + w, cz + w, cx, cz + w], cota: 8 + r() * 6 });
    }
  }
  const ret = [-600, -700, 600, 400];
  const jogar = (ordem, salvarNoMeio = false) => {
    let sim = criarSim({ semente: 'aplainar' });
    const grade = T.altura.slice();
    let v = sim.mudancas.desde(-1).versao;
    ordem.forEach((k, i) => {
      if (salvarNoMeio && i === 3) {
        const novo = criarSim({ semente: 'aplainar' });
        aplicarSave(novo, lerSave(montarSave(sim)));
        sim = novo;
        v = sim.mudancas.desde(-1).versao;
      }
      sim.formas.registrar(formas[k]);
      const d = sim.mudancas.desde(v);
      v = d.versao;
      for (const q of d.terreno) aplainar(T, sim.formas.porId.values(), q, grade);
    });
    return grade;
  };
  const a = jogar([0, 1, 2, 3, 4, 5, 6]);
  const b = jogar([6, 5, 4, 3, 2, 1, 0]);
  const c = jogar([3, 0, 6, 1, 5, 2, 4], true);
  const norm = formas.map(normalizarForma);
  const ref = aplainarReferencia(T, norm, ret, T.altura.slice());
  const tudo = aplainarTudo(T, norm, new Float32Array(T.altura.length));
  assert.equal(hashGrade(a), hashGrade(b));
  assert.equal(hashGrade(a), hashGrade(c));
  assert.equal(hashGrade(a), hashGrade(ref), 'igual ao aplainar de referência da F0');
  assert.equal(hashGrade(a), hashGrade(tudo), 'refazer tudo dá o mesmo que refazer por retângulos');
});

test('aplainar: o chão do espelho segue as formas na hora, volta ao remover e sai igual depois de carregar', () => {
  const sim = simDoMapa('aplainar-espelho');
  const T = sim.espelho.terreno;
  const antes = T.altura.slice();
  const v = sim.mudancas.desde(-1).versao;
  const id = sim.formas.registrar({ tipo: 'plataforma', ref: 999999, contorno: [100, -300, 160, -300, 160, -250, 100, -250], cota: 30 });
  assert.equal(sim.alturaEm(130, -275), 30);
  assert.ok(sim.mudancas.desde(v).terreno.length > 0);
  sim.formas.remover(id);
  assert.equal(hashGrade(T.altura), hashGrade(antes), 'remover volta ao chão de antes, bit a bit');
  // save e carga: a grade não vai no save e sai igual (base mais as formas)
  sim.formas.registrar({ tipo: 'cava', ref: 999998, contorno: [200, -200, 260, -200, 260, -140, 200, -140], cota: 2 });
  const hGrade = hashGrade(T.altura);
  const nova = criarSimulacao({ semente: 'aplainar-espelho' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(hashGrade(nova.espelho.terreno.altura), hGrade);
  assert.equal(nova.hash(), sim.hash());
  assert.deepEqual(nova.validar(), []);
});

// ------------------------------------------------------------------------------------------------ Vila e rodovia

test('Vila e rodovia: ~60 prédios e ~350 moradores, rua principal e terra, ponte, nó de entrada, invariantes', () => {
  const sim = simDoMapa('vila');
  const A = sim.tabelas.arestas;
  const N = sim.tabelas.nos;
  const P = sim.tabelas.predios;
  const M = sim.json.mapa;
  assert.ok(M.predios.length >= 50 && M.predios.length <= 75, `${M.predios.length} prédios`);
  assert.ok(M.moradores >= 330 && M.moradores <= 380, `${M.moradores} moradores`);
  assert.equal(sim.agregados.populacao, M.moradores);
  assert.deepEqual(sim.erros, []);
  assert.deepEqual(sim.validar(), []);
  assert.deepEqual(conferirEspelho(sim.espelho, { alturaEm: (x, z) => sim.alturaEm(x, z) }), []);
  // tipos: rodovia com a flag, uma ponte, rua principal e ruas de terra
  const tipos = {};
  let pontes = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const t = VIAS_ORDEM[A.tipo[e]];
    tipos[t] = (tipos[t] ?? 0) + 1;
    if (t === 'rodovia') assert.ok(A.flags[e] & ARESTA.RODOVIA);
    if (A.flags[e] & ARESTA.PONTE) {
      pontes++;
      // a ponte passa por cima do rio, com vão livre
      const r = rioEm(terrenoBase(sim).base, (A.p[8 * e] + A.p[8 * e + 6]) / 2, (A.p[8 * e + 1] + A.p[8 * e + 7]) / 2);
      assert.ok(r.a < r.hw, 'a ponte cruza o rio');
      assert.ok(Math.min(A.y[2 * e], A.y[2 * e + 1]) > r.nivel + 6, 'vão livre sobre a água');
    }
  }
  assert.equal(pontes, 1);
  assert.ok(tipos.rodovia > 20 && tipos.terra > 10 && tipos.rua >= 2, JSON.stringify(tipos));
  // greide da rodovia até 6%, no vale: cortes e aterros de poucos metros (sem paredão de 40 m na encosta), e menos
  // ainda no trecho em frente à área inicial, fora a cabeceira da ponte
  const base = terrenoBase(sim).base;
  let pior = 0;
  let piorPerto = 0;
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || VIAS_ORDEM[A.tipo[e]] !== 'rodovia') continue;
    const g = Math.abs(A.y[2 * e + 1] - A.y[2 * e]) / A.comp[e];
    assert.ok(g <= 0.06, `rodovia com ${(g * 100).toFixed(1)}% na aresta ${e}`);
    if (A.flags[e] & ARESTA.PONTE) continue;
    for (const no of [A.a[e], A.b[e]]) {
      const d = Math.abs(N.y[no] - alturaEm(base, N.x[no], N.z[no]));
      pior = Math.max(pior, d);
      if (N.x[no] > -1000 && N.x[no] < 1400) piorPerto = Math.max(piorPerto, d);
    }
  }
  assert.ok(pior < 18, `corte ou aterro de ${pior.toFixed(1)} m na rodovia`);
  assert.ok(piorPerto < 8, `corte ou aterro de ${piorPerto.toFixed(1)} m na rodovia em frente à área inicial`);
  // nó de entrada: fim do acesso, ligado à rodovia, dentro da área inicial
  const ent = M.entrada % 1048576;
  assert.ok(N.viva[ent]);
  assert.equal(N.grau[ent], 1);
  const [i, j] = ladrilhoDe(N.x[ent], N.z[ent]);
  assert.equal(sim.espelho.ladrilhos.estado[j * 16 + i], LADRILHO.HOLDING);
  // prédios da Vila: de zona, nível 1 ou 2, sobre terra firme e dentro da área da Vila
  const vila = sim.espelho.areas.find((a) => a.id === 'vila');
  for (const ref of M.predios) {
    const p = ref % 1048576;
    assert.equal(P.tipo[p], TIPO_PREDIO.ZONA);
    assert.ok(P.nivel[p] === 1 || P.nivel[p] === 2);
    assert.ok(pontoNoPoligono(P.x[p], P.z[p], vila.contorno), `prédio ${p} fora da Vila`);
  }
  // determinístico
  const outra = simDoMapa('vila');
  assert.equal(outra.hash(), sim.hash());
});

// ------------------------------------------------------------------------------------------------ ladrilhos

test('ladrilhos (D3, D90): 6 x 5 iniciais, vizinhos à venda, licença, preço, crédito, Influência e o evento', () => {
  const sim = simDoMapa('ladrilhos');
  const L = sim.espelho.ladrilhos;
  let holding = 0;
  let compraveis = 0;
  for (let k = 0; k < 256; k++) {
    if (L.estado[k] === LADRILHO.HOLDING) holding++;
    if (L.estado[k] === LADRILHO.COMPRAVEL) compraveis++;
  }
  assert.equal(holding, 30);
  assert.equal(compraveis, 22);
  assert.equal(L.estado[5 * 16 + 6], LADRILHO.HOLDING);
  assert.equal(L.estado[9 * 16 + 11], LADRILHO.HOLDING);
  assert.equal(L.estado[7 * 16 + 12], LADRILHO.COMPRAVEL);
  assert.equal(L.preco[7 * 16 + 12], 40000);
  assert.equal(sim.cmd('ladrilho.comprar', { i: 12, j: 7 }).codigo, 'licenca');
  concederLicencas(sim, 2);
  assert.equal(sim.q.ladrilhos().licencas, 2);
  assert.equal(sim.cmd('ladrilho.comprar', { i: 14, j: 7 }).codigo, 'vizinho');
  assert.equal(sim.cmd('ladrilho.comprar', { i: 7, j: 7 }).codigo, 'comprado');
  assert.equal(sim.cmd('ladrilho.comprar', { i: 99, j: 7 }).codigo, 'valor');
  const caixa = sim.holding.caixa();
  const eventos = [];
  sim.on('ladrilho', (d) => eventos.push(d));
  assert.equal(sim.cmd('ladrilho.comprar', { i: 12, j: 7 }).ok, true);
  assert.equal(caixa - sim.holding.caixa(), 40000);
  assert.deepEqual(eventos, [{ i: 12, j: 7 }]);
  assert.equal(L.estado[7 * 16 + 13], LADRILHO.COMPRAVEL, 'o vizinho do novo passa a estar à venda');
  assert.equal(preco(sim), 46000, 'o segundo custa 15% mais');
  // Influência 50 tira 10% (S3a publica q.holding; aqui um substituto)
  sim.registrarConsulta('holding', () => ({ influencia: 50 }));
  assert.equal(preco(sim), 41400);
  // sem crédito
  sim.holding.pagar(sim.holding.caixa(), 'teste');
  assert.equal(sim.cmd('ladrilho.comprar', { i: 13, j: 7 }).codigo, 'creditos');
  assert.equal(sim.q.ladrilhos().licencas, 1, 'a recusa não gasta a licença');
  // Modo livre: sem licença e sem preço
  const livre = criarSimulacao({ semente: 'ladrilhos-livre', modo: 'livre' });
  assert.equal(livre.cmd('ladrilho.comprar', { i: 5, j: 8 }).ok, true);
  // save: a posse e as licenças voltam
  const nova = criarSimulacao({ semente: 'ladrilhos' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(nova.espelho.ladrilhos.estado[7 * 16 + 12], LADRILHO.HOLDING);
  assert.equal(nova.q.ladrilhos().licencas, 1);
});

// ------------------------------------------------------------------------------------------------ mata e recursos

test('floresta (D6): mata fechada nas serras, praia sem mata, cidade aberta; desmate sob as formas', () => {
  const sim = simDoMapa('mata');
  const F = sim.espelho.floresta;
  assert.equal(F.n, 1024);
  assert.equal(F.passo, 8);
  const media = (x0, z0, x1, z1) => {
    let s = 0;
    let n = 0;
    for (let z = z0; z < z1; z += 16) for (let x = x0; x < x1; x += 16) {
      s += densidadeEm(F, x, z);
      n++;
    }
    return s / n;
  };
  assert.ok(media(-1500, -2500, 1500, -2000) > 0.7, 'serra do Held coberta');
  assert.ok(media(-300, -300, 300, 100) < 0.3, 'planície da cidade aberta');
  // a praia da frente da sede (D90): a costa avançou para o sul, até uns 1.110 m
  assert.ok(media(-300, 1100, 300, 1102) < 0.1, 'praia sem mata');
  // desmate: uma plataforma nova limpa a mata sob ela e marca o diário
  const v = sim.mudancas.desde(-1).versao;
  const x = -1000;
  const z = -2200;
  assert.ok(densidadeEm(F, x, z) > 0.5);
  sim.formas.registrar({ tipo: 'plataforma', ref: 424242, contorno: [x - 20, z - 20, x + 20, z - 20, x + 20, z + 20, x - 20, z + 20], cota: 300 });
  assert.equal(densidadeEm(F, x, z), 0);
  assert.ok(sim.mudancas.desde(v).floresta.length > 0);
});

test('recursos: grades 256², extração baixa o valor e a camada Recursos segue o contrato', () => {
  const sim = simDoMapa('recursos');
  const E = sim.espelho.recursos;
  assert.equal(E.n, 256);
  assert.equal(E.passo, 32);
  for (const r of RECURSOS) assert.equal(E[r].length, 65536);
  // pedreira sugerida fica sobre rocha, areal sobre areia, olaria sobre argila
  const S = Object.fromEntries(sim.q.sugestoes().map((s) => [s.id, s]));
  const quadrado = (s, r) => [s.x - r, s.z - r, s.x + r, s.z - r, s.x + r, s.z + r, s.x - r, s.z + r];
  assert.ok(recursoNoPoligono(E, 'rocha', quadrado(S.pedreira, 40)).media > 90);
  assert.ok(recursoNoPoligono(E, 'areia', quadrado(S.areal, 40)).media > 90);
  assert.ok(recursoNoPoligono(E, 'argila', quadrado(S.olaria, 40)).media > 90);
  const pol = quadrado(S.pedreira, 40);
  const antes = recursoNoPoligono(E, 'rocha', pol).soma;
  const v0 = sim.q.camada('recursos').versao;
  assert.equal(extrair(sim, 'rocha', pol, 300), 300);
  assert.equal(recursoNoPoligono(E, 'rocha', pol).soma, antes - 300);
  const c = sim.q.camada('recursos');
  assert.ok(c.versao > v0);
  assert.equal(c.id, 'recursos');
  assert.equal(c.fonte, CAMADAS.recursos.fonte);
  assert.equal(c.tipo, CAMADAS.recursos.tipo);
  assert.ok(c.dados instanceof Float32Array && c.dados.length === 65536);
  assert.deepEqual(c.grade, { n: 256, passo: 32, origem: [-4096, -4096] });
  assert.equal(c.legenda.length, 6);
  // save: a extração fica
  const nova = criarSimulacao({ semente: 'recursos' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(recursoNoPoligono(nova.espelho.recursos, 'rocha', pol).soma, antes - 300);
});

// ------------------------------------------------------------------------------------------------ áreas e sugestões

test('áreas (D55) e sugestões (D36, D90): formato, dentro da área inicial, avenida do nó de entrada ao portão norte', () => {
  const sim = simDoMapa('sugestoes');
  const ids = sim.espelho.areas.map((a) => a.id).sort();
  assert.deepEqual(ids, ['gleba', 'morros', 'orla', 'varzea', 'vila']);
  for (const a of sim.espelho.areas) assert.ok(a.contorno instanceof Float64Array && a.contorno.length >= 6 && a.nome);
  const S = sim.q.sugestoes();
  const h0 = sim.hash();
  sim.q.sugestoes();
  assert.equal(sim.hash(), h0, 'consulta pura');
  const porId = Object.fromEntries(S.map((s) => [s.id, s]));
  for (const id of ['avenida', 'quadra1', 'entrada', 'captacao', 'usina', 'escritorio', 'pedreira', 'areal', 'olaria']) assert.ok(porId[id], id);
  const N = sim.tabelas.nos;
  const ent = sim.json.mapa.entrada % 1048576;
  assert.deepEqual(porId.avenida.pontos[0], [N.x[ent], N.z[ent]]);
  assert.equal(porId.entrada.ref, sim.json.mapa.entrada);
  const T = sim.espelho.terreno;
  const [x0, z0, x1, z1] = limitesInicio();
  const { centro, raio } = GLEBA_ENVELOPE;
  for (const s of S) {
    const pts = s.pontos ?? [[s.x, s.z]];
    for (const [x, z] of pts) {
      assert.ok(x >= x0 && x <= x1 && z >= z0 && z <= z1, `${s.id} fora da área inicial`);
      assert.equal(aguaEm(T, x, z), AGUA.TERRA, `${s.id} na água`);
      // nada da primeira hora dentro do disco da sede (a avenida chega ao portão, na borda)
      if (s.id !== 'avenida') assert.ok(Math.hypot(x - centro[0], z - centro[1]) > raio + 10, `${s.id} na gleba`);
    }
  }
  // a primeira avenida termina no portão norte da sede
  const fim = porId.avenida.pontos.at(-1);
  const norte = PLANOS[PLANO_ESCOLHIDO].portoes.find((p) => p.id === 'norte');
  assert.deepEqual(fim, [norte.x, norte.z]);
  // a captação fica na beira do rio, acima da Vila
  const r = rioEm(terrenoBase(sim).base, porId.captacao.x, porId.captacao.z);
  assert.ok(r.a - r.hw < 60, 'captação na margem');
  assert.ok(porId.captacao.z < 560, 'rio acima da Vila');
  // a captação e a usina (o id do catálogo é 'solar') ficam na rua principal da Vila, com rede: a prévia aceita e a
  // frente dá para uma via com canos e cabos (a S2a mostrou a Vila abandonando com as duas na estrada de terra)
  assert.equal(porId.usina.construir, 'solar');
  const A = sim.tabelas.arestas;
  for (const id of ['captacao', 'usina']) {
    const s = porId[id];
    const pv = sim.q.construir.previa({ tipo: s.construir, x: s.x, z: s.z, rot: s.rot });
    assert.ok(pv.ok, `${id}: ${pv.codigo}`);
    let melhor = Infinity;
    let tipo = null;
    for (let e = 0; e < A.n; e++) {
      if (!A.viva[e]) continue;
      const p = A.p;
      for (let t = 0; t <= 8; t++) {
        const u = t / 8;
        const v = 1 - u;
        const x = v * v * v * p[8 * e] + 3 * v * v * u * p[8 * e + 2] + 3 * v * u * u * p[8 * e + 4] + u * u * u * p[8 * e + 6];
        const z = v * v * v * p[8 * e + 1] + 3 * v * v * u * p[8 * e + 3] + 3 * v * u * u * p[8 * e + 5] + u * u * u * p[8 * e + 7];
        const d = Math.hypot(x - pv.x, z - pv.z);
        if (d < melhor) {
          melhor = d;
          tipo = VIAS_ORDEM[A.tipo[e]];
        }
      }
    }
    assert.equal(tipo, 'rua', `${id} de frente para ${tipo}`);
  }
  // as quadras sugeridas: a grade de ruas da caixa de cada uma (como o robô traça) passa na prévia, fora do disco
  for (const q of S.filter((x) => x.tipo === 'zona')) {
    const xs = q.pontos.map((p) => p[0]);
    const zs = q.pontos.map((p) => p[1]);
    const [qx0, qz0, qx1, qz1] = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
    const pv = sim.q.via.previa({ modo: 'grade', tipo: 'rua', pontos: [[qx0, qz0], [qx1, qz0], [qx1, qz1]] });
    assert.ok(pv.ok, `${q.id}: ${JSON.stringify(pv.erros)}`);
  }
  // C1a: os prédios da Holding sugeridos ficam de frente para uma via ("Usar sugestão" sem 'acesso'): o Escritório, o
  // Areal e a Olaria (marco 1) na estrada de terra e no caminho do barreiro desde o começo; a Pedreira na avenida
  sim.progresso.xp(MARCOS[1].xp, 'teste');
  sim.rodar(20, { sincrono: true });
  const previaDe = (id) => sim.q.construir.previa({ tipo: porId[id].construir, x: porId[id].x, z: porId[id].z, rot: porId[id].rot });
  for (const id of ['escritorio', 'areal', 'olaria']) assert.ok(previaDe(id).ok, `${id}: ${previaDe(id).codigo}`);
  assert.equal(previaDe('pedreira').codigo, 'acesso');
  // a avenida constrói trecho a trecho, em ordem (como o robô), no declive da avenida, e o último trecho encaixa no
  // portão norte pela reta radial (chegando de viés, a lateral da pista entra no disco: código 'gleba')
  const pts = porId.avenida.pontos;
  for (let k = 0; k + 1 < pts.length; k++) {
    const plano = { modo: 'reta', tipo: porId.avenida.via, pontos: [pts[k], pts[k + 1]], sessao: 1 };
    const pv = sim.q.via.previa(plano);
    assert.ok(pv.ok, `avenida, trecho ${k}: ${JSON.stringify(pv.erros)}`);
    if (k === pts.length - 2) assert.ok(pv.encaixes.some((e) => e.portao === 'norte'), 'a avenida não chega ao portão norte');
    assert.ok(sim.cmd('via.construir', { plano }).ok, `avenida, trecho ${k}`);
  }
  sim.rodar(20, { sincrono: true });
  assert.ok(previaDe('pedreira').ok, `pedreira: ${previaDe('pedreira').codigo}`);
});

// ------------------------------------------------------------------------------------------------ save

test('save: ida e volta com o mapa (hash, chão, mata, recursos, ladrilhos) e tiques sem erro', () => {
  const sim = simDoMapa('save-mundo');
  sim.rodar(40);
  const nova = criarSimulacao({ semente: 'save-mundo' });
  aplicarSave(nova, lerSave(montarSave(sim)));
  assert.equal(nova.hash(), sim.hash());
  assert.equal(hashGrade(nova.espelho.terreno.altura), hashGrade(sim.espelho.terreno.altura));
  assert.equal(hashGrade(nova.espelho.floresta.dens), hashGrade(sim.espelho.floresta.dens));
  assert.deepEqual(nova.validar(), []);
  nova.rodar(40);
  sim.rodar(40);
  assert.equal(nova.hash(), sim.hash());
  assert.deepEqual([...sim.erros, ...nova.erros], []);
});
