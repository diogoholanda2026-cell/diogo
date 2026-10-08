// Tela Economia (desenho da UI 8.13; D41, D42, D68, D87 e as regras do dono): o painel de economia do CS2 com a regra
// à vista, todo valor em dólar por ui/formato.js (a simulação manda unidades).
//   Orçamento: saldo por hora de jogo, caixa, dívida e valor da Holding; receitas e despesas por hora com a linha da
//     regra ("Contribuição: 12.480 × US$ 6.600 = US$ 82,4 mi/h" e a faixa do bem-estar), a importação para a cidade
//     (D48); o que ficou sem pagar (D41: o caixa nunca fica negativo, os serviços trabalham na fração paga); o caixa
//     dos últimos 12 meses do calendário (D67).
//   Empréstimo: as regras escritas a partir de REGRAS_DONO (US$ 30 mi por ano, 10% ao ano, dívida até US$ 300 mi,
//     prazo de 10 anos e mora), disponível no ano e dívida com barra, tomar de US$ 600 mil em US$ 600 mil, contratos e
//     pagar ou quitar.
// Lê q.orcamento, q.emprestimo e q.barra; age só por comando() (Promise, D16). abaEconomia abre numa aba (a faixa de
// alerta do "Caixa zerado" abre direto no empréstimo).
import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { barra } from '../loja.js';
import { consultar } from '../consultas.js';
import { comando, frase } from '../acoes.js';
import * as fmt from '../formato.js';
import { t, temTexto } from '../textos.js';
import { Tela, Secao } from '../comp/Tela.jsx';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { Indicador } from '../comp/Indicador.jsx';
import { Barra } from '../comp/Barra.jsx';
import { Deslizante } from '../comp/Deslizante.jsx';
import { DoisToques } from '../comp/DoisToques.jsx';
import { Tabela } from '../comp/Tabela.jsx';
import { Grafico } from '../comp/Grafico.jsx';
import { Dica } from '../comp/Dica.jsx';
import { Vazio } from '../comp/Vazio.jsx';
import { REGRAS_DONO, bemEstarArredondado } from '../../data/economia.js';
import { anoDoTique } from '../../comum/relogio.js';

/** Aba que a tela abre na próxima vez ('orcamento' | 'emprestimo'); quem abre por fora escreve aqui. */
export const abaEconomia = signal('orcamento');

const RECEITAS = [
  ['moradores', 'populacao'],
  ['cidade', 'caminhao'],
  ['deposito', 'deposito'],
  ['marcos', 'marco'],
];
const DESPESAS = [
  ['servicos', 'servicos'],
  ['vias', 'vias'],
  ['ligacao', 'energia'],
  ['salarios', 'trabalho'],
  ['juros', 'juros'],
  ['importacao', 'material'],
  ['importacaoCidade', 'importar'],
];

// ------------------------------------------------------------------------------------------ leitura (puras)

/** Linhas do orçamento por hora de jogo, com a fração de cada uma no seu total (para a barra da linha). */
export function linhasOrcamento(orc) {
  const montar = (lista, fonte, sinal) => {
    const num = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0); // campo que falta ou sem número não estraga o total
    const linhas = lista.map(([id, glifo]) => ({ id, glifo, rotulo: t(`eco.${sinal > 0 ? 'rec' : 'des'}.${id}`), valor: num(fonte?.[id]) }));
    const total = linhas.reduce((s, l) => s + l.valor, 0);
    for (const l of linhas) l.frac = total > 0 ? l.valor / total : 0;
    return { linhas, total };
  };
  const receitas = montar(RECEITAS, orc?.receitas, 1);
  const despesas = montar(DESPESAS, orc?.despesas, -1);
  // só os tipos que têm frase (serviços e salários, D41); outro campo novo da simulação não vira '??chave'
  const naoPago = Object.entries(orc?.naoPago ?? {}).filter(([id, v]) => v > 0 && temTexto(`eco.naoPago.${id}`)).map(([id, valor]) => ({ id, valor }));
  return { receitas, despesas, naoPago };
}

/**
 * A regra do dono na linha da contribuição, em dólar (D68): "Contribuição: 12.480 × US$ 6.600 = US$ 82,4 mi/h" quando
 * a conta fecha com a receita; senão (tarifa por prédio, a pergunta 3), a média por morador.
 */
