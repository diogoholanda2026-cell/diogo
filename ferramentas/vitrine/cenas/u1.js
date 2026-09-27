// Cenas da vitrine da U1a (pele da interface): barra de cima em repouso e com popover, partida nova (saldo negativo,
// pausado), cartão de prédio residencial e de serviço, tela Economia (orçamento e empréstimo) e a folha de glifos.
//   node ferramentas/vitrine-ui.mjs <pasta> u1-barra,u1-cartao-res,u1-cartao-servico,u1-economia
// A simulação falsa dá os números de uma cidade de 12 mil; o serviço é montado aqui sobre q.predio (a falsa só tem
// zonas), com a categoria que o cartão usa para o glifo.
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { nomesGlifos, glifo } from '../../../fonte/ui/glifos/glifos.js';
import { Tela, Secao } from '../../../fonte/ui/comp/Tela.jsx';
import { Botao } from '../../../fonte/ui/comp/Botao.jsx';
import { Chip } from '../../../fonte/ui/comp/Chip.jsx';
import { Segmentado } from '../../../fonte/ui/comp/Segmentado.jsx';
import { Interruptor } from '../../../fonte/ui/comp/Interruptor.jsx';
import { Quantidade } from '../../../fonte/ui/comp/Quantidade.jsx';
import { Deslizante } from '../../../fonte/ui/comp/Deslizante.jsx';
import { DoisToques } from '../../../fonte/ui/comp/DoisToques.jsx';
import { Barra } from '../../../fonte/ui/comp/Barra.jsx';
import { Aviso } from '../../../fonte/ui/comp/Aviso.jsx';
import { Linha } from '../../../fonte/ui/comp/Linha.jsx';
import { Indicador } from '../../../fonte/ui/comp/Indicador.jsx';
import { Vazio } from '../../../fonte/ui/comp/Vazio.jsx';
import { Modal } from '../../../fonte/ui/comp/Modal.jsx';
import { Glifo } from '../../../fonte/ui/glifos/Glifo.jsx';

const REF = (idx) => idx + 2 ** 20;
const IDX_RES = 3; // quadra 0: residencial baixa na simulação falsa
const IDX_SERV = 40;

function selecionar({ ui, R, sim }, idx) {
  const P = sim.espelho.predios;
  ui.ui.loja.selecao.value = { tipo: 'predio', ref: REF(idx), idx, ponto: [P.x[idx], 0, P.z[idx]] };
  R.selecionado(REF(idx));
}

function servicoFalso(sim) {
  const original = sim.q.predio;
  sim.q.predio = (ref) => {
    if (ref !== REF(IDX_SERV)) return original(ref);
    const tique = sim.estado.tique;
    return {
      ref, tipo: 'servico', modelo: 0, nome: 'Clínica da Família Santa Cida', zona: 0, nivel: 1, estado: 'ok', obra: null,
      moradia: null, trabalho: null, nivelProx: null,
      servicos: { agua: 'ok', esgoto: 'ok', energia: 'ok', saude: 1, educacao: 0, seguranca: 0, bombeiros: 0, lazer: 0 },
      servico: { categoria: 'saude', capacidade: 800, uso: 620, eficiencia: 0.74, alcance: 600, manutencaoHora: 400 },
      holding: null, cor: 0, via: { ref: 2, nome: 'Rua da Matriz' },
      avisos: [{ codigo: 'semTrabalhadores', gravidade: 'atencao', desde: tique - 240, acao: null }],
      faz: 'atende a saúde de quem mora a até 600 m',
    };
  };
}

// A simulação falsa (F0) dá o saldo por hora como contribuição menos 21.500, sem as outras receitas nem os juros; a
// Economia mostra receitas, despesas e saldo lado a lado, então as cenas fecham a conta pelo contrato (saldo líquido =
// receitas menos despesas) para a captura não mostrar uma soma errada ao dono.
function contaFechada(sim) {
  if (sim.contaFechada) return;
  sim.contaFechada = true;
  const orc0 = sim.q.orcamento;
  const barra0 = sim.q.barra;
  const soma = (o) => Object.values(o ?? {}).reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0);
  const saldo = (o) => soma(o.receitas) - soma(o.despesas);
  sim.q.orcamento = () => {
    const o = orc0();
    // a série dos 12 meses termina nos números de agora (a falsa traz outra escala de despesas)
    const rec = soma(o.receitas);
    const des = soma(o.despesas);
    const serie = o.serie.map((p, i, l) => {
      const f = l.length > 1 ? i / (l.length - 1) : 1;
      return { ...p, receitas: Math.round(rec * (0.55 + 0.45 * f)), despesas: Math.round(des * (0.7 + 0.3 * f)) };
    });
    return { ...o, saldoHora: saldo(o), serie };
  };
  sim.q.barra = () => ({ ...barra0(), saldoHora: saldo(orc0()) });
}

