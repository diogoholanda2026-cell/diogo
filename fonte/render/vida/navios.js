// Cruzeiro na baía (R6, D61): um navio de 300 m a 3,2 m/s num oval em água aberta (duas retas e dois semicírculos de
// 600 m) ao largo da costa da marina, sem simulação. Uma chamada instanciada de uma instância, LOD0 até 2,5 km e LOD1
// depois (cunha e blocos), escondido a mais de 40 km. Malha e rota em geracao/vidaLuxo.js; material e malha instanciada
// iguais aos dos iates. Sem mar no mapa ou sem espaço para o oval, não desenha.
import { malhaCruzeiro, planoMarina, rotaCruzeiro, pontoDoOval, escreverMatriz } from '../geracao/vidaLuxo.js';
import { geometriaDeCor, materialDeLuxo, malhaInstanciada } from './iates.js';

export const ALCANCE_CRUZEIRO = Object.freeze({ ver: 40000, lod0: 2500 });

function criarNavios(ctx) {
  const geo0 = geometriaDeCor(malhaCruzeiro(0));
  const geo1 = geometriaDeCor(malhaCruzeiro(1));
  const mat = materialDeLuxo(ctx, 'cruzeiro', { rugo: 0.42, metal: 0.05 });
  const mesh = malhaInstanciada(ctx, geo0, mat, 1, 'cruzeiro');
  let T = null;
  let semente = '';
  let rota = null;
  let lodAtual = 0;

  function refazer(esp) {
    T = esp.terreno;
    semente = String(esp.mapa?.semente ?? '');
    const s = (semente.length * 31 + 7) % 997;
    const marina = T ? planoMarina(T, s) : null;
    rota = T ? rotaCruzeiro(T, marina, s) : null;
  }

  return {
    nome: 'navios',
    get rota() {
      return rota;
    },
    quadro(tMs) {
      const esp = ctx.sim?.espelho;
      if (!esp?.terreno) {
        mesh.visible = false;
        return;
      }
      if (esp.terreno !== T || String(esp.mapa?.semente ?? '') !== semente) refazer(esp);
      if (!rota) {
        mesh.visible = false;
        return;
      }
      const t = tMs / 1000;
      const p = pontoDoOval(rota, t * rota.vel);
      const cp = ctx.camera.position;
      const d = Math.hypot(cp.x - p.x, cp.z - p.z);
      mesh.visible = d < ALCANCE_CRUZEIRO.ver;
      if (!mesh.visible) return;
      const lod = d < ALCANCE_CRUZEIRO.lod0 ? 0 : 1;
      if (lod !== lodAtual) {
        mesh.geometry = lod ? geo1 : geo0;
        lodAtual = lod;
      }
      const nivel = esp.mapa?.nivelMar ?? 0;
      // o arfar longo de um navio grande: meio grau de arfagem e um de rolagem em 9 s
      escreverMatriz(mesh.instanceMatrix.array, 0, p.x, nivel + 0.1, p.z, p.rumo, Math.sin(t * 0.35) * 0.004, Math.sin(t * 0.52) * 0.006, 1);
      mesh.count = 1;
      mesh.instanceMatrix.needsUpdate = true;
    },
    descartar() {
      ctx.cena.remove(mesh);
      geo0.dispose();
      geo1.dispose();
      mesh.dispose();
      mat.dispose();
    },
  };
}


export function registrar(api) {
  api.registrarDominio('navios', criarNavios);
}
