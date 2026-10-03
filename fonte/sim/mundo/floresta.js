// Floresta: densidade da mata em 1024² células de 8 m (Uint8) e o desmate automático sob vias e lotes (D6; dona: S1a).
//
// A mata sai do relevo base e dos campos do mapa: Mata Atlântica fechada nas serras, nos planaltos e nos morros;
// pedra nua nos flancos a prumo dos pães de açúcar; mata ciliar na beira do rio e mangue na foz; restinga baixa atrás da
// praia; várzea e planície abertas (pasto, capim) com capões de mata, mais raros perto da cidade. 255 = mata fechada;
// o render levanta a copa acima de 0,6 (desenho do render 3.1).
//
// Desmate: toda forma registrada (via, plataforma, cava) limpa a mata sob o núcleo e 3 m em volta, na hora; a grade vai
// no save (a mata cortada não volta sozinha).
import { smoothstep, clamp } from '../../comum/util.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
import { amostrar } from '../../comum/altura.js';
import { terrenoBase, ruido, fbm, sementeDe, rioEm } from './terreno.js';
import { distanciaForma, ALCANCE } from './aplainar.js';

const N = 1024;
const PASSO = 8;
const CACHE = new Map();
const RIO = { a: 0, hw: 0, nivel: 0, varzea: 0, lado: 1, v: 0 };

/**
 * Densidade da mata do mapa (guardada por id; o espelho recebe uma cópia). Célula [j * 1024 + i] com centro em
 * x = ox + (i + 0.5) * 8, z = oz + (j + 0.5) * 8.
 */
