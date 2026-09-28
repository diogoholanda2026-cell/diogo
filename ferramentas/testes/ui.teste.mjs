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
  assert.deepEqual(n.map((x) => [x.id, x.valor]), [['moradores', '84 de 96'], ['bemEstar', '71'], ['contribuicao', '+924/h']]);
  assert.equal(cartao.subtitulo(res), 'Residencial média · nível 3 de 5');
  assert.equal(cartao.aparencia(res).glifo, 'residencial');
  const a = cartao.avisoPrincipal(res, 400 + 3 * 60 + 5);
  assert.equal(a.gravidade, 'grave');
  assert.equal(a.texto, 'Sem energia');
  assert.equal(a.sub, 'há 3 min de jogo');
  assert.equal(a.mais, 1);
  const serv = { tipo: 'servico', estado: 'ok', servico: { categoria: 'saude', capacidade: 800, uso: 620, eficiencia: 0.74, alcance: 600, manutencaoHora: 400 } };
  assert.deepEqual(cartao.numerosDoCartao(serv).map((x) => [x.id, x.valor, x.estado ?? null]), [['atendidos', '620 de 800', null], ['eficiencia', '74%', 'al'], ['manutencao', '−400/h', null]]);
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
  assert.deepEqual(vazio.map((x) => x.valor), ['0 de 8', '0', '0/h']);
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

test('Economia: a linha da regra "Contribuição: 12.480 × 11 = 137.280/h" com a simulação falsa; média quando não fecha', async () => {
  const { economia } = await ui();
  const { criarSimFalsa } = await import('../vitrine/sim-falsa.js');
  const sim = criarSimFalsa({ cenario: 'meio' });
  const b = sim.q.barra();
  const orc = sim.q.orcamento();
  assert.equal(economia.regraContribuicao(b.populacao, b.tarifa, orc.receitas.moradores), 'Contribuição: 12.480 × 11 = 137.280/h');
  assert.equal(economia.regraContribuicao(1000, 11, 9000), 'Média de 9,0 por morador: 9.000/h');
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
  assert.equal(economia.curto(150000), '150 mil');
  assert.equal(economia.curto(2500), '2,5 mil');
  assert.equal(economia.curto(1.26e6), '1,3 mi');
  assert.equal(economia.curto(-40000), '−40 mil');
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
