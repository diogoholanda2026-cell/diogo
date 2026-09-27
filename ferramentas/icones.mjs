// Ícones do app (PWA): monograma "H" champanhe dentro de um anel, sobre grafite. Desenhados no canvas do Chromium de
// teste com a mesma geometria da marca da tela de carga (fonte/web/index.html, caixa de 100 x 100).
// Saída: fonte/web/icones/icone-192.png, icone-512.png e icone-mascaravel-512.png (este com a marca dentro do círculo
// seguro de 40% do raio e o fundo até a borda). Uso: node ferramentas/icones.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raiz, 'fonte/web/icones');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// marca na caixa de 100: anel de raio 44 (traço 3) e o H em dois montantes e uma travessa
const MARCA = { anel: 44, traco: 3, h: 'M34 30h7v17h18V30h7v40h-7V53H41v17h-7z' };
const ICONES = [
  { arquivo: 'icone-192.png', tam: 192, raioMarca: 0.36, canto: 0.2 },
  { arquivo: 'icone-512.png', tam: 512, raioMarca: 0.36, canto: 0.2 },
  { arquivo: 'icone-mascaravel-512.png', tam: 512, raioMarca: 0.3, canto: 0 },
];

function desenhar({ tam, raioMarca, canto }, marca) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const g = cv.getContext('2d');
  // fundo grafite com degradê vertical leve (o mesmo da carga)
  const fundo = g.createLinearGradient(0, 0, 0, tam);
  fundo.addColorStop(0, '#1A212B'); fundo.addColorStop(0.55, '#10151C'); fundo.addColorStop(1, '#0B0F14');
  g.fillStyle = fundo;
  const r = canto * tam;
  g.beginPath(); g.roundRect(0, 0, tam, tam, r); g.fill();
  // fio de luz de 1 px na borda de cima, como o vidro da interface
  if (canto) { g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(0, 0, tam, Math.max(1, tam / 192)); g.restore(); }
  // marca: escala da caixa de 100 para o raio pedido
  const k = (raioMarca * tam) / marca.anel;
  g.translate(tam / 2 - 50 * k, tam / 2 - 50 * k); g.scale(k, k);
  const ch = g.createLinearGradient(0, 6, 0, 94);
  ch.addColorStop(0, '#E4CC98'); ch.addColorStop(1, '#C9AA6E');
  g.strokeStyle = ch; g.fillStyle = ch; g.lineWidth = marca.traco;
  g.beginPath(); g.arc(50, 50, marca.anel, 0, Math.PI * 2); g.stroke();
  g.fill(new Path2D(marca.h));
  return cv.toDataURL('image/png');
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.goto('about:blank');
mkdirSync(pasta, { recursive: true });
for (const ic of ICONES) {
  const url = await page.evaluate(`(${desenhar})(${JSON.stringify(ic)}, ${JSON.stringify(MARCA)})`);
  const png = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(pasta, ic.arquivo), png);
  console.log(ic.arquivo, ic.tam + ' px', (png.length / 1024).toFixed(1) + ' KB');
}
await browser.close();
