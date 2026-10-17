// Aba Problemas da tela Cidade (desenho da UI 8.13; X3b; D29, D41): os problemas da cidade numa lista só, os alertas e os
// avisos de prédio agregados e ordenados por gravidade (mundo/problemas.js). À esquerda a lista (a forma da gravidade, o
// glifo, a frase, a camada e a contagem); à direita o problema escolhido com "Ver na camada" (liga a camada certa, fecha a
// tela e centraliza no primeiro prédio ou na aresta; clicar de novo vai ao seguinte) e "Próximo" (escolhe o problema
// seguinte). Teclado: setas sobem e descem na lista, Enter vê na camada, N passa ao próximo.
import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { barra, camada } from '../../loja.js';
import { consultar } from '../../consultas.js';
import * as fmt from '../../formato.js';
import { t, temTexto } from '../../textos.js';
import { Secao } from '../../comp/Tela.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { glifo as temGlifo } from '../../glifos/glifos.js';
import { FormaGravidade } from '../../comp/Aviso.jsx';
import { textoAlerta } from '../../hud/FaixaAlerta.jsx';
import { irParaAlvo } from '../../hud/Menu.jsx';
import { listarProblemas, contarProblemas, proximoProblema, destinoDoProblema } from '../../mundo/problemas.js';

/** O problema escolhido (id) e quantas vezes "Ver na camada" já foi apertado em cada um (para andar pelos prédios). */
export const escolhido = signal(null);
const vezes = new Map();

