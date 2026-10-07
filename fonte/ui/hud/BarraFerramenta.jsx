// Barra da ferramenta ativa (desenho da UI 8.5, o painel de opções da ferramenta do CS2): toma a barra de baixo
// inteira enquanto uma ferramenta está aberta. Polegar esquerdo: Cancelar e Desfazer (com quantas ações a sessão
// guarda). Meio: as opções da ferramenta em cima e, embaixo, o total ("124 m · US$ 2,2 mi · manutenção 12/h") ou
// o motivo quando não dá. Polegar direito: a ação principal, 108 x 52 (Construir, Melhorar, Pronto, Demolir com dois
// toques quando há prédio da Holding, Comprar). Inválido fica fraco, continua tocável e diz o motivo no rótulo.
import { computed } from '@preact/signals';
import { Botao } from '../comp/Botao.jsx';
import { Segmentado } from '../comp/Segmentado.jsx';
import { Chip } from '../comp/Chip.jsx';
import { DoisToques } from '../comp/DoisToques.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { barra } from '../loja.js';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { VIAS } from '../../data/vias.js';
import { ZONAS } from '../../data/zonas.js';
import { sessao, categoria, ferramentas } from '../ferramentas/sessao.js';
import { MODOS_VIA } from '../ferramentas/via.js';
import { MODOS_ZONA, TAMANHOS_PINCEL, zonasDaParte } from '../ferramentas/zona.js';
import { pedeDoisToques } from '../ferramentas/demolir.js';
import { Bandeja, COR_FAMILIA } from './Bandeja.jsx';

const demanda = computed(() => barra.value?.demanda ?? { R: 0, C: 0, I: 0, E: 0 });
const GLIFO_MODO = Object.freeze({ reta: 'reta', curva: 'curva', grade: 'grade', melhorar: 'melhorar' });
const ORDEM_TAMANHO = Object.keys(TAMANHOS_PINCEL);
/** P, M, G e volta ao P. */
export const proximoTamanho = (tam) => ORDEM_TAMANHO[(ORDEM_TAMANHO.indexOf(tam) + 1) % ORDEM_TAMANHO.length];
const porHora = (v) => fmt.dinheiroPorHora(v ?? 0);
const mouse = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

// ------------------------------------------------------------------------------------------------ textos (puros)

/** Linha de baixo da via: total da prévia, motivo ou a dica da fase. { texto, estado: 'er' | null } */
export function linhaVia(s) {
  const m = s.maquina;
  const p = s.previa;
  if (m.modo === 'melhorar') {
    if (!m.selecao.length) return { texto: t('x2.via.dica.melhorar'), estado: null };
    if (!p?.ok) return { texto: s.motivo ?? t('x2.via.melhorarNada'), estado: 'er' };
    const n = p.arestas.filter((a) => a.ok).length;
    const texto = t(n === 1 ? 'x2.via.melhorar1' : 'x2.via.melhorar', { n, m: fmt.numero(p.comprimento), custo: fmt.dinheiro(p.custo) });
    // "estimado" só quando a conta é da interface (a prévia da simulação não é estimativa)
    return { texto: p.estimado ? `${texto} · ${t('x2.estimado')}` : texto, estado: s.motivo ? 'er' : null };
  }
  if (p?.segmentos?.length && (m.fase === 'previa' || m.fase === 'arrastando' || m.fase === 'mirandoB' || (m.fase === 'aFixo' && m.b))) {
    const base = m.modo === 'grade'
      ? t('x2.via.grade', { n: p.segmentos.length, m: fmt.numero(p.comprimento), custo: fmt.dinheiro(p.custo) })
      : t('x2.via.total', { m: fmt.numero(p.comprimento), custo: fmt.dinheiro(p.custo) });
    const partes = [base, t('x2.manutencao', { v: porHora(p.manutencaoHora) })];
    const dem = p.demolir?.predios?.length ?? 0;
    if (dem) partes.push(t(dem === 1 ? 'x2.via.demolirPredio1' : 'x2.via.demolirPredios', { n: dem }));
    if (s.substituto) partes.push(t('x2.estimado'));
    if (s.motivo) return { texto: `${s.motivo} · ${base}`, estado: 'er' };
    return { texto: partes.join(' · '), estado: null };
  }
  const fase = m.fase === 'arrastando' ? 'previa' : m.fase;
  if (m.modo === 'grade' && fase === 'previa') return { texto: t('x2.via.dica.grade'), estado: null };
  const chaveMouse = `x2.via.dica.${fase}Mouse`;
  const k = mouse() && (fase === 'ocioso' || fase === 'aFixo') ? chaveMouse : `x2.via.dica.${fase}`;
  return { texto: t(k), estado: null };
}

