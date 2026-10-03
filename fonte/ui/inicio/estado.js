// Estado do menu inicial (desenho da UI 7.6 e 8.19; dona: U2a): em que etapa a tela de entrada está, os saves que o
// menu mostra e a capa do mais novo. Os componentes do início e o corpo sob demanda leem estes sinais.
import { signal } from '@preact/signals';

/**
 * null: fora do início (jogando). Senão { etapa, ocupado?, erro? }:
 * 'entrada' (Clique ou Toque para entrar), 'menu', 'nova', 'carregar', 'config', 'creditos'.
 */
export const inicio = signal(null);

/** Resumos dos saves (jogo.listarSaves), do mais novo ao mais velho. */
export const saves = signal([]);

/** Endereço (object URL) da capa do save mais novo, para o fundo do menu. */
export const capaFundo = signal(null);

/**
 * Teclado do início: a etapa à vista põe aqui quem trata a tecla (devolve true se usou). Enquanto o início está aberto,
 * nenhuma tecla chega aos atalhos do jogo por trás (velocidade, ferramentas, menu): carga.js para a propagação.
 */
export const teclas = { atual: null };

/** Abre o início numa etapa. */
export const abrirInicio = (etapa = 'menu', extra = {}) => (inicio.value = { etapa, ...extra });

/** Troca a etapa sem perder o resto. */
export const irPara = (etapa) => (inicio.value = inicio.peek() ? { ...inicio.peek(), etapa, erro: null, ocupado: null } : { etapa });

/** Sai do início (a partida está na tela). */
export const fecharInicio = () => (inicio.value = null);

/** O ponteiro é de toque? (Toque para entrar e tela cheia) ou mouse (Clique para entrar e atalhos à vista) */
export function ehToque() {
  try {
    return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
}

/** Relê os saves e a capa do mais novo. */
export async function atualizarSaves(jogo) {
  let lista = [];
  try {
    lista = (await jogo?.listarSaves?.()) ?? [];
  } catch (e) {
    lista = [];
  }
  saves.value = lista;
  const comCapa = lista.find((s) => s.capa instanceof Blob);
  const antes = capaFundo.peek();
  capaFundo.value = comCapa && typeof URL !== 'undefined' ? URL.createObjectURL(comCapa.capa) : null;
  if (antes) URL.revokeObjectURL(antes);
  return lista;
}
