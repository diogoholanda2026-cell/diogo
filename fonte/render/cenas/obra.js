// Cena 'obra' (desenho do render 15.2, R4b): obras da cidade sintética em fases diferentes, com o tempo parado (?anda=1
// faz andar em 4x): canteiro, fundação, estrutura e fechamento num prédio alto (grua de torre, esqueleto e tela), as
// mesmas fases em prédios baixos (grua móvel e andaime) e a reforma de subir de nível. ?vista= troca a câmera: padrao
// (as obras a ~280 m), alto (o prédio alto em obra de perto), baixo (o andaime de uma casa) e lote (um lote pronto de
// perto: piso, muro, árvores e carros); ?hora= a hora do céu. O resultado traz as fases escolhidas e as peças.
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';
import { progressoObra, faseObra } from '../../contratos/espelho.js';

/** Centro da busca (o bairro de torres da cidade sintética) e o tique parado da cena. */
export const OBRA = Object.freeze({ x: 330, z: -880, raio: 420, tique: 6000, duracao: 600, guinada: 75 });

/** Fases da cena: o progresso de cada obra (a reforma de nível à parte). */
export const FASES_CENA = Object.freeze([
  { id: 'canteiro', p: 0.05 },
  { id: 'fundacao', p: 0.19 },
  { id: 'estrutura', p: 0.45 },
  { id: 'fechamento', p: 0.78 },
]);

/**
 * Escolhe as obras da cena no espelho: o prédio mais alto perto do centro em estrutura e fechamento (dois, se houver),
 * e baixos em cada fase, mais uma reforma de nível. Devolve [{ i, p, nivel, H }]. alturaDe(i): altura do plano (m).
 */
export function escolherObras(P, alturaDe, { x, z, raio } = OBRA) {
  const perto = [];
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || P.flags[i] & PREDIO.ABANDONADO) continue;
    const d = Math.hypot(P.x[i] - x, P.z[i] - z);
    if (d < raio) perto.push({ i, d, H: alturaDe(i) });
  }
  perto.sort((a, b) => a.d - b.d);
  // altos da cidade vertical do M1a (D76: 12 a 25 andares), os mais à vista primeiro (menos vizinhos altos em 90 m)
  const vizAltos = (c) => perto.reduce((a, o) => a + (o !== c && o.H > 0.45 * c.H && Math.hypot(P.x[o.i] - P.x[c.i], P.z[o.i] - P.z[c.i]) < 90 ? o.H : 0), 0);
  const altos = perto.filter((c) => c.H >= 30 && c.H <= 95).map((c) => ({ ...c, v: vizAltos(c) })).sort((a, b) => a.v - b.v || b.H - a.H);
  // as baixas e as casas perto da alta (a vista de cima pega todas juntas)
  const a0 = altos[0];
  const daAlta = (c) => (a0 ? Math.hypot(P.x[c.i] - P.x[a0.i], P.z[c.i] - P.z[a0.i]) : c.d);
  const baixos = perto.filter((c) => c.H > 6 && c.H <= 14).sort((a, b) => daAlta(a) - daAlta(b));
  const casas = perto.filter((c) => c.H <= 6).sort((a, b) => daAlta(a) - daAlta(b));
  const out = [];
  const usar = (c, p, nivel = false) => c && !out.some((o) => o.i === c.i) && out.push({ i: c.i, p, nivel, H: c.H });
  usar(altos[0], 0.76);
  usar(altos.slice(1).sort((a, b) => daAlta(a) - daAlta(b))[0], 0.45);
  FASES_CENA.forEach((f, k) => usar(baixos[k], f.p));
  usar(casas[0], 0.45);
  usar(casas[1], 0.8);
  usar(baixos[FASES_CENA.length] ?? altos[2], 0.5, true);
  return out;
}

/**
 * Guinada (graus) de onde a câmera vê o prédio i sem um vizinho alto na frente: a câmera fica no rumo (-sen g, cos g)
 * a dh m do prédio; conta os vizinhos com mais de 40% da altura dele nesse rumo (25 graus) e mais perto que a câmera.
 */
