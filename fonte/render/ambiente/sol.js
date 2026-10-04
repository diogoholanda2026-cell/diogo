// Luz direta do sol ou da lua (D9, D43, desenho do render 2.1 e 2.5): uma DirectionalLight do three SEM sombra (a
// sombra é a própria, render/sombra/mapa.js, lida pelo gancho 'sombra'). Cor e intensidade saem do mesmo modelo do
// céu (ambiente/ceu.js): de manhã e à tarde o sol esquenta sozinho pela extinção do ar, sem tinta. De noite a luz
// chave é a lua (azulada, fraca, pela fase); entre os dois, no crepúsculo, a luz direta some e fica a do céu. A
// direção da luz chave vai para ctx.sol.dir (a sombra anda com ela, em degraus menores com o sol baixo) e a força da
// sombra cai com a luz.
import * as THREE from 'three';

const RAD = Math.PI / 180;
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Menor fração do degrau do perfil com o sol baixo (VIS1d). */
export const DEGRAU_SOL_BAIXO = 0.25;

/**
 * Degrau do sol da sombra própria (rad) pela elevação dele (VIS1d). Com o sol baixo a ponta de uma sombra longa anda
 * muito a cada grau (h / sen² e por radiano: a do anel de 160 m anda uns 110 m por grau com o sol a 9 graus, a da
 * Blade Tower uns 350 m), e o mapa de perto, refeito a cada degrau, a fazia pular. O degrau do perfil cai com sen² e
 * abaixo de 30 graus, até um quarto dele: a ponta anda em passos de uns 25 m. Acima de 30 graus, o do perfil. O mapa
 * sai mais vezes só no começo e no fim do dia (um passe de projetores; medido na aérea, ~0,1 ms na RX 550).
 * @example degrauDoSol(RAD, 60 * RAD) === RAD
 */
export function degrauDoSol(base, elev) {
  const s = Math.sin(Math.max(0, elev));
  return base * Math.min(1, Math.max(DEGRAU_SOL_BAIXO, (s * s) / 0.25));
}
const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Sol {
  constructor(ctx) {
    this.ctx = ctx;
    this.luz = new THREE.DirectionalLight(0xffffff, 1);
    this.luz.castShadow = false;
    this.luz.name = 'ambiente:sol';
    ctx.cena.add(this.luz, this.luz.target);
    this.dir = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
    this.chave = 'sol';
    this.intensidade = 0;
    if (ctx.sombra) ctx.sombra.vista = ctx.camera; // o foco da sombra de perto segue o que a vista mostra
  }

  /** Sombra pelo perfil: cascatas, degrau do sol (1,5 grau no Média, 1 no PC) e amostras do PCF. */
  configurar(perfil) {
    const s = this.ctx.sombra;
    if (!s) return;
    const p = perfil.sombra;
    const ligada = p.tam > 0 && p.ligada !== false;
    if (s.definirCascatas) s.definirCascatas(p.cascatas ?? 1);
    // sem sombra (Leve) fica um alvo mínimo: o gSombraMapa precisa de uma textura de profundidade válida
    s.redimensionar(ligada ? p.tam : 16);
    this.degrauBase = (p.degrau ?? 1.5) * RAD;
    s.degrau = this.degrauBase;
    s.amostras = p.pcf ?? 5;
    s.raioPcf = p.raioPcf ?? 1.2;
    s.ligada = ligada;
  }

  /**
   * @param {object} ast  astros do quadro (sol, lua)
   * @param {object} est  estado do céu (solIrr, luaIrr)
   */
  atualizar(ast, est) {
    const eSol = luma(est.solIrr);
    const eLua = luma(est.luaIrr);
    const usaSol = eSol >= eLua || ast.sol.elevacao > -0.02;
    const irr = usaSol ? est.solIrr : est.luaIrr;
    const d = usaSol ? ast.sol.dir : ast.lua.dir;
    const i = luma(irr);
    this.chave = usaSol ? 'sol' : 'lua';
    this.intensidade = i;
    const L = this.luz;
    if (i > 1e-6) L.color.setRGB(irr[0] / i, irr[1] / i, irr[2] / i, THREE.LinearSRGBColorSpace);
    // a luz fica sempre visível, com intensidade 0 quando não há sol nem lua: esconder mudaria o número de luzes
    // direcionais e o three trocaria o programa de todo material no crepúsculo (compilação no Mali, travada)
    L.intensity = i;
    // a direção só muda com luz: no fundo do crepúsculo a sombra não gira à toa
    if (i > 2e-4) this.dir.set(d[0], Math.max(d[1], 0.02), d[2]).normalize();
    const cam = this.ctx.camera;
    L.position.copy(cam.position).addScaledVector(this.dir, 1000);
    L.target.position.copy(cam.position);
    L.updateMatrixWorld();
    L.target.updateMatrixWorld();
    this.ctx.sol.dir.copy(this.dir);
    const so = this.ctx.sombra;
    if (so) {
      so.forca = suave(0.0008, 0.012, i);
      // o degrau do sol encolhe com o sol baixo (a ponta da sombra longa não pula); com a lua, o do perfil
      if (this.degrauBase) so.degrau = usaSol ? degrauDoSol(this.degrauBase, ast.sol.elevacao) : this.degrauBase;
    }
  }

  descartar() {
    this.ctx.cena.remove(this.luz, this.luz.target);
    this.luz.dispose();
  }
}

export function registrar() {}
