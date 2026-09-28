// Testes do gerador de prédios (R4a; A2 "Render em Node", desenho do render 15.5): plano e malha para todos os
// modelos, níveis e estilos; determinismo; nada de NaN; prédio dentro do lote e da altura do nível; triângulos por LOD
// no teto; LOD1 com a mesma caixa do LOD0 (1 cm); atributos quantizados com erro abaixo de 5 mm; setor de ~150 prédios
// no tempo do worker; variedade pela semente; tipologias brasileiras presentes; paletas com albedo real; o material
// `edificio` monta com o three (e o shader conhece todos os tipos de superfície).
// Roda sozinho: node ferramentas/testes/geracao-predios.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planoPredio, caixaDasPecas, SOBRA_MAX, ENTERRA } from '../../fonte/render/geracao/planoPredio.js';
import { Construtor, malhaDoPlano, instanciasDoPlano, formaUnitaria, FORMA, FACHADA, deOctaedro, octaedro } from '../../fonte/render/geracao/malhaPredio.js';
import { quantizarMalha, paraHalf, deHalf } from '../../fonte/render/geracao/quantizar.js';
import { gerarSetor, CAIXA } from '../../fonte/render/geracao/fundir.js';
import { GradeSetores, pedidoDoSetor } from '../../fonte/render/mundo/setores.js';
import { bytesDetalhe } from '../../fonte/render/materiais/texturas-predio.js';
import { PREDIOS, PREDIOS_ORDEM, PE_DIREITO } from '../../fonte/data/predios.js';
import { ZONAS } from '../../fonte/data/zonas.js';
import { PALETAS, TIPOLOGIAS } from '../../fonte/data/estilos.js';
import { fnv1aTipado } from '../../fonte/comum/hash.js';

const SEMENTES = 24;
const casos = [];
for (const id of PREDIOS_ORDEM) {
  const m = PREDIOS[id];
  for (let nivel = 1; nivel <= 5; nivel++) casos.push({ id, m, nivel, w: m.planta[0] * 8, d: m.planta[1] * 8 });
}
const semente = (k) => (Math.imul(k + 1, 2654435761) ^ 0x5bd1e995) >>> 0;

/** Teto de triângulos do LOD0 por família de zona (desenho 5.3; teto das torres no Média). */
function tetoLod0(zona) {
  if (zona === 'resBaixa' || zona === 'comBaixa') return 600;
  if (zona === 'resAlta' || zona === 'escritorio') return 1200;
  if (zona === 'industria') return 800;
  return 1500;
}

