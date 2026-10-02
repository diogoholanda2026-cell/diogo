// Cena 'bairro' (desenho do render 15.2, A10: 9h): um bairro misto da cidade sintética (casas, lojas de rua, prédios
// médios, torres e escritórios) a 400 m e 45 graus, para a troca LOD0/LOD1 e a sombra de perto. ?vista= troca a câmera
// sem sair do lugar: rua (nível da calçada), 50, 200 (metros), lod1 (1,1 km) e lod2 (3,2 km), e as de tipologia
// (torres, escritorios, industria, orla); ?hora= a hora do céu.
// A cena espera a oficina entregar os setores da vista (predios.preparar) antes de liberar a captura, e o resultado
// traz as medidas do gerador (setores, LOD0 visíveis, instâncias, triângulos por LOD, memória, sombra).
// ?crescer=4 (R4b, D39): crescimento sintético no ritmo da simulação em 4x (até 3 nascimentos e uma subida de nível
// por tique, no máximo 60 obras abertas, as obras terminando no fim) em volta da vista, por ?por= segundos (padrão
// 40), a partir do fim do aquecimento; depois para e mede quanto a fila da oficina leva para esvaziar. O resultado traz o
// envio por quadro (o JS das malhas e listas, com o pior de cada parte, e o tempo do WebGL nos envios de buffer e
// textura) e a fila.
import { PREDIO, TIPO_PREDIO } from '../../contratos/flags.js';

/** Centro do bairro na cidade sintética e as vistas. */
export const BAIRRO = Object.freeze({ x: -1000, z: -460, guinada: 32 });
export const VISTAS = Object.freeze({
  padrao: { dist: 400, inclinacao: 45 },
  // a avenida comercial da orla, olhando ao longo dela
  rua: { dist: 30, inclinacao: 4, x: 1543, z: 1570, guinada: 110 },
  // rua de casas e lojas de um bairro popular denso, e um bairro misto com prédios médios
  50: { dist: 55, inclinacao: 16, x: 386, z: -958, guinada: 40 },
  200: { dist: 200, inclinacao: 30, x: 330, z: -880, guinada: 75 },
  lod1: { dist: 1100, inclinacao: 30 },
  lod2: { dist: 3200, inclinacao: 24 },
  // de perto, por tipologia: torres residenciais sobre pódio, escritórios, galpões e prédios médios da orla
  torres: { dist: 170, inclinacao: 20, x: -157, z: -675, guinada: 35 },
  escritorios: { dist: 190, inclinacao: 16, x: -381, z: -517, guinada: 210 },
  industria: { dist: 150, inclinacao: 28, x: 1231, z: -661, guinada: 60 },
  orla: { dist: 150, inclinacao: 20, x: 420, z: 1718, guinada: 330 },
});

/** Ritmo do crescimento sintético (o da simulação, sim/zonas/crescimento.js, em tiques). */
export const CRESCER = Object.freeze({ nascimentos: 3, niveis: 1, maxObras: 60, raio: 700, obraBase: 45, obraPorAndar: 10, nivelBase: 30, nivelPorAndar: 4 });

/**
 * Crescimento sintético sobre o espelho (sem a simulação): nascimentos (o lote ganha um prédio novo em obra: outra
 * semente, nível 1), subidas de nível (reforma) e o fim das obras, marcados no diário como a simulação marca.
 */
