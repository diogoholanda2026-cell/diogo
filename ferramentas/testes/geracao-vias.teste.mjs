// Testes das vias (R3a; desenho do render 4 e 15.5, A2 "Render em Node"): perfis reais com as marcas do CTB; a
// varredura sobre o chão (sem NaN, normais para cima, pista 15 cm acima do chão, saia de 1 m, estações fundidas em reta
// plana); juntas das bocas com as peças dos nós a menos de 1 cm, sem sobreposição e sem fresta; curva fechada sem
// dobra; determinismo; quantização; os setores da cidade sintética no tempo do worker, com postes na calçada e
// semáforos só em cruzamento de avenida; os 6 carros da frota; a heurística do tráfego e o ciclo do semáforo; o mapa
// de luz da rua; o gancho no chão da R2a; os materiais montam sobre o three sem mediump.
// Roda sozinho: node ferramentas/testes/geracao-vias.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reta, tabelaArco, maisPerto, ponto } from '../../fonte/comum/bezier.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';
import { VIAS, VIAS_ORDEM, MEIO_FIO } from '../../fonte/data/vias.js';
import { perfilVia, PERFIS, MAT, ALTURA, ESTILO, COR_LINHA, alturaNaSecao } from '../../fonte/render/geracao/perfilVia.js';
import {
  gerarMalhaVia, ConstrutorVia, estacao, quantizarVia, deOctaedro, postesDaAresta, arvoresDaAresta, vagasDaAresta,
  faixasDeTransito,
} from '../../fonte/render/geracao/malhaVia.js';
import { analisarNo, gerarNo, gerarSetorVias, OBJETOS, grupoSemaforo, defasagemSemaforo } from '../../fonte/render/geracao/cruzamento.js';
import { MODELOS, malhaVeiculo, PARTE } from '../../fonte/render/geracao/veiculos.js';
import { bytesDetalheVia } from '../../fonte/render/materiais/texturas-via.js';

const plano = () => 0;
const morro = (x, z) => 3 * Math.sin(x / 40) + 2 * Math.cos(z / 30) + 0.01 * x;
const TIPOS = VIAS_ORDEM;

// ------------------------------------------------------------------------------------------------ utilidades

/** Triângulos de um construtor com a normal geométrica (não normalizada) e a do primeiro vértice. */
function* triangulos(K) {
  const P = (i) => [K.pos[3 * i], K.pos[3 * i + 1], K.pos[3 * i + 2]];
  for (let t = 0; t < K.ni; t += 3) {
    const [a, b, c] = [K.idx[t], K.idx[t + 1], K.idx[t + 2]];
    const A = P(a);
    const B = P(b);
    const C = P(c);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    yield { a, b, c, A, B, C, n, nv: [K.nor[3 * a], K.nor[3 * a + 1], K.nor[3 * a + 2]] };
  }
}

/** Confere um construtor: nada de NaN, índices válidos, face virada para o lado da normal dos vértices. */
function conferirMalha(K, onde) {
  for (let i = 0; i < K.nv * 3; i++) assert.ok(Number.isFinite(K.pos[i]) && Number.isFinite(K.nor[i]), `${onde}: NaN no vértice ${Math.floor(i / 3)}`);
  for (let i = 0; i < K.nv * 4; i++) assert.ok(Number.isFinite(K.uv[i]), `${onde}: NaN no aUV`);
  for (let i = 0; i < K.ni; i++) assert.ok(K.idx[i] < K.nv, `${onde}: índice fora`);
  let contra = 0;
  for (const t of triangulos(K)) {
    const l = Math.hypot(...t.n);
    if (l < 1e-9) continue;
    if ((t.n[0] * t.nv[0] + t.n[1] * t.nv[1] + t.n[2] * t.nv[2]) / l < -1e-6) contra++;
  }
  assert.equal(contra, 0, `${onde}: ${contra} triângulos virados contra a normal`);
}

/** Rede de prova: nós [x, z] e arestas [a, b, tipo, p1?, p2?]; cortes pelos nós; malhas das arestas e dos nós. */
function montarRede(nos, arestas, alturaEm = plano) {
  const A = arestas.map(([a, b, tipo, p1, p2], e) => {
    const [x0, z0] = nos[a];
    const [x3, z3] = nos[b];
    const p = p1 ? Float64Array.of(x0, z0, p1[0], p1[1], p2[0], p2[1], x3, z3) : reta(x0, z0, x3, z3);
    return { e, a, b, tipo, p, tab: tabelaArco(p), cIni: 0, cFim: 0 };
  });
  const nosA = nos.map(([x, z], n) => {
    const bracos = [];
    for (const ar of A) {
      if (ar.a === n) bracos.push({ e: ar.e, tipo: ar.tipo, p: ar.p, inverte: false });
      if (ar.b === n) bracos.push({ e: ar.e, tipo: ar.tipo, p: ar.p, inverte: true });
    }
    const no = analisarNo({ n, x, z, bracos });
    for (const b of no.bracos) {
      if (b.inverte) A[b.e].cFim = b.corte;
      else A[b.e].cIni = b.corte;
    }
    return no;
  });
  const Ka = new ConstrutorVia();
  const Kn = new ConstrutorVia();
  for (const ar of A) {
    const cruz = (n) => nosA[n].tipo === 'cruzamento';
    gerarMalhaVia({ p: ar.p, sIni: ar.cIni, sFim: ar.tab[16] - ar.cFim, id: ar.e, tampaIni: cruz(ar.a), tampaFim: cruz(ar.b) }, ar.tipo, { alturaEm, K: Ka });
  }
  for (const no of nosA) gerarNo(no, Kn, { alturaEm });
  return { A, nos: nosA, Ka, Kn };
}

/** Pior distância de um vértice da boca de uma aresta ao vértice mais perto da peça do nó (as juntas, 4.3). */
function juntas(Ka, Kn, A) {
  let pior = 0;
  let n = 0;
  for (let i = 0; i < Ka.nv; i++) {
    const e = Ka.id[i];
    const naBoca = (Ka.uv[4 * i + 1] < 1e-6 && A[e].cIni > 0) || (Ka.uv[4 * i + 2] < 1e-6 && A[e].cFim > 0);
    if (!naBoca) continue;
    // o canteiro e a barreira ficam de fora: a própria aresta fecha com a tampa
    const P = perfilVia(Ka.dados[4 * i + 1]);
    const u = Ka.uv[4 * i];
    const mat = Ka.dados[4 * i];
    const alto = (P.canteiro && u >= P.canteiro.u0 - 1e-6 && u <= P.canteiro.u1 + 1e-6) || (P.barreira && u >= P.barreira.u0 - 1e-6 && u <= P.barreira.u1 + 1e-6);
    if (alto && mat !== MAT.PISTA && mat !== MAT.ACOSTAMENTO) continue;
    // as tampas (faces verticais viradas para a ponta) não são junta
    if (Math.abs(Ka.nor[3 * i]) + Math.abs(Ka.nor[3 * i + 2]) > 0.99 && mat !== MAT.SAIA && mat !== MAT.MEIO_FIO && mat !== MAT.TALUDE) continue;
    let m = Infinity;
    for (let j = 0; j < Kn.nv; j++) {
      const d = Math.hypot(Ka.pos[3 * i] - Kn.pos[3 * j], Ka.pos[3 * i + 1] - Kn.pos[3 * j + 1], Ka.pos[3 * i + 2] - Kn.pos[3 * j + 2]);
      if (d < m) m = d;
    }
    n++;
    pior = Math.max(pior, m);
  }
  return { pior, n };
}

/** Triângulos virados para cima, projetados no chão: [ax, az, bx, bz, cx, cz]. */
function tampoDe(...Ks) {
  const out = [];
  for (const K of Ks) {
    for (const t of triangulos(K)) {
      const l = Math.hypot(...t.n);
      if (l < 1e-9 || t.n[1] / l < 0.2) continue;
      out.push([t.A[0], t.A[2], t.B[0], t.B[2], t.C[0], t.C[2]]);
    }
  }
  return out;
}
function cobertura(tampo, x, z) {
  let c = 0;
  for (const [ax, az, bx, bz, cx, cz] of tampo) {
    const d1 = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    const d2 = (cx - bx) * (z - bz) - (cz - bz) * (x - bx);
    const d3 = (ax - cx) * (z - cz) - (az - cz) * (x - cx);
    if ((d1 > 1e-7 && d2 > 1e-7 && d3 > 1e-7) || (d1 < -1e-7 && d2 < -1e-7 && d3 < -1e-7)) c++;
  }
  return c;
}

