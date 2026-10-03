// Ferramentas desenhadas no mundo (desenho do render 11.2; D28): o domínio 'ferramentas' ouve os pedidos da interface
// (R.ferramenta.*, que viram avisos internos) e desenha, sem luz nem neblina, de 1 a 4 chamadas enquanto a ferramenta
// está aberta:
//   'ferramenta.via'      a prévia do traçado: a malha da via pelo gerador da R3a (gerarMalhaVia, quando publicar) ou,
//                         até lá, a FITA PLANA na largura do tipo, colada no chão por alturaEm, translúcida (azul;
//                         vermelha no trecho com erro; champanhe na sugestão), com as bordas, o eixo e as guias de
//                         encaixe em linhas finas (2 chamadas)
//   'ferramenta.zona' e 'ferramenta.celulas'   as células de 8 m como instâncias de quadrado (1 chamada), só num raio
//                         de 400 m da mira e até 8 mil, com cor por zona e borda no shader (a zona de longe fica na
//                         textura de células do chão, da R2a); as da prévia do pincel acesas
//   'ferramenta.pincel'   o centro da mira para o raio de 400 m (o círculo no chão é da R2a)
//   'ferramenta.fantasma' a caixa translúcida da planta (o LOD1 do modelo quando a R5 publicar) e o círculo de alcance
//                         colado no chão (2 chamadas)
//   'ferramenta.demolir'  contorno vermelho: caixas sobre os prédios marcados e fita sobre as vias (2 chamadas); cada
//                         item é a ref de um prédio ou { tipo: 'aresta', ref } (a ref sozinha não diz a tabela)
//   'ferramenta.limpar'   apaga tudo
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';
import { ponto as pontoBz, direcao as direcaoBz, tabelaArco } from '../../comum/bezier.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { CELULA } from '../../contratos/flags.js';
import { idxDaRef } from '../../contratos/espelho.js';
import { alturaDaCaixa } from '../depuracao.js';
import * as malhaVia from '../geracao/malhaVia.js';

/** Números das sobreposições. */
export const SOBRE = Object.freeze({
  raioCelulas: 400, // m em volta da mira
  maxCelulas: 8000,
  passoFita: 4, // m entre amostras da fita
  acimaVia: 0.45, // m acima do chão (a pista fica 0,15 acima do terreno aplainado)
  acimaCelula: 0.3,
  celula: 7.4, // quadrado desenhado dentro da célula de 8 m
  balde: 64, // grade espacial das células
  refazerAoAndar: 24, // m que a mira anda antes de refazer as instâncias
  alturaFantasma: 12,
});

const COR = Object.freeze({
  normal: new THREE.Color('#5ab0ff'),
  invalido: new THREE.Color('#ff7b6e'),
  sugestao: new THREE.Color('#d9bd84'),
  borda: new THREE.Color('#eef2f6'),
  guia: new THREE.Color('#d9bd84'),
  vazia: new THREE.Color('#aeb6bf'),
  invalida: new THREE.Color('#b5524a'),
  apagar: new THREE.Color('#ff7b6e'),
  demolir: new THREE.Color('#ff5a4a'),
});
const COR_FAMILIA = Object.freeze({ res: new THREE.Color('#199e70'), com: new THREE.Color('#3987e5'), ind: new THREE.Color('#c98500'), esc: new THREE.Color('#3987e5') });

// ------------------------------------------------------------------------------------------------ geometria (pura)

/**
 * Fita plana ao longo de uma Bézier cúbica (8 números), na largura dada, colada no chão por `cota(x, z)`.
 * Devolve { posicoes: Float32Array, indices: Uint32Array, bordas: Float32Array (pares de pontos das duas bordas e do
 * eixo tracejado) }.
 */
