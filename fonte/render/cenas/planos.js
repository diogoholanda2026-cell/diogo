// Cena 'planos' (SEDE3 e SEDE4, D88 a D90 e D97): a sede v4, Park of Future Dreams, construída inteira no platô em disco do
// sul da área inicial, de frente para o mar, em escala real: a Blade Tower e a Legacy Tower no pódio, o Mirror Lake grande
// cavado no relevo com as ilhas, as Dream Falls de 120 m e as fontes, os dois anéis com os Hanging Gardens e o Halo Lake,
// as 8 Canopy Bridges, as torres do bosque no eixo das avenidas, o parque com as Supertrees, a paisagem, o anel viário, as
// 8 avenidas e os portões. ?vista= mostra a sede de um ponto fixo:
//   aerea    o disco inteiro às 17h30, do sul-sudoeste, sobre o mar
//   avenida  da avenida do portão oeste, do alto, olhando o centro pelo pórtico do Horizon Ring
//   mar      da praia da restinga, ao entardecer, com a lagoa na frente
//   noite    do parque, às 21h: a faixa de LED dos anéis, as Dream Falls e as fontes acesas
//   parque   o lago e a mata de perto, às 17h, do cais da praça do pódio (SEDE4)
//   canopy   uma Canopy Bridge de baixo, da avenida de 225 graus (SEDE4)
//   quedas   as Dream Falls de 247,5 graus de frente (SEDE4)
// ?olhar=x,y,z,ax,ay,az,fov[,hora] põe a câmera num ponto qualquer (conferir de perto: a ponte, uma coroa, um pórtico).
// ?etapas= mostra o jogo (X1b) em vez da sede construída: 'todas' (as 5 etapas do M1a prontas: o par, o lago, os portões
//   e o resto da sede em fantasma) ou '<etapa>:<progresso>' (a obra: as anteriores prontas, esta em obra), com as vias
//   internas do plano desenhadas (a cena não tem o grafo do jogo). ?heli=<segundo> congela o helicóptero no ciclo.
//   window.__cenaPlanos.mostrar({ hora, vista })  → Promise: troca a vista e a hora e espera o céu assentar
// Relevo: o mapa de Heldópolis (S1a); ?sim=sintetica usa a cidade sintética. O chão da cava sai como o aplainar faria
// (D5) e a mata do parque é pintada na grade da floresta. window.__resultado confere a família 'arcologia' no quadro
// (D66: até 250 mil triângulos de perto e 60 mil na vista aberta) e mede as chamadas.
import { PLANOS, PLANO_PADRAO, GLEBA_ENVELOPE, pontoDoArco, CAMERA_ARCOLOGIA } from '../../data/arcologia-plano.js';
import { alturaEm } from '../../comum/altura.js';
import { cavarPlanoNaCena, descavar } from '../arcologia/lago.js';
import { tirarAnelSintetico, simDaCena, assentarHora, pintarMataDaSede, fixarCamera } from './torre.js';
import { TETO_ARCOLOGIA } from '../../contratos/render.js';
import { ETAPA } from '../../contratos/flags.js';
import { ETAPAS_ORDEM } from '../../data/arcologia.js';

const qs = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams());

