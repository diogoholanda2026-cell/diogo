// Dicas da primeira hora (desenho da UI 10.1 a 10.3; dona: U2a): uma coisa nova por vez, no máximo uma dica na tela,
// cada uma aparece uma vez só (prefs.dicasVistas) e todas se desligam de vez ("Não mostrar dicas", prefs.dicas). A
// dica é um cartão curto com quem fala e a mão fantasma (um dedo que faz o gesto, 3 vezes) por cima do botão ou do
// mundo. As condições leem a loja (barra, ferramenta, tela) e nunca a simulação por dentro.
import { effect } from '@preact/signals';
import { barra, tela, prefs } from '../loja.js';
import { sessao } from '../ferramentas/sessao.js';
import { inicio } from '../inicio/estado.js';
import { CartaoDica, dicaAtual, dispensarDica } from './Dica.jsx';
import { usarEstiloGuia } from './estilo.js';

/**
 * As dicas, na ordem de prioridade. quando(estado) decide; alvo: seletor do botão (ou null: o mundo); gesto da mão:
 * 'toque', 'via' ou 'arrasto'. O texto é 'u2.dica.<id>' (e 'u2.dica.<id>.mouse' no PC, quando muda).
 */
export const DICAS = Object.freeze([
  { id: 'via', quem: 'iris', gesto: 'via', alvo: null, mouse: true, quando: (e) => e.ferramenta === 'via' },
  { id: 'zona', quem: 'iris', gesto: 'arrasto', alvo: null, mouse: true, quando: (e) => e.ferramenta === 'zona' },
  { id: 'colocar', quem: 'iris', gesto: 'toque', alvo: null, mouse: true, quando: (e) => e.ferramenta === 'colocar' },
  { id: 'avisos', quem: 'cida', gesto: 'toque', alvo: null, quando: (e) => !e.ferramenta && e.alertas.some((a) => /sem(Agua|Energia)|agua|energia/i.test(`${a.codigo} ${a.glifo}`)) },
  { id: 'velocidade', quem: 'iris', gesto: 'toque', alvo: '.hud-vel', soMouse: true, quando: (e) => !e.ferramenta && e.velocidade === 0 && e.tique === 0 && e.segundos >= 8 },
  { id: 'numeros', quem: 'livia', gesto: 'toque', alvo: '[data-a="creditos"]', quando: (e) => !e.ferramenta && e.tique >= 22 * 60 },
  { id: 'emprestimo', quem: 'livia', gesto: 'toque', alvo: '[data-a="creditos"]', quando: (e) => !e.ferramenta && e.caixaBaixo },
]);

export { dicaAtual, dispensarDica };

const ehToqueAgora = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/**
 * A próxima dica para o estado (pura: os testes chamam).
 * @param {object} e  { ferramenta, alertas, velocidade, tique, segundos, caixaBaixo, toque }
 * @param {string[]} vistas
 */
export function proximaDica(e, vistas = []) {
  for (const d of DICAS) {
    if (vistas.includes(d.id)) continue;
    if (d.soMouse && e.toque) continue;
    if (d.quando(e)) return d;
  }
  return null;
}

let soltar = [];

export function registrar(ui) {
  soltar.forEach((f) => f());
  soltar = [];
  dicaAtual.value = null;
  usarEstiloGuia();
  ui.registrarHud('sobre', CartaoDica, { ordem: 70, nome: 'dica' });
  // a vitrine e as cenas não mostram dica sozinhas (a cena da vitrine abre a sua)
  if (!ui.jogo || ui.jogo.falso || ui.jogo.cena) return;
  let desde = null;
  let caixaMinimo = Infinity;
  const avaliar = () => {
    const p = prefs.peek() ?? {};
    if (p.dicas === false || inicio.peek() || tela.peek() || dicaAtual.peek()) return;
    const b = barra.peek() ?? {};
    if (desde === null) desde = Date.now();
    const cred = b.creditos ?? Infinity;
    caixaMinimo = Math.min(caixaMinimo, cred);
    const e = {
      ferramenta: sessao.peek()?.tipo ?? null,
      alertas: b.alertas ?? [],
      velocidade: b.velocidade ?? 0,
      tique: ui.obterSim?.()?.tique ?? 0,
      segundos: (Date.now() - desde) / 1000,
      caixaBaixo: !!b.caixaZerado || (Number.isFinite(cred) && cred < 2000),
      toque: ehToqueAgora(),
    };
    const d = proximaDica(e, p.dicasVistas ?? []);
    if (d) {
      dicaAtual.value = d;
      // vista ao aparecer: um recarregar não repete (cada dica uma vez)
      const vistas = [...new Set([...(p.dicasVistas ?? []), d.id])];
      if (ui.jogo && typeof ui.jogo.gravarPrefs === 'function') ui.jogo.gravarPrefs({ dicasVistas: vistas });
    }
  };
  soltar.push(effect(() => {
    sessao.value;
    tela.value;
    inicio.value;
    queueMicrotask(avaliar);
  }));
  const id = setInterval(avaliar, 1000);
  soltar.push(() => clearInterval(id));
  // a ferramenta fechou ou uma tela abriu: a dica da ferramenta sai
  soltar.push(effect(() => {
    const d = dicaAtual.value;
    const f = sessao.value?.tipo ?? null;
    if (d && ['via', 'zona', 'colocar'].includes(d.id) && f !== d.id) dicaAtual.value = null;
    if (d && tela.value) dicaAtual.value = null;
  }));
}
