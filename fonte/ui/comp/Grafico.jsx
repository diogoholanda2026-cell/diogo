// Gráfico em SVG feito à mão (desenho da UI 8.16, regras da skill de gráficos): linha de 2 px com área a 12% embaixo,
// ou barras; grade recessiva; UM eixo só; cores --g1 a --g4 na ordem fixa, sempre para a mesma entidade; texto só em
// --t1 e --t2. Uma série: sem legenda (o título diz o que é); duas a quatro: legenda. Tocar e segurar (ou passar o
// mouse) mostra a linha vertical e o cartão com o valor; "Ver tabela" em todo gráfico.
// O SVG só desenha traços (viewBox esticado, traço que não escala); os rótulos são HTML, então o texto nunca deforma.
//   series = [{ id, rotulo, cor: 'var(--g1)', valores: [n] }]; rotulos = ['Mês 1', ...] (eixo x)
import { useState, useRef } from 'preact/hooks';
import { Botao } from './Botao.jsx';
import { Tabela } from './Tabela.jsx';
import { t } from '../textos.js';
import { numero } from '../formato.js';

const ALTO = 100; // altura interna do viewBox

/** Passo "redondo" (1, 2, 2,5 ou 5 vezes 10^k) para cerca de n divisões. */
export function passoRedondo(amplitude, n = 3) {
  if (!(amplitude > 0)) return 1;
  const bruto = amplitude / n;
  const p = 10 ** Math.floor(Math.log10(bruto));
  const m = bruto / p;
  return p * (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10);
}

/** Escala do eixo: { lo, hi, marcas: [n] }, com o zero incluído quando pedido. */
export function escala(valores, { zero = true, divisoes = 3 } = {}) {
  const v = valores.filter(Number.isFinite);
  let lo = v.length ? Math.min(...v) : 0;
  let hi = v.length ? Math.max(...v) : 1;
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi === lo) hi = lo + 1;
  const passo = passoRedondo(hi - lo, divisoes);
  lo = Math.floor(lo / passo) * passo;
  hi = Math.ceil(hi / passo) * passo;
  const marcas = [];
  for (let x = lo; x <= hi + passo / 2; x += passo) marcas.push(+x.toFixed(6));
  return { lo, hi, marcas };
}