/** Rótulo do botão principal (o motivo curto quando não dá). */
export function rotuloPrincipal(s) {
  if (s.tipo === 'zona') return t('x2.pronto');
  if (s.tipo === 'demolir') return t('x2.demolir');
  if (s.tipo === 'areas') return t('x2.comprar');
  const base = s.tipo === 'via' && s.maquina.modo === 'melhorar' ? t('x2.melhorar') : t('x2.construir');
  const pronto = s.tipo === 'via' ? !!s.previa?.segmentos?.length || s.maquina.modo === 'melhorar' : s.tipo === 'colocar' ? !!s.previa : true;
  return !s.valido && pronto && s.motivo ? s.motivo : base;
}

// ------------------------------------------------------------------------------------------------ opções por ferramenta

function OpcoesVia({ s }) {
  const m = s.maquina;
  const abertaTipo = categoria.value === 'vias';
  return (
    <div class="bf-opcoes">
      <Botao a="ferr.tipo" rotulo={`${t('x2.tipo')}: ${VIAS[m.tipo].nome}`} class={`bf-tipo chip chip-bt${abertaTipo ? ' aberta' : ''}`} aria-expanded={String(abertaTipo)} onClick={() => (categoria.value = abertaTipo ? null : 'vias')}>
        <Glifo n={m.tipo} tam={16} />
        <span class="chip-texto">{VIAS[m.tipo].nome}</span>
        <Glifo n="setaCima" tam={14} class="bf-seta" />
      </Botao>
      <Segmentado
        a="ferr.modo"
        rotulo={t('x2.modo')}
        valor={m.modo}
        aoTrocar={(v) => ferramentas.opcao({ modo: v })}
        opcoes={MODOS_VIA.map((v) => ({ v, rotulo: t(`x2.modo.${v}`), glifo: GLIFO_MODO[v] }))}
        class="bf-seg"
      />
      {m.modo === 'reta' || m.modo === 'curva' ? (
        <Chip a="ferr.continua" glifo="continua" texto={t('x2.continua')} ativo={m.continua} estado={m.continua ? 'ac' : null} class={m.continua ? 'ligado' : ''} onClick={() => ferramentas.opcao({ continua: !m.continua })} />
      ) : null}
      {m.modo !== 'melhorar' ? (
        <Chip a="ferr.encaixe" glifo="encaixe" texto={t('x2.encaixe')} ativo={m.encaixe} estado={m.encaixe ? 'ac' : null} class={m.encaixe ? 'ligado' : ''} onClick={() => ferramentas.opcao({ encaixe: !m.encaixe })} />
      ) : null}
    </div>
  );
}

function OpcoesZona({ s }) {
  const m = s.maquina;
  const d = demanda.value;
  const zonas = zonasDaParte();
  return (
    <div class="bf-opcoes">
      <div class="bf-zonas" role="radiogroup" aria-label={t('x2.zona.qual')}>
        {zonas.map((z) => {
          const lig = !m.apagar && m.zona === z;
          return (
            <Botao a="ferr.zona" k={z} rotulo={ZONAS[z].nome} role="radio" aria-checked={String(lig)} class={`bf-zona${lig ? ' ligado' : ''}`} onClick={() => ferramentas.opcao({ zona: z })}>
              <i class="bf-zona-cor" style={{ background: COR_FAMILIA[ZONAS[z].familia] }} data-densidade={ZONAS[z].densidade} />
              <span>{t(`x2.zonaCurta.${z}`)}</span>
            </Botao>
          );
        })}
        <Botao a="ferr.apagar" rotulo={t('x2.zona.apagar')} role="radio" aria-checked={String(m.apagar)} class={`bf-zona bf-zona-glifo${m.apagar ? ' ligado' : ''}`} onClick={() => ferramentas.opcao({ apagar: !m.apagar })}>
          <Glifo n="apagar" tam={18} />
        </Botao>
      </div>
      <Segmentado a="ferr.forma" rotulo={t('x2.zona.forma')} valor={m.modo} aoTrocar={(v) => ferramentas.opcao({ modo: v })} soGlifo opcoes={MODOS_ZONA.map((v) => ({ v, rotulo: t(`x2.zona.${v}`), glifo: v }))} class="bf-seg" />
      {m.modo === 'pincel' ? (
        <Botao a="ferr.tamanho" rotulo={`${t('x2.zona.tamanho')}: ${t(`x2.zona.${m.tamanho}`)}`} class="bf-tam chip chip-bt" onClick={() => ferramentas.opcao({ tamanho: proximoTamanho(m.tamanho) })}>
          <i class={`bf-tam-disco bf-tam-${m.tamanho}`} aria-hidden="true" />
          <span class="chip-texto">{t(`x2.zona.${m.tamanho}`)}</span>
        </Botao>
      ) : null}
      <span class="bf-demanda" aria-label={t('x2.zona.demanda')}>
        {['R', 'C', 'I'].concat(d.E > 0 ? ['E'] : []).map((k) => (
          <span class={`bf-dem bf-dem-${k}`} title={`${t('x2.zona.demanda')} ${k}`}>
            <b>{k}</b>
            <i style={{ transform: `scaleY(${Math.max(0.06, Math.min(1, (d[k] ?? 0) / 100))})` }} />
          </span>
        ))}
      </span>
    </div>
  );
}

