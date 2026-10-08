// Corpo do Livro da Arcologia (D26, D49, D67, D88 a D90; dona: X1b), sob demanda.
//   Ato 1: o progresso do Ato 1, o investido, as alturas da obra do par e a Dream Bridge; cada etapa com o estado, a
//     data no calendário (começou, previsão, pronta), a fase, os materiais no canteiro, a caminho e no estoque, a obra
//     parada (material ou caixa), o que ela entrega (D49) e as ações: começar, importar o que falta e ver no mapa.
//   A sede: o Park of Future Dreams parte a parte, com o nome em inglês, o que cada uma é, se está construída, em obra
//     ou em fantasma, e o que vem depois do Ato 1 com o prazo da história (D89: jun. 2026 e 2032).
import { useState } from 'preact/hooks';
import { barra } from '../../loja.js';
import { consultar } from '../../consultas.js';
import * as fmt from '../../formato.js';
import { t, temTexto } from '../../textos.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Indicador } from '../../comp/Indicador.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Chip } from '../../comp/Chip.jsx';
import { Linha } from '../../comp/Linha.jsx';
import { Aviso } from '../../comp/Aviso.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { EnvioMateriais } from '../EnvioMateriais.jsx';
import { ImportarItem } from '../../comp/ImportarItem.jsx';
import { comando } from '../../acoes.js';
import { nomeItem } from '../../selecao/secoes/empresa.jsx';
import { tomarAba } from '../../hud/Menu.jsx';
import {
  nomeParte, nomeEtapa, nomeTrecho, fraseEfeito, glifoEfeito, fraseRecusa, fraseParalelo, faltaImportar, custoImportar, alvoDaParte,
  iniciarEtapa, importarFalta, importando, verNoMapa,
} from '../LivroArcologia.jsx';

const ESTADO_CHIP = { 0: 'ac', 1: 'ch', 2: 'al', 3: 'ok' };
const GLIFO_ESTADO = { 0: 'cadeado', 1: 'construir', 2: 'obra', 3: 'check' };
const data = (d) => (d ? fmt.dataCalendario(d) : '');
const item = (id) => (temTexto(`s3.item.${id}`) ? t(`s3.item.${id}`) : id);

