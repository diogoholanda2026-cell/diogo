// Corpo do modal de decisão do Conselho (desenho da UI 8.14; D35, D77), sob demanda. Sobretítulo "CONSELHO ·
// DECISÃO", o título, a situação em 2 ou 3 linhas e de 2 a 4 cartões lado a lado (rolagem na horizontal no celular
// estreito): quem propõe (monograma e nome), o que faz, Influência ou Legado com o número, o ganho com glifo de mais, o
// custo com glifo de menos e o que custa em dólar; "Escolher" em cada cartão. Embaixo, "Decidir depois" com o prazo em
// mm:ss reais e, uma vez, "Pedir mais prazo" (decisao.adiar). O texto vem por chave da simulação (s3.decisao.*).
import { useState } from 'preact/hooks';
import { barra, avisar } from '../../loja.js';
import { consultar } from '../../consultas.js';
import { comando, frase as fraseRecusa } from '../../acoes.js';
import * as fmt from '../../formato.js';
import { t } from '../../textos.js';
import { Modal } from '../../comp/Modal.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { quemFala } from '../../hud/Objetivo.jsx';
import { Quem, frase } from './comum.jsx';

function CartaoOpcao({ d, o, escolher }) {
  const q = quemFala(o.quem);
  const medidor = o.influencia > 0 ? ['influencia', o.influencia] : o.legado > 0 ? ['legado', o.legado] : null;
  const ganho = frase(o.ganho);
  const custo = frase(o.custo);
  return (
    <article class="dec-cartao" data-k={o.id}>
      <header class="dec-quem">
        <Quem id={o.quem} />
        <span class="dec-propoe">{t('dec.propoe', { quem: q.curto })}</span>
        {medidor ? (
          <span class="dec-medidor">
            <span class="rot">{t(`hold.${medidor[0]}`)}</span>
            <b class="num tx-ch">{fmt.comSinal(medidor[1])}</b>
          </span>
        ) : null}
      </header>
      <h3 class="dec-opcao">{frase(o.texto)}</h3>
      {ganho ? (
        <p class="dec-linha tx-ok">
          <Glifo n="mais" tam={14} />
          <span>{ganho}</span>
        </p>
      ) : null}
      {custo ? (
        <p class="dec-linha tx-al">
          <Glifo n="menos" tam={14} />
          <span>{custo}</span>
        </p>
      ) : null}
      {o.creditos > 0 ? <p class="dec-preco num">{t('dec.custa', { v: fmt.dinheiro(o.creditos) })}</p> : null}
      <Botao a="dec.escolher" k={o.id} rotulo={t('dec.escolherOpcao', { opcao: frase(o.texto) })} principal class="bt-pri dec-escolher" onClick={() => escolher(o)}>
        {t('dec.escolher')}
      </Botao>
    </article>
  );
}

/** Largura do modal (desenho da UI 8.14): até 620 px; no celular deitado, 92% da tela, para os cartões caberem lado a lado sem esconder o Escolher. */
export const larguraDecisao = (w = typeof innerWidth === 'number' ? innerWidth : 1376, h = typeof innerHeight === 'number' ? innerHeight : 768) =>
  h < 560 ? Math.max(620, Math.round(w * 0.92)) : 620;

export default function Decisao({ ui, id, fechar }) {
  const [erro, setErro] = useState(null);
  barra.value; // relê o prazo com a barra
  const d = (consultar('decisoes') ?? []).find((x) => x.id === id);
  if (!d) {
    // a decisão já saiu (escolhida, prazo vencido): a fila anda
    queueMicrotask(fechar);
    return null;
  }
  const tempo = ui.obterSim()?.espelho?.tempo;
  const falta = Number.isFinite(d.prazo) ? Math.max(0, d.prazo - (tempo?.tique ?? 0)) : null;
  const escolher = async (o) => {
    const r = await comando('decisao.escolher', { id, opcao: o.id }, { silencioso: true });
    if (!r.ok) return setErro(fraseRecusa(r));
    avisar({ texto: t('dec.feita', { opcao: frase(o.texto) }), gravidade: 'info', glifo: 'conselho' });
    fechar();
  };
  const adiar = async () => {
    const r = await comando('decisao.adiar', { id }, { silencioso: true });
    if (!r.ok) setErro(fraseRecusa(r));
  };
  const acoes = [
    d.podeAdiar ? (
      <Botao a="dec.adiar" rotulo={t('dec.adiar')} class="bt-fan" onClick={adiar}>
        {t('dec.adiar')}
      </Botao>
    ) : null,
    <Botao a="dec.depois" rotulo={t('dec.depois')} class="bt-sec" onClick={fechar}>
      {falta !== null ? t('dec.depoisPrazo', { t: fmt.contagem(falta, tempo?.mult ?? 0) }) : t('dec.depois')}
    </Botao>,
  ];
  return (
    <Modal sobretitulo={t('dec.sobre')} titulo={frase(d.titulo)} aoFechar={fechar} acoes={acoes} a="decisao" largura={larguraDecisao()}>
      <p class="dec-texto">{frase(d.texto)}</p>
      <div class="dec-cartoes" role="list">
        {(d.opcoes ?? []).map((o) => (
          <CartaoOpcao d={d} o={o} escolher={escolher} />
        ))}
      </div>
      {erro ? (
        <p class="eco-retorno tx-al" role="status">
          <Glifo n="alerta" tam={16} />
          {erro}
        </p>
      ) : null}
      {falta !== null ? <p class="eco-nota">{t('dec.padrao', { opcao: frase((d.opcoes ?? []).find((o) => o.id === d.padrao)?.texto) || d.padrao || '' })}</p> : null}
    </Modal>
  );
}
