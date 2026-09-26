// Ícones desenhados em canvas no estilo do SimCity BuildIt: cores saturadas, volume por degradê, luz do alto à esquerda,
// contorno escuro fino (1,8 px) e sombra de contato. Cada desenho é feito num espaço de 96 unidades e tela() dá a
// todos o mesmo acabamento (brilho só onde há tinta, contorno da silhueta, sombra e cor mais viva), a 160 px
// (nítidos até ~58 px CSS em DPR 2,75). Os retratos dos conselheiros ocupam o círculo inteiro, sem contorno.
// prepararIcones() gera todos uma vez como blob: (URLs curtas no HTML dos painéis); o que faltar sai na hora
// como data: URL.
import { PREDIOS } from '../data/itens.js';
const cache = new Map();
const S = 160, K = S / 96;
function lin(c, x0, y0, x1, y1, st) { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function rad(c, x, y, r0, r1, st) { const g = c.createRadialGradient(x, y, r0, x, y, r1); st.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function contorno(c, w = 2.2) { c.lineWidth = w; c.strokeStyle = 'rgba(22,28,50,.6)'; c.stroke(); }
// (a sombra no chão virou a sombra projetada do acabamento: fica só para não mexer nos desenhos)
function sombra() {}
// reflexo: mancha branca suave (o brilho de plástico dos ícones do BuildIt)
function reflexo(c, x, y, rx, ry, a = 0.7, rot = -0.5) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, ry / rx); c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fillStyle = rad(c, 0, 0, 0, rx, [[0, `rgba(255,255,255,${a})`], [1, 'rgba(255,255,255,0)']]); c.fill(); c.restore(); }
function estrela(c, x, y, r0, r1, n = 5, rot = -Math.PI / 2) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n; const r = i % 2 ? r0 : r1; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
function tora(c, x, y, r, L) {
  c.beginPath(); rr(c, x - L / 2, y - r, L, r * 2, r * 0.5); c.fillStyle = lin(c, 0, y - r, 0, y + r, [[0, '#f0ae62'], [0.45, '#c47634'], [1, '#7c3f16']]); c.fill(); contorno(c, 1.6);
  c.beginPath(); c.ellipse(x + L / 2, y, r * 0.55, r, 0, 0, 7); c.fillStyle = rad(c, x + L / 2 - 2, y - 3, 1, r, [[0, '#ffe7b8'], [1, '#eab676']]); c.fill(); contorno(c, 1.6);
  c.strokeStyle = 'rgba(176,104,40,.85)'; c.lineWidth = 1.2; for (const k of [0.6, 0.3]) { c.beginPath(); c.ellipse(x + L / 2, y, r * 0.55 * k, r * k, 0, 0, 7); c.stroke(); }
}
function caixa(c, x, y, w, h, d, top, frente, lado) { // bloco isométrico simples
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w + d, y - d * 0.6); c.lineTo(x + d, y - d * 0.6); c.closePath(); c.fillStyle = top; c.fill(); contorno(c, 1.5);
  c.beginPath(); c.rect(x, y, w, h); c.fillStyle = frente; c.fill(); contorno(c, 1.5);
  c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + d, y - d * 0.6); c.lineTo(x + w + d, y - d * 0.6 + h); c.lineTo(x + w, y + h); c.closePath(); c.fillStyle = lado; c.fill(); contorno(c, 1.5);
}
function folha(c, x, y, s, a, cor = '#4fb83a') { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 0.6, -s * 0.5, 0, -s); c.quadraticCurveTo(-s * 0.6, -s * 0.5, 0, 0); c.fillStyle = lin(c, 0, -s, 0, 0, [[0, '#b8f06a'], [1, cor]]); c.fill(); contorno(c, 1.3); c.restore(); }
function vaso(c, x, y) { c.beginPath(); c.moveTo(x - 16, y); c.lineTo(x + 16, y); c.lineTo(x + 12, y + 20); c.lineTo(x - 12, y + 20); c.closePath(); c.fillStyle = lin(c, x - 16, 0, x + 16, 0, [[0, '#f0824a'], [1, '#b44a22']]); c.fill(); contorno(c); c.fillStyle = '#7a4a26'; c.fillRect(x - 15, y - 1, 30, 4); }
function saco(c, cor1, cor2, rotulo) {
  c.beginPath(); c.moveTo(26, 30); c.quadraticCurveTo(48, 20, 70, 30); c.lineTo(74, 76); c.quadraticCurveTo(48, 84, 22, 76); c.closePath(); c.fillStyle = lin(c, 22, 0, 74, 0, [[0, cor1], [1, cor2]]); c.fill(); contorno(c);
  c.beginPath(); c.moveTo(30, 30); c.lineTo(66, 30); c.lineTo(62, 22); c.lineTo(34, 22); c.closePath(); c.fillStyle = cor2; c.fill(); contorno(c, 1.5);
  if (rotulo) rotulo();
}
// capacete de obra (o do botão Obras): casco, crista, aba larga e reflexo
function capacete(c, cores, emblema) {
  const [claro, meio, escuro] = cores;
  c.beginPath(); c.moveTo(16, 64); c.bezierCurveTo(14, 30, 34, 16, 50, 16); c.bezierCurveTo(68, 16, 84, 32, 82, 64); c.closePath();
  c.fillStyle = rad(c, 38, 28, 3, 60, [[0, claro], [0.55, meio], [1, escuro]]); c.fill(); contorno(c, 2.4);
  c.beginPath(); c.moveTo(42, 18); c.bezierCurveTo(40, 34, 40, 50, 42, 64); c.lineTo(56, 64); c.bezierCurveTo(58, 50, 58, 34, 56, 18); c.closePath(); c.fillStyle = lin(c, 42, 0, 56, 0, [[0, meio], [0.5, claro], [1, meio]]); c.fill(); contorno(c, 1.6);
  c.beginPath(); c.ellipse(49, 66, 42, 11, -0.06, 0, 7); c.fillStyle = lin(c, 0, 56, 0, 78, [[0, claro], [0.5, meio], [1, escuro]]); c.fill(); contorno(c, 2.2);
  c.beginPath(); c.ellipse(49, 63, 32, 5, -0.06, Math.PI, 0); c.strokeStyle = 'rgba(120,60,0,.35)'; c.lineWidth = 2; c.stroke();
  if (emblema) emblema();
  reflexo(c, 32, 34, 11, 6, 0.85, -0.9);
}
// folha do bem-estar (no lugar da carinha): humor 1 folha verde de pé com um brilho, 0 amarelada e inclinada, -1 laranja,
// caída, com a ponta enrolada e manchas (forma e cor mudam juntas, para quem não distingue as cores)
function folhaBem(c, cores, humor) {
  c.save(); c.translate(46, 50); c.rotate(humor > 0 ? -0.3 : humor === 0 ? 0.38 : 1.2);
  c.strokeStyle = cores[2]; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(1, 36, -5, 42); c.stroke();
  c.beginPath(); c.moveTo(0, 30);
  if (humor < 0) { c.bezierCurveTo(-30, 18, -30, -22, -4, -34); c.quadraticCurveTo(7, -41, 11, -30); c.quadraticCurveTo(4, -31, 6, -24); c.bezierCurveTo(30, -12, 27, 18, 0, 30); }
  else { c.bezierCurveTo(-32, 16, -30, -26, 0, -40); c.bezierCurveTo(30, -26, 32, 16, 0, 30); }
  c.closePath(); c.fillStyle = rad(c, -10, -14, 3, 52, [[0, cores[0]], [0.55, cores[1]], [1, cores[2]]]); c.fill(); contorno(c, 2.2);
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(2, -2, 0, humor < 0 ? -24 : -34); c.stroke();
  c.lineWidth = 1.7; for (const y of [12, -2, -16]) for (const k of [-1, 1]) { c.beginPath(); c.moveTo(0.5, y); c.quadraticCurveTo(k * 9, y - 3, k * 16, y - 11); c.stroke(); }
  if (humor < 0) { c.fillStyle = 'rgba(122,56,16,.55)'; for (const [x, y, r] of [[-12, 4, 4], [10, -8, 3], [8, 14, 2.6]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } }
  c.restore();
  if (humor > 0) { estrela(c, 76, 20, 2.6, 10, 4); c.fillStyle = '#ffffff'; c.fill(); contorno(c, 1.3); }
  if (humor >= 0) reflexo(c, 36, 32, 8, 4, 0.6, -0.9);
}
// planta da composição vista de cima (Composição concluída): prato claro da maquete, mata, lago, Sede, Anel do
// Campus, Biblioteca, Bioma e os caminhos
function plantaSitio(c) {
  c.beginPath(); c.arc(48, 48, 42, 0, 7); c.fillStyle = lin(c, 0, 6, 0, 90, [[0, '#fffaf0'], [1, '#d6cab2']]); c.fill(); contorno(c, 2.2);
  c.beginPath(); c.arc(48, 48, 37, 0, 7); c.fillStyle = rad(c, 40, 36, 4, 46, [[0, '#a6e072'], [1, '#3f8a2a']]); c.fill(); contorno(c, 1.2);
  c.save(); c.beginPath(); c.arc(48, 48, 37, 0, 7); c.clip();
  c.strokeStyle = '#fbf3e0'; c.lineCap = 'round'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(12, 72); c.quadraticCurveTo(40, 60, 52, 71); c.quadraticCurveTo(62, 80, 86, 70); c.stroke();
  c.beginPath(); c.ellipse(55, 30, 14, 8.5, -0.25, 0, 7); c.fillStyle = rad(c, 50, 27, 1, 15, [[0, '#c8f0ff'], [1, '#2f8fd8']]); c.fill(); contorno(c, 1.3);
  c.strokeStyle = '#fffaf0'; c.lineWidth = 4.6; c.beginPath(); c.arc(55, 36, 19, Math.PI * 1.1, Math.PI * 1.62); c.stroke();
  c.restore();
  c.beginPath(); c.arc(31, 55, 15, 0, Math.PI * 2); c.moveTo(39.5, 55); c.arc(31, 55, 8.5, 0, Math.PI * 2, true); c.fillStyle = '#fffaf0'; c.fill(); contorno(c, 1.4);
  c.beginPath(); c.arc(31, 55, 8.5, 0, 7); c.fillStyle = rad(c, 29, 53, 1, 9, [[0, '#7cd05a'], [1, '#2f7a22']]); c.fill(); contorno(c, 1);
  c.beginPath(); c.arc(66, 57, 7, 0, 7); c.fillStyle = rad(c, 64, 55, 1, 8, [[0, '#ffffff'], [1, '#d8d0c0']]); c.fill(); contorno(c, 1.3);
  c.beginPath(); c.arc(76, 42, 5.5, 0, 7); c.fillStyle = rad(c, 74, 40, 1, 6, [[0, '#e8fbff'], [1, '#6cc4ec']]); c.fill(); contorno(c, 1.2);
}
// Anel do Campus visto de cima (selo do nível): o prédio em coroa branca quente com as janelas acesas, o terraço e o
// campo no centro. No selo do HUD o terraço fica vazado (o XP o pinta por baixo, em verde, no sentido horário);
// cheio = o terraço verde (o selo do modal de subir de nível).
function anelCampus(c, cheio) {
  const X = 48, Y = 48, O = Math.PI * 2, coroa = (a, b) => { c.beginPath(); c.arc(X, Y, b, 0, O); c.moveTo(X + a, Y); c.arc(X, Y, a, 0, O, true); };
  c.beginPath(); c.arc(X, Y, 46, 0, O); c.fillStyle = rad(c, 34, 28, 4, 64, [[0, '#ffffff'], [0.55, '#f6f1e6'], [1, '#d6c9b0']]); c.fill(); contorno(c, 2.2);
  c.strokeStyle = 'rgba(96,78,50,.45)'; c.lineWidth = 1.1; c.beginPath(); c.arc(X, Y, 44.2, 0, O); c.stroke();
  c.save(); c.setLineDash([3.2, 2.2]); c.strokeStyle = '#eeae48'; c.lineWidth = 2.6; c.beginPath(); c.arc(X, Y, 40.8, 0, O); c.stroke(); c.restore();
  if (cheio) { coroa(21.5, 36.5); c.fillStyle = rad(c, 38, 34, 4, 50, [[0, '#a6e27c'], [1, '#4f9a36']]); c.fill(); contorno(c, 1.2); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.3; c.beginPath(); c.arc(X, Y, 29, 0, O); c.stroke(); }
  else { c.save(); c.globalCompositeOperation = 'destination-out'; coroa(21.5, 36.5); c.fill(); c.restore(); }
  c.beginPath(); c.arc(X, Y, 21.5, 0, O); c.fillStyle = '#f6f1e6'; c.fill(); contorno(c, 1.2);
  c.beginPath(); c.arc(X, Y, 19, 0, O); c.fillStyle = rad(c, 43, 42, 2, 22, [[0, '#62b842'], [1, '#2c6f20']]); c.fill(); contorno(c, 1.2);
  c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.1; c.beginPath(); c.arc(X, Y, 15, 0, O); c.stroke();
}
// ---- prédios do canteiro: os galpões do mundo (render/models/canteiro.js), fachada de frente e o fundo em oblíquo ----
const PAREDE = { branca: ['#fffdf7', '#e8e1d3', '#c3baa8'], chapa: ['#f4f7fa', '#cdd5de', '#96a2b0'], madeira: ['#f8d7a4', '#dca466', '#a86e36'], concreto: ['#eceae4', '#c6c1b7', '#9b968c'] };
const bez = (a, b, e, d, t) => { const u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * e + t * t * t * d; };
// galpão: fachada (x, y, w, h), fundo d; telhado 'abobada' (chapa curva), 'serra' (dentes azuis com vidro âmbar) ou
// 'vidro' (estufa); porta 'vidro' (âmbar), 'enrolar' (de aço) ou nenhuma; dentro(c) desenha o que aparece pelo vidro
function galpao(c, x, y, w, h, d, par, tel = 'abobada', porta = 'vidro', dentro = null) {
  const dx = d, dy = -d * 0.6, vid = tel === 'vidro', n = 4, p = w / n, t = Math.min(h * 0.45, p * 0.9), r = Math.min(w * 0.26, 15), k = (r * 4) / 3;
  c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w + dx, y + dy); c.lineTo(x + w + dx, y + h + dy); c.lineTo(x + w, y + h); c.closePath(); c.fillStyle = par[2]; c.fill(); contorno(c, 1.4);
  if (tel === 'serra') for (let i = 0; i < n; i++) { const x0 = x + i * p, x1 = x0 + p;
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y - t); c.lineTo(x1 + dx, y - t + dy); c.lineTo(x0 + dx, y + dy); c.closePath(); c.fillStyle = lin(c, 0, y - t + dy, 0, y, [[0, '#9ad6ff'], [1, '#2a7fd4']]); c.fill(); contorno(c, 1.2);
    c.beginPath(); c.moveTo(x1, y - t); c.lineTo(x1, y); c.lineTo(x1 + dx, y + dy); c.lineTo(x1 + dx, y - t + dy); c.closePath(); c.fillStyle = lin(c, x1, 0, x1 + dx, 0, [[0, '#fff0c0'], [1, '#f2b24a']]); c.fill(); contorno(c, 1.2); }
  else {
    c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x, y - k, x + w, y - k, x + w, y); c.lineTo(x + w + dx, y + dy); c.bezierCurveTo(x + w + dx, y + dy - k, x + dx, y + dy - k, x + dx, y + dy); c.closePath();
    c.fillStyle = vid ? 'rgba(200,238,250,.8)' : lin(c, 0, y - r + dy, 0, y, [[0, '#ffffff'], [0.55, '#d6dde5'], [1, '#98a3b0']]); c.fill(); contorno(c, 1.4);
    c.strokeStyle = vid ? 'rgba(255,255,255,.95)' : 'rgba(96,110,128,.5)'; c.lineWidth = vid ? 1.6 : 1.1;
    for (let s = 0.125; s < 1; s += 0.125) { const px = bez(x, x, x + w, x + w, s), py = bez(y, y - k, y - k, y, s); c.beginPath(); c.moveTo(px, py); c.lineTo(px + dx, py + dy); c.stroke(); }
  }
  if (dentro) dentro(c);
  c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y);
  if (tel === 'serra') for (let i = 0; i < n; i++) { const x1 = x + (i + 1) * p; c.lineTo(x1, y - t); c.lineTo(x1, y); } else c.bezierCurveTo(x, y - k, x + w, y - k, x + w, y);
  c.lineTo(x + w, y + h); c.closePath();
  c.fillStyle = vid ? 'rgba(206,242,252,.5)' : lin(c, 0, y - (tel === 'serra' ? t : r), 0, y + h, [[0, par[0]], [1, par[1]]]); c.fill(); contorno(c, 1.5);
  if (vid) { c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.6; for (let i = 1; i < 4; i++) { const xx = x + (i * w) / 4; c.beginPath(); c.moveTo(xx, y + h); c.lineTo(xx, y - Math.sin((i / 4) * Math.PI) * r); c.stroke(); } c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.stroke(); }
  if (porta === 'vidro') { const pw = w * 0.3, ph = h * 0.64, px = x + (w - pw) / 2; rr(c, px, y + h - ph, pw, ph, 1.5); c.fillStyle = lin(c, 0, y + h - ph, 0, y + h, [[0, '#fff0c0'], [1, '#eaa640']]); c.fill(); contorno(c, 1.2); c.strokeStyle = 'rgba(130,76,20,.45)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + pw / 2, y + h - ph); c.lineTo(px + pw / 2, y + h); c.stroke(); }
  else if (porta === 'enrolar') { const pw = w * 0.46, ph = h * 0.7, px = x + (w - pw) / 2; c.beginPath(); c.rect(px, y + h - ph, pw, ph); c.fillStyle = lin(c, 0, y + h - ph, 0, y + h, [[0, '#8a97a6'], [1, '#56626f']]); c.fill(); contorno(c, 1.2); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; for (let yy = y + h - ph + 3; yy < y + h; yy += 3.2) { c.beginPath(); c.moveTo(px + 1, yy); c.lineTo(px + pw - 1, yy); c.stroke(); } }
}
// contêiner do Escritório: chapa com nervuras e a faixa de janela âmbar
function conteiner(c, x, y, w, h, d, azul) {
  const P = azul ? ['#9ccff4', '#3f8ccc', '#2a6496'] : ['#ffffff', '#ebe4d6', '#c4bba9'];
  caixa(c, x, y, w, h, d, P[0], lin(c, 0, y, 0, y + h, [[0, P[0]], [1, P[1]]]), P[2]);
  c.strokeStyle = 'rgba(20,40,70,.2)'; c.lineWidth = 1; for (let i = 1; i < 8; i++) { const xx = x + (i * w) / 8; c.beginPath(); c.moveTo(xx, y + 2); c.lineTo(xx, y + h - 2); c.stroke(); }
  rr(c, x + w * 0.14, y + h * 0.3, w * 0.62, h * 0.34, 1.5); c.fillStyle = lin(c, 0, y + h * 0.3, 0, y + h * 0.64, [[0, '#fff0c0'], [1, '#f2b24a']]); c.fill(); contorno(c, 1.1);
}
// silo de chapa com o chapéu cônico
function silo(c, x, yb, r, h) {
  c.beginPath(); c.moveTo(x - r, yb - h); c.lineTo(x - r, yb); c.ellipse(x, yb, r, r * 0.35, 0, Math.PI, 0, true); c.lineTo(x + r, yb - h); c.closePath();
  c.fillStyle = lin(c, x - r, 0, x + r, 0, [[0, '#ffffff'], [0.4, '#dfe5ec'], [1, '#8a96a4']]); c.fill(); contorno(c, 1.3);
  c.strokeStyle = 'rgba(96,110,128,.45)'; c.lineWidth = 1; for (const q of [0.3, 0.62]) { c.beginPath(); c.ellipse(x, yb - h * q, r, r * 0.35, 0, 0, Math.PI); c.stroke(); }
  c.beginPath(); c.moveTo(x - r - 1.2, yb - h); c.lineTo(x, yb - h - r * 0.95); c.lineTo(x + r + 1.2, yb - h); c.ellipse(x, yb - h, r + 1.2, r * 0.38, 0, 0, Math.PI); c.closePath();
  c.fillStyle = lin(c, x - r, 0, x + r, 0, [[0, '#f6f8fa'], [1, '#7c8896']]); c.fill(); contorno(c, 1.3);
}
function tronco(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = rad(c, x - r * 0.3, y - r * 0.35, 1, r * 1.1, [[0, '#ffe6b8'], [0.7, '#e3aa66'], [1, '#b8742c']]); c.fill(); contorno(c, 1.4); c.strokeStyle = 'rgba(168,104,44,.75)'; c.lineWidth = 1.1; for (const k of [0.55, 0.2]) { c.beginPath(); c.arc(x, y, r * k, 0, 7); c.stroke(); } }
// selo redondo na fachada da usina: reciclagem (materiais) ou coração (pedidos da comunidade)
function seloUsina(c, x, y, coracao) {
  c.beginPath(); c.arc(x, y, 8.5, 0, 7); c.fillStyle = rad(c, x - 3, y - 3, 1, 9, [[0, '#ffffff'], [1, '#e2eef6']]); c.fill(); contorno(c, 1.3);
  if (coracao) { c.beginPath(); c.moveTo(x, y + 5); c.bezierCurveTo(x - 9, y - 1, x - 5, y - 8, x, y - 3.5); c.bezierCurveTo(x + 5, y - 8, x + 9, y - 1, x, y + 5); c.closePath(); c.fillStyle = lin(c, 0, y - 7, 0, y + 5, [[0, '#ff8a7a'], [1, '#e0352a']]); c.fill(); contorno(c, 1.1); return; }
  c.save(); c.translate(x, y); c.strokeStyle = '#2fae3a'; c.lineWidth = 2.3; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.rotate((Math.PI * 2) / 3); c.beginPath(); c.arc(0, 0, 5, 0.2, 1.6); c.stroke(); c.beginPath(); c.moveTo(5 * Math.cos(1.6) - 2, 5 * Math.sin(1.6)); c.lineTo(5 * Math.cos(1.6) + 0.8, 5 * Math.sin(1.6) + 2.6); c.stroke(); } c.restore();
}
// usina: galpão branco com telhado em dente de serra, silos (um, dois ou três: I, II e III), esteira e monte de brita
function usinaIc(c, n, coracao) {
  for (let i = n - 1; i >= 0; i--) silo(c, 72 + i * 8, 68 - i * 4, 7.5, 38 - i * 3);
  galpao(c, 4, 46, 56, 28, 18, PAREDE.branca, 'serra', null);
  c.strokeStyle = '#3a3f48'; c.lineWidth = 4.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(58, 62); c.lineTo(78, 78); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(58, 60.5); c.lineTo(78, 76.5); c.stroke();
  c.beginPath(); c.moveTo(66, 88); c.quadraticCurveTo(79, 64, 94, 88); c.closePath(); c.fillStyle = rad(c, 78, 76, 1, 18, [[0, '#dcd8d0'], [1, '#8a857c']]); c.fill(); contorno(c, 1.3);
  c.fillStyle = 'rgba(80,76,70,.5)'; for (const [x, y] of [[76, 82], [82, 79], [86, 84], [80, 85], [72, 85]]) { c.beginPath(); c.arc(x, y, 1.3, 0, 7); c.fill(); }
  seloUsina(c, 32, 62, coracao);
}
function betoneira(c, x, y) {
  c.strokeStyle = '#6d7884'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 8, y + 12); c.lineTo(x - 2, y + 1); c.lineTo(x + 8, y + 12); c.stroke();
  c.save(); c.translate(x, y); c.rotate(-0.55);
  c.beginPath(); c.moveTo(-14, -9); c.quadraticCurveTo(-4, -13, 8, -7); c.lineTo(14, -4); c.lineTo(14, 4); c.lineTo(8, 7); c.quadraticCurveTo(-4, 13, -14, 9); c.quadraticCurveTo(-18, 0, -14, -9); c.closePath();
  c.fillStyle = lin(c, 0, -12, 0, 12, [[0, '#ffc07a'], [0.5, '#ff8a1c'], [1, '#c45408']]); c.fill(); contorno(c, 1.5);
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2.2; for (const xx of [-7, 1]) { c.beginPath(); c.moveTo(xx, -11); c.quadraticCurveTo(xx + 3, 0, xx, 11); c.stroke(); }
  c.beginPath(); c.ellipse(14, 0, 2.5, 4.5, 0, 0, 7); c.fillStyle = '#3a3f48'; c.fill(); contorno(c, 1.1); c.restore();
}
// carretel de madeira com o cabo laranja enrolado
function bobina(c, x, y) {
  c.beginPath(); c.ellipse(x + 6, y, 6, 13, 0, 0, 7); c.fillStyle = '#a86e36'; c.fill(); contorno(c, 1.3);
  c.beginPath(); c.rect(x - 6, y - 9, 12, 18); c.fillStyle = lin(c, 0, y - 9, 0, y + 9, [[0, '#ffb070'], [1, '#d0581a']]); c.fill(); contorno(c, 1.2);
  c.strokeStyle = 'rgba(120,40,0,.45)'; c.lineWidth = 1; for (let yy = y - 6; yy <= y + 6; yy += 3) { c.beginPath(); c.moveTo(x - 6, yy); c.lineTo(x + 6, yy); c.stroke(); }
  c.beginPath(); c.ellipse(x - 6, y, 6, 13, 0, 0, 7); c.fillStyle = rad(c, x - 8, y - 4, 1, 13, [[0, '#f6cf98'], [1, '#b8742c']]); c.fill(); contorno(c, 1.3);
  c.beginPath(); c.ellipse(x - 6, y, 1.8, 4, 0, 0, 7); c.fillStyle = '#5a3418'; c.fill();
}
function painelSolar(c, P) {
  c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = lin(c, P[0][0], P[0][1], P[2][0], P[2][1], [[0, '#7cc8ff'], [1, '#1c4f9c']]); c.fill(); contorno(c, 1.4);
  const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; c.strokeStyle = 'rgba(220,240,255,.7)'; c.lineWidth = 1;
  for (const t of [1 / 3, 2 / 3]) for (const [a, b, e, f] of [[P[0], P[1], P[3], P[2]], [P[0], P[3], P[1], P[2]]]) { c.beginPath(); c.moveTo(...L(a, b, t)); c.lineTo(...L(e, f, t)); c.stroke(); }
}
// sol (horas do dia no Apreciar): n raios, cor do disco
function sol(c, x, y, r, cores, raios = 10) {
  c.save(); c.translate(x, y); c.fillStyle = lin(c, 0, -r * 1.7, 0, r * 1.7, [[0, '#ffe766'], [1, '#ffa31a']]);
  for (let i = 0; i < raios; i++) { c.rotate((Math.PI * 2) / raios); c.beginPath(); c.moveTo(-r * 0.28, -r * 1.1); c.lineTo(0, -r * 1.62); c.lineTo(r * 0.28, -r * 1.1); c.closePath(); c.fill(); contorno(c, 1.3); }
  c.restore(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = rad(c, x - r * 0.3, y - r * 0.35, 1, r * 1.1, [[0, cores[0]], [0.6, cores[1]], [1, cores[2]]]); c.fill(); contorno(c, 2);
}

const D = {
  madeira(c) { sombra(c); tora(c, 44, 68, 11, 50); tora(c, 54, 68, 11, 50); tora(c, 49, 48, 11, 50); },
  brita(c) { sombra(c); const pts = [[30, 70, 12], [50, 72, 13], [68, 70, 11], [40, 56, 12], [60, 56, 11], [50, 42, 10]]; pts.forEach(([x, y, r], i) => { c.beginPath(); c.ellipse(x, y, r, r * 0.85, i, 0, 7); c.fillStyle = rad(c, x - 4, y - 5, 1, r * 1.3, [[0, '#f4f6f8'], [1, ['#8e98a4', '#a8b2bc', '#7c8794'][i % 3]]]); c.fill(); contorno(c, 1.5); }); },
  aco(c) { sombra(c); for (let i = 0; i < 3; i++) { c.save(); c.translate(48, 60 - i * 12); c.rotate(-0.35); rr(c, -34, -5, 68, 10, 3); c.fillStyle = lin(c, 0, -5, 0, 5, [[0, '#f6faff'], [0.5, '#9cb2c8'], [1, '#566c84']]); c.fill(); contorno(c, 1.5); c.restore(); } },
  argila(c) { sombra(c); c.beginPath(); c.moveTo(22, 74); c.bezierCurveTo(14, 50, 34, 28, 52, 30); c.bezierCurveTo(74, 30, 84, 56, 74, 74); c.quadraticCurveTo(48, 82, 22, 74); c.fillStyle = rad(c, 40, 40, 4, 50, [[0, '#f7a064'], [1, '#b04c1c']]); c.fill(); contorno(c); c.fillStyle = 'rgba(255,220,190,.25)'; c.beginPath(); c.ellipse(40, 42, 10, 5, -0.4, 0, 7); c.fill(); },
  mudas(c) { sombra(c); for (const [x, y] of [[34, 72], [48, 76], [62, 72], [42, 64], [56, 64]]) { c.beginPath(); c.ellipse(x, y, 7, 5, 0.3, 0, 7); c.fillStyle = '#8a5a2e'; c.fill(); contorno(c, 1.2); } c.strokeStyle = '#3a8a26'; c.lineWidth = 3; c.beginPath(); c.moveTo(49, 62); c.quadraticCurveTo(46, 44, 50, 34); c.stroke(); folha(c, 50, 38, 20, -0.9); folha(c, 50, 42, 18, 0.9); },
  vidro(c) { sombra(c); c.beginPath(); c.moveTo(24, 76); c.lineTo(38, 24); c.lineTo(72, 30); c.lineTo(74, 76); c.closePath(); c.fillStyle = lin(c, 24, 24, 74, 76, [[0, 'rgba(200,240,255,.95)'], [0.5, 'rgba(110,190,225,.85)'], [1, 'rgba(60,140,190,.9)']]); c.fill(); contorno(c); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(40, 34); c.lineTo(34, 58); c.stroke(); },
  cobre(c) { sombra(c); for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(48, 56, 30 - i * 5, 20 - i * 3.4, 0, 0, 7); c.lineWidth = 5; c.strokeStyle = i % 2 ? '#ff9c54' : '#c85c1c'; c.stroke(); } c.beginPath(); c.arc(48, 56, 5, 0, 7); c.fillStyle = '#6b3a18'; c.fill(); },
  fibra(c) { sombra(c); for (let i = 0; i < 4; i++) { const x = 30 + i * 12; c.save(); c.translate(x, 54); c.rotate(-0.15 + i * 0.1); rr(c, -5, -30, 10, 60, 4); c.fillStyle = lin(c, -5, 0, 5, 0, [[0, '#f6e67a'], [1, '#b0a232']]); c.fill(); contorno(c, 1.4); for (const y of [-12, 8]) { c.fillStyle = '#7e7a2a'; c.fillRect(-5, y, 10, 2.5); } c.restore(); } },
  viga(c) { sombra(c); caixa(c, 14, 50, 58, 16, 14, '#f8d08a', '#e2a052', '#b8742c'); c.strokeStyle = 'rgba(120,80,40,.5)'; c.lineWidth = 1.2; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(14, 50 + k * 4); c.lineTo(72, 50 + k * 4); c.stroke(); } },
  deque(c) { sombra(c); for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(18 + i * 4, 40 + i * 8); c.lineTo(66 + i * 4, 32 + i * 8); c.lineTo(68 + i * 4, 38 + i * 8); c.lineTo(20 + i * 4, 46 + i * 8); c.closePath(); c.fillStyle = i % 2 ? '#e2a052' : '#f0b866'; c.fill(); contorno(c, 1.3); } },
  trelica(c) { sombra(c); c.lineWidth = 7; c.lineJoin = 'round'; c.strokeStyle = '#8a5a2e'; const P = [[14, 74], [82, 74], [48, 26]]; c.beginPath(); c.moveTo(...P[0]); c.lineTo(...P[1]); c.lineTo(...P[2]); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(31, 50); c.lineTo(38, 74); c.lineTo(48, 26); c.lineTo(58, 74); c.lineTo(65, 50); c.stroke(); c.lineWidth = 4; c.strokeStyle = '#f0b866'; c.beginPath(); c.moveTo(...P[0]); c.lineTo(...P[1]); c.lineTo(...P[2]); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(31, 50); c.lineTo(38, 74); c.lineTo(48, 26); c.lineTo(58, 74); c.lineTo(65, 50); c.stroke(); },
  estante(c) { sombra(c); rr(c, 20, 18, 56, 64, 4); c.fillStyle = '#b06a2c'; c.fill(); contorno(c); const cores = ['#f04a3a', '#2e9cf0', '#ffcc3a', '#6fd39a', '#b69cff', '#f5f0e6']; for (let r = 0; r < 3; r++) { c.fillStyle = '#7c4418'; c.fillRect(24, 22 + r * 20, 48, 17); for (let b = 0; b < 7; b++) { c.fillStyle = cores[(r * 3 + b) % 6]; c.fillRect(26 + b * 6.4, 25 + r * 20 + (b % 3), 5, 14 - (b % 3)); } } },
  cimento(c) { sombra(c); saco(c, '#c9c6bd', '#8e8a82', () => { c.beginPath(); c.arc(48, 56, 11, 0, 7); c.fillStyle = '#5cc83a'; c.fill(); folha(c, 48, 62, 14, 0, '#2e8a22'); }); },
  concreto(c) { sombra(c); caixa(c, 22, 44, 40, 32, 16, '#d8d5ce', '#aaa69e', '#8c8880'); c.fillStyle = 'rgba(80,76,70,.35)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(26 + ((i * 37) % 34), 48 + ((i * 23) % 26), 1.6, 0, 7); c.fill(); } },
  bloco(c) { sombra(c); caixa(c, 16, 46, 52, 26, 14, '#e39a6a', '#c4643a', '#9e4a28'); c.fillStyle = '#6e3018'; for (const x of [30, 52]) { c.beginPath(); c.ellipse(x, 42, 6, 3, 0, 0, 7); c.fill(); } },
  premoldado(c) { sombra(c); caixa(c, 10, 52, 64, 16, 18, '#dcd9d2', '#b6b2aa', '#95918a'); c.fillStyle = '#6a665e'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(18 + i * 12, 60, 4, 0, 7); c.fill(); } },
  substrato(c) { sombra(c); saco(c, '#7a5a3a', '#4e3622', () => { folha(c, 42, 62, 14, -0.5); folha(c, 54, 62, 14, 0.5); }); },
  grama(c) { sombra(c); c.beginPath(); c.ellipse(64, 60, 14, 18, 0, 0, 7); c.fillStyle = '#6b4a2e'; c.fill(); contorno(c); c.beginPath(); c.ellipse(64, 60, 9, 12, 0, 0, 7); c.fillStyle = '#3a8a26'; c.fill(); rr(c, 16, 42, 48, 36, 6); c.fillStyle = lin(c, 0, 42, 0, 78, [[0, '#a6ee6a'], [1, '#3a8a26']]); c.fill(); contorno(c); c.strokeStyle = '#2e7a20'; c.lineWidth = 1.5; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(20 + i * 3.6, 44); c.lineTo(19 + i * 3.6, 38); c.stroke(); } },
  muda(c) { sombra(c); vaso(c, 48, 60); c.strokeStyle = '#5a3a1e'; c.lineWidth = 4; c.beginPath(); c.moveTo(48, 60); c.lineTo(48, 32); c.stroke(); c.beginPath(); c.arc(48, 30, 18, 0, 7); c.fillStyle = rad(c, 42, 22, 2, 22, [[0, '#a6ee6a'], [1, '#2e8a22']]); c.fill(); contorno(c); },
  jardim(c) { sombra(c); rr(c, 22, 14, 52, 68, 5); c.fillStyle = '#50667c'; c.fill(); contorno(c); for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(32 + k * 16, 24 + r * 16, 8, 0, 7); c.fillStyle = ['#5cc83a', '#3c9a2a', '#86dc5a'][(r + k) % 3]; c.fill(); } c.fillStyle = '#f04a3a'; c.beginPath(); c.arc(40, 40, 3, 0, 7); c.fill(); c.fillStyle = '#ffcc3a'; c.beginPath(); c.arc(58, 64, 3, 0, 7); c.fill(); },
  perfil(c) { sombra(c); c.save(); c.translate(48, 56); c.rotate(-0.3); const g = lin(c, 0, -20, 0, 20, [[0, '#eef2f6'], [1, '#6d7884']]); c.fillStyle = g; c.beginPath(); c.rect(-36, -18, 72, 7); c.rect(-36, 11, 72, 7); c.rect(-36, -4, 72, 8); c.fill(); c.fillStyle = '#98acc0'; c.fillRect(-36, -11, 72, 22); c.fillStyle = g; c.fillRect(-36, -18, 72, 7); c.fillRect(-36, 11, 72, 7); c.strokeStyle = 'rgba(20,16,12,.55)'; c.lineWidth = 1.6; c.strokeRect(-36, -18, 72, 36); c.restore(); },
  conector(c) { sombra(c); c.save(); c.translate(38, 54); c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); } c.closePath(); c.fillStyle = lin(c, -18, -18, 18, 18, [[0, '#eef4fa'], [1, '#6c8298']]); c.fill(); contorno(c); c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fillStyle = '#4a545e'; c.fill(); c.restore(); c.save(); c.translate(64, 52); c.rotate(0.4); c.fillStyle = lin(c, -5, 0, 5, 0, [[0, '#dfe4ea'], [1, '#6c8298']]); c.fillRect(-5, -6, 10, 36); c.fillRect(-11, -12, 22, 8); c.restore(); },
  guarda(c) { sombra(c); rr(c, 20, 30, 56, 44, 3); c.fillStyle = 'rgba(160,215,240,.55)'; c.fill(); contorno(c); c.fillStyle = '#98acc0'; c.fillRect(16, 24, 64, 7); c.fillRect(18, 24, 6, 54); c.fillRect(72, 24, 6, 54); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(34, 40); c.lineTo(28, 62); c.stroke(); },
  no(c) { sombra(c); c.lineWidth = 6; c.strokeStyle = '#98acc0'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; c.beginPath(); c.moveTo(48, 54); c.lineTo(48 + Math.cos(a) * 34, 54 + Math.sin(a) * 26); c.stroke(); } c.beginPath(); c.arc(48, 54, 12, 0, 7); c.fillStyle = rad(c, 44, 50, 2, 14, [[0, '#ffffff'], [1, '#6c8298']]); c.fill(); contorno(c); },
  painel(c) { sombra(c); c.beginPath(); c.moveTo(20, 76); c.lineTo(28, 20); c.lineTo(76, 26); c.lineTo(70, 80); c.closePath(); c.fillStyle = lin(c, 20, 20, 76, 80, [[0, '#cfefff'], [1, '#2e9cf0']]); c.fill(); c.lineWidth = 5; c.strokeStyle = '#e8ecef'; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); c.moveTo(36, 30); c.lineTo(31, 54); c.stroke(); },
  duplo(c) { sombra(c); c.beginPath(); c.moveTo(20, 76); c.lineTo(28, 20); c.lineTo(76, 26); c.lineTo(70, 80); c.closePath(); c.fillStyle = lin(c, 20, 20, 76, 80, [[0, '#3a5a9a'], [1, '#1a2a5a']]); c.fill(); c.lineWidth = 5; c.strokeStyle = '#e8ecef'; c.stroke(); c.strokeStyle = 'rgba(160,200,255,.6)'; c.lineWidth = 1.5; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(20 + 2 * i + i * 12, 24 + i * 1.5 - 2); c.lineTo(20 + i * 12.5, 78); c.stroke(); c.beginPath(); c.moveTo(27 - i * 2, 20 + i * 14); c.lineTo(75 - i * 1.5, 26 + i * 14); c.stroke(); } },
  cupula(c) { sombra(c); c.beginPath(); c.moveTo(48, 16); c.lineTo(82, 76); c.lineTo(14, 76); c.closePath(); c.fillStyle = lin(c, 14, 16, 82, 76, [[0, 'rgba(210,245,255,.95)'], [1, 'rgba(80,170,215,.85)']]); c.fill(); c.lineWidth = 5; c.strokeStyle = '#c9ced6'; c.stroke(); },
  acrilico(c) { sombra(c); c.beginPath(); c.moveTo(16, 30); c.quadraticCurveTo(48, 18, 80, 30); c.lineTo(80, 76); c.quadraticCurveTo(48, 86, 16, 76); c.closePath(); c.fillStyle = lin(c, 0, 20, 0, 80, [[0, 'rgba(150,220,245,.8)'], [1, 'rgba(30,110,160,.95)']]); c.fill(); contorno(c); c.fillStyle = '#ffae4a'; c.beginPath(); c.ellipse(42, 56, 9, 5, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(50, 56); c.lineTo(57, 51); c.lineTo(57, 61); c.fill(); },
  fiacao(c) { sombra(c); c.beginPath(); c.ellipse(48, 54, 30, 26, 0, 0, 7); c.fillStyle = '#b06a2c'; c.fill(); contorno(c); c.beginPath(); c.ellipse(48, 54, 24, 20, 0, 0, 7); c.fillStyle = '#e0894a'; c.fill(); c.strokeStyle = '#b8622a'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(48, 54, 24 - i * 3, 20 - i * 2.4, 0, 0, 7); c.stroke(); } c.beginPath(); c.arc(48, 54, 6, 0, 7); c.fillStyle = '#5a3a1e'; c.fill(); },
  luminaria(c) { c.beginPath(); c.arc(48, 44, 30, 0, 7); c.fillStyle = rad(c, 48, 44, 4, 34, [[0, 'rgba(255,240,180,.95)'], [1, 'rgba(255,200,90,0)']]); c.fill(); c.beginPath(); c.arc(48, 42, 16, Math.PI * 0.8, Math.PI * 2.2); c.lineTo(56, 64); c.lineTo(40, 64); c.closePath(); c.fillStyle = rad(c, 44, 36, 2, 20, [[0, '#ffffff'], [1, '#ffd98a']]); c.fill(); contorno(c); c.fillStyle = '#6c8298'; rr(c, 39, 64, 18, 12, 3); c.fill(); contorno(c, 1.5); },
  solar(c) { sombra(c); c.save(); c.translate(48, 50); c.transform(1, 0.25, -0.45, 1, 0, 0); rr(c, -30, -22, 60, 44, 3); c.fillStyle = lin(c, 0, -22, 0, 22, [[0, '#3a6ac9'], [1, '#12245a']]); c.fill(); contorno(c); c.strokeStyle = 'rgba(190,215,255,.55)'; c.lineWidth = 1.4; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-30 + i * 15, -22); c.lineTo(-30 + i * 15, 22); c.stroke(); } for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(-30, -22 + i * 14.7); c.lineTo(30, -22 + i * 14.7); c.stroke(); } c.restore(); c.fillStyle = '#6c8298'; c.fillRect(45, 70, 6, 12); },
  sensor(c) { sombra(c); rr(c, 30, 40, 36, 36, 8); c.fillStyle = lin(c, 0, 40, 0, 76, [[0, '#f6f8fa'], [1, '#aab4be']]); c.fill(); contorno(c); c.beginPath(); c.arc(48, 58, 7, 0, 7); c.fillStyle = '#3fd07f'; c.fill(); c.strokeStyle = '#3fd07f'; c.lineWidth = 3; for (const r of [14, 22]) { c.beginPath(); c.arc(48, 40, r, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); } },
  computador(c) { sombra(c); rr(c, 16, 20, 64, 44, 5); c.fillStyle = '#2a2f38'; c.fill(); contorno(c); c.fillStyle = lin(c, 0, 24, 0, 60, [[0, '#7fe9ff'], [1, '#2a7fb0']]); c.fillRect(21, 25, 54, 34); c.fillStyle = '#6c8298'; c.fillRect(42, 64, 12, 8); rr(c, 26, 72, 44, 8, 3); c.fill(); contorno(c, 1.4); },
  kitlab(c) { sombra(c); c.beginPath(); c.moveTo(40, 18); c.lineTo(56, 18); c.lineTo(56, 38); c.lineTo(74, 76); c.quadraticCurveTo(48, 84, 22, 76); c.lineTo(40, 38); c.closePath(); c.fillStyle = 'rgba(220,240,250,.8)'; c.fill(); contorno(c); c.beginPath(); c.moveTo(33, 56); c.lineTo(63, 56); c.lineTo(72, 75); c.quadraticCurveTo(48, 82, 24, 75); c.closePath(); c.fillStyle = lin(c, 0, 56, 0, 80, [[0, '#8fe07a'], [1, '#3fae4a']]); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; for (const [x, y] of [[42, 64], [52, 70], [58, 62]]) { c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); } },
  racao(c) { sombra(c); saco(c, '#e8d7a8', '#bba46a', () => { c.fillStyle = '#6e4a2a'; for (const [x, y] of [[40, 58], [48, 64], [56, 58], [48, 52]]) { c.beginPath(); c.ellipse(x, y, 4, 3, 0.5, 0, 7); c.fill(); } }); },
  kitvet(c) { sombra(c); rr(c, 18, 32, 60, 44, 8); c.fillStyle = lin(c, 0, 32, 0, 76, [[0, '#ffffff'], [1, '#c9d2da']]); c.fill(); contorno(c); c.fillStyle = '#3fae72'; c.fillRect(42, 40, 12, 28); c.fillRect(34, 48, 28, 12); c.strokeStyle = '#6c8298'; c.lineWidth = 4; c.beginPath(); c.moveTo(38, 32); c.lineTo(38, 24); c.lineTo(58, 24); c.lineTo(58, 32); c.stroke(); },
  estrado(c) { sombra(c); for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(12 + i * 4, 44 + i * 7); c.lineTo(70 + i * 4, 36 + i * 7); c.lineTo(72 + i * 4, 41 + i * 7); c.lineTo(14 + i * 4, 49 + i * 7); c.closePath(); c.fillStyle = '#f0b866'; c.fill(); contorno(c, 1.3); } for (const x of [20, 46, 72]) { c.fillStyle = '#b06a2c'; c.fillRect(x, 50, 8, 26); } },
  etiqueta(c) { sombra(c); c.save(); c.translate(48, 52); c.rotate(-0.25); c.beginPath(); c.moveTo(-30, -18); c.lineTo(18, -18); c.lineTo(32, 0); c.lineTo(18, 18); c.lineTo(-30, 18); c.closePath(); c.fillStyle = '#f5f0e6'; c.fill(); contorno(c); c.fillStyle = '#f0a820'; c.fillRect(-22, -8, 18, 16); c.strokeStyle = '#2e9cf0'; c.lineWidth = 2.5; for (const r of [8, 14]) { c.beginPath(); c.arc(4, 0, r, -0.8, 0.8); c.stroke(); } c.beginPath(); c.arc(20, 0, 3.5, 0, 7); c.fillStyle = '#50667c'; c.fill(); c.restore(); },
  cadeado(c) { sombra(c); c.lineWidth = 7; c.strokeStyle = '#98acc0'; c.beginPath(); c.arc(48, 40, 15, Math.PI, 0); c.lineTo(63, 50); c.moveTo(33, 50); c.lineTo(33, 40); c.stroke(); rr(c, 24, 46, 48, 36, 7); c.fillStyle = lin(c, 0, 46, 0, 82, [[0, '#ffe29a'], [1, '#c9902a']]); c.fill(); contorno(c); c.beginPath(); c.arc(48, 60, 5, 0, 7); c.fillStyle = '#5a3a0a'; c.fill(); c.fillRect(46, 62, 4, 10); },
  estaca(c) { sombra(c); c.save(); c.translate(48, 50); c.rotate(0.2); c.beginPath(); c.moveTo(-6, -34); c.lineTo(6, -34); c.lineTo(6, 24); c.lineTo(0, 34); c.lineTo(-6, 24); c.closePath(); c.fillStyle = lin(c, -6, 0, 6, 0, [[0, '#f8d08a'], [1, '#b8742c']]); c.fill(); contorno(c); c.fillStyle = '#ff6a2a'; c.fillRect(-7, -28, 14, 8); c.beginPath(); c.moveTo(7, -26); c.quadraticCurveTo(22, -20, 18, -8); c.lineTo(12, -12); c.quadraticCurveTo(14, -18, 7, -20); c.fill(); c.restore(); },
  baliza(c) { sombra(c); c.save(); c.translate(48, 50); c.rotate(-0.25); for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#f5f0e6' : '#f04a3a'; c.fillRect(-4, -36 + i * 10, 8, 10); } c.strokeStyle = 'rgba(20,16,12,.55)'; c.lineWidth = 1.6; c.strokeRect(-4, -36, 8, 70); c.restore(); },
  trena(c) { sombra(c); c.strokeStyle = '#ff3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(62, 52); c.lineTo(90, 44); c.stroke(); rr(c, 18, 36, 46, 34, 8); c.fillStyle = lin(c, 0, 36, 0, 70, [[0, '#ffe06a'], [1, '#f0a820']]); c.fill(); contorno(c); rr(c, 24, 42, 22, 12, 3); c.fillStyle = '#2a3a2a'; c.fill(); c.fillStyle = '#7fe99a'; c.font = 'bold 9px sans-serif'; c.fillText('12,4', 26, 51); c.beginPath(); c.arc(54, 58, 5, 0, 7); c.fillStyle = '#50667c'; c.fill(); },
  // ---- projetos ----
  sede(c) { c.beginPath(); c.ellipse(48, 62, 38, 16, 0, 0, 7); c.fillStyle = '#2a3a5a'; c.fill(); contorno(c); for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(48, 58 - i * 9, 36 - i * 2, 15 - i, 0, Math.PI, 0); c.strokeStyle = i % 2 ? '#8ad8ff' : '#f5f0e6'; c.lineWidth = 5; c.stroke(); } c.beginPath(); c.ellipse(48, 38, 30, 11, 0, 0, 7); c.fillStyle = '#5cc83a'; c.fill(); contorno(c, 1.6); },
  escola(c) { sombra(c); c.save(); c.translate(48, 50); c.rotate(-0.6); rr(c, -8, -34, 16, 58, 2); c.fillStyle = '#ffcc3a'; c.fill(); contorno(c); c.beginPath(); c.moveTo(-8, 24); c.lineTo(0, 38); c.lineTo(8, 24); c.fillStyle = '#f8d08a'; c.fill(); contorno(c, 1.5); c.fillStyle = '#f04a3a'; c.fillRect(-8, -34, 16, 8); c.restore(); },
  campo(c) { rr(c, 10, 22, 76, 52, 4); c.fillStyle = lin(c, 0, 22, 0, 74, [[0, '#5cc83a'], [1, '#2e8a22']]); c.fill(); contorno(c); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.strokeRect(16, 28, 64, 40); c.beginPath(); c.moveTo(48, 28); c.lineTo(48, 68); c.stroke(); c.beginPath(); c.arc(48, 48, 9, 0, 7); c.stroke(); },
  praca(c) { sombra(c); c.beginPath(); c.ellipse(48, 64, 36, 14, 0, 0, 7); c.fillStyle = '#d8c8a8'; c.fill(); contorno(c); c.beginPath(); c.ellipse(48, 62, 22, 8, 0, 0, 7); c.fillStyle = '#2e9cf0'; c.fill(); c.strokeStyle = '#8ad8ff'; c.lineWidth = 4; c.beginPath(); c.moveTo(48, 60); c.quadraticCurveTo(48, 30, 36, 40); c.moveTo(48, 60); c.quadraticCurveTo(48, 30, 60, 40); c.stroke(); },
  // cidade em volta da Arcologia: skyline creme com faixas de vidro, árvore e chão
  cidade(c) { sombra(c); const pr = (x, y, w, h) => { rr(c, x, y, w, h, 3); c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#fbf5e8'], [1, '#d9ccb4']]); c.fill(); contorno(c, 2); c.fillStyle = '#3d4654'; for (let k = y + 7; k < y + h - 6; k += 10) c.fillRect(x + 4, k, w - 8, 4); c.fillStyle = '#5fae3c'; c.fillRect(x - 1, y - 3, w + 2, 4); };
    pr(14, 40, 22, 42); pr(38, 18, 22, 64); pr(62, 32, 20, 50); c.beginPath(); c.arc(84, 70, 9, 0, 7); c.fillStyle = '#3f8f2e'; c.fill(); contorno(c, 1.6); c.fillStyle = '#7a8a5a'; c.fillRect(8, 82, 82, 4); },
  casa(c) { sombra(c); rr(c, 20, 44, 56, 36, 3); c.fillStyle = lin(c, 0, 44, 0, 80, [[0, '#fbf5e8'], [1, '#dccfb8']]); c.fill(); contorno(c); c.beginPath(); c.moveTo(12, 48); c.lineTo(48, 18); c.lineTo(84, 48); c.closePath(); c.fillStyle = lin(c, 0, 18, 0, 48, [[0, '#6cc04a'], [1, '#3f8a2c']]); c.fill(); contorno(c);
    c.fillStyle = '#3d4654'; c.fillRect(28, 54, 14, 12); c.fillRect(54, 54, 14, 12); c.fillStyle = '#b07a48'; c.fillRect(42, 64, 12, 16); },
  predio(c) { sombra(c); const t = (x, y, w, h) => { rr(c, x, y, w, h, 2); c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#fbf5e8'], [1, '#d9ccb4']]); c.fill(); contorno(c, 2); c.fillStyle = '#3d4654'; c.fillRect(x + 4, y + 6, w - 8, 5); c.fillStyle = '#58ad38'; c.fillRect(x - 2, y - 4, w + 4, 5); };
    t(12, 62, 72, 20); t(20, 44, 56, 18); t(30, 26, 36, 18); },
  torre(c) { sombra(c); rr(c, 32, 10, 32, 74, 3); c.fillStyle = lin(c, 0, 10, 0, 84, [[0, '#e8f2f6'], [1, '#b8c8d0']]); c.fill(); contorno(c);
    for (let y = 18; y < 80; y += 11) { c.fillStyle = '#4ea834'; rr(c, 27, y, 42, 4, 2); c.fill(); c.beginPath(); c.arc(28 + ((y * 7) % 38), y - 2, 4, 0, 7); c.fillStyle = '#3c8c2a'; c.fill(); } },
  saude(c) { sombra(c); rr(c, 14, 14, 68, 68, 14); c.fillStyle = lin(c, 0, 14, 0, 82, [[0, '#ffffff'], [1, '#dfe6ea']]); c.fill(); contorno(c); c.fillStyle = '#2fbf62'; c.fillRect(40, 24, 16, 48); c.fillRect(24, 40, 48, 16); c.strokeStyle = 'rgba(0,60,20,.35)'; c.lineWidth = 1.5; c.strokeRect(40, 24, 16, 48); },
  seguranca(c) { sombra(c); c.beginPath(); c.moveTo(48, 10); c.lineTo(80, 22); c.lineTo(76, 54); c.quadraticCurveTo(70, 76, 48, 86); c.quadraticCurveTo(26, 76, 20, 54); c.lineTo(16, 22); c.closePath(); c.fillStyle = lin(c, 0, 10, 0, 86, [[0, '#5aa6ff'], [1, '#1e56b8']]); c.fill(); contorno(c);
    c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 7 : 16; c.lineTo(48 + Math.cos(a) * r, 46 + Math.sin(a) * r); } c.closePath(); c.fillStyle = '#ffd24a'; c.fill(); contorno(c, 1.5); },
  parque(c) { sombra(c); c.beginPath(); c.ellipse(48, 62, 40, 20, 0, 0, 7); c.fillStyle = lin(c, 0, 42, 0, 82, [[0, '#7ccf52'], [1, '#3f8e2c']]); c.fill(); contorno(c); c.beginPath(); c.ellipse(56, 66, 16, 7, 0, 0, 7); c.fillStyle = '#39a8e0'; c.fill();
    for (const [x, y, r] of [[26, 44, 13], [40, 36, 10]]) { c.fillStyle = '#6b4a2e'; c.fillRect(x - 2, y, 4, 16); c.beginPath(); c.arc(x, y - 4, r, 0, 7); c.fillStyle = '#3f9a2e'; c.fill(); contorno(c, 1.6); } },
  comercio(c) { sombra(c); rr(c, 12, 36, 72, 46, 3); c.fillStyle = lin(c, 0, 36, 0, 82, [[0, '#fbf5e8'], [1, '#dccfb8']]); c.fill(); contorno(c); c.fillStyle = '#ffd68a'; c.fillRect(18, 54, 22, 22); c.fillRect(46, 54, 32, 22);
    const cores = ['#e2543f', '#fbf5e8']; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(10 + k * 13, 36); c.lineTo(23 + k * 13, 36); c.lineTo(23 + k * 13, 48); c.quadraticCurveTo(16.5 + k * 13, 54, 10 + k * 13, 48); c.closePath(); c.fillStyle = cores[k % 2]; c.fill(); } c.strokeStyle = 'rgba(22,28,50,.6)'; c.lineWidth = 2; c.strokeRect(10, 36, 78, 0.1); },
  escritorio(c) { sombra(c); rr(c, 28, 10, 40, 74, 3); c.fillStyle = lin(c, 28, 0, 68, 0, [[0, '#9fc4dc'], [0.5, '#e8f4fa'], [1, '#6f96b2']]); c.fill(); contorno(c); c.strokeStyle = '#f5efe2'; c.lineWidth = 3; for (let y = 20; y < 84; y += 10) { c.beginPath(); c.moveTo(28, y); c.lineTo(68, y); c.stroke(); }
    c.fillStyle = '#4ea834'; rr(c, 24, 42, 48, 4, 2); c.fill(); rr(c, 24, 8, 48, 5, 2); c.fill(); },
  mercado(c) { sombra(c); rr(c, 10, 56, 76, 26, 3); c.fillStyle = '#efe6d4'; c.fill(); contorno(c); c.beginPath(); c.moveTo(12, 58); c.quadraticCurveTo(48, 6, 84, 58); c.closePath(); c.fillStyle = 'rgba(170,215,235,.85)'; c.fill(); contorno(c);
    c.strokeStyle = '#4a5664'; c.lineWidth = 2; for (const x of [30, 48, 66]) { c.beginPath(); c.moveTo(x, 58); c.lineTo(x, 26 + Math.abs(x - 48) * 0.7); c.stroke(); } c.fillStyle = '#e2543f'; c.fillRect(16, 64, 14, 8); c.fillStyle = '#2ab8a8'; c.fillRect(40, 64, 14, 8); c.fillStyle = '#f8c83a'; c.fillRect(64, 64, 14, 8); },
  estacao(c) { sombra(c); c.fillStyle = '#7a8088'; c.fillRect(6, 78, 84, 4); rr(c, 14, 40, 68, 32, 8); c.fillStyle = lin(c, 0, 40, 0, 72, [[0, '#ffffff'], [1, '#d8dde2']]); c.fill(); contorno(c); c.fillStyle = '#2ab8a8'; c.fillRect(14, 64, 68, 5);
    c.fillStyle = '#3d4654'; for (let k = 0; k < 4; k++) c.fillRect(20 + k * 15, 46, 11, 12); c.strokeStyle = '#4a5664'; c.lineWidth = 2; c.beginPath(); c.moveTo(48, 40); c.lineTo(48, 24); c.moveTo(36, 24); c.lineTo(60, 24); c.stroke(); },
  hospital(c) { sombra(c); rr(c, 14, 24, 68, 58, 4); c.fillStyle = lin(c, 0, 24, 0, 82, [[0, '#ffffff'], [1, '#dfe6ea']]); c.fill(); contorno(c); c.fillStyle = '#9ec8e8'; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) if (!(r === 0 && (k === 1 || k === 2))) c.fillRect(20 + k * 15, 34 + r * 15, 10, 9);
    c.fillStyle = '#2fbf62'; c.fillRect(42, 30, 12, 26); c.fillRect(35, 37, 26, 12); c.fillStyle = '#b8c2c8'; c.fillRect(40, 66, 16, 16); },
  cultura(c) { sombra(c); c.beginPath(); c.moveTo(12, 34); c.lineTo(48, 14); c.lineTo(84, 34); c.closePath(); c.fillStyle = '#f2ead8'; c.fill(); contorno(c); rr(c, 14, 34, 68, 8, 2); c.fillStyle = '#e6dcc4'; c.fill(); contorno(c, 1.6);
    c.fillStyle = '#f7f1e4'; for (const x of [20, 34, 48, 62, 76]) { c.fillRect(x - 3, 42, 6, 30); } c.strokeStyle = 'rgba(22,28,50,.45)'; c.lineWidth = 1.4; for (const x of [20, 34, 48, 62, 76]) c.strokeRect(x - 3, 42, 6, 30); rr(c, 10, 72, 76, 10, 2); c.fillStyle = '#d8ccb4'; c.fill(); contorno(c, 1.6); },
  prefeitura(c) { sombra(c); rr(c, 10, 46, 76, 36, 3); c.fillStyle = lin(c, 0, 46, 0, 82, [[0, '#fbf5e8'], [1, '#d9ccb4']]); c.fill(); contorno(c);
    c.fillStyle = '#3d4654'; for (const x of [18, 30, 58, 70]) c.fillRect(x, 56, 8, 10); rr(c, 40, 62, 16, 20, 2); c.fillStyle = '#8a5a34'; c.fill(); contorno(c, 1.4);
    rr(c, 36, 20, 24, 30, 2); c.fillStyle = lin(c, 0, 20, 0, 50, [[0, '#fffaf0'], [1, '#e2d6bc']]); c.fill(); contorno(c); c.beginPath(); c.moveTo(34, 21); c.lineTo(48, 8); c.lineTo(62, 21); c.closePath(); c.fillStyle = '#58ad38'; c.fill(); contorno(c, 1.6);
    c.beginPath(); c.arc(48, 34, 8, 0, 7); c.fillStyle = '#fff'; c.fill(); contorno(c, 1.6); c.strokeStyle = '#2a3242'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(48, 34); c.lineTo(48, 28.5); c.moveTo(48, 34); c.lineTo(52, 35.5); c.stroke();
    c.fillStyle = '#6b7480'; c.fillRect(76, 18, 2.5, 30); c.fillStyle = '#2f9e5a'; c.fillRect(78.5, 18, 12, 8); c.fillStyle = '#ffd21a'; c.beginPath(); c.moveTo(80, 22); c.lineTo(84.5, 19.5); c.lineTo(89, 22); c.lineTo(84.5, 24.5); c.closePath(); c.fill(); },
  hidreletrica(c) { sombra(c); c.beginPath(); c.moveTo(8, 30); c.quadraticCurveTo(48, 18, 88, 30); c.lineTo(88, 50); c.quadraticCurveTo(48, 40, 8, 50); c.closePath(); c.fillStyle = lin(c, 0, 20, 0, 50, [[0, '#7cc8ff'], [1, '#2f86d8']]); c.fill(); contorno(c, 1.6);
    c.beginPath(); c.moveTo(8, 50); c.quadraticCurveTo(48, 40, 88, 50); c.lineTo(84, 84); c.quadraticCurveTo(48, 76, 12, 84); c.closePath(); c.fillStyle = lin(c, 0, 44, 0, 84, [[0, '#eee6d4'], [1, '#bfb49c']]); c.fill(); contorno(c);
    c.fillStyle = 'rgba(120,190,255,.85)'; for (const x of [30, 48, 66]) c.fillRect(x - 3, 52, 6, 28);
    c.lineJoin = 'round'; c.beginPath(); c.moveTo(56, 4); c.lineTo(40, 26); c.lineTo(50, 26); c.lineTo(44, 42); c.lineTo(62, 18); c.lineTo(52, 18); c.closePath(); c.fillStyle = lin(c, 40, 4, 62, 42, [[0, '#fff7a0'], [1, '#f0a000']]); c.fill(); contorno(c, 1.8); },
  construtora(c) { sombra(c); c.beginPath(); c.moveTo(14, 60); c.quadraticCurveTo(16, 24, 48, 22); c.quadraticCurveTo(80, 24, 82, 60); c.closePath(); c.fillStyle = lin(c, 0, 22, 0, 60, [[0, '#ffd84a'], [1, '#f0a000']]); c.fill(); contorno(c);
    rr(c, 8, 58, 80, 12, 5); c.fillStyle = '#f0a000'; c.fill(); contorno(c); rr(c, 42, 16, 12, 44, 5); c.fillStyle = '#ffe680'; c.fill(); contorno(c, 1.6); reflexo(c, 30, 36, 8, 4, 0.6, -0.6);
    c.fillStyle = '#3d4654'; c.fillRect(20, 74, 56, 6); },
  fabrica(c) { sombra(c); c.beginPath(); c.moveTo(8, 84); c.lineTo(8, 46); c.lineTo(28, 34); c.lineTo(28, 46); c.lineTo(48, 34); c.lineTo(48, 46); c.lineTo(68, 34); c.lineTo(68, 84); c.closePath(); c.fillStyle = lin(c, 0, 34, 0, 84, [[0, '#f5efe2'], [1, '#cdbfa6']]); c.fill(); contorno(c);
    rr(c, 70, 18, 14, 66, 2); c.fillStyle = '#b8554a'; c.fill(); contorno(c); c.fillStyle = '#fff'; c.fillRect(70, 26, 14, 4); c.fillStyle = '#3d4654'; for (const x of [16, 36, 56]) c.fillRect(x - 5, 58, 10, 12);
    c.fillStyle = 'rgba(220,226,236,.9)'; for (const [x, y, r] of [[80, 10, 6], [88, 4, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } },
  logistica(c) { sombra(c); rr(c, 6, 30, 52, 42, 3); c.fillStyle = lin(c, 0, 30, 0, 72, [[0, '#ffffff'], [1, '#d6dbe2']]); c.fill(); contorno(c); c.fillStyle = '#3f88e2'; c.fillRect(6, 44, 52, 8);
    c.beginPath(); c.moveTo(58, 44); c.lineTo(76, 44); c.lineTo(88, 58); c.lineTo(88, 72); c.lineTo(58, 72); c.closePath(); c.fillStyle = lin(c, 0, 44, 0, 72, [[0, '#ff8a3a'], [1, '#e2543f']]); c.fill(); contorno(c); c.fillStyle = '#9ec8e8'; c.fillRect(66, 48, 12, 9);
    for (const x of [20, 46, 76]) { c.beginPath(); c.arc(x, 74, 7, 0, 7); c.fillStyle = '#2a2e36'; c.fill(); contorno(c, 1.6); c.beginPath(); c.arc(x, 74, 2.6, 0, 7); c.fillStyle = '#b8c2c8'; c.fill(); } },
  shopping(c) { sombra(c); c.beginPath(); c.moveTo(18, 34); c.lineTo(78, 34); c.lineTo(84, 86); c.lineTo(12, 86); c.closePath(); c.fillStyle = lin(c, 0, 34, 0, 86, [[0, '#ff7aa8'], [1, '#d63a78']]); c.fill(); contorno(c);
    c.strokeStyle = 'rgba(22,28,50,.7)'; c.lineWidth = 4; c.beginPath(); c.arc(48, 34, 14, Math.PI, 0); c.stroke(); c.strokeStyle = '#ffe680'; c.lineWidth = 2.4; c.beginPath(); c.arc(48, 34, 14, Math.PI, 0); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(48, 50); c.lineTo(52, 60); c.lineTo(62, 60); c.lineTo(54, 66); c.lineTo(57, 76); c.lineTo(48, 70); c.lineTo(39, 76); c.lineTo(42, 66); c.lineTo(34, 60); c.lineTo(44, 60); c.closePath(); c.fill(); reflexo(c, 30, 46, 8, 3, 0.5, -0.4); },
  banco(c) { sombra(c); c.beginPath(); c.moveTo(8, 34); c.lineTo(48, 10); c.lineTo(88, 34); c.closePath(); c.fillStyle = lin(c, 0, 10, 0, 34, [[0, '#ffe680'], [1, '#e0a820']]); c.fill(); contorno(c);
    rr(c, 10, 34, 76, 7, 2); c.fillStyle = '#f2ead8'; c.fill(); contorno(c, 1.6); c.fillStyle = '#f7f1e4'; for (const x of [20, 36, 52, 68]) { c.fillRect(x - 4, 42, 8, 30); } c.strokeStyle = 'rgba(22,28,50,.45)'; c.lineWidth = 1.4; for (const x of [20, 36, 52, 68]) c.strokeRect(x - 4, 42, 8, 30);
    rr(c, 6, 72, 84, 10, 2); c.fillStyle = '#d8ccb4'; c.fill(); contorno(c, 1.6); c.beginPath(); c.arc(48, 24, 6, 0, 7); c.fillStyle = '#fff4c0'; c.fill(); contorno(c, 1.2); },
  terreno(c) { sombra(c); c.beginPath(); c.moveTo(48, 40); c.lineTo(90, 60); c.lineTo(48, 82); c.lineTo(6, 60); c.closePath(); c.fillStyle = lin(c, 0, 40, 0, 82, [[0, '#8ed05a'], [1, '#4cb62a']]); c.fill(); contorno(c);
    c.setLineDash([5, 4]); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(48, 46); c.lineTo(78, 60); c.lineTo(48, 76); c.lineTo(18, 60); c.closePath(); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#6b4a2a'; c.fillRect(46, 12, 4, 52); c.beginPath(); c.moveTo(50, 12); c.lineTo(78, 20); c.lineTo(50, 30); c.closePath(); c.fillStyle = '#ffcc3a'; c.fill(); contorno(c, 1.6); c.fillStyle = '#2a3242'; c.font = 'bold 12px sans-serif'; c.fillText('H', 55, 25); },
  luxo(c) { sombra(c); rr(c, 30, 20, 36, 66, 3); c.fillStyle = lin(c, 30, 0, 66, 0, [[0, '#5a7fa8'], [0.5, '#a8cbe8'], [1, '#4a6a90']]); c.fill(); contorno(c);
    c.fillStyle = '#e0b030'; for (const x of [30, 64]) c.fillRect(x, 20, 2.5, 66); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; for (let y = 30; y < 84; y += 8) { c.beginPath(); c.moveTo(33, y); c.lineTo(63, y); c.stroke(); }
    c.beginPath(); c.ellipse(48, 16, 20, 6, 0, 0, 7); c.fillStyle = '#2a3242'; c.fill(); contorno(c, 1.6); c.strokeStyle = '#ffd21a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(48, 16, 15, 4.3, 0, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 7px sans-serif'; c.fillText('H', 45.5, 18.5);
    rr(c, 20, 80, 56, 8, 2); c.fillStyle = '#58ad38'; c.fill(); contorno(c, 1.6); },
  aeroporto(c) { sombra(c); c.save(); c.translate(48, 50); c.rotate(-0.7); c.beginPath(); c.moveTo(0, -40); c.quadraticCurveTo(7, -34, 6, -18); c.lineTo(38, 4); c.lineTo(38, 12); c.lineTo(6, 2); c.lineTo(5, 24); c.lineTo(16, 34); c.lineTo(16, 40); c.lineTo(0, 35);
    c.lineTo(-16, 40); c.lineTo(-16, 34); c.lineTo(-5, 24); c.lineTo(-6, 2); c.lineTo(-38, 12); c.lineTo(-38, 4); c.lineTo(-6, -18); c.quadraticCurveTo(-7, -34, 0, -40); c.closePath(); c.fillStyle = lin(c, -38, -40, 38, 40, [[0, '#ffffff'], [1, '#c9d6e2']]); c.fill(); contorno(c);
    c.fillStyle = '#3aa6c8'; c.fillRect(-2, -30, 4, 50); c.restore(); },
  estadio(c) { sombra(c); c.beginPath(); c.ellipse(48, 54, 40, 26, 0, 0, 7); c.fillStyle = lin(c, 0, 28, 0, 80, [[0, '#f5efe2'], [1, '#cfc4ae']]); c.fill(); contorno(c); c.beginPath(); c.ellipse(48, 56, 28, 15, 0, 0, 7); c.fillStyle = '#4cb62a'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(48, 42); c.lineTo(48, 70); c.stroke(); c.beginPath(); c.arc(48, 56, 5, 0, 7); c.stroke(); for (const x of [12, 84]) { c.fillStyle = '#6b7480'; c.fillRect(x - 1.5, 14, 3, 26); c.fillStyle = '#ffe9a0'; c.fillRect(x - 5, 10, 10, 6); } },
  passarela(c) { sombra(c); c.strokeStyle = '#f5f0e6'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(10, 54); c.quadraticCurveTo(48, 30, 86, 54); c.stroke(); c.strokeStyle = 'rgba(160,215,240,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(10, 46); c.quadraticCurveTo(48, 22, 86, 46); c.stroke(); c.fillStyle = '#e8ecef'; for (const x of [30, 48, 66]) c.fillRect(x - 3, 44, 6, 36); },
  biblioteca(c) { c.fillStyle = '#ffc478'; for (let i = 0; i < 4; i++) { rr(c, 34, 50 - i * 9 + 12, 28, 8, 2); c.fill(); } c.strokeStyle = '#d2a064'; c.lineWidth = 3; c.beginPath(); c.moveTo(38, 74); c.lineTo(20, 30); c.moveTo(58, 74); c.lineTo(76, 30); c.stroke(); c.beginPath(); c.moveTo(48, 12); c.lineTo(88, 24); c.lineTo(48, 36); c.lineTo(8, 24); c.closePath(); c.fillStyle = 'rgba(200,225,235,.95)'; c.fill(); c.strokeStyle = '#e6b464'; c.lineWidth = 3; c.stroke(); },
  // tablet com três nós ligados (rede de recursos digitais)
  crd(c) { sombra(c); rr(c, 20, 14, 56, 70, 7); c.fillStyle = '#2a2f38'; c.fill(); contorno(c); rr(c, 25, 20, 46, 54, 3); c.fillStyle = lin(c, 0, 20, 0, 74, [[0, '#1f4a6a'], [1, '#12263a']]); c.fill(); const N = [[36, 34], [60, 40], [44, 62]]; c.strokeStyle = '#7fe9ff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(...N[0]); c.lineTo(...N[1]); c.lineTo(...N[2]); c.closePath(); c.stroke(); for (const [x, y] of N) { c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fillStyle = rad(c, x - 1.5, y - 1.5, 0.5, 6, [[0, '#ffffff'], [1, '#7fe9ff']]); c.fill(); } c.fillStyle = '#50667c'; c.beginPath(); c.arc(48, 79, 2.2, 0, 7); c.fill(); },
  faculdade(c) { c.beginPath(); c.moveTo(48, 20); c.lineTo(88, 38); c.lineTo(48, 56); c.lineTo(8, 38); c.closePath(); c.fillStyle = '#2a2f38'; c.fill(); contorno(c); c.beginPath(); c.moveTo(24, 46); c.lineTo(24, 64); c.quadraticCurveTo(48, 80, 72, 64); c.lineTo(72, 46); c.lineTo(48, 57); c.closePath(); c.fillStyle = '#3a404a'; c.fill(); contorno(c); c.strokeStyle = '#ffcc3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(76, 42); c.lineTo(76, 66); c.stroke(); c.fillStyle = '#ffcc3a'; c.beginPath(); c.arc(76, 68, 4, 0, 7); c.fill(); },
  // hélice de DNA
  ciencias(c) { sombra(c); c.lineCap = 'round'; for (let i = 0; i <= 8; i++) { const y = 16 + i * 8, a = (i / 8) * Math.PI * 2; const x1 = 48 + Math.sin(a) * 20, x2 = 48 - Math.sin(a) * 20; c.strokeStyle = 'rgba(90,96,110,.7)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke(); }
    for (const [cor, f] of [['#6fd39a', 1], ['#b69cff', -1]]) { c.beginPath(); for (let i = 0; i <= 32; i++) { const y = 16 + i * 2, a = (i / 32) * Math.PI * 2; const x = 48 + f * Math.sin(a) * 20; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.strokeStyle = 'rgba(20,16,12,.55)'; c.lineWidth = 8.4; c.stroke(); c.strokeStyle = cor; c.lineWidth = 6; c.stroke(); } },
  acelerador(c) { c.strokeStyle = '#48c0f8'; c.lineWidth = 4; for (const a of [0, 1.05, 2.1]) { c.save(); c.translate(48, 48); c.rotate(a); c.beginPath(); c.ellipse(0, 0, 36, 13, 0, 0, 7); c.stroke(); c.restore(); } c.beginPath(); c.arc(48, 48, 8, 0, 7); c.fillStyle = rad(c, 46, 46, 1, 9, [[0, '#fff'], [1, '#48c0f8']]); c.fill(); },
  anfiteatro(c) { sombra(c); for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(48, 58, 40 - i * 6, 22 - i * 3.4, 0, Math.PI, 0); c.lineTo(48 + 40 - i * 6, 62); c.strokeStyle = i % 2 ? '#9aa0a8' : '#c9ced6'; c.lineWidth = 6; c.stroke(); } c.fillStyle = '#e2a052'; c.beginPath(); c.ellipse(48, 64, 14, 6, 0, 0, 7); c.fill(); contorno(c, 1.5); },
  santuario(c) { c.fillStyle = '#6e4a2a'; for (const [x, y, r] of [[30, 40, 8], [44, 30, 8], [58, 30, 8], [70, 40, 8]]) { c.beginPath(); c.ellipse(x, y, r * 0.8, r, 0, 0, 7); c.fill(); } c.beginPath(); c.ellipse(50, 62, 20, 16, 0, 0, 7); c.fill(); },
  savana(c) { sombra(c); c.fillStyle = '#6e4a2a'; c.fillRect(44, 40, 7, 42); c.beginPath(); c.ellipse(48, 36, 36, 12, 0, 0, 7); c.fillStyle = lin(c, 0, 24, 0, 48, [[0, '#a6ee6a'], [1, '#4a8a26']]); c.fill(); contorno(c); },
  bioma(c) { sombra(c); c.beginPath(); c.arc(48, 70, 36, Math.PI, 0); c.closePath(); c.fillStyle = 'rgba(160,220,245,.6)'; c.fill(); contorno(c); c.beginPath(); c.rect(14, 56, 68, 14); c.fillStyle = 'rgba(40,130,190,.85)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(12 + i * 14, 70); c.lineTo(48, 34); c.stroke(); } },
  // cabeça de gorila: crista alta, arcada da sobrancelha, máscara facial clara e narinas
  gorilas(c) { sombra(c); c.beginPath(); c.moveTo(20, 80); c.bezierCurveTo(14, 52, 22, 28, 40, 18); c.quadraticCurveTo(48, 10, 56, 18); c.bezierCurveTo(74, 28, 82, 52, 76, 80); c.closePath(); c.fillStyle = rad(c, 40, 30, 4, 60, [[0, '#4a4442'], [1, '#221e1e']]); c.fill(); contorno(c);
    c.beginPath(); c.ellipse(48, 58, 20, 22, 0, 0, 7); c.fillStyle = rad(c, 44, 52, 2, 26, [[0, '#7d7068'], [1, '#554a45']]); c.fill(); contorno(c, 1.6);
    c.beginPath(); c.moveTo(26, 44); c.quadraticCurveTo(48, 32, 70, 44); c.quadraticCurveTo(48, 40, 26, 44); c.fillStyle = '#1c1818'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#2a2424'; c.stroke();
    for (const x of [39, 57]) { c.beginPath(); c.ellipse(x, 49, 3.2, 2.6, 0, 0, 7); c.fillStyle = '#d9c9a8'; c.fill(); c.beginPath(); c.arc(x, 49.5, 1.6, 0, 7); c.fillStyle = '#1a1414'; c.fill(); }
    c.beginPath(); c.ellipse(48, 62, 11, 7, 0, 0, 7); c.fillStyle = '#3e3634'; c.fill(); for (const x of [43, 53]) { c.beginPath(); c.ellipse(x, 62, 3, 2.2, 0, 0, 7); c.fillStyle = '#161212'; c.fill(); } c.strokeStyle = '#2a2222'; c.lineWidth = 2; c.beginPath(); c.moveTo(40, 72); c.quadraticCurveTo(48, 75, 56, 72); c.stroke(); },
  floresta(c) { sombra(c); for (const [x, s] of [[30, 22], [66, 24], [48, 30]]) { c.fillStyle = '#5a3a1e'; c.fillRect(x - 3, 58, 6, 24); c.beginPath(); c.arc(x, 48, s, 0, 7); c.fillStyle = rad(c, x - 6, 40, 2, s, [[0, '#a6ee6a'], [1, '#2e7a20']]); c.fill(); contorno(c); } },
  // trilha sinuosa de cascalho claro sobre o gramado
  caminho(c) { sombra(c); rr(c, 12, 18, 72, 62, 10); c.fillStyle = lin(c, 0, 18, 0, 80, [[0, '#86dc5a'], [1, '#3a8a26']]); c.fill(); contorno(c);
    c.lineCap = 'round'; const tr = () => { c.beginPath(); c.moveTo(22, 76); c.bezierCurveTo(26, 52, 64, 62, 58, 42); c.bezierCurveTo(54, 30, 66, 24, 74, 22); }; tr(); c.strokeStyle = 'rgba(20,16,12,.45)'; c.lineWidth = 13; c.stroke(); tr(); c.strokeStyle = '#e8dcc0'; c.lineWidth = 10; c.stroke();
    c.fillStyle = 'rgba(150,130,100,.6)'; for (const [x, y] of [[30, 64], [45, 56], [57, 48], [64, 30]]) { c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); } for (const [x, y] of [[24, 30], [34, 38], [78, 60], [70, 72]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fillStyle = '#2e7a20'; c.fill(); contorno(c, 1.2); } },
  // lago com ilha arborizada e juncos na margem
  lago(c) { sombra(c); c.beginPath(); c.ellipse(48, 56, 38, 24, -0.08, 0, 7); c.fillStyle = '#c9b88e'; c.fill(); contorno(c); c.beginPath(); c.ellipse(48, 56, 33, 20, -0.08, 0, 7); c.fillStyle = rad(c, 40, 50, 4, 38, [[0, '#6cc0ea'], [1, '#2f8fd0']]); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; for (const [x, y, l] of [[26, 52, 10], [60, 66, 12], [40, 70, 8]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke(); }
    c.beginPath(); c.ellipse(58, 50, 10, 6, 0, 0, 7); c.fillStyle = '#8a7a52'; c.fill(); contorno(c, 1.4); c.beginPath(); c.arc(58, 44, 8, 0, 7); c.fillStyle = rad(c, 55, 40, 1, 9, [[0, '#a6ee6a'], [1, '#2e7a20']]); c.fill(); contorno(c, 1.4);
    c.strokeStyle = '#3a8a26'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = 16 + i * 3; c.beginPath(); c.moveTo(x, 62); c.lineTo(x - 1 + i * 0.6, 48 - (i % 2) * 4); c.stroke(); } },
  // edifício-fita em três terraços curvos (módulo por pavimento)
  modulo(c) { sombra(c); for (let i = 0; i < 3; i++) { const y = 66 - i * 14, x0 = 12 + i * 8, x1 = 84 - i * 8; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(48, y + 10, x1, y); c.lineTo(x1, y - 10); c.quadraticCurveTo(48, y, x0, y - 10); c.closePath(); c.fillStyle = lin(c, 0, y - 10, 0, y + 6, [[0, '#ffd08a'], [1, '#c98a3e']]); c.fill(); contorno(c, 1.6); c.beginPath(); c.moveTo(x0, y - 10); c.quadraticCurveTo(48, y, x1, y - 10); c.lineTo(x1 - 2, y - 13); c.quadraticCurveTo(48, y - 4, x0 + 2, y - 13); c.closePath(); c.fillStyle = '#5f8f3e'; c.fill(); contorno(c, 1.2); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y - 1); c.quadraticCurveTo(48, y + 9, x1, y - 1); c.stroke(); } },
  // lixeira (descartar)
  // disposição da equipe: cafezinho fumegante
  // ---- prédios do canteiro: os galpões do mundo, cada um com o que o distingue (um desenho por prédio) ----
  'predio:escritorio'(c) {
    c.strokeStyle = '#8a96a4'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(78, 66); c.lineTo(78, 10); c.stroke();
    c.beginPath(); c.moveTo(79, 11); c.quadraticCurveTo(86, 7, 94, 12); c.lineTo(94, 25); c.quadraticCurveTo(86, 20, 79, 24); c.closePath(); c.fillStyle = lin(c, 79, 0, 94, 0, [[0, '#6fe8d0'], [1, '#1f9c8a']]); c.fill(); contorno(c, 1.3);
    conteiner(c, 4, 58, 56, 20, 16, true); conteiner(c, 16, 38, 50, 20, 16, false);
  },
  'predio:almox'(c) { galpao(c, 6, 46, 60, 32, 18, PAREDE.chapa, 'abobada', 'enrolar'); for (const [x, y, s] of [[8, 80, 1], [23, 82, 0.85], [11, 69, 0.8]]) caixa(c, x, y, 13 * s, 10 * s, 6 * s, '#ffe0a8', '#e8a85a', '#b8742c'); },
  'predio:usina1'(c) { usinaIc(c, 1, false); },
  'predio:usina2'(c) { usinaIc(c, 2, true); },
  'predio:usina3'(c) { usinaIc(c, 3, false); },
  'predio:carpintaria'(c) { galpao(c, 4, 46, 56, 28, 18, PAREDE.madeira, 'abobada'); for (const [x, y] of [[64, 84], [76, 84], [88, 84], [70, 74], [82, 74], [76, 64]]) tronco(c, x, y, 6.2); },
  'predio:concreto'(c) { silo(c, 74, 62, 8.5, 42); galpao(c, 4, 48, 54, 26, 16, PAREDE.concreto, 'abobada'); betoneira(c, 76, 74); },
  'predio:horto'(c) {
    galpao(c, 6, 50, 62, 26, 18, ['rgba(222,247,253,.9)', 'rgba(176,226,242,.9)', 'rgba(150,206,230,.85)'], 'vidro', null, (c) => { for (const [x, y, s] of [[16, 70, 7], [28, 72, 8], [42, 70, 7], [55, 72, 8], [70, 64, 6], [80, 59, 6]]) { c.beginPath(); c.arc(x, y, s, 0, 7); c.fillStyle = rad(c, x - s * 0.3, y - s * 0.4, 1, s, [[0, '#b4f07a'], [1, '#2e8a22']]); c.fill(); contorno(c, 1.1); } });
    rr(c, 6, 73, 62, 4, 1.5); c.fillStyle = '#8a5a2e'; c.fill();
  },
  'predio:serralheria'(c) {
    galpao(c, 4, 44, 56, 28, 18, PAREDE.chapa, 'abobada');
    for (let i = 0; i < 4; i++) { const y = 86 - i * 4.4, x0 = 32 + i * 2.5; rr(c, x0, y - 3.8, 56, 3.8, 1.8); c.fillStyle = lin(c, 0, y - 3.8, 0, y, [[0, '#eef3f8'], [1, '#65707c']]); c.fill(); contorno(c, 1.1); }
    c.save(); c.translate(80, 40); c.fillStyle = '#ffe066'; c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 4 : 12; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.strokeStyle = 'rgba(210,120,20,.8)'; c.lineWidth = 1.2; c.stroke(); c.beginPath(); c.arc(0, 0, 3.5, 0, 7); c.fillStyle = '#fff'; c.fill(); c.restore();
  },
  'predio:vidracaria'(c) {
    galpao(c, 4, 46, 52, 28, 16, PAREDE.branca, 'abobada');
    for (let i = 0; i < 3; i++) { const x = 58 + i * 10; c.beginPath(); c.moveTo(x, 88); c.lineTo(x + 7, 50); c.lineTo(x + 19, 52); c.lineTo(x + 12, 88); c.closePath(); c.fillStyle = lin(c, x, 50, x + 19, 88, [[0, 'rgba(225,248,255,.95)'], [0.6, 'rgba(130,200,236,.9)'], [1, 'rgba(80,150,205,.92)']]); c.fill(); contorno(c, 1.3); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x + 6, 76); c.lineTo(x + 10, 58); c.stroke(); }
  },
  'predio:eletrica'(c) {
    galpao(c, 4, 48, 54, 26, 16, PAREDE.branca, 'abobada'); painelSolar(c, [[12, 31], [42, 20], [60, 27], [30, 39]]); bobina(c, 78, 76);
    c.beginPath(); c.moveTo(72, 30); c.lineTo(63, 46); c.lineTo(69, 46); c.lineTo(65, 58); c.lineTo(78, 40); c.lineTo(72, 40); c.closePath(); c.fillStyle = lin(c, 63, 30, 78, 58, [[0, '#fff3a0'], [1, '#f0a41a']]); c.fill(); contorno(c, 1.4);
  },
  'predio:laboratorio'(c) {
    galpao(c, 4, 48, 54, 26, 16, PAREDE.branca, 'abobada');
    rr(c, 47, 34, 32, 5, 2); c.fillStyle = '#dfe5ec'; c.fill(); contorno(c, 1.2);
    c.beginPath(); c.moveTo(49, 35); c.arc(63, 35, 14, Math.PI, 0); c.closePath(); c.fillStyle = rad(c, 57, 27, 2, 18, [[0, '#ffffff'], [1, '#c8d2dc']]); c.fill(); contorno(c, 1.5);
    c.beginPath(); c.moveTo(61, 22); c.lineTo(67, 22.5); c.lineTo(66, 35); c.lineTo(60, 35); c.closePath(); c.fillStyle = '#2a2f38'; c.fill();
    for (let i = 0; i < 3; i++) { const x = 66 + i * 9, yb = 88 - i * 2; c.beginPath(); c.moveTo(x - 4, yb - 14); c.lineTo(x - 4, yb); c.ellipse(x, yb, 4, 1.6, 0, Math.PI, 0, true); c.lineTo(x + 4, yb - 14); c.closePath(); c.fillStyle = lin(c, x - 4, 0, x + 4, 0, [[0, '#8ff0dc'], [1, '#1f8c7c']]); c.fill(); contorno(c, 1.2); c.beginPath(); c.ellipse(x, yb - 14, 4, 1.6, 0, 0, 7); c.fillStyle = '#c8fff2'; c.fill(); contorno(c, 1); }
  },
  // ---- interface ----
  // moeda de crédito da Holding em latão: borda grossa, face com a serrilha gravada e o H em relevo
  creditos(c) {
    c.beginPath(); c.arc(48, 51, 36, 0, 7); c.fillStyle = lin(c, 0, 16, 0, 88, [[0, '#f3dc98'], [0.5, '#c9a24a'], [1, '#7a5a1c']]); c.fill(); contorno(c, 2.4);
    c.beginPath(); c.arc(48, 47, 33, 0, 7); c.fillStyle = rad(c, 38, 34, 3, 42, [[0, '#fff6d8'], [0.5, '#e6c878'], [1, '#b8903a']]); c.fill(); contorno(c, 1.6);
    c.beginPath(); c.arc(48, 47, 25, 0, 7); c.strokeStyle = 'rgba(122,90,28,.6)'; c.lineWidth = 2.6; c.stroke();
    c.fillStyle = 'rgba(122,90,28,.45)'; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.beginPath(); c.arc(48 + Math.cos(a) * 29, 47 + Math.sin(a) * 29, 1.1, 0, 7); c.fill(); }
    const H = (dx, dy, cor) => { c.fillStyle = cor; rr(c, 36 + dx, 33 + dy, 8, 28, 2.5); c.fill(); rr(c, 52 + dx, 33 + dy, 8, 28, 2.5); c.fill(); c.fillRect(42 + dx, 44 + dy, 12, 6); };
    H(-0.8, -0.9, 'rgba(255,250,225,.9)'); H(1.3, 1.5, 'rgba(96,66,14,.85)'); H(0, 0, lin(c, 0, 33, 0, 61, [[0, '#ecd490'], [1, '#a8822e']]));
    reflexo(c, 33, 30, 12, 6, 0.9, -0.7);
  },
  // ficha de Mutirão em latão: borda recortada e o capacete da comunidade gravado, com a estrela
  mutirao(c) {
    c.beginPath(); for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2, r = 37 + 2.6 * Math.cos(a * 12); c.lineTo(48 + Math.cos(a) * r, 50 + Math.sin(a) * r); } c.closePath();
    c.fillStyle = lin(c, 0, 12, 0, 90, [[0, '#f3dc98'], [0.5, '#c9a24a'], [1, '#7a5a1c']]); c.fill(); contorno(c, 2.4);
    c.beginPath(); c.arc(48, 49, 29, 0, 7); c.fillStyle = rad(c, 40, 38, 3, 36, [[0, '#d9b765'], [0.6, '#b08a38'], [1, '#86661f']]); c.fill(); contorno(c, 1.5);
    c.save(); c.translate(48, 51); c.scale(0.52, 0.52); c.translate(-49, -46);
    capacete(c, ['#fffaf0', '#f0d890', '#b8903a'], () => { c.fillStyle = '#fffaf0'; estrela(c, 49, 42, 6, 13); c.fill(); contorno(c, 1.8); });
    c.restore();
  },
  xp(c) { c.lineJoin = 'round'; estrela(c, 48, 52, 17, 39); c.fillStyle = rad(c, 40, 38, 2, 46, [[0, '#fff9cc'], [0.5, '#ffd22a'], [1, '#ef8400']]); c.fill(); contorno(c, 2.4); estrela(c, 48, 52, 8, 19); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill(); reflexo(c, 40, 36, 9, 5, 0.9); },
  // moradores: duas pessoas azuis, como no BuildIt
  pop(c) {
    const pessoa = (x, y, s, cores) => {
      c.beginPath(); c.moveTo(x - 20 * s, y + 30 * s); c.bezierCurveTo(x - 21 * s, y + 4 * s, x - 12 * s, y - 2 * s, x, y - 2 * s); c.bezierCurveTo(x + 12 * s, y - 2 * s, x + 21 * s, y + 4 * s, x + 20 * s, y + 30 * s); c.closePath();
      c.fillStyle = lin(c, 0, y - 2 * s, 0, y + 30 * s, [[0, cores[0]], [1, cores[1]]]); c.fill(); contorno(c, 2.2);
      c.beginPath(); c.arc(x, y - 16 * s, 12.5 * s, 0, 7); c.fillStyle = rad(c, x - 4 * s, y - 21 * s, 1, 15 * s, [[0, cores[2]], [1, cores[0]]]); c.fill(); contorno(c, 2.2);
      reflexo(c, x - 5 * s, y - 21 * s, 5 * s, 3 * s, 0.85);
    };
    pessoa(63, 44, 0.88, ['#78ceff', '#2a88dc', '#d4f0ff']); pessoa(38, 52, 1, ['#3aa2f7', '#1260c2', '#b4e2ff']);
  },
  // bem-estar: folha verde de pé (70% ou mais), amarelada e inclinada, laranja e caída
  bem(c) { folhaBem(c, ['#dcff9e', '#62c832', '#2a8a1a'], 1); },
  'bem-medio'(c) { folhaBem(c, ['#fff6a8', '#d8c42c', '#8f8010'], 0); },
  'bem-baixo'(c) { folhaBem(c, ['#ffd8a8', '#e8782a', '#9a3e10'], -1); },
  agua(c) { c.beginPath(); c.moveTo(48, 12); c.bezierCurveTo(60, 32, 76, 46, 76, 60); c.arc(48, 60, 28, 0, Math.PI); c.bezierCurveTo(20, 46, 36, 32, 48, 12); c.fillStyle = rad(c, 40, 50, 2, 38, [[0, '#e4f8ff'], [0.45, '#48b8f8'], [1, '#1464c4']]); c.fill(); contorno(c, 2.4); reflexo(c, 38, 54, 6, 10, 0.8, 0.3); },
  energia(c) { c.lineJoin = 'round'; c.beginPath(); c.moveTo(58, 8); c.lineTo(20, 54); c.lineTo(44, 54); c.lineTo(34, 88); c.lineTo(78, 36); c.lineTo(54, 36); c.closePath(); c.fillStyle = lin(c, 20, 8, 78, 88, [[0, '#fff7a0'], [0.5, '#ffd21a'], [1, '#f08a00']]); c.fill(); contorno(c, 2.4); reflexo(c, 46, 30, 6, 3, 0.8, -0.9); },
  saneamento(c) { folha(c, 48, 86, 66, 0, '#2f9a22'); c.beginPath(); c.moveTo(48, 34); c.bezierCurveTo(55, 45, 61, 51, 61, 58); c.arc(48, 58, 13, 0, Math.PI); c.bezierCurveTo(35, 51, 41, 45, 48, 34); c.fillStyle = rad(c, 45, 52, 1, 14, [[0, '#e4f8ff'], [1, '#2a90e0']]); c.fill(); contorno(c, 1.6); },
  // composição concluída: a planta da maquete vista de cima ('vida' é o nome que o HUD e os brindes usam)
  planta(c) { plantaSitio(c); },
  vida(c) { plantaSitio(c); },
  // Obras: o capacete dourado do botão grande
  obras(c) { capacete(c, ['#fff5b0', '#ffc81c', '#d68400']); },
  // Produção: galpão azul com telhado em dente de serra e chaminé vermelha
  producao(c) {
    rr(c, 64, 12, 12, 40, 2); c.fillStyle = lin(c, 64, 0, 76, 0, [[0, '#ff8664'], [1, '#c8341c']]); c.fill(); contorno(c, 1.8); c.fillStyle = '#fff'; c.fillRect(64.8, 19, 10.4, 5);
    for (const [x, y, r] of [[73, 8, 6.5], [83, 5, 5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = 'rgba(244,248,252,.96)'; c.fill(); contorno(c, 1.2); }
    c.beginPath(); c.moveTo(12, 82); c.lineTo(12, 46); c.lineTo(30, 32); c.lineTo(30, 46); c.lineTo(48, 32); c.lineTo(48, 46); c.lineTo(66, 32); c.lineTo(66, 46); c.lineTo(84, 46); c.lineTo(84, 82); c.closePath();
    c.fillStyle = lin(c, 0, 32, 0, 82, [[0, '#9ad8ff'], [1, '#2f84d6']]); c.fill(); contorno(c, 2.2);
    c.fillStyle = 'rgba(255,255,255,.6)'; for (const x of [12, 30, 48]) { c.beginPath(); c.moveTo(x + 3, 45); c.lineTo(x + 16, 35.5); c.lineTo(x + 16, 45); c.closePath(); c.fill(); }
    rr(c, 20, 58, 22, 24, 2); c.fillStyle = lin(c, 0, 58, 0, 82, [[0, '#ffc04a'], [1, '#f08414']]); c.fill(); contorno(c, 1.6); c.strokeStyle = 'rgba(150,70,0,.6)'; c.lineWidth = 1.5; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(20, 58 + i * 6); c.lineTo(42, 58 + i * 6); c.stroke(); }
    c.fillStyle = '#fff4a8'; for (const x of [50, 66]) { rr(c, x, 56, 11, 11, 2); c.fill(); contorno(c, 1.2); }
  },
  // Almoxarifado: o armazém azul de teto redondo, porta de enrolar e um caixote
  almox(c) {
    c.beginPath(); c.moveTo(12, 82); c.lineTo(12, 44); c.bezierCurveTo(12, 18, 84, 18, 84, 44); c.lineTo(84, 82); c.closePath(); c.fillStyle = lin(c, 0, 22, 0, 82, [[0, '#94dcff'], [0.5, '#3aa4f2'], [1, '#1a68c6']]); c.fill(); contorno(c, 2.2);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; for (const x of [26, 48, 70]) { c.beginPath(); c.moveTo(x, 26 + Math.abs(x - 48) * 0.3); c.lineTo(x, 44); c.stroke(); }
    rr(c, 25, 46, 46, 36, 3); c.fillStyle = lin(c, 0, 46, 0, 82, [[0, '#f6fafe'], [1, '#b4c6d8']]); c.fill(); contorno(c, 1.8); c.strokeStyle = 'rgba(70,100,130,.5)'; c.lineWidth = 1.5; for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(25, 46 + i * 6); c.lineTo(71, 46 + i * 6); c.stroke(); }
    caixa(c, 48, 70, 20, 12, 8, '#ffdc9c', '#f4a64a', '#c8741c'); c.strokeStyle = 'rgba(140,70,10,.6)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(48, 76); c.lineTo(68, 76); c.stroke();
  },
  // Pedidos: prancheta com a lista marcada
  pedidos(c) {
    rr(c, 18, 14, 60, 72, 8); c.fillStyle = lin(c, 18, 0, 78, 0, [[0, '#f6a854'], [1, '#c2661c']]); c.fill(); contorno(c, 2.2);
    rr(c, 25, 24, 46, 56, 3); c.fillStyle = '#fffdf4'; c.fill(); contorno(c, 1.4);
    rr(c, 34, 8, 28, 14, 5); c.fillStyle = lin(c, 0, 8, 0, 22, [[0, '#eef3f8'], [1, '#8698ac']]); c.fill(); contorno(c, 1.6);
    c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const y = 37 + i * 14; c.strokeStyle = '#34ac22'; c.lineWidth = 4.2; c.beginPath(); c.moveTo(30, y); c.lineTo(34.5, y + 4.5); c.lineTo(41, y - 4); c.stroke(); c.strokeStyle = '#8ca2ba'; c.lineWidth = 3; c.beginPath(); c.moveTo(46, y); c.lineTo(65, y); c.stroke(); }
  },
  // Trocas: setas verde e laranja (sai e entra)
  troca(c) {
    const seta = (pts, cor1, cor2) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = lin(c, 0, pts[1][1] - 12, 0, pts[1][1] + 16, [[0, cor1], [1, cor2]]); c.fill(); contorno(c, 2.2); };
    c.lineJoin = 'round'; seta([[12, 22], [58, 22], [58, 11], [86, 30], [58, 49], [58, 38], [12, 38]], '#c8f77a', '#3aa61e');
    seta([[84, 58], [38, 58], [38, 47], [10, 66], [38, 85], [38, 74], [84, 74]], '#ffd27a', '#f07c0c');
    reflexo(c, 30, 26, 10, 3, 0.8, 0); reflexo(c, 60, 62, 10, 3, 0.8, 0);
  },
  // Apreciar: câmera escura com lente azul
  apreciar(c) {
    rr(c, 10, 30, 76, 50, 12); c.fillStyle = lin(c, 0, 30, 0, 80, [[0, '#6a7c96'], [1, '#232e46']]); c.fill(); contorno(c, 2.2);
    rr(c, 28, 20, 26, 14, 5); c.fillStyle = '#3a4862'; c.fill(); contorno(c, 1.6);
    c.beginPath(); c.arc(48, 55, 21, 0, 7); c.fillStyle = lin(c, 0, 34, 0, 76, [[0, '#f2f6fa'], [1, '#9aaabc']]); c.fill(); contorno(c, 1.8);
    c.beginPath(); c.arc(48, 55, 15, 0, 7); c.fillStyle = rad(c, 43, 49, 1, 17, [[0, '#a8ecff'], [0.5, '#2a86d8'], [1, '#0a2654']]); c.fill(); contorno(c, 1.4);
    c.beginPath(); c.arc(43, 49.5, 4.5, 0, 7); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill();
    c.beginPath(); c.arc(75, 41, 4.2, 0, 7); c.fillStyle = '#ff4a3a'; c.fill(); contorno(c, 1.2); rr(c, 15, 37, 11, 6, 2); c.fillStyle = '#ffe36b'; c.fill();
  },
  // Configurações: engrenagem azul brilhante
  config(c) {
    c.save(); c.translate(48, 48); c.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; for (const [d, r] of [[-0.3, 29], [-0.17, 39], [0.17, 39], [0.3, 29]]) c.lineTo(Math.cos(a + d) * r, Math.sin(a + d) * r); }
    c.closePath(); c.fillStyle = rad(c, -10, -12, 2, 44, [[0, '#b8ecff'], [0.5, '#34a2f2'], [1, '#1256b0']]); c.fill(); contorno(c, 2.4);
    c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fillStyle = lin(c, 0, -13, 0, 13, [[0, '#ffffff'], [1, '#cfe2f4']]); c.fill(); contorno(c, 2);
    c.beginPath(); c.arc(0, 0, 21, 0, 7); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.stroke(); c.restore();
  },
  ok(c) { c.lineCap = 'round'; c.lineJoin = 'round'; const v = () => { c.beginPath(); c.moveTo(22, 50); c.lineTo(40, 68); c.lineTo(74, 30); }; v(); c.lineWidth = 19; c.strokeStyle = 'rgba(16,40,20,.7)'; c.stroke(); v(); c.lineWidth = 14; c.strokeStyle = '#ffffff'; c.stroke(); },
  // check verde (obra pronta, meta cumprida)
  check(c) { c.lineCap = 'round'; c.lineJoin = 'round'; const v = () => { c.beginPath(); c.moveTo(18, 50); c.lineTo(40, 71); c.lineTo(80, 24); }; v(); c.lineWidth = 23; c.strokeStyle = '#1c6a12'; c.stroke(); v(); c.lineWidth = 17; c.strokeStyle = lin(c, 0, 24, 0, 74, [[0, '#caff84'], [0.5, '#62cc30'], [1, '#2e9a1a']]); c.stroke(); reflexo(c, 62, 38, 9, 3.2, 0.85, -0.85); },
  subir(c) { c.lineJoin = 'round'; c.beginPath(); c.moveTo(48, 10); c.lineTo(83, 48); c.lineTo(62, 48); c.lineTo(62, 85); c.lineTo(34, 85); c.lineTo(34, 48); c.lineTo(13, 48); c.closePath(); c.fillStyle = lin(c, 0, 10, 0, 85, [[0, '#d6ff8a'], [0.5, '#5ec634'], [1, '#2a861a']]); c.fill(); contorno(c, 2.4); reflexo(c, 42, 34, 10, 5, 0.75, -0.9); },
  // grua amarela treliçada com a carga
  grua(c) {
    const amarelo = lin(c, 0, 10, 0, 90, [[0, '#ffe66e'], [1, '#f09e0a']]);
    rr(c, 28, 20, 13, 64, 2); c.fillStyle = amarelo; c.fill(); contorno(c, 1.8); c.strokeStyle = 'rgba(150,76,0,.75)'; c.lineWidth = 1.6; for (let y = 24; y < 80; y += 10) { c.beginPath(); c.moveTo(28, y); c.lineTo(41, y + 10); c.stroke(); }
    rr(c, 10, 13, 78, 10, 2); c.fillStyle = amarelo; c.fill(); contorno(c, 1.8); c.strokeStyle = 'rgba(150,76,0,.75)'; for (let x = 14; x < 86; x += 8) { c.beginPath(); c.moveTo(x, 13); c.lineTo(x + 8, 23); c.stroke(); }
    rr(c, 8, 22, 15, 13, 2); c.fillStyle = '#62748e'; c.fill(); contorno(c, 1.4); rr(c, 41, 22, 13, 11, 2); c.fillStyle = '#94dcff'; c.fill(); contorno(c, 1.4);
    c.strokeStyle = '#26324a'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(76, 23); c.lineTo(76, 52); c.stroke();
    rr(c, 63, 52, 26, 15, 2); c.fillStyle = lin(c, 0, 52, 0, 67, [[0, '#ff9468'], [1, '#d0441e']]); c.fill(); contorno(c, 1.6);
    rr(c, 19, 82, 32, 7, 2); c.fillStyle = '#56657c'; c.fill(); contorno(c, 1.4);
  },
  // placa de obra: prancha azul com a planta em branco
  placa(c) {
    c.fillStyle = lin(c, 44, 0, 52, 0, [[0, '#dc9450'], [1, '#8a461a']]); c.beginPath(); c.rect(44, 52, 8, 34); c.fill(); contorno(c, 1.4);
    rr(c, 10, 12, 76, 46, 7); c.fillStyle = lin(c, 0, 12, 0, 58, [[0, '#72ccff'], [1, '#1b72cc']]); c.fill(); contorno(c, 2.2);
    rr(c, 15, 17, 66, 36, 4); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 2.8; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, 46); c.lineTo(24, 31); c.lineTo(36, 23); c.lineTo(48, 31); c.lineTo(48, 46); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(32, 46); c.lineTo(32, 38); c.lineTo(40, 38); c.lineTo(40, 46); c.stroke();
    c.beginPath(); c.moveTo(55, 29); c.lineTo(73, 29); c.moveTo(55, 37); c.lineTo(70, 37); c.moveTo(55, 45); c.lineTo(66, 45); c.stroke();
  },
  // repasse: pilha de moedas
  repasse(c) {
    for (let i = 0; i < 4; i++) { const y = 72 - i * 12, x = 48 + (i % 2 ? 2 : -1.5);
      c.beginPath(); c.moveTo(x - 28, y); c.lineTo(x - 28, y + 6); c.ellipse(x, y + 6, 28, 9, 0, Math.PI, 0, true); c.lineTo(x + 28, y); c.ellipse(x, y, 28, 9, 0, 0, Math.PI, false); c.closePath(); c.fillStyle = lin(c, x - 28, 0, x + 28, 0, [[0, '#f0a412'], [0.4, '#ffd23a'], [1, '#c87400']]); c.fill(); contorno(c, 1.8);
      c.beginPath(); c.ellipse(x, y, 28, 9, 0, 0, 7); c.fillStyle = rad(c, x - 8, y - 3, 1, 30, [[0, '#fff7b8'], [0.6, '#ffd23a'], [1, '#f2a20c']]); c.fill(); contorno(c, 1.6);
      c.beginPath(); c.ellipse(x, y, 18, 5.5, 0, 0, 7); c.strokeStyle = 'rgba(196,112,0,.6)'; c.lineWidth = 1.6; c.stroke(); }
    reflexo(c, 38, 34, 9, 3, 0.8, 0);
  },
  foto(c) { rr(c, 12, 18, 72, 60, 6); c.fillStyle = '#fbf8f0'; c.fill(); contorno(c); c.fillStyle = lin(c, 0, 24, 0, 70, [[0, '#4ab4f4'], [1, '#bfe8ff']]); c.fillRect(18, 24, 60, 48); c.fillStyle = '#58c43a'; c.beginPath(); c.moveTo(18, 72); c.lineTo(40, 46); c.lineTo(54, 60); c.lineTo(64, 50); c.lineTo(78, 72); c.fill(); c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(64, 36, 7, 0, 7); c.fill(); },
  tela(c) { c.lineCap = 'round'; c.lineJoin = 'round'; for (const [w, cor] of [[12, 'rgba(16,26,48,.7)'], [7.5, '#ffffff']]) { c.strokeStyle = cor; c.lineWidth = w; for (const [x, y, dx, dy] of [[16, 16, 1, 1], [80, 16, -1, 1], [16, 80, 1, -1], [80, 80, -1, -1]]) { c.beginPath(); c.moveTo(x, y + dy * 20); c.lineTo(x, y); c.lineTo(x + dx * 20, y); c.stroke(); } } },
  mapa(c) { c.beginPath(); c.moveTo(12, 24); c.lineTo(36, 14); c.lineTo(60, 24); c.lineTo(84, 14); c.lineTo(84, 72); c.lineTo(60, 82); c.lineTo(36, 72); c.lineTo(12, 82); c.closePath(); c.fillStyle = lin(c, 0, 14, 0, 82, [[0, '#fff4d6'], [1, '#ecd4a0']]); c.fill(); contorno(c); c.fillStyle = 'rgba(120,200,255,.55)'; c.beginPath(); c.moveTo(36, 14); c.lineTo(60, 24); c.lineTo(60, 82); c.lineTo(36, 72); c.fill(); c.strokeStyle = '#4fb83a'; c.lineWidth = 3.4; c.beginPath(); c.arc(38, 46, 12, 0, 7); c.stroke(); c.fillStyle = '#f0463c'; c.beginPath(); c.arc(64, 44, 8, Math.PI, 0); c.lineTo(64, 60); c.closePath(); c.fill(); contorno(c, 1.4); c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 44, 3, 0, 7); c.fill(); },
  // troféu (medalha do capítulo)
  trofeu(c) {
    c.lineWidth = 6.5; c.lineCap = 'round'; c.strokeStyle = '#e89a0c'; c.beginPath(); c.arc(25, 35, 10, Math.PI * 0.55, Math.PI * 1.55); c.stroke(); c.beginPath(); c.arc(71, 35, 10, -Math.PI * 0.55, Math.PI * 0.45); c.stroke();
    c.beginPath(); c.moveTo(24, 18); c.lineTo(72, 18); c.bezierCurveTo(72, 46, 61, 58, 48, 58); c.bezierCurveTo(35, 58, 24, 46, 24, 18); c.closePath(); c.fillStyle = lin(c, 24, 0, 72, 0, [[0, '#ffd23a'], [0.35, '#fff6c4'], [0.6, '#ffd23a'], [1, '#d88200']]); c.fill(); contorno(c, 2.2);
    c.beginPath(); c.ellipse(48, 18, 24, 5.5, 0, 0, 7); c.fillStyle = '#c47400'; c.fill(); contorno(c, 1.6);
    c.beginPath(); c.rect(43, 57, 10, 11); c.fillStyle = lin(c, 0, 57, 0, 68, [[0, '#ffd23a'], [1, '#c87a00']]); c.fill(); contorno(c, 1.6);
    rr(c, 29, 67, 38, 14, 4); c.fillStyle = lin(c, 0, 67, 0, 81, [[0, '#ffd23a'], [1, '#c87400']]); c.fill(); contorno(c, 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(35, 71, 26, 3);
  },
  // selo do nível no HUD: o Anel do Campus com os terraços vazados (o XP os enche por baixo, no sentido horário)
  'anel-campus'(c) { anelCampus(c, false); },
  // o mesmo anel com os terraços verdes: o selo do modal de subir de nível
  nivel(c) { anelCampus(c, true); },
  // placa de latão gravada (o capítulo): parafusos nos cantos, o anel do campus e o letreiro
  'placa-latao'(c) {
    rr(c, 6, 20, 84, 56, 8); c.fillStyle = lin(c, 0, 20, 0, 76, [[0, '#f6e2a4'], [0.5, '#d4b060'], [1, '#9a7428']]); c.fill(); contorno(c, 2.2);
    rr(c, 11, 25, 74, 46, 5); c.strokeStyle = 'rgba(122,90,28,.6)'; c.lineWidth = 1.6; c.stroke(); rr(c, 12.5, 26.5, 71, 43, 4.5); c.strokeStyle = 'rgba(255,250,225,.55)'; c.lineWidth = 1; c.stroke();
    for (const [x, y] of [[16, 30], [80, 30], [16, 66], [80, 66]]) { c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fillStyle = rad(c, x - 0.8, y - 0.8, 0.3, 3, [[0, '#fff6d8'], [1, '#8a6a24']]); c.fill(); c.strokeStyle = 'rgba(90,64,16,.7)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x - 1.6, y + 1.2); c.lineTo(x + 1.6, y - 1.2); c.stroke(); }
    c.strokeStyle = '#6e4e14'; c.lineWidth = 3.2; c.beginPath(); c.arc(31, 48, 9, 0, 7); c.stroke(); c.beginPath(); c.arc(31, 48, 3.4, 0, 7); c.fillStyle = '#6e4e14'; c.fill();
    c.fillStyle = '#6e4e14'; rr(c, 45, 40, 32, 5.5, 2.7); c.fill(); rr(c, 45, 51, 22, 4.5, 2.2); c.fill(); c.fillStyle = 'rgba(255,248,220,.6)'; rr(c, 45, 46, 32, 1.2, 0.6); c.fill();
    reflexo(c, 32, 28, 18, 3.5, 0.75, 0);
  },
  // bichos do santuário: a pegada
  bichos(c) {
    const cor = (x, y, r) => rad(c, x - r * 0.3, y - r * 0.4, 1, r * 1.2, [[0, '#f8c690'], [0.6, '#c47a3a'], [1, '#7c4418']]);
    c.beginPath(); c.moveTo(48, 46); c.bezierCurveTo(68, 44, 80, 70, 66, 79); c.bezierCurveTo(58, 84, 38, 84, 30, 79); c.bezierCurveTo(16, 70, 28, 44, 48, 46); c.closePath(); c.fillStyle = cor(48, 62, 24); c.fill(); contorno(c, 2.2);
    for (const [x, y, rx, ry, a] of [[22, 42, 8, 10.5, -0.45], [37, 27, 8.5, 11, -0.12], [59, 27, 8.5, 11, 0.12], [74, 42, 8, 10.5, 0.45]]) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, 7); c.fillStyle = cor(x, y, ry); c.fill(); contorno(c, 2); reflexo(c, x - 2, y - 4, 3, 2, 0.7, a - 0.5); }
    reflexo(c, 42, 56, 9, 4, 0.7, -0.3);
  },
  lixo(c) { c.beginPath(); c.moveTo(26, 30); c.lineTo(70, 30); c.lineTo(65, 82); c.lineTo(31, 82); c.closePath(); c.fillStyle = lin(c, 26, 0, 70, 0, [[0, '#dce4ec'], [0.5, '#a2b0be'], [1, '#6a7888']]); c.fill(); contorno(c);
    c.strokeStyle = 'rgba(60,70,84,.55)'; c.lineWidth = 3; for (const x of [38, 48, 58]) { c.beginPath(); c.moveTo(x, 38); c.lineTo(x - (x - 48) * 0.1, 76); c.stroke(); }
    rr(c, 20, 22, 56, 9, 3); c.fillStyle = '#f0463c'; c.fill(); contorno(c, 1.6); rr(c, 40, 15, 16, 8, 3); c.fillStyle = '#b8301e'; c.fill(); contorno(c, 1.4); },
  // disposição da equipe: cafezinho fumegante
  disposicao(c) { c.beginPath(); c.ellipse(48, 78, 30, 7, 0, 0, 7); c.fillStyle = '#eef2f6'; c.fill(); contorno(c, 1.6); c.beginPath(); c.moveTo(24, 40); c.lineTo(68, 40); c.quadraticCurveTo(68, 76, 46, 76); c.quadraticCurveTo(24, 76, 24, 40); c.closePath(); c.fillStyle = lin(c, 24, 0, 68, 0, [[0, '#ff8a6a'], [1, '#d0381e']]); c.fill(); contorno(c);
    c.beginPath(); c.ellipse(46, 41, 21, 4, 0, 0, 7); c.fillStyle = '#5a3418'; c.fill(); c.beginPath(); c.arc(72, 52, 9, -1.3, 1.3); c.lineWidth = 5; c.strokeStyle = '#e0503a'; c.stroke(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(22,28,50,.6)'; c.beginPath(); c.arc(72, 52, 11.5, -1.3, 1.3); c.stroke();
    c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 3.5; for (const x of [38, 50]) { c.beginPath(); c.moveTo(x, 34); c.bezierCurveTo(x - 7, 26, x + 7, 22, x, 12); c.stroke(); } },
  // horas do dia no Apreciar: ciclo automático, manhã, meio-dia, pôr do sol e noite
  ciclo(c) {
    c.save(); c.beginPath(); c.arc(48, 48, 36, 0, 7); c.clip();
    c.fillStyle = lin(c, 14, 14, 82, 82, [[0, '#9ae0ff'], [0.49, '#48aef2'], [0.51, '#2c3c8a'], [1, '#141c50']]); c.fillRect(0, 0, 96, 96); c.restore();
    c.beginPath(); c.arc(48, 48, 36, 0, 7); contorno(c, 2.4);
    sol(c, 34, 34, 9, ['#fffbd0', '#ffd21a', '#f09000'], 8);
    c.save(); c.beginPath(); c.rect(0, 0, 96, 96); c.arc(69, 56, 10, 0, 7, true); c.clip(); c.beginPath(); c.arc(62, 62, 12, 0, 7); c.fillStyle = '#fff4b8'; c.fill(); c.restore();
  },
  manha(c) { sol(c, 48, 58, 17, ['#fffbd0', '#ffd21a', '#f7a20a']); c.beginPath(); c.moveTo(6, 86); c.bezierCurveTo(20, 56, 40, 60, 52, 68); c.bezierCurveTo(64, 56, 80, 58, 90, 86); c.closePath(); c.fillStyle = lin(c, 0, 56, 0, 86, [[0, '#9ce86a'], [1, '#3a9a28']]); c.fill(); contorno(c, 2.2); c.strokeStyle = '#26324a'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(66, 26); c.quadraticCurveTo(70, 22, 74, 26); c.quadraticCurveTo(78, 22, 82, 26); c.stroke(); },
  sol(c) { sol(c, 48, 48, 21, ['#fffce0', '#ffdc1a', '#f69a00'], 12); reflexo(c, 41, 40, 8, 5, 0.8); },
  por(c) { sol(c, 48, 60, 19, ['#fff0b0', '#ff8a2a', '#e0441a']); c.beginPath(); c.rect(6, 62, 84, 24); c.fillStyle = lin(c, 0, 62, 0, 86, [[0, '#7a5ad8'], [1, '#3a2a8a']]); c.fill(); contorno(c, 2.2); c.strokeStyle = 'rgba(255,190,120,.9)'; c.lineWidth = 3; c.lineCap = 'round'; for (const [x0, x1, y] of [[30, 66, 70], [38, 58, 77], [44, 52, 83]]) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); } },
  lua(c) { c.save(); c.beginPath(); c.rect(0, 0, 96, 96); c.arc(62, 40, 25, 0, 7, true); c.clip(); c.beginPath(); c.arc(44, 52, 30, 0, 7); c.fillStyle = rad(c, 30, 52, 2, 34, [[0, '#fffbe0'], [1, '#ffd24a']]); c.fill(); c.restore(); for (const [x, y, r] of [[74, 66, 8], [78, 20, 6], [58, 82, 4.5]]) { estrela(c, x, y, r * 0.42, r); c.fillStyle = '#fff6b0'; c.fill(); contorno(c, 1.2); } },
  // economia: calendário do jogo (folha com a faixa azul e as argolas), valuation (barras subindo com a seta),
  // empréstimo (banco com a moeda) e acelerador (cronômetro com o raio)
  // relógio (o tempo de uma obra ou lote nos botões): mostrador claro, aro escuro, 12 traços e dois ponteiros
  relogio(c) {
    c.beginPath(); c.arc(48, 50, 36, 0, 7); c.fillStyle = lin(c, 0, 14, 0, 86, [[0, '#5a7a9e'], [1, '#2a4468']]); c.fill(); contorno(c, 2.2);
    c.beginPath(); c.arc(48, 50, 29, 0, 7); c.fillStyle = rad(c, 42, 42, 2, 32, [[0, '#ffffff'], [1, '#dbe8f4']]); c.fill(); contorno(c, 1.4);
    c.strokeStyle = '#3a5678'; c.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const L = i % 3 ? 3.5 : 6; c.lineWidth = i % 3 ? 1.8 : 2.6; c.beginPath(); c.moveTo(48 + Math.cos(a) * (27 - L), 50 + Math.sin(a) * (27 - L)); c.lineTo(48 + Math.cos(a) * 26, 50 + Math.sin(a) * 26); c.stroke(); }
    c.lineWidth = 4.2; c.strokeStyle = '#1e3350'; c.beginPath(); c.moveTo(48, 50); c.lineTo(48, 32); c.stroke(); c.lineWidth = 3.4; c.strokeStyle = '#ff9f1a'; c.beginPath(); c.moveTo(48, 50); c.lineTo(62, 58); c.stroke();
    c.beginPath(); c.arc(48, 50, 3.2, 0, 7); c.fillStyle = '#1e3350'; c.fill(); c.beginPath(); c.arc(40, 18, 5, 0, 7); c.fillStyle = '#ff9f1a'; c.fill(); contorno(c, 1.4); reflexo(c, 38, 36, 10, 6, 0.7, -0.7);
  },
  calendario(c) {
    rr(c, 16, 22, 64, 62, 9); c.fillStyle = lin(c, 0, 22, 0, 84, [[0, '#ffffff'], [1, '#dcebf8']]); c.fill(); contorno(c, 2.2);
    c.save(); rr(c, 16, 22, 64, 62, 9); c.clip(); c.fillStyle = lin(c, 0, 22, 0, 42, [[0, '#6ad2ff'], [1, '#1f83dc']]); c.fillRect(16, 22, 64, 20); c.restore(); rr(c, 16, 22, 64, 62, 9); contorno(c, 2.2);
    for (const x of [32, 64]) { c.beginPath(); c.rect(x - 3, 12, 6, 18); c.fillStyle = lin(c, x - 3, 0, x + 3, 0, [[0, '#f6f8fb'], [1, '#8c9cb0']]); c.fill(); contorno(c, 1.4); }
    for (let i = 0; i < 9; i++) { const x = 25 + (i % 3) * 17, y = 48 + Math.floor(i / 3) * 12; rr(c, x, y, 12, 8, 2); c.fillStyle = i === 4 ? '#f2453a' : '#b9d2ea'; c.fill(); }
  },
  valuation(c) {
    for (const [i, h] of [[0, 22], [1, 36], [2, 54]]) { const x = 16 + i * 22; rr(c, x, 82 - h, 16, h, 4); c.fillStyle = lin(c, x, 0, x + 16, 0, [[0, i === 2 ? '#a8ee64' : '#86d9ff'], [1, i === 2 ? '#3fa320' : '#1f83dc']]); c.fill(); contorno(c, 1.8); }
    c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#ff9f1a'; c.lineWidth = 6; c.beginPath(); c.moveTo(20, 46); c.lineTo(46, 30); c.lineTo(58, 38); c.lineTo(80, 16); c.stroke();
    c.beginPath(); c.moveTo(66, 14); c.lineTo(84, 12); c.lineTo(82, 30); c.closePath(); c.fillStyle = '#ff9f1a'; c.fill(); contorno(c, 1.6);
    c.strokeStyle = 'rgba(22,28,50,.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(20, 46); c.lineTo(46, 30); c.lineTo(58, 38); c.lineTo(80, 16); c.stroke();
  },
  emprestimo(c) {
    c.beginPath(); c.moveTo(12, 38); c.lineTo(48, 14); c.lineTo(84, 38); c.closePath(); c.fillStyle = lin(c, 0, 14, 0, 38, [[0, '#ffffff'], [1, '#c8dcee']]); c.fill(); contorno(c, 2);
    for (const x of [20, 40, 60]) { rr(c, x, 40, 12, 28, 2); c.fillStyle = lin(c, x, 0, x + 12, 0, [[0, '#f8fbfe'], [0.5, '#dbe8f4'], [1, '#98acc0']]); c.fill(); contorno(c, 1.6); }
    rr(c, 10, 68, 76, 12, 3); c.fillStyle = lin(c, 0, 68, 0, 80, [[0, '#e6f0fa'], [1, '#9db4cc']]); c.fill(); contorno(c, 2);
    c.beginPath(); c.arc(72, 66, 15, 0, 7); c.fillStyle = rad(c, 67, 61, 2, 17, [[0, '#fff8c4'], [0.5, '#ffd23a'], [1, '#e08a00']]); c.fill(); contorno(c, 2);
    c.beginPath(); c.arc(72, 66, 9, 0, 7); c.strokeStyle = 'rgba(196,112,0,.65)'; c.lineWidth = 2.2; c.stroke();
  },
  acelerar(c) {
    rr(c, 42, 8, 12, 10, 3); c.fillStyle = '#8c9cb0'; c.fill(); contorno(c, 1.6); c.beginPath(); c.rect(45, 16, 6, 8); c.fillStyle = '#5a6a80'; c.fill();
    c.beginPath(); c.arc(48, 54, 30, 0, 7); c.fillStyle = lin(c, 0, 24, 0, 84, [[0, '#ffffff'], [1, '#c8dcee']]); c.fill(); contorno(c, 2.4);
    c.beginPath(); c.arc(48, 54, 23, 0, 7); c.fillStyle = rad(c, 42, 46, 2, 26, [[0, '#ffffff'], [1, '#dbe9f6']]); c.fill(); c.strokeStyle = 'rgba(22,28,50,.35)'; c.lineWidth = 1.4; c.stroke();
    c.lineCap = 'round'; c.strokeStyle = 'rgba(22,28,50,.5)'; c.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(48 + Math.cos(a) * 19, 54 + Math.sin(a) * 19); c.lineTo(48 + Math.cos(a) * 22, 54 + Math.sin(a) * 22); c.stroke(); }
    c.beginPath(); c.moveTo(52, 36); c.lineTo(38, 58); c.lineTo(48, 58); c.lineTo(44, 74); c.lineTo(60, 50); c.lineTo(50, 50); c.closePath(); c.fillStyle = lin(c, 0, 36, 0, 74, [[0, '#fff2a0'], [0.5, '#ffd23a'], [1, '#f09000']]); c.fill(); contorno(c, 1.8);
  },
};
// retratos redondos dos conselheiros: fundo na cor de cada um, busto, rosto e o que distingue cada um
const RETRATO = {
  iris: { fundo: ['#fff6e0', '#f4c870', '#cc8a26'], pele: ['#ffdcbc', '#eab48a'], roupa: ['#34c8b8', '#10867c'], gola: '#ffffff', cabelo: ['#6a3a22', '#3a1e10'] },
  tome: { fundo: ['#eef8ff', '#90c8ee', '#3f82c0'], pele: ['#eab080', '#c07c48'], roupa: ['#ffa640', '#dc640c'], gola: '#3a4a60', cabelo: ['#4a3020', '#2a1a10'] },
  nara: { fundo: ['#f0fff2', '#98dca4', '#44985a'], pele: ['#f0bc8e', '#cc8c58'], roupa: ['#86cc4a', '#4a8a20'], gola: '#e8f4d8', cabelo: ['#3a2a2e', '#140e10'] },
  caio: { fundo: ['#f8f2ff', '#c0aaf4', '#7656c6'], pele: ['#ac744c', '#7c4c2c'], roupa: ['#ffffff', '#c6d2e0'], gola: '#8a5ae0', cabelo: ['#2a1e1c', '#0e0a0a'] },
  cida: { fundo: ['#fff2ec', '#f6b4a0', '#cc6446'], pele: ['#cc9060', '#a2663a'], roupa: ['#ff8292', '#d24058'], gola: '#ffd23a', cabelo: ['#ffffff', '#b8b8c6'] },
};
function retrato(c, q) {
  const R = RETRATO[q] || RETRATO.iris; const [p1, p2] = R.pele, [h1, h2] = R.cabelo;
  c.save(); c.beginPath(); c.arc(48, 48, 48, 0, 7); c.clip();
  c.fillStyle = rad(c, 38, 26, 4, 72, [[0, R.fundo[0]], [0.45, R.fundo[1]], [1, R.fundo[2]]]); c.fillRect(0, 0, 96, 96);
  const cabelo = () => lin(c, 0, 14, 0, 80, [[0, h1], [1, h2]]);
  // cabelo que cai atrás (Nara, Dona Cida)
  if (q === 'nara') { c.beginPath(); c.moveTo(24, 44); c.bezierCurveTo(22, 20, 74, 20, 72, 44); c.bezierCurveTo(76, 60, 78, 74, 74, 86); c.lineTo(22, 86); c.bezierCurveTo(18, 74, 20, 60, 24, 44); c.fillStyle = cabelo(); c.fill(); contorno(c, 1.6); }
  if (q === 'cida') for (const [x, y, r] of [[28, 50, 11], [68, 50, 11], [30, 34, 12], [66, 34, 12], [48, 24, 14], [38, 26, 12], [58, 26, 12]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = rad(c, x - 3, y - 4, 1, r, [[0, h1], [1, h2]]); c.fill(); contorno(c, 1.2); }
  // busto
  c.beginPath(); c.moveTo(6, 100); c.bezierCurveTo(8, 80, 22, 72, 36, 71); c.lineTo(60, 71); c.bezierCurveTo(74, 72, 88, 80, 90, 100); c.closePath(); c.fillStyle = lin(c, 0, 70, 0, 100, [[0, R.roupa[0]], [1, R.roupa[1]]]); c.fill(); contorno(c, 1.8);
  if (q === 'tome') { c.fillStyle = '#e8f4f8'; c.fillRect(14, 84, 68, 5); c.fillStyle = R.gola; c.beginPath(); c.moveTo(38, 71); c.lineTo(48, 84); c.lineTo(58, 71); c.fill(); }
  else if (q === 'caio') { c.beginPath(); c.moveTo(38, 71); c.lineTo(48, 90); c.lineTo(58, 71); c.fillStyle = R.gola; c.fill(); c.strokeStyle = 'rgba(22,28,50,.45)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(38, 71); c.lineTo(44, 96); c.moveTo(58, 71); c.lineTo(52, 96); c.stroke(); }
  else if (q === 'cida') { c.fillStyle = R.gola; for (let i = 0; i < 7; i++) { const a = Math.PI * (0.2 + i * 0.1); c.beginPath(); c.arc(48 + Math.cos(a) * 13, 70 + Math.sin(a) * 9, 2.3, 0, 7); c.fill(); } }
  else { c.beginPath(); c.moveTo(39, 71); c.lineTo(48, 83); c.lineTo(57, 71); c.fillStyle = R.gola; c.fill(); contorno(c, 1.2); }
  // pescoço, orelhas e rosto
  c.fillStyle = p2; c.fillRect(41, 58, 14, 15);
  for (const x of [29, 67]) { c.beginPath(); c.ellipse(x, 48, 4.5, 6, 0, 0, 7); c.fillStyle = p2; c.fill(); contorno(c, 1.2); }
  c.beginPath(); c.ellipse(48, 45, 19, 22, 0, 0, 7); c.fillStyle = rad(c, 42, 38, 2, 26, [[0, p1], [1, p2]]); c.fill(); contorno(c, 1.6);
  // cabelo de cima e acessórios da cabeça
  if (q === 'iris') { c.beginPath(); c.arc(48, 17, 10, 0, 7); c.fillStyle = cabelo(); c.fill(); contorno(c, 1.4); c.beginPath(); c.moveTo(28, 50); c.bezierCurveTo(24, 22, 72, 22, 68, 50); c.bezierCurveTo(66, 38, 58, 32, 48, 34); c.bezierCurveTo(38, 32, 30, 38, 28, 50); c.fillStyle = cabelo(); c.fill(); contorno(c, 1.4); }
  if (q === 'nara') { c.beginPath(); c.moveTo(28, 48); c.bezierCurveTo(24, 22, 72, 22, 68, 48); c.bezierCurveTo(62, 34, 44, 30, 28, 48); c.fillStyle = cabelo(); c.fill(); contorno(c, 1.4); folha(c, 66, 32, 14, 0.9, '#3aa02a'); }
  if (q === 'caio') { c.fillStyle = cabelo(); for (let i = 0; i < 9; i++) { const a = Math.PI * (1.05 + i * 0.113); c.beginPath(); c.arc(48 + Math.cos(a) * 18, 43 + Math.sin(a) * 18, 6.5, 0, 7); c.fill(); } }
  if (q === 'cida') for (const [x, y, r] of [[36, 27, 9], [48, 23, 10], [60, 27, 9]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = rad(c, x - 3, y - 4, 1, r, [[0, h1], [1, h2]]); c.fill(); }
  if (q === 'tome') { c.beginPath(); c.moveTo(26, 38); c.bezierCurveTo(26, 14, 70, 14, 70, 38); c.closePath(); c.fillStyle = rad(c, 40, 22, 2, 30, [[0, '#fff5b0'], [0.6, '#ffc81c'], [1, '#d68400']]); c.fill(); contorno(c, 1.8); c.beginPath(); c.ellipse(48, 38, 27, 5, 0, 0, 7); c.fillStyle = '#f0a80c'; c.fill(); contorno(c, 1.6); c.fillStyle = '#ffe680'; c.fillRect(45, 18, 6, 19);
    c.beginPath(); c.moveTo(30, 50); c.bezierCurveTo(30, 70, 66, 70, 66, 50); c.bezierCurveTo(62, 60, 34, 60, 30, 50); c.fillStyle = cabelo(); c.fill(); }
  // olhos, sobrancelhas, nariz, boca e bochechas
  for (const x of [41, 55]) { c.beginPath(); c.ellipse(x, 47, 2.8, 3.6, 0, 0, 7); c.fillStyle = '#1e1a24'; c.fill(); c.beginPath(); c.arc(x + 0.9, 45.8, 1, 0, 7); c.fillStyle = '#fff'; c.fill(); }
  c.strokeStyle = q === 'cida' ? '#8a8a96' : h2; c.lineWidth = 2; c.lineCap = 'round'; for (const x of [41, 55]) { c.beginPath(); c.moveTo(x - 4, 41); c.quadraticCurveTo(x, 38.5, x + 4, 41); c.stroke(); }
  c.strokeStyle = 'rgba(120,60,30,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(48, 49); c.quadraticCurveTo(46, 54, 49, 54.5); c.stroke();
  c.strokeStyle = '#8a2a2a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(42, 58); c.quadraticCurveTo(48, 63, 54, 58); c.stroke();
  c.fillStyle = 'rgba(255,110,110,.32)'; for (const x of [36, 60]) { c.beginPath(); c.ellipse(x, 55, 4.2, 2.8, 0, 0, 7); c.fill(); }
  if (q === 'iris') { c.strokeStyle = '#3a2418'; c.lineWidth = 2; for (const x of [41, 55]) { c.beginPath(); c.arc(x, 47, 6.2, 0, 7); c.stroke(); } c.beginPath(); c.moveTo(47.2, 46.5); c.lineTo(48.8, 46.5); c.stroke(); }
  if (q === 'caio') { c.strokeStyle = '#1e1a24'; c.lineWidth = 2; for (const x of [41, 55]) { rr(c, x - 6.5, 42.5, 13, 9.5, 2.5); c.stroke(); } c.beginPath(); c.moveTo(47.5, 46); c.lineTo(48.5, 46); c.stroke(); }
  if (q === 'cida') { c.fillStyle = '#ffd23a'; for (const x of [29, 67]) { c.beginPath(); c.arc(x, 56, 2.8, 0, 7); c.fill(); contorno(c, 1); } }
  c.restore();
}
function desenho(nome) {
  if (D[nome]) return D[nome];
  if (nome.startsWith('retrato:')) { const q = nome.slice(8); return (c) => retrato(c, q); }
  return D.placa;
}
const tela0 = () => { const cv = document.createElement('canvas'); cv.width = cv.height = S; return cv; };
// caixa do desenho (em unidades de 96): cada ícone é ampliado para ocupar o mesmo espaço, como os do BuildIt
function medir(nome) {
  const cv = tela0(), c = cv.getContext('2d', { willReadFrequently: true }); c.scale(K, K); desenho(nome)(c);
  const d = c.getImageData(0, 0, S, S).data; let x0 = S, y0 = S, x1 = -1, y1 = -1;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0 / K, y0 / K, (x1 + 1) / K, (y1 + 1) / K];
}
// acabamento comum: o desenho ampliado até 80% do quadro (folga para o contorno e a sombra); luz do alto à esquerda (brilho
// no canto de cima e sombra que desce para a direita, só onde há tinta); a silhueta dilatada 1,8 px vira o contorno
// azul-noite; uma elipse de contato sob a base dá a sombra (desvio 0 e 6, desfoque 10); por fim a cor fica um pouco
// mais viva (saturate 1,1). Retrato: o círculo inteiro, só com o brilho.
function tela(nome) {
  const retr = nome.startsWith('retrato:');
  const base = tela0(), c = base.getContext('2d'); c.lineJoin = 'round'; let pe = null;
  c.save();
  if (retr) c.scale(K, K);
  else {
    const bx = medir(nome); const e = bx ? Math.min(1.5, 76.8 / Math.max(bx[2] - bx[0], bx[3] - bx[1])) : 0.9; c.translate(S / 2, S / 2 - 3); c.scale(K * e, K * e);
    if (bx) { c.translate(-(bx[0] + bx[2]) / 2, -(bx[1] + bx[3]) / 2); pe = [S / 2, S / 2 - 3 + ((bx[3] - bx[1]) * K * e) / 2, ((bx[2] - bx[0]) * K * e) / 2]; } else c.translate(-48, -48);
  }
  desenho(nome)(c); c.restore();
  c.save(); c.globalCompositeOperation = 'source-atop';
  let g = c.createRadialGradient(S * 0.3, S * 0.16, S * 0.02, S * 0.3, S * 0.16, S * 0.64); g.addColorStop(0, `rgba(255,255,255,${retr ? 0.22 : 0.36})`); g.addColorStop(0.5, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S);
  g = c.createLinearGradient(S * 0.3, S * 0.3, S * 0.95, S * 0.95); g.addColorStop(0, 'rgba(8,20,52,0)'); g.addColorStop(1, 'rgba(8,20,52,.2)'); c.fillStyle = g; c.fillRect(0, 0, S, S); c.restore();
  if (retr) return base;
  const sil = tela0(), x = sil.getContext('2d'); const R = 1.8;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.drawImage(base, Math.cos(a) * R, Math.sin(a) * R); }
  x.globalCompositeOperation = 'source-in'; x.fillStyle = '#15213b'; x.fillRect(0, 0, S, S);
  x.globalCompositeOperation = 'destination-out'; x.drawImage(base, 0, 0);
  const out = tela0(), o = out.getContext('2d');
  // (a elipse fica fora da tela e só a sombra dela entra: shadowOffsetX devolve os 4 S)
  if (pe) { const rx = Math.max(10, pe[2] * 0.78); o.save(); o.shadowColor = 'rgba(0,18,48,.34)'; o.shadowBlur = 10; o.shadowOffsetX = 4 * S; o.shadowOffsetY = 6; o.beginPath(); o.ellipse(pe[0] - 4 * S, pe[1] - 5, rx, Math.min(8, rx * 0.22), 0, 0, 7); o.fillStyle = '#000'; o.fill(); o.restore(); }
  o.drawImage(sil, 0, 0);
  o.filter = 'saturate(1.1)'; o.drawImage(base, 0, 0); o.filter = 'none';
  return out;
}
export const LISTA_ICONES = Object.keys(D);
// todos os nomes: os do desenho, um 'predio:<id>' para cada prédio do canteiro e os retratos do conselho
export function nomesIcones() { return [...new Set([...LISTA_ICONES, ...Object.keys(PREDIOS).map((k) => 'predio:' + k), ...Object.keys(RETRATO).map((k) => 'retrato:' + k)])]; }
export function icone(nome) {
  if (cache.has(nome)) return cache.get(nome);
  const url = tela(nome).toDataURL('image/png'); cache.set(nome, url); return url;
}
// gera todos os ícones uma vez como blob: (chamar na barra de carga); devolve quantos gerou
export async function prepararIcones() {
  let n = 0;
  for (const nome of nomesIcones()) {
    if (String(cache.get(nome) || '').startsWith('blob:')) continue;
    const cv = tela(nome); const b = await new Promise((r) => (cv.toBlob ? cv.toBlob(r, 'image/png') : r(null)));
    if (b) { cache.set(nome, URL.createObjectURL(b)); n++; }
  }
  return n;
}
export function img(nome, cls = '') { return `<img class="${cls}" src="${icone(nome)}" alt="" draggable="false">`; }
