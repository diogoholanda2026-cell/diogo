// Corpo da tela Progresso (desenho da UI 8.13; D49, D51, D55), sob demanda.
//   Marcos: a trilha vertical de 0 a 7 com o XP de cada um, o prêmio em dólar, as licenças de área e o que libera; o
//     atual aberto com a barra do XP; o marco 7 pede também a Blade Tower pronta (o requisito, cumprido ou não).
//   Áreas: os ladrilhos da Holding, os compráveis e as licenças, o desconto da Influência e "Comprar áreas" (a
//     ferramenta Áreas da X2).
//   Arcologia: o progresso de cada etapa pela q.arcologia() e o caminho para o Livro da Arcologia (X1b).
import { useState } from 'preact/hooks';
import { barra, ferramenta } from '../../loja.js';
import { consultar } from '../../consultas.js';
import * as fmt from '../../formato.js';
import { t, temTexto } from '../../textos.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Indicador } from '../../comp/Indicador.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Chip } from '../../comp/Chip.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { tomarAba, telaArcologia } from '../../hud/Menu.jsx';
import { fracaoMarco } from '../../hud/BarraCima.jsx';
import { nomeLiberado, glifoLiberado } from './comum.jsx';

/** O que um marco libera, com nome (os ids sem nome conhecido ficam de fora). */
export const liberados = (ids) => (ids ?? []).map((id) => ({ id, nome: nomeLiberado(id) })).filter((x) => x.nome);

/** Requisito do marco em frase ('Pede a Blade Tower pronta'). */
const fraseRequisito = (r) => (temTexto(`barra.marco.requisito.${r}`) ? t(`barra.marco.requisito.${r}`) : t('prog.requisito'));

