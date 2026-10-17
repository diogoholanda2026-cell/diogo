// Jatinhos cruzando o céu (R6, D61): três executivos de 30 m em retas de 44 km a 1,3 a 2,5 km de altura e uns 110 a
// 130 m/s, sem simulação e sem trilha. Uma chamada instanciada (3 instâncias de 556 triângulos); o conjunto some a mais de
// 30 km do jato mais perto. Malha e rotas em geracao/vidaLuxo.js; material e malha instanciada iguais aos dos iates.
import { malhaJato, rotasJatos, jatoNaRota, escreverMatriz } from '../geracao/vidaLuxo.js';
import { geometriaDeCor, materialDeLuxo, malhaInstanciada } from './iates.js';

export const N_JATOS = 3;

function criarJatos(ctx) {
  const geo = geometriaDeCor(malhaJato());
  const mat = materialDeLuxo(ctx, 'jato', { rugo: 0.28, metal: 0.3 });
  const mesh = malhaInstanciada(ctx, geo, mat, N_JATOS, 'jatos');
  let T = null;
  let semente = '';
  let rotas = [];

  return {
    nome: 'jatos',
    get rotas() {
      return rotas;
    },
    quadro(tMs) {
      const esp = ctx.sim?.espelho;
      if (esp?.terreno && (esp.terreno !== T || String(esp.mapa?.semente ?? '') !== semente)) {
        T = esp.terreno;
        semente = String(esp.mapa?.semente ?? '');
        rotas = rotasJatos(T, (semente.length * 31 + 7) % 997, N_JATOS);
      }
      if (!rotas.length) {
        mesh.visible = false;
        return;
      }
      const cp = ctx.camera.position;
      const arr = mesh.instanceMatrix.array;
      let perto = Infinity;
      rotas.forEach((r, k) => {
        const p = jatoNaRota(r, tMs);
        perto = Math.min(perto, Math.hypot(cp.x - p.x, cp.y - p.y, cp.z - p.z));
        // o nariz um pouco acima da horizontal em cruzeiro e uma leve rolagem de curva de espera
        escreverMatriz(arr, k * 16, p.x, p.y, p.z, p.rumo, -0.03, Math.sin(tMs / 9000 + k) * 0.02, 1);
      });
      mesh.visible = perto < 30000;
      mesh.count = rotas.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    descartar() {
      ctx.cena.remove(mesh);
      geo.dispose();
      mesh.dispose();
      mat.dispose();
    },
  };
}

export function registrar(api) {
  api.registrarDominio('jatos', criarJatos);
}
