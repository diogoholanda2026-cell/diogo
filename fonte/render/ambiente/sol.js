// Luz direta do sol ou da lua (D9, D43, desenho do render 2.1 e 2.5): uma DirectionalLight do three SEM sombra (a
// sombra é a própria, render/sombra/mapa.js, lida pelo gancho 'sombra'). Cor e intensidade saem do mesmo modelo do
// céu (ambiente/ceu.js): de manhã e à tarde o sol esquenta sozinho pela extinção do ar, sem tinta. De noite a luz
// chave é a lua (azulada, fraca, pela fase); entre os dois, no crepúsculo, a luz direta some e fica a do céu. A
// direção da luz chave vai para ctx.sol.dir (a sombra anda com ela, em degraus) e a força da sombra cai com a luz.
import * as THREE from 'three';

const RAD = Math.PI / 180;
const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
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
  }

  /** Sombra pelo perfil: cascatas, degrau do sol (1,5 grau no Média, 1 no PC) e amostras do PCF. */
  configurar(perfil) {
    const s = this.ctx.sombra;
    if (!s) return;
    const p = perfil.sombra;
    if (s.definirCascatas) s.definirCascatas(p.cascatas ?? 1);
    s.redimensionar(p.tam);
    s.degrau = (p.degrau ?? 1.5) * RAD;
    s.amostras = p.pcf ?? 5;
    s.raioPcf = p.raioPcf ?? 1.2;
    s.ligada = p.tam > 0 && p.ligada !== false;
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
    L.intensity = i;
    L.visible = i > 1e-5;
    // a direção só muda com luz: no fundo do crepúsculo a sombra não gira à toa
    if (i > 2e-4) this.dir.set(d[0], Math.max(d[1], 0.02), d[2]).normalize();
    const cam = this.ctx.camera;
    L.position.copy(cam.position).addScaledVector(this.dir, 1000);
    L.target.position.copy(cam.position);
    L.updateMatrixWorld();
    L.target.updateMatrixWorld();
    this.ctx.sol.dir.copy(this.dir);
    if (this.ctx.sombra) this.ctx.sombra.forca = suave(0.0008, 0.012, i);
  }

  descartar() {
    this.ctx.cena.remove(this.luz, this.luz.target);
    this.luz.dispose();
  }
}

export function registrar() {}