const CSS = `
.prob{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,1fr);gap:var(--e4);align-items:start}
.prob-lista{display:flex;flex-direction:column;gap:var(--e1)}
.prob-item{display:flex;align-items:center;gap:var(--e3);width:100%;min-height:44px;padding:var(--e2) var(--e3);border-radius:var(--r1);
  background:var(--s2);color:var(--t1);text-align:left}
.prob-item[aria-pressed='true']{background:var(--acF);box-shadow:inset 0 0 0 1px var(--ac)}
.prob-item .glifo{flex:none;color:var(--t2)}
.prob-textos{display:flex;flex-direction:column;min-width:0;flex:1}
.prob-texto{font-size:var(--t15);font-weight:600;line-height:1.25}
.prob-sub{font-size:var(--t12);font-weight:500;color:var(--t2)}
.prob-n{flex:none;font-size:var(--t15);font-weight:650}
.prob-painel{position:sticky;top:0;display:flex;flex-direction:column;gap:var(--e3)}
.prob-resumo{display:flex;gap:var(--e4);font-size:var(--t13);font-weight:600}
.prob-resumo span{display:inline-flex;align-items:center;gap:var(--e1)}
.prob-acoes{display:flex;gap:var(--e2);flex-wrap:wrap}
.prob-dica{font-size:var(--t12);color:var(--t2);line-height:1.3}
@media (max-width:900px){.prob{grid-template-columns:1fr}.prob-painel{position:static}}
`;
let estiloPosto = false;
function usarEstilo() {
  if (estiloPosto || typeof document === 'undefined') return;
  estiloPosto = true;
  const el = document.createElement('style');
  el.dataset.estilo = 'x3-problemas';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/** Os problemas agora (barra, avisos de prédio e espelho). */
export function problemasAgora(ui) {
  const b = barra.value;
  return listarProblemas({
    alertas: b.alertas,
    avisos: consultar('avisosPredios'),
    predios: ui?.obterSim?.()?.espelho?.predios ?? null,
    textoAlerta,
    t,
  });
}

/** "Ver na camada": liga a camada do problema e leva a câmera ao alvo (ou abre a tela do alerta). */
export function verNaCamada(ui, p, fechar) {
  const vez = vezes.get(p.id) ?? 0;
  const d = destinoDoProblema(p, vez);
  if (!d) return false;
  vezes.set(p.id, vez + 1);
  if (d.camada) camada.value = d.camada;
  if (d.alvo) return irParaAlvo(ui, d.alvo);
  if (d.tela && d.tela.split('.')[0] !== 'cidade') return irParaAlvo(ui, { tela: d.tela });
  if (d.camada) fechar?.();
  return !!d.camada;
}

const rotuloCamada = (id) => (id && temTexto(`camada.${id}`) ? t(`camada.${id}`) : null);

function Item({ p, ativo, aoEscolher }) {
  const sub = [rotuloCamada(p.camada) ? t('x3.prob.camada', { nome: rotuloCamada(p.camada) }) : null, t(`x3.prob.grav.${p.gravidade}`)].filter(Boolean).join(' · ');
  return (
    <Botao a="problema" k={p.id} rotulo={p.texto} ativo={ativo} class="prob-item" onClick={() => aoEscolher(p.id)}>
      <FormaGravidade gravidade={p.gravidade} />
      <Glifo n={temGlifo(p.glifo) ? p.glifo : 'alerta'} tam={18} />
      <span class="prob-textos">
        <span class="prob-texto">{p.texto}</span>
        <span class="prob-sub">{sub}</span>
      </span>
      {p.n ? <span class="prob-n num">{fmt.numero(p.n)}</span> : null}
    </Botao>
  );
}

export default function Problemas({ ui, fechar }) {
  usarEstilo();
  const lista = problemasAgora(ui);
  const [, redesenhar] = useState(0);
  const atual = Math.max(0, lista.findIndex((p) => p.id === escolhido.value));
  const p = lista[atual] ?? null;
  const c = contarProblemas(lista);
  const escolher = (id) => {
    escolhido.value = id;
    redesenhar((n) => n + 1);
  };
  const proximo = () => {
    const k = proximoProblema(lista, atual);
    if (k >= 0) escolher(lista[k].id);
  };
  useEffect(() => {
    const tecla = (ev) => {
      if (!p || ev.ctrlKey || ev.metaKey || ev.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target?.tagName ?? '')) return;
      if (ev.key === 'ArrowDown' || ev.key === 'n' || ev.key === 'N') proximo();
      else if (ev.key === 'ArrowUp') escolher(lista[(atual - 1 + lista.length) % lista.length].id);
      else if (ev.key === 'Enter' && ev.target?.tagName !== 'BUTTON') verNaCamada(ui, p, fechar);
      else return;
      ev.preventDefault();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  if (!lista.length) return <Vazio glifo="check" texto={t('x3.prob.vazio')} a="problemas.vazio" />;
  const podeVer = !!p && (p.camada || p.alvos.length || p.tela);
  return (
    <div class="prob" data-a="problemas">
      <div class="prob-lista" role="group" aria-label={t('x3.prob.lista')}>
        {lista.map((x) => (
          <Item p={x} ativo={x.id === p?.id} aoEscolher={escolher} />
        ))}
      </div>
      <div class="prob-painel">
        <Secao titulo={t('x3.prob.titulo', { n: fmt.numero(c.total) })}>
          <div class="prob-resumo">
            {['grave', 'atencao', 'info'].map((g) => (
              <span data-k={g}>
                <FormaGravidade gravidade={g} />
                <span class="num">{fmt.numero(c[g])}</span> {t(`x3.prob.plural.${g}`)}
              </span>
            ))}
          </div>
        </Secao>
        {p ? (
          <Secao titulo={t('x3.prob.escolhido')}>
            <p class="prob-texto">{p.texto}</p>
            <div class="prob-acoes">
              <Botao a="problema.ver" k={p.id} rotulo={t('x3.prob.ver')} principal class="bt-pri" desligado={!podeVer} dica={podeVer ? undefined : t('x3.prob.semAlvo')} onClick={() => verNaCamada(ui, p, fechar)}>
                <Glifo n="camadas" tam={18} />
                {t('x3.prob.ver')}
              </Botao>
              <Botao a="problema.proximo" rotulo={t('x3.prob.proximo')} class="bt-sec" desligado={lista.length < 2} dica={lista.length < 2 ? t('x3.prob.so1') : undefined} onClick={proximo}>
                <Glifo n="ir" tam={18} />
                {t('x3.prob.proximo')}
              </Botao>
            </div>
            <p class="prob-dica">{p.alvos.length > 1 ? t('x3.prob.dicaVarios', { n: fmt.numero(p.alvos.length) }) : t('x3.prob.dica')}</p>
          </Secao>
        ) : null}
      </div>
    </div>
  );
}
