// Cena 'servicos' (D60, A10, R5): os prédios colocáveis na cidade sintética. Dois bairros recebem os modelos de frente
// para as vias, como o comando construir faz (a frente encosta na calçada e olha para a via): os serviços perto do
// rio a oeste (a captação e a ETE na margem) e a produção da Holding na zona industrial a leste, perto da costa (o
// areal na margem). Os prédios da cidade debaixo das plantas saem. ?vista= troca a câmera:
//   padrao   os serviços de dia (15h, a hora do A10)
//   holding  a produção da Holding
//   noite    os serviços às 21h
//   perto    a clínica (Rede Sarah) e a escola de perto
//   aberta   a vista aberta da bancada (a cidade inteira; o orçamento com os colocáveis)
//   <tipo>   um modelo de perto (o id de data/colocaveis.js)
// ?obra=1 põe um serviço e um prédio da Holding em obra (o corte da R4b). O resultado traz onde cada um ficou, as
// medidas do domínio e os triângulos da família.
import { COLOCAVEIS, COLOCAVEIS_ORDEM } from '../../data/colocaveis.js';
import { SERVICOS_ORDEM, SERVICOS } from '../../data/servicos.js';
import { HOLDING_ORDEM, PREDIOS_HOLDING } from '../../data/holding.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { PREDIO, TIPO_PREDIO, AGUA } from '../../contratos/flags.js';
import { ponto, tangente } from '../../comum/bezier.js';
import { alturaEm, celulaEm } from '../../comum/altura.js';
import { hash32 } from '../../comum/hash.js';
import { CAMERA_ABERTA } from './aberta.js';

/** Os dois bairros da cena (centro e raio de busca) e o que vai em cada um, com o nível dos prédios da Holding. */
export const BAIRROS = Object.freeze({
  servicos: { x: -1130, z: -330, raio: 900, tipos: ['captacao', 'poco', 'solar', 'praca', 'clinica', 'escolaF', 'delegacia', 'bombeiros', 'ete', 'termica', 'escolaM', 'parque', 'hospital', 'parqueG'] },
  holding: { x: 1250, z: -720, raio: 900, tipos: ['escritorioObra', 'pedreira', 'areal', 'olaria', 'concreteira', 'mina', 'cimenteira', 'vidraria', 'serraria', 'manejo'], niveis: { concreteira: 3, pedreira: 2, escritorioObra: 2, olaria: 2 } },
});

/** Passo das amostras das vias (m) e o lado dos baldes da busca. */
const PASSO = 8;
const BALDE = 32;

/** Margem com água atrás (data dos serviços e da Holding). */
const margemDe = (tipo) => SERVICOS[tipo]?.margem ?? PREDIOS_HOLDING[tipo]?.margem ?? 0;

/** Cantos do retângulo (cx, cz, rot, w, d) na convenção do espelho (frente para +z do lote). */
function cantos(cx, cz, rot, w, d) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [cx + a * c + b * s, cz - a * s + b * c]);
}

/** Pontos de amostra dentro do retângulo (grade de ~6 m), para conferir vias, água e o relevo. */
function amostras(cx, cz, rot, w, d, passo = 6) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const out = [];
  const nu = Math.max(1, Math.round(w / passo));
  const nv = Math.max(1, Math.round(d / passo));
  for (let a = 0; a <= nu; a++) for (let b = 0; b <= nv; b++) {
    const u = (a / nu - 0.5) * w;
    const v = (b / nv - 0.5) * d;
    out.push([cx + u * c + v * s, cz - u * s + v * c]);
  }
  return out;
}

