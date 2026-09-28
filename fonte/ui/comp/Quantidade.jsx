// Quantidade (desenho da UI 8.20): [−] N [+] de 44 x 44. Para os lotes de produção vale de 1 a 10 (regra do dono);
// o botão no limite fica fraco e continua tocável: o toque diz o porquê ("Máximo: 10"), no mouse e no dedo.
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';
import { numero } from '../formato.js';
import { avisar } from '../loja.js';

/**
 * Props do botão − ou + de um passo: fraco no limite (aria-disabled, sem o desligado do Botao, que engole o toque) e,
 * tocado assim, avisa o limite em vez de ficar mudo (desenho da UI 3.1, princípio 6).
 */
export function botaoDoPasso(noLimite, motivo, mudar) {
  return {
    'aria-disabled': noLimite ? 'true' : undefined,
    dica: noLimite ? motivo : undefined,
    onClick: () => (noLimite ? avisar({ texto: motivo, gravidade: 'info' }) : mudar()),
  };
}

/**
 * Prende n em [min, max] no passo contado a partir de min: o resultado é sempre um passo (com max fora do passo, o
 * último passo abaixo dele), como o empréstimo de 1.000 em 1.000 que nunca pode dar 10.500.
 */
export function limitar(n, min = 1, max = 10, passo = 1) {
  const v = Number.isFinite(n) ? n : min;
  const p = passo > 0 ? passo : 1;
  const kMax = Math.max(0, Math.floor((max - min) / p + 1e-9));
  const k = Math.min(kMax, Math.max(0, Math.round((v - min) / p)));
  return min + k * p;
}

export function Quantidade({ valor, aoMudar, min = 1, max = 10, passo = 1, rotulo, a = 'quantidade', formato = numero }) {
  const v = limitar(valor, min, max, passo);
  return (
    <div class="quantidade" role="group" aria-label={rotulo}>
      <Botao a={a} k="menos" rotulo={t('comp.menos')} class="bt-glifo bt-sec" {...botaoDoPasso(v <= min, t('comp.minimo', { n: formato(min) }), () => aoMudar?.(limitar(v - passo, min, max, passo)))}>
        <Glifo n="menos" />
      </Botao>
      <output class="quantidade-valor num" aria-live="polite">
        {formato(v)}
      </output>
      <Botao a={a} k="mais" rotulo={t('comp.mais')} class="bt-glifo bt-sec" {...botaoDoPasso(v >= max, t('comp.maximo', { n: formato(max) }), () => aoMudar?.(limitar(v + passo, min, max, passo)))}>
        <Glifo n="mais" />
      </Botao>
    </div>
  );
}