const REDES = {
  X: { nos: [[0, 0], [100, 0], [-100, 0], [0, 100], [0, -100]], arestas: [[0, 1, 'rua'], [2, 0, 'rua'], [0, 3, 'rua'], [4, 0, 'rua']] },
  T: { nos: [[0, 0], [100, 0], [-100, 0], [0, 100]], arestas: [[0, 1, 'avenida'], [2, 0, 'avenida'], [0, 3, 'rua']] },
  Y: { nos: [[0, 0], [100, 10], [-80, 60], [-30, -100]], arestas: [[0, 1, 'rua'], [2, 0, 'avenida'], [0, 3, 'ruaMao']] },
  agudo: { nos: [[0, 0], [100, 0], [90, 52]], arestas: [[0, 1, 'rua'], [0, 2, 'rua'], [1, 2, 'rua']] },
  curva: { nos: [[0, 0], [100, 0], [180, 60]], arestas: [[0, 1, 'avenida'], [1, 2, 'avenida']] },
  curvaInv: { nos: [[0, 0], [100, 0], [180, 60]], arestas: [[0, 1, 'rua'], [2, 1, 'rua']] },
  largura: { nos: [[0, 0], [100, 0], [200, 0]], arestas: [[0, 1, 'rua'], [1, 2, 'avenidaG']] },
  ponta: { nos: [[0, 0], [100, 0]], arestas: [[0, 1, 'avenida']] },
  curvo: { nos: [[0, 0], [120, 0], [0, 120], [-120, 0]], arestas: [[0, 1, 'rua', [40, 20], [80, -20]], [0, 2, 'avenida', [10, 40], [-10, 80]], [3, 0, 'rua']] },
  rodovia: { nos: [[0, 0], [300, 0], [-300, 0], [0, 150]], arestas: [[0, 1, 'rodovia'], [2, 0, 'rodovia'], [0, 3, 'rua']] },
  terra: { nos: [[0, 0], [60, 0], [-60, 0], [0, 60]], arestas: [[0, 1, 'terra'], [2, 0, 'terra'], [0, 3, 'rua']] },
};

// ------------------------------------------------------------------------------------------------ perfis

test('perfis: larguras da D22, seção contínua, meio-fio de 15 cm, saia de 1 m e as marcas do CTB', () => {
  for (const id of TIPOS) {
    const P = perfilVia(id);
    assert.equal(P, perfilVia(VIAS_ORDEM.indexOf(id)), `${id}: o perfil é o mesmo pelo id e pelo índice`);
    assert.equal(P.largura, VIAS[id].largura);
    assert.ok(Math.abs(P.partes[P.partes.length - 1].u1 - P.meia) < 1e-9 && Math.abs(P.partes[0].u0 + P.meia) < 1e-9, `${id}: partes de -meia a meia`);
    // linha poligonal contínua da esquerda para a direita
    for (let k = 0; k + 1 < P.tiras.length; k++) {
      const a = P.tiras[k];
      const b = P.tiras[k + 1];
      assert.ok(Math.abs(a.u1 - b.u0) < 1e-9 && Math.abs(a.y1 - b.y0) < 1e-9, `${id}: seção quebrada na tira ${k}`);
    }
    const t0 = P.tiras[0];
    const t1 = P.tiras[P.tiras.length - 1];
    if (id === 'rodovia') assert.ok(t0.mat === MAT.TALUDE && t0.y0 < 0 && t1.y1 < 0, 'rodovia: talude enterrado nas bordas');
    else assert.ok(t0.mat === MAT.SAIA && t0.y0 === ALTURA.saia && t1.y1 === ALTURA.saia, `${id}: saia de 1 m nas duas bordas`);
    // a pista 15 cm acima do chão (o aplainar põe o chão abaixo, D5) e a calçada um meio-fio acima dela
    for (const t of P.tiras) {
      if (t.mat === MAT.PISTA || t.mat === MAT.ACOSTAMENTO) assert.ok(Math.min(t.y0, t.y1) >= ALTURA.pista - 1e-9 && Math.max(t.y0, t.y1) <= ALTURA.pista + 0.2, `${id}: pista fora da altura`);
      if (t.mat === MAT.MEIO_FIO && t.u0 === t.u1) assert.ok(Math.abs(Math.abs(t.y1 - t.y0) - MEIO_FIO.altura) < 1e-9, `${id}: meio-fio de ${MEIO_FIO.altura} m`);
      if (t.mat === MAT.CALCADA) {
        assert.ok(Math.min(t.y0, t.y1) >= ALTURA.pista + MEIO_FIO.altura - 1e-9, `${id}: calçada abaixo do meio-fio`);
        // caimento de 2% para a rua
        const fora = Math.abs(t.u0) > Math.abs(t.u1) ? t.y0 : t.y1;
        const dentro = Math.abs(t.u0) > Math.abs(t.u1) ? t.y1 : t.y0;
        assert.ok(fora > dentro, `${id}: a calçada cai para a rua`);
      }
    }
    assert.equal(P.meioFio, !['rodovia', 'terra'].includes(id), `${id}: meio-fio só em via com calçada`);
    // a roda do carro encosta na faixa (com o abaulamento), nunca abaixo da pista nem na altura da calçada
    for (const f of P.faixas) {
      const y = alturaNaSecao(P, f.meio);
      assert.ok(y >= (P.terra ? ALTURA.terraBorda : ALTURA.pista) - 1e-9 && y < ALTURA.pista + 0.2, `${id}: faixa em ${f.meio} a ${y}`);
    }
    for (const c of P.calcadas) assert.ok(alturaNaSecao(P, (c.u0 + c.u1) / 2) >= ALTURA.calcada, `${id}: calçada`);
  }
  const marcas = (id) => perfilVia(id).linhas;
  const amarelas = (id) => marcas(id).filter((l) => l.cor === COR_LINHA.AMARELA);
  // rua de mão dupla: eixo amarelo seccionado (LFO-2) entre os sentidos, e a linha do estacionamento
  assert.equal(amarelas('rua').length, 1);
  assert.equal(amarelas('rua')[0].estilo, ESTILO.TRACEJADA);
  const rua = perfilVia('rua');
  const eixo = amarelas('rua')[0].u;
  assert.ok(rua.faixas.some((f) => f.sentido < 0 && Math.abs(f.u1 - eixo) < 1e-9) && rua.faixas.some((f) => f.sentido > 0 && Math.abs(f.u0 - eixo) < 1e-9), 'rua: o amarelo separa os sentidos');
  assert.ok(marcas('rua').some((l) => l.estilo === ESTILO.ESTACIONAMENTO));
  // mão única e as avenidas (sentidos separados pelo canteiro): só brancas seccionadas entre faixas (LMS-2)
  for (const id of ['ruaMao', 'avenida', 'avenidaG']) {
    assert.equal(amarelas(id).length, 0, `${id}: sem amarelo`);
    assert.ok(marcas(id).filter((l) => l.estilo === ESTILO.TRACEJADA).length >= 1, `${id}: divisão de faixas`);
  }
  // rodovia: bordos brancos contínuos (LBO) e o amarelo contínuo junto da barreira
  assert.equal(marcas('rodovia').filter((l) => l.cor === COR_LINHA.BRANCA && l.estilo === ESTILO.CONTINUA).length, 2);
  assert.equal(amarelas('rodovia').filter((l) => l.estilo === ESTILO.CONTINUA).length, 2);
  assert.equal(marcas('terra').length, 0, 'chão batido sem pintura');
  // traço e espaço: 1 para 2 na cidade, 1 para 3 na rodovia
  for (const id of ['rua', 'ruaMao', 'avenida', 'avenidaG']) assert.equal(perfilVia(id).tracejado[1] / perfilVia(id).tracejado[0], 2);
  assert.equal(perfilVia('rodovia').tracejado[1] / perfilVia('rodovia').tracejado[0], 3);
  assert.equal(PERFIS.length, VIAS_ORDEM.length);
});

// ------------------------------------------------------------------------------------------------ varredura

