// Corpo do início (desenho da UI 7.6, 8.19 e 10.2; D58, D66, D67 e D77 a D83; dona: U2a), sob demanda: menu inicial
// sobre a capa do último save (Continuar com a Holding, a população, a data do calendário e há quanto tempo; Nova
// partida; Carregar; Configurações; Créditos), a nova partida (Holding Held e o criador Diogo Holanda preenchidos e
// editáveis, a cor da marca, o calendário que começa em jan. 2020), os saves, as configurações e os créditos. No
// mouse os atalhos ficam à vista (Enter, N, C, O, R; Esc volta); setas sobem e descem entre os botões.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { Botao } from '../../comp/Botao.jsx';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Interruptor } from '../../comp/Interruptor.jsx';
import { saves, irPara, ehToque, teclas, atualizarSaves } from '../estado.js';
import { entrarNaPartida } from '../carga.js';
import { Marca } from '../Entrada.jsx';
import { CORES_HOLDING, PARTIDA_PADRAO, MAX_NOME, conferirPartida } from '../NovaPartida.jsx';
import { usarEstilo } from '../estilo.js';
import { CSS_CORPO } from './estilo.js';
import { haQuanto, dataDoSave, mudarPrefs } from './comum.js';
import { ListaSaves, fraseFalha } from './Carregar.jsx';
import Configuracoes from './Configuracoes.jsx';
import { tocar } from '../../../som/interface.js';
import { vibrar } from '../../../som/som.js';

/** Liga as teclas de uma etapa enquanto ela está à vista (já no quadro em que ela aparece). */
function useTeclas(fn, deps = []) {
  useLayoutEffect(() => {
    teclas.atual = fn;
    return () => {
      if (teclas.atual === fn) teclas.atual = null;
    };
  }, deps);
}

/** Setas para cima e para baixo andam entre os botões da lista. */
function moverFoco(ev, raiz) {
  if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return false;
  const bts = [...(raiz?.querySelectorAll('.ini-bt') ?? [])].filter((b) => b.getAttribute('aria-disabled') !== 'true');
  if (!bts.length) return false;
  const i = bts.indexOf(document.activeElement);
  const prox = ev.key === 'ArrowDown' ? (i + 1) % bts.length : (i - 1 + bts.length) % bts.length;
  bts[i < 0 ? 0 : prox].focus();
  ev.preventDefault();
  return true;
}

function BotaoMenu({ a, titulo, sub = null, tecla, principal = false, desligado = false, dica, onClick }) {
  const linhas = sub ? [].concat(sub).filter(Boolean) : [];
  return (
    <Botao a={a} rotulo={linhas.length ? `${titulo}. ${linhas.join('. ')}` : titulo} class={`ini-bt ${principal ? 'bt-pri' : 'bt-sec'}`} desligado={desligado} dica={dica} onClick={onClick}>
      <span class="ini-bt-textos">
        <span class="ini-bt-titulo">{titulo}</span>
        {linhas.map((l) => (
          <span class="ini-bt-sub">{l}</span>
        ))}
      </span>
      {tecla && !ehToque() ? <kbd class="ini-tecla" aria-hidden="true">{tecla}</kbd> : null}
    </Botao>
  );
}

