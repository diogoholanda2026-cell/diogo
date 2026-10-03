// Corpo das Configurações (desenho da UI 8.17; D31, D42, D66 e D70; dona: U2a), sob demanda. Abas numa coluna à
// esquerda e linhas de 52 px à direita: rótulo 15/600, explicação 12/500 e o controle à direita.
//   Vídeo: qualidade (Auto, Ultra, Alta, PC, Média, Leve, cada uma com o orçamento) com "Manter esta qualidade? 10 s"
//     (volta sozinha), resolução dinâmica e nitidez (CAS) da PC1 e da PC2, "Sempre dia", painel de desempenho (F9) e
//     o Teste de desempenho.
//   Interface, Controles (mira, borda do mouse e as teclas), Som (5 canais, segundo plano, vibração), Jogo (salvamento
//   automático, dicas), Acessibilidade, Salvamento (salvar, saves, exportar, importar, armazenamento, recomeçar) e
//   Sobre (versão, placa, capacidades e licenças).
// Teclado: Page Up e Page Down (ou [ e ]) trocam a aba; Esc fecha.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { avisar } from '../../loja.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Segmentado } from '../../comp/Segmentado.jsx';
import { Deslizante } from '../../comp/Deslizante.jsx';
import { DoisToques } from '../../comp/DoisToques.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Abas } from '../../comp/Abas.jsx';
import { ORCAMENTO } from '../../../contratos/render.js';
import { VOLUME_PADRAO } from '../../../som/som.js';
import { teclas, ehToque, irPara } from '../estado.js';
import { usarEstilo } from '../estilo.js';
import { CSS_CORPO } from './estilo.js';
import { mudarPrefs, rotuloSlot, exportarSave } from './comum.js';
import { fraseFalha } from './Carregar.jsx';

export const ABAS = Object.freeze(['video', 'interface', 'controles', 'som', 'jogo', 'acessibilidade', 'salvamento', 'sobre']);
export const QUALIDADES = Object.freeze(['auto', 'ultra', 'alta', 'pc', 'media', 'leve']);
/** Segundos do "Manter esta qualidade?" (volta sozinha se o aparelho travar). */
export const MANTER_S = 10;

/** Orçamento de uma qualidade, escrito: 'até 800 chamadas e 2,5 mi triângulos'. */
export function orcamentoEscrito(id) {
  const o = ORCAMENTO[id];
  if (!o) return '';
  return t('u2.cfg.orcamento', { calls: fmt.numero(o.calls), tris: fmt.curto(o.tris) });
}

/**
 * "Manter esta qualidade?": { de, para, resta } enquanto a troca não foi confirmada. O relógio é do módulo, não da
 * aba: trocar de aba ou fechar a tela não confirma a troca; sem "Manter", a qualidade volta sozinha.
 */
export const manter = signal(null);
let relogioManter = null;

function pararManter() {
  clearInterval(relogioManter);
  relogioManter = null;
  manter.value = null;
}

/** Volta à qualidade de antes (o fim da contagem ou "Voltar"). */
function voltarQualidade(ui) {
  const m = manter.peek();
  pararManter();
  if (!m) return;
  mudarPrefs(ui, { qualidade: m.de });
  avisar({ texto: t('u2.cfg.voltou', { nome: t(`u2.q.${m.de}`) }), gravidade: 'info', glifo: 'ajustes' });
}

/** Troca a qualidade e começa (ou continua) a contagem; voltar à de antes encerra sem perguntar. */
export function trocarQualidade(ui, nova) {
  const q = ui.loja.prefs.peek()?.qualidade ?? 'auto';
  if (nova === q) return;
  const de = manter.peek()?.de ?? q;
  mudarPrefs(ui, { qualidade: nova });
  if (nova === de) return pararManter();
  manter.value = { de, para: nova, resta: MANTER_S };
  if (relogioManter) return;
  relogioManter = setInterval(() => {
    const m = manter.peek();
    if (!m) return pararManter();
    if (m.resta <= 1) voltarQualidade(ui);
    else manter.value = { ...m, resta: m.resta - 1 };
  }, 1000);
}

/** A próxima aba (passo +1 ou -1, dando a volta). */
export const abaVizinha = (aba, passo) => ABAS[(ABAS.indexOf(aba) + passo + ABAS.length) % ABAS.length];