test('varredura: todos os tipos sobre o chão plano e o morro, em reta e em S: sem NaN, normais certas, alturas do perfil', () => {
  const curvas = {
    reta: reta(0, 0, 112, 0),
    s: Float64Array.of(0, 0, 60, 50, 90, -50, 160, 10),
  };
  for (const [nomeChao, h] of [['plano', plano], ['morro', morro]]) {
    for (const [nomeCurva, p] of Object.entries(curvas)) {
      for (const id of TIPOS) {
        const P = perfilVia(id);
        const onde = `${id} ${nomeCurva} ${nomeChao}`;
        const K = gerarMalhaVia({ p, id: 7, tampaIni: true, tampaFim: true }, id, { alturaEm: h });
        conferirMalha(K, onde);
        assert.ok(K.tris > 0);
        const tab = tabelaArco(p);
        const mp = { t: 0, d: 0, x: 0, z: 0 };
        for (let i = 0; i < K.nv; i++) {
          const x = K.pos[3 * i];
          const y = K.pos[3 * i + 1];
          const z = K.pos[3 * i + 2];
          assert.equal(K.id[i], 7);
          const u = K.uv[4 * i];
          assert.ok(Math.abs(u) <= P.meia + 1e-6, `${onde}: u ${u} fora da largura`);
          // o vértice fica a |u| do eixo (na curva, o ponto mais perto do eixo pode ser outro: 2 cm)
          maisPerto(p, x, z, 0, mp);
          assert.ok(Math.abs(mp.d - Math.abs(u)) < 0.02 || nomeCurva === 's', `${onde}: vértice a ${mp.d.toFixed(3)} m do eixo, u ${u}`);
          // a altura sai do chão (alturaEm) mais a altura da tira: pista 15 cm acima, saia 1 m abaixo
          const dy = y - h(x, z);
          const mat = K.dados[4 * i];
          if (mat === MAT.PISTA) assert.ok(dy >= ALTURA.pista - 1e-4 && dy <= ALTURA.pista + 0.2, `${onde}: pista a ${dy.toFixed(3)} do chão`);
          if (mat === MAT.SAIA) assert.ok(Math.abs(dy - ALTURA.saia) < 1e-4 || dy > 0, `${onde}: saia`);
          assert.ok(K.uv[4 * i + 1] >= -1e-6 && K.uv[4 * i + 2] >= -1e-6 && Math.abs(K.uv[4 * i + 1] + K.uv[4 * i + 2] - tab[16]) < 1e-3, `${onde}: v e vf somam o comprimento`);
        }
      }
    }
  }
});

test('estações: reta no chão plano com um quadrilátero por tira; no morro, a malha segue o chão a menos de 6 cm; na curva, a cada 3 graus', () => {
  for (const id of TIPOS) {
    const P = perfilVia(id);
    const K = gerarMalhaVia({ p: reta(0, 0, 112, 0) }, id, { alturaEm: plano });
    assert.equal(K.tris, 2 * P.tiras.length, `${id}: reta plana com ${K.tris} triângulos`);
  }
  // no morro as estações se fundem só onde o chão segue a reta: entre elas, a cada metro, a malha fica na altura da
  // tira sobre o chão (a reta no eixo x põe o vértice de u em z = u)
  for (const id of TIPOS) {
    const Km = gerarMalhaVia({ p: reta(0, 0, 112, 0) }, id, { alturaEm: morro });
    const colunas = new Map();
    for (let i = 0; i < Km.nv; i++) {
      if (Math.abs(Km.nor[3 * i + 1]) < 0.5) continue; // faces verticais
      const chave = `${Km.uv[4 * i].toFixed(3)}:${Km.dados[4 * i]}`;
      if (!colunas.has(chave)) colunas.set(chave, []);
      colunas.get(chave).push(i);
    }
    let pior = 0;
    for (const lista of colunas.values()) {
      lista.sort((a, b) => Km.pos[3 * a] - Km.pos[3 * b]);
      for (let k = 0; k + 1 < lista.length; k++) {
        const a = lista[k];
        const b = lista[k + 1];
        const xa = Km.pos[3 * a];
        const xb = Km.pos[3 * b];
        const z = Km.pos[3 * a + 2];
        const dya = Km.pos[3 * a + 1] - morro(xa, z);
        for (let x = xa; x <= xb; x += 1) {
          const f = (x - xa) / (xb - xa || 1);
          const y = Km.pos[3 * a + 1] + (Km.pos[3 * b + 1] - Km.pos[3 * a + 1]) * f;
          pior = Math.max(pior, Math.abs(y - morro(x, z) - dya));
        }
      }
    }
    assert.ok(pior < 0.06, `${id}: a malha se afasta ${(pior * 100).toFixed(1)} cm do chão entre as estações`);
  }
  // curva de 90 graus com raio 60 m: estações a cada 3 graus (ou menos) de virada
  const k = 0.5523 * 60;
  const p = Float64Array.of(0, 0, k, 0, 60, 60 - k, 60, 60);
  const Kc = gerarMalhaVia({ p }, 'rua', { alturaEm: plano });
  const ss = [...new Set(Array.from({ length: Kc.nv }, (_, i) => +Kc.uv[4 * i + 1].toFixed(5)))].sort((a, b) => a - b);
  const tab = tabelaArco(p);
  for (let i = 0; i + 1 < ss.length; i++) {
    const a = estacao(p, tab, ss[i]);
    const b = estacao(p, tab, ss[i + 1]);
    const ang = (Math.acos(Math.min(1, a.tx * b.tx + a.tz * b.tz)) * 180) / Math.PI;
    assert.ok(ang <= 3.01, `curva: ${ang.toFixed(2)} graus entre estações`);
  }
});

test('curva fechada no raio mínimo sem dobra: a borda de dentro anda sempre para a frente', () => {
  for (const id of ['rua', 'avenida', 'avenidaG', 'terra']) {
    const R = VIAS[id].raioMin;
    const k = 0.5523 * R;
    const p = Float64Array.of(0, 0, k, 0, R, R - k, R, R);
    const K = gerarMalhaVia({ p }, id, { alturaEm: plano });
    conferirMalha(K, `${id} raio ${R}`);
    // por coluna de u: os vértices em ordem de v andam na direção da tangente
    const P = perfilVia(id);
    const tab = tabelaArco(p);
    const colunas = new Map();
    for (let i = 0; i < K.nv; i++) {
      const chave = `${K.uv[4 * i].toFixed(3)}:${K.dados[4 * i]}:${(K.pos[3 * i + 1]).toFixed(3)}`;
      if (!colunas.has(chave)) colunas.set(chave, []);
      colunas.get(chave).push(i);
    }
    for (const lista of colunas.values()) {
      lista.sort((a, b) => K.uv[4 * a + 1] - K.uv[4 * b + 1]);
      for (let j = 0; j + 1 < lista.length; j++) {
        const a = lista[j];
        const b = lista[j + 1];
        const e = estacao(p, tab, K.uv[4 * a + 1]);
        const dx = K.pos[3 * b] - K.pos[3 * a];
        const dz = K.pos[3 * b + 2] - K.pos[3 * a + 2];
        if (Math.hypot(dx, dz) < 1e-6) continue;
        assert.ok(dx * e.tx + dz * e.tz > 0, `${id}: a borda u ${K.uv[4 * a].toFixed(2)} dobra na curva de raio ${R} (meia largura ${P.meia})`);
      }
    }
  }
});

// ------------------------------------------------------------------------------------------------ nós

test('nós: juntas das bocas a menos de 1 cm, peças sem NaN e viradas para cima, no plano e no morro', () => {
  const esperado = { X: 'cruzamento', T: 'cruzamento', Y: 'cruzamento', curva: 'curva', curvaInv: 'curva', ponta: 'ponta' };
  for (const [nome, R] of Object.entries(REDES)) {
    for (const [nomeChao, h] of [['plano', plano], ['morro', morro]]) {
      const { A, nos, Ka, Kn } = montarRede(R.nos, R.arestas, h);
      const onde = `${nome} ${nomeChao}`;
      conferirMalha(Ka, `${onde} (arestas)`);
      conferirMalha(Kn, `${onde} (nós)`);
      const j = juntas(Ka, Kn, A);
      assert.ok(j.n > 0, `${onde}: nenhuma boca`);
      assert.ok(j.pior < 0.01, `${onde}: junta de ${(j.pior * 100).toFixed(2)} cm`);
      if (esperado[nome]) assert.ok(nos.some((n) => n.tipo === esperado[nome]), `${onde}: sem nó do tipo ${esperado[nome]}`);
      for (const ar of A) assert.ok(ar.cIni + ar.cFim < ar.tab[16], `${onde}: cortes maiores que a aresta ${ar.e}`);
    }
  }
});

