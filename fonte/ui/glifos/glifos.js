// Registro dos glifos (desenho da UI 6): traço de 1,75 numa grade de 24, pontas e juntas redondas, currentColor, sem
// preenchimento (detalhes pequenos a 35%). Um glifo é uma lista de caminhos SVG ('d'): string = traço; { d, cheio:
// true } = detalhe preenchido. Só caminhos (círculo vira arco), para o mesmo registro servir ao DOM (<Glifo>) e ao
// atlas dos marcadores no canvas (new Path2D(d), X3a). F0 criou; a U1a desenha o conjunto do M1 (primeiro corte com
// cerca de 90). Estilo único: formas dentro de 3 a 21, cantos com raio de 1 a 2, pontos como anéis de 0,55.

const glifos = new Map();

/**
 * Registra glifos: { nome: ['M...', { d: 'M...', cheio: true }] }. Registrar de novo troca o desenho.
 */
export function registrarGlifos(mapa) {
  for (const [nome, partes] of Object.entries(mapa)) {
    const lista = Array.isArray(partes) ? partes : [partes];
    glifos.set(nome, {
      tracos: lista.filter((p) => typeof p === 'string'),
      cheios: lista.filter((p) => p && typeof p === 'object' && p.cheio).map((p) => p.d),
    });
  }
}

/** O glifo pelo nome ({ tracos: [d], cheios: [d] }) ou null. */
export const glifo = (nome) => glifos.get(nome) ?? null;

/** Nomes registrados. */
export const nomesGlifos = () => [...glifos.keys()];

// ---------------------------------------------------------------- formas de apoio (só geram texto de caminho)
const n = (v) => String(+v.toFixed(2));

