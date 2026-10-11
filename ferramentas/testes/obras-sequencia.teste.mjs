// Testes da OBR2 (D102, animação das obras): a sequência de cada classe de obra (casa, prédio baixo, torre, serviço e campo),
// a malha de estacas que a perfuratriz percorre (a mesma ordem no JS e no GLSL), o fecho da obra (retirada do canteiro,
// bandeirola e brilho, 16 tiques), o bloco do fecho, a sonda que aquece o programa da sombra do primeiro colocável (zero
// compilações depois de pronto) e os ciclos das máquinas no GLSL. Sem GPU: as peças são puras e os shaders montam sobre o
// three. Roda sozinho: node ferramentas/testes/obras-sequencia.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoPredio } from '../../fonte/render/geracao/planoPredio.js';
import * as O from '../../fonte/render/mundo/obras.js';

const base = { idx: 9, x: 200, y: 4, z: -60, rot: 0.3 };
const contar = (r, t) => r.caixas.filter((c) => c[7] === t).length;
const modelos = (r) => r.gruas.map((g) => g[4]).sort();

/** Plano com a altura pedida (m) entre min e max, procurando por modelo, nível e semente. */
function planoAte(w, d, min, max, modelosTeste = ['lojaDupla', 'mercado', 'predioBaixo', 'casa', 'predioLargo']) {
  for (let k = 0; k < 400; k++) {
    const pl = planoPredio({ w, d, modelo: modelosTeste[k % modelosTeste.length], nivel: 1 + (k % 5), semente: 3 + k });
    if (pl.alturaTopo > min && pl.alturaTopo <= max) return pl;
  }
  return null;
}

test('obra: cada classe de obra tem a sua sequência (casa, prédio baixo, torre)', () => {
  // torre: perfuratriz, escavadeira, grua de torre; núcleo, fôrma trepante e plataforma, operários no alto, faíscas e balancim
  const alto = planoPredio({ w: 40, d: 40, modelo: 'predioLargo', nivel: 5, semente: 11 });
  const t = O.pecasDaObra({ ...base, w: 40, d: 40, plano: alto, nivel: false });
  assert.equal(O.classeDaObra(alto.alturaTopo, true), 'torre');
  assert.deepEqual(modelos(t), [O.MODELO.TORRE, O.MODELO.ESCAVADEIRA, O.MODELO.PERFURATRIZ]);
  assert.equal(contar(t, O.PECA.NUCLEO), 1);
  assert.equal(contar(t, O.PECA.FORMA), 2, 'a fôrma e a plataforma');
  assert.equal(contar(t, O.PECA.OPERARIO_ALTO), 3);
  assert.equal(contar(t, O.PECA.OPERARIO), 4);
  assert.ok(contar(t, O.PECA.FAISCA) >= 3 + 8, 'solda no alto, esmerilhadeira no chão e o brilho do fecho');
  assert.equal(contar(t, O.PECA.BALANCIM), 4, 'plataforma, guarda-corpo e dois cabos');
  assert.equal(contar(t, O.PECA.BASCULANTE), 2);
  assert.equal(contar(t, O.PECA.MONTE), 1);
  assert.equal(contar(t, O.PECA.BANDEIRA), 2, 'mastro e bandeira do fecho');
  // o núcleo é o do corpo mais alto (o casario do telhado não conta) e a fôrma começa na altura dele
  const nuc = t.caixas.find((c) => c[7] === O.PECA.NUCLEO);
  assert.ok(nuc[5] > 8 && nuc[5] <= alto.alturaTopo, `altura do núcleo ${nuc[5]}`);
  // prédio baixo: sem fôrma trepante, um operário no alto, grua móvel
  const baixo = planoAte(24, 32, 6, O.ALTO);
  assert.ok(baixo, 'um prédio de 6 a 14 m');
  const b = O.pecasDaObra({ ...base, w: 24, d: 32, plano: baixo, nivel: false });
  assert.equal(O.classeDaObra(baixo.alturaTopo, true), 'predio');
  assert.deepEqual(modelos(b), [O.MODELO.MOVEL, O.MODELO.ESCAVADEIRA, O.MODELO.PERFURATRIZ]);
  assert.equal(contar(b, O.PECA.FORMA), 0);
  assert.equal(contar(b, O.PECA.OPERARIO_ALTO), 1);
  assert.equal(contar(b, O.PECA.OPERARIO), 3);
  // casa: só a escavadeira pequena (sem perfuratriz, grua, núcleo nem operário no alto), mastro de bandeira baixo
  const casa = planoAte(12, 14, 0, 6, ['casa', 'lojaDupla']);
  assert.ok(casa, 'uma casa de até 6 m');
  const c = O.pecasDaObra({ ...base, w: 12, d: 14, plano: casa, nivel: false });
  assert.equal(O.classeDaObra(casa.alturaTopo, true), 'casa');
  assert.deepEqual(modelos(c), [O.MODELO.ESCAVADEIRA]);
  assert.ok(c.gruas[0][6] < 0.6, 'escavadeira pequena');
  assert.equal(contar(c, O.PECA.NUCLEO) + contar(c, O.PECA.OPERARIO_ALTO) + contar(c, O.PECA.FORMA), 0);
  assert.equal(contar(c, O.PECA.OPERARIO), 2);
  assert.ok(Math.abs(c.caixas.find((x) => x[7] === O.PECA.BANDEIRA)[5] - 2.2) < 1e-6);
  // reforma de nível: sem cava, estacas ou máquinas de terra; só os dois operários, o tapume da frente e o brilho do fecho
  const r = O.pecasDaObra({ ...base, w: 40, d: 40, plano: alto, nivel: true });
  assert.equal(contar(r, O.PECA.ESTACA) + contar(r, O.PECA.MONTE) + contar(r, O.PECA.NUCLEO), 0);
  assert.equal(contar(r, O.PECA.OPERARIO), 2);
  assert.equal(contar(r, O.PECA.BANDEIRA), 0, 'a reforma não leva bandeirola');
  assert.deepEqual(modelos(r), [O.MODELO.TORRE]);
});

