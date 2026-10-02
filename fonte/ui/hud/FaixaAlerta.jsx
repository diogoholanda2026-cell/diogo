// Faixa de alerta (desenho da UI 7.1 e 8.11; D41): no alto, ao centro, sob a barra de cima, um problema da cidade
// inteira por vez (q.barra().alertas), o mais grave, com a forma da gravidade, o número e a ação que resolve ("Ver" abre
// a camada, a tela ou leva a câmera); "+2" abre a lista dos outros. "Caixa zerado" traz as três saídas da D41: tomar
// empréstimo, vender no Depósito e ver o orçamento. O chip "Pausado" fica na mesma linha, à esquerda da faixa (o botão
// de pausa da barra fica âmbar): os dois nunca se cobrem. Sob uma tela de gestão a linha some (a tela cobre o mundo).
import { useState } from 'preact/hooks';
import { barra, tela, camada } from '../loja.js';
import { t, temTexto } from '../textos.js';
import * as fmt from '../formato.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { glifo as temGlifo } from '../glifos/glifos.js';
import { FormaGravidade } from '../comp/Aviso.jsx';
import { Ancora, Popover } from '../comp/Popover.jsx';
import { abrirTelaNaAba, irParaAlvo } from './Menu.jsx';
import { itensTrilho } from './Trilho.jsx';

const PESO = { grave: 3, atencao: 2, info: 1 };
// a camada que mostra o problema (X3a desenha pela loja.camada)
const CAMADA_DO_ALERTA = {
  faltaAgua: 'agua', faltaEnergia: 'energia', bemEstarPerto: 'bemEstar', abandonoPerto: 'bemEstar', obrasParadas: 'recursos',
  desempregoAlto: 'empregos', faltamTrabalhadores: 'empregos',
};

/** Alertas em ordem de gravidade (a mais grave primeiro; empate, a ordem da simulação). */
export const ordenarAlertas = (l) =>
  (Array.isArray(l) ? l : [])
    .map((a, i) => [a, i])
    .sort((x, y) => (PESO[y[0].gravidade] ?? 0) - (PESO[x[0].gravidade] ?? 0) || x[1] - y[1])
    .map(([a]) => a);

/** Parâmetros com nome: o item vira o nome do item em minúsculas ("falta de concreto"). */
function nomear(params) {
  const p = { ...(params ?? {}) };
  for (const [k, v] of Object.entries(p)) {
    if (k === 'item' && temTexto(`s3.item.${v}`)) {
      const nome = t(`s3.item.${v}`);
      p[k] = nome.charAt(0).toLowerCase() + nome.slice(1);
    } else if (typeof v === 'number') p[k] = fmt.numero(v);
  }
  return p;
}

/** Frase do alerta: a da cidade (aviso.*), a da economia (s3.alerta.*), a desta faixa ou a genérica da gravidade. */
export function textoAlerta(a) {
  const params = nomear(a?.params);
  for (const k of [`aviso.${a?.codigo}`, `s3.alerta.${a?.codigo}`, `faixa.${a?.codigo}`]) if (temTexto(k)) return t(k, params);
  return t(`faixa.generico.${a?.gravidade in PESO ? a.gravidade : 'atencao'}`);
}

/**
 * As ações que resolvem: [{ id, rotulo, fazer(ui) }]. "Caixa zerado" tem as três da D41. "Ver camada" liga a camada e
 * leva a câmera ao lugar (uma tela por cima esconderia a camada); sem as Camadas (X3a) no jogo, "Ver" vai ao alvo.
 */
export function acoesAlerta(a, { camadas = true } = {}) {
  if (!a) return [];
  if (a.codigo === 'caixaZerado' || a.codigo === 'caixaVaiZerar') {
    return [
      { id: 'emprestimo', rotulo: t('faixa.acao.emprestimo'), fazer: (ui) => abrirTelaNaAba(ui, 'economia', 'emprestimo') },
      { id: 'deposito', rotulo: t('faixa.acao.deposito'), fazer: (ui) => abrirTelaNaAba(ui, 'holding', 'mercado') },
      { id: 'orcamento', rotulo: t('faixa.acao.orcamento'), fazer: (ui) => abrirTelaNaAba(ui, 'economia', 'orcamento') },
    ];
  }
  const cam = camadas ? CAMADA_DO_ALERTA[a.codigo] : null;
  if (!a.alvo && !cam) return [];
  return [
    {
      id: 'ver',
      rotulo: t(cam ? 'faixa.acao.verCamada' : 'faixa.acao.ver'),
      fazer: (ui) => {
        if (!cam) return irParaAlvo(ui, a.alvo);
        camada.value = cam;
        if (Number.isFinite(a.alvo?.x) && Number.isFinite(a.alvo?.z)) irParaAlvo(ui, a.alvo);
        else if (tela.peek()) ui.fecharTela();
      },
    },
  ];
}