test('plano e LOD0: todos os modelos, níveis e estilos, sem NaN, dentro do lote, da altura e do teto de triângulos', () => {
  for (const c of casos) {
    for (let k = 0; k < SEMENTES; k++) {
      const pl = planoPredio({ w: c.w, d: c.d, modelo: c.id, nivel: c.nivel, estilo: k % 4, semente: semente(k) });
      const onde = `${c.id} nível ${c.nivel} semente ${k} (${pl.tipologia})`;
      assert.ok(pl.pecas.length > 0, `${onde}: sem peças`);
      assert.equal(pl.pecas.filter((p) => p.principal).length, 1, `${onde}: uma peça principal`);
      const K = new Construtor(512);
      K.predio(3, 1, -2, 0.7, 9);
      const tris = malhaDoPlano(K, pl);
      for (let i = 0; i < K.nv * 3; i++) {
        assert.ok(Number.isFinite(K.pos[i]) && Number.isFinite(K.nor[i]), `${onde}: NaN no vértice ${Math.floor(i / 3)}`);
      }
      for (let i = 0; i < K.nv * 4; i++) assert.ok(Number.isFinite(K.fuv[i]), `${onde}: NaN na fachada`);
      assert.ok(tris <= tetoLod0(c.m.zona), `${onde}: ${tris} triângulos no LOD0 (teto ${tetoLod0(c.m.zona)})`);
      // dentro do lote (o toldo e a marquise avançam até SOBRA_MAX sobre a calçada)
      const b = caixaDasPecas(pl.pecas);
      assert.ok(b[0] >= -c.w / 2 - 0.01 && b[3] <= c.w / 2 + 0.01, `${onde}: fora do lote em x (${b[0].toFixed(2)}, ${b[3].toFixed(2)})`);
      assert.ok(b[2] >= -c.d / 2 - 0.01 && b[5] <= c.d / 2 + SOBRA_MAX, `${onde}: fora do lote em z (${b[2].toFixed(2)}, ${b[5].toFixed(2)})`);
      assert.ok(b[1] >= -ENTERRA - 0.01, `${onde}: desce demais`);
      // altura: o teto de andares do nível, o pé-direito da tipologia, o térreo, a coroa e o heliponto
      const fam = ZONAS[c.m.zona].familia;
      const pe = Math.max(TIPOLOGIAS[pl.tipologia]?.pe ?? 3, PE_DIREITO[fam]);
      const [, a1] = c.m.niveis[c.nivel - 1].andares;
      const teto = a1 * pe * 1.25 + 16;
      assert.ok(pl.alturaTopo <= teto, `${onde}: ${pl.alturaTopo.toFixed(1)} m acima do teto do nível (${teto.toFixed(1)})`);
      assert.ok(pl.andares >= c.m.niveis[c.nivel - 1].andares[0] && pl.andares <= a1, `${onde}: andares fora da faixa do catálogo`);
    }
  }
});

test('LOD1: a mesma caixa do LOD0 (1 cm), só formas do contrato e triângulos por prédio no teto', () => {
  const tForma = [FORMA.CAIXA, FORMA.CHANFRO, FORMA.CILINDRO, FORMA.DUAS_AGUAS].map((f) => formaUnitaria(f).tris);
  assert.deepEqual(tForma.map((t) => t <= 36), [true, true, true, true]);
  assert.equal(tForma[FORMA.CAIXA], 10);
  for (const c of casos) {
    for (let k = 0; k < SEMENTES; k++) {
      const pl = planoPredio({ w: c.w, d: c.d, modelo: c.id, nivel: c.nivel, estilo: k % 4, semente: semente(k) });
      const onde = `${c.id} nível ${c.nivel} semente ${k} (${pl.tipologia})`;
      const b0 = caixaDasPecas(pl.pecas, (p) => !p.lote && !p.sobra && !p.soLod1);
      const b1 = caixaDasPecas(pl.pecas, (p) => p.lod1);
      const dif = Math.max(...b0.map((v, i) => Math.abs(v - b1[i])));
      assert.ok(dif <= 0.01, `${onde}: caixa do LOD1 difere do LOD0 em ${dif.toFixed(3)} m`);
      // a saliência (toldo, marquise, sacada) não passa de SOBRA_MAX da silhueta
      const bs = caixaDasPecas(pl.pecas, (p) => p.sobra);
      if (Number.isFinite(bs[0])) {
        const passa = Math.max(b1[0] - bs[0], bs[3] - b1[3], b1[2] - bs[2], bs[5] - b1[5], bs[4] - b1[4]);
        assert.ok(passa <= SOBRA_MAX + 0.01, `${onde}: saliência de ${passa.toFixed(2)} m`);
      }
      let tris = 0;
      let n = 0;
      instanciasDoPlano(pl, 0, 0, 0, 0, (f, m, bytes) => {
        tris += tForma[f];
        n++;
        for (let i = 0; i < 16; i++) assert.ok(Number.isFinite(m[i]), `${onde}: NaN na matriz`);
      });
      assert.ok(n >= 1 && tris <= (c.m.zona === 'industria' ? 200 : 150), `${onde}: ${n} instâncias, ${tris} triângulos no LOD1`);
    }
  }
});

