// Seção da folha do prédio residencial (desenho da UI 8.7): Visão geral (avisos, obra, moradores e capacidade, lares,
// bem-estar com o rosto da faixa, Contribuição por hora de jogo em dólar e o nível com o que falta para subir),
// Moradores (fatores do bem-estar com o número de cada um e a escolaridade) e Serviços (redes e cobertura).
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { glifoBemEstar } from '../../glifos/glifos.js';
import { tarifaDoBemEstar, bemEstarArredondado } from '../../../data/economia.js';
import { Bloco, Par, Avisos, Nivel, Servicos, Fatores, Obra } from '../Folha.jsx';
import { Barra } from '../../comp/Barra.jsx';

/** Escolaridade dos moradores em 4 níveis (frações de 0 a 1). */
export function Escolaridade({ fracoes }) {
  if (!Array.isArray(fracoes) || !fracoes.some((f) => f > 0)) return null;
  return (
    <Bloco titulo={t('folha.escolaridade')}>
      {fracoes.map((f, i) => (
        <div class="fl-par fl-par-barra" data-k={`estudo${i}`}>
          <span class="fl-par-rot">{t(`folha.estudo.${i}`)}</span>
          <Barra valor={f} estado="ac" rotulo={t(`folha.estudo.${i}`)} texto={fmt.pct(f)} />
        </div>
      ))}
    </Bloco>
  );
}

export function SecaoResidencial({ ui, sel, p, aba }) {
  const m = p?.moradia ?? {};
  if (aba === 'moradores') {
    return (
      <>
        <Fatores titulo={t('folha.fatoresBem')} fatores={m.fatores} />
        <Escolaridade fracoes={m.escolaridade} />
      </>
    );
  }
  if (aba === 'servicos') return <Servicos p={p} />;
  const bem = bemEstarArredondado(m.bemEstar);
  const tar = tarifaDoBemEstar(m.bemEstar);
  return (
    <>
      <Avisos ui={ui} p={p} sel={sel} />
      <Obra p={p} />
      <Bloco titulo={t('folha.resumo')}>
        <Par k="moradores" rotulo={t('cartao.moradores')} valor={t('cartao.deN', { a: fmt.numero(m.moradores ?? 0), b: fmt.numero(m.capacidade ?? 0) })} />
        <Par k="lares" rotulo={t('folha.lares')} valor={fmt.numero(m.lares ?? 0)} />
        <Par k="bemEstar" rotulo={t('cartao.bemEstar')} valor={fmt.numero(bem)} glifo={glifoBemEstar(tar)} estado={tar >= 11 ? 'ok' : tar >= 8 ? null : 'er'} />
        <Par k="contribuicao" rotulo={t('cartao.contribuicao')} valor={fmt.dinheiroHora(m.contribuicaoHora ?? 0)} estado="ch" dica={fmt.dicaHora()} />
        <Par k="tarifa" rotulo={t('folha.tarifa')} valor={t('folha.porMorador', { v: fmt.dinheiroPorHora(m.tarifa ?? tar) })} dica={fmt.dicaHora()} />
      </Bloco>
      <Nivel p={p} />
    </>
  );
}
SecaoResidencial.abas = () => [
  { id: 'geral', rotulo: t('folha.aba.geral') },
  { id: 'moradores', rotulo: t('folha.aba.moradores') },
  { id: 'servicos', rotulo: t('folha.aba.servicos') },
];

export function registrar(ui) {
  ui.registrarSecao('residencial', SecaoResidencial, { ordem: 10 });
}
