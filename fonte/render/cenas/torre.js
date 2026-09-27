// Cena 'torre' (X1a, A10): a Torre Lâmina no platô do mapa de Heldópolis (S1a), com o plano padrão construído em
// volta, e a prancha de aceite: 4 azimutes e 2 closes (pódio e coroa, a 30 m), de dia e de noite. ?cena=torre abre a
// vista livre a ~1 km; ?prancha=1 monta a prancha na própria página (cada vista sai de R.foto, com o mesmo quadro do
// jogo) e a mostra por cima do canvas; ?sim=sintetica põe a Torre na cidade sintética de 12 mil prédios.
//   window.__cenaTorre.prancha({ hora })  → Promise: monta a prancha na hora pedida. Mudar a hora no meio pede ~30
//   quadros para a luz do ambiente e o cubo do céu assentarem (D9); a captura abre a página já na hora (?hora=21).
// window.__resultado confere o orçamento da D27 (triângulos do LOD0 do perfil, LOD1 e sombra) e as cotas.
import { TORRE_LAMINA as TL, PLANOS, PLANO_PADRAO, GLEBA_ENVELOPE } from '../../data/arcologia-plano.js';
import { cavarPlanoNaCena, descavar } from '../arcologia/lago.js';
import { CeuReserva, estadoDoCeu, PONTOS_TORRE } from '../arcologia/torre.js';
import { ARESTA } from '../../contratos/flags.js';

const P = PLANOS[PLANO_PADRAO].torre;
const consulta = () => (typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams());

/** Simulação das cenas da Arcologia: o mapa de verdade (S1a) ou, com ?sim=sintetica, a cidade sintética. */
export function simDaCena() {
  const s = consulta().get('sim');
  return s === 'sintetica' || s === 'vazia' ? s : 'partida';
}

/**
 * Força a hora do céu e, se ela mudou, desenha quadros pequenos até a luz do ambiente (quadros-chave em fatias) e o
 * cubo do céu (uma face por quadro, em duplo buffer) assentarem na hora nova (D9).
 */
export async function assentarHora(R, ctx, hora, quadros = 30) {
  const antes = ctx.horaDoCeu();
  R.tempo.forcar({ hora });
  const dh = Math.abs(((((hora - antes + 12) % 24) + 24) % 24) - 12);
  if (dh < 0.25) return 0; // a mesma hora
  for (let i = 0; i < quadros; i++) await R.foto({ w: 8, h: 8 });
  return quadros;
}

/**
 * Vistas da prancha, no espaço local da Torre (frente das penas para +z): de onde a câmera olha, para onde e o campo
 * de visão vertical. Os azimutes são contados a partir da frente, no sentido horário visto de cima.
 */
export const VISTAS = Object.freeze([
  { id: 'az35', azimute: 35, dist: 860, altura: 176, alvo: [0, 172, 0], fov: 40 },
  { id: 'az125', azimute: 125, dist: 860, altura: 176, alvo: [0, 172, 0], fov: 40 },
  { id: 'az215', azimute: 215, dist: 860, altura: 176, alvo: [0, 172, 0], fov: 40 },
  { id: 'az305', azimute: 305, dist: 860, altura: 176, alvo: [0, 172, 0], fov: 40 },
  { id: 'podio', de: [-16, 7, PONTOS_TORRE.podio.z0 - TL.podio.marquise - 30], alvo: [0, 15, PONTOS_TORRE.podio.z0 - 2], fov: 64 },
  { id: 'coroa', de: [50, 306, 16], alvo: [0, 322, -8], fov: 62 },
]);

/** Arranjo da prancha (1920 x 1080): 4 retratos de azimute e os 2 closes empilhados à direita. */
export const QUADROS = Object.freeze([
  { x: 0, y: 0, w: 328, h: 1080 },
  { x: 332, y: 0, w: 328, h: 1080 },
  { x: 664, y: 0, w: 328, h: 1080 },
  { x: 996, y: 0, w: 328, h: 1080 },
  { x: 1328, y: 0, w: 592, h: 538 },
  { x: 1328, y: 542, w: 592, h: 538 },
]);

/** Posição e alvo de uma vista no mundo, com a Torre em { x, y, z, rot }. */
export function vistaNoMundo(v, t) {
  const loc = (p) => {
    const c = Math.cos(t.rot);
    const s = Math.sin(t.rot);
    return [t.x + c * p[0] + s * p[2], t.y + p[1], t.z - s * p[0] + c * p[2]];
  };
  let de;
  if (v.azimute !== undefined) {
    const a = (v.azimute * Math.PI) / 180;
    de = loc([Math.sin(a) * v.dist, v.altura, Math.cos(a) * v.dist]);
  } else de = loc(v.de);
  return { de, alvo: loc(v.alvo), fov: v.fov };
}

/**
 * Tira as vias internas provisórias da cidade sintética (o anel em volta da Torre, marcado ARCOLOGIA): nas cenas da
 * Arcologia quem desenha o entorno da Torre é o plano. Só mexe na simulação desta cena.
 */
export function tirarAnelSintetico(ctx) {
  const A = ctx.sim?.espelho?.vias?.arestas;
  if (!A) return 0;
  let n = 0;
  for (let e = 0; e < A.n; e++) {
    if (A.viva[e] && A.flags[e] & ARESTA.ARCOLOGIA) {
      A.viva[e] = 0;
      n++;
    }
  }
  if (n) ctx.sim.mudancas.tudo('arestas');
  return n;
}