function Linha({ rotulo, exp = null, children, k }) {
  return (
    <div class="cfg-linha" data-cfg={k}>
      <span class="cfg-textos">
        <span class="cfg-rot">{rotulo}</span>
        {exp ? <span class="cfg-exp">{exp}</span> : null}
      </span>
      <span class="cfg-ctl">{children}</span>
    </div>
  );
}

/** Interruptor da linha: o rótulo já está à esquerda, ao lado do trilho fica só o estado ("ligado"). */
function Chave({ k, rotulo, ligado, aoTrocar, desligado = false, dica }) {
  const estado = t(ligado ? 'comp.ligado' : 'comp.desligado');
  return (
    <Botao a="cfg.liga" k={k} rotulo={`${rotulo}: ${estado}`} role="switch" aria-checked={String(!!ligado)} class={`interruptor${ligado ? ' ligado' : ''}`} desligado={desligado} dica={dica} onClick={() => aoTrocar(!ligado)}>
      <span class="interruptor-trilho" aria-hidden="true">
        <span class="interruptor-bola" />
      </span>
      <span class="interruptor-texto">
        <b>{estado}</b>
      </span>
    </Botao>
  );
}

function Liga({ ui, k, padrao = false, rotulo, exp }) {
  const p = ui.loja.prefs.value ?? {};
  const v = p[k] ?? padrao;
  return (
    <Linha rotulo={rotulo} exp={exp} k={k}>
      <Chave k={k} rotulo={rotulo} ligado={!!v} aoTrocar={(x) => mudarPrefs(ui, { [k]: x })} />
    </Linha>
  );
}

// ------------------------------------------------------------------------------------------------ vídeo

