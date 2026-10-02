// Cenas da vitrine da U1a (pele da interface): barra de cima em repouso e com popover, partida nova (saldo negativo,
// pausado), cartão de prédio residencial, de serviço e em obra, tela Economia (orçamento e empréstimo) e a folha de
// glifos. E as da U1b (u1b-*): telas Holding, Cidade, Progresso e Conselho, decisão, momento do marco e da etapa,
// folha por tipo (residencial, empresa da Holding, via, terreno), menu de contexto, faixa de alerta, avisos, objetivos,
// "Onde você parou" e a Ajuda do menu.
//   node ferramentas/vitrine-ui.mjs <pasta> u1-barra,u1-cartao-res,u1-cartao-servico,u1-economia
// A simulação falsa dá os números de uma cidade de 12 mil; o serviço é montado aqui sobre q.predio (a falsa só tem
// zonas) no formato do contrato: o tipo do catálogo ('clinica') diz a categoria, sem campo extra.
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
import { avisar } from '../../../fonte/ui/loja.js';
import { abrirTelaNaAba } from '../../../fonte/ui/hud/Menu.jsx';
import { abrirDecisao } from '../../../fonte/ui/telas/Decisao.jsx';
import { manterFolha } from '../../../fonte/ui/selecao/Cartao.jsx';
import { abrirMenuContexto } from '../../../fonte/ui/mundo/MenuContexto.jsx';
import { mostrarRetomar } from '../../../fonte/ui/hud/Retomar.jsx';
import { objetivoRecolhido } from '../../../fonte/ui/hud/Objetivo.jsx';
import { registrarItemTrilho } from '../../../fonte/ui/hud/Trilho.jsx';

const REF = (idx) => idx + 2 ** 20;
const IDX_RES = 3; // quadra 0: residencial baixa na simulação falsa
const IDX_SERV = 40;

// no PC a seleção abre a folha direto (U1b); as cenas do cartão pedem o cartão também no PC (prefs.cartaoNoPC)
function selecionar({ ui, R, sim }, idx, { cartao = true } = {}) {
  const loja = ui.ui.loja;
  if (cartao) loja.prefs.value = { ...(loja.prefs.peek() ?? {}), cartaoNoPC: true };
  const P = sim.espelho.predios;
  loja.selecao.value = { tipo: 'predio', ref: REF(idx), idx, ponto: [P.x[idx], 0, P.z[idx]] };
  R.selecionado(REF(idx));
}

function servicoFalso(sim) {
  const original = sim.q.predio;
  sim.q.predio = (ref) => {
    if (ref !== REF(IDX_SERV)) return original(ref);
    const tique = sim.estado.tique;
    return {
      ref, tipo: 'clinica', modelo: 0, nome: 'Clínica da Família Santa Cida', zona: 0, nivel: 1, estado: 'ok', obra: null,
      moradia: null, trabalho: null, nivelProx: null,
      servicos: { agua: 'ok', esgoto: 'ok', energia: 'ok', saude: 1, educacao: 0, seguranca: 0, bombeiros: 0, lazer: 0 },
      servico: { capacidade: 800, uso: 620, eficiencia: 0.74, alcance: 600, manutencaoHora: 400 },
      holding: null, cor: 0, via: { ref: 2, nome: 'Rua da Matriz' },
      avisos: [{ codigo: 'semTrabalhadores', gravidade: 'atencao', desde: tique - 240, acao: null }],
      faz: 'atende a saúde de quem mora a até 600 m',
    };
  };
}