test('nós: sem sobreposição no tampo, e sem fresta nas bocas nem no meio do cruzamento', () => {
  for (const [nome, R] of Object.entries(REDES)) {
    const { A, nos, Ka, Kn } = montarRede(R.nos, R.arestas, plano);
    const tampo = tampoDe(Ka, Kn);
    // sobreposição: amostras numa grade fina em volta de cada nó
    for (const no of nos) {
      if (no.tipo === 'reto') continue;
      const r = Math.max(...no.bracos.map((b) => b.corte + b.P.meia)) + 4;
      let pior = 0;
      for (let x = no.x - r + 0.1234; x < no.x + r; x += 0.57) {
        for (let z = no.z - r + 0.0567; z < no.z + r; z += 0.57) pior = Math.max(pior, cobertura(tampo, x, z));
      }
      assert.ok(pior <= 1, `${nome}, nó ${no.n} (${no.tipo}): ${pior} camadas no mesmo ponto`);
    }
    // fresta: 10 cm para dentro do nó em cada faixa de cada boca, e o centro do cruzamento de 3 braços ou mais
    for (const no of nos) {
      if (no.tipo === 'reto') continue;
      for (const b of no.bracos) {
        const ar = A[b.e];
        const s = b.inverte ? ar.tab[16] - b.corte + 0.1 : b.corte - 0.1;
        const e = estacao(ar.p, ar.tab, s);
        for (const f of b.P.faixas) {
          const x = e.x - e.tz * f.meio;
          const z = e.z + e.tx * f.meio;
          assert.equal(cobertura(tampo, x, z), 1, `${nome}, nó ${no.n} (${no.tipo}): fresta na boca da aresta ${b.e}, faixa u ${f.meio}`);
        }
      }
      if (no.tipo === 'cruzamento' && no.bracos.length >= 3) assert.equal(cobertura(tampo, no.x + 0.013, no.z + 0.021), 1, `${nome}: o meio do cruzamento`);
    }
  }
});

test('nós: ponta sem saída com retorno redondo depois da boca, cruzamento agudo sem calçada cruzada', () => {
  // a ponta cobre da boca até o nó (o retorno), e não volta por cima da aresta
  const { A, nos, Kn } = montarRede([[0, 0], [100, 0]], [[0, 1, 'rua']], plano);
  assert.ok(nos.every((n) => n.tipo === 'ponta'));
  const tampoNo = tampoDe(Kn);
  assert.equal(cobertura(tampoNo, 3, 0.01), 1, 'o retorno cobre o fim da rua');
  assert.equal(cobertura(tampoNo, A[0].cIni + 1, 0.01), 0, 'o retorno não entra na aresta');
  // agudo (30 graus, o mínimo da S1b): a boca fica além de onde as calçadas se cruzam
  const ag = montarRede(REDES.agudo.nos, REDES.agudo.arestas, plano);
  const no0 = ag.nos[0];
  const [b0, b1] = no0.bracos;
  const ang = Math.acos(b0.dx * b1.dx + b0.dz * b1.dz);
  const minimo = b0.P.meia / Math.tan(ang / 2);
  for (const b of no0.bracos) assert.ok(b.corte >= minimo - 1e-6, `agudo: corte ${b.corte.toFixed(1)} antes de ${minimo.toFixed(1)} m`);
});

// ------------------------------------------------------------------------------------------------ determinismo e quantização

