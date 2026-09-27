// Save binário versionado (seção 2.9, contratos/save.js) e hash do estado (16.5). Sem IndexedDB (isso é da U2a).
// montarSave → bytes crus; comprimir/descomprimir usam CompressionStream (Node 18+ e navegador); carregarSave monta
// numa simulação NOVA, valida e confere o hash. O hash percorre o registro: estado esquecido aparece no teste de ida e
// volta.
import { SAVE, TIPOS_SECAO } from '../../contratos/save.js';
import { FNV_BASE, fnv1aTexto, fnv1aTipado, fnv1aU32 } from '../../comum/hash.js';
import { jsonCanonico, trocarConteudo, ehTipado } from '../../comum/util.js';

/** Migrações de dados: MIGRACOES[v](cabecalho, secoes) leva um save da versão v para v + 1. */
export const MIGRACOES = {};

const TIPO_DE = {
  Float64Array: 'f64', Float32Array: 'f32', Int32Array: 'i32', Uint32Array: 'u32',
  Int16Array: 'i16', Uint16Array: 'u16', Int8Array: 'i8', Uint8Array: 'u8',
};
const CONSTRUTOR = {
  f64: Float64Array, f32: Float32Array, i32: Int32Array, u32: Uint32Array,
  i16: Int16Array, u16: Uint16Array, i8: Int8Array, u8: Uint8Array,
};
for (const k of Object.keys(TIPOS_SECAO)) if (!CONSTRUTOR[k]) throw new Error(`formato: tipo de seção sem construtor ${k}`);

const alinhar = (n) => (n + 7) & ~7;

// Seções JSON só com dados simples: Map, Set e objetos de classe virariam {} no JSON e sumiriam do save sem mudar o
// hash (a ida e volta passaria e a partida carregada perderia o estado).
function conferirSimples(v, caminho) {
  const p = Object.getPrototypeOf(v);
  if (p !== Object.prototype && p !== null) {
    throw new Error(`save: ${caminho} é ${v.constructor?.name ?? 'objeto'}; use objeto simples, array ou array tipado`);
  }
}

// ------------------------------------------------------------------------------------------------ hash

/** Hash canônico de uma estrutura com arrays tipados (chaves em ordem; tipados pelos bytes). */
export function hashEstrutura(v, h = FNV_BASE) {
  if (v === null || v === undefined) return fnv1aTexto('~', h);
  if (ehTipado(v)) {
    h = fnv1aTexto(`#${TIPO_DE[v.constructor.name]}:${v.length}`, h);
    return fnv1aTipado(v, h);
  }
  switch (typeof v) {
    case 'number':
    case 'boolean':
      return fnv1aTexto(String(v), h);
    case 'string':
      return fnv1aTexto(JSON.stringify(v), h);
    case 'object': {
      if (Array.isArray(v)) {
        h = fnv1aTexto(`[${v.length}`, h);
        for (const x of v) h = hashEstrutura(x, h);
        return fnv1aTexto(']', h);
      }
      conferirSimples(v, 'seção do hash');
      h = fnv1aTexto('{', h);
      for (const k of Object.keys(v).sort()) {
        if (v[k] === undefined || typeof v[k] === 'function') continue;
        h = fnv1aTexto(k, h);
        h = hashEstrutura(v[k], h);
      }
      return fnv1aTexto('}', h);
    }
    default:
      return h;
  }
}

function hashTabela(t, h) {
  h = fnv1aTexto(t.nome, h);
  h = fnv1aU32(t.n, h);
  h = fnv1aU32(t.alto, h);
  h = fnv1aTipado(t.viva, h, t.n);
  h = fnv1aTipado(t.ger, h, t.alto);
  for (const col of t.colunasOrdenadas()) {
    h = fnv1aTexto(col, h);
    h = fnv1aTipado(t[col], h, t.n * t.specs[col].por);
  }
  return h;
}

/**
 * Hash do estado da simulação: núcleo (tique, seq, sorteios), tabelas, grades e seções JSON registradas com hash,
 * formas e tarefas pendentes. Não entra o que é derivado (espelho, agregados, grades espaciais, altura aplainada).
 */