export function guinadaAberta(P, alturaDe, i, dh, preferida = 0) {
  const H = alturaDe(i);
  const viz = [];
  for (let k = 0; k < P.n; k++) {
    if (k === i || !P.viva[k]) continue;
    const dx = P.x[k] - P.x[i];
    const dz = P.z[k] - P.z[i];
    const d = Math.hypot(dx, dz);
    if (d < 20 || d > dh) continue;
    const h = alturaDe(k);
    if (h > 0.4 * H) viz.push([Math.atan2(dx, dz), d, h]);
  }
  let melhor = preferida;
  let menor = Infinity;
  for (let k = 0; k < 24; k++) {
    const g = preferida + k * 15;
    const r = (g * Math.PI) / 180;
    const rumo = Math.atan2(-Math.sin(r), Math.cos(r));
    let n = 0;
    for (const [a, , h] of viz) {
      const da = Math.abs(((a - rumo + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (da < 0.44) n += h;
    }
    if (n < menor) {
      menor = n;
      melhor = g;
    }
  }
  return melhor;
}

export function registrar(registrarCena) {
  registrarCena('obra', {
    sim: 'sintetica',
    hora: 10,
    camera: { x: OBRA.x, z: OBRA.z, guinada: OBRA.guinada, dist: 300, inclinacao: 34 },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const vista = qs.get('vista') ?? 'padrao';
      const anda = qs.get('anda') === '1';
      const esp = ctx.sim.espelho;
      const P = esp.predios;
      const pred = ctx.dominio('predios');
      const falhas = [];
      if (!pred?.planoObra) falhas.push('o domínio predios é o substituto da F0');
      const alturaDe = (i) => pred?.planoObra?.(i)?.alturaTopo ?? 0;
      const obras = P ? escolherObras(P, alturaDe) : [];
      if (obras.length < 5) falhas.push(`só ${obras.length} obras perto do centro`);
      // o tempo da cena e as obras no espelho (as bandeiras e o início e o fim; o diário leva ao render); as obras que
      // a cidade sintética já tinha saem (a cena mostra só as dela)
      const T = OBRA.tique;
      esp.tempo.tique = T;
      esp.tempo.frac = 0;
      for (let i = 0; P && i < P.n; i++) {
        if (!(P.flags[i] & PREDIO.OBRA)) continue;
        P.flags[i] &= ~(PREDIO.OBRA | PREDIO.OBRA_NIVEL);
        ctx.sim.mudancas.marcarIdx?.('predios', i);
      }
      for (const o of obras) {
        P.flags[o.i] = (P.flags[o.i] | PREDIO.OBRA | (o.nivel ? PREDIO.OBRA_NIVEL : 0)) & ~PREDIO.ABANDONADO;
        P.obraIni[o.i] = Math.round(T - o.p * OBRA.duracao);
        P.obraFim[o.i] = P.obraIni[o.i] + OBRA.duracao;
        ctx.sim.mudancas.marcarIdx?.('predios', o.i);
      }
      // câmera: as obras do centro, o alto de perto, o andaime da casa, um lote pronto
      const alvo = (o) => (o ? { x: P.x[o.i], z: P.z[o.i] } : { x: OBRA.x, z: OBRA.z });
      const alto = obras.find((o) => o.H >= 30);
      const casa = obras.find((o) => o.H <= 6);
      // o meio da caixa das obras escolhidas, a uma distância que pega todas
      const xs = obras.map((o) => P.x[o.i]);
      const zs = obras.map((o) => P.z[o.i]);
      const cx = obras.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : OBRA.x;
      const cz = obras.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : OBRA.z;
      const ext = obras.length ? Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) : 0;
      let cam = { x: cx, z: cz, guinada: OBRA.guinada, dist: Math.min(420, Math.max(280, 1.4 * ext)), inclinacao: 38 };
      if (vista === 'alto' && alto) {
        // de baixo, a ~3,4 alturas: o pé no meio da tela e o topo da grua (7 m acima do esqueleto) dentro do quadro
        const dist = Math.max(150, alto.H * 3.4);
        cam = { ...alvo(alto), guinada: guinadaAberta(P, alturaDe, alto.i, dist * Math.cos(0.1), OBRA.guinada), dist, inclinacao: 6 };
      }
      if (vista === 'baixo' && casa) cam = { ...alvo(casa), guinada: OBRA.guinada, dist: 32, inclinacao: 24 };
      let lote = null;
      if (vista === 'lote' && P) {
        // um lote pronto com árvore e carro perto do centro
        for (let i = 0; i < P.n && !lote; i++) {
          if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA || P.flags[i] & (PREDIO.OBRA | PREDIO.ABANDONADO)) continue;
          if (Math.hypot(P.x[i] - OBRA.x, P.z[i] - OBRA.z) > 900) continue;
          const pl = pred.planoObra(i);
          if (pl?.lote?.carros.length >= 2 && pl.lote.arvores.length >= 1 && pl.alturaTopo < 30) lote = i;
        }
        if (lote !== null) {
          // da rua, de frente para o lote (a frente olha para +z do lote) e um pouco de lado
          const fx = Math.sin(P.rot[lote]);
          const fz = Math.cos(P.rot[lote]);
          cam = { x: P.x[lote] + fx * 3, z: P.z[lote] + fz * 3, guinada: (-P.rot[lote] * 180) / Math.PI + 22, dist: 36, inclinacao: 24 };
        }
      }
      ctx.cameraApi.definir(cam);
      let medidas = null;
      try {
        medidas = await pred?.preparar?.({ teto: 180000 });
      } catch (e) {
        falhas.push(`preparar falhou: ${e?.message ?? e}`);
      }
      ctx.dominio('obras')?.refazer?.();
      let tAnt = null;
      return {
        quadro(tMs) {
          if (!anda) return;
          if (tAnt !== null) {
            const t = esp.tempo.tique + esp.tempo.frac + (4 * Math.min(200, tMs - tAnt)) / 1000;
            esp.tempo.tique = Math.floor(t);
            esp.tempo.frac = t - esp.tempo.tique;
          }
          tAnt = tMs;
        },
        resultado() {
          const ob = ctx.dominio('obras');
          const m = ob?.medidas?.() ?? null;
          const f = [...falhas];
          if (!m?.caixas) f.push('nenhuma peça de obra');
          const tq = esp.tempo.tique + esp.tempo.frac;
          return {
            ok: f.length === 0,
            falhas: f,
            vista,
            obras: obras.map((o) => {
              const p = progressoObra(tq, 0, P.obraIni[o.i], P.obraFim[o.i]);
              return { i: o.i, H: +o.H.toFixed(1), p: +p.toFixed(2), fase: o.nivel ? 'reforma' : ['canteiro', 'fundacao', 'estrutura', 'fechamento'][faseObra(p)] };
            }),
            lote,
            pecas: m,
            predios: medidas,
            quadro: { calls: ctx.stats.calls, tris: ctx.stats.tris, resto: ctx.stats.familias.resto, sombra: ctx.stats.familias.sombra },
          };
        },
      };
    },
  });
}
