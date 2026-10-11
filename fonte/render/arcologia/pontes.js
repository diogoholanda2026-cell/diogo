// Canopy Bridges (D97): as 8 pontes-jardim entre o Meridian Ring e o Horizon Ring, nos eixos das 8 avenidas. Cada uma é um
// parque no ar, não uma passarela (a ideia do SkyPark do Marina Bay Sands e do The Crystal de Chongqing): tabuleiro branco
// fino a 66 m (entre duas marquises, dentro das duas faixas de LED), 30 m de largura com o passeio de pedra no meio, os
// canteiros com duas fileiras de árvores, o deck de madeira e o guarda-corpo de vidro nas bordas, o arco raso por baixo (a
// flecha de uns 1/27 do vão, sem pilar na avenida) e a faixa de LED que corre o tabuleiro por fora e por baixo e liga as
// faixas dos dois anéis. Nas três avenidas que levam a Codex Tower, a Helix Labs e a Compass Tower o tabuleiro atravessa a
// torre e a ponte faz escala nela, em dois vãos de uns 90 m. Cada ponte aparece com o trecho do Horizon Ring em que pousa.
//
// Em malha (LOD1, o único: as árvores de perto são da vegetação, que as planta pelas listas da Arcologia): tabuleiro,
// canteiros, vidro, LED, costelas do arco com os pendurais e, para a leitura de longe, uma copa baixa em cada árvore (8
// triângulos) mais dois ipês em flor por ponte (acento de cor: a vegetação não tem espécie florida).
import { acab, PADRAO, LUZ, VIDRO, vid, caixa, barra, tufo, hashF } from './torre.js';
import { noArco } from './arcos.js';

const RAD = Math.PI / 180;

const K = {
  branco: acab('#e3e0d8', { rugo: 0.5 }),
  forro: acab('#d8d4ca', { rugo: 0.6, luz: LUZ.marquise }),
  passeio: acab('#d4cbb8', { rugo: 0.78, padrao: PADRAO.piso }),
  deck: acab('#a58a6c', { rugo: 0.8 }),
  granito: acab('#6a655f', { rugo: 0.6, padrao: PADRAO.pedra }),
  jardim: acab('#3b5a2c', { rugo: 0.95, padrao: PADRAO.folha }),
  led: acab('#ece4d4', { rugo: 0.3, metal: 0.3, luz: LUZ.ponte }),
  // as copas baixas de longe: verdes fundos e variados (nada de verde-lima)
  copa: [
    acab('#36502c', { rugo: 0.95, padrao: PADRAO.folha }),
    acab('#415b34', { rugo: 0.95, padrao: PADRAO.folha }),
    acab('#2c4727', { rugo: 0.95, padrao: PADRAO.folha }),
  ],
  tronco: acab('#4a3f35', { rugo: 0.9 }),
  // ipê-amarelo (dourado queimado) e ipê-roxo (lilás fechado): a flor de agosto e setembro
  ipeAmarelo: acab('#c99a2e', { rugo: 0.9, padrao: PADRAO.folha }),
  ipeRoxo: acab('#85578a', { rugo: 0.9, padrao: PADRAO.folha }),
  // quaresmeira (Tibouchina granulosa, o magenta fundo) e manacá-da-serra (Tibouchina mutabilis: a flor passa de branca a lilás)
  quaresmeira: acab('#8c3a7c', { rugo: 0.9, padrao: PADRAO.folha }),
  manaca: acab('#c4a3c8', { rugo: 0.9, padrao: PADRAO.folha }),
};

/** As quatro árvores de flor da Mata Atlântica que a vegetação não tem (ipê-amarelo, ipê-roxo, quaresmeira e manacá-da-serra). */
export const FLORADAS = Object.freeze({ amarelo: K.ipeAmarelo, roxo: K.ipeRoxo, quaresmeira: K.quaresmeira, manaca: K.manaca });

/**
 * Copa baixa de longe: uma bipirâmide de seis lados mexida (12 triângulos, normais radiais: lê como mancha macia de folhagem,
 * não como pirâmide). De longe uma ponte tem uns 40 destas por vão; o icosaedro de 20 custava 8 mil triângulos nas 8 pontes.
 */
