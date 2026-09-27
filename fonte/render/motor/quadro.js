// Quadro do render: passes na ordem (sombra própria quando suja, cena), limite de quadros pelo estado da tela e o
// tamanho da tela. Primeira versão da F0; a R1a herda e completa (alvo HDR com MSAA, bloom, AgX na composição, CAS,
// resolução dinâmica, céu e sombra de longe) e leva a sombra para render/sombra/.
//
// Sombra própria (D43): uma cena SÓ de projetores (InstancedMesh gêmeos que compartilham a geometria e o buffer de
// instâncias do LOD1, as árvores de perto e a Arcologia), desenhada com renderer.render(cenaSombra, camOrto) num alvo
// com DepthTexture. O LOD0 detalhado nunca projeta; a caixa LOD1 projeta sem aparecer na imagem. O shadowMap do three
// fica desligado (ele filtra os objetos pelas camadas da câmera da vista, não da câmera de sombra).
import * as THREE from 'three';

const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
const RAD = Math.PI / 180;

export class SombraPropria {
  /**
   * @param {{ tam?: number, degrauGraus?: number }} op  degrauGraus: o sol usado pela sombra anda em degraus (D9)
   */
  constructor({ tam = 1024, degrauGraus = 1.5 } = {}) {
    this.degrau = degrauGraus * RAD;
    this.cena = new THREE.Scene();
    this.cena.matrixWorldAutoUpdate = true;
    this.camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 4000);
    this.alvo = null;
    this.redimensionar(tam);
    this.material = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    this.matriz = new THREE.Matrix4();
    this.ligada = true;
    this.sujo = true;
    this.pares = []; // [fonte, gêmeo]
    this._dir = new THREE.Vector3(0, 1, 0);
    this._novaDir = new THREE.Vector3();
    this._centro = new THREE.Vector3(Infinity, 0, 0);
    this._origem = new THREE.Vector3();
    this._raio = 0;
    this.vezes = 0; // passes feitos (teste e bancada)
  }

  /** Troca o tamanho do mapa (R.qualidade): alvo novo com DepthTexture e um passe novo. */
  redimensionar(tam) {
    if (this.alvo && tam === this.tam) return;
    this.alvo?.dispose();
    this.tam = tam;
    const dt = new THREE.DepthTexture(tam, tam);
    dt.type = THREE.UnsignedIntType;
    dt.compareFunction = THREE.LessEqualCompare; // amostrador de sombra: o hardware faz a comparação e o bilinear
    dt.minFilter = THREE.LinearFilter;
    dt.magFilter = THREE.LinearFilter;
    this.alvo = new THREE.WebGLRenderTarget(tam, tam, {
      format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true, depthTexture: dt, generateMipmaps: false,
    });
    if (this._raio) this._posicionar();
    this.sujo = true;
  }

  /**
   * Cria o gêmeo projetor de uma malha visível (InstancedMesh ou Mesh): mesma geometria e, na instanciada, o MESMO
   * buffer de instâncias. A fonte pode estar invisível na cena da vista (LOD1 escondido de perto) e o gêmeo projeta.
   */
  projetor(fonte, { material = null } = {}) {
    let g;
    if (fonte.isInstancedMesh) {
      g = new THREE.InstancedMesh(fonte.geometry, material ?? this.material, 1);
      g.instanceMatrix = fonte.instanceMatrix; // compartilhado: nenhum envio a mais
      g.count = fonte.count;
    } else {
      g = new THREE.Mesh(fonte.geometry, material ?? this.material);
    }
    g.matrixAutoUpdate = false;
    g.frustumCulled = false;
    g.name = `sombra:${fonte.name || fonte.type}`;
    this.cena.add(g);
    this.pares.push([fonte, g]);
    this.sujo = true;
    return g;
  }

  /** Solta o gêmeo de uma fonte. */
  soltar(fonte) {
    const i = this.pares.findIndex(([f]) => f === fonte);
    if (i < 0) return;
    this.cena.remove(this.pares[i][1]);
    this.pares.splice(i, 1);
    this.sujo = true;
  }

  /** O que mudou nos projetores (instâncias, contagem) pede um passe novo. */
  marcar() {
    this.sujo = true;
  }

  /**
   * Acompanha a vista: centro no alvo da câmera, raio e direção PARA o sol. Refaz o mapa quando o centro anda 15% do
   * raio, o raio muda 20% ou o sol passa de um degrau (D9, desenho do render 2.5).
   */
  acompanhar(centro, raio, dirSol) {
    const d = this._novaDir.copy(dirSol).normalize();
    const andou = Math.hypot(centro.x - this._centro.x, centro.z - this._centro.z) > 0.15 * this._raio || Math.abs(centro.y - this._centro.y) > 0.15 * this._raio;
    const zoom = !this._raio || Math.abs(raio - this._raio) > 0.2 * this._raio;
    const sol = this._dir.angleTo(d) >= this.degrau;
    if (!(andou || zoom || sol || this.sujo)) return false;
    if (andou || zoom) {
      this._centro.copy(centro);
      this._raio = raio;
    }
    if (sol || !this.vezes) this._dir.copy(d);
    this._posicionar();
    this.sujo = true;
    return true;
  }

  _posicionar() {
    const cam = this.camera;
    const r = this._raio;
    const dist = r * 2 + 800; // cabe a Torre de 350 m com o sol baixo
    const up = Math.abs(this._dir.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    cam.up.copy(up);
    cam.position.copy(this._centro).addScaledVector(this._dir, dist);
    cam.lookAt(this._centro);
    cam.updateMatrixWorld(true);
    // encaixe no texel: a origem do mundo cai sempre na mesma fração do texel, então um ponto fixo do mundo não
    // "anda" em subtexel quando o centro muda com a mesma direção do sol (o centro em si fica sempre no meio da vista)
    const texel = (2 * r) / this.tam;
    const o = this._origem.set(0, 0, 0).applyMatrix4(cam.matrixWorldInverse);
    const dx = o.x - Math.round(o.x / texel) * texel;
    const dy = o.y - Math.round(o.y / texel) * texel;
    cam.left = -r + dx;
    cam.right = r + dx;
    cam.top = r + dy;
    cam.bottom = -r + dy;
    cam.near = 1;
    cam.far = dist + r * 3;
    cam.updateProjectionMatrix();
    this.matriz.copy(BIAS).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  }

  /** Desenha o mapa se sujo e escreve os uniformes do gancho 'sombra'. */
  desenhar(renderer, medidas, uniformes) {
    if (!this.ligada) {
      if (uniformes) uniformes.gSombraLigada.value = 0;
      return;
    }
    for (const [f, g] of this.pares) {
      f.updateMatrixWorld();
      g.matrix.copy(f.matrixWorld);
      g.matrixWorld.copy(f.matrixWorld);
      if (f.isInstancedMesh && g.count !== f.count) {
        g.count = f.count;
        this.sujo = true;
      }
      // a fonte pede um passe novo quando as instâncias mudam (o domínio chama marcar())
    }
    if (this.sujo && this.pares.length && this._raio) {
      const antes = renderer.getRenderTarget();
      renderer.setRenderTarget(this.alvo);
      const fazer = () => renderer.render(this.cena, this.camera);
      if (medidas) medidas.passe(fazer, { sombra: true });
      else fazer();
      renderer.setRenderTarget(antes);
      this.sujo = false;
      this.vezes++;
    }
    if (uniformes) {
      uniformes.gSombraMapa.value = this.alvo.depthTexture;
      uniformes.gSombraMatriz.value.copy(this.matriz);
      uniformes.gSombraTexel.value = 1 / this.tam;
      uniformes.gSombraNormal.value = Math.max(0.3, (2 * this._raio) / this.tam);
      uniformes.gSombraLigada.value = this.pares.length && this._raio ? 1 : 0;
    }
  }

  descartar() {
    this.alvo.dispose();
    this.material.dispose();
  }
}