/** Círculo como dois arcos. */
export const circulo = (cx, cy, r) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`;

/** Retângulo de cantos arredondados. */
export function ret(x, y, w, h, r = 1.5) {
  const a = (dx, dy) => `a${n(r)} ${n(r)} 0 0 1 ${n(dx)} ${n(dy)}`;
  return `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}${a(r, r)}v${n(h - 2 * r)}${a(-r, r)}h${n(-(w - 2 * r))}${a(-r, -r)}v${n(-(h - 2 * r))}${a(r, -r)}z`;
}

/** Ponto: anel pequeno que, com o traço, lê como um ponto cheio. */
const ponto = (x, y) => circulo(x, y, 0.55);

/** Estrela de k pontas (raio de fora R, de dentro r), com a primeira ponta para cima. */
function estrela(cx, cy, R, r, k = 5) {
  const pts = [];
  for (let i = 0; i < 2 * k; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / k;
    const raio = i % 2 ? r : R;
    pts.push(`${n(cx + raio * Math.cos(ang))} ${n(cy + raio * Math.sin(ang))}`);
  }
  return `M${pts.join('L')}z`;
}

// caminhos que se repetem entre glifos
const GOTA = 'M12 3.5C9 7.6 6 10.8 6 14.25a6 6 0 0 0 12 0C18 10.8 15 7.6 12 3.5z';
const RAIO = 'M13.5 2.5 5.5 13.5h6l-1 8 8-11h-6z';
const CASA = ['M3.5 11 12 4l8.5 7', 'M5.5 9.5v11h13v-11'];
const CUBO = ['M12 3.5l8 4.5v8l-8 4.5-8-4.5V8z', 'M4 8l8 4.5L20 8', 'M12 12.5v8'];
const ROSTO = [circulo(12, 12, 8.75), ponto(9, 10), ponto(15, 10)];
const ESTRADA = 'M9 3.5 5 20.5M15 3.5l4 17';
const RISCO = 'M3.5 3.5l17 17';

registrarGlifos({
  // ------------------------------------------------------------ estado da cidade e da Holding
  // monograma da Holding: H dentro de um anel
  holding: [circulo(12, 12, 9.25), 'M8.5 7.5v9M15.5 7.5v9M8.5 12h7'],
  // créditos: moeda com aro interno e H pequeno (glifo, não símbolo de moeda)
  creditos: [circulo(12, 12, 8.5), { d: circulo(12, 12, 6), cheio: true }, 'M10 9v6M14 9v6M10 12h4'],
  populacao: [circulo(9, 8.5, 3), 'M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6', 'M15.8 5.6a2.9 2.9 0 0 1 0 5.8', 'M17.6 14.6c1.6.5 2.6 2 2.9 4.4'],
  renda: ['M3.5 16.5l5.5-5.5 3.5 3.5 7.5-7.5', 'M14.5 7h5.5v5.5'],
  bemEstarBom: [...ROSTO, 'M8.75 14a3.75 3.75 0 0 0 6.5 0'],
  bemEstarMedio: [...ROSTO, 'M9 15h6'],
  bemEstarRuim: [...ROSTO, 'M8.75 16.5a3.75 3.75 0 0 1 6.5 0'],
  demanda: ['M3.5 20.5h17', 'M5.5 20.5v-6h3v6', 'M10.5 20.5V7h3v13.5', 'M15.5 20.5v-9h3v9'],
  marco: ['M5.5 21V3.5', 'M5.5 4.5h12l-2.5 4 2.5 4h-12'],
  calendario: [ret(3.5, 5, 17, 15.5, 2), 'M3.5 10h17', 'M8 3v4M16 3v4', ponto(8, 14), ponto(12, 14), ponto(16, 14)],
  relogio: [circulo(12, 12, 8.75), 'M12 7.5V12l3 2'],
  prazo: ['M6.5 3.5h11M6.5 20.5h11', 'M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5'],
  valuation: ['M7 4h10l3.5 5L12 20.5 3.5 9z', 'M3.5 9h17', 'M10 4 8.5 9l3.5 11.5L15.5 9 14 4'],
  influencia: ['M3.5 9.5v5h4l8 4.5V5l-8 4.5z', 'M18.5 9a4.2 4.2 0 0 1 0 6'],
  legado: ['M5 19C5 10.5 10 5.5 19.5 4.5 19 14 14 19 5 19z', 'M5 19l8.5-8.5'],
  dinheiro: [ret(3, 6.5, 18, 11, 2), circulo(12, 12, 2.75), ponto(6.5, 12), ponto(17.5, 12)],
  juros: ['M6 18 18 6', circulo(7.5, 7.5, 2.25), circulo(16.5, 16.5, 2.25)],
  // contrato do empréstimo: folha com a dobra e as linhas
  contrato: ['M14.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V7.5z', 'M14.5 3.5v4h4', 'M8.75 11.5h6.5M8.75 14.5h6.5M8.75 17.5h3.5'],
  caixa: ['M18.5 8V6.5A1.5 1.5 0 0 0 17 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5V14', 'M20.5 9.75h-4.25a2.25 2.25 0 0 0 0 4.5h4.25z'],

  // ------------------------------------------------------------ céu e tempo (a hora nunca aparece em número, D42)
  sol: [circulo(12, 12, 4), 'M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5'],
  // manhã e fim de tarde: o sol no horizonte, subindo ou descendo (cada fase do céu tem o seu glifo, D42)
  solNascente: ['M3 18h18', 'M7 18a5 5 0 0 1 10 0', 'M12 3.75v5', 'M9.75 6 12 3.75 14.25 6', 'M5.9 11.4l1.4 1.4M18.1 11.4l-1.4 1.4'],
  solBaixo: ['M3 18h18', 'M7 18a5 5 0 0 1 10 0', 'M12 3.75v5', 'M9.75 6.5 12 8.75l2.25-2.25', 'M5.9 11.4l1.4 1.4M18.1 11.4l-1.4 1.4'],
  lua: ['M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z'],
  nuvem: ['M7.5 18.5h9.5a3.5 3.5 0 0 0 .4-6.98 5 5 0 0 0-9.7-1.2A4.1 4.1 0 0 0 7.5 18.5z'],
  pausa: ['M9 6.5v11M15 6.5v11'],
  vel1: ['M9 6.5l7 5.5-7 5.5z'],
  vel2: ['M5.5 6.5l6.5 5.5-6.5 5.5zM12.5 6.5l6.5 5.5-6.5 5.5z'],
  vel3: ['M3.5 7.5L8 12l-4.5 4.5zM9.75 7.5l4.5 4.5-4.5 4.5zM16 7.5l4.5 4.5-4.5 4.5z'],

  // ------------------------------------------------------------ construção (categorias da barra, D24)
  vias: [ESTRADA, 'M12 5v2M12 10.5v2.5M12 16.5v3'],
  zonas: [ret(4, 4, 7, 7, 1), ret(13, 4, 7, 7, 1), ret(4, 13, 7, 7, 1), ret(13, 13, 7, 7, 1), { d: ret(13, 13, 7, 7, 1), cheio: true }],
  servicos: ['M3.5 9.5 12 4.5l8.5 5', 'M4.5 9.5h15', 'M6.5 12v6M10 12v6M14 12v6M17.5 12v6', 'M3.5 20.5h17'],
  lazer: [circulo(12, 9.25, 5.75), 'M12 15v5.5', 'M8.5 20.5h7', 'M12 17.5l2.5-2.5'],
  empresas: ['M4 20.5V9h6v11.5', 'M10 20.5V4h10v16.5', 'M2.5 20.5h19', 'M13 7.5h4M13 11h4M13 14.5h4', 'M6.5 12.5h1M6.5 16h1'],
  // a Torre Lâmina de lado (D27): pódio baixo e largo e três lâminas coladas com as alturas na proporção real (163,
  // 238 e 301 m: a mais baixa passa da metade), recuos só do lado das penas, a face lisa inteira e o heliponto em
  // balanço no topo. Com degraus de alturas iguais ela lia como escada ou pódio de prêmio; com recuos de menos de 2,5
  // o degrau vira serrilhado nos 22 px da barra
  arcologia: ['M3.5 20.5h17', 'M5.5 20.5V18h13v2.5', 'M7.5 18v-7.5H10v-3h2.5V4H16v14', 'M16 4h2.5'],
  // marreta
  demolir: ['M13.5 4.25 19.75 10.5l-3 3-6.25-6.25z', 'M12 9 4.25 16.75a1.77 1.77 0 0 0 2.5 2.5L14.5 11.5'],
  obra: ['M7 21V3.5', 'M3.5 6.5h17', 'M7 3.5 3.5 6.5M7 3.5l13.5 3', 'M17 6.5v4', ret(15.25, 10.5, 3.5, 3, 0.5), 'M4.5 21h5'],

  // ------------------------------------------------------------ zonas (famílias da D23)
  residencial: [...CASA, 'M10 20.5V15h4v5.5'],
  comercial: ['M4 8.5 5.5 4h13L20 8.5', 'M4 8.5v1a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0v-1z', 'M5.5 12.5v8h13v-8', 'M10 20.5V16h4v4.5'],
  industrial: ['M3 20.5v-10l5.5 3.5v-3.5l5.5 3.5v-3.5l4 2.5V4h3v16.5z', 'M7 17h1.5M11.5 17H13'],
  escritorio: [ret(6, 3.5, 12, 17, 1), 'M9.5 7.5H11M13 7.5h1.5M9.5 11H11M13 11h1.5M9.5 14.5H11M13 14.5h1.5', 'M4 20.5h16'],

  // ------------------------------------------------------------ serviços e redes
  agua: [GOTA],
  esgoto: ['M3.5 6.5h9a5 5 0 0 1 5 5v1', 'M3.5 10.5h9a1 1 0 0 1 1 1v1', 'M12.5 12.5h6', 'M15.5 15.5c-1 1.35-2 2.4-2 3.3a2 2 0 0 0 4 0c0-.9-1-1.95-2-3.3z'],
  energia: [RAIO],
  saude: [ret(4, 4, 16, 16, 3), 'M12 8v8M8 12h8'],
  educacao: ['M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5z', 'M12 6.5v13'],
  policia: ['M12 3.5l7.5 2.75V12c0 4.3-3.1 7.4-7.5 8.75C7.6 19.4 4.5 16.3 4.5 12V6.25z', estrela(12, 11.75, 3.4, 1.45)],
  bombeiros: ['M12 21a6 6 0 0 0 6-6c0-3.6-2.6-5.4-3.6-8.6-1 2.1-2.1 3.1-3.2 3.6-.3-2.6-1.2-4.6-2.7-6.5C8.2 7.6 6 10 6 15a6 6 0 0 0 6 6z', 'M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.4-2.4 2.5-4 1.1 1.6 2.5 2.4 2.5 4A2.5 2.5 0 0 1 12 21z'],
  praca: ['M3.5 10h17', 'M3.5 14h17', 'M6 14v5.5M18 14v5.5', 'M6 10V7.5M18 10V7.5'],
  parque: [circulo(8.5, 9, 4), 'M8.5 13v7.5', circulo(16, 11.5, 3.25), 'M16 14.75v5.75', 'M3.5 20.5h17'],

  // ------------------------------------------------------------ Holding e produção
  deposito: ['M3.5 20.5V9L12 4.5 20.5 9v11.5', 'M7.5 20.5V13h9v7.5', 'M7.5 16.75h9'],
  lote: [ret(3.5, 12.5, 8, 8, 1), ret(12.5, 12.5, 8, 8, 1), ret(8, 3.5, 8, 8, 1)],
  material: [...CUBO],
  // caminhão de carga (frota da Holding, vendas à cidade)
  caminhao: [ret(2.5, 6.5, 11.5, 10, 1), 'M14 9.5h3.25l3.25 3.5v3.5H14', circulo(7, 17.75, 1.75), circulo(16.75, 17.75, 1.75)],
  // importar: caixa aberta com a seta entrando
  importar: ['M4 12.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6.5', 'M4 12.5h4.5l1 2h5l1-2H20', 'M12 3.5v7.5', 'M9 8l3 3 3-3'],
  manutencao: ['M14.7 6.3a4.25 4.25 0 0 0-5.6 5.6l-5 5a1.9 1.9 0 0 0 2.7 2.7l5-5a4.25 4.25 0 0 0 5.6-5.6l-2.6 2.6-2.4-.3-.3-2.4z'],
  alcance: [circulo(12, 12, 8.75), 'M12 12h8.75', ponto(12, 12)],
  trabalho: [ret(3.5, 7.5, 17, 12, 2), 'M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5', 'M3.5 12.5h17'],
  eficiencia: ['M4.5 17a7.5 7.5 0 1 1 15 0', 'M12 17l3.5-4.5', ponto(12, 17)],
  nivel: ['M6 12.5 12 7l6 5.5', 'M6 18 12 12.5l6 5.5'],

  // ------------------------------------------------------------ avisos (o atlas dos marcadores sai daqui, X3a)
  // o ponto da exclamação é traço cheio, como o do info: preenchido a 35% ele sumia nos 12 px do saldo negativo
  alerta: ['M12 4.2l8.6 15H3.4z', 'M12 9.5v4', ponto(12, 16.4)],
  semVia: [ESTRADA, 'M9.5 9.5l5 5M14.5 9.5l-5 5'],
  semEnergia: [RAIO, RISCO],
  semAgua: [GOTA, RISCO],
  semTrabalhadores: [circulo(10, 8, 3.25), 'M3.5 20c.6-3.4 3.1-5.25 6.5-5.25 1.2 0 2.3.2 3.2.7', 'M15 17.5h6'],
  abandonado: [...CASA, 'M9.5 12l5 5.5M14.5 12l-5 5.5'],
  semMaterial: [...CUBO, RISCO],

  // ------------------------------------------------------------ vista e sistema
  camadas: ['M12 3.5l8.5 4.5L12 12.5 3.5 8z', 'M3.5 12 12 16.5 20.5 12', 'M3.5 16 12 20.5 20.5 16'],
  mural: ['M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-7.5l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z', 'M7.5 9h9M7.5 12h6'],
  conselho: [
    'M5 4h8.5A1.5 1.5 0 0 1 15 5.5v5a1.5 1.5 0 0 1-1.5 1.5H8.5l-3 2.5V12H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 4z',
    'M17.5 9.5H19a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-.5V20l-3-2.5H11a1.5 1.5 0 0 1-1.5-1.5v-1.5',
  ],
  foto: ['M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2.5h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z', circulo(12, 12.75, 3.5)],
  ajustes: ['M4 7h9.5M17.5 7H20M4 17h2.5M10.5 17H20', circulo(15.5, 7, 2), circulo(8.5, 17, 2)],
  localizar: [circulo(12, 12, 7), 'M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4', ponto(12, 12)],
  info: [circulo(12, 12, 8.75), 'M12 11v5.5', ponto(12, 7.75)],
  menu: ['M5 7h14M5 12h14M5 17h14'],
  reticencias: [circulo(6, 12, 1.1), circulo(12, 12, 1.1), circulo(18, 12, 1.1)],
  fechar: ['M6.5 6.5l11 11M17.5 6.5l-11 11'],
  voltar: ['M14.5 5.5 8 12l6.5 6.5'],
  setaDir: ['M9.5 5.5 16 12l-6.5 6.5'],
  setaCima: ['M5.5 14.5 12 8l6.5 6.5'],
  setaBaixo: ['M5.5 9.5 12 16l6.5-6.5'],
  ir: ['M4.5 12h14', 'M13 6.5l5.5 5.5-5.5 5.5'],
  mais: ['M12 5v14M5 12h14'],
  menos: ['M5 12h14'],
  cadeado: [ret(5, 10.5, 14, 10, 2), 'M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  grafico: ['M4 4v16h16', 'M7.5 15l3.5-4.5 3 2.5 5-6'],
  tabela: [ret(3.5, 5, 17, 14, 2), 'M3.5 10h17M3.5 14.5h17M10 10v9'],
  salvar: ['M12 3.5v11', 'M7.5 10 12 14.5l4.5-4.5', 'M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2'],
  som: ['M4 9.5v5h3.5l4.5 4V5.5l-4.5 4z', 'M15.5 9.25a3.9 3.9 0 0 1 0 5.5', 'M18 6.75a7.4 7.4 0 0 1 0 10.5'],
  olho: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', circulo(12, 12, 3)],
});

/** Glifo do rosto do bem-estar pela faixa da tarifa (as faixas do dono: até 30, 31 a 60, 61 a 100). */
export const glifoBemEstar = (tarifa) => (tarifa >= 11 ? 'bemEstarBom' : tarifa >= 8 ? 'bemEstarMedio' : 'bemEstarRuim');
