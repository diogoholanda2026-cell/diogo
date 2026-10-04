// Lote inteiro (desenho do render 5.4, R4b): o CS2 convence porque o prédio vem com o lote. O piso (jardim,
// estacionamento, quintal) e o muro com os portões são peças do plano, fundidas no LOD0 do setor (planoPredio.js); aqui
// ficam as árvores do lote e os carros parados, que o plano põe no quintal, no recuo da frente e sob os pilotis
// (plano.lote) e o gerador do setor leva ao mundo (fundir.js: lote.copa, lote.palmeira, lote.carros). Só nos setores
// com o LOD0 à vista, filtrados pela cópia que vale (base ou anexo, D39) e sem a obra nova (o canteiro não tem carro
// nem árvore): ctx.dominio('predios').lotesVisiveis().
//   árvores  plantadas no domínio 'vegetacao' (ctx.vegetacao.plantar, dono 'lotes'; VIS1b) com as espécies da R2b, em
//            LOD0, LOD1 e impostor e com a sombra própria de lá: a copa do quintal varia entre oiti, copa redonda (a
//            mangueira e o jambo dos quintais), copa estreita (ipê) e, rara, a embaúba; a palmeira-imperial fica no
//            jardim dos prédios altos. A espécie, o tamanho e o tom saem do hash do item (determinístico)
//   carros   os da frota (veiculos.js, com o material do tráfego): o mesmo programa, nenhuma compilação a mais
import * as THREE from 'three';
import { ListaCompactada } from './instancias.js';
import { criarMaterialCarro } from './trafego.js';
import { PASSO_ARVORE } from './vegetacao.js';
import { malhaVeiculo } from '../geracao/veiculos.js';
import { ESPECIE, ESPECIES } from '../geracao/arvores.js';
import { CARROS_LOTE } from '../geracao/planoPredio.js';

/**
 * Copa do lote por espécie: o peso (a soma dá 1) e a altura (m) na escala 1 do plano (o plano sorteia de 0,55 a 0,95).
 * As de quintal ficam baixas, como as de verdade (a mata2 de 16 m vira uma mangueira de 5 a 9 m).
 */
export const COPAS_LOTE = Object.freeze([
  { especie: 'oiti', peso: 0.42, altura: 8.5 },
  { especie: 'mata2', peso: 0.3, altura: 9.5 },
  { especie: 'mata3', peso: 0.22, altura: 9 },
  { especie: 'embauba', peso: 0.06, altura: 10 },
]);
/** Altura (m) da palmeira-imperial do lote na escala 1 do plano. */
export const PALMEIRA_LOTE = 21;

/** Espécie (índice) e altura na escala 1 de uma copa do lote, pelo primeiro byte do item (0 a 255). */
export function copaDoLote(b0) {
  let x = (b0 + 0.5) / 256;
  for (const c of COPAS_LOTE) {
    x -= c.peso;
    if (x < 0) return { especie: ESPECIE[c.especie], altura: c.altura };
  }
  const u = COPAS_LOTE[COPAS_LOTE.length - 1];
  return { especie: ESPECIE[u.especie], altura: u.altura };
}

/**
 * Árvores dos lotes no formato das listas da vegetação (PASSO_ARVORE por árvore: x, y, z, espécie, altura, largura,
 * giro, tom, semente). grupos: [{ tipo: 'copa' | 'palmeira', n, mat (16 por item, coluna maior), bytes (4 por item) }].
 * A largura segue a proporção da espécie (a copa da R2b com a altura do lote), o giro vem da matriz do plano.
 * @returns {Float32Array}
 */
