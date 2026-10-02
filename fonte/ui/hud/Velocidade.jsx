// Velocidade (desenho da UI 8.2 e 9.5; D7, D10): o segmentado pausa, 1x, 2x e 4x mora na barra de cima; aqui ficam a
// pausa automática e o teclado do PC.
//   Pausa automática: modais (decisão do Conselho, marco, etapa) pausam sempre; as telas de gestão pausam no celular
//   (padrão; prefs.pausarTelas troca) e não no PC. Ao fechar a última, volta a velocidade de antes, a não ser que o
//   jogador tenha mexido nela no meio (o estado é sempre o que está marcado, nunca o que vai acontecer).
//   Teclado: Espaço pausa e volta; 1, 2 e 3 escolhem 1x, 2x e 4x; Shift mais 1 a 6 abre Holding, Economia, Cidade,
//   Transporte (M2, fica de fora), Progresso e Conselho.
// Contrato para as outras telas: pausarPor(motivo) e soltarPausa(motivo), com motivo único por quem pausa.
import { effect } from '@preact/signals';
import { barra, tela, prefs } from '../loja.js';
import { velocidade } from '../acoes.js';

const motivos = new Set();
let antes = 0; // a velocidade de antes da primeira pausa automática
let pausei = false; // a pausa atual foi nossa (o jogador já estava pausado: nada a devolver)
let ultimaJogador = 1; // a última velocidade escolhida pelo jogador (Espaço volta para ela)

const atual = () => barra.peek()?.velocidade ?? 0;

/** Pausa o tempo por um motivo (modal, tela). Vários motivos juntos pausam uma vez só. */
export function pausarPor(motivo) {
  if (motivos.has(motivo)) return;
  motivos.add(motivo);
  if (motivos.size > 1) return;
  const v = atual();
  pausei = v > 0;
  antes = v;
  if (pausei) velocidade(0);
}

/** Solta a pausa de um motivo; sem nenhum, volta a velocidade de antes (se o jogador não mexeu nela). */
export function soltarPausa(motivo) {
  if (!motivos.delete(motivo) || motivos.size) return;
  if (pausei && atual() === 0 && antes > 0) velocidade(antes);
  pausei = false;
}

/** Quantos motivos seguram a pausa agora (testes e vitrine). */
export const pausasAtivas = () => motivos.size;

/** Teclas de velocidade e de tela: devolve true se a tecla foi usada. */
export function teclaVelocidade(ev, ui) {
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return false;
  const alvo = ev.target;
  if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return false;
  if (ev.shiftKey && /^Digit[1-6]$/.test(ev.code)) {
    const id = ['holding', 'economia', 'cidade', null, 'progresso', 'conselho'][+ev.code.slice(5) - 1];
    if (!id || !ui.telas().includes(id)) return false;
    if (tela.peek() === id) ui.fecharTela();
    else ui.abrirTela(id);
    return true;
  }
  if (ev.shiftKey) return false;
  if (ev.code === 'Space') {
    // pausar à mão tira a pausa automática do caminho (ela não devolve a velocidade por cima do jogador)
    pausei = false;
    velocidade(atual() === 0 ? ultimaJogador : 0);
    return true;
  }
  const k = { Digit1: 1, Digit2: 2, Digit3: 3, Numpad1: 1, Numpad2: 2, Numpad3: 3 }[ev.code];
  if (!k) return false;
  pausei = false;
  velocidade(k);
  return true;
}

let soltar = null;

export function registrar(ui) {
  soltar?.();
  motivos.clear();
  pausei = false;
  // a última velocidade que o jogador deixou ligada (Espaço volta para ela)
  const semVel = effect(() => {
    const v = barra.value?.velocidade ?? 0;
    if (v > 0) ultimaJogador = v;
  });
  // telas de gestão: pausa no celular (padrão), não no PC; o menu sempre pausa
  const semTela = effect(() => {
    const id = tela.value;
    const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const pausar = id && (id === 'menu' || (prefs.peek()?.pausarTelas ?? toque));
    if (pausar) pausarPor('tela');
    else soltarPausa('tela');
  });
  const tecla = (ev) => {
    if (teclaVelocidade(ev, ui)) ev.preventDefault();
  };
  if (typeof addEventListener === 'function') addEventListener('keydown', tecla);
  soltar = () => {
    semVel();
    semTela();
    if (typeof removeEventListener === 'function') removeEventListener('keydown', tecla);
  };
}