export function regraContribuicao(pop, tarifa, receita) {
  const produto = Math.round(pop * tarifa);
  if (Math.abs(produto - receita) <= Math.max(1, Math.abs(receita) * 0.01)) {
    return t('eco.regra', { pop: fmt.numero(pop), tarifa: fmt.dinheiro(tarifa), total: fmt.dinheiroPorHora(produto) });
  }
  return t('eco.regraMedia', { media: fmt.dinheiro(pop > 0 ? receita / pop : 0), total: fmt.dinheiroPorHora(receita) });
}

/**
 * Faixa do bem-estar que paga a tarifa atual ([de, ate] da regra do dono). O nome não repete o faixaDaTarifa(bemEstar)
 * de data/economia.js, que parte do bem-estar e devolve outra forma.
 */
export function faixaPelaTarifa(tarifa) {
  const f = REGRAS_DONO.renda.faixas.find(([, , v]) => v === tarifa) ?? REGRAS_DONO.renda.faixas[0];
  return { de: f[0], ate: f[1], tarifa: f[2] };
}

/**
 * Quanto dá para tomar agora: múltiplos do passo, até o disponível no ano e até a dívida máxima (principal mais juros
 * devidos). motivo: 'ano' | 'divida' | null.
 */
export function limitesEmprestimo(emp, regras = REGRAS_DONO.emprestimo) {
  const passo = regras.passo;
  // campo que falta vale o padrão; campo sem número (NaN) vale o lado seguro: nada disponível, dívida no teto
  const n = (v, falta, torto = falta) => (v === null || v === undefined ? falta : Number.isFinite(v) ? v : torto);
  const disponivel = Math.max(0, n(emp?.disponivelAno, 0));
  const folga = Math.max(0, n(emp?.dividaMax, regras.dividaMax) - n(emp?.divida, 0, regras.dividaMax) - n(emp?.jurosDevidos, 0, regras.dividaMax));
  const max = Math.floor(Math.min(disponivel, folga) / passo) * passo;
  const motivo = max >= passo ? null : disponivel < passo ? 'ano' : 'divida';
  return { min: passo, max, passo, motivo };
}

/** Os últimos 12 pontos da série mensal do orçamento (um por mês). */
export const serieDoAno = (serie) => (Array.isArray(serie) ? serie.slice(-12) : []);

/** Taxa por hora sem sinal, para séries que já dizem o que são (receitas, despesas): 'US$ 42 mi/h'. */
const taxa = (v) => fmt.dinheiroPorHora(v);

/** Dinheiro curto para o eixo dos gráficos: 'US$ 90 mi', '−US$ 24 mi'. */
export const curto = (v) => fmt.dinheiro(v);

/** Rótulo de um ponto da série mensal: 'jan. 2020' (o ponto sem ano é da série antiga: só o mês). */
const rotuloMes = (p) => (p?.ano ? fmt.dataCalendario(p) : fmt.mesCurto(p?.mes));

// ------------------------------------------------------------------------------------------ peças

function LinhaValor({ glifo, rotulo, valor, frac = null, sinal = 1, sub = null, sub2 = null, k }) {
  const v = fmt.dinheiroHora(sinal > 0 ? valor : -valor);
  return (
    <div class={`eco-linha${valor ? '' : ' zero'}`} data-k={k} title={fmt.dicaHora()}>
      <span class="eco-linha-glifo">
        <Glifo n={glifo} tam={18} />
      </span>
      <span class="eco-linha-textos">
        <span class="eco-linha-rot">{rotulo}</span>
        {sub ? <span class="eco-linha-sub num">{sub}</span> : null}
        {sub2 ? <span class="eco-linha-sub">{sub2}</span> : null}
        {frac !== null ? (
          <span class={`eco-linha-barra ${sinal > 0 ? 'rec' : 'des'}`} aria-hidden="true">
            <i style={{ transform: `scaleX(${frac})` }} />
          </span>
        ) : null}
      </span>
      <span class="eco-linha-valor num" data-dica="hora">
        {v}
      </span>
    </div>
  );
}