const conferirTexto = (seletor, re, nome) => () => {
  const e = document.querySelector(seletor);
  if (!e) return [`${nome}: ${seletor} não apareceu`];
  return re.test(e.textContent) ? [] : [`${nome}: "${e.textContent.slice(0, 80)}" não bate com ${re}`];
};

// o saldo em destaque é a conta escrita embaixo dele (receitas menos despesas) e o mesmo da barra de cima
function somaDoSaldo() {
  const n = (s) => Number((s.match(/[+−-]?[\d.]+/) ?? ['0'])[0].replace(/\./g, '').replace('−', '-'));
  const saldo = document.querySelector('.eco-saldo')?.textContent ?? '';
  const conta = [...(document.querySelector('.eco-saldo-conta')?.textContent ?? '').matchAll(/[+−-][\d.]+/g)].map((m) => n(m[0]));
  const barra = document.querySelector('[data-a="creditos"] .hud-sub')?.textContent ?? '';
  const f = [];
  if (conta.length !== 2 || n(saldo) !== conta[0] + conta[1]) f.push(`saldo "${saldo}" não é a conta "${conta.join(' ')}"`);
  if (n(barra) !== n(saldo)) f.push(`saldo da barra "${barra}" difere do da Economia "${saldo}"`);
  return f;
}

// nenhum grupo da barra sai da tela nem encosta no outro (a vitrine só mede o texto)
function barraCabe() {
  const f = [];
  const grupos = [...document.querySelectorAll('.hud-grupo')].map((g) => g.getBoundingClientRect()).filter((r) => r.width > 0);
  for (const r of grupos) if (r.left < 0 || r.right > innerWidth) f.push(`grupo da barra fora da tela (${Math.round(r.left)} a ${Math.round(r.right)})`);
  grupos.sort((a, b) => a.left - b.left);
  for (let i = 1; i < grupos.length; i++) if (grupos[i].left - grupos[i - 1].right < 4) f.push('grupos da barra encostados');
  return f;
}

// painel com todas as primitivas (referência para as outras parcelas de interface), montado fora da árvore da UI
function Primitivas() {
  const [seg, setSeg] = useState('media');
  const [auto, setAuto] = useState(true);
  const [lote, setLote] = useState(10);
  const [valor, setValor] = useState(20000);
  const col = (...filhos) => h('div', { class: 'eco-col' }, ...filhos);
  return h(Tela, { id: 'primitivas', glifo: 'ajustes', titulo: 'Primitivas', aoFechar: () => {} },
    h('div', { class: 'eco-colunas' },
      col(
        h(Secao, { titulo: 'Botões' },
          h('div', { class: 'eco-acoes' },
            h(Botao, { a: 'p.pri', rotulo: 'Construir', class: 'bt-pri' }, 'Construir'),
            h(Botao, { a: 'p.sec', rotulo: 'Detalhes', class: 'bt-sec' }, 'Detalhes'),
            h(Botao, { a: 'p.fan', rotulo: 'Ver camada', class: 'bt-fan' }, 'Ver camada'),
            h(Botao, { a: 'p.ch', rotulo: 'Iniciar etapa', class: 'bt-ch' }, 'Iniciar etapa'),
            h(Botao, { a: 'p.perigo', rotulo: 'Demolir', class: 'bt-perigo' }, h(Glifo, { n: 'demolir', tam: 18 }), 'Demolir'),
            h(DoisToques, { a: 'p.dois', rotulo: 'Quitar tudo' }),
            h(Botao, { a: 'p.fraco', rotulo: 'Sem créditos', desligado: true, dica: 'Faltam 1.200', class: 'bt-sec' }, 'Sem créditos'))),
        h(Secao, { titulo: 'Escolhas' },
          h('div', { class: 'eco-acoes' },
            h(Segmentado, { a: 'p.seg', rotulo: 'Densidade', valor: seg, aoTrocar: setSeg, opcoes: [{ v: 'baixa', rotulo: 'Baixa' }, { v: 'media', rotulo: 'Média' }, { v: 'alta', rotulo: 'Alta', glifo: 'cadeado' }] }),
            h(Interruptor, { a: 'p.auto', rotulo: 'Auto', ligado: auto, aoTrocar: setAuto }),
            h(Quantidade, { a: 'p.lote', rotulo: 'Lote', valor: lote, aoMudar: setLote })),
          h(Deslizante, { a: 'p.desl', rotulo: 'Valor', valor, aoMudar: setValor, min: 1000, max: 50000, passo: 1000, botoes: true })),
        h(Secao, { titulo: 'Chips' },
          h('div', { class: 'eco-acoes' },
            h(Chip, { glifo: 'check', texto: 'Água', estado: 'ok' }),
            h(Chip, { glifo: 'alerta', texto: 'Esgoto', estado: 'al' }),
            h(Chip, { glifo: 'semEnergia', texto: 'Energia', estado: 'er' }),
            h(Chip, { glifo: 'conselho', texto: 'Conselho 1', estado: 'ch', a: 'p.chip' })))),
      col(
        h(Secao, { titulo: 'Avisos' },
          h(Aviso, { gravidade: 'grave', glifo: 'semEnergia', texto: 'Sem energia em 34 prédios', sub: 'há 3 min de jogo', acao: 'Ver' }),
          h('div', { style: 'height:6px' }),
          h(Aviso, { gravidade: 'atencao', glifo: 'esgoto', texto: 'Esgoto no limite', acao: 'Ver camada' }),
          h('div', { style: 'height:6px' }),
          h(Aviso, { gravidade: 'info', glifo: 'nivel', texto: 'Etapa pronta para começar' }),
          h('div', { style: 'height:6px' }),
          h(Aviso, { gravidade: 'holding', glifo: 'lote', texto: 'Lote de concreto pronto' })),
        h(Secao, { titulo: 'Linhas e números' },
          h(Linha, { glifo: 'material', titulo: 'Concreto', sub: 'Concreteira · lote de 10', valor: '+60/h' }),
          h(Linha, { glifo: 'caminhao', titulo: 'Frota', sub: '4 de 6 caminhões', valor: '1 na fila', valorEstado: 'al', a: 'p.linha', onClick: () => {} }),
          h('div', { class: 'eco-indicadores' },
            h(Indicador, { rotulo: 'Moradores', valor: '12.480', glifo: 'populacao' }),
            h(Indicador, { rotulo: 'Bem-estar', valor: '63', glifo: 'bemEstarBom', estado: 'ok' }),
            h(Indicador, { rotulo: 'Caixa', valor: '184.350', glifo: 'creditos', estado: 'ch' })),
          h(Barra, { valor: 0.62, rotulo: 'Obra', estado: 'al', texto: '62% · 04:10' }),
          h(Vazio, { glifo: 'mural', texto: 'Nada no Mural por enquanto.', acao: 'Ver Conselho' })))));
}

