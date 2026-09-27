// Duas faixas de profundidade (D14, desenho do render 1.2 com a troca da seção 6 do PROJETO): sem EXT_clip_control
// (ou com ?semClip=1) não há profundidade invertida, e um plano próximo pequeno com o distante em dezenas de km não
// cabe nos 24 bits. Então o quadro desenha primeiro a faixa de LONGE (o que tem userData.faixa = 'longe' ou é da
// família 'terreno': céu à parte, mundo de fora, terreno e LOD2) com o plano próximo em 90% do limite e o distante em
// 60 km, limpa a profundidade e desenha o PERTO (tudo) do plano próximo dinâmico até o limite (3 km ou 1,6 vez a
// distância da câmera, o que for maior). As luzes entram nas duas faixas. Uma malha opaca que passa do corte da
// faixa de perto (pela esfera no mundo; sem esfera conhecida, como as listas da cidade inteira e o mar, conta como
// passando) entra também na de longe: sem isso o mar e a cidade além do corte sumiam num risco reto. Só ela paga a
// chamada a mais; o que fica todo além do corte sai da faixa de perto pelo descarte do three. userData.faixa =
// 'perto' deixa uma malha só na faixa de perto.
import * as THREE from 'three';

export const CAMADA_LONGE = 2;
const LONGE_FAR = 60000;

/** O objeto vai também na faixa de longe? */
export const ehDeLonge = (o) => o.userData?.faixa === 'longe' || o.userData?.familia === 'terreno' || o.isLight;

const _c = new THREE.Vector3();

/** Esfera do objeto no espaço dele (null: extensão desconhecida). A instanciada vale pela esfera das instâncias. */
function esfera(o) {
  if (o.isInstancedMesh || o.isBatchedMesh) return o.boundingSphere;
  const g = o.geometry;
  if (!g) return null;
  if (!g.boundingSphere && g.attributes?.position) g.computeBoundingSphere();
  return g.boundingSphere;
}

const transparente = (m) => (Array.isArray(m) ? m.some((x) => x?.transparent) : !!m?.transparent);

/**
 * A malha passa do corte da faixa de perto (distância da câmera ao ponto mais longe da esfera)? Sem esfera finita,
 * sim. As transparentes ficam de fora (duas faixas somariam a cor delas na sobreposição).
 */
export function passaDoCorte(o, posCamera, corte) {
  if (!o.geometry || o.userData?.faixa === 'perto' || transparente(o.material)) return false;
  const s = esfera(o);
  if (!s || !Number.isFinite(s.radius) || s.radius < 0) return true;
  const r = s.radius * o.matrixWorld.getMaxScaleOnAxis();
  if (!Number.isFinite(r)) return true;
  return _c.copy(s.center).applyMatrix4(o.matrixWorld).distanceTo(posCamera) + r > corte;
}

export class Faixas {
  constructor(ctx) {
    this.ctx = ctx;
    this.limite = 3000;
    this.passes = 0;
    this._marcados = new WeakSet();
  }

  /**
   * Liga a camada da faixa de longe em toda a árvore da cena: o que é de longe e tudo o que está dentro dele (um grupo
   * marcado com faixa 'longe' leva as malhas filhas; o three testa a camada de cada objeto, não a do pai). Com a câmera,
   * também a malha visível que passa do corte da faixa de perto. Quem deixa de ser de longe perde a camada.
   * @param {THREE.Object3D} cena
   * @param {THREE.Camera} [cam]  câmera da vista (sem ela, só as marcas)
   * @param {number} [corte]  plano distante da faixa de perto (m)
   */
  marcar(cena, cam = null, corte = Infinity) {
    const pos = cam?.position ?? null;
    const ver = (o, herdado) => {
      const longe = herdado || ehDeLonge(o) || (pos !== null && o.visible && passaDoCorte(o, pos, corte));
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
    const near0 = cam.near;
    const far0 = cam.far;
    const dist = this.ctx.cameraApi?.estado?.().dist ?? 1000;
    this.limite = Math.max(3000, dist * 1.6);
    this.marcar(cena, cam, this.limite * 1.02);
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
