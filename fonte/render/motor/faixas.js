// Duas faixas de profundidade (D14, desenho do render 1.2 com a troca da seção 6 do PROJETO): sem EXT_clip_control
// (ou com ?semClip=1) não há profundidade invertida, e um plano próximo pequeno com o distante em dezenas de km não
// cabe nos 24 bits. Então o quadro desenha primeiro a faixa de LONGE (o que tem userData.faixa = 'longe' ou é da
// família 'terreno': céu à parte, mundo de fora, terreno e LOD2) com o plano próximo em 90% do limite e o distante em
// 60 km, limpa a profundidade e desenha o PERTO (tudo) do plano próximo dinâmico até o limite (3 km ou 1,6 vez a
// distância da câmera, o que for maior). As luzes entram nas duas faixas.
import * as THREE from 'three';

export const CAMADA_LONGE = 2;
const LONGE_FAR = 60000;

/** O objeto vai também na faixa de longe? */
export const ehDeLonge = (o) => o.userData?.faixa === 'longe' || o.userData?.familia === 'terreno' || o.isLight;

export class Faixas {
  constructor(ctx) {
    this.ctx = ctx;
    this.limite = 3000;
    this.passes = 0;
    this._marcados = new WeakSet();
  }

  /** Liga a camada da faixa de longe nos objetos de cima da cena (e um nível abaixo). */
  marcar(cena) {
    const ver = (o) => {
      if (ehDeLonge(o)) o.layers.enable(CAMADA_LONGE);
      else if (this._marcados.has(o)) o.layers.disable(CAMADA_LONGE);
      if (ehDeLonge(o)) this._marcados.add(o);
    };
    for (const o of cena.children) {
      ver(o);
      if (o.isGroup) for (const f of o.children) ver(f);
    }
  }

  /**
   * Desenha a cena (depois do fundo): uma faixa com a profundidade invertida, duas sem ela.
   * @returns {number} passes feitos
   */
  desenhar(renderer, cena, cam, medidas) {
    const faz = (fn) => (medidas ? medidas.passe(fn) : fn());
    if (!this.ctx.semClip) {
      faz(() => renderer.render(cena, cam));
      return 1;
    }
    this.marcar(cena);
    const near0 = cam.near;
    const far0 = cam.far;
    const dist = this.ctx.cameraApi?.estado?.().dist ?? 1000;
    this.limite = Math.max(3000, dist * 1.6);
    const camadas = cam.layers.mask;
    faz(() => {
      cam.near = this.limite * 0.9;
      cam.far = LONGE_FAR;
      cam.updateProjectionMatrix();
      cam.layers.set(CAMADA_LONGE);
      renderer.render(cena, cam);
    });
    renderer.clearDepth();
    faz(() => {
      cam.layers.mask = camadas;
      cam.near = near0;
      cam.far = this.limite * 1.02;
      cam.updateProjectionMatrix();
      renderer.render(cena, cam);
    });
    cam.near = near0;
    cam.far = far0;
    cam.updateProjectionMatrix();
    return 2;
  }
}

/** Uma camada só para testes: a câmera enxerga a faixa de longe? */
export const camadaLonge = () => new THREE.Layers().set(CAMADA_LONGE);

export function registrar() {}
