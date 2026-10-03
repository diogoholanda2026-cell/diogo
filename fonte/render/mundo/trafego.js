// Carros (desenho do render 8, D37). Sem o trânsito agregado (S1c, M1b), uma amostra pela heurística: a densidade de
// cada aresta sai do tipo de via, da hora do céu (picos de manhã e no fim da tarde, madrugada vazia) e das zonas das
// células vizinhas (comércio e escritório puxam mais, indústria traz caminhões). Com espelho.fluxos (veículos por
// hora no pico, por sentido, e o fator de velocidade), a densidade vem do fluxo: carros por km = fluxo / velocidade.
//
// Como andam (R3b):
//   fila     cada faixa é uma fila ordenada; quem faz a curva de um cruzamento está nas duas filas (a da faixa de onde
//            saiu, à frente da boca, e a da faixa para onde vai, atrás da boca). A velocidade sai da distância ao da
//            frente (a que ainda para com a frenagem de conforto, contando a velocidade dele) e o passo nunca passa da
//            distância de fila: um carro não entra no outro nem com um quadro longo
//   cruzamento  a vez é uma reserva no nó: o carro só cruza se a curva dele não chega perto da curva de quem já está
//            lá dentro (ou já reservou) e se ninguém que pediu antes, com a curva cruzando a dele, espera a vez. A
//            ordem de chegada manda, com a via principal na frente (sem semáforo) e a conversão à esquerda atrás;
//            no semáforo só pede quem tem o verde, e quem ainda para antes da retenção desiste no amarelo. O bolsão:
//            quem espera na retenção ainda sai no amarelo e, virando à esquerda, nos primeiros 3 s do vermelho
//   faixa    a faixa de destino segue a virada (direita para a faixa da direita, esquerda para a da esquerda, em frente
//            na mesma posição ou sorteada, vindo de uma faixa só); o carro só sai para uma faixa com lugar
//   saída    com espelho.fluxos, o braço de saída é sorteado pelo fluxo dele naquele sentido; sem, pelo tipo da via
//   amostra  com o teto do perfil abaixo dos carros esperados, nasce mais perto da câmera (fora do LOD0, para não
//            brotar à vista) e quem está longe do alvo sai aos poucos: a rua da câmera fica com a densidade do fluxo
//   gente    pedestre na faixa de pedestres (pedestres.js): o carro não entra nem sai pelo braço dela e para na
//            retenção
//   externos os caminhões das entregas (caminhoes.js) andam aqui como carros com rota fixa, no ritmo da viagem da
//            simulação; quem desenha é caminhoes.js
// Faróis e lanternas acesos à noite, luz de freio. Os carros estacionados vêm do setor de vias (as vagas). Tetos por
// perfil (Média 120 andando); 6 modelos em 2 LODs, uma chamada por modelo e LOD (família 'vida').
import * as THREE from 'three';
import { malhaVeiculo, MODELOS } from '../geracao/veiculos.js';
import { faixasDeTransito, estacao, hashF } from '../geracao/malhaVia.js';
import { perfilVia, ALTURA, alturaNaSecao } from '../geracao/perfilVia.js';
import { FROTA_CORES, porPeso, grupoSemaforo, defasagemSemaforo } from '../geracao/cruzamento.js';
import * as SH from '../materiais/shaders/via.glsl.js';
import { alturaEm } from '../../comum/altura.js';
import { CELULA } from '../../contratos/flags.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { porPerfil } from '../motor/perfis.js';

/** Tetos e alcances por perfil (desenho do render 2.10): carros andando, estacionados, raio da amostra e do LOD0. */
export const PERFIL_TRAFEGO = Object.freeze({
  ultra: { carros: 400, estacionados: 500, raio: 700, lod0: 130, parados: 450 },
  alta: { carros: 240, estacionados: 300, raio: 500, lod0: 95, parados: 320 },
  media: { carros: 120, estacionados: 160, raio: 360, lod0: 70, parados: 230 },
  leve: { carros: 50, estacionados: 0, raio: 220, lod0: 40, parados: 0 },
});

/** Carros por 100 m de faixa no pico, por tipo de via. */
export const BASE_TIPO = Object.freeze({ rua: 0.45, ruaMao: 0.5, avenida: 1.1, avenidaG: 1.35, rodovia: 1.3, terra: 0.08 });
/** Peso de cada família de zona na atração de carros. */
const PESO_ZONA = Object.freeze({ res: 1, com: 2.2, esc: 2.6, ind: 1.5 });
/** Teto da densidade pelo fluxo (carros por 100 m de faixa): a fila parada tem uns 15. */
export const DENSIDADE_MAX = 9;

/** Fator da hora do céu (0 a 1): picos às 7h30 e às 18h, almoço, madrugada quase vazia. */
export function fatorHora(h) {
  const g = (c, s) => Math.exp(-((((h - c + 36) % 24) - 12) ** 2) / (2 * s * s));
  return Math.min(1, 0.1 + 0.9 * Math.max(g(7.5, 1.4), 0.95 * g(18, 1.8), 0.6 * g(12.5, 2.4), 0.45 * g(15, 3)));
}

/** Fator das zonas vizinhas de uma aresta: { res, com, esc, ind } em células ocupadas; comprimento em m. */
export function fatorZona(contagem, comprimento) {
  let soma = 0;
  for (const [k, n] of Object.entries(contagem ?? {})) soma += (PESO_ZONA[k] ?? 1) * n;
  const cap = Math.max(1, (comprimento / 8) * 2);
  return 0.4 + Math.min(1.8, (1.4 * soma) / cap);
}

/** Carros por 100 m de faixa numa aresta (a heurística do M1a). */
export function densidade(tipo, hora, contagem, comprimento) {
  const id = perfilVia(tipo).id;
  return (BASE_TIPO[id] ?? 0.3) * fatorHora(hora) * fatorZona(contagem, comprimento);
}

/**
 * Carros por 100 m de faixa pelo fluxo (S1c): q veículos por hora no pico no sentido, repartidos nas faixas dele, na
 * velocidade da via vezes o fator (0 a 1, congestionamento), na hora do céu.
 */
export function densidadeFluxo(tipo, q, faixas, vel, hora) {
  if (!(q > 0) || !(faixas > 0)) return 0;
  const vKmh = Math.max(5, perfilVia(tipo).velocidade * Math.max(0.15, Math.min(1, vel || 1)));
  return Math.min(DENSIDADE_MAX, ((q / faixas / vKmh) * fatorHora(hora)) / 10);
}

/** Onde o carro para no vermelho: a frente a 0,5 m antes da retenção (m da boca; a retenção do shader vai de 6,4 a 6,8). */
export const PARADA = 7.3;
/** Folga entre o para-choque de um e o do outro na fila (m). */
export const FOLGA_FILA = 2;
/** Frenagem de conforto (m/s²): a velocidade que ainda para no espaço livre. */
export const A_PLANO = 3;
/** Frenagem forte (m/s²): a correção quando o plano não bastou. */
export const A_MAX = 7;
/** Velocidades na curva do nó (m/s): cruzamento, curva de duas vias e retorno na ponta. */
export const V_NO = Object.freeze({ cruzamento: 7, curva: 10, retorno: 5 });
/** Até onde (m da boca) o carro escolhe a saída e pede a vez. */
const OLHAR = 45;
/** Amostras da curva do nó para o teste de conflito. */
const N_CURVA = 8;
/**
 * Peso da distância ao alvo na escolha de onde nasce um carro (0,2 a 1): cheio até 30% do raio, caindo até a borda.
 * Com o teto do perfil abaixo dos carros esperados, a amostra fica cheia perto da câmera e rala longe.
 */
export const pesoDistancia = (d, R) => (d <= 0.3 * R ? 1 : Math.max(0.2, 1 - (0.8 * (d - 0.3 * R)) / (0.7 * R)));

/** Parado na fila (s) além disso, o carro sai da amostra (trava de laço de vias curtas). */
export const DESISTE = 50;

/** Distância mínima entre os centros de dois carros na mesma faixa (m): meio comprimento de cada um e a folga. */
export const distanciaNaFila = (miTras, miFrente) => (MODELOS[miTras].c + MODELOS[miFrente].c) / 2 + FOLGA_FILA;
/** A mesma conta pelos comprimentos dos dois (os caminhões das entregas não estão em MODELOS). */
const distFila = (a, b) => (a.c + b.c) / 2 + FOLGA_FILA;

/** Velocidade que ainda para em g metros com a frenagem de conforto, contando a do da frente (vL). */
export const velSegura = (g, vL = 0) => Math.sqrt(Math.max(0, 2 * A_PLANO * g + 0.6 * vL * vL));

/** Duração do vermelho de cada grupo (s): o ciclo de 40 s com 16 de verde e 3 de amarelo. */
export const VERMELHO = 21;
/** O bolsão: quem espera na retenção para virar à esquerda ainda sai até tantos segundos do vermelho (a limpeza). */
export const LIMPEZA = 3;

