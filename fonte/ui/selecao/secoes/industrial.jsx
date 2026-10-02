// Seção da folha da indústria zoneada: o que ela faz, trabalhadores e produtividade (que cai com a falta de mão de
// obra básica), o nível, as vagas por escolaridade e os serviços. Destino da carga e poluição chegam no M1b (S2b).
import { t } from '../../textos.js';
import { Bloco, Avisos, Nivel, Servicos, Obra } from '../Folha.jsx';
import { ResumoTrabalho, Trabalho } from './comercial.jsx';

export function SecaoIndustrial({ ui, sel, p, aba }) {
  const w = p?.trabalho;
  if (aba === 'trabalho') return <Trabalho w={w} />;
  if (aba === 'servicos') return <Servicos p={p} />;
  return (
    <>
      <Avisos ui={ui} p={p} sel={sel} />
      <Obra p={p} />
      {p?.faz ? (
        <Bloco titulo={t('folha.faz')}>
          <p class="fl-texto">{p.faz}</p>
        </Bloco>
      ) : null}
      <ResumoTrabalho w={w} clientes={false} />
      <Nivel p={p} />
    </>
  );
}
SecaoIndustrial.abas = () => [
  { id: 'geral', rotulo: t('folha.aba.geral') },
  { id: 'trabalho', rotulo: t('folha.aba.trabalho') },
  { id: 'servicos', rotulo: t('folha.aba.servicos') },
];

export function registrar(ui) {
  ui.registrarSecao('industrial', SecaoIndustrial, { ordem: 30 });
}
