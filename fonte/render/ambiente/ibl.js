// Luz do ambiente (D9, desenho do render 2.2): o PMREM sai do MESMO céu (sem os discos, com o chão refletido abaixo
// do horizonte, na unidade do sol) em 8 quadros-chave por ciclo, postos onde a luz muda depressa (antes, no e depois
// do nascer e do pôr, meio-dia e meia-noite), e a cena lê a mistura dos dois quadros-chave vizinhos, feita texel a
// texel num alvo do mesmo tamanho (uma chamada barata por quadro, só quando a mistura muda). Um quadro-chave novo
// (um cubo pequeno e o PMREM) sai em fatias, uma face por quadro e o PMREM no sétimo, só ao cruzar um trecho; os quadros-chave são refeitos
// quando o dia do ano, as nuvens ou o brilho da cidade mudam (este, 10%). Tamanhos: 256 no Ultra, 128 no Alta, 64 no
// Média e 32 no Leve. De noite o PMREM leva o brilho da cidade: vidro e água refletem o céu alaranjado.
// Com o sol baixo a luz do ambiente cai pelo fator do estado do céu (VIS1d, ceu.js, AMBIENTE_SOL_BAIXO), posto em
// cena.environmentIntensity: um uniforme que o three passa a todo material que lê o ambiente da cena (o chão, pelo
// atlas dele, lê o mesmo número), sem programa novo e sem refazer os quadros-chave.
import * as THREE from 'three';
import { criarMaterialCeu, aplicarEstado, desenharFaces, triangulo } from './ceu.js';
import { TELA_VERTICE, MISTURA } from '../materiais/shaders/pos.glsl.js';

/**
 * As 8 horas dos quadros-chave de um dia (hora do céu, 0 a 24, em ordem).
 * @param {{ nascer: number, por: number, meioDia: number }} np
 */
export function horasChave({ nascer, por, meioDia }) {
  const h = [meioDia + 12, nascer - 1, nascer + 0.2, nascer + 1.6, meioDia, por - 1.6, por - 0.2, por + 1];
  return h.map((x) => ((x % 24) + 24) % 24).sort((a, b) => a - b);
}

/**
 * Trecho e fração da hora entre os quadros-chave (cíclico).
 * @returns {{ i: number, j: number, t: number }} i e j são índices em horas
 */
export function trecho(horas, hora) {
  const n = horas.length;
  for (let k = 0; k < n; k++) {
    const a = horas[k];
    const b = k + 1 < n ? horas[k + 1] : horas[0] + 24;
    const hh = hora < a ? hora + 24 : hora;
    if (hh >= a && hh < b) return { i: k, j: (k + 1) % n, t: (hh - a) / (b - a) };
  }
  return { i: n - 1, j: 0, t: 0 };
}

export class Ibl {
  constructor(ctx, amb) {
    this.ctx = ctx;
    this.amb = amb;
    this.cena = new THREE.Scene();
    this.malha = new THREE.Mesh(triangulo(), null);
    this.malha.frustumCulled = false;
    this.cena.add(this.malha);
    this.camTela = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mistura = new THREE.ShaderMaterial({
      name: 'ibl-mistura',
      uniforms: { tA: { value: null }, tB: { value: null }, uT: { value: 0 } },
      vertexShader: TELA_VERTICE,
      fragmentShader: MISTURA,
      depthTest: false,
      depthWrite: false,
    });
    this.pmrem = new THREE.PMREMGenerator(ctx.renderer);
    this.chaves = new Map(); // chave -> { rt, uso }
    this.alvoMistura = null;
    this.pedido = { i: null, j: null, t: 0 };
    this.feito = { a: null, b: null, t: -1 };
    this.estKey = {};
    this.gerados = 0;
    this.fator = 1; // a luz do ambiente com o sol baixo (cena.environmentIntensity)
  }

  configurar(perfil) {
    const tam = perfil.ibl ?? 64;
    const nuvens = perfil.ceu?.nuvens !== false;
    if (this.tam === tam && this.nuvens === nuvens) return;
    this.descartarAlvos();
    this.tam = tam;
    this.nuvens = nuvens;
    this.mat = criarMaterialCeu('ibl', { nuvens });
    this.cubo = new THREE.WebGLCubeRenderTarget(tam, { type: THREE.HalfFloatType, generateMipmaps: false, depthBuffer: false });
  }

  /** Assinatura do que muda um quadro-chave além da hora (dia do ano, nuvens, brilho da cidade). */
  assinatura() {
    const tempo = this.amb.tempoCeu?.() ?? this.ctx.sim?.espelho?.tempo;
    const dia = Math.round((tempo?.diaDoAno ?? 0) / 5);
    const nuv = Math.round((tempo?.clima?.nuvens ?? 0.3) * 20);
    const cid = Math.round(Math.log(Math.max(0.01, this.amb.brilhoCidade)) / Math.log(1.1));
    return `${dia}|${nuv}|${cid}|${this.tam}`;
  }