function Orcamento({ orc, b }) {
  if (!orc) return <Vazio glifo="dinheiro" texto={t('eco.semDados')} />;
  const { receitas, despesas, naoPago } = linhasOrcamento(orc);
  const saldo = orc.saldoHora ?? receitas.total - despesas.total;
  const faixa = faixaPelaTarifa(b.tarifa);
  // o caixa e o fluxo dos últimos 12 meses (a série da simulação guarda até 20 anos)
  const serie = serieDoAno(orc.serie);
  return (
    <div class="eco-colunas">
      <div class="eco-col">
        <div class="eco-destaque">
          <span class="rot">
            {t('eco.saldoHora')}
            <Dica texto={fmt.dicaHora()} rotulo={t('eco.dicaHora')} a="eco.dica" />
          </span>
          <span class={`eco-saldo num${saldo < 0 ? ' tx-er' : ''}`}>
            {saldo < 0 ? <Glifo n="alerta" tam={22} /> : null}
            {fmt.dinheiroHora(saldo)}
          </span>
          <span class="eco-saldo-conta num" title={fmt.dicaHora()} data-dica="hora">{t('eco.conta', { rec: fmt.dinheiroHora(receitas.total), des: fmt.dinheiroHora(-despesas.total) })}</span>
        </div>
        <div class="eco-indicadores">
          <Indicador rotulo={t('eco.caixa')} valor={fmt.dinheiro(orc.caixa ?? b.creditos)} glifo="creditos" estado={(orc.caixa ?? b.creditos) <= 0 ? 'er' : 'ch'} />
          <Indicador rotulo={t('eco.divida')} valor={fmt.dinheiro(b.divida)} glifo="contrato" />
          <Indicador rotulo={t('eco.valuation')} valor={fmt.dinheiro(b.valuation)} glifo="valuation" />
        </div>
        {serie.length > 1 ? (
          <Grafico
            titulo={t('eco.graficoCaixa')}
            series={[{ id: 'caixa', rotulo: t('eco.caixa'), cor: 'var(--g1)', valores: serie.map((p) => p.caixa) }]}
            rotulos={serie.map(rotuloMes)}
            formato={fmt.dinheiro}
            formatoEixo={curto}
            tipo="area"
            altura={96}
            a="eco.grafico"
          />
        ) : null}
        {serie.length > 1 ? (
          <Grafico
            titulo={t('eco.graficoFluxo')}
            series={[
              { id: 'receitas', rotulo: t('eco.receitasCurto'), cor: 'var(--g3)', valores: serie.map((p) => p.receitas) },
              { id: 'despesas', rotulo: t('eco.despesasCurto'), cor: 'var(--g2)', valores: serie.map((p) => p.despesas) },
            ]}
            rotulos={serie.map(rotuloMes)}
            formato={taxa}
            formatoEixo={curto}
            altura={96}
            a="eco.fluxo"
          />
        ) : null}
      </div>
      <div class="eco-col">
        <Secao titulo={t('eco.receitas')} acao={<span class="eco-total num tx-ok">{fmt.dinheiroHora(receitas.total)}</span>} class="eco-secao">
          {receitas.linhas.map((l) =>
            l.id === 'moradores' ? (
              <LinhaValor k={l.id} glifo={l.glifo} rotulo={l.rotulo} valor={l.valor} frac={l.frac} sub={regraContribuicao(b.populacao, b.tarifa, l.valor)} sub2={t('eco.regraFaixa', { bem: bemEstarArredondado(b.bemEstarTarifa ?? b.bemEstar), de: faixa.de, ate: faixa.ate, tarifa: fmt.dinheiro(faixa.tarifa) })} />
            ) : (
              <LinhaValor k={l.id} glifo={l.glifo} rotulo={l.rotulo} valor={l.valor} frac={l.frac} />
            ),
          )}
        </Secao>
        <Secao titulo={t('eco.despesas')} acao={<span class="eco-total num">{fmt.dinheiroHora(-despesas.total)}</span>} class="eco-secao">
          {despesas.linhas.map((l) => (
            <LinhaValor k={l.id} glifo={l.glifo} rotulo={l.rotulo} valor={l.valor} frac={l.frac} sinal={-1} />
          ))}
        </Secao>
        <Secao titulo={t('eco.naoPago')} class="eco-secao">
          {naoPago.length ? (
            naoPago.map((l) => (
              <div class="eco-linha eco-nao-pago" data-k={l.id}>
                <span class="eco-linha-glifo tx-al">
                  <Glifo n="alerta" tam={18} />
                </span>
                <span class="eco-linha-textos">
                  <span class="eco-linha-rot">{t(`eco.naoPago.${l.id}`)}</span>
                  <span class="eco-linha-sub">{t(`eco.naoPago.${l.id}.efeito`)}</span>
                </span>
                <span class="eco-linha-valor num tx-al" title={fmt.dicaHora()} data-dica="hora">
                  {fmt.dinheiroHora(-l.valor)}
                </span>
              </div>
            ))
          ) : (
            <p class="eco-tudo-pago">
              <Glifo n="check" tam={16} class="tx-ok" />
              {t('eco.tudoPago')}
            </p>
          )}
          <p class="eco-nota">{t('eco.caixaNunca')}</p>
        </Secao>
      </div>
    </div>
  );
}

