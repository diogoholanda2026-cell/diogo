// Cena 'torre' (X1a e SEDE2, A10): as torres gêmeas (D64) no platô do mapa de Heldópolis (S1a), com o plano padrão
// construído em volta, e a prancha de aceite: 4 azimutes e 2 closes (a fenda com a cachoeira e as duas coroas), de dia
// e de noite. ?cena=torre abre a vista livre a ~1,3 km; ?prancha=1 monta a prancha na própria página (cada vista sai
// de R.foto, com o mesmo quadro do jogo) e a mostra por cima do canvas; ?sim=sintetica põe as torres na cidade
// sintética de 12 mil prédios.
//   window.__cenaTorre.prancha({ hora })  → Promise: monta a prancha na hora pedida. Mudar a hora no meio pede ~30
//   quadros para a luz do ambiente e o cubo do céu assentarem (D9); a captura abre a página já na hora (?hora=21).
// window.__resultado confere o orçamento da D64 e da D66 (triângulos do LOD0 do perfil por torre, LOD1 e sombra).
import { TORRE_LAMINA as TL, PLANOS, PLANO_PADRAO, GLEBA_ENVELOPE, GEMEAS } from '../../data/arcologia-plano.js';
import { cavarPlanoNaCena, descavar } from '../arcologia/lago.js';
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
 * Vistas da prancha, no espaço do par (o meio da fenda; a fenda corre no eixo norte-sul, +z é o sul, o lago e o mar):
 * de onde a câmera olha, para onde e o campo de visão vertical. Os azimutes são contados a partir do sul, no sentido
 * horário visto de cima. Os closes: a fenda com a ponte e a cachoeira vista do lago, e as duas coroas.
 */
const ALTO = TL.altura;
export const VISTAS = Object.freeze([
  { id: 'az20', azimute: 20, dist: 1250, altura: ALTO * 0.5, alvo: [0, ALTO * 0.5, 0], fov: 40 },
  { id: 'az110', azimute: 110, dist: 1250, altura: ALTO * 0.5, alvo: [0, ALTO * 0.5, 0], fov: 40 },
  { id: 'az200', azimute: 200, dist: 1250, altura: ALTO * 0.5, alvo: [0, ALTO * 0.5, 0], fov: 40 },
  { id: 'az290', azimute: 290, dist: 1250, altura: ALTO * 0.5, alvo: [0, ALTO * 0.5, 0], fov: 40 },
  { id: 'fenda', de: [-14, 9, 118], alvo: [0, GEMEAS.ponte.cota * 0.62, 0], fov: 58 },
  { id: 'coroas', de: [-90, ALTO - 10, 150], alvo: [0, ALTO - 50, 0], fov: 52 },
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
    camera: { x: P.x, z: P.z, dist: 1300, guinada: 20, inclinacao: 9 },
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
        R.camera.definir({ x: tt.x, z: tt.z, dist: 900, guinada: 200, inclinacao: 20 });
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

      /** Uma vista só da prancha (para conferir sem montar as seis): devolve o JPEG como data URL. */
      async function foto({ id = 'az20', hora = 17.5, w = 640, h = 1080 } = {}) {
        const R = window.__held?.R;
        if (!R) throw new Error('foto: o render ainda não está pronto');
        await assentarHora(R, ctx, hora);
        vista = VISTAS.find((v) => v.id === id) ?? VISTAS[0];
        R.foto({ w, h });
        const blob = await R.foto({ w, h });
        vista = null;
        return await new Promise((ok) => {
          const leitor = new FileReader();
          leitor.onload = () => ok(leitor.result);
          leitor.readAsDataURL(blob);
        });
      }

      let img = null;
      function mostrar(folha) {
        img ??= Object.assign(document.createElement('img'), { alt: '' });
        Object.assign(img.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'contain', background: '#0b0d10', zIndex: '50' });
        img.src = folha.toDataURL('image/png');
        if (!img.isConnected) document.body.appendChild(img);
      }

      if (typeof window !== 'undefined') {
        window.__cenaTorre = { vistas: VISTAS, prancha, foto };
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
        // as gêmeas somam as duas torres: cada uma dentro da faixa (D66: até 70 mil cada no Alta)
        const n = dom?.torre?.gemeas ? 2 : 1;
        if (!tri) falhas.push('as torres não foram montadas');
        else {
          if (perfil !== 'leve' && (tri.lod0 < n * faixa[0] || tri.lod0 > n * faixa[1])) falhas.push(`LOD0 com ${tri.lod0} triângulos em ${n} torre(s) no perfil ${perfil} (D66: ${faixa[0]} a ${faixa[1]} cada)`);
          if (tri.lod1 < n * TL.triangulos.lod1[0] || tri.lod1 > n * TL.triangulos.lod1[1]) falhas.push(`LOD1 com ${tri.lod1} triângulos em ${n} torre(s) (${TL.triangulos.lod1.join(' a ')} cada)`);
        }
        return { ok: falhas.length === 0, falhas, medidas: { perfil, triangulos: tri ?? null, lod: dom?.torre?.lod ?? null, familias: ctx.stats?.familias ?? null } };
      }

      return {
        quadro() {
          aplicarVista();
          if (vista) dom?.atualizarLods?.();
        },
        resultado,
        descartar() {
          img?.remove();
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