function Menu({ ui, estado }) {
  const lista = saves.value;
  const ultimo = lista[0] ?? null;
  const raiz = useRef(null);
  const ocupado = estado.ocupado;
  const podeContinuar = !!ultimo || !!ui.jogo?.temDiario?.();
  const continuar = () => !ocupado && podeContinuar && entrarNaPartida(ui, 'continuar');
  useTeclas((ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ocupado) return false;
    if (moverFoco(ev, raiz.current)) return true;
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    if (k === 'Enter' && ev.target?.closest?.('.ini-bt')) return false; // o botão com foco age sozinho
    const acao = { Enter: continuar, N: () => irPara('nova'), C: () => lista.length && irPara('carregar'), O: () => irPara('config'), R: () => irPara('creditos') }[k];
    if (!acao) return false;
    ev.preventDefault();
    acao();
    return true;
  }, [lista, ocupado]);
  useEffect(() => {
    raiz.current?.querySelector('.ini-bt')?.focus({ preventScroll: true });
    ui.R?.estado?.('coberto');
  }, []);
  const sub = ultimo ? [`${ultimo.nome || t('u2.holdingSemNome')} · ${t('u2.moradores', { n: fmt.populacao(ultimo.populacao ?? 0) })}`, `${dataDoSave(ultimo)} · ${t('u2.menu.salvo', { quando: haQuanto(ultimo.data) })}`] : null;
  const versao = typeof window !== 'undefined' ? window.__HELD_MONTAGEM__?.versao : null;
  return (
    <div class="ini-menu" ref={raiz} data-hud="inicio">
      <header class="ini-cab">
        <Marca />
        <div>
          <h1>{t('u2.jogo').toUpperCase()}</h1>
          <p>{t('u2.cidade')}</p>
        </div>
      </header>
      {estado.erro ? <p class="ini-erro" role="alert">{fraseFalha({ codigo: estado.erro })}</p> : null}
      <nav class="ini-botoes" aria-label={t('u2.menu.titulo')}>
        {podeContinuar ? (
          <BotaoMenu a="inicio.continuar" titulo={t(ocupado === 'continuar' ? 'u2.menu.abrindo' : 'u2.menu.continuar')} sub={sub} tecla="Enter" principal desligado={!!ocupado} onClick={continuar} />
        ) : null}
        <BotaoMenu a="inicio.nova" titulo={t('u2.menu.nova')} sub={podeContinuar ? null : t('u2.menu.novaSub')} tecla="N" principal={!podeContinuar} desligado={!!ocupado} onClick={() => irPara('nova')} />
        <BotaoMenu a="inicio.carregar" titulo={t('u2.menu.carregar')} tecla="C" desligado={!!ocupado || !lista.length} dica={lista.length ? undefined : t('u2.sv.nenhum')} onClick={() => irPara('carregar')} />
        <BotaoMenu a="inicio.config" titulo={t('u2.menu.config')} tecla="O" desligado={!!ocupado} onClick={() => irPara('config')} />
        <BotaoMenu a="inicio.creditos" titulo={t('u2.menu.creditos')} tecla="R" desligado={!!ocupado} onClick={() => irPara('creditos')} />
      </nav>
      <p class="ini-rodape">{versao ? t('u2.menu.versao', { v: versao }) : t('u2.menu.rodape')}</p>
    </div>
  );
}