test('obra: o serviço (colocável sem plano) ganha esqueleto pela altura e o campo só o canteiro e as máquinas', () => {
  // escola (30 m): esqueleto sobre a pegada, núcleo e grua de torre
  const e = O.pecasDaObra({ ...base, w: 50, d: 60, plano: null, nivel: false, H: 30, esqueleto: true });
  assert.ok(contar(e, O.PECA.PILAR) >= 4 && contar(e, O.PECA.LAJE) >= 8 && contar(e, O.PECA.MASSA) === 1);
  assert.equal(contar(e, O.PECA.NUCLEO), 1);
  assert.ok(modelos(e).includes(O.MODELO.TORRE) && modelos(e).includes(O.MODELO.ESCAVADEIRA));
  assert.equal(O.classeDaObra(30, true), 'torre');
  // parque (campo): nada de esqueleto, núcleo ou grua; escavadeira e operários continuam
  const p = O.pecasDaObra({ ...base, w: 50, d: 60, plano: null, nivel: false, H: 14, esqueleto: false });
  assert.equal(contar(p, O.PECA.PILAR) + contar(p, O.PECA.LAJE) + contar(p, O.PECA.NUCLEO), 0);
  assert.equal(p.cascas.length, 0);
  assert.equal(O.classeDaObra(14, false), 'simples');
  assert.ok(contar(p, O.PECA.OPERARIO) >= 3);
  // sem altura nenhuma (colocável desconhecido): o canteiro básico, sem bandeirola
  const n = O.pecasDaObra({ ...base, w: 20, d: 20, plano: null, nivel: false, H: 0 });
  assert.equal(contar(n, O.PECA.BANDEIRA), 0);
  assert.ok(contar(n, O.PECA.TAPUME) >= 4);
});

