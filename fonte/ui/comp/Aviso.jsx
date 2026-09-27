// Aviso (desenho da UI 6.3 e 8.11): a gravidade vai na FORMA (losango grave, triângulo atenção, círculo informação,
// aro duplo da Holding) e na cor; o glifo diz o assunto; texto 13/600 e, se houver, a ação que resolve ("Ver camada").
// Serve às faixas, aos toasts e à linha de aviso do cartão e da folha.
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

const FORMAS = {
  grave: 'M8 1.5 14.5 8 8 14.5 1.5 8z',
  atencao: 'M8 2 14.5 13.5h-13z',
  info: 'M2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 1 0-11 0z',
  holding: 'M1.75 8a6.25 6.25 0 1 0 12.5 0 6.25 6.25 0 1 0-12.5 0zM4.5 8a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0z',
};

/** Forma de 16 px da gravidade (a cor vem da classe). */
export function FormaGravidade({ gravidade = 'info' }) {
  return (
    <svg class={`forma forma-${gravidade}`} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={FORMAS[gravidade] ?? FORMAS.info} />
    </svg>
  );
}

export function Aviso({ gravidade = 'info', glifo = 'alerta', texto, sub = null, acao = null, aoAcao, a = 'aviso', k, class: classe = '' }) {
  return (
    <div class={`aviso aviso-${gravidade}${classe ? ` ${classe}` : ''}`} role={gravidade === 'grave' ? 'alert' : 'status'}>
      <FormaGravidade gravidade={gravidade} />
      <Glifo n={glifo} tam={18} class="aviso-glifo" />
      <span class="aviso-textos">
        <span class="aviso-texto">{texto}</span>
        {sub ? <span class="aviso-sub">{sub}</span> : null}
      </span>
      {acao ? (
        <Botao a={a} k={k} rotulo={acao} class="bt-fan aviso-acao" onClick={aoAcao}>
          {acao}
        </Botao>
      ) : null}
    </div>
  );
}