test('determinismo: o mesmo pedido dá a mesma malha, as mesmas instâncias e a mesma caixa, bit a bit', () => {
  const lista = [];
  PREDIOS_ORDEM.forEach((id, mi) => {
    for (let nivel = 1; nivel <= 5; nivel += 2) lista.push({ mi, nivel, w: PREDIOS[id].planta[0] * 8, d: PREDIOS[id].planta[1] * 8 });
  });
  const pedido = () => {
    const n = lista.length;
    const num = new Float32Array(n * 6);
    const ints = new Uint32Array(n * 4);
    lista.forEach((p, k) => {
      num.set([(k % 8) * 30 + 10, 2 + k * 0.1, Math.floor(k / 8) * 45 + 10, k * 0.37, p.w, p.d], k * 6);
      ints.set([k + 100, semente(k), p.mi, p.nivel | ((k % 4) << 4)], k * 4);
    });
    return { setor: 5, ox: -512, oz: 256, lod0: true, n, num, ints };
  };
  const a = gerarSetor(pedido());
  const b = gerarSetor(pedido());
  const h = (r) => {
    let x = 0;
    for (const v of Object.values(r.malhas[0].atributos)) x = fnv1aTipado(v, x);
    x = fnv1aTipado(r.malhas[0].indices, x);
    for (const f of r.lod1) x = fnv1aTipado(f.bytes, fnv1aTipado(f.mat, fnv1aTipado(f.ids, x)));
    return fnv1aTipado(r.caixas, x);
  };
  assert.equal(h(a), h(b));
  assert.equal(a.tris.lod0, b.tris.lod0);
  // o LOD2 é o começo de cada lista: uma principal por prédio
  const principais = a.lod1.reduce((s, f) => s + f.np, 0);
  assert.equal(principais, lista.length);
  // os ids das instâncias são os idx pedidos
  const ids = new Set(lista.map((_, k) => k + 100));
  for (const f of a.lod1) for (const id of f.ids) assert.ok(ids.has(id));
});

test('quantização: posição com erro abaixo de 5 mm, normal abaixo de 1,5 grau, meia precisão e o AO', () => {
  const K = new Construtor(1024);
  let k = 0;
  for (const id of ['torreRes', 'torreEscritorios', 'casa', 'galpao', 'predioMedio', 'loja']) {
    for (let nivel = 1; nivel <= 5; nivel++) {
      const m = PREDIOS[id];
      const pl = planoPredio({ w: m.planta[0] * 8, d: m.planta[1] * 8, modelo: id, nivel, estilo: k % 4, semente: semente(k) });
      K.predio((k % 6) * 45 - 10, 3.5, Math.floor(k / 6) * 55 - 20, k * 0.51, k);
      malhaDoPlano(K, pl);
      k++;
    }
  }
  const q = quantizarMalha(K);
  const [cx, cy, cz, s] = q.escala;
  let erro = 0;
  for (let i = 0; i < q.nv; i++) {
    for (let c = 0; c < 3; c++) {
      const v = [cx, cy, cz][c] + (q.atributos.posicao[3 * i + c] / 32767) * s;
      erro = Math.max(erro, Math.abs(v - K.pos[3 * i + c]));
    }
  }
  assert.ok(erro < 0.005, `erro de posição ${(erro * 1000).toFixed(2)} mm`);
  let pior = 0;
  for (let i = 0; i < q.nv; i += 7) {
    const [x, y, z] = deOctaedro(q.atributos.normal[2 * i], q.atributos.normal[2 * i + 1]);
    const n = [K.nor[3 * i], K.nor[3 * i + 1], K.nor[3 * i + 2]];
    const l = Math.hypot(...n);
    pior = Math.max(pior, Math.acos(Math.min(1, (x * n[0] + y * n[1] + z * n[2]) / l)));
  }
  assert.ok((pior * 180) / Math.PI < 1.5, `normal com ${((pior * 180) / Math.PI).toFixed(2)} graus de erro`);
  for (const v of [0, 1, -1, 0.5, 3.25, 17.9, 120.5, 199.75, 1e4, -2.5, 0.001]) {
    const r = deHalf(paraHalf(v));
    assert.ok(Math.abs(r - v) <= Math.max(1e-3, Math.abs(v) * 1e-3), `meia precisão de ${v}: ${r}`);
  }
  assert.equal(deHalf(paraHalf(1e6)), 65504);
  const o = [0, 0];
  octaedro(0, -1, 0, o, 0);
  assert.deepEqual(deOctaedro(o[0], o[1]).map((v) => Math.round(v)), [0, -1, 0]);
  assert.ok(q.atributos.ao.every((a) => a >= 0 && a <= 255));
  assert.ok(q.indices instanceof Uint16Array || q.indices instanceof Uint32Array);
  assert.equal(q.atributos.id.constructor, Uint32Array);
});

