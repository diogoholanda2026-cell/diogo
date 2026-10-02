// Seção da folha do comércio (e do escritório, M1b): Visão geral (avisos, obra, trabalhadores e vagas, produtividade,
// clientes e o nível), Trabalho (vagas por escolaridade e os fatores da produtividade) e Serviços. A indústria usa os
// mesmos blocos (industrial.jsx).
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { Bloco, Par, Avisos, Nivel, Servicos, Fatores, Obra } from '../Folha.jsx';

const soma = (l) => (Array.isArray(l) ? l.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0) : Number.isFinite(l) ? l : 0);

/** Trabalhadores, produtividade e clientes (o bloco trabalho de q.predio). */
export function ResumoTrabalho({ w, clientes = true }) {
  const prod = w?.produtividade ?? 0;
  return (
    <Bloco titulo={t('folha.resumo')}>
      <Par k="trabalhadores" rotulo={t('cartao.trabalhadores')} valor={t('cartao.deN', { a: fmt.numero(soma(w?.ocupadas)), b: fmt.numero(soma(w?.vagas)) })} />
      <Par k="produtividade" rotulo={t('cartao.produtividade')} valor={fmt.pct(prod)} estado={prod < 0.5 ? 'er' : prod < 0.8 ? 'al' : null} glifo={prod < 0.8 ? 'alerta' : null} />
      {clientes && Number.isFinite(w?.clientes) ? <Par k="clientes" rotulo={t('folha.clientes')} valor={fmt.numero(w.clientes)} /> : null}
    </Bloco>
  );
}

/** Vagas por escolaridade (básico a superior) e os fatores da produtividade. */
export function Trabalho({ w }) {
  const vagas = Array.isArray(w?.vagas) ? w.vagas : [];
  return (
    <>
      {vagas.length ? (
        <Bloco titulo={t('folha.vagas')}>
          {vagas.map((v, i) => (
            <Par k={`vaga${i}`} rotulo={t(`folha.estudo.${i}`)} valor={t('cartao.deN', { a: fmt.numero(w.ocupadas?.[i] ?? 0), b: fmt.numero(v ?? 0) })} estado={(w.ocupadas?.[i] ?? 0) < v ? 'al' : null} />
          ))}
        </Bloco>
      ) : null}
      <Fatores titulo={t('folha.fatoresProd')} fatores={w?.fatores} pct />
    </>
  );
}

export function SecaoComercial({ ui, sel, p, aba }) {
  const w = p?.trabalho;
  if (aba === 'trabalho') return <Trabalho w={w} />;
  if (aba === 'servicos') return <Servicos p={p} />;
  return (
    <>
      <Avisos ui={ui} p={p} sel={sel} />
      <Obra p={p} />
      <ResumoTrabalho w={w} />
      <Nivel p={p} />
    </>
  );
}
SecaoComercial.abas = () => [
  { id: 'geral', rotulo: t('folha.aba.geral') },
  { id: 'trabalho', rotulo: t('folha.aba.trabalho') },
  { id: 'servicos', rotulo: t('folha.aba.servicos') },
];

export function registrar(ui) {
  ui.registrarSecao('comercial', SecaoComercial, { ordem: 20 });
}
