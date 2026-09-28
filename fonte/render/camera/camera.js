// Câmera à CS2 (desenho do render 10.1, contrato em fonte/contratos/render.js): órbita em volta de um alvo no chão,
// do nível da rua (10 m) à cidade inteira (9 km), guinada livre, inclinação de 3 graus (o horizonte à vista) a 88
// (de cima), campo vertical de 40 graus. Movimento com inércia e amortecimento crítico: o arrasto é direto (o chão
// fica sob o dedo) e, ao soltar, a vista desliza e para; o zoom vai suave na direção do cursor ou do meio da pinça.
// Colisão: a câmera fica 2 m acima do chão (alturaEm, D4, ou a superfície do mar, espelho.mapa.nivelMar) e do campo de
// alturas da cidade (ctx.alturaCidade, R1b, a grade da CPU: sem ler a GPU). Perto dos prédios a vista sobe pela órbita
// (a inclinação efetiva cresce até a câmera sair de cima do telhado), sem pular de altura; o estado guarda a
// inclinação pedida. O voo (irPara) segue o caminho ótimo de zoom e deslocamento de van Wijk e Nuij (2003): afasta o
// bastante para os dois lugares caberem na vista, anda e aproxima, com a velocidade de tela constante e a partida e a
// chegada suaves.
// Plano próximo e distante: com a profundidade invertida em ponto flutuante (alvo HDR), perto de 0,1 m e longe de
// 100 km; no canvas (Leve) e sem ela, o plano próximo cresce com a altura e, sem EXT_clip_control, valem as duas
// faixas (motor/faixas.js). Guinada 0 olha para o norte (-z) e cresce no sentido horário visto de cima.
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';

export const LIMITES_CAMERA = Object.freeze({ distMin: 10, distMax: 9000, incMin: 3, incMax: 88, fov: 40 });

const RAD = Math.PI / 180;
const CAMPOS = ['x', 'z', 'dist', 'guinada', 'inclinacao'];
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

/** Curvatura do voo (rho de van Wijk e Nuij): raiz de 2 é o ótimo medido pelos autores. */
export const RHO_VOO = Math.SQRT2;

/**
 * Caminho ótimo de zoom e deslocamento (van Wijk e Nuij, 2003; a mesma conta do d3-interpolate): de uma vista de
 * largura w0 a uma de largura w1, andando d no chão. Devolve S (o comprimento do caminho) e em(t), t de 0 a 1, com
 * { u (fração do caminho no chão), w (largura) }.
 */
export function caminhoVoo(w0, w1, d, rho = RHO_VOO) {
  const r2 = rho * rho;
  const r4 = r2 * r2;
  if (d < 1e-6 * Math.max(w0, w1, 1)) {
    const S = Math.log(w1 / w0) / rho;
    return { S: Math.abs(S), em: (t) => ({ u: t, w: w0 * Math.exp(rho * t * S) }) };
  }
  const b0 = (w1 * w1 - w0 * w0 + r4 * d * d) / (2 * w0 * r2 * d);
  const b1 = (w1 * w1 - w0 * w0 - r4 * d * d) / (2 * w1 * r2 * d);
  // log(raiz(b² + 1) - b) é -asinh(b): a forma do artigo perde tudo na subtração quando b é grande (afastar muito
  // saindo quase do mesmo lugar: de 10 m a 9 km andando 2 cm dava NaN, e a câmera ia para a origem no voo)
  const q0 = -Math.asinh(b0);
  const q1 = -Math.asinh(b1);
  const S = (q1 - q0) / rho;
  const ch = Math.cosh(q0);
  return {
    S,
    em(t) {
      const s = t * S;
      return { u: (w0 / (r2 * d)) * (ch * Math.tanh(rho * s + q0) - Math.sinh(q0)), w: (w0 * ch) / Math.cosh(rho * s + q0) };
    },
  };
}

/** Constantes de tempo (s) da inércia e do zoom. */
export const AMORTECE = Object.freeze({ pan: 0.32, giro: 0.22, zoom: 0.14, parado: 0.02 });

