// Seção da folha do prédio da Holding (desenho da UI 8.7; D13, D47, D57 e a regra do dono dos lotes de 1 a 10):
//   Produção: cada linha com o item (os que o prédio faz), o lote de 1 a 10 (começa em 10 com Auto, D57), Auto, o
//     progresso com a contagem em mm:ss reais, por que parou, a sugestão de lote só quando ajuda (um toque aplica), a
//     cadeia "insumo para produto" com quem produz cada insumo (um toque leva a folha até ele, com Voltar) e a compra
//     de tempo (D13: 1, 5, 10, 30 e 60 min de jogo, com o preço em dólar).
//   Prédio: nível de 1 a 3 com o que o próximo pede, trabalhadores por escolaridade, produtividade e a distância ao
//     armazém (D47).
import { useState, useEffect } from 'preact/hooks';
import { t, temTexto } from '../../textos.js';
import * as fmt from '../../formato.js';
import { comando } from '../../acoes.js';
import { consultar } from '../../consultas.js';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Quantidade } from '../../comp/Quantidade.jsx';
import { Interruptor } from '../../comp/Interruptor.jsx';
import { Segmentado } from '../../comp/Segmentado.jsx';
import { Chip } from '../../comp/Chip.jsx';
import { Bloco, Par, Avisos, Obra, navegar } from '../Folha.jsx';
import { Trabalho } from './comercial.jsx';
import { ITENS, PREDIOS_HOLDING } from '../../../data/holding.js';
import { COMPRA_TEMPO, REGRAS_DONO } from '../../../data/economia.js';

/** Nome do item ('Concreto'); item desconhecido, o próprio id. */
export const nomeItem = (item) => (temTexto(`s3.item.${item}`) ? t(`s3.item.${item}`) : item ?? '');
/** Nome do tipo de prédio da Holding ('Concreteira'). */
export const nomePredioHolding = (tipo) => PREDIOS_HOLDING[tipo]?.nome ?? tipo ?? '';
/** Por que a linha parou (frase da S3a ou a desta seção). */
export const motivoParada = (p) => (temTexto(`s3.parada.${p}`) ? t(`s3.parada.${p}`) : t('folha.linha.parada'));
/** Insumos de 1 unidade do item: [{ item, n }]. */
export const insumosDe = (item) => Object.entries(ITENS[item]?.req ?? {}).map(([k, n]) => ({ item: k, n }));

function Cadeia({ ui, item }) {
  const ins = insumosDe(item);
  if (!ins.length) return <p class="fl-nota">{t('folha.linha.extrai', { item: nomeItem(item).toLowerCase() })}</p>;
  const prod = consultar('producao');
  return (
    <div class="fl-cadeia">
      {ins.map((x) => {
        const tipo = ITENS[x.item]?.predio;
        const quem = (prod?.predios ?? []).find((q) => q.tipo === tipo);
        const P = ui.obterSim()?.espelho?.predios;
        const i = quem ? quem.ref % 2 ** 20 : -1;
        const ir = quem ? () => navegar(ui, { tipo: 'predio', ref: quem.ref, idx: i, ponto: P && i < P.n ? [P.x[i], P.y?.[i] ?? 0, P.z[i]] : null }) : null;
        return (
          <span class="fl-insumo">
            <span class="num">{`${x.n} ${nomeItem(x.item).toLowerCase()}`}</span>
            {ir ? (
              <Botao a="folha.insumo" k={x.item} rotulo={t('folha.linha.verFornecedor', { nome: nomePredioHolding(tipo) })} class="bt-fan" onClick={ir}>
                {nomePredioHolding(tipo)}
              </Botao>
            ) : (
              <span class="fl-nota">{t(ITENS[x.item]?.predio ? 'folha.linha.semFornecedor' : 'folha.linha.importado')}</span>
            )}
          </span>
        );
      })}
      <Glifo n="setaDir" tam={16} />
      <span class="num">{t('folha.linha.produto', { item: nomeItem(item).toLowerCase() })}</span>
    </div>
  );
}

