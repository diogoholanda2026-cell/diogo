// Texturas dos prédios (D45): o mapa de detalhe da fachada, feito uma vez na carga. Ruído de valor periódico (o mosaico
// fecha nas bordas) em quatro canais: R manchas grandes (umidade, tom do pano), G sujeira média e escorrido, B grão fino
// do reboco e do concreto, A livre. O shader lê em metros da fachada (escala 0,11 e 0,53), de modo que o detalhe não
// estica com o tamanho do prédio. Lado B do A/B (D46, ?materiais=cc0): carregarDetalheCC0() troca o mapa pela foto
// CC0 de reboco ou concreto em KTX2 ('fachada-detalhe' na lista de texturas da montagem), quando ela existir.

const LADO = 256;

function hashP(i, j, p, s) {
  const x = ((i % p) + p) % p;
  const y = ((j % p) + p) % p;
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Ruído de valor periódico com período p células, em (u, v) de 0 a 1. */
function valor(u, v, p, s) {
  const x = u * p;
  const y = v * p;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const a = fx * fx * (3 - 2 * fx);
  const b = fy * fy * (3 - 2 * fy);
  const h00 = hashP(i, j, p, s);
  const h10 = hashP(i + 1, j, p, s);
  const h01 = hashP(i, j + 1, p, s);
  const h11 = hashP(i + 1, j + 1, p, s);
  return h00 + (h10 - h00) * a + (h01 - h00) * b + (h00 - h10 - h01 + h11) * a * b;
}

function fbm(u, v, p0, oitavas, s) {
  let t = 0;
  let amp = 0.5;
  let soma = 0;
  let p = p0;
  for (let k = 0; k < oitavas; k++) {
    t += amp * valor(u, v, p, s + k * 13);
    soma += amp;
    amp *= 0.5;
    p *= 2;
  }
  return t / soma;
}

/** Os bytes RGBA do mapa de detalhe (puro, testável no Node). */
export function bytesDetalhe(lado = LADO) {
  const d = new Uint8Array(lado * lado * 4);
  for (let j = 0; j < lado; j++) {
    for (let i = 0; i < lado; i++) {
      const u = i / lado;
      const v = j / lado;
      const k = 4 * (j * lado + i);
      const manchas = fbm(u, v, 4, 4, 1);
      // escorrido: ruído esticado na vertical (período baixo em v)
      const esc = fbm(u, v * 0.25, 16, 3, 2) * 0.6 + fbm(u, v, 8, 3, 3) * 0.4;
      const grao = fbm(u, v, 64, 2, 4);
      d[k] = Math.round(255 * Math.min(1, Math.max(0, (manchas - 0.5) * 1.8 + 0.5)));
      d[k + 1] = Math.round(255 * Math.min(1, Math.max(0, (esc - 0.5) * 2 + 0.5)));
      d[k + 2] = Math.round(255 * grao);
      d[k + 3] = 255;
    }
  }
  return d;
}

let promessaCC0 = null;

/**
 * Detalhe fotográfico CC0 da fachada (KTX2 2D listado em window.__HELD_MONTAGEM__.texturas['fachada-detalhe'], com o
 * transcodificador Basis de montagem.basis). A foto entra nos três canais que o shader lê (manchas, escorrido, grão)
 * pela luminância dela. Sem arquivo ou sem transcodificador, resolve null e a fachada fica procedural.
 * @returns {Promise<object | null>}
 */
export function carregarDetalheCC0({ renderer, THREE, montagem = null }) {
  if (promessaCC0) return promessaCC0;
  const m = montagem ?? globalThis.__HELD_MONTAGEM__ ?? null;
  const arquivo = m?.texturas?.['fachada-detalhe'];
  if (!arquivo || !m?.basis) return (promessaCC0 = Promise.resolve(null));
  promessaCC0 = (async () => {
    try {
      const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
      const l = new KTX2Loader().setTranscoderPath(m.basis.endsWith('/') ? m.basis : `${m.basis}/`).detectSupport(renderer);
      const tex = await l.loadAsync(arquivo);
      l.dispose();
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = 4;
      tex.colorSpace = THREE.NoColorSpace;
      tex.userData.fonte = 'cc0';
      return tex;
    } catch (e) {
      console.warn('fachada: detalhe CC0 não carregou; fica o procedural', e);
      return null;
    }
  })();
  return promessaCC0;
}

/** Registra o mapa de detalhe da fachada ('fachadaDetalhe'). */
export function registrar(api) {
  api.registrarTextura('fachadaDetalhe', ({ THREE }) => {
    const t = new THREE.DataTexture(bytesDetalhe(), LADO, LADO, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    t.name = 'fachadaDetalhe';
    return t;
  });
}
