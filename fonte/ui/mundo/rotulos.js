// Rótulos do mundo (desenho da UI 8.10; D28; X3a), sem Preact: os candidatos (áreas de longe, avenidas de perto,
// marcos da sede e prédios da Holding), a colisão entre eles e com o HUD, e o desenho no DOM por transform (até 40). As
// posições de tela vêm de R.ancoras() a cada quadro. Os nomes da sede ficam em inglês (D88, D89), lidos de
// data/arcologia-plano.js: Park of Future Dreams, Blade Tower, Legacy Tower, Mirror Lake, Meridian Ring, Horizon Ring
// I a VIII, Codex Tower, Helix Labs e Compass Tower.
import { PLANOS, PLANO_ESCOLHIDO, PARTES_NOMES, TRECHOS_HORIZON, HORIZON, MERIDIAN, LAGO, GLEBA_ENVELOPE, torresDoPar, pontoDoArco } from '../../data/arcologia-plano.js';
import { alturaEm } from '../../comum/altura.js';
import { ponto as pontoBz } from '../../comum/bezier.js';
import { TIPO_PREDIO } from '../../contratos/flags.js';
import { refDe } from '../../contratos/espelho.js';
import { VIAS_ORDEM } from '../../data/vias.js';

/** Números dos rótulos. Distâncias da câmera ao alvo (m): quando cada tipo aparece. */
export const ROTULOS = Object.freeze({
  max: 40,
  areaDe: 650, // áreas: de longe
  marcoAte: 3200,
  trechoAte: 1500, // os 8 trechos do Horizon Ring só de perto (de longe, o anel inteiro)
  avenidaAte: 900,
  avenidaRaio: 700, // m em volta do alvo da câmera
  maxAvenidas: 8,
  holdingAte: 1600,
  folga: 6, // px entre rótulos
  alturaPx: 18,
  refazerMs: 500,
});

/** Prioridade por tipo (o de maior prioridade fica quando dois se cruzam). */
export const PRIORIDADE_ROTULO = Object.freeze({ marco: 4, holding: 3.5, area: 3, avenida: 2 });

/** Centroide de um polígono [x, z, x, z, ...] (pela área; sem área, a média dos vértices). */
export function centroide(c) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  const n = c.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x0 = c[2 * i];
    const z0 = c[2 * i + 1];
    const x1 = c[2 * j];
    const z1 = c[2 * j + 1];
    const k = x0 * z1 - x1 * z0;
    a += k;
    cx += (x0 + x1) * k;
    cz += (z0 + z1) * k;
  }
  if (Math.abs(a) < 1e-6) {
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < n; i++) {
      sx += c[2 * i];
      sz += c[2 * i + 1];
    }
    return [sx / n, sz / n];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

/**
 * Marcos da sede v3 (puro): [{ id, texto, p: [x, y, z], tipo: 'marco', ate }] com os nomes em inglês. O par de torres
 * vira dois rótulos (Blade Tower e Legacy Tower, pelos nomes de cada torre), o Horizon Ring um por trecho (de perto) e
 * um para o anel inteiro (de longe).
 */
export function marcosDaSede(planoId = PLANO_ESCOLHIDO) {
  const plano = PLANOS[planoId] ?? PLANOS[PLANO_ESCOLHIDO];
  if (!plano) return [];
  const [cx, cz] = plano.centro;
  const cota = GLEBA_ENVELOPE.cota;
  const out = [];
  const marco = (id, texto, x, y, z, ate = ROTULOS.marcoAte, de = 0) => out.push({ id: `marco.${id}`, texto, p: [x, y, z], tipo: 'marco', ate, de });
  for (const t of torresDoPar(plano.torre)) marco(t.spec.nome.split(' ')[0].toLowerCase(), t.spec.nome, t.x, cota + 0.5 * t.spec.altura, t.z);
  const [lx, lz] = pontoDoArco(cx, cz, (LAGO.r0 + LAGO.r1) / 2, 120);
  marco('lago', PARTES_NOMES.lago, lx, cota + 2, lz, 1600);
  const [mx, mz] = pontoDoArco(cx, cz, MERIDIAN.raio, 292.5);
  marco('meridian', PARTES_NOMES.meridian, mx, cota + MERIDIAN.altura + 6, mz);
  const [hx, hz] = pontoDoArco(cx, cz, HORIZON.raio, 247.5);
  marco('horizon', PARTES_NOMES.horizon, hx, cota + HORIZON.altura + 6, hz, ROTULOS.marcoAte, ROTULOS.trechoAte);
  for (const tr of TRECHOS_HORIZON) {
    const [x, z] = pontoDoArco(cx, cz, HORIZON.raio, (tr.de + tr.ate) / 2);
    marco(tr.id, tr.nome, x, cota + HORIZON.altura + 6, z, ROTULOS.trechoAte);
  }
  for (const id of ['codex', 'helix', 'compass']) {
    const parte = plano.partes.find((p) => p.id === id);
    const pc = parte?.pecas?.[0];
    if (pc) marco(id, PARTES_NOMES[id], pc.x, cota + 0.6 * (pc.altura ?? 150), pc.z);
  }
  // o parque, no bosque grande a sudeste do pódio
  const [px, pz] = pontoDoArco(cx, cz, 290, 20);
  marco('parque', PARTES_NOMES.parque, px, cota + 4, pz, ROTULOS.areaDe);
  return out;
}

