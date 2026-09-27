// Mapa da sombra própria (D43, D9, desenho do render 2.5): uma cena SÓ de projetores (gêmeos que compartilham a
// geometria e o buffer de instâncias do LOD1, as árvores de perto e a Arcologia), desenhada com
// renderer.render(cenaSombra, camOrto) num alvo com DepthTexture. O LOD0 detalhado nunca projeta; a caixa LOD1 projeta
// sem aparecer na imagem. O shadowMap do three fica desligado (ele filtra pelas camadas da câmera da vista).
//
// Média: 1 cascata de 1024; Alta e Ultra: 2 cascatas lado a lado num atlas (a de perto com 30% do raio). O raio
// cresce com a distância da câmera até o teto do perfil (1 km no Média: a metade de perto da vista aberta tem sombra
// antes da sombra de longe da R1b); com o sol baixo a cascata encolhe na direção dele (_posicionar), e a instanciada
// grande (a cidade em LOD1) projeta só as instâncias da cascata (compactar), para caber nos 60 mil triângulos da
// família 'sombra'. O centro segue o alvo da câmera (nas vistas rasantes, puxado para baixo dela) e a direção
// do sol anda em degraus (1,5 grau no Média, 1 no PC): o mapa só é refeito quando o foco anda 15% do raio da cascata
// de perto, o zoom muda 20%, o sol passa de um degrau ou um projetor muda. Cada cascata é encaixada no texel (um
// ponto parado do mundo não treme). Com a profundidade invertida (EXT_clip_control) a comparação e o viés trocam de
// sentido sozinhos.
import * as THREE from 'three';

const RAD = Math.PI / 180;

/**
 * Instanciada com mais vagas que isto ganha buffer próprio compactado na cascata (projetor): a cidade inteira numa
 * malha só (a da depuração tem 12 mil). Listas que já vêm compactadas pela dona (as do LOD1 da R4a, por região)
 * ficam abaixo e compartilham o buffer.
 */
export const COMPACTAR_ACIMA = 4096;

/** Altura (m) até onde telhados e fachadas recebem sombra na cascata encolhida pelo sol baixo (_posicionar). */
export const ALTURA_RECEPTORES = 160;

