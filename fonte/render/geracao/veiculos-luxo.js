// Esportivos da frota de carros (R6, D61; puro, sem three). Referência: cupê de motor central ou dianteiro baixo e largo,
// na família do Porsche 911, do Ferrari Roma e do Lamborghini Huracán (nomes fictícios, nenhuma marca no jogo): 4,55 m
// por 1,95 m e 1,20 m de altura, entre-eixos de 2,70 m, rodas de 34 cm de raio, cabine recuada, bico baixo e longo,
// tomadas de ar nas laterais e aerofólio na tampa. O corpo é o gerador dos carros de passeio (geracao/veiculos.js, que
// lê estas medidas em MODELOS); aqui ficam as medidas e as peças que só o esportivo tem. A frota o sorteia em 6% dos
// carros de passeio (mundo/trafego.js), em cores vivas (ESPORTIVOS_CORES), e cabe numa só chamada instanciada por LOD.

/** Medidas do esportivo (a forma de MODELOS em geracao/veiculos.js). */
export const ESPORTIVO = Object.freeze({
  id: 'esportivo', nome: 'esportivo', c: 4.55, l: 1.95, h: 1.2, cintura: 0.8, vao: 0.11, roda: 0.34, eixos: 2.7,
  cabine: [0.62, 0.45, 0.2, 0.08], capo: 0.62, traseira: 0.9, esporte: true,
});

/** Cores do esportivo (sRGB, peso): vermelho de corrida, amarelo, azul-noite, branco pérola, grafite e laranja. */
export const ESPORTIVOS_CORES = Object.freeze([
  ['#b3131b', 0.26], ['#e2b81c', 0.14], ['#16284f', 0.14], ['#ece9e2', 0.16], ['#2b2d31', 0.2], ['#d9631a', 0.1],
]);

/**
 * Peças a mais do esportivo, como polígonos { pts, parte } (anti-horário visto de fora): aerofólio na tampa (lâmina em
 * duas hastes), duas tomadas de ar atrás das portas e o spoiler baixo sob o bico. parte: números de PARTE.
 * @param {typeof ESPORTIVO} m
 * @param {{ PINTURA: number, PRETO: number }} PARTE
 */
export function pecasEsportivo(m, PARTE) {
  const w = m.l / 2;
  const zT = -m.c / 2;
  const zF = m.c / 2;
  const P = [];
  const caixa = (x0, y0, z0, x1, y1, z1, parte, soLados = false) => {
    P.push({ pts: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], parte });
    P.push({ pts: [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], parte });
    if (soLados) return;
    P.push({ pts: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], parte });
    P.push({ pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], parte });
    P.push({ pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], parte });
  };
  // aerofólio: lâmina fina na altura de 1,12 m, a 0,30 m do fim da traseira, com as hastes escuras
  const yA = m.traseira + 0.2;
  const zA = zT + 0.42;
  caixa(-w + 0.1, yA, zA - 0.2, w - 0.1, yA + 0.045, zA + 0.2, PARTE.PINTURA);
  for (const s of [-1, 1]) caixa(s * (w - 0.42) - 0.03, m.traseira - 0.05, zA - 0.05, s * (w - 0.42) + 0.03, yA, zA + 0.05, PARTE.PRETO, true);
  // tomadas de ar: painéis escuros rentes às laterais, atrás das portas (a esquerda e a direita)
  const zI = zT + m.c * 0.41;
  for (const s of [-1, 1]) {
    const x = s * (w + 0.006);
    const q = [[x, m.cintura - 0.26, zI - 0.3], [x, m.cintura - 0.26, zI + 0.3], [x, m.cintura - 0.04, zI + 0.22], [x, m.cintura - 0.04, zI - 0.22]];
    P.push({ pts: s > 0 ? q.slice().reverse() : q, parte: PARTE.PRETO });
  }
  // spoiler dianteiro: lábio escuro sob o bico
  P.push({ pts: [[-w + 0.36, m.vao + 0.02, zF - 0.02], [w - 0.36, m.vao + 0.02, zF - 0.02], [w - 0.36, m.vao + 0.1, zF - 0.02], [-w + 0.36, m.vao + 0.1, zF - 0.02]].reverse(), parte: PARTE.PRETO });
  return P;
}

/** O esportivo é sorteado na thread principal (mundo/trafego.js); este módulo não registra tipo na oficina. */
export function registrar() {}