  /** Escolhe o trecho da hora (os passes vêm depois, no quadro) e põe o fator do sol baixo na cena. */
  atualizar(hora, est = null) {
    this.fator = est?.kAmb ?? 1;
    this.ctx.cena.environmentIntensity = this.fator;
    const horas = horasChave(this.amb.nascerEPor());
    const { i, j, t } = trecho(horas, hora);
    const sig = this.assinatura();
    this.pedido = { a: `${horas[i].toFixed(2)}|${sig}`, ha: horas[i], b: `${horas[j].toFixed(2)}|${sig}`, hb: horas[j], t };
  }

  /** Estado do céu na hora do quadro-chave nos uniformes do material dele. */
  prepararChave(hora) {
    const { ast, est } = this.amb.estadoNaHora(hora, this.estKey);
    aplicarEstado(this.mat, est, ast, { nuvem: this.amb.ceu.nuvem, nuvemPasso: this.amb.ceu.nuvemPasso });
  }

  /** Um quadro-chave inteiro de uma vez (na carga): o céu naquela hora num cubo pequeno e o PMREM dele. */
  gerar(renderer, hora) {
    this.prepararChave(hora);
    desenharFaces(renderer, this.cubo, this.mat, this.cena, this.camTela);
    this.gerados++;
    return this.pmrem.fromCubemap(this.cubo.texture);
  }

  /**
   * Passes do quadro. Na carga os dois quadros-chave saem de uma vez; depois, um quadro-chave novo sai em fatias
   * (uma face do cubo por quadro e o PMREM no sétimo), e a mistura antiga segue valendo até ele ficar pronto.
   * @returns {number} 1 se fez uma fatia de quadro-chave (o céu do fundo pula a face dele neste quadro)
   */
  passes(renderer, medidas) {
    if (!this.mat) return 0;
    const { a, b, ha, hb, t } = this.pedido;
    if (!a) return 0;
    const faz = (fn) => (medidas ? medidas.passe(fn) : fn());
    const falta = [[a, ha], [b, hb]].filter(([k]) => !this.chaves.has(k));
    let fatia = 0;
    if (falta.length) {
      if (!this.chaves.size) {
        for (const [k, h] of falta) faz(() => this.chaves.set(k, { rt: this.gerar(renderer, h), uso: 0 }));
      } else {
        const [k, h] = falta[0];
        if (this.gerando?.k !== k) {
          this.gerando = { k, face: 0 };
          this.prepararChave(h);
        }
        const g = this.gerando;
        if (g.face < 6) {
          faz(() => desenharFaces(renderer, this.cubo, this.mat, this.cena, this.camTela, g.face, g.face + 1));
          g.face++;
        } else {
          faz(() => this.chaves.set(k, { rt: this.pmrem.fromCubemap(this.cubo.texture), uso: 0 }));
          this.gerados++;
          this.gerando = null;
        }
        fatia = 1;
        if (!this.chaves.has(a) || !this.chaves.has(b)) return fatia;
      }
    }
    // guarda só os usados agora e o anterior (a volta do trecho não refaz)
    for (const [k, v] of this.chaves) {
      if (k === a || k === b) v.uso = 0;
      else if (++v.uso > 2) {
        v.rt.dispose();
        this.chaves.delete(k);
      }
    }
    const A = this.chaves.get(a).rt;
    const B = this.chaves.get(b).rt;
    if (this.feito.a === a && this.feito.b === b && Math.abs(this.feito.t - t) < 0.002 && this.alvoMistura) return fatia;
    if (!this.alvoMistura || this.alvoMistura.width !== A.width || this.alvoMistura.height !== A.height) {
      this.alvoMistura?.dispose();
      this.alvoMistura = new THREE.WebGLRenderTarget(A.width, A.height, {
        type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: false,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.LinearSRGBColorSpace,
      });
      this.alvoMistura.texture.mapping = THREE.CubeUVReflectionMapping;
      this.alvoMistura.texture.name = 'ibl.mistura';
    }
    const u = this.mistura.uniforms;
    u.tA.value = A.texture;
    u.tB.value = B.texture;
    u.uT.value = t;
    this.malha.material = this.mistura;
    faz(() => {
      const antes = renderer.getRenderTarget();
      renderer.setRenderTarget(this.alvoMistura);
      renderer.render(this.cena, this.camTela);
      renderer.setRenderTarget(antes);
    });
    this.feito = { a, b, t };
    this.ctx.cena.environment = this.alvoMistura.texture;
    return fatia;
  }

  descartarAlvos() {
    for (const v of this.chaves.values()) v.rt.dispose();
    this.chaves.clear();
    this.alvoMistura?.dispose();
    this.alvoMistura = null;
    this.cubo?.dispose();
    this.mat?.dispose();
    this.feito = { a: null, b: null, t: -1 };
    this.gerando = null;
    if (this.ctx.cena.environment?.name === 'ibl.mistura') this.ctx.cena.environment = null;
    this.ctx.cena.environmentIntensity = 1;
  }

  descartar() {
    this.descartarAlvos();
    this.pmrem.dispose();
    this.mistura.dispose();
    this.malha.geometry.dispose();
  }
}

export function registrar() {}
