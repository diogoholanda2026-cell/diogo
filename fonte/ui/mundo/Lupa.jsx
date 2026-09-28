// Lupa esquemática (desenho da UI 9.2): um círculo de 128 px com ampliação de 3 vezes em volta da mira, do lado oposto
// ao do dedo (acima e à esquerda com o dedo na metade direita), só no toque e com o dedo apoiado. Desenha em canvas 2D
// a partir dos DADOS, não dos pixels (ler o quadro da GPU pararia a fila no Mali e a imagem ampliada ficaria borrada):
// vias na largura real, nós como pontos, a prévia do traçado, as guias de encaixe tracejadas, a grade de 8 m, a água,
// as plantas dos prédios e, nas zonas, as células. Orientada pela guinada da câmera; custo abaixo de 1 ms.
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../textos.js';
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { ponto as pontoBz, caixa as caixaBz } from '../../comum/bezier.js';
import { AGUA, CELULA } from '../../contratos/flags.js';
import { alturaEm } from '../../comum/altura.js';
import { sessao, vivo } from '../ferramentas/sessao.js';
import { meioDoPlano, retangulosHud } from './Cotas.jsx';

export const LUPA = Object.freeze({ tam: 128, zoom: 3, afasta: 100, sobe: 92, margem: 8, topo: 56, folgaX: 56, folgaY: 14, cache: 200 });
let ladoAnterior = 0;

/**
 * Candidatos da lupa (células, prédios e arestas perto da mira), juntados UMA vez por toque numa janela com `margem`
 * metros de folga e refeitos só quando a mira sai dela, o zoom abre a lupa além dela ou uma tabela muda de tamanho. A
 * cada quadro a lupa só percorre os candidatos: varrer a cidade inteira (125 mil células na sintética) passaria de 1 ms.
 * A zona e o estado das células continuam lidos ao vivo (o pincel pinta durante o toque); as células só entram com
 * `celulas` (a ferramenta de zonas).
 */
export function candidatosLupa(cache, esp, cx, cz, alcance, { margem = LUPA.cache, celulas = true } = {}) {
  const C = celulas ? esp?.celulas : null;
  const P = esp?.predios;
  const A = esp?.vias?.arestas;
  const nC = C?.n ?? 0;
  const nP = P?.n ?? 0;
  const nA = A?.n ?? 0;
  if (
    cache.esp === esp && cache.nC === nC && cache.nP === nP && cache.nA === nA && cache.vC === C?.viva && cache.vP === P?.viva &&
    Math.max(Math.abs(cx - cache.cx), Math.abs(cz - cache.cz)) + alcance + 40 <= cache.r
  ) return cache;
  const r = alcance + margem;
  const dentro = (x, z, folga) => Math.abs(x - cx) <= r + folga && Math.abs(z - cz) <= r + folga;
  const cel = [];
  for (let c = 0; c < nC; c++) if (C.viva[c] && dentro(C.x[c], C.z[c], 6)) cel.push(c);
  const pred = [];
  for (let i = 0; i < nP; i++) if (P.viva[i] && dentro(P.x[i], P.z[i], 40)) pred.push(i);
  const ares = [];
  for (let e = 0; e < nA; e++) {
    if (!A.viva[e]) continue;
    const b = caixaBz(A.p, 8 * e, 20);
    if (b[2] >= cx - r && b[0] <= cx + r && b[3] >= cz - r && b[1] <= cz + r) ares.push(e);
  }
  return Object.assign(cache, { esp, nC, nP, nA, vC: C?.viva, vP: P?.viva, cx, cz, r, cel, pred, ares });
}

const cacheLupa = { esp: null };

const COR = Object.freeze({
  chao: '#39403a',
  grade: 'rgba(255,255,255,0.07)',
  agua: '#2c5872',
  predio: '#20262d',
  predioBorda: 'rgba(255,255,255,0.18)',
  via: '#8e969f',
  viaBorda: '#c7ccd1',
  no: '#eef2f6',
  previa: 'rgba(90,176,255,0.75)',
  previaEr: 'rgba(255,123,110,0.8)',
  guia: '#d9bd84',
  aro: '#5ab0ff',
});
const COR_ZONA = { res: '#199e70', com: '#3987e5', ind: '#c98500', esc: '#3987e5' };

