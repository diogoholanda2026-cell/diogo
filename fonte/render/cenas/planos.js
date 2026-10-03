// Cena 'planos' (SEDE3, D88 a D90): a sede v3, Park of Future Dreams, construída inteira no platô em disco do sul da
// área inicial, de frente para o mar, em escala real: a Blade Tower e a Legacy Tower no pódio, o Mirror Lake cavado no
// relevo com as Dream Falls e as fontes, os dois anéis, as torres do bosque, o parque com as Supertrees, a paisagem, o
// anel viário, as 8 avenidas e os portões. ?vista= mostra a sede de um ponto fixo:
//   aerea    o disco inteiro às 17h30, do sul-sudoeste, sobre o mar
//   avenida  da avenida do portão oeste, do alto, olhando o centro pelo pórtico do Horizon Ring
//   mar      da praia da restinga, ao entardecer, com a lagoa na frente
//   noite    do parque, às 21h: a faixa de LED dos anéis, as Dream Falls e as fontes acesas
// ?olhar=x,y,z,ax,ay,az,fov[,hora] põe a câmera num ponto qualquer (conferir de perto: a ponte, uma coroa, um pórtico).
//   window.__cenaPlanos.mostrar({ hora, vista })  → Promise: troca a vista e a hora e espera o céu assentar
// Relevo: o mapa de Heldópolis (S1a); ?sim=sintetica usa a cidade sintética. O chão da cava sai como o aplainar faria
// (D5) e a mata do parque é pintada na grade da floresta. window.__resultado confere a família 'arcologia' no quadro
// (D66: até 250 mil triângulos de perto e 60 mil na vista aberta) e mede as chamadas.
import { PLANOS, PLANO_PADRAO, GLEBA_ENVELOPE, pontoDoArco, CAMERA_ARCOLOGIA } from '../../data/arcologia-plano.js';
import { alturaEm } from '../../comum/altura.js';
import { cavarPlanoNaCena, descavar } from '../arcologia/lago.js';
import { tirarAnelSintetico, simDaCena, assentarHora, pintarMataDaSede, fixarCamera } from './torre.js';
import { TETO_ARCOLOGIA } from '../../contratos/render.js';

const qs = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams());

const [CX, CZ] = PLANOS[PLANO_PADRAO].centro;
/** Ponto a r metros do centro da sede no ângulo do modelo (graus: 0 leste, 90 sul), a y metros. */
const em = (r, graus, y) => {
  const [x, z] = pontoDoArco(CX, CZ, r, graus);
  return [Math.round(x), y, Math.round(z)];
};

/**
 * Vistas fixas da sede v3: hora, de onde a câmera olha, para onde (mundo, metros) e o campo de visão vertical. chao: a
 * altura da câmera conta do chão (ou da água) ali.
 */
export const VISTAS_SEDE = Object.freeze({
  // o disco inteiro, do sul-sudoeste e do alto do mar, com a serra atrás (a câmera da Arcologia)
  aerea: { hora: 17.5, de: [CX - 770, 1300, CZ + 2110], alvo: [CX, 40, CZ - 40], fov: 40 },
  // do alto da avenida do portão oeste: a avenida entra no pórtico do Horizon Ring (a pista e as quadras no teto), o
  // parque, o Meridian Ring e as torres no meio; a Codex à esquerda
  avenida: { hora: 17.25, de: em(1000, 180, 200), alvo: [CX, 40, CZ], fov: 62 },
  // do alto da duna da restinga, entre a lagoa e o mar: a curva de vidro do Horizon Ring no sol do fim da tarde, com a
  // lagoa na frente (a McLaren) e as coroas das torres atrás
  mar: { hora: 18, de: [-700, 10, 1028], alvo: [CX, 120, CZ], fov: 48, chao: true },
  // do parque, de frente para a Dream Fall de 60 graus: o pódio, as fontes no lago, as torres e as faixas de LED
  noite: { hora: 21, de: em(250, 60, 26), alvo: [CX, 80, CZ], fov: 62, chao: true },
});

/** Teto da família 'arcologia' de perto, por perfil (o do contrato), e na vista aberta (60 mil, a SEDE3). */
export { TETO_ARCOLOGIA };
export const TETO_ABERTA_V3 = 60000;

