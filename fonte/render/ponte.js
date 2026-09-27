// Ponte da simulação para o render (seção 2.4, D19, D21): uma chamada de sim.mudancas.desde(v) por quadro e a entrega
// do resultado a cada domínio registrado, na ordem de registro. O render só lê; nenhum domínio guarda referência a
// coluna do espelho entre quadros (uma tabela que cresce troca os arrays).
//
// A fonte ({ espelho, mudancas }) pode trocar de simulação (nova partida, carregar): a ponte percebe pelo objeto do
// diário e pede tudo de novo (desde(-1)), sem confiar no número da versão da simulação velha.

/** Teto de tempo por quadro para aplicar as mudanças (seção 2.4). */
export const TETO_MS = 2;

const agora = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export class PonteRender {
  /**
   * @param {{ espelho: object, mudancas: { desde(v: number): object } }} fonte  lida a cada quadro (pode ser um objeto
   *   com getters que apontam para a simulação atual)
   */
  constructor(fonte) {
    this.fonte = fonte;
    this.versao = -1;
    this._diario = null;
    this.ultimo = null; // o último resultado de desde() (para depuração e testes)
    this.ms = 0;
  }

  /** Força a próxima leitura a pedir tudo. */
  refazer() {
    this.versao = -1;
  }

  /**
   * Lê o diário e entrega a cada domínio: dominio.aplicar(d, espelho, ctx, prazo). prazo é o instante (performance.now)
   * até o qual o domínio pode trabalhar neste quadro; o que passar fica para o próximo por conta do domínio.
   * @param {Iterable<object>} dominios
   */
  quadro(dominios, ctx) {
    const m = this.fonte?.mudancas;
    const esp = this.fonte?.espelho;
    if (!m || !esp) return null;
    if (m !== this._diario) {
      this._diario = m;
      this.versao = -1;
    }
    const t0 = agora();
    const d = m.desde(this.versao);
    this.versao = d.versao;
    this.ultimo = d;
    const prazo = t0 + TETO_MS;
    for (const dom of dominios) {
      if (!dom.aplicar) continue;
      try {
        dom.aplicar(d, esp, ctx, prazo);
      } catch (e) {
        console.error(`render: domínio ${dom.nome} falhou ao aplicar:`, e);
      }
    }
    this.ms = agora() - t0;
    return d;
  }
}

/** true se o resultado de desde() pede refazer o domínio inteiro (tudo, realocado ou n novo). */
export function pedeTudo(d, dominio) {
  return !!(d.tudo?.[dominio] || d.realocado?.includes(dominio));
}
