// Seção da folha do terreno (o "Valor do terreno" do menu de contexto): a área nomeada (D55), o ladrilho (da Holding,
// comprável com o preço em dólar ou trancado), o valor do terreno, a cota e os recursos naturais daquele ponto. Lê só o
// espelho (seção 2.4): o ponto vem de R.selecionar.
import { t } from '../../textos.js';
import * as fmt from '../../formato.js';
import { Bloco, Par } from '../Folha.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { comando } from '../../acoes.js';
import { consultar } from '../../consultas.js';
import { avisar } from '../../loja.js';
import { infoArea, faltaDaArea } from '../../ferramentas/areas.js';
import { AREAS_COMPRAVEIS } from '../../../data/areas-compraveis.js';

const RECURSOS = ['rocha', 'areia', 'argila', 'calcario', 'fertil', 'subterranea'];

/** Valor de uma grade do espelho no ponto ({ n, passo, origem }; sem origem, a do mapa). */
export function naGrade(g, dados, x, z, origem) {
  if (!g || !dados) return null;
  const o = g.origem ?? origem ?? [-4096, -4096];
  const i = Math.floor((x - o[0]) / g.passo);
  const j = Math.floor((z - o[1]) / g.passo);
  if (i < 0 || j < 0 || i >= g.n || j >= g.n) return null;
  return dados[j * g.n + i];
}

/** Ponto dentro do contorno (Float64Array x, z, x, z...). */
export function dentro(contorno, x, z) {
  let d = false;
  const c = contorno ?? [];
  for (let i = 0, j = c.length - 2; i < c.length; j = i, i += 2) {
    const xi = c[i], zi = c[i + 1], xj = c[j], zj = c[j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
}

/** O que a folha mostra do ponto: { area, ladrilho: { estado, preco }, valor, cota, recursos: [{ id, v }] }. */
export function lerTerreno(espelho, ponto) {
  const [x, y, z] = ponto ?? [0, 0, 0];
  const mapa = espelho?.mapa ?? {};
  const origem = mapa.origem ?? [-4096, -4096];
  const area = (espelho?.areas ?? []).find((a) => dentro(a.contorno, x, z)) ?? null;
  const L = espelho?.ladrilhos;
  let ladrilho = null;
  if (L?.estado) {
    const lado = (mapa.tam ?? 8192) / L.n;
    const i = Math.floor((x - origem[0]) / lado);
    const j = Math.floor((z - origem[1]) / lado);
    if (i >= 0 && j >= 0 && i < L.n && j < L.n) ladrilho = { i, j, estado: L.estado[j * L.n + i], preco: L.preco?.[j * L.n + i] ?? 0 };
  }
  const gv = espelho?.grades?.valor;
  const valor = gv ? naGrade(gv, gv.dados, x, z, origem) : null;
  const R = espelho?.recursos;
  const recursos = R ? RECURSOS.map((id) => ({ id, v: (naGrade(R, R[id], x, z, origem) ?? 0) / 255 })).filter((r) => r.v > 0.02) : [];
  return { area, ladrilho, valor, cota: Number.isFinite(y) ? y : null, recursos };
}

/** Comprar o terreno e a área (D107), direto na folha do terreno: o ladrilho sob o ponto e, se a área é comprável, ela inteira. */
function Compra({ d }) {
  const est = d.ladrilho?.estado;
  const area = d.area && AREAS_COMPRAVEIS.includes(d.area.id) ? infoArea(consultar('area.compra', { id: d.area.id }), 'area') : null;
  const comprar = async (nome, args, ok) => {
    const r = await comando(nome, args);
    if (r.ok) avisar(ok, 'info');
  };
  if (est !== 1 && !area) return null;
  return (
    <Bloco titulo={t('folha.terreno.comprar')}>
      {est === 1 ? (
        <Botao a="folha.terreno.comprarLadrilho" rotulo={t('folha.terreno.comprarLadrilho', { preco: fmt.dinheiro(d.ladrilho.preco) })} class="bt-ch" onClick={() => comprar('ladrilho.comprar', { i: d.ladrilho.i, j: d.ladrilho.j }, t('x2.areas.comprada'))}>
          {t('folha.terreno.comprarLadrilho', { preco: fmt.dinheiro(d.ladrilho.preco) })}
        </Botao>
      ) : null}
      {area ? (
        <>
          <Botao a="folha.terreno.comprarArea" rotulo={t('area.comprar', { nome: area.nome })} class="bt-ch" desligado={!area.pode} dica={faltaDaArea(area) || undefined} onClick={() => area.pode && comprar('area.comprar', { id: area.id }, t('area.comprada', { nome: area.nome, n: area.faltam }))}>
            {t('area.comprar', { nome: area.nome })}
          </Botao>
          <p class="fl-nota">{`${t(area.faltam === 1 ? 'area.faltam1' : 'area.faltam', { n: area.faltam })} · ${t('area.preco', { preco: fmt.dinheiro(area.preco) })}`}</p>
          {area.criterios.map((c) => (
            <Par k={c.id} rotulo={t(c.chave)} valor={t(c.ok ? 'area.criterio.ok' : 'area.criterio.nao')} estado={c.ok ? 'ch' : null} />
          ))}
          {!area.pode ? <p class="fl-nota">{faltaDaArea(area)}</p> : null}
        </>
      ) : null}
    </Bloco>
  );
}

export function SecaoTerreno({ ui, sel }) {
  const d = lerTerreno(ui.obterSim()?.espelho, sel?.ponto);
  const est = d.ladrilho?.estado;
  return (
    <>
      <Bloco titulo={t('folha.resumo')}>
        {d.area ? <Par k="area" rotulo={t('folha.terreno.area')} valor={d.area.nome ?? d.area.id} /> : null}
        {d.ladrilho ? (
          <Par k="ladrilho" rotulo={t('folha.terreno.ladrilho')} valor={est === 2 ? t('folha.terreno.daHolding') : est === 1 ? t('folha.terreno.compravel', { preco: fmt.dinheiro(d.ladrilho.preco) }) : t('folha.terreno.trancado')} estado={est === 2 ? 'ch' : null} />
        ) : null}
        {Number.isFinite(d.valor) ? <Par k="valor" rotulo={t('folha.terreno.valor')} valor={t('folha.terreno.valorDe', { v: fmt.numero(d.valor) })} /> : null}
        {Number.isFinite(d.cota) ? <Par k="cota" rotulo={t('folha.terreno.cota')} valor={t('cartao.via.m', { m: fmt.numero(d.cota, 1) })} /> : null}
      </Bloco>
      <Compra d={d} />
      {d.recursos.length ? (
        <Bloco titulo={t('folha.terreno.recursos')}>
          {d.recursos.map((r) => (
            <div class="fl-par fl-par-barra" data-k={r.id}>
              <span class="fl-par-rot">{t(`folha.recurso.${r.id}`)}</span>
              <Barra valor={r.v} estado="ch" rotulo={t(`folha.recurso.${r.id}`)} texto={fmt.pct(r.v)} />
            </div>
          ))}
        </Bloco>
      ) : null}
      <p class="fl-nota">{t('folha.terreno.nota')}</p>
    </>
  );
}
SecaoTerreno.titulo = ({ ui, sel }) => {
  const d = lerTerreno(ui.obterSim()?.espelho, sel?.ponto);
  return { nome: d.area?.nome ?? t('folha.terreno'), sub: d.area ? t('folha.terreno') : null, glifo: 'mapa' };
};

export function registrar(ui) {
  ui.registrarSecao('terreno', SecaoTerreno, { ordem: 70 });
}
