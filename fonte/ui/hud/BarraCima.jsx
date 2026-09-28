// Barra de cima (desenho da UI 8.1 e 8.2; D7, D11, D24, D42). Dois grupos de vidro grafite nos cantos de cima:
//   esquerda (leitura): H da Holding, marco com o anel do XP, créditos com o saldo em "/h", população em "/h",
//     bem-estar com o rosto da faixa e a margem até o degrau ("+3 acima de 61"), demanda R C I (E no M1b);
//   direita: Conselho (só com decisão), calendário "Mês 3 · Ano 2" com o glifo e o nome da fase do céu (nunca a hora
//     em número), velocidade (pausa, 1x, 2x, 4x) e menu.
// Cada número abre a sua tela quando ela existe (créditos: Economia; população e demanda: Cidade; marco: Progresso;
// H: Holding) e, antes disso, um popover com o "de onde vem". No PC entram o valor da Holding, a dívida e os botões
// das telas registradas, que apertam em vez de sair da tela (useAperto). Os números são sempre explícitos; a cor de
// estado vem sempre com glifo.
import { useState, useRef, useEffect, useLayoutEffect } from 'preact/hooks';
import { barra, tela } from '../loja.js';
import * as fmt from '../formato.js';
import { t, temTexto } from '../textos.js';
import { velocidade } from '../acoes.js';
import { consultar } from '../consultas.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { glifoBemEstar } from '../glifos/glifos.js';
import { Ancora, Popover } from '../comp/Popover.jsx';
import { Barra, fracao } from '../comp/Barra.jsx';
import { REGRAS_DONO, bemEstarArredondado } from '../../data/economia.js';
import { MES, MESES_ANO, RODADA, HORA } from '../../comum/relogio.js';

const GLIFO_VEL = ['pausa', 'vel1', 'vel2', 'vel3'];
// gatilho de popover: aria-expanded (não aria-pressed, que é de botão que liga e desliga)
const expande = (aberto) => ({ 'aria-expanded': String(!!aberto), 'aria-haspopup': 'dialog' });
// "reduzir movimento": o do sistema ou o do jogador (prefs.reduzirMovimento marca a raiz, ui/prefs.js)
const movimentoReduzido = () =>
  (typeof document !== 'undefined' && document.documentElement?.dataset?.movimento === 'reduzido') ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
// um glifo por fase do céu: no celular estreito o nome da fase sai da barra e o glifo basta (o popover diz o nome)
export const GLIFO_FASE = Object.freeze({ manha: 'solNascente', tarde: 'sol', fimDeTarde: 'solBaixo', noite: 'lua' });
const glifoFase = (f) => GLIFO_FASE[f] ?? 'sol';
// telas de gestão que ganham botão com rótulo no PC (desenho da UI 7.4), na ordem da barra
const GESTAO = ['holding', 'economia', 'cidade', 'progresso', 'conselho'];
const GLIFO_TELA = Object.freeze({ holding: 'holding', economia: 'dinheiro', cidade: 'populacao', progresso: 'marco', conselho: 'conselho' });
// telas que a barra já abre por outro caminho (o H; o chip do Conselho e o menu): as primeiras a sair quando aperta
const REPETIDAS = ['holding', 'conselho'];
const NIVEL_MAX = 3;

// ------------------------------------------------------------------------------------------ regras de leitura (puras)

/** Bem-estar que a barra mostra: o da tarifa (D11), inteiro de 0 a 100; sem número (NaN, cidade vazia) vale 0. */
export const bemDaBarra = (b) => bemEstarArredondado(b?.bemEstarTarifa ?? b?.bemEstar);

/** Cidade sem moradores (partida nova): o bem-estar não tem de quem ser média, então não há rosto nem degrau. */
export const semMoradores = (b) => b?.populacao === 0;

/**
 * Margem do bem-estar até o degrau da tarifa (D11): "+3 acima de 61"; âmbar abaixo de 63 (a 2 pontos do degrau).
 * Sem degrau: abaixo de 31 diz quanto falta para subir; na faixa de cima, sem risco, diz a faixa. Sem moradores, diz
 * isso (um rosto triste e "faltam 31" numa cidade vazia assustariam à toa).
 * @returns {{ texto: string, estado: 'al' | null }}
 */