export function registrar(registrarCena) {
  const q = qs();
  const olhar = (q.get('olhar') ?? '').split(',').map(Number);
  const livre = olhar.length >= 7 && olhar.every(Number.isFinite)
    ? { hora: olhar[7] ?? 17.5, de: olhar.slice(0, 3), alvo: olhar.slice(3, 6), fov: olhar[6] }
    : null;
  const vistaInicial = VISTAS_SEDE[q.get('vista')] ? q.get('vista') : null;
  registrarCena('planos', {
    sim: simDaCena(),
    hora: livre?.hora ?? (vistaInicial ? VISTAS_SEDE[vistaInicial].hora : 17.5),
    camera: { ...CAMERA_ARCOLOGIA },
    async montar(ctx) {
      tirarAnelSintetico(ctx);
      const dom = ctx.dominio('arcologia');
      const cava = { guarda: new Map(), ret: null };
      const cam = ctx.camera;
      const fov0 = cam.fov;
      let vista = livre ?? (vistaInicial ? VISTAS_SEDE[vistaInicial] : null);
      cavarPlanoNaCena(ctx, PLANOS[PLANO_PADRAO], GLEBA_ENVELOPE.cota, cava);
      const despintar = pintarMataDaSede(ctx);
      dom?.vitrine({ modo: 'plano' });

      // a pose da vista fixa (a altura conta do chão ou da água ali, com chao)
      function aplicarVista() {
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

      // a vista fixa entra no lugar da câmera do jogo (os domínios a veem no quadro deles: a vegetação escolhe as
      // árvores dela, a sombra se centra nela); alguns quadros depois de trocar, as árvores do alcance saem de uma vez
      const soltarCamera = fixarCamera(ctx, { ativa: () => !!vista, pose: aplicarVista, alvo: () => vista.alvo });
      let quadrosVista = 0;

      /** Troca a vista (ou a câmera da Arcologia) e a hora; espera o chão refeito e alguns quadros. */
      async function mostrar({ hora = null, camera = null, vista: v = null } = {}) {
        const R = window.__held?.R;
        if (!R) throw new Error('planos: o render ainda não está pronto');
        vista = VISTAS_SEDE[v] ?? null;
        quadrosVista = 0;
        await assentarHora(R, ctx, hora ?? vista?.hora ?? 17.5);
        if (!vista) {
          cam.fov = fov0;
          R.camera.definir({ ...CAMERA_ARCOLOGIA, ...(camera ?? {}) });
        }
        const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));
        const t0 = performance.now();
        while (performance.now() - t0 < 1400) await quadro();
        dom?.refazer();
        for (let i = 0; i < 3; i++) await quadro();
        window.__plano = { hora, vista: v };
        return true;
      }
      if (typeof window !== 'undefined') window.__cenaPlanos = { mostrar, vistas: Object.keys(VISTAS_SEDE) };

      function resultado() {
        const falhas = [];
        const s = ctx.stats;
        const tris = s?.familias?.arcologia ?? 0;
        const partes = dom?.partes;
        const perfil = ctx.perfil?.id ?? 'media';
        if (!partes) falhas.push('a sede não foi montada');
        const teto = TETO_ARCOLOGIA.perto[perfil];
        if (teto && tris > teto) falhas.push(`Arcologia com ${tris} triângulos no quadro (teto da família de perto no ${perfil}: ${teto})`);
        const nomeVista = vista ? Object.keys(VISTAS_SEDE).find((k) => VISTAS_SEDE[k] === vista) : null;
        if (nomeVista === 'aerea' && tris > TETO_ABERTA_V3) falhas.push(`Arcologia com ${tris} triângulos na vista aberta (teto: ${TETO_ABERTA_V3})`);
        return {
          ok: falhas.length === 0,
          falhas,
          medidas: {
            vista: nomeVista, trisArcologia: tris, lodPartes: dom?.lodPartes, setoresLod0: partes?.setores.filter((x) => x.lod0).length ?? 0,
            lodTorres: dom?.torre?.lod, arvores: partes?.arvores ?? 0, calls: s?.calls ?? 0,
          },
        };
      }

      return {
        quadro(tMs, c) {
          if (!vista) return;
          if (++quadrosVista === 3) c.dominio('vegetacao')?.preparar?.();
        },
        resultado,
        descartar() {
          soltarCamera();
          despintar();
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