/** Materiais da etapa: entregue de pedido, com o que está a caminho e no estoque. */
function Materiais({ e }) {
  return (
    <div class="fl-bloco">
      {(e.materiais ?? []).map((m) => (
        <div class="fl-par fl-par-barra" data-k={m.item}>
          <span class="fl-par-rot">{item(m.item)}</span>
          <Barra
            valor={m.pede ? (m.entregue ?? 0) / m.pede : 0}
            estado={(m.entregue ?? 0) >= m.pede ? 'ok' : 'ch'}
            rotulo={item(m.item)}
            texto={t('x1.material', { entregue: fmt.numero(m.entregue ?? 0), pede: fmt.numero(m.pede) })}
          />
          {e.estado === 2 || e.estado === 1 ? (
            <span class="linha-sub">{t('x1.material.sub', { caminho: fmt.numero(m.aCaminho ?? 0), estoque: fmt.numero(m.estoque ?? 0) })}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** O que a etapa entrega (D49), em chips. */
function Entrega({ e }) {
  const l = (e.efeitos ?? []).map((ef) => ({ tipo: ef.tipo, texto: fraseEfeito(ef) })).filter((x) => x.texto);
  if (!l.length) return null;
  return (
    <div class="trilha-libera" aria-label={t('x1.entrega')}>
      {l.map((x) => (
        <Chip glifo={glifoEfeito(x.tipo)} texto={x.texto} estado={e.estado === 3 ? 'ok' : null} />
      ))}
    </div>
  );
}

/** Uma etapa do Ato 1. */
function Etapa({ ui, e, n, de, parte, etapas, caixa, dep }) {
  const recusa = fraseRecusa(e, etapas, caixa);
  const paralelo = fraseParalelo(e, etapas);
  const falta = e.estado === 1 || e.estado === 2 ? faltaImportar(e, importando(dep)) : [];
  const custoFalta = custoImportar(falta, dep);
  const fases = e.fases ?? [];
  const nomeFase = fases[e.fase] && temTexto(`x1.fase.${fases[e.fase]}`) ? t(`x1.fase.${fases[e.fase]}`) : '';
  return (
    <Secao
      titulo={`${nomeParte(parte)} · ${t('x1.etapaN', { n, de })}`}
      acao={<Chip glifo={GLIFO_ESTADO[e.estado] ?? 'info'} texto={t(`x1.estado.${e.estado ?? 0}`)} estado={ESTADO_CHIP[e.estado] ?? null} />}
      class="livro-etapa"
    >
      <Linha glifo="arcologia" cor="var(--ch)" titulo={nomeEtapa(e)} sub={recusa ?? (e.estado === 3 && e.fim ? t('x1.data.fim', { data: data(e.fim) }) : e.estado === 2 && e.ini ? t('x1.data.inicio', { data: data(e.ini) }) : null)} />
      {paralelo ? <Chip glifo="obra" texto={paralelo} estado={e.estado === 2 ? 'ch' : 'ok'} class="livro-paralelo" /> : null}
      {e.estado === 2 ? (
        <>
          <Barra valor={e.progresso ?? 0} estado="ch" rotulo={nomeEtapa(e)} texto={`${t('x1.fase', { n: (e.fase ?? 0) + 1, de: fases.length || 4, nome: nomeFase })} · ${fmt.pct(e.progresso ?? 0)}`} />
          {e.parada ? <Aviso gravidade="atencao" glifo={e.parada === 'caixa' ? 'semCreditos' : 'semMaterial'} texto={t(`x1.parada.${e.parada}`)} a="livro.parada" k={e.id} /> : null}
          {e.previsao ? <p class="fl-nota">{t('x1.data.previsao', { data: data(e.previsao) })}</p> : null}
        </>
      ) : null}
      {e.estado !== 3 ? (
        <div class="fl-bloco">
          <div class="fl-par" data-k="custo">
            <span class="fl-par-rot">{t('x1.custo')}</span>
            <span class="fl-par-valor num">{fmt.dinheiro(e.creditos ?? 0)}</span>
          </div>
          <div class="fl-par" data-k="duracao">
            <span class="fl-par-rot">{t('x1.duracao')}</span>
            <span class="fl-par-valor num">{t('x1.duracao.valor', { n: fmt.numero(e.minutos ?? 0) })}</span>
          </div>
        </div>
      ) : null}
      {e.estado === 1 || e.estado === 2 ? <Materiais e={e} /> : null}
      <EnvioMateriais e={e} />
      <Entrega e={e} />
      <div class="eco-acoes">
        {e.estado === 1 ? (
          <Botao a="livro.iniciar" k={e.id} rotulo={t('x1.iniciar', { v: fmt.dinheiro(e.creditos ?? 0) })} principal class="bt-pri" desligado={caixa < (e.creditos ?? 0) || e.recusa === 'ocupado'} onClick={() => iniciarEtapa(e.id)}>
            <Glifo n="construir" tam={18} />
            {t('x1.iniciar', { v: fmt.dinheiro(e.creditos ?? 0) })}
          </Botao>
        ) : null}
        {falta.length ? (
          <Botao a="livro.importar" k={e.id} rotulo={t('x1.importar', { v: fmt.dinheiro(custoFalta) })} class="bt-sec" dica={t('x1.importar.nota')} onClick={() => importarFalta(e, consultar('deposito'))}>
            <Glifo n="importar" tam={18} />
            {t('x1.importar', { v: fmt.dinheiro(custoFalta) })}
          </Botao>
        ) : null}
        {e.estado >= 2 ? (
          <Botao a="livro.ver" k={e.id} rotulo={t('x1.ver')} class="bt-sec" onClick={() => verNoMapa(ui, alvoDaParte(parte))}>
            <Glifo n="localizar" tam={18} />
            {t('x1.ver')}
          </Botao>
        ) : null}
      </div>
      {/* importar qualquer quantidade (1 a 1000) de qualquer material da etapa, mesmo o que o estoque já cobre */}
      {(e.estado === 1 || e.estado === 2 ? (e.materiais ?? []) : []).map((m) => ({ item: m.item, n: falta.find((f) => f.item === m.item)?.n ?? 0 })).map((x) => (
        <ImportarItem
          key={`${e.id}:${x.item}`}
          item={x.item}
          nome={nomeItem(x.item)}
          falta={x.n}
          preco={dep?.itens?.find((i) => i.item === x.item)?.precoImportacao}
          prazoTiques={dep?.entregaTiques}
          aoImportar={(n) => comando('importar', { item: x.item, n })}
        />
      ))}
    </Secao>
  );
}

/** Aba do Ato 1: o resumo à esquerda e as etapas à direita. */
function Ato1({ ui, a, caixa, dep }) {
  const etapas = (a.partes ?? []).flatMap((p) => (p.etapas ?? []).map((e) => ({ ...e, parte: p.id })));
  // na ordem da cadeia: o lago antes do par
  etapas.sort((x, y) => (x.parte === 'lago' ? -1 : 0) - (y.parte === 'lago' ? -1 : 0));
  const porParte = (id) => etapas.filter((e) => e.parte === id);
  const al = a.alturas;
  const ef = a.efeitos ?? {};
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <Indicador rotulo={t('x1.sede')} valor={fmt.pct(a.progressoTotal ?? 0)} sub={t('x1.total', { n: etapas.filter((e) => e.estado === 3).length, de: etapas.length })} glifo="arcologia" grande />
        <Barra valor={a.progressoTotal ?? 0} estado={a.inaugurada ? 'ok' : 'ch'} rotulo={t('x1.sede')} />
        {a.equipes ? <Indicador rotulo={t('ux1.livro.equipes')} valor={t('ux1.livro.equipes.valor', { n: a.equipes.ocupadas, de: a.equipes.total })} sub={t('ux1.livro.equipes.sub')} glifo="obra" /> : null}
        {Number.isFinite(a.valor) ? <Indicador rotulo={t('x1.investido')} valor={fmt.dinheiro(a.valor)} sub={t('x1.investido.sub')} glifo="valuation" /> : null}
        {al ? (
          <Indicador rotulo={t('x1.alturas')} valor={t('x1.alturas.valor', { b: fmt.numero(al.blade), l: fmt.numero(al.legacy) })} sub={al.ponte ? t('x1.ponte.pronta') : t('x1.ponte.espera')} glifo="nivel" />
        ) : null}
        {ef.contribuicaoLuxoHora > 0 ? <Indicador rotulo={t('x1.luxo')} valor={fmt.dinheiroHora(ef.contribuicaoLuxoHora)} dica={fmt.dicaHora()} glifo="renda" estado="ch" /> : null}
        {a.inaugurada ? (
          <>
            <Chip glifo="check" texto={t('x1.inaugurada')} estado="ok" />
            <p class="fl-nota">{t('x1.inaugurada.nota')}</p>
          </>
        ) : null}
      </div>
      <div class="gest-col">
        {['lago', 'torre'].flatMap((id) => porParte(id).map((e, k, l) => <Etapa ui={ui} e={e} n={k + 1} de={l.length} parte={id} etapas={etapas} caixa={caixa} dep={dep} />))}
      </div>
    </div>
  );
}

/** Estado de uma parte no mapa: construída, em obra ou em fantasma. */
function estadoDaParte(p) {
  const l = p.etapas ?? [];
  if (l.length && l.every((e) => e.estado === 3)) return 'pronta';
  if (l.some((e) => e.estado >= 2)) return 'obra';
  return 'fantasma';
}

/** O que vem depois do Ato 1, pelo prazo da história e na ordem das partes. */
function futurasEmOrdem(a) {
  const l = (a.partes ?? []).flatMap((p, i) => (p.futuras ?? []).map((f, k) => ({ f, p, ordem: i * 100 + k })));
  const quando = (f) => (f.prazo?.ano ?? 0) * 12 + (f.prazo?.mes ?? 0);
  return l.sort((x, y) => quando(x.f) - quando(y.f) || x.ordem - y.ordem);
}

/** Aba da sede: o Park of Future Dreams parte a parte e o que vem depois do Ato 1. */
function Sede({ ui, a }) {
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <Indicador rotulo={t('x1.sede.sub')} valor={t('x1.sede')} glifo="arcologia" />
        {(a.partes ?? []).map((p) => {
          const est = estadoDaParte(p);
          return (
            <Linha
              glifo={est === 'pronta' ? 'check' : est === 'obra' ? 'obra' : 'arcologia'}
              cor={est === 'fantasma' ? null : 'var(--ch)'}
              titulo={nomeParte(p.id)}
              sub={`${t(`x1.faz.${p.id}`)} ${t(`x1.estadoParte.${est}`)}.`}
              a="livro.parte"
              k={p.id}
              onClick={() => verNoMapa(ui, alvoDaParte(p.id))}
            />
          );
        })}
      </div>
      <div class="gest-col">
        <Secao titulo={t('x1.futuras')}>
          <p class="fl-nota">{t('x1.futuras.nota')}</p>
          {futurasEmOrdem(a).map(({ f, p }) => {
            const trecho = f.id.startsWith('horizon.') ? f.id.split('.').slice(0, 2).join('.') : null;
            const nome = trecho ? nomeTrecho(trecho) ?? nomeParte(p.id) : `${nomeParte(p.id)} · ${f.nome}`;
            return (
              <div class="fl-par" data-k={f.id}>
                <span class="fl-par-rot">{nome}</span>
                <span class="fl-par-valor num">{data(f.prazo)}</span>
              </div>
            );
          })}
        </Secao>
      </div>
    </div>
  );
}

export default function LivroArcologia({ ui, fechar }) {
  const [aba, setAba] = useState(() => tomarAba('arcologia', 'etapas'));
  const b = barra.value; // relê com a barra (a simulação anda)
  const a = consultar('arcologia');
  const dep = consultar('deposito'); // as importações a caminho e o preço de importação de agora
  const abas = ['etapas', 'sede'].map((id) => ({ id, rotulo: t(`x1.aba.${id}`) }));
  const caixa = Number.isFinite(b?.creditos) ? b.creditos : Infinity;
  return (
    <Tela id="arcologia" glifo="arcologia" titulo={t('x1.livro.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {!a ? <Vazio glifo="arcologia" texto={t('prog.semArcologia')} /> : aba === 'sede' ? <Sede ui={ui} a={a} /> : <Ato1 ui={ui} a={a} caixa={caixa} dep={dep} />}
    </Tela>
  );
}
