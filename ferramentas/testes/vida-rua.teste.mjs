// Testes da vida na rua (R3b; desenho do render 8): a vez no cruzamento (nenhum carro dentro do outro, nem na curva,
// em 300 s), a fila sem carro dentro de carro, o caminhão das entregas pelo caminho da entrega, a gente pela atividade
// dos prédios (na calçada, atravessando só na faixa e com os carros parados), as figuras e os caminhões gerados, o
// realce da aresta selecionada e os materiais novos sobre o three sem mediump.
// Roda sozinho: node ferramentas/testes/vida-rua.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ------------------------------------------------------------------------------------------------ utilidades

/** Cidade sintética, rede do render e um contexto mínimo com os domínios da vida (trafego, pedestres, caminhoes). */
async function montarRua({ perfil = 'media', hora = 8, alvo, camera = null, dominios = ['trafego'] } = {}) {
  const THREE = await import('three');
  const { gerarCidadeSintetica } = await import('../cidade-sintetica.mjs');
  const { Rede } = await import('../../fonte/render/mundo/vias.js');
  const { GradeSetores } = await import('../../fonte/render/mundo/setores.js');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { statsVazio } = await import('../../fonte/contratos/render.js');
  const { sim } = gerarCidadeSintetica();
  const esp = sim.espelho;
  const rede = new Rede(new GradeSetores());
  rede.tudo(esp);
  const vias = { rede, *setoresPerto() {} };
  const doms = {};
  const a = new THREE.Vector3(alvo.x, 0, alvo.z);
  const ctx = {
    cena: new THREE.Scene(), medidas: { familia: (m) => m }, ganchos, perfil: { id: perfil }, camera: new THREE.PerspectiveCamera(),
    stats: statsVazio(), sim: { espelho: esp }, horaDoCeu: () => hora, sol: { dia: 1 },
    cameraApi: { alvo: (v) => v.copy(a) },
    dominio: (n) => (n === 'vias' ? vias : doms[n] ?? null),
  };
  ctx.camera.position.set(alvo.x, 80, alvo.z + 40);
  if (camera) ctx.camera.position.set(camera.x, camera.y, camera.z);
  const api = { registrarDominio: (n, f) => (doms[n] = f(ctx)) };
  for (const d of dominios) (await import(`../../fonte/render/mundo/${d}.js`)).registrar(api);
  return { THREE, esp, rede, ctx, doms, alvo: a };
}

/** Duas caixas orientadas (carros: x, z, hx, hz, c, l) se sobrepõem? encolhe: folga de cada lado (m). */
function sobrepoe(a, b, encolhe = 0.25) {
  const ha = [a.l / 2 - encolhe, a.c / 2 - encolhe];
  const hb = [b.l / 2 - encolhe, b.c / 2 - encolhe];
  if (Math.hypot(a.x - b.x, a.z - b.z) > Math.hypot(...ha) + Math.hypot(...hb)) return false;
  const ea = [[a.hz, -a.hx], [a.hx, a.hz]];
  const eb = [[b.hz, -b.hx], [b.hx, b.hz]];
  const d = [b.x - a.x, b.z - a.z];
  for (const ax of [...ea, ...eb]) {
    const ra = ha[0] * Math.abs(ea[0][0] * ax[0] + ea[0][1] * ax[1]) + ha[1] * Math.abs(ea[1][0] * ax[0] + ea[1][1] * ax[1]);
    const rb = hb[0] * Math.abs(eb[0][0] * ax[0] + eb[0][1] * ax[1]) + hb[1] * Math.abs(eb[1][0] * ax[0] + eb[1][1] * ax[1]);
    if (Math.abs(d[0] * ax[0] + d[1] * ax[1]) > ra + rb) return false;
  }
  return true;
}

// ------------------------------------------------------------------------------------------------ cruzamento

