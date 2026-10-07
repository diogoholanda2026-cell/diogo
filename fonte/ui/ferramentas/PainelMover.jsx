// Painel "o que muda" da ferramenta de mover (MOV1, D94; dona: MOV1). Vem sob demanda de sessao.js (um import() no
// registrar) e mora no canto de cima da esquerda (o lugar da folha, que a ferramenta recolhe): enquanto o jogador arrasta
// o fantasma, diz o que custa mover, quanto tempo o prédio fica em obra, o que o alcance dele ganha e perde (moradores
// atendidos antes e depois), a via a que se liga, a rede e o armazém. O motivo do vermelho e o giro ficam no painel do
// fantasma (DicaColocar.jsx); aqui só o que muda. Sem toque no mouse (pointer-events: none): o dedo arrasta por cima.
import { sessao } from './sessao.js';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { Glifo } from '../glifos/Glifo.jsx';
import { linhasDoQueMuda } from './mover.js';

const GLIFO = { ok: 'check', al: 'alerta', er: 'alerta' };

/** A sessão é a de mover? */
const doMover = (s) => !!s && s.tipo === 'colocar' && !!s.maquina?.mover;

export function PainelMover() {
  const s = sessao.value;
  if (!doMover(s)) return null;
  const p = s.previa;
  const linhas = linhasDoQueMuda(p, { t, fmt });
  return (
    <div class={`mov1-painel${s.dedo ? ' arrastando' : ''}`} data-hud="mover" role="group" aria-label={t('mov1.painel')}>
      <h2 class="mov1-titulo">
        <Glifo n="mover" tam={18} />
        <span>{t('mov1.painel.titulo', { nome: s.item?.nomeReal ?? '' })}</span>
      </h2>
      {p?.parado ? <p class="mov1-parado">{t('mov1.painel.parado')}</p> : null}
      {linhas.length ? (
        <ul class="mov1-linhas">
          {linhas.map((l) => (
            <li key={l.id} class={`mov1-linha${l.tom ? ` tx-${l.tom}` : ''}`} data-linha={l.id}>
              {l.tom ? <Glifo n={GLIFO[l.tom]} tam={16} /> : <i class="mov1-ponto" aria-hidden="true" />}
              <span class="mov1-texto">{l.texto}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function registrar(ui) {
  ui.registrarHud('folha', PainelMover, { ordem: 30, nome: 'mover-painel' });
}
