// Cena 'materiais' (D46, Prévia 0): A/B do chão lado a lado na mesma vista. À esquerda da divisa, o detalhe
// procedural; à direita, o fotográfico CC0 (arte/materiais/chao-camadas.ktx2) quando a montagem traz o arquivo e o
// transcodificador Basis. Sem CC0, os dois lados ficam procedurais e o resultado avisa. A câmera fica sobre o mar,
// olhando para o norte, com a linha da costa atravessando a tela: os dois lados mostram as mesmas faixas (mar com a
// arrebentação, areia molhada e seca, restinga, capim e a encosta com granito), perto o bastante (15 a 80 m) para a
// textura de cada material aparecer (mais longe, o que manda é a mistura das camadas, igual nos dois lados).
// window.__resultado = { ok, falhas, avisos, cc0, ganhos, ganhosB }.
import { PALETA_CHAO } from '../materiais/shaders/terreno.glsl.js';
import { carregarCC0 } from '../materiais/texturas-chao.js';

export const CAMERA_MATERIAIS = Object.freeze({ x: -2112, z: 1727, dist: 36, guinada: 345, inclinacao: 27 });

const lerGanhos = (vs) => vs.map((v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]);

export function registrar(registrarCena) {
  registrarCena('materiais', {
    sim: 'sintetica',
    hora: 10.5,
    camera: CAMERA_MATERIAIS,
    async montar(ctx) {
      const chao = ctx.chao;
      // a textura CC0 chega antes do primeiro quadro (a cena espera; sem arquivo resolve null na hora)
      const cc0 = chao ? await carregarCC0({ renderer: ctx.renderer, THREE: ctx.THREE, montagem: ctx.montagem }) : null;
      const meio = () => (ctx.canvas.clientWidth || innerWidth) / 2;
      chao?.ab(true, meio());
      // divisa desenhada por cima do mundo (só uma linha, sem texto)
      let linha = null;
      if (typeof document !== 'undefined') {
        linha = document.createElement('div');
        linha.style.cssText = 'position:fixed;top:0;bottom:0;width:2px;margin-left:-1px;background:rgba(245,240,228,.85);pointer-events:none;z-index:5';
        document.body.appendChild(linha);
      }
      return {
        quadro() {
          const x = meio();
          if (linha) linha.style.left = `${x}px`;
          chao?.ab(true, x);
        },
        resultado() {
          const falhas = [];
          const avisos = [];
          if (!chao) return { ok: false, falhas: ['sem terreno'] };
          const m = chao.materiais();
          if (!cc0 || !m.cc0) avisos.push('materiais CC0 ausentes: os dois lados estão procedurais');
          const u = chao.uniformes;
          const g = lerGanhos(u.uTerGanho.value);
          const gB = lerGanhos(u.uTerGanhoB.value);
          [g, gB].forEach((lista, lado) => lista.forEach((v, i) => {
            if (v.some((c) => !(c >= 0.5 && c <= 2))) falhas.push(`ganho fora da faixa na camada ${PALETA_CHAO[i].id} (lado ${lado ? 'B' : 'A'})`);
          }));
          if (m.cc0 && u.uTerCamadasB.value?.userData?.fonte !== 'cc0') falhas.push('o lado B não está com a textura CC0');
          const porId = (lista) => Object.fromEntries(PALETA_CHAO.map((c, i) => [c.id, lista[i]]));
          return { ok: falhas.length === 0, falhas, avisos, cc0: m.cc0, ganhos: porId(g), ganhosB: porId(gB) };
        },
        descartar() {
          linha?.remove();
          chao?.ab(false);
        },
      };
    },
  });
}