test('setor de ~150 prédios no tempo do worker (D39: até 30 ms no PC) e o pedido montado pelo espelho', async () => {
  const { gerarCidadeSintetica } = await import('../cidade-sintetica.mjs');
  const { sim } = gerarCidadeSintetica();
  const P = sim.espelho.predios;
  const g = new GradeSetores();
  const listas = new Map();
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== 0) continue;
    const s = g.indice(P.x[i], P.z[i]);
    if (!listas.has(s)) listas.set(s, []);
    listas.get(s).push(i);
  }
  const [s, lista] = [...listas.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  // aquece o JIT e mede a mediana de 5
  const ms = [];
  let r = null;
  for (let k = 0; k < 6; k++) {
    const { dados } = pedidoDoSetor(P, lista, g, s, true);
    const t = performance.now();
    r = gerarSetor(dados);
    if (k) ms.push(performance.now() - t);
  }
  ms.sort((a, b) => a - b);
  const med = ms[2];
  console.log(`  setor ${s}: ${lista.length} prédios, ${r.tris.lod0} tri LOD0, ${r.tris.lod1} tri LOD1, ${med.toFixed(1)} ms (mediana)`);
  assert.ok(med < 30 * (lista.length / 150) * 3, `setor em ${med.toFixed(1)} ms`);
  assert.equal(r.caixas.length, lista.length * CAIXA);
  // a caixa de cada prédio fica dentro do lote do espelho
  for (let k = 0; k < lista.length; k++) {
    const i = lista[k];
    const b = r.caixas.subarray(CAIXA * k, CAIXA * k + 6);
    assert.ok(b[0] >= -P.w[i] / 2 - 0.05 && b[2] <= P.w[i] / 2 + 0.05, `caixa do prédio ${i} fora do lote`);
  }
});

test('variedade pela semente: o mesmo modelo e nível não repete o prédio', () => {
  const assinatura = (pl) => pl.pecas.map((p) => `${p.forma}:${p.w.toFixed(1)}:${(p.d ?? 0).toFixed(1)}:${(p.h ?? 0).toFixed(1)}:${p.mat.t}:${p.mat.c1}`).join('|');
  for (const [id, nivel] of [['casa', 1], ['predioMedio', 2], ['torreRes', 3], ['loja', 1], ['torreEscritorios', 5], ['galpao', 1]]) {
    const m = PREDIOS[id];
    const vistos = new Set();
    const fachadas = new Set();
    for (let k = 0; k < 40; k++) {
      const pl = planoPredio({ w: m.planta[0] * 8, d: m.planta[1] * 8, modelo: id, nivel, estilo: k % 4, semente: semente(k + 1000) });
      vistos.add(assinatura(pl));
      const pr = pl.pecas.find((p) => p.principal);
      fachadas.add(`${pr.forma}:${pr.mat.t}:${pr.mat.c1}:${pr.mat.c2}`);
    }
    assert.ok(vistos.size >= 38, `${id} nível ${nivel}: só ${vistos.size} prédios diferentes em 40`);
    assert.ok(fachadas.size >= 6, `${id} nível ${nivel}: só ${fachadas.size} combinações de fachada e cor`);
  }
});

