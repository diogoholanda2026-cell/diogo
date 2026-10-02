// Corpo da tela Cidade (desenho da UI 8.13; D11, D23, D50), sob demanda: o painel de informações que o CS2 não tem
// inteiro.
//   Visão geral: população, lares, novos moradores por hora, empregos e desemprego, escolaridade e os prédios.
//   Demanda: as barras de cada zona (cor da família) e os fatores com o número de cada um, + e −.
//   Bem-estar: a média da tarifa com a margem até o degrau ("+3 acima de 61"), as três faixas da regra do dono com a
//     Contribuição em dólar e os fatores médios da cidade (D50).
//   Serviços: as redes (oferta e demanda; a energia da rodovia, D52) e cada serviço com capacidade, uso e eficiência,
//     com "Ver camada".
import { useState } from 'preact/hooks';
import { barra, camada } from '../../loja.js';
import { consultar } from '../../consultas.js';
import * as fmt from '../../formato.js';
import { t } from '../../textos.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Indicador } from '../../comp/Indicador.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { Linha } from '../../comp/Linha.jsx';
import { glifoBemEstar } from '../../glifos/glifos.js';
import { tomarAba } from '../../hud/Menu.jsx';
import { textoMargem, faixasTarifa, bemDaBarra, semMoradores } from '../../hud/BarraCima.jsx';
import { Fatores, Par } from '../../selecao/Folha.jsx';
import { Escolaridade } from '../../selecao/secoes/residencial.jsx';
import { camadaDoServico } from '../../selecao/secoes/servico.jsx';
import { ZONAS, ZONAS_ORDEM } from '../../../data/zonas.js';
import { SERVICOS } from '../../../data/servicos.js';

const soma = (l) => (Array.isArray(l) ? l.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0) : 0);
const ESTADO_FAMILIA = { res: 'zR', com: 'zC', esc: 'zE', ind: 'zI' };

/** Zonas com demanda a mostrar: as ativas (q.demanda().ativas) ou as do M1a. */
export function zonasDaDemanda(d) {
  const ativas = Array.isArray(d?.ativas) && d.ativas.length ? d.ativas : ZONAS_ORDEM.filter((z) => z && ZONAS[z]?.parte !== 'M1b');
  return ativas.filter((z) => ZONAS[z]);
}

function Geral({ c, b }) {
  const pred = c?.predios ?? {};
  const emp = c?.empregos ?? {};
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <div class="eco-indicadores">
          <Indicador rotulo={t('cid.populacao')} valor={fmt.populacao(c?.populacao ?? b.populacao)} glifo="populacao" />
          <Indicador rotulo={t('cid.lares')} valor={fmt.numero(c?.lares ?? 0)} glifo="residencial" />
          <Indicador rotulo={t('cid.novos')} valor={fmt.porHora(c?.popHora ?? b.popHora)} dica={fmt.dicaHora()} />
        </div>
        <Secao titulo={t('cid.empregos')}>
          <Par k="vagas" rotulo={t('cid.vagas')} valor={t('cartao.deN', { a: fmt.numero(soma(emp.ocupadas)), b: fmt.numero(soma(emp.vagas)) })} />
          <Par k="desemprego" rotulo={t('cid.desemprego')} valor={fmt.pct(c?.desemprego ?? 0, 1)} estado={(c?.desemprego ?? 0) > 0.15 ? 'al' : null} glifo={(c?.desemprego ?? 0) > 0.15 ? 'alerta' : null} />
          {Number.isFinite(c?.trabalhadores) ? <Par k="trabalhadores" rotulo={t('cid.trabalhadores')} valor={fmt.numero(c.trabalhadores)} /> : null}
        </Secao>
      </div>
      <div class="gest-col">
        <Escolaridade fracoes={c?.escolaridade} />
        {pred.total ? (
          <Secao titulo={t('cid.predios')}>
            <Par k="total" rotulo={t('cid.prediosTotal')} valor={fmt.numero(pred.total)} />
            <Par k="obra" rotulo={t('cid.emObra')} valor={fmt.numero(pred.emObra ?? 0)} />
            <Par k="abandonados" rotulo={t('cid.abandonados')} valor={fmt.numero(pred.abandonados ?? 0)} estado={pred.abandonados ? 'al' : null} />
            {Array.isArray(pred.porNivel) ? <Par k="niveis" rotulo={t('cid.porNivel')} valor={pred.porNivel.map((n) => fmt.numero(n)).join(' · ')} /> : null}
          </Secao>
        ) : null}
      </div>
    </div>
  );
}

function Demanda({ d, b }) {
  const zonas = zonasDaDemanda(d);
  const fatores = d?.fatores ?? {};
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <Secao titulo={t('cid.demanda')}>
          {zonas.map((z) => (
            <div class="fl-par fl-par-barra" data-k={z}>
              <span class="fl-par-rot">{ZONAS[z]?.nome ?? z}</span>
              <Barra valor={(d?.[z] ?? 0) / 100} estado={ESTADO_FAMILIA[ZONAS[z]?.familia] ?? 'ac'} rotulo={ZONAS[z]?.nome ?? z} texto={fmt.numero(d?.[z] ?? 0)} />
            </div>
          ))}
          <p class="eco-nota">{t('barra.demanda.nota')}</p>
        </Secao>
      </div>
      <div class="gest-col">
        {zonas.map((z) => (Array.isArray(fatores[z]) && fatores[z].length ? <Fatores titulo={t('cid.fatoresDe', { zona: ZONAS[z]?.nome ?? z })} fatores={fatores[z].filter((f) => f.id !== 'parte')} /> : null))}
        {!zonas.some((z) => fatores[z]?.length) ? <Vazio glifo="demanda" texto={t('cid.semFatores')} /> : null}
      </div>
    </div>
  );
}

