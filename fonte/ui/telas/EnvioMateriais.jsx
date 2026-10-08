// Envio dos materiais de uma etapa da Arcologia (D109; dona: X1b): o seletor Automático ou Manual e, no manual, a lista
// dos itens com o enviado, o que falta e o estoque, a quantidade digitada (até 1000 de uma vez) e os botões Enviar e
// Enviar tudo que couber. Serve ao Livro da Arcologia e à folha da parte. Alvos de 44 px (Botao, Segmentado, Quantidade).
import { useState } from 'preact/hooks';
import * as fmt from '../formato.js';
import { t, temTexto } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { Segmentado } from '../comp/Segmentado.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { trocarEnvio, enviarMaterial, enviarTudo } from './LivroArcologia.jsx';

const nomeItem = (id) => (temTexto(`s3.item.${id}`) ? t(`s3.item.${id}`) : id);

/** O mais que se manda de uma vez de um item (D109, revisto em 08/10/2026): o que falta, o estoque e o teto de 1000 por pedido (no mínimo 1 para a tela). */
export const TETO_PEDIDO = 1000;
export const maxDoLote = (m) => Math.max(1, Math.min(TETO_PEDIDO, Math.floor(m?.falta ?? 0), Math.floor(m?.estoque ?? 0) || TETO_PEDIDO));

/** Uma linha do modo manual: o item, a situação, a quantidade e o botão Enviar. */
function ItemManual({ idEtapa, m }) {
  const [n, setN] = useState(1);
  const max = maxDoLote(m);
  // o campo aceita digitar (1000 de uma vez) e se prende ao que falta, ao estoque e ao teto de 1000 por pedido
  const q = Math.min(Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)), max);
  const completo = (m.falta ?? 0) < 1;
  const semEstoque = !completo && (m.estoque ?? 0) < 1;
  return (
    <div class="fl-par fl-par-envio" data-k={m.item}>
      <span class="fl-par-rot">{nomeItem(m.item)}</span>
      <span class="linha-sub">
        {completo
          ? t('arc2.item.completo', { pedido: fmt.numero(m.pedido ?? 0), precisa: fmt.numero(m.precisa ?? m.pede ?? 0) })
          : t('arc2.item.situacao', { pedido: fmt.numero(m.pedido ?? 0), precisa: fmt.numero(m.precisa ?? m.pede ?? 0), falta: fmt.numero(m.falta ?? 0), estoque: fmt.numero(m.estoque ?? 0) })}
      </span>
      {completo ? (
        <Glifo n="check" tam={18} />
      ) : (
        <div class="eco-acoes">
          <input
            class="fl-renomear-campo fl-envio-campo num"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            data-a="arc.qtdDigitar"
            data-k={m.item}
            value={String(n === '' ? '' : q)}
            aria-label={t('arc2.item.quantidade', { item: nomeItem(m.item) })}
            onInput={(ev) => {
              const v = ev.currentTarget.value.replace(/[^0-9]/g, '');
              setN(v === '' ? '' : Math.min(Number(v), max));
            }}
            onBlur={() => setN(q)}
            onFocus={(ev) => ev.currentTarget.select?.()}
          />
          <Botao a="arc.qtdMax" k={m.item} rotulo={t('arc2.maximo', { n: fmt.numero(max) })} class="bt-sec" onClick={() => setN(max)}>
            {t('arc2.maximo.curto')}
          </Botao>
          <Botao a="arc.enviar" k={m.item} rotulo={t('arc2.enviar.n', { n: q })} class="bt-sec" desligado={semEstoque} dica={semEstoque ? t('arc2.semEstoque') : undefined} onClick={() => enviarMaterial(idEtapa, m.item, q)}>
            <Glifo n="caminhao" tam={18} />
            {t('arc2.enviar')}
          </Botao>
        </div>
      )}
    </div>
  );
}

/** Seletor do modo e, no manual, a lista dos itens. `e` é a etapa da consulta q.arcologia. */
export function EnvioMateriais({ e }) {
  if (!e || (e.estado !== 1 && e.estado !== 2)) return null;
  const modo = e.envio === 'manual' ? 'manual' : 'auto';
  const itens = e.materiais ?? [];
  const algoCabe = itens.some((m) => (m.falta ?? 0) >= 1 && (m.estoque ?? 0) >= 1);
  const algoFalta = itens.some((m) => (m.falta ?? 0) >= 1);
  return (
    <div class="fl-bloco livro-envio" data-k="envio">
      <span class="fl-par-rot">{t('arc2.envio')}</span>
      <Segmentado
        a="arc.modo"
        rotulo={t('arc2.envio')}
        valor={modo}
        aoTrocar={(v) => trocarEnvio(e.id, v)}
        opcoes={[{ v: 'auto', rotulo: t('arc2.envio.auto') }, { v: 'manual', rotulo: t('arc2.envio.manual') }]}
      />
      <p class="fl-nota">{t(`arc2.envio.${modo}.nota`)}</p>
      {modo === 'manual' ? (
        <>
          {itens.map((m) => (
            <ItemManual idEtapa={e.id} m={m} />
          ))}
          {algoFalta ? (
            <Botao a="arc.enviarTudo" k={e.id} rotulo={t('arc2.enviarTudo')} class="bt-pri" principal desligado={!algoCabe} onClick={() => enviarTudo(e.id)}>
              <Glifo n="caminhao" tam={18} />
              {t('arc2.enviarTudo')}
            </Botao>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
