// Registro das formas do aplainar (D5): vias, plataformas dos lotes e cavas da Arcologia. As formas são estado (vão
// no save e no hash); a grade final não vai: ao carregar, o aplainar de S1a refaz a altura a partir da base e daqui.
// Registrar ou remover marca o retângulo de influência no diário ('terreno'), que o S1a recalcula.
import { caixaDePontos } from '../comum/vetor.js';
import { FORMA } from '../contratos/interno.js';

/** Alcance da influência de uma forma além do núcleo: faixa plana de 8 m e transição de 16 m. */
export const ALCANCE_FORMA = FORMA.faixaPlana + FORMA.transicao;

const TIPOS = Object.keys(FORMA.ordemTipo);

/**
 * Normaliza e confere uma forma. Via: eixo (triplas x, z, y) e meiaLargura; plataforma e cava: contorno (pares) e cota.
 * @returns {object} a forma com Float64Array e a caixa do núcleo
 */
export function normalizarForma(f) {
  if (!f || !TIPOS.includes(f.tipo)) throw new Error(`forma: tipo inválido (${f?.tipo})`);
  if (!Number.isFinite(f.ref)) throw new Error('forma: ref numérica obrigatória');
  const out = { tipo: f.tipo, ref: f.ref };
  if (f.tipo === 'via') {
    const eixo = Float64Array.from(f.eixo ?? []);
    if (eixo.length < 6 || eixo.length % 3) throw new Error('forma via: eixo com triplas x, z, y (2 pontos ou mais)');
    if (!(f.meiaLargura > 0)) throw new Error('forma via: meiaLargura');
    out.eixo = eixo;
    out.meiaLargura = f.meiaLargura;
    const c = caixaDePontos(eixo, 3);
    out.caixa = [c[0] - f.meiaLargura, c[1] - f.meiaLargura, c[2] + f.meiaLargura, c[3] + f.meiaLargura];
  } else {
    const contorno = Float64Array.from(f.contorno ?? []);
    if (contorno.length < 6 || contorno.length % 2) throw new Error('forma: contorno com pares x, z (3 pontos ou mais)');
    if (!Number.isFinite(f.cota)) throw new Error('forma: cota');
    out.contorno = contorno;
    out.cota = f.cota;
    out.caixa = caixaDePontos(contorno, 2);
  }
  return out;
}

export class Formas {
  /** @param {{ marcarRet?: (x0: number, z0: number, x1: number, z1: number) => void }} op */
  constructor({ marcarRet = null } = {}) {
    this.marcarRet = marcarRet;
    /** @type {Map<number, object>} */
    this.porId = new Map();
    this.seq = 0;
  }

  _marcar(f) {
    if (!this.marcarRet) return;
    const [x0, z0, x1, z1] = f.caixa;
    this.marcarRet(x0 - ALCANCE_FORMA, z0 - ALCANCE_FORMA, x1 + ALCANCE_FORMA, z1 + ALCANCE_FORMA);
  }

  /**
   * Registra uma forma; devolve o id.
   * @example sim.formas.registrar({ tipo: 'plataforma', ref: 5, contorno: [0, 0, 16, 0, 16, 24, 0, 24], cota: 12.4 })
   */
  registrar(forma) {
    const f = normalizarForma(forma);
    f.id = ++this.seq;
    this.porId.set(f.id, f);
    this._marcar(f);
    return f.id;
  }

  /** Remove pelo id. */
  remover(id) {
    const f = this.porId.get(id);
    if (!f) return false;
    this.porId.delete(id);
    this._marcar(f);
    return true;
  }

  /** Remove todas as formas de um tipo e ref (ex.: a via demolida). */
  removerRef(tipo, ref) {
    let n = 0;
    for (const f of this.lista()) if (f.tipo === tipo && f.ref === ref && this.remover(f.id)) n++;
    return n;
  }

  /** Todas, em ordem de id. */
  lista() {
    return [...this.porId.values()].sort((a, b) => a.id - b.id);
  }

  /** Formas cuja influência toca o retângulo, em ordem de id. */
  tocando(x0, z0, x1, z1) {
    const out = [];
    for (const f of this.lista()) {
      const c = f.caixa;
      if (c[0] - ALCANCE_FORMA <= x1 && c[2] + ALCANCE_FORMA >= x0 && c[1] - ALCANCE_FORMA <= z1 && c[3] + ALCANCE_FORMA >= z0) out.push(f);
    }
    return out;
  }

  get tamanho() {
    return this.porId.size;
  }

  /** Para o save (arrays tipados ficam: o formato do save guarda como seção binária). */
  paraSalvar() {
    return { seq: this.seq, lista: this.lista().map((f) => ({ ...f, caixa: undefined })) };
  }

  deSalvar(d) {
    this.porId.clear();
    this.seq = d?.seq ?? 0;
    for (const f of d?.lista ?? []) {
      const g = normalizarForma(f);
      g.id = f.id;
      this.porId.set(g.id, g);
    }
  }
}
