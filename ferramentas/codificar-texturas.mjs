// Codifica o detalhe fotográfico CC0 do chão (D46) num KTX2 com 8 fatias, na ordem de PALETA_CHAO, com o codificador
// Basis Universal em wasm (versão fixa: ktx2-encoder 0.6.0, que traz o basis_encoder.wasm).
//
//   node ferramentas/codificar-texturas.mjs [--baixar] [--fonte arte/materiais/fonte] [--saida arte/materiais/chao-camadas.ktx2]
//        [--lado 1024] [--codificador <caminho do basis_encoder.js>] [--uastc] [--sem-licenca]
//
// Entrada: uma foto por camada em --fonte, com o nome do id da camada (grama.jpg, capim.png, terraRoxa.jpg, ...) e,
// se houver, a altura (deslocamento) em <id>-altura.<ext>. As fotos não vão para o git: arte/materiais/fontes.json diz
// de onde cada uma vem (material da ambientCG, espelhos e sha256) e --baixar refaz a pasta, conferindo o sha256 (atrás
// de proxy, rode com NODE_USE_ENV_PROXY=1). A licença é conferida: cada camada precisa do material listado em
// arte/LICENCAS.md e, se fontes.json a descreve, o arquivo tem de ter o sha256 de lá (--sem-licenca pula, só para teste).
// O que sai por fatia: rgb = a foto dividida pela própria média e posta em 0,5 (o chão multiplica pela cor da paleta:
// o longe e o perto ficam com a mesma cor média), a = altura (a do arquivo ou a luminância da foto). Mipmaps no KTX2.
// A foto é lida e recortada em quadrado no Chromium de teste (sem dependência de imagem no Node).
// Falha acima do teto de 8 MB das texturas (A1). O montar.mjs leva o .ktx2 de arte/materiais/ para a montagem; o jogo
// só usa se a montagem também trouxer o transcodificador (basis_transcoder.js e .wasm do three) na pasta de
// window.__HELD_MONTAGEM__.basis ou, sem ela, em basis/ ao lado do index (ver carregarCC0 em texturas-chao.js).
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname, extname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PALETA_CHAO } from '../fonte/render/materiais/shaders/terreno.glsl.js';
import { abrirChromium } from './testar.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TETO_BYTES = 8 * 1024 * 1024;
const EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function lerArgs(argv) {
  const o = { fonte: 'arte/materiais/fonte', saida: 'arte/materiais/chao-camadas.ktx2', lado: 1024, codificador: null, uastc: false, licenca: true, baixar: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--fonte') o.fonte = argv[++i];
    else if (k === '--saida') o.saida = argv[++i];
    else if (k === '--lado') o.lado = +argv[++i];
    else if (k === '--codificador') o.codificador = argv[++i];
    else if (k === '--uastc') o.uastc = true;
    else if (k === '--sem-licenca') o.licenca = false;
    else if (k === '--baixar') o.baixar = true;
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return o;
}

/** Arquivos de uma camada na pasta: { foto, altura } (caminhos) ou null. */
export function arquivosDaCamada(pasta, id) {
  if (!existsSync(pasta)) return null;
  const nomes = readdirSync(pasta);
  const achar = (base) => nomes.find((n) => basename(n, extname(n)) === base && EXTS.includes(extname(n).toLowerCase()));
  const foto = achar(id);
  if (!foto) return null;
  const alt = achar(`${id}-altura`);
  return { foto: join(pasta, foto), altura: alt ? join(pasta, alt) : null };
}

/**
 * Normaliza uma foto RGBA (lado x lado) para o formato das fatias: rgb dividido pela média do canal e posto em 0,5;
 * a = altura (de outra imagem RGBA, pela luminância, ou da própria foto), também com média 0,5.
 */
export function normalizarFatia(rgba, altura = null) {
  const n = rgba.length / 4;
  const soma = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) soma[c] += rgba[4 * i + c];
  const media = soma.map((s) => Math.max(1, s / n));
  const fonteAlt = altura ?? rgba;
  let somaL = 0;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lum[i] = 0.2126 * fonteAlt[4 * i] + 0.7152 * fonteAlt[4 * i + 1] + 0.0722 * fonteAlt[4 * i + 2];
    somaL += lum[i];
  }
  const mediaL = Math.max(1, somaL / n);
  const out = new Uint8Array(rgba.length);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out[4 * i + c] = Math.min(255, Math.round((rgba[4 * i + c] / media[c]) * 127.5));
    out[4 * i + 3] = Math.min(255, Math.round((lum[i] / mediaL) * 127.5));
  }
  return out;
}

