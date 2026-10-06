// Cenas da vitrine da UX1 (colocar com giro livre, motivo do vermelho, escolha livre e obras em paralelo, D98): o
// fantasma com a dica de cada bloqueio (declive, colisão, aplainar, sem via), o puxador de giro e o Alinhar à via, e o
// Livro da Arcologia com duas etapas em obra. A simulação falsa ganha um construir.previa de mentira no formato da
// simulação (o motivo e os dados que a dica lê) e uma q.arcologia com as equipes de obra.
//   node ferramentas/vitrine-ui.mjs <pasta> ux1-dica-declive,ux1-dica-aplainar,ux1-livro-paralelo 986x443,1376x768
import { ferramentas } from '../../../fonte/ui/ferramentas/sessao.js';
import { abrirTelaNaAba } from '../../../fonte/ui/hud/Menu.jsx';
import { ETAPAS, ETAPAS_M2, alturaBlade, alturaLegacy } from '../../../fonte/data/arcologia.js';
import { PARTES_ORDEM, PARTES_NOMES } from '../../../fonte/data/arcologia-plano.js';
import { LADRILHO } from '../../../fonte/contratos/flags.js';
import { bairroTeste } from './x2.js';

const ITEM = { tipo: 'clinica', nome: 'Clínica da Família', custo: 22000, manutencaoHora: 400, marco: 1, liberado: true, grupo: 'Saúde', glifo: 'saude', alcance: 600, capacidade: 1200, pegada: [40, 48] };

/** Põe o bairro de teste no espelho da simulação falsa e a previa de mentira no lugar dos substitutos. */
function prepararMundo(sim, R, previa) {
  const b = bairroTeste();
  sim.espelho.vias = { nos: b.nos, arestas: b.arestas };
  sim.espelho.celulas = b.celulas;
  sim.espelho.predios = b.predios;
  const estado = new Uint8Array(256);
  for (let j = 6; j <= 9; j++) for (let i = 6; i <= 9; i++) estado[j * 16 + i] = LADRILHO.HOLDING;
  sim.espelho.ladrilhos = { n: 16, estado, preco: new Float64Array(256) };
  delete sim.q.via;
  delete sim.q.zona;
  sim.q.construir = { previa };
  sim.q.catalogo = (cat) => (cat === 'servicos' ? [{ ...ITEM }] : []);
  R.camera.definir({ x: 380, z: 120, dist: 460, guinada: 16, inclinacao: 48 });
}

/** Evento da ferramenta num ponto do mundo (a tela sai da câmera de mentira). */
function evento(R, tipo, p, t) {
  const s = R.projetar([p[0], 0, p[1]]);
  return { tipo, ponto: [...p], tela: [s.x, s.y], dedo: [s.x, s.y + 56], t };
}

const existe = (sel, nome) => () => (document.querySelector(sel) ? [] : [`${nome}: ${sel} não apareceu`]);
const juntar = (...fs) => () => fs.flatMap((f) => f());
const textoTem = (sel, re, nome) => () => {
  const e = document.querySelector(sel);
  if (!e) return [`${nome}: ${sel} não apareceu`];
  return re.test(e.textContent) ? [] : [`${nome}: "${e.textContent.slice(0, 90)}" não bate com ${re}`];
};
const esperarSeletor = async (esperar, seletor, ms = 1500) => {
  for (let t = 0; t < ms; t += 30) {
    if (document.querySelector(seletor)) return;
    await esperar(30);
  }
};
// o painel do fantasma cabe na tela e não cobre a barra da ferramenta
const painelCabe = () => {
  const p = document.querySelector('.ux1-painel');
  const b = document.querySelector('.barra-ferr');
  if (!p || !b) return ['o painel ou a barra da ferramenta não apareceu'];
  const r = p.getBoundingClientRect();
  const q = b.getBoundingClientRect();
  const f = [];
  if (r.left < 0 || r.right > innerWidth + 1 || r.top < 0) f.push(`painel fora da tela (${Math.round(r.left)} a ${Math.round(r.right)}, topo ${Math.round(r.top)})`);
  if (r.bottom > q.top + 1) f.push(`painel (${Math.round(r.bottom)}) cobre a barra (${Math.round(q.top)})`);
  return f;
};