/** Fundo de teste (D104): saca qualquer valor, a qualquer hora, para pagar as construções. Temporário. */
function FundoTeste({ fundo }) {
  const [valor, setValor] = useState(Math.min(fundo.saldo, 1000 * fundo.passo));
  const [retorno, setRetorno] = useState(null);
  const max = Math.max(0, Math.floor(fundo.saldo / fundo.passo) * fundo.passo);
  const v = Math.min(Math.max(valor, Math.min(fundo.passo, max)), max);
  const sacar = async (n) => {
    const res = await comando('fundo.sacar', { valor: n }, { silencioso: true });
    setRetorno(res.ok ? { ok: true, texto: t('eco.fundo.sacou', { n: fmt.dinheiro(n) }) } : { ok: false, texto: frase(res) });
  };
  return (
    <Secao titulo={t('eco.fundo')} class="eco-secao">
      <p class="eco-nota">{t('eco.fundo.saldo', { saldo: fmt.dinheiro(fundo.saldo), total: fmt.dinheiro(fundo.total) })}</p>
      {max > 0 ? (
        <div class="eco-tomar">
          <Deslizante valor={v} aoMudar={setValor} min={Math.min(fundo.passo, max)} max={max} passo={fundo.passo} rotulo={t('eco.fundo.valor')} formato={fmt.dinheiro} botoes a="eco.fundo.valor" />
          <Botao a="eco.fundo.sacar" rotulo={t('eco.fundo.sacarN', { n: fmt.dinheiro(v) })} principal class="bt-pri" onClick={() => sacar(v)}>
            {t('eco.fundo.sacarN', { n: fmt.dinheiro(v) })}
          </Botao>
          <Botao a="eco.fundo.tudo" rotulo={t('eco.fundo.tudo')} class="bt-sec" onClick={() => sacar(fundo.saldo)}>
            {t('eco.fundo.tudo')}
          </Botao>
        </div>
      ) : (
        <p class="eco-nota">{t('eco.fundo.vazio')}</p>
      )}
      {retorno && <p class={`eco-retorno ${retorno.ok ? 'tx-ok' : 'tx-al'}`} role="status">{retorno.texto}</p>}
    </Secao>
  );
}