test('tipologias brasileiras: autoconstrução, telhado de quatro águas, galpão com lanternim, torre com varandas e escalonada', () => {
  const formas = (id, nivel, estilo, n = 60) => {
    const m = PREDIOS[id];
    const conta = {};
    for (let k = 0; k < n; k++) {
      const pl = planoPredio({ w: m.planta[0] * 8, d: m.planta[1] * 8, modelo: id, nivel, estilo, semente: semente(k + 500) });
      const vistas = new Set(pl.pecas.map((p) => p.forma + (p.mat?.t === FACHADA.FIBRO || p.topo?.t === FACHADA.FIBRO ? ':fibro' : '')));
      for (const f of vistas) conta[f] = (conta[f] ?? 0) + 1;
    }
    return conta;
  };
  // bairro popular (estilo 2): caixa d'água redonda na laje, esperas nos cantos e fibrocimento em meia-água
  const pop = formas('casa', 1, 2);
  assert.ok(pop.cilindro >= 8, `casa popular: caixa d'água em ${pop.cilindro ?? 0} de 60`);
  assert.ok(pop.coluna >= 5, `casa popular: esperas em ${pop.coluna ?? 0} de 60`);
  assert.ok((pop['meiaAgua:fibro'] ?? 0) >= 8, `casa popular: fibrocimento em ${pop['meiaAgua:fibro'] ?? 0} de 60`);
  // bairro contemporâneo (estilo 1): telha cerâmica em quatro águas numa parte das casas
  const med = formas('casa', 2, 1);
  assert.ok(med.quatroAguas >= 6, `casa de padrão médio: quatro águas em ${med.quatroAguas ?? 0} de 60`);
  // galpão: duas águas com lanternim (dois telhados de duas águas) numa parte
  const gal = formas('galpao', 1, 0);
  assert.ok(gal.duasAguas >= 15 && (gal.shed ?? 0) + (gal.arco ?? 0) >= 8, `galpão: ${JSON.stringify(gal)}`);
  // torre residencial de pódio: varandas de canto em boa parte; escritório: pele de vidro com chanfro em parte
  const tor = formas('torreRes', 1, 0);
  assert.ok(tor.varanda >= 20, `torre: varandas em ${tor.varanda ?? 0} de 60`);
  const esc = formas('torreEscritorios', 3, 1);
  assert.ok(esc.chanfro >= 8, `escritório: chanfro em ${esc.chanfro ?? 0} de 60`);
  // loja térrea funda: a platibanda da frente esconde a água que cai para os fundos
  const m = PREDIOS.loja;
  let escondidas = 0;
  for (let k = 0; k < 60; k++) {
    const pl = planoPredio({ w: m.planta[0] * 8, d: m.planta[1] * 8, modelo: 'loja', nivel: 1, estilo: k % 4, semente: semente(k + 900) });
    const agua = pl.pecas.find((p) => p.forma === 'meiaAgua');
    if (!agua) continue;
    escondidas++;
    const frente = Math.max(...pl.pecas.filter((p) => p.lod1 && p.forma === 'caixa').map((p) => p.z + p.d / 2));
    const plat = pl.pecas.find((p) => p.forma === 'caixa' && p.d <= 0.31 && Math.abs(p.z + p.d / 2 - frente) < 0.01);
    assert.ok(plat, `loja ${k}: água sem platibanda na frente`);
    assert.ok(plat.y0 + plat.h >= agua.y0 + agua.h + 0.2, `loja ${k}: a água aparece acima da platibanda`);
    assert.equal(agua.giro, Math.PI, `loja ${k}: a água cai para os fundos`);
  }
  assert.ok(escondidas >= 20, `loja térrea: água escondida em ${escondidas} de 60`);
});