export function copaBaixa(m, cx, cy, cz, r, ry, k, semente) {
  const base = m.vertices;
  const pts = [[0, 1, 0], [0, -0.55, 0]];
  for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * 6.2832 + 0.4), 0.12, Math.sin((i / 6) * 6.2832 + 0.4)]);
  pts.forEach((p, i) => {
    const j = 0.82 + 0.34 * hashF(semente, i);
    const x = cx + p[0] * r * j;
    const y = cy + p[1] * ry * j;
    const z = cz + p[2] * r * j;
    const tom = 0.84 + 0.28 * hashF(semente, i, 9) + (p[1] > 0.5 ? 0.12 : p[1] < 0 ? -0.14 : 0);
    m.v(x, y, z, p[0], i < 2 ? p[1] * 1.8 : 0.3, p[2], x, z, [k[0] * tom, k[1] * tom, k[2] * tom, k[3]]);
  });
  for (let i = 0; i < 6; i++) {
    const a = base + 2 + i;
    const b = base + 2 + ((i + 1) % 6);
    m.tri(base, b, a);
    m.tri(base + 1, a, b);
  }
}

/** Árvore em flor (acento de cor): o tronco fino e a copa em três tufos da cor da flor (`cor` de FLORADAS: o ipê é o padrão). */
export function ipeEmFlor(m, x, y, z, altura, cor, semente) {
  const tr = altura * 0.4;
  const k = FLORADAS[cor] ?? K.ipeAmarelo;
  // o tronco de 5 lados
  const base = m.vertices;
  for (let s = 0; s < 5; s++) {
    const t = (s / 5) * Math.PI * 2;
    m.v(x + Math.cos(t) * 0.3, y, z + Math.sin(t) * 0.3, Math.cos(t), 0, Math.sin(t), s, 0, K.tronco);
    m.v(x + Math.cos(t) * 0.18, y + tr, z + Math.sin(t) * 0.18, Math.cos(t), 0, Math.sin(t), s, tr, K.tronco);
  }
  for (let s = 0; s < 5; s++) {
    const a = base + 2 * s;
    const b = base + 2 * ((s + 1) % 5);
    m.tri(a, b, a + 1);
    m.tri(b, b + 1, a + 1);
  }
  const R = altura * 0.34;
  tufo(m, x, y + tr + R * 0.7, z, R, R * 0.78, k, semente);
  tufo(m, x + R * 0.55, y + tr + R * 0.35, z - R * 0.2, R * 0.62, R * 0.5, k, semente + 1);
  tufo(m, x - R * 0.45, y + tr + R * 0.45, z + R * 0.3, R * 0.58, R * 0.46, k, semente + 2);
}

/** Meia profundidade que a torre ocupa no eixo (m) mais a folga do guarda-corpo e dos canteiros em volta dela. */
const FOLGA_TORRE = 1;

/**
 * A ponte: p = { cx, cz, angulo, r0, r1, cota, largura, espessura, nasce, flecha, torre: { r, meia } | null, trecho }.
 * g.chao dá o chão; g.vidro, g.opaco e g.arvores recebem a malha e as árvores (a vegetação as desenha).
 */