/** Fase do semáforo (0 verde, 1 amarelo, 2 vermelho) do grupo g: a mesma conta do shader (via.glsl.js, objFase). */
export function faseSemaforo(tempo, g, defas) {
  const t = (((tempo + defas * 0.16) % 40) + 40) % 40;
  const m = g < 0.5 ? t : (t + 20) % 40;
  return m < 16 ? 0 : m < 19 ? 1 : 2;
}

/** Segundos que faltam do vermelho do grupo g (0 fora do vermelho): a gente atravessa no vermelho dos carros. */
export function restaVermelho(tempo, g, defas) {
  const t = (((tempo + defas * 0.16) % 40) + 40) % 40;
  const m = g < 0.5 ? t : (t + 20) % 40;
  return m >= 19 ? 40 - m : 0;
}

/** Virada de (hx, hz) para (gx, gz), olhando de cima: 1 à direita, -1 à esquerda, 0 em frente (até 35 graus). */
export function virada(hx, hz, gx, gz) {
  const ang = Math.atan2(hx * gz - hz * gx, hx * gx + hz * gz);
  return Math.abs(ang) < 0.61 ? 0 : ang > 0 ? 1 : -1;
}

/** Faixas de um sentido da aresta, da esquerda para a direita de quem anda nele (u vezes o sentido crescente). */
const cacheFaixas = new Map();
export function faixasOrdenadas(tipo, mao, sentido) {
  const k = `${tipo}:${mao}:${sentido}`;
  let l = cacheFaixas.get(k);
  if (!l) {
    l = faixasDeTransito(tipo, mao).filter((f) => f.sentido === sentido).sort((a, b) => a.u * sentido - b.u * sentido);
    cacheFaixas.set(k, l);
  }
  return l;
}

/**
 * Faixa de destino pela virada: à direita, a da direita; à esquerda, a da esquerda; em frente, a mesma posição (de
 * `rank` em `n` faixas de origem) ou, vindo de uma faixa só, a sorteada por h (0 a 1; sem h, a da direita).
 * `direita`: em frente pela faixa da direita (caminhões).
 */
export function faixaDestino(fx, rank, n, vir, direita = false, h = null) {
  if (!fx.length) return null;
  if (vir > 0 || (vir === 0 && direita)) return fx[fx.length - 1];
  if (vir < 0) return fx[0];
  if (n <= 1) return h === null ? fx[fx.length - 1] : fx[Math.min(fx.length - 1, Math.floor(h * fx.length))];
  return fx[Math.round((rank / (n - 1)) * (fx.length - 1))];
}

/** Quadrado da distância do ponto p ao segmento qr. */
function dist2PontoSeg(px, pz, qx, qz, rx, rz) {
  const lx = rx - qx;
  const lz = rz - qz;
  const l2 = lx * lx + lz * lz;
  const f = l2 > 0 ? Math.max(0, Math.min(1, ((px - qx) * lx + (pz - qz) * lz) / l2)) : 0;
  const dx = px - qx - f * lx;
  const dz = pz - qz - f * lz;
  return dx * dx + dz * dz;
}

/** Quadrado da distância entre os segmentos ab e cd no plano (0 se cruzam). */
function dist2Seg(ax, az, bx, bz, cx, cz, dx, dz) {
  const ux = bx - ax;
  const uz = bz - az;
  const vx = dx - cx;
  const vz = dz - cz;
  const wx = ax - cx;
  const wz = az - cz;
  const den = ux * vz - uz * vx;
  if (Math.abs(den) > 1e-12) {
    const s = (vx * wz - vz * wx) / den;
    const t = (ux * wz - uz * wx) / den;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return 0;
  }
  return Math.min(
    dist2PontoSeg(ax, az, cx, cz, dx, dz),
    dist2PontoSeg(bx, bz, cx, cz, dx, dz),
    dist2PontoSeg(cx, cz, ax, az, bx, bz),
    dist2PontoSeg(dx, dz, ax, az, bx, bz),
  );
}

/**
 * Menor distância entre duas poligonais (x, z intercalados), a partir dos índices ia e ib (e, em B, só até o trecho
 * fimB, exclusive). Com `lim`, para no primeiro par de trechos mais perto que ele (devolve essa distância: basta para
 * saber que é menor que lim).
 */
export function distPoligonais(A, ia, B, ib, lim = 0, fimB = Infinity) {
  let m = Infinity;
  const l2 = lim * lim;
  const na = A.length / 2 - 1;
  const nb = Math.min(B.length / 2 - 1, fimB);
  for (let i = ia; i < na; i++) {
    for (let j = ib; j < nb; j++) {
      const d = dist2Seg(A[2 * i], A[2 * i + 1], A[2 * i + 2], A[2 * i + 3], B[2 * j], B[2 * j + 1], B[2 * j + 2], B[2 * j + 3]);
      if (d < m) {
        m = d;
        if (m < l2) return Math.sqrt(m);
      }
    }
  }
  return Math.sqrt(m);
}

/** Ponto e tangente da cúbica p (8 números) em t. */
export function pontoCurva(p, t, out) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  out.x = a * p[0] + b * p[2] + d * p[4] + e * p[6];
  out.z = a * p[1] + b * p[3] + d * p[5] + e * p[7];
  const dx = 3 * u * u * (p[2] - p[0]) + 6 * u * t * (p[4] - p[2]) + 3 * t * t * (p[6] - p[4]);
  const dz = 3 * u * u * (p[3] - p[1]) + 6 * u * t * (p[5] - p[3]) + 3 * t * t * (p[7] - p[5]);
  const l = Math.sqrt(dx * dx + dz * dz) || 1;
  out.hx = dx / l;
  out.hz = dz / l;
  return out;
}

/**
 * Matriz da instância (16 números, por coluna, a partir de o) que gira em y para a frente (+z do modelo) olhar para
 * (hx, hz), escala s e põe em (x, y, z): a mesma de compose(posição, giro em y por atan2(hx, hz), s), sem o quatérnio.
 */