export function gerarFloresta(base, mapa) {
  const guardado = CACHE.get(mapa.id);
  if (guardado) return guardado;
  const dens = new Uint8Array(N * N);
  const { n, altura, agua } = base;
  const [ox, oz] = base.origem;
  const { relevo, tipoDomo, costa, G } = base.campos;
  const s0 = sementeDe(mapa.semente) + 911;
  const [gx0, gz0, gx1, gz1] = mapa.plato.caixa;
  const disco = mapa.plato.disco;
  const vila = mapa.vila.area.flat();
  let vx0 = Infinity;
  let vz0 = Infinity;
  let vx1 = -Infinity;
  let vz1 = -Infinity;
  for (let q = 0; q < vila.length; q += 2) {
    vx0 = Math.min(vx0, vila[q]);
    vx1 = Math.max(vx1, vila[q]);
    vz0 = Math.min(vz0, vila[q + 1]);
    vz1 = Math.max(vz1, vila[q + 1]);
  }
  const nc = G.nc;
  const rioSL = base.campos.rio.sl;
  const valeSL = base.campos.vale.sl;
  // ruídos de escala grande numa grade de 32 m (a mata varia em centenas de metros): variação e capões
  const rMata = new Float32Array(nc * nc);
  const rCapao = new Float32Array(nc * nc);
  for (let jc = 0; jc < nc; jc++) {
    const z = oz + jc * G.pc;
    for (let ic = 0; ic < nc; ic++) {
      const x = ox + ic * G.pc;
      rMata[jc * nc + ic] = fbm(x / 260, z / 260, s0, 2);
      rCapao[jc * nc + ic] = fbm(x / 420, z / 420, s0 + 7, 3);
    }
  }
  for (let j = 0; j < N; j++) {
    const z = oz + (j + 0.5) * PASSO;
    const jc = Math.min(nc - 1, (j + 2) >> 2);
    for (let i = 0; i < N; i++) {
      const k = j * n + i;
      // água em qualquer canto da célula: sem mata
      if (agua[k] | agua[k + 1] | agua[k + n] | agua[k + n + 1]) continue;
      const x = ox + (i + 0.5) * PASSO;
      const h00 = altura[k];
      const h10 = altura[k + 1];
      const h01 = altura[k + n];
      const h11 = altura[k + n + 1];
      const dx = (h10 + h11 - h00 - h01) / (2 * PASSO);
      const dz = (h01 + h11 - h00 - h10) / (2 * PASSO);
      const decl = Math.sqrt(dx * dx + dz * dz);
      const h = (h00 + h10 + h01 + h11) / 4;
      const r = (relevo[k] + relevo[k + 1] + relevo[k + n] + relevo[k + n + 1]) / 4;
      const kc = jc * nc + Math.min(nc - 1, (i + 2) >> 2);
      const sd = amostrar(costa.sd, nc, G.pc, ox, oz, x, z);
      const ruidoMata = amostrar(rMata, nc, G.pc, ox, oz, x, z);
      let d;
      if (r > 12) {
        // serra, planalto e morros: mata fechada; pedra nos flancos a prumo; campo de altitude nos topos altos
        const mata = smoothstep(12, 40, r);
        d = 0.8 + 0.16 * mata + 0.06 * ruidoMata;
        if (tipoDomo[k] === 1) d = clamp(1.05 - smoothstep(0.55, 1.15, decl) * 1.05, 0, 0.9);
        else d *= 1 - smoothstep(1.05, 1.6, decl) * 0.85;
        if (h > 380) d *= 1 - 0.45 * smoothstep(380, 460, h);
      } else if (sd < 55) {
        d = 0; // praia
      } else {
        // planície: pasto e capim com capões de mata, raros perto da cidade
        const cidade = 1 - smoothstep(900, 1700, Math.sqrt(x * x + z * z));
        const limiar = 0.28 + 0.12 * cidade;
        const capao = smoothstep(limiar, limiar + 0.2, amostrar(rCapao, nc, G.pc, ox, oz, x, z));
        // pasto com árvores soltas e capões de mata
        d = 0.1 + 0.12 * ruidoMata + capao * 0.78;
        // córrego: mata ciliar na beira do leito, de uns 12 a 45 m de cada lado, com a borda recortada (a oitava de
        // 38 m) e o dossel mais ralo aqui e ali, como as matas de galeria no pasto (não uma faixa de largura igual)
        const cd = amostrar(base.campos.corregoDist, nc, G.pc, ox, oz, x, z);
        if (cd < 70) {
          const lim = 28 + 10 * ruido(x / 110, z / 110, s0 + 13) + 8 * ruido(x / 38, z / 38, s0 + 17);
          const cheio = 0.56 + 0.28 * smoothstep(-0.4, 0.4, ruidoMata) + 0.12 * ruido(x / 45, z / 45, s0 + 19);
          d = Math.max(d, cheio * (1 - smoothstep(lim - 8, lim + 6, cd)));
        }
        // restinga baixa atrás da praia
        if (sd < 190) d = Math.max(d * 0.5, 0.42 + 0.1 * ruidoMata) * smoothstep(55, 90, sd);
        // encosta do vale e pé dos morros: capoeira
        if (r > 3) d = Math.max(d, 0.35 + 0.35 * smoothstep(3, 12, r));
      }
      // rio: mata ciliar na margem, várzea aberta, mangue na foz
      // (só perto do rio ou da faixa de meandros: a leitura custa quatro bilineares)
      const slc = rioSL[kc];
      const vlc = valeSL[kc];
      const rio = (slc < 1000 && slc > -1000) || (vlc < 1000 && vlc > -1000) ? rioEm(base, x, z, RIO) : null;
      if (rio && (rio.a < rio.hw + 80 || rio.v < rio.varzea + 30)) {
        const margem = rio.a - rio.hw;
        // mata ciliar de largura que varia (10 a 60 m), mais rala aqui e ali e com o pasto chegando na margem em alguns
        // trechos (não uma faixa de largura igual)
        const lim = 30 + 18 * ruido(x / 150, z / 150, s0 + 23) + 7 * ruido(x / 46, z / 46, s0 + 29);
        const cheio = 0.62 + 0.28 * smoothstep(-0.5, 0.4, ruidoMata) - 0.5 * smoothstep(0.35, 0.6, ruido(x / 260, z / 260, s0 + 31));
        const ciliar = cheio * (1 - smoothstep(lim - 8, lim + 6, margem));
        if (ciliar > d) d = ciliar;
        else if (margem > lim && rio.v < rio.varzea) d = Math.min(d, 0.12 + 0.12 * ruidoMata + 0.5 * smoothstep(0.55, 0.8, ruido(x / 180, z / 180, s0 + 3)));
        if (rio.nivel < 1 && margem < 160) d = Math.max(d, 0.74);
      }
      // lagoas: brejo e mata na beira das marginais; taboa e restinga baixa na de Santa Cida
      const lsd = amostrar(base.campos.lagoa.sd, nc, G.pc, ox, oz, x, z);
      if (lsd > -45 && lsd < 0) {
        const marginal = base.campos.lagoa.qual[kc] > 0;
        const anel = (marginal ? 0.62 + 0.2 * ruidoMata : 0.3 + 0.15 * ruidoMata) * (1 - smoothstep(12, 45, -lsd));
        if (anel > d) d = anel;
      }
      // gleba e Vila: gramado e quintais
      if (x > gx0 - 10 && x < gx1 + 10 && z > gz0 - 10 && z < gz1 + 10) d = Math.min(d, 0.05);
      // o platô em disco da sede v3 (D90): a caixa é só o centro, então a mata limpa pelo círculo
      if (disco && (x - disco.cx) * (x - disco.cx) + (z - disco.cz) * (z - disco.cz) < (disco.r + 10) * (disco.r + 10)) d = Math.min(d, 0.05);
      else if (x > vx0 && x < vx1 && z > vz0 && z < vz1 && pontoNoPoligono(x, z, vila)) d = Math.min(d, 0.22);
      dens[j * N + i] = Math.round(clamp(d, 0, 1) * 255);
    }
  }
  CACHE.set(mapa.id, dens);
  return dens;
}