export const MANIFESTO = 'arte/materiais/fontes.json';
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** O manifesto das fotos (arte/materiais/fontes.json) ou null. */
export function lerManifesto(raiz = RAIZ) {
  const c = join(raiz, MANIFESTO);
  return existsSync(c) ? JSON.parse(readFileSync(c, 'utf8')) : null;
}

/**
 * Baixa as fotos do manifesto para a pasta (grama.jpg, grama-altura.jpg, ...), tentando cada espelho até um dar o
 * sha256 certo. Arquivo que já está lá com o sha256 certo fica. Devolve a lista do que baixou.
 */
export async function baixarFontes(manifesto, pasta, { buscar = globalThis.fetch } = {}) {
  mkdirSync(pasta, { recursive: true });
  const feitos = [];
  for (const [id, c] of Object.entries(manifesto.camadas)) {
    for (const [papel, sufixo] of [['cor', ''], ['altura', '-altura']]) {
      const f = c[papel];
      if (!f) continue;
      const destino = join(pasta, `${id}${sufixo}.jpg`);
      if (existsSync(destino) && sha256(readFileSync(destino)) === f.sha256) continue;
      let ok = false;
      const erros = [];
      for (const e of f.espelhos) {
        const [dono, repo, ...cam] = e.split('/');
        const url = `https://raw.githubusercontent.com/${dono}/${repo}/HEAD/${cam.map(encodeURIComponent).join('/')}`;
        try {
          const r = await buscar(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const buf = Buffer.from(await r.arrayBuffer());
          if (sha256(buf) !== f.sha256) throw new Error('sha256 diferente do manifesto');
          writeFileSync(destino, buf);
          feitos.push(`${id}${sufixo}.jpg (${c.ambientcg}, de ${dono}/${repo})`);
          ok = true;
          break;
        } catch (err) {
          erros.push(`${dono}/${repo}: ${err.message}`);
        }
      }
      if (!ok) throw new Error(`não consegui ${id}${sufixo}.jpg (${c.ambientcg}): ${erros.join('; ')}. Atrás de proxy, rode com NODE_USE_ENV_PROXY=1`);
    }
  }
  return feitos;
}

/**
 * Confere a licença dos arquivos de cada camada: o material (ou o nome do arquivo) tem de estar em LICENCAS.md e, se o
 * manifesto descreve o arquivo, o sha256 tem de bater. Devolve a lista de problemas (vazia = ok).
 */
export function conferirLicencas(arquivos, licencas, manifesto = null) {
  const problemas = [];
  for (const a of arquivos) {
    const c = manifesto?.camadas?.[a.id];
    for (const [papel, f] of [['cor', a.foto], ['altura', a.altura]]) {
      if (!f) continue;
      const nome = basename(f);
      const esperado = c?.[papel]?.sha256;
      if (c && esperado) {
        if (!licencas.includes(c.ambientcg)) problemas.push(`${nome}: ${c.ambientcg} fora de arte/LICENCAS.md`);
        else if (sha256(readFileSync(f)) !== esperado) problemas.push(`${nome}: sha256 diferente do de ${MANIFESTO}`);
      } else if (!licencas.includes(nome)) problemas.push(`${nome}: sem licença em arte/LICENCAS.md`);
    }
  }
  return problemas;
}

/** Lê e recorta as imagens no Chromium: devolve RGBA lado x lado de cada arquivo. */
async function lerImagens(caminhos, lado) {
  const browser = await abrirChromium({ gl: false });
  try {
    const page = await (await browser.newContext()).newPage();
    const out = [];
    for (const c of caminhos) {
      const b64 = readFileSync(c).toString('base64');
      const tipo = extname(c).toLowerCase() === '.png' ? 'image/png' : extname(c).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg';
      const px = await page.evaluate(async ({ b64, tipo, lado }) => {
        const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bin], { type: tipo }));
        const s = Math.min(bmp.width, bmp.height);
        const cv = new OffscreenCanvas(lado, lado);
        const g = cv.getContext('2d');
        g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, lado, lado);
        const d = g.getImageData(0, 0, lado, lado).data;
        let bin2 = '';
        for (let i = 0; i < d.length; i += 32768) bin2 += String.fromCharCode(...d.subarray(i, i + 32768));
        return btoa(bin2);
      }, { b64, tipo, lado });
      out.push(new Uint8Array(Buffer.from(px, 'base64')));
    }
    return out;
  } finally {
    await browser.close();
  }
}

