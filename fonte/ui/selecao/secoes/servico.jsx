// Seção da folha do serviço (desenho da UI 8.7): avisos, obra, o que ele faz e a referência real do modelo (R5),
// atendidos de capacidade (ou a produção, nas redes de água e energia), eficiência (cai com a falta de pessoal ou de
// verba, D41), alcance com "Ver camada" (liga a camada certa: água, energia ou serviços) e a manutenção por hora em
// dólar. Veículos e extensões ficam para o M2.
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { camada } from '../../loja.js';
import { Botao } from '../../comp/Botao.jsx';
import { Bloco, Par, Avisos, Obra } from '../Folha.jsx';
import { folhaAberta, categoriaServico } from '../Cartao.jsx';
import { COLOCAVEIS } from '../../../data/colocaveis.js';

const CAMADA = { agua: 'agua', energia: 'energia', esgoto: 'esgoto' };
/** A camada que mostra o alcance do serviço. */
export const camadaDoServico = (cat) => CAMADA[cat] ?? 'servicos';

export function SecaoServico({ ui, sel, p }) {
  const s = p?.servico ?? {};
  const cat = categoriaServico(p);
  const rede = !!s.rede || cat === 'agua' || cat === 'energia' || cat === 'esgoto';
  const efic = s.eficiencia ?? 0;
  const ref = COLOCAVEIS[p?.id ?? p?.tipo]?.referencia ?? null;
  const ver = () => {
    camada.value = camadaDoServico(cat);
    folhaAberta.value = false;
  };
  return (
    <>
      <Avisos ui={ui} p={p} sel={sel} />
      <Obra p={p} />
      {p?.faz || ref ? (
        <Bloco titulo={t('folha.faz')}>
          {p?.faz ? <p class="fl-texto">{p.faz}</p> : null}
          {ref ? <p class="fl-nota">{t('folha.inspirado', { ref })}</p> : null}
        </Bloco>
      ) : null}
      <Bloco
        titulo={t('folha.resumo')}
        acao={
          <Botao a="folha.verCamada" rotulo={t('folha.verCamada')} class="bt-fan" onClick={ver}>
            {t('folha.verCamada')}
          </Botao>
        }
      >
        {rede ? (
          <Par k="uso" rotulo={t('folha.emUso')} valor={fmt.pct(s.capacidade ? (s.uso ?? 0) / s.capacidade : 0)} />
        ) : (
          <Par k="atendidos" rotulo={t('cartao.atendidos')} valor={t('cartao.deN', { a: fmt.numero(s.uso ?? 0), b: fmt.numero(s.capacidade ?? 0) })} />
        )}
        <Par k="eficiencia" rotulo={t('cartao.eficiencia')} valor={fmt.pct(efic)} estado={efic < 0.5 ? 'er' : efic < 0.8 ? 'al' : null} glifo={efic < 0.8 ? 'alerta' : null} />
        {s.alcance > 0 ? <Par k="alcance" rotulo={t('folha.alcance')} valor={t('cartao.via.m', { m: fmt.numero(s.alcance) })} /> : null}
        <Par k="manutencao" rotulo={t('cartao.manutencao')} valor={fmt.dinheiroHora(-(s.manutencaoHora ?? 0))} dica={fmt.dicaHora()} />
      </Bloco>
      {efic < 0.8 ? <p class="fl-nota">{t('folha.eficienciaBaixa')}</p> : null}
    </>
  );
}

export function registrar(ui) {
  ui.registrarSecao('servico', SecaoServico, { ordem: 40 });
}
