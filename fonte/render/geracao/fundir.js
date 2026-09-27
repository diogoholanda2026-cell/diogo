// Gerador de setor (D39, desenho do render 1.3 e 5.3), puro: roda no worker `oficina` (tipos 'setor' e 'anexo') e no
// Node. Para cada prédio do setor faz o plano (planoPredio.js); no LOD0 funde todos numa malha só por material
// (`edificio`), com os vértices relativos ao canto do setor e os atributos quantizados (quantizar.js); e devolve sempre
// as instâncias do LOD1 por forma (a principal de cada prédio primeiro: o LOD2 é o começo da lista) e a caixa de cada
// prédio (seleção e testes). A thread principal (render/mundo/predios.js) monta os pedidos e recebe o resultado.
//
// Pedido (dados): { setor, ox, oz, lod0, n, num: Float32Array(n x NUM) [x - ox, y, z - oz, rot, w, d],
//                   ints: Uint32Array(n x INT) [idx, semente, modelo, nível | estilo << 4 | cor << 8 | abandonado << 12] }
// Resposta: { setor, lod0, malhas: [malha quantizada] | [], lod1: [{ n, np, mat, ids, bytes } x 4 formas],
//             caixas: Float32Array(n x CAIXA) [x0, z0, x1, z1, y0, y1, trisLOD0] no espaço do lote, tris: { lod0, lod1 } }
import { planoPredio } from './planoPredio.js';
import { Construtor, malhaDoPlano, instanciasDoPlano, formaUnitaria, FORMAS } from './malhaPredio.js';
import { quantizarMalha } from './quantizar.js';

export const NUM = 6;
export const INT = 4;
export const CAIXA = 7;

const TRIS_FORMA = FORMAS.map((_, f) => formaUnitaria(f).tris);

/** Empacota nível, estilo, cor e abandono num inteiro (ints[4 * i + 3]). */
export const empacotarPredio = (nivel, estilo, cor, abandonado) => (nivel & 15) | ((estilo & 15) << 4) | ((cor & 15) << 8) | ((abandonado ? 1 : 0) << 12);

/** Gera um setor (ou um anexo: o mesmo formato com poucos prédios). */
export function gerarSetor(dados) {
  const { n = 0, num, ints, ox = 0, oz = 0, lod0 = false } = dados;
  const K = lod0 ? new Construtor(Math.max(256, n * 400)) : null;
  const prin = FORMAS.map(() => ({ m: [], b: [], id: [] }));
  const sec = FORMAS.map(() => ({ m: [], b: [], id: [] }));
  const caixas = new Float32Array(n * CAIXA);
  let tris1 = 0;
  for (let i = 0; i < n; i++) {
    const x = num[NUM * i];
    const y = num[NUM * i + 1];
    const z = num[NUM * i + 2];
    const rot = num[NUM * i + 3];
    const w = num[NUM * i + 4];
    const d = num[NUM * i + 5];
    const idx = ints[INT * i];
    const pk = ints[INT * i + 3];
    const plano = planoPredio({
      w, d, modelo: ints[INT * i + 2], semente: ints[INT * i + 1],
      nivel: pk & 15, estilo: (pk >> 4) & 15, cor: (pk >> 8) & 15, abandonado: !!((pk >> 12) & 1),
    });
    let t0 = 0;
    if (K) {
      K.predio(x, y, z, rot, idx);
      t0 = malhaDoPlano(K, plano);
    }
    instanciasDoPlano(plano, ox + x, y, oz + z, rot, (f, m, b, principal) => {
      const L = principal ? prin[f] : sec[f];
      L.m.push(...m);
      L.b.push(...b);
      L.id.push(idx);
      tris1 += TRIS_FORMA[f];
    });
    const c = plano.caixa;
    caixas.set([c[0], c[2], c[3], c[5], c[1], c[4], t0], CAIXA * i);
  }
  const lod1 = FORMAS.map((_, f) => {
    const P = prin[f];
    const S = sec[f];
    const np = P.id.length;
    const cnt = np + S.id.length;
    const mat = new Float32Array(cnt * 16);
    mat.set(P.m, 0);
    mat.set(S.m, np * 16);
    const bytes = new Uint8Array(cnt * 16);
    bytes.set(P.b, 0);
    bytes.set(S.b, np * 16);
    const ids = new Uint32Array(cnt);
    ids.set(P.id, 0);
    ids.set(S.id, np);
    return { n: cnt, np, mat, bytes, ids };
  });
  const malhas = K && K.nv ? [quantizarMalha(K)] : [];
  return { setor: dados.setor, lod0, malhas, lod1, caixas, tris: { lod0: K ? K.tris : 0, lod1: tris1 } };
}

/** Registra os geradores de setor e de anexo no worker `oficina` (D45). */
export function registrar({ registrarGeradorOficina } = {}) {
  registrarGeradorOficina?.('setor', gerarSetor);
  registrarGeradorOficina?.('anexo', gerarSetor);
}
