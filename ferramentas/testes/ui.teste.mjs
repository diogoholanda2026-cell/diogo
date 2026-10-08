// Testes da U1a (pele da interface), sem navegador: glifos (só caminhos, dentro da grade, todo nome usado existe),
// contraste dos tokens sobre o pior fundo (vidro sobre céu branco), textos da U1a (chaves usadas existem, nada
// proibido pela D42), as regras de leitura da barra de cima (margem do bem-estar, faixas, marco, calendário), do
// cartão (números por tipo, aviso mais grave, fase da obra) e da Economia (linha da regra da contribuição, limites do
// empréstimo, orçamento), a escala dos gráficos e a ordenação da tabela, e o CSS (sem desfoque; animação só com
// transform e opacity). Roda sozinho: node ferramentas/testes/ui.teste.mjs (o simular --testes descobre).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fonte = (p) => join(RAIZ, 'fonte', p);
const ler = (p) => readFileSync(fonte(p), 'utf8');

// arquivos da U1a (seção 3.1)
const ARQ_U1 = [
  'ui/hud/BarraCima.jsx',
  'ui/selecao/Cartao.jsx',
  'ui/telas/Economia.jsx',
  ...readdirSync(fonte('ui/comp')).filter((f) => f.endsWith('.jsx')).map((f) => `ui/comp/${f}`),
];

// um pacote só com a interface (JSX pelo esbuild, como na montagem): os módulos, os textos e os glifos na mesma instância
let pacote = null;
async function ui() {
  if (pacote) return pacote;
  const { build } = await import('esbuild');
  const abs = (p) => JSON.stringify(fonte(p));
  const entrada = `
    export * as barra from ${abs('ui/hud/BarraCima.jsx')};
    export * as cartao from ${abs('ui/selecao/Cartao.jsx')};
    export * as economia from ${abs('ui/telas/Economia.jsx')};
    export * as grafico from ${abs('ui/comp/Grafico.jsx')};
    export * as tabela from ${abs('ui/comp/Tabela.jsx')};
    export * as quantidade from ${abs('ui/comp/Quantidade.jsx')};
    export * as textos from ${abs('ui/textos.js')};
    export * as glifos from ${abs('ui/glifos/glifos.js')};
    export * as loja from ${abs('ui/loja.js')};
  `;
  const r = await build({
    stdin: { contents: entrada, resolveDir: RAIZ, loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node',
    logLevel: 'silent', jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  pacote = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return pacote;
}

// ------------------------------------------------------------------------------------------------ glifos

// caixa de um caminho SVG, amostrando curvas e arcos (conversão do arco para o centro, SVG 1.1 F.6.5)
function caixaDoCaminho(d) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e-?\d+)?/g) ?? [];
  let i = 0, cmd = null, x = 0, y = 0, x0 = 0, y0 = 0, cx = 0, cy = 0;
  const pts = [];
  const num = () => Number(tok[i++]);
  const add = (a, b) => pts.push([a, b]);
  const cubica = (p0, p1, p2, p3) => {
    for (let k = 0; k <= 16; k++) {
      const t = k / 16, u = 1 - t;
      add(u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]);
    }
  };
  const arco = (x1, y1, rx, ry, fi, fa, fs, x2, y2) => {
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (!rx || !ry) return add(x2, y2);
    const c = Math.cos((fi * Math.PI) / 180), s = Math.sin((fi * Math.PI) / 180);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const xp = c * dx + s * dy, yp = -s * dx + c * dy;
    const l = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
    const num2 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const coef = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num2 / (rx * rx * yp * yp + ry * ry * xp * xp)));
    const cxp = (coef * rx * yp) / ry, cyp = (-coef * ry * xp) / rx;
    const ccx = c * cxp - s * cyp + (x1 + x2) / 2, ccy = s * cxp + c * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI;
    if (fs && dt < 0) dt += 2 * Math.PI;
    for (let k = 0; k <= 32; k++) {
      const a = t1 + (dt * k) / 32;
      add(ccx + rx * Math.cos(a) * c - ry * Math.sin(a) * s, ccy + rx * Math.cos(a) * s + ry * Math.sin(a) * c);
    }
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const bx = rel ? x : 0, by = rel ? y : 0;
    if (C === 'Z') { x = x0; y = y0; add(x, y); continue; }
    if (C === 'M') { x = bx + num(); y = by + num(); x0 = x; y0 = y; add(x, y); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { x = bx + num(); y = by + num(); add(x, y); }
    else if (C === 'H') { x = bx + num(); add(x, y); }
    else if (C === 'V') { y = (rel ? y : 0) + num(); add(x, y); }
    else if (C === 'C') { const p1 = [bx + num(), by + num()], p2 = [bx + num(), by + num()], p3 = [bx + num(), by + num()]; cubica([x, y], p1, p2, p3); cx = p2[0]; cy = p2[1]; [x, y] = p3; }
    else if (C === 'S') { const p1 = [2 * x - cx, 2 * y - cy], p2 = [bx + num(), by + num()], p3 = [bx + num(), by + num()]; cubica([x, y], p1, p2, p3); cx = p2[0]; cy = p2[1]; [x, y] = p3; }
    else if (C === 'Q') { const q = [bx + num(), by + num()], p3 = [bx + num(), by + num()]; cubica([x, y], [x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y)], [p3[0] + (2 / 3) * (q[0] - p3[0]), p3[1] + (2 / 3) * (q[1] - p3[1])], p3); [x, y] = p3; }
    else if (C === 'A') { const rx = num(), ry = num(), fi = num(), fa = num(), fs = num(), x2 = bx + num(), y2 = by + num(); arco(x, y, rx, ry, fi, fa, fs, x2, y2); x = x2; y = y2; }
    else throw new Error(`comando ${cmd} em ${d}`);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), pts };
}

// o conjunto do M1 (desenho da UI 6.2) que as outras parcelas de interface usam sem desenhar o seu
const CONJUNTO_M1 = {
  estado: ['holding', 'creditos', 'renda', 'populacao', 'bemEstarBom', 'bemEstarMedio', 'bemEstarRuim', 'demanda', 'marco', 'calendario', 'sol', 'solNascente', 'solBaixo', 'lua', 'nuvem'],
  tempo: ['pausa', 'vel1', 'vel2', 'vel3', 'relogio', 'prazo'],
  construcao: ['vias', 'zonas', 'servicos', 'transporte', 'lazer', 'empresas', 'arcologia', 'demolir', 'obra'],
  vias: ['rua', 'ruaMao', 'avenida', 'avenidaG', 'terra', 'reta', 'curva', 'continua', 'grade', 'encaixe', 'desfazer', 'refazer', 'construir', 'cancelar', 'alca', 'ponte'],
  zonas: ['preencher', 'pincel', 'retangulo', 'apagar', 'residencial', 'comercial', 'industrial', 'escritorio', 'mista', 'densidade1', 'densidade2', 'densidade3'],
  servicos: ['agua', 'esgoto', 'energia', 'lixo', 'saude', 'educacao', 'policia', 'bombeiros', 'administracao', 'comunicacao', 'parque', 'praca'],
  holding: ['imobiliario', 'tecnologia', 'midia', 'hotelaria', 'aviacao', 'caminhao', 'dinheiro', 'influencia', 'legado', 'valuation', 'deposito', 'lote', 'material', 'mapa', 'recursos'],
  avisos: ['alerta', 'semVia', 'semEnergia', 'semAgua', 'semTrabalhadores', 'poucosClientes', 'semMercadoria', 'abandonado', 'semMaterial', 'semCreditos', 'estoqueCheio', 'doenca', 'crime', 'incendio', 'transito'],
  sistema: ['camadas', 'mural', 'foto', 'menu', 'ajustes', 'conselho', 'localizar', 'info', 'fechar', 'voltar', 'setaDir', 'setaCima', 'setaBaixo', 'mais', 'menos', 'cadeado', 'check', 'filtro', 'tabela', 'grafico', 'som', 'vibracao', 'telaCheia', 'salvar', 'carregar', 'exportar', 'importar', 'compartilhar', 'copiar', 'teclado', 'olho', 'girar', 'girarCelular', 'editar', 'cor', 'ajuda', 'sair', 'objetivo'],
};

