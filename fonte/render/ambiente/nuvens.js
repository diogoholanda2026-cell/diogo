// Nuvens (D9, desenho do render 2.1): os parâmetros das nuvens 2D do céu (cobertura pelo clima do espelho, deriva
// com o vento) e a sombra delas no chão, uma textura de ruído que anda com o vento, lida pelo gancho 'sombra' (uma
// leitura por pixel). A deriva segue a hora do céu, não o relógio: com o jogo pausado as nuvens param, e a mesma cena
// sai igual em duas capturas. No Leve não há nuvens no céu nem sombra delas.
import * as THREE from 'three';

/** Ruído de valor periódico (azulejável) em [0, 1], determinístico. */
function hash2(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Textura de ruído fbm azulejável (R8, tam x tam) para a sombra das nuvens.
 * @returns {Uint8Array}
 */
export function ruidoNuvem(tam = 256, periodo = 6, oitavas = 4) {
  const out = new Uint8Array(tam * tam);
  const f = new Float32Array(tam * tam);
  let mn = Infinity;
  let mx = -Infinity;
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let v = 0;
      let amp = 0.5;
      for (let o = 0; o < oitavas; o++) {
        const p = periodo << o;
        const fx = (x / tam) * p;
        const fy = (y / tam) * p;
        const i = Math.floor(fx);
        const j = Math.floor(fy);
        const tx = fx - i;
        const ty = fy - j;
        const u = tx * tx * (3 - 2 * tx);
        const w = ty * ty * (3 - 2 * ty);
        const a = hash2(i % p, j % p, o);
        const b = hash2((i + 1) % p, j % p, o);
        const c = hash2(i % p, (j + 1) % p, o);
        const d = hash2((i + 1) % p, (j + 1) % p, o);
        v += amp * (a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w);
        amp *= 0.5;
      }
      f[y * tam + x] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  for (let k = 0; k < f.length; k++) out[k] = Math.round(((f[k] - mn) / (mx - mn)) * 255);
  return out;
}

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Nuvens {
  constructor(ctx) {
    this.ctx = ctx;
    this.u = ctx.ganchos.uniformes;
    const tam = 256;
    this.textura = new THREE.DataTexture(ruidoNuvem(tam), tam, tam, THREE.RedFormat, THREE.UnsignedByteType);
    this.textura.wrapS = this.textura.wrapT = THREE.RepeatWrapping;
    this.textura.minFilter = THREE.LinearMipmapLinearFilter;
    this.textura.magFilter = THREE.LinearFilter;
    this.textura.generateMipmaps = true;
    this.textura.needsUpdate = true;
    this.horas = 0; // horas de céu andadas
    this.horaAnt = null;
    // a deriva soma o vento de cada quadro: uma troca de vento muda o rumo sem teleportar as nuvens
    this.derivaCeu = [0, 0]; // passo das nuvens do céu
    this.derivaChao = [0, 0]; // deslocamento da sombra no chão, na fração da textura que se repete
    this.noCeu = true;
    this.noChao = true;
  }

  configurar(perfil) {
    this.noCeu = perfil.ceu?.nuvens !== false;
    this.noChao = perfil.nuvemSombra !== false;
  }

  /**
   * @param {number} dt  segundos reais (sem uso: a deriva anda com a hora do céu)
   * @param {{ nuvens?: number, vento?: number[] }} clima
   * @param {object} est  estado do céu
   * @param {import('./ceu.js').Ceu} ceu
   */
  atualizar(dt, clima, est, ceu) {
    const hora = this.ctx.horaDoCeu();
    const dh = this.horaAnt === null ? 0 : ((((hora - this.horaAnt + 36) % 24) + 24) % 24) - 12;
    this.horaAnt = hora;
    this.horas += dh;
    const cob = Math.min(1, Math.max(0, clima?.nuvens ?? 0.3));
    const v = clima?.vento ?? [3, 1];
    const vn = Math.hypot(v[0], v[1]) || 1;
    const vx = v[0] / vn;
    const vz = v[1] / vn;
    ceu.nuvem.set(this.noCeu ? cob : 0, 0.45, 0.00018, 0.5);
    this.derivaCeu[0] += dh * 0.0009 * vx;
    this.derivaCeu[1] += dh * 0.0009 * vz;
    ceu.nuvemPasso.set(this.derivaCeu[0], this.derivaCeu[1]);
    // sombra no chão: some de noite e com o sol rente; a nuvem a ~1.500 m anda uns 20 km por ciclo
    const s = est.P.sol;
    const forca = this.noChao ? 0.42 * suave(0.03, 0.2, s[1]) * suave(0.02, 0.12, cob) : 0;
    const escala = 1 / 5200;
    // a textura se repete (RepeatWrapping): só a fração da deriva importa, e o float32 do shader não perde precisão
    // depois de anos de jogo
    const k = dh * 900 * escala;
    this.derivaChao[0] = (this.derivaChao[0] + k * vx) % 1;
    this.derivaChao[1] = (this.derivaChao[1] + k * vz) % 1;
    const sy = Math.max(s[1], 0.12);
    this.u.gNuvemMapa.value = this.textura;
    this.u.gNuvemParams.value.set(escala, forca, 1 - 0.92 * cob, 0);
    this.u.gNuvemDesloc.value.set(this.derivaChao[0], this.derivaChao[1], s[0] / sy, s[2] / sy);
  }

  descartar() {
    this.textura.dispose();
  }
}

export function registrar() {}