// prédio em obra parado por falta de material: o ramo da obra do cartão (fase e barra no lugar dos números)
const IDX_OBRA = 41;
function obraFalsa(sim) {
  const original = sim.q.predio;
  sim.q.predio = (ref) => {
    const p = original(ref);
    if (ref !== REF(IDX_OBRA) || !p) return p;
    const tique = sim.estado.tique;
    return {
      ...p, nome: 'Galeria Jardim da Baía', estado: 'obra', moradia: null, trabalho: null,
      obra: { fase: 'estrutura', progresso: 0.42, fimTique: tique + 900, semMaterial: true },
      avisos: [{ codigo: 'semMaterial', gravidade: 'atencao', desde: tique - 150, acao: null }],
      faz: 'vai abrir lojas e empregos no bairro',
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

// valor em dólar escrito curto ("+US$ 80,6 mi/h", "−US$ 13,4 mi/h", "US$ 4.800/h") de volta a número
const ESCALA = { mil: 1e3, mi: 1e6, bi: 1e9, tri: 1e12 };
const RE_DOLAR = /([+−-]?)US\$\s?([\d.]+(?:,\d+)?)(?:\s(mil|mi|bi|tri))?/g;
const lerDolar = (m) => (m[1] === '−' || m[1] === '-' ? -1 : 1) * Number(m[2].replace(/\./g, '').replace(',', '.')) * (ESCALA[m[3]] ?? 1);
const dolares = (s) => [...(s ?? '').matchAll(RE_DOLAR)].map(lerDolar);

// o saldo em destaque é a conta escrita embaixo dele (receitas menos despesas, com a folga do arredondamento curto) e
// o mesmo da barra de cima
function somaDoSaldo() {
  const saldo = document.querySelector('.eco-saldo')?.textContent ?? '';
  const conta = dolares(document.querySelector('.eco-saldo-conta')?.textContent);
  const barra = document.querySelector('[data-a="creditos"] .hud-sub')?.textContent ?? '';
  const [s] = dolares(saldo);
  const f = [];
  const folga = (v) => Math.abs(v) * 0.006 + 1;
  if (conta.length !== 2 || !Number.isFinite(s) || Math.abs(s - (conta[0] + conta[1])) > folga(conta[0]) + folga(conta[1])) f.push(`saldo "${saldo}" não é a conta "${conta.join(' ')}"`);
  if (dolares(barra)[0] !== s) f.push(`saldo da barra "${barra}" difere do da Economia "${saldo}"`);
  return f;
}

// o popover está por cima de tudo no próprio centro e nos cantos de baixo (nem a tela nem o cartão o cobrem)
function popoverPorCima(seletor) {
  const p = document.querySelector(seletor);
  if (!p) return [`${seletor} não abriu`];
  const r = p.getBoundingClientRect();
  const pontos = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 12, r.bottom - 12], [r.right - 12, r.bottom - 12]];
  return pontos.some(([x, y]) => !p.contains(document.elementFromPoint(x, y))) ? [`${seletor} ficou por baixo de outra camada`] : [];
}

// área dos grupos do HUD (a mesma conta da vitrine) para cenas que não são repouso: a meta da 7.1 com o objetivo
// aberto (~17,6% em 986 x 443 e ~19% em 915 x 412)
const META_AREA = { 986: 17.6, 915: 19 };
function areaDoHud() {
  const meta = META_AREA[innerWidth];
  if (!meta) return [];
  const area = [...document.querySelectorAll('[data-hud]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    .reduce((s, r) => s + Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)), 0);
  const pct = (100 * area) / (innerWidth * innerHeight);
  return pct > meta ? [`HUD em ${pct.toFixed(1)}% (meta ${meta}%)`] : [];
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
          h('div', { class: 'fileira' },
            h(Botao, { a: 'p.pri', rotulo: 'Construir', class: 'bt-pri' }, 'Construir'),
            h(Botao, { a: 'p.sec', rotulo: 'Detalhes', class: 'bt-sec' }, 'Detalhes'),
            h(Botao, { a: 'p.fan', rotulo: 'Ver camada', class: 'bt-fan' }, 'Ver camada'),
            h(Botao, { a: 'p.ch', rotulo: 'Iniciar etapa', class: 'bt-ch' }, 'Iniciar etapa'),
            h(Botao, { a: 'p.perigo', rotulo: 'Demolir', class: 'bt-perigo' }, h(Glifo, { n: 'demolir', tam: 18 }), 'Demolir'),
            h(DoisToques, { a: 'p.dois', rotulo: 'Quitar tudo' }),
            h(Botao, { a: 'p.fraco', rotulo: 'Sem créditos', desligado: true, dica: 'Faltam 1.200', class: 'bt-sec' }, 'Sem créditos'))),
        h(Secao, { titulo: 'Escolhas' },
          h('div', { class: 'fileira' },
            h(Segmentado, { a: 'p.seg', rotulo: 'Densidade', valor: seg, aoTrocar: setSeg, opcoes: [{ v: 'baixa', rotulo: 'Baixa' }, { v: 'media', rotulo: 'Média' }, { v: 'alta', rotulo: 'Alta', glifo: 'cadeado' }] }),
            h(Interruptor, { a: 'p.auto', rotulo: 'Auto', ligado: auto, aoTrocar: setAuto }),
            h(Quantidade, { a: 'p.lote', rotulo: 'Lote', valor: lote, aoMudar: setLote })),
          h(Deslizante, { a: 'p.desl', rotulo: 'Valor', valor, aoMudar: setValor, min: 1000, max: 50000, passo: 1000, botoes: true })),
        h(Secao, { titulo: 'Chips' },
          h('div', { class: 'fileira' },
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
    async preparar({ sim, ui, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      // a tela das primitivas monta fora da árvore: marca a tela aberta para o HUD de baixo sumir como numa tela de
      // verdade (a barra de construção da X2 some sob as telas)
      ui.ui.loja.tela.value = 'primitivas';
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
      ...conferirTexto('[data-a="calendario"]', /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\. 20\d\d/, 'calendário (D67)')(),
      ...conferirTexto('[data-a="creditos"]', /US\$ /, 'caixa em dólar (D87)')(),
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
  // PC com as cinco telas de gestão registradas (a U1b registra Holding, Cidade, Progresso e Conselho): a barra aperta
  // (sem os botões repetidos de Holding e Conselho, depois só com glifo e, se preciso, sem o valor e a dívida) em vez de
  // sair da tela
  registrarCenaVitrine('u1-barra-pc', {
    cenario: 'meio',
    repouso: true,
    tamanhos: ['1376x768', '1920x1080'],
    async preparar({ sim, ui, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      await esperar(120); // o aperto mede no quadro seguinte ao do ResizeObserver
    },
    conferir: () => {
      const f = barraCabe();
      // Economia, Cidade e Progresso ficam sempre; Holding e Conselho só com folga (o H e o chip abrem as duas)
      const k = [...document.querySelectorAll('[data-a="gestao"]')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.dataset.k);
      for (const id of ['economia', 'cidade', 'progresso']) if (!k.includes(id)) f.push(`sem o botão da tela ${id}`);
      return f;
    },
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
    conferir: conferirTexto('[data-popover="barra.bem"]', /61 a 100.*US\$ 6\.600\/h/, 'faixas'),
  });
  // o "de onde vem" com a Economia aberta: a barra fica à vista e o popover abre por cima da tela
  registrarCenaVitrine('u1-bem-tela', {
    cenario: 'meio',
    async preparar({ sim, ui, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      ui.ui.abrirTela('economia');
      await esperar(30);
      acionar('bemEstar');
    },
    conferir: () => popoverPorCima('[data-popover="barra.bem"]'),
  });
  // o menu do canto abre a tela 'menu' da U1b (Retomar, as telas registradas, Ajuda), que vem sob demanda
  registrarCenaVitrine('u1-menu', {
    cenario: 'meio',
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 1);
      await esperar(30);
      acionar('menu');
      await esperar(150);
    },
    conferir: () => [...conferirTexto('[data-tela="menu"]', /Retomar.*Holding.*Economia.*Cidade.*Progresso.*Conselho.*Ajuda/, 'menu')()],
  });
  // partida nova: pausado, saldo negativo com o glifo de alerta, população zero e o bem-estar "sem moradores". É o
  // estado Pausado da 7.3 (o chip sob a barra, no centro) com o objetivo aberto da primeira hora embaixo, no centro
  // (7.1): os dois juntos deixam 307 px no meio em 986 x 443, então a faixa livre do repouso mede-se na cena seguinte,
  // em 1x; aqui fica a área do HUD, com a meta do objetivo aberto
  registrarCenaVitrine('u1-inicio', {
    cenario: 'inicio',
    conferir: () => [
      ...conferirTexto('[data-hud="pausado"]', /pausado/i, 'chip de pausa')(),
      ...conferirTexto('[data-a="bemEstar"]', /sem moradores/, 'bem-estar da cidade vazia')(),
      ...areaDoHud(),
    ],
  });
  // partida nova rodando em 1x: o repouso da primeira hora, com o cartão do objetivo aberto
  registrarCenaVitrine('u1-inicio-1x', {
    cenario: 'inicio',
    repouso: true,
    async preparar({ acionar, esperar }) {
      acionar('velocidade', 1);
      await esperar(40);
    },
    conferir: () => [...conferirTexto('[data-hud="objetivo"]', /Objetivo 1 de 3/i, 'objetivo aberto na primeira hora')()],
  });
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
      ...conferirTexto('.cartao-sub', /^Saúde · alcance de 600 m$/, 'categoria pelo tipo do catálogo')(),
    ],
  });
  // cartão de prédio em obra: a fase e a barra no lugar dos números, o aviso de material em cima
  registrarCenaVitrine('u1-cartao-obra', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      obraFalsa(ctx.sim);
      ctx.acionar('velocidade', 1);
      selecionar(ctx, IDX_OBRA);
      await ctx.esperar(60);
    },
    conferir: () => [
      ...conferirTexto('.cartao-obra', /Em obra: estrutura/, 'fase da obra')(),
      ...conferirTexto('.cartao', /falta material/, 'aviso da obra')(),
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
      ...conferirTexto('[data-k="moradores"]', /Contribuição: 12\.480 × US\$ 6\.600 = US\$ 82,4 mi\/h/, 'regra da contribuição')(),
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
      ...conferirTexto('.eco-regras', /US\$ 30 mi por ano/, 'regras do empréstimo')(),
      ...conferirTexto('.eco-regras', /US\$ 300 mi/, 'regras do empréstimo')(),
      ...conferirTexto('.eco-medidores', /US\$ 6 mi de US\$ 30 mi/, 'disponível no ano')(),
    ],
  });
  registrarU1b(registrarCenaVitrine);
  // folha de todos os glifos (conferência do estilo único), só no PC grande (cabem os ~150 com o nome)
  registrarCenaVitrine('u1-glifos', {
    semUI: true,
    tamanhos: ['1920x1080'],
    preparar() {
      const nomes = nomesGlifos();
      const svg = (n) => {
        const g = glifo(n);
        const cheios = g.cheios.map((d) => `<path d="${d}" fill="currentColor" stroke="none" opacity=".35"/>`).join('');
        const tracos = g.tracos.map((d) => `<path d="${d}"/>`).join('');
        return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${cheios}${tracos}</svg>`;
      };
      const folha = document.createElement('div');
      folha.style.cssText = 'position:fixed;inset:0;z-index:99;background:#10151c;color:#eef2f6;font:600 12px Inter,sans-serif;display:grid;grid-template-columns:repeat(16,1fr);gap:6px;padding:16px;align-content:start;overflow:hidden';
      folha.innerHTML = nomes.map((n) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;border-radius:8px;background:rgba(255,255,255,.04)">${svg(n)}<span style="color:#a7b1bd;font-size:12px">${n}</span></div>`).join('') + `<div style="grid-column:span 2;align-self:center;color:#a7b1bd">${nomes.length} glifos</div>`;
      document.body.appendChild(folha);
    },
  });
}

// ================================================================================================== U1b

const IDX_HOLDING = 7; // na simulação falsa, um prédio em cada 9 (índice 7) é a Concreteira da Holding
const REF_VIA = 5;

// as telas e os modais vêm sob demanda: espera o corpo chegar
async function esperarSeletor(esperar, seletor, ms = 1500) {
  for (let t = 0; t < ms; t += 30) {
    if (document.querySelector(seletor)) return;
    await esperar(30);
  }
}

// abre a folha (no celular a seleção abre o cartão; "Detalhes" abre a folha: aqui direto)
async function abrirFolha({ ui, R, esperar }, sel, ref = null) {
  manterFolha.proxima = true;
  ui.ui.loja.selecao.value = sel;
  if (ref !== null) R.selecionado(ref);
  await esperarSeletor(esperar, '.lugar-folha .folha');
  await esperar(60);
}

const tela = (id, aba, re, nome, extra = {}) => ({
  cenario: 'meio',
  async preparar({ sim, ui, esperar }) {
    contaFechada(sim);
    abrirTelaNaAba(ui.ui, id, aba);
    await esperarSeletor(esperar, `[data-tela="${id}"] .tela-corpo > *`);
    await esperar(80);
    await extra.depois?.({ ui, esperar });
  },
  conferir: () => [...conferirTexto(`[data-tela="${id}"]`, re, nome)(), ...(extra.conferir?.() ?? [])],
});

function registrarU1b(registrarCenaVitrine) {
  // Holding: visão geral com Influência e Legado, o efeito escrito embaixo de cada medidor (D55)
  registrarCenaVitrine('u1b-holding', tela('holding', 'geral', /Influência.*Legado/, 'medidores da Holding'));
  // produção: as linhas com lote de 1 a 10, Auto e a sugestão de lote da parada por estoque
  registrarCenaVitrine('u1b-holding-producao', tela('holding', 'producao', /Concreto/, 'linhas de produção'));
  // Mercado: "37 de 100 vendas nesta janela", preços a 150% e "Abastecer a cidade por importação"
  registrarCenaVitrine('u1b-holding-mercado', tela('holding', 'mercado', /\d+ de 100 vendas nesta janela.*importação/i, 'mercado'));
  // Cidade: demanda com os fatores por zona
  registrarCenaVitrine('u1b-cidade', tela('cidade', 'demanda', /Residencial/, 'demanda da cidade'));
  // Progresso: os marcos, o que cada um libera e o requisito do marco 7
  registrarCenaVitrine('u1b-progresso', tela('progresso', 'marcos', /Marco 7|Cidade Grande/, 'marcos'));
  // Conselho: a decisão pendente em cartão, quem propõe, o prazo
  registrarCenaVitrine('u1b-conselho', tela('conselho', 'decisoes', /Decidir/, 'decisões pendentes'));
  // Conselho: os seis conselheiros com nome completo e cargo (D83)
  registrarCenaVitrine('u1b-conselheiros', tela('conselho', 'conselheiros', /Íris.*Tomé/, 'conselheiros'));
  // o modal da decisão: as opções lado a lado, quem propõe, ganho e custo, "Decidir depois" com o prazo
  registrarCenaVitrine('u1b-decisao', {
    cenario: 'meio',
    async preparar({ sim, esperar }) {
      contaFechada(sim);
      abrirDecisao('febre.aurora');
      await esperarSeletor(esperar, '[data-modal="decisao"] .dec-cartao');
      await esperar(80);
    },
    conferir: () => [...conferirTexto('[data-modal="decisao"]', /Escolher.*Escolher/, 'opções da decisão')(), ...conferirTexto('[data-modal="decisao"]', /Decidir depois/, 'adiar')()],
  });
  // o momento do marco depois do título: prêmios em dólar, licença e "Liberado agora" (sem a cena, direto ao modal)
  registrarCenaVitrine('u1b-momento', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      contaFechada(sim);
      const loja = ui.ui.loja;
      loja.prefs.value = { ...(loja.prefs.peek() ?? {}), cenasMarco: false };
      ui.ui.momento({ tipo: 'marco', n: 5, nome: 'Cidade Nova', premios: { creditos: 50000, licencas: 1 }, libera: ['holding.concreteira', 'item.concreto', 'servico.bombeiros', 'zona.resMedia'], fala: { quem: 'cida', texto: 'A Vila virou cidade. Agora a orla inteira quer morar aqui.' } });
      await esperarSeletor(esperar, '[data-modal="momento"]');
      await esperar(80);
    },
    conferir: () => [...conferirTexto('[data-modal="momento"]', /US\$ 30 mi/, 'prêmio em dólar')(), ...conferirTexto('[data-modal="momento"]', /Concreteira/, 'liberado agora')()],
  });
  // o título de terço inferior da etapa da Torre, com a fala e "Continuar"
  registrarCenaVitrine('u1b-momento-etapa', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      contaFechada(sim);
      ui.ui.momento({ tipo: 'etapa', titulo: 'Blade Tower', sub: { etapa: 2, de: 4, nome: 'Sede operacional' }, fala: { quem: 'iris', texto: 'A sede operacional está de pé. Daqui a Holding vê a baía inteira.' } });
      await esperarSeletor(esperar, '.mom-terco');
      await esperar(80);
    },
    conferir: conferirTexto('.mom-terco', /Etapa 2 de 4/, 'título da etapa'),
  });
  // folha do residencial: moradores, contribuição em dólar, serviços, cores
  registrarCenaVitrine('u1b-folha-res', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      const P = ctx.sim.espelho.predios;
      await abrirFolha(ctx, { tipo: 'predio', ref: REF(IDX_RES), idx: IDX_RES, ponto: [P.x[IDX_RES], 0, P.z[IDX_RES]] }, REF(IDX_RES));
    },
    conferir: () => [...conferirTexto('.lugar-folha .folha', /Moradores/, 'folha residencial')(), ...conferirTexto('.lugar-folha .folha', /US\$/, 'dinheiro em dólar')()],
  });
  // folha da empresa da Holding: linhas de produção, vagas, nível
  registrarCenaVitrine('u1b-folha-empresa', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      const P = ctx.sim.espelho.predios;
      await abrirFolha(ctx, { tipo: 'predio', ref: REF(IDX_HOLDING), idx: IDX_HOLDING, ponto: [P.x[IDX_HOLDING], 0, P.z[IDX_HOLDING]] }, REF(IDX_HOLDING));
    },
    conferir: () => [...conferirTexto('.lugar-folha .folha', /Concreteira/, 'folha da empresa')(), ...conferirTexto('.lugar-folha .folha', /Concreto/, 'linha de produção')()],
  });
  // folha da via: tipo, comprimento, declive, manutenção em dólar e "Melhorar"
  registrarCenaVitrine('u1b-folha-via', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      await abrirFolha(ctx, { tipo: 'aresta', ref: REF_VIA, ponto: [0, 0, 0] });
    },
    conferir: () => [...conferirTexto('.lugar-folha .folha', /Avenida das Palmeiras/, 'folha da via')(), ...conferirTexto('.lugar-folha .folha', /412 m/, 'comprimento')()],
  });
  // folha do terreno: área, cota e recursos do ponto
  registrarCenaVitrine('u1b-folha-terreno', {
    cenario: 'meio',
    async preparar(ctx) {
      contaFechada(ctx.sim);
      await abrirFolha(ctx, { tipo: 'terreno', ponto: [120, 4, -80] });
    },
    conferir: conferirTexto('.lugar-folha .folha', /Terreno|Cota/i, 'folha do terreno'),
  });
  // menu de contexto radial numa empresa da Holding (toque longo ou botão direito)
  registrarCenaVitrine('u1b-ctx', {
    cenario: 'meio',
    async preparar({ sim, ui, R, esperar }) {
      contaFechada(sim);
      const original = R.selecionar;
      R.selecionar = () => ({ tipo: 'predio', ref: REF(IDX_HOLDING), idx: IDX_HOLDING });
      abrirMenuContexto(ui.ui, Math.round(innerWidth * 0.45), Math.round(innerHeight * 0.6));
      R.selecionar = original;
      await esperar(80);
    },
    conferir: () => {
      const n = document.querySelectorAll('.ctx-petala').length;
      return n === 4 ? conferirTexto('.ctx', /Produção/, 'pétala de produção')() : [`menu de contexto com ${n} pétalas`];
    },
  });
  // caixa zerado: a faixa grave com as três saídas (empréstimo, Depósito, orçamento) e a pausa
  registrarCenaVitrine('u1b-faixa-caixa', {
    cenario: 'meio',
    espera: 900, // depois da contagem dos créditos até 0
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      acionar('velocidade', 0); // pausa antes de zerar, senão o saldo positivo da cidade enche o caixa de novo
      await esperar(30);
      sim.estado.creditos = 0;
      await esperar(60);
    },
    conferir: () => {
      const f = [...conferirTexto('[data-hud="faixa"]', /Caixa zerado/i, 'faixa do caixa')(), ...conferirTexto('[data-hud="pausado"]', /pausado/i, 'chip de pausa')()];
      // as três saídas da D41: na faixa no PC; até 1.100 px, a primeira na faixa e as outras no "Mais"
      const visiveis = [...document.querySelectorAll('[data-a="faixa.acao"]')].filter((b) => b.getBoundingClientRect().width > 0).length;
      const mais = document.querySelector('[data-a="faixa.mais"]')?.getBoundingClientRect().width > 0;
      if (!(visiveis === 3 || (visiveis === 1 && mais))) f.push(`saídas do caixa zerado: ${visiveis} na faixa${mais ? ' e o Mais' : ''}`);
      if (!/US\$ 0\b/.test(document.querySelector('[data-a="creditos"]')?.textContent ?? '')) f.push('o caixa não mostra US$ 0');
      return f;
    },
  });
  // falta água: a faixa de atenção com "Ver camada" e dois avisos curtos à direita
  registrarCenaVitrine('u1b-faixa-agua', {
    cenario: 'meio',
    async preparar({ sim, esperar }) {
      contaFechada(sim);
      // as Camadas como a X3a registra (sem elas, a faixa leva ao lugar com "Ver", não com "Ver camada")
      registrarItemTrilho({ id: 'camadas', glifo: 'camadas', rotulo: 'trilho.camadas', ordem: 10, aoTocar: () => {} });
      sim.estado.alertaAgua = true;
      avisar({ texto: 'Lote de concreto pronto na Concreteira Held', gravidade: 'holding', glifo: 'lote' });
      avisar({ texto: 'Objetivo cumprido: Leve água à Vila de Santa Cida', gravidade: 'info', glifo: 'objetivo' });
      await esperar(80);
    },
    conferir: () => [...conferirTexto('[data-hud="faixa"]', /Falta água.*Ver camada/, 'faixa da água')(), ...(document.querySelectorAll('.toast').length === 2 ? [] : ['os dois avisos não apareceram'])],
  });
  // os três objetivos abertos na lista (cidade, Holding, Arcologia), com quem fala
  registrarCenaVitrine('u1b-objetivos', {
    cenario: 'meio',
    async preparar({ sim, acionar, esperar }) {
      contaFechada(sim);
      objetivoRecolhido.value = false;
      await esperar(40);
      acionar('objetivo.lista');
      await esperar(60);
    },
    conferir: () => {
      const n = document.querySelectorAll('.obj-linha').length;
      return n === 3 ? [] : [`lista com ${n} objetivos`];
    },
  });
  // "Onde você parou" ao carregar: o objetivo da Arcologia e o problema maior
  registrarCenaVitrine('u1b-retomar', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      contaFechada(sim);
      // as Camadas como a X3a registra (sem elas, a faixa leva ao lugar com "Ver", não com "Ver camada")
      registrarItemTrilho({ id: 'camadas', glifo: 'camadas', rotulo: 'trilho.camadas', ordem: 10, aoTocar: () => {} });
      sim.estado.alertaAgua = true;
      mostrarRetomar(ui.ui);
      await esperar(80);
    },
    conferir: conferirTexto('[data-hud="retomar"]', /Falta água/, 'problema no retomar'),
  });
  // a Ajuda do menu: glossário curto e atalhos do PC
  registrarCenaVitrine('u1b-ajuda', {
    cenario: 'meio',
    async preparar({ sim, ui, acionar, esperar }) {
      contaFechada(sim);
      ui.ui.abrirTela('menu');
      await esperarSeletor(esperar, '[data-a="menu.item"][data-k="ajuda"]');
      acionar('menu.item', 'ajuda');
      await esperar(80);
    },
    conferir: conferirTexto('[data-tela="menu"]', /Demanda.*Espaço/, 'glossário e atalhos'),
  });
}