const _mLuz = new THREE.Matrix4();

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
    this.pares = []; // { fonte, gemeo, compacto, versao, contagem, buffer }
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
    this._raiosY = [0, 0]; // meia altura de cada cascata no espaço da luz
    this._foco = new THREE.Vector3();
    this.vista = null; // câmera da vista (opcional): o foco anda para baixo dela nas vistas rasantes
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
    this._pronto = false; // a DepthTexture só existe na GPU depois do primeiro uso do alvo (_garantirAlvo)
    if (this._raio) this._posicionar();
    this.sujo = true;
  }

  /**
   * Garante a DepthTexture do alvo na GPU (limpa uma vez) antes de ela entrar no gSombraMapa: um sampler2DShadow com
   * uma textura que nunca foi desenhada fica ligado a nada, o ANGLE acusa "Mismatch between texture format and
   * sampler type" e recusa TODAS as chamadas dos materiais com o gancho (o Leve, sem sombra, não desenhava o mundo).
   */
  _garantirAlvo(renderer) {
    if (this._pronto) return;
    const antes = renderer.getRenderTarget();
    renderer.setRenderTarget(this.alvo);
    renderer.clear(true, true, false);
    renderer.setRenderTarget(antes);
    this._pronto = true;
  }

  /**
   * Cria o gêmeo projetor de uma malha visível (InstancedMesh ou Mesh), com a mesma geometria. A fonte pode estar
   * invisível na cena da vista (LOD1 escondido de perto) e o gêmeo projeta. Na instanciada pequena o gêmeo usa o MESMO
   * buffer de instâncias (nenhum envio a mais); na grande (mais de COMPACTAR_ACIMA vagas, a cidade inteira numa malha)
   * ele tem um buffer próprio, refeito só quando o mapa é refeito, com as instâncias que caem na cascata maior: a
   * sombra desenha a vizinhança da vista, não a cidade toda (família 'sombra' do orçamento, 4.8).
   * @param {{ material?: THREE.Material, compactar?: boolean }} op  compactar: força (true) ou proíbe (false)
   */
  projetor(fonte, { material = null, compactar = null } = {}) {
    let g;
    let compacto = false;
    if (fonte.isInstancedMesh) {
      compacto = compactar ?? fonte.instanceMatrix.count > COMPACTAR_ACIMA;
      if (compacto) {
        g = new THREE.InstancedMesh(fonte.geometry, material ?? this.material, fonte.instanceMatrix.count);
        g.count = 0;
      } else {
        g = new THREE.InstancedMesh(fonte.geometry, material ?? this.material, 1);
        g.instanceMatrix = fonte.instanceMatrix; // compartilhado: nenhum envio a mais
        g.count = fonte.count;
      }
    } else {
      g = new THREE.Mesh(fonte.geometry, material ?? this.material);
    }
    g.matrixAutoUpdate = false;
    g.frustumCulled = false;
    g.name = `sombra:${fonte.name || fonte.type}`;
    this.cena.add(g);
    this.pares.push({ fonte, gemeo: g, compacto, versao: -1, contagem: -1, buffer: fonte.instanceMatrix ?? null });
    this.sujo = true;
    return g;
  }

  /** Solta o gêmeo de uma fonte. */
  soltar(fonte) {
    const i = this.pares.findIndex((p) => p.fonte === fonte);
    if (i < 0) return;
    const { gemeo, compacto } = this.pares[i];
    this.cena.remove(gemeo);
    if (compacto) gemeo.dispose();
    this.pares.splice(i, 1);
    this.sujo = true;
  }

  /**
   * Copia para o buffer do gêmeo as instâncias da fonte que podem sombrear a cascata maior: o segmento da base ao
   * topo de cada uma, levado ao espaço da luz, com a meia largura da planta, cruza o quadrado da cascata.
   * @returns {number} instâncias copiadas
   */
  compactar(par) {
    const { fonte, gemeo } = par;
    if (gemeo.instanceMatrix.count < fonte.instanceMatrix.count) {
      // o 'dispose' do three solta o buffer velho da GPU (ele volta a ouvir no próximo desenho)
      gemeo.dispose();
      gemeo.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(fonte.instanceMatrix.count * 16), 16);
    }
    const g = fonte.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const y0 = bb.min.y;
    const y1 = bb.max.y;
    const meia = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), Math.abs(bb.min.z), Math.abs(bb.max.z)) * fonte.matrixWorld.getMaxScaleOnAxis();
    const c = this.cascatas - 1;
    const r = (this._raios[c] || this._raio) * 1.03;
    const ry = (this._raiosY[c] || this._raio) * 1.03;
    const M = _mLuz.multiplyMatrices(this.cams[c].matrixWorldInverse, fonte.matrixWorld).elements;
    const src = fonte.instanceMatrix.array;
    const dst = gemeo.instanceMatrix.array;
    let k = 0;
    for (let i = 0, n = fonte.count; i < n; i++) {
      const o = i * 16;
      const ux = src[o + 4];
      const uy = src[o + 5];
      const uz = src[o + 6];
      const tx = src[o + 12];
      const ty = src[o + 13];
      const tz = src[o + 14];
      // base e topo no espaço da luz (só x e y: o quadrado da cascata)
      const bx = tx + ux * y0;
      const by = ty + uy * y0;
      const bz = tz + uz * y0;
      const cx = tx + ux * y1;
      const cy = ty + uy * y1;
      const cz = tz + uz * y1;
      const lx0 = M[0] * bx + M[4] * by + M[8] * bz + M[12];
      const ly0 = M[1] * bx + M[5] * by + M[9] * bz + M[13];
      const lx1 = M[0] * cx + M[4] * cy + M[8] * cz + M[12];
      const ly1 = M[1] * cx + M[5] * cy + M[9] * cz + M[13];
      const pe = meia * Math.max(Math.hypot(src[o], src[o + 1], src[o + 2]), Math.hypot(src[o + 8], src[o + 9], src[o + 10]));
      if (Math.min(lx0, lx1) - pe > r || Math.max(lx0, lx1) + pe < -r || Math.min(ly0, ly1) - pe > ry || Math.max(ly0, ly1) + pe < -ry) continue;
      for (let j = 0; j < 16; j++) dst[k * 16 + j] = src[o + j];
      k++;
    }
    const a = gemeo.instanceMatrix;
    a.clearUpdateRanges();
    a.addUpdateRange(0, Math.max(1, k) * 16);
    a.needsUpdate = true;
    gemeo.count = k;
    return k;
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
   * Foco da cascata: o alvo da câmera e, nas vistas rasantes, um ponto entre ele e o chão sob a câmera (o que se vê
   * de perto fica embaixo da tela, não no alvo). Sem deslocamento de cima (88 graus); até 45% da distância no chão a
   * 3 graus, sem tirar o alvo da cascata.
   */
  foco(centro, raio, alvo = this._foco) {
    alvo.copy(centro);
    const p = this.vista?.position;
    if (!p) return alvo;
    const dx = p.x - centro.x;
    const dz = p.z - centro.z;
    const h = Math.hypot(dx, dz);
    if (h < 1e-3) return alvo;
    const k = 0.5 * (1 - Math.sin(Math.atan2(p.y - centro.y, h))) ** 2;
    const m = Math.min(k * h, 0.7 * raio);
    alvo.x += (dx / h) * m;
    alvo.z += (dz / h) * m;
    return alvo;
  }

  /**
   * Acompanha a vista: centro no foco (o alvo da câmera, deslocado nas vistas rasantes), raio e direção PARA o sol
   * (ou a lua). Refaz o mapa quando o centro anda 15% do raio de perto, o raio muda 20% ou o sol passa de um degrau
   * (D9, desenho do render 2.5).
   */
  acompanhar(alvoCamera, raio, dirSol) {
    const centro = this.foco(alvoCamera, raio);
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

  /**
   * Posiciona as câmeras das cascatas. No espaço da luz, x é o chão de lado para o sol (1 para 1) e y o chão na
   * direção do sol encolhido pelo seno da elevação, mais a altura das coisas: com o sol baixo, um quadrado de 2r no
   * chão cabe em 2r de largura por 2 (r sen e + H cos e) de altura (H = ALTURA_RECEPTORES, os telhados que recebem
   * sombra). Assim a cascata não vira uma faixa comprida no chão, o texel não se estica 3 vezes na direção do sol ao
   * fim da tarde e entram só os projetores da vizinhança.
   */
  _posicionar() {
    const n = this.cascatas;
    const bz = this.invertida ? 1 : 0.5;
    const cz = this.invertida ? 0 : 0.5;
    const se = Math.min(1, Math.max(0.02, this._dir.y));
    const ce = Math.sqrt(1 - se * se);
    for (let i = 0; i < n; i++) {
      const r = n > 1 && i === 0 ? this.raioPerto : this._raio;
      const ry = Math.min(r, r * se + ALTURA_RECEPTORES * ce);
      this._raios[i] = r;
      this._raiosY[i] = ry;
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
      const tx = (2 * r) / this.tam;
      const ty = (2 * ry) / this.tam;
      const o = this._origem.set(0, 0, 0).applyMatrix4(cam.matrixWorldInverse);
      const dx = o.x - Math.round(o.x / tx) * tx;
      const dy = o.y - Math.round(o.y / ty) * ty;
      cam.left = -r + dx;
      cam.right = r + dx;
      cam.top = ry + dy;
      cam.bottom = -ry + dy;
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
    this._garantirAlvo(renderer);
    if (!this.ligada) {
      if (uniformes) {
        uniformes.gSombraMapa.value = this.alvo.depthTexture;
        uniformes.gSombraLigada.value = 0;
      }
      return;
    }
    for (const par of this.pares) {
      const { fonte: f, gemeo: g } = par;
      f.updateMatrixWorld();
      if (!g.matrixWorld.equals(f.matrixWorld)) {
        g.matrix.copy(f.matrixWorld);
        g.matrixWorld.copy(f.matrixWorld);
        this.sujo = true;
      }
      if (!f.isInstancedMesh) continue;
      if (par.compacto) {
        // instâncias mexidas (versão do buffer), outra contagem ou outro buffer: refaz
        if (f.instanceMatrix.version !== par.versao || f.count !== par.contagem || f.instanceMatrix !== par.buffer) {
          par.versao = f.instanceMatrix.version;
          par.contagem = f.count;
          par.buffer = f.instanceMatrix;
          this.sujo = true;
        }
      } else {
        if (g.instanceMatrix !== f.instanceMatrix) g.instanceMatrix = f.instanceMatrix;
        if (g.count !== f.count) {
          g.count = f.count;
          this.sujo = true;
        }
      }
    }
    if (this.sujo && this.pares.length && this._raio) {
      this.instancias = 0;
      for (const par of this.pares) if (par.compacto) this.instancias += this.compactar(par);
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
    for (const { gemeo, compacto } of this.pares) if (compacto) gemeo.dispose();
    this.pares.length = 0;
    this.cena.clear();
    this.alvo.dispose();
    this.material.dispose();
  }
}

export function registrar() {}