test('prioridade no cruzamento: em 300 s, nenhum carro dentro do outro (na curva do nó nem na fila), sem trava', async () => {
  const { RUA } = await import('../../fonte/render/cenas/rua.js');
  // o cruzamento da cena rua (avenida com semáforo) e um bairro de ruas sem semáforo, no pico da manhã; e o cruzamento
  // sem espelho.fluxos (o M1a não tem a S1c: a amostra pela heurística), no pico da tarde
  const casos = [['cruzamento da cena rua', RUA, 8, true], ['ruas do bairro sul', { x: 1261.5, z: 353.1 }, 8, true], ['cruzamento sem fluxos', RUA, 18, false]];
  for (const [nome, alvo, hora, comFluxo] of casos) {
    const { ctx, doms, esp } = await montarRua({ alvo, hora, dominios: ['trafego', 'pedestres'] });
    if (!comFluxo) esp.fluxos = null;
    const traf = doms.trafego;
    assert.ok(traf.povoar(ctx) > 50, `${nome}: tráfego vazio`);
    await doms.pedestres.povoar(ctx);
    traf.animar(true);
    doms.pedestres.animar(true);
    let dentro = 0;
    let fila = 0;
    const exemplo = [];
    const curvas = new Set();
    let piorParado = 0;
    const parado = new Map();
    for (let q = 0, t = 0; q < 3000; q++) {
      t += 100;
      traf.quadro(t, ctx);
      doms.pedestres.quadro(t, ctx);
      const C = traf.amostra();
      for (const c of C) {
        if (c.curva) curvas.add(`${c.id}:${c.de}`);
        const p = c.v < 0.1 ? (parado.get(c.id) ?? 0) + 0.1 : 0;
        parado.set(c.id, p);
        piorParado = Math.max(piorParado, p);
      }
      for (let i = 0; i < C.length; i++) {
        for (let j = i + 1; j < C.length; j++) {
          if (!sobrepoe(C[i], C[j])) continue;
          if (C[i].curva || C[j].curva) dentro++;
          else fila++;
          if (exemplo.length < 3) exemplo.push(`quadro ${q}: ${C[i].id} e ${C[j].id} em (${C[i].x.toFixed(1)}, ${C[i].z.toFixed(1)})`);
        }
      }
    }
    assert.equal(dentro, 0, `${nome}: ${dentro} vezes dois carros um dentro do outro no cruzamento (${exemplo.join('; ')})`);
    assert.equal(fila, 0, `${nome}: ${fila} vezes um carro dentro do outro fora do cruzamento (${exemplo.join('; ')})`);
    // o cruzamento anda: centenas de curvas em 300 s, e ninguém parado mais que um ciclo e meio de semáforo
    assert.ok(curvas.size > 400, `${nome}: só ${curvas.size} curvas em 300 s`);
    assert.ok(piorParado < 60, `${nome}: carro parado ${piorParado.toFixed(0)} s`);
    traf.descartar();
    doms.pedestres.descartar();
  }
});

test('fila e vez: velocidade que ainda para, conflito das curvas, virada, faixa de destino e o fluxo da S1c', async () => {
  const T = await import('../../fonte/render/mundo/trafego.js');
  // quem vem a 15 m/s com o da frente parado a 17 m ainda para com a frenagem de conforto (o defeito da fila era
  // frear tarde: 15 m/s com 17,6 m livres)
  for (const v of [5, 10, 15, 20]) {
    const g = (v * v) / (2 * T.A_PLANO);
    assert.ok(T.velSegura(g) <= v + 1e-9 && T.velSegura(g * 0.5) < v, `velSegura(${g.toFixed(1)})`);
  }
  assert.equal(T.velSegura(-3), 0);
  assert.ok(T.velSegura(10, 12) > T.velSegura(10, 0), 'seguir um carro andando permite mais velocidade');
  // virada olhando de cima (x leste, z sul): do norte para leste é à direita
  assert.equal(T.virada(0, -1, 1, 0), 1);
  assert.equal(T.virada(0, -1, -1, 0), -1);
  assert.equal(T.virada(1, 0, 1, 0.1), 0);
  // faixa de destino: direita para a da direita, esquerda para a da esquerda, em frente na mesma posição
  const fx = [{ u: -1 }, { u: 0 }, { u: 1 }];
  assert.equal(T.faixaDestino(fx, 0, 2, 1), fx[2]);
  assert.equal(T.faixaDestino(fx, 1, 2, -1), fx[0]);
  assert.equal(T.faixaDestino(fx, 1, 2, 0), fx[2]);
  assert.equal(T.faixaDestino(fx, 0, 1, 0, true), fx[2]);
  for (const tipo of ['rua', 'avenida', 'avenidaG']) {
    for (const s of [1, -1]) {
      const l = T.faixasOrdenadas(tipo, 0, s);
      for (let i = 1; i < l.length; i++) assert.ok(l[i].u * s > l[i - 1].u * s, `${tipo}: faixas da esquerda para a direita`);
    }
  }
  // poligonais que se cruzam: distância 0; paralelas a 3,5 m (faixas vizinhas): 3,5
  const A = Float64Array.of(0, 0, 10, 0);
  assert.equal(T.distPoligonais(A, 0, Float64Array.of(5, -5, 5, 5), 0), 0);
  assert.ok(Math.abs(T.distPoligonais(A, 0, Float64Array.of(0, 3.5, 10, 3.5), 0) - 3.5) < 1e-9);
  // a curva do nó: a cúbica começa no fim de uma faixa e acaba no começo da outra, com a poligonal do conflito
  const { tabelaArco, reta } = await import('../../fonte/comum/bezier.js');
  const mk = (e, x0, z0, x1, z1) => {
    const p = reta(x0, z0, x1, z1);
    const tab = tabelaArco(p);
    return { e, tipo: 0, mao: 0, p, tab, L: tab[16], cIni: 8, cFim: 8 };
  };
  const a1 = mk(1, -100, 0, 0, 0);
  const a2 = mk(2, 0, 0, 0, 100);
  const cv = T.curvaEntre(a1, 1.75, 1, a2, 1.75, 1);
  assert.ok(Math.hypot(cv.p[0] + 8, cv.p[1] - 1.75) < 0.01 && cv.poli.length === 18);
  assert.equal(cv.vir, 1, 'de leste para sul é à direita');
  // fluxo (S1c): veículos por hora no pico, por faixa, na velocidade da via, pela hora; congestionado tem mais carros
  assert.equal(T.densidadeFluxo('rua', 0, 1, 1, 8), 0);
  assert.ok(T.densidadeFluxo('rua', 600, 1, 0.3, 8) > T.densidadeFluxo('rua', 600, 1, 1, 8));
  assert.ok(T.densidadeFluxo('rua', 600, 1, 1, 8) > T.densidadeFluxo('rua', 600, 1, 1, 3));
  assert.ok(T.densidadeFluxo('avenida', 1e6, 1, 0.1, 8) <= T.DENSIDADE_MAX);
  // a gente atravessa no vermelho dos carros: o que falta do vermelho bate com a fase
  for (let t = 0; t < 40; t += 0.5) {
    const r = T.restaVermelho(t, 0, 0);
    assert.equal(r > 0, T.faseSemaforo(t, 0, 0) === 2);
  }
  // a matriz das instâncias (sem o quatérnio) é a do compose do three com o giro em y
  const THREE = await import('three');
  const m = new THREE.Matrix4();
  const arr = new Float32Array(32);
  for (const [hx, hz, s] of [[0, 1, 1], [1, 0, 1.1], [-0.6, -0.8, 0.95], [0.3, -2, 1]]) {
    m.compose(new THREE.Vector3(3, 4, 5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(hx, hz)), new THREE.Vector3(s, s, s));
    T.matrizGiroY(arr, 16, 3, 4, 5, hx, hz, s);
    for (let k = 0; k < 16; k++) assert.ok(Math.abs(arr[16 + k] - m.elements[k]) < 1e-5, `matrizGiroY(${hx}, ${hz}) [${k}]`);
  }
  // a amostra pesa a distância ao alvo: cheia no miolo, rala na borda, nunca zero
  assert.equal(T.pesoDistancia(0, 500), 1);
  assert.equal(T.pesoDistancia(150, 500), 1);
  assert.ok(Math.abs(T.pesoDistancia(500, 500) - 0.2) < 1e-9 && T.pesoDistancia(900, 500) === 0.2);
  for (let d = 0; d < 500; d += 25) assert.ok(T.pesoDistancia(d + 25, 500) <= T.pesoDistancia(d, 500));
  // a faixa de destino em frente vindo de uma faixa só: sorteada (sem sorteio, a da direita)
  assert.equal(T.faixaDestino(fx, 0, 1, 0, false, 0.1), fx[0]);
  assert.equal(T.faixaDestino(fx, 0, 1, 0, false, 0.99), fx[2]);
  assert.equal(T.faixaDestino(fx, 0, 1, 0), fx[2]);
  // distância entre poligonais com limite: para cedo, mas sempre abaixo do limite quando estão perto
  const P1 = Float64Array.of(0, 0, 10, 0, 20, 0);
  const P2 = Float64Array.of(0, 2, 10, 2, 20, 1);
  assert.ok(T.distPoligonais(P1, 0, P2, 0, 1.5) < 1.5);
  assert.ok(Math.abs(T.distPoligonais(P1, 0, P2, 0) - 1) < 1e-9);
});