/** Quadros por segundo máximos por estado da tela (R.estado). */
export const TETO_QPS = Object.freeze({ livre: 0, coberto: 10, foto: 0, teste: 0 });

/**
 * Laço de desenho de um quadro.
 * @param {object} ctx  contexto do render (index.js): renderer, cena, camera, sombra, medidas, ganchos, perfil, pr
 */
export class Quadro {
  constructor(ctx) {
    this.ctx = ctx;
    this.estado = 'livre';
    this._ultimo = 0;
    this.w = 1;
    this.h = 1;
    this._medir = true;
    // mede a tela só quando ela muda (ler o layout a cada quadro força o navegador a refazê-lo depois da interface)
    if (typeof addEventListener !== 'undefined') addEventListener('resize', () => (this._medir = true));
  }

  /** Tamanho da tela em px CSS (no começo do quadro, só depois de um resize ou de trocar a razão de pixels). */
  medirTela() {
    const { renderer, camera, canvas } = this.ctx;
    if (!this._medir && renderer.getPixelRatio() === this.ctx.pr) return;
    this._medir = false;
    const w = Math.max(1, canvas.clientWidth || (typeof innerWidth !== 'undefined' ? innerWidth : 1));
    const h = Math.max(1, canvas.clientHeight || (typeof innerHeight !== 'undefined' ? innerHeight : 1));
    if (w !== this.w || h !== this.h || renderer.getPixelRatio() !== this.ctx.pr) {
      this.w = w;
      this.h = h;
      renderer.setPixelRatio(this.ctx.pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  /** true se este quadro deve ser desenhado (teto de qps do estado). */
  vez(tMs) {
    const teto = TETO_QPS[this.estado] || 0;
    if (!teto) return true;
    if (tMs - this._ultimo < 1000 / teto - 2) return false;
    return true;
  }

  /** Desenha: sombra própria (se suja) e a cena, medindo cada passe. */
  desenhar(tMs) {
    const { renderer, cena, camera, sombra, medidas, ganchos } = this.ctx;
    this._ultimo = tMs;
    medidas.inicio(tMs);
    sombra.desenhar(renderer, medidas, ganchos.uniformes);
    medidas.passe(() => {
      renderer.setRenderTarget(null);
      renderer.render(cena, camera);
    });
    medidas.fim(tMs, { pr: this.ctx.pr, largura: this.w, altura: this.h, cenas: [cena, sombra.cena] });
  }
}