/**
 * @param {object} ctx  contexto do render (camera do three, sim, semClip)
 * @param {object} inicial  EstadoCamera parcial
 */
export function criarCamera(ctx, inicial = {}) {
  const L = LIMITES_CAMERA;
  const e = { x: 0, z: 0, dist: 1200, guinada: 20, inclinacao: 38, ...inicial };
  const vel = { x: 0, z: 0, guinada: 0, inclinacao: 0 }; // m/s e graus/s
  const zoom = { alvo: e.dist, ancora: null }; // distância desejada e o ponto do mundo que fica parado na tela
  let voo = null;
  let tAnt = 0;
  let incEfetiva = e.inclinacao;
  const cam = ctx.camera;
  cam.fov = L.fov;
  const alvoV = new THREE.Vector3();
  const posicionar = (a, inc) => {
    const gu = e.guinada * RAD;
    const ic = inc * RAD;
    cam.position.set(a.x - e.dist * Math.cos(ic) * Math.sin(gu), a.y + e.dist * Math.sin(ic), a.z + e.dist * Math.cos(ic) * Math.cos(gu));
  };

  const terreno = () => ctx.sim?.espelho?.terreno ?? null;
  // sobre o mar vale a superfície da água, não o fundo: o alvo fica na água e a câmera nunca mergulha
  const nivelMar = () => {
    const n = ctx.sim?.espelho?.mapa?.nivelMar;
    return Number.isFinite(n) ? n : 0;
  };
  const superficie = (x, z) => {
    const T = terreno();
    return T ? Math.max(alturaEm(T, x, z), nivelMar()) : 0;
  };
  const chao = (x, z) => {
    const h = superficie(x, z);
    const c = ctx.alturaCidade ? ctx.alturaCidade(x, z) : -Infinity;
    return Math.max(h, Number.isFinite(c) ? c : -Infinity);
  };
  // profundidade em ponto flutuante (alvo HDR com a profundidade invertida): plano próximo de centímetros; no canvas
  // (Leve, sem pós) ou nas duas faixas, 24 bits (ou 16 em alguns celulares) pedem o plano próximo mais longe
  const profundidadeFina = () => !ctx.semClip && !!ctx.quadro?.pos?.ligado && !!ctx.renderer?.state?.buffers?.depth?.getReversed?.();
  const limitar = () => {
    for (const k of CAMPOS) if (!Number.isFinite(e[k])) e[k] = k === 'dist' ? 1200 : 0;
    e.dist = Math.min(L.distMax, Math.max(L.distMin, e.dist));
    e.inclinacao = Math.min(L.incMax, Math.max(L.incMin, e.inclinacao));
    e.guinada = ((e.guinada % 360) + 360) % 360;
    // o alvo fica dentro do mapa (origem e lado do espelho; sem mapa, 8.192 m centrados)
    const mapa = ctx.sim?.espelho?.mapa;
    const lado = Number.isFinite(mapa?.tam) ? mapa.tam : 8192;
    const ox = Number.isFinite(mapa?.origem?.[0]) ? mapa.origem[0] : -lado / 2;
    const oz = Number.isFinite(mapa?.origem?.[1]) ? mapa.origem[1] : -lado / 2;
    e.x = Math.min(ox + lado, Math.max(ox, e.x));
    e.z = Math.min(oz + lado, Math.max(oz, e.z));
  };
  const pararInercia = () => {
    vel.x = vel.z = vel.guinada = vel.inclinacao = 0;
    zoom.alvo = e.dist;
    zoom.ancora = null;
  };
  // um voo interrompido (definir, outro irPara) resolve a Promise dele: quem espera não fica preso
  const encerrarVoo = () => {
    if (!voo) return;
    const { ok } = voo;
    voo = null;
    ok();
  };

  const api = {
    estado: () => ({ x: e.x, z: e.z, dist: e.dist, guinada: e.guinada, inclinacao: e.inclinacao }),
    /** Põe a câmera no estado (sem inércia; interrompe o voo). */
    definir(n = {}) {
      encerrarVoo();
      for (const k of CAMPOS) if (Number.isFinite(n[k])) e[k] = n[k];
      limitar();
      pararInercia();
    },
    /** Voo até o alvo em ms (arco quando longe); resolve ao chegar ou se interrompido. */
    irPara(alvo = {}, ms = 800) {
      encerrarVoo();
      pararInercia();
      const de = api.estado();
      const para = { ...de };
      for (const k of CAMPOS) if (Number.isFinite(alvo[k])) para[k] = alvo[k];
      para.dist = Math.min(L.distMax, Math.max(L.distMin, para.dist));
      para.inclinacao = Math.min(L.incMax, Math.max(L.incMin, para.inclinacao));
      para.guinada = de.guinada + ((((para.guinada - de.guinada + 540) % 360) + 360) % 360) - 180;
      if (!(ms > 0)) {
        api.definir(para);
        return Promise.resolve();
      }
      const caminho = caminhoVoo(de.dist, para.dist, Math.hypot(para.x - de.x, para.z - de.z));
      return new Promise((ok) => {
        voo = { t0: agora(), ms, de, para, caminho, ok };
      });
    },
    /** Desloca o alvo no mundo (arrasto: direto, sem inércia). */
    mover(dx, dz) {
      if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
      encerrarVoo();
      e.x += dx;
      e.z += dz;
      limitar();
    },
    girar(dg, di = 0) {
      if (!Number.isFinite(dg) || !Number.isFinite(di)) return;
      encerrarVoo();
      e.guinada += dg;
      e.inclinacao += di;
      limitar();
    },
    /**
     * Zoom suave por um fator (menor que 1 aproxima), com o ponto do mundo `ancora` ([x, y, z]) parado na tela.
     * Fatores seguidos se acumulam no alvo do zoom.
     */
    zoom(fator, ancora = null) {
      // um fator torto (NaN, infinito, zero) travaria o zoom para sempre: o alvo NaN não volta sozinho
      if (!(fator > 0) || !Number.isFinite(fator)) return;
      encerrarVoo();
      if (!Number.isFinite(zoom.alvo)) zoom.alvo = e.dist;
      zoom.alvo = Math.min(L.distMax, Math.max(L.distMin, zoom.alvo * fator));
      zoom.ancora = ancora && Number.isFinite(ancora[0]) && Number.isFinite(ancora[2]) ? [ancora[0], ancora[2]] : null;
    },
    /** Velocidades de soltura (arrasto e giro): a vista desliza e para. Um valor torto vale zero. */
    impulso({ vx = 0, vz = 0, vg = 0, vi = 0 } = {}) {
      const f = (v) => (Number.isFinite(v) ? v : 0);
      vel.x = f(vx);
      vel.z = f(vz);
      vel.guinada = f(vg);
      vel.inclinacao = f(vi);
    },
    parar: pararInercia,
    /** Alvo no chão (y pelo terreno; sobre o mar, a superfície da água). */
    alvo(v = new THREE.Vector3()) {
      return v.set(e.x, superficie(e.x, e.z), e.z);
    },
    /** Chão sob um ponto (terreno e, com a R1b, a cidade). */
    chao,
    atualizar(tMs = agora()) {
      const dt = tAnt ? Math.min(0.1, Math.max(0, (tMs - tAnt) / 1000)) : 0;
      tAnt = tMs;
      if (voo) {
        const k = Math.min(1, (tMs - voo.t0) / voo.ms);
        const s = suave(k);
        const { u, w } = voo.caminho.em(s);
        const { de: a, para: b } = voo;
        e.x = a.x + (b.x - a.x) * u;
        e.z = a.z + (b.z - a.z) * u;
        e.dist = Math.min(L.distMax, w);
        e.guinada = a.guinada + (b.guinada - a.guinada) * s;
        e.inclinacao = a.inclinacao + (b.inclinacao - a.inclinacao) * s;
        if (k >= 1) {
          for (const c of CAMPOS) e[c] = b[c];
          encerrarVoo();
        }
      } else if (dt > 0) {
        // inércia: velocidades que decaem; zoom que se aproxima do alvo com o ponto de âncora parado
        e.x += vel.x * dt;
        e.z += vel.z * dt;
        e.guinada += vel.guinada * dt;
        e.inclinacao += vel.inclinacao * dt;
        const kp = Math.exp(-dt / AMORTECE.pan);
        const kg = Math.exp(-dt / AMORTECE.giro);
        vel.x *= kp;
        vel.z *= kp;
        vel.guinada *= kg;
        vel.inclinacao *= kg;
        if (Math.hypot(vel.x, vel.z) < 0.02 * Math.max(1, e.dist * 0.01)) vel.x = vel.z = 0;
        if (Math.abs(vel.guinada) < 0.05) vel.guinada = 0;
        if (Math.abs(vel.inclinacao) < 0.05) vel.inclinacao = 0;
        if (Math.abs(zoom.alvo / e.dist - 1) > 1e-4) {
          const f = (zoom.alvo / e.dist) ** (1 - Math.exp(-dt / AMORTECE.zoom));
          if (zoom.ancora) {
            e.x = zoom.ancora[0] + (e.x - zoom.ancora[0]) * f;
            e.z = zoom.ancora[1] + (e.z - zoom.ancora[1]) * f;
          }
          e.dist *= f;
        } else {
          e.dist = zoom.alvo;
          zoom.ancora = null;
        }
      }
      limitar();
      const a = api.alvo(alvoV);
      posicionar(a, e.inclinacao);
      // colisão: 2 m acima do chão e da cidade onde a câmera está; perto de prédio, a vista sobe pela órbita (em passos
      // de 2 graus e depois por bissecção até 1/8 de grau, para a vista não andar aos saltos contornando uma torre)
      let inc = e.inclinacao;
      let piso = chao(cam.position.x, cam.position.z) + 2;
      if (cam.position.y < piso) {
        let baixo = inc;
        for (let k = 0; k < 44 && cam.position.y < piso && inc < L.incMax; k++) {
          baixo = inc;
          inc = Math.min(L.incMax, inc + 2);
          posicionar(a, inc);
          piso = chao(cam.position.x, cam.position.z) + 2;
        }
        if (cam.position.y >= piso) {
          for (let k = 0; k < 4; k++) {
            const meio = (baixo + inc) / 2;
            posicionar(a, meio);
            if (cam.position.y >= chao(cam.position.x, cam.position.z) + 2) inc = meio;
            else baixo = meio;
          }
          posicionar(a, inc);
          piso = chao(cam.position.x, cam.position.z) + 2;
        }
      }
      if (cam.position.y < piso) cam.position.y = piso;
      incEfetiva = inc;
      cam.lookAt(a);
      const acima = Math.max(1, cam.position.y - chao(cam.position.x, cam.position.z));
      if (!profundidadeFina()) {
        cam.near = Math.min(30, Math.max(0.2, acima * 0.02));
        cam.far = 60000;
      } else {
        cam.near = Math.min(4, Math.max(0.08, acima * 0.004));
        cam.far = 100000;
      }
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    },
    get voando() {
      return !!voo;
    },
    /** Inclinação que a vista usa de fato (sobe perto de prédio para a câmera não entrar nele). */
    get inclinacaoEfetiva() {
      return incEfetiva;
    },
    get movendo() {
      return !!voo || vel.x !== 0 || vel.z !== 0 || vel.guinada !== 0 || vel.inclinacao !== 0 || zoom.ancora !== null || Math.abs(zoom.alvo - e.dist) > 1e-3;
    },
  };
  limitar();
  zoom.alvo = e.dist;
  return api;
}

export function registrar(api) {
  api.definirCamera(criarCamera);
}
