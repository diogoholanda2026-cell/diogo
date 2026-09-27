// Tabela (desenho da UI 8.20): cabeçalho 12/600 em caixa alta, linhas de 44 px (36 no PC), números tabulares à
// direita, ordenação no toque do cabeçalho (aria-sort). Acima de 50 linhas mostra as 50 primeiras e "Mostrar mais"
// (a lista virtual fica para quando uma tela precisar).
//   colunas = [{ id, rotulo, num?: true, formato?: (v, linha) => texto, estado?: (v, linha) => 'ok' | 'al' | 'er' | null }]
//   linhas = [{ ...valores por id }]; chave(linha) → chave estável
import { useState } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';

export const LIMITE_LINHAS = 50;

/** Ordena uma cópia das linhas pela coluna (números antes de texto; nulos por último). */
export function ordenar(linhas, id, sentido = 1) {
  const val = (l) => l?.[id];
  return [...linhas].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sentido;
    return String(x).localeCompare(String(y), 'pt-BR') * sentido;
  });
}

export function Tabela({ colunas, linhas, chave = (l, i) => i, ordenavel = true, rotulo, a = 'tabela', vazio = null, class: classe = '' }) {
  const [ordem, setOrdem] = useState(null); // { id, sentido }
  const [todas, setTodas] = useState(false);
  if (!linhas?.length && vazio) return vazio;
  const base = linhas ?? [];
  const lista = ordem ? ordenar(base, ordem.id, ordem.sentido) : base;
  const vistas = todas ? lista : lista.slice(0, LIMITE_LINHAS);
  const clicar = (id) => setOrdem(ordem?.id === id ? (ordem.sentido > 0 ? { id, sentido: -1 } : null) : { id, sentido: 1 });
  return (
    <div class={`tabela${classe ? ` ${classe}` : ''}`}>
      <table aria-label={rotulo}>
        <thead>
          <tr>
            {colunas.map((c) => (
              <th scope="col" class={c.num ? 'num' : ''} aria-sort={ordem?.id === c.id ? (ordem.sentido > 0 ? 'ascending' : 'descending') : undefined}>
                {ordenavel ? (
                  <Botao a={`${a}.ordem`} k={c.id} rotulo={t('comp.ordenar', { col: c.rotulo })} class="tabela-ordem" onClick={() => clicar(c.id)}>
                    <span>{c.rotulo}</span>
                    {ordem?.id === c.id ? <Glifo n={ordem.sentido > 0 ? 'setaCima' : 'setaBaixo'} tam={12} /> : null}
                  </Botao>
                ) : (
                  c.rotulo
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vistas.map((l, i) => (
            <tr key={chave(l, i)}>
              {colunas.map((c) => {
                const v = l[c.id];
                const est = c.estado?.(v, l);
                return <td class={`${c.num ? 'num' : ''}${est ? ` tx-${est}` : ''}`}>{c.formato ? c.formato(v, l) : v}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!todas && lista.length > LIMITE_LINHAS ? (
        <Botao a={`${a}.mais`} rotulo={t('comp.mostrarMais', { n: lista.length - LIMITE_LINHAS })} class="bt-fan" onClick={() => setTodas(true)}>
          {t('comp.mostrarMais', { n: lista.length - LIMITE_LINHAS })}
        </Botao>
      ) : null}
    </div>
  );
}
