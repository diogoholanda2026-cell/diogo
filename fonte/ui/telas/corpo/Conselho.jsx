// Corpo da tela Conselho (desenho da UI 8.13 e 8.14; D35, D78, D83), sob demanda.
//   Decisões: as pendentes em cartões (título, quem propõe, prazo em mm:ss reais) com "Decidir", que abre o modal.
//   Histórico: o que cada escolha deixou, com a data do calendário, quem propôs e se valeu o padrão por prazo.
//   Conselheiros: os seis com nome completo e cargo (a história, seção 8).
import { useState } from 'preact/hooks';
import { barra } from '../../loja.js';
import { consultar } from '../../consultas.js';
import * as fmt from '../../formato.js';
import { t } from '../../textos.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { tomarAba } from '../../hud/Menu.jsx';
import { abrirDecisao } from '../Decisao.jsx';
import { Quem, frase } from './comum.jsx';
import { CONSELHEIROS_ORDEM } from '../../../data/nomes.js';

function Pendentes({ ui }) {
  const l = consultar('decisoes') ?? [];
  const tempo = ui.obterSim()?.espelho?.tempo;
  if (!l.length) return <Vazio glifo="conselho" texto={t('cons.semPendentes')} />;
  return (
    <div class="cons-cartoes">
      {l.map((d) => {
        const quem = Array.isArray(d.quem) ? d.quem : [d.quem];
        const falta = Number.isFinite(d.prazo) ? d.prazo - (tempo?.tique ?? 0) : null;
        return (
          <article class="cons-cartao" data-k={d.id}>
            <span class="rot">{d.data ? fmt.dataCalendario(d.data) : t('cons.decisao')}</span>
            <h3 class="cons-titulo">{frase(d.titulo)}</h3>
            <div class="cons-quem">
              {quem.filter(Boolean).map((q) => (
                <Quem id={q} />
              ))}
            </div>
            {falta !== null ? <p class="eco-nota num">{t('cons.prazo', { t: fmt.contagem(Math.max(0, falta), tempo?.mult ?? 0) })}</p> : null}
            <Botao a="cons.decidir" k={d.id} rotulo={t('cons.decidir')} principal class="bt-pri" onClick={() => abrirDecisao(d.id)}>
              {t('cons.decidir')}
            </Botao>
          </article>
        );
      })}
    </div>
  );
}

function Historico() {
  const l = consultar('decisoes', { historico: true });
  const lista = Array.isArray(l) ? [...l].reverse() : [];
  if (!lista.length) return <Vazio glifo="relogio" texto={t('cons.semHistorico')} />;
  return (
    <Secao titulo={t('cons.aba.historico')}>
      {lista.map((h) => (
        <div class="cons-hist" data-k={h.id}>
          {h.quem ? <Quem id={h.quem} /> : null}
          <span class="cons-hist-textos">
            <span class="cons-hist-titulo">{frase(h.titulo)}</span>
            <span class="cons-hist-escolha">{frase(h.texto) || h.opcao}</span>
            <span class="eco-nota num">{[h.data ? fmt.dataCalendario(h.data) : null, h.auto ? t('cons.porPrazo') : null].filter(Boolean).join(' · ')}</span>
          </span>
        </div>
      ))}
    </Secao>
  );
}

function Conselheiros() {
  return (
    <Secao titulo={t('cons.aba.conselheiros')}>
      <div class="cons-pessoas">
        {CONSELHEIROS_ORDEM.map((id) => (
          <Quem id={id} nome cargo />
        ))}
      </div>
      <p class="eco-nota">{t('cons.nota')}</p>
    </Secao>
  );
}

export default function Conselho({ ui, fechar }) {
  const [aba, setAba] = useState(() => tomarAba('conselho', 'decisoes'));
  barra.value; // relê com a barra (prazos e decisões novas)
  const pend = (consultar('decisoes') ?? []).length;
  const abas = [
    { id: 'decisoes', rotulo: t('cons.aba.decisoes'), selo: pend || null },
    { id: 'historico', rotulo: t('cons.aba.historico') },
    { id: 'conselheiros', rotulo: t('cons.aba.conselheiros') },
  ];
  return (
    <Tela id="conselho" glifo="conselho" titulo={t('cons.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {aba === 'decisoes' ? <Pendentes ui={ui} /> : aba === 'historico' ? <Historico /> : <Conselheiros />}
    </Tela>
  );
}