export function fitaDaCurva(p, largura, cota, { passo = SOBRE.passoFita, acima = SOBRE.acimaVia } = {}) {
  const tab = tabelaArco(p);
  const comp = tab[16];
  const n = Math.max(2, Math.min(256, Math.ceil(comp / passo)));
  const pos = new Float32Array((n + 1) * 2 * 3);
  const idx = new Uint32Array(n * 6);
  const q = [0, 0];
  const d = [0, 0];
  const meia = largura / 2;
  const ladoE = [];
  const ladoD = [];
  const eixo = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pontoBz(p, t, q);
    direcaoBz(p, t, d);
    const nx = -d[1];
    const nz = d[0];
    for (let s = 0; s < 2; s++) {
      const k = s ? 1 : -1;
      const x = q[0] + nx * meia * k;
      const z = q[1] + nz * meia * k;
      const y = cota(x, z) + acima;
      const o = (2 * i + s) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      (s ? ladoD : ladoE).push(x, y + 0.02, z);
    }
    eixo.push(q[0], cota(q[0], q[1]) + acima + 0.03, q[1]);
    if (i < n) {
      const a = 2 * i;
      idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
  }
  const linhas = [];
  for (const l of [ladoE, ladoD]) for (let i = 0; i + 5 < l.length; i += 3) linhas.push(l[i], l[i + 1], l[i + 2], l[i + 3], l[i + 4], l[i + 5]);
  // eixo tracejado: um traço sim, um não
  for (let i = 0; i + 5 < eixo.length; i += 6) linhas.push(eixo[i], eixo[i + 1], eixo[i + 2], eixo[i + 3], eixo[i + 4], eixo[i + 5]);
  return { posicoes: pos, indices: idx, bordas: new Float32Array(linhas) };
}

/** Linha do chão entre dois pontos, colada por cota, em pares (LineSegments). */
export function linhaNoChao(a, b, cota, { passo = 8, acima = SOBRE.acimaVia + 0.05 } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.min(64, Math.ceil(L / passo)));
  const out = [];
  let px = a[0];
  let pz = a[1];
  let py = cota(px, pz) + acima;
  for (let i = 1; i <= n; i++) {
    const x = a[0] + ((b[0] - a[0]) * i) / n;
    const z = a[1] + ((b[1] - a[1]) * i) / n;
    const y = cota(x, z) + acima;
    out.push(px, py, pz, x, y, z);
    px = x;
    pz = z;
    py = y;
  }
  return out;
}

/** Círculo colado no chão (LineSegments), para o alcance. */
export function circuloNoChao(cx, cz, r, cota, { n = 96, acima = 0.6 } = {}) {
  const out = [];
  let ax = cx + r;
  let az = cz;
  let ay = cota(ax, az) + acima;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    const y = cota(x, z) + acima;
    out.push(ax, ay, az, x, y, z);
    ax = x;
    az = z;
    ay = y;
  }
  return out;
}

/** Cor da célula: zona pela família; livre sem zona cinza; inválida vermelha escura; ocupada um pouco mais escura. */
export function corDaCelula(zona, estado, alvo = new THREE.Color()) {
  if (estado === CELULA.INVALIDA) return alvo.copy(COR.invalida);
  const z = ZONAS[ZONAS_ORDEM[zona]];
  if (!z) return alvo.copy(COR.vazia);
  alvo.copy(COR_FAMILIA[z.familia] ?? COR.vazia);
  if (estado === CELULA.OCUPADA) alvo.multiplyScalar(0.72);
  return alvo;
}

// ------------------------------------------------------------------------------------------------ grade das células (pura)

/**
 * Grade espacial das células em baldes de SOBRE.balde metros com chave numérica. `de[c]` é o balde em que a célula c
 * foi posta (-1: em nenhum); um balde pode guardar células que já saíram dele (quem lê confere `de`), e a grade
 * inteira é refeita quando a tabela troca de arrays.
 */
export function criarGradeCelulas(C, { origem = [-4096, -4096], tam = 8192, balde = SOBRE.balde } = {}) {
  const lado = Math.ceil(tam / balde) + 2;
  return {
    viva: C.viva,
    C,
    B: balde,
    ox: (origem?.[0] ?? -4096) - balde,
    oz: (origem?.[1] ?? -4096) - balde,
    lado,
    baldes: new Map(),
    de: new Int32Array(Math.max(C.n, C.viva?.length ?? 0)).fill(-1),
    visto: new Uint32Array(Math.max(C.n, C.viva?.length ?? 0)),
    selo: 0,
  };
}

const indiceBalde = (G, v, o) => Math.max(0, Math.min(G.lado - 1, Math.floor((v - o) / G.B)));