export function matrizGiroY(arr, o, x, y, z, hx, hz, s = 1) {
  const l = Math.sqrt(hx * hx + hz * hz);
  const sn = l > 1e-9 ? (hx / l) * s : 0;
  const cs = l > 1e-9 ? (hz / l) * s : s;
  arr[o] = cs;
  arr[o + 1] = 0;
  arr[o + 2] = -sn;
  arr[o + 3] = 0;
  arr[o + 4] = 0;
  arr[o + 5] = s;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = sn;
  arr[o + 9] = 0;
  arr[o + 10] = cs;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

/** Copia o ponto e a direção (x, z, hx, hz) de q para o carro, sem objeto novo a cada quadro. */
function pose(c, q) {
  c.x = q.x;
  c.z = q.z;
  c.hx = q.hx;
  c.hz = q.hz;
}

/** Posição na faixa: ponto e direção de viagem. */
const EST = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
export function naFaixa(ar, u, s, sentido, out) {
  estacao(ar.p, ar.tab, s, EST);
  out.x = EST.x - EST.tz * u;
  out.z = EST.z + EST.tx * u;
  out.hx = EST.tx * sentido;
  out.hz = EST.tz * sentido;
  return out;
}

/** s onde a faixa de um sentido acaba (a boca do nó da frente) e onde começa. */
export const fimDaFaixa = (ar, sentido) => (sentido > 0 ? ar.L - ar.cFim : ar.cIni);
export const inicioDaFaixa = (ar, sentido) => (sentido > 0 ? ar.cIni : ar.L - ar.cFim);

const QA = { x: 0, z: 0, hx: 1, hz: 0 };
const QB = { x: 0, z: 0, hx: 1, hz: 0 };

/**
 * A curva do nó entre o fim de uma faixa (ar, u, sentido) e o começo de outra (ar2, u2, sentido2): a cúbica com as
 * alças nas direções das faixas (o retorno avança pelo miolo redondo da ponta antes de voltar), o comprimento e a
 * poligonal de N_CURVA trechos para o teste de conflito.
 */
export function curvaEntre(ar, u, sentido, ar2, u2, sentido2, retorno = false) {
  naFaixa(ar, u, fimDaFaixa(ar, sentido), sentido, QA);
  naFaixa(ar2, u2, inicioDaFaixa(ar2, sentido2), sentido2, QB);
  const L = Math.hypot(QB.x - QA.x, QB.z - QA.z);
  const h = retorno ? Math.max(3, L * 0.9) : L * 0.42;
  const p = [QA.x, QA.z, QA.x + QA.hx * h, QA.z + QA.hz * h, QB.x - QB.hx * h, QB.z - QB.hz * h, QB.x, QB.z];
  // comprimento da cúbica: a média da corda e do polígono de controle (o retorno anda mais que a corda)
  const rede = Math.hypot(p[2] - p[0], p[3] - p[1]) + Math.hypot(p[4] - p[2], p[5] - p[3]) + Math.hypot(p[6] - p[4], p[7] - p[5]);
  const poli = new Float64Array(2 * (N_CURVA + 1));
  const q = { x: 0, z: 0, hx: 0, hz: 0 };
  for (let k = 0; k <= N_CURVA; k++) {
    pontoCurva(p, k / N_CURVA, q);
    poli[2 * k] = q.x;
    poli[2 * k + 1] = q.z;
  }
  const ang = Math.abs(Math.atan2(QA.hx * QB.hz - QA.hz * QB.hx, QA.hx * QB.hx + QA.hz * QB.hz));
  return { p, L: Math.max(1, (L + rede) / 2), poli, vir: retorno ? 0 : virada(QA.hx, QA.hz, QB.hx, QB.hz), ang: retorno ? Math.PI : ang };
}

/** Modelo de um carro andando: passeio na maioria, ônibus nas avenidas, caminhão perto da indústria e na rodovia. */
function modeloDe(tipoId, h, ind) {
  if ((tipoId === 'avenida' || tipoId === 'avenidaG') && h < 0.06) return 4;
  if (h < 0.06 + (tipoId === 'rodovia' ? 0.1 : 0) + 0.12 * ind) return 5;
  return porPeso([[0, 0.34], [1, 0.26], [2, 0.24], [3, 0.16]], hashF(Math.floor(h * 1e6), 7));
}

const CORES = FROTA_CORES.map(([hex]) => {
  const c = parseInt(hex.slice(1), 16);
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
});

// ------------------------------------------------------------------------------------------------ material

function trocar(src, alvo, novo) {
  if (!src.includes(alvo)) throw new Error(`carro: shader sem '${alvo}'`);
  return src.replace(alvo, novo);
}

/** Material dos carros: partes no shader, cor e luzes da instância. */
export function criarMaterialCarro(ganchos, U) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0 });
  m.name = 'carro';
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    let vs = s.vertexShader;
    vs = trocar(vs, '#include <common>', `#include <common>\n${SH.CARRO_VERTICE_PARS}`);
    vs = trocar(vs, '#include <begin_vertex>', `#include <begin_vertex>\n${SH.CARRO_VERTICE_MAIN}`);
    let fs = s.fragmentShader;
    fs = trocar(fs, '#include <common>', `#include <common>\n${SH.CARRO_FRAGMENTO_PARS}`);
    fs = trocar(fs, '#include <color_fragment>', SH.CARRO_FRAGMENTO_COR);
    fs = trocar(fs, '#include <roughnessmap_fragment>', SH.CARRO_FRAGMENTO_RUGOSIDADE);
    fs = trocar(fs, '#include <metalnessmap_fragment>', SH.CARRO_FRAGMENTO_METAL);
    fs = trocar(fs, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SH.CARRO_FRAGMENTO_EMISSIVO}`);
    s.vertexShader = vs;
    s.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'carro-1';
  return ganchos.aplicar(m, ganchos.nomes().filter((n) => n !== 'camada'));
}

// ------------------------------------------------------------------------------------------------ domínio

/** Chave numérica de uma faixa: a aresta, o u (as faixas ficam a mais de 3 m umas das outras, |u| < 64) e o sentido. */
const chave = (e, u, sentido) => (e * 1024 + Math.round(u * 8) + 512) * 2 + (sentido > 0 ? 1 : 0);

/** Lista de um mapa de listas por quadro (as listas ficam e são esvaziadas no começo do quadro). */
function listaDe(mapa, k) {
  let l = mapa.get(k);
  if (!l) mapa.set(k, (l = []));
  return l;
}

/** Esvazia as listas do mapa; de tempos em tempos, esquece as chaves (faixas e nós que saíram da amostra). */
function esvaziar(mapa, tudo) {
  if (tudo) mapa.clear();
  else for (const l of mapa.values()) l.length = 0;
}

function criarTrafego(ctx) {
  const { cena, medidas } = ctx;
  const U = { gCarroNoite: { value: 0 } };
  const material = criarMaterialCarro(ctx.ganchos, U);
  const perfil = () => porPerfil(PERFIL_TRAFEGO, ctx.perfil);
  // uma InstancedMesh por modelo e LOD, com a cor e as luzes por instância
  const malhas = [];
  function montarMalhas() {
    for (const m of malhas) {
      cena.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.dispose(); // a matriz das instâncias tem buffer próprio na GPU
    }
    malhas.length = 0;
    const P = perfil();
    const cap = Math.max(16, P.carros + P.estacionados);
    MODELOS.forEach((_, mi) => {
      for (const lod of [0, 1]) {
        const v = malhaVeiculo(mi, lod);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(v.posicao, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(v.normal, 3));
        g.setAttribute('aParte', new THREE.BufferAttribute(Float32Array.from(v.parte), 1));
        g.setIndex(new THREE.BufferAttribute(v.indices, 1));
        const cor = new THREE.InstancedBufferAttribute(new Uint8Array(cap * 4), 4, false);
        cor.setUsage(THREE.DynamicDrawUsage);
        g.setAttribute('aCarro', cor);
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
        const mesh = new THREE.InstancedMesh(g, material, cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.count = 0;
        mesh.visible = false;
        mesh.name = `carros:${MODELOS[mi].id}:${lod}`;
        medidas.familia(mesh, 'vida');
        cena.add(mesh);
        malhas.push({ mi, lod, mesh, cor, cap, tris: v.tris });
      }
    });
  }
  montarMalhas();
  let perfilMontado = ctx.perfil.id;

  // ---------------------------------------------------------------------------------------------- estado
  const carros = [];
  /** Caminhões das entregas (caminhoes.js) andando aqui: id da entrega → carro. */
  const externos = new Map();
  /** Entregas cujo caminhão chegou ao fim da rota aqui (antes de a simulação tirar a entrega do espelho). */
  const fins = new Set();
  let candidatos = [];
  let somaPeso = 0; // carros esperados perto do alvo (pelo fluxo ou pela heurística)
  let somaSorteio = 0; // a soma dos pesos de sorteio (perto da câmera pesa mais)
  let alvoCand = null;
  let tCand = -1e9;
  let zonas = null;
  let zonasSujas = true;
  let versaoRede = -1;
  let seq = 1;
  let animar = null; // cenas podem forçar (true) ou parar (false); null: anda com o jogo
  const alvo = new THREE.Vector3();
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };
  // por quadro: as filas por faixa, os carros com a vez em cada nó e os que pediram a vez (as listas e as entradas das
  // filas, { c, pos }, são reaproveitadas de um quadro para o outro)
  const filas = new Map();
  const ativos = new Map();
  const pedidos = new Map();
  const entradas = [];
  let nEntradas = 0;
  let nQuadros = 0;
  let relogio = 0;

  /** Contagem das zonas vizinhas por aresta (células ocupadas). */
  function contarZonas(esp) {
    const C = esp.celulas;
    const mapa = new Map();
    if (!C) return mapa;
    for (let c = 0; c < C.n; c++) {
      if (!C.viva[c] || C.estado[c] !== CELULA.OCUPADA || !C.zona[c]) continue;
      const fam = ZONAS[ZONAS_ORDEM[C.zona[c]]]?.familia;
      if (!fam) continue;
      const e = C.aresta[c];
      let o = mapa.get(e);
      if (!o) mapa.set(e, (o = {}));
      o[fam] = (o[fam] ?? 0) + 1;
    }
    return mapa;
  }

  /** Fluxo de um sentido da aresta (veículos por hora no pico) e o fator de velocidade, se espelho.fluxos existe. */
  function fluxoDe(F, ar, sentido, temFaixa) {
    if (!F?.ida || ar.e >= F.ida.length) return null;
    let q = sentido > 0 ? F.ida[ar.e] : F.volta?.[ar.e] ?? 0;
    // a mão única pode vir com o fluxo no outro sentido
    if (!(q > 0) && !temFaixa(-sentido)) q = sentido > 0 ? F.volta?.[ar.e] ?? 0 : F.ida[ar.e];
    return { q: q || 0, vel: F.vel?.[ar.e] ?? 1 };
  }

  /** Arestas perto do alvo da câmera, com o peso (carros esperados) de cada faixa. */
  function escolherCandidatos(vias, hora, esp) {
    const R = perfil().raio;
    const F = esp?.fluxos ?? null;
    candidatos = [];
    somaPeso = 0;
    for (const ar of vias.rede.arestas.values()) {
      const L = ar.L - ar.cIni - ar.cFim;
      if (L < 12) continue;
      estacao(ar.p, ar.tab, ar.L / 2, est);
      const d = Math.hypot(est.x - alvo.x, est.z - alvo.z);
      if (d > R + ar.L / 2) continue;
      const faixas = faixasDeTransito(ar.tipo, ar.mao);
      if (!faixas.length) continue;
      const nSent = { 1: 0, '-1': 0 };
      for (const f of faixas) nSent[f.sentido]++;
      const tem = (s) => nSent[s] > 0;
      const ind = (zonas?.get(ar.e)?.ind ?? 0) / Math.max(1, L / 8);
      const pesos = faixas.map((f) => {
        const fl = F ? fluxoDe(F, ar, f.sentido, tem) : null;
        const dens = fl ? densidadeFluxo(ar.tipo, fl.q, nSent[f.sentido], fl.vel, hora) : densidade(ar.tipo, hora, zonas?.get(ar.e), ar.L);
        return (dens * L) / 100;
      });
      const w = pesos.reduce((a, b) => a + b, 0);
      if (w <= 0) continue;
      candidatos.push({ ar, faixas, pesos, w, ind, g: pesoDistancia(d, R), ws: 0 });
      somaPeso += w;
    }
    // sorteio pelo peso vezes o da distância; se o teto passa da soma disso, mistura com o peso puro (lam) até ela
    // chegar ao teto: perto da câmera a densidade nunca passa da esperada
    const alvoN = Math.min(perfil().carros, somaPeso);
    let somaG = 0;
    for (const c of candidatos) somaG += c.w * c.g;
    const lam = somaG >= alvoN || somaPeso <= somaG ? 0 : (alvoN - somaG) / (somaPeso - somaG);
    somaSorteio = 0;
    for (const c of candidatos) {
      c.ws = c.w * (c.g + lam * (1 - c.g));
      somaSorteio += c.ws;
    }
    alvoCand = alvo.clone();
  }

  /** Posição de um carro numa fila (faixa): a da faixa, ou a da curva que sai dela ou entra nela. */
  function entrarNaFila(k, c, pos) {
    let o = entradas[nEntradas];
    if (!o) entradas.push((o = { c: null, pos: 0 }));
    nEntradas++;
    o.c = c;
    o.pos = pos;
    listaDe(filas, k).push(o);
  }

  /** Lugar livre numa faixa para um carro de comprimento cc em s (pelas filas do último quadro). */
  function lugarLivre(ar, u, sentido, s, cc, folga = 0) {
    const f = filas.get(chave(ar.e, u, sentido));
    if (!f) return true;
    const pos = s * sentido;
    for (const o of f) if (Math.abs(o.pos - pos) < (cc + o.c.c) / 2 + FOLGA_FILA + folga) return false;
    return true;
  }

  function novoCarro(ar, f, s, mi, { c = MODELOS[mi].c, l = MODELOS[mi].l, vMax, cor, externo = null } = {}) {
    const id = seq++;
    const P = perfilVia(ar.tipo);
    const vm = vMax ?? (P.velocidade / 3.6) * (0.72 + 0.25 * hashF(id, 5));
    const car = {
      id, e: ar.e, u: f.u, sentido: f.sentido, s, v: 0, vMax: vm, mi, c, l,
      cor: cor ?? CORES[porPeso(FROTA_CORES.map(([, w], k) => [k, w]), hashF(id, 6))],
      curva: null, prox: null, reserva: null, tPedido: null, quer: false, espera: 0, parado: 0, freio: false,
      x: 0, y: 0, z: 0, hx: 1, hz: 0, idade: 0, externo,
    };
    // começa na velocidade que ainda para antes da boca
    const resta = (fimDaFaixa(ar, f.sentido) - s) * f.sentido;
    car.v = Math.min(vm * 0.8, velSegura(Math.max(0, resta - PARADA - c / 2)));
    naFaixa(ar, car.u, car.s, car.sentido, QA);
    pose(car, QA);
    return car;
  }

  /** Um carro novo numa faixa sorteada; longeCam: não nasce a menos disso da câmera (o carro não brota à vista). */
  function nascer(longeCam = 0) {
    if (!candidatos.length || somaSorteio <= 0) return null;
    let a = hashF(seq, 1) * somaSorteio;
    let c = candidatos[candidatos.length - 1];
    for (const q of candidatos) {
      a -= q.ws;
      if (a < 0) {
        c = q;
        break;
      }
    }
    let b = hashF(seq, 2) * c.w;
    let f = c.faixas[c.faixas.length - 1];
    for (let k = 0; k < c.faixas.length; k++) {
      b -= c.pesos[k];
      if (b < 0) {
        f = c.faixas[k];
        break;
      }
    }
    const ar = c.ar;
    // longe das bocas: nem em cima da retenção, nem saindo de um cruzamento
    const s0 = ar.cIni + 6;
    const s1 = ar.L - ar.cFim - 6;
    const s = s1 - s0 > 30 ? (f.sentido > 0 ? s0 + hashF(seq, 3) * (s1 - s0 - 24) : s0 + 24 + hashF(seq, 3) * (s1 - s0 - 24)) : (s0 + s1) / 2;
    if (longeCam > 0) {
      estacao(ar.p, ar.tab, s, est);
      const cam = ctx.camera.position;
      if ((est.x - cam.x) ** 2 + (est.z - cam.z) ** 2 < longeCam * longeCam) return null;
    }
    const P = perfilVia(ar.tipo);
    const mi = modeloDe(P.id, hashF(seq, 4), c.ind);
    // não nasce em cima de outro (nem de um ônibus de 12 m), nem numa fila parada (não alimenta o congestionamento)
    if (!lugarLivre(ar, f.u, f.sentido, s, MODELOS[mi].c, 8)) return null;
    for (const o of filas.get(chave(ar.e, f.u, f.sentido)) ?? []) if (o.c.parado > 15) return null;
    return novoCarro(ar, f, s, mi);
  }

  /** Rank da faixa do carro entre as do sentido dele (0 a mais à esquerda) e quantas são. */
  function rankDe(ar, car) {
    const fx = faixasOrdenadas(ar.tipo, ar.mao, car.sentido);
    return { rank: Math.max(0, fx.findIndex((f) => f.u === car.u)), n: fx.length };
  }

  /** Prepara a saída: a curva do fim da faixa do carro até a boca da faixa escolhida. */
  function saida(car, ar, a2, sentido, f, no, n, extra = {}) {
    const retorno = !!extra.retorno;
    const cv = curvaEntre(ar, car.u, car.sentido, a2, f.u, sentido, retorno);
    const vLim = retorno ? V_NO.retorno : no.tipo === 'cruzamento' ? V_NO.cruzamento : no.tipo === 'curva' ? V_NO.curva : car.vMax;
    return { ar: a2, sentido, u: f.u, s: inicioDaFaixa(a2, sentido), no, n, de: ar, ...cv, vLim, retorno, ...extra };
  }

  /** Próxima aresta na ponta: a rota do caminhão, ou um braço do nó que aceite a direção (sem voltar pela mesma). */
  function proxima(vias, car, ar) {
    const n = car.sentido > 0 ? ar.b : ar.a;
    const no = vias.rede.nos.get(n);
    if (!no) return null;
    estacao(ar.p, ar.tab, fimDaFaixa(ar, car.sentido), est);
    const hx = est.tx * car.sentido;
    const hz = est.tz * car.sentido;
    const { rank, n: nf } = rankDe(ar, car);
    const ext = car.externo;
    if (ext) {
      // o caminhão segue a rota da entrega; chegou ao fim (ou a rota quebrou): sai
      const k = ext.k + 1;
      const passo = ext.plano.passos[k];
      if (!passo) return null;
      const a2 = vias.rede.arestas.get(passo.e);
      if (!a2 || (passo.sentido > 0 ? a2.a : a2.b) !== n) return null;
      const fx = faixasOrdenadas(a2.tipo, a2.mao, passo.sentido);
      if (!fx.length) return null;
      estacao(a2.p, a2.tab, inicioDaFaixa(a2, passo.sentido), est);
      const vir = virada(hx, hz, est.tx * passo.sentido, est.tz * passo.sentido);
      return saida(car, ar, a2, passo.sentido, faixaDestino(fx, rank, nf, vir, true), no, n, { k });
    }
    const saidas = [];
    const F = ctx.sim?.espelho?.fluxos;
    for (const b of no.analise.bracos) {
      if (b.e === car.e && b.inverte === car.sentido > 0) continue;
      const a2 = vias.rede.arestas.get(b.e);
      if (!a2) continue;
      const sentido = b.inverte ? -1 : 1;
      const fx = faixasOrdenadas(a2.tipo, a2.mao, sentido);
      if (!fx.length) continue;
      const vir = virada(hx, hz, b.dx, b.dz);
      // pelo fluxo da saída naquele sentido (S1c), se houver; senão, pelo tipo da via
      let w = (BASE_TIPO[perfilVia(a2.tipo).id] ?? 0.3) + 0.2;
      if (F?.ida && a2.e < F.ida.length) {
        let q = sentido > 0 ? F.ida[a2.e] : F.volta?.[a2.e] ?? 0;
        if (!(q > 0) && a2.mao) q = sentido > 0 ? F.volta?.[a2.e] ?? 0 : F.ida[a2.e];
        w = 0.15 + Math.max(0, q || 0) / 600;
      }
      // a faixa da direita vira à direita, a da esquerda à esquerda; das outras a conversão é rara
      // toco curto sem saída: o retorno caberia dentro do cruzamento; só entra se não houver outra saída
      const outro = vias.rede.nos.get(sentido > 0 ? a2.b : a2.a);
      if (outro?.tipo === 'ponta' && a2.L < 40) w *= 0.001;
      if (nf > 1 && vir > 0 && rank < nf - 1) w *= 0.15;
      // à esquerda da faixa da direita cruza a outra faixa e trava o fluxo contrário: quase nunca
      if (nf > 1 && vir < 0 && rank > 0) w *= 0.03;
      saidas.push({ a2, sentido, fx, w, vir });
    }
    if (!saidas.length) {
      // sem saída: faz o retorno na ponta, para a faixa do outro sentido da mesma via; a rodovia que acaba na ponta
      // sai do mapa (o carro some)
      if (no.tipo !== 'ponta' || perfilVia(ar.tipo).id === 'rodovia') return null;
      const volta = -car.sentido;
      const fx = faixasOrdenadas(ar.tipo, ar.mao, volta);
      if (!fx.length) return null;
      // a faixa mais perto da que o carro está: a da esquerda de quem volta
      return saida(car, ar, ar, volta, fx[0], no, n, { retorno: true });
    }
    const soma = saidas.reduce((q, x) => q + x.w, 0);
    let h = hashF(car.id, car.idade++ + 11) * soma;
    let esc = saidas[saidas.length - 1];
    for (const x of saidas) {
      h -= x.w;
      if (h < 0) {
        esc = x;
        break;
      }
    }
    return saida(car, ar, esc.a2, esc.sentido, faixaDestino(esc.fx, rank, nf, esc.vir, false, hashF(car.id, car.idade + 31)), no, n);
  }

  /**
   * O semáforo de quem chega pelo braço (e, sentido) ao nó: { grupo, defas }, ou null sem semáforo. Guardado na saída
   * px (a mesma enquanto o carro se aproxima do nó), para não procurar o braço a cada quadro.
   */
  function semaforoDe(px, no, e, sentido) {
    if (px.sinal !== undefined) return px.sinal;
    const b = no?.semaforos ? no.analise.bracos.find((x) => x.e === e && x.inverte === sentido > 0) : null;
    px.sinal = b ? { grupo: grupoSemaforo(b.theta), defas: defasagemSemaforo(no.n) } : null;
    return px.sinal;
  }

  /** Fase do semáforo (0 verde, 1 amarelo, 2 vermelho) do sinal de semaforoDe; sem semáforo, 0. */
  const faseDoBraco = (sinal, tempo) => (sinal ? faseSemaforo(tempo, sinal.grupo, sinal.defas) : 0);

  /** Segundos desde que o vermelho do sinal começou (o vermelho dura 21 s); sem semáforo, 0. */
  const vermelhoHa = (sinal, tempo) => (sinal ? VERMELHO - restaVermelho(tempo, sinal.grupo, sinal.defas) : 0);

  /**
   * A faixa de destino tem lugar para o carro entrar? Ninguém fazendo a curva para ela agora e ninguém na boca dela
   * (a menos da distância de fila). Paciência: parado há mais de 15 s fora de cruzamento (um laço de vias curtas),
   * entra assim mesmo (a fila segura o passo dentro da curva).
   */
  function entradaLivre(px, car) {
    const f = filas.get(chave(px.ar.e, px.u, px.sentido));
    if (!f) return true;
    const boca = px.s * px.sentido;
    for (const o of f) {
      if (o.c === car) continue;
      if (o.c.curva && o.c.curva.prox.ar.e === px.ar.e && o.c.curva.prox.u === px.u && o.c.curva.prox.sentido === px.sentido) return false;
      if (o.pos - boca < distFila(car, o.c)) return false;
    }
    return true;
  }

  /**
   * Quanto a carroceria rígida sai da curva para dentro no meio (m): a flecha da corda do comprimento do carro no raio
   * da curva (c² / 8R, o raio pelo comprimento da curva e o ângulo virado). Ônibus numa esquina fechada varre a outra faixa.
   */
  const varre = (c, px) => {
    const ang = px.ang ?? 0;
    if (ang < 0.2) return 0;
    return Math.min(3, (c.c * c.c * ang) / (8 * px.L));
  };

  /** Prioridade de quem pede a vez (menor passa antes): a chegada, a principal na frente, a esquerda atrás. */
  const prioridade = (c) => (c.tPedido ?? relogio) + (c.prox?.vir < 0 ? 2 : 0) - (c.prox?.principal ? 3 : 0);

  /**
   * A curva px do carro c (no nó px.n) chega perto da curva de o no mesmo nó, do ponto onde o está em diante? Quem
   * já saiu da curva mas ainda tem a traseira no nó conta pelo último trecho dela.
   */
  function conflita(c, px, o) {
    if (o === c) return false;
    const saindo = o.saindoNo === px.n && !o.curva;
    const naBoca = o.naBoca === px.n && o.reserva !== px.n;
    // da mesma faixa de origem: a fila já os separa
    if (!saindo && o.e === c.e && o.u === c.u && o.sentido === c.sentido) return false;
    const op = saindo ? o.saindo : o.curva ? o.curva.prox : o.reserva === px.n ? o.reservaPx : o.prox;
    if (!op?.poli) return false;
    const i0 = saindo ? N_CURVA - 1 : o.curva ? Math.max(0, Math.floor((o.curva.t - (o.c / 2 + 0.5) / o.curva.L) * N_CURVA)) : 0;
    // quem espera na boca ocupa só o começo da curva dele
    const lim = (c.l + o.l) / 2 + 0.7 + varre(c, px) + (naBoca ? 0 : varre(o, op));
    return distPoligonais(px.poli, 0, op.poli, naBoca ? 0 : Math.min(N_CURVA - 1, i0), lim, naBoca ? 1 : Infinity) < lim;
  }

  /** O carro pode cruzar agora? Ninguém dentro no caminho, ninguém antes dele na fila da vez, ninguém na faixa. */
  function podeReservar(c, px, ped) {
    for (const o of ativos.get(px.n) ?? []) if (conflita(c, px, o)) return false;
    const pc = prioridade(c);
    for (const r of pedidos.get(px.n) ?? []) {
      if (r === c || r.reserva != null || !r.prox || r.prox.n !== px.n) continue;
      // quem espera lugar na saída só segura quem vai para a mesma faixa (a ordem dela); não trava o cruzamento
      const rp = r.prox;
      if (!r.livre && (rp.ar.e !== px.ar.e || rp.u !== px.u || rp.sentido !== px.sentido)) continue;
      const pr = prioridade(r);
      if ((pr < pc || (pr === pc && r.id < c.id)) && conflita(c, px, r)) return false;
    }
    if (ped?.faixaOcupada && (ped.faixaOcupada(px.n, px.ar.e) || ped.faixaOcupada(px.n, c.e))) return false;
    return true;
  }

  function soltarReserva(c) {
    if (c.reserva == null) return;
    const l = ativos.get(c.reserva);
    if (l) {
      const i = l.indexOf(c);
      if (i >= 0) l.splice(i, 1);
    }
    c.reserva = null;
  }

  /** Acelera para vAlvo (aceleração do modelo, frenagem até A_MAX). */
  function acelerar(c, vAlvo, dt) {
    const antes = c.v;
    const acel = c.c > 9 ? 1.2 : c.c > 6 ? 1.6 : 2.4;
    c.v = Math.max(0, c.v + Math.max(-A_MAX * dt, Math.min(acel * dt, vAlvo - c.v)));
    c.freio = c.v < antes - 0.05 * dt || c.v < 0.3;
  }

  /** Velocidade do caminhão no ritmo da viagem: atrasado acelera um pouco, adiantado segura. */
  function vExterno(c, ar) {
    const P = perfilVia(ar.tipo);
    const vVia = (P.velocidade / 3.6) * 0.9;
    const ext = c.externo;
    const atraso = Number.isFinite(ext.alvoD) ? ext.alvoD - distanciaNaRota(c) : 0;
    return Math.max(0.35 * vVia, Math.min(1.2 * vVia, vVia * (1 + atraso / 80)));
  }

  /** Distância do caminhão ao longo da rota (m), na mesma conta de caminhoes.js (comprimentos das arestas do render). */
  function distanciaNaRota(c) {
    const ext = c.externo;
    const pl = ext.plano;
    const k = ext.k;
    const ar = pl.ars[k];
    if (!ar) return 0;
    const dentro = (s, sentido, a) => (sentido > 0 ? s : a.L - s);
    if (c.curva) {
      const d0 = pl.cum[k] + dentro(fimDaFaixa(ar, c.sentido), c.sentido, ar);
      const a2 = pl.ars[k + 1];
      const d1 = a2 ? pl.cum[k + 1] + dentro(inicioDaFaixa(a2, pl.passos[k + 1].sentido), pl.passos[k + 1].sentido, a2) : d0;
      return d0 + (d1 - d0) * c.curva.t;
    }
    return pl.cum[k] + dentro(c.s, c.sentido, ar);
  }

  const pA = { x: 0, z: 0, hx: 1, hz: 0 };

  function andar(vias, dt, tempo, ped) {
    const rede = vias.rede;
    const cam = ctx.camera.position;
    relogio = tempo;
    // a cada ~1 min de quadros, esquece as faixas e os nós que saíram da amostra
    const tudo = ++nQuadros % 600 === 0;
    esvaziar(filas, tudo);
    esvaziar(ativos, tudo);
    esvaziar(pedidos, tudo);
    nEntradas = 0;
    for (const c of carros) {
      c.gap = Infinity;
      c.vL = 0;
      if (c.curva) {
        const ar = rede.arestas.get(c.e);
        const cv = c.curva;
        const px = cv.prox;
        // na curva a carroceria varre por dentro e a corda é menor que o arco: guarda uns metros a mais nas duas filas
        const m = px.vir || px.retorno ? 1 + 0.12 * c.c : 0.5;
        if (ar) entrarNaFila(chave(c.e, c.u, c.sentido), c, fimDaFaixa(ar, c.sentido) * c.sentido + cv.t * cv.L + m);
        entrarNaFila(chave(px.ar.e, px.u, px.sentido), c, px.s * px.sentido - (1 - cv.t) * cv.L - m);
      } else entrarNaFila(chave(c.e, c.u, c.sentido), c, c.s * c.sentido);
      if (c.saindoNo != null) listaDe(ativos, c.saindoNo).push(c);
      // parado depois da retenção sem a vez (via curta): a frente já está no miolo e conta como quem está lá
      c.naBoca = null;
      if (!c.curva && c.reserva == null && c.prox && c.prox.de === rede.arestas.get(c.e)) {
        const resta = (fimDaFaixa(c.prox.de, c.sentido) - c.s) * c.sentido;
        if (resta < PARADA + c.c / 2 - 0.5) {
          c.naBoca = c.prox.n;
          listaDe(ativos, c.naBoca).push(c);
        }
      }
      if (c.reserva != null) listaDe(ativos, c.reserva).push(c);
      else if (c.quer && c.prox) listaDe(pedidos, c.prox.n).push(c);
    }
    // o da frente de cada um, em todas as filas em que ele está: a menor folga manda
    for (const f of filas.values()) {
      f.sort((a, b) => a.pos - b.pos || a.c.id - b.c.id);
      for (let i = 0; i + 1 < f.length; i++) {
        const a = f[i];
        const b = f[i + 1];
        const g = b.pos - a.pos - distFila(a.c, b.c);
        if (g < a.c.gap) {
          a.c.gap = g;
          a.c.vL = b.c.v;
        }
      }
    }
    const sair = new Set();
    for (const c of carros) {
      if (c.curva) andarNaCurva(c, dt);
      else if (!andarNaFaixa(vias, c, dt, tempo, ped)) sair.add(c);
      c.parado = c.v < 0.1 ? c.parado + dt : 0;
      // travado (um laço de vias curtas, o congestionamento da hora do pico): sai da amostra, longe da câmera
      if (c.parado > DESISTE && !c.externo && Math.hypot(c.x - cam.x, c.z - cam.z) > 60) sair.add(c);
    }
    if (sair.size) {
      for (const c of sair) {
        soltarReserva(c);
        if (c.externo) {
          c.externo.chegou = true;
          externos.delete(c.externo.id);
          fins.add(c.externo.id);
        }
      }
      for (let i = carros.length - 1; i >= 0; i--) if (sair.has(carros[i])) carros.splice(i, 1);
    }
  }

  function andarNaCurva(c, dt) {
    const cv = c.curva;
    const px = cv.prox;
    acelerar(c, Math.min(px.vLim, c.vMax, velSegura(c.gap, c.vL)), dt);
    // o passo nunca passa da folga de nenhuma das duas filas
    const passo = Math.min(c.v * dt, Math.max(0, c.gap));
    if (passo < c.v * dt) c.v = dt > 0 ? passo / dt : 0;
    cv.t += passo / cv.L;
    if (cv.t >= 1) {
      c.e = px.ar.e;
      c.u = px.u;
      c.sentido = px.sentido;
      c.s = px.s;
      c.curva = null;
      c.prox = null;
      // a vez no nó fica até a traseira sair dele (parado logo na boca, ainda ocupa o miolo)
      if (c.reserva != null) {
        c.saindo = px;
        c.saindoNo = c.reserva;
        c.reserva = null;
      }
      c.espera = 0;
      if (c.externo) c.externo.k = px.k;
      naFaixa(px.ar, c.u, c.s, c.sentido, pA);
      pose(c, pA);
      return;
    }
    pontoCurva(px.p, cv.t, pA);
    pose(c, pA);
  }

  /** Um passo na faixa. Devolve false se o carro sai (sem saída, fim da rota, aresta que sumiu). */
  function andarNaFaixa(vias, c, dt, tempo, ped) {
    const rede = vias.rede;
    const ar = rede.arestas.get(c.e);
    if (!ar) return false;
    if (c.saindo && (c.s - inicioDaFaixa(ar, c.sentido)) * c.sentido > c.c / 2 + 1) {
      c.saindo = null;
      c.saindoNo = null;
    }
    const fim = fimDaFaixa(ar, c.sentido);
    const resta = (fim - c.s) * c.sentido;
    const n = c.sentido > 0 ? ar.b : ar.a;
    const no = rede.nos.get(n);
    let vAlvo = c.externo ? vExterno(c, ar) : c.vMax;
    vAlvo = Math.min(vAlvo, velSegura(c.gap, c.vL));
    // perto do fim escolhe a saída (de novo, se a rede mudou embaixo dela)
    if (c.prox && (rede.arestas.get(c.prox.ar.e) !== c.prox.ar || c.prox.de !== ar || rede.nos.get(c.prox.n) !== c.prox.no)) {
      c.prox = null;
      soltarReserva(c);
    }
    if (resta < OLHAR && c.prox == null) c.prox = proxima(vias, c, ar) ?? false;
    const px = c.prox || null;
    const parar = PARADA + c.c / 2;
    let pode = !!px;
    c.quer = false;
    if (px) {
      // chega à boca na velocidade da curva
      vAlvo = Math.min(vAlvo, Math.sqrt(px.vLim * px.vLim + 2 * A_PLANO * Math.max(0, resta)));
      if (resta < OLHAR) {
        const livre = entradaLivre(px, c) || (c.espera > 15 && no?.tipo !== 'cruzamento');
        const naFaixaGente = ped?.faixaOcupada?.(n, c.e) ?? false;
        // a vez no nó: cruzamento e curva de duas vias (o ônibus varre a outra faixa na esquina fechada)
        const cruz = (no?.tipo === 'cruzamento' || no?.tipo === 'curva') && !px.retorno;
        if (cruz) {
          const sinal = semaforoDe(px, no, c.e, c.sentido);
          const fase = faseDoBraco(sinal, tempo);
          const verde = fase === 0;
          // no amarelo, quem já espera na retenção para converter (o bolsão) ainda sai, se o miolo estiver livre
          const naRetencao = resta < parar + 1 && c.v < 0.5;
          // o bolsão: no amarelo, quem já espera na retenção ainda sai; quem vira à esquerda (e esperou o fluxo
          // contrário passar) também nos primeiros segundos do vermelho, se o miolo estiver livre
          const limpeza = fase === 1 || (fase === 2 && px.vir < 0 && vermelhoHa(sinal, tempo) < LIMPEZA);
          const podePedir = verde || (limpeza && naRetencao && c.espera > 3);
          // a principal (sem semáforo): a via mais rápida do nó, se houver uma mais lenta
          if (px.principal === undefined) {
            const vs = no.analise.bracos.map((b) => b.P.velocidade);
            const minha = perfilVia(ar.tipo).velocidade;
            px.principal = !no.semaforos && minha >= Math.max(...vs) && Math.min(...vs) < minha;
          }
          if (c.reserva != null && (!podePedir || !livre || naFaixaGente) && resta - parar > (c.v * c.v) / (2 * A_MAX) + 0.5) soltarReserva(c);
          if (c.reserva == null) {
            const decide = resta - parar <= (c.v * c.v) / (2 * A_PLANO) + 4 || resta < parar + 1;
            if (podePedir && decide) {
              // a ordem é a da chegada à retenção (quem vem andando conta quando chega, não quando pede); o pedido
              // fica de pé no verde, mesmo com a saída cheia por um instante
              c.tPedido ??= tempo + Math.max(0, resta - parar) / Math.max(1, c.v);
              c.quer = true;
              c.livre = livre && !naFaixaGente;
              if (livre && !naFaixaGente && podeReservar(c, px, ped)) {
                c.reserva = n;
                c.reservaPx = px;
                listaDe(ativos, n).push(c);
                c.tPedido = null;
                c.quer = false;
              }
            } else if (!podePedir) c.tPedido = null;
          }
          pode = c.reserva != null;
        } else {
          pode = livre && !naFaixaGente;
        }
        if (!pode) {
          // espera a vez na retenção ou, se já passou dela, na boca
          const g = resta >= parar - 0.5 ? resta - parar : resta - 0.3;
          vAlvo = Math.min(vAlvo, velSegura(Math.max(0, g)));
        }
      }
    }
    acelerar(c, vAlvo, dt);
    let passo = Math.min(c.v * dt, Math.max(0, c.gap));
    // sem a vez, a boca é uma parede
    if (px && !pode) passo = Math.min(passo, Math.max(0, resta - 0.05));
    if (passo < c.v * dt) c.v = dt > 0 ? passo / dt : 0;
    c.espera = c.v < 0.3 ? c.espera + dt : 0;
    c.s += passo * c.sentido;
    if ((fim - c.s) * c.sentido <= 1e-6) {
      if (!px) return false; // sem saída, fim da rota do caminhão ou a rodovia que sai do mapa
      if (pode) {
        c.s = fim;
        c.curva = { t: 0, L: px.L, prox: px };
        c.prox = null;
        pontoCurva(px.p, 0, pA);
        pose(c, pA);
        return true;
      }
      c.s = fim;
    }
    naFaixa(ar, c.u, c.s, c.sentido, pA);
    pose(c, pA);
    return true;
  }

  // ---------------------------------------------------------------------------------------------- caminhões

  /**
   * Põe (ou atualiza) o caminhão de uma entrega na rua. plano: { passos: [{ e, sentido }], ars, cum } (caminhoes.js);
   * alvoD: onde a viagem da simulação está agora (m ao longo da rota); modelo: { c, l }. Só entra numa faixa (fora
   * das curvas dos nós), dentro do raio da amostra, e tira da frente os carros comuns. Devolve o carro ou null.
   */
  function seguir(id, plano, alvoD, modelo) {
    const ja = externos.get(id);
    if (ja) {
      ja.externo.alvoD = alvoD;
      ja.externo.visto = relogio;
      return ja;
    }
    const vias = ctx.dominio('vias');
    if (!vias?.rede || !plano?.passos?.length) return null;
    // a aresta e a posição do alvo, numa faixa
    let k = 0;
    while (k + 1 < plano.passos.length && plano.cum[k + 1] <= alvoD) k++;
    const passo = plano.passos[k];
    const ar = vias.rede.arestas.get(passo.e);
    if (!ar || ar !== plano.ars[k]) return null;
    const d = alvoD - plano.cum[k];
    const s = passo.sentido > 0 ? d : ar.L - d;
    const ini = inicioDaFaixa(ar, passo.sentido);
    const fimF = fimDaFaixa(ar, passo.sentido);
    if ((s - ini) * passo.sentido < 1 || (fimF - s) * passo.sentido < 8) return null;
    estacao(ar.p, ar.tab, s, est);
    if (Math.hypot(est.x - alvo.x, est.z - alvo.z) > perfil().raio) return null;
    const fx = faixasOrdenadas(ar.tipo, ar.mao, passo.sentido);
    if (!fx.length) return null;
    const f = fx[fx.length - 1];
    // os comuns na frente saem da amostra; outro caminhão ali, espera
    const fl = filas.get(chave(ar.e, f.u, passo.sentido)) ?? [];
    const pos = s * passo.sentido;
    const tirar = [];
    for (const o of fl) {
      if (Math.abs(o.pos - pos) >= (modelo.c + o.c.c) / 2 + FOLGA_FILA + 4) continue;
      if (o.c.externo) return null;
      tirar.push(o.c);
    }
    for (const o of tirar) {
      soltarReserva(o);
      const i = carros.indexOf(o);
      if (i >= 0) carros.splice(i, 1);
    }
    const car = novoCarro(ar, f, s, 5, { c: modelo.c, l: modelo.l, vMax: (perfilVia(ar.tipo).velocidade / 3.6) * 0.9, externo: { id, plano, k, alvoD, visto: relogio, chegou: false } });
    // a cota já no primeiro quadro (caminhoes.js desenha antes de o tráfego andar de novo)
    car.y = cotaDe(car, ar, ctx.sim.espelho.terreno);
    carros.push(car);
    externos.set(id, car);
    return car;
  }

  /** Tira o caminhão da entrega da rua. */
  function soltarExterno(id) {
    const c = externos.get(id);
    if (!c) return;
    externos.delete(id);
    soltarReserva(c);
    const i = carros.indexOf(c);
    if (i >= 0) carros.splice(i, 1);
  }

  /**
   * A faixa de pedestres do braço e no nó n tem carro passando ou por passar? Quem tem a vez no nó saindo ou entrando
   * por ela, quem já passou da retenção, quem acabou de sair do nó por ela e, sem semáforo, quem chega andando.
   */
  function cruzandoFaixa(n, e, semSinal = false) {
    for (const c of ativos.get(n) ?? []) {
      if (c.saindoNo === n && !c.curva) {
        if (c.e === e) return true;
        continue;
      }
      const px = c.curva ? c.curva.prox : c.reservaPx;
      if (px && (px.ar.e === e || c.e === e)) return true;
    }
    const ar = ctx.dominio('vias')?.rede?.arestas.get(e);
    if (!ar) return false;
    for (const c of carros) {
      if (c.curva || c.e !== e) continue;
      if ((c.sentido > 0 ? ar.b : ar.a) === n) {
        const resta = (fimDaFaixa(ar, c.sentido) - c.s) * c.sentido;
        if (resta < PARADA + c.c / 2 - 0.5) return true;
        if (semSinal && resta < 30 && c.v > 1.5) return true;
      } else if ((c.s - inicioDaFaixa(ar, c.sentido)) * c.sentido < 5.3 + c.c / 2) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------------------------- desenho

  const vaga = { arr: null, o: 0 };

  /** Cota da roda: a superfície da faixa (com o abaulamento) ou, no miolo do nó, a do polígono da pista. */
  function cotaDe(c, ar, T) {
    const dy = c.curva || !ar ? ALTURA.pista + 0.03 : alturaNaSecao(perfilVia(ar.tipo), c.u);
    return ar?.ponte && !c.curva ? ar.cotas[0] + ((ar.cotas[1] - ar.cotas[0]) * c.s) / ar.L + dy - ALTURA.pista : (T ? alturaEm(T, c.x, c.z) : 0) + dy;
  }

  function desenhar(vias, esp, noite) {
    const P = perfil();
    const cp = ctx.camera.position;
    const cont = malhas.map(() => 0);
    const T = esp.terreno;
    const idxMalha = (mi, lod) => mi * 2 + lod;
    // a vaga da instância na malha do modelo e LOD, com a cor e as luzes; null se a malha está cheia
    const por = (mi, lod, cor, luz) => {
      const k = idxMalha(mi, lod);
      const M = malhas[k];
      const j = cont[k];
      if (j >= M.cap) return null;
      cont[k]++;
      M.cor.array[4 * j] = cor[0];
      M.cor.array[4 * j + 1] = cor[1];
      M.cor.array[4 * j + 2] = cor[2];
      M.cor.array[4 * j + 3] = luz;
      vaga.arr = M.mesh.instanceMatrix.array;
      vaga.o = j * 16;
      return vaga;
    };
    const farol = noite > 0.25 ? 1 : 0;
    const lod0 = P.lod0 * P.lod0;
    for (const c of carros) {
      c.y = cotaDe(c, vias.rede.arestas.get(c.e), T);
      if (c.externo) continue; // caminhoes.js desenha
      const d2 = (c.x - cp.x) ** 2 + (c.y - cp.y) ** 2 + (c.z - cp.z) ** 2;
      const v = por(c.mi, d2 < lod0 ? 0 : 1, c.cor, farol | (c.freio ? 2 : 0));
      if (v) matrizGiroY(v.arr, v.o, c.x, c.y, c.z, c.hx, c.hz);
    }
    let parados = 0;
    if (P.estacionados > 0) {
      for (const st of vias.setoresPerto(P.parados)) {
        for (const [mi, l] of st.estacionados ?? []) {
          for (let k = 0; k < l.n && parados < P.estacionados; k++) {
            const o = k * 16;
            const dx = l.mat[o + 12] - cp.x;
            const dy = l.mat[o + 13] - cp.y;
            const dz = l.mat[o + 14] - cp.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > P.parados) continue;
            const cor = CORES[l.bytes[4 * k]] ?? CORES[0];
            const v = por(mi, d < P.lod0 ? 0 : 1, cor, 0);
            if (v) v.arr.set(l.mat.subarray(o, o + 16), v.o);
            parados++;
          }
        }
      }
    }
    malhas.forEach((M, k) => {
      const n = cont[k];
      M.mesh.count = n;
      M.mesh.visible = n > 0;
      if (!n) return;
      const im = M.mesh.instanceMatrix;
      im.clearUpdateRanges();
      im.addUpdateRange(0, n * 16);
      im.needsUpdate = true;
      M.cor.clearUpdateRanges();
      M.cor.addUpdateRange(0, n * 4);
      M.cor.needsUpdate = true;
    });
    ctx.stats.instancias.carros = carros.length - externos.size + parados;
    return parados;
  }

  /** Povoa até o alvo de carros (o nascimento recusa lugar ocupado). */
  function encher(alvoN, tentativas, longeCam = 0) {
    for (let k = 0; k < tentativas && carros.length - externos.size < alvoN; k++) {
      const car = nascer(longeCam);
      if (car) {
        carros.push(car);
        entrarNaFila(chave(car.e, car.u, car.sentido), car, car.s * car.sentido);
      } else seq++;
    }
  }

  /**
   * A amostra em volta do alvo: nascem carros até o alvo (a soma dos pesos até o teto), longe da câmera (fora do LOD0),
   * e saem os que ficaram longe do alvo e, se passou do alvo, os que estão fora do LOD0; o caminhão que ficou longe
   * volta para caminhoes.js. Com o teto abaixo dos carros esperados, quem está fora do miolo sai aos poucos (mais
   * depressa perto da borda, sempre fora do LOD0) e a vaga volta a nascer perto: a rua da câmera fica com a densidade
   * do fluxo e a borda, rala.
   */
  function manter(P, dt = 0) {
    const alvoN = Math.min(P.carros, Math.round(somaPeso));
    encher(alvoN, 4, P.lod0);
    let sobra = carros.length - externos.size - (alvoN + 4);
    const rarear = dt > 0 && somaPeso > P.carros;
    const cam = ctx.camera.position;
    const lod0 = P.lod0 * P.lod0;
    for (let i = carros.length - 1; i >= 0; i--) {
      const car = carros[i];
      const d2 = (car.x - alvo.x) ** 2 + (car.z - alvo.z) ** 2;
      const longe = d2 > (P.raio + 80) ** 2;
      if (car.externo) {
        // longe, ou sem notícia da entrega há 90 s (a viagem acabou): sai
        if (longe || relogio - car.externo.visto > 90) soltarExterno(car.externo.id);
        continue;
      }
      const fora = (car.x - cam.x) ** 2 + (car.z - cam.z) ** 2 > lod0;
      let sai = longe || (sobra > 0 && fora);
      if (!sai && rarear && fora && !car.curva) {
        const g = pesoDistancia(Math.sqrt(d2), P.raio);
        sai = g < 1 && hashF(car.id, nQuadros + 7919) < (dt * (1 - g)) / 20;
      }
      if (sai) {
        if (!longe) sobra--;
        soltarReserva(car);
        carros.splice(i, 1);
      }
    }
  }

  let tAnt = null;
  let parados = 0;
  const dom = {
    nome: 'trafego',
    aplicar(d) {
      if (d.celulas?.length || d.tudo?.celulas || d.realocado?.includes('celulas')) zonasSujas = true;
    },
    quadro(tMs, c) {
      const vias = c.dominio('vias');
      if (!vias?.rede) return;
      if (perfilMontado !== c.perfil.id) {
        perfilMontado = c.perfil.id;
        montarMalhas();
        carros.length = 0;
        externos.clear();
      }
      const esp = c.sim.espelho;
      const P = perfil();
      const hora = c.horaDoCeu();
      const dia = c.sol?.dia ?? 1;
      const noite = Math.min(1, Math.max(0, 1 - dia * 1.4));
      U.gCarroNoite.value = noite;
      // o relógio da rua (o mesmo dos semáforos) anda com o jogo; parado na pausa, a não ser que a cena peça
      const t = esp.tempo;
      const anda = animar ?? (t?.velocidade ?? 1) > 0;
      const dt = tAnt === null ? 0 : (Math.min(100, tMs - tAnt) / 1000) * (anda ? Math.max(1, t?.mult ?? 1) : 0);
      tAnt = tMs;
      c.relogioRua = (c.relogioRua ?? 0) + dt;
      if (zonasSujas && tMs - (dom._tZonas ?? -1e9) > 5000) {
        zonas = contarZonas(esp);
        zonasSujas = false;
        dom._tZonas = tMs;
      }
      c.cameraApi?.alvo?.(alvo);
      if (versaoRede !== vias.rede.versao || !alvoCand || alvo.distanceTo(alvoCand) > 60 || tMs - tCand > 2000) {
        escolherCandidatos(vias, hora, esp);
        versaoRede = vias.rede.versao;
        tCand = tMs;
      }
      manter(P, dt);
      if (dt > 0) andar(vias, dt, c.relogioRua, c.dominio('pedestres'));
      parados = desenhar(vias, esp, noite);
    },
    /** Cenas: força o tráfego a andar (true), parar (false) ou seguir o jogo (null); e povoa de uma vez. */
    animar(b) {
      animar = b;
    },
    povoar(ctxQ = ctx) {
      const vias = ctxQ.dominio('vias');
      if (!vias?.rede) return 0;
      ctxQ.cameraApi?.alvo?.(alvo);
      if (zonasSujas) {
        zonas = contarZonas(ctxQ.sim.espelho);
        zonasSujas = false;
      }
      escolherCandidatos(vias, ctxQ.horaDoCeu(), ctxQ.sim.espelho);
      versaoRede = vias.rede.versao;
      const alvoN = Math.min(perfil().carros, Math.round(somaPeso));
      encher(alvoN, alvoN * 4);
      return carros.length;
    },
    /** Cenas: adianta o tráfego e a gente `seg` segundos sem desenhar (as filas se formam antes da primeira imagem). */
    avancar(seg, ctxQ = ctx) {
      const vias = ctxQ.dominio('vias');
      if (!vias?.rede) return;
      for (let t = 0; t < seg; t += 0.1) {
        ctxQ.relogioRua = (ctxQ.relogioRua ?? 0) + 0.1;
        manter(perfil(), 0.1);
        andar(vias, 0.1, ctxQ.relogioRua, ctxQ.dominio('pedestres'));
        ctxQ.dominio('pedestres')?.avancarUm?.(0.1, ctxQ);
      }
    },
    seguir,
    soltarExterno,
    /** O caminhão da entrega id na rua (ou null): posição, direção, cota, freio, a aresta e se está numa curva. */
    externo(id) {
      return externos.get(id) ?? null;
    },
    /** O caminhão da entrega id chegou ao fim da rota aqui? */
    chegou: (id) => fins.has(id),
    /** A entrega saiu do espelho: esquece a chegada. */
    esquecer(id) {
      fins.delete(id);
    },
    cruzandoFaixa,
    /** Depuração (testes): os carros como estão. */
    _carros: () => carros,
    medidas() {
      let tris = 0;
      for (const M of malhas) tris += M.mesh.count * M.tris;
      return { andando: carros.length - externos.size, caminhoes: externos.size, parados, tris, alvo: Math.round(somaPeso), fluxo: !!ctx.sim?.espelho?.fluxos?.ida };
    },
    /** Cópia do estado dos carros andando (testes e cenas): aresta, faixa, sentido, s, modelo, velocidade e curva. */
    amostra() {
      return carros.map((c) => ({
        id: c.id, e: c.e, u: c.u, sentido: c.sentido, s: c.s, mi: c.mi, c: c.c, l: c.l, v: c.v, curva: !!c.curva, retorno: !!c.curva?.prox?.retorno,
        no: c.curva?.prox?.n ?? null, de: c.curva ? c.e : null, para: c.curva?.prox?.ar.e ?? null, x: c.x, z: c.z, hx: c.hx, hz: c.hz,
        externo: c.externo?.id ?? null, k: c.externo?.k ?? null,
      }));
    },
    descartar() {
      for (const M of malhas) {
        cena.remove(M.mesh);
        M.mesh.geometry.dispose();
        M.mesh.dispose();
      }
      material.dispose();
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('trafego', criarTrafego);
}
