// Lote inteiro (desenho do render 5.4, R4b): o CS2 convence porque o prédio vem com o lote. O piso (jardim,
// estacionamento, quintal) e o muro com os portões são peças do plano, fundidas no LOD0 do setor (planoPredio.js); aqui
// ficam as árvores do lote e os carros parados, que o plano põe no quintal, no recuo da frente e sob os pilotis
// (plano.lote) e o gerador do setor leva ao mundo (fundir.js: lote.copa, lote.palmeira, lote.carros). Só nos setores
// com o LOD0 à vista, filtrados pela cópia que vale (base ou anexo, D39) e sem a obra nova (o canteiro não tem carro
// nem árvore): ctx.dominio('predios').lotesVisiveis(). As árvores usam os modelos das árvores de rua (props.js) e os
// carros os da frota (veiculos.js, com o material do tráfego): os mesmos programas, nenhuma compilação a mais. As
// árvores de perto projetam na sombra própria.
import * as THREE from 'three';
import { ListaCompactada } from './instancias.js';
import { MODELOS_PROPS, criarMaterialArvore } from './props.js';
import { criarMaterialCarro } from './trafego.js';
import { malhaVeiculo } from '../geracao/veiculos.js';
import { CARROS_LOTE } from '../geracao/planoPredio.js';

function criarLotes(ctx) {
  const { cena, medidas } = ctx;
  const U = { gCarroNoite: { value: 0 } };
  const matCopa = criarMaterialArvore(ctx.ganchos);
  const matPalma = criarMaterialArvore(ctx.ganchos, { duplo: true });
  const matCarro = criarMaterialCarro(ctx.ganchos, U);
  const geoCarro = (mi) => {
    const v = malhaVeiculo(mi, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v.posicao, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(v.normal, 3));
    g.setAttribute('aParte', new THREE.BufferAttribute(Float32Array.from(v.parte), 1));
    g.setIndex(new THREE.BufferAttribute(v.indices, 1));
    return { g, tris: v.tris };
  };
  const defs = [
    { tipo: 'copa', geo: MODELOS_PROPS.copa0(), mat: matCopa, bytes: ['aObj'], fam: 'arvores', sombra: true },
    { tipo: 'palmeira', geo: MODELOS_PROPS.palmeira0(), mat: matPalma, bytes: ['aObj'], fam: 'arvores', sombra: true },
    ...CARROS_LOTE.map((mi, k) => ({ tipo: `carro${k}`, k, geo: geoCarro(mi), mat: matCarro, bytes: ['aCarro'], fam: 'resto' })),
  ];
  const listas = defs.map((d) => {
    const L = new ListaCompactada({ geometria: d.geo.g, material: d.mat, nome: `lotes:${d.tipo}`, bytes: d.bytes, cap: 256 });
    L.aoCriar = (m, velha) => {
      if (velha) {
        cena.remove(velha);
        if (d.sombra) ctx.sombra.soltar(velha);
      }
      medidas.familia(m, d.fam);
      cena.add(m);
      if (d.sombra) medidas.familia(ctx.sombra.projetor(m), 'sombra');
    };
    L.aoCriar(L.malha, null);
    return { ...d, L, tris: d.geo.tris };
  });
  let chave = -1;

  function compactar(pred) {
    const vis = pred.lotesVisiveis?.() ?? [];
    let h = 0x811c9dc5;
    for (const v of vis) {
      h = Math.imul(h ^ v.s, 0x01000193);
      h = Math.imul(h ^ v.chave, 0x01000193);
    }
    if (h === chave) return;
    chave = h;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let n = 0;
    for (const d of listas) {
      const pedacos = [];
      for (const v of vis) {
        for (const lote of v.lotes) {
          const g = d.tipo === 'copa' ? lote.copa : d.tipo === 'palmeira' ? lote.palmeira : lote.carros[d.k];
          if (g?.n) pedacos.push({ mat: g.mat, ids: null, bytes: g.bytes, n: g.n });
        }
      }
      n += d.L.compactar(pedacos);
      d.L.malha.visible = d.L.count > 0;
    }
    ctx.sombra.marcar();
    dom.instancias = n;
    dom.msEnvio = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }

  const dom = {
    nome: 'lotes',
    instancias: 0,
    /** ms de JS das listas refeitas no último quadro (a cena bairro soma ao envio dos prédios). */
    msEnvio: 0,
    quadro(tMs, c) {
      dom.msEnvio = 0;
      const pred = c.dominio('predios');
      if (pred?.lotesVisiveis) compactar(pred);
      const dia = c.sol?.dia ?? 1;
      U.gCarroNoite.value = Math.min(1, Math.max(0, 1 - dia * 1.4));
    },
    medidas() {
      const out = {};
      for (const d of listas) out[d.tipo] = { n: d.L.count, tris: d.L.count * d.tris };
      return out;
    },
    descartar() {
      for (const d of listas) {
        cena.remove(d.L.malha);
        if (d.sombra) ctx.sombra.soltar(d.L.malha);
        d.L.descartar();
      }
      matCopa.dispose();
      matPalma.dispose();
      matCarro.dispose();
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('lotes', criarLotes);
}
