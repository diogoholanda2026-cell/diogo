// Vazio (desenho da UI 8.20): glifo de 32 em --t3, a frase em 13/500 e a ação que resolve (nada fica sem porquê).
import { Glifo } from '../glifos/Glifo.jsx';
import { Botao } from './Botao.jsx';

export function Vazio({ glifo = 'info', texto, acao = null, aoAcao, a = 'vazio' }) {
  return (
    <div class="vazio">
      <Glifo n={glifo} tam={32} class="vazio-glifo" />
      <p class="vazio-texto">{texto}</p>
      {acao ? (
        <Botao a={a} rotulo={acao} class="bt-sec" onClick={aoAcao}>
          {acao}
        </Botao>
      ) : null}
    </div>
  );
}