test('determinismo: a mesma aresta e o mesmo setor dão a mesma malha, bit a bit', async () => {
  // os geradores (render/geracao) não leem relógio nem sorteiam: quem pede mede o tempo
  const { readFileSync } = await import('node:fs');
  for (const f of ['perfilVia', 'malhaVia', 'cruzamento', 'veiculos']) {
    const src = readFileSync(new URL(`../../fonte/render/geracao/${f}.js`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.ok(!/\b(?:performance\.now|Date\.now|Math\.random)\b|\bnew\s+Date\b/.test(src), `${f}.js: relógio ou sorteio`);
  }
  const p = Float64Array.of(-40, 10, 20, 80, 90, -30, 150, 25);
  const h1 = (K) => fnv1aTipado(new Uint8Array(K.pos.buffer, 0, K.nv * 12), fnv1aTipado(new Uint8Array(K.idx.buffer, 0, K.ni * 4)));
  for (const id of TIPOS) {
    const a = gerarMalhaVia({ p, id: 3, marcas: 5 }, id, { alturaEm: morro });
    const b = gerarMalhaVia({ p, id: 3, marcas: 5 }, id, { alturaEm: morro });
    assert.equal(h1(a), h1(b), `${id}: malha diferente`);
  }
  const { A } = montarRede(REDES.T.nos, REDES.T.arestas, morro);
  const pedido = () => ({
    setor: 1, versao: 1, ox: -128, oz: -128, vagas: 0.5,
    arestas: A.map((ar) => ({ e: ar.e, tipo: ar.tipo, p: Array.from(ar.p), sIni: ar.cIni, sFim: ar.tab[16] - ar.cFim, mao: 0 })),
    nos: [{ n: 0, x: 0, z: 0, semaforos: true, bracos: [0, 1, 2].map((e) => ({ e, tipo: A[e].tipo, p: Array.from(A[e].p), inverte: A[e].b === 0 })) }],
  });
  const r1 = gerarSetorVias(pedido());
  const r2 = gerarSetorVias(pedido());
  assert.equal(fnv1aTipado(r1.malhas[0].atributos.posicao), fnv1aTipado(r2.malhas[0].atributos.posicao));
  assert.equal(fnv1aTipado(r1.objetos.posteDuplo.mat), fnv1aTipado(r2.objetos.posteDuplo.mat));
  // a resposta inteira (sem campo de tempo)
  const plano1 = JSON.stringify(r1, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
  assert.equal(plano1, JSON.stringify(r2, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)));
});

test('quantização (D39): posição com erro abaixo de 5 mm num setor de 256 m, normal abaixo de 1,5 grau, aId inteiro', () => {
  const K = new ConstrutorVia();
  gerarMalhaVia({ p: Float64Array.of(-20, 10, 80, 120, 180, -40, 276, 230), id: 65000 }, 'avenidaG', { alturaEm: morro, K, ox: 0, oz: 0 });
  gerarMalhaVia({ p: reta(0, 250, 256, 0), id: 12 }, 'rua', { alturaEm: morro, K });
  const q = quantizarVia(K);
  const [cx, cy, cz, s] = q.escala;
  let piorP = 0;
  let piorN = 0;
  for (let i = 0; i < q.nv; i++) {
    for (let k = 0; k < 3; k++) {
      const c = [cx, cy, cz][k];
      piorP = Math.max(piorP, Math.abs(c + (q.atributos.posicao[3 * i + k] / 32767) * s - K.pos[3 * i + k]));
    }
    const n = deOctaedro(q.atributos.normal[2 * i], q.atributos.normal[2 * i + 1]);
    const d = n[0] * K.nor[3 * i] + n[1] * K.nor[3 * i + 1] + n[2] * K.nor[3 * i + 2];
    piorN = Math.max(piorN, (Math.acos(Math.min(1, d)) * 180) / Math.PI);
  }
  assert.ok(piorP < 0.005, `posição: ${(piorP * 1000).toFixed(2)} mm`);
  assert.ok(piorN < 1.5, `normal: ${piorN.toFixed(2)} graus`);
  assert.ok(q.atributos.id.includes(65000) && q.atributos.id.includes(12));
  assert.equal(q.tris, K.tris);
});

// ------------------------------------------------------------------------------------------------ setores da cidade sintética

test('setores da cidade sintética: todos no tempo do worker, sem NaN, postes na calçada, semáforos só em avenida', async () => {
  const { gerarCidadeSintetica } = await import('../cidade-sintetica.mjs');
  const { Rede, pedidoDeSetor } = await import('../../fonte/render/mundo/vias.js');
  const { GradeSetores } = await import('../../fonte/render/mundo/setores.js');
  const { RUA } = await import('../../fonte/render/cenas/rua.js');
  const { sim } = gerarCidadeSintetica();
  const esp = sim.espelho;
  const grade = new GradeSetores();
  const rede = new Rede(grade);
  const setores = [...rede.tudo(esp)].filter((s) => s >= 0);
  assert.ok(rede.arestas.size > 500 && setores.length > 50);
  let tris = 0;
  let piorTris = 0;
  const ms = [];
  const conta = Object.fromEntries(OBJETOS.map((t) => [t, 0]));
  let estacionados = 0;
  const mp = { t: 0, d: 0, x: 0, z: 0 };
  for (const s of setores) {
    const [x0, z0] = grade.canto(s);
    const { dados } = pedidoDeSetor(rede, { s, x0, z0, versao: 1 }, esp, 0.5);
    const t = performance.now();
    const r = gerarSetorVias(dados);
    ms.push(performance.now() - t);
    tris += r.tris;
    piorTris = Math.max(piorTris, r.tris);
    const T = esp.terreno;
    const ch = dados.chao;
    for (const m of r.malhas) {
      for (const v of m.atributos.uv) assert.ok(Number.isFinite(v), `setor ${s}: NaN no aUV`);
      assert.ok(Number.isFinite(m.escala[3]) && m.escala[3] > 0);
      // o retalho do chão cobre a malha inteira (fora dele a altura ficaria presa na borda), onde o mapa deixa
      const [cx0, , cz0, cx1, , cz1] = m.caixa;
      const lim = (v, a, b) => Math.min(Math.max(v, a), b);
      const fimMapa = [T.origem[0] + (T.n - 1) * T.passo, T.origem[1] + (T.n - 1) * T.passo];
      assert.ok(ch.ox <= lim(dados.ox + cx0, T.origem[0], fimMapa[0]) + 1e-6 && ch.oz <= lim(dados.oz + cz0, T.origem[1], fimMapa[1]) + 1e-6, `setor ${s}: malha antes do retalho do chão`);
      assert.ok(ch.ox + (ch.n - 1) * ch.passo >= lim(dados.ox + cx1, T.origem[0], fimMapa[0]) - 1e-6 && ch.oz + (ch.n - 1) * ch.passo >= lim(dados.oz + cz1, T.origem[1], fimMapa[1]) - 1e-6, `setor ${s}: malha depois do retalho do chão`);
    }
    for (const [tipo, l] of Object.entries(r.objetos)) {
      conta[tipo] += l.n;
      for (let k = 0; k < l.n; k++) {
        const x = l.mat[16 * k + 12];
        const z = l.mat[16 * k + 14];
        assert.ok(Number.isFinite(x) && Number.isFinite(l.mat[16 * k + 13]) && Number.isFinite(z), `setor ${s}: ${tipo} sem posição`);
        if (tipo !== 'posteSimples') continue;
        // o poste urbano fica na calçada, junto do meio-fio, fora da pista
        const ar = rede.arestas.get(l.ids[k]);
        const P = perfilVia(ar.tipo);
        maisPerto(ar.p, x, z, 0, mp);
        assert.ok(mp.d > P.bordas.d + 0.2 && mp.d < P.meia, `setor ${s}: poste a ${mp.d.toFixed(2)} m do eixo da ${P.id}`);
      }
    }
    for (const [mi, l] of r.estacionados) {
      assert.ok(mi >= 0 && mi < MODELOS.length);
      estacionados += l.n;
    }
  }
  ms.sort((a, b) => a - b);
  const mediana = ms[Math.floor(ms.length / 2)];
  console.log(`  ${setores.length} setores, ${tris} triângulos (pior setor ${piorTris}), mediana ${mediana.toFixed(1)} ms, pior ${ms[ms.length - 1].toFixed(1)} ms`);
  console.log(`  objetos: ${JSON.stringify(conta)}, ${estacionados} carros estacionados`);
  assert.ok(mediana < 30, `setor em ${mediana.toFixed(1)} ms (mediana)`);
  assert.ok(piorTris < 12000, `setor com ${piorTris} triângulos`);
  for (const t of OBJETOS) assert.ok(conta[t] > 0, `nenhum ${t} na cidade`);
  assert.ok(estacionados > 100);
  // semáforos: só nos cruzamentos de 3 braços ou mais com avenida, nunca com a rodovia
  for (const no of rede.nos.values()) {
    if (!no.semaforos) continue;
    assert.ok(no.tipo === 'cruzamento' && no.analise.bracos.length >= 3);
    assert.ok(no.analise.bracos.some((b) => b.P.id === 'avenida' || b.P.id === 'avenidaG'));
    assert.ok(!no.analise.bracos.some((b) => b.P.id === 'rodovia'));
  }
  // o cruzamento da cena rua existe: avenida com rua, com semáforo
  const noRua = [...rede.nos.values()].find((n) => Math.hypot(n.x - RUA.x, n.z - RUA.z) < 1);
  assert.ok(noRua?.semaforos, 'o cruzamento da cena rua sumiu da cidade sintética');
});

// ------------------------------------------------------------------------------------------------ objetos, carros e tráfego

test('objetos da rua: postes, árvores e vagas longe das pontas e no lado certo', () => {
  const p = reta(0, 0, 200, 0);
  const tab = tabelaArco(p);
  for (const id of TIPOS) {
    const P = perfilVia(id);
    for (const q of postesDaAresta(p, id, 10, 190, 5, tab)) {
      assert.ok(q.s >= 14 - 1e-9 && q.s <= 186 + 1e-9, `${id}: poste junto da ponta`);
      if (P.regras.postes.onde === 'canteiro') assert.ok(Math.abs(q.u - ((P.canteiro ?? P.barreira).u0 + (P.canteiro ?? P.barreira).u1) / 2) < 1e-9);
      else assert.ok(Math.abs(q.u) > Math.max(Math.abs(P.bordas.e), P.bordas.d), `${id}: poste na pista`);
      assert.ok(Math.hypot(q.dx, q.dz) > 0.99, `${id}: braço sem direção`);
    }
    for (const q of arvoresDaAresta(p, id, 10, 190, 9, tab)) {
      assert.ok(q.s >= 16 - 1e-6 && q.s <= 184 + 1e-6, `${id}: árvore junto da ponta`);
      const naPista = P.pistas.some((pp) => q.u > pp.u0 && q.u < pp.u1);
      assert.ok(!naPista, `${id}: árvore na pista (u ${q.u})`);
    }
    const vagas = vagasDaAresta(p, id, 10, 190, 9, 0, 1, tab);
    assert.equal(vagas.length > 0, P.vagas.length > 0, `${id}: vagas só onde há estacionamento`);
    for (const q of vagas) assert.ok(P.vagas.some((v) => q.u >= v.u0 && q.u <= v.u1), `${id}: carro fora da vaga`);
    // as faixas de trânsito da mão: dupla tem os dois sentidos, única um só
    const fx = faixasDeTransito(id, 0);
    assert.equal(fx.length, P.faixas.length);
    if (VIAS[id].mao === 'dupla') assert.ok(fx.some((f) => f.sentido > 0) && fx.some((f) => f.sentido < 0));
  }
});

/**
 * Amostras dos faróis (e das lanternas) que um raio para a frente (para trás) mostra atrás de alguma face da
 * carroceria: um farol enterrado no bico não acende para quem vem de frente.
 */
function luzesEscondidas(v) {
  const P = (i) => [v.posicao[3 * i], v.posicao[3 * i + 1], v.posicao[3 * i + 2]];
  const raio = (o, dz, a, b, c) => {
    // Möller-Trumbore com a direção (0, 0, dz)
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const p = [-dz * e2[1], dz * e2[0], 0];
    const det = e1[0] * p[0] + e1[1] * p[1];
    if (Math.abs(det) < 1e-12) return -1;
    const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
    const u = (s[0] * p[0] + s[1] * p[1]) / det;
    if (u < 0 || u > 1) return -1;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const w = (dz * q[2]) / det;
    if (w < 0 || u + w > 1) return -1;
    return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
  };
  let escondidas = 0;
  for (const [parte, dz] of [[PARTE.FAROL, 1], [PARTE.LANTERNA, -1]]) {
    const vs = [];
    for (let i = 0; i < v.parte.length; i++) if (v.parte[i] === parte) vs.push(i);
    // cada célula de luz tem 4 vértices seguidos
    for (let q = 0; q + 3 < vs.length; q += 4) {
      const [A, B, C, D] = [0, 1, 2, 3].map((k) => P(vs[q + k]));
      for (const [fa, fb] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.8], [0.2, 0.8], [0.8, 0.2]]) {
        const o = [0, 1, 2].map((k) => {
          const ab = A[k] + (B[k] - A[k]) * fa;
          const dc = D[k] + (C[k] - D[k]) * fa;
          return ab + (dc - ab) * fb;
        });
        o[2] += dz * 1e-4;
        for (let t = 0; t < v.indices.length; t += 3) {
          const [a, b, c] = [v.indices[t], v.indices[t + 1], v.indices[t + 2]];
          if (v.parte[a] === parte || v.parte[a] === PARTE.SOMBRA) continue;
          if (raio(o, dz, P(a), P(b), P(c)) > 1e-4) {
            escondidas++;
            break;
          }
        }
      }
    }
  }
  return escondidas;
}