export function ponte(g, p) {
  const { cx, cz, angulo, r0, r1, cota, largura, espessura, nasce, flecha, torre } = p;
  const a = angulo * RAD;
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  const lx = -uz;
  const lz = ux;
  const yb = g.chao(cx + ux * (r0 + r1) / 2, cz + uz * (r0 + r1) / 2);
  const Y = yb + cota;
  const hw = largura / 2;
  const P = (s, v, y) => [cx + ux * s + lx * v, y, cz + uz * s + lz * v];
  const sa = r0 - 1;
  const sb = r1 + 0.6;
  const sm = (sa + sb) / 2;
  const c = P(sm, 0, 0);
  // o tabuleiro: a laje branca (os lados e o fundo; o topo leva as camadas de cima)
  caixa(g.opaco, c[0], c[2], (sb - sa) / 2, hw, Y - espessura, Y, K.branco, { ux, uz, topo: false, base: true });
  if (g.sombra) return;
  // os vãos livres do tabuleiro: dois se há torre no eixo, um se não
  const vaos = torre ? [[r0, torre.r - torre.meia], [torre.r + torre.meia, r1]] : [[r0, r1]];
  const naTorre = (s) => !!torre && s > torre.r - torre.meia - FOLGA_TORRE && s < torre.r + torre.meia + FOLGA_TORRE;
  const Lcheio = r1 - r0;

  // as costelas do arco raso por baixo (duas, a 9 m do eixo), nascendo nas faces e subindo até quase a laje no meio do vão
  const yTopoArco = Y - espessura - 0.8;
  for (const [va, vb] of vaos) {
    const L = vb - va;
    const f = flecha * (L / Lcheio);
    const N = L > 120 ? 14 : 8;
    const yArco = (s) => yTopoArco - f + f * (1 - ((2 * (s - (va + vb) / 2)) / L) ** 2);
    for (const v of [-9, 9]) {
      let ant = null;
      for (let i = 0; i <= N; i++) {
        const s = va + ((vb - va) * i) / N;
        const pt = P(s, v, yArco(s));
        if (ant) barra(g.opaco, ant, pt, 0.85, 4, K.branco);
        ant = pt;
      }
      // os pendurais finos da costela até a laje, a cada uns 18 m
      const nP = Math.max(2, Math.round(L / 18));
      for (let i = 1; i < nP; i++) {
        const s = va + (L * i) / nP;
        const yp = yArco(s) + 0.8;
        if (Y - espessura - yp > 0.8) barra(g.opaco, P(s, v, yp), P(s, v, Y - espessura), 0.28, 3, K.branco);
      }
    }
  }
  if (g.fantasma) {
    g.caixa([c[0], Y - 4, c[2]], (sb - sa) / 2, 6, (sb - sa) / 2, p.trecho);
    return;
  }

  // a luz: a faixa de LED que corre o tabuleiro dos dois lados (ela liga as faixas dos anéis) e por baixo, nas bordas
  for (const sd of [-1, 1]) {
    const n = [lx * sd, 0, lz * sd];
    g.opaco.quad(P(sa, sd * (hw + 0.03), Y - 1.35), P(sb, sd * (hw + 0.03), Y - 1.5), P(sb, sd * (hw + 0.03), Y - 0.6), P(sa, sd * (hw + 0.03), Y - 0.6), n, [0, 0], [sb - sa, 0], [sb - sa, 0.9], [0, 0.9], K.led);
    // por baixo, 3 m de faixa de cada lado (a que se lê de baixo, da avenida) e, por cima, a faixa de luz de 2,4 m na borda do deck (a que
    // se lê do alto, da vista aberta: o tabuleiro fica contornado de luz entre o verde)
    g.opaco.quad(P(sa, sd * (hw - 3.6), Y - espessura - 0.03), P(sb, sd * (hw - 3.6), Y - espessura - 0.03), P(sb, sd * (hw - 0.6), Y - espessura - 0.03), P(sa, sd * (hw - 0.6), Y - espessura - 0.03), [0, -1, 0], [0, 0], [sb - sa, 0], [sb - sa, 3], [0, 3], K.led);
    g.opaco.quad(P(sa, sd * (hw - 2.9), Y + 0.07), P(sb, sd * (hw - 2.9), Y + 0.07), P(sb, sd * (hw - 0.5), Y + 0.07), P(sa, sd * (hw - 0.5), Y + 0.07), [0, 1, 0], [0, 0], [sb - sa, 0], [sb - sa, 2.4], [0, 2.4], K.led);
  }

  // as camadas de cima: o passeio de pedra no meio, o deck de madeira nas bordas e os canteiros com duas fileiras de árvores
  const camada = (s0, s1, v0, v1, y, k) => g.opaco.quad(P(s0, v0, y), P(s1, v0, y), P(s1, v1, y), P(s0, v1, y), [0, 1, 0], [P(s0, v0, 0)[0], P(s0, v0, 0)[2]], [P(s1, v0, 0)[0], P(s1, v0, 0)[2]], [P(s1, v1, 0)[0], P(s1, v1, 0)[2]], [P(s0, v1, 0)[0], P(s0, v1, 0)[2]], k);
  camada(sa, sb, -5, 5, Y + 0.03, K.passeio);
  for (const sd of [-1, 1]) camada(sa, sb, sd * 11, sd * hw, Y + 0.03, K.deck);
  for (const [va, vb] of vaos) {
    for (const sd of [-1, 1]) {
      const s0 = va + 0.3;
      const s1 = vb - 0.3;
      const cc = P((s0 + s1) / 2, sd * 8, 0);
      caixa(g.opaco, cc[0], cc[2], (s1 - s0) / 2, 3, Y, Y + 0.8, K.jardim, { ux, uz, lados: K.granito });
    }
  }
  // o guarda-corpo de vidro das duas bordas, de dentro e de fora
  for (const [va, vb] of vaos) {
    for (const sd of [-1, 1]) {
      const v = sd * (hw - 0.15);
      for (const f of [-1, 1]) {
        const n = [lx * sd * f, 0, lz * sd * f];
        g.vidro.quad(P(va, v, Y), P(vb, v, Y), P(vb, v, Y + 1.2), P(va, v, Y + 1.2), n, [0, 0], [vb - va, 0], [vb - va, 1.2], [0, 1.2], vid(VIDRO.parapeito, 0.3 + 0.1 * f));
      }
    }
  }

  // as árvores: duas fileiras a 8 m do eixo, de 9 em 9 m (a vegetação desenha), e a copa baixa de longe a cada 14 m; quatro árvores
  // de flor por ponte (ipê-amarelo, ipê-roxo, quaresmeira e manacá-da-serra, a flor em volume porque a vegetação não a tem),
  // cada uma num canteiro e numa posição do vão que muda de uma ponte para a outra
  const rot = Math.round(angulo / 45) % 4;
  const flores = [[0.2, 1, 'amarelo'], [0.38, -1, 'manaca'], [0.62, 1, 'roxo'], [0.8, -1, 'quaresmeira']].map(([f, sd, cor]) => [Math.round(r0 + (r1 - r0) * ((f + 0.07 * rot) % 1)), sd, cor]);
  const florEm = (s, sd) => flores.find(([sq, sl]) => sl === sd && Math.abs(sq - s) < 5);
  let k = 0;
  for (let s = r0 + 7; s < r1 - 5; s += 9) {
    if (naTorre(s)) continue;
    for (const sd of [-1, 1]) {
      const flor = florEm(s, sd);
      const q = P(s, sd * 8, Y + 0.8);
      const h = hashF(k, Math.round(angulo), 4);
      k++;
      if (flor) {
        ipeEmFlor(g.opaco, q[0], q[1], q[2], 8.5, flor[2], k * 3 + Math.round(angulo));
        continue;
      }
      if (g.arvores) {
        // a vegetação tem a juçara (palmeira), a embaúba, o oiti e as de mata (a figueira e a estreita)
        const esp = h < 0.16 ? 'palmeira' : h < 0.32 ? 'embauba' : h < 0.55 ? 'oiti' : h < 0.8 ? 'mata3' : 'mata2';
        const alt = esp === 'palmeira' ? 7.5 + 3 * hashF(k, 2, 5) : esp === 'oiti' ? 5.5 + 2.5 * hashF(k, 3, 5) : esp === 'embauba' ? 6 + 2 * hashF(k, 3, 5) : 7 + 3 * hashF(k, 4, 5);
        g.arvores.push({ x: q[0], y: q[1], z: q[2], especie: esp, altura: alt, giro: hashF(k, 6, 7) * 6.28 });
        if (k % 3 === 0 || esp !== 'palmeira') {
          const rr = esp === 'palmeira' ? 2.8 : alt * 0.5;
          copaBaixa(g.opaco, q[0], q[1] + alt * 0.64, q[2], rr * 1.1, rr * 0.7, K.copa[k % 3], k * 5 + Math.round(angulo));
        }
      }
    }
  }
  // caixas de seleção ao longo do eixo (~40 m cada)
  const n = Math.max(2, Math.round((r1 - r0) / 40));
  for (let i = 0; i < n; i++) {
    const s = r0 + ((r1 - r0) * (i + 0.5)) / n;
    const q = P(s, 0, Y - 6);
    g.caixa(q, (r1 - r0) / n / 2 + largura / 2, 14, (r1 - r0) / n / 2 + largura / 2, p.trecho);
  }
}

/** Raio (m) e ângulo do ponto de pouso de uma ponte, para os testes e a câmera (a face de dentro do Horizon Ring). */
export function pousoDaPonte(p) {
  return noArco(p.cx, p.cz, p.r1, p.angulo);
}
