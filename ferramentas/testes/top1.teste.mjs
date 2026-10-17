// Testes da cidade de topo (TOP1, D115): a escada de padrão de 1 a 5, a super torre do nível 5, a cobertura das torres de
// luxo, o heliponto no gramado da mansão, os tetos de triângulos por LOD e a renda por morador intacta.
// Roda sozinho: node ferramentas/testes/top1.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDIOS, nivelDoModelo, modelosDaZona } from '../../fonte/data/predios.js';
import { TIPOLOGIAS } from '../../fonte/data/estilos.js';
import { planoPredio, caixaDasPecas } from '../../fonte/render/geracao/planoPredio.js';
import { Construtor, malhaDoPlano, instanciasDoPlano, formaUnitaria } from '../../fonte/render/geracao/malhaPredio.js';
import { registrar as registrarTextosTop1 } from '../../fonte/ui/textos/top1.js';

const semente = (k) => (Math.imul(k + 1, 2654435761) ^ 0x70f1) >>> 0;
const plano = (id, nivel, k) => {
  const m = PREDIOS[id];
  return planoPredio({ w: m.planta[0] * 8, d: m.planta[1] * 8, modelo: id, nivel, estilo: k % 4, semente: semente(k) });
};
const N = 40;
const tF = [0, 1, 2, 3].map((f) => formaUnitaria(f).tris);
const triLod0 = (pl) => {
  const K = new Construtor(512);
  K.predio(3, 1, -2, 0.7, 9);
  return malhaDoPlano(K, pl);
};
const triLod1 = (pl) => {
  let t = 0;
  instanciasDoPlano(pl, 0, 0, 0, 0, (f) => { t += tF[f]; });
  return t;
};
// heliponto elevado do topo (cilindro lod1 de 0,5 m) e pavilhão de cobertura (laje fina de 0,4 m que avança)
const heliTopo = (pl) => pl.pecas.filter((p) => p.forma === 'cilindro' && p.lod1 && p.h === 0.5).length;
const heliChao = (pl) => pl.pecas.filter((p) => p.heli && p.forma === 'cilindro' && p.w >= 8).length;
const coberturas = (pl) => pl.pecas.filter((p) => p.forma === 'caixa' && p.sobra && p.h === 0.4).length;

test('escada de 1 a 5: classe média alta, alta, super-rica, ultra-rica e Tier 0,1%, nunca popular', () => {
  const escada = {
    resBaixa: ['casaAltoPadrao', 'casaAltoPadrao', 'casaPedraVidro', 'mansao', 'mansaoHeliponto'],
    resMedia: ['edificioPedraVidro', 'edificioPedraVidro', 'varandaGourmet', 'varandaCobertura', 'varandaCobertura'],
    resAlta: ['torreVarandas', 'torreVarandas', 'torreLuxo', 'torreLuxo', 'superTorre'],
  };
  assert.deepEqual(PREDIOS.mansaoLote.niveis.map((n) => n.tipologia), escada.resBaixa);
  assert.deepEqual(PREDIOS.casaTerreno.niveis.map((n) => n.tipologia), escada.resBaixa);
  assert.deepEqual(PREDIOS.predioMedio.niveis.map((n) => n.tipologia), escada.resMedia);
  assert.deepEqual(PREDIOS.torreRes.niveis.map((n) => n.tipologia), escada.resAlta);
  // lotes de 24 m de lado ou menos não têm onde pousar o helicóptero: o nível 5 fica na mansão
  for (const id of ['casaJardim', 'casaPatio']) assert.equal(nivelDoModelo(id, 5).tipologia, 'mansao');
  for (const zona of Object.keys(escada)) for (const id of modelosDaZona(zona)) for (const nv of PREDIOS[id].niveis) assert.ok(TIPOLOGIAS[nv.tipologia], `${id}: tipologia ${nv.tipologia} sem parâmetros`);
  // a super torre sobe mais que qualquer torre de luxo
  const [a0, a1] = nivelDoModelo('torreRes', 5).andares;
  assert.ok(a0 >= 50 && a1 <= 60, `super torre de ${a0} a ${a1} andares`);
  assert.ok(a0 > nivelDoModelo('torreRes', 4).andares[1]);
  // a renda por morador e os moradores do nível 5 não mudam
  assert.equal(nivelDoModelo('torreRes', 5).moradores, 900);
});