test('obra: a malha de estacas segue a ordem em zigue-zague da perfuratriz (o mesmo JS e GLSL)', () => {
  const alto = planoPredio({ w: 40, d: 40, modelo: 'predioLargo', nivel: 5, semente: 11 });
  const t = O.pecasDaObra({ ...base, w: 40, d: 40, plano: alto, nivel: false });
  const estacas = t.caixas.filter((c) => c[7] === O.PECA.ESTACA);
  const n = estacas[0][9] >> 6;
  assert.equal(estacas.length, n, 'a quantidade vai em cada estaca (param = ordem + 64 n)');
  estacas.forEach((e, k) => assert.equal(e[9] & 63, k, 'a ordem de aparição'));
  const rig = t.gruas.find((g) => g[4] === O.MODELO.PERFURATRIZ);
  const nx = rig[6] % 8;
  const nz = Math.floor(rig[6] / 8) % 8;
  const sx = Math.floor(rig[6] / 64) % 64;
  const sz = Math.floor(rig[6] / 4096);
  assert.equal(nx * nz, n);
  // a estaca k fica onde a perfuratriz estaciona: o ponto (i, j) da malha, a partir da primeira estaca (a origem da máquina)
  const g = alto.pecas.length ? O.volumesDoPlano(alto)[0].giro ?? 0 : 0;
  const c = Math.cos(base.rot + g);
  const s = Math.sin(base.rot + g);
  for (let k = 1; k < n; k++) {
    const [i, j] = O.pontoEstaca(k, nx);
    const dx = estacas[k][0] - estacas[0][0];
    const dz = estacas[k][2] - estacas[0][2];
    // no referencial da máquina: x ao longo do giro, z ao longo da fila
    const ax = dx * c - dz * s;
    const az = dx * s + dz * c;
    const [i0, j0] = O.pontoEstaca(0, nx);
    assert.ok(Math.abs(ax - (i - i0) * sx) < 1e-6 && Math.abs(az - (j - j0) * sz) < 1e-6, `estaca ${k}: (${ax.toFixed(2)}, ${az.toFixed(2)}) contra (${(i - i0) * sx}, ${(j - j0) * sz})`);
  }
  // zigue-zague: a fila ímpar volta, nenhuma estaca se repete e dois pontos seguidos são vizinhos
  const vistos = new Set();
  for (let k = 0; k < n; k++) {
    const [i, j] = O.pontoEstaca(k, nx);
    vistos.add(`${i},${j}`);
    if (k) {
      const [pi, pj] = O.pontoEstaca(k - 1, nx);
      assert.equal(Math.abs(i - pi) + Math.abs(j - pj), 1, 'dois pontos seguidos são vizinhos');
    }
  }
  assert.equal(vistos.size, n);
});

test('obra: o fecho (retirada do canteiro, bandeirola e brilho) só leva o que o fecho mostra e soma o deslocamento ao tipo', () => {
  const alto = planoPredio({ w: 40, d: 40, modelo: 'predioLargo', nivel: 5, semente: 11 });
  const t = O.pecasDaObra({ ...base, w: 40, d: 40, plano: alto, nivel: false });
  // numa obra em andamento nem a bandeirola nem o brilho valem, em nenhuma fase
  for (const p of [0, 0.05, 0.2, 0.4, 0.7, 0.99]) {
    const vale = t.caixas.filter((x) => O.caixaVale(x, p, false));
    assert.ok(!vale.some((x) => x[7] === O.PECA.BANDEIRA || (x[7] === O.PECA.FAISCA && x[9] % 8 === 2)), `fase ${p}`);
  }
  const f = O.blocoDe(t.caixas, O.fechoVale, 9, false, { t0: 777 });
  const tipos = new Set(Array.from({ length: f.n }, (_, k) => f.o[4 * k + 1] - O.FECHO.deslocamento));
  assert.deepEqual([...tipos].sort((a, b) => a - b), [O.PECA.CONTEINER, O.PECA.PILHA, O.PECA.BETONEIRA, O.PECA.TAPUME, O.PECA.FAISCA, O.PECA.BANDEIRA].sort((a, b) => a - b));
  for (let k = 0; k < f.n; k++) assert.equal(f.x[4 * k], 777, 'o tique do fim no aAux.x');
  assert.equal(O.FECHO.tiques, 16);
  // a máscara de fase ganhou o bit de antes da fundação (as estacas e as máquinas de terra)
  assert.notEqual(O.mascaraFase(0.2), O.mascaraFase(0.3));
});

