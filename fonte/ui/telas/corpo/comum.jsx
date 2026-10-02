// Peças comuns aos corpos sob demanda da U1b (Holding, Cidade, Progresso, Conselho, Decisão e Momento): o monograma
// de quem fala, o nome do que um marco libera, o medidor de 0 a 100 e a linha de tabela simples. Vêm num pedaço
// compartilhado do pacote, só quando uma dessas telas abre.
import { t, temTexto } from '../../textos.js';
import * as fmt from '../../formato.js';
import { Barra } from '../../comp/Barra.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { quemFala } from '../../hud/Objetivo.jsx';
import { SERVICOS } from '../../../data/servicos.js';
import { PREDIOS_HOLDING } from '../../../data/holding.js';
import { VIAS } from '../../../data/vias.js';

/**
 * Frase de uma chave da simulação ou o próprio texto (uma simulação que já manda a frase). Uma chave sem frase
 * ('s3.decisao.x.ganho') fica vazia: a linha some em vez de mostrar a chave crua.
 */
export const frase = (x) => {
  if (typeof x !== 'string') return x ?? '';
  if (temTexto(x)) return t(x);
  return /^\w+(\.\w+)+$/.test(x) ? '' : x;
};

/** Monograma de 28 px de um conselheiro (D83), com o nome e o cargo ao lado quando `nome`. */
export function Quem({ id, nome = false, cargo = false }) {
  const q = quemFala(id);
  return (
    <span class="quem">
      <span class={`monograma mono-${q.id ?? 'holding'}`} aria-hidden="true">
        {q.inicial}
      </span>
      {nome ? (
        <span class="quem-textos">
          <span class="quem-nome">{q.nome}</span>
          {cargo && q.cargo ? <span class="quem-cargo">{q.cargo}</span> : null}
        </span>
      ) : null}
    </span>
  );
}

/** Nome do que um marco libera ('servico.clinica' → 'Clínica'); id sem nome conhecido, null (fica de fora). */
export function nomeLiberado(id) {
  const [dom, ...resto] = String(id).split('.');
  const x = resto.join('.');
  if (dom === 'servico') return SERVICOS[x]?.nome ?? null;
  if (dom === 'holding') return PREDIOS_HOLDING[x]?.nome ?? null;
  if (dom === 'via') return VIAS[x]?.nome ?? null;
  if (dom === 'item' && temTexto(`s3.item.${x}`)) return t(`s3.item.${x}`);
  if (dom === 'zona' && temTexto(`zona.${x}`)) return t(`zona.${x}`);
  if (dom === 'etapa' && temTexto(`s3.etapa.${x}`)) return t(`s3.etapa.${x}`);
  return temTexto(`libera.${id}`) ? t(`libera.${id}`) : null;
}

/** Glifo do que um marco libera, pelo domínio. */
export const glifoLiberado = (id) => ({ servico: 'servicos', holding: 'empresas', via: 'vias', item: 'material', zona: 'zonas', etapa: 'arcologia' })[String(id).split('.')[0]] ?? 'check';

/** Medidor de 0 a 100 (Influência, Legado) com o efeito escrito embaixo (D55). */
export function Medidor({ glifo, rotulo, valor, efeito }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 0));
  return (
    <div class="medidor">
      <span class="medidor-cab">
        <Glifo n={glifo} tam={18} class="tx-ch" />
        <span class="rot">{rotulo}</span>
        <b class="num medidor-valor">{fmt.numero(v)}</b>
      </span>
      <Barra valor={v / 100} estado="ch" rotulo={rotulo} />
      {efeito ? <span class="medidor-efeito">{efeito}</span> : null}
    </div>
  );
}
