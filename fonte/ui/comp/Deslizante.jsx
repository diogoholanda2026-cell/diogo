// Deslizante (desenho da UI 8.20): trilho de 4 px, polegar de 24 (alvo de 44), passos; o valor em 15/650 ao lado.
// É um <input type="range"> de verdade (teclado e leitor de tela de graça). Com botoes, ganha [−] e [+] de 44 px, como
// o empréstimo de 1.000 em 1.000.
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';
import { numero } from '../formato.js';
import { limitar } from './Quantidade.jsx';

export function Deslizante({ valor, aoMudar, min = 0, max = 100, passo = 1, rotulo, a = 'deslizante', formato = numero, botoes = false }) {
  const vazio = max < min;
  const topo = vazio ? min : limitar(max, min, max, passo); // o último passo (max pode cair fora do passo)
  const v = vazio ? min : limitar(valor, min, max, passo);
  const pct = topo > min ? ((v - min) / (topo - min)) * 100 : 0;
  const mudar = (x) => aoMudar?.(limitar(x, min, topo, passo));
  return (
    <div class={`deslizante${vazio ? ' vazio' : ''}`}>
      {botoes ? (
        <Botao a={a} k="menos" rotulo={t('comp.menos')} desligado={vazio || v <= min} class="bt-glifo bt-sec" onClick={() => mudar(v - passo)}>
          <Glifo n="menos" />
        </Botao>
      ) : null}
      <input
        type="range"
        class="deslizante-entrada"
        data-a={a}
        min={min}
        max={topo}
        step={passo}
        value={v}
        disabled={vazio}
        aria-label={rotulo}
        aria-valuetext={formato(v)}
        style={{ '--pct': `${pct}%` }}
        onInput={(ev) => mudar(+ev.currentTarget.value)}
      />
      {botoes ? (
        <Botao a={a} k="mais" rotulo={t('comp.mais')} desligado={vazio || v >= topo} class="bt-glifo bt-sec" onClick={() => mudar(v + passo)}>
          <Glifo n="mais" />
        </Botao>
      ) : null}
      <output class="deslizante-valor num">{formato(v)}</output>
    </div>
  );
}