test('obra: o shader leva os ciclos (escavadeira, grua, caminhão, estacas), o fecho e a poeira em billboard, sem mediump', async () => {
  const S = await import('../../fonte/render/materiais/shaders/obra.glsl.js');
  const comum = S.GLSL_OBRA.comumVertice;
  for (const f of ['gCicloCaminhao', 'gCicloEscavadeira', 'gCicloGrua', 'gPontoEstaca', 'gTri']) assert.ok(comum.includes(f), f);
  const v = S.GLSL_OBRA.caixas.vertice;
  assert.ok(v.includes('gT0 > 31.5') && v.includes('aAux.x'), 'o fecho');
  assert.ok(v.includes('viewMatrix') && v.includes('normal.z < 0.5'), 'billboard de uma face só');
  assert.ok(v.includes('#ifdef OBRA_SOMBRA') && v.includes('if ( gT > 6.5 ) gVer = false'), 'as peças pequenas não projetam sombra');
  const g = S.GLSL_OBRA.gruas.vertice;
  assert.ok(g.includes('gCicloEscavadeira') && g.includes('gPontoEstaca') && g.includes('gCicloGrua'));
  assert.ok(g.includes('aAux.y') && g.includes('aAux.z') && g.includes('aAux.w'), 'giro de pegar e de largar e os raios no aAux');
  assert.ok(!/\bmediump\b/.test(Object.values(S.GLSL_OBRA).map((x) => (typeof x === 'string' ? x : Object.values(x).join('\n'))).join('\n')));
  // a perfuratriz, o ciclo do caminhão e o da escavadeira: o GLSL traduzido bate com o esperado
  const ciclo = comum.match(/vec3 gCicloCaminhao[\s\S]*?\n}\n/)[0];
  assert.ok(ciclo.includes('84.0') && ciclo.includes('12.0') && ciclo.includes('62.0'), 'chega em 12, fica até 62 e sai em 12 (ciclo de 84)');
});