// ------------------------------------------------------------------------------------------------ caminhões

test('caminhão seguindo o caminho da entrega: na posição da viagem e no trânsito, aresta por aresta até o fim', async () => {
  const cam = await import('../../fonte/render/mundo/caminhoes.js');
  const { MODELO_CAMINHAO } = cam;
  const G = await import('../../fonte/render/geracao/caminhoes.js');
  assert.deepEqual({ c: G.CAMINHAO.c, l: G.CAMINHAO.l }, { ...MODELO_CAMINHAO }, 'as medidas do trânsito são as do modelo');
  assert.deepEqual([...cam.CORPOS], [...G.CORPOS]);
  const { PRODUCAO } = await import('../../fonte/data/holding.js');
  assert.equal(cam.FATOR_VELOCIDADE, PRODUCAO.caminhao.fatorVelocidade, 'a mesma velocidade da logística da S3a');
  // o sentido do caminho: idx de a para b, ~idx de b para a
  assert.deepEqual(cam.passosDoCaminho(Int32Array.of(3, ~7)), [{ e: 3, sentido: 1 }, { e: 7, sentido: -1 }]);
  for (const i of [0, 2]) {
    const { THREE, esp, rede, ctx, doms, alvo } = await montarRua({ perfil: 'alta', hora: 10, alvo: { x: 0, z: 0 }, dominios: ['trafego', 'caminhoes'] });
    const ent = esp.entregas[i];
    assert.ok(ent?.caminho?.length > 3, 'a cidade sintética tem entregas com caminho');
    const pl = cam.planoDaRota(rede, ent.caminho);
    assert.ok(pl && pl.L > 100, 'o caminho emenda na rede do render');
    // a posição da viagem anda para a frente, do nó de saída ao de chegada
    let antes = -1;
    const dur = ent.tFim - ent.tIni;
    for (let k = 0; k <= 40; k++) {
      const d = cam.distanciaDaViagem(ent, pl, ent.tIni + (dur * k) / 40);
      if (d === null) continue;
      assert.ok(d >= antes - 1e-9, 'a viagem volta para trás');
      antes = d;
    }
    const p0 = cam.poseDaViagem(pl, 0);
    const p1 = cam.poseDaViagem(pl, pl.L);
    const ini = rede.nos.get(pl.passos[0].sentido > 0 ? pl.ars[0].a : pl.ars[0].b);
    const fim = pl.ars.at(-1);
    const nFim = rede.nos.get(pl.passos.at(-1).sentido > 0 ? fim.b : fim.a);
    assert.ok(Math.hypot(p0.x - ini.x, p0.z - ini.z) < 40 && Math.hypot(p1.x - nFim.x, p1.z - nFim.z) < 40, 'a viagem vai de um nó ao outro do caminho');
    // no trânsito: a câmera acompanha o caminhão; ele passa pelas arestas do caminho na ordem e chega ao fim
    await doms.caminhoes.preparar();
    esp.tempo = { ...(esp.tempo ?? {}), tique: ent.tIni, frac: 0, velocidade: 1, mult: 1 };
    doms.trafego.animar(true);
    doms.caminhoes.animar(true);
    const visitadas = [];
    let noTransito = 0;
    for (let q = 0, t = 0; q < 12000 && !doms.trafego.chegou(ent.id); q++) {
      t += 100;
      esp.tempo.frac += 0.1;
      if (esp.tempo.frac >= 1) {
        esp.tempo.frac -= 1;
        esp.tempo.tique++;
      }
      const st = doms.caminhoes.estado(ent.id);
      const p = st ?? p0;
      alvo.set(p.x, 0, p.z);
      ctx.camera.position.set(p.x, 60, p.z + 30);
      doms.trafego.quadro(t, ctx);
      doms.caminhoes.quadro(t, ctx);
      const s2 = doms.caminhoes.estado(ent.id);
      if (!s2) continue;
      if (s2.agente) noTransito++;
      if (!s2.curva && visitadas.at(-1) !== s2.e) visitadas.push(s2.e);
    }
    const esperado = pl.passos.map((p) => p.e);
    let j = 0;
    for (const e of visitadas) {
      const k = esperado.indexOf(e, j);
      assert.ok(k >= 0, `entrega ${ent.id}: o caminhão saiu da rota na aresta ${e}`);
      j = k;
    }
    assert.ok(noTransito > 100, `entrega ${ent.id}: o caminhão não andou no trânsito`);
    assert.ok(doms.trafego.chegou(ent.id), `entrega ${ent.id}: o caminhão não chegou ao fim do caminho`);
    assert.deepEqual(visitadas, esperado, `entrega ${ent.id}: passou por todas as arestas do caminho, na ordem`);
    assert.ok(THREE);
  }
});