/** Põe (ou muda de balde) a célula c. Devolve true se ela entrou num balde novo (nasceu ou andou). */
export function porNaGrade(G, c) {
  const C = G.C;
  if (!C.viva[c] || !Number.isFinite(C.x[c]) || !Number.isFinite(C.z[c])) return false;
  const k = indiceBalde(G, C.z[c], G.oz) * G.lado + indiceBalde(G, C.x[c], G.ox);
  if (G.de[c] === k) return false;
  G.de[c] = k;
  let l = G.baldes.get(k);
  if (!l) G.baldes.set(k, (l = []));
  l.push(c);
  return true;
}

/** Chama fn(c, d2) para cada célula viva a até r metros de (x, z), uma vez cada. */
export function celulasNoRaio(G, x, z, r, fn) {
  const C = G.C;
  const selo = (G.selo = (G.selo + 1) >>> 0 || 1);
  const i0 = indiceBalde(G, x - r, G.ox);
  const i1 = indiceBalde(G, x + r, G.ox);
  const j0 = indiceBalde(G, z - r, G.oz);
  const j1 = indiceBalde(G, z + r, G.oz);
  const r2 = r * r;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const k = j * G.lado + i;
      const l = G.baldes.get(k);
      if (!l) continue;
      for (const c of l) {
        if (G.de[c] !== k || G.visto[c] === selo || !C.viva[c]) continue;
        G.visto[c] = selo;
        const d2 = (C.x[c] - x) ** 2 + (C.z[c] - z) ** 2;
        if (d2 <= r2) fn(c, d2);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ materiais

const VERT_CELULA = /* glsl */ `
varying vec2 vUv;
varying vec3 vCor;
void main() {
  vUv = uv;
  vCor = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const FRAG_CELULA = /* glsl */ `
uniform float uOpac;
varying vec2 vUv;
varying vec3 vCor;
void main() {
  vec2 d = min(vUv, 1.0 - vUv);
  float borda = 1.0 - smoothstep(0.035, 0.08, min(d.x, d.y));
  vec3 c = mix(vCor, min(vCor * 1.3 + 0.1, vec3(1.0)), borda);
  gl_FragColor = vec4(c, mix(uOpac, 0.92, borda));
}
`;

/**
 * Geometria vazia com o atributo de posição (aquecimento, D66): o three põe "tem posição" na chave do programa, então o
 * programa que o aquecimento compila com a geometria vazia sem posição não serve para a de verdade e o jogo compilava
 * de novo na primeira prévia de via, no primeiro fantasma e no primeiro demolir de via (PC3).
 */
export function geometriaVazia(cores = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  if (cores) g.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
  return g;
}

function materialTranslucido(cor, opacidade = 0.5) {
  const m = new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: opacidade, depthWrite: false, fog: false, side: THREE.DoubleSide });
  m.name = 'sobreposicao';
  return m;
}

// ------------------------------------------------------------------------------------------------ domínio

/** Gerador de malha da R3a, se já publicou (procura pelo nome para a montagem não avisar enquanto é esqueleto). */
function geradorDaR3a() {
  const par = Object.entries(malhaVia).find(([k]) => k === 'gerarMalhaVia');
  return typeof par?.[1] === 'function' ? par[1] : null;
}

/**
 * Malha da via pelo gerador da R3a (gerarMalhaVia(aresta, tipo, { alturaEm }) devolve o construtor com pos, idx, nv
 * e ni), levantada um pouco para a prévia ficar sobre a via de verdade; as bordas e o eixo continuam os da fita. null
 * se o gerador não existe ou a resposta não tem o formato (a fita plana entra).
 */
function malhaDaR3a(seg, cota, largura) {
  const gerar = geradorDaR3a();
  if (!gerar) return null;
  try {
    const K = gerar({ p: seg.p, cotas: seg.cotas, ponte: !!seg.ponte }, seg.tipo, { alturaEm: cota });
    const nv = K?.nv ?? (K?.pos ? K.pos.length / 3 : 0);
    const ni = K?.ni ?? K?.idx?.length ?? 0;
    if (!K?.pos || !K?.idx || !nv || !ni) return null;
    const posicoes = Float32Array.from(K.pos.subarray(0, 3 * nv));
    for (let i = 1; i < posicoes.length; i += 3) posicoes[i] += 0.25;
    const bordas = fitaDaCurva(seg.p, largura, cota).bordas;
    return { posicoes, indices: Uint32Array.from(K.idx.subarray(0, ni)), bordas };
  } catch (e) {
    return null;
  }
}

function criarFerramentas(ctx) {
  const grupo = new THREE.Group();
  grupo.name = 'ferramentas';
  ctx.cena.add(grupo);
  const esp = () => ctx.sim?.espelho;
  const cota = (x, z) => {
    const T = esp()?.terreno;
    return T?.altura ? alturaEm(T, x, z) : 0;
  };

  // ---------------- via: fita e linhas
  const matFita = materialTranslucido(0xffffff, 0.5);
  matFita.vertexColors = true;
  const fita = ctx.medidas.familia(new THREE.Mesh(geometriaVazia(true), matFita), 'resto');
  fita.name = 'ferramentas:fita';
  fita.frustumCulled = false;
  fita.renderOrder = 20;
  fita.visible = false;
  const matLinha = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  matLinha.name = 'sobreposicao:linhas';
  const linhas = ctx.medidas.familia(new THREE.LineSegments(geometriaVazia(true), matLinha), 'resto');
  linhas.name = 'ferramentas:linhas';
  linhas.frustumCulled = false;
  linhas.renderOrder = 21;
  linhas.visible = false;
  grupo.add(fita, linhas);

  function montarVia(v) {
    if (!v?.plano?.segmentos?.length) {
      fita.visible = false;
      linhas.visible = false;
      return;
    }
    const estilo = v.estilo ?? 'normal';
    const pos = [];
    const cor = [];
    const ind = [];
    const lin = [];
    const corL = [];
    const c = new THREE.Color();
    // com erro por trecho, só o trecho fica vermelho; erro do plano inteiro (créditos) pinta tudo
    const porTrecho = v.plano.segmentos.some((s) => s.erros?.length);
    for (const seg of v.plano.segmentos) {
      const larg = VIAS[seg.tipo]?.largura ?? 16;
      const m = malhaDaR3a(seg, cota, larg) ?? fitaDaCurva(seg.p, larg, cota);
      const base = pos.length / 3;
      const erro = porTrecho ? !!seg.erros?.length : estilo === 'invalido';
      c.copy(erro ? COR.invalido : estilo === 'sugestao' ? COR.sugestao : COR.normal);
      for (let i = 0; i < m.posicoes.length; i += 3) {
        pos.push(m.posicoes[i], m.posicoes[i + 1], m.posicoes[i + 2]);
        cor.push(c.r, c.g, c.b);
      }
      for (const i of m.indices) ind.push(base + i);
      for (let i = 0; i < m.bordas.length; i += 3) {
        lin.push(m.bordas[i], m.bordas[i + 1], m.bordas[i + 2]);
        corL.push(COR.borda.r, COR.borda.g, COR.borda.b);
      }
    }
    for (const gu of v.plano.guias ?? []) {
      if (!gu?.a || !gu?.b) continue;
      const l = linhaNoChao(gu.a, gu.b, cota);
      for (let i = 0; i < l.length; i += 3) {
        lin.push(l[i], l[i + 1], l[i + 2]);
        corL.push(COR.guia.r, COR.guia.g, COR.guia.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
    g.setIndex(new THREE.Uint32BufferAttribute(ind, 1));
    fita.geometry.dispose();
    fita.geometry = g;
    fita.visible = true;
    const gl = new THREE.BufferGeometry();
    gl.setAttribute('position', new THREE.Float32BufferAttribute(lin, 3));
    gl.setAttribute('color', new THREE.Float32BufferAttribute(corL, 3));
    linhas.geometry.dispose();
    linhas.geometry = gl;
    linhas.visible = lin.length > 0;
  }

  // ---------------- células de zona
  const geoCel = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const matCel = new THREE.ShaderMaterial({
    uniforms: { uOpac: { value: 0.42 } },
    vertexShader: VERT_CELULA,
    fragmentShader: FRAG_CELULA,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  matCel.name = 'sobreposicao:celulas';
  const cels = ctx.medidas.familia(new THREE.InstancedMesh(geoCel, matCel, SOBRE.maxCelulas), 'resto');
  cels.name = 'ferramentas:celulas';
  cels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cels.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SOBRE.maxCelulas * 3), 3);
  cels.frustumCulled = false;
  cels.renderOrder = 19;
  cels.count = 0;
  cels.visible = false;
  grupo.add(cels);
  // grade: a grade espacial das células (refeita inteira só quando a tabela troca de arrays ou pede tudo; a pintura só
  // toca as células pintadas); slot: a instância de cada célula no último desenho; lista: as células desenhadas
  const zona = { ligada: false, centro: null, feito: null, previa: new Map(), grade: null, slot: new Int32Array(0), lista: [] };

  function gradeDe(C) {
    const G = zona.grade;
    if (G && G.viva === C.viva && G.de.length >= C.n) return G;
    const mapa = esp()?.mapa;
    const novo = criarGradeCelulas(C, { origem: mapa?.origem, tam: mapa?.tam });
    for (let c = 0; c < C.n; c++) porNaGrade(novo, c);
    zona.grade = novo;
    zona.slot = new Int32Array(novo.de.length).fill(-1);
    zona.lista = [];
    return novo;
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const cc = new THREE.Color();
  // a célula inválida não entra (como no CS2: onde não dá para zonear, não há grade), a não ser na prévia do pincel
  const visivel = (C, c) => !!C.viva[c] && (C.estado[c] !== CELULA.INVALIDA || zona.previa.has(c));
  const corDe = (C, c) => {
    if (!zona.previa.has(c)) return corDaCelula(C.zona[c], C.estado[c], cc);
    const zp = zona.previa.get(c);
    return zp === 0 ? cc.copy(COR.apagar) : corDaCelula(zp, CELULA.LIVRE, cc).multiplyScalar(1.25);
  };

  function montarCelulas() {
    const C = esp()?.celulas;
    for (const c of zona.lista) if (c < zona.slot.length) zona.slot[c] = -1;
    zona.lista = [];
    if (!zona.ligada || !C?.n || !zona.centro) {
      cels.count = 0;
      cels.visible = false;
      zona.feito = null;
      return;
    }
    const [cx, cz] = zona.centro;
    const R = SOBRE.raioCelulas;
    const G = gradeDe(C);
    const lista = [];
    celulasNoRaio(G, cx, cz, R, (c, d2) => {
      if (visivel(C, c)) lista.push([d2, c]);
    });
    // as mais perto da mira primeiro, até o teto
    if (lista.length > SOBRE.maxCelulas) lista.sort((a, b) => a[0] - b[0]);
    const n = Math.min(SOBRE.maxCelulas, lista.length);
    sv.set(SOBRE.celula, 1, SOBRE.celula);
    for (let k = 0; k < n; k++) {
      const c = lista[k][1];
      e.set(0, C.ang[c], 0);
      q.setFromEuler(e);
      const y = (Number.isFinite(C.y[c]) ? C.y[c] : cota(C.x[c], C.z[c])) + SOBRE.acimaCelula;
      pv.set(C.x[c], y, C.z[c]);
      m4.compose(pv, q, sv);
      cels.setMatrixAt(k, m4);
      cels.setColorAt(k, corDe(C, c));
      zona.slot[c] = k;
      zona.lista.push(c);
    }
    cels.count = n;
    cels.instanceMatrix.needsUpdate = true;
    cels.instanceColor.needsUpdate = true;
    cels.visible = n > 0;
    zona.feito = [cx, cz];
  }

  /**
   * Troca só a cor das células dadas (a pintura e a prévia do pincel mudam a zona, não o lugar). Devolve false se
   * alguma precisa do desenho inteiro de novo: entrou ou saiu do conjunto desenhado (nasceu, morreu, ficou inválida).
   */
  function recolorir(celulas) {
    const C = esp()?.celulas;
    if (!zona.ligada || !C?.n || !zona.feito || !zona.grade) return false;
    const [fx, fz] = zona.feito;
    const R2 = SOBRE.raioCelulas ** 2;
    let mudou = false;
    for (const c of celulas) {
      const k = c < zona.slot.length ? zona.slot[c] : -1;
      const ver = c < C.n && visivel(C, c);
      if (k >= 0) {
        if (!ver) return false;
        cels.setColorAt(k, corDe(C, c));
        mudou = true;
      } else if (ver && (C.x[c] - fx) ** 2 + (C.z[c] - fz) ** 2 <= R2) return false;
    }
    if (mudou) cels.instanceColor.needsUpdate = true;
    return true;
  }

  // ---------------- fantasma e alcance
  const matFant = materialTranslucido(0x5ab0ff, 0.38);
  const geoCaixa = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const fant = ctx.medidas.familia(new THREE.Mesh(geoCaixa, matFant), 'resto');
  fant.name = 'ferramentas:fantasma';
  fant.renderOrder = 22;
  fant.visible = false;
  const matAnel = new THREE.LineBasicMaterial({ color: 0xd9bd84, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  matAnel.name = 'sobreposicao:alcance';
  const anel = ctx.medidas.familia(new THREE.LineSegments(geometriaVazia(), matAnel), 'resto');
  anel.name = 'ferramentas:alcance';
  anel.frustumCulled = false;
  anel.renderOrder = 23;
  anel.visible = false;
  grupo.add(fant, anel);

  function montarFantasma(f) {
    if (!f || !Number.isFinite(f.x)) {
      fant.visible = false;
      anel.visible = false;
      return;
    }
    const [w, d] = Array.isArray(f.pegada) ? f.pegada : [24, 24];
    const y = cota(f.x, f.z);
    fant.position.set(f.x, y - 0.5, f.z);
    fant.rotation.set(0, f.rot ?? 0, 0);
    fant.scale.set(w, SOBRE.alturaFantasma, d);
    matFant.color.copy(f.ok === false ? COR.invalido : COR.normal);
    fant.visible = true;
    const pts = [];
    if (f.alcance > 0) pts.push(...circuloNoChao(f.x, f.z, f.alcance, cota));
    // contorno da planta no chão
    const c = Math.cos(f.rot ?? 0);
    const s = Math.sin(f.rot ?? 0);
    const cantos = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [f.x + a * c + b * s, f.z - a * s + b * c]);
    for (let i = 0; i < 4; i++) pts.push(...linhaNoChao(cantos[i], cantos[(i + 1) % 4], cota, { passo: 6, acima: 0.5 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    anel.geometry.dispose();
    anel.geometry = g;
    matAnel.color.copy(f.ok === false ? COR.invalido : COR.sugestao);
    anel.visible = pts.length > 0;
  }

  // ---------------- demolir
  const matDem = materialTranslucido(0xff5a4a, 0.42);
  const caixasDem = ctx.medidas.familia(new THREE.InstancedMesh(geoCaixa, matDem, 512), 'resto');
  caixasDem.name = 'ferramentas:demolir';
  caixasDem.frustumCulled = false;
  caixasDem.renderOrder = 22;
  caixasDem.count = 0;
  caixasDem.visible = false;
  const fitaDem = ctx.medidas.familia(new THREE.Mesh(geometriaVazia(), materialTranslucido(0xff5a4a, 0.6)), 'resto');
  fitaDem.name = 'ferramentas:demolirVias';
  fitaDem.frustumCulled = false;
  fitaDem.renderOrder = 22;
  fitaDem.visible = false;
  grupo.add(caixasDem, fitaDem);
  let refsDem = [];

  function montarDemolir() {
    const E = esp();
    const P = E?.predios;
    const A = E?.vias?.arestas;
    let n = 0;
    const pos = [];
    const ind = [];
    for (const alvo of refsDem) {
      // { tipo, ref } (a interface diz a tabela); um número sozinho vale como prédio e, se não houver, como aresta
      const ref = typeof alvo === 'number' ? alvo : alvo?.ref;
      const tipo = typeof alvo === 'number' ? null : alvo?.tipo;
      if (!Number.isFinite(ref)) continue;
      const i = idxDaRef(ref);
      const ger = Math.floor(ref / 1048576);
      const ehPredio = tipo !== 'aresta' && P && i < P.n && P.viva[i] && P.ger[i] === ger;
      if (ehPredio && n < 512) {
        const h = alturaDaCaixa(P, i) + 1.5;
        e.set(0, P.rot[i], 0);
        q.setFromEuler(e);
        pv.set(P.x[i], P.y[i] - 0.5, P.z[i]);
        sv.set(P.w[i] + 1, h + 0.5, P.d[i] + 1);
        m4.compose(pv, q, sv);
        caixasDem.setMatrixAt(n++, m4);
      } else if (tipo !== 'predio' && !ehPredio && A && i < A.n && A.viva[i] && A.ger[i] === ger) {
        const larg = VIAS[VIAS_ORDEM[A.tipo[i]]]?.largura ?? 16;
        const m = fitaDaCurva(A.p.subarray(8 * i, 8 * i + 8), larg + 1, cota, { acima: SOBRE.acimaVia + 0.1 });
        const base = pos.length / 3;
        for (const v of m.posicoes) pos.push(v);
        for (const k of m.indices) ind.push(base + k);
      }
    }
    caixasDem.count = n;
    caixasDem.instanceMatrix.needsUpdate = true;
    caixasDem.visible = n > 0;
    if (pos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(new THREE.Uint32BufferAttribute(ind, 1));
      fitaDem.geometry.dispose();
      fitaDem.geometry = g;
    }
    fitaDem.visible = pos.length > 0;
  }

  // ---------------- avisos da interface
  const soltar = [
    ctx.ouvir('ferramenta.via', (v) => montarVia(v)),
    ctx.ouvir('ferramenta.zona', (b) => {
      zona.ligada = !!b;
      if (!b) zona.previa.clear();
      zona.feito = null;
      if (!zona.centro) {
        const alvo = new THREE.Vector3();
        ctx.cameraApi?.alvo?.(alvo);
        zona.centro = [alvo.x, alvo.z];
      }
      montarCelulas();
    }),
    ctx.ouvir('ferramenta.celulas', (c) => {
      const antes = [...zona.previa.keys()];
      zona.previa.clear();
      const lista = c?.celulas ?? [];
      for (const i of lista) zona.previa.set(i, c.zona ?? 0);
      // a prévia anda com o dedo: troca as cores das que saíram e das que entraram; o desenho inteiro só se preciso
      if (zona.ligada && !recolorir([...antes, ...lista])) montarCelulas();
    }),
    ctx.ouvir('ferramenta.pincel', (p) => {
      if (!p || !Number.isFinite(p.x)) return;
      const antes = zona.feito;
      zona.centro = [p.x, p.z];
      if (zona.ligada && (!antes || Math.hypot(p.x - antes[0], p.z - antes[1]) > SOBRE.refazerAoAndar)) montarCelulas();
    }),
    ctx.ouvir('ferramenta.fantasma', (f) => montarFantasma(f)),
    ctx.ouvir('ferramenta.demolir', (refs) => {
      refsDem = Array.isArray(refs) ? refs.slice(0, 1024) : [];
      montarDemolir();
    }),
    ctx.ouvir('ferramenta.limpar', () => {
      montarVia(null);
      montarFantasma(null);
      refsDem = [];
      montarDemolir();
      zona.previa.clear();
      if (zona.ligada) montarCelulas();
    }),
  ];

  return {
    nome: 'ferramentas',
    aplicar(d) {
      // células mudaram: com a tabela nova (tudo, realocado) refaz a grade espacial inteira; na pintura e na via nova
      // só as tocadas entram na grade, e as que já estão desenhadas trocam de cor sem refazer as instâncias
      const C = esp()?.celulas;
      const tudo = d?.tudo?.celulas || d?.realocado?.includes('celulas');
      if (tudo) zona.grade = null;
      else if (d?.celulas?.length && C && zona.grade) {
        const G = gradeDe(C);
        let andou = false;
        for (const c of d.celulas) if (c < G.de.length && porNaGrade(G, c)) andou = true;
        if (zona.ligada && (andou || !recolorir(d.celulas))) montarCelulas();
      } else if (d?.celulas?.length && zona.ligada) montarCelulas();
      if (tudo && zona.ligada) montarCelulas();
      if (refsDem.length && (d?.predios?.length || d?.arestas?.length || d?.tudo?.predios || d?.tudo?.vias)) montarDemolir();
    },
    /** Medidas para a cena e os testes. */
    medidas: () => ({
      via: fita.visible ? fita.geometry.index.count / 3 : 0,
      linhas: linhas.visible ? linhas.geometry.attributes.position.count / 2 : 0,
      celulas: cels.visible ? cels.count : 0,
      fantasma: fant.visible,
      demolir: caixasDem.count + (fitaDem.visible ? 1 : 0),
      gerador: geradorDaR3a() ? 'R3a' : 'fita plana',
    }),
    descartar() {
      for (const f of soltar) f();
      ctx.cena.remove(grupo);
      for (const o of [fita, linhas, cels, fant, anel, caixasDem, fitaDem]) o.geometry?.dispose?.();
      for (const m of [matFita, matLinha, matCel, matFant, matAnel, matDem, fitaDem.material]) m.dispose();
    },
  };
}

export function registrar(api) {
  api.registrarDominio('ferramentas', criarFerramentas);
}