export function hashEstado(sim) {
  let h = fnv1aTexto(jsonCanonico(sim.estadoNucleo()));
  const reg = sim.registros;
  for (const nome of [...reg.tabelas.keys()].sort()) if (reg.tabelas.get(nome).hash) h = hashTabela(sim.tabelas[nome], h);
  for (const nome of [...reg.grades.keys()].sort()) {
    if (!reg.grades.get(nome).hash) continue;
    h = fnv1aTexto(nome, h);
    h = fnv1aTipado(sim.grades[nome].dados, h);
  }
  for (const nome of [...reg.json.keys()].sort()) {
    if (!reg.json.get(nome).hash) continue;
    h = fnv1aTexto(nome, h);
    h = hashEstrutura(sim.json[nome], h);
  }
  h = hashEstrutura(sim.formas.paraSalvar(), h);
  h = hashEstrutura(sim.tarefas.paraSalvar(), h);
  return h >>> 0;
}

// ------------------------------------------------------------------------------------------------ escrita

class Escritor {
  constructor() {
    this.secoes = [];
    this.partes = [];
    this.offset = 0;
  }

  /** Acrescenta uma seção com os primeiros n elementos do array. */
  add(nome, ta, n = ta.length) {
    const tipo = TIPO_DE[ta.constructor.name];
    if (!tipo) throw new Error(`save: tipo sem seção (${ta.constructor.name})`);
    const bytes = new Uint8Array(ta.buffer, ta.byteOffset, n * ta.BYTES_PER_ELEMENT);
    this.secoes.push({ nome, tipo, n, bytes: bytes.length, offset: this.offset });
    this.partes.push([this.offset, bytes]);
    this.offset = alinhar(this.offset + bytes.length);
  }
}

/** Troca os arrays tipados de uma estrutura por { $bin: nome } e manda os bytes para o escritor. */
function codificar(v, caminho, esc) {
  if (v === null || typeof v !== 'object') return v;
  if (ehTipado(v)) {
    const nome = `est.${caminho}`;
    esc.add(nome, v);
    return { $bin: nome };
  }
  if (Array.isArray(v)) return v.map((x, i) => codificar(x, `${caminho}.${i}`, esc));
  conferirSimples(v, caminho);
  const out = {};
  for (const k of Object.keys(v)) {
    if (v[k] === undefined || typeof v[k] === 'function') continue;
    out[k] = codificar(v[k], `${caminho}.${k}`, esc);
  }
  return out;
}

/** Volta { $bin } para arrays tipados (cópias donas da memória). */
function decodificar(v, secoes) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decodificar(x, secoes));
  if (typeof v.$bin === 'string' && Object.keys(v).length === 1) {
    const s = secoes.get(v.$bin);
    if (!s) throw new Error(`save: seção faltando (${v.$bin})`);
    return s.slice();
  }
  const out = {};
  for (const k of Object.keys(v)) out[k] = decodificar(v[k], secoes);
  return out;
}

/**
 * Monta o save cru (sem gzip). op.criado e op.nome vêm do app (a simulação não lê relógio); op.vista guarda câmera e
 * velocidade; op.comprimido marca o bit 0 (quem chama comprime depois).
 * @returns {Uint8Array}
 */
