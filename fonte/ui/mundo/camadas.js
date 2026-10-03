// Camadas de informação, o lado da interface (desenho da UI 8.12; D29; X3a), sem Preact (os testes importam no Node):
// a lista das camadas do M1a, as rampas (a skill de gráficos: sequencial de um tom para magnitude, divergente azul e
// vermelho com cinza no meio para cobertura e bem-estar, categórica para zonas, redes e recursos), o pedido ao render
// (R.camadas.mostrar) e o modelo da legenda (embaixo ao centro). Os dados vêm de q.camada(id) (contratos/camadas.js).
//
// O pedido ao render segue o que cada dono do desenho faz com min e max (render/sobreposicoes/camadas.js):
//   prédios (R4a: canal R = round((v - min) / (max - min) x 255)): na categórica, min 0 e max 255 (o R é o índice da
//     cor); na contínua, o min desce um degrau (o valor mínimo dá R = 1 e o "sem dado" abaixo dele, R = 0, fica neutro)
//   arestas (R3a) e células (R2a): o próprio dono reserva o 0; a categórica usa o valor como índice da cor (1 a 7)
//   grade (R2a): a contínua vai de 0 a 255; os recursos vão como categoria (o recurso que domina, 1 a 6)
// Na categórica, cores[k] é a cor do valor k (a cor 0 não aparece).

/** Camadas que o popover mostra, na ordem (D29: as 6 do M1a; o Valor do terreno entra quando a simulação tiver). */
export const CAMADAS_UI = Object.freeze([
  { id: 'zonas', glifo: 'zonas' },
  { id: 'bemEstar', glifo: 'bemEstarBom' },
  { id: 'agua', glifo: 'agua' },
  { id: 'energia', glifo: 'energia' },
  { id: 'servicos', glifo: 'servicos' },
  { id: 'recursos', glifo: 'recursos' },
  { id: 'valor', glifo: 'valuation' },
]);

/** Paleta das camadas (tokens da UI 4; a rampa sequencial é a --seq do desenho). */
export const PALETA = Object.freeze({
  seq: Object.freeze(['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']),
  // no mundo o meio é um cinza médio: o --divMeio do gráfico (#383835) viraria sombra no prédio iluminado
  div: Object.freeze({ ruim: '#e66767', meio: '#7d8188', bom: '#3987e5' }),
  divDaltonico: Object.freeze({ ruim: '#d95926', meio: '#7d8188', bom: '#3987e5' }),
  zonas: Object.freeze({
    resBaixa: '#3dbb8b', resMedia: '#199e70', resAlta: '#0f7353',
    comBaixa: '#62a3ef', comAlta: '#3987e5', escritorio: '#2a62b8', industria: '#c98500',
  }),
  // o produtor (captação, poço, usina) é o azul fundo da rede: o champanhe de antes ficava igual ao âmbar do racionado
  // sob a luz e em deuteranopia, e o champanhe é a cor da Holding nos marcadores
  rede: Object.freeze({ ok: '#3987e5', racionado: '#f2b14c', sem: '#e66767', produtor: '#184f95' }),
  recursos: Object.freeze({
    rocha: '#9aa3ad', areia: '#e0c48a', argila: '#c46a3c', calcario: '#ece6d6', fertil: '#7f8f3a', subterranea: '#4f9fd8',
  }),
  semDado: '#9a9ea4',
});

/** Ordem das zonas (data/zonas.js) e dos recursos (sim/mundo/recursos.js), pelo valor de cada categoria. */
export const ZONAS_POR_VALOR = ['', 'resBaixa', 'resMedia', 'resAlta', 'comBaixa', 'comAlta', 'escritorio', 'industria'];
export const RECURSOS_POR_VALOR = ['', 'rocha', 'areia', 'argila', 'calcario', 'fertil', 'subterranea'];
export const REDE_POR_VALOR = ['', 'ok', 'racionado', 'sem', 'produtor'];

// ------------------------------------------------------------------------------------------------ cores

const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const rgbHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Mistura duas cores hex (em sRGB, perto do que o olho vê numa rampa curta). */
export function misturar(a, b, t) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex(x.map((v, k) => v + (y[k] - v) * Math.min(1, Math.max(0, t))));
}

/** Rampa de n cores ao longo de uma lista de paradas (hex), igualmente espaçadas. */
export function rampa(paradas, n = 8) {
  if (paradas.length === 1) return Array.from({ length: n }, () => paradas[0]);
  return Array.from({ length: n }, (_, k) => {
    const x = (k / (n - 1)) * (paradas.length - 1);
    const i = Math.min(paradas.length - 2, Math.floor(x));
    return misturar(paradas[i], paradas[i + 1], x - i);
  });
}

