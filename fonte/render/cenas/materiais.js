// Cena 'materiais' (D46, Prévia 0): A/B do chão lado a lado na mesma vista. À esquerda da divisa, o detalhe
// procedural; à direita, o fotográfico CC0 (arte/materiais/chao-camadas.ktx2) quando a montagem traz o arquivo e o
// transcodificador. Sem CC0, os dois lados ficam procedurais e o resultado avisa. A vista junta o mar com a
// arrebentação, a areia molhada e seca e o gramado da orla, perto o bastante (40 a 150 m) para o detalhe contar.
// window.__resultado = { ok, falhas, cc0, avisos, ganhos }.
import { PALETA_CHAO } from '../materiais/shaders/terreno.glsl.js';

export const CAMERA_MATERIAIS = Object.freeze({ x: -2040, z: 1650, dist: 75, guinada: 250, inclinacao: 36 });

export function registrar(registrarCena) {
  registrarCena('materiais', {
    sim: 'sintetica',
    hora: 10.5,
    camera: CAMERA_MATERIAIS,
    async montar(ctx) {
      const chao = ctx.chao;
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
          if (!m.cc0) avisos.push('materiais CC0 ausentes: os dois lados estão procedurais');
          const g = chao.uniformes.uTerGanho.value.map((v) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]);
          g.forEach((v, i) => {
            if (v.some((c) => !(c >= 0.5 && c <= 2))) falhas.push(`ganho fora da faixa na camada ${PALETA_CHAO[i].id}`);
          });
          return { ok: falhas.length === 0, falhas, avisos, cc0: m.cc0, ganhos: Object.fromEntries(PALETA_CHAO.map((c, i) => [c.id, g[i]])) };
        },
        descartar() {
          linha?.remove();
          chao?.ab(false);
        },
      };
    },
  });
}