/** Previa de mentira de um bloqueio ou de um aplainar, no formato de q.construir.previa. */
const previa = (extra) => (a) => ({ x: a.x, z: a.z, rot: a.rot ?? 0, alinhado: false, rotVia: null, giro: null, pegada: [40, 48], custo: 22000, manutencaoHora: 400, alcance: 600, efeitos: [], ...extra });

/** q.arcologia() falsa: o lago e a fundação da torre em obra juntos (as duas equipes), a torre.e2 esperando a e1. */
function arcologiaFalsa() {
  const est = { 'lago.e1': 2, 'torre.e1': 2, 'torre.e2': 1, 'torre.e3': 0, 'torre.e4': 0 };
  const prog = { 'lago.e1': 0.62, 'torre.e1': 0.3 };
  const vista = (d) => {
    const e = est[d.id];
    const p = prog[d.id] ?? 0;
    return {
      id: d.id, parte: d.parte, nome: d.nome, estado: e, marco: d.marco, depende: [...d.depende],
      requisito: d.id === 'torre.e2' ? 'torre.e1' : d.id === 'torre.e3' ? 'torre.e2' : d.id === 'torre.e4' ? 'torre.e3' : null,
      emParalelo: e === 2 ? Object.keys(est).filter((k) => k !== d.id && est[k] === 2) : [Object.keys(est).filter((k) => est[k] === 2)].flat(),
      recusa: e === 1 ? 'trancado' : e === 0 ? 'marco' : null,
      creditos: d.creditos, minutos: d.minutos, fases: d.fases, fase: Math.min(3, Math.floor(p * 4)), progresso: p,
      materiais: Object.entries(d.materiais).map(([item, pede]) => ({ item, pede, entregue: e === 2 ? Math.round(pede * Math.min(1, p + 0.3)) : 0, aCaminho: 0, estoque: 30 })),
      parada: null, efeitos: d.efeitos.map((x) => ({ ...x })), xp: d.xp,
      ini: e === 2 ? { tique: 9000, mes: 8, ano: 2021 } : null, fim: null, previsao: e === 2 ? { tique: 10000, mes: 11, ano: 2021 } : null,
    };
  };
  return {
    plano: 'A',
    nome: 'Park of Future Dreams',
    partes: PARTES_ORDEM.map((id) => ({
      id, nome: PARTES_NOMES[id], etapas: ETAPAS.filter((d) => d.parte === id).map(vista),
      futuras: ETAPAS_M2.filter((d) => d.parte === id).map((d) => ({ id: d.id, nome: d.nome, prazo: { ...d.prazo }, creditos: d.creditos, materiais: { ...d.materiais } })),
    })),
    progressoTotal: (0.62 + 0.3) / 5,
    equipes: { total: 2, ocupadas: 2 },
    valor: 20000 + 50000 + 30000,
    alturas: { blade: alturaBlade(0.3), legacy: alturaLegacy(0.3), ponte: false },
    efeitos: { vagas: [0, 0, 0, 0], moradoresLuxo: 0, contribuicaoLuxoHora: 0, vias: 0, portoes: 0, agua: 0 },
    inaugurada: false,
  };
}

