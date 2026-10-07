// Corpo da tela Holding (desenho da UI 8.13; D25, D47, D48, D55, D57), sob demanda. Todo dinheiro em dólar (D87).
//   Visão geral: valor da Holding em destaque, caixa, dívida e lucro por hora; o caixa dos últimos 12 meses; Influência
//     e Legado em dois medidores de 0 a 100 com o efeito escrito (nunca num gráfico de dois eixos); quem é o jogador.
//   Produção: tabela por item (estoque, produz/h, consome/h e a demanda da cidade por hora, D48), as linhas de cada
//     prédio com o lote de 1 a 10, Auto e a sugestão (D57), a frota e o armazém (D47).
//   Mercado: o Depósito (venda a 150% do preço base, "37 de 100 vendas nesta janela · renova em mm:ss"), importação a
//     160%, vender à cidade e "Abastecer a cidade por importação" (D48).
//   Imóveis: os prédios da Holding, com um toque para ver no mapa.
import { useState, useEffect } from 'preact/hooks';
import { barra, selecao } from '../../loja.js';
import { consultar } from '../../consultas.js';
import { comando, frase } from '../../acoes.js';
import * as fmt from '../../formato.js';
import { t } from '../../textos.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Indicador } from '../../comp/Indicador.jsx';
import { Grafico } from '../../comp/Grafico.jsx';
import { Tabela } from '../../comp/Tabela.jsx';
import { Quantidade } from '../../comp/Quantidade.jsx';
import { Interruptor } from '../../comp/Interruptor.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Linha } from '../../comp/Linha.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Chip } from '../../comp/Chip.jsx';
import { Medidor } from './comum.jsx';
import { tomarAba } from '../../hud/Menu.jsx';
import { nomeItem, nomePredioHolding, motivoParada } from '../../selecao/secoes/empresa.jsx';
import { manterFolha } from '../../selecao/Cartao.jsx';
import { REGRAS_DONO } from '../../../data/economia.js';

const porHora = (n) => `${fmt.numero(Math.round(n ?? 0))}${t('unid.porHora')}`;

/** Itens que a tabela mostra: os liberados e os que têm algum número (um item trancado com estoque aparece). */
export const itensVisiveis = (itens) => (itens ?? []).filter((x) => x.liberado !== false || x.estoque > 0 || x.produzHora > 0 || x.cidadeHora > 0);

/** Janela do Depósito: "37 de 100 vendas nesta janela" e quanto falta para renovar (mm:ss reais na velocidade). */
export function janelaDeposito(dep, tique, mult) {
  const j = dep?.janela ?? {};
  const max = j.max ?? REGRAS_DONO.deposito.vendasPorJanela; // null: sem limite (D103)
  const semLimite = max == null;
  return { vendidas: j.vendidas ?? 0, max, semLimite, resta: semLimite ? Infinity : Math.max(0, max - (j.vendidas ?? 0)), renova: fmt.contagem(Math.max(0, (j.fimTique ?? 0) - tique), mult) };
}

// ------------------------------------------------------------------------------------------ visão geral