test('paletas: albedo real (nada acima de 0,80 linear) e nada saturado', () => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (const [nome, lista] of Object.entries(PALETAS)) {
    for (const hex of lista) {
      const n = parseInt(hex.slice(1), 16);
      const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
      const alb = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
      assert.ok(alb <= 0.8, `${nome} ${hex}: albedo ${alb.toFixed(2)}`);
      const mx = Math.max(...rgb);
      const mn = Math.min(...rgb);
      const sat = mx ? (mx - mn) / mx : 0;
      assert.ok(sat <= 0.72, `${nome} ${hex}: saturação ${sat.toFixed(2)}`);
      if (!['letreiro', 'telha', 'tijolo', 'toldo'].includes(nome)) assert.ok(sat <= 0.5, `${nome} ${hex}: saturação ${sat.toFixed(2)}`);
    }
  }
  // o mapa de detalhe é periódico e cheio
  const d = bytesDetalhe(64);
  assert.equal(d.length, 64 * 64 * 4);
  assert.ok(new Set(d.filter((_, i) => i % 4 === 0)).size > 20);
});

test('material edificio: o shader monta sobre o MeshStandardMaterial do three com os ganchos, sem mediump', async () => {
  const THREE = await import('three');
  const { ganchos } = await import('../../fonte/render/motor/ganchos.js');
  const { criarMaterialEdificio } = await import('../../fonte/render/mundo/predios.js');
  const m = criarMaterialEdificio({ ganchos });
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
    defines: {},
  };
  m.onBeforeCompile(shader, null);
  for (const u of ['gPredTab', 'gDetalhe', 'gHora', 'gNoite', 'gSelecionado', ...Object.keys(ganchos.uniformes).slice(0, 3)]) assert.ok(u in shader.uniforms, `uniforme ${u}`);
  assert.ok(shader.vertexShader.includes('gOct(') && shader.vertexShader.includes('attribute uint aId'));
  assert.ok(shader.fragmentShader.includes('gFachada( gVista )') && shader.fragmentShader.includes('gMascaraTelhado'));
  assert.ok(!/\bmediump\b/.test(shader.vertexShader + shader.fragmentShader), 'mediump no shader do edifício');
  for (const nome of Object.keys(FACHADA)) assert.ok(shader.fragmentShader.includes(`#define F_${nome} `), `F_${nome} no shader`);
  // varyings próprios: 4
  const nv = (shader.vertexShader.match(/^\s*(flat\s+)?varying\s+vec4\s+v(PF|Fac|Cor|Ident)\b/gm) ?? []).length;
  assert.equal(nv, 4);
});

test('sombra própria e duas faixas: setores projetores pelo chão da cascata e pelo sol; o corte é o das faixas', async () => {
  const THREE = await import('three');
  const { sombraAlcanca, limiteFaixas } = await import('../../fonte/render/mundo/predios.js');
  const { Faixas } = await import('../../fonte/render/motor/faixas.js');
  // setor de 256 m com o canto a 300 m a leste do foco (raio 100): só projeta dentro com o sol a leste e baixo
  assert.equal(sombraAlcanca(300, -128, 256, 0, 0, 100, 1, 0, 0), false, 'sem alcance, fora do raio');
  assert.equal(sombraAlcanca(300, -128, 256, 0, 0, 100, 1, 0, 250), true, 'sol baixo a leste: a sombra chega');
  assert.equal(sombraAlcanca(300, -128, 256, 0, 0, 100, -1, 0, 600), false, 'sol a oeste: a sombra vai para o outro lado');
  assert.equal(sombraAlcanca(-50, -50, 256, 0, 0, 10, 0, 1, 0), true, 'o foco dentro do setor');
  // o corte das faixas é a mesma conta do motor (a lista de longe e a de perto se encontram na emenda)
  for (const dist of [200, 1500, 2500, 6000]) {
    const f = new Faixas({ semClip: true, cameraApi: { estado: () => ({ dist }) } });
    const falso = { autoClear: true, render() {}, clearDepth() {} };
    f.desenhar(falso, new THREE.Scene(), new THREE.PerspectiveCamera(40, 1, 1, 1000), null);
    assert.equal(limiteFaixas(dist), f.limite, `corte a ${dist} m`);
  }
});