/**
 * Centro da lupa na tela e o lado usado: [x, y, lado]. Do lado oposto ao do dedo e dentro da área útil; se ali ela
 * cobre um ponto de `evitar` (a cota do traçado, em px de tela) e o outro lado está livre, vai para o outro lado. Fica
 * no `anterior` enquanto ele estiver livre, para não pular de um lado para o outro a cada quadro. `hud` são os
 * retângulos do HUD ([{ l, t, r, b, cima }]): a lupa fica abaixo dos de cima (a barra e a pílula de pausa) que estão na
 * coluna dela e acima dos de baixo.
 */
export function posicaoLupa(mira, dedo, W, H, evitar = [], anterior = 0, hud = []) {
  const r = LUPA.tam / 2;
  const em = (lado) => {
    const x = Math.max(LUPA.margem + r, Math.min(W - LUPA.margem - r, mira[0] + lado * LUPA.afasta));
    let topo = LUPA.topo;
    let fundo = H - LUPA.margem;
    for (const q of hud) {
      if (q.r <= x - r || q.l >= x + r) continue;
      if (q.cima) topo = Math.max(topo, q.b + LUPA.margem);
      else fundo = Math.min(fundo, q.t - LUPA.margem);
    }
    return [x, Math.max(topo + r, Math.min(fundo - r, mira[1] - LUPA.sobe)), lado];
  };
  const cobre = ([x, y]) => evitar.some((p) => Math.abs(p[0] - x) < r + LUPA.folgaX && Math.abs(p[1] - y) < r + LUPA.folgaY);
  const lado = dedo && dedo[0] > W / 2 ? -1 : 1;
  if (anterior === -lado) {
    const b = em(-lado);
    if (evitar.length && !cobre(b)) return b;
  }
  const a = em(lado);
  if (!evitar.length || !cobre(a)) return a;
  const b = em(-lado);
  return cobre(b) ? a : b;
}

/** A cota do traçado na tela (o que a lupa não deve cobrir), ou null. */
function cotaNaTela(s, R, T) {
  if (s.tipo !== 'via' || !R?.projetar) return null;
  const temTraco = s.maquina.modo === 'melhorar' || s.maquina.b;
  const q = temTraco ? meioDoPlano(s.previa) : null;
  if (!q) return null;
  const p = R.projetar([q[0], (T?.altura ? alturaEm(T, q[0], q[1]) : 0) + 1, q[1]]);
  return p && Number.isFinite(p.x) && p.visivel !== false ? [p.x, p.y - 34] : null;
}

