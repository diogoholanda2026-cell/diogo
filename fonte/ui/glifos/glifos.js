// Registro dos glifos (desenho da UI 6): traço de 1,75 numa grade de 24, pontas e juntas redondas, currentColor, sem
// preenchimento (detalhes pequenos a 35%). Um glifo é uma lista de caminhos SVG ('d'): string = traço; { d, cheio:
// true } = detalhe preenchido. Só caminhos (círculo vira arco), para o mesmo registro servir ao DOM (<Glifo>) e ao
// atlas dos marcadores no canvas (new Path2D(d), X3a). F0 criou; a U1a desenha o conjunto do M1 (cerca de 145, da
// seção 6.2 do desenho). Estilo único: formas dentro de 3 a 21, cantos com raio de 1 a 2, pontos como anéis de 0,55.
// Outra parcela que precisar de um glifo novo pede aqui (ou registra no dela com o mesmo traço, ui.registrarGlifos).

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

// O resto do conjunto do M1 (desenho da UI 6.2), no mesmo traço, para as parcelas que vêm depois não desenharem os
// seus: ferramentas de via e zona (X2), serviços e divisões da Holding (U1b), avisos do atlas dos marcadores (X3a) e
// o sistema (U2a). Vias vistas de cima, na ordem da largura (rua 16 m, avenida 24, avenida grande 32).
// densidade: as colunas até a escolhida, cheias; as de cima ficam só no chão (o lugar delas)
const COLUNAS = [ret(4, 14.5, 4, 6, 1), ret(10, 10, 4, 10.5, 1), ret(16, 5.5, 4, 15, 1)];
const CHAO_COLUNA = ['M4 20.5h4', 'M10 20.5h4', 'M16 20.5h4'];
const densidade = (k) => [...COLUNAS.slice(0, k).flatMap((d) => [d, { d, cheio: true }]), ...CHAO_COLUNA.slice(k)];
const PESSOA = [circulo(9, 8, 3.25), 'M3.5 20c.6-3.4 3.1-5.25 6.5-5.25 1.2 0 2.3.2 3.2.7'];