function Video({ ui, noInicio }) {
  const p = ui.loja.prefs.value ?? {};
  const R = ui.R;
  const perfil = R?.perfil?.() ?? {};
  const pendente = manter.value;
  const [res, setRes] = useState(() => R?.stats?.resolucao ?? null);
  useEffect(() => {
    const id = setInterval(() => setRes(R?.stats?.resolucao ? { ...R.stats.resolucao } : null), 1000);
    return () => clearInterval(id);
  }, []);
  const q = p.qualidade ?? 'auto';
  const sugerido = perfil.sugerido ?? 'media';
  const expQ = q === 'auto' ? t('u2.cfg.qAuto', { nome: t(`u2.q.${sugerido}`), gpu: perfil.gpu || t('u2.cfg.semPlaca'), orcamento: orcamentoEscrito(sugerido) }) : t(`u2.cfg.qExp.${q}`, { orcamento: orcamentoEscrito(q) });
  const dinamica = p.resolucaoDinamica !== false;
  // o pedido ao render (R.resolucao, pendência da R1a): sem ele os dois controles ficam à vista, desligados e com o
  // motivo, e a leitura ao vivo continua (nada de controle que parece mudar e não muda)
  const podeResolucao = typeof R?.resolucao === 'function';
  const semAjuste = podeResolucao ? '' : ` ${t('u2.cfg.resPendente')}`;
  const pct = res?.nativa?.w ? Math.round((100 * res.w) / res.nativa.w) : null;
  const agora = res && pct ? t('u2.cfg.resAgora', { w: res.w, h: res.h, pct, modo: t(`u2.cfg.resModo.${res.modo ?? 'quadro'}`) }) : t('u2.cfg.resSem');
  return (
    <div class="cfg-corpo">
      <Linha rotulo={t('u2.cfg.qualidade')} exp={expQ} k="qualidade">
        <Segmentado a="cfg.qualidade" rotulo={t('u2.cfg.qualidade')} valor={q} aoTrocar={(nova) => trocarQualidade(ui, nova)} opcoes={QUALIDADES.map((v) => ({ v, rotulo: t(`u2.q.${v}`) }))} />
      </Linha>
      {pendente ? (
        <div class="cfg-manter" role="alert" data-a="cfg.manter">
          <b>{t('u2.cfg.manter', { s: pendente.resta })}</b>
          <Botao a="cfg.manterSim" rotulo={t('u2.cfg.manterSim')} class="bt-pri" onClick={pararManter}>
            {t('u2.cfg.manterSim')}
          </Botao>
          <Botao a="cfg.manterNao" rotulo={t('u2.cfg.manterNao')} class="bt-sec" onClick={() => voltarQualidade(ui)}>
            {t('u2.cfg.manterNao')}
          </Botao>
        </div>
      ) : null}
      <Linha rotulo={t('u2.cfg.dinamica')} exp={`${t('u2.cfg.dinamicaExp')} ${agora}${semAjuste}`} k="resolucaoDinamica">
        <Chave k="resolucaoDinamica" rotulo={t('u2.cfg.dinamica')} ligado={dinamica} desligado={!podeResolucao} dica={podeResolucao ? undefined : t('u2.cfg.resPendente')} aoTrocar={(v) => mudarPrefs(ui, { resolucaoDinamica: v })} />
      </Linha>
      <Linha rotulo={t('u2.cfg.nitidez')} exp={`${t('u2.cfg.nitidezExp', { cas: res?.cas ? fmt.numero(res.cas, 2) : '0' })}${semAjuste}`} k="nitidez">
        {podeResolucao ? (
          <Segmentado a="cfg.nitidez" rotulo={t('u2.cfg.nitidez')} valor={p.nitidez ?? 'auto'} aoTrocar={(v) => mudarPrefs(ui, { nitidez: v })} opcoes={[{ v: 'auto', rotulo: t('u2.cfg.nitidezAuto') }, { v: 'desligada', rotulo: t('u2.cfg.nitidezNao') }]} />
        ) : (
          <Botao a="cfg.nitidez" k="auto" rotulo={t('u2.cfg.nitidezAuto')} class="bt-sec" desligado dica={t('u2.cfg.resPendente')}>
            {t('u2.cfg.nitidezAuto')}
          </Botao>
        )}
      </Linha>
      <Liga ui={ui} k="sempreDia" rotulo={t('u2.cfg.sempreDia')} exp={t('u2.cfg.sempreDiaExp')} />
      <Liga ui={ui} k="painel" rotulo={t('u2.cfg.painel')} exp={t('u2.cfg.painelExp')} />
      <Linha rotulo={t('u2.cfg.teste')} exp={t(noInicio ? 'u2.cfg.testeNoInicio' : 'u2.cfg.testeExp')} k="teste">
        <Botao a="cfg.teste" rotulo={t('u2.cfg.testeAbrir')} class="bt-sec" desligado={noInicio || !ui.telas().includes('testeDesempenho')} dica={noInicio ? t('u2.cfg.testeNoInicio') : undefined} onClick={() => ui.abrirTela('testeDesempenho')}>
          <Glifo n="grafico" tam={18} />
          <span>{t('u2.cfg.testeAbrir')}</span>
        </Botao>
      </Linha>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ outras abas

function Interface({ ui }) {
  const p = ui.loja.prefs.value ?? {};
  const toque = ehToque();
  const tamanhos = [...(toque ? [] : [0.9]), 1, 1.12, 1.25];
  return (
    <div class="cfg-corpo">
      <Linha rotulo={t('u2.cfg.tamanho')} exp={t('u2.cfg.tamanhoExp')} k="tamanho">
        <Segmentado a="cfg.tamanho" rotulo={t('u2.cfg.tamanho')} valor={p.tamanho ?? 1} aoTrocar={(v) => mudarPrefs(ui, { tamanho: v })} opcoes={tamanhos.map((v) => ({ v, rotulo: fmt.pct(v) }))} />
      </Linha>
      <Liga ui={ui} k="pausarTelas" padrao={toque} rotulo={t('u2.cfg.pausarTelas')} exp={t('u2.cfg.pausarTelasExp')} />
      <Liga ui={ui} k="cenasMarco" padrao rotulo={t('u2.cfg.cenasMarco')} exp={t('u2.cfg.cenasMarcoExp')} />
      {toque ? null : <Liga ui={ui} k="cartaoNoPC" rotulo={t('u2.cfg.cartaoNoPC')} exp={t('u2.cfg.cartaoNoPCExp')} />}
    </div>
  );
}

const TECLAS = ['espaco', 'velocidades', 'mover', 'girar', 'categorias', 'empresas', 'telas', 'construir', 'desfazer', 'esc', 'f9'];

function Controles({ ui }) {
  const p = ui.loja.prefs.value ?? {};
  const toque = ehToque();
  return (
    <div class="cfg-corpo">
      <Linha rotulo={t('u2.cfg.mira')} exp={t('u2.cfg.miraExp')} k="mira">
        <Segmentado a="cfg.mira" rotulo={t('u2.cfg.mira')} valor={p.mira ?? 56} aoTrocar={(v) => mudarPrefs(ui, { mira: v })} opcoes={[0, 40, 56, 72].map((v) => ({ v, rotulo: `${v} px` }))} />
      </Linha>
      {toque ? null : <Liga ui={ui} k="bordaMouse" rotulo={t('u2.cfg.borda')} exp={t('u2.cfg.bordaExp')} />}
      <Secao titulo={t('u2.cfg.teclas')}>
        <div class="cfg-teclas">
          {TECLAS.map((k) => [<b class="num">{t(`u2.tecla.${k}`)}</b>, <span>{t(`u2.tecla.${k}.def`)}</span>])}
        </div>
      </Secao>
    </div>
  );
}

const CANAIS_SOM = ['som', 'musica', 'ambiente', 'efeitos', 'interface'];

function Som({ ui }) {
  const p = ui.loja.prefs.value ?? {};
  const pctFmt = (v) => fmt.pct(v / 100);
  return (
    <div class="cfg-corpo">
      {CANAIS_SOM.map((k) => (
        <Linha rotulo={t(`u2.som.${k}`)} k={k}>
          <Deslizante a={`cfg.som.${k}`} rotulo={t(`u2.som.${k}`)} min={0} max={100} passo={5} valor={Math.round(100 * (p[k] ?? VOLUME_PADRAO[k]))} formato={pctFmt} aoMudar={(v) => mudarPrefs(ui, { [k]: v / 100 })} />
        </Linha>
      ))}
      <Liga ui={ui} k="silenciarFundo" padrao rotulo={t('u2.som.fundo')} exp={t('u2.som.fundoExp')} />
      <Liga ui={ui} k="vibrar" padrao rotulo={t('u2.som.vibrar')} exp={t('u2.som.vibrarExp')} />
    </div>
  );
}

function Jogo({ ui }) {
  return (
    <div class="cfg-corpo">
      <Liga ui={ui} k="autoSalvar" padrao rotulo={t('u2.cfg.autoSalvar')} exp={t('u2.cfg.autoSalvarExp')} />
      <Liga ui={ui} k="dicas" padrao rotulo={t('u2.cfg.dicas')} exp={t('u2.cfg.dicasExp')} />
      <Linha rotulo={t('u2.cfg.dicasDeNovo')} exp={t('u2.cfg.dicasDeNovoExp')} k="dicasVistas">
        <Botao a="cfg.dicasDeNovo" rotulo={t('u2.cfg.dicasDeNovo')} class="bt-sec" onClick={() => (mudarPrefs(ui, { dicasVistas: [], dicas: true }), avisar({ texto: t('u2.cfg.dicasVoltam'), gravidade: 'info' }))}>
          {t('u2.cfg.dicasDeNovoBt')}
        </Botao>
      </Linha>
      <Linha rotulo={t('u2.cfg.calendario')} exp={t('u2.cfg.calendarioExp', { data: fmt.dataCalendario({ mes: 1, ano: 1 }) })} k="calendario" />
    </div>
  );
}

function Acessibilidade({ ui }) {
  const p = ui.loja.prefs.value ?? {};
  const mov = p.reduzirMovimento === true ? 'sim' : p.reduzirMovimento === false ? 'nao' : 'sistema';
  return (
    <div class="cfg-corpo">
      <Liga ui={ui} k="contraste" rotulo={t('u2.cfg.contraste')} exp={t('u2.cfg.contrasteExp')} />
      <Linha rotulo={t('u2.cfg.movimento')} exp={t('u2.cfg.movimentoExp')} k="reduzirMovimento">
        <Segmentado a="cfg.movimento" rotulo={t('u2.cfg.movimento')} valor={mov} aoTrocar={(v) => mudarPrefs(ui, { reduzirMovimento: v === 'sim' ? true : v === 'nao' ? false : null })} opcoes={['sistema', 'sim', 'nao'].map((v) => ({ v, rotulo: t(`u2.cfg.mov.${v}`) }))} />
      </Linha>
    </div>
  );
}

function Salvamento({ ui, noInicio, fechar }) {
  const jogo = ui.jogo;
  const [arm, setArm] = useState(null);
  const [q, setQ] = useState(0);
  const arquivo = useRef(null);
  const noJogo = !noInicio && !!jogo?.temPartida?.();
  useEffect(() => {
    jogo?.armazenamento?.().then(setArm, () => setArm(null));
    jogo?.quarentena?.().then((l) => setQ(l?.length ?? 0), () => setQ(0));
  }, []);
  const salvar = async () => {
    const r = await jogo.salvar('manual');
    avisar({ texto: r?.ok ? t('u2.sv.salvoEm', { espaco: rotuloSlot(r.slot) }) : fraseFalha(r), gravidade: r?.ok ? 'info' : 'atencao', glifo: 'salvar' });
  };
  const abrirSaves = () => (noInicio ? irPara('carregar') : ui.abrirTela('carregar'));
  const exportar = async () => {
    const r = await exportarSave(jogo, null, { compartilhar: ehToque() });
    avisar({ texto: r?.ok ? t('u2.sv.exportado', { nome: r.nome }) : fraseFalha(r), gravidade: r?.ok ? 'info' : 'atencao', glifo: 'exportar' });
  };
  const importar = async (ev) => {
    const f = ev.currentTarget.files?.[0];
    ev.currentTarget.value = '';
    if (!f) return;
    const r = await jogo.importar(f);
    if (r?.ok) {
      fechar?.();
      if (noInicio) irPara('menu');
    }
    avisar({ texto: r?.ok ? t('u2.sv.importado') : t('u2.sv.naoImportou', { motivo: fraseFalha(r) }), gravidade: r?.ok ? 'info' : 'atencao', glifo: 'carregar' });
  };
  const recomecar = async () => {
    const h = ui.consultar?.('holding') ?? {};
    const est = jogo.salvamento?.estado?.() ?? {};
    await jogo.novaPartida({ nome: h.nome || undefined, cor: h.cor || undefined, criador: est.criador ?? undefined, modo: 'normal' });
    fechar?.();
  };
  const persistente = arm?.persistente === true ? t('u2.cfg.persSim') : arm?.persistente === false ? t('u2.cfg.persNao') : t('u2.cfg.persSem');
  const usado = Number.isFinite(arm?.usadoMB) ? t('u2.cfg.usado', { mb: fmt.numero(arm.usadoMB, 1) }) : '';
  return (
    <div class="cfg-corpo">
      {noJogo ? (
        <Linha rotulo={t('u2.cfg.salvarAgora')} exp={t('u2.cfg.salvarAgoraExp')} k="salvar">
          <Botao a="cfg.salvar" rotulo={t('u2.cfg.salvarAgora')} class="bt-pri" onClick={salvar}>
            <Glifo n="salvar" tam={18} />
            <span>{t('u2.cfg.salvarBt')}</span>
          </Botao>
        </Linha>
      ) : null}
      <Linha rotulo={t('u2.cfg.saves')} exp={t('u2.cfg.savesExp')} k="saves">
        <Botao a="cfg.saves" rotulo={t('u2.cfg.saves')} class="bt-sec" onClick={abrirSaves}>
          <Glifo n="carregar" tam={18} />
          <span>{t('u2.cfg.savesBt')}</span>
        </Botao>
      </Linha>
      <Linha rotulo={t('u2.cfg.exportar')} exp={t('u2.cfg.exportarExp')} k="exportar">
        <Botao a="cfg.exportar" rotulo={t('u2.cfg.exportar')} class="bt-sec" onClick={exportar}>
          <Glifo n="exportar" tam={18} />
          <span>{t('u2.sv.exportar')}</span>
        </Botao>
      </Linha>
      <Linha rotulo={t('u2.cfg.importar')} exp={t('u2.cfg.importarExp')} k="importar">
        <Botao a="cfg.importar" rotulo={t('u2.cfg.importar')} class="bt-sec" onClick={() => arquivo.current?.click()}>
          <Glifo n="carregar" tam={18} />
          <span>{t('u2.sv.importar')}</span>
        </Botao>
        <input ref={arquivo} type="file" accept=".held,application/octet-stream" hidden onChange={importar} />
      </Linha>
      <Linha rotulo={t('u2.cfg.armazenamento')} exp={`${persistente}${usado ? ` · ${usado}` : ''}${q ? ` · ${t('u2.cfg.quarentena', { n: q })}` : ''}`} k="armazenamento" />
      {noJogo ? (
        <Linha rotulo={t('u2.cfg.recomecar')} exp={t('u2.cfg.recomecarExp')} k="recomecar">
          <DoisToques a="cfg.recomecar" rotulo={t('u2.cfg.recomecarBt')} rotuloArmado={t('u2.cfg.recomecarArmado')} glifo="desfazer" perigo aoConfirmar={recomecar} />
        </Linha>
      ) : null}
    </div>
  );
}

function Sobre({ ui }) {
  const R = ui.R;
  const perfil = R?.perfil?.() ?? {};
  const capac = perfil.capac ?? R?.stats?.capac ?? {};
  const versao = typeof window !== 'undefined' ? window.__HELD_MONTAGEM__?.versao ?? t('u2.cfg.semVersao') : '';
  const sim = (b) => t(b ? 'u2.sim' : 'u2.nao');
  const linhas = [
    ['versao', versao],
    ['perfil', `${t(`u2.q.${perfil.id ?? 'media'}`)} · ${t('u2.cfg.sugerido', { nome: t(`u2.q.${perfil.sugerido ?? 'media'}`) })}`],
    ['placa', perfil.gpu || t('u2.cfg.semPlaca')],
    ['capacidades', t('u2.cfg.capac', { clip: sim(capac.clipControl), multi: sim(capac.multiDraw), timer: sim(capac.timer) })],
    ['licencas', t('u2.cfg.licencasExp')],
  ];
  return (
    <div class="cfg-corpo">
      {linhas.map(([k, v]) => <Linha rotulo={t(`u2.cfg.sobre.${k}`)} exp={v} k={k} />)}
    </div>
  );
}

const CORPOS = { video: Video, interface: Interface, controles: Controles, som: Som, jogo: Jogo, acessibilidade: Acessibilidade, salvamento: Salvamento, sobre: Sobre };

let abaLembrada = 'video';

/** A tela inteira (no jogo pelo menu; no início pelo menu inicial, com noInicio). */
export default function Configuracoes({ ui, fechar, noInicio = false }) {
  const [aba, setAba] = useState(abaLembrada);
  useEffect(() => usarEstilo('corpo-u2', CSS_CORPO), []);
  useLayoutEffect(() => {
    abaLembrada = aba;
    const fn = (ev) => {
      const alvo = ev.target;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) && alvo.type !== 'range') return false;
      const passo = ev.key === 'PageDown' || ev.key === ']' ? 1 : ev.key === 'PageUp' || ev.key === '[' ? -1 : 0;
      if (passo) {
        ev.preventDefault();
        setAba(abaVizinha(aba, passo));
        return true;
      }
      if (noInicio && ev.key === 'Escape') {
        fechar();
        return true;
      }
      return false;
    };
    if (noInicio) {
      teclas.atual = fn;
      return () => {
        if (teclas.atual === fn) teclas.atual = null;
      };
    }
    addEventListener('keydown', fn);
    return () => removeEventListener('keydown', fn);
  }, [aba, noInicio]);
  const Corpo = CORPOS[aba] ?? Video;
  return (
    <Tela id="configuracoes" glifo="ajustes" titulo={t('u2.cfg.titulo')} aoFechar={fechar} class={noInicio ? 'tela-inicio' : ''}>
      <div class="cfg-layout">
        <Abas abas={ABAS.map((id) => ({ id, rotulo: t(`u2.cfg.aba.${id}`) }))} ativa={aba} aoTrocar={setAba} a="configuracoes.aba" rotulo={t('u2.cfg.titulo')} class="cfg-abas" />
        <div class="cfg-painel" role="tabpanel" aria-label={t(`u2.cfg.aba.${aba}`)}>
          <Corpo ui={ui} noInicio={noInicio} fechar={fechar} />
          {ehToque() ? null : <p class="cfg-dica">{t('u2.cfg.teclasAbas')}</p>}
        </div>
      </div>
    </Tela>
  );
}
