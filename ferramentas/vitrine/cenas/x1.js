// Cenas da vitrine da X1b (Arcologia jogável): o Livro da Arcologia no Ato 1 (a torre.e2 em obra, parada por falta de
// aço) e na aba da sede (as partes com o nome em inglês e o prazo da história), a folha da Blade Tower e Legacy Tower
// selecionadas e o momento da etapa pronta (o título com a fala da Íris). A simulação falsa ganha aqui uma q.arcologia
// no formato da X1b (materiais com o que está a caminho e no estoque, efeitos, datas, alturas e o M2).
//   node ferramentas/vitrine-ui.mjs <pasta> x1-livro,x1-livro-sede,x1-folha-torre,x1-momento 986x443,1376x768
import { abrirTelaNaAba } from '../../../fonte/ui/hud/Menu.jsx';
import { manterFolha } from '../../../fonte/ui/selecao/Cartao.jsx';
import { momentoDaEtapaX1 } from '../../../fonte/ui/telas/LivroArcologia.jsx';
import { ETAPAS, ETAPAS_M2, alturaBlade, alturaLegacy } from '../../../fonte/data/arcologia.js';
import { PARTES_ORDEM, PARTES_NOMES } from '../../../fonte/data/arcologia-plano.js';

const data = (tique, mes, ano) => ({ tique, mes, ano });

/** q.arcologia() falsa: lago.e1 e torre.e1 prontas, torre.e2 em obra a 55% parada por aço. */
function arcologiaFalsa() {
  const est = { 'lago.e1': 3, 'torre.e1': 3, 'torre.e2': 2, 'torre.e3': 1, 'torre.e4': 0 };
  const vista = (d) => {
    const e = est[d.id];
    const pronta = e === 3;
    const prog = pronta ? 1 : e === 2 ? 0.55 : 0;
    return {
      id: d.id, parte: d.parte, nome: d.nome, estado: e === 1 ? 0 : e, marco: d.marco, requisito: d.requisito,
      recusa: e === 1 ? 'trancado' : e === 0 ? 'marco' : null,
      creditos: d.creditos, minutos: d.minutos, fases: d.fases, fase: pronta ? 3 : Math.min(3, Math.floor(prog * 4)), progresso: prog,
      materiais: Object.entries(d.materiais).map(([item, pede]) => ({
        item, pede, entregue: pronta ? pede : e === 2 ? (item === 'aco' ? 20 : pede) : 0, aCaminho: e === 2 && item === 'aco' ? 10 : 0, estoque: item === 'concreto' ? 40 : 0,
      })),
      parada: e === 2 ? 'material' : null, efeitos: d.efeitos.map((x) => ({ ...x })), xp: d.xp,
      ini: d.id === 'lago.e1' ? data(300, 1, 2020) : d.id === 'torre.e1' ? data(5400, 10, 2020) : e === 2 ? data(9600, 5, 2021) : null,
      fim: d.id === 'lago.e1' ? data(780, 2, 2020) : d.id === 'torre.e1' ? data(6300, 11, 2020) : null,
      previsao: e === 2 ? data(10200, 6, 2021) : null,
    };
  };
  const g = 2.55;
  return {
    plano: 'A',
    nome: 'Park of Future Dreams',
    partes: PARTES_ORDEM.map((id) => ({
      id, nome: PARTES_NOMES[id], etapas: ETAPAS.filter((d) => d.parte === id).map(vista),
      futuras: ETAPAS_M2.filter((d) => d.parte === id).map((d) => ({ id: d.id, nome: d.nome, prazo: { ...d.prazo }, creditos: d.creditos, materiais: { ...d.materiais } })),
    })),
    progressoTotal: 2.55 / 5,
    valor: 60000 + 150000 + 300000 + 23800,
    alturas: { blade: alturaBlade(g), legacy: alturaLegacy(g), ponte: false },
    efeitos: { vagas: [0, 0, 0, 0], moradoresLuxo: 0, contribuicaoLuxoHora: 0, vias: 24, portoes: 8, agua: 6000 },
    inaugurada: false,
  };
}

const esperarSeletor = async (esperar, seletor, ms = 1500) => {
  for (let t = 0; t < ms; t += 30) {
    if (document.querySelector(seletor)) return;
    await esperar(30);
  }
};

const conferirTexto = (seletor, re, nome) => () => {
  const el = document.querySelector(seletor);
  if (!el) return [`${nome}: ${seletor} não apareceu`];
  return re.test(el.textContent ?? '') ? [] : [`${nome}: o texto não bate com ${re}`];
};

function ligar(sim) {
  sim.q.arcologia = arcologiaFalsa;
}

export function registrar(registrarCenaVitrine) {
  // Livro, Ato 1: o progresso, o investido em dólar, as alturas, as etapas com a data, a fase e o material parado
  registrarCenaVitrine('x1-livro', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      ligar(sim);
      abrirTelaNaAba(ui.ui, 'arcologia', 'etapas');
      await esperarSeletor(esperar, '[data-tela="arcologia"] .gest-colunas');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('[data-tela="arcologia"]', /Sede operacional/, 'etapa em obra')(),
      ...conferirTexto('[data-tela="arcologia"]', /falta material/, 'obra parada')(),
      ...conferirTexto('[data-tela="arcologia"]', /US\$/, 'dinheiro em dólar')(),
      ...conferirTexto('[data-tela="arcologia"]', /2021/, 'data do calendário')(),
    ],
  });
  // Livro, a sede: as partes em inglês e o que vem depois do Ato 1 com o prazo (jun. 2026, dez. 2032)
  registrarCenaVitrine('x1-livro-sede', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      ligar(sim);
      abrirTelaNaAba(ui.ui, 'arcologia', 'sede');
      await esperarSeletor(esperar, '[data-tela="arcologia"] .gest-colunas');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('[data-tela="arcologia"]', /Meridian Ring.*Horizon Ring/s, 'partes em inglês')(),
      ...conferirTexto('[data-tela="arcologia"]', /jun\. 2026/, 'prazo da história')(),
    ],
  });
  // a folha do par selecionado no mapa (sem cartão: abre a folha)
  registrarCenaVitrine('x1-folha-torre', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      ligar(sim);
      manterFolha.proxima = true;
      ui.ui.loja.selecao.value = { tipo: 'arcologia', ref: null, idx: 0, ponto: [172, 300, 174] };
      await esperarSeletor(esperar, '.lugar-folha .folha');
      await esperar(80);
    },
    conferir: conferirTexto('.lugar-folha .folha', /Blade Tower e Legacy Tower/, 'folha do par'),
  });
  // o momento da etapa pronta (sem o voo: o render falso)
  registrarCenaVitrine('x1-momento', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      ligar(sim);
      const m = { tipo: 'etapa', id: 'torre.e2', sub: { etapa: 2, de: 4, nome: 'Sede operacional' }, ...momentoDaEtapaX1({ id: 'torre.e2', estado: 3 }) };
      delete m.alvo;
      ui.ui.momento(m);
      await esperarSeletor(esperar, '.mom-terco');
      await esperar(80);
    },
    conferir: conferirTexto('.mom-terco', /Blade Tower e Legacy Tower.*Etapa 2 de 4/s, 'título da etapa'),
  });
}
