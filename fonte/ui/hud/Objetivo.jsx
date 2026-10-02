// Objetivos (desenho da UI 8.6; D58): embaixo, entre os dois grupos da barra de construção, os 3 objetivos abertos
// (um da cidade, um da Holding, um da Arcologia, de q.barra().objetivos). Aberto: o cartão de 44 px com o monograma de
// quem fala, "OBJETIVO · CIDADE", a frase numa linha com a barra do progresso e "Ir" (leva a câmera, abre a tela ou a
// categoria certa); tocar na frase abre a lista dos três. Recolhido: o chip "Objetivos" com o número dos abertos.
// Na primeira hora de jogo começa aberto; depois recolhe sozinho (o jogador troca e a escolha fica na sessão). Some
// com ferramenta, tela de gestão ou bandeja abertas.
import { signal } from '@preact/signals';
import { barra, tela, ferramenta } from '../loja.js';
import { sessao, categoria } from '../ferramentas/sessao.js';
import { t, temTexto } from '../textos.js';
import * as fmt from '../formato.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { Ancora, Popover } from '../comp/Popover.jsx';
import { CONSELHEIROS } from '../../data/nomes.js';
import { HORA } from '../../comum/relogio.js';
import { irParaAlvo } from './Menu.jsx';

/** null: segue a regra da primeira hora; true ou false: a escolha do jogador nesta sessão. */
export const objetivoRecolhido = signal(null);
const lista = signal(false);
const foco = signal(0);

/** Quem fala: { nome, curto, cargo, inicial } pelo id curto (D83); id desconhecido vira a Holding. */
export function quemFala(id) {
  const c = CONSELHEIROS[id];
  if (!c) return { nome: t('obj.holding'), curto: t('obj.holding'), cargo: '', inicial: 'H', id: null };
  const curto = c.curto ?? c.nome;
  return { nome: c.nome, curto, cargo: c.cargo, inicial: curto.replace(/^Dona /, '').charAt(0), id };
}

/**
 * Frase do objetivo: a chave da simulação com os parâmetros (números em pt-BR, `paramsChave` traduzidos), a do id
 * ('s3.objetivo.<id>') ou a genérica do domínio. Nunca '??chave' na tela.
 */
export function textoObjetivo(o) {
  if (!o) return '';
  const p = {};
  for (const [k, v] of Object.entries(o.params ?? {})) p[k] = typeof v === 'number' ? fmt.numero(v) : v;
  for (const [k, chave] of Object.entries(o.paramsChave ?? {})) if (temTexto(chave)) p[k] = t(chave).toLowerCase();
  for (const chave of [o.texto, `s3.objetivo.${o.id}`]) if (chave && temTexto(chave)) return t(chave, p);
  return t(`obj.generico.${o.dominio ?? 'cidade'}`);
}

/** Fração feita (0 a 1); sem total (objetivo contínuo), 0. */
export const fracaoObjetivo = (o) => (o?.total > 0 ? Math.min(1, Math.max(0, (o.feito ?? 0) / o.total)) : 0);

/** Recolhido agora? A escolha do jogador manda; sem ela, recolhe depois da primeira hora de jogo. */
export const estaRecolhido = (tique) => objetivoRecolhido.value ?? (tique ?? 0) >= HORA;

const Monograma = ({ quem }) => (
  <span class={`monograma mono-${quem.id ?? 'holding'}`} aria-hidden="true">
    {quem.inicial}
  </span>
);

function LinhaObjetivo({ ui, o, i }) {
  const quem = quemFala(o.quem);
  return (
    <div class="obj-linha">
      <Monograma quem={quem} />
      <span class="obj-linha-textos">
        <span class="rot">{t(`obj.dominio.${o.dominio ?? 'cidade'}`)}</span>
        <span class="obj-linha-texto">{textoObjetivo(o)}</span>
        {o.total > 0 ? <span class="obj-linha-conta num">{t('obj.conta', { feito: fmt.numero(o.feito ?? 0), total: fmt.numero(o.total) })}</span> : null}
      </span>
      {o.alvo ? (
        <Botao a="objetivo.lista.ir" k={o.id} rotulo={t('obj.ir')} class="bt-fan" onClick={() => { lista.value = false; foco.value = i; irParaAlvo(ui, o.alvo); }}>
          {t('obj.ir')}
        </Botao>
      ) : null}
    </div>
  );
}

export function Objetivo({ ui }) {
  const objs = barra.value.objetivos ?? [];
  if (!objs.length || tela.value || ferramenta.value || sessao.value || categoria.value) return null;
  const tique = ui.obterSim()?.espelho?.tempo?.tique ?? 0;
  if (estaRecolhido(tique)) {
    return (
      <Botao a="objetivo.abrir" rotulo={t('obj.abrir', { n: objs.length })} class="obj-chip vidro" data-hud="objetivo" onClick={() => (objetivoRecolhido.value = false)}>
        <Glifo n="objetivo" tam={18} />
        <span>{t('obj.chip')}</span>
        <span class="obj-chip-n num">{objs.length}</span>
      </Botao>
    );
  }
  const i = Math.min(foco.value, objs.length - 1);
  const o = objs[i];
  const quem = quemFala(o.quem);
  const frac = fracaoObjetivo(o);
  return (
    <div class="obj-cartao vidro" data-hud="objetivo">
      <Ancora class="obj-ancora">
        <Botao a="objetivo.lista" rotulo={t('obj.listar')} aria-expanded={String(lista.value)} class="obj-corpo" onClick={() => (lista.value = !lista.value)}>
          <Monograma quem={quem} />
          <span class="obj-textos">
            <span class="rot obj-rot">{t('obj.rotulo', { i: i + 1, n: objs.length, dominio: t(`obj.dominio.${o.dominio ?? 'cidade'}`) })}</span>
            <span class="obj-texto">{textoObjetivo(o)}</span>
          </span>
          {o.total > 0 ? (
            <i class="obj-progresso" aria-hidden="true">
              <i style={{ transform: `scaleX(${frac})` }} />
            </i>
          ) : null}
        </Botao>
        <Popover aberto={lista.value} aoFechar={() => (lista.value = false)} titulo={t('obj.titulo')} largura={340} a="objetivo.lista" lado="esquerda">
          {objs.map((x, k) => (
            <LinhaObjetivo ui={ui} o={x} i={k} />
          ))}
          <p class="popover-nota">{t('obj.nota')}</p>
        </Popover>
      </Ancora>
      {o.alvo ? (
        <Botao a="objetivo.ir" k={o.id} rotulo={t('obj.irPara', { texto: textoObjetivo(o) })} class="bt-fan obj-ir" onClick={() => irParaAlvo(ui, o.alvo)}>
          <span>{t('obj.ir')}</span>
          <Glifo n="setaDir" tam={16} />
        </Botao>
      ) : null}
      <Botao a="objetivo.recolher" rotulo={t('obj.recolher')} class="bt-glifo obj-recolher" onClick={() => { lista.value = false; objetivoRecolhido.value = true; }}>
        <Glifo n="setaBaixo" tam={18} />
      </Botao>
    </div>
  );
}

export function registrar(ui) {
  ui.registrarHud('baixo', Objetivo, { ordem: 50, nome: 'objetivo' });
}
