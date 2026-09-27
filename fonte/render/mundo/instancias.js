// Listas de instâncias compactadas (desenho do render 1.3): uma InstancedMesh desenha [0, count) sem descartar por
// instância, então o buffer é montado só com os pedaços visíveis (setores, regiões) quando esse conjunto muda, com uma
// cópia de arrays tipados e um envio parcial; zero trabalho por quadro. Serve ao LOD1 e LOD2 dos prédios (predios.js)
// e pode servir às árvores e aos props (R2b, R3a) com o mesmo formato de pedaço.
//
// Pedaço: { mat: Float32Array(n x 16) (coluna maior, como o three), ids: Uint32Array(n), bytes: Uint8Array(n x B) }
// e quantas instâncias do começo entram (n). Os bytes viram atributos Uint8 x 4 intercalados (nomes em `bytes`).
import * as THREE from 'three';

export class ListaCompactada {
  /**
   * @param {{ geometria: THREE.BufferGeometry, material: THREE.Material | null, nome: string, bytes?: string[],
   *           comId?: boolean, cap?: number }} op
   *   geometria  a forma (compartilhada: posição, normal e índices vão para a GPU uma vez só)
   *   material   null para uma lista só de projetores de sombra (sem atributos extras)
   *   bytes      nomes dos atributos Uint8 x 4 intercalados, na ordem dos bytes do pedaço
   */
  constructor({ geometria, material = null, nome, bytes = [], comId = false, cap = 1024 }) {
    this.base = geometria;
    this.material = material;
    this.nome = nome;
    this.nomesBytes = bytes;
    this.comId = comId;
    this.stride = bytes.length * 4;
    this.malha = null;
    this.cap = 0;
    this.count = 0;
    this.aoCriar = null; // (malha nova, malha velha) => void: o dono põe na cena e liga a sombra
    this._garantir(cap);
  }

  _garantir(n) {
    if (n <= this.cap && this.malha) return false;
    const cap = Math.max(256, 2 ** Math.ceil(Math.log2(Math.max(1, n) * 1.25)));
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(this.base.attributes)) g.setAttribute(k, a);
    g.setIndex(this.base.index);
    if (this.stride) {
      const buf = new THREE.InstancedInterleavedBuffer(new Uint8Array(cap * this.stride), this.stride, 1);
      buf.setUsage(THREE.DynamicDrawUsage);
      this.nomesBytes.forEach((nome, k) => g.setAttribute(nome, new THREE.InterleavedBufferAttribute(buf, 4, k * 4, false)));
      this._buf = buf;
    }
    if (this.comId) {
      const ids = new THREE.InstancedBufferAttribute(new Uint32Array(cap), 1);
      ids.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aId', ids);
    }
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(-1e7, -1e7, -1e7), new THREE.Vector3(1e7, 1e7, 1e7));
    const m = new THREE.InstancedMesh(g, this.material ?? new THREE.MeshBasicMaterial(), cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    m.name = this.nome;
    m.matrixAutoUpdate = false;
    const velha = this.malha;
    this.malha = m;
    this.cap = cap;
    this.aoCriar?.(m, velha);
    if (velha) velha.geometry.dispose();
    return true;
  }

  /**
   * Monta o buffer com os pedaços na ordem dada: [{ mat, ids, bytes, n }]. Devolve quantas instâncias ficaram.
   */
  compactar(pedacos) {
    let total = 0;
    for (const p of pedacos) total += p.n;
    this._garantir(total);
    const m = this.malha;
    const im = m.instanceMatrix.array;
    const b = this._buf?.array;
    const ids = this.comId ? m.geometry.attributes.aId.array : null;
    let o = 0;
    for (const p of pedacos) {
      if (!p.n) continue;
      im.set(p.n * 16 === p.mat.length ? p.mat : p.mat.subarray(0, p.n * 16), o * 16);
      if (b) b.set(p.n * this.stride === p.bytes.length ? p.bytes : p.bytes.subarray(0, p.n * this.stride), o * this.stride);
      if (ids) ids.set(p.n === p.ids.length ? p.ids : p.ids.subarray(0, p.n), o);
      o += p.n;
    }
    m.count = o;
    this.count = o;
    // envio parcial: só o trecho usado
    const faixa = (attr, k) => {
      attr.clearUpdateRanges();
      if (o) attr.addUpdateRange(0, o * k);
      attr.needsUpdate = true;
    };
    faixa(m.instanceMatrix, 16);
    if (this._buf) faixa(this._buf, this.stride);
    if (ids) faixa(m.geometry.attributes.aId, 1);
    return o;
  }

  descartar() {
    this.malha?.geometry.dispose();
    this.malha = null;
  }
}

export function registrar() {}