test('caminhões gerados: carroceria pela carga, paletes por unidade, monte, normais e LOD', async () => {
  const G = await import('../../fonte/render/geracao/caminhoes.js');
  const { ITENS } = await import('../../fonte/data/holding.js');
  // os materiais da Holding do M1a têm a carroceria certa
  assert.equal(G.cargaDe('brita').corpo, 'basculante');
  assert.equal(G.cargaDe('areia').corpo, 'basculante');
  assert.equal(G.cargaDe('tijolo').corpo, 'carroceria');
  assert.equal(G.cargaDe('concreto').corpo, 'betoneira');
  assert.equal(G.cargaDe(null).corpo, 'bau');
  for (const item of Object.keys(ITENS)) assert.ok(G.CORPOS.includes(G.cargaDe(item).corpo), `${item} sem carroceria`);
  const P = G.PARTE_CAMINHAO;
  for (const corpo of G.CORPOS) {
    for (const lod of [0, 1]) {
      const m = G.malhaCaminhao(corpo, lod);
      assert.equal(G.malhaCaminhao(corpo, lod), m, 'guardada');
      assert.ok(lod ? m.tris <= 24 : m.tris >= 250 && m.tris <= 700, `${corpo} LOD${lod}: ${m.tris} triângulos`);
      let y0 = Infinity;
      let y1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (let k = 0; k < m.posicao.length; k += 3) {
        assert.ok(Number.isFinite(m.posicao[k] + m.posicao[k + 1] + m.posicao[k + 2]));
        y0 = Math.min(y0, m.posicao[k + 1]);
        y1 = Math.max(y1, m.posicao[k + 1]);
        z0 = Math.min(z0, m.posicao[k + 2]);
        z1 = Math.max(z1, m.posicao[k + 2]);
      }
      assert.ok(y0 >= -1e-6 && y1 < 3.6 && z1 - z0 < G.CAMINHAO.c + 1, `${corpo} LOD${lod}: medidas`);
      const partes = new Set();
      for (let k = 0; k < m.parte.length; k += 2) partes.add(m.parte[k]);
      if (!lod) assert.ok(partes.has(P.FAROL) && partes.has(P.LANTERNA) && partes.has(P.VIDRO), `${corpo}: faróis, lanternas e vidro`);
      else assert.ok(partes.has(P.FRENTE) && partes.has(P.TRASEIRA), `${corpo} LOD1: as pontas que acendem`);
    }
  }
  // paletes: um por unidade, de 1 a 10; o monte da basculante sem índice
  const car = G.malhaCaminhao('carroceria', 0);
  const idx = new Set();
  for (let k = 0; k < car.parte.length; k += 2) if (car.parte[k] === P.CARGA) idx.add(car.parte[k + 1]);
  assert.deepEqual([...idx].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const bas = G.malhaCaminhao('basculante', 0);
  let monte = 0;
  for (let k = 0; k < bas.parte.length; k += 2) if (bas.parte[k] === P.CARGA) monte += bas.parte[k + 1] === 0 ? 1 : 0;
  assert.ok(monte > 20, 'basculante sem o monte do material');
  // a cabine com as faces para fora
  const zF = G.CAMINHAO.c / 2;
  const zc = zF - G.CAMINHAO.cab;
  for (const corpo of G.CORPOS) {
    const m = G.malhaCaminhao(corpo, 0);
    let contra = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const ids = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      const V = ids.map((i) => [m.posicao[3 * i], m.posicao[3 * i + 1], m.posicao[3 * i + 2]]);
      const parte = m.parte[2 * ids[0]];
      const c = [0, 1, 2].map((k) => (V[0][k] + V[1][k] + V[2][k]) / 3);
      if (!(parte === P.PINTURA || parte === P.VIDRO) || c[2] < zc - 0.01) continue;
      const u = V[1].map((x, k) => x - V[0][k]);
      const v = V[2].map((x, k) => x - V[0][k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const r = [c[0], c[1] - 2, c[2] - (zF - 1)];
      if (n[0] * r[0] + n[1] * r[1] + n[2] * r[2] < 0) contra++;
    }
    assert.equal(contra, 0, `${corpo}: ${contra} faces da cabine viradas para dentro`);
  }
});

// ------------------------------------------------------------------------------------------------ gente

test('gente: figura com silhueta (LOD0 e LOD1), faces para fora, juntas iguais às do GLSL e aparência variada', async () => {
  const G = await import('../../fonte/render/geracao/pessoas.js');
  const { JUNTAS_GLSL } = await import('../../fonte/render/materiais/shaders/pessoa.glsl.js');
  for (const k of ['quadril', 'joelho', 'ombro']) assert.equal(JUNTAS_GLSL[k], G.JUNTA[k], `junta ${k} do GLSL`);
  const M = G.MEMBRO;
  for (const lod of [0, 1]) {
    const m = G.malhaPessoa(lod);
    assert.ok(lod ? m.tris <= 32 : m.tris >= 150 && m.tris <= 300, `LOD${lod}: ${m.tris} triângulos`);
    let y1 = 0;
    const membros = new Set();
    for (let k = 0; k < m.posicao.length; k += 3) {
      assert.ok(Number.isFinite(m.posicao[k] + m.posicao[k + 1] + m.posicao[k + 2]));
      y1 = Math.max(y1, m.posicao[k + 1]);
    }
    for (let k = 1; k < m.corpo.length; k += 2) membros.add(m.corpo[k]);
    assert.ok(Math.abs(y1 - G.ALTURA_MODELO) < 0.03, `LOD${lod}: altura ${y1.toFixed(2)}`);
    // as pernas andam (coxas dos dois lados) nos dois LODs; no LOD0, canelas e braços também
    assert.ok(membros.has(M.COXA_A) && membros.has(M.COXA_B));
    if (!lod) for (const x of [M.CANELA_A, M.CANELA_B, M.BRACO_A, M.BRACO_B]) assert.ok(membros.has(x));
    // faces para fora do eixo do membro (o cabelo longo e a bolsa ficam de fora da conta)
    let contra = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const ids = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      const V = ids.map((i) => [m.posicao[3 * i], m.posicao[3 * i + 1], m.posicao[3 * i + 2]]);
      const [parte, membro] = [m.corpo[2 * ids[0]], m.corpo[2 * ids[0] + 1]];
      if (parte === G.PARTE_PESSOA.CABELO_LONGO || parte === G.PARTE_PESSOA.BOLSA) continue;
      const u = V[1].map((x, k) => x - V[0][k]);
      const v = V[2].map((x, k) => x - V[0][k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const ln = Math.hypot(...n);
      if (ln < 1e-12 || Math.abs(n[1]) / ln > 0.7) continue;
      const c = [0, 1, 2].map((k) => (V[0][k] + V[1][k] + V[2][k]) / 3);
      const ax = membro >= 1 && membro <= 4 ? (membro <= 2 ? 0.095 : -0.095) : membro >= 5 ? (membro === 5 ? 0.215 : -0.215) : 0;
      const r = [c[0] - ax, c[2]];
      const lr = Math.hypot(...r);
      if (lr > 0.01 && (n[0] * r[0] + n[2] * r[1]) / ln / lr < -0.05) contra++;
    }
    assert.equal(contra, 0, `LOD${lod}: ${contra} faces viradas para dentro`);
  }
  // aparência: mulheres e homens, alturas reais, os 5 tons de pele, roupas sem verde-lima, cabelo longo e saia
  const { hashF } = await import('../../fonte/render/geracao/malhaVia.js');
  const amostra = Array.from({ length: 600 }, (_, i) => G.aparencia((k) => hashF(i, k, 9)));
  const fem = amostra.filter((a) => a.fem).length;
  assert.ok(fem > 220 && fem < 380, `${fem} mulheres em 600`);
  for (const a of amostra) {
    assert.ok(a.altura >= 1.55 && a.altura <= 1.9, `altura ${a.altura}`);
    for (const c of [a.cima, a.baixo]) {
      // verde-lima: verde alto, vermelho médio, azul baixo
      assert.ok(!(c[1] > 170 && c[0] > 110 && c[2] < 90 && c[1] > c[0] + 30), `verde-lima ${c}`);
    }
  }
  const tons = new Set(amostra.map((a) => Math.min(4, Math.floor(a.pele / 51.2))));
  assert.equal(tons.size, 5, 'os 5 tons de pele aparecem');
  const B = G.BITS_ROUPA;
  assert.ok(amostra.some((a) => a.bits & B.SAIA) && amostra.some((a) => a.bits & B.LONGO) && amostra.some((a) => a.bits & B.PERNAS));
  assert.ok(amostra.every((a) => !(a.bits & B.SAIA) || a.fem), 'saia só nas mulheres');
});

test('gente: a caminhada do GLSL tem o braço contrário à perna e os pés no chão', async () => {
  const G = await import('../../fonte/render/geracao/pessoas.js');
  const SH = await import('../../fonte/render/materiais/shaders/pessoa.glsl.js');
  const vs = SH.PESSOA_VERTICE_NORMAL;
  // os números saem do próprio GLSL: lado de cada membro, coxa, joelho, braço e quanto o corpo desce
  const num = (re, nome) => {
    const m = vs.match(re);
    assert.ok(m, `GLSL sem ${nome}`);
    return Number(m[1]);
  };
  const coxa = num(/float a = (-?[\d.]+) \* amp \* sf \* lado;\s*pessoaPos = pessoaGira\( pessoaPos, PESSOA_QUADRIL/, 'o giro da coxa');
  const braco = num(/float a = (-?[\d.]+) \* amp \* sf \* lado;\s*pessoaPos = pessoaGira\( pessoaPos, PESSOA_OMBRO/, 'o giro do braço');
  const joelho = num(/float dobra = ([\d.]+) \* amp/, 'a dobra do joelho');
  const desce = num(/pessoaPos\.y -= ([\d.]+) \* amp \* sf \* sf;/, 'a descida no apoio duplo');
  assert.ok(vs.includes('( membro == 1 || membro == 2 || membro == 6 ) ? 1.0 : -1.0'), 'lado A: perna A e braço B');
  const J = G.JUNTA;
  const gira = (p, y0, a) => [p[0], y0 + (p[1] - y0) * Math.cos(a) - p[2] * Math.sin(a), (p[1] - y0) * Math.sin(a) + p[2] * Math.cos(a)];
  const pose = (p, membro, fase) => {
    const lado = membro === 1 || membro === 2 || membro === 6 ? 1 : -1;
    const sf = Math.sin(fase * 2 * Math.PI);
    let q = p;
    if (membro >= 1 && membro <= 4) {
      if (membro === 2 || membro === 4) q = gira(q, J.joelho, joelho * Math.max(0, Math.cos(fase * 2 * Math.PI) * lado));
      q = gira(q, J.quadril, coxa * sf * lado);
    } else if (membro >= 5) q = gira(q, J.ombro, braco * sf * lado);
    return [q[0], q[1] - desce * sf * sf, q[2]];
  };
  const m = G.malhaPessoa(0);
  const P = G.PARTE_PESSOA;
  for (const fase of [0.25, 0.75]) {
    const pe = { A: -9, B: -9 };
    const mao = { A: -9, B: -9 };
    let chao = 9;
    for (let i = 0; i < m.posicao.length / 3; i++) {
      const [parte, membro] = [m.corpo[2 * i], m.corpo[2 * i + 1]];
      const p = [m.posicao[3 * i], m.posicao[3 * i + 1], m.posicao[3 * i + 2]];
      const q = pose(p, membro, fase);
      const lado = p[0] > 0 ? 'A' : 'B';
      if (parte === P.SAPATO) {
        pe[lado] = Math.max(pe[lado], q[2]);
        chao = Math.min(chao, q[1]);
      }
      if (parte === P.PELE && membro >= 5) mao[lado] = Math.max(mao[lado], q[2]);
    }
    // a perna da frente e o braço do outro lado vão juntos (o passo humano, não o do camelo)
    const frente = pe.A > pe.B ? 'A' : 'B';
    const outro = frente === 'A' ? 'B' : 'A';
    assert.ok(mao[outro] > mao[frente] + 0.1, `fase ${fase}: perna ${frente} à frente com o braço do mesmo lado (mãos ${JSON.stringify(mao)})`);
    // no apoio duplo o pé de trás fica no chão (nem flutuando, nem enterrado)
    assert.ok(chao > -0.03 && chao < 0.01, `fase ${fase}: pé mais baixo a ${chao.toFixed(3)} m do chão`);
  }
});

test('gente na calçada: pela atividade e pela hora, na faixa de andar, atravessando só na faixa com os carros parados', async () => {
  const { RUA } = await import('../../fonte/render/cenas/rua.js');
  const P = await import('../../fonte/render/mundo/pedestres.js');
  const { perfilVia } = await import('../../fonte/render/geracao/perfilVia.js');
  // mais gente no comércio que na indústria; mais no fim da tarde que de madrugada
  assert.ok(P.genteDoPredio('com', 0, 50, 12) > P.genteDoPredio('ind', 0, 50, 12));
  assert.ok(P.genteDoPredio('res', 400, 0, 18.5) > 4 * P.genteDoPredio('res', 400, 0, 3));
  for (const f of ['res', 'com', 'esc', 'ind']) for (let h = 0; h < 24; h += 0.5) assert.ok(P.fatorRua(f, h) > 0 && P.fatorRua(f, h) <= 1);
  // a faixa de andar fica na calçada, longe do meio-fio (postes a 0,55 m e árvores a 1 m dele)
  for (const id of ['rua', 'avenida', 'avenidaG']) {
    const Pv = perfilVia(id);
    for (const lado of [1, -1]) {
      const c = Pv.calcadas.find((k) => k.lado === lado);
      const u = P.uDaCalcada(Pv, lado, P.FAIXA_ANDAR.de);
      assert.ok(u * lado > Math.abs(lado > 0 ? c.u0 : c.u1) + 1.2 && u * lado < Pv.meia, `${id}: faixa de andar fora da calçada`);
    }
  }
  assert.equal(P.PERFIL_PEDESTRES.media.pessoas, 420, 'teto do Média (ficha R3b)');
  const porHora = {};
  for (const hora of [3, 10, 18]) {
    const { ctx, doms } = await montarRua({ perfil: 'alta', hora, alvo: RUA, camera: { x: RUA.x, y: 30, z: RUA.z + 20 }, dominios: ['trafego', 'pedestres'] });
    doms.trafego.povoar(ctx);
    porHora[hora] = await doms.pedestres.povoar(ctx);
    if (hora !== 10) continue;
    doms.trafego.animar(true);
    doms.pedestres.animar(true);
    const atravessou = new Set();
    let perto = 0;
    let nan = 0;
    for (let q = 0, t = 0; q < 1200; q++) {
      t += 100;
      doms.trafego.quadro(t, ctx);
      doms.pedestres.quadro(t, ctx);
      const G = doms.pedestres.amostra();
      for (const p of G) {
        if (!Number.isFinite(p.x + p.y + p.z)) nan++;
        if (p.cruza) atravessou.add(p.id);
      }
      if (q % 2) continue;
      // nenhum carro a menos de 1,8 m de quem atravessa
      const C = doms.trafego.amostra();
      for (const p of G) if (p.cruza) for (const c of C) if (Math.hypot(c.x - p.x, c.z - p.z) < 1.8) perto++;
    }
    assert.equal(nan, 0, 'pessoa sem posição');
    assert.equal(perto, 0, `${perto} vezes um carro em cima de quem atravessava`);
    assert.ok(atravessou.size > 20, `só ${atravessou.size} atravessaram em 120 s`);
    assert.ok(doms.pedestres.medidas().pessoas > 150, 'a rua comercial às 10h tem gente');
    doms.trafego.descartar();
    doms.pedestres.descartar();
  }
  assert.ok(porHora[18] > porHora[10] && porHora[10] > 2 * porHora[3], `gente por hora: ${JSON.stringify(porHora)}`);
  assert.ok(porHora[18] <= P.PERFIL_PEDESTRES.alta.pessoas + 2, 'o teto do perfil');
});

// ------------------------------------------------------------------------------------------------ realce e materiais

test('realce da aresta selecionada: o bit G da tabela pelo evento selecao, e o shader soma o brilho', async () => {
  const { realcarAresta, arestaDaSelecao, BIT_REALCE } = await import('../../fonte/render/mundo/vias.js');
  const { VIA_FRAGMENTO_EMISSIVO } = await import('../../fonte/render/materiais/shaders/via.glsl.js');
  const { refDe } = await import('../../fonte/contratos/espelho.js');
  assert.ok(VIA_FRAGMENTO_EMISSIVO.includes(`& ${BIT_REALCE} )`), 'o shader lê o bit do realce');
  const dados = new Uint8Array(4 * 16);
  dados[4 * 3 + 1] = 0b100; // outro bit do canal G fica
  let r = realcarAresta(dados, -1, 3);
  assert.equal(r, 3);
  assert.equal(dados[4 * 3 + 1], 0b101);
  r = realcarAresta(dados, r, 5);
  assert.equal(dados[4 * 3 + 1], 0b100, 'apaga o realce de antes');
  assert.equal(dados[4 * 5 + 1] & 1, 1);
  r = realcarAresta(dados, r, -1);
  assert.equal(r, -1);
  assert.equal(dados[4 * 5 + 1] & 1, 0);
  const A = { n: 4, viva: Uint8Array.of(1, 1, 0, 1), ger: Uint16Array.of(0, 2, 0, 1) };
  assert.equal(arestaDaSelecao({ tipo: 'aresta', ref: refDe(1, 2) }, A), 1);
  assert.equal(arestaDaSelecao({ tipo: 'aresta', ref: refDe(1, 1) }, A), -1, 'geração velha (vaga reaproveitada)');
  assert.equal(arestaDaSelecao({ tipo: 'aresta', ref: refDe(2, 0) }, A), -1, 'aresta morta');
  assert.equal(arestaDaSelecao({ tipo: 'predio', ref: 1 }, A), -1);
  assert.equal(arestaDaSelecao(null, A), -1);
  // no domínio: o evento acende, o realce fica depois de a simulação aplicar outro passo, e a seleção nula apaga
  const THREE = await import('three');
  const { gerarCidadeSintetica } = await import('../cidade-sintetica.mjs');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { statsVazio } = await import('../../fonte/contratos/render.js');
  const V = await import('../../fonte/render/mundo/vias.js');
  const esp = gerarCidadeSintetica().sim.espelho;
  const ouvintes = new Map();
  const ctx = {
    cena: new THREE.Scene(), medidas: { familia: (m) => m }, ganchos, perfil: { id: 'media' }, camera: new THREE.PerspectiveCamera(),
    stats: statsVazio(), sim: { espelho: esp }, textura: () => null, sobre: {},
    ouvir: (n, f) => (ouvintes.set(n, f), () => {}), emitir: (n, v) => ouvintes.get(n)?.(v),
  };
  let dom = null;
  V.registrar({ registrarDominio: (n, f) => (dom = f(ctx)), registrarSelecionavel: () => {} });
  dom.aplicar({ tudo: { vias: true } }, esp);
  const AE = esp.vias.arestas;
  let e = 0;
  while (!AE.viva[e]) e++;
  const bit = () => dom.tabela.image.data[4 * e + 1] & BIT_REALCE;
  ctx.emitir('selecao', { tipo: 'aresta', ref: refDe(e, AE.ger[e]) });
  assert.equal(bit(), BIT_REALCE, 'a aresta selecionada acende');
  dom.aplicar({}, esp);
  assert.equal(bit(), BIT_REALCE, 'o realce fica depois de outro passo da simulação');
  ctx.emitir('selecao', { tipo: 'predio', ref: 3 });
  assert.equal(bit(), 0, 'selecionar outra coisa apaga');
  dom.descartar?.();
});

test('materiais da gente e dos caminhões montam sobre o three, com os ganchos e sem mediump', async () => {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { criarMaterialPessoa } = await import('../../fonte/render/mundo/pedestres.js');
  const { criarMaterialCaminhao } = await import('../../fonte/render/mundo/caminhoes.js');
  // os trechos GLSL vêm sob demanda, com os geradores
  const shPessoa = await import('../../fonte/render/materiais/shaders/pessoa.glsl.js');
  const shCaminhao = await import('../../fonte/render/geracao/caminhoes.js');
  const materiais = [
    ['pessoa', criarMaterialPessoa(ganchos, shPessoa), ['aCorpo', 'aPessoa', 'aRoupa', 'aRoupa2']],
    ['caminhao', criarMaterialCaminhao(ganchos, { gCamNoite: { value: 0 }, gCamTempo: { value: 0 }, gCamTambor: { value: new THREE.Vector4() }, gCamPiso: { value: 1 } }, shCaminhao), ['aParte2', 'aCab', 'aCarga']],
  ];
  for (const [nome, m, atributos] of materiais) {
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      defines: {},
    };
    m.onBeforeCompile(shader, null);
    for (const a of atributos) assert.ok(shader.vertexShader.includes(`attribute vec${a === 'aCorpo' || a === 'aParte2' ? 2 : 4} ${a}`), `${nome}: atributo ${a}`);
    assert.ok('gLuzRuaMapa' in shader.uniforms, `${nome}: sem o gancho noite (a luz da rua)`);
    assert.ok(!/\bmediump\b/.test(shader.vertexShader + shader.fragmentShader), `${nome}: mediump`);
    // a pose sai de uma conta só, usada na normal e na posição
    assert.ok(shader.vertexShader.includes('vec3 transformed = '), `${nome}: posição`);
    assert.ok(!shader.vertexShader.includes('#include <begin_vertex>'), `${nome}: o begin_vertex do three ficou`);
  }
});