function montarFora(no) {
  const caixa = document.createElement('div');
  caixa.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  document.getElementById('ui').appendChild(caixa);
  render(no, caixa);
}

export function registrar(registrarCenaVitrine) {
  // todas as primitivas numa tela, para conferir alvos, texto e contraste
  registrarCenaVitrine('u1-primitivas', {
    cenario: 'meio',
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      montarFora(h(Primitivas));
      await esperar(60);
    },
  });
  // modal (decisão, marco): véu, sobretítulo, ações; o botão de dois toques armado
  registrarCenaVitrine('u1-modal', {
    cenario: 'meio',
    async preparar({ sim, esperar }) {
      contaFechada(sim);
      montarFora(h(Modal, { sobretitulo: 'Conselho · decisão', titulo: 'Água da Vila de Santa Cida', aoFechar: () => {}, acoes: [h(Botao, { a: 'm.depois', rotulo: 'Decidir depois', class: 'bt-fan' }, 'Decidir depois'), h(Botao, { a: 'm.ok', rotulo: 'Escolher', class: 'bt-pri', principal: true }, 'Escolher')] },
        h('p', { class: 'popover-texto' }, 'Dona Cida pede a captação no rio acima da Vila. Tomé prefere o reservatório do lago, que também serve à Arcologia.'),
        h(Barra, { valor: 0.4, rotulo: 'Prazo', estado: 'al', texto: 'prazo: 12 min de jogo' })));
      await esperar(60);
      document.querySelector('[data-a="m.ok"]')?.focus();
    },
  });
  // barra de cima em repouso: 1x, uma decisão pendente (chip do Conselho), a margem do bem-estar
  registrarCenaVitrine('u1-barra', {
    cenario: 'meio',
    repouso: true,
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      await esperar(50);
    },
    conferir: () => [
      ...barraCabe(),
      ...conferirTexto('[data-a="bemEstar"]', /\+\d+ acima de 61/, 'margem do bem-estar')(),
      ...conferirTexto('[data-a="calendario"]', /Mês \d+ · Ano \d+/, 'calendário')(),
      ...conferirTexto('[data-a="creditos"]', /\/h/, 'saldo por hora')(),
    ],
  });
  // barra no pior caso de largura: créditos de 7 dígitos, população de 6, bem-estar perto do degrau (âmbar)
  registrarCenaVitrine('u1-barra-cheia', {
    cenario: 'meio',
    repouso: true,
    espera: 700, // depois do destaque do salto dos créditos
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      Object.assign(sim.estado, { creditos: 9876543, populacao: 123456, bemEstar: 61.6 });
      acionar('velocidade', 3);
      await esperar(50);
    },
    conferir: () => [...barraCabe(), ...conferirTexto('[data-a="bemEstar"]', /\+1 acima de 61/, 'margem âmbar')()],
  });
  // popover do bem-estar: as faixas da regra do dono
  registrarCenaVitrine('u1-bem', {
    cenario: 'meio',
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      await esperar(30);
      acionar('bemEstar');
    },
    conferir: conferirTexto('[data-popover="barra.bem"]', /61 a 100.*11\/h/, 'faixas'),
  });
  // partida nova: pausado, saldo negativo com o glifo de alerta, população zero
  registrarCenaVitrine('u1-inicio', { cenario: 'inicio', repouso: true, conferir: conferirTexto('[data-hud="pausado"]', /pausado/i, 'chip de pausa') });
  // cartão de prédio residencial
  registrarCenaVitrine('u1-cartao-res', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      ctx.acionar('velocidade', 1);
      selecionar(ctx, IDX_RES);
      await ctx.esperar(60);
    },
    conferir: () => [
      ...conferirTexto('.cartao', /Moradores/, 'cartão residencial')(),
      ...conferirTexto('.cartao', /Contribuição/, 'cartão residencial')(),
      ...conferirTexto('.cartao', /\/h/, 'cartão residencial')(),
    ],
  });
  // cartão de serviço, com um aviso de atenção
  registrarCenaVitrine('u1-cartao-servico', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      servicoFalso(ctx.sim);
      ctx.acionar('velocidade', 1);
      selecionar(ctx, IDX_SERV);
      await ctx.esperar(60);
    },
    conferir: () => [
      ...conferirTexto('.cartao', /Atendidos/, 'cartão de serviço')(),
      ...conferirTexto('.cartao', /Faltam trabalhadores/, 'aviso do cartão')(),
    ],
  });
  // tela Economia: orçamento com a linha da regra
  registrarCenaVitrine('u1-economia', {
    cenario: 'meio',
    async preparar({ sim, ui, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      ui.ui.abrirTela('economia');
      await esperar(60);
    },
    conferir: () => [
      ...conferirTexto('[data-k="moradores"]', /Contribuição: 12\.480 × 11 = 137\.280\/h/, 'regra da contribuição')(),
      ...somaDoSaldo(),
    ],
  });
  // tela Economia: empréstimo com as regras escritas
  registrarCenaVitrine('u1-emprestimo', {
    cenario: 'meio',
    async preparar({ sim, ui, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      ui.ui.abrirTela('economia');
      await esperar(30);
      acionar('economia.aba', 'emprestimo');
      await esperar(60);
    },
    conferir: () => [
      ...conferirTexto('.eco-regras', /50\.000 por ano/, 'regras do empréstimo')(),
      ...conferirTexto('.eco-regras', /500\.000/, 'regras do empréstimo')(),
      ...conferirTexto('.eco-medidores', /10\.000 de 50\.000/, 'disponível no ano')(),
    ],
  });
  // folha de todos os glifos (conferência do estilo único), só no PC
  registrarCenaVitrine('u1-glifos', {
    semUI: true,
    tamanhos: ['1376x768'],
    preparar() {
      const nomes = nomesGlifos();
      const svg = (n) => {
        const g = glifo(n);
        const cheios = g.cheios.map((d) => `<path d="${d}" fill="currentColor" stroke="none" opacity=".35"/>`).join('');
        const tracos = g.tracos.map((d) => `<path d="${d}"/>`).join('');
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${cheios}${tracos}</svg>`;
      };
      const folha = document.createElement('div');
      folha.style.cssText = 'position:fixed;inset:0;z-index:99;background:#10151c;color:#eef2f6;font:600 12px Inter,sans-serif;display:grid;grid-template-columns:repeat(12,1fr);gap:6px;padding:16px;align-content:start;overflow:hidden';
      folha.innerHTML = nomes.map((n) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;border-radius:8px;background:rgba(255,255,255,.04)">${svg(n)}<span style="color:#a7b1bd;font-size:12px">${n}</span></div>`).join('') + `<div style="grid-column:span 2;align-self:center;color:#a7b1bd">${nomes.length} glifos</div>`;
      document.body.appendChild(folha);
    },
  });
}