function Linha({ ui, p, l, i, mult, tique }) {
  const [lote, setLote] = useState(l.n > 0 ? l.n : REGRAS_DONO.lote.max);
  // a ordem mudada em outro lugar (a tela Holding, o Auto) vale aqui também
  useEffect(() => {
    if (l.n > 0) setLote(l.n);
  }, [l.n]);
  const itens = p.holding.produz ?? [];
  const item = l.item ?? itens[0];
  const ordem = (mudar) => comando('linha.ordem', { predio: p.ref, linha: i, item, n: lote, auto: l.ativa ? l.auto : true, ...mudar });
  const faltam = l.rodando && Number.isFinite(l.fimTique) ? l.fimTique - tique : null;
  return (
    <section class="fl-linha" data-k={`linha${i}`}>
      <header class="fl-bloco-cab">
        <h2 class="rot">{t('folha.linha', { n: i + 1, item: nomeItem(item) })}</h2>
        {l.ativa || l.rodando ? (
          <Botao a="folha.linha.parar" k={i} rotulo={t('folha.linha.parar')} class="bt-fan" onClick={() => comando('linha.parar', { predio: p.ref, linha: i })}>
            {t('folha.linha.parar')}
          </Botao>
        ) : null}
      </header>
      {itens.length > 1 ? (
        <Segmentado a="folha.linha.item" rotulo={t('folha.linha.itemRot')} valor={item} opcoes={itens.map((x) => ({ v: x, rotulo: nomeItem(x) }))} aoTrocar={(x) => comando('linha.ordem', { predio: p.ref, linha: i, item: x, n: lote, auto: true })} />
      ) : null}
      <div class="fl-linha-lote">
        <span class="fl-par-rot">{t('folha.linha.lote')}</span>
        <Quantidade a="folha.lote" valor={lote} rotulo={t('folha.linha.lote')} min={REGRAS_DONO.lote.min} max={REGRAS_DONO.lote.max} aoMudar={(v) => { setLote(v); ordem({ n: v }); }} />
        <Interruptor a="folha.auto" k={i} rotulo={t('folha.linha.auto')} ligado={l.ativa ? !!l.auto : false} aoTrocar={(v) => ordem({ auto: v })} />
      </div>
      {l.rodando ? (
        <Barra valor={l.progresso ?? 0} estado="ch" rotulo={t('folha.linha.progresso')} texto={faltam !== null ? `${fmt.contagem(faltam, mult)}${mult ? '' : ` ${t('folha.linha.em1x')}`}` : fmt.pct(l.progresso ?? 0)} />
      ) : l.parada ? (
        <p class="fl-nota tx-al">
          <Glifo n="alerta" tam={14} /> {motivoParada(l.parada)}
        </p>
      ) : !l.ativa ? (
        <p class="fl-nota">{t('folha.linha.parada')}</p>
      ) : null}
      {l.sugestaoLote ? (
        <Chip a="folha.sugestao" k={i} glifo="lote" estado="ac" texto={t('folha.linha.sugestao', { n: l.sugestaoLote })} titulo={t('folha.linha.sugestaoRot', { n: l.sugestaoLote })} onClick={() => { setLote(l.sugestaoLote); ordem({ n: l.sugestaoLote }); }} />
      ) : null}
      <Cadeia ui={ui} item={item} />
      {l.rodando ? (
        <div class="fl-tempo" role="group" aria-label={t('folha.tempo')}>
          <span class="fl-par-rot">{t('folha.tempo')}</span>
          {Object.entries(COMPRA_TEMPO ?? {}).map(([min, preco]) => (
            <Botao a="folha.tempo" k={min} rotulo={t('folha.tempoRot', { min, preco: fmt.dinheiro(preco) })} class="bt-sec fl-tempo-bt" onClick={() => comando('acelerar', { alvo: { predio: p.ref, linha: i }, minutos: +min })}>
              <span class="num">{t('folha.tempoMin', { min })}</span>
              <small class="num">{fmt.dinheiro(preco)}</small>
            </Botao>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function Predio({ p }) {
  const h = p.holding;
  const prox = h.proximoNivel;
  const prod = h.produtividade ?? 0;
  return (
    <>
      <Bloco titulo={t('folha.nivel')}>
        <Barra valor={(h.nivel ?? 1) / (h.nivelMax ?? 3)} estado="ch" rotulo={t('folha.nivelHolding', { n: h.nivel ?? 1, max: h.nivelMax ?? 3 })} texto={t('folha.nivelHolding', { n: h.nivel ?? 1, max: h.nivelMax ?? 3 })} />
        {prox ? (
          <>
            <p class="fl-nota">
              {t('folha.nivelPede', {
                custo: fmt.dinheiro(prox.custo),
                materiais: Object.entries(prox.materiais ?? {}).map(([k, n]) => `${fmt.numero(n)} ${nomeItem(k).toLowerCase()}`).join(', '),
                marco: prox.marco,
              })}
            </p>
            <Botao a="folha.subirNivel" rotulo={t('folha.subirNivel', { n: (h.nivel ?? 1) + 1 })} class="bt-ch" onClick={() => comando('predio.nivel', { ref: p.ref })}>
              {t('folha.subirNivel', { n: (h.nivel ?? 1) + 1 })}
            </Botao>
          </>
        ) : (
          <p class="fl-nota">{t('folha.nivelMaxHolding')}</p>
        )}
      </Bloco>
      <Bloco titulo={t('folha.resumo')}>
        <Par k="produtividade" rotulo={t('cartao.produtividade')} valor={fmt.pct(prod)} estado={prod < 0.5 ? 'er' : prod < 0.8 ? 'al' : null} glifo={prod < 0.8 ? 'alerta' : null} />
        {Number.isFinite(h.distArmazem) ? <Par k="armazem" rotulo={t('folha.distArmazem')} valor={t('cartao.via.m', { m: fmt.numero(Math.round(h.distArmazem)) })} /> : null}
      </Bloco>
      <Trabalho w={{ vagas: h.vagas, ocupadas: h.ocupadas }} />
    </>
  );
}

export function SecaoEmpresa({ ui, sel, p, aba }) {
  const h = p?.holding;
  if (!h) return null;
  if (aba === 'predio') return <Predio p={p} />;
  const tempo = ui.obterSim()?.espelho?.tempo;
  const linhas = h.linhas ?? [];
  return (
    <>
      <Avisos ui={ui} p={p} sel={sel} />
      <Obra p={p} />
      {p.faz ? <p class="fl-texto">{p.faz}</p> : null}
      {linhas.length ? (
        // a chave do prédio e da linha: ir ao fornecedor (Voltar) não leva o lote escolhido de um prédio para o outro
        linhas.map((l, i) => <Linha key={`${p.ref}:${i}`} ui={ui} p={p} l={l} i={i} mult={tempo?.mult ?? 0} tique={tempo?.tique ?? 0} />)
      ) : (
        <p class="fl-nota">{t('folha.semLinhas')}</p>
      )}
    </>
  );
}
SecaoEmpresa.abas = () => [
  { id: 'producao', rotulo: t('folha.aba.producao') },
  { id: 'predio', rotulo: t('folha.aba.predio') },
];

export function registrar(ui) {
  ui.registrarSecao('empresa', SecaoEmpresa, { ordem: 50 });
}