/** O módulo Basis (codificador em wasm). */
async function carregarBasis(caminho) {
  const alvo = caminho ? resolve(caminho) : join(RAIZ, 'node_modules/ktx2-encoder/dist/basis/basis_encoder.js');
  if (!existsSync(alvo)) {
    throw new Error(`codificador Basis não encontrado em ${alvo}. Instale ktx2-encoder 0.6.0 (devDependencies) ou passe --codificador <basis_encoder.js>`);
  }
  const BASIS = (await import(pathToFileURL(alvo).href)).default;
  const m = await BASIS();
  m.initializeBasis();
  return m;
}

/** Codifica as fatias RGBA (lado x lado) num KTX2 de textura em camadas, com mipmaps. */
export async function codificarKTX2(fatias, lado, { codificador = null, uastc = false } = {}) {
  const m = await carregarBasis(codificador);
  const enc = new m.BasisEncoder();
  try {
    enc.setDebug(false);
    enc.setCreateKTX2File(true);
    enc.setTexType(1); // cBASISTexType2DArray
    enc.setUASTC(!!uastc);
    enc.setMipGen(true);
    enc.setPerceptual(false); // são multiplicadores e altura, não cor para a tela
    if (enc.setKTX2AndBasisSRGBTransferFunc) enc.setKTX2AndBasisSRGBTransferFunc(false);
    else enc.setKTX2SRGBTransferFunc(false);
    if (uastc) enc.setKTX2UASTCSupercompression(true);
    else enc.setQualityLevel(200);
    fatias.forEach((f, i) => {
      if (enc.setSliceSourceImage(i, f, lado, lado, 0) === false) throw new Error(`fatia ${i} recusada pelo codificador`);
    });
    const saida = new Uint8Array(Math.ceil(lado * lado * 4 * fatias.length * 1.4) + 65536);
    const n = enc.encode(saida);
    if (!n) throw new Error('o codificador Basis não gerou nada');
    return saida.slice(0, n);
  } finally {
    enc.delete();
  }
}

export async function codificar(o) {
  const pasta = resolve(RAIZ, o.fonte);
  const licencas = existsSync(join(RAIZ, 'arte/LICENCAS.md')) ? readFileSync(join(RAIZ, 'arte/LICENCAS.md'), 'utf8') : '';
  const manifesto = lerManifesto();
  if (o.baixar) {
    if (!manifesto) throw new Error(`--baixar sem ${MANIFESTO}`);
    for (const f of await baixarFontes(manifesto, pasta)) console.log(`baixado: ${f}`);
  }
  const arquivos = PALETA_CHAO.map((c) => ({ id: c.id, ...(arquivosDaCamada(pasta, c.id) ?? {}) }));
  const faltam = arquivos.filter((a) => !a.foto).map((a) => a.id);
  if (faltam.length) throw new Error(`faltam fotos em ${o.fonte}: ${faltam.join(', ')} (uma por camada, com o id no nome; --baixar as traz do manifesto)`);
  if (o.licenca) {
    const problemas = conferirLicencas(arquivos, licencas, manifesto);
    if (problemas.length) throw new Error(`licença: ${problemas.join('; ')}`);
  }
  const lista = arquivos.flatMap((a) => [a.foto, a.altura ?? a.foto]);
  const px = await lerImagens(lista, o.lado);
  const fatias = arquivos.map((a, i) => normalizarFatia(px[2 * i], a.altura ? px[2 * i + 1] : null));
  const ktx = await codificarKTX2(fatias, o.lado, o);
  if (ktx.byteLength > TETO_BYTES) throw new Error(`${(ktx.byteLength / 1048576).toFixed(1)} MB passam do teto de 8 MB (A1)`);
  const saida = resolve(RAIZ, o.saida);
  mkdirSync(dirname(saida), { recursive: true });
  writeFileSync(saida, ktx);
  return { saida, bytes: ktx.byteLength, camadas: arquivos.map((a) => a.id) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const r = await codificar(lerArgs(process.argv.slice(2)));
    console.log(`codificado: ${r.saida} (${(r.bytes / 1024).toFixed(0)} KB, ${r.camadas.length} camadas: ${r.camadas.join(', ')})`);
  } catch (e) {
    console.error('codificar-texturas: ' + e.message);
    process.exit(1);
  }
}