export function textoMargem(b) {
  if (semMoradores(b)) return { texto: t('barra.bem.semMoradores'), estado: null };
  const m = b?.margem ?? {};
  const bem = bemDaBarra(b);
  if (m.degrau !== null && m.degrau !== undefined) {
    const delta = Math.max(0, Math.round(Number.isFinite(m.delta) ? m.delta : bem - m.degrau));
    return { texto: t('barra.bem.acima', { n: delta, degrau: m.degrau }), estado: delta < 2 ? 'al' : null };
  }
  const prox = REGRAS_DONO.renda.faixas.find(([de]) => de > bem);
  if (prox) return { texto: t('barra.bem.faltam', { n: prox[0] - bem, degrau: prox[0] }), estado: null };
  return { texto: t('barra.bem.topo'), estado: null };
}

/** As três faixas da regra do dono, com a atual marcada: [{ de, ate, tarifa, atual }]. */
export const faixasTarifa = (tarifa) => REGRAS_DONO.renda.faixas.map(([de, ate, v]) => ({ de, ate, tarifa: v, atual: v === tarifa }));

/** Fração do XP entre o marco atual e o próximo (1 no último marco). */
export function fracaoMarco(m) {
  if (!m || m.xpProx === null || m.xpProx === undefined) return 1;
  const faixa = m.xpProx - (m.xpIni ?? 0);
  return faixa > 0 ? fracao((m.xp - (m.xpIni ?? 0)) / faixa) : 0;
}

/** Tiques até o próximo ano do calendário (o ano rege o limite do empréstimo, D42). */
export function tiquesAteAno(data) {
  const mes = data?.mes ?? 1;
  const frac = data?.fracMes ?? 0;
  return Math.max(0, Math.round((MESES_ANO - mes + 1 - frac) * MES));
}

/** Zonas da demanda na barra: R, C e I no M1a; E (escritório, M1b) quando a simulação mandar valor. */
export const zonasDemanda = (d) => (d && d.E > 0 ? ['R', 'C', 'I', 'E'] : ['R', 'C', 'I']);

// ------------------------------------------------------------------------------------------ peças

/**
 * Créditos com destaque nos saltos (um empréstimo, um prêmio, uma obra paga): champanhe no ganho por 500 ms, vermelho
 * no gasto por 300 ms e a contagem de 480 ms até o valor novo. A renda de cada tique não conta como salto, então a
 * barra não anima em repouso. Com "reduzir movimento", só a cor.
 */
function useCreditos(valor, ritmoHora) {
  const antes = useRef(valor);
  const alvo = useRef(valor); // a contagem corre até o valor mais novo (a renda dos tiques seguintes entra nela)
  const anim = useRef({ id: 0, fim: 0, mostrado: null });
  const [salto, setSalto] = useState(null);
  const [visto, setVisto] = useState(null); // null: segue o valor
  alvo.current = valor;
  useEffect(() => {
    const a = antes.current;
    antes.current = valor;
    const d = valor - a;
    // a renda normal entre duas leituras da ponte (250 ms, até 8 tiques por quadro) fica abaixo de duas rodadas de
    // tiques, mesmo que a simulação pague por rodada; acima disso é salto (empréstimo, prêmio, obra)
    const esperado = Math.abs(ritmoHora || 0) * ((2 * RODADA) / HORA);
    if (!Number.isFinite(d) || Math.abs(d) <= Math.max(500, esperado)) return;
    const x = anim.current;
    clearTimeout(x.fim);
    setSalto(d > 0 ? 'sobe' : 'desce');
    x.fim = setTimeout(() => setSalto(null), d > 0 ? 500 : 300);
    if (movimentoReduzido() || typeof requestAnimationFrame !== 'function') return;
    if (x.id) cancelAnimationFrame(x.id);
    const de = x.mostrado ?? a; // um salto no meio de outro continua do número que está na tela
    const t0 = performance.now();
    const passo = (tq) => {
      const k = Math.min(1, (tq - t0) / 480);
      x.mostrado = k < 1 ? Math.round(de + (alvo.current - de) * (1 - (1 - k) ** 3)) : null;
      setVisto(x.mostrado);
      x.id = k < 1 ? requestAnimationFrame(passo) : 0;
    };
    x.id = requestAnimationFrame(passo);
  }, [valor]);
  // a barra saindo não deixa temporizador nem quadro pendurado
  useEffect(
    () => () => {
      clearTimeout(anim.current.fim);
      if (anim.current.id) cancelAnimationFrame(anim.current.id);
    },
    [],
  );
  return { salto, visto: visto ?? valor };
}