registrarGlifos({
  // ------------------------------------------------------------ tipos de via (data/vias.js) e modos de traçado
  rua: ['M7 3.5v17', 'M17 3.5v17', 'M12 4v3M12 10.5v3M12 17v3'],
  ruaMao: ['M7 3.5v17', 'M17 3.5v17', 'M12 19V6.5', 'M9.25 9.25 12 6.5l2.75 2.75'],
  avenida: ['M5 3.5v17', 'M19 3.5v17', 'M11 3.5v17M13 3.5v17'],
  avenidaG: ['M3.5 3.5v17', 'M20.5 3.5v17', { d: 'M10.5 3.5h3v17h-3z', cheio: true }, 'M10.5 3.5v17M13.5 3.5v17', 'M7 4v3M7 10.5v3M7 17v3', 'M17 4v3M17 10.5v3M17 17v3'],
  // rua de terra: bordas irregulares e cascalho
  terra: ['M7 3.5c-.9 3-.9 6 0 8.5s.9 5.5 0 8.5', 'M17 3.5c.9 3 .9 6 0 8.5s-.9 5.5 0 8.5', ponto(11, 7), ponto(13.25, 11.75), ponto(10.75, 16.5)],
  // traçado: nós como anéis, o trecho entre eles
  reta: ['M7 17 17 7', circulo(5.5, 18.5, 2), circulo(18.5, 5.5, 2)],
  curva: ['M5.5 16.5C5.5 10 10 5.5 16.5 5.5', circulo(5.5, 18.5, 2), circulo(18.5, 5.5, 2)],
  continua: ['M4 18l3.26-3.26', circulo(8.5, 13.5, 1.75), 'M9.74 14.74l2.02 2.02', circulo(13, 18, 1.75), 'M14.24 16.76 20 11', 'M16.5 11H20v3.5'],
  grade: ['M3.5 8.5h17M3.5 15.5h17', 'M8.5 3.5v17M15.5 3.5v17'],
  // encaixe: ímã
  encaixe: ['M5.5 5v7.5a6.5 6.5 0 0 0 13 0V5', 'M10 5v7.5a2 2 0 0 0 4 0V5', 'M5.5 5H10M14 5h4.5', 'M5.5 9H10M14 9h4.5'],
  desfazer: ['M9 4.5 4.5 9 9 13.5', 'M4.5 9H14a5.5 5.5 0 0 1 0 11h-3.5'],
  refazer: ['M15 4.5 19.5 9 15 13.5', 'M19.5 9H10a5.5 5.5 0 0 0 0 11h3.5'],
  // construir: o muro de tijolos (o botão principal da barra da ferramenta)
  construir: [ret(3.5, 5, 17, 14, 1.5), 'M3.5 9.67h17M3.5 14.33h17', 'M9 5v4.67M15 5v4.67M6.25 9.67v4.66M12 9.67v4.66M17.75 9.67v4.66M9 14.33V19M15 14.33V19'],
  cancelar: [circulo(12, 12, 8.75), 'M9 9l6 6M15 9l-6 6'],
  // alça do traçado: arrastar em qualquer direção
  alca: ['M12 3.5v17M3.5 12h17', 'M9.5 6 12 3.5 14.5 6', 'M9.5 18 12 20.5 14.5 18', 'M6 9.5 3.5 12 6 14.5', 'M18 9.5 20.5 12 18 14.5'],
  ponte: ['M2.5 9h19', 'M4 9v11.5M20 9v11.5', 'M4 20.5a8 8 0 0 1 16 0', 'M8 9v4.5M12 9v3.5M16 9v4.5'],

  // ------------------------------------------------------------ pincel de zona e densidade
  // preencher a quadra: o balde de tinta (o "preencher" de todo editor; a quadra entre ruas lia igual à grade)
  preencher: [
    'M18 11.5 10.5 4 4.56 9.94a1.5 1.5 0 0 0 0 2.12l5.38 5.38a1.5 1.5 0 0 0 2.12 0z',
    { d: 'M5.5 13h11l-4.44 4.44a1.5 1.5 0 0 1-2.12 0z', cheio: true },
    'M5.5 13h11',
    'M5.5 3.5 9 7',
    'M21 18.75a1.75 1.75 0 1 1-3.5 0c0-1.4 1.45-2.1 1.75-3.5.3 1.4 1.75 2.1 1.75 3.5z',
  ],
  pincel: ['M20 4l-7.5 7.5', 'M10.75 10.25l3 3', 'M11.25 12.75c-2-.9-4.6 0-5.1 2.3-.3 1.5-.6 3-2.15 4.4 2.7.8 5.6.3 7-1.5.9-1.2 1.05-2.4.25-3.7'],
  retangulo: ['M4 7V5.5A1.5 1.5 0 0 1 5.5 4H7', 'M11 4h2', 'M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7', 'M20 11v2', 'M20 17v1.5a1.5 1.5 0 0 1-1.5 1.5H17', 'M13 20h-2', 'M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17', 'M4 13v-2'],
  // borracha
  apagar: ['M13.8 4.9a1.5 1.5 0 0 1 2.1 0l3.2 3.2a1.5 1.5 0 0 1 0 2.1L10.5 18.8H7.2l-2.3-2.3a1.5 1.5 0 0 1 0-2.1z', 'M8.5 10.2l5.3 5.3', 'M10.5 18.8h9'],
  // uso misto: moradia em cima, loja com toldo no térreo
  mista: ['M6 12.5V5A1.5 1.5 0 0 1 7.5 3.5h9A1.5 1.5 0 0 1 18 5v7.5', 'M6 15.5v5h12v-5', 'M4.5 12.5h15v.75a1.875 1.875 0 0 1-3.75 0 1.875 1.875 0 0 1-3.75 0 1.875 1.875 0 0 1-3.75 0 1.875 1.875 0 0 1-3.75 0z', 'M9.5 6.5H11M13 6.5h1.5M9.5 9.5H11M13 9.5h1.5', 'M10 20.5V17.5h4v3', 'M3.5 20.5h17'],
  densidade1: densidade(1),
  densidade2: densidade(2),
  densidade3: densidade(3),

  // ------------------------------------------------------------ serviços e divisões da Holding
  lixo: ['M4.5 6.5h15', 'M9.5 6.5V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v1.5', 'M6.5 6.5l1 13A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.4l1-13.1', 'M10 10.5V17M14 10.5V17'],
  // prefeitura: prédio com a bandeira
  administracao: ['M3.5 20.5h17', 'M5 20.5V11h14v9.5', 'M12 11V3.5', 'M12 4h5l-1.25 2L17 8h-5', 'M8.5 14v3.5M12 14v3.5M15.5 14v3.5'],
  comunicacao: ['M12 11.5v9', 'M8.5 20.5 12 11.5l3.5 9', 'M9.6 17h4.8', ponto(12, 8.5), 'M9.5 6a3.5 3.5 0 0 0 0 5M14.5 6a3.5 3.5 0 0 1 0 5', 'M7 3.5a7 7 0 0 0 0 10M17 3.5a7 7 0 0 1 0 10'],
  // transporte coletivo (M2): ônibus de frente
  transporte: [ret(5, 3.5, 14, 15.5, 2.5), 'M5 12h14', 'M9.5 6.5h5', 'M7.5 19v1.5M16.5 19v1.5', ponto(8.5, 15.5), ponto(15.5, 15.5)],
  imobiliario: [circulo(8, 16, 4), 'M10.9 13.1 19.5 4.5', 'M16.5 7.5l2.5 2.5', 'M14 10l2 2'],
  tecnologia: [ret(7, 7, 10, 10, 1.5), ret(10, 10, 4, 4, 0.5), 'M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5'],
  // mídia e imprensa: o jornal
  midia: ['M17.5 9h2.25a.75.75 0 0 1 .75.75v8.75a2 2 0 0 1-4 0V5A1.5 1.5 0 0 0 15 3.5H5A1.5 1.5 0 0 0 3.5 5v13.5a2 2 0 0 0 2 2h13', ret(6.5, 7, 7, 4.5, 0.5), 'M6.5 14.5h7M6.5 17.5h7'],
  hotelaria: ['M3.5 6.5v13', 'M3.5 15.5h17v4', 'M20.5 15.5v-3a2.5 2.5 0 0 0-2.5-2.5h-7.5v5.5', circulo(7, 12.25, 1.75)],
  aviacao: ['M12 3.5c.9 0 1.5.9 1.5 2V10l7 4v2l-7-2v4l2 1.5V21L12 20l-3.5 1v-1.5l2-1.5v-4l-7 2v-2l7-4V5.5c0-1.1.6-2 1.5-2z'],
  mapa: ['M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z', 'M9 4v13.5M15 6.5V20'],
  // recursos do subsolo: a picareta
  recursos: ['M9.5 4.9Q18.2 5.8 19.1 14.5', 'M4.5 19.5 16.25 7.75'],

  // ------------------------------------------------------------ avisos (forma e cor vêm da gravidade, 6.3)
  poucosClientes: [...PESSOA, 'M18 12.5V20', 'M15.5 17.5 18 20l2.5-2.5'],
  semMercadoria: ['M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z', 'M9 8V6.5a3 3 0 0 1 6 0V8', RISCO],
  semCreditos: [circulo(12, 12, 8.5), 'M10 9v6M14 9v6M10 12h4', RISCO],
  estoqueCheio: ['M3.5 20.5V9L12 4.5 20.5 9v11.5', 'M7 20.5v-4h10v4M12 16.5v4', 'M9.5 16.5v-4h5v4'],
  doenca: [circulo(12, 12, 5), 'M12 3.5V7M12 17v3.5M3.5 12H7M17 12h3.5', 'M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6', ponto(10.25, 11), ponto(13.5, 13.25)],
  // crime: a máscara
  crime: ['M3.5 9.5c2.6-1.4 5.5-2 8.5-2s5.9.6 8.5 2c0 3.6-1.5 6-4 6-1.9 0-2.9-1.8-4.5-1.8s-2.6 1.8-4.5 1.8c-2.5 0-4-2.4-4-6z', 'M7 11.25l2.5.75M17 11.25l-2.5.75'],
  incendio: [...CASA, 'M12 19.5a2.75 2.75 0 0 0 2.75-2.75c0-1.8-1.5-2.7-2.75-4.5-1.25 1.8-2.75 2.7-2.75 4.5A2.75 2.75 0 0 0 12 19.5z'],
  // trânsito parado: o carro de frente
  transito: ['M4.5 17.5v-5l2-5h11l2 5v5z', 'M4.5 12.5h15', 'M6.5 17.5v2H9v-2M15 17.5v2h2.5v-2', ponto(7.5, 15), ponto(16.5, 15)],

  // ------------------------------------------------------------ sistema
  objetivo: [circulo(12, 12, 8.75), circulo(12, 12, 5), ponto(12, 12)],
  filtro: ['M4 5h16l-6 7.5v5.5l-4 2.5v-8z'],
  vibracao: [ret(8, 4, 8, 16, 1.5), 'M5 9v6M19 9v6', 'M3 10.75v2.5M21 10.75v2.5'],
  telaCheia: ['M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9', 'M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9', 'M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15', 'M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15'],
  // carregar partida: a pasta
  carregar: ['M3.5 7A1.5 1.5 0 0 1 5 5.5h4.25l2 2H19A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z'],
  exportar: ['M12 14.5V3.5', 'M7.5 8 12 3.5 16.5 8', 'M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2'],
  compartilhar: ['M12 3.5v11', 'M8 7.5l4-4 4 4', 'M8.5 10.5H7A1.5 1.5 0 0 0 5.5 12v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5'],
  copiar: [ret(8.5, 8.5, 12, 12, 2), 'M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3'],
  teclado: [ret(2.5, 6, 19, 12, 2), 'M6 10h.5M9.5 10h.5M13.5 10h.5M17.5 10h.5M6 14h.5M17.5 14h.5', 'M9.5 14h5'],
  // girar o prédio ao colocar
  girar: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3l2.2 1.8', 'M19.5 4v4.5H15'],
  // o jogo é em paisagem
  girarCelular: [ret(3.5, 11, 17, 9, 1.5), 'M7 7.5a6.5 6.5 0 0 1 10 0', 'M17.25 4.25V7.5H14', ponto(17.5, 15.5)],
  editar: ['M15.5 4.5l4 4L9 19H5v-4z', 'M13 7l4 4'],
  // cor do prédio e da marca: a paleta
  cor: ['M12 3.5a8.5 8.5 0 0 0 0 17c1.5 0 2.2-1.1 1.7-2.4-.5-1.4.4-2.6 1.9-2.6h2.4a3 3 0 0 0 3-3C21 7.4 17 3.5 12 3.5z', circulo(7.75, 11.5, 1.1), circulo(9.75, 7.5, 1.1), circulo(14.5, 7.5, 1.1)],
  ajuda: [circulo(12, 12, 8.75), 'M9.5 9.5a2.5 2.5 0 0 1 4.9.6c0 1.7-2.4 2.1-2.4 3.9', ponto(12, 16.75)],
  sair: ['M9.5 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5h3.5', 'M15.5 16.5 20 12l-4.5-4.5', 'M20 12H9.5'],
});

/** Glifo do rosto do bem-estar pela faixa da tarifa (as faixas do dono: até 30, 31 a 60, 61 a 100). */
export const glifoBemEstar = (tarifa) => (tarifa >= 11 ? 'bemEstarBom' : tarifa >= 8 ? 'bemEstarMedio' : 'bemEstarRuim');