/** Densidade (0 a 1) na célula de (x, z). */
export function densidadeEm(F, x, z) {
  const i = Math.floor((x - F.origem[0]) / F.passo);
  const j = Math.floor((z - F.origem[1]) / F.passo);
  if (i < 0 || j < 0 || i >= F.n || j >= F.n) return 0;
  return F.dens[j * F.n + i] / 255;
}

const O = { d: 0, r: 0, cota: 0 };

/**
 * Desmate sob as formas que tocam o retângulo: núcleo e 3 m em volta. Devolve quantas células mudaram (e marca o
 * retângulo 'floresta' no diário quando muda alguma).
 */
export function desmatar(sim, ret, folga = 3) {
  const F = sim.espelho.floresta;
  if (!F) return 0;
  const [ox, oz] = F.origem;
  let mudou = 0;
  let rx0 = Infinity;
  let rz0 = Infinity;
  let rx1 = -Infinity;
  let rz1 = -Infinity;
  for (const f of sim.formas.porId.values()) {
    const c = f.caixa;
    if (c[0] - ALCANCE > ret[2] || c[2] + ALCANCE < ret[0] || c[1] - ALCANCE > ret[3] || c[3] + ALCANCE < ret[1]) continue;
    const i0 = Math.max(0, Math.floor((c[0] - folga - ox) / PASSO));
    const i1 = Math.min(N - 1, Math.floor((c[2] + folga - ox) / PASSO));
    const j0 = Math.max(0, Math.floor((c[1] - folga - oz) / PASSO));
    const j1 = Math.min(N - 1, Math.floor((c[3] + folga - oz) / PASSO));
    for (let j = j0; j <= j1; j++) {
      const z = oz + (j + 0.5) * PASSO;
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        if (!F.dens[k]) continue;
        const x = ox + (i + 0.5) * PASSO;
        distanciaForma(f, x, z, O);
        if (O.d > folga) continue;
        F.dens[k] = 0;
        mudou++;
        if (x < rx0) rx0 = x;
        if (x > rx1) rx1 = x;
        if (z < rz0) rz0 = z;
        if (z > rz1) rz1 = z;
      }
    }
  }
  if (mudou) sim.mudancas.marcarRet('floresta', rx0 - PASSO, rz0 - PASSO, rx1 + PASSO, rz1 + PASSO);
  return mudou;
}

/**
 * Publica espelho.floresta { n: 1024, passo: 8, origem, dens } (grade salva: o desmate fica) e liga o desmate às formas.
 */
export function registrar(sim) {
  const tb = terrenoBase(sim);
  if (!tb) return;
  const dens = gerarFloresta(tb.base, tb.mapa).slice();
  const F = { n: N, passo: PASSO, origem: [...tb.base.origem], dens };
  sim.espelho.floresta = F;
  sim.registrarGrade('floresta', { n: N, passo: PASSO, dados: dens });
  const marcar = sim.formas.marcarRet;
  sim.formas.marcarRet = (x0, z0, x1, z1) => {
    if (marcar) marcar(x0, z0, x1, z1);
    desmatar(sim, [x0, z0, x1, z1]);
  };
  sim.mudancas.tudo('floresta');
}