export function registrar(registrarCenaVitrine) {
  // declive acima do máximo: o motivo, o desnível e o que fazer, o botão e a cota com o motivo curto
  registrarCenaVitrine('ux1-dica-declive', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R, previa({ ok: false, codigo: 'declive', dados: { desnivel: 11.4, max: 9.6, livre: 5.76 } }));
      ferramentas.abrir('colocar', { item: ITEM });
      ferramentas.evento(evento(R, 'hover', [400, 150], 0));
      await esperarSeletor(esperar, '.ux1-painel');
      await esperar(60);
    },
    conferir: juntar(textoTem('.ux1-dica', /Terreno inclinado demais: 11,4 m de desnível, e dá para aplainar até 9,6 m/, 'dica do declive'), textoTem('[data-a="ferr.principal"]', /Íngreme demais/, 'motivo no botão'), existe('.ux1-puxador', 'puxador de giro'), existe('[data-a="colocar.alinhar"]', 'Alinhar à via'), painelCabe),
  });
  // aplainar: planta sobre declive de até o máximo, com o custo em dólar e a obra a mais
  registrarCenaVitrine('ux1-dica-aplainar', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R, previa({ ok: true, aplainar: { desnivel: 7.2, livre: 5.76, max: 9.6, volume: 3800, custo: 1330, tiques: 38 }, custoAplainar: 1330, custo: 23330, alinhado: true, rotVia: 0, giro: 0.646 }));
      ferramentas.abrir('colocar', { item: ITEM });
      ferramentas.evento(evento(R, 'hover', [400, 150], 0));
      await esperarSeletor(esperar, '.ux1-painel');
      await esperar(60);
    },
    conferir: juntar(textoTem('.ux1-dica', /Terreno inclinado: aplainar por US\$.*e mais 0,6 min de jogo de obra/, 'dica do aplainar'), existe('.ux1-puxador', 'puxador de giro'), painelCabe),
  });
  // colisão com uma via: quanto afastar (a via sai em vermelho no mundo)
  registrarCenaVitrine('ux1-dica-colisao', {
    cenario: 'meio',
    tamanhos: ['986x443', '1376x768'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R, previa({ ok: false, codigo: 'colisao', dados: { com: 'via', ref: 1048577, afastar: 6 } }));
      ferramentas.abrir('colocar', { item: ITEM });
      ferramentas.evento(evento(R, 'hover', [400, 150], 0));
      await esperarSeletor(esperar, '.ux1-painel');
      await esperar(60);
    },
    conferir: juntar(textoTem('.ux1-dica', /Colide com a via: afaste 6 m/, 'dica da colisão'), textoTem('[data-a="ferr.principal"]', /Colide: afaste 6 m/, 'motivo no botão'), painelCabe),
  });
  // sem via: o motivo e o que fazer, sem prender o fantasma
  registrarCenaVitrine('ux1-dica-acesso', {
    cenario: 'meio',
    tamanhos: ['986x443', '1376x768'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R, previa({ ok: false, codigo: 'acesso', dados: { max: 60, alinhar: true } }));
      ferramentas.abrir('colocar', { item: ITEM });
      ferramentas.evento(evento(R, 'hover', [400, 150], 0));
      await esperarSeletor(esperar, '.ux1-painel');
      await esperar(60);
    },
    conferir: juntar(textoTem('.ux1-dica', /Sem via a menos de 60 m: ligue uma via perto daqui/, 'dica do acesso'), painelCabe),
  });
  // o Livro com duas etapas em obra juntas: as equipes, a frase de quem anda junto e a torre.e2 esperando a e1
  registrarCenaVitrine('ux1-livro-paralelo', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      sim.q.arcologia = arcologiaFalsa;
      abrirTelaNaAba(ui.ui, 'arcologia', 'etapas');
      await esperarSeletor(esperar, '[data-tela="arcologia"] .gest-colunas');
      await esperar(80);
    },
    conferir: juntar(
      textoTem('[data-tela="arcologia"]', /Equipes de obra.*2 de 2 ocupadas/s, 'equipes'),
      textoTem('[data-tela="arcologia"]', /Em obra junto com/, 'obras em paralelo'),
      textoTem('[data-tela="arcologia"]', /Depois de/, 'a torre.e2 espera a e1'),
    ),
  });
}