test('carros: 6 modelos da frota brasileira em medidas reais, LOD0 de 150 a 400 triângulos e LOD1 de 12 a 24', () => {
  assert.deepEqual(MODELOS.map((m) => m.id), ['hatch', 'seda', 'suv', 'picape', 'onibus', 'caminhao']);
  for (let i = 0; i < MODELOS.length; i++) {
    const m = MODELOS[i];
    assert.equal(malhaVeiculo(i, 0), malhaVeiculo(m.id, 0), `${m.id}: guardado`);
    for (const lod of [0, 1]) {
      const v = malhaVeiculo(i, lod);
      const [lo, hi] = lod ? [12, 24] : [150, 400];
      assert.ok(v.tris >= lo && v.tris <= hi, `${m.id} LOD${lod}: ${v.tris} triângulos`);
      assert.equal(v.parte.length, v.posicao.length / 3);
      let y0 = Infinity;
      let y1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      let x1 = 0;
      for (let k = 0; k < v.posicao.length; k += 3) {
        assert.ok(Number.isFinite(v.posicao[k]) && Number.isFinite(v.posicao[k + 1]) && Number.isFinite(v.posicao[k + 2]));
        y0 = Math.min(y0, v.posicao[k + 1]);
        y1 = Math.max(y1, v.posicao[k + 1]);
        z0 = Math.min(z0, v.posicao[k + 2]);
        z1 = Math.max(z1, v.posicao[k + 2]);
        if (v.parte[k / 3] !== PARTE.SOMBRA) x1 = Math.max(x1, Math.abs(v.posicao[k]));
      }
      // no chão, do tamanho de verdade (a sombra de contato passa 15 cm), e com faróis e lanternas no LOD0
      assert.ok(y0 >= -1e-6 && Math.abs(y1 - m.h) < 0.05, `${m.id} LOD${lod}: altura ${y0.toFixed(2)} a ${y1.toFixed(2)}`);
      assert.ok(Math.abs(z1 - z0 - (m.c + 0.3)) < 0.05, `${m.id} LOD${lod}: comprimento ${(z1 - z0).toFixed(2)}`);
      assert.ok(x1 <= m.l / 2 + 0.2, `${m.id} LOD${lod}: largura ${(2 * x1).toFixed(2)}`);
      if (!lod) assert.ok(v.parte.includes(PARTE.FAROL) && v.parte.includes(PARTE.LANTERNA), `${m.id}: sem faróis ou lanternas`);
      if (!lod) assert.equal(luzesEscondidas(v), 0, `${m.id}: farol ou lanterna dentro da carroceria`);
      // de longe (LOD1) a ponta da frente e a de trás acendem à noite: a cidade vista de cima tem as filas de luz
      if (lod) assert.ok(v.parte.includes(PARTE.FRENTE) && v.parte.includes(PARTE.TRASEIRA), `${m.id} LOD1: sem as pontas que acendem`);
    }
    assert.ok(m.c >= 3.5 && m.c <= 13 && m.l >= 1.6 && m.l <= 2.6, `${m.id}: medidas fora da frota`);
  }
});

test('carros de perto (VIS1b): lataria curva, para-choque, placa, vidros e retrovisores; LOD1 com o custo de antes', async () => {
  const { CARRO_GLSL } = await import('../../fonte/render/mundo/trafego.js');
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  for (let i = 0; i < 4; i++) {
    const m = MODELOS[i];
    const v = malhaVeiculo(i, 0);
    const N = (k) => [v.normal[3 * k], v.normal[3 * k + 1], v.normal[3 * k + 2]];
    const Pt = (k) => [v.posicao[3 * k], v.posicao[3 * k + 1], v.posicao[3 * k + 2]];
    const partes = new Set(v.parte);
    for (const p of [PARTE.PLACA, PARTE.PLASTICO, PARTE.VIDRO, PARTE.FAROL, PARTE.LANTERNA, PARTE.ARO]) assert.ok(partes.has(p), `${m.id}: sem a parte ${p}`);
    let curvos = 0;
    let pintura = 0;
    let chapada = 0;
    let placas = 0;
    let espelhos = 0;
    let vidroLado = 0;
    for (let t = 0; t < v.indices.length; t += 3) {
      const ids = [v.indices[t], v.indices[t + 1], v.indices[t + 2]];
      const [A, B, C] = ids.map(Pt);
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const area = Math.hypot(...n) / 2;
      if (area < 1e-9) continue;
      const nf = n.map((x) => x / (2 * area));
      const parte = v.parte[ids[0]];
      if (parte === PARTE.PINTURA) {
        pintura++;
        if (ids.some((k) => ang(N(k), nf) > (5 * Math.PI) / 180)) curvos++;
        // a lataria de trás ou da frente chapada (as três normais a menos de 12 graus do eixo): era o bloco claro
        for (const dz of [-1, 1]) if (ids.every((k) => ang(N(k), [0, 0, dz]) < (12 * Math.PI) / 180)) chapada += area;
      }
      if (parte === PARTE.PLACA) placas += area;
      // o espelho do retrovisor: vidro virado para trás, fora da lateral
      if (parte === PARTE.VIDRO && nf[2] < -0.9 && Math.abs(A[0] + B[0] + C[0]) / 3 > m.l / 2 - 0.05) espelhos++;
      if (parte === PARTE.VIDRO && Math.abs(nf[0]) > 0.8) vidroLado += area;
    }
    assert.ok(curvos / pintura > 0.6, `${m.id}: só ${curvos} de ${pintura} triângulos de pintura com a normal suave`);
    assert.ok(chapada < 0.05, `${m.id}: ${chapada.toFixed(2)} m² de pintura chapada de frente ou de trás`);
    // as duas placas Mercosul (40 x 13 cm)
    assert.ok(Math.abs(placas - 2 * 0.4 * 0.13) < 0.03, `${m.id}: placas com ${placas.toFixed(3)} m²`);
    assert.ok(espelhos >= 4, `${m.id}: sem os dois retrovisores`);
    assert.ok(vidroLado > 0.6, `${m.id}: janelas laterais com ${vidroLado.toFixed(2)} m²`);
  }
  // de longe nada muda: o LOD1 de todos os modelos com os mesmos 22 triângulos (20 e a sombra de contato)
  for (let i = 0; i < MODELOS.length; i++) assert.equal(malhaVeiculo(i, 1).tris, 22, `${MODELOS[i].id} LOD1`);
  // a pintura é verniz, não espelho; o vidro reflete o céu sem o espelho branco; placa e plástico com a cor deles
  const rug = (p) => Number(new RegExp(`p == ${p}[^}]*?gCarroRug = ([\\d.]+)`).exec(CARRO_GLSL.cor)?.[1]);
  assert.ok(/gCarroRug = 0\.36 \+/.test(CARRO_GLSL.cor), 'pintura com rugosidade de verniz');
  assert.ok(rug(1) >= 0.1, `vidro com rugosidade ${rug(1)}`);
  assert.ok(rug(10) >= 0.4 && rug(11) >= 0.5, 'placa e plástico foscos');
});