export function montarSave(sim, { nome = '', criado = 0, vista = null, comprimido = false } = {}) {
  const esc = new Escritor();
  const reg = sim.registros;
  const tabelas = {};
  for (const n of [...reg.tabelas.keys()].sort()) {
    if (!reg.tabelas.get(n).salvar) continue;
    const t = sim.tabelas[n];
    tabelas[n] = { n: t.n, alto: t.alto, cap: t.cap, colunas: t.colunasOrdenadas() };
    esc.add(`${n}.viva`, t.viva, t.n);
    esc.add(`${n}.ger`, t.ger, t.alto);
    for (const col of t.colunasOrdenadas()) esc.add(`${n}.${col}`, t[col], t.n * t.specs[col].por);
  }
  const grades = {};
  for (const n of [...reg.grades.keys()].sort()) {
    if (!reg.grades.get(n).salvar) continue;
    const g = sim.grades[n];
    grades[n] = { n: g.n ?? null, passo: g.passo ?? null, tamanho: g.dados.length };
    esc.add(`grade.${n}`, g.dados);
  }
  const json = {};
  for (const n of [...reg.json.keys()].sort()) if (reg.json.get(n).salvar) json[n] = codificar(sim.json[n], `json.${n}`, esc);
  const ident = sim.json.identidade ?? {};
  const cab = {
    versaoSave: SAVE.versaoSave,
    jogo: SAVE.jogo,
    mapa: sim.mapa,
    semente: sim.semente,
    tique: sim.tique,
    criado,
    nome,
    holding: { nome: ident.nome ?? '', cor: ident.cor ?? '' },
    partida: { modo: sim.json.partida?.modo ?? 'normal' },
    arcologia: { plano: sim.espelho.arcologia?.plano ?? null },
    nucleo: sim.estadoNucleo(),
    json,
    tabelas,
    grades,
    formas: codificar(sim.formas.paraSalvar(), 'formas', esc),
    tarefas: codificar(sim.tarefas.paraSalvar(), 'tarefas', esc),
    livro: sim.livro.paraJSON(),
    vista: vista ?? { camera: null, velocidade: sim.velocidade },
    hash: hashEstado(sim),
    secoes: esc.secoes,
  };
  const txt = new TextEncoder().encode(JSON.stringify(cab));
  const iniBin = alinhar(SAVE.cabecalhoBytes + txt.length);
  const out = new Uint8Array(iniBin + esc.offset);
  const magica = new TextEncoder().encode(SAVE.magica);
  out.set(magica, 0);
  const dv = new DataView(out.buffer);
  dv.setUint16(4, SAVE.formato, true);
  dv.setUint16(6, comprimido ? SAVE.bandeiras.comprimido : 0, true);
  dv.setUint32(8, txt.length, true);
  out.set(txt, SAVE.cabecalhoBytes);
  for (const [off, bytes] of esc.partes) out.set(bytes, iniBin + off);
  return out;
}

// ------------------------------------------------------------------------------------------------ leitura

export const ehGzip = (b) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

async function passarPor(bytes, transformacao) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(transformacao);
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** gzip (navegador e Node 18+). */
export const comprimir = (bytes) => passarPor(bytes, new CompressionStream('gzip'));
export const descomprimir = (bytes) => passarPor(bytes, new DecompressionStream('gzip'));

/**
 * Lê o cabeçalho e as seções de um save cru. Lança erro se não for um save do jogo ou se o formato for desconhecido.
 * @returns {{ cab: object, secoes: Map<string, ArrayLike<number>>, bandeiras: number }}
 */
