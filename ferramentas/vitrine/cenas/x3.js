// Cenas da vitrine da X3a (camadas, marcadores e rótulos): o popover das camadas aberto pelo trilho com a Água ligada
// (as categorias na legenda), a legenda do Bem-estar (rampa divergente com o cinza no 60 e as marcas das faixas da
// Contribuição) e a da Recursos com as obras paradas por falta de material. A simulação falsa ganha aqui uma q.camada
// e uma q.avisosPredios no formato da S2a.
//   node ferramentas/vitrine-ui.mjs <pasta> x3-camadas,x3-legenda-bemestar,x3-legenda-recursos 986x443,1376x768
import { PREDIO } from '../../../fonte/contratos/flags.js';

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

/** q.camada falsa no formato da S2a (os mesmos ids e chaves de texto). */
function camadaFalsa(sim, id) {
  const n = Math.max(1, sim.espelho?.predios?.n ?? 64);
  const dados = new Float32Array(n);
  for (let i = 0; i < n; i++) dados[i] = (i * 37) % 100;
  if (id === 'agua' || id === 'energia') {
    for (let i = 0; i < n; i++) dados[i] = 1 + ((i * 7) % 4);
    const cats = [1, 2, 3, 4].map((v) => ({ v, chave: `camada.${id}.${['', 'ok', 'racionado', 'sem', 'produtor'][v]}` }));
    return { id, fonte: 'predios', dados, grade: null, tipo: 'cat', escala: { min: 0, max: 4, unidade: 'm³/h' }, categorias: cats, legenda: cats, resumo: { chave: `camada.${id}.resumo`, params: { oferta: 12000, demanda: 9800, importado: 0 } }, versao: 1 };
  }
  if (id === 'bemEstar') {
    return { id, fonte: 'predios', dados, grade: null, tipo: 'seq', escala: { min: 0, max: 100, meio: 60, unidade: '' }, categorias: null, legenda: [{ v: 30, chave: 'camada.bemEstar.faixa5' }, { v: 60, chave: 'camada.bemEstar.faixa8' }, { v: 100, chave: 'camada.bemEstar.faixa11' }], resumo: { chave: 'camada.bemEstar.resumo', params: { media: 64, tarifa: 11 } }, versao: 1 };
  }
  if (id === 'recursos') {
    const g = 16;
    const cat = new Uint8Array(g * g).map((_, k) => k % 7);
    const leg = ['rocha', 'areia', 'argila', 'calcario', 'fertil', 'subterranea'].map((r, k) => ({ v: k + 1, chave: `recurso.${r}` }));
    return { id, fonte: 'grade', dados: new Float32Array(g * g).fill(0.5), categoria: cat, grade: { n: g, passo: 32, origem: [0, 0] }, tipo: 'seq', escala: { min: 0, max: 1, unidade: '' }, categorias: leg, legenda: leg, resumo: { chave: 'camada.recursos.resumo', params: {} }, versao: 1 };
  }
  return { id, fonte: 'predios', dados, grade: null, tipo: 'seq', escala: { min: 0, max: 100, unidade: '' }, categorias: null, legenda: [], resumo: { chave: 'x3.legenda.sintetica', params: {} }, versao: 1 };
}

/** Avisos falsos: 3 obras paradas por falta de material e 2 prédios sem água. */
const avisosFalsos = () => ({
  versao: 2, idx: Int32Array.from([3, 5, 8, 11, 17]), glifo: Uint8Array.from([6, 6, 6, 3, 3]), gravidade: Uint8Array.from([1, 1, 1, 2, 2]),
  nomes: ['', 'abandonado', 'alerta', 'semAgua', 'semEnergia', 'semVia', 'semMaterial', 'semTrabalhadores', 'poucosClientes', 'trabalho', 'bemEstarRuim'],
});

function ligar(sim) {
  sim.q.camada = (id) => camadaFalsa(sim, id);
  sim.q.avisosPredios = avisosFalsos;
  // as 3 obras paradas também pela flag do prédio no espelho (a legenda da Recursos conta por ela)
  const P = sim.espelho?.predios;
  if (P?.flags) for (const i of [3, 5, 8]) if (i < P.n) P.flags[i] |= PREDIO.OBRA | PREDIO.SEM_MATERIAL;
}

export function registrar(registrarCenaVitrine) {
  // o popover pelo trilho, com a Água ligada: a grade das camadas, o filtro dos avisos e a legenda por categoria
  registrarCenaVitrine('x3-camadas', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar, clicar }) {
      ligar(sim);
      await clicar('[data-a="trilho"][data-k="camadas"]');
      await esperarSeletor(esperar, '.x3-pop');
      await clicar('.x3-pop [data-a="camada"][data-k="agua"]');
      await esperarSeletor(esperar, '.x3-leg');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('.x3-pop', /Zonas.*Bem-estar.*Água.*Energia.*Serviços.*Recursos/s, 'grade das camadas')(),
      ...conferirTexto('.x3-pop', /Graves e atenção/, 'filtro dos avisos')(),
      ...conferirTexto('.x3-leg', /Com água.*Racionada.*Sem água/s, 'legenda da Água')(),
      ...(document.querySelector('.x3-pop [data-k="agua"][aria-pressed="true"]') ? [] : ['a Água não ficou marcada no popover']),
    ],
  });
  // a legenda do Bem-estar: a rampa divergente, o 0 e o 100 nas pontas e as marcas do 30 e do 60
  registrarCenaVitrine('x3-legenda-bemestar', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      ligar(sim);
      ui.ui.loja.camada.value = 'bemEstar';
      await esperarSeletor(esperar, '.x3-leg');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('.x3-leg', /Bem-estar/, 'título')(),
      ...conferirTexto('.x3-leg .x3-escala', /0.*30.*60.*100/s, 'escala')(),
      // a Contribuição em dólar (D68, D87): 11 unidades de desenho são US$ 6.600
      ...conferirTexto('.x3-leg', /Contribuição de US\$ 6\.600/, 'resumo em dólar')(),
    ],
  });
  // a Recursos: os recursos por categoria e as obras paradas por falta de material com "Próxima"
  registrarCenaVitrine('x3-legenda-recursos', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar }) {
      ligar(sim);
      ui.ui.loja.camada.value = 'recursos';
      await esperarSeletor(esperar, '.x3-leg .x3-extra');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('.x3-leg', /Rocha.*Areia.*Argila.*Calcário/s, 'recursos')(),
      ...conferirTexto('.x3-leg .x3-extra', /3 obras paradas por falta de material/, 'obras paradas')(),
      ...(document.querySelector('.x3-leg [data-a="x3.legenda.proxima"]') ? [] : ['sem o botão Próxima']),
    ],
  });
}