test('tráfego pela heurística (M1a): hora, tipo de via e zonas; teto do Média; semáforo com fases que não se cruzam', async () => {
  const { fatorHora, fatorZona, densidade, faseSemaforo, PERFIL_TRAFEGO, PARADA, distanciaNaFila } = await import('../../fonte/render/mundo/trafego.js');
  const { VIA_FRAGMENTO_PARS } = await import('../../fonte/render/materiais/shaders/via.glsl.js');
  // na fila, para-choque com para-choque: atrás de um ônibus o hatch não entra nele
  for (let a = 0; a < MODELOS.length; a++) {
    for (let b = 0; b < MODELOS.length; b++) assert.ok(distanciaNaFila(a, b) > (MODELOS[a].c + MODELOS[b].c) / 2 + 0.5, `fila ${MODELOS[a].id} atrás de ${MODELOS[b].id}`);
  }
  // no vermelho a frente para antes da linha de retenção do shader, e a retenção fica 1,6 m antes da zebra (CTB)
  const ret = VIA_FRAGMENTO_PARS.includes('viaFaixa( v, 0.8, 4.8 )') ? null : 'zebra';
  assert.equal(ret, null, 'a zebra mudou de lugar no shader');
  const mRet = /float ri = viaFaixa\( v, ([\d.]+), ([\d.]+) \)/.exec((await import('../../fonte/render/materiais/shaders/via.glsl.js')).VIA_FRAGMENTO_PARS);
  assert.ok(mRet, 'retenção no shader');
  assert.ok(+mRet[1] - 4.8 >= 1.6 - 1e-9, `retenção a ${(+mRet[1] - 4.8).toFixed(2)} m da zebra`);
  assert.ok(PARADA > +mRet[2], `o carro para em ${PARADA} m, a retenção vai até ${mRet[2]} m`);
  assert.ok(fatorHora(3) < 0.2, 'madrugada vazia');
  assert.ok(fatorHora(7.5) > 0.95 && fatorHora(18) > 0.8, 'picos da manhã e do fim da tarde');
  assert.ok(fatorHora(12.5) > fatorHora(10) && fatorHora(10) > fatorHora(3));
  for (let h = 0; h < 24; h += 0.25) assert.ok(fatorHora(h) > 0 && fatorHora(h) <= 1);
  assert.ok(densidade('avenida', 8, null, 100) > densidade('rua', 8, null, 100));
  assert.ok(densidade('rua', 8, null, 100) > densidade('terra', 8, null, 100));
  assert.ok(fatorZona({ com: 10 }, 100) > fatorZona({ res: 10 }, 100) && fatorZona({ res: 10 }, 100) > fatorZona(null, 100));
  assert.equal(PERFIL_TRAFEGO.media.carros, 120, 'teto do Média (ficha R3a)');
  for (const p of Object.values(PERFIL_TRAFEGO)) assert.ok(p.carros <= 400, 'até 400 carros na CPU (desenho 8)');
  // 40 s por ciclo: 16 s de verde, 3 de amarelo; os dois grupos nunca verdes juntos
  for (const defas of [0, 77, 255]) {
    let verde = 0;
    for (let t = 0; t < 40; t += 0.05) {
      const a = faseSemaforo(t, 0, defas);
      const b = faseSemaforo(t, 1, defas);
      assert.ok(!(a === 0 && b === 0), 'os dois grupos verdes');
      if (a === 0) verde += 0.05;
    }
    assert.ok(Math.abs(verde - 16) < 0.2, `verde de ${verde.toFixed(1)} s`);
  }
  // o grupo sai da direção do braço (leste-oeste e norte-sul) e a defasagem é a mesma para o shader e os carros
  assert.notEqual(grupoSemaforo(0), grupoSemaforo(Math.PI / 2));
  assert.equal(grupoSemaforo(0), grupoSemaforo(Math.PI));
  assert.ok(defasagemSemaforo(409) >= 0 && defasagemSemaforo(409) < 256);
});

test('tráfego andando na cidade sintética: fila sem carro dentro de carro, sem trava, retorno na ponta da rua', async () => {
  const THREE = await import('three');
  const { gerarCidadeSintetica } = await import('../cidade-sintetica.mjs');
  const { Rede } = await import('../../fonte/render/mundo/vias.js');
  const { GradeSetores } = await import('../../fonte/render/mundo/setores.js');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { statsVazio } = await import('../../fonte/contratos/render.js');
  const { registrar, distanciaNaFila, FOLGA_FILA } = await import('../../fonte/render/mundo/trafego.js');
  const { RUA } = await import('../../fonte/render/cenas/rua.js');
  const { sim } = gerarCidadeSintetica();
  const esp = sim.espelho;
  const rede = new Rede(new GradeSetores());
  rede.tudo(esp);
  const vias = { rede, *setoresPerto() {} };
  const pontaDeRua = [...rede.nos.values()].find((n) => n.tipo === 'ponta' && n.analise.bracos[0].P.id !== 'rodovia');
  assert.ok(pontaDeRua, 'a cidade sintética não tem rua sem saída');
  for (const [nome, alvo] of [['cruzamento da cena rua', RUA], ['rua sem saída', pontaDeRua]]) {
    let dom = null;
    const ctx = {
      cena: new THREE.Scene(), medidas: { familia: (m) => m }, ganchos, perfil: { id: 'media' }, camera: new THREE.PerspectiveCamera(),
      stats: statsVazio(), sim: { espelho: esp }, horaDoCeu: () => 8, sol: { dia: 1 },
      cameraApi: { alvo: (v) => v.set(alvo.x, 0, alvo.z) },
      dominio: (n) => (n === 'vias' ? vias : null),
    };
    ctx.camera.position.set(alvo.x, 80, alvo.z + 40);
    registrar({ registrarDominio: (n, f) => { dom = f(ctx); } });
    assert.ok(dom.povoar(ctx) > 10, `${nome}: tráfego vazio`);
    dom.animar(true);
    let sobre = 0;
    let retornos = 0;
    let piorParado = 0;
    const parado = new Map();
    // 150 s de jogo a 10 quadros por segundo
    for (let q = 0, t = 0; q < 1500; q++) {
      t += 100;
      dom.quadro(t, ctx);
      const C = dom.amostra();
      for (const c of C) {
        const p = c.v < 0.1 ? (parado.get(c.id) ?? 0) + 0.1 : 0;
        parado.set(c.id, p);
        piorParado = Math.max(piorParado, p);
        if (c.retorno) retornos++;
      }
      if (q % 5) continue;
      for (let i = 0; i < C.length; i++) {
        for (let j = i + 1; j < C.length; j++) {
          const a = C[i];
          const b = C[j];
          if (a.curva || b.curva || a.e !== b.e || a.u !== b.u || a.sentido !== b.sentido) continue;
          if (Math.abs(a.s - b.s) < distanciaNaFila(a.mi, b.mi) - FOLGA_FILA - 0.3) sobre++;
        }
      }
    }
    assert.equal(sobre, 0, `${nome}: ${sobre} vezes um carro dentro do outro na mesma faixa`);
    assert.ok(piorParado < 60, `${nome}: carro parado ${piorParado.toFixed(0)} s (trava)`);
    assert.ok(dom.amostra().length > 10, `${nome}: o tráfego minguou`);
    if (nome === 'rua sem saída') assert.ok(retornos > 0, 'nenhum carro fez o retorno na ponta');
    dom.descartar();
  }
});

test('luz da rua: uma poça por lado do poste, sódio e LED, e as avenidas mais fortes', async () => {
  const { luzesDaRede, LAMPADAS, GANHO_LUZ_RUA } = await import('../../fonte/render/mundo/luzRua.js');
  const mk = (e, tipo, p) => ({ e, tipo: VIAS_ORDEM.indexOf(tipo), p, tab: tabelaArco(p), L: tabelaArco(p)[16], cIni: 10, cFim: 10 });
  const rede = [mk(0, 'rua', reta(0, 0, 300, 0)), mk(1, 'avenida', reta(0, 100, 300, 100)), mk(2, 'terra', reta(0, 300, 300, 300))];
  const { pos, cor, n } = luzesDaRede(rede);
  const postes = (ar) => postesDaAresta(ar.p, ar.tipo, ar.cIni, ar.L - ar.cFim, ar.e, ar.tab);
  assert.equal(n, postes(rede[0]).length + 2 * postes(rede[1]).length + postes(rede[2]).length, 'o poste duplo acende os dois lados');
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) assert.ok(Number.isFinite(pos[4 * i + k]));
    assert.ok(pos[4 * i + 2] >= 10 && pos[4 * i + 2] <= 20, 'raio da poça de 10 a 20 m');
  }
  // cada luz tem a cor de uma das lâmpadas (sódio âmbar, LED neutro ou forte)
  for (let i = 0; i < n; i++) {
    const c = cor.subarray(3 * i, 3 * i + 3);
    assert.ok(Object.values(LAMPADAS).some((l) => Math.abs(l[0] - c[0]) + Math.abs(l[1] - c[1]) + Math.abs(l[2] - c[2]) < 1e-5), `luz ${i} sem lâmpada`);
  }
  // na avenida, a intensidade é a do LED forte
  const ia = [];
  for (let i = 0; i < n; i++) if (Math.abs(pos[4 * i + 1] - 100) < 20) ia.push(pos[4 * i + 3]);
  assert.ok(ia.length && ia.every((x) => Math.abs(x - LAMPADAS.ledForte[3]) < 1e-6));
  assert.ok(GANHO_LUZ_RUA >= 2 && GANHO_LUZ_RUA <= 8);
});