function Nova({ ui, estado }) {
  const [nome, setNome] = useState(PARTIDA_PADRAO.nome);
  const [criador, setCriador] = useState(PARTIDA_PADRAO.criador);
  const [cor, setCor] = useState(PARTIDA_PADRAO.cor);
  const [invalido, setInvalido] = useState(null);
  const dicas = ui.loja.prefs.value?.dicas !== false;
  const ocupado = estado.ocupado;
  const primeiro = useRef(null);
  const comecar = async () => {
    if (ocupado) return;
    const c = conferirPartida({ nome, criador });
    if (!c.ok) {
      setInvalido(c.campo);
      tocar('erro');
      return;
    }
    vibrar(15);
    const r = await entrarNaPartida(ui, 'nova', { nome: c.nome, criador: c.criador, cor, modo: 'normal' });
    if (r?.ok) atualizarSaves(ui.jogo);
  };
  useTeclas((ev) => {
    if (ev.key === 'Escape') {
      irPara('menu');
      return true;
    }
    if (ev.key === 'Enter' && !ev.target?.closest?.('.bt')) {
      ev.preventDefault();
      comecar();
      return true;
    }
    return false;
  }, [nome, criador, cor, ocupado]);
  useEffect(() => primeiro.current?.focus({ preventScroll: true }), []);
  return (
    <Tela id="nova" glifo="holding" titulo={t('u2.nova.titulo')} aoFechar={() => irPara('menu')} class="tela-inicio">
      <div class="ini-form">
        <label class="ini-campo">
          <span>{t('u2.nova.nome')}</span>
          <input ref={primeiro} data-a="nova.nome" value={nome} maxLength={MAX_NOME} aria-invalid={invalido === 'nome' ? 'true' : 'false'} onInput={(ev) => (setNome(ev.currentTarget.value), setInvalido(null))} />
        </label>
        <label class="ini-campo">
          <span>{t('u2.nova.criador')}</span>
          <input data-a="nova.criador" value={criador} maxLength={40} aria-invalid={invalido === 'criador' ? 'true' : 'false'} onInput={(ev) => (setCriador(ev.currentTarget.value), setInvalido(null))} />
        </label>
        <div class="ini-campo ini-largo">
          <span>{t('u2.nova.cor')}</span>
          <div class="ini-cores" role="radiogroup" aria-label={t('u2.nova.cor')}>
            {CORES_HOLDING.map((c) => (
              <Botao a="nova.cor" k={c.id} rotulo={t(`u2.cor.${c.id}`)} role="radio" aria-checked={String(c.cor === cor)} class="ini-cor" style={{ background: c.cor }} onClick={() => setCor(c.cor)} />
            ))}
          </div>
        </div>
        <p class="ini-nota ini-largo">{t('u2.nova.mapa')}</p>
        <p class="ini-nota ini-largo">{t('u2.nova.calendario', { data: fmt.dataCalendario({ mes: 1, ano: 1 }) })}</p>
        <div class="ini-largo">
          <Interruptor a="nova.dicas" rotulo={t('u2.nova.dicas')} ligado={dicas} aoTrocar={(v) => mudarPrefs(ui, { dicas: v })} />
        </div>
        {invalido ? <p class="ini-erro ini-largo" role="alert">{t(`u2.nova.invalido.${invalido}`)}</p> : null}
        {estado.erro ? <p class="ini-erro ini-largo" role="alert">{fraseFalha({ codigo: estado.erro })}</p> : null}
        <div class="ini-acoes ini-largo">
          <Botao a="nova.comecar" rotulo={t('u2.nova.comecar')} class="bt-pri" principal desligado={!!ocupado} onClick={comecar}>
            <Glifo n="ir" tam={18} />
            <span>{t(ocupado ? 'u2.nova.comecando' : 'u2.nova.comecar')}</span>
          </Botao>
          <Botao a="nova.voltar" rotulo={t('comp.voltar')} class="bt-sec" onClick={() => irPara('menu')}>
            {t('comp.voltar')}
          </Botao>
        </div>
      </div>
    </Tela>
  );
}

function Carregar({ ui }) {
  useTeclas((ev) => {
    if (ev.key !== 'Escape') return false;
    irPara('menu');
    return true;
  });
  return (
    <Tela id="carregar" glifo="carregar" titulo={t('u2.carregar.titulo')} aoFechar={() => irPara('menu')} class="tela-inicio">
      <ListaSaves ui={ui} aoEntrar={(modo, op) => entrarNaPartida(ui, modo, op)} />
    </Tela>
  );
}

function Creditos() {
  useTeclas((ev) => {
    if (ev.key !== 'Escape') return false;
    irPara('menu');
    return true;
  });
  const linhas = ['criador', 'cidade', 'motor', 'fonte', 'interface', 'som'];
  return (
    <Tela id="creditos" glifo="info" titulo={t('u2.menu.creditos')} aoFechar={() => irPara('menu')} class="tela-inicio">
      <div class="cfg-corpo">
        <Secao titulo={t('u2.jogo')}>
          {linhas.map((k) => (
            <div class="cfg-linha">
              <span class="cfg-textos">
                <span class="cfg-rot">{t(`u2.cred.${k}`)}</span>
                <span class="cfg-exp">{t(`u2.cred.${k}.exp`)}</span>
              </span>
            </div>
          ))}
        </Secao>
      </div>
    </Tela>
  );
}

/** O corpo do início pela etapa. */
export default function CorpoInicio({ ui, etapa, estado }) {
  useEffect(() => usarEstilo('corpo-u2', CSS_CORPO), []);
  if (etapa === 'nova') return <Nova ui={ui} estado={estado} />;
  if (etapa === 'carregar') return <Carregar ui={ui} />;
  if (etapa === 'config') return <ConfigNoInicio ui={ui} />;
  if (etapa === 'creditos') return <Creditos />;
  return <Menu ui={ui} estado={estado} />;
}

function ConfigNoInicio({ ui }) {
  return <Configuracoes ui={ui} fechar={() => irPara('menu')} noInicio />;
}