test('glifos: o conjunto do M1 (130 ou mais, desenho da UI 6.2), só caminhos, dentro da grade de 24 com folga para o traço', async () => {
  const { glifos } = await ui();
  const nomes = glifos.nomesGlifos();
  assert.ok(nomes.length >= 130, `${nomes.length} glifos`);
  const faltam = Object.values(CONJUNTO_M1).flat().filter((n) => !glifos.glifo(n));
  assert.deepEqual(faltam, [], 'glifos do conjunto do M1');
  for (const n of nomes) {
    const g = glifos.glifo(n);
    assert.ok(g.tracos.length || g.cheios.length, `glifo vazio: ${n}`);
    for (const d of [...g.tracos, ...g.cheios]) {
      assert.match(d, /^[MmLlHhVvCcSsQqAaZz0-9 .,\-e]+$/, `${n}: ${d}`);
      const c = caixaDoCaminho(d);
      assert.ok(c.x0 >= 1.5 && c.y0 >= 1.5 && c.x1 <= 22.5 && c.y1 <= 22.5, `${n} sai da grade: ${JSON.stringify(c)} em ${d}`);
    }
  }
});

test('glifos: todo nome usado pela U1a existe (barra, cartão, Economia, primitivas)', async () => {
  const { glifos, barra } = await ui();
  const usados = new Set(Object.values(barra.GLIFO_FASE));
  for (const f of ARQ_U1) {
    const src = ler(f);
    for (const m of src.matchAll(/\b(?:n|glifo)=["'](\w+)["']/g)) usados.add(m[1]);
    for (const m of src.matchAll(/\bglifo: '(\w+)'/g)) usados.add(m[1]);
    for (const m of src.matchAll(/\['\w+', '(\w+)'\]/g)) usados.add(m[1]);
    for (const bloco of src.matchAll(/const GLIFO_\w+ = (?:Object\.freeze\()?\{([^}]*)\}/g)) for (const m of bloco[1].matchAll(/:\s*'(\w+)'/g)) usados.add(m[1]);
    for (const m of src.matchAll(/\bn=\{[^}]*?'(\w+)'\s*:\s*'(\w+)'/g)) { usados.add(m[1]); usados.add(m[2]); }
  }
  const faltam = [...usados].filter((n) => !glifos.glifo(n));
  assert.deepEqual(faltam, []);
  assert.ok(usados.size > 40, `${usados.size} glifos usados`);
});

// ------------------------------------------------------------------------------------------------ tokens

function tokens() {
  const css = ler('ui/tema/tokens.css');
  const raiz = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  return Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const cor = (s) => {
  const h = s.match(/^#([0-9a-f]{6})$/i);
  if (h) return [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16), 1];
  const r = s.match(/rgba?\(([^)]+)\)/);
  const p = r[1].split(',').map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const sobre = (fundo, c) => [0, 1, 2].map((k) => c[3] * c[k] + (1 - c[3]) * fundo[k]);
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const razao = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('tokens: texto sobre o vidro no pior fundo (céu branco) passa de 4,5:1; cor de estado e champanhe inclusive', () => {
  const T = tokens();
  const branco = [255, 255, 255];
  const s0 = sobre(branco, cor(T.s0));
  const s1 = sobre(branco, cor(T.s1));
  const s3sobreS0 = sobre(s0, cor(T.s3)); // segmento ligado
  for (const [nome, fundo] of [['s0', s0], ['s1', s1]]) {
    for (const tx of ['t1', 't2', 'ac', 'ch', 'ok', 'al', 'er']) {
      const k = razao(sobre(fundo, cor(T[tx])), fundo);
      assert.ok(k >= 4.5, `--${tx} sobre --${nome} (céu branco atrás): ${k.toFixed(2)}:1`);
    }
  }
  assert.ok(razao(cor(T.t1), s3sobreS0) >= 4.5, 'texto principal no segmento ligado');
  assert.ok(razao(cor(T.tinv), cor(T.ac)) >= 4.5, 'botão primário');
  assert.ok(razao(cor(T.tinv), cor(T.ch)) >= 4.5, 'selo champanhe');
  // o texto terciário é só para glifo apagado, nunca para texto de informação (fica abaixo de 4,5)
  assert.ok(razao(sobre(s0, cor(T.t3)), s0) < 4.5);
});

// ------------------------------------------------------------------------------------------------ textos

test('textos da U1a: as chaves usadas existem, as dinâmicas cobrem cada caso, nada proibido (D42)', async () => {
  const { textos } = await ui();
  const { verificarConteudo } = await import('../guarda-texto.mjs');
  const faltam = [];
  for (const f of ARQ_U1) {
    for (const m of ler(f).matchAll(/\bt\(\s*'([^']+)'/g)) if (!textos.temTexto(m[1])) faltam.push(`${f}: ${m[1]}`);
  }
  const dinamicas = [
    ...['holding', 'economia', 'cidade', 'progresso', 'conselho'].map((id) => `barra.tela.${id}`),
    ...['progresso', 'cidade'].map((id) => `barra.ver.${id}`),
    ...['R', 'C', 'I', 'E'].map((z) => `barra.demanda.${z}`),
    ...[0, 1, 2, 3].map((v) => `vel.${v}`),
    'barra.marco.requisito.torre.e4',
    ...['canteiro', 'fundacao', 'estrutura', 'fechamento'].map((f) => `cartao.obra.${f}`),
    ...['grave', 'atencao', 'info', 'holding'].map((g) => `cartao.aviso.${g}`),
    ...['moradores', 'cidade', 'deposito', 'marcos'].map((id) => `eco.rec.${id}`),
    ...['servicos', 'vias', 'ligacao', 'salarios', 'juros', 'importacao', 'importacaoCidade'].map((id) => `eco.des.${id}`),
    ...['servicos', 'salarios'].flatMap((id) => [`eco.naoPago.${id}`, `eco.naoPago.${id}.efeito`]),
    ...['ano', 'divida'].map((m) => `eco.bloqueio.${m}`),
    ...['orcamento', 'emprestimo'].map((a) => `eco.aba.${a}`),
  ];
  for (const k of dinamicas) if (!textos.temTexto(k)) faltam.push(k);
  assert.deepEqual(faltam, []);
  const doU1 = readFileSync(fonte('ui/textos/u1.js'), 'utf8');
  for (const m of doU1.matchAll(/^\s*'([\w.]+)':/gm)) {
    const falhas = verificarConteudo(textos.t(m[1]), ['travessao', 'aluguel', 'porDia', 'dia'], { js: false });
    assert.deepEqual(falhas, [], `${m[1]}: ${textos.t(m[1])}`);
  }
  assert.deepEqual(textos.chavesRepetidas(), []);
});

// ------------------------------------------------------------------------------------------------ barra de cima

test('barra: margem do bem-estar até o degrau (D11), âmbar abaixo de 63; faixas da regra do dono', async () => {
  const { barra } = await ui();
  assert.deepEqual(barra.textoMargem({ bemEstarTarifa: 64, margem: { degrau: 61, delta: 3 } }), { texto: '+3 acima de 61', estado: null });
  assert.deepEqual(barra.textoMargem({ bemEstarTarifa: 62, margem: { degrau: 61, delta: 1 } }), { texto: '+1 acima de 61', estado: 'al' });
  assert.equal(barra.textoMargem({ bemEstarTarifa: 63, margem: { degrau: 61, delta: 2 } }).estado, null, '63 já não é âmbar');
  assert.equal(barra.textoMargem({ bemEstarTarifa: 25, margem: { degrau: null, delta: null } }).texto, 'faltam 6 para 31');
  assert.equal(barra.textoMargem({ bemEstarTarifa: 80, margem: { degrau: null, delta: null } }).texto, 'faixa mais alta');
  const f = barra.faixasTarifa(8);
  assert.deepEqual(f.map((x) => [x.de, x.ate, x.tarifa, x.atual]), [[0, 30, 5, false], [31, 60, 8, true], [61, 100, 11, false]]);
  // cidade vazia (partida nova): sem rosto triste nem "faltam 31"; bem-estar sem número vale 0, nunca "NaN"
  assert.deepEqual(barra.textoMargem({ populacao: 0, bemEstarTarifa: 0, margem: { degrau: null, delta: null } }), { texto: 'sem moradores', estado: null });
  assert.equal(barra.bemDaBarra({ bemEstarTarifa: NaN }), 0);
  assert.equal(barra.bemDaBarra({ bemEstar: 63.6 }), 64);
  assert.equal(barra.textoMargem({ populacao: 10, bemEstarTarifa: NaN, margem: { degrau: null, delta: null } }).texto, 'faltam 31 para 31');
  assert.equal(barra.textoMargem({ populacao: 10, bemEstarTarifa: 62, margem: { degrau: 61, delta: NaN } }).texto, '+1 acima de 61');
});

test('barra: anel do marco, ano novo em tiques, zonas da demanda (E só no M1b), um glifo por fase do céu', async () => {
  const { barra } = await ui();
  assert.equal(barra.fracaoMarco({ xp: 9120, xpIni: 8000, xpProx: 15000 }), 0.16);
  assert.equal(barra.fracaoMarco({ xp: 50000, xpIni: 38000, xpProx: null }), 1);
  assert.equal(barra.fracaoMarco({ xp: 100, xpIni: 400, xpProx: 1500 }), 0);
  assert.equal(barra.tiquesAteAno({ mes: 12, fracMes: 0.5 }), 300);
  assert.equal(barra.tiquesAteAno({ mes: 1, fracMes: 0 }), 7200);
  assert.deepEqual(barra.zonasDemanda({ R: 1, C: 2, I: 3, E: 0 }), ['R', 'C', 'I']);
  assert.deepEqual(barra.zonasDemanda({ R: 1, C: 2, I: 3, E: 40 }), ['R', 'C', 'I', 'E']);
  assert.equal(new Set(Object.values(barra.GLIFO_FASE)).size, 4);
});

// ------------------------------------------------------------------------------------------------ cartão

test('cartão: números por tipo (Contribuição em /h, nunca Aluguel), aviso mais grave, obra e aparência', async () => {
  const { cartao } = await ui();
  const res = {
    tipo: 'zona', zona: 2, nivel: 3, estado: 'ok',
    moradia: { moradores: 84, capacidade: 96, bemEstar: 71.4, tarifa: 11, contribuicaoHora: 924 },
    avisos: [{ codigo: 'semEsgoto', gravidade: 'atencao', desde: 100 }, { codigo: 'semEnergia', gravidade: 'grave', desde: 400 }],
  };
  const n = cartao.numerosDoCartao(res);
  // dinheiro em dólar (D87): 924 unidades por hora = US$ 554 mil por hora
  assert.deepEqual(n.map((x) => [x.id, x.valor]), [['moradores', '84 de 96'], ['bemEstar', '71'], ['contribuicao', '+US$ 554 mil/h']]);
  assert.equal(cartao.subtitulo(res), 'Residencial média · nível 3 de 5');
  assert.equal(cartao.aparencia(res).glifo, 'residencial');
  const a = cartao.avisoPrincipal(res, 400 + 3 * 60 + 5);
  assert.equal(a.gravidade, 'grave');
  assert.equal(a.texto, 'Sem energia');
  assert.equal(a.sub, 'há 3 min de jogo');
  assert.equal(a.mais, 1);
  const serv = { tipo: 'servico', estado: 'ok', servico: { categoria: 'saude', capacidade: 800, uso: 620, eficiencia: 0.74, alcance: 600, manutencaoHora: 400 } };
  assert.deepEqual(cartao.numerosDoCartao(serv).map((x) => [x.id, x.valor, x.estado ?? null]), [['atendidos', '620 de 800', null], ['eficiencia', '74%', 'al'], ['manutencao', '−US$ 240 mil/h', null]]);
  assert.equal(cartao.subtitulo(serv), 'Saúde · alcance de 600 m');
  assert.equal(cartao.aparencia(serv).glifo, 'saude');
  const ind = { tipo: 'zona', zona: 7, nivel: 2, trabalho: { vagas: [10, 8, 4, 1], ocupadas: [10, 6, 3, 0], produtividade: 0.92 } };
  assert.deepEqual(cartao.numerosDoCartao(ind).map((x) => x.valor), ['19 de 23', '92%', '2 de 5']);
  assert.equal(cartao.aparencia(ind).glifo, 'industrial');
  assert.equal(cartao.avisoPrincipal({ estado: 'abandonado', avisos: [] }).texto, 'Abandonado');
  assert.equal(cartao.avisoPrincipal({ avisos: [{ codigo: 'desconhecido', gravidade: 'grave' }] }).texto, 'Problema grave neste prédio');
  assert.equal(cartao.faseDaObra({ progresso: 0.3 }).nome, 'estrutura');
  assert.equal(cartao.faseDaObra({ progresso: 1 }).nome, 'fechamento');
  for (const p of [res, serv, ind]) for (const x of cartao.numerosDoCartao(p)) assert.doesNotMatch(`${x.rotulo} ${x.valor}`, /aluguel|\/dia/i);
  // prédio vazio: bem-estar sem número vira 0 (e o rosto da faixa de baixo), nunca "NaN"
  const vazio = cartao.numerosDoCartao({ ...res, moradia: { moradores: 0, capacidade: 8, bemEstar: NaN, contribuicaoHora: 0 } });
  assert.deepEqual(vazio.map((x) => x.valor), ['0 de 8', '0', 'US$ 0/h']);
  // glifo do aviso: o código que já é nome de glifo usa o próprio; os outros pela tabela; desconhecido, o alerta
  const glifoDe = (codigo) => cartao.avisoPrincipal({ avisos: [{ codigo, gravidade: 'atencao' }] }).glifo;
  assert.deepEqual(['transito', 'semEsgoto', 'caixaZerado', 'semAgua', 'outraCoisa'].map(glifoDe), ['transito', 'esgoto', 'semCreditos', 'semAgua', 'alerta']);
  // obra com dado torto não derruba o cartão (o find sem fase lançava e levava a interface junto)
  assert.deepEqual(cartao.faseDaObra({ progresso: NaN }), { nome: 'canteiro', frac: 0 });
  assert.equal(cartao.faseDaObra({ fase: 'estrutura' }).nome, 'estrutura');
  assert.equal(cartao.faseDaObra({ fase: 0.3 }).nome, 'estrutura');
  assert.equal(cartao.faseDaObra({ fase: 'estrutura', progresso: 0.8 }).nome, 'fechamento', 'o progresso manda');
  // o tipo do q.predio não tem forma fixa no contrato: o bloco servico decide (nunca o glifo residencial da zona 0)
  assert.equal(cartao.aparencia({ tipo: 1, zona: 0, servico: { capacidade: 10 } }).familia, 'servico');
  assert.equal(cartao.aparencia({ tipo: 2, zona: 0, holding: { nivel: 1 } }).glifo, 'holding');
  // o contrato do q.predio não tem categoria: o tipo do catálogo (data/servicos.js) diz o glifo e o nome
  const clinica = { tipo: 'clinica', zona: 0, servico: { capacidade: 8000, uso: 10, eficiencia: 1, alcance: 1200, manutencaoHora: 700 } };
  assert.equal(cartao.aparencia(clinica).glifo, 'saude');
  assert.equal(cartao.subtitulo(clinica), 'Saúde · alcance de 1.200 m');
  assert.deepEqual(['poco', 'ete', 'solar', 'escolaM', 'delegacia', 'parqueG'].map((tipo) => cartao.aparencia({ tipo, servico: {} }).glifo), ['agua', 'esgoto', 'energia', 'educacao', 'policia', 'parque']);
  assert.equal(cartao.subtitulo({ tipo: 'novoServico', servico: { alcance: 0 } }), 'Serviço', 'tipo novo sem categoria: o nome genérico');
  assert.equal(cartao.numerosDoCartao({ ...ind, nivel: NaN }).at(-1).valor, '1 de 5');
  // prédio da Holding sem o bloco trabalho: os números vêm do bloco holding (antes a faixa ficava vazia)
  const conc = { tipo: 'holding', nivel: 2, holding: { nivel: 2, vagas: [4, 6, 2, 0], ocupadas: [4, 5, 1, 0], linhas: [{ item: 'concreto', parada: false }, { item: 'brita', parada: true }] } };
  assert.deepEqual(cartao.numerosDoCartao(conc).map((x) => [x.id, x.valor, x.estado ?? null]), [['trabalhadores', '10 de 12', null], ['linhas', '1 de 2', 'al'], ['nivel', '2 de 5', null]]);
  assert.deepEqual(cartao.numerosDoCartao({ tipo: 'holding', holding: { vagas: 8, ocupadas: NaN } }).map((x) => x.valor), ['0 de 8', '0 de 0', '1 de 5']);
});

// ------------------------------------------------------------------------------------------------ Economia

test('Economia: a linha da regra "Contribuição: 12.480 × US$ 6.600 = US$ 82,4 mi/h" com a simulação falsa; média quando não fecha', async () => {
  const { economia } = await ui();
  const { criarSimFalsa } = await import('../vitrine/sim-falsa.js');
  const sim = criarSimFalsa({ cenario: 'meio' });
  const b = sim.q.barra();
  const orc = sim.q.orcamento();
  assert.equal(economia.regraContribuicao(b.populacao, b.tarifa, orc.receitas.moradores), 'Contribuição: 12.480 × US$ 6.600 = US$ 82,4 mi/h');
  assert.equal(economia.regraContribuicao(1000, 11, 9000), 'Média de US$ 5.400 por morador: US$ 5,4 mi/h');
  const { receitas, despesas, naoPago } = economia.linhasOrcamento(orc);
  assert.equal(receitas.linhas[0].id, 'moradores');
  assert.equal(receitas.linhas[0].rotulo, 'Contribuição dos moradores');
  assert.equal(receitas.total, 137280 + 18400 + 2100);
  assert.equal(despesas.linhas.length, 7);
  assert.ok(Math.abs(receitas.linhas.reduce((s, l) => s + l.frac, 0) - 1) < 1e-9);
  assert.deepEqual(naoPago, []);
  assert.deepEqual(economia.linhasOrcamento({ ...orc, naoPago: { servicos: 1200, salarios: 0 } }).naoPago, [{ id: 'servicos', valor: 1200 }]);
  assert.deepEqual(economia.faixaPelaTarifa(8), { de: 31, ate: 60, tarifa: 8 });
  // campo sem número ou que falta não estraga o total; não pago sem frase não aparece como '??chave'
  const torto = economia.linhasOrcamento({ receitas: { moradores: NaN, cidade: 100 }, despesas: { vias: -5 }, naoPago: { outra: 5, servicos: 7 } });
  assert.equal(torto.receitas.total, 100);
  assert.equal(torto.despesas.total, 0);
  assert.deepEqual(torto.naoPago, [{ id: 'servicos', valor: 7 }]);
  // os gráficos mostram só os últimos 12 meses da série (a simulação guarda até 240)
  const longa = Array.from({ length: 30 }, (_, i) => ({ mes: (i % 12) + 1, caixa: i }));
  assert.deepEqual(economia.serieDoAno(longa).map((p) => p.caixa), Array.from({ length: 12 }, (_, i) => 18 + i));
  assert.deepEqual(economia.serieDoAno(undefined), []);
});

test('Economia: limites do empréstimo pela regra do dono (passo, ano, dívida com juros devidos)', async () => {
  const { economia } = await ui();
  const base = { disponivelAno: 50000, divida: 0, dividaMax: 500000, jurosDevidos: 0 };
  assert.deepEqual(economia.limitesEmprestimo(base), { min: 1000, max: 50000, passo: 1000, motivo: null });
  assert.equal(economia.limitesEmprestimo({ ...base, disponivelAno: 10500 }).max, 10000);
  assert.equal(economia.limitesEmprestimo({ ...base, divida: 495000, jurosDevidos: 1500 }).max, 3000);
  assert.equal(economia.limitesEmprestimo({ ...base, disponivelAno: 500 }).motivo, 'ano');
  assert.equal(economia.limitesEmprestimo({ ...base, divida: 499500 }).motivo, 'divida');
  // número torto fecha o empréstimo (nunca um deslizante com teto NaN); campo que falta vale o padrão
  assert.deepEqual(economia.limitesEmprestimo({ ...base, disponivelAno: NaN }), { min: 1000, max: 0, passo: 1000, motivo: 'ano' });
  assert.equal(economia.limitesEmprestimo({ ...base, divida: NaN }).motivo, 'divida');
  assert.equal(economia.limitesEmprestimo({ disponivelAno: 50000 }).max, 50000);
  // o eixo dos gráficos também em dólar (D87)
  assert.equal(economia.curto(150000), 'US$ 90 mi');
  assert.equal(economia.curto(2500), 'US$ 1,5 mi');
  assert.equal(economia.curto(1.26e6), 'US$ 756 mi');
  assert.equal(economia.curto(-40000), '−US$ 24 mi');
});

// ------------------------------------------------------------------------------------------------ primitivas

test('gráfico: escala com o zero e passos redondos; tabela ordena números e texto; quantidade presa de 1 a 10', async () => {
  const { grafico, tabela, quantidade } = await ui();
  assert.equal(grafico.passoRedondo(180000, 3), 100000);
  assert.equal(grafico.passoRedondo(9, 3), 5);
  assert.deepEqual(grafico.escala([60000, 181000]), { lo: 0, hi: 200000, marcas: [0, 100000, 200000] });
  assert.deepEqual(grafico.escala([-5, 12], { zero: true }).marcas, [-10, 0, 10, 20]);
  const l = [{ a: 3, b: 'Ana' }, { a: 1, b: 'Íris' }, { a: null, b: 'Caio' }, { a: 2, b: 'Bia' }];
  assert.deepEqual(tabela.ordenar(l, 'a', 1).map((x) => x.a), [1, 2, 3, null]);
  assert.deepEqual(tabela.ordenar(l, 'a', -1).map((x) => x.a), [3, 2, 1, null]);
  assert.deepEqual(tabela.ordenar(l, 'b', 1).map((x) => x.b), ['Ana', 'Bia', 'Caio', 'Íris']);
  assert.deepEqual([0, 1, 5.4, 10, 11, NaN].map((n) => quantidade.limitar(n)), [1, 1, 5, 10, 10, 1]);
  assert.equal(quantidade.limitar(12345, 1000, 50000, 1000), 12000);
  // teto fora do passo: o resultado continua no passo (nunca um empréstimo de 10.500)
  assert.equal(quantidade.limitar(10500, 1000, 10500, 1000), 10000);
  assert.equal(quantidade.limitar(99999, 1000, 10500, 1000), 10000);
  assert.equal(quantidade.limitar(5, 1, 10, 0), 5, 'passo inválido vale 1');
  // no limite o botão fica fraco mas o toque diz o porquê (antes o desligado do Botao engolia o toque no celular)
  const { loja } = await ui();
  let mudou = 0;
  const noLimite = quantidade.botaoDoPasso(true, 'Máximo: 10', () => mudou++);
  assert.equal(noLimite['aria-disabled'], 'true');
  noLimite.onClick();
  assert.equal(mudou, 0);
  assert.equal(loja.avisos.value.at(-1)?.texto, 'Máximo: 10');
  const livre = quantidade.botaoDoPasso(false, 'Máximo: 10', () => mudou++);
  assert.equal(livre['aria-disabled'], undefined);
  livre.onClick();
  assert.equal(mudou, 1);
});

test('cartão: só seleção de prédio consulta q.predio (via e Arcologia têm outro índice)', async () => {
  const { cartao } = await ui();
  for (const tipo of ['predio', 'colocavel', 'marcador']) assert.ok(cartao.ehPredio({ tipo, ref: 1048579 }), tipo);
  for (const tipo of ['aresta', 'arcologia', 'terreno', 'agua']) assert.ok(!cartao.ehPredio({ tipo, ref: 1048579 }), tipo);
  assert.ok(!cartao.ehPredio({ tipo: 'predio' }), 'sem ref');
  assert.ok(!cartao.ehPredio(null));
  // o botão do aviso só aparece com a frase e com quem saiba fazer a ação (U1b registra)
  const semEnergia = { avisos: [{ codigo: 'semEnergia', gravidade: 'grave', acao: 'verCamadaEnergiaTeste' }] };
  assert.equal(cartao.avisoPrincipal(semEnergia).acao, null);
  const { registrarTextos } = (await ui()).textos;
  registrarTextos('u1', { 'acao.verCamadaEnergiaTeste': 'Ver camada' });
  assert.equal(cartao.avisoPrincipal(semEnergia).acao, null, 'frase sem ação registrada');
  cartao.registrarAcaoAviso('verCamadaEnergiaTeste', () => {});
  assert.equal(cartao.avisoPrincipal(semEnergia).acao, 'Ver camada');
});

// ------------------------------------------------------------------------------------------------ CSS

test('CSS da U1a: sem desfoque no celular, animação só com transform e opacity, a barra escala com a tela', () => {
  const pasta = fonte('ui/tema');
  for (const f of ['componentes.css', 'hud.css', 'folha.css', 'telas.css']) {
    const css = readFileSync(join(pasta, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); // sem os comentários
    // desfoque só no PC, pelo data-vidro, e só nos grupos da barra (até 3 elementos)
    for (const m of css.matchAll(/([^{}]*)\{[^{}]*backdrop-filter[^{}]*\}/g)) {
      assert.match(m[1].trim(), /^:root\[data-vidro='1'\] #ui \.hud-grupo\.vidro$/, `${f}: desfoque fora do data-vidro: ${m[1].trim()}`);
    }
    for (const m of css.matchAll(/@keyframes\s+[\w-]+\s*\{([\s\S]*?)\}\s*\}/g)) {
      for (const p of m[1].matchAll(/([\w-]+)\s*:/g)) assert.ok(['transform', 'opacity'].includes(p[1]), `${f}: animação de ${p[1]}`);
    }
  }
  const hud = readFileSync(join(pasta, 'hud.css'), 'utf8');
  assert.match(hud, /\.lugar-cima[\s\S]*?zoom:\s*var\(--zoom\)/);
  // a barra é um contexto de empilhamento no z do HUD: com popover aberto ela sobe acima da tela (50) e do cartão (40)
  assert.match(hud, /\.lugar-cima:has\(\.popover\)\s*\{\s*z-index:\s*var\(--z-popover\)/);
});

test('glifos: a Torre Lâmina lê como torre (lâminas na proporção da D27) e o alerta não depende de preenchimento', async () => {
  const { glifos } = await ui();
  const torre = glifos.glifo('arcologia').tracos.map(caixaDoCaminho);
  // o contorno das lâminas: o mais alto dos traços (o chão, o pódio e o heliponto são baixos)
  const corpo = torre.reduce((a, c) => (c.y1 - c.y0 > a.y1 - a.y0 ? c : a));
  const alto = corpo.y1 - corpo.y0;
  // a lâmina mais baixa (163 de 301 m) passa da metade da torre: com degraus de alturas iguais ela lia como escada
  const baixa = corpo.y1 - Math.min(...corpo.pts.filter(([x]) => x <= corpo.x0 + 1).map(([, y]) => y));
  assert.ok(baixa / alto >= 0.5 && baixa / alto <= 0.6, `lâmina baixa com ${(baixa / alto).toFixed(2)} da altura (D27: 0,54)`);
  assert.ok(alto >= 1.5 * (corpo.x1 - corpo.x0), 'torre larga demais');
  // o ponto da exclamação é traço cheio (o preenchido a 35% some nos 12 px do saldo negativo)
  assert.equal(glifos.glifo('alerta').cheios.length, 0);
});

// ================================================================================================ U1b
// HUD, seleção e gestão: o dinheiro em dólar e a data real pelo formato (D67, D68, D87), as regras puras da faixa de
// alerta, dos objetivos, do menu (abrir numa aba, ir até o alvo), da folha (família, terreno), do menu de contexto,
// da pausa automática, do Depósito, dos momentos e dos avisos; os textos e os glifos que a U1b usa.

const ARQ_U1B = [
  ...['Velocidade', 'Trilho', 'Objetivo', 'FaixaAlerta', 'Avisos', 'Menu', 'Retomar'].map((n) => `ui/hud/${n}.jsx`),
  'ui/selecao/Folha.jsx',
  ...readdirSync(fonte('ui/selecao/secoes')).filter((f) => f.endsWith('.jsx') && f !== 'arcologia.jsx').map((f) => `ui/selecao/secoes/${f}`),
  ...['Holding', 'Cidade', 'Progresso', 'Conselho', 'Decisao', 'Momento'].map((n) => `ui/telas/${n}.jsx`),
  ...readdirSync(fonte('ui/telas/corpo')).filter((f) => f.endsWith('.jsx')).map((f) => `ui/telas/corpo/${f}`),
  'ui/mundo/MenuContexto.jsx',
];

let pacote2 = null;
async function ui2() {
  if (pacote2) return pacote2;
  const { build } = await import('esbuild');
  const abs = (p) => JSON.stringify(fonte(p));
  const entrada = `
    export * as fmt from ${abs('ui/formato.js')};
    export * as textos from ${abs('ui/textos.js')};
    export * as glifos from ${abs('ui/glifos/glifos.js')};
    export * as loja from ${abs('ui/loja.js')};
    export * as acoes from ${abs('ui/acoes.js')};
    export * as faixa from ${abs('ui/hud/FaixaAlerta.jsx')};
    export * as objetivo from ${abs('ui/hud/Objetivo.jsx')};
    export * as menu from ${abs('ui/hud/Menu.jsx')};
    export * as vel from ${abs('ui/hud/Velocidade.jsx')};
    export * as trilho from ${abs('ui/hud/Trilho.jsx')};
    export * as avisos from ${abs('ui/hud/Avisos.jsx')};
    export * as folha from ${abs('ui/selecao/Folha.jsx')};
    export * as cartao from ${abs('ui/selecao/Cartao.jsx')};
    export * as terreno from ${abs('ui/selecao/secoes/terreno.jsx')};
    export * as empresa from ${abs('ui/selecao/secoes/empresa.jsx')};
    export * as ctx from ${abs('ui/mundo/MenuContexto.jsx')};
    export * as momento from ${abs('ui/telas/Momento.jsx')};
    export * as corpoMomento from ${abs('ui/telas/corpo/Momento.jsx')};
    export * as holding from ${abs('ui/telas/corpo/Holding.jsx')};
    export * as cidade from ${abs('ui/telas/corpo/Cidade.jsx')};
    export * as comum from ${abs('ui/telas/corpo/comum.jsx')};
  `;
  const r = await build({
    stdin: { contents: entrada, resolveDir: RAIZ, loader: 'js' }, bundle: true, write: false, format: 'esm', platform: 'node',
    logLevel: 'silent', jsx: 'automatic', jsxImportSource: 'preact', nodePaths: [join(RAIZ, 'node_modules')],
  });
  pacote2 = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return pacote2;
}

test('formato (D67, D68, D87): dólar curto pelo fator único, por hora com sinal, data real "jan. 2020", nunca NaN', async () => {
  const { fmt } = await ui2();
  const { REGRAS_DONO } = await import('../../fonte/data/economia.js');
  assert.equal(fmt.MOEDA.fator, REGRAS_DONO.moeda?.fator ?? 600);
  assert.equal(fmt.MOEDA.simbolo, 'US$');
  // as regras do dono em dólar: 50 mil por ano = US$ 30 mi; dívida até 500 mil = US$ 300 mi; tarifas 5, 8 e 11
  assert.deepEqual([50000, 500000, 5, 8, 11].map(fmt.dinheiro), ['US$ 30 mi', 'US$ 300 mi', 'US$ 3.000', 'US$ 4.800', 'US$ 6.600']);
  assert.equal(fmt.dinheiro(2e6), 'US$ 1,2 bi');
  assert.equal(fmt.dinheiro(-2e6), '−US$ 1,2 bi');
  assert.equal(fmt.dinheiro(NaN), 'US$ 0');
  assert.equal(fmt.dinheiro(300000), 'US$ 180 mi', 'o caixa inicial');
  assert.equal(fmt.dinheiroHora(8), '+US$ 4.800/h');
  assert.equal(fmt.dinheiroHora(-16000), '−US$ 9,6 mi/h');
  assert.equal(fmt.dinheiroHora(0), 'US$ 0/h');
  assert.equal(fmt.dinheiroPorHora(11), 'US$ 6.600/h');
  // forma curta: o arredondamento que chega a 1.000 sobe de escala
  assert.deepEqual([4800, 12500, 480000, 999960, 1.25e6, 3.5e12].map(fmt.curto), ['4.800', '12,5 mil', '480 mil', '1 mi', '1,3 mi', '3,5 tri']);
  // calendário real (D67): o ano da simulação (2020 em diante) ou o ano de jogo antigo (1 = 2020)
  assert.equal(fmt.dataCalendario({ mes: 1, ano: 2020 }), 'jan. 2020');
  assert.equal(fmt.dataCalendario({ mes: 3, ano: 2 }), 'mar. 2021');
  assert.equal(fmt.dataCalendario({}), 'jan. 2020');
  assert.equal(fmt.anoCalendario(2026), 2026);
  assert.deepEqual([1, 12, 13, NaN].map(fmt.mesCurto), ['jan.', 'dez.', 'dez.', 'jan.']);
  for (const v of [NaN, Infinity, -0, 1e15]) assert.doesNotMatch(fmt.dinheiro(v) + fmt.dinheiroHora(v), /NaN|Infinity/);
});

test('textos da U1b: chaves usadas e dinâmicas existem, nada proibido (D42), nenhuma chave repetida; glifos existem', async () => {
  const { textos, glifos } = await ui2();
  const { verificarConteudo } = await import('../guarda-texto.mjs');
  const faltam = [];
  const usados = new Set();
  for (const f of ARQ_U1B) {
    const src = ler(f);
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) if (!textos.temTexto(m[1])) faltam.push(`${f}: ${m[1]}`);
    for (const m of src.matchAll(/\b(?:n|glifo)=["'](\w+)["']/g)) usados.add(m[1]);
    for (const m of src.matchAll(/\bglifo: '(\w+)'/g)) usados.add(m[1]);
    // pares [id, glifo] só na lista do menu; na folha, [glifo, estado] das redes
    if (f.endsWith('corpo/Menu.jsx')) for (const m of src.matchAll(/\['\w+', '(\w+)'\]/g)) usados.add(m[1]);
    for (const m of src.matchAll(/: \['(\w+)', '(?:ok|al|er)'\]/g)) usados.add(m[1]);
  }
  const dinamicas = [
    ...['detalhes', 'localizar', 'cor', 'demolir', 'producao', 'melhorar', 'zonear', 'construir', 'valor'].map((k) => `ctx.${k}`),
    ...[0, 1, 2, 3].flatMap((i) => [`folha.estudo.${i}`, `prog.etapa.${i}`]),
    ...['rocha', 'areia', 'argila', 'calcario', 'fertil', 'subterranea'].map((k) => `folha.recurso.${k}`),
    ...['agua', 'energia', 'esgoto'].map((k) => `folha.rede.${k}`),
    ...['geral', 'producao', 'mercado', 'imoveis'].map((k) => `hold.aba.${k}`),
    ...['geral', 'demanda', 'bemEstar', 'servicos'].map((k) => `cid.aba.${k}`),
    ...['marcos', 'areas', 'arcologia'].map((k) => `prog.aba.${k}`),
    ...['carregar', 'holding', 'economia', 'cidade', 'progresso', 'conselho', 'arcologia', 'camadas', 'mural', 'configuracoes'].map((k) => `menu.tela.${k}`),
    ...['demanda', 'bemEstar', 'marco', 'lote', 'deposito', 'medidores', 'hora'].flatMap((k) => [`menu.g.${k}`, `menu.g.${k}.def`]),
    ...['espaco', 'velocidades', 'telas', 'construir', 'camera', 'esc'].flatMap((k) => [`menu.a.${k}`, `menu.a.${k}.def`]),
    ...['cidade', 'holding', 'arcologia'].flatMap((k) => [`obj.dominio.${k}`, `obj.generico.${k}`]),
    ...['grave', 'atencao', 'info'].map((k) => `faixa.generico.${k}`),
    ...Array.from({ length: 12 }, (_, i) => `cal.mes.${i + 1}`),
    ...['camadas', 'mural', 'foto'].map((k) => `trilho.${k}`),
    ...['verCamadaAgua', 'verCamadaEnergia', 'verCamadaBemEstar', 'verCamadaEmpregos', 'construirVia', 'demolir'].map((k) => `acao.${k}`),
    ...['acao.deposito', 'acao.emprestimo', 'regra.dependencia', 'nivel.armazem2', 'arcologia.faseInicial'].map((k) => `libera.${k}`),
    'faixa.acao.verCamada', 'prog.premio', 'prog.premioLicenca', 'mom.licenca', 'mom.licencas', 'menu.salvo', 'menu.naoSalvo',
    'tela.carregando', 'tela.erro', 'folha.via.unica', 'folha.via.dupla', 'folha.linha.semFornecedor', 'folha.linha.importado', 'unid.mil', 'unid.tri',
    'hold.titulo', 'cid.titulo', 'prog.titulo', 'cons.titulo', 'menu.titulo',
  ];
  for (const k of dinamicas) if (!textos.temTexto(k)) faltam.push(k);
  assert.deepEqual(faltam, []);
  for (const k of textos.chaves().filter((k) => /^(cal|obj|retomar|menu|ctx|folha|hold|cid|prog|cons|dec|mom|faixa|trilho|acao|libera|tela)\./.test(k))) {
    assert.deepEqual(verificarConteudo(textos.t(k), ['travessao', 'aluguel', 'porDia', 'dia'], { js: false }), [], `${k}: ${textos.t(k)}`);
  }
  assert.deepEqual(textos.chavesRepetidas(), []);
  const semGlifo = [...usados].filter((n) => !glifos.glifo(n));
  assert.deepEqual(semGlifo, []);
  // os nomes completos dos conselheiros (D83) e nada do plano antigo (Torres do Conselho, Trevo)
  const tudo = ARQ_U1B.map(ler).join('\n') + readFileSync(fonte('ui/textos/u1.js'), 'utf8');
  assert.doesNotMatch(tudo, /Torres do Conselho|Trevo|Torre Lâmina/);
});

test('faixa de alerta: o mais grave primeiro, a frase da cidade ou da economia, as três saídas do "Caixa zerado" (D41)', async () => {
  const { faixa } = await ui2();
  const l = faixa.ordenarAlertas([
    { id: 'a', gravidade: 'atencao', codigo: 'faltaAgua', params: { n: 1400 } },
    { id: 'b', gravidade: 'grave', codigo: 'caixaZerado' },
    { id: 'c', gravidade: 'info', codigo: 'x' },
  ]);
  assert.deepEqual(l.map((a) => a.id), ['b', 'a', 'c']);
  assert.equal(faixa.textoAlerta(l[1]), 'Falta água: 1.400 prédios sem água');
  assert.equal(faixa.textoAlerta({ codigo: 'obrasSemMaterial', params: { item: 'concreto' }, gravidade: 'atencao' }), 'Obras paradas por falta de concreto');
  assert.equal(faixa.textoAlerta({ codigo: 'inventado', gravidade: 'grave' }), 'Problema grave na cidade');
  assert.deepEqual(faixa.acoesAlerta(l[0]).map((x) => x.id), ['emprestimo', 'deposito', 'orcamento']);
  assert.deepEqual(faixa.acoesAlerta({ codigo: 'faltaEnergia', alvo: { x: 1, z: 2 } }).map((x) => x.rotulo), ['Ver camada']);
  assert.deepEqual(faixa.acoesAlerta({ codigo: 'semAlvo' }), []);
});

test('objetivos (D58): frase com os parâmetros e as chaves traduzidas, quem fala com nome completo (D83), recolhe depois da primeira hora', async () => {
  const { objetivo } = await ui2();
  const o = { id: 'holding.estoque', texto: 's3.objetivo.holding.estoque', params: { n: 1200, item: 'concreto' }, paramsChave: { item: 's3.item.concreto' }, quem: 'tome', dominio: 'holding', feito: 24, total: 40 };
  assert.equal(objetivo.textoObjetivo(o), 'Junte 1.200 de concreto para a próxima etapa');
  assert.equal(objetivo.textoObjetivo({ id: 'cidade.agua', texto: 'chave.que.nao.existe', dominio: 'cidade' }), 'Leve água à Vila de Santa Cida');
  assert.equal(objetivo.textoObjetivo({ id: 'inventado', dominio: 'arcologia' }), 'Leve a Arcologia adiante');
  assert.equal(objetivo.fracaoObjetivo(o), 0.6);
  assert.equal(objetivo.fracaoObjetivo({ feito: 5 }), 0);
  const q = objetivo.quemFala('livia');
  assert.deepEqual([q.nome, q.inicial], ['Lívia Andrade', 'L']);
  assert.equal(objetivo.quemFala('cida').inicial, 'C');
  assert.equal(objetivo.quemFala('iris').nome, 'Íris Valverde');
  assert.equal(objetivo.quemFala('ninguem').inicial, 'H');
  assert.equal(objetivo.estaRecolhido(100), false);
  assert.equal(objetivo.estaRecolhido(3600), true);
  objetivo.objetivoRecolhido.value = false;
  assert.equal(objetivo.estaRecolhido(9000), false, 'a escolha do jogador manda');
  objetivo.objetivoRecolhido.value = null;
});

test('menu: abrir uma tela já numa aba (uma vez só) e ir até o alvo da simulação (câmera, tela, categoria)', async () => {
  const { menu } = await ui2();
  const abertas = [];
  const voos = [];
  const ui = {
    telas: () => ['holding', 'economia', 'livroArcologia'],
    abrirTela: (id) => (abertas.push(id), true),
    fecharTela: () => {},
    R: { camera: { irPara: (alvo) => voos.push(alvo) } },
  };
  assert.equal(menu.irParaAlvo(ui, { tela: 'holding.mercado' }), true);
  assert.equal(menu.tomarAba('holding', 'geral'), 'mercado');
  assert.equal(menu.tomarAba('holding', 'geral'), 'geral', 'a aba pedida vale uma vez');
  assert.equal(menu.irParaAlvo(ui, { tela: 'arcologia' }), true);
  assert.deepEqual(abertas, ['holding', 'livroArcologia']);
  assert.equal(menu.irParaAlvo(ui, { x: 120, z: -80 }), true);
  assert.deepEqual([voos[0].x, voos[0].z], [120, -80]);
  assert.equal(menu.irParaAlvo(ui, null), false);
  assert.equal(menu.irParaAlvo({ ...ui, telas: () => [] }, { tela: 'arcologia' }), false);
});

test('folha: família pela seleção e pelo prédio; terreno pelo espelho (área, licença em dólar, valor e recursos)', async () => {
  const { folha, terreno, cartao } = await ui2();
  const sel = { tipo: 'predio', ref: 1048579 };
  assert.equal(folha.familiaDe({ tipo: 'aresta', ref: 1 }, null), 'via');
  assert.equal(folha.familiaDe({ tipo: 'terreno', ponto: [0, 0, 0] }, null), 'terreno');
  assert.equal(folha.familiaDe({ tipo: 'arcologia', ref: 1 }, null), 'arcologia');
  assert.equal(folha.familiaDe(sel, { tipo: 'zona', zona: 2, moradia: {} }), 'residencial');
  assert.equal(folha.familiaDe(sel, { tipo: 'zona', familia: 'ind' }), 'industrial');
  assert.equal(folha.familiaDe(sel, { tipo: 'zona', familia: 'esc' }), 'comercial');
  assert.equal(folha.familiaDe(sel, { tipo: 'servico', servico: {} }), 'servico');
  assert.equal(folha.familiaDe(sel, { tipo: 'holding', holding: {} }), 'empresa');
  assert.equal(folha.familiaDe(sel, null), null);
  const estado = new Uint8Array(256);
  estado[8 * 16 + 8] = 2;
  estado[8 * 16 + 9] = 1;
  const preco = new Float64Array(256).fill(40000);
  const rocha = new Uint8Array(256 * 256);
  rocha[128 * 256 + 128] = 255;
  const valor = new Float32Array(256 * 256).fill(420);
  const esp = {
    mapa: { tam: 8192, origem: [-4096, -4096] },
    ladrilhos: { n: 16, estado, preco },
    areas: [{ id: 'vila', nome: 'Vila de Santa Cida', contorno: new Float64Array([0, 0, 100, 0, 100, 100, 0, 100]) }],
    grades: { valor: { n: 256, passo: 32, dados: valor } },
    recursos: { n: 256, passo: 32, rocha, areia: new Uint8Array(256 * 256) },
  };
  const d = terreno.lerTerreno(esp, [10, 3.5, 10]);
  assert.equal(d.area?.nome, 'Vila de Santa Cida');
  assert.deepEqual(d.ladrilho, { i: 8, j: 8, estado: 2, preco: 40000 });
  assert.equal(d.valor, 420);
  assert.deepEqual(d.recursos.map((r) => r.id), ['rocha']);
  assert.equal(terreno.lerTerreno(esp, [600, 0, 10]).ladrilho.estado, 1);
  assert.equal(terreno.lerTerreno(esp, [600, 0, 10]).area, null);
  assert.equal(terreno.lerTerreno({}, [0, 0, 0]).ladrilho, null, 'espelho vazio não quebra');
  // cartão da via (q.aresta): comprimento, manutenção em dólar e o declive (o fluxo no M1b)
  const via = cartao.numerosDaVia({ tipo: 'avenida', comprimento: 412, manutencaoHora: 41, declive: -0.021 });
  assert.deepEqual(via.map((x) => x.valor), ['412 m', '−US$ 24,6 mil/h', '2,1%']);
  assert.equal(cartao.nomeTipoVia('avenidaG'), 'Avenida grande');
  assert.ok(cartao.ehVia({ tipo: 'aresta', ref: 3 }) && !cartao.ehVia({ tipo: 'predio', ref: 3 }));
  assert.ok(cartao.semCartao({ tipo: 'terreno' }) && cartao.semCartao({ tipo: 'arcologia' }) && !cartao.semCartao({ tipo: 'predio' }));
});

test('menu de contexto: até 4 pétalas acima do dedo e dentro da tela; ações pelo tipo (prédio, Holding, via, terreno)', async () => {
  const { ctx } = await ui2();
  for (const [x, y] of [[493, 300], [20, 300], [970, 420], [493, 60]]) {
    const p = ctx.posicoesPetalas(4, x, y, 986, 443);
    assert.equal(p.length, 4);
    for (const q of p) {
      assert.ok(q.x >= 36 && q.x <= 986 - 36 && q.y >= 36 && q.y <= 443 - 36, `pétala fora da tela em ${x},${y}: ${JSON.stringify(q)}`);
      assert.ok(Math.hypot(q.x - x, q.y - y) > 40 || x < 60 || x > 930, 'pétala sob o dedo');
    }
    if (y > 120) assert.ok(p.every((q) => q.y < y), 'acima do dedo quando cabe');
  }
  assert.equal(ctx.tipoDoMenu({ tipo: 'predio', ref: 5 }, { tipo: 'zona' }), 'predio');
  assert.equal(ctx.tipoDoMenu({ tipo: 'predio', ref: 5 }, { tipo: 'holding', holding: {} }), 'holding');
  assert.equal(ctx.tipoDoMenu({ tipo: 'aresta', ref: 5 }, null), 'via');
  assert.equal(ctx.tipoDoMenu({ tipo: 'terreno', ponto: [0, 0, 0] }, null), 'terreno');
  assert.equal(ctx.tipoDoMenu(null, null), null);
});

test('pausa automática: o modal pausa e devolve a velocidade de antes; se o jogador mexeu no meio, não devolve', async () => {
  const { vel, acoes, loja } = await ui2();
  const { criarSimFalsa } = await import('../vitrine/sim-falsa.js');
  const sim = criarSimFalsa({ cenario: 'meio' });
  acoes.ligarAcoes({ obterSim: () => sim, aoComando: () => loja.aplicarBarra(sim.q.barra()) });
  sim.cmd('velocidade', { v: 2 });
  loja.aplicarBarra(sim.q.barra());
  vel.pausarPor('modal');
  vel.pausarPor('tela');
  assert.equal(sim.estado.v, 0);
  vel.soltarPausa('modal');
  assert.equal(sim.estado.v, 0, 'ainda há uma tela pausando');
  vel.soltarPausa('tela');
  assert.equal(sim.estado.v, 2, 'volta a 2x');
  vel.pausarPor('modal');
  acoes.velocidade(3); // o jogador escolheu 4x com o modal aberto
  vel.soltarPausa('modal');
  assert.equal(sim.estado.v, 3, 'a escolha do jogador fica');
  assert.equal(vel.pausasAtivas(), 0);
});

test('Holding e momentos: janela do Depósito, itens visíveis, título do marco e da etapa, avisos dos eventos', async () => {
  const { holding, momento, corpoMomento, avisos, comum, trilho } = await ui2();
  const j = holding.janelaDeposito({ janela: { fimTique: 14400, vendidas: 37, max: 100 } }, 14400 - 125, 1);
  assert.deepEqual([j.vendidas, j.max, j.resta, j.renova], [37, 100, 63, '02:05']);
  assert.deepEqual(holding.itensVisiveis([{ item: 'a', liberado: true }, { item: 'b', liberado: false }, { item: 'c', liberado: false, estoque: 3 }]).map((x) => x.item), ['a', 'c']);
  assert.deepEqual(corpoMomento.tituloDoMomento({ tipo: 'marco', n: 3, nome: 'Vila Próspera' }), { sobre: 'Marco 3', titulo: 'Vila Próspera' });
  const ui = { consultar: () => ({ partes: [{ nome: 'Blade Tower', etapas: [{ id: 'torre.e1', nome: 'Fundações' }, { id: 'torre.e2', nome: 'Sede operacional' }] }] }) };
  const m = momento.momentoDaEtapa(ui, { id: 'torre.e2', estado: 3 });
  assert.deepEqual(corpoMomento.tituloDoMomento(m), { sobre: 'Blade Tower', titulo: 'Etapa 2 de 2 · Sede operacional' });
  momento.registrarEtapaMomento((ev) => (ev.id === 'torre.e2' ? { fala: { quem: 'iris', texto: 'A sede abriu.' } } : null));
  assert.equal(momento.momentoDaEtapa(ui, { id: 'torre.e2', estado: 3 }).fala.quem, 'iris');
  const a = avisos.avisoDoEvento('objetivo', { id: 'cidade.agua', estado: 'feito' }, () => [{ id: 'cidade.agua', texto: 's3.objetivo.cidade.agua', dominio: 'cidade' }]);
  assert.equal(a.texto, 'Objetivo cumprido: Leve água à Vila de Santa Cida');
  assert.equal(avisos.avisoDoEvento('velocidade', { v: 1 }), null);
  assert.deepEqual(['servico.clinica', 'holding.concreteira', 'item.concreto', 'zona.resMedia', 'acao.deposito', 'nada.disso'].map(comum.nomeLiberado), ['Clínica', 'Concreteira', 'Concreto', 'Residencial média', 'Depósito', null]);
  // trilho: só o que tem tela (a categoria sem item fica fora, D24); um item registrado troca o padrão
  assert.deepEqual(trilho.itensTrilho(['camadas', 'holding']).map((x) => x.id), ['camadas']);
  trilho.registrarItemTrilho({ id: 'mural', glifo: 'mural', rotulo: 'trilho.mural', ordem: 20, aoTocar: () => {} });
  assert.deepEqual(trilho.itensTrilho([]).map((x) => x.id), ['mural']);
});

test('fila de modais: o fechar tira o próprio item (toque duplo e decisão que some não levam o seguinte); Decidir traz a decisão para a frente', async () => {
  const { momento, holding, avisos, comum } = await ui2();
  momento.filaModal.value = [];
  momento.enfileirar({ tipo: 'momento', dados: { tipo: 'marco', n: 3 } });
  momento.enfileirar({ tipo: 'momento', dados: { tipo: 'marco', n: 4 } });
  const [a, b] = momento.filaModal.value;
  assert.notEqual(a.seq, b.seq, 'cada item tem a sua chave (o seguinte começa do título)');
  momento.tirarModal(a);
  momento.tirarModal(a); // toque duplo em Continuar
  assert.deepEqual(momento.filaModal.value.map((x) => x.dados.n), [4]);
  momento.enfileirar({ tipo: 'decisao', id: 'febre.aurora' });
  momento.enfileirar({ tipo: 'decisao', id: 'febre.aurora' });
  assert.equal(momento.filaModal.value.length, 2, 'a mesma decisão não entra duas vezes');
  momento.enfileirar({ tipo: 'decisao', id: 'febre.aurora' }, { frente: true });
  assert.deepEqual(momento.filaModal.value.map((x) => x.tipo), ['decisao', 'momento'], 'Decidir traz a que esperava para a frente');
  momento.filaModal.value = [];
  // Mercado: a venda presa ao estoque e à janela; importar não depende dos dois
  assert.deepEqual([holding.vendaPossivel(10, 140, 63), holding.vendaPossivel(40, 12, 63), holding.vendaPossivel(10, 0, 63), holding.vendaPossivel(10, 50, 0)], [10, 12, 1, 1]);
  // o objetivo cumprido já saiu de q.objetivos quando o evento chega: a frase vem da barra lida antes
  const barraAntes = [{ id: 'holding.estoque', texto: 's3.objetivo.holding.estoque', params: { n: 1200, item: 'concreto' }, paramsChave: { item: 's3.item.concreto' }, dominio: 'holding' }];
  const x = avisos.avisoDoEvento('objetivo', { id: 'holding.estoque', estado: 'feito' }, () => [], barraAntes);
  assert.equal(x.texto, 'Objetivo cumprido: Junte 1.200 de concreto para a próxima etapa');
  assert.equal(avisos.avisoDoEvento('caixaZerado', { sim: true }), null, 'o caixa zerado fica na faixa, não vira aviso curto');
  // chave da simulação sem frase some (nunca a chave crua na tela)
  assert.deepEqual([comum.frase('s3.decisao.nada.disso.ganho'), comum.frase('Água da Vila'), comum.frase(null)], ['', 'Água da Vila', '']);
});

test('menu de contexto da via: Melhorar só com melhoria, Demolir nunca na rodovia nem na Arcologia; a faixa sem Camadas leva ao lugar', async () => {
  const { ctx, faixa } = await ui2();
  const ids = (p) => ctx.itensDoMenu('via', p).map(([id]) => id);
  assert.deepEqual(ids({ melhoraPara: ['avenidaG'] }), ['detalhes', 'melhorar', 'demolir']);
  assert.deepEqual(ids({ melhoraPara: [] }), ['detalhes', 'demolir']);
  assert.deepEqual(ids({ rodovia: true, melhoraPara: [] }), ['detalhes']);
  assert.deepEqual(ctx.itensDoMenu('predio', null).map(([id]) => id), ['detalhes', 'localizar', 'cor', 'demolir']);
  const a = { codigo: 'faltaAgua', gravidade: 'atencao', alvo: { x: 1, z: 2 } };
  assert.equal(faixa.acoesAlerta(a)[0].rotulo, 'Ver camada');
  assert.equal(faixa.acoesAlerta(a, { camadas: false })[0].rotulo, 'Ver');
  assert.equal(faixa.acoesAlerta({ codigo: 'desempregoAlto', gravidade: 'atencao', alvo: { tela: 'cidade' } })[0].rotulo, 'Ver camada');
});