// ------------------------------------------------------------------------------------------------ materiais e o chão

test('detalhe da via: determinístico, periódico e com os quatro canais variados', () => {
  const a = bytesDetalheVia(64);
  const b = bytesDetalheVia(64);
  assert.equal(fnv1aTipado(a), fnv1aTipado(b));
  for (let c = 0; c < 4; c++) assert.ok(new Set(a.filter((_, i) => i % 4 === c)).size > 20, `canal ${c} liso`);
  // periódico: a borda de cima emenda com a de baixo sem salto maior que o do miolo
  let salto = 0;
  let miolo = 0;
  for (let i = 0; i < 64; i++) {
    salto = Math.max(salto, Math.abs(a[4 * i + 1] - a[4 * (63 * 64 + i) + 1]));
    miolo = Math.max(miolo, Math.abs(a[4 * (31 * 64 + i) + 1] - a[4 * (32 * 64 + i) + 1]));
  }
  assert.ok(salto <= miolo + 8, `mosaico com emenda (${salto} contra ${miolo})`);
});

test('materiais via, carro e objetos montam sobre o MeshStandardMaterial do three, com os ganchos e sem mediump', async () => {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { criarMaterialVia, criarUniformesVia } = await import('../../fonte/render/mundo/vias.js');
  const { criarMaterialCarro } = await import('../../fonte/render/mundo/trafego.js');
  const { criarMaterialObjetos } = await import('../../fonte/render/mundo/props.js');
  const materiais = [
    ['via', criarMaterialVia(ganchos, criarUniformesVia()), ['gViaTab', 'gViaDetalhe', 'gViaLonge']],
    ['carro', criarMaterialCarro(ganchos, { gCarroNoite: { value: 0 } }), ['gCarroNoite']],
    ['obj-rua', criarMaterialObjetos(ganchos, { gObjNoite: { value: 0 }, gObjTempo: { value: 0 }, gObjLuz: { value: new THREE.Color() } }), ['gObjTempo']],
  ];
  for (const [nome, m, unis] of materiais) {
    const shader = {
      uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      defines: {},
    };
    m.onBeforeCompile(shader, null);
    for (const u of unis) assert.ok(u in shader.uniforms, `${nome}: uniforme ${u}`);
    assert.ok('gLuzRuaMapa' in shader.uniforms, `${nome}: sem o gancho noite (a luz da rua)`);
    assert.ok(!/\bmediump\b/.test(shader.vertexShader + shader.fragmentShader), `${nome}: mediump`);
  }
  const via = materiais[0][1];
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, defines: {} };
  via.onBeforeCompile(shader, null);
  assert.ok(shader.vertexShader.includes('attribute uint aId') && shader.fragmentShader.includes('viaMarcas('));
  // a luz da rua entra só pelo gancho `noite` (sem a soma dupla no emissivo da via)
  assert.ok(!shader.fragmentShader.includes('gLuzRua;'));
  // o poste e o semáforo em pé no eixo (cone(x, z, y0, y1): a altura no lugar do z plantava peças soltas a metros dele)
  const { MODELOS_PROPS } = await import('../../fonte/render/mundo/props.js');
  for (const nome of Object.keys(MODELOS_PROPS)) {
    const g = MODELOS_PROPS[nome]().g;
    g.computeBoundingBox();
    const b = g.boundingBox;
    assert.ok(Math.max(-b.min.x, b.max.x) < 0.5 && Math.max(-b.min.z, b.max.z) < 5 && b.max.y > 5, `${nome}: peça fora do lugar`);
  }
});

test('árvores de rua (VIS1b): o setor dá as listas, a vegetação da R2b planta oiti e palmeira-imperial, props não desenha copa', async () => {
  const THREE = await import('three');
  const P = await import('../../fonte/render/mundo/props.js');
  const { OBJETOS } = await import('../../fonte/render/geracao/cruzamento.js');
  const { ESPECIE } = await import('../../fonte/render/geracao/arvores.js');
  // as listas de árvore do setor vão todas para a vegetação, e só elas
  assert.deepEqual([...P.ARVORES_DA_RUA].sort(), OBJETOS.filter((t) => !P.TIPOS_DESENHADOS.includes(t)).sort());
  assert.ok(!Object.keys(P.MODELOS_PROPS).some((k) => /copa|palmeira/.test(k)), 'props ainda tem modelo de árvore');
  // a vegetação (mundo/vegetacao.js) troca para as árvores da rua quando 'props:copa0' some da cena: o domínio props
  // não põe árvore nenhuma na cena, nem na sombra própria
  const cena = new THREE.Scene();
  const projetados = [];
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const ctx = { cena, ganchos, perfil: { id: 'pc' }, medidas: { familia: (m) => m }, sombra: { projetor: (m) => projetados.push(m), soltar() {}, marcar() {} } };
  let dom = null;
  P.registrar({ registrarDominio: (n, f) => (dom = f(ctx)) });
  const st = { s: 1, dist: 10, objetos: { copa: { n: 2, mat: new Float32Array(32), bytes: new Uint8Array(8) }, palmeira: { n: 1, mat: new Float32Array(16), bytes: new Uint8Array(4) } } };
  dom.quadro(0, { ...ctx, dominio: () => ({ versaoObjetos: 1, setoresPerto: () => [st] }), sim: { espelho: { tempo: {} } }, sol: { dia: 1 } });
  assert.equal(cena.getObjectByName('props:copa0'), undefined);
  assert.ok(!cena.children.some((o) => /copa|palmeira/.test(o.name)) && projetados.length === 0);
  assert.equal(dom.instancias, 0, 'as árvores do setor não viram instância do props');
  // a vegetação traduz copa em oiti e palmeira em palmeira-imperial (o texto do arquivo dela: arvoresDaRua)
  const { readFileSync } = await import('node:fs');
  const veg = readFileSync(new URL('../../fonte/render/mundo/vegetacao.js', import.meta.url), 'utf8');
  assert.match(veg, /\['copa', ESPECIE\.oiti, [\d.]+\], \['palmeira', ESPECIE\.palmeira, [\d.]+\]/);
  assert.match(veg, /comRua = !c\.cena\.getObjectByName\('props:copa0'\)/);
  assert.ok(ESPECIE.oiti >= 0 && ESPECIE.palmeira >= 0);
});

test('chão da R2a: o gancho que apaga a pintura da via perto acha a leitura do uso do solo, com e sem o GLSL enxuto', async () => {
  const THREE = await import('three');
  const { ligarChaoNoShader, ALVO_USO_CHAO } = await import('../../fonte/render/mundo/vias.js');
  const { GLSL_TER_FRAGMENTO } = await import('../../fonte/render/materiais/shaders/terreno.glsl.js');
  const { enxugarGlsl } = await import('../montar.mjs');
  const fonte = Object.values(GLSL_TER_FRAGMENTO).filter((x) => typeof x === 'string').join('\n');
  assert.ok(ALVO_USO_CHAO.test(fonte), 'o terreno não lê mais tUso de uTerUso em tUVM');
  // o mesmo GLSL como a montagem entrega (sem comentários nem espaços em volta de parênteses e vírgulas)
  assert.ok(!/[`\\]|\$\{/.test(fonte));
  const js = enxugarGlsl(`x = /* glsl */ \`${fonte}\`;`);
  const enxuto = js.slice(js.indexOf('`') + 1, js.lastIndexOf('`'));
  assert.ok(enxuto.length < fonte.length && ALVO_USO_CHAO.test(enxuto));
  for (const glsl of [fonte, enxuto]) {
    const fs = THREE.ShaderLib.standard.fragmentShader.replace('#include <common>', `#include <common>\n${glsl}`);
    const ligado = ligarChaoNoShader(fs);
    assert.ok(ligado && ligado.includes('uniform vec2 uViaPerto;') && /tUso\.r \*= smoothstep\( uViaPerto\.x, uViaPerto\.y, vTer\.z \)/.test(ligado));
  }
  assert.equal(ligarChaoNoShader('void main() {}'), null);
});