function linhaZona(s) {
  const m = s.maquina;
  const p = s.previa;
  if (p?.celulas?.length) {
    const partes = [t(p.celulas.length === 1 ? 'x2.zona.celula1' : 'x2.zona.celulas', { n: fmt.numero(p.celulas.length) })];
    if (p.comPredio) partes.push(t('x2.zona.comPredio', { n: p.comPredio }));
    if (p.efeitoMedia) partes.push(t('x2.zona.efeito', { v: fmt.comSinal(p.efeitoMedia, 1) }));
    return partes.join(' · ');
  }
  return t(m.apagar ? 'x2.zona.dica.apagar' : `x2.zona.dica.${m.modo}`);
}

function OpcoesColocar({ s }) {
  return (
    <div class="bf-opcoes">
      <span class="bf-nome">
        <Glifo n={s.item?.glifo ?? 'servicos'} tam={18} />
        <b>{s.item?.nome ?? s.maquina.tipo}</b>
      </span>
      <Botao a="ferr.girar" rotulo={t('x2.girar')} class="bt-sec bt-curto" onClick={() => ferramentas.girar(1)}>
        <Glifo n="girar" tam={16} />
        <span>{t('x2.girar')}</span>
      </Botao>
    </div>
  );
}

function linhaColocar(s) {
  const p = s.previa;
  if (!p) return { texto: t('x2.colocar.dica'), estado: null };
  if (!p.ok) return { texto: s.motivo ?? t('x2.motivo.outro'), estado: 'er' };
  const partes = [t('x2.colocar.custo', { custo: fmt.dinheiro(p.custo ?? s.item?.custo ?? 0) })];
  if (p.manutencaoHora || s.item?.manutencaoHora) partes.push(t('x2.manutencao', { v: porHora(p.manutencaoHora ?? s.item?.manutencaoHora) }));
  if (p.alcance) partes.push(t('x2.colocar.alcance', { m: fmt.numero(p.alcance) }));
  if (s.substituto) partes.push(t('x2.estimado'));
  return { texto: partes.join(' · '), estado: null };
}

function linhasDemolir(s) {
  const r = s.resumo;
  if (!s.maquina.marcados.length || !r) return [t('x2.demolir.dica'), ''];
  const nm = s.maquina.marcados.length;
  const cima = [t(nm === 1 ? 'x2.demolir.marcado1' : 'x2.demolir.marcados', { n: nm })];
  if (r.holding) cima.push(t('x2.demolir.holding'));
  const baixo = [];
  if (r.predios) baixo.push(t('x2.demolir.perde', { mor: fmt.numero(r.moradores), emp: fmt.numero(r.empregos) }));
  if (r.arestas) baixo.push(t(r.arestas === 1 ? 'x2.demolir.via1' : 'x2.demolir.vias', { n: r.arestas, m: fmt.numero(r.metros) }), t('x2.demolir.volta', { v: fmt.dinheiro(r.voltaVias) }));
  return [cima.join(' · '), baixo.join(' · ')];
}

function linhasAreas(s) {
  const i = s.info;
  if (!i) return [t('x2.areas.dica'), ''];
  const titulo = t('x2.areas.titulo', { i: i.i, j: i.j });
  if (i.estado === 'holding') return [titulo, t('x2.areas.holding')];
  if (i.estado === 'trancado') return [titulo, t('x2.areas.trancada')];
  const partes = [t('x2.areas.preco', { preco: fmt.dinheiro(i.preco) })];
  if (i.desconto > 0) partes.push(t('x2.areas.desconto', { pct: fmt.pct(i.desconto) }));
  return [titulo, partes.join(' · ')];
}