function BemEstar({ c, b }) {
  const vazia = semMoradores(b);
  const m = textoMargem(b);
  const bem = bemDaBarra(b);
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <div class="eco-destaque">
          <span class="rot">{t('cid.bemMedia')}</span>
          <span class={`eco-saldo num${vazia ? '' : b.tarifa >= 11 ? ' tx-ok' : b.tarifa >= 8 ? '' : ' tx-er'}`}>
            <Glifo n={vazia ? 'bemEstarMedio' : glifoBemEstar(b.tarifa)} tam={22} />
            {vazia ? t('barra.bem.semMoradores') : fmt.numero(bem)}
          </span>
          <span class={`eco-saldo-conta${m.estado ? ' tx-al' : ''}`}>{m.texto}</span>
        </div>
        <Secao titulo={t('barra.bem.faixas')}>
          {faixasTarifa(vazia ? null : b.tarifa).map((f) => (
            <div class={`faixa${f.atual ? ' atual' : ''}`}>
              <span class="faixa-de num">{f.de === 0 ? t('barra.bem.ate', { ate: f.ate }) : t('barra.bem.deAte', { de: f.de, ate: f.ate })}</span>
              <Glifo n="ir" tam={14} />
              <span class="faixa-tarifa num">{t('barra.bem.tarifa', { tarifa: fmt.dinheiroPorHora(f.tarifa) })}</span>
              {f.atual ? <Glifo n="check" tam={14} class="tx-ok" /> : null}
            </div>
          ))}
          <p class="eco-nota">{t('barra.bem.media')}</p>
        </Secao>
      </div>
      <div class="gest-col">
        {c?.fatoresBemEstar?.length ? <Fatores titulo={t('cid.fatoresBem')} fatores={c.fatoresBemEstar} /> : <Vazio glifo="bemEstarMedio" texto={t('cid.semFatores')} />}
      </div>
    </div>
  );
}

function Servicos({ c, fechar }) {
  const redes = c?.redes ?? {};
  const lista = Array.isArray(c?.servicos) ? c.servicos : [];
  const ver = (id) => {
    camada.value = id;
    fechar();
  };
  return (
    <div class="gest-colunas">
      <div class="gest-col">
        <Secao titulo={t('cid.redes')}>
          {['agua', 'energia'].map((r) =>
            redes[r] ? (
              <div class="fl-par fl-par-barra" data-k={r}>
                <span class="fl-par-rot">{t(`folha.rede.${r}`)}</span>
                <Barra valor={redes[r].oferta > 0 ? redes[r].demanda / redes[r].oferta : redes[r].demanda > 0 ? 1 : 0} estado={redes[r].demanda > redes[r].oferta ? 'al' : 'ok'} rotulo={t(`folha.rede.${r}`)} texto={t('cid.redeUso', { d: fmt.numero(redes[r].demanda ?? 0), o: fmt.numero(redes[r].oferta ?? 0) })} />
              </div>
            ) : null,
          )}
          {c?.ligacaoExterna?.energia ? (
            <p class="eco-nota">{c.ligacaoExterna.energia.ligada ? t('cid.ligacao', { usado: fmt.numero(c.ligacaoExterna.energia.usado ?? 0), teto: fmt.numero(c.ligacaoExterna.energia.teto ?? 0) }) : t('cid.semLigacao')}</p>
          ) : null}
        </Secao>
      </div>
      <div class="gest-col">
        <Secao titulo={t('cid.servicos')}>
          {lista.length ? (
            lista.map((s) => (
              <Linha
                a="cid.servico"
                k={s.tipo}
                glifo="servicos"
                titulo={`${SERVICOS[s.tipo]?.nome ?? s.tipo} · ${fmt.numero(s.n ?? 0)}`}
                sub={t('cid.servicoSub', { uso: fmt.numero(s.carga ?? 0), cap: fmt.numero(s.capacidade ?? 0), efic: fmt.pct(s.eficiencia ?? 0), manut: fmt.dinheiroHora(-(s.manutencaoHora ?? 0)) })}
                valor={t('folha.verCamada')}
                valorEstado="ac"
                onClick={() => ver(camadaDoServico(s.categoria))}
              />
            ))
          ) : (
            <Vazio glifo="servicos" texto={t('cid.semServicos')} />
          )}
        </Secao>
      </div>
    </div>
  );
}

export default function Cidade({ ui, fechar }) {
  const [aba, setAba] = useState(() => tomarAba('cidade', 'geral'));
  const b = barra.value;
  const c = consultar('cidade');
  const d = aba === 'demanda' ? consultar('demanda') ?? b.demanda : null;
  const abas = ['geral', 'demanda', 'bemEstar', 'servicos'].map((id) => ({ id, rotulo: t(`cid.aba.${id}`) }));
  return (
    <Tela id="cidade" glifo="populacao" titulo={t('cid.titulo')} abas={abas} aba={aba} aoTrocarAba={setAba} aoFechar={fechar}>
      {!c && aba !== 'bemEstar' && aba !== 'demanda' ? (
        <Vazio glifo="populacao" texto={t('cid.semDados')} />
      ) : aba === 'geral' ? (
        <Geral c={c} b={b} />
      ) : aba === 'demanda' ? (
        <Demanda d={d} b={b} />
      ) : aba === 'bemEstar' ? (
        <BemEstar c={c} b={b} />
      ) : (
        <Servicos c={c} fechar={fechar} />
      )}
    </Tela>
  );
}

