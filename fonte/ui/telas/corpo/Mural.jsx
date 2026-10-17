// Corpo do Mural (desenho da UI 8.13; dona: U2b), sob demanda: a lista das notícias do mais novo ao mais velho, com o
// autor (o conselheiro que fala), a data do calendário (D67) e "Ver no mapa" quando a notícia tem lugar; abas por
// assunto (tudo, decisões, marcos, Arcologia, mundo, Vila). Relê q.mural() a cada evento 'mural' da simulação, então a
// tela aberta mostra a notícia nova sem fechar.
import { useState } from 'preact/hooks';
import { eventos } from '../../loja.js';
import { consultar } from '../../consultas.js';
import * as fmt from '../../formato.js';
import { t, temTexto } from '../../textos.js';
import { Tela } from '../../comp/Tela.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { usarEstilo } from '../../inicio/estilo.js';
import { irParaAlvo } from '../../hud/Menu.jsx';
import { CONSELHEIROS } from '../../../data/nomes.js';

/** Assuntos do Mural: o id, o glifo e o texto da aba. */
export const ASSUNTOS = Object.freeze([
  { id: 'todos', glifo: 'mural', rotulo: 'u2b.mural.todos' },
  { id: 'decisoes', glifo: 'conselho', rotulo: 'u2b.mural.decisoes' },
  { id: 'marcos', glifo: 'marco', rotulo: 'u2b.mural.marcos' },
  { id: 'arcologia', glifo: 'arcologia', rotulo: 'u2b.mural.arcologia' },
  { id: 'mundo', glifo: 'info', rotulo: 'u2b.mural.mundo' },
  { id: 'vila', glifo: 'residencial', rotulo: 'u2b.mural.vila' },
]);

/** O assunto de uma notícia pela chave do texto. */
export function assuntoDe(chave = '') {
  if (chave.startsWith('s3.mural.decisao')) return 'decisoes';
  if (chave.startsWith('s3.mural.marco')) return 'marcos';
  if (chave.startsWith('x1.mural')) return 'arcologia';
  if (chave.startsWith('s3.mural.evento')) return 'mundo';
  if (chave.startsWith('s3.mural.vilaNova')) return 'vila';
  return 'mundo';
}

/** Quem fala: o conselheiro pelo id curto, ou a cidade. */
export const autorDe = (id) => CONSELHEIROS[id]?.nome ?? t('u2b.mural.autor.cidade');

/** As notícias de q.mural() do mais novo ao mais velho, com o assunto e a frase prontos. */
export function noticias(posts) {
  return (Array.isArray(posts) ? posts : [])
    .map((p) => {
      const chave = p.texto ?? p.chave ?? '';
      return {
        id: p.id,
        tique: p.tique ?? 0,
        autor: p.autor,
        assunto: assuntoDe(chave),
        frase: temTexto(chave) ? t(chave, p.params) : t('u2b.mural.semTexto'),
        data: p.data ?? null,
        alvo: p.alvo ?? null,
      };
    })
    .sort((a, b) => b.tique - a.tique || b.id - a.id);
}

const CSS = `
.mu-lista{display:flex;flex-direction:column;gap:var(--e3);max-width:760px;margin:0 auto;padding:0;list-style:none}
.mu-nota{display:flex;gap:var(--e3);padding:var(--e3) var(--e4);border-radius:var(--r2);background:var(--s2);box-shadow:inset 0 0 0 1px var(--fio)}
.mu-nota[data-assunto=marcos],.mu-nota[data-assunto=arcologia]{box-shadow:inset 3px 0 0 var(--ch),inset 0 0 0 1px var(--fio)}
.mu-glifo{flex:none;color:var(--t2);margin-top:2px}
.mu-corpo{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
.mu-cab{display:flex;flex-wrap:wrap;gap:var(--e2);align-items:baseline;font-size:var(--t12);font-weight:650;color:var(--t2);letter-spacing:.04em}
.mu-autor{color:var(--t1)}
.mu-frase{margin:0;font-size:var(--t15);font-weight:500;line-height:1.45;color:var(--t1)}
.mu-ver{align-self:flex-start;min-height:32px;padding:0 var(--e3)}
.mu-total{max-width:760px;margin:0 auto var(--e3);font-size:var(--t12);font-weight:600;color:var(--t2)}
@media (pointer:coarse){.mu-ver{min-height:var(--alvo)}}
`;

export default function CorpoMural({ ui, fechar }) {
  usarEstilo('mural', CSS);
  eventos.value; // um evento novo (inclusive o 'mural') relê a lista
  const [aba, setAba] = useState('todos');
  const todas = noticias(consultar('mural'));
  const lista = aba === 'todos' ? todas : todas.filter((n) => n.assunto === aba);
  const abas = ASSUNTOS.map((a) => ({ id: a.id, rotulo: t(a.rotulo), selo: a.id === 'todos' ? null : todas.filter((n) => n.assunto === a.id).length || null }));
  return (
    <Tela id="mural" glifo="mural" titulo={t('u2b.mural.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {lista.length ? (
        <>
          <p class="mu-total">{lista.length === 1 ? t('u2b.mural.um') : t('u2b.mural.total', { n: lista.length })}</p>
          <ol class="mu-lista" aria-label={t('u2b.mural.titulo')}>
            {lista.map((n) => (
              <li class="mu-nota" data-assunto={n.assunto} data-k={n.id}>
                <Glifo n={ASSUNTOS.find((a) => a.id === n.assunto)?.glifo ?? 'mural'} tam={20} class="mu-glifo" />
                <div class="mu-corpo">
                  <div class="mu-cab">
                    <span class="mu-autor">{autorDe(n.autor)}</span>
                    {n.data ? <span class="num">{fmt.dataCalendario(n.data)}</span> : null}
                  </div>
                  <p class="mu-frase">{n.frase}</p>
                  {n.alvo ? (
                    <Botao a="mural.ver" k={n.id} rotulo={t('u2b.mural.ver')} class="bt-sec mu-ver" onClick={() => irParaAlvo(ui, n.alvo)}>
                      <Glifo n="localizar" tam={16} />
                      <span>{t('u2b.mural.ver')}</span>
                    </Botao>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <Vazio glifo="mural" texto={t(todas.length ? 'u2b.mural.vazioFiltro' : 'u2b.mural.vazio')} />
      )}
    </Tela>
  );
}