function Geral({ b }) {
  const h = consultar('holding') ?? {};
  const orc = consultar('orcamento');
  const serie = Array.isArray(orc?.serie) ? orc.serie.slice(-12) : [];
  const ef = h.efeitos ?? {};
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <div class="eco-destaque">
          <span class="rot">{t('hold.valor')}</span>
          <span class="eco-saldo num tx-ch">
            <Glifo n="valuation" tam={22} />
            {fmt.dinheiro(h.valuation ?? b.valuation)}
          </span>
          <span class="eco-saldo-conta">{t('hold.quem', { nome: h.nome ?? t('barra.holding.padrao'), jogador: h.jogador ?? t('hold.jogador') })}</span>
        </div>
        <div class="eco-indicadores">
          <Indicador rotulo={t('eco.caixa')} valor={fmt.dinheiro(b.creditos)} glifo="creditos" estado={b.creditos <= 0 ? 'er' : 'ch'} />
          <Indicador rotulo={t('eco.divida')} valor={fmt.dinheiro(b.divida)} glifo="contrato" />
          <Indicador rotulo={t('hold.lucro')} valor={fmt.dinheiroHora(b.saldoHora)} glifo="renda" estado={b.saldoHora < 0 ? 'al' : null} dica={fmt.dicaHora()} />
        </div>
        {serie.length > 1 ? (
          <Grafico titulo={t('eco.graficoCaixa')} series={[{ id: 'caixa', rotulo: t('eco.caixa'), cor: 'var(--g1)', valores: serie.map((p) => p.caixa) }]} rotulos={serie.map((p) => (p.ano ? fmt.dataCalendario(p) : fmt.mesCurto(p.mes)))} formato={fmt.dinheiro} tipo="area" altura={96} a="hold.grafico" />
        ) : null}
      </div>
      <div class="gest-col">
        <Secao titulo={t('hold.medidores')}>
          <div class="medidores">
            <Medidor glifo="influencia" rotulo={t('hold.influencia')} valor={h.influencia} efeito={t('hold.influencia.efeito', { pct: fmt.numero((ef.descontoLadrilho ?? 0) * 100, 1) })} />
            <Medidor glifo="legado" rotulo={t('hold.legado')} valor={h.legado} efeito={t('hold.legado.efeito', { v: fmt.numero(ef.atratividade ?? 0, 1) })} />
          </div>
          <p class="eco-nota">{t('hold.medidores.nota')}</p>
        </Secao>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ produção

function LinhaCompacta({ predio, l, i, tique, mult }) {
  const [lote, setLote] = useState(l.n > 0 ? l.n : REGRAS_DONO.lote.max);
  // a ordem mudada em outro lugar (a folha do prédio, o Auto) vale aqui também
  useEffect(() => {
    if (l.n > 0) setLote(l.n);
  }, [l.n]);
  const item = l.item;
  const ordem = (m) => comando('linha.ordem', { predio, linha: i, item, n: lote, auto: l.ativa ? l.auto : true, ...m });
  const faltam = l.rodando && Number.isFinite(l.fimTique) ? fmt.contagem(l.fimTique - tique, mult) : null;
  return (
    <div class="hold-linha" data-k={`${predio}-${i}`}>
      <span class="hold-linha-item">{item ? nomeItem(item) : t('hold.semItem')}</span>
      {item ? (
        <>
          <Quantidade a="hold.lote" valor={lote} rotulo={t('folha.linha.lote')} min={REGRAS_DONO.lote.min} max={REGRAS_DONO.lote.max} aoMudar={(v) => { setLote(v); ordem({ n: v }); }} />
          <Interruptor a="hold.auto" k={`${predio}-${i}`} rotulo={t('folha.linha.auto')} ligado={l.ativa ? !!l.auto : false} aoTrocar={(v) => ordem({ auto: v })} />
        </>
      ) : null}
      <span class="hold-linha-estado">
        {l.rodando ? (
          <Barra valor={l.progresso ?? 0} estado="ch" rotulo={t('folha.linha.progresso')} texto={faltam} />
        ) : l.parada ? (
          <span class="tx-al">
            <Glifo n="alerta" tam={14} /> {motivoParada(l.parada)}
          </span>
        ) : (
          <span class="tx-2">{t('folha.linha.parada')}</span>
        )}
        {l.sugestaoLote ? <Chip a="hold.sugestao" k={`${predio}-${i}`} glifo="lote" estado="ac" texto={t('folha.linha.sugestao', { n: l.sugestaoLote })} onClick={() => { setLote(l.sugestaoLote); ordem({ n: l.sugestaoLote }); }} /> : null}
      </span>
    </div>
  );
}

function Producao({ tique, mult }) {
  const prod = consultar('producao');
  if (!prod) return <Vazio glifo="material" texto={t('hold.semDados')} />;
  const itens = itensVisiveis(prod.itens);
  const fr = prod.frota ?? {};
  // a tabela pede a coluna larga: a demanda da cidade por hora (D48) não pode ficar fora da tela no celular
  return (
    <div class="gest-colunas gest-tabela">
      <div class="gest-col">
        <Secao titulo={t('hold.itens')}>
          <Tabela
            a="hold.itens"
            rotulo={t('hold.itens')}
            chave={(x) => x.item}
            colunas={[
              { id: 'nome', rotulo: t('hold.col.item') },
              { id: 'estoque', rotulo: t('hold.col.estoque'), num: true, formato: (v) => fmt.numero(v) },
              { id: 'produzHora', rotulo: t('hold.col.produz'), num: true, formato: porHora },
              { id: 'consomeHora', rotulo: t('hold.col.consome'), num: true, formato: porHora },
              { id: 'cidadeHora', rotulo: t('hold.col.cidade'), num: true, formato: porHora, estado: (v, l) => (v > l.produzHora && v > l.estoque ? 'al' : null) },
            ]}
            linhas={itens.map((x) => ({ ...x, nome: nomeItem(x.item) }))}
            vazio={<Vazio glifo="material" texto={t('hold.semItens')} />}
          />
          <p class="eco-nota">{t('hold.cidadeNota')}</p>
        </Secao>
        <Secao titulo={t('hold.logistica')}>
          <div class="eco-indicadores">
            <Indicador rotulo={t('hold.frota')} valor={t('cartao.deN', { a: fmt.numero(fr.usados ?? 0), b: fmt.numero(fr.total ?? 0) })} glifo="caminhao" />
            <Indicador rotulo={t('hold.fila')} valor={fmt.numero(fr.fila ?? 0)} estado={(fr.fila ?? 0) > 0 ? 'al' : null} glifo={(fr.fila ?? 0) > 0 ? 'alerta' : null} />
            {prod.armazem ? <Indicador rotulo={t('hold.armazem')} valor={t('cartao.deN', { a: fmt.numero(prod.armazem.usado ?? 0), b: fmt.numero(prod.armazem.capacidade ?? 0) })} glifo="deposito" /> : null}
          </div>
          {fr.atrasoMedio > 0 ? <p class="eco-nota">{t('hold.atraso', { t: fmt.minutosDeJogo(fr.atrasoMedio) })}</p> : null}
        </Secao>
      </div>
      <div class="gest-col">
        <Secao titulo={t('hold.linhas')}>
          {(prod.predios ?? []).length ? (
            prod.predios.map((p) => (
              <div class="hold-predio" key={p.ref} data-k={p.ref}>
                <span class="hold-predio-nome">
                  {nomePredioHolding(p.tipo)}
                  <small class="tx-2">{t('hold.nivel', { n: p.nivel ?? 1 })}</small>
                </span>
                {(p.linhas ?? []).map((l, i) => (
                  <LinhaCompacta key={`${p.ref}:${i}`} predio={p.ref} l={l} i={i} tique={tique} mult={mult} />
                ))}
              </div>
            ))
          ) : (
            <Vazio glifo="empresas" texto={t('hold.semPredios')} />
          )}
        </Secao>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ mercado

/** Quantos o toque vende: o pedido, preso ao estoque e ao que resta na janela (ao menos 1, para a recusa explicar). */
export const vendaPossivel = (n, estoque, resta) => Math.max(1, Math.min(n, Math.floor(estoque ?? 0), resta ?? 0));

function ItemMercado({ x, resta, setRetorno }) {
  // a quantidade vale para importar (até 100 por toque, sem depender do estoque nem da janela); a venda usa o que dá
  const [n, setN] = useState(10);
  const v = vendaPossivel(n, x.estoque, resta);
  const agir = async (nome, args, ok) => {
    const r = await comando(nome, args, { silencioso: true });
    setRetorno(r.ok ? { ok: true, texto: ok } : { ok: false, texto: frase(r) });
  };
  return (
    <div class="merc-item" data-k={x.item}>
      <div class="merc-cab">
        <span class="merc-nome">{nomeItem(x.item)}</span>
        <span class="merc-estoque num">{t('hold.estoqueN', { n: fmt.numero(x.estoque ?? 0) })}</span>
      </div>
      <div class="merc-precos num">
        <span>{t('hold.venda', { v: fmt.dinheiro(x.precoVenda ?? (x.precoBase ?? 0) * REGRAS_DONO.deposito.venda) })}</span>
        {Number.isFinite(x.precoImportacao) ? <span>{t('hold.importa', { v: fmt.dinheiro(x.precoImportacao) })}</span> : null}
      </div>
      <div class="merc-acoes">
        <Quantidade a="merc.n" valor={n} rotulo={t('hold.quantidade')} min={1} max={100} aoMudar={setN} />
        <Botao a="merc.vender" k={x.item} rotulo={t('hold.vender', { n: v })} class="bt-ch" aria-disabled={!(x.estoque > 0) || !resta ? 'true' : undefined} onClick={() => agir('deposito.vender', { item: x.item, n: v }, t('hold.vendido', { n: v, item: nomeItem(x.item).toLowerCase(), v: fmt.dinheiro(v * (x.precoVenda ?? 0)) }))}>
          {t('hold.vender', { n: v })}
        </Botao>
        <Botao a="merc.importar" k={x.item} rotulo={t('hold.importar', { n })} class="bt-sec" onClick={() => agir('importar', { item: x.item, n }, t('hold.importado', { n, item: nomeItem(x.item).toLowerCase() }))}>
          {t('hold.importar', { n })}
        </Botao>
      </div>
      <Interruptor a="merc.cidade" k={x.item} rotulo={t('hold.vendeCidade')} ligado={x.vendeCidade !== false} aoTrocar={(s) => comando('estoque.vendeCidade', { item: x.item, sim: s })} />
    </div>
  );
}

function Mercado({ tique, mult }) {
  const [retorno, setRetorno] = useState(null);
  useEffect(() => {
    if (!retorno) return undefined;
    const id = setTimeout(() => setRetorno(null), 4000);
    return () => clearTimeout(id);
  }, [retorno]);
  const dep = consultar('deposito');
  if (!dep) return <Vazio glifo="deposito" texto={t('hold.semDados')} />;
  const j = janelaDeposito(dep, tique, mult);
  const itens = itensVisiveis(dep.itens);
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <Secao titulo={t('hold.deposito')}>
          {j.semLimite
            ? <p class="eco-nota">{t('hold.semLimite', { n: fmt.numero(j.vendidas) })}</p>
            : <Barra valor={j.vendidas / j.max} estado={j.resta ? 'ch' : 'al'} rotulo={t('hold.janela', { a: j.vendidas, b: j.max })} texto={t('hold.janela', { a: fmt.numero(j.vendidas), b: fmt.numero(j.max) })} />}
          {!j.semLimite && <p class="eco-nota" data-dica="hora">{t('hold.renova', { t: j.renova })}</p>}
          <p class="eco-nota">{t('hold.regraDeposito')}</p>
        </Secao>
        <Secao titulo={t('hold.abastecer')}>
          <Interruptor a="merc.importarAuto" rotulo={t('hold.abastecerRot')} ligado={dep.importarAuto !== false} aoTrocar={(s) => comando('cidade.importarAuto', { sim: s })} />
          <p class="eco-nota">{t('hold.abastecerNota')}</p>
        </Secao>
        {retorno ? (
          <p class={`eco-retorno ${retorno.ok ? 'tx-ok' : 'tx-al'}`} role="status">
            <Glifo n={retorno.ok ? 'check' : 'alerta'} tam={16} />
            {retorno.texto}
          </p>
        ) : null}
      </div>
      <div class="gest-col">
        <Secao titulo={t('hold.itens')}>
          {itens.length ? itens.map((x) => <ItemMercado key={x.item} x={x} resta={j.resta} setRetorno={setRetorno} />) : <Vazio glifo="deposito" texto={t('hold.semItens')} />}
        </Secao>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ imóveis

function Imoveis({ ui, fechar }) {
  const prod = consultar('producao');
  const P = ui.obterSim()?.espelho?.predios;
  const l = prod?.predios ?? [];
  if (!l.length) return <Vazio glifo="empresas" texto={t('hold.semPredios')} />;
  const ver = (p) => {
    const i = p.ref % 2 ** 20;
    const ponto = P && i < P.n ? [P.x[i], P.y?.[i] ?? 0, P.z[i]] : null;
    fechar();
    manterFolha.proxima = true;
    selecao.value = { tipo: 'predio', ref: p.ref, idx: i, ponto };
    ui.R?.selecionado?.({ tipo: 'predio', ref: p.ref });
    if (ponto) ui.R?.camera?.irPara?.({ x: ponto[0], z: ponto[2], dist: 260 }, 900);
  };
  return (
    <Secao titulo={t('hold.imoveis')}>
      {l.map((p) => {
        const ativas = (p.linhas ?? []).filter((x) => x.rodando || x.ativa).length;
        return (
          <Linha a="hold.imovel" k={p.ref} glifo="empresas" cor="var(--ch)" titulo={nomePredioHolding(p.tipo)} sub={t('hold.imovelSub', { n: p.nivel ?? 1, a: ativas, b: (p.linhas ?? []).length })} valor={Number.isFinite(p.produtividade) ? fmt.pct(p.produtividade) : null} onClick={() => ver(p)} />
        );
      })}
    </Secao>
  );
}

// ------------------------------------------------------------------------------------------ tela

export default function Holding({ ui, fechar }) {
  const [aba, setAba] = useState(() => tomarAba('holding', 'geral'));
  const b = barra.value; // relê com a barra (4 vezes por segundo)
  const tempo = ui.obterSim()?.espelho?.tempo;
  const tique = tempo?.tique ?? 0;
  const mult = tempo?.mult ?? 0;
  const abas = ['geral', 'producao', 'mercado', 'imoveis'].map((id) => ({ id, rotulo: t(`hold.aba.${id}`) }));
  return (
    <Tela id="holding" glifo="holding" titulo={t('hold.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {aba === 'geral' ? <Geral b={b} /> : aba === 'producao' ? <Producao tique={tique} mult={mult} /> : aba === 'mercado' ? <Mercado tique={tique} mult={mult} /> : <Imoveis ui={ui} fechar={fechar} />}
    </Tela>
  );
}
