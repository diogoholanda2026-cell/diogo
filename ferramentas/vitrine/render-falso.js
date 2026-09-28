// Render falso para a vitrine e o robô rápido da interface (PROJETO 2.7, ui.md 13.1): a mesma API R do render de
// verdade, sem WebGL. Desenha num canvas 2D um céu, o chão com as ruas da grade e os prédios do espelho como caixas
// (convenção da 2.4: x, z no centro da planta, w na frente, d no fundo, rot com a frente para +z), com uma câmera
// de mentira; projeta, faz raio no chão, seleciona prédios e desenha as sobreposições das ferramentas, camadas e
// marcadores de um jeito simples. Com { fundo: url } desenha só a imagem (captura de uma cena da bancada).
//   const R = await criarRenderFalso(canvas, { sim: { espelho, mudancas }, fundo, tema: 'dia' | 'noite' });
// Câmera como no contrato (fonte/contratos/render.js): ângulos em graus, guinada 0 olhando para o norte (-z) e
// crescendo no sentido horário visto de cima, inclinação acima do horizonte. R.stats no formato de statsVazio().
import { statsVazio } from '../../fonte/contratos/render.js';

const FOV = (45 * Math.PI) / 180;
const CORES_ZONA = ['#a9aeb3', '#c9c3b8', '#bdb6aa', '#a3b2c2', '#b9a88f', '#aebccb', '#98a8ba', '#b0b4b8'];

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cruz(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function esc(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

export async function criarRenderFalso(canvas, opcoes = {}) {
  const { sim = null, fundo = null } = opcoes;
  const g = canvas.getContext('2d');
  let W = 1, H = 1;
  let imgFundo = null;
  if (fundo) { imgFundo = new Image(); imgFundo.src = fundo; try { await imgFundo.decode(); } catch (e) { imgFundo = null; } }

  const cam = { x: 0, z: 0, dist: 900, guinada: 225, inclinacao: 35 };
  const RAD = Math.PI / 180;
  const estado = { modo: 'camera', tema: opcoes.tema || 'dia', fase: null, sempreDia: false, estadoR: 'livre', qualidade: opcoes.qualidade || 'media',
    selecionado: null, camada: null, via: null, pincel: null, fantasma: null, demolir: new Set(), zona: false, ladrilhos: false,
    marcadores: [], atlas: null, sujo: true, aoFerramenta: null, opcoesEntrada: { deslocY: 56, bordaPx: 48 } };
  let olho = [0, 0, 0], frente = [0, 0, -1], direita = [1, 0, 0], cima = [0, 1, 0], foco = 1;

  function atualizarCamera() {
    const r = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    if (canvas.width !== Math.round(w * r) || canvas.height !== Math.round(h * r)) { canvas.width = Math.round(w * r); canvas.height = Math.round(h * r); }
    W = w; H = h;
    g.setTransform(r, 0, 0, r, 0, 0);
    const alvo = [cam.x, 0, cam.z];
    const gu = cam.guinada * RAD, inc = cam.inclinacao * RAD;
    // frente no chão: (sen gu, 0, -cos gu); o olho fica atrás e acima do alvo
    olho = [cam.x - cam.dist * Math.cos(inc) * Math.sin(gu), cam.dist * Math.sin(inc), cam.z + cam.dist * Math.cos(inc) * Math.cos(gu)];
    frente = norm(sub(alvo, olho));
    direita = norm(cruz(frente, [0, 1, 0]));
    cima = cruz(direita, frente);
    foco = H / 2 / Math.tan(FOV / 2);
  }

  // mundo para tela; profundidade > 0 é na frente da câmera
  function tela(p) {
    const v = sub(p, olho);
    const z = esc(v, frente);
    return { x: W / 2 + (esc(v, direita) * foco) / Math.max(z, 1e-3), y: H / 2 - (esc(v, cima) * foco) / Math.max(z, 1e-3), z };
  }
  function raioChao(x, y) {
    const d = norm([
      frente[0] + direita[0] * (x - W / 2) / foco - cima[0] * (y - H / 2) / foco,
      frente[1] + direita[1] * (x - W / 2) / foco - cima[1] * (y - H / 2) / foco,
      frente[2] + direita[2] * (x - W / 2) / foco - cima[2] * (y - H / 2) / foco,
    ]);
    if (d[1] >= -1e-4) return null;
    const t = -olho[1] / d[1];
    return [olho[0] + d[0] * t, 0, olho[2] + d[2] * t];
  }

  const P = () => sim?.espelho?.predios;
  function alturaDe(i) { const p = P(); return 5 + p.nivel[i] * (p.zona[i] === 2 ? 9 : 4.5); }
  function cantos(i) {
    const p = P();
    const c = Math.cos(p.rot[i]), s = Math.sin(p.rot[i]);
    const hw = p.w[i] / 2, hd = p.d[i] / 2, h = alturaDe(i);
    const base = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [p.x[i] + a * c + b * s, p.z[i] - a * s + b * c]);
    return { base: base.map(([x, z]) => [x, 0, z]), topo: base.map(([x, z]) => [x, h, z]) };
  }
  function cascoConvexo(pts) {
    const q = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
    const lado = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const inf = [], sup = [];
    for (const p of q) { while (inf.length >= 2 && lado(inf.at(-2), inf.at(-1), p) <= 0) inf.pop(); inf.push(p); }
    for (const p of q.reverse()) { while (sup.length >= 2 && lado(sup.at(-2), sup.at(-1), p) <= 0) sup.pop(); sup.push(p); }
    return inf.slice(0, -1).concat(sup.slice(0, -1));
  }
  function dentro(poli, x, y) {
    let d = false;
    for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      const a = poli[i], b = poli[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) d = !d;
    }
    return d;
  }

  const noite = () => !estado.sempreDia && (estado.fase === 'noite' || (estado.fase == null && estado.tema === 'noite'));
  function corCamada(i) {
    const c = estado.camada;
    if (!c || c.fonte !== 'predios' || !c.dados) return null;
    const v = c.dados[i];
    const cores = c.cores || ['#cde2fb', '#3987e5', '#0d366b'];
    if (c.categorico) return cores[Math.max(0, Math.min(cores.length - 1, Math.round(v)))];
    const t = Math.max(0, Math.min(1, (v - (c.min ?? 0)) / (((c.max ?? 1) - (c.min ?? 0)) || 1)));
    return cores[Math.min(cores.length - 1, Math.floor(t * cores.length))];
  }
  function sombra(cor, k) {
    const n = parseInt(cor.slice(1), 16);
    const f = (x) => Math.max(0, Math.min(255, Math.round(x * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function linhaChao(pts, cor, largura) {
    g.beginPath();
    let ini = true;
    for (const p of pts) { const s = tela(p); if (s.z <= 1) { ini = true; continue; } if (ini) g.moveTo(s.x, s.y); else g.lineTo(s.x, s.y); ini = false; }
    g.strokeStyle = cor; g.lineWidth = largura; g.stroke();
  }

  function desenhar() {
    atualizarCamera();
    if (imgFundo) {
      const k = Math.max(W / imgFundo.width, H / imgFundo.height);
      g.drawImage(imgFundo, (W - imgFundo.width * k) / 2, (H - imgFundo.height * k) / 2, imgFundo.width * k, imgFundo.height * k);
      desenharSobreposicoes();
      return;
    }
    const n = noite();
    const ceu = g.createLinearGradient(0, 0, 0, H);
    if (n) { ceu.addColorStop(0, '#0a1020'); ceu.addColorStop(1, '#1d2740'); } else { ceu.addColorStop(0, '#7fa9d6'); ceu.addColorStop(1, '#dde6ea'); }
    g.fillStyle = ceu; g.fillRect(0, 0, W, H);
    const hz = tela([olho[0] + frente[0] * 1e5, 0, olho[2] + frente[2] * 1e5]);
    const yh = Math.max(0, Math.min(H, hz.z > 0 ? hz.y : 0));
    const chao = g.createLinearGradient(0, yh, 0, H);
    if (n) { chao.addColorStop(0, '#1a1f24'); chao.addColorStop(1, '#101316'); } else { chao.addColorStop(0, '#9aa38d'); chao.addColorStop(1, '#7f8a6f'); }
    g.fillStyle = chao; g.fillRect(0, yh, W, H - yh);
    // vias: as arestas do espelho (Bézier cúbica, 8 números por aresta) ou, sem elas, a grade de 112 m da mentira
    const p = P();
    const A = sim?.espelho?.vias?.arestas;
    const corVia = n ? '#2a3038' : '#8d9088';
    if (A?.n && A.p) {
      for (let e = 0; e < A.n; e++) {
        if (!A.viva[e]) continue;
        const c = A.p.subarray(e * 8, e * 8 + 8);
        linhaChao(Array.from({ length: 9 }, (_, k) => { const t = k / 8, u = 1 - t; const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; return [b[0] * c[0] + b[1] * c[2] + b[2] * c[4] + b[3] * c[6], 0, b[0] * c[1] + b[1] * c[3] + b[2] * c[5] + b[3] * c[7]]; }), corVia, 3);
      }
    } else {
      const ext = p?.n ? Math.ceil(Math.sqrt(p.n / 12)) * 56 + 112 : 600;
      for (let k = -ext; k <= ext; k += 112) {
        linhaChao([[k + 56, 0, -ext], [k + 56, 0, ext]], corVia, 3);
        linhaChao([[-ext, 0, k], [ext, 0, k]], corVia, 3);
      }
    }
    if (estado.ladrilhos) for (let k = -4096; k <= 4096; k += 512) { linhaChao([[k, 0, -4096], [k, 0, 4096]], 'rgba(217,189,132,.6)', 1); linhaChao([[-4096, 0, k], [4096, 0, k]], 'rgba(217,189,132,.6)', 1); }
    // prédios do fundo para a frente
    if (p?.n) {
      const ordem = [];
      for (let i = 0; i < p.n; i++) if (p.viva[i]) ordem.push([esc(sub([p.x[i], 0, p.z[i]], olho), frente), i]);
      ordem.sort((a, b) => b[0] - a[0]);
      const sol = norm([0.4, 0.8, 0.3]);
      for (const [prof, i] of ordem) {
        if (prof < 5) continue;
        const { base, topo } = cantos(i);
        const cor = corCamada(i) || (estado.demolir.has(i) ? '#e66767' : CORES_ZONA[p.zona[i] % CORES_ZONA.length]);
        const faces = [];
        for (let k = 0; k < 4; k++) {
          const a = base[k], b = base[(k + 1) % 4];
          const nrm = norm(cruz(sub(b, a), [0, 1, 0]));
          const centro = [(a[0] + b[0]) / 2, topo[0][1] / 2, (a[2] + b[2]) / 2];
          if (esc(nrm, sub(olho, centro)) > 0) faces.push({ pts: [a, b, topo[(k + 1) % 4], topo[k]], luz: 0.55 + 0.35 * Math.max(0, esc(nrm, sol)) });
        }
        faces.push({ pts: topo, luz: 1 });
        for (const f of faces) {
          const s = f.pts.map(tela);
          if (s.some((q) => q.z <= 1)) continue;
          g.beginPath(); g.moveTo(s[0].x, s[0].y); for (const q of s.slice(1)) g.lineTo(q.x, q.y); g.closePath();
          g.fillStyle = sombra(cor, (n ? 0.45 : 1) * f.luz); g.fill();
        }
        if (n && p.zona[i] <= 2) { const t = tela(topo[0]); if (t.z > 1) { g.fillStyle = 'rgba(255,214,150,.55)'; g.fillRect(t.x - 1, t.y + 2, 2, 2); } }
        if (estado.selecionado === i) {
          const casco = cascoConvexo([...base, ...topo].map(tela));
          g.beginPath(); g.moveTo(casco[0].x, casco[0].y); for (const q of casco.slice(1)) g.lineTo(q.x, q.y); g.closePath();
          g.strokeStyle = '#5AB0FF'; g.lineWidth = 2; g.stroke();
        }
      }
    }
    desenharSobreposicoes();
  }

  function circuloChao(x, z, r, cor, preenche) {
    const pts = Array.from({ length: 49 }, (_, k) => [x + r * Math.cos((k / 48) * 2 * Math.PI), 0, z + r * Math.sin((k / 48) * 2 * Math.PI)]);
    linhaChao(pts, cor, 2);
    if (preenche) { g.fillStyle = preenche; g.fill(); }
  }
  function desenharSobreposicoes() {
    const v = estado.via;
    if (v?.plano?.segmentos) {
      const cor = { normal: '#5AB0FF', invalido: '#FF7B6E', sugestao: '#D9BD84' }[v.estilo] || '#5AB0FF';
      for (const s of v.plano.segmentos) {
        const c = s.p;
        const pts = Array.from({ length: 33 }, (_, k) => { const t = k / 32, u = 1 - t; const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; return [b[0] * c[0] + b[1] * c[2] + b[2] * c[4] + b[3] * c[6], 0, b[0] * c[1] + b[1] * c[3] + b[2] * c[5] + b[3] * c[7]]; });
        linhaChao(pts, cor, 6);
      }
    }
    if (estado.pincel) circuloChao(estado.pincel.x, estado.pincel.z, estado.pincel.raio, '#5AB0FF', 'rgba(90,176,255,.12)');
    const f = estado.fantasma;
    if (f) {
      circuloChao(f.x, f.z, f.alcance || 0, 'rgba(217,189,132,.8)', 'rgba(217,189,132,.08)');
      const s = tela([f.x, 12, f.z]);
      if (s.z > 1) { g.fillStyle = f.ok === false ? 'rgba(255,123,110,.7)' : 'rgba(90,176,255,.7)'; g.fillRect(s.x - 14, s.y - 14, 28, 28); }
    }
    // marcadores: círculo com o glifo do atlas sobre o topo do prédio
    const p = P();
    for (const m of estado.marcadores) {
      if (!p || !(m.idx < p.n)) continue;
      const s = tela([p.x[m.idx], alturaDe(m.idx) + 8, p.z[m.idx]]);
      if (s.z <= 1) continue;
      g.beginPath(); g.arc(s.x, s.y, 14, 0, 2 * Math.PI);
      g.fillStyle = m.gravidade === 2 || m.gravidade === 'grave' ? '#FF7B6E' : '#F2B14C'; g.fill();
      const a = estado.atlas;
      const r = a?.mapa?.[m.glifo];
      if (a && r) g.drawImage(a.canvas, r[0], r[1], r[2], r[3], s.x - 10, s.y - 10, 20, 20);
    }
  }

  // entrada: arrastar move a câmera; no modo ferramenta os eventos vão para a UI
  let arrasto = null;
  const ponto = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = ponto(e);
    if (estado.modo === 'ferramenta' && estado.aoFerramenta) { estado.aoFerramenta({ fase: 'inicio', x, y, ponto: raioChao(x, y), dedos: 1 }); arrasto = { ferramenta: true }; return; }
    arrasto = { x, y, cx: cam.x, cz: cam.z };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    const { x, y } = ponto(e);
    if (arrasto.ferramenta) { estado.aoFerramenta?.({ fase: 'move', x, y, ponto: raioChao(x, y), dedos: 1 }); return; }
    const k = cam.dist / foco, gu = cam.guinada * RAD;
    const dx = x - arrasto.x, dy = y - arrasto.y;
    cam.x = arrasto.cx - dx * k * Math.cos(gu) + dy * k * Math.sin(gu);
    cam.z = arrasto.cz - dx * k * Math.sin(gu) - dy * k * Math.cos(gu);
    estado.sujo = true;
  });
  addEventListener('pointerup', (e) => {
    if (arrasto?.ferramenta) { const { x, y } = ponto(e); estado.aoFerramenta?.({ fase: 'fim', x, y, ponto: raioChao(x, y), dedos: 1 }); }
    arrasto = null;
  });
  addEventListener('resize', () => { estado.sujo = true; });

  const sujar = () => { estado.sujo = true; };
  const R = {
    falso: true,
    quadro() { if (estado.sujo) { estado.sujo = false; desenhar(); } },
    camera: {
      irPara(alvo = {}, ms = 0) { Object.assign(cam, Object.fromEntries(Object.entries(alvo).filter(([k]) => k in cam))); sujar(); return Promise.resolve(); },
      estado: () => ({ ...cam }),
      definir(e) { Object.assign(cam, e); sujar(); },
    },
    entrada: {
      modo(m) { estado.modo = m; },
      aoFerramenta(fn) { estado.aoFerramenta = fn; },
      opcoes(o) { Object.assign(estado.opcoesEntrada, o); },
    },
    selecionar(x, y) {
      atualizarCamera();
      const p = P();
      if (estado.marcadores.length && p) for (const m of estado.marcadores) {
        const s = tela([p.x[m.idx], alturaDe(m.idx) + 8, p.z[m.idx]]);
        if (s.z > 1 && Math.hypot(s.x - x, s.y - y) <= 16) return { tipo: 'marcador', ref: m.idx + 2 ** 20, idx: m.idx, ponto: [p.x[m.idx], alturaDe(m.idx), p.z[m.idx]] };
      }
      if (p?.n) {
        const ordem = [];
        for (let i = 0; i < p.n; i++) if (p.viva[i]) ordem.push([esc(sub([p.x[i], 0, p.z[i]], olho), frente), i]);
        ordem.sort((a, b) => a[0] - b[0]);
        for (const [prof, i] of ordem) {
          if (prof < 5) continue;
          const { base, topo } = cantos(i);
          const s = [...base, ...topo].map(tela);
          if (s.some((q) => q.z <= 1)) continue;
          if (dentro(cascoConvexo(s), x, y)) return { tipo: 'predio', ref: i + p.ger[i] * 2 ** 20, idx: i, ponto: [p.x[i], alturaDe(i), p.z[i]] };
        }
      }
      const c = raioChao(x, y);
      return c ? { tipo: 'terreno', ref: null, idx: -1, ponto: c } : null;
    },
    projetar(pt) { atualizarCamera(); const s = tela(pt); return { x: s.x, y: s.y, visivel: s.z > 1 && s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H, dist: Math.hypot(...sub(pt, olho)) }; },
    raio(x, y) { atualizarCamera(); return raioChao(x, y); },
    ancoras(lista) { atualizarCamera(); return lista.map((pt) => R.projetar(pt)); },
    camadas: { mostrar(c) { estado.camada = c; sujar(); }, ocultar() { estado.camada = null; sujar(); } },
    ferramenta: {
      via: { previa(plano, estilo = 'normal') { estado.via = plano ? { plano, estilo } : null; sujar(); } },
      zona: { mostrar(b) { estado.zona = !!b; sujar(); }, celulas() { sujar(); } },
      pincel(p) { estado.pincel = p; sujar(); },
      ladrilhos(b) { estado.ladrilhos = !!b; sujar(); },
      fantasma(f) { estado.fantasma = f; sujar(); },
      demolir(refs) { estado.demolir = new Set((refs || []).map((r) => r % 2 ** 20)); sujar(); },
      limpar() { Object.assign(estado, { via: null, pincel: null, fantasma: null, demolir: new Set(), zona: false, ladrilhos: false }); sujar(); },
    },
    marcadores: {
      atlas(cv, mapa) { estado.atlas = { canvas: cv, mapa }; sujar(); },
      definir(lista) { estado.marcadores = lista || []; sujar(); },
    },
    selecionado(s) { const ref = s !== null && typeof s === 'object' ? s.ref : s; estado.selecionado = ref == null ? null : ref % 2 ** 20; sujar(); },
    tempo: { forcar(f) { estado.fase = f?.fase ?? null; sujar(); } },
    sempreDia(b) { estado.sempreDia = !!b; sujar(); },
    estado(e) { estado.estadoR = e; },
    qualidade(id) { estado.qualidade = id; },
    perfil: () => ({ id: estado.qualidade, sugerido: 'media', capac: { clipControl: true, multiDraw: true, timer: false, limites: { amostradores: 16, varyings: 15 } } }),
    // números de mentira no formato do contrato (perto do alvo da 4.8 no Média)
    stats: Object.assign(statsVazio(), {
      calls: 128, tris: 612000, callsSombra: 11, trisSombra: 41000, passes: 6, ms: 16.4, qps: 60, p95: 18.2, gpuMs: 9.1, pr: 1, msaa: 0, perfil: 'media',
      familias: { terreno: 98000, predios: 205000, colocaveis: 22000, arvores: 81000, vias: 71000, vida: 24000, arcologia: 26000, sombra: 41000, resto: 44000 },
      pxPorTri: 1.2, pior: { calls: 141, tris: 640000, ms: 22 }, setores: { lod0: 9, anexos: 3, fila: 0, msEnvio: 0.4 },
      instancias: { predios: 11840, arvores: 150000, carros: 420, pessoas: 900, marcadores: 2 },
      memoria: { geometriaMB: 38, texturasMB: 22, programas: 14 }, capac: { clipControl: true, multiDraw: true, timer: false, limites: {} },
    }),
    bancada: () => Promise.resolve({ perfil: estado.qualidade, sugerido: 'media', msMedio: 21.3, p95: 28.9, qps: 47, calls: 131, tris: 618000, pior: { calls: 146, tris: 655000, ms: 34 }, gpuMs: 14.2, familias: { ...R.stats.familias }, programas: [], capac: R.perfil().capac }),
    capa(w = 640, h = 288) { return new Promise((ok) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(canvas, 0, 0, w, h); c.toBlob(ok, 'image/jpeg', 0.8); }); },
    foto({ w = 1920, h = 1080 } = {}) { return R.capa(w, h); },
    voo() { return Promise.resolve(); },
  };
  desenhar();
  return R;
}
