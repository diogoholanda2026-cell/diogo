// Seção da folha da via (q.aresta): tipo, comprimento, declive, mão, manutenção por hora em dólar, o fluxo (M1b, com o
// trânsito) e quanto volta ao demolir; as melhorias possíveis (o rodapé abre a ferramenta). Rodovia e vias da
// Arcologia não se demolem.
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { VIAS } from '../../../data/vias.js';
import { Bloco, Par } from '../Folha.jsx';
import { nomeTipoVia } from '../Cartao.jsx';

export function SecaoVia({ p }) {
  if (!p) return null;
  return (
    <>
      <Bloco titulo={t('folha.resumo')}>
        <Par k="tipo" rotulo={t('folha.via.tipo')} valor={nomeTipoVia(p.tipo)} />
        <Par k="comprimento" rotulo={t('cartao.via.comprimento')} valor={t('cartao.via.m', { m: fmt.numero(p.comprimento ?? 0) })} />
        {Number.isFinite(p.declive) ? <Par k="declive" rotulo={t('cartao.via.declive')} valor={fmt.pct(Math.abs(p.declive), 1)} /> : null}
        <Par k="mao" rotulo={t('folha.via.mao')} valor={t(p.mao ? 'folha.via.unica' : 'folha.via.dupla')} />
        <Par k="manutencao" rotulo={t('cartao.manutencao')} valor={fmt.dinheiroHora(-(p.manutencaoHora ?? 0))} dica={fmt.dicaHora()} />
        {p.fluxo ? <Par k="fluxo" rotulo={t('cartao.via.fluxo')} valor={fmt.pct(p.fluxo.vel ?? 1)} estado={(p.fluxo.vel ?? 1) < 0.5 ? 'al' : null} /> : null}
        {p.rodovia || p.arcologia ? null : Number.isFinite(p.devolve) ? <Par k="devolve" rotulo={t('folha.via.devolve')} valor={fmt.dinheiro(p.devolve)} /> : null}
      </Bloco>
      {p.melhoraPara?.length ? (
        <Bloco titulo={t('folha.via.melhorias')}>
          {p.melhoraPara.map((tp) => (
            <Par k={tp} rotulo={VIAS[tp]?.nome ?? tp} valor={t('folha.via.largura', { m: fmt.numero(VIAS[tp]?.largura ?? 0) })} />
          ))}
        </Bloco>
      ) : null}
      {p.rodovia ? <p class="fl-nota">{t('folha.via.rodovia')}</p> : p.arcologia ? <p class="fl-nota">{t('folha.via.arcologia')}</p> : null}
    </>
  );
}

export function registrar(ui) {
  ui.registrarSecao('via', SecaoVia, { ordem: 60 });
}