const [CX, CZ] = PLANOS[PLANO_PADRAO].centro;
/** Ponto a r metros do centro da sede no ângulo do modelo (graus: 0 leste, 90 sul), a y metros. */
const em = (r, graus, y) => {
  const [x, z] = pontoDoArco(CX, CZ, r, graus);
  return [Math.round(x), y, Math.round(z)];
};
/** O mesmo, deslocado `lado` metros para o lado do eixo (o sentido em que o ângulo cresce): sai do meio da avenida. */
const emLado = (r, graus, lado, y) => {
  const [x, z] = pontoDoArco(CX, CZ, r, graus);
  const a = (graus * Math.PI) / 180;
  return [Math.round(x - Math.sin(a) * lado), y, Math.round(z + Math.cos(a) * lado)];
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
  // SEDE4: o parque com o lago e a mata de perto, do cais da praça do pódio: a água, a ilha de mata, o bosque de Supertrees
  // na margem, a mata densa até o Meridian Ring com os terraços dos Hanging Gardens e a enseada de uma queda ao fundo
  parque: { hora: 17, de: em(158, 8, 15), alvo: em(380, 28, 30), fov: 58, chao: true },
  // SEDE4: uma Canopy Bridge de baixo, da avenida de 225 graus sobre o cais do Halo Lake (a pista, o espelho d'água dos dois
  // lados e a mata): o tabuleiro e o arco passam sobre a pista até o Meridian Ring, que fecha o fundo
  canopy: { hora: 16.5, de: emLado(688, 225, 8, 7), alvo: emLado(470, 225, 0, 64), fov: 70, chao: true },
  // SEDE4: a mesma ponte vista de lado e de cima, da mata: o tabuleiro com as duas fileiras de árvores, o vidro, a luz e o arco
  canopyTopo: { hora: 16.5, de: emLado(540, 225, 62, 86), alvo: emLado(600, 225, 0, 66), fov: 56, chao: true },
  // SEDE4: a noite com as quedas acesas, da margem do lago ao lado do bosque de Supertrees (o show de luz) olhando a enseada de
  // 247,5 graus: a cortina de 120 m acesa de baixo, a faixa de LED do Meridian Ring e o lago escuro
  noiteQuedas: { hora: 21, de: em(350, 283, 18), alvo: em(408, 247.5, 62), fov: 62, chao: true },
  // SEDE4: as Dream Falls de 247,5 graus de frente, do cais da praça: a cortina de 120 m, a enseada e a névoa
  quedas: { hora: 16, de: em(160, 247.5, 14), alvo: em(405, 247.5, 62), fov: 52, chao: true },
  // X1b: a obra do par de dentro do parque (ainda por fazer), do alto: o pódio, o lago, as duas torres subindo com a
  // frente de obra de concreto, as gruas e o fantasma acima do corte
  obra: { hora: 16.5, de: em(390, 128, 190), alvo: [CX, 150, CZ], fov: 50 },
  // X1b: as torres prontas às 17h30 com a Dream Bridge a 330 m, do lado do mar e na altura da ponte
  ponte: { hora: 17.5, de: em(760, 95, 300), alvo: [CX, 300, CZ], fov: 40 },
  // X1b: o helicóptero pousando no heliponto da Blade, de perto, do lado da proa (sobre o mar)
  heli: { hora: 17.5, de: em(180, 110, 548), alvo: [CX - 25, 505, CZ - 20], fov: 46 },
  // X1b: o Park of Future Dreams à noite do alto, com o par e o lago prontos e o resto da sede em fantasma
  noiteAerea: { hora: 21, de: [CX - 900, 1100, CZ + 1700], alvo: [CX, 60, CZ - 40], fov: 42 },
});

/**
 * Etapas do M1a para a vitrine de jogo (?etapas=): 'todas' prontas, ou '<id>:<progresso>' com as anteriores prontas e
 * esta em obra. null se o texto não diz nada.
 */
export function etapasDaCena(texto) {
  if (!texto) return null;
  const [id, p] = texto.split(':');
  const k = texto === 'todas' ? ETAPAS_ORDEM.length : ETAPAS_ORDEM.indexOf(id);
  if (k < 0) return null;
  const prog = Math.min(1, Math.max(0, Number(p) || 0));
  return ETAPAS_ORDEM.map((e, i) => {
    const estado = i < k ? ETAPA.PRONTA : i === k ? ETAPA.EM_OBRA : ETAPA.TRANCADA;
    return { id: e, parte: e.split('.')[0], estado, fase: estado === ETAPA.PRONTA ? 3 : Math.min(3, Math.floor(prog * 4)), progresso: estado === ETAPA.PRONTA ? 1 : estado === ETAPA.EM_OBRA ? prog : 0 };
  });
}

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
  const etapasJogo = etapasDaCena(q.get('etapas'));
  const heli = q.has('heli') ? Number(q.get('heli')) || 0 : null;
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
      // no jogo (?etapas=) o parque ainda não existe: a mata dele não é pintada
      const despintar = etapasJogo ? () => {} : pintarMataDaSede(ctx);
      dom?.vitrine(etapasJogo ? { modo: 'jogo', etapas: etapasJogo, vias: true } : { modo: 'plano' });
      const helicoptero = ctx.dominio('helicoptero');
      if (heli !== null) {
        helicoptero?.forcar(true);
        helicoptero?.fixar(heli);
      }

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
        if ((nomeVista === 'aerea' || nomeVista === 'noiteAerea') && tris > TETO_ABERTA_V3) falhas.push(`Arcologia com ${tris} triângulos na vista aberta (teto: ${TETO_ABERTA_V3})`);
        return {
          ok: falhas.length === 0,
          falhas,
          medidas: {
            vista: nomeVista, trisArcologia: tris, lodPartes: dom?.lodPartes, setoresLod0: partes?.setores.filter((x) => x.lod0).length ?? 0,
            lodTorres: dom?.torre?.lod, arvores: partes?.arvores ?? 0, calls: s?.calls ?? 0,
            etapas: etapasJogo ? q.get('etapas') : null, corte: dom?.corte ?? null, trisGruas: Math.round(dom?.obra?.triangulos ?? 0),
            heli: heli !== null ? !!helicoptero?.grupo?.visible : null,
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
          helicoptero?.forcar(null);
          helicoptero?.fixar(null);
          cam.fov = fov0;
          cam.updateProjectionMatrix();
        },
      };
    },
  });
}