function desenhar(cv, ui) {
  const s = sessao.value;
  const R = ui.R;
  const ativa = !!(s && vivo.apoiado && vivo.toque && vivo.mira && R?.raio && s.tipo !== 'areas');
  if (!ativa) {
    ladoAnterior = 0; // cada toque novo começa do lado oposto ao do dedo
    cacheLupa.esp = null; // e junta os candidatos de novo (a cidade pode ter mudado entre os toques)
    if (cv.dataset.ligada) {
      cv.style.opacity = '0';
      delete cv.dataset.ligada;
    }
    return;
  }
  const centro = R.raio(vivo.mira[0], vivo.mira[1]);
  if (!centro) return;
  const esp = ui.obterSim()?.espelho;
  const W = typeof innerWidth !== 'undefined' ? innerWidth : 986;
  const H = typeof innerHeight !== 'undefined' ? innerHeight : 443;
  const cota = cotaNaTela(s, R, esp?.terreno);
  const [px, py, lado] = posicaoLupa(vivo.mira, vivo.dedo, W, H, cota ? [cota] : [], ladoAnterior, retangulosHud());
  ladoAnterior = lado;
  const T = LUPA.tam;
  const dpr = Math.min(2, typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1);
  if (cv.width !== Math.round(T * dpr)) {
    cv.width = Math.round(T * dpr);
    cv.height = Math.round(T * dpr);
  }
  cv.style.transform = `translate(${(px - T / 2).toFixed(1)}px, ${(py - T / 2).toFixed(1)}px)`;
  cv.style.opacity = '1';
  cv.dataset.ligada = '1';
  const g = cv.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, T, T);
  g.save();
  g.beginPath();
  g.arc(T / 2, T / 2, T / 2 - 1, 0, 2 * Math.PI);
  g.clip();
  g.fillStyle = COR.chao;
  g.fillRect(0, 0, T, T);

  const k = LUPA.zoom / Math.max(0.05, vivo.mpp || 1); // px da lupa por metro
  const alcance = T / 2 / k + 4;
  const guinada = ((R.camera?.estado?.().guinada ?? 0) * Math.PI) / 180;
  const cg = Math.cos(guinada);
  const sg = Math.sin(guinada);
  const cx = centro[0];
  const cz = centro[2];
  // mundo para a lupa: direita no chão (cos g, sen g), frente (sen g, -cos g) para cima
  const L = (x, z) => {
    const dx = x - cx;
    const dz = z - cz;
    return [T / 2 + (dx * cg + dz * sg) * k, T / 2 - (dx * sg - dz * cg) * k];
  };
  const perto = (x, z, folga = 0) => Math.abs(x - cx) < alcance + folga && Math.abs(z - cz) < alcance + folga;
  const cand = candidatosLupa(cacheLupa, esp, cx, cz, alcance, { celulas: s.tipo === 'zona' });

  // grade de 8 m (só quando os quadrados passam de 6 px)
  if (8 * k >= 6) {
    g.strokeStyle = COR.grade;
    g.lineWidth = 1;
    g.beginPath();
    const x0 = Math.floor((cx - alcance) / 8) * 8;
    const z0 = Math.floor((cz - alcance) / 8) * 8;
    for (let x = x0; x <= cx + alcance; x += 8) {
      const a = L(x, cz - alcance);
      const b = L(x, cz + alcance);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    for (let z = z0; z <= cz + alcance; z += 8) {
      const a = L(cx - alcance, z);
      const b = L(cx + alcance, z);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    g.stroke();
  }

  // água pelas amostras da grade de alturas
  const Tr = esp?.terreno;
  if (Tr?.agua) {
    g.fillStyle = COR.agua;
    const i0 = Math.max(0, Math.floor((cx - alcance - Tr.origem[0]) / Tr.passo));
    const i1 = Math.min(Tr.n - 1, Math.ceil((cx + alcance - Tr.origem[0]) / Tr.passo));
    const j0 = Math.max(0, Math.floor((cz - alcance - Tr.origem[1]) / Tr.passo));
    const j1 = Math.min(Tr.n - 1, Math.ceil((cz + alcance - Tr.origem[1]) / Tr.passo));
    const h = Tr.passo / 2;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        if (Tr.agua[j * Tr.n + i] === AGUA.TERRA) continue;
        const x = Tr.origem[0] + i * Tr.passo;
        const z = Tr.origem[1] + j * Tr.passo;
        poligono(g, [L(x - h, z - h), L(x + h, z - h), L(x + h, z + h), L(x - h, z + h)]);
        g.fill();
      }
    }
  }

  // células de zona (só na ferramenta de zonas)
  const C = esp?.celulas;
  if (s.tipo === 'zona' && C?.n) {
    const h = 3.6;
    // as células que o pincel vai pintar ficam na cor da zona escolhida (ou vermelhas no Apagar)
    const acesas = new Set(s.previa?.celulas ?? []);
    const alvo = s.maquina?.apagar ? '#ff7b6e' : COR_ZONA[ZONAS[s.maquina?.zona]?.familia] ?? '#ffffff';
    for (const c of cand.cel) {
      if (!C.viva[c] || !perto(C.x[c], C.z[c], 6)) continue;
      const z = ZONAS[ZONAS_ORDEM[C.zona[c]]];
      g.fillStyle = acesas.has(c) ? alvo : z ? COR_ZONA[z.familia] : C.estado[c] === CELULA.INVALIDA ? 'rgba(255,123,110,0.25)' : 'rgba(255,255,255,0.14)';
      g.globalAlpha = acesas.has(c) ? 0.95 : z ? 0.6 : 1;
      const a = C.ang[c];
      const ux = Math.cos(a);
      const uz = -Math.sin(a);
      const vx = Math.sin(a);
      const vz = Math.cos(a);
      const x = C.x[c];
      const zc = C.z[c];
      poligono(g, [L(x - ux * h - vx * h, zc - uz * h - vz * h), L(x + ux * h - vx * h, zc + uz * h - vz * h), L(x + ux * h + vx * h, zc + uz * h + vz * h), L(x - ux * h + vx * h, zc - uz * h + vz * h)]);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // plantas dos prédios
  const P = esp?.predios;
  if (P?.n) {
    g.fillStyle = COR.predio;
    g.strokeStyle = COR.predioBorda;
    g.lineWidth = 1;
    for (const i of cand.pred) {
      if (!P.viva[i] || !perto(P.x[i], P.z[i], 40)) continue;
      const c = Math.cos(P.rot[i]);
      const sn = Math.sin(P.rot[i]);
      const hw = P.w[i] / 2;
      const hd = P.d[i] / 2;
      const q = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => L(P.x[i] + a * c + b * sn, P.z[i] - a * sn + b * c));
      poligono(g, q);
      g.fill();
      g.stroke();
    }
  }

  // vias na largura real, com a borda da calçada
  const A = esp?.vias?.arestas;
  const q = [0, 0];
  const faixa = (p, o, largura, cor) => {
    g.strokeStyle = cor;
    g.lineWidth = Math.max(1.5, largura * k);
    g.lineCap = 'round';
    g.beginPath();
    for (let n = 0; n <= 16; n++) {
      pontoBz(p, n / 16, q, o);
      const [x, y] = L(q[0], q[1]);
      if (n) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  };
  if (A?.n) {
    for (const e of cand.ares) {
      if (!A.viva[e]) continue;
      const larg = VIAS[VIAS_ORDEM[A.tipo[e]]]?.largura ?? 16;
      faixa(A.p, 8 * e, larg, COR.viaBorda);
      faixa(A.p, 8 * e, larg - 2, COR.via);
    }
    const N = esp.vias.nos;
    g.fillStyle = COR.no;
    for (let i = 0; i < (N?.n ?? 0); i++) {
      if (!N.viva[i] || !perto(N.x[i], N.z[i])) continue;
      const [x, y] = L(N.x[i], N.z[i]);
      g.beginPath();
      g.arc(x, y, 2.5, 0, 2 * Math.PI);
      g.fill();
    }
  }

  // prévia do traçado, guias e o ponto encaixado
  const pv = s.previa;
  if (s.tipo === 'via' && pv?.segmentos?.length) {
    for (const seg of pv.segmentos) faixa(seg.p, 0, VIAS[seg.tipo]?.largura ?? 16, seg.erros?.length ? COR.previaEr : COR.previa);
  }
  if (s.tipo === 'via' && pv?.guias?.length) {
    g.setLineDash([4, 4]);
    g.strokeStyle = COR.guia;
    g.lineWidth = 1.25;
    g.beginPath();
    for (const gu of pv.guias) {
      const a = L(gu.a[0], gu.a[1]);
      const b = L(gu.b[0], gu.b[1]);
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
    }
    g.stroke();
    g.setLineDash([]);
  }
  if (s.encaixe?.ponto) {
    const [x, y] = L(s.encaixe.ponto[0], s.encaixe.ponto[1]);
    g.strokeStyle = COR.guia;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 6, 0, 2 * Math.PI);
    g.stroke();
  }
  // a mira no centro
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(T / 2 - 9, T / 2);
  g.lineTo(T / 2 - 3, T / 2);
  g.moveTo(T / 2 + 3, T / 2);
  g.lineTo(T / 2 + 9, T / 2);
  g.moveTo(T / 2, T / 2 - 9);
  g.lineTo(T / 2, T / 2 - 3);
  g.moveTo(T / 2, T / 2 + 3);
  g.lineTo(T / 2, T / 2 + 9);
  g.stroke();
  g.restore();
  // aro
  g.strokeStyle = COR.aro;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(T / 2, T / 2, T / 2 - 1, 0, 2 * Math.PI);
  g.stroke();
}

function poligono(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

function Lupa({ ui }) {
  const ref = useRef(null);
  useEffect(
    () =>
      ui.aoQuadro(() => {
        if (ref.current) desenhar(ref.current, ui);
      }),
    [],
  );
  return <canvas ref={ref} class="lupa" role="img" aria-label={t('x2.lupa')} width={LUPA.tam} height={LUPA.tam} />;
}

export function registrar(ui) {
  ui.registrarHud('mundo', Lupa, { ordem: 70, nome: 'x2-lupa' });
}
