// Dois toques (desenho da UI 8.20): o primeiro toque arma por 2,6 s (fio --al, "Toque de novo para confirmar" e uma
// barra de 2 px que esvazia); o segundo executa. Para o que não se desfaz: quitar, demolir prédio da Holding.
// Desligado fica fraco e continua tocável: o toque diz o motivo em vez de não fazer nada (aoRecusar, quando a tela tem
// onde dizer; senão, a dica vira aviso).
import { useState, useEffect } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';
import { avisar } from '../loja.js';

export const ARMADO_MS = 2600;

export function DoisToques({ rotulo, rotuloArmado = null, aoConfirmar, aoRecusar = null, a = 'confirmar', k, glifo = null, perigo = false, desligado = false, dica, ms = ARMADO_MS }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return undefined;
    const id = setTimeout(() => setArmado(false), ms);
    return () => clearTimeout(id);
  }, [armado, ms]);
  useEffect(() => {
    if (desligado) setArmado(false); // desligar no meio desarma (voltar a ligar pede os dois toques de novo)
  }, [desligado]);
  const vale = armado && !desligado;
  const texto = vale ? rotuloArmado ?? t('comp.toqueDeNovo') : rotulo;
  return (
    <Botao
      a={a}
      k={k}
      rotulo={texto}
      aria-disabled={desligado ? 'true' : undefined}
      dica={dica}
      data-armado={vale ? '' : undefined}
      class={`bt-sec dois-toques${vale ? ' armado' : ''}${perigo ? ' bt-perigo' : ''}`}
      onClick={() => {
        if (desligado) {
          if (aoRecusar) aoRecusar();
          else if (dica) avisar({ texto: dica, gravidade: 'info' });
          return;
        }
        if (!armado) return setArmado(true);
        setArmado(false);
        aoConfirmar?.();
      }}
    >
      {glifo ? <Glifo n={glifo} tam={18} /> : null}
      <span>{texto}</span>
      {vale ? <i class="dois-toques-barra" style={{ animationDuration: `${ms}ms` }} aria-hidden="true" /> : null}
    </Botao>
  );
}
