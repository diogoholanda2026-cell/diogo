// Configurações do toque (TOQ1, D99), sob demanda: o bloco que a aba Controles das Configurações mostra no celular (e
// em qualquer tela de toque): sensibilidade do arrasto, da pinça e do giro e a inércia da câmera. As escolhas moram em
// prefs (toqueArrasto, toquePinca, toqueGiro, toqueInercia); o app as leva à entrada (R.entrada.opcoes) ao gravar. O
// padrão (100% em tudo, deslize ligado) é o bom sem mexer em nada. Os textos vêm de textos/toq1.js e se registram aqui.
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { Segmentado } from '../../comp/Segmentado.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Secao } from '../../comp/Tela.jsx';

/** As escolhas de sensibilidade (a entrada limita a 40% e 200%). */
export const SENSIBILIDADES = Object.freeze([0.6, 0.8, 1, 1.25, 1.5]);
/** Os padrões: o que vale sem prefs. */
export const PADRAO_TOQUE = Object.freeze({ toqueArrasto: 1, toquePinca: 1, toqueGiro: 1, toqueInercia: true });

function Linha({ rotulo, exp, k, children }) {
  return (
    <div class="cfg-linha" data-cfg={k}>
      <span class="cfg-textos">
        <span class="cfg-rot">{rotulo}</span>
        {exp ? <span class="cfg-exp">{exp}</span> : null}
      </span>
      <span class="cfg-ctl">{children}</span>
    </div>
  );
}

/**
 * @param {{ ui: object, mudar: (parcial: object) => void }} props  mudar grava e aplica as prefs (mudarPrefs da U2a)
 */
export function ControlesToque({ ui, mudar }) {
  const p = ui.loja.prefs.value ?? {};
  const sens = (k, rotulo, exp) => (
    <Linha rotulo={rotulo} exp={exp} k={k}>
      <Segmentado a={`toq1.${k}`} rotulo={rotulo} valor={p[k] ?? PADRAO_TOQUE[k]} aoTrocar={(v) => mudar({ [k]: v })} opcoes={SENSIBILIDADES.map((v) => ({ v, rotulo: fmt.pct(v) }))} />
    </Linha>
  );
  const inercia = p.toqueInercia !== false;
  const mexido = Object.keys(PADRAO_TOQUE).some((k) => (p[k] ?? PADRAO_TOQUE[k]) !== PADRAO_TOQUE[k]);
  return (
    <Secao titulo={t('toq1.titulo')}>
      {sens('toqueArrasto', t('toq1.arrasto'), t('toq1.arrastoExp'))}
      {sens('toquePinca', t('toq1.pinca'), t('toq1.pincaExp'))}
      {sens('toqueGiro', t('toq1.giro'), t('toq1.giroExp'))}
      <Linha rotulo={t('toq1.inercia')} exp={t('toq1.inerciaExp')} k="toqueInercia">
        <Segmentado a="toq1.inercia" rotulo={t('toq1.inercia')} valor={inercia ? 'sim' : 'nao'} aoTrocar={(v) => mudar({ toqueInercia: v === 'sim' })} opcoes={[{ v: 'sim', rotulo: t('comp.ligado') }, { v: 'nao', rotulo: t('comp.desligado') }]} />
      </Linha>
      <Linha rotulo={t('toq1.padrao')} exp={t('toq1.padraoExp')} k="toquePadrao">
        <Botao a="toq1.padrao" rotulo={t('toq1.padrao')} class="bt-sec" desligado={!mexido} onClick={() => mudar({ ...PADRAO_TOQUE })}>
          {t('toq1.padraoBt')}
        </Botao>
      </Linha>
    </Secao>
  );
}
