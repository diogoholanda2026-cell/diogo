// Raio da tela contra o chão (R.raio, D4): a mesma altura bilinear da simulação (alturaEm de fonte/comum/altura.js),
// sem ler a GPU. Marcha com passo que cresce com a folga acima do chão (seguro para encostas de até 45 graus) e
// fecha por bisseção; um raio que sobe só acerta morro. A R1b acrescenta o campo de alturas da cidade na seleção.
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';

const _v = new THREE.Vector3();

/** Raio da tela (px CSS) em coordenadas do mundo: { origem, dir } (dir unitário). */
export function raioDaTela(camera, largura, altura, x, y) {
  const v = _v.set((x / largura) * 2 - 1, -(y / altura) * 2 + 1, 0.5).unproject(camera);
  const o = camera.position;
  const d = v.sub(o).normalize();
  return { origem: [o.x, o.y, o.z], dir: [d.x, d.y, d.z] };
}

const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

/**
 * Ponto do mundo na tela (R.projetar): { x, y, visivel, dist, frente, prof }, em px CSS. "Na frente" sai do espaço da
 * câmera, não do z da tela: com a profundidade invertida um ponto logo atrás da câmera cai com z entre -1 e 0 e
 * passaria por visível (marcadores e âncoras espelhados no meio da tela). frente diz se o ponto está além do plano
 * próximo (mesmo fora da tela) e prof é a distância ao longo do eixo da câmera (negativa atrás dela): quem desenha uma
 * linha com pontos dos dois lados (o traçado sugerido rente ao chão) corta o trecho no plano próximo pela prof, em vez
 * de ligar um ponto espelhado.
 * @param {THREE.Camera} camera  com matrixWorld e matrixWorldInverse em dia
 * @param {number[]} p  [x, y, z]
 */
export function projetarNaTela(camera, largura, altura, p) {
  const v = _p.set(p[0], p[1], p[2]);
  const dist = v.distanceTo(camera.position);
  const prof = -_q.copy(v).applyMatrix4(camera.matrixWorldInverse).z;
  const frente = prof > (camera.near || 0);
  v.project(camera);
  const x = ((v.x + 1) / 2) * largura;
  const y = ((1 - v.y) / 2) * altura;
  return { x, y, visivel: frente && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= largura && y >= 0 && y <= altura, dist, frente, prof };
}

/**
 * Primeiro ponto do raio abaixo do chão (terreno pela grade de alturas), ou null.
 * @param {{ n, passo, origem, altura }} T  espelho.terreno (null: chão plano na cota 0)
 * @param {{ origem: number[], dir: number[] }} raio
 */
export function raioNoTerreno(T, raio, { maxDist = 40000, maxPassos = 600 } = {}) {
  const [ox, oy, oz] = raio.origem;
  const [dx, dy, dz] = raio.dir;
  const folga = (t) => oy + dy * t - (T ? alturaEm(T, ox + dx * t, oz + dz * t) : 0);
  let f = folga(0);
  if (f < 0) return null;
  let t0 = 0;
  let t = 0;
  for (let k = 0; k < maxPassos && t < maxDist; k++) {
    // passo seguro: a folga dividida pela descida do raio mais a inclinação máxima do chão (1)
    const passo = Math.max(0.25, f / (Math.max(0, -dy) + 1)) + t * 0.002;
    t0 = t;
    t = Math.min(maxDist, t + passo);
    f = folga(t);
    if (f <= 0) {
      let a = t0;
      let b = t;
      for (let i = 0; i < 28; i++) {
        const m = (a + b) / 2;
        if (folga(m) > 0) a = m;
        else b = m;
      }
      const s = (a + b) / 2;
      return [ox + dx * s, oy + dy * s, oz + dz * s];
    }
  }
  return null;
}

/** R.raio(xTela, yTela) do contexto do render. */
export function raioDoContexto(ctx, x, y) {
  const w = ctx.tela?.w || ctx.canvas?.clientWidth || 1;
  const h = ctx.tela?.h || ctx.canvas?.clientHeight || 1;
  return raioNoTerreno(ctx.sim?.espelho?.terreno ?? null, raioDaTela(ctx.camera, w, h, x, y));
}

export function registrar(api) {
  api.definirRaio(raioDoContexto);
}