export function criarCrescimento(esp, mudancas, { x, z, raio = CRESCER.raio, semente = 7 } = {}) {
  const P = esp.predios;
  let s = semente >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const perto = [];
  for (let i = 0; i < P.n; i++) if (P.viva[i] && P.tipo[i] === TIPO_PREDIO.ZONA && Math.hypot(P.x[i] - x, P.z[i] - z) < raio) perto.push(i);
  const abertas = new Set();
  const cont = { nascimentos: 0, niveis: 0, terminadas: 0 };
  const marcar = (i) => mudancas.marcarIdx?.('predios', i);
  const sorteia = () => perto[Math.floor(rnd() * perto.length)];
  function tique(T) {
    for (const i of [...abertas]) {
      if (T < P.obraFim[i]) continue;
      P.flags[i] &= ~(PREDIO.OBRA | PREDIO.OBRA_NIVEL);
      abertas.delete(i);
      cont.terminadas++;
      marcar(i);
    }
    for (let k = 0; k < CRESCER.nascimentos + CRESCER.niveis; k++) {
      if (abertas.size >= CRESCER.maxObras || !perto.length) break;
      const i = sorteia();
      if (abertas.has(i) || P.flags[i] & PREDIO.OBRA) continue;
      const nivel = k >= CRESCER.nascimentos;
      if (nivel && P.nivel[i] >= 5) continue;
      const andares = 2 + P.nivel[i] * 3;
      if (nivel) {
        P.nivel[i]++;
        P.flags[i] |= PREDIO.OBRA | PREDIO.OBRA_NIVEL;
        P.obraFim[i] = T + CRESCER.nivelBase + CRESCER.nivelPorAndar * andares;
        cont.niveis++;
      } else {
        P.semente[i] = (Math.imul(P.semente[i] ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1;
        P.nivel[i] = 1 + Math.floor(rnd() * 2);
        P.flags[i] = (P.flags[i] | PREDIO.OBRA) & ~PREDIO.ABANDONADO;
        P.obraFim[i] = T + CRESCER.obraBase + CRESCER.obraPorAndar * andares;
        cont.nascimentos++;
      }
      P.obraIni[i] = T;
      abertas.add(i);
      marcar(i);
    }
  }
  return { tique, cont, abertas, perto: perto.length };
}

const pct = (a, q) => {
  if (!a.length) return 0;
  const b = [...a].sort((u, v) => u - v);
  return b[Math.min(b.length - 1, Math.floor(q * b.length))];
};

export function registrar(registrarCena) {
  registrarCena('bairro', {
    sim: 'sintetica',
    hora: 9,
    camera: { x: BAIRRO.x, z: BAIRRO.z, guinada: BAIRRO.guinada, ...VISTAS.padrao },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const nome = qs.get('vista') ?? 'padrao';
      const v = VISTAS[nome] ?? VISTAS.padrao;
      const cam = { x: BAIRRO.x, z: BAIRRO.z, guinada: BAIRRO.guinada, ...v };
      ctx.cameraApi.definir(cam);
      const dom = ctx.dominio('predios');
      const falhas = [];
      let medidas = null;
      if (!dom?.preparar) falhas.push('o domínio predios é o substituto da F0 (o gerador não registrou)');
      else {
        try {
          medidas = await dom.preparar({ teto: 180000 });
          if (!dom.pronto()) falhas.push('a oficina não entregou todos os setores da vista a tempo');
        } catch (e) {
          falhas.push(`preparar falhou: ${e?.message ?? e}`);
        }
      }
      // crescimento sintético em 4x (o envio por quadro e a fila da oficina)
      const mult = Number(qs.get('crescer')) || 0;
      const porMs = (Number(qs.get('por')) || 40) * 1000;
      const esp = ctx.sim.espelho;
      const cresc = mult > 0 && esp.predios ? criarCrescimento(esp, ctx.sim.mudancas, { x: cam.x, z: cam.z }) : null;
      const med = { quadros: 0, js: [], gl: [], fila: [], filaMax: 0, esvaziouMs: null, fimMs: null, pior: { predios: 0, obras: 0, lotes: 0 } };
      let glQuadro = 0;
      if (cresc && ctx.gl) {
        // o tempo do WebGL nos envios (buffer e textura) por quadro
        const gl = ctx.gl;
        for (const f of ['bufferData', 'bufferSubData', 'texSubImage2D', 'texImage2D']) {
          const orig = gl[f].bind(gl);
          gl[f] = (...a) => {
            const t0 = performance.now();
            const r = orig(...a);
            glQuadro += performance.now() - t0;
            return r;
          };
        }
      }
      let t0 = null;
      let tAnt = null;
      let tiqueF = esp.tempo?.tique ?? 0;
      return {
        quadro(tMs) {
          if (!cresc) return;
          // o crescimento começa com o jogo pronto (depois do aquecimento dos programas), sem os envios da carga
          const aq = ctx.stats.aquecimento?.estado;
          if (t0 === null && aq && aq !== 'pronto') return;
          if (t0 === null) dom?.zerarEnvio?.();
          // o quadro anterior (o envio dele já aconteceu no desenho)
          if (t0 !== null) {
            const S = ctx.stats.setores;
            med.quadros++;
            // o JS do envio: malhas e listas dos prédios, e as listas das obras e do lote
            const partes = { predios: S.msEnvio ?? 0, obras: ctx.dominio('obras')?.msEnvio ?? 0, lotes: ctx.dominio('lotes')?.msEnvio ?? 0 };
            for (const k of Object.keys(partes)) med.pior[k] = Math.max(med.pior[k], partes[k]);
            med.js.push(partes.predios + partes.obras + partes.lotes);
            med.gl.push(glQuadro);
            const fila = S.pendentes ?? S.fila ?? 0;
            med.fila.push(fila);
            med.filaMax = Math.max(med.filaMax, fila);
            if (med.fimMs !== null && med.esvaziouMs === null && fila === 0) med.esvaziouMs = Math.round(tMs - med.fimMs);
          }
          glQuadro = 0;
          if (t0 === null) t0 = tMs;
          const cresce = tMs - t0 < porMs;
          if (!cresce && med.fimMs === null) med.fimMs = tMs;
          if (tAnt !== null && cresce) {
            const antes = Math.floor(tiqueF);
            tiqueF += (mult * Math.min(250, tMs - tAnt)) / 1000;
            for (let T = antes + 1; T <= Math.floor(tiqueF); T++) cresc.tique(T);
            esp.tempo.tique = Math.floor(tiqueF);
            esp.tempo.frac = tiqueF - Math.floor(tiqueF);
          }
          tAnt = tMs;
        },
        resultado() {
          const s = ctx.stats;
          const m = dom?.medidas?.() ?? medidas;
          if (m && !m.instancias && !m.lod0Visiveis) falhas.push('nenhum prédio desenhado');
          const r = {
            ok: falhas.length === 0,
            falhas: [...falhas],
            vista: nome,
            medidas: m,
            quadro: { calls: s.calls, tris: s.tris, callsSombra: s.callsSombra, trisSombra: s.trisSombra, predios: s.familias.predios, sombra: s.familias.sombra },
          };
          if (cresc) {
            const envio = med.js.map((j, k) => j + med.gl[k]);
            r.crescimento = {
              mult, segundos: porMs / 1000, prediosPerto: cresc.perto, ...cresc.cont, abertas: cresc.abertas.size, quadros: med.quadros,
              envio: { pior: +Math.max(0, ...envio).toFixed(2), p95: +pct(envio, 0.95).toFixed(2), js: +Math.max(0, ...med.js).toFixed(2), gl: +Math.max(0, ...med.gl).toFixed(2), porDominio: Object.fromEntries(Object.entries(med.pior).map(([k, v]) => [k, +v.toFixed(2)])) },
              fila: { max: med.filaMax, fim: med.fila.at(-1) ?? 0, esvaziouMs: med.esvaziouMs },
              partes: m?.envio ?? null,
              anexos: s.setores.anexos,
              obras: ctx.dominio('obras')?.medidas?.() ?? null,
            };
          }
          return r;
        },
      };
    },
  });
}