function Faixa({ ui, alertas }) {
  const [lista, setLista] = useState(false);
  const a = alertas[0];
  const camadas = itensTrilho(ui.telas()).some((x) => x.id === 'camadas');
  const acoes = acoesAlerta(a, { camadas });
  // até 1.100 px de largura a faixa leva só a primeira ação; as outras (as três saídas do "Caixa zerado", D41) e os
  // outros alertas ficam no "+"
  const mais = alertas.length - 1;
  const extras = acoes.slice(1);
  return (
    <div class={`faixa-alerta vidro faixa-${a.gravidade in PESO ? a.gravidade : 'atencao'}`} data-hud="faixa" role={a.gravidade === 'grave' ? 'alert' : 'status'}>
      <FormaGravidade gravidade={a.gravidade in PESO ? a.gravidade : 'atencao'} />
      <Glifo n={temGlifo(a.glifo) ? a.glifo : 'alerta'} tam={18} class="faixa-glifo" />
      <span class="faixa-texto">{textoAlerta(a)}</span>
      {acoes.map((x, i) => (
        <Botao a="faixa.acao" k={x.id} rotulo={x.rotulo} class={`bt-fan faixa-acao${i ? ' faixa-acao-extra' : ''}`} onClick={() => x.fazer(ui)}>
          {x.rotulo}
        </Botao>
      ))}
      {mais > 0 || extras.length ? (
        <Ancora class={`faixa-mais-ancora${mais > 0 ? '' : ' faixa-so-extras'}`}>
          <Botao a="faixa.mais" rotulo={mais > 0 ? t('faixa.mais', { n: mais }) : t('faixa.saidas')} aria-expanded={String(lista)} class="bt-fan faixa-mais num" onClick={() => setLista(!lista)}>
            {mais > 0 ? `+${mais}` : t('faixa.maisCurto')}
          </Botao>
          <Popover aberto={lista} aoFechar={() => setLista(false)} titulo={mais > 0 ? t('faixa.outros') : t('faixa.saidas')} lado="direita" largura={320} a="faixa.lista">
            {extras.length ? (
              <div class="fileira faixa-extras">
                {extras.map((x) => (
                  <Botao a="faixa.lista.saida" k={x.id} rotulo={x.rotulo} class="bt-sec" onClick={() => { setLista(false); x.fazer(ui); }}>
                    {x.rotulo}
                  </Botao>
                ))}
              </div>
            ) : null}
            {alertas.slice(1).map((x) => {
              const ac = acoesAlerta(x, { camadas })[0];
              return (
                <div class="par faixa-linha">
                  <FormaGravidade gravidade={x.gravidade in PESO ? x.gravidade : 'atencao'} />
                  <span class="par-rot">{textoAlerta(x)}</span>
                  {ac ? (
                    <Botao a="faixa.lista.acao" k={x.id} rotulo={ac.rotulo} class="bt-fan" onClick={() => { setLista(false); ac.fazer(ui); }}>
                      {ac.rotulo}
                    </Botao>
                  ) : null}
                </div>
              );
            })}
          </Popover>
        </Ancora>
      ) : null}
    </div>
  );
}

export function FaixaAlerta({ ui }) {
  if (tela.value) return null;
  const b = barra.value;
  const pausado = b.velocidade === 0;
  const alertas = ordenarAlertas(b.alertas);
  if (!pausado && !alertas.length) return null;
  return (
    <div class="faixa-linha-centro">
      {pausado ? (
        <div class="chip-pausa vidro" data-hud="pausado" role="status">
          <Glifo n="pausa" tam={14} />
          <span>{t('vel.pausado')}</span>
        </div>
      ) : null}
      {alertas.length ? <Faixa ui={ui} alertas={alertas} /> : null}
    </div>
  );
}

export function registrar(ui) {
  ui.registrarHud('centro', FaixaAlerta, { ordem: 10, nome: 'faixa' });
}