test('super torre: fuste esbelto, um recuo só e assimétrico, lâmina de pedra, cobertura duplex e heliponto', () => {
  let heli = 0;
  let altura = 0;
  for (let k = 0; k < N; k++) {
    const pl = plano('torreRes', 5, k);
    assert.equal(pl.tipologia, 'superTorre');
    assert.equal(pl.pecas.filter((p) => p.principal).length, 1);
    assert.ok(pl.alturaTopo >= 50 * 3.8 * 0.9, `semente ${k}: ${pl.alturaTopo.toFixed(0)} m`);
    altura = Math.max(altura, pl.alturaTopo);
    heli += heliTopo(pl) >= 1 ? 1 : 0;
    assert.equal(coberturas(pl), 1, `semente ${k}: uma cobertura`);
    // volumes altos do corpo: fuste, fuste recuado e lâmina; não mais (nada de Torre em bolo)
    const altos = pl.pecas.filter((p) => p.lod1 && (p.forma === 'caixa' || p.forma === 'chanfro') && p.h > 25);
    assert.equal(altos.length, 3, `semente ${k}: ${altos.length} volumes altos`);
    const [fuste, cima] = altos;
    assert.ok(cima.w < fuste.w - 2, `semente ${k}: recuo`);
    assert.ok(Math.abs(cima.x) > 0.5, `semente ${k}: recuo simétrico`);
    // esbelta: o lado maior do fuste é no máximo 1/6 da altura
    assert.ok(Math.max(fuste.w, fuste.d) <= pl.alturaTopo / 6, `semente ${k}: gorda (${fuste.w.toFixed(0)} x ${fuste.d.toFixed(0)} para ${pl.alturaTopo.toFixed(0)} m)`);
    const lamina = altos[2];
    assert.ok(lamina.y0 + lamina.h >= caixaDasPecas(pl.pecas, (p) => !p.lote && !p.sobra && p !== lamina && p.forma !== 'cilindro' && p.forma !== 'coluna')[4] - 0.01, `semente ${k}: a lâmina sobe além do topo`);
  }
  assert.ok(heli >= N * 0.9, `heliponto no topo em ${heli} de ${N}`);
  assert.ok(altura > 230, `a mais alta tem ${altura.toFixed(0)} m`);
});

test('torre de luxo e prédio de varandas: cobertura envidraçada a partir do nível ultra-rica (4), nenhuma abaixo', () => {
  for (let k = 0; k < 20; k++) {
    assert.equal(coberturas(plano('torreEstreita', 3, k)), 0, 'nível 3 sem cobertura');
    assert.equal(coberturas(plano('torreEstreita', 4, k)), 1, `torre nível 4 semente ${k}`);
    assert.equal(coberturas(plano('predioMedio', 3, k)), 0);
    assert.equal(coberturas(plano('predioMedio', 4, k)), 1, `prédio nível 4 semente ${k}`);
    assert.equal(coberturas(plano('predioMedio', 5, k)), 1);
    assert.equal(heliTopo(plano('predioMedio', 4, k)), 0, 'o heliponto do prédio médio só no nível 5');
  }
  let h5 = 0;
  for (let k = 0; k < N; k++) h5 += heliTopo(plano('predioMedio', 5, k)) >= 1 ? 1 : 0;
  assert.ok(h5 >= N * 0.45 && h5 <= N * 0.95, `heliponto em ${h5} de ${N} prédios de nível 5`);
});

test('mansão do nível 5 tem heliponto no gramado, dentro do lote e fora da casa; a do nível 4 não', () => {
  for (const id of ['mansaoLote', 'casaTerreno']) {
    const m = PREDIOS[id];
    const W = m.planta[0] * 8;
    const D = m.planta[1] * 8;
    let com = 0;
    for (let k = 0; k < N; k++) {
      const pl = plano(id, 5, k);
      assert.equal(pl.tipologia, 'mansaoHeliponto');
      assert.equal(heliChao(plano(id, 4, k)), 0, `${id}: nível 4 sem heliponto`);
      const discos = pl.pecas.filter((p) => p.heli && p.forma === 'cilindro');
      if (!discos.length) continue;
      com++;
      const d = discos[0];
      assert.ok(d.x - d.w / 2 >= -W / 2 && d.x + d.w / 2 <= W / 2 && d.z - d.d / 2 >= -D / 2 && d.z + d.d / 2 <= D / 2, `${id} semente ${k}: heliponto fora do lote`);
      const casa = caixaDasPecas(pl.pecas, (p) => !p.lote && !p.sobra);
      assert.ok(d.z + d.d / 2 <= casa[2] + 0.01, `${id} semente ${k}: heliponto sob a casa`);
    }
    assert.ok(com >= N * 0.9, `${id}: heliponto em ${com} de ${N}`);
  }
  for (let k = 0; k < 10; k++) assert.equal(heliChao(plano('casaJardim', 5, k)), 0);
});

test('tetos de triângulos e de chamadas: LOD0 e LOD1 por perfil, sem material novo', () => {
  const tetos = { resBaixa: 600, resMedia: 1500, resAlta: 1200 };
  const mats = new Set();
  for (const zona of ['resBaixa', 'resMedia', 'resAlta']) {
    for (const id of modelosDaZona(zona)) {
      for (let nivel = 4; nivel <= 5; nivel++) {
        for (let k = 0; k < 24; k++) {
          const pl = plano(id, nivel, k);
          const t0 = triLod0(pl);
          assert.ok(t0 <= tetos[zona], `${id} nível ${nivel} semente ${k}: ${t0} triângulos no LOD0`);
          assert.ok(triLod1(pl) <= 150, `${id} nível ${nivel} semente ${k}: LOD1 acima de 150`);
          for (const p of pl.pecas) if (p.mat) mats.add(p.mat.t);
        }
      }
    }
  }
  assert.ok(mats.size <= 40, `${mats.size} tipos de superfície`);
});

test('textos da TOP1: sem travessão e com os cinco degraus da escada', () => {
  const mapa = {};
  registrarTextosTop1((_, m) => Object.assign(mapa, m));
  for (let n = 1; n <= 5; n++) assert.ok(mapa[`top1.escada.${n}`], `degrau ${n}`);
  assert.equal(mapa['top1.escada.1'], 'Classe média alta');
  assert.equal(mapa['top1.escada.5'], 'Tier 0,1%');
  for (const [k, v] of Object.entries(mapa)) assert.ok(!/[—–]/.test(v), `${k}: travessão`);
});