export function lerSave(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (ehGzip(bytes)) throw new Error('save comprimido: use abrirSave ou descomprimir antes');
  if (bytes.length < SAVE.cabecalhoBytes || new TextDecoder().decode(bytes.subarray(0, 4)) !== SAVE.magica) {
    throw new Error('não é um save da Arcologia de Held');
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formato = dv.getUint16(4, true);
  const bandeiras = dv.getUint16(6, true);
  const tam = dv.getUint32(8, true);
  if (formato !== SAVE.formato) throw new Error(`formato de save desconhecido (${formato})`);
  if (SAVE.cabecalhoBytes + tam > bytes.length) throw new Error('save cortado (cabeçalho)');
  let cab;
  try {
    cab = JSON.parse(new TextDecoder().decode(bytes.subarray(SAVE.cabecalhoBytes, SAVE.cabecalhoBytes + tam)));
  } catch {
    throw new Error('save danificado (JSON)');
  }
  if (cab.jogo !== SAVE.jogo) throw new Error('save de outro jogo');
  const iniBin = alinhar(SAVE.cabecalhoBytes + tam);
  const secoes = new Map();
  for (const s of cab.secoes ?? []) {
    const C = CONSTRUTOR[s.tipo];
    if (!C) throw new Error(`save: tipo de seção desconhecido (${s.tipo})`);
    if (!Number.isInteger(s.offset) || s.offset < 0 || s.offset % SAVE.alinhamento || !Number.isInteger(s.n) || s.n < 0) {
      throw new Error(`save danificado (seção ${s.nome})`);
    }
    const ini = iniBin + s.offset;
    if (ini + s.bytes > bytes.length || s.bytes !== s.n * C.BYTES_PER_ELEMENT) throw new Error(`save cortado (${s.nome})`);
    // cópia alinhada (o buffer de entrada pode não estar alinhado ao tipo)
    const copia = new Uint8Array(s.bytes);
    copia.set(bytes.subarray(ini, ini + s.bytes));
    secoes.set(s.nome, new C(copia.buffer));
  }
  return { cab, secoes, bandeiras };
}

/** Aplica MIGRACOES até a versão atual. */
export function migrar(lido) {
  let v = lido.cab.versaoSave;
  if (!Number.isInteger(v) || v < 1) throw new Error('save sem versão');
  if (v > SAVE.versaoSave) throw new Error(`save de versão mais nova (${v}); atualize o jogo`);
  while (v < SAVE.versaoSave) {
    const m = MIGRACOES[v];
    if (!m) throw new Error(`sem migração da versão ${v}`);
    m(lido.cab, lido.secoes);
    v++;
    lido.cab.versaoSave = v;
  }
  return lido;
}

/**
 * Aplica um save lido numa simulação NOVA com a mesma semente (tabelas, grades, seções JSON, núcleo, formas, tarefas e
 * livro). Não mexe na velocidade: o jogo abre pausado (D10); a velocidade salva está em cab.vista.
 */
export function aplicarSave(sim, { cab, secoes }) {
  if (String(cab.semente) !== String(sim.semente)) throw new Error('save de outra semente');
  const sec = (nome) => {
    const s = secoes.get(nome);
    if (!s) throw new Error(`save: seção faltando (${nome})`);
    return s;
  };
  for (const [nome, meta] of Object.entries(cab.tabelas ?? {})) {
    const t = sim.tabelas[nome];
    if (!t) throw new Error(`save: tabela desconhecida (${nome})`);
    t.garantir(Math.max(meta.n, meta.alto ?? meta.n));
    t.viva.fill(0);
    for (const col of t.nomes) t[col].fill(t.specs[col].padrao);
    t.viva.set(sec(`${nome}.viva`));
    t.ger.fill(0);
    t.ger.set(sec(`${nome}.ger`));
    for (const col of t.nomes) {
      const s = secoes.get(`${nome}.${col}`);
      if (s) t[col].set(s);
    }
    t.n = meta.n;
    t.alto = meta.alto ?? meta.n;
    t.refazerLivres();
  }
  for (const [nome, meta] of Object.entries(cab.grades ?? {})) {
    const g = sim.grades[nome];
    if (!g) throw new Error(`save: grade desconhecida (${nome})`);
    const s = sec(`grade.${nome}`);
    if (s.length !== g.dados.length) throw new Error(`save: grade ${nome} com tamanho ${s.length}`);
    g.dados.set(s);
  }
  for (const [nome, dados] of Object.entries(cab.json ?? {})) {
    if (!sim.json[nome]) continue; // seção de um domínio que não existe nesta montagem
    trocarConteudo(sim.json[nome], decodificar(dados, secoes));
  }
  sim.definirNucleo(cab.nucleo);
  sim.formas.deSalvar(decodificar(cab.formas, secoes));
  sim.tarefas.deSalvar(decodificar(cab.tarefas, secoes));
  sim.livro.deJSON(cab.livro);
  for (const fn of sim._aoCarregar) fn(sim);
  sim.mudancas.tudoGeral();
  sim.emitir('carregado', { tique: sim.tique });
  sim._entregar();
  return sim;
}

/**
 * Abre um save (cru ou gzip) numa simulação nova feita por criar({ semente, mapa }). Valida e confere o hash.
 * O diário do app (U2a) reproduz os comandos depois disso, antes de trocar a simulação da tela.
 * @returns {Promise<{ sim: object, cab: object, erros: { nome: string, erro: string }[] }>}
 */
export async function abrirSave(bytes, criar) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  const cru = ehGzip(bytes) ? await descomprimir(bytes) : bytes;
  const lido = lerSave(cru);
  const versaoGravada = lido.cab.versaoSave;
  migrar(lido);
  const sim = criar({ semente: lido.cab.semente, mapa: lido.cab.mapa });
  aplicarSave(sim, lido);
  const erros = sim.validar();
  // depois de uma migração o hash gravado é o da versão velha: só confere save da versão atual
  if (versaoGravada === SAVE.versaoSave && hashEstado(sim) !== lido.cab.hash) {
    erros.push({ nome: 'hash', erro: 'o estado carregado não bate com o hash gravado' });
  }
  return { sim, cab: lido.cab, erros };
}

/** Save pronto para gravar: gzip (padrão) ou cru (segundo plano, D31). */
export async function salvar(sim, { comprimido = true, ...op } = {}) {
  const cru = montarSave(sim, { ...op, comprimido });
  return comprimido ? comprimir(cru) : cru;
}