/** Dois retângulos girados se sobrepõem (eixos separadores), com a folga somada às meias medidas. */
function sobrepoe(A, B, folga) {
  const eixos = [A.rot, A.rot + Math.PI / 2, B.rot, B.rot + Math.PI / 2];
  for (const g of eixos) {
    const ux = Math.cos(g);
    const uz = -Math.sin(g);
    const proj = (R) => {
      const cs = cantos(R.x, R.z, R.rot, R.w + folga, R.d + folga).map(([x, z]) => x * ux + z * uz);
      return [Math.min(...cs), Math.max(...cs)];
    };
    const [a0, a1] = proj(A);
    const [b0, b1] = proj(B);
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

/**
 * Escolhe os lugares dos colocáveis de um bairro, de frente para as vias (puro: espelho e pedidos; o Node testa).
 * @param {object} esp  o espelho (vias, terreno)
 * @param {{ tipo: string }[]} pedidos
 * @param {{ x: number, z: number, raio: number }} centro
 * @returns {{ tipo: string, x: number, z: number, y: number, rot: number, w: number, d: number }[]}
 */
export function escolherLugares(esp, pedidos, { x, z, raio }, ocupados = []) {
  const A = esp.vias?.arestas;
  const T = esp.terreno;
  if (!A || !T) return [];
  const ox = (T.origem?.[0] ?? -4096) - T.passo / 2;
  const oz = (T.origem?.[1] ?? -4096) - T.passo / 2;
  const agua = (px, pz) => (T.agua ? celulaEm(T.agua, T.n, T.passo, ox, oz, px, pz) : AGUA.TERRA);
  // trechos das vias em baldes (para conferir que nenhuma corta a planta) e as amostras de frente perto do centro
  const baldes = new Map();
  const vias = [];
  const P0 = [0, 0];
  const T0 = [0, 0];
  for (let e = 0; e < A.n; e++) {
    if (!A.viva[e]) continue;
    const id = VIAS_ORDEM[A.tipo[e]];
    const tipo = VIAS[id];
    if (!tipo) continue;
    const comp = A.comp[e] || Math.hypot(A.p[8 * e + 6] - A.p[8 * e], A.p[8 * e + 7] - A.p[8 * e + 1]);
    const n = Math.max(1, Math.ceil(comp / PASSO));
    let ant = null;
    for (let k = 0; k <= n; k++) {
      ponto(A.p, k / n, P0, 8 * e);
      tangente(A.p, k / n, T0, 8 * e);
      const l = Math.hypot(T0[0], T0[1]) || 1;
      const a = { x: P0[0], z: P0[1], tx: T0[0] / l, tz: T0[1] / l, meia: tipo.largura / 2 };
      if (ant) {
        const seg = { ax: ant.x, az: ant.z, bx: a.x, bz: a.z, meia: a.meia };
        const chave = `${Math.floor((ant.x + a.x) / 2 / BALDE)},${Math.floor((ant.z + a.z) / 2 / BALDE)}`;
        if (!baldes.has(chave)) baldes.set(chave, []);
        baldes.get(chave).push(seg);
      }
      ant = a;
      if (id !== 'rodovia' && id !== 'terra' && k > 0 && k < n && Math.hypot(a.x - x, a.z - z) < raio) vias.push(a);
    }
  }
  const cortaVia = (px, pz) => {
    const bi = Math.floor(px / BALDE);
    const bj = Math.floor(pz / BALDE);
    for (let i = bi - 1; i <= bi + 1; i++) for (let j = bj - 1; j <= bj + 1; j++) {
      for (const g of baldes.get(`${i},${j}`) ?? []) {
        const vx = g.bx - g.ax;
        const vz = g.bz - g.az;
        const t = Math.max(0, Math.min(1, ((px - g.ax) * vx + (pz - g.az) * vz) / (vx * vx + vz * vz || 1)));
        if (Math.hypot(px - g.ax - vx * t, pz - g.az - vz * t) < g.meia + 0.5) return true;
      }
    }
    return false;
  };
  const postos = [...ocupados];
  const out = [];
  for (const { tipo } of pedidos) {
    const [w, d] = COLOCAVEIS[tipo]?.pegada ?? [24, 24];
    const margem = margemDe(tipo);
    let melhor = null;
    for (const a of vias) {
      for (const lado of [1, -1]) {
        const nx = -a.tz * lado;
        const nz = a.tx * lado;
        const off = a.meia + d / 2 + 1.5;
        const cx = a.x + nx * off;
        const cz = a.z + nz * off;
        let custo = Math.hypot(cx - x, cz - z);
        if (melhor && custo > melhor.custo) continue;
        // a frente olha de volta para a via: frente = (sen rot, cos rot) = -n
        const rot = Math.atan2(-nx, -nz);
        const R = { x: cx, z: cz, rot, w, d };
        if (postos.some((p) => sobrepoe(R, p, 6))) continue;
        const pts = amostras(cx, cz, rot, w, d);
        let ok = true;
        let h0 = Infinity;
        let h1 = -Infinity;
        for (const [px, pz] of pts) {
          if (agua(px, pz) !== AGUA.TERRA || cortaVia(px, pz)) {
            ok = false;
            break;
          }
          const h = alturaEm(T, px, pz);
          h0 = Math.min(h0, h);
          h1 = Math.max(h1, h);
        }
        if (!ok || h1 - h0 > 3) continue;
        // margem: água até `margem` metros atrás do fundo (captação, ETE, areal)
        if (margem) {
          let achou = false;
          for (let m = 4; m <= Math.max(margem, 90) && !achou; m += 4) achou = agua(cx - Math.sin(rot) * (d / 2 + m), cz - Math.cos(rot) * (d / 2 + m)) !== AGUA.TERRA;
          if (!achou) custo += 5000;
        }
        if (!melhor || custo < melhor.custo) melhor = { custo, tipo, x: cx, z: cz, rot, w, d, y: pts.reduce((s, [px, pz]) => s + alturaEm(T, px, pz), 0) / pts.length };
      }
    }
    if (!melhor) continue;
    postos.push(melhor);
    out.push(melhor);
  }
  return out;
}

/** Tira a mata de dentro da planta (o desmate que o construir da simulação faz) e marca o retângulo no diário. */
function desmatar(esp, L, mudancas) {
  const F = esp.floresta;
  if (!F?.dens) return;
  const [ox, oz] = F.origem ?? [-4096, -4096];
  const cs = cantos(L.x, L.z, L.rot, L.w + 8, L.d + 8);
  const x0 = Math.min(...cs.map((c) => c[0]));
  const x1 = Math.max(...cs.map((c) => c[0]));
  const z0 = Math.min(...cs.map((c) => c[1]));
  const z1 = Math.max(...cs.map((c) => c[1]));
  const c = Math.cos(L.rot);
  const s = Math.sin(L.rot);
  for (let j = Math.max(0, Math.floor((z0 - oz) / F.passo)); j <= Math.min(F.n - 1, Math.floor((z1 - oz) / F.passo)); j++) {
    for (let i = Math.max(0, Math.floor((x0 - ox) / F.passo)); i <= Math.min(F.n - 1, Math.floor((x1 - ox) / F.passo)); i++) {
      const dx = ox + (i + 0.5) * F.passo - L.x;
      const dz = oz + (j + 0.5) * F.passo - L.z;
      if (Math.abs(dx * c - dz * s) <= L.w / 2 + 4 && Math.abs(dx * s + dz * c) <= L.d / 2 + 4) F.dens[j * F.n + i] = 0;
    }
  }
  mudancas?.marcarRet?.('floresta', x0, z0, x1, z1);
}

/** Tira os prédios da cidade debaixo das plantas e põe os colocáveis no espelho. Devolve [{ tipo, i, x, z, ... }]. */
export function construirNaCena(esp, lugares, { niveis = {}, obra = [], mudancas = null } = {}) {
  const P = esp.predios;
  const feitos = [];
  for (const L of lugares) {
    desmatar(esp, L, mudancas);
    const R = { x: L.x, z: L.z, rot: L.rot, w: L.w, d: L.d };
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i] || P.tipo[i] !== TIPO_PREDIO.ZONA) continue;
      if (Math.abs(P.x[i] - L.x) > 120 || Math.abs(P.z[i] - L.z) > 120) continue;
      if (sobrepoe(R, { x: P.x[i], z: P.z[i], rot: P.rot[i], w: P.w[i], d: P.d[i] }, 2)) P.liberar(i);
    }
    const servico = COLOCAVEIS[L.tipo].familia === 'servico';
    const i = P.alocar();
    if (i < 0) continue;
    P.tipo[i] = servico ? TIPO_PREDIO.SERVICO : TIPO_PREDIO.HOLDING;
    P.modelo[i] = servico ? SERVICOS_ORDEM.indexOf(L.tipo) : HOLDING_ORDEM.indexOf(L.tipo);
    P.zona[i] = 0;
    P.x[i] = L.x;
    P.z[i] = L.z;
    P.y[i] = L.y;
    P.rot[i] = L.rot;
    P.w[i] = L.w;
    P.d[i] = L.d;
    P.nivel[i] = niveis[L.tipo] ?? 1;
    P.estilo[i] = 0;
    P.semente[i] = hash32(COLOCAVEIS_ORDEM.indexOf(L.tipo) * 7919 + 17);
    P.flags[i] = (servico ? 0 : PREDIO.HOLDING) | (obra.includes(L.tipo) ? PREDIO.OBRA : 0);
    P.cor[i] = 0;
    P.marcar(i);
    feitos.push({ ...L, i });
  }
  return feitos;
}