/**
 * Áreas nomeadas (espelho.areas) no centroide; a gleba leva o nome da sede (Park of Future Dreams).
 * @returns {{ id, texto, p, tipo: 'area', de }[]}
 */
export function areasDoEspelho(esp, planoId = PLANO_ESCOLHIDO) {
  const T = esp?.terreno;
  return (esp?.areas ?? []).map((a) => {
    const [x, z] = centroide(a.contorno);
    const y = (T?.altura ? alturaEm(T, x, z) : 0) + 30;
    const texto = a.id === 'gleba' ? (PLANOS[planoId] ?? PLANOS[PLANO_ESCOLHIDO])?.nome ?? a.nome : a.nome;
    return { id: `area.${a.id}`, texto, p: [x, y, z], tipo: 'area', de: ROTULOS.areaDe };
  });
}

/** Tipos de via que levam rótulo (as avenidas e acima). */
const TIPOS_AVENIDA = new Set(VIAS_ORDEM.map((t, k) => (/avenida|expressa|rodovia/i.test(t) ? k : -1)).filter((k) => k >= 0));

/**
 * Avenidas perto do alvo: uma por nome, o trecho mais perto, no meio da curva. nomeDe(ref) dá o nome (q.aresta).
 */
export function avenidasPerto(esp, alvo, nomeDe, { raio = ROTULOS.avenidaRaio, max = ROTULOS.maxAvenidas } = {}) {
  const A = esp?.vias?.arestas;
  if (!A?.n) return [];
  const T = esp.terreno;
  const porNome = new Map();
  const m = [0, 0];
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e] || !TIPOS_AVENIDA.has(A.tipo[e])) continue;
    pontoBz(A.p, 0.5, m, 8 * e);
    const d = Math.hypot(m[0] - alvo[0], m[1] - alvo[1]);
    if (d > raio) continue;
    const nome = nomeDe(refDe(e, A.ger?.[e] ?? 0));
    if (!nome) continue;
    const ant = porNome.get(nome);
    if (ant && ant.d <= d) continue;
    const y = (T?.altura ? alturaEm(T, m[0], m[1]) : A.y?.[2 * e] ?? 0) + 2;
    porNome.set(nome, { id: `avenida.${nome}`, texto: nome, p: [m[0], y, m[1]], tipo: 'avenida', d, ate: ROTULOS.avenidaAte });
  }
  return [...porNome.values()].sort((a, b) => a.d - b.d).slice(0, max);
}

/** Prédios da Holding (nome pelo q.predio, guardado por quem chama). */
export function predioDaHolding(esp, nomeDe) {
  const P = esp?.predios;
  if (!P?.n) return [];
  const out = [];
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.HOLDING) continue;
    const ref = refDe(i, P.ger?.[i] ?? 0);
    const nome = nomeDe(ref);
    if (nome) out.push({ id: `holding.${ref}`, texto: nome, p: [P.x[i], P.y[i] + 24, P.z[i]], tipo: 'holding', ate: ROTULOS.holdingAte });
  }
  return out;
}

/** O rótulo vale nesta distância da câmera ao alvo? (de: a partir de; ate: até) */
export const valeNaDistancia = (r, dist) => dist >= (r.de ?? 0) && dist <= (r.ate ?? Infinity);

/**
 * Coloca os rótulos (puro): candidatos com { x, y (tela), w, h, prioridade, dist } visíveis; evita os retângulos do
 * HUD, os já colocados (o de maior prioridade e, no empate, o mais perto, fica) e, com `tela` { w, h }, o que sairia
 * pela borda. Devolve os índices colocados.
 */
export function colocar(cands, { hud = [], folga = ROTULOS.folga, max = ROTULOS.max, tela = null } = {}) {
  const ordem = cands.map((_, k) => k).sort((a, b) => cands[b].prioridade - cands[a].prioridade || cands[a].dist - cands[b].dist);
  const postos = [];
  const cruza = (a, b) => a.x0 < b.x1 + folga && b.x0 < a.x1 + folga && a.y0 < b.y1 + folga && b.y0 < a.y1 + folga;
  for (const k of ordem) {
    if (postos.length >= max) break;
    const c = cands[k];
    const r = { x0: c.x - c.w / 2, x1: c.x + c.w / 2, y0: c.y - c.h / 2, y1: c.y + c.h / 2, k };
    // inteiro dentro da tela (o centro dentro não basta: o texto sairia pela borda)
    if (tela && (r.x0 < 0 || r.y0 < 0 || r.x1 > tela.w || r.y1 > tela.h)) continue;
    if (hud.some((h) => cruza(r, h))) continue;
    if (postos.some((p) => cruza(r, p))) continue;
    postos.push(r);
  }
  return postos.map((p) => p.k);
}

// ------------------------------------------------------------------------------------------------ desenho (navegador)

