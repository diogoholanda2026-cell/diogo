// Câmera à CS2 (desenho do render 10.1, contrato em fonte/contratos/render.js): órbita em volta de um alvo no chão,
// do nível da rua (10 m) à cidade inteira (9 km), guinada livre, inclinação de 3 graus (o horizonte à vista) a 88
// (de cima), campo vertical de 40 graus. Movimento com inércia e amortecimento crítico: o arrasto é direto (o chão
// fica sob o dedo) e, ao soltar, a vista desliza e para; o zoom vai suave na direção do cursor ou do meio da pinça.
// Colisão: a câmera fica 2 m acima do chão (alturaEm, D4) e, com a R1b, do campo de alturas da cidade
// (ctx.alturaCidade). O voo (irPara) sobe em arco quando a distância é grande. Plano próximo e distante: com a
// profundidade invertida, perto de 0,1 m e longe de 100 km; sem ela, o plano próximo dinâmico e as duas faixas
// (motor/faixas.js). Guinada 0 olha para o norte (-z) e cresce no sentido horário visto de cima.
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';

export const LIMITES_CAMERA = Object.freeze({ distMin: 10, distMax: 9000, incMin: 3, incMax: 88, fov: 40 });

const RAD = Math.PI / 180;
const CAMPOS = ['x', 'z', 'dist', 'guinada', 'inclinacao'];
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

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
  const cam = ctx.camera;
  cam.fov = L.fov;
  const alvoV = new THREE.Vector3();

  const terreno = () => ctx.sim?.espelho?.terreno ?? null;
  const chao = (x, z) => {
    const T = terreno();
    const h = T ? alturaEm(T, x, z) : 0;
    const c = ctx.alturaCidade ? ctx.alturaCidade(x, z) : -Infinity;
    return Math.max(h, Number.isFinite(c) ? c : -Infinity);
  };
  const limitar = () => {
    for (const k of CAMPOS) if (!Number.isFinite(e[k])) e[k] = k === 'dist' ? 1200 : 0;
    e.dist = Math.min(L.distMax, Math.max(L.distMin, e.dist));
    e.inclinacao = Math.min(L.incMax, Math.max(L.incMin, e.inclinacao));
    e.guinada = ((e.guinada % 360) + 360) % 360;
    const m = (ctx.sim?.espelho?.mapa?.tam ?? 8192) / 2;
    e.x = Math.min(m, Math.max(-m, e.x));
    e.z = Math.min(m, Math.max(-m, e.z));
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
      const dh = Math.hypot(para.x - de.x, para.z - de.z);
      const arco = Math.min(4000, 0.35 * Math.max(0, dh - 0.5 * (de.dist + para.dist)));
      return new Promise((ok) => {
        voo = { t0: agora(), ms, de, para, arco, ok };
      });
    },
    /** Desloca o alvo no mundo (arrasto: direto, sem inércia). */
    mover(dx, dz) {
      encerrarVoo();
      e.x += dx;
      e.z += dz;
      limitar();
    },
    girar(dg, di = 0) {
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
      encerrarVoo();
      zoom.alvo = Math.min(L.distMax, Math.max(L.distMin, zoom.alvo * fator));
      zoom.ancora = ancora ? [ancora[0], ancora[2]] : null;
    },
    /** Velocidades de soltura (arrasto e giro): a vista desliza e para. */
    impulso({ vx = 0, vz = 0, vg = 0, vi = 0 } = {}) {
      vel.x = vx;
      vel.z = vz;
      vel.guinada = vg;
      vel.inclinacao = vi;
    },
    parar: pararInercia,
    /** Alvo no chão (y pelo terreno). */
    alvo(v = new THREE.Vector3()) {
      const T = terreno();
      return v.set(e.x, T ? alturaEm(T, e.x, e.z) : 0, e.z);
    },
    /** Chão sob um ponto (terreno e, com a R1b, a cidade). */
    chao,
    atualizar(tMs = agora()) {
      const dt = tAnt ? Math.min(0.1, Math.max(0, (tMs - tAnt) / 1000)) : 0;
      tAnt = tMs;
      if (voo) {
        const k = Math.min(1, (tMs - voo.t0) / voo.ms);
        const s = suave(k);
        for (const c of CAMPOS) e[c] = voo.de[c] + (voo.para[c] - voo.de[c]) * s;
        e.dist += voo.arco * Math.sin(Math.PI * s);
        if (k >= 1) encerrarVoo();
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
      const gu = e.guinada * RAD;
      const inc = e.inclinacao * RAD;
      cam.position.set(a.x - e.dist * Math.cos(inc) * Math.sin(gu), a.y + e.dist * Math.sin(inc), a.z + e.dist * Math.cos(inc) * Math.cos(gu));
      // colisão: 2 m acima do chão onde a câmera está
      const piso = chao(cam.position.x, cam.position.z) + 2;
      if (cam.position.y < piso) cam.position.y = piso;
      cam.lookAt(a);
      const acima = Math.max(1, cam.position.y - chao(cam.position.x, cam.position.z));
      if (ctx.semClip) {
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
