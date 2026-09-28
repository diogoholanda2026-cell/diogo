// Cena 'planos' (X1a e SEDE2, D59 e D63): os planos diretores da Arcologia construídos no platô entre a lagoa e a
// baía, em escala real, com as torres, o lago cavado no relevo, as partes, a paisagem, as vias internas e os portões.
// ?plano=A|B|C escolhe o plano (padrão A, a sede v2). ?vista= mostra a sede v2 de um ponto fixo:
//   aerea  visão geral às 17h30, do sul-sudoeste
//   eixo   do portão norte, pelo eixo, olhando as torres e a fenda com a cachoeira
//   mar    da praia, olhando para o norte ao entardecer
//   noite  as fontes e a cachoeira acesas, da margem sul do lago
// ?olhar=x,y,z,ax,ay,az,fov[,hora] põe a câmera num ponto qualquer (conferir de perto: a fenda, uma coroa).
//   window.__cenaPlanos.mostrar({ plano, hora, vista })  → Promise: troca o plano (cava o lago dele), a vista e a hora
// Relevo: o mapa de Heldópolis (S1a); ?sim=sintetica usa a cidade sintética. O chão da cava sai como o aplainar faria
// (D5). window.__resultado confere a Arcologia no quadro (D66: até 250 mil triângulos da família de perto no Alta e 40
// mil na vista aberta) e mede as chamadas.
import { PLANOS, PLANO_PADRAO, GLEBA_ENVELOPE } from '../../data/arcologia-plano.js';
import { alturaEm } from '../../comum/altura.js';
import { cavarPlanoNaCena, descavar } from '../arcologia/lago.js';
import { tirarAnelSintetico, simDaCena, assentarHora } from './torre.js';

const qs = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams());

/**
 * Vistas fixas da sede v2 (plano A): hora, de onde a câmera olha, para onde (mundo, metros) e o campo de visão
 * vertical. O centro do anel está em (250, 570); a fenda das torres corre no eixo norte-sul (x = 250).
 */
export const VISTAS_SEDE = Object.freeze({
  aerea: { hora: 17.5, de: [-120, 640, 1560], alvo: [250, 40, 560], fov: 42 },
  eixo: { hora: 16.5, de: [250, 92, 170], alvo: [250, 168, 570], fov: 80 },
  // chao: a altura da câmera conta do chão (ou da água) ali, não do zero. No eixo (x = 250): as fileiras de palmeiras
  // do eixo sul emolduram o pórtico e a fenda; fora dele uma palmeira do calçadão caía na frente do pórtico
  mar: { hora: 17.75, de: [250, 3, 968], alvo: [250, 200, 570], fov: 56, chao: true },
  noite: { hora: 21, de: [228, 4, 722], alvo: [250, 108, 572], fov: 68, chao: true },
});

/** Teto da família 'arcologia' no quadro, por perfil, de perto e na vista aberta (D66, tetos provisórios). */
export const TETO_ARCOLOGIA = Object.freeze({ perto: { media: 90000, alta: 250000, ultra: 250000, pc: 250000 }, aberta: 40000 });