test('obras: o domínio guarda a sonda da sombra, mostra o fecho por 16 tiques e limpa', async () => {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { PERFIS } = await import('../../fonte/render/motor/perfis.js');
  const { criarSimulacao } = await import('../../fonte/sim/estado.js');
  const { gerarCidadeSintetica, SINTETICA } = await import('../cidade-sintetica.mjs');
  const sim = criarSimulacao({ semente: SINTETICA.semente, dominios: false });
  gerarCidadeSintetica({ sim, predios: 300 });
  const esp = sim.espelho;
  const P = esp.predios;
  let i = -1;
  for (let k = 0; k < P.n && i < 0; k++) if (P.viva[k] && P.tipo[k] === 0 && !(P.flags[k] & 1)) i = k;
  assert.ok(i >= 0);
  // a cidade sintética já traz obras: a prova é só a deste prédio
  for (let k = 0; k < P.n; k++) if (k !== i) P.flags[k] &= ~(1 | 256);
  let fabrica = null;
  O.registrar({ registrarDominio: (n, f) => (fabrica = f) });
  const cenaSombra = new THREE.Scene();
  const matSombra = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const projetados = [];
  const ctx = {
    cena: new THREE.Scene(), ganchos, perfil: PERFIS.media, medidas: { familia: (m) => m },
    sim: { espelho: esp, mudancas: sim.mudancas },
    sombra: { cena: cenaSombra, material: matSombra, projetor: (m) => { projetados.push(m); return m; }, soltar() {}, marcar() {} },
    cameraApi: { alvo: (v) => v.set(P.x[i], 0, P.z[i]) },
    dominio: (n) => (n === 'predios' ? { planoObra: (k) => planoPredio({ w: P.w[k], d: P.d[k], modelo: P.modelo[k], semente: P.semente[k], nivel: P.nivel[k] }) } : null),
  };
  const dom = fabrica(ctx);
  // a sonda: um Mesh invisível com o material de profundidade padrão e sem instâncias (o programa do colocável sem obras)
  const sonda = cenaSombra.children.find((o) => o.name === 'obras:sonda-sombra');
  assert.ok(sonda && sonda.isMesh && !sonda.isInstancedMesh && sonda.visible === false && sonda.material === matSombra, 'sonda do aquecimento da sombra');
  assert.ok(sonda.geometry.attributes.position && sonda.geometry.attributes.normal, 'posição e normal, como a malha do colocável');
  await dom.carregando;
  assert.ok(dom.pronto());
  // a obra em andamento
  esp.tempo.tique = 1000;
  esp.tempo.frac = 0;
  P.flags[i] |= 1;
  P.obraIni[i] = 400;
  P.obraFim[i] = 1020; // p = 0,97: fechamento
  dom.aplicar({ tudo: { predios: true } }, esp);
  dom.refazer();
  const m0 = dom.medidas();
  assert.ok(m0.caixas > 20 && m0.obras === 1, JSON.stringify(m0));
  // a obra acaba: sobra o fecho, só com o canteiro que desmonta, a bandeirola e o brilho; sem esqueleto nem máquinas
  P.flags[i] &= ~1;
  esp.tempo.tique = 1020;
  dom.aplicar({ predios: [i] }, esp);
  dom.refazer();
  const m1 = dom.medidas();
  assert.equal(m1.obras, 0);
  assert.ok(m1.caixas > 5 && m1.caixas < m0.caixas, `fecho ${m1.caixas} peças contra ${m0.caixas} da obra`);
  assert.equal(m1.gruas + m1.cascas, 0);
  // no meio do fecho ainda está; depois de 16 tiques sai
  esp.tempo.tique = 1020 + 10;
  dom.refazer();
  assert.ok(dom.medidas().caixas > 5);
  esp.tempo.tique = 1020 + O.FECHO.tiques + 1;
  dom.refazer();
  assert.equal(dom.medidas().caixas, 0, 'o fecho acabou');
  // a obra que some sem acabar (a vaga morreu, ou o prédio foi demolido) não mostra fecho
  P.flags[i] |= 1;
  P.obraIni[i] = 1030;
  P.obraFim[i] = 1500;
  dom.aplicar({ predios: [i] }, esp);
  dom.refazer();
  assert.equal(dom.medidas().obras, 1);
  P.viva[i] = 0;
  dom.aplicar({ predios: [i] }, esp);
  dom.refazer();
  assert.equal(dom.medidas().caixas, 0, 'demolida: sem fecho');
  P.viva[i] = 1;
  dom.descartar();
  assert.ok(!cenaSombra.children.includes(sonda), 'a sonda sai com o domínio');
});

test('arcologia: o carrinho leva o balde do pega ao assenta, o cabo alonga e encurta e o fecho dura 24 s', async () => {
  const A = await import('../../fonte/render/arcologia/obra.js');
  let xmin = 1e9;
  let xmax = -1e9;
  let cmin = 1e9;
  let cmax = -1e9;
  let carregando = 0;
  for (let t = 0; t < 50; t += 0.25) {
    const c = A.cicloCarrinho(t);
    xmin = Math.min(xmin, c.x);
    xmax = Math.max(xmax, c.x);
    cmin = Math.min(cmin, c.cabo);
    cmax = Math.max(cmax, c.cabo);
    if (c.carga) carregando++;
  }
  assert.ok(xmin >= 16 - 1e-6 && xmax <= 42 + 1e-6 && xmax - xmin > 20, `o carrinho vai de ${xmin} a ${xmax}`);
  assert.ok(cmin >= 14 - 1e-6 && cmax > 22, `o cabo de ${cmin} a ${cmax}`);
  assert.ok(carregando > 40 && carregando < 120, 'a carga só no meio do ciclo');
  assert.equal(A.cicloCarrinho(0).x, A.cicloCarrinho(50).x, 'o ciclo fecha');
  assert.equal(A.FECHO.segundos, 24);
  for (const m of [A.malhaCabo(), A.malhaCarga(), A.malhaOperario(), A.malhaBandeira(), A.malhaBrilho(), A.malhaCarrinho()]) assert.ok(m.i.length >= 3, 'malha com triângulos');
});