/** Câmera que enquadra um grupo de lugares: o meio da caixa, a uma distância pelo tamanho. */
function enquadrar(lugares, { guinada = 30, inclinacao = 36, fator = 0.9, min = 260 } = {}) {
  if (!lugares.length) return null;
  const xs = lugares.map((l) => l.x);
  const zs = lugares.map((l) => l.z);
  const ext = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, dist: Math.max(min, ext * fator), guinada, inclinacao };
}

/** Câmera de perto de um lugar, olhando a frente (a frente do lote aponta para (sen rot, cos rot)). */
function dePerto(L, { dist, inclinacao = 26, lado = 28 } = {}) {
  const g = (-L.rot * 180) / Math.PI + 180 + lado;
  return { x: L.x, z: L.z, dist: dist ?? Math.max(70, Math.hypot(L.w, L.d) * 1.5), guinada: g, inclinacao };
}

export function registrar(registrarCena) {
  registrarCena('servicos', {
    sim: 'sintetica',
    hora: 15,
    camera: { x: BAIRROS.servicos.x, z: BAIRROS.servicos.z, dist: 600, guinada: 30, inclinacao: 36 },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const vista = qs.get('vista') ?? 'padrao';
      const esp = ctx.sim.espelho;
      const falhas = [];
      const obra = qs.get('obra') === '1' ? ['clinica', 'concreteira'] : [];
      const lugS = escolherLugares(esp, BAIRROS.servicos.tipos.map((tipo) => ({ tipo })), BAIRROS.servicos);
      const lugH = escolherLugares(esp, BAIRROS.holding.tipos.map((tipo) => ({ tipo })), BAIRROS.holding, lugS);
      const mud = ctx.sim.mudancas;
      const feitos = [...construirNaCena(esp, lugS, { obra, mudancas: mud }), ...construirNaCena(esp, lugH, { niveis: BAIRROS.holding.niveis, obra, mudancas: mud })];
      const faltam = COLOCAVEIS_ORDEM.filter((t) => !feitos.some((f) => f.tipo === t));
      if (faltam.length) falhas.push(`sem lugar para: ${faltam.join(', ')}`);
      if (obra.length) {
        // obra pela metade (fechamento)
        const T = 6000;
        esp.tempo.tique = T;
        esp.tempo.frac = 0;
        const P = esp.predios;
        for (const f of feitos) if (obra.includes(f.tipo)) {
          P.obraIni[f.i] = T - 420;
          P.obraFim[f.i] = T + 180;
          P.marcar(f.i);
        }
      }
      // câmera
      const doTipo = (t) => feitos.find((f) => f.tipo === t);
      const sv = feitos.filter((f) => COLOCAVEIS[f.tipo].familia === 'servico');
      const hd = feitos.filter((f) => COLOCAVEIS[f.tipo].familia === 'holding');
      let cam = null;
      if (vista === 'holding') cam = enquadrar(hd, { guinada: 205, inclinacao: 34, fator: 0.62 });
      else if (vista === 'aberta') cam = { ...CAMERA_ABERTA };
      else if (vista === 'perto') cam = doTipo('clinica') ? dePerto(doTipo('clinica'), { dist: 120, inclinacao: 24 }) : null;
      else if (COLOCAVEIS[vista]) cam = doTipo(vista) ? dePerto(doTipo(vista)) : null;
      else cam = enquadrar(sv, { guinada: 30, inclinacao: 34, fator: 0.6 });
      if (cam) ctx.cameraApi.definir(cam);
      // o domínio: o registrado no índice do render ou, enquanto o índice não o liga, um da própria cena, que ela
      // alimenta com o diário a cada quadro
      let dom = ctx.dominio('colocaveis');
      let proprio = null;
      let versao = -1;
      if (!dom) {
        const { criarDominioColocaveis } = await import('../colocaveis/dominio.js');
        proprio = criarDominioColocaveis(ctx);
        dom = proprio;
        await proprio.chegou;
      }
      let medidas = null;
      let predios = null;
      try {
        predios = await ctx.dominio('predios')?.preparar?.({ teto: 180000 });
        medidas = await dom.preparar({ teto: 120000 });
        if (proprio) versao = ctx.sim.mudancas.desde(-1).versao;
      } catch (e) {
        falhas.push(`preparar falhou: ${e?.message ?? e}`);
      }
      if (!medidas) falhas.push('o domínio colocaveis não preparou');
      return {
        quadro(tMs) {
          if (!proprio) return;
          const d = ctx.sim.mudancas.desde(versao);
          versao = d.versao;
          proprio.aplicar(d, ctx.sim.espelho, ctx);
          proprio.quadro(tMs, ctx);
        },
        descartar() {
          proprio?.descartar();
        },
        resultado() {
          const m = dom.medidas() ?? null;
          const f = [...falhas];
          if (m && m.itens !== feitos.length) f.push(`o domínio tem ${m.itens} colocáveis de ${feitos.length}`);
          return {
            ok: f.length === 0,
            falhas: f,
            vista,
            colocados: feitos.map((x) => ({ tipo: x.tipo, i: x.i, x: Math.round(x.x), z: Math.round(x.z), rot: +x.rot.toFixed(2) })),
            colocaveis: m,
            predios,
            quadro: { calls: ctx.stats.calls, tris: ctx.stats.tris, colocaveis: ctx.stats.familias.colocaveis, sombra: ctx.stats.familias.sombra },
          };
        },
      };
    },
  });
}