export function registrar(registrarCena) {
  const q = qs();
  const inicial = PLANOS[q.get('plano')] ? q.get('plano') : PLANO_PADRAO;
  const olhar = (q.get('olhar') ?? '').split(',').map(Number);
  const livre = olhar.length >= 7 && olhar.every(Number.isFinite)
    ? { hora: olhar[7] ?? 17.5, de: olhar.slice(0, 3), alvo: olhar.slice(3, 6), fov: olhar[6] }
    : null;
  const vistaInicial = inicial === 'A' && VISTAS_SEDE[q.get('vista')] ? q.get('vista') : null;
  registrarCena('planos', {
    sim: simDaCena(),
    hora: livre?.hora ?? (vistaInicial ? VISTAS_SEDE[vistaInicial].hora : 17.5),
    camera: { ...PLANOS[inicial].camera },
    async montar(ctx) {
      tirarAnelSintetico(ctx);
      const dom = ctx.dominio('arcologia');
      const cava = { guarda: new Map(), ret: null };
      const cam = ctx.camera;
      const fov0 = cam.fov;
      let atual = null;
      let vista = livre ?? (vistaInicial ? VISTAS_SEDE[vistaInicial] : null);

      function escolher(id) {
        cavarPlanoNaCena(ctx, PLANOS[id], GLEBA_ENVELOPE.cota, cava);
        atual = { id };
        dom?.vitrine({ modo: 'plano', plano: id });
      }
      escolher(inicial);

      // a vista fixa manda na câmera a cada quadro (depois da câmera do jogo)
      function aplicarVista() {
        if (!vista) {
          if (cam.fov !== fov0) {
            cam.fov = fov0;
            cam.updateProjectionMatrix();
          }
          return;
        }
        const { de, alvo, fov } = vista;
        const T = ctx.sim?.espelho?.terreno;
        const base = vista.chao && T?.altura ? Math.max(alturaEm(T, de[0], de[2]), ctx.sim.espelho.mapa?.nivelMar ?? 0) : 0;
        cam.position.set(de[0], base + de[1], de[2]);
        cam.up.set(0, 1, 0);
        cam.lookAt(alvo[0], alvo[1], alvo[2]);
        cam.fov = fov;
        cam.near = 0.5;
        cam.far = 40000;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
      }

      /** Troca o plano mostrado, a vista (ou a câmera do plano) e a hora; espera o chão refeito e alguns quadros. */
      async function mostrar({ plano = PLANO_PADRAO, hora = null, camera = null, vista: v = null } = {}) {
        const R = window.__held?.R;
        if (!R) throw new Error('planos: o render ainda não está pronto');
        vista = plano === 'A' && VISTAS_SEDE[v] ? VISTAS_SEDE[v] : null;
        await assentarHora(R, ctx, hora ?? vista?.hora ?? 17.5);
        if (plano !== atual?.id) escolher(plano);
        if (!vista) R.camera.definir({ ...PLANOS[plano].camera, ...(camera ?? {}) });
        const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        const t0 = performance.now();
        while (performance.now() - t0 < 1400) await quadro();
        dom?.refazer();
        for (let i = 0; i < 3; i++) await quadro();
        window.__plano = { plano, hora, vista: v };
        return true;
      }
      if (typeof window !== 'undefined') window.__cenaPlanos = { mostrar, planos: Object.keys(PLANOS), vistas: Object.keys(VISTAS_SEDE) };

      function resultado() {
        const falhas = [];
        const s = ctx.stats;
        const tris = s?.familias?.arcologia ?? 0;
        const partes = dom?.partes;
        const perfil = ctx.perfil?.id ?? 'media';
        if (!partes) falhas.push('o plano não foi montado');
        const teto = TETO_ARCOLOGIA.perto[perfil];
        if (teto && tris > teto) falhas.push(`Arcologia com ${tris} triângulos no quadro (teto da família no ${perfil}: ${teto})`);
        return {
          ok: falhas.length === 0,
          falhas,
          medidas: { plano: atual?.id, vista: vista ? Object.keys(VISTAS_SEDE).find((k) => VISTAS_SEDE[k] === vista) : null, trisArcologia: tris, lodPartes: dom?.lodPartes, lodTorres: dom?.torre?.lod, arvores: partes?.arvores ?? 0, calls: s?.calls ?? 0 },
        };
      }

      return {
        quadro() {
          aplicarVista();
          if (vista) dom?.atualizarLods?.();
        },
        resultado,
        descartar() {
          const T = ctx.sim?.espelho?.terreno;
          // desfaz a cava e marca o chão no diário (o terreno refaz a malha da região)
          if (T && cava.guarda.size) {
            descavar(T, cava.guarda);
            if (cava.ret) ctx.sim.mudancas.marcarRet('terreno', ...cava.ret);
          }
          dom?.vitrine(null);
          cam.fov = fov0;
          cam.updateProjectionMatrix();
        },
      };
    },
  });
}
