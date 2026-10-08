// Importação por item (D110, pedido do dono em 08/10/2026): campo do lote (1 a 1000, digitável, atalhos 1/10/100/1000),
// "Máx" (o que falta, até 1000), o custo à vista (n x preço de importação, 160% do preço base) e o prazo, e o botão
// "Importar N". Serve ao Livro da Arcologia (por item que falta) e fica pronto para a tela Holding.
import { useState } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { LoteCampo, limitarLote, LOTE_MAX } from './LoteCampo.jsx';
import { t } from '../textos.js';
import * as fmt from '../formato.js';

/** Custo à vista de n unidades pelo preço de importação do Depósito (função pura). */
export const custoDaImportacao = (n, preco) => limitarLote(n) * (Number.isFinite(preco) ? preco : 0);

/** Prazo em segundos de jogo (1 tique = 1 s de jogo). */
export const prazoSegundos = (tiques) => Math.max(0, Math.round(Number.isFinite(tiques) ? tiques : 0));

export function ImportarItem({ item, nome, falta = 0, preco, prazoTiques, aoImportar, a = 'importar' }) {
  const maxFalta = limitarLote(Math.ceil(falta) || 1);
  const [n, setN] = useState(falta > 0 ? maxFalta : 10);
  const q = limitarLote(n);
  const custo = custoDaImportacao(q, preco);
  return (
    <div class="fl-par importar-item" data-k={item}>
      <span class="fl-par-rot">{nome}</span>
      <LoteCampo a={`${a}.lote`} k={item} valor={q} aoMudar={setN} rotulo={t('x1.importar.qtd', { item: nome })} />
      <div class="eco-acoes">
        {falta > 0 ? (
          <Botao a={`${a}.max`} k={item} rotulo={t('x1.importar.max', { n: fmt.numero(Math.min(LOTE_MAX, maxFalta)) })} class="bt-sec" onClick={() => setN(maxFalta)}>
            {t('arc2.maximo.curto')}
          </Botao>
        ) : null}
        <Botao a={`${a}.ir`} k={item} rotulo={t('x1.importar.n', { n: fmt.numero(q) })} class="bt-sec" onClick={() => aoImportar?.(q)}>
          <Glifo n="importar" tam={18} />
          {t('x1.importar.n', { n: fmt.numero(q) })}
        </Botao>
      </div>
      <span class="linha-sub num">{t('x1.importar.custo', { v: fmt.dinheiro(custo), s: fmt.numero(prazoSegundos(prazoTiques)) })}</span>
    </div>
  );
}