function Marcos({ b }) {
  const l = consultar('marcos');
  const atual = b.marco ?? {};
  if (!Array.isArray(l) || !l.length) return <Vazio glifo="marco" texto={t('prog.semDados')} />;
  return (
    <ol class="trilha" aria-label={t('prog.aba.marcos')}>
      {l.map((m) => {
        const feito = m.feito ?? m.n <= (atual.n ?? 0);
        const ehAtual = m.atual ?? m.n === atual.n;
        const prox = m.n === (atual.n ?? 0) + 1;
        const lib = liberados(m.libera);
        return (
          <li class={`trilha-marco${feito ? ' feito' : ''}${ehAtual ? ' atual' : ''}${prox ? ' proximo' : ''}`} data-k={m.n}>
            <span class="trilha-n num" aria-hidden="true">
              {feito ? <Glifo n="check" tam={16} /> : m.n}
            </span>
            <div class="trilha-corpo">
              <div class="trilha-cab">
                <span class="trilha-nome">{t('prog.marco', { n: m.n, nome: m.nome })}</span>
                <span class="trilha-xp num">{t('prog.xp', { xp: fmt.numero(m.xp ?? 0) })}</span>
              </div>
              {prox ? <Barra valor={fracaoMarco(atual)} estado="ac" rotulo={t('barra.marco.xp')} texto={t('barra.marco.deXp', { xp: fmt.numero(atual.xp ?? 0), prox: fmt.numero(atual.xpProx ?? m.xp) })} /> : null}
              {m.requisito ? (
                <p class={`trilha-req${m.requisitoOk ? ' tx-ok' : ' tx-ch'}`}>
                  <Glifo n={m.requisitoOk ? 'check' : 'arcologia'} tam={14} /> {fraseRequisito(m.requisito)}
                </p>
              ) : null}
              {m.n > 0 && (m.premio || m.licencas) ? (
                <p class="trilha-premio">{t(m.licencas ? 'prog.premioLicenca' : 'prog.premio', { v: fmt.dinheiro(m.premio ?? 0), n: m.licencas ?? 0 })}</p>
              ) : null}
              {lib.length ? (
                <div class="trilha-libera">
                  {lib.slice(0, ehAtual || prox ? 12 : 6).map((x) => (
                    <Chip glifo={glifoLiberado(x.id)} texto={x.nome} estado={feito ? 'ok' : null} />
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Areas({ fechar }) {
  const lad = consultar('ladrilhos');
  const h = consultar('holding');
  const est = lad?.estado ?? [];
  let daHolding = 0;
  let compraveis = 0;
  for (const e of est) {
    if (e === 2) daHolding++;
    else if (e === 1) compraveis++;
  }
  const precos = [];
  for (let k = 0; k < est.length; k++) if (est[k] === 1 && lad.preco?.[k] > 0) precos.push(lad.preco[k]);
  const menor = precos.length ? Math.min(...precos) : null;
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <div class="eco-indicadores">
          <Indicador rotulo={t('prog.areasHolding')} valor={fmt.numero(daHolding)} glifo="mapa" estado="ch" />
          <Indicador rotulo={t('prog.compraveis')} valor={fmt.numero(compraveis)} glifo="mapa" />
          <Indicador rotulo={t('prog.licencas')} valor={fmt.numero(lad?.licencas ?? 0)} glifo="contrato" />
        </div>
        {menor !== null ? <p class="eco-nota">{t('prog.areaPreco', { v: fmt.dinheiro(menor) })}</p> : null}
        {h?.efeitos?.descontoLadrilho > 0 ? <p class="eco-nota">{t('hold.influencia.efeito', { pct: fmt.numero(h.efeitos.descontoLadrilho * 100, 1) })}</p> : null}
        <p class="eco-nota">{t('prog.areasNota')}</p>
        <Botao a="prog.comprar" rotulo={t('prog.comprar')} principal class="bt-pri" onClick={() => { fechar(); ferramenta.value = { tipo: 'areas' }; }}>
          {t('prog.comprar')}
        </Botao>
      </div>
    </div>
  );
}

function Arcologia({ ui, fechar }) {
  const a = consultar('arcologia');
  const livro = telaArcologia(ui);
  const etapas = (a?.partes ?? []).flatMap((p) => (p.etapas ?? []).map((e) => ({ ...e, parte: p.nome })));
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        {a ? <Barra valor={a.progressoTotal ?? 0} estado="ch" rotulo={t('prog.arcoTotal')} texto={t('prog.arcoTotalN', { p: fmt.pct(a.progressoTotal ?? 0) })} /> : null}
        {etapas.length ? (
          etapas.map((e) => (
            <div class="fl-par fl-par-barra" data-k={e.id}>
              <span class="fl-par-rot">{temTexto(`s3.etapa.${e.id}`) ? t(`s3.etapa.${e.id}`) : `${e.parte} · ${e.nome}`}</span>
              <Barra valor={e.estado === 3 ? 1 : e.progresso ?? 0} estado={e.estado === 3 ? 'ok' : e.estado === 2 ? 'ch' : 'ac'} rotulo={e.nome ?? e.id} texto={t(`prog.etapa.${e.estado ?? 0}`)} />
            </div>
          ))
        ) : (
          <Vazio glifo="arcologia" texto={t('prog.semArcologia')} />
        )}
        {livro ? (
          <Botao a="prog.livro" rotulo={t('prog.livro')} class="bt-ch" onClick={() => { fechar(); ui.abrirTela(livro); }}>
            <Glifo n="arcologia" tam={18} />
            {t('prog.livro')}
          </Botao>
        ) : null}
      </div>
    </div>
  );
}

export default function Progresso({ ui, fechar }) {
  const [aba, setAba] = useState(() => tomarAba('progresso', 'marcos'));
  const b = barra.value;
  const abas = ['marcos', 'areas', 'arcologia'].map((id) => ({ id, rotulo: t(`prog.aba.${id}`) }));
  return (
    <Tela id="progresso" glifo="marco" titulo={t('prog.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {aba === 'marcos' ? <Marcos b={b} /> : aba === 'areas' ? <Areas fechar={fechar} /> : <Arcologia ui={ui} fechar={fechar} />}
    </Tela>
  );
}
