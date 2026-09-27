// Cena 'planos' (X1a, D59, Prévia 0): os três planos diretores da Arcologia construídos no platô entre a lagoa e a
// baía, em escala real, com a Torre Lâmina, o reservatório cavado no relevo, as partes em LOD1, a paisagem, as vias
// internas candidatas e os portões, numa vista aérea oblíqua às 17h30. ?plano=A|B|C escolhe o plano (padrão A);
//   window.__cenaPlanos.mostrar({ plano, hora })  → Promise: troca o plano (cava o reservatório dele) e a câmera
// Relevo: o mapa de Heldópolis (S1a); ?sim=sintetica usa a cidade sintética. O chão da cava sai como o aplainar
// faria (D5).
// window.__resultado confere o orçamento da Arcologia (LOD1 perto de 25 mil triângulos, até 45 chamadas no Média).
import { PLANOS, PLANO_PADRAO, GLEBA_ENVELOPE } from '../../data/arcologia-plano.js';
import { CeuReserva, estadoDoCeu } from '../arcologia/torre.js';
import { cavarPlanoNaCena, descavar } from '../arcologia/lago.js';
import { tirarAnelSintetico, simDaCena, assentarHora } from './torre.js';

const qs = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams());

export function registrar(registrarCena) {
  const inicial = PLANOS[qs().get('plano')] ? qs().get('plano') : PLANO_PADRAO;
  registrarCena('planos', {
    sim: simDaCena(),
    hora: 17.5,
    camera: { ...PLANOS[inicial].camera },
    async montar(ctx) {
      tirarAnelSintetico(ctx);
      const dom = ctx.dominio('arcologia');
      const ceu = new CeuReserva(ctx);
      const estado = {};
      const cava = { guarda: new Map(), ret: null };
      let atual = null;

      function cavar(id) {
        cavarPlanoNaCena(ctx, PLANOS[id], GLEBA_ENVELOPE.cota, cava);
        atual = { id };
      }

      function escolher(id) {
        cavar(id);
        dom?.vitrine({ modo: 'plano', plano: id });
      }
      escolher(inicial);

      /** Troca o plano mostrado, a câmera e a hora; espera o chão refeito e alguns quadros. */
      async function mostrar({ plano = PLANO_PADRAO, hora = 17.5, camera = null } = {}) {
        const R = window.__held?.R;
        if (!R) throw new Error('planos: o render ainda não está pronto');
        await assentarHora(R, ctx, hora);
        escolher(plano);
        R.camera.definir({ ...PLANOS[plano].camera, ...(camera ?? {}) });
        const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        const t0 = performance.now();
        while (performance.now() - t0 < 1400) await quadro();
        dom?.refazer();
        for (let i = 0; i < 3; i++) await quadro();
        window.__plano = { plano, hora };
        return true;
      }
      if (typeof window !== 'undefined') window.__cenaPlanos = { mostrar, planos: Object.keys(PLANOS) };

      function resultado() {
        const falhas = [];
        const s = ctx.stats;
        const tris = s?.familias?.arcologia ?? 0;
        const partes = dom?.partes;
        if (!partes) falhas.push('o plano não foi montado');
        if (ctx.perfil?.id === 'media' && tris > 60000) falhas.push(`Arcologia com ${tris} triângulos no quadro (teto da família: 60 mil)`);
        return { ok: falhas.length === 0, falhas, medidas: { plano: atual?.id, trisArcologia: tris, arvores: partes?.arvores ?? 0, calls: s?.calls ?? 0 } };
      }

      return {
        quadro(tMs, c) {
          estadoDoCeu(c, estado);
          ceu.quadro(estado);
        },
        resultado,
        descartar() {
          ceu.descartar();
          const T = ctx.sim?.espelho?.terreno;
          if (T && cava.guarda.size) descavar(T, cava.guarda);
          dom?.vitrine(null);
        },
      };
    },
  });
}
