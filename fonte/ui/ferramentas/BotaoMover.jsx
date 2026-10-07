// O botão Mover da folha do prédio (MOV1, D94; dona: MOV1): os colocáveis (serviços, prédios da Holding, praças e marcos do
// complexo) mudam de lugar ou de direção por uns 10% do custo; a zona não (ela se refaz sozinha) e a Arcologia fica fixa,
// e nesses dois a folha nem mostra o botão. Em obra, o botão aparece apagado e diz por quê. Mora aqui, e não na folha,
// para a folha só chamar: os textos entram pelo registro da MOV1 (mov1.js), sem pedir ao índice fixo de textos.
import { t, registrarTextos } from '../textos.js';
import * as fmt from '../formato.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { registrarGlifos } from '../glifos/glifos.js';
import { registrar as registrarTextosMov1 } from '../textos/mov1.js';
import { GLIFO_MOVER } from './mover.js';

registrarTextosMov1(registrarTextos);
registrarGlifos(GLIFO_MOVER);

/** O prédio p (q.predio) pode ter o botão (colocável, mesmo que em obra)? */
export const mostraMover = (p) => !!p?.mover && p.mover.motivo !== 'zona' && p.mover.motivo !== 'arcologia';

/**
 * @param {{ p: object, aoAbrir: () => void }} props  p: o q.predio da folha; aoAbrir: fecha a folha e abre a ferramenta
 */
export function BotaoMover({ p, aoAbrir }) {
  if (!mostraMover(p)) return null;
  const mv = p.mover;
  return (
    <Botao
      a="folha.mover"
      rotulo={t('mov1.mover')}
      class="bt-sec"
      desligado={!mv.pode}
      dica={mv.pode ? t('mov1.mover.dica', { custo: fmt.dinheiro(mv.custo) }) : t('mov1.mover.emObra')}
      onClick={aoAbrir}
    >
      <Glifo n="mover" tam={18} />
      {t('mov1.mover')}
    </Botao>
  );
}