const POOL = ROTULOS.max;
const FONTES = { area: '600 12px Inter, system-ui, sans-serif', marco: '600 13px Inter, system-ui, sans-serif', avenida: '600 12px Inter, system-ui, sans-serif', holding: '600 13px Inter, system-ui, sans-serif' };
const SELETOR_HUD = '#ui [data-hud], #ui .lugar-cima > *, #ui .lugar-baixo > *, #ui .lugar-direita > *, #ui .lugar-centro > *, #ui .lugar-folha > *, #ui .x3-pop';

/** O rotulador de uma raiz: candidatos a cada meio segundo, posições e colisão a cada quadro. */
export function criarRotulador(ui, raiz) {
  const spans = [];
  for (let k = 0; k < POOL; k++) {
    const s = document.createElement('span');
    s.className = 'x3-rot';
    raiz.appendChild(s);
    spans.push({ el: s, texto: '', tipo: '', on: false });
  }
  const medir = document.createElement('canvas').getContext('2d');
  const larguras = new Map();
  const largura = (texto, tipo) => {
    const k = `${tipo}|${texto}`;
    let w = larguras.get(k);
    if (w === undefined) {
      medir.font = FONTES[tipo] ?? FONTES.marco;
      const t = tipo === 'area' ? texto.toUpperCase() : texto;
      w = Math.ceil(medir.measureText(t).width + (tipo === 'area' ? 12 * 0.14 * t.length : 0)) + 14;
      larguras.set(k, w);
    }
    return w;
  };
  const nomes = new Map(); // ref → { nome, t }
  const nomeDe = (consulta) => (ref) => {
    const agora = performance.now();
    const c = nomes.get(`${consulta}:${ref}`);
    if (c && agora - c.t < 10000) return c.nome;
    // refs de vias e prédios que já sumiram não ficam guardadas para sempre numa partida longa
    if (!c && nomes.size > 4096) nomes.clear();
    const nome = ui.consultar(consulta, ref)?.nome ?? null;
    nomes.set(`${consulta}:${ref}`, { nome, t: agora });
    return nome;
  };
  let cands = [];
  let hud = [];
  let tCands = -Infinity;
  let tHud = -Infinity;
  let espAnt = null;
  let fixos = [];

  function refazerCandidatos(tMs) {
    const sim = ui.obterSim();
    const esp = sim?.espelho;
    const cam = ui.R?.camera?.estado?.();
    if (!esp || !cam) {
      cands = [];
      return;
    }
    if (esp !== espAnt) {
      espAnt = esp;
      const plano = esp.arcologia?.plano ?? undefined;
      fixos = [...areasDoEspelho(esp, plano), ...marcosDaSede(plano)];
    }
    const lista = fixos.filter((r) => valeNaDistancia(r, cam.dist));
    if (cam.dist <= ROTULOS.avenidaAte) lista.push(...avenidasPerto(esp, [cam.x, cam.z], nomeDe('aresta')));
    if (cam.dist <= ROTULOS.holdingAte) lista.push(...predioDaHolding(esp, nomeDe('predio')));
    cands = lista.map((r) => ({ ...r, w: largura(r.texto, r.tipo), h: ROTULOS.alturaPx, prioridade: PRIORIDADE_ROTULO[r.tipo] ?? 1 }));
    tCands = tMs;
  }

  function apagar() {
    for (const s of spans) {
      if (!s.on) continue;
      s.on = false;
      s.el.style.display = 'none';
    }
  }

  return {
    quadro(tMs) {
      const R = ui.R;
      if (!R?.ancoras || ui.loja.tela.value) {
        apagar();
        return;
      }
      if (tMs - tCands >= ROTULOS.refazerMs) refazerCandidatos(tMs);
      if (tMs - tHud >= 500) {
        hud = [...document.querySelectorAll(SELETOR_HUD)].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height).map((r) => ({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }));
        tHud = tMs;
      }
      const tela = R.ancoras(cands.map((c) => c.p));
      const vis = [];
      tela.forEach((s, k) => {
        if (s?.visivel) vis.push({ ...cands[k], x: s.x, y: s.y, dist: s.dist });
      });
      const postos = colocar(vis, { hud, max: POOL, tela: { w: raiz.clientWidth || innerWidth, h: raiz.clientHeight || innerHeight } });
      for (let k = 0; k < POOL; k++) {
        const s = spans[k];
        const c = k < postos.length ? vis[postos[k]] : null;
        if (!c) {
          if (s.on) {
            s.on = false;
            s.el.style.display = 'none';
          }
          continue;
        }
        if (s.texto !== c.texto) {
          s.texto = c.texto;
          s.el.textContent = c.texto;
        }
        if (s.tipo !== c.tipo) {
          s.tipo = c.tipo;
          s.el.className = `x3-rot ${c.tipo}`;
        }
        if (!s.on) {
          s.on = true;
          s.el.style.display = 'block';
        }
        s.el.style.transform = `translate3d(${Math.round(c.x - c.w / 2)}px, ${Math.round(c.y - c.h / 2)}px, 0)`;
      }
    },
    descartar() {
      for (const s of spans) s.el.remove();
    },
  };
}