export function registrar(registrarCena) {
  registrarCena('torre', {
    sim: simDaCena(),
    hora: 17.5,
    camera: { x: P.x, z: P.z, dist: 1150, guinada: 20, inclinacao: 9 },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      tirarAnelSintetico(ctx);
      const dom = ctx.dominio('arcologia');
      // a Torre no plano padrão construído (o entorno de verdade); ?contexto=0 mostra só a Torre com a esplanada
      const contexto = qs.get('contexto') !== '0';
      const cava = { guarda: new Map(), ret: null };
      if (contexto) {
        cavarPlanoNaCena(ctx, PLANOS[PLANO_PADRAO], GLEBA_ENVELOPE.cota, cava);
        dom?.vitrine({ modo: 'plano', plano: PLANO_PADRAO });
      } else dom?.vitrine({ modo: 'torre', plano: PLANO_PADRAO });
      const ceu = new CeuReserva(ctx);
      const estado = {};
      const cam = ctx.camera;
      const fov0 = cam.fov;
      let vista = null; // vista forçada (prancha)

      const t = () => {
        const g = dom?.torre?.grupo;
        return g ? { x: g.position.x, y: g.position.y, z: g.position.z, rot: g.rotation.y } : { x: P.x, y: 0, z: P.z, rot: P.rot };
      };

      function aplicarVista() {
        if (!vista) {
          if (cam.fov !== fov0) {
            cam.fov = fov0;
            cam.updateProjectionMatrix();
          }
          return;
        }
        const { de, alvo, fov } = vistaNoMundo(vista, t());
        cam.position.set(de[0], de[1], de[2]);
        cam.up.set(0, 1, 0);
        cam.lookAt(alvo[0], alvo[1], alvo[2]);
        cam.fov = fov;
        const dist = Math.hypot(de[0] - alvo[0], de[1] - alvo[1], de[2] - alvo[2]);
        cam.near = Math.max(0.5, Math.min(20, dist * 0.02));
        cam.far = 40000;
        cam.updateProjectionMatrix();
        cam.updateMatrixWorld();
      }

      /** Monta a prancha na hora pedida e a põe por cima do canvas. Devolve o canvas da prancha. */
      async function prancha({ hora = 17.5 } = {}) {
        const R = window.__held?.R;
        if (!R) throw new Error('prancha: o render ainda não está pronto');
        await assentarHora(R, ctx, hora);
        const tt = t();
        R.camera.definir({ x: tt.x, z: tt.z, dist: 700, guinada: 200, inclinacao: 20 });
        const folha = document.createElement('canvas');
        folha.width = 1920;
        folha.height = 1080;
        const g = folha.getContext('2d');
        g.fillStyle = '#0b0d10';
        g.fillRect(0, 0, folha.width, folha.height);
        for (let i = 0; i < VISTAS.length; i++) {
          vista = VISTAS[i];
          const q = QUADROS[i];
          R.foto({ w: q.w, h: q.h }); // um quadro para o céu, a sombra e o reflexo assentarem na vista nova
          const blob = await R.foto({ w: q.w, h: q.h });
          const img = await createImageBitmap(blob);
          g.drawImage(img, q.x, q.y, q.w, q.h);
        }
        vista = null;
        mostrar(folha);
        window.__prancha = { pronta: true, hora };
        return folha;
      }

      let img = null;
      function mostrar(folha) {
        img ??= Object.assign(document.createElement('img'), { alt: '' });
        Object.assign(img.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'contain', background: '#0b0d10', zIndex: '50' });
        img.src = folha.toDataURL('image/png');
        if (!img.isConnected) document.body.appendChild(img);
      }

      if (typeof window !== 'undefined') {
        window.__cenaTorre = { vistas: VISTAS, prancha };
        if (qs.get('prancha') === '1') {
          const esperar = () => (window.__pronto ? prancha({ hora: Number(qs.get('hora')) || 17.5 }) : setTimeout(esperar, 200));
          setTimeout(esperar, 200);
        }
      }

      function resultado() {
        const tri = dom?.torre?.triangulos;
        const falhas = [];
        const perfil = ctx.perfil?.id ?? 'media';
        const faixa = TL.triangulos.lod0[perfil] ?? TL.triangulos.lod0.media;
        if (!tri) falhas.push('a Torre não foi montada');
        else {
          if (perfil !== 'leve' && (tri.lod0 < faixa[0] || tri.lod0 > faixa[1])) falhas.push(`LOD0 com ${tri.lod0} triângulos no perfil ${perfil} (D27: ${faixa[0]} a ${faixa[1]})`);
          if (tri.lod1 < TL.triangulos.lod1[0] || tri.lod1 > TL.triangulos.lod1[1]) falhas.push(`LOD1 com ${tri.lod1} triângulos (D27: ${TL.triangulos.lod1.join(' a ')})`);
        }
        return { ok: falhas.length === 0, falhas, medidas: { perfil, triangulos: tri ?? null, lod: dom?.torre?.lod ?? null } };
      }

      return {
        quadro(tMs, c) {
          estadoDoCeu(c, estado);
          ceu.quadro(estado);
          aplicarVista();
        },
        resultado,
        descartar() {
          ceu.descartar();
          img?.remove();
          const T = ctx.sim?.espelho?.terreno;
          if (T && cava.guarda.size) descavar(T, cava.guarda);
          dom?.vitrine(null);
          cam.fov = fov0;
          cam.updateProjectionMatrix();
        },
      };
    },
  });
}

