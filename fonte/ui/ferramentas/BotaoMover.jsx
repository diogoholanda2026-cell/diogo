// O botão Mover da folha do prédio (MOV1, D94; MOV2, D105; dona: MOV1): os colocáveis (serviços, prédios da Holding, praças e
// marcos do complexo) e os prédios de zona, prontos ou em obra, mudam de lugar ou de direção por uns 10% do custo; a Arcologia
// fica fixa e a folha nem mostra o botão. O colocável em obra aparece apagado e diz por quê; o de zona em obra pode (a obra
// segue do mesmo ponto). Mora aqui, e não na folha,
// para a folha só chamar: os textos entram pelo registro da MOV1 (mov1.js), sem pedir ao índice fixo de textos.
import { t, registrarTextos } from '../textos.js';
import * as fmt from '../formato.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { registrarGlifos } from '../glifos/glifos.js';
import { registrar as registrarTextosMov1 } from '../textos/mov1.js';
import { GLIFO_MOVER, registrarTextosDeZona } from './mover.js';

registrarTextosMov1(registrarTextos);
registrarTextosDeZona(registrarTextos);
registrarGlifos(GLIFO_MOVER);

/** O prédio p (q.predio) pode ter o botão (colocável ou zona, mesmo que em obra)? Só a Arcologia fica sem. */
export const mostraMover = (p) => !!p?.mover && p.mover.motivo !== 'arcologia';

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
      dica={mv.pode ? t(mv.zona ? (mv.emObra ? 'mov2.mover.dicaObra' : 'mov2.mover.dicaZona') : 'mov1.mover.dica', { custo: fmt.dinheiro(mv.custo) }) : t('mov1.mover.emObra')}
      onClick={aoAbrir}
    >
      <Glifo n="mover" tam={18} />
      {t('mov1.mover')}
    </Botao>
  );
}
