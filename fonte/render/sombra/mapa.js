// Mapa da sombra própria (D43, D9, desenho do render 2.5): uma cena SÓ de projetores (gêmeos que compartilham a
// geometria e o buffer de instâncias do LOD1, as árvores de perto e a Arcologia), desenhada com
// renderer.render(cenaSombra, camOrto) num alvo com DepthTexture. O LOD0 detalhado nunca projeta; a caixa LOD1 projeta
// sem aparecer na imagem. O shadowMap do three fica desligado (ele filtra pelas camadas da câmera da vista).
//
// Média: 1 cascata de 1024; Alta e Ultra: 2 cascatas lado a lado num atlas (a de perto com 30% do raio). O centro
// segue o alvo da câmera e a direção do sol anda em degraus (1,5 grau no Média, 1 no PC): o mapa só é refeito quando o
// alvo anda 15% do raio da cascata de perto, o zoom muda 20%, o sol passa de um degrau ou um projetor muda. Cada
// cascata é encaixada no texel (um ponto parado do mundo não treme). Com a profundidade invertida (EXT_clip_control)
// a comparação e o viés trocam de sentido sozinhos.
import * as THREE from 'three';

const RAD = Math.PI / 180;

export class SombraPropria {
  /**
   * @param {{ tam?: number, degrauGraus?: number, cascatas?: number }} op
   */
  constructor({ tam = 1024, degrauGraus = 1.5, cascatas = 1 } = {}) {
    this.degrau = degrauGraus * RAD;
    this.cena = new THREE.Scene();
    this.cena.matrixWorldAutoUpdate = true;
    this.cams = [new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 4000), new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 4000)];
    this.camera = this.cams[0];
    this.matriz = new THREE.Matrix4(); // cascata de perto (ou a única): mundo para [0, 1]³ da cascata
    this.matriz1 = new THREE.Matrix4(); // cascata de longe
    this.cascatas = cascatas >= 2 ? 2 : 1;
    this.fracaoPerto = 0.3;
    this.alvo = null;
    this.invertida = false;
    this.redimensionar(tam);
    this.material = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    this.ligada = true;
    this.sujo = true;
    this.pares = []; // [fonte, gêmeo]
    this.vies = 0.0006;
    this.forca = 1;
    this.amostras = 5;
    this.raioPcf = 1.2;
    this._dir = new THREE.Vector3(0, 1, 0);
    this._novaDir = new THREE.Vector3();
    this._centro = new THREE.Vector3(Infinity, 0, 0);
    this._origem = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._raio = 0;
    this._raios = [0, 0];
    this.vezes = 0; // passes feitos (teste e bancada)
  }

  /** Troca o tamanho de cada cascata (R.qualidade): alvo novo com DepthTexture e um passe novo. */
  redimensionar(tam) {
    if (this.alvo && tam === this.tam && this.alvo.width === tam * this.cascatas) return;
    this.tam = tam;
    this._criarAlvo();
  }

  /** 1 ou 2 cascatas (perfil). */
  definirCascatas(n) {
    const c = n >= 2 ? 2 : 1;
    if (c === this.cascatas) return;
    this.cascatas = c;
    this._criarAlvo();
  }

  _criarAlvo() {
    this.alvo?.dispose();
    const w = this.tam * this.cascatas;
    const dt = new THREE.DepthTexture(w, this.tam);
    dt.type = THREE.UnsignedIntType;
    // amostrador de sombra: o hardware faz a comparação e o bilinear (com a profundidade invertida, GreaterEqual)
    dt.compareFunction = this.invertida ? THREE.GreaterEqualCompare : THREE.LessEqualCompare;
    dt.minFilter = THREE.LinearFilter;
    dt.magFilter = THREE.LinearFilter;
    this.alvo = new THREE.WebGLRenderTarget(w, this.tam, {
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

  /** Raio da cascata de perto (a única no Média). */
  get raioPerto() {
    return this.cascatas > 1 ? Math.max(40, this._raio * this.fracaoPerto) : this._raio;
  }

  /**
   * Acompanha a vista: centro no alvo da câmera, raio e direção PARA o sol (ou a lua). Refaz o mapa quando o centro
   * anda 15% do raio de perto, o raio muda 20% ou o sol passa de um degrau (D9, desenho do render 2.5).
   */
  acompanhar(centro, raio, dirSol) {
    const d = this._novaDir.copy(dirSol).normalize();
    const rp = this.raioPerto || raio;
    const andou = Math.hypot(centro.x - this._centro.x, centro.z - this._centro.z) > 0.15 * rp || Math.abs(centro.y - this._centro.y) > 0.15 * rp;
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
    const n = this.cascatas;
    const bz = this.invertida ? 1 : 0.5;
    const cz = this.invertida ? 0 : 0.5;
    for (let i = 0; i < n; i++) {
      const r = n > 1 && i === 0 ? this.raioPerto : this._raio;
      this._raios[i] = r;
      const cam = this.cams[i];
      const dist = r * 2 + 800; // cabe a Torre de 350 m com o sol baixo
      this._up.set(0, 1, 0);
      if (Math.abs(this._dir.y) > 0.98) this._up.set(0, 0, -1);
      cam.up.copy(this._up);
      cam.position.copy(this._centro).addScaledVector(this._dir, dist);
      cam.lookAt(this._centro);
      cam.updateMatrixWorld(true);
      // encaixe no texel: a origem do mundo cai sempre na mesma fração do texel, então um ponto fixo do mundo não
      // "anda" em subtexel quando o centro muda com a mesma direção do sol
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
      cam._reversedDepth = this.invertida; // o three faria isto no passe; a matriz precisa sair já certa
      cam.updateProjectionMatrix();
      const m = i === 0 ? this.matriz : this.matriz1;
      m.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, bz, cz, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    }
  }

  /** Desenha o mapa se sujo e escreve os uniformes do gancho 'sombra'. */
  desenhar(renderer, medidas, uniformes) {
    const inv = !!renderer.state?.buffers?.depth?.getReversed?.();
    if (inv !== this.invertida) {
      this.invertida = inv;
      this.alvo.depthTexture.compareFunction = inv ? THREE.GreaterEqualCompare : THREE.LessEqualCompare;
      this.alvo.depthTexture.needsUpdate = true;
      if (this._raio) this._posicionar();
      this.sujo = true;
    }
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
    }
    if (this.sujo && this.pares.length && this._raio) {
      const antes = renderer.getRenderTarget();
      const limpar = renderer.autoClear;
      renderer.autoClear = true;
      const A = this.alvo;
      for (let i = 0; i < this.cascatas; i++) {
        A.viewport.set(i * this.tam, 0, this.tam, this.tam);
        A.scissor.set(i * this.tam, 0, this.tam, this.tam);
        A.scissorTest = this.cascatas > 1;
        renderer.setRenderTarget(A);
        const cam = this.cams[i];
        const fazer = () => renderer.render(this.cena, cam);
        if (medidas) medidas.passe(fazer, { sombra: true });
        else fazer();
      }
      A.viewport.set(0, 0, A.width, A.height);
      A.scissor.set(0, 0, A.width, A.height);
      A.scissorTest = false;
      renderer.autoClear = limpar;
      renderer.setRenderTarget(antes);
      this.sujo = false;
      this.vezes++;
    }
    if (uniformes) this.escreverUniformes(uniformes);
  }

  /** Uniformes do gancho 'sombra' (gSombra*). */
  escreverUniformes(u) {
    const r0 = this._raios[0] || this._raio;
    const r1 = this._raios[1] || this._raio;
    u.gSombraMapa.value = this.alvo.depthTexture;
    u.gSombraMatriz.value.copy(this.matriz);
    u.gSombraMatriz1.value.copy(this.matriz1);
    u.gSombraCascatas.value = this.cascatas;
    u.gSombraTexel.value = 1 / this.tam;
    u.gSombraNormal.value = Math.max(0.3, (2 * r0) / this.tam);
    u.gSombraNormal1.value = Math.max(0.3, (2 * r1) / this.tam);
    u.gSombraVies.value = this.invertida ? -this.vies : this.vies;
    u.gSombraAmostras.value = this.amostras;
    u.gSombraRaioPcf.value = this.raioPcf;
    u.gSombraForca.value = this.forca;
    u.gSombraLigada.value = this.pares.length && this._raio ? 1 : 0;
  }

  descartar() {
    this.alvo.dispose();
    this.material.dispose();
  }
}

export function registrar() {}