/**
 * Aperto da barra no PC (desenho da UI 7.4): 0 com tudo; 1 sem os botões de Holding e Conselho (o H e o chip já abrem
 * essas telas); 2 com os botões que ficam só com o glifo; 3 também sem o valor da Holding e a dívida. Sobe quando os
 * grupos pedem mais que a largura (com as cinco telas da U1b, a 1376 e a 1920 os rótulos não cabem) e desce quando a
 * largura volta a caber o que o nível de baixo pedia, sem vaivém. A medida roda no quadro seguinte ao do
 * ResizeObserver (mudar o nível dentro dele daria o erro de laço do observador). No celular os extras nem aparecem.
 */
function useAperto(ref, chave) {
  const [nivel, setNivel] = useState(0);
  const e = useRef({ nivel: 0, pedida: [], quadro: 0 }).current;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== 'function' || typeof requestAnimationFrame !== 'function') return undefined;
    const medir = () => {
      e.quadro = 0;
      const grupos = [...el.children].filter((c) => c.classList.contains('hud-grupo') && c.offsetWidth > 0);
      const folga = parseFloat(getComputedStyle(el).columnGap) || 0;
      const pede = grupos.reduce((s, g) => s + g.offsetWidth, 0) + folga * Math.max(0, grupos.length - 1);
      const livre = el.clientWidth;
      let n = e.nivel;
      if (pede > livre + 0.5 && n < NIVEL_MAX) e.pedida[n++] = pede;
      else if (n > 0 && livre >= e.pedida[n - 1]) n--;
      if (n !== e.nivel) setNivel((e.nivel = n));
    };
    const agendar = () => {
      if (!e.quadro) e.quadro = requestAnimationFrame(medir);
    };
    const ro = new ResizeObserver(agendar);
    ro.observe(el);
    for (const g of el.children) ro.observe(g);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(e.quadro);
      e.quadro = 0;
    };
  }, [chave]);
  return nivel;
}

function Anel({ frac, n }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  return (
    <span class="marco-anel">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden={true} focusable="false">
        <circle cx="14" cy="14" r={r} class="marco-trilho" />
        {frac > 0.005 ? <circle cx="14" cy="14" r={r} class="marco-xp" stroke-dasharray={`${(c * frac).toFixed(2)} ${c.toFixed(2)}`} transform="rotate(-90 14 14)" /> : null}
      </svg>
      <b class="num">{n}</b>
    </span>
  );
}

function BarrasDemanda({ demanda }) {
  return (
    <span class="demanda-barras" aria-hidden={true}>
      {zonasDemanda(demanda).map((z) => (
        <span class={`demanda-col demanda-${z}`}>
          <span class="demanda-trilho">
            <i style={{ transform: `scaleY(${fracao((demanda?.[z] ?? 0) / 100)})` }} />
          </span>
          <span class="demanda-letra">{z}</span>
        </span>
      ))}
    </span>
  );
}

/** Linha "rótulo · valor" dos popovers. */
const Par = ({ rotulo, valor, estado = null, glifo = null }) => (
  <div class="par">
    <span class="par-rot">{rotulo}</span>
    <span class={`par-valor num${estado ? ` tx-${estado}` : ''}`}>
      {glifo ? <Glifo n={glifo} tam={14} /> : null}
      {valor}
    </span>
  </div>
);

function VerTudo({ ui, tela, fechar }) {
  if (!ui.telas().includes(tela)) return null;
  return (
    <Botao a="barra.ver" k={tela} rotulo={t(`barra.ver.${tela}`)} class="bt-fan popover-acao" onClick={() => { fechar(); ui.abrirTela(tela); }}>
      <span>{t(`barra.ver.${tela}`)}</span>
      <Glifo n="setaDir" tam={16} />
    </Botao>
  );
}

// ------------------------------------------------------------------------------------------ barra