function Emprestimo({ emp, b }) {
  const r = REGRAS_DONO.emprestimo;
  const lim = limitesEmprestimo(emp, r);
  const [valor, setValor] = useState(Math.min(lim.max, 10 * r.passo) || r.passo);
  const [retorno, setRetorno] = useState(null);
  useEffect(() => {
    if (!retorno) return undefined;
    const id = setTimeout(() => setRetorno(null), 4000);
    return () => clearTimeout(id);
  }, [retorno]);
  if (!emp) return <Vazio glifo="contrato" texto={t('eco.semDados')} />;
  const v = Math.min(Math.max(valor, lim.min), Math.max(lim.min, lim.max));
  const ano = fmt.anoCalendario(b.data?.ano ?? 1);
  // o retorno aparece na seção do botão tocado (tomar ou contratos): no celular a outra pode estar fora da vista
  const agir = async (nome, args, ok, onde = 'contratos') => {
    const res = await comando(nome, args, { silencioso: true });
    setRetorno(res.ok ? { ok: true, texto: ok, onde } : { ok: false, texto: frase(res), onde });
  };
  const recusar = (texto) => setRetorno({ ok: false, texto, onde: 'contratos' });
  const linhaRetorno = (onde) =>
    retorno?.onde === onde ? (
      <p class={`eco-retorno ${retorno.ok ? 'tx-ok' : 'tx-al'}`} role="status">
        <Glifo n={retorno.ok ? 'check' : 'alerta'} tam={16} />
        {retorno.texto}
      </p>
    ) : null;
  const contratos = (emp.contratos ?? []).map((c) => ({
    id: c.id,
    ano: fmt.anoCalendario(c.ano),
    valor: c.valor,
    saldo: c.saldo,
    vence: fmt.anoCalendario(anoDoTique(c.fim ?? 0)),
    juros: c.mora ? r.mora : r.taxaAno,
    mora: !!c.mora,
  }));
  const quitar = (emp.divida ?? 0) + (emp.jurosDevidos ?? 0);
  const semJuros = !(emp.jurosDevidos > 0);
  const semCaixa = !(b.creditos >= quitar);
  return (
    <div class="eco-colunas">
      <div class="eco-col">
        <div class="eco-fala">
          <span class="monograma" aria-hidden="true">
            L
          </span>
          <span class="eco-fala-textos">
            <span class="eco-fala-quem">{t('eco.livia')}</span>
            <span class="eco-fala-texto">{lim.motivo === 'ano' ? t('eco.livia.ano', { ano: ano + 1 }) : t('eco.livia.fala')}</span>
          </span>
        </div>
        <Secao titulo={t('eco.regras')} class="eco-secao eco-regras">
          <p class="eco-regra">
            <Glifo n="calendario" tam={18} />
            {t('eco.regra.porAno', { n: fmt.dinheiro(r.porAno) })}
          </p>
          <p class="eco-regra">
            <Glifo n="juros" tam={18} />
            {t('eco.regra.taxa', { pct: fmt.numero(r.taxaAno * 100) })}
          </p>
          <p class="eco-regra">
            <Glifo n="contrato" tam={18} />
            {t('eco.regra.divida', { n: fmt.dinheiro(r.dividaMax) })}
          </p>
          <p class="eco-regra">
            <Glifo n="prazo" tam={18} />
            {r.lombard ? t('eco.regra.lombard', { anos: r.prazoAnos, pct: fmt.numero(r.lombard.cobertura * 100), mora: fmt.numero(r.mora * 100) }) : t('eco.regra.prazo', { anos: r.prazoAnos, mora: fmt.numero(r.mora * 100) })}
          </p>
          <p class="eco-regra">
            <Glifo n="mais" tam={18} />
            {t('eco.regra.passo', { n: fmt.dinheiro(r.passo) })}
          </p>
        </Secao>
      </div>
      <div class="eco-col">
        <div class="eco-medidores">
          <div class="eco-medidor">
            <span class="rot">{t('eco.disponivel', { ano })}</span>
            <Barra valor={(emp.disponivelAno ?? 0) / (emp.limiteAno || r.porAno)} estado="ac" rotulo={t('eco.disponivel', { ano })} texto={t('eco.deN', { a: fmt.dinheiro(emp.disponivelAno), b: fmt.dinheiro(emp.limiteAno ?? r.porAno) })} />
          </div>
          <div class="eco-medidor">
            <span class="rot">{t('eco.divida')}</span>
            <Barra valor={(emp.divida ?? 0) / (emp.dividaMax || r.dividaMax)} estado={(emp.divida ?? 0) > 0.8 * (emp.dividaMax || r.dividaMax) ? 'al' : 'ch'} rotulo={t('eco.divida')} texto={t('eco.deN', { a: fmt.dinheiro(emp.divida), b: fmt.dinheiro(emp.dividaMax ?? r.dividaMax) })} />
          </div>
        </div>
        <Secao titulo={t('eco.tomar')} class="eco-secao">
          {lim.motivo ? (
            <p class="eco-bloqueio">
              <Glifo n="cadeado" tam={16} />
              {t(`eco.bloqueio.${lim.motivo}`, { ano: ano + 1 })}
            </p>
          ) : (
            <div class="eco-tomar">
              <Deslizante valor={v} aoMudar={setValor} min={lim.min} max={lim.max} passo={lim.passo} rotulo={t('eco.valorTomar')} formato={fmt.dinheiro} botoes a="eco.valor" />
              <Botao a="eco.tomar" rotulo={t('eco.tomarN', { n: fmt.dinheiro(v) })} principal class="bt-pri" onClick={() => agir('emprestimo.tomar', { valor: v }, t('eco.tomado', { n: fmt.dinheiro(v) }), 'tomar')}>
                {t('eco.tomarN', { n: fmt.dinheiro(v) })}
              </Botao>
            </div>
          )}
          {linhaRetorno('tomar')}
        </Secao>
        {emp.fundo?.ativo && <FundoTeste fundo={emp.fundo} />}
        <Secao titulo={t('eco.contratos')} class="eco-secao">
          {contratos.length ? (
            <>
              <Tabela
                a="eco.contratos"
                rotulo={t('eco.contratos')}
                chave={(c) => c.id}
                colunas={[
                  { id: 'ano', rotulo: t('eco.col.ano'), num: true, formato: String },
                  { id: 'valor', rotulo: t('eco.col.valor'), num: true, formato: fmt.dinheiro },
                  { id: 'saldo', rotulo: t('eco.col.saldo'), num: true, formato: fmt.dinheiro },
                  { id: 'vence', rotulo: t('eco.col.vence'), num: true, formato: String },
                  { id: 'juros', rotulo: t('eco.col.juros'), num: true, formato: (x) => `${fmt.numero(x * 100)}%`, estado: (x, l) => (l.mora ? 'al' : null) },
                ]}
                linhas={contratos}
              />
              <div class="eco-acoes">
                {/* fracos mas tocáveis: o toque diz o motivo aqui mesmo, na linha de retorno da seção */}
                <Botao
                  a="eco.pagarJuros"
                  rotulo={t('eco.pagarJuros', { n: fmt.dinheiro(emp.jurosDevidos) })}
                  aria-disabled={semJuros ? 'true' : undefined}
                  dica={semJuros ? t('eco.semJuros') : undefined}
                  class="bt-sec"
                  onClick={() => (semJuros ? recusar(t('eco.semJuros')) : agir('emprestimo.pagarJuros', {}, t('eco.pago')))}
                >
                  {t('eco.pagarJuros', { n: fmt.dinheiro(emp.jurosDevidos) })}
                </Botao>
                <Botao a="eco.pagarParcela" rotulo={t('eco.pagarParcela')} dica={t('eco.parcelaDica', { min: fmt.dinheiro(r.passo) })} class="bt-sec" onClick={() => agir('emprestimo.pagarParcela', {}, t('eco.pago'))}>
                  {t('eco.pagarParcela')}
                </Botao>
                <DoisToques
                  a="eco.quitar"
                  rotulo={t('eco.quitar', { n: fmt.dinheiro(quitar) })}
                  aoConfirmar={() => agir('emprestimo.quitar', {}, t('eco.quitado'))}
                  desligado={semCaixa}
                  dica={semCaixa ? t('codigo.creditos') : undefined}
                  aoRecusar={() => recusar(t('codigo.creditos'))}
                />
              </div>
            </>
          ) : (
            <Vazio glifo="check" texto={t('eco.semDivida')} />
          )}
          {/* fora da tabela: "Dívida quitada." fica à vista depois que o último contrato some */}
          {linhaRetorno('contratos')}
        </Secao>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ tela

export function Economia({ fechar }) {
  const [aba, setAba] = useState(abaEconomia.peek());
  // quem abre por fora escolhe a aba só uma vez: a próxima abertura volta ao orçamento
  useEffect(() => {
    abaEconomia.value = 'orcamento';
  }, []);
  const b = barra.value; // relê a cada leitura da barra (4 por segundo)
  const orc = aba === 'orcamento' ? consultar('orcamento') : null;
  const emp = aba === 'emprestimo' ? consultar('emprestimo') : null;
  const abas = [
    { id: 'orcamento', rotulo: t('eco.aba.orcamento') },
    { id: 'emprestimo', rotulo: t('eco.aba.emprestimo') },
  ];
  return (
    <Tela id="economia" glifo="dinheiro" titulo={t('eco.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {aba === 'orcamento' ? <Orcamento orc={orc} b={b} /> : <Emprestimo emp={emp} b={b} />}
    </Tela>
  );
}

/** Tela de gestão 'economia' (créditos na barra de cima abrem). */
export function registrar(ui) {
  ui.registrarTela('economia', Economia);
}