export function Grafico({ series, rotulos = [], formato = numero, formatoEixo = null, altura = 120, tipo = 'linha', titulo, a = 'grafico', zero = true }) {
  const [ponto, setPonto] = useState(null);
  const [verTabela, setVerTabela] = useState(false);
  const area = useRef(null);
  const n = Math.max(0, ...series.map((s) => s.valores.length));
  const { lo, hi, marcas } = escala(series.flatMap((s) => s.valores), { zero: zero || tipo === 'barras' });
  const y = (v) => ALTO - ((v - lo) / (hi - lo)) * ALTO;
  const barras = tipo === 'barras';
  const x = (i) => (barras ? ((i + 0.5) / n) * 100 : n > 1 ? (i / (n - 1)) * 100 : 50);
  const eixo = formatoEixo ?? formato;
  const legenda = series.length > 1;

  const escolher = (ev) => {
    const r = area.current?.getBoundingClientRect();
    if (!r || !n) return;
    const f = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    setPonto(barras ? Math.min(n - 1, Math.floor(f * n)) : Math.round(f * (n - 1)));
  };

  const caminhos = series.map((s, k) => {
    if (!s.valores.some(Number.isFinite)) return null; // série vazia: nada de caminho inválido no SVG
    if (barras) {
      const w = (100 / n) * (0.7 / series.length);
      return (
        <g style={{ color: s.cor }}>
          {s.valores.map((v, i) => {
            if (!Number.isFinite(v)) return null;
            const x0 = x(i) - (w * series.length) / 2 + k * w;
            const y0 = y(Math.max(v, 0));
            const y1 = y(Math.min(v, 0));
            return <rect x={x0.toFixed(2)} y={y0.toFixed(2)} width={w.toFixed(2)} height={Math.max(0.5, y1 - y0).toFixed(2)} class="grafico-barra" />;
          })}
        </g>
      );
    }
    // trechos contínuos: um valor sem número (mês sem dado) quebra a linha em vez de cair no zero ou virar NaN
    const trechos = [];
    let atual = null;
    s.valores.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        atual = null;
        return;
      }
      if (!atual) trechos.push((atual = []));
      atual.push(i);
    });
    const base = y(Math.max(lo, Math.min(hi, 0))).toFixed(2);
    const pt = (i) => `${x(i).toFixed(2)},${y(s.valores[i]).toFixed(2)}`;
    const linha = trechos.map((tr) => `M${tr.map(pt).join('L')}`).join('');
    const preenchido = trechos.map((tr) => `M${x(tr[0]).toFixed(2)},${base}L${tr.map(pt).join('L')}L${x(tr[tr.length - 1]).toFixed(2)},${base}z`).join('');
    return (
      <g style={{ color: s.cor }}>
        {tipo === 'area' || series.length === 1 ? <path d={preenchido} class="grafico-area" /> : null}
        <path d={linha} class="grafico-linha" vector-effect="non-scaling-stroke" />
      </g>
    );
  });

  const ultimo = (l) => [...l].reverse().find(Number.isFinite);
  const resumo = series.map((s) => `${s.rotulo}: ${ultimo(s.valores) === undefined ? t('comp.grafico.semDado') : formato(ultimo(s.valores))}`).join('; ');
  const colunas = [{ id: 'x', rotulo: t('comp.grafico.quando') }, ...series.map((s) => ({ id: s.id, rotulo: s.rotulo, num: true, formato: (v) => (Number.isFinite(v) ? formato(v) : t('comp.grafico.semDado')) }))];
  const linhasTabela = Array.from({ length: n }, (_, i) => Object.fromEntries([['x', rotulos[i] ?? String(i + 1)], ...series.map((s) => [s.id, s.valores[i]])]));

  return (
    <figure class="grafico" data-grafico={a}>
      <figcaption class="grafico-cab">
        {titulo ? <span class="rot">{titulo}</span> : null}
        <Botao a={`${a}.tabela`} rotulo={verTabela ? t('comp.verGrafico') : t('comp.verTabela')} ativo={verTabela} class="bt-fan grafico-alternar" onClick={() => setVerTabela(!verTabela)}>
          {verTabela ? t('comp.verGrafico') : t('comp.verTabela')}
        </Botao>
      </figcaption>
      {legenda ? (
        <div class="grafico-legenda">
          {series.map((s) => (
            <span class="grafico-chave">
              <i style={{ background: s.cor }} />
              {s.rotulo}
            </span>
          ))}
        </div>
      ) : null}
      {verTabela ? (
        <Tabela colunas={colunas} linhas={linhasTabela} ordenavel={false} rotulo={titulo} a={`${a}.dados`} />
      ) : (
        <div class="grafico-corpo">
          <div class="grafico-eixo" aria-hidden="true">
            {marcas.map((m) => (
              <span class="num" style={{ top: `${(y(m) / ALTO) * 100}%` }}>
                {eixo(m)}
              </span>
            ))}
          </div>
          <div
            ref={area}
            class="grafico-area-toque"
            style={{ height: `${altura}px` }}
            role="img"
            aria-label={`${titulo ?? ''} ${resumo}`}
            onPointerDown={(ev) => {
              ev.currentTarget.setPointerCapture?.(ev.pointerId);
              escolher(ev);
            }}
            onPointerMove={(ev) => {
              if (ev.buttons || ev.pointerType === 'mouse') escolher(ev);
            }}
            onPointerLeave={(ev) => {
              if (ev.pointerType === 'mouse') setPonto(null);
            }}
          >
            <svg class="grafico-svg" viewBox={`0 0 100 ${ALTO}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
              {marcas.map((m) => (
                <line x1="0" x2="100" y1={y(m).toFixed(2)} y2={y(m).toFixed(2)} class={`grafico-grade${m === 0 ? ' zero' : ''}`} vector-effect="non-scaling-stroke" />
              ))}
              {caminhos}
            </svg>
            {ponto !== null && ponto < n ? (
              <>
                <i class="grafico-guia" style={{ left: `${x(ponto)}%` }} />
                {barras
                  ? null
                  : series.map((s) => (Number.isFinite(s.valores[ponto]) ? <i class="grafico-ponto" style={{ left: `${x(ponto)}%`, top: `${(y(s.valores[ponto]) / ALTO) * 100}%`, background: s.cor }} /> : null))}
                <div class={`grafico-cartao${x(ponto) > 60 ? ' esq' : ''}`} style={{ left: `${x(ponto)}%` }}>
                  <span class="grafico-cartao-x">{rotulos[ponto] ?? ''}</span>
                  {series.map((s) => (
                    <span class="grafico-cartao-v num">
                      {legenda ? <i style={{ background: s.cor }} /> : null}
                      {Number.isFinite(s.valores[ponto]) ? formato(s.valores[ponto]) : t('comp.grafico.semDado')}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <div class="grafico-x" aria-hidden="true">
            <span>{rotulos[0] ?? ''}</span>
            <span>{rotulos[n - 1] ?? ''}</span>
          </div>
        </div>
      )}
    </figure>
  );
}