export function BarraCima({ ui }) {
  const b = barra.value;
  const [aberto, setAberto] = useState(null);
  const fechar = () => setAberto(null);
  const alternar = (id) => setAberto(aberto === id ? null : id);
  // toque: a tela, se já existe (tocar de novo com ela aberta fecha); senão, o popover com o "de onde vem"
  const abrir = (id, pop) => {
    if (!ui.telas().includes(id)) return alternar(pop);
    fechar();
    if (tela.value === id) ui.fecharTela();
    else ui.abrirTela(id);
  };
  const { salto, visto: creditosVistos } = useCreditos(b.creditos, b.saldoHora);
  const saldoNeg = b.saldoHora < 0;
  const saldo = fmt.porHora(b.saldoHora);
  const margem = textoMargem(b);
  const bem = bemDaBarra(b);
  const vazia = semMoradores(b);
  const glifoBem = vazia ? 'bemEstarMedio' : glifoBemEstar(b.tarifa);
  const estadoBem = vazia ? null : b.tarifa >= 11 ? 'ok' : b.tarifa >= 8 ? null : 'er';
  const pausado = b.velocidade === 0;
  const pendentes = b.decisoesPendentes ?? 0;
  const dicaHora = fmt.dicaHora();
  const telasPc = GESTAO.filter((id) => ui.telas().includes(id));
  const marco = b.marco ?? {};
  const cima = useRef(null);
  // os grupos observados mudam quando uma tela de gestão se registra ou o chip do Conselho aparece (o grupo das telas
  // nunca some ao apertar: a Economia é desta parcela e fica)
  const aperto = useAperto(cima, `${telasPc.join(',')}|${pendentes > 0}`);
  const telasBarra = aperto >= 1 ? telasPc.filter((id) => !REPETIDAS.includes(id)) : telasPc;

  return (
    <div ref={cima} class={`hud-cima${aperto ? ` aperto-${aperto}` : ''}`}>
      <div class="hud-grupo vidro" data-hud="cima-esquerda">
        <Ancora>
          <Botao a="holding" rotulo={t('barra.holding')} {...(ui.telas().includes('holding') ? {} : expande(aberto === 'holding'))} class="hud-item hud-marca" onClick={() => abrir('holding', 'holding')}>
            <Glifo n="holding" tam={24} />
          </Botao>
          <Popover aberto={aberto === 'holding'} aoFechar={fechar} titulo={t('barra.holding')} a="barra.holding">
            <PopHolding b={b} />
          </Popover>
        </Ancora>
        <Ancora>
          <Botao a="marco" rotulo={t('barra.marco.rotulo', { n: marco.n ?? 0, nome: marco.nome ?? '' })} {...expande(aberto === 'marco')} class="hud-item hud-marco" onClick={() => alternar('marco')}>
            <Anel frac={fracaoMarco(marco)} n={marco.n ?? 0} />
          </Botao>
          <Popover aberto={aberto === 'marco'} aoFechar={fechar} titulo={t('barra.marco.titulo', { n: marco.n ?? 0, nome: marco.nome ?? '' })} a="barra.marco">
            <PopMarco marco={marco} />
            <VerTudo ui={ui} tela="progresso" fechar={fechar} />
          </Popover>
        </Ancora>
        <Botao a="creditos" rotulo={t('barra.creditos.rotulo', { valor: fmt.creditos(b.creditos), saldo })} class={`hud-item${salto ? ` salto-${salto}` : ''}`} onClick={() => abrir('economia', 'economia')}>
          <Glifo n="creditos" class="tx-ch" />
          <span class="pilha">
            <b class="num hud-valor">{fmt.creditosBarra(creditosVistos)}</b>
            <small class={`num hud-sub${saldoNeg ? ' tx-al' : ''}`} title={dicaHora} data-dica="hora">
              {saldoNeg ? <Glifo n="alerta" tam={12} /> : null}
              {saldo}
            </small>
          </span>
        </Botao>
        <Ancora>
          <Botao a="populacao" rotulo={t('barra.pop.rotulo', { valor: fmt.populacao(b.populacao), hora: fmt.porHora(b.popHora) })} {...(ui.telas().includes('cidade') ? {} : expande(aberto === 'pop'))} class="hud-item" onClick={() => abrir('cidade', 'pop')}>
            <Glifo n="populacao" />
            <span class="pilha">
              <b class="num hud-valor">{fmt.populacao(b.populacao)}</b>
              <small class="num hud-sub" title={dicaHora} data-dica="hora">
                {fmt.porHora(b.popHora)}
              </small>
            </span>
          </Botao>
          <Popover aberto={aberto === 'pop'} aoFechar={fechar} titulo={t('barra.pop.titulo')} a="barra.pop">
            <Par rotulo={t('barra.pop.moradores')} valor={fmt.populacao(b.populacao)} />
            <Par rotulo={t('barra.pop.ritmo')} valor={fmt.porHora(b.popHora)} />
            <p class="popover-nota">{dicaHora}</p>
          </Popover>
        </Ancora>
        <Ancora>
          <Botao a="bemEstar" rotulo={vazia ? t('barra.bem.rotuloVazia', { margem: margem.texto }) : t('barra.bem.rotulo', { n: bem, margem: margem.texto })} {...expande(aberto === 'bem')} class="hud-item" onClick={() => alternar('bem')}>
            <Glifo n={glifoBem} class={estadoBem ? `tx-${estadoBem}` : ''} />
            <span class="pilha">
              {/* cidade sem moradores: sem número (a média não tem de quem ser), o nome no lugar */}
              <b class={vazia ? 'hud-valor' : 'num hud-valor'}>{vazia ? t('barra.bem.nome') : bem}</b>
              <small class={`num hud-sub${margem.estado ? ` tx-${margem.estado}` : ''}`}>
                {margem.estado ? <Glifo n="alerta" tam={12} /> : null}
                {margem.texto}
              </small>
            </span>
          </Botao>
          <Popover aberto={aberto === 'bem'} aoFechar={fechar} titulo={vazia ? t('barra.bem.nome') : t('barra.bem.titulo', { n: bem })} largura={300} a="barra.bem">
            <PopBemEstar b={b} margem={margem} vazia={vazia} />
            <VerTudo ui={ui} tela="cidade" fechar={fechar} />
          </Popover>
        </Ancora>
        <Ancora>
          <Botao a="demanda" rotulo={t('barra.demanda.rotulo', { r: b.demanda?.R ?? 0, c: b.demanda?.C ?? 0, i: b.demanda?.I ?? 0 })} {...expande(aberto === 'demanda')} class="hud-item hud-demanda" onClick={() => alternar('demanda')}>
            <BarrasDemanda demanda={b.demanda} />
          </Botao>
          <Popover aberto={aberto === 'demanda'} aoFechar={fechar} titulo={t('barra.demanda.titulo')} a="barra.demanda">
            <PopDemanda demanda={b.demanda} />
            <VerTudo ui={ui} tela="cidade" fechar={fechar} />
          </Popover>
        </Ancora>
        <span class="hud-item hud-pc2" role="group" aria-label={t('barra.valuation')}>
          <Glifo n="valuation" class="tx-ch" />
          <span class="pilha">
            <b class="num hud-valor">{fmt.creditosBarra(b.valuation)}</b>
            <small class="hud-sub">{t('barra.valuation')}</small>
          </span>
        </span>
        <span class="hud-item hud-pc2" role="group" aria-label={t('barra.divida')}>
          <Glifo n="contrato" />
          <span class="pilha">
            <b class="num hud-valor">{fmt.creditosBarra(b.divida)}</b>
            <small class="hud-sub">{t('barra.divida')}</small>
          </span>
        </span>
      </div>

      {telasBarra.length ? (
        <div class="hud-grupo vidro hud-pc hud-gestao" data-hud="cima-gestao">
          {telasBarra.map((id) => (
            <Botao a="gestao" k={id} rotulo={t(`barra.tela.${id}`)} dica={aperto >= 2 ? t(`barra.tela.${id}`) : undefined} ativo={tela.value === id} class="hud-item hud-rotulo" onClick={() => (tela.value === id ? ui.fecharTela() : ui.abrirTela(id))}>
              {/* apertada, a barra mostra só o glifo (o nome fica no rótulo acessível e na dica do mouse) */}
              <Glifo n={GLIFO_TELA[id] ?? 'setaDir'} class="hud-rotulo-glifo" />
              <span class="hud-rotulo-texto">{t(`barra.tela.${id}`)}</span>
            </Botao>
          ))}
        </div>
      ) : null}

      <div class="hud-grupo vidro" data-hud="cima-direita">
        {pendentes > 0 ? (
          <Ancora>
            <Botao a="conselho" rotulo={t('barra.conselho', { n: pendentes })} {...(ui.telas().includes('conselho') ? {} : expande(aberto === 'conselho'))} class="hud-item hud-conselho" onClick={() => abrir('conselho', 'conselho')}>
              <Glifo n="conselho" />
              <span class="selo num">{pendentes}</span>
            </Botao>
            <Popover aberto={aberto === 'conselho'} aoFechar={fechar} titulo={t('barra.tela.conselho')} a="barra.conselho">
              <Par rotulo={t('barra.conselho.pendentes')} valor={fmt.numero(pendentes)} />
              <p class="popover-nota">{t('app.emBreve')}</p>
            </Popover>
          </Ancora>
        ) : null}
        <Ancora>
          <Botao a="calendario" rotulo={`${fmt.dataCalendario(b.data)}, ${fmt.fase(b.data?.fase)}`} {...expande(aberto === 'data')} class="hud-item hud-data" onClick={() => alternar('data')}>
            <Glifo n={glifoFase(b.data?.fase)} />
            <span class="pilha">
              <b class="num hud-data-mes">
                {t('barra.mesN', { mes: b.data?.mes ?? 1 })}
                <span class="hud-data-longa">
                  {' · '}
                  {t('barra.anoN', { ano: b.data?.ano ?? 1 })}
                </span>
              </b>
              <small class="hud-sub hud-data-longa">{fmt.fase(b.data?.fase)}</small>
              <small class="num hud-sub hud-data-curta">{t('barra.anoN', { ano: b.data?.ano ?? 1 })}</small>
            </span>
          </Botao>
          <Popover aberto={aberto === 'data'} aoFechar={fechar} titulo={fmt.dataCalendario(b.data)} lado="direita" largura={292} a="barra.data">
            <PopData b={b} />
          </Popover>
        </Ancora>
        <div class="hud-vel" role="radiogroup" aria-label={t('vel.grupo')}>
          {GLIFO_VEL.map((g, v) => (
            <Botao a="velocidade" k={v} rotulo={t(`vel.${v}`)} role="radio" aria-checked={String(b.velocidade === v)} class={`hud-item hud-seg${b.velocidade === v ? ' ligado' : ''}${v === 0 ? ' pausa' : ''}`} onClick={() => velocidade(v)}>
              <Glifo n={g} />
            </Botao>
          ))}
        </div>
        <Ancora>
          <Botao a="menu" rotulo={t('barra.menu')} {...(ui.telas().includes('menu') ? {} : expande(aberto === 'menu'))} class="hud-item hud-menu" onClick={() => abrir('menu', 'menu')}>
            <Glifo n="menu" />
          </Botao>
          <Popover aberto={aberto === 'menu'} aoFechar={fechar} titulo={t('barra.menu')} lado="direita" largura={240} a="barra.menu">
            <PopMenu ui={ui} fechar={fechar} />
          </Popover>
        </Ancora>
      </div>

      {pausado ? (
        <div class="chip-pausa vidro" data-hud="pausado" role="status">
          <Glifo n="pausa" tam={14} />
          <span>{t('vel.pausado')}</span>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ popovers

function PopHolding({ b }) {
  const h = consultar('holding');
  return (
    <>
      <Par rotulo={t('barra.holding.nome')} valor={h?.nome ?? t('barra.holding.padrao')} />
      <Par rotulo={t('barra.valuation')} valor={fmt.creditos(b.valuation)} glifo="valuation" />
      <Par rotulo={t('barra.caixa')} valor={fmt.creditos(b.creditos)} />
      <Par rotulo={t('barra.divida')} valor={fmt.creditos(b.divida)} />
      <p class="popover-nota">{t('barra.holding.nota')}</p>
    </>
  );
}

function PopMarco({ marco }) {
  const ultimo = marco.xpProx === null || marco.xpProx === undefined;
  return (
    <>
      <Barra valor={fracaoMarco(marco)} rotulo={t('barra.marco.xp')} texto={ultimo ? fmt.numero(marco.xp) : t('barra.marco.deXp', { xp: fmt.numero(marco.xp), prox: fmt.numero(marco.xpProx) })} />
      <p class="popover-texto">{ultimo ? t('barra.marco.ultimo') : t('barra.marco.faltam', { n: fmt.numero(Math.max(0, marco.xpProx - marco.xp)), prox: (marco.n ?? 0) + 1 })}</p>
      {/* requisito sem frase (um marco novo da simulação) fica fora em vez de aparecer como '??chave' */}
      {marco.requisito && temTexto(`barra.marco.requisito.${marco.requisito}`) ? (
        <p class="popover-texto tx-ch">
          <Glifo n="arcologia" tam={14} /> {t(`barra.marco.requisito.${marco.requisito}`)}
        </p>
      ) : null}
    </>
  );
}

function PopBemEstar({ b, margem, vazia }) {
  // cidade sem moradores: as faixas ficam como regra, sem faixa "atual" nem "cai para" (não há de quem ser a média)
  const faixas = faixasTarifa(vazia ? null : b.tarifa);
  const anterior = vazia ? null : faixas.filter((f) => f.tarifa < b.tarifa).pop();
  return (
    <>
      <p class="popover-texto">{vazia ? t('barra.bem.pagaVazia') : t('barra.bem.paga', { tarifa: b.tarifa })}</p>
      {anterior ? <p class={`popover-texto${margem.estado ? ' tx-al' : ''}`}>{t('barra.bem.cai', { degrau: anterior.ate + 1, tarifa: anterior.tarifa })}</p> : null}
      <div class="faixas" role="list" aria-label={t('barra.bem.faixas')}>
        {faixas.map((f) => (
          <div class={`faixa${f.atual ? ' atual' : ''}`} role="listitem">
            <span class="faixa-de num">{f.de === 0 ? t('barra.bem.ate', { ate: f.ate }) : t('barra.bem.deAte', { de: f.de, ate: f.ate })}</span>
            {/* seta de "paga", não chevron de navegar: a linha não abre nada */}
            <Glifo n="ir" tam={14} />
            <span class="faixa-tarifa num">{t('barra.bem.tarifa', { tarifa: f.tarifa })}</span>
            {f.atual ? <Glifo n="check" tam={14} class="tx-ok" /> : null}
          </div>
        ))}
      </div>
      <p class="popover-nota">{t('barra.bem.media')}</p>
    </>
  );
}

function PopDemanda({ demanda }) {
  const nomes = { R: 'barra.demanda.R', C: 'barra.demanda.C', I: 'barra.demanda.I', E: 'barra.demanda.E' };
  return (
    <>
      {zonasDemanda(demanda).map((z) => (
        <div class="par par-barra">
          <span class="par-rot">{t(nomes[z])}</span>
          <Barra valor={(demanda?.[z] ?? 0) / 100} estado={`z${z}`} rotulo={t(nomes[z])} texto={fmt.numero(demanda?.[z] ?? 0)} />
        </div>
      ))}
      <p class="popover-nota">{t('barra.demanda.nota')}</p>
    </>
  );
}

function PopData({ b }) {
  const ano = (b.data?.ano ?? 1) + 1;
  const tiques = tiquesAteAno(b.data);
  return (
    <>
      <p class="popover-texto popover-fase">
        <Glifo n={glifoFase(b.data?.fase)} tam={16} />
        {fmt.fase(b.data?.fase)}
      </p>
      <Par rotulo={t('barra.data.mes')} valor={t('barra.data.mesDe', { mes: b.data?.mes ?? 1 })} />
      <Par rotulo={t('barra.data.anoNovo', { ano })} valor={fmt.contagem(tiques, b.mult)} glifo={b.velocidade === 0 ? 'pausa' : null} />
      <p class="popover-nota">{t('barra.data.escala')}</p>
      <p class="popover-nota">{t('barra.data.emprestimo')}</p>
    </>
  );
}

/**
 * Menu enquanto a tela 'menu' (U1b) não existe: as telas de gestão já registradas e o aviso do resto. Assim o botão
 * do canto nunca fica mudo na prévia.
 */
function PopMenu({ ui, fechar }) {
  const telas = GESTAO.filter((id) => ui.telas().includes(id));
  return (
    <>
      {telas.length ? (
        <div class="popover-lista">
          {telas.map((id) => (
            <Botao a="barra.menu.tela" k={id} rotulo={t(`barra.tela.${id}`)} class="popover-item" onClick={() => { fechar(); ui.abrirTela(id); }}>
              <Glifo n={GLIFO_TELA[id] ?? 'setaDir'} tam={18} />
              <span>{t(`barra.tela.${id}`)}</span>
            </Botao>
          ))}
        </div>
      ) : null}
      <p class="popover-nota">{t('app.emBreve')}</p>
    </>
  );
}

/** Entra no lugar 'cima' da interface (ui/index.jsx), trocando a barra mínima da F0. */
export function registrar(ui) {
  ui.registrarHud('cima', BarraCima, { ordem: 0, nome: 'barra' });
}