/** Rampa divergente de n cores entre min e max, com o cinza no meio (no valor `meio`, não no centro da escala). */
export function rampaDivergente(min, max, meio, { ruim, meio: cinza, bom }, n = 8) {
  const m = Number.isFinite(meio) ? Math.min(max, Math.max(min, meio)) : (min + max) / 2;
  return Array.from({ length: n }, (_, k) => {
    const v = min + ((max - min) * k) / (n - 1);
    if (v <= m) return misturar(ruim, cinza, m > min ? (v - min) / (m - min) : 1);
    return misturar(cinza, bom, max > m ? (v - m) / (max - m) : 1);
  });
}

/** Luminância relativa (WCAG) de uma cor hex. */
export function luminancia(h) {
  const [r, g, b] = hexRgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre duas cores hex. */
export function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** O jeito de pintar uma camada pelos dados: 'cat' (categorias), 'div' (bom e ruim) ou 'seq' (magnitude). */
export function tipoDaRampa(d) {
  if (!d) return null;
  if (d.tipo === 'cat' || (d.id === 'recursos' && d.categoria)) return 'cat';
  if (d.tipo === 'div' || d.id === 'bemEstar' || d.id === 'servicos' || Number.isFinite(d.escala?.meio)) return 'div';
  return 'seq';
}

/**
 * Cores da camada: { cores: [hex], categorico, tipo }. Na categórica, cores[valor] (até 8); na contínua, 8 paradas do
 * mínimo ao máximo. op.daltonico troca o vermelho da divergente por laranja.
 */
export function paleta(d, { daltonico = false } = {}) {
  const tipo = tipoDaRampa(d);
  if (!tipo) return { cores: [], categorico: false, tipo: null };
  if (tipo === 'cat') {
    let nomes = null;
    let mapa = null;
    if (d.id === 'zonas') [nomes, mapa] = [ZONAS_POR_VALOR, PALETA.zonas];
    else if (d.id === 'recursos') [nomes, mapa] = [RECURSOS_POR_VALOR, PALETA.recursos];
    else if (d.id === 'agua' || d.id === 'energia' || d.id === 'esgoto') [nomes, mapa] = [REDE_POR_VALOR, PALETA.rede];
    if (nomes) return { cores: nomes.map((n, k) => (k ? mapa[n] : PALETA.semDado)).slice(0, 8), categorico: true, tipo };
    // categórica sem paleta própria (o Nível, da X3b): a sequencial do valor 1 ao último
    const n = Math.min(7, Math.max(1, (d.categorias ?? []).reduce((m, c) => Math.max(m, c.v), 1)));
    return { cores: [PALETA.semDado, ...rampa(PALETA.seq.slice(1), n)], categorico: true, tipo };
  }
  const { min, max } = escalaDe(d);
  if (tipo === 'div') return { cores: rampaDivergente(min, max, d.escala?.meio, daltonico ? PALETA.divDaltonico : PALETA.div), categorico: false, tipo };
  return { cores: rampa(PALETA.seq, 8), categorico: false, tipo };
}

/** Mínimo e máximo da escala (a da simulação; um intervalo vazio vira um de 1). */
export function escalaDe(d) {
  const min = Number.isFinite(d?.escala?.min) ? d.escala.min : 0;
  let max = Number.isFinite(d?.escala?.max) ? d.escala.max : 1;
  if (max <= min) max = min + 1;
  return { min, max };
}

/**
 * O pedido ao render (R.camadas.mostrar) a partir de q.camada(id): { id, fonte, dados, grade, cores, min, max,
 * categorico, porPredio? }. op: { daltonico, predios e celulas (do espelho: a Zonas e as camadas por aresta pintam
 * também o prédio) }. null sem dados.
 */
export function paraRender(d, op = {}) {
  if (!d?.dados) return null;
  const p = paleta(d, op);
  const base = { id: d.id, fonte: d.fonte, grade: d.grade ?? null, cores: p.cores, categorico: p.categorico };
  // recursos: a grade vai pela categoria (o recurso que domina)
  if (d.id === 'recursos' && d.categoria) return { ...base, dados: Float32Array.from(d.categoria), min: 0, max: 7, categorico: true };
  if (d.fonte === 'predios') {
    if (p.categorico) return { ...base, dados: d.dados, min: 0, max: 255 };
    const { min, max } = escalaDe(d);
    return { ...base, dados: d.dados, min: min - (max - min) / 254, max };
  }
  const { min, max } = p.categorico ? { min: 0, max: 7 } : escalaDe(d);
  const pedido = { ...base, dados: d.dados, min, max };
  // Zonas: além das células no chão, o prédio de zona pintado pela zona dele (o CS2 pinta os dois); camada por aresta
  // (Serviços): o prédio leva o valor da rua da frente, e a camada se lê também de longe, onde a via é só pintura
  if (d.id === 'zonas' && op.predios?.n) pedido.porPredio = { dados: zonasDosPredios(op.predios), categorico: true };
  else if (d.fonte === 'arestas' && op.predios?.n && op.celulas?.n) pedido.porPredio = { dados: valorDaRua(op.predios, op.celulas, d.dados), categorico: p.categorico, min, max };
  return pedido;
}

/** Valor da aresta da frente de cada prédio (pela célula da linha 0 dele), ou NaN sem rua. */
export function valorDaRua(P, C, porAresta) {
  const dados = new Float32Array(P.n).fill(NaN);
  for (let c = 0; c < C.n; c++) {
    const i = C.predio[c];
    if (!C.viva[c] || i < 0 || i >= P.n || C.linha[c] !== 0 || !Number.isNaN(dados[i])) continue;
    const e = C.aresta[c];
    if (e >= 0 && e < porAresta.length) dados[i] = porAresta[e];
  }
  return dados;
}

/** A zona de cada prédio (0 nos serviços e na Holding), para pintar o prédio na camada Zonas. */
export function zonasDosPredios(P) {
  const dados = new Float32Array(P.n);
  for (let i = 0; i < P.n; i++) if (P.viva[i] && (P.tipo?.[i] ?? 0) === 0) dados[i] = P.zona[i];
  return dados;
}

/**
 * Valor do canal R da tabela de prédios que a R4a escreve para um valor da camada (a mesma conta de predios.js), para
 * os testes: 0 é "sem dado".
 */
export function valorNaTabela(pedido, v) {
  const t = (v - pedido.min) / (pedido.max - pedido.min || 1);
  const r = Math.round(t * 255);
  return Number.isFinite(r) ? Math.max(0, Math.min(255, r)) : 0;
}

// ------------------------------------------------------------------------------------------------ legenda

const curto = (s) => typeof s === 'string' && s.length <= 18;

/** Parâmetros do resumo que são dinheiro em unidades de desenho (a Contribuição do bem-estar): vão em dólar (D68, D87). */
export const PARAMS_DINHEIRO = Object.freeze(['tarifa']);

/**
 * Modelo da legenda (puro): { id, titulo, tipo: 'cat' | 'seq' | 'div', itens: [{ cor, texto }] (categórica),
 * gradiente (CSS), pontas: [texto do mínimo, texto do máximo], marcas: [{ pos (0 a 1), texto, dica }], resumo, extra }.
 * t: a função de textos; num: o formatador de números (fmt.numero); dinheiro: o de dinheiro (fmt.dinheiro, para os
 * PARAMS_DINHEIRO); extra: linha a mais (obras paradas na Recursos).
 */
export function modeloLegenda(d, { t, num = (n) => String(n), dinheiro = null, daltonico = false, extra = null } = {}) {
  if (!d) return null;
  const p = paleta(d, { daltonico });
  const titulo = t(`camada.${d.id}`);
  const resumo = d.resumo?.chave ? t(d.resumo.chave, formatarParams(d.resumo.params, num, dinheiro)) : '';
  if (p.categorico) {
    const lista = (d.legenda?.length ? d.legenda : d.categorias ?? []).filter((c) => c.v > 0 && c.v < p.cores.length);
    return { id: d.id, titulo, tipo: 'cat', itens: lista.map((c) => ({ cor: p.cores[c.v], texto: t(c.chave) })), resumo, extra };
  }
  const { min, max } = escalaDe(d);
  const un = d.escala?.unidade ?? '';
  const pct = un === '%' && max <= 1;
  const valor = (v) => (pct ? `${num(Math.round(v * 100))}%` : `${num(v)}${un && un !== '%' ? ` ${un}` : un}`);
  const pontas = [valor(min), valor(max)];
  const marcas = [];
  for (const m of d.legenda ?? []) {
    const pos = (m.v - min) / (max - min);
    const texto = t(m.chave);
    // um texto curto na ponta troca o número dela; os do meio viram marcas com o número e a frase na dica
    if (pos <= 0.001 && curto(texto)) pontas[0] = texto;
    else if (pos >= 0.999 && curto(texto)) pontas[1] = texto;
    else if (pos > 0.001 && pos < 0.999) marcas.push({ pos, texto: valor(m.v), dica: texto });
  }
  const paradas = p.cores.map((c, k) => `${c} ${Math.round((100 * k) / (p.cores.length - 1))}%`);
  return { id: d.id, titulo, tipo: p.tipo, gradiente: `linear-gradient(90deg, ${paradas.join(', ')})`, pontas, marcas, resumo, extra };
}

/** Números dos parâmetros do resumo formatados em pt-BR (inteiros; o dinheiro em dólar; o resto como veio). */
function formatarParams(params, num, dinheiro) {
  const out = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v !== 'number' || !Number.isFinite(v)) out[k] = v;
    else out[k] = dinheiro && PARAMS_DINHEIRO.includes(k) ? dinheiro(v) : num(Math.round(v));
  }
  return out;
}
