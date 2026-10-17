// Cenas da vitrine da X3a (camadas, marcadores e rótulos): o popover das camadas aberto pelo trilho com a Água ligada
// (as categorias na legenda e o filtro dos avisos em "Graves e atenção", o padrão da C1d), a legenda do Bem-estar (rampa
// divergente com o cinza no 60, as marcas das faixas e, sob a rampa, a Contribuição de cada faixa em dólar por hora com a
// da cidade em destaque) e a da Recursos com as obras paradas por falta de material. A simulação falsa ganha aqui uma
// q.camada e uma q.avisosPredios no formato da S2a.
//   node ferramentas/vitrine-ui.mjs <pasta> x3-camadas,x3-legenda-bemestar,x3-legenda-recursos 986x443,1376x768
import { PREDIO } from '../../../fonte/contratos/flags.js';
import { definirParteAtual } from '../../../fonte/data/zonas.js';

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
  // as 7 camadas do M1b no formato da S1c, da S2a e da S2b (os mesmos ids, escalas e chaves de texto)
  if (id === 'esgoto') {
    for (let i = 0; i < n; i++) dados[i] = 1 + ((i * 5) % 4);
    const cats = [1, 2, 3, 4].map((v) => ({ v, chave: `camada.esgoto.${['', 'ok', 'racionado', 'sem', 'produtor'][v]}` }));
    return { id, fonte: 'predios', dados, grade: null, tipo: 'cat', escala: { min: 0, max: 4, unidade: 'm³/h' }, categorias: cats, legenda: cats, resumo: { chave: 'camada.esgoto.resumo', params: { oferta: 800, demanda: 640, importado: 0 } }, versao: 1 };
  }
  if (id === 'nivel') {
    for (let i = 0; i < n; i++) dados[i] = 1 + (i % 5);
    const cats = [1, 2, 3, 4, 5].map((v) => ({ v, chave: `camada.nivel.${v}` }));
    return { id, fonte: 'predios', dados, grade: null, tipo: 'cat', escala: { min: 1, max: 5, unidade: '' }, categorias: cats, legenda: cats, resumo: { chave: 'camada.nivel.resumo', params: { n1: 20, n2: 18, n3: 12, n4: 8, n5: 6 } }, versao: 1 };
  }
  if (id === 'transito') {
    const ar = new Float32Array(40);
    for (let i = 0; i < 40; i++) ar[i] = (i % 16) / 10;
    return { id, fonte: 'arestas', dados: ar, grade: null, tipo: 'seq', escala: { min: 0, max: 1.5, meio: 1, unidade: '' }, categorias: null, legenda: [{ v: 0, chave: 'camada.transito.livre' }, { v: 1, chave: 'camada.transito.cheio' }, { v: 1.5, chave: 'camada.transito.parado' }], resumo: { chave: 'camada.transito.resumo', params: { gargalos: 3, minutos: 7, vel: 62 } }, versao: 1 };
  }
  if (id === 'ar' || id === 'ruido') {
    const g = 16;
    const gd = new Float32Array(g * g).map((_, k) => ((k * 37) % 256));
    const marca = id === 'ar' ? 110 : 120;
    return { id, fonte: 'grade', dados: gd, grade: { n: g, passo: 64, origem: [0, 0] }, tipo: 'seq', escala: { min: 0, max: 255, unidade: '' }, categorias: null, legenda: [{ v: 0, chave: `camada.${id}.limpo` }, { v: marca, chave: `camada.${id}.aviso` }, { v: 255, chave: `camada.${id}.alto` }], resumo: { chave: `camada.${id}.resumo`, params: { pico: 212, moradores: 340 } }, versao: 1 };
  }
  if (id === 'valor') {
    const g = 16;
    const gd = new Float32Array(g * g).map((_, k) => ((k * 53) % 1000));
    return { id, fonte: 'grade', dados: gd, grade: { n: g, passo: 64, origem: [0, 0] }, tipo: 'seq', escala: { min: 0, max: 1000, unidade: '' }, categorias: null, legenda: [{ v: 0, chave: 'camada.valor.baixo' }, { v: 600, chave: 'camada.valor.nivel5' }, { v: 1000, chave: 'camada.valor.alto' }], resumo: { chave: 'camada.valor.resumo', params: {} }, versao: 1 };
  }
  if (id === 'empregos') {
    for (let i = 0; i < n; i++) dados[i] = ((i * 29) % 21) / 10 - 1;
    return { id, fonte: 'predios', dados, grade: null, tipo: 'div', escala: { min: -1, max: 1, meio: 0, unidade: '' }, categorias: null, legenda: [{ v: -1, chave: 'camada.empregos.semEmprego' }, { v: 0, chave: 'camada.empregos.equilibrado' }, { v: 1, chave: 'camada.empregos.semGente' }], resumo: { chave: 'camada.empregos.resumo', params: { desemprego: 12, abertas: 140, vagas: 900 } }, versao: 1 };
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
      ...(document.querySelector('.x3-pop [data-a="x3.filtro"][data-k="importantes"][aria-checked="true"]') ? [] : ['o filtro padrão não é "Graves e atenção"']),
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
      // C1d: a Contribuição de cada faixa (5, 8 e 11 por morador, D68 e D87) e a da cidade (11) em destaque
      ...conferirTexto('.x3-leg .x3-faixas', /US\$ 3\.000\/h.*US\$ 4\.800\/h.*US\$ 6\.600\/h/s, 'faixas em dólar')(),
      ...conferirTexto('.x3-leg .x3-faixa.x3-atual', /^US\$ 6\.600\/h$/, 'faixa da cidade')(),
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

  // X3b: o popover com as camadas do M1b (12 no total) e a legenda do Ar com a unidade e as palavras do meio
  registrarCenaVitrine('x3b-camadas-m1b', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar, clicar }) {
      definirParteAtual('M1b');
      ligar(sim);
      await clicar('[data-a="trilho"][data-k="camadas"]');
      await esperarSeletor(esperar, '.x3-pop');
      await clicar('.x3-pop [data-a="camada"][data-k="ar"]');
      await esperarSeletor(esperar, '.x3-leg');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('.x3-pop', /Esgoto.*Trânsito.*Poluição do ar.*Ruído.*Empregos.*Valor do terreno.*Nível dos prédios/s, 'as camadas do M1b')(),
      ...conferirTexto('.x3-leg', /Poluição do ar/, 'título')(),
      ...conferirTexto('.x3-leg .x3-escala', /Ar limpo.*Ar pesado.*Muito poluído/s, 'escala em palavras')(),
      ...conferirTexto('.x3-leg', /Índice de 0 a 255 em cada quadrado de 64 m/, 'unidade')(),
    ],
  });
  // uma legenda por camada nova (trânsito, empregos, nível): escala, palavras e unidade
  for (const [id, re, un] of [
    ['transito', /Livre.*Na capacidade.*Parado/s, /Fluxo dividido pela capacidade/],
    ['empregos', /Sem emprego.*Equilibrado.*Vagas abertas/s, /Fração das vagas abertas/],
    ['nivel', /Nível 1.*Nível 5/s, /Nível de 1 a 5/],
    ['valor', /Baixo.*600.*Alto/s, /Pontos de 0 a 1\.000/],
    ['esgoto', /Com esgoto.*Esgoto no limite.*Sem esgoto.*Trata esgoto/s, /m³\/h/],
  ]) {
    registrarCenaVitrine(`x3b-legenda-${id}`, {
      cenario: 'meio',
      async preparar({ sim, ui, esperar }) {
        definirParteAtual('M1b');
        ligar(sim);
        ui.ui.loja.camada.value = id;
        await esperarSeletor(esperar, '.x3-leg');
        await esperar(80);
      },
      conferir: () => [...conferirTexto('.x3-leg', re, `legenda de ${id}`)(), ...conferirTexto('.x3-leg', un, `unidade de ${id}`)()],
    });
  }
  // a aba Problemas da tela Cidade: alertas e avisos de prédio por gravidade, "Ver na camada" e "Próximo"
  registrarCenaVitrine('x3b-problemas', {
    cenario: 'meio',
    async preparar({ sim, ui, esperar, clicar }) {
      definirParteAtual('M1b');
      ligar(sim);
      const barra = sim.q.barra;
      sim.q.barra = (...a) => ({
        ...barra(...a),
        alertas: [
          { id: 'agua', gravidade: 'grave', glifo: 'semAgua', codigo: 'faltaAgua', params: { n: 2 } },
          { id: 'transito', gravidade: 'atencao', glifo: 'transito', codigo: 'transitoParado', params: { via: 'Avenida Central' }, alvo: { x: 200, z: -60 } },
          { id: 'ar', gravidade: 'atencao', glifo: 'alerta', codigo: 'poluicaoAr', params: { pct: 31 }, alvo: { x: -140, z: 90 } },
        ],
      });
      const nomes = ['', 'abandonado', 'alerta', 'semAgua', 'semEnergia', 'semVia', 'semMaterial', 'semTrabalhadores', 'poucosClientes', 'trabalho', 'bemEstarRuim', 'esgoto'];
      sim.q.avisosPredios = () => ({ versao: 3, idx: Int32Array.from([3, 5, 8, 11, 17, 20]), glifo: Uint8Array.from([3, 3, 11, 8, 8, 10]), gravidade: Uint8Array.from([2, 2, 2, 1, 1, 0]), nomes });
      ui.ui.abrirTela('cidade');
      await esperarSeletor(esperar, '[data-a="cidade.aba"]');
      await clicar('[data-a="cidade.aba"][data-k="problemas"]');
      await esperarSeletor(esperar, '[data-a="problema"]');
      await esperar(120);
    },
    conferir: () => [
      ...conferirTexto('.prob-lista', /Falta água.*Prédios sem esgoto: 1.*Prédios com poucos clientes: 2.*Trânsito parado em Avenida Central.*Ar pesado.*Prédios com bem-estar muito baixo: 1/s, 'lista por gravidade')(),
      ...conferirTexto('.prob-painel', /Problemas da cidade: 6/, 'resumo')(),
      ...(document.querySelector('[data-a="problema.ver"]') && document.querySelector('[data-a="problema.proximo"]') ? [] : ['faltam "Ver na camada" ou "Próximo"']),
      ...(document.querySelectorAll('[data-a="problema"]').length === 6 ? [] : [`esperava 6 problemas na lista, vieram ${document.querySelectorAll('[data-a="problema"]').length}`]),
    ],
  });
}
