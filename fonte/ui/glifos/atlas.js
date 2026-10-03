// Atlas dos glifos de aviso para o render (desenho da UI 6.3; D28; X3a): na carga, os glifos de aviso do registro
// (glifos.js, o mesmo traço do DOM) e os algarismos da contagem dos marcadores de setor viram um canvas de 512 x 512
// com células de 64 px, traço branco sobre transparente, e vão para R.marcadores.atlas(canvas, mapa). O glifo fica
// nos 44 px do meio da célula (folga de 10 px: as mips de baixo não misturam as vizinhas). Os algarismos vêm da Inter
// (fillText); quando a fonte termina de carregar, o atlas é refeito.
import { glifo } from './glifos.js';

export const ATLAS = Object.freeze({ lado: 512, celula: 64, porLado: 8, glifoPx: 44, traco: 2.1 });

/** Glifos de aviso no atlas (os de q.avisosPredios e os do desenho da UI 6.2), na ordem das células. */
export const GLIFOS_ATLAS = Object.freeze([
  'alerta', 'semVia', 'semEnergia', 'semAgua', 'semTrabalhadores', 'abandonado', 'semMaterial', 'poucosClientes',
  'semMercadoria', 'semCreditos', 'estoqueCheio', 'doenca', 'crime', 'incendio', 'transito', 'trabalho',
  'bemEstarRuim', 'lixo', 'esgoto', 'obra', 'holding', 'arcologia', 'lote', 'deposito',
]);
/** Os algarismos começam numa linha própria (a célula do '0' vai para o render no mapa). */
export const PRIMEIRO_DIGITO = 40;

/** Célula de cada nome (puro): { nome: célula, '0'..'9': células seguidas }. */
export function mapaAtlas(nomes = GLIFOS_ATLAS) {
  const mapa = {};
  nomes.slice(0, PRIMEIRO_DIGITO).forEach((n, k) => {
    mapa[n] = k;
  });
  for (let d = 0; d < 10; d++) mapa[String(d)] = PRIMEIRO_DIGITO + d;
  return mapa;
}

/** Canto de cima à esquerda de uma célula, em px. */
export const cantoDaCelula = (c) => [(c % ATLAS.porLado) * ATLAS.celula, Math.floor(c / ATLAS.porLado) * ATLAS.celula];

/** Desenha o atlas num canvas (novo, ou o dado). Devolve { canvas, mapa }. */
export function desenharAtlas(canvas = null, nomes = GLIFOS_ATLAS) {
  const cv = canvas ?? document.createElement('canvas');
  cv.width = ATLAS.lado;
  cv.height = ATLAS.lado;
  const g = cv.getContext('2d');
  const mapa = mapaAtlas(nomes);
  g.clearRect(0, 0, ATLAS.lado, ATLAS.lado);
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const k = ATLAS.glifoPx / 24;
  const m = (ATLAS.celula - ATLAS.glifoPx) / 2;
  for (const nome of nomes) {
    const desenho = glifo(nome);
    if (!desenho || mapa[nome] === undefined) continue;
    const [x, y] = cantoDaCelula(mapa[nome]);
    g.save();
    g.translate(x + m, y + m);
    g.scale(k, k);
    g.lineWidth = ATLAS.traco;
    g.globalAlpha = 0.35;
    for (const d of desenho.cheios) g.fill(new Path2D(d));
    g.globalAlpha = 1;
    for (const d of desenho.tracos) g.stroke(new Path2D(d));
    g.restore();
  }
  // algarismos: 650 da Inter, centrados na célula
  g.font = `650 ${Math.round(ATLAS.celula * 0.78)}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let d = 0; d < 10; d++) {
    const [x, y] = cantoDaCelula(mapa[String(d)]);
    g.fillText(String(d), x + ATLAS.celula / 2, y + ATLAS.celula / 2 + 3);
  }
  return { canvas: cv, mapa };
}

export function registrar(ui) {
  if (typeof document === 'undefined' || !ui.R?.marcadores?.atlas) return;
  const entregar = () => {
    try {
      const { canvas, mapa } = desenharAtlas();
      ui.R.marcadores.atlas(canvas, mapa);
    } catch (e) {
      console.error('atlas dos marcadores:', e);
    }
  };
  entregar();
  // a Inter dos algarismos pode chegar depois da primeira entrega
  document.fonts?.load?.('650 50px Inter').then(entregar, () => {});
}