export function arvoresDosLotes(grupos) {
  let n = 0;
  for (const g of grupos) n += g.n;
  const out = new Float32Array(n * PASSO_ARVORE);
  let o = 0;
  for (const g of grupos) {
    const palmeira = g.tipo === 'palmeira';
    for (let k = 0; k < g.n; k++) {
      const m = 16 * k;
      const s = g.mat[m + 5] || 1;
      const b0 = g.bytes ? g.bytes[4 * k] : 128;
      const b1 = g.bytes ? g.bytes[4 * k + 1] : 128;
      const c = palmeira ? { especie: ESPECIE.palmeira, altura: PALMEIRA_LOTE } : copaDoLote(b0);
      out[o] = g.mat[m + 12];
      out[o + 1] = g.mat[m + 13];
      out[o + 2] = g.mat[m + 14];
      out[o + 3] = c.especie;
      const P = ESPECIES[c.especie];
      out[o + 4] = c.altura * s;
      out[o + 5] = (c.altura * s * P.largura) / P.altura;
      out[o + 6] = Math.atan2(g.mat[m + 8], g.mat[m]);
      out[o + 7] = b1 / 255;
      out[o + 8] = ((b0 * 31 + b1) & 255) / 255;
      o += PASSO_ARVORE;
    }
  }
  return out;
}

function criarLotes(ctx) {
  const { cena, medidas } = ctx;
  const U = { gCarroNoite: { value: 0 } };
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
  const listas = CARROS_LOTE.map((mi, k) => {
    const geo = geoCarro(mi);
    const L = new ListaCompactada({ geometria: geo.g, material: matCarro, nome: `lotes:carro${k}`, bytes: ['aCarro'], cap: 256 });
    L.aoCriar = (m, velha) => {
      if (velha) cena.remove(velha);
      medidas.familia(m, 'resto');
      cena.add(m);
    };
    L.aoCriar(L.malha, null);
    return { tipo: `carro${k}`, k, L, tris: geo.tris };
  });
  let chave = -1;
  let arvores = 0;
  /** A vegetação ainda não existia quando as árvores mudaram: planta no próximo quadro. */
  let plantarDepois = null;

  function plantar(lista) {
    const veg = ctx.vegetacao;
    if (!veg?.plantar) {
      plantarDepois = lista;
      return;
    }
    plantarDepois = null;
    veg.plantar('lotes', lista);
  }

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
          const g = lote.carros[d.k];
          if (g?.n) pedacos.push({ mat: g.mat, ids: null, bytes: g.bytes, n: g.n });
        }
      }
      n += d.L.compactar(pedacos);
      d.L.malha.visible = d.L.count > 0;
    }
    // as árvores: uma lista só para a vegetação (refeita quando os lotes à vista mudam)
    const grupos = [];
    for (const v of vis) {
      for (const lote of v.lotes) {
        if (lote.copa?.n) grupos.push({ tipo: 'copa', ...lote.copa });
        if (lote.palmeira?.n) grupos.push({ tipo: 'palmeira', ...lote.palmeira });
      }
    }
    const lista = arvoresDosLotes(grupos);
    arvores = lista.length / PASSO_ARVORE;
    plantar(lista);
    dom.instancias = n + arvores;
    dom.msEnvio = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  }

  const dom = {
    nome: 'lotes',
    instancias: 0,
    /** ms de JS das listas refeitas no último quadro (a cena bairro soma ao envio dos prédios). */
    msEnvio: 0,
    quadro(tMs, c) {
      dom.msEnvio = 0;
      if (plantarDepois) plantar(plantarDepois);
      const pred = c.dominio('predios');
      if (pred?.lotesVisiveis) compactar(pred);
      const dia = c.sol?.dia ?? 1;
      U.gCarroNoite.value = Math.min(1, Math.max(0, 1 - dia * 1.4));
    },
    medidas() {
      const out = { arvores: { n: arvores } };
      for (const d of listas) out[d.tipo] = { n: d.L.count, tris: d.L.count * d.tris };
      return out;
    },
    descartar() {
      for (const d of listas) {
        cena.remove(d.L.malha);
        d.L.descartar();
      }
      ctx.vegetacao?.plantar?.('lotes', null);
      matCarro.dispose();
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('lotes', criarLotes);
}
