// Loja da interface (desenho da UI 12.3): sinais do Preact que os componentes leem. A ponte escreve a barra 4 vezes
// por segundo e depois de cada comando (com batch); as ações e os eventos escrevem o resto. Uma interface por página.
import { signal, batch } from '@preact/signals';
import { EXEMPLO_BARRA } from '../contratos/consultas.js';
import { lerPrefs } from './prefs.js';

/** Barra vazia (antes da primeira leitura): o formato de q.barra() com zeros. */
export const BARRA_VAZIA = Object.freeze({
  ...EXEMPLO_BARRA,
  creditos: 0, saldoHora: 0, populacao: 0, popHora: 0, bemEstar: 0, bemEstarTarifa: 0, tarifa: 5, faixa: [0, 30],
  margem: { degrau: null, delta: 0 }, demanda: { R: 0, C: 0, I: 0, E: 0 }, data: { mes: 1, ano: 1, fracMes: 0, fase: 'manha' },
  velocidade: 0, mult: 0, marco: { n: 0, nome: '', xp: 0, xpIni: 0, xpProx: null, requisito: null }, divida: 0, valuation: 0,
  caixaZerado: false, alertas: [], decisoesPendentes: 0, objetivos: [],
});

export const barra = signal(BARRA_VAZIA); // q.barra()
export const selecao = signal(null); // { tipo, ref, idx, ponto } de R.selecionar
export const detalhe = signal(null); // q.predio(ref) do selecionado (a folha relê com ela aberta)
export const ferramenta = signal(null); // { tipo: 'via' | 'zona' | 'colocar' | 'demolir', ... } (X2)
export const tela = signal(null); // id da tela de gestão aberta (registrarTela)
export const camada = signal(null); // id da camada ligada (X3a)
export const avisos = signal([]); // [{ id, texto, gravidade, glifo, alvo }] (U1b mostra)
export const mural = signal([]); // posts (U2b)
export const decisoes = signal(0); // quantas decisões pendentes (U1b)
export const eventos = signal([]); // últimos eventos da simulação [{ nome, dados }]
export const prefs = signal(lerPrefs());
export const app = signal({ segundoPlano: false, velocidadeEfetiva: 0 });

let seqAviso = 0;

/** Aplica uma leitura de q.barra (um batch só). */
export function aplicarBarra(b) {
  batch(() => {
    barra.value = b;
    decisoes.value = b?.decisoesPendentes ?? 0;
  });
}

/** Acrescenta um aviso (fica no máximo com os 5 últimos). */
export function avisar({ texto, gravidade = 'info', glifo = null, alvo = null, codigo = null }) {
  const a = { id: ++seqAviso, texto, gravidade, glifo, alvo, codigo };
  avisos.value = [...avisos.value.slice(-4), a];
  return a.id;
}

/** Tira um aviso. */
export function dispensar(id) {
  avisos.value = avisos.value.filter((a) => a.id !== id);
}

/** Guarda um evento da simulação (os 30 últimos). */
export function registrarEvento(nome, dados) {
  eventos.value = [...eventos.value.slice(-29), { nome, dados }];
}

/** Volta tudo ao começo (testes e troca de partida). */
export function reiniciarLoja() {
  batch(() => {
    barra.value = BARRA_VAZIA;
    selecao.value = null;
    detalhe.value = null;
    ferramenta.value = null;
    tela.value = null;
    camada.value = null;
    avisos.value = [];
    mural.value = [];
    decisoes.value = 0;
    eventos.value = [];
  });
}
