// Guarda de texto: regras que se conferem lendo a fonte, sem rodar nada (PROJETO 3.2, D44 e D42).
//  1. fonte/sim/ e fonte/comum/ não usam relógio nem sorteio (Date.now, performance.now, new Date, Math.random):
//     a simulação é determinística.
//  2. fonte/sim/, fonte/comum/ e fonte/render/geracao/ não importam o three (rodam no Node e nos workers).
//  3. Nenhum shader próprio em fonte/render/ usa mediump (o Mali só falha no celular do dono).
//  4. Os textos da interface (fonte/ui/textos/) não têm travessão, "Aluguel", "/dia" nem a palavra "dia" (D42).
//  5. Em fonte/, quem faz import * as THREE usa o namespace só como THREE.Nome: passado como valor ({ THREE },
//     f(THREE), ctx.THREE = THREE), ele impede o esbuild de podar o three (177 KB a mais no pacote, A1).
// Os comentários de JS não contam (um comentário pode citar a regra). Uso: node ferramentas/guarda-texto.mjs [raiz]
// Importável: guardar({ raiz }) devolve { arquivos, falhas }; verificarConteudo(texto, regras) testa um texto solto.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = /\.(m?js|jsx|ts|glsl|vert|frag)$/;

// regras por nome: cada uma devolve a lista de trechos proibidos de um texto já sem comentários
export const REGRAS = {
  relogio: { motivo: 'relógio ou sorteio na simulação', re: /\b(?:Date\.now|performance\.now|Math\.random)\b|\bnew\s+Date\b/g },
  three: { motivo: 'importa o three fora do render', re: /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]three(?:\/[^'"]*)?['"]/g },
  mediump: { motivo: 'mediump num shader próprio (use highp, D44)', re: /\bmediump\b/g },
  travessao: { motivo: 'travessão no texto da interface', re: /[\u2014\u2013]/g },
  aluguel: { motivo: '"Aluguel" (a receita dos moradores é Contribuição, D42)', re: /aluguel/gi },
  porDia: { motivo: '"/dia" (taxas só em /h de jogo, D42)', re: /\/\s*dias?\b/gi },
  // palavra inteira, com fronteira que entende acento ("média" e "diário" passam; "dia" e "dias" não)
  dia: { motivo: 'a palavra "dia" (some da interface, D42)', re: /(?<![\p{L}\p{N}_])dias?(?![\p{L}\p{N}_])/giu },
  // só nos arquivos com import * as THREE (o THREE do contexto é um subconjunto, materiais/texturas.js)
  threeValor: {
    motivo: 'o namespace do three passado como valor (use THREE.Nome; impede a poda do three, A1)',
    re: /(?<!\bas\s+)(?<![.\w$])THREE\b(?!\s*[.:])/g,
    se: /\bimport\s*\*\s*as\s+THREE\s+from\s*['"]three['"]/,
  },
};

// quais regras valem em cada pasta (caminho relativo à raiz, com barra)
export const PASTAS = [
  { pasta: 'fonte/sim', regras: ['relogio', 'three'] },
  { pasta: 'fonte/comum', regras: ['relogio', 'three'] },
  { pasta: 'fonte/render/geracao', regras: ['three'] },
  { pasta: 'fonte/render', regras: ['mediump'] },
  { pasta: 'fonte/ui/textos', regras: ['travessao', 'aluguel', 'porDia', 'dia'] },
  { pasta: 'fonte', regras: ['threeValor'] },
];

// Troca os comentários de JS (// e /* */) por espaços, preservando as quebras de linha e o texto das strings.
// Não entende expressão regular literal com aspas ou barras dentro: basta para a fonte do jogo.
export function semComentarios(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const branco = (s) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      let j = src.indexOf('\n', i); if (j < 0) j = n;
      out += branco(src.slice(i, j)); i = j;
    } else if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
      out += branco(src.slice(i, j)); i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; else if (c !== '`' && src[j] === '\n') break; j++; }
      out += src.slice(i, j + 1); i = j + 1;
    } else { out += c; i++; }
  }
  return out;
}

// Confere um texto contra as regras dadas; devolve [{ linha, regra, motivo, trecho }]
export function verificarConteudo(texto, regras, { js = true } = {}) {
  const limpo = js ? semComentarios(texto) : texto;
  const falhas = [];
  for (const nome of regras) {
    const { re, motivo, se } = REGRAS[nome];
    if (se && !se.test(limpo)) continue;
    re.lastIndex = 0;
    for (const m of limpo.matchAll(re)) {
      const linha = limpo.slice(0, m.index).split('\n').length;
      const ini = limpo.lastIndexOf('\n', m.index) + 1;
      const fim = limpo.indexOf('\n', m.index);
      falhas.push({ linha, regra: nome, motivo, trecho: limpo.slice(ini, fim < 0 ? undefined : fim).trim().slice(0, 100) });
    }
  }
  return falhas;
}

function listar(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const nome of readdirSync(dir).sort()) {
    const f = join(dir, nome);
    if (statSync(f).isDirectory()) out.push(...listar(f));
    else if (EXT.test(nome)) out.push(f);
  }
  return out;
}

// Roda a guarda na árvore inteira; devolve { arquivos, falhas: [{ arquivo, linha, regra, motivo, trecho }] }
export function guardar({ raiz = RAIZ } = {}) {
  const porArquivo = new Map();
  for (const { pasta, regras } of PASTAS) {
    for (const f of listar(join(raiz, pasta))) {
      const r = porArquivo.get(f) || new Set();
      for (const x of regras) r.add(x);
      porArquivo.set(f, r);
    }
  }
  const falhas = [];
  for (const [f, regras] of porArquivo) {
    const js = !/\.(glsl|vert|frag)$/.test(f);
    for (const x of verificarConteudo(readFileSync(f, 'utf8'), [...regras], { js })) {
      falhas.push({ arquivo: relative(raiz, f).split('\\').join('/'), ...x });
    }
  }
  return { arquivos: porArquivo.size, falhas };
}

export function relatorio({ arquivos, falhas }) {
  if (!falhas.length) return `guarda-texto ok (${arquivos} arquivos)`;
  return [`guarda-texto: ${falhas.length} falha(s)`, ...falhas.map((f) => `  ${f.arquivo}:${f.linha}: ${f.motivo}: ${f.trecho}`)].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const r = guardar({ raiz: process.argv[2] ? resolve(process.argv[2]) : RAIZ });
  console.log(relatorio(r));
  process.exit(r.falhas.length ? 1 : 0);
}
