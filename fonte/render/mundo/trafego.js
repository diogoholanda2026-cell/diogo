// Carros (desenho do render 8, D37): no M1a, sem o trânsito agregado (S1c), uma amostra pela heurística: a
// densidade de cada aresta sai do tipo de via, da hora do céu (picos de manhã e no fim da tarde, madrugada vazia) e
// das zonas das células vizinhas (comércio e escritório puxam mais, indústria traz caminhões). Os carros andam nas
// faixas pela curva da aresta, com o sentido da mão, guardam distância do da frente, param no vermelho dos
// semáforos (o mesmo ciclo dos focos, props.js) e atravessam o cruzamento por uma curva até a faixa da próxima aresta.
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

/** Onde o carro para no vermelho: a frente a 0,5 m antes da retenção (m da boca; a retenção do shader vai de 6,4 a 6,8). */
export const PARADA = 7.3;
/** Folga entre o para-choque de um e o do outro na fila (m). */
export const FOLGA_FILA = 2;

/** Distância mínima entre os centros de dois carros na mesma faixa (m): meio comprimento de cada um e a folga. */
export const distanciaNaFila = (miTras, miFrente) => (MODELOS[miTras].c + MODELOS[miFrente].c) / 2 + FOLGA_FILA;

/** Fase do semáforo (0 verde, 1 amarelo, 2 vermelho) do grupo g: a mesma conta do shader (via.glsl.js, objFase). */
export function faseSemaforo(tempo, g, defas) {
  const t = (((tempo + defas * 0.16) % 40) + 40) % 40;
  const m = g < 0.5 ? t : (t + 20) % 40;
  return m < 16 ? 0 : m < 19 ? 1 : 2;
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
  let candidatos = [];
  let somaPeso = 0;
  let alvoCand = null;
  let tCand = -1e9;
  let zonas = null;
  let zonasSujas = true;
  let versaoRede = -1;
  let seq = 1;
  let animar = null; // cenas podem forçar (true) ou parar (false); null: anda com o jogo
  const alvo = new THREE.Vector3();
  const est = { x: 0, z: 0, tx: 1, tz: 0, t: 0 };

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

  /** Arestas perto do alvo da câmera, com o peso (carros esperados) de cada uma. */
  function escolherCandidatos(vias, hora) {
    const R = perfil().raio;
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
      const w = (densidade(ar.tipo, hora, zonas?.get(ar.e), ar.L) * faixas.length * L) / 100;
      candidatos.push({ ar, faixas, w, ind: (zonas?.get(ar.e)?.ind ?? 0) / Math.max(1, L / 8) });
      somaPeso += w;
    }
    alvoCand = alvo.clone();
  }

  /** Posição na faixa: ponto, direção de viagem. */
  function naFaixa(ar, u, s, sentido, out) {
    estacao(ar.p, ar.tab, s, est);
    out.x = est.x - est.tz * u;
    out.z = est.z + est.tx * u;
    out.hx = est.tx * sentido;
    out.hz = est.tz * sentido;
    return out;
  }

  function nascer(h) {
    if (!candidatos.length || somaPeso <= 0) return null;
    let a = hashF(seq, 1) * somaPeso;
    let c = candidatos[candidatos.length - 1];
    for (const q of candidatos) {
      a -= q.w;
      if (a < 0) {
        c = q;
        break;
      }
    }
    const f = c.faixas[Math.floor(hashF(seq, 2) * c.faixas.length) % c.faixas.length];
    const ar = c.ar;
    const s = ar.cIni + 2 + hashF(seq, 3) * Math.max(1, ar.L - ar.cIni - ar.cFim - 4);
    // não nasce em cima de outro (nem de um ônibus de 12 m)
    if (carros.some((o) => o.e === ar.e && o.u === f.u && Math.abs(o.s - s) < 15)) return null;
    const id = seq++;
    const P = perfilVia(ar.tipo);
    const mi = modeloDe(P.id, hashF(id, 4), c.ind);
    const vMax = (P.velocidade / 3.6) * (0.72 + 0.25 * hashF(id, 5));
    const cor = CORES[porPeso(FROTA_CORES.map(([, w], k) => [k, w]), hashF(id, 6))];
    return { id, e: ar.e, u: f.u, sentido: f.sentido, s, v: vMax * 0.8, vMax, mi, cor, curva: null, freio: false, x: 0, y: 0, z: 0, hx: 1, hz: 0, idade: h };
  }

  /** Próxima aresta na ponta: um braço do nó que aceite a direção de saída (sem voltar pela mesma). */
  function proxima(vias, car, ar) {
    const n = car.sentido > 0 ? ar.b : ar.a;
    const no = vias.rede.nos.get(n);
    if (!no) return null;
    const saidas = [];
    for (const b of no.analise.bracos) {
      if (b.e === car.e && (b.inverte === car.sentido > 0)) continue;
      const a2 = vias.rede.arestas.get(b.e);
      if (!a2) continue;
      const sentido = b.inverte ? -1 : 1;
      const fx = faixasDeTransito(a2.tipo, a2.mao).filter((f) => f.sentido === sentido);
      if (!fx.length) continue;
      const P2 = perfilVia(a2.tipo);
      saidas.push({ a2, sentido, fx, w: (BASE_TIPO[P2.id] ?? 0.3) + 0.2 });
    }
    if (!saidas.length) {
      // sem saída: faz o retorno na ponta, para a faixa do outro sentido da mesma via; a rodovia que acaba na ponta
      // sai do mapa (o carro some)
      if (no.tipo !== 'ponta' || perfilVia(ar.tipo).id === 'rodovia') return null;
      const volta = -car.sentido;
      const fx = faixasDeTransito(ar.tipo, ar.mao).filter((f) => f.sentido === volta);
      if (!fx.length) return null;
      const f = fx.reduce((m, x) => (Math.abs(x.u - car.u) < Math.abs(m.u - car.u) ? x : m), fx[0]);
      return { ar, sentido: volta, u: f.u, s: volta > 0 ? ar.cIni : ar.L - ar.cFim, no, n, retorno: true };
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
    // a faixa mais perto da que o carro está (pela ordem das faixas)
    const f = esc.fx[Math.floor(hashF(car.id, car.idade + 3) * esc.fx.length) % esc.fx.length];
    return { ar: esc.a2, sentido: esc.sentido, u: f.u, s: esc.sentido > 0 ? esc.a2.cIni : esc.a2.L - esc.a2.cFim, no, n };
  }

  /** Luz do semáforo para quem chega pelo braço (e, sentido) no nó: true se pode entrar. */
  function podeEntrar(no, e, sentido, tempo) {
    if (!no?.semaforos) return true;
    const b = no.analise.bracos.find((x) => x.e === e && x.inverte === sentido > 0);
    if (!b) return true;
    return faseSemaforo(tempo, grupoSemaforo(b.theta), defasagemSemaforo(no.n)) === 0;
  }

  /**
   * A faixa de destino tem lugar para o carro entrar? Ninguém na boca dela (a menos da distância de fila) e ninguém
   * fazendo a curva para ela agora. Sem isso, dois carros saem do cruzamento um dentro do outro.
   */
  function entradaLivre(px, car) {
    // paciência: parado há mais de 10 s na boca (um laço de vias curtas travado), entra assim mesmo
    if (car.espera > 10) return true;
    for (const o of carros) {
      if (o === car) continue;
      const alvo = o.curva ? o.curva.prox : o;
      const e = o.curva ? alvo.ar.e : o.e;
      if (e !== px.ar.e || alvo.u !== px.u || alvo.sentido !== px.sentido) continue;
      if (o.curva) return false;
      if ((o.s - px.s) * px.sentido < distanciaNaFila(car.mi, o.mi)) return false;
    }
    return true;
  }

  const pA = { x: 0, z: 0, hx: 1, hz: 0 };
  const pB = { x: 0, z: 0, hx: 1, hz: 0 };

  function andar(vias, dt, tempo) {
    // fila por faixa: o carro da frente limita a velocidade. Quem está na curva já entra na fila da faixa de destino,
    // atrás da boca pelo que falta da curva: dois carros que convergem para a mesma faixa não saem um dentro do outro
    const filas = new Map();
    for (const c of carros) {
      c.lider = null;
      const px = c.curva?.prox;
      const k = px ? `${px.ar.e}:${px.u}:${px.sentido}` : `${c.e}:${c.u}:${c.sentido}`;
      c.naFila = px ? px.s * px.sentido - (1 - c.curva.t) * c.curva.L : c.s * c.sentido;
      if (!filas.has(k)) filas.set(k, []);
      filas.get(k).push(c);
    }
    for (const fila of filas.values()) {
      fila.sort((a, b) => a.naFila - b.naFila || !!b.curva - !!a.curva);
      for (let i = 0; i < fila.length; i++) fila[i].lider = fila[i + 1] ?? null;
    }
    for (let i = carros.length - 1; i >= 0; i--) {
      const c = carros[i];
      const ar = vias.rede.arestas.get(c.e);
      if (!ar) {
        carros.splice(i, 1);
        continue;
      }
      if (c.curva) {
        const cv = c.curva;
        // na curva o da frente também segura: o passo não passa da distância de fila
        const folga = c.lider ? c.lider.naFila - c.naFila - distanciaNaFila(c.mi, c.lider.mi) : Infinity;
        const passo = Math.min(c.v * dt, Math.max(0, folga));
        cv.t += passo / Math.max(1, cv.L);
        c.v = passo < c.v * dt ? passo / dt : Math.min(c.vMax * 0.6, c.v + 2 * dt);
        if (cv.t >= 1) {
          c.e = cv.prox.ar.e;
          c.u = cv.prox.u;
          c.sentido = cv.prox.sentido;
          c.s = cv.prox.s;
          c.curva = null;
        } else {
          const t = cv.t;
          const u = 1 - t;
          const a = u * u * u;
          const b = 3 * u * u * t;
          const d = 3 * u * t * t;
          const e = t * t * t;
          c.x = a * cv.p[0] + b * cv.p[2] + d * cv.p[4] + e * cv.p[6];
          c.z = a * cv.p[1] + b * cv.p[3] + d * cv.p[5] + e * cv.p[7];
          const dx = 3 * u * u * (cv.p[2] - cv.p[0]) + 6 * u * t * (cv.p[4] - cv.p[2]) + 3 * t * t * (cv.p[6] - cv.p[4]);
          const dz = 3 * u * u * (cv.p[3] - cv.p[1]) + 6 * u * t * (cv.p[5] - cv.p[3]) + 3 * t * t * (cv.p[7] - cv.p[5]);
          const l = Math.hypot(dx, dz) || 1;
          c.hx = dx / l;
          c.hz = dz / l;
          continue;
        }
      }
      const arA = vias.rede.arestas.get(c.e);
      const fim = c.sentido > 0 ? arA.L - arA.cFim : arA.cIni;
      const resta = (fim - c.s) * c.sentido;
      const n = c.sentido > 0 ? arA.b : arA.a;
      const no = vias.rede.nos.get(n);
      let vAlvo = c.vMax;
      // o da frente: para-choque a para-choque (um ônibus de 12 m pede mais fila que um hatch)
      if (c.lider) {
        const gap = c.lider.naFila - c.naFila - distanciaNaFila(c.mi, c.lider.mi);
        vAlvo = Math.min(vAlvo, Math.max(0, gap * 0.9));
      }
      // semáforo: a frente para antes da retenção; quem já passou da linha no amarelo segue
      const parar = PARADA + MODELOS[c.mi].c / 2;
      if (resta < 40 && resta > parar - 1 && !podeEntrar(no, c.e, c.sentido, tempo)) vAlvo = Math.min(vAlvo, Math.max(0, (resta - parar) * 0.7));
      // curva fechada, cruzamento ou retorno na ponta: reduz
      if (resta < 18 && no?.tipo === 'cruzamento') vAlvo = Math.min(vAlvo, 7);
      if (resta < 25 && c.prox?.retorno) vAlvo = Math.min(vAlvo, 5);
      // perto do fim já escolhe a saída e espera a vez: a faixa de destino precisa ter lugar
      if (resta < 30) {
        if (c.prox && vias.rede.arestas.get(c.prox.ar.e) !== c.prox.ar) c.prox = null;
        c.prox ??= proxima(vias, c, arA) ?? false;
        if (c.prox && !entradaLivre(c.prox, c)) {
          vAlvo = Math.min(vAlvo, Math.max(0, (resta - 1) * 0.7));
          if (c.v < 0.3) c.espera = (c.espera ?? 0) + dt;
        }
      }
      const antes = c.v;
      c.v += Math.max(-6 * dt, Math.min(2.2 * dt, vAlvo - c.v));
      c.freio = c.v < antes - 0.05 * dt || c.v < 0.3;
      c.s += c.v * dt * c.sentido;
      if ((fim - c.s) * c.sentido <= 0) {
        const px = c.prox === undefined || c.prox === null ? proxima(vias, c, arA) : c.prox;
        if (!px) {
          carros.splice(i, 1);
          continue;
        }
        // a faixa de destino fechou (outro carro entrou na curva): segura na boca, se ainda dá para parar sem
        // empilhar quem vem atrás (no cruzamento todos chegam a 7 m/s ou menos)
        if (c.v <= (no?.tipo === 'cruzamento' ? 7.5 : 3) && !entradaLivre(px, c)) {
          c.espera = (c.espera ?? 0) + dt;
          c.s = fim - 0.05 * c.sentido;
          c.v = 0;
          c.freio = true;
          c.prox = px;
          naFaixa(arA, c.u, c.s, c.sentido, pA);
          Object.assign(c, { x: pA.x, z: pA.z, hx: pA.hx, hz: pA.hz });
          continue;
        }
        c.prox = null;
        c.espera = 0;
        naFaixa(arA, c.u, fim, c.sentido, pA);
        naFaixa(px.ar, px.u, px.s, px.sentido, pB);
        const L = Math.hypot(pB.x - pA.x, pB.z - pA.z);
        // o retorno avança pelo miolo redondo da ponta antes de voltar (o controle à frente dos dois pontos)
        const h = px.retorno ? Math.max(3, L * 0.9) : L * 0.42;
        const p = [pA.x, pA.z, pA.x + pA.hx * h, pA.z + pA.hz * h, pB.x - pB.hx * h, pB.z - pB.hz * h, pB.x, pB.z];
        // comprimento da cúbica: a média da corda e do polígono de controle (o retorno anda mais que a corda)
        const rede = Math.hypot(p[2] - p[0], p[3] - p[1]) + Math.hypot(p[4] - p[2], p[5] - p[3]) + Math.hypot(p[6] - p[4], p[7] - p[5]);
        c.curva = { t: 0, L: Math.max(1, (L + rede) / 2), prox: px, p };
        c.x = pA.x;
        c.z = pA.z;
        continue;
      }
      naFaixa(arA, c.u, c.s, c.sentido, pA);
      c.x = pA.x;
      c.z = pA.z;
      c.hx = pA.hx;
      c.hz = pA.hz;
    }
  }

  // ---------------------------------------------------------------------------------------------- desenho

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const esc = new THREE.Vector3(1, 1, 1);

  function desenhar(vias, esp, noite) {
    const P = perfil();
    const cp = ctx.camera.position;
    const cont = malhas.map(() => 0);
    const T = esp.terreno;
    const idxMalha = (mi, lod) => mi * 2 + lod;
    const por = (mi, lod, mat, cor, luz) => {
      const k = idxMalha(mi, lod);
      const M = malhas[k];
      const j = cont[k];
      if (j >= M.cap) return;
      cont[k]++;
      M.mesh.instanceMatrix.array.set(mat, j * 16);
      M.cor.array[4 * j] = cor[0];
      M.cor.array[4 * j + 1] = cor[1];
      M.cor.array[4 * j + 2] = cor[2];
      M.cor.array[4 * j + 3] = luz;
    };
    const farol = noite > 0.25 ? 1 : 0;
    for (const c of carros) {
      const ar = vias.rede.arestas.get(c.e);
      // a roda na superfície da faixa (com o abaulamento); no miolo do cruzamento, a cota do polígono da pista
      const dy = c.curva || !ar ? ALTURA.pista + 0.03 : alturaNaSecao(perfilVia(ar.tipo), c.u);
      c.y = ar?.ponte && !c.curva ? ar.cotas[0] + ((ar.cotas[1] - ar.cotas[0]) * c.s) / ar.L + dy - ALTURA.pista : (T ? alturaEm(T, c.x, c.z) : 0) + dy;
      pos.set(c.x, c.y, c.z);
      q.setFromAxisAngle(eixoY, Math.atan2(c.hx, c.hz));
      m4.compose(pos, q, esc);
      const d = Math.hypot(c.x - cp.x, c.y - cp.y, c.z - cp.z);
      por(c.mi, d < P.lod0 ? 0 : 1, m4.elements, c.cor, farol | (c.freio ? 2 : 0));
    }
    let parados = 0;
    if (P.estacionados > 0) {
      for (const st of vias.setoresPerto(P.parados)) {
        for (const [mi, l] of st.estacionados ?? []) {
          for (let k = 0; k < l.n && parados < P.estacionados; k++) {
            const o = k * 16;
            const d = Math.hypot(l.mat[o + 12] - cp.x, l.mat[o + 13] - cp.y, l.mat[o + 14] - cp.z);
            if (d > P.parados) continue;
            const cor = CORES[l.bytes[4 * k]] ?? CORES[0];
            por(mi, d < P.lod0 ? 0 : 1, l.mat.subarray(o, o + 16), cor, 0);
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
    ctx.stats.instancias.carros = carros.length + parados;
    return parados;
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
        escolherCandidatos(vias, hora);
        versaoRede = vias.rede.versao;
        tCand = tMs;
      }
      // população: a soma dos pesos até o teto
      const alvoN = Math.min(P.carros, Math.round(somaPeso));
      for (let k = 0; k < 4 && carros.length < alvoN; k++) {
        const car = nascer(tMs);
        if (car) {
          const ar = vias.rede.arestas.get(car.e);
          naFaixa(ar, car.u, car.s, car.sentido, pA);
          Object.assign(car, { x: pA.x, z: pA.z, hx: pA.hx, hz: pA.hz });
          carros.push(car);
        } else seq++;
      }
      // saem os que ficaram longe (e os que passam do alvo)
      for (let i = carros.length - 1; i >= 0; i--) {
        const car = carros[i];
        if (Math.hypot(car.x - alvo.x, car.z - alvo.z) > P.raio + 80 || carros.length > alvoN + 4) carros.splice(i, 1);
      }
      if (dt > 0) andar(vias, dt, c.relogioRua);
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
      escolherCandidatos(vias, ctxQ.horaDoCeu());
      versaoRede = vias.rede.versao;
      const alvoN = Math.min(perfil().carros, Math.round(somaPeso));
      for (let k = 0; k < alvoN * 4 && carros.length < alvoN; k++) {
        const car = nascer(0);
        if (!car) {
          seq++;
          continue;
        }
        const ar = vias.rede.arestas.get(car.e);
        naFaixa(ar, car.u, car.s, car.sentido, pA);
        Object.assign(car, { x: pA.x, z: pA.z, hx: pA.hx, hz: pA.hz });
        carros.push(car);
      }
      return carros.length;
    },
    medidas() {
      let tris = 0;
      for (const M of malhas) tris += M.mesh.count * M.tris;
      return { andando: carros.length, parados, tris, alvo: Math.round(somaPeso) };
    },
    /** Cópia do estado dos carros andando (testes e cenas): aresta, faixa, sentido, s, modelo, velocidade e curva. */
    amostra() {
      return carros.map((c) => ({ id: c.id, e: c.e, u: c.u, sentido: c.sentido, s: c.s, mi: c.mi, v: c.v, curva: !!c.curva, retorno: !!c.curva?.prox?.retorno, x: c.x, z: c.z }));
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
