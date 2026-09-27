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

  /**
   * Liga a camada da faixa de longe em toda a árvore da cena: o que é de longe e tudo o que está dentro dele (um grupo
   * marcado com faixa 'longe' leva as malhas filhas; o three testa a camada de cada objeto, não a do pai). Quem deixa
   * de ser de longe perde a camada.
   */
  marcar(cena) {
    const ver = (o, herdado) => {
      const longe = herdado || ehDeLonge(o);
      if (longe) {
        o.layers.enable(CAMADA_LONGE);
        this._marcados.add(o);
      } else if (this._marcados.has(o)) {
        o.layers.disable(CAMADA_LONGE);
        this._marcados.delete(o);
      }
      const filhos = o.children;
      for (let i = 0; i < filhos.length; i++) ver(filhos[i], longe);
    };
    const filhos = cena.children;
    for (let i = 0; i < filhos.length; i++) ver(filhos[i], false);
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
    const autoLimpa = renderer.autoClear;
    faz(() => {
      cam.near = this.limite * 0.9;
      cam.far = LONGE_FAR;
      cam.updateProjectionMatrix();
      cam.layers.set(CAMADA_LONGE);
      renderer.render(cena, cam);
    });
    // a faixa de perto não pode limpar a cor da de longe (sem o céu, o quadro deixa o autoClear ligado)
    renderer.autoClear = false;
    renderer.clearDepth();
    faz(() => {
      cam.layers.mask = camadas;
      cam.near = near0;
      cam.far = this.limite * 1.02;
      cam.updateProjectionMatrix();
      renderer.render(cena, cam);
    });
    renderer.autoClear = autoLimpa;
    cam.near = near0;
    cam.far = far0;
    cam.updateProjectionMatrix();
    return 2;
  }
}

/** Uma camada só para testes: a câmera enxerga a faixa de longe? */
export const camadaLonge = () => new THREE.Layers().set(CAMADA_LONGE);

export function registrar() {}