// ------------------------------------------------------------------------------------------------ barra

function Principal({ s }) {
  const rot = rotuloPrincipal(s);
  const fraco = !s.valido && s.tipo !== 'zona';
  const glifo = s.tipo === 'demolir' ? 'demolir' : s.tipo === 'zona' ? 'check' : s.tipo === 'areas' ? 'mapa' : 'construir';
  if (s.tipo === 'demolir' && s.valido && pedeDoisToques(s.maquina)) {
    return <DoisToques a="ferr.principal" rotulo={rot} glifo="demolir" perigo aoConfirmar={() => ferramentas.construir()} />;
  }
  const classe = s.tipo === 'demolir' ? 'bt-perigo' : s.tipo === 'areas' ? 'bt-ch' : 'bt-pri';
  return (
    <Botao a="ferr.principal" rotulo={rot} principal aria-disabled={fraco ? 'true' : undefined} class={`${classe} bf-principal${fraco ? ' fraco' : ''}`} onClick={() => ferramentas.construir()}>
      <Glifo n={glifo} tam={18} />
      <span class="bf-principal-rot">{rot}</span>
    </Botao>
  );
}

function BarraFerramenta({ ui }) {
  const s = sessao.value;
  if (!s) return null;
  let opcoes = null;
  let linha = { texto: '', estado: null };
  if (s.tipo === 'via') {
    opcoes = <OpcoesVia s={s} />;
    linha = linhaVia(s);
  } else if (s.tipo === 'zona') {
    opcoes = <OpcoesZona s={s} />;
    linha = { texto: linhaZona(s), estado: null };
  } else if (s.tipo === 'colocar') {
    opcoes = <OpcoesColocar s={s} />;
    linha = linhaColocar(s);
  } else {
    const [cima, baixo] = s.tipo === 'demolir' ? linhasDemolir(s) : linhasAreas(s);
    opcoes = (
      <div class="bf-opcoes">
        <span class="bf-nome">
          <Glifo n={s.tipo === 'demolir' ? 'demolir' : 'mapa'} tam={18} />
          <b>{cima}</b>
        </span>
      </div>
    );
    linha = { texto: baixo, estado: null };
  }
  const bandejaVias = s.tipo === 'via' && categoria.value === 'vias';
  return (
    <div class="barra-ferr-pilha">
      {bandejaVias ? <Bandeja ui={ui} cat="vias" lado="esquerda" /> : null}
      <div class="barra-ferr vidro" data-hud="ferramenta" role="toolbar" aria-label={t(`x2.ferramenta.${s.tipo}`)}>
        <div class="bf-esq">
          <Botao a="ferr.cancelar" rotulo={s.maquina?.fase === 'ocioso' || s.tipo !== 'via' ? t('x2.sair') : t('x2.cancelar')} class="bt-glifo bf-bt" onClick={() => ferramentas.cancelar()}>
            <Glifo n="cancelar" tam={22} />
          </Botao>
          <Botao a="ferr.desfazer" rotulo={s.desfazer ? t('x2.desfazerN', { n: s.desfazer }) : t('x2.desfazer')} aria-disabled={s.desfazer ? undefined : 'true'} class="bt-glifo bf-bt" onClick={() => ferramentas.desfazer()}>
            <Glifo n="desfazer" tam={22} />
            {s.desfazer ? <b class="bf-n num">{s.desfazer}</b> : null}
          </Botao>
        </div>
        <div class="bf-meio">
          {opcoes}
          <p class={`bf-linha num${linha.estado ? ` tx-${linha.estado}` : ''}`}>
            {linha.estado ? <Glifo n="alerta" tam={14} /> : null}
            <span>{linha.texto}</span>
          </p>
        </div>
        <div class="bf-dir">
          <Principal s={s} />
        </div>
      </div>
    </div>
  );
}

export function registrar(ui) {
  ui.registrarHud('baixo', BarraFerramenta, { ordem: 95, nome: 'barra-ferramenta' });
  // glifo do Melhorar (a via sobe de tipo), no traço do registro
  ui.registrarGlifos({ melhorar: ['M4 19.5h16', 'M4 15.5h16', 'M12 12V3.5', 'M8.5 7 12 3.5 15.5 7'] });
}
