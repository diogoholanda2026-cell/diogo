// Simulação falsa para a vitrine e o robô rápido da interface (PROJETO 2.4 a 2.6 e 3.2): responde a mesma API da
// simulação de verdade (sim.q.*, sim.cmd, sim.on, sim.espelho, sim.mudancas, sim.avancar) com números fixos e
// plausíveis, sem nenhuma regra de domínio. Determinística (sorteio próprio pela semente, nada de relógio).
//   const sim = criarSimFalsa({ cenario: 'meio' });   // 'inicio' (partida nova) ou 'meio' (cidade de 12 mil)
//   const jogo = criarJogoFalso(sim);                  // o objeto do app (2.8), para a simulação falsa ou a real
// Os comandos mudam o estado da mentira pelo necessário para a interface reagir (créditos, velocidade, empréstimo,
// ordem de lote, cor e nome do prédio, decisão) e recusam com os códigos da 2.5 nos casos das regras do dono.
// Formatos: fonte/contratos/consultas.js (q.barra parte de EXEMPLO_BARRA) e os da S2a e da S3a na onda 3: a data do
// calendário real (D67: o tique 0 é jan. 2020, a barra manda { mes, ano: 2020... }), dinheiro sempre em unidades de
// desenho (a interface mostra em dólar, D87), objetivos com chave 's3.objetivo.*', decisões com chaves 's3.decisao.*',
// marcos com o que liberam, produção com linhas e a sugestão de lote. Os eventos chegam também a quem ouve '*'.
import { EXEMPLO_BARRA } from '../../fonte/contratos/consultas.js';

const TIQUES_MES = 600;
const TIQUES_ANO = 7200;

function sorteio(semente) {
  let a = semente >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const ITENS_FALSOS = [
  { item: 'brita', nome: 'Brita', precoBase: 20 }, { item: 'areia', nome: 'Areia', precoBase: 15 },
  { item: 'argila', nome: 'Argila', precoBase: 18 }, { item: 'tijolo', nome: 'Tijolo', precoBase: 50 },
  { item: 'serrada', nome: 'Madeira serrada', precoBase: 80 }, { item: 'cimento', nome: 'Cimento', precoBase: 90 },
  { item: 'concreto', nome: 'Concreto', precoBase: 170 }, { item: 'vidro', nome: 'Vidro', precoBase: 140 },
];
export const MARCOS_FALSOS = ['Canteiro', 'Povoado', 'Vila', 'Vila Próspera', 'Cidade Nova', 'Cidade', 'Cidade Grande', 'Polo Regional'];
const LIBERA_FALSOS = [
  ['via.rua', 'via.avenida', 'zona.resBaixa', 'zona.comBaixa', 'zona.industria', 'servico.captacao', 'servico.poco', 'servico.solar', 'servico.praca', 'holding.escritorioObra', 'holding.pedreira', 'holding.areal', 'acao.deposito', 'acao.emprestimo', 'etapa.lago.e1'],
  ['servico.clinica', 'servico.escolaF', 'servico.delegacia', 'holding.olaria', 'item.argila', 'item.tijolo'],
  ['servico.bombeiros', 'zona.resMedia', 'via.ruaMao'],
  ['holding.concreteira', 'item.concreto', 'item.cimento', 'item.aco', 'etapa.torre.e1', 'regra.dependencia'],
  ['via.avenidaG', 'item.vidro', 'etapa.torre.e2'],
  ['etapa.torre.e3', 'nivel.armazem2'],
  ['etapa.torre.e4'],
  ['arcologia.faseInicial'],
];
const ANO_INICIAL = 2020;
/** Data do calendário de um tique (D67). */
export const dataFalsa = (tique) => { const m = Math.floor(Math.max(0, tique) / TIQUES_MES); return { ano: ANO_INICIAL + Math.floor(m / 12), mes: (m % 12) + 1, fracMes: (Math.max(0, tique) % TIQUES_MES) / TIQUES_MES }; };
const XP_MARCOS = [0, 400, 1500, 3500, 8000, 15000, 25000, 38000];
const FASES = [[5, 'noite'], [11, 'manha'], [16, 'tarde'], [19, 'fimDeTarde'], [24, 'noite']];

const CENARIOS = {
  inicio: { creditos: 250000, populacao: 0, bemEstar: 50, marco: 0, xp: 0, tique: 0, predios: 0, divida: 0 },
  meio: { creditos: 184350, populacao: 12480, bemEstar: 63.4, marco: 4, xp: 9120, tique: TIQUES_ANO + 2 * TIQUES_MES + 250, predios: 900, divida: 40000 },
};

// cidade de caixas: prédios em quadras de uma grade de 112 m, de frente para as ruas (convenção da 2.4)
function gerarCidade(n, sortear) {
  const cap = Math.max(16, n);
  const P = {
    n, cap, viva: new Uint8Array(cap), ger: new Uint16Array(cap), tipo: new Uint8Array(cap), modelo: new Uint16Array(cap),
    zona: new Uint8Array(cap), x: new Float64Array(cap), z: new Float64Array(cap), y: new Float32Array(cap), rot: new Float32Array(cap),
    w: new Uint16Array(cap), d: new Uint16Array(cap), nivel: new Uint8Array(cap), estilo: new Uint8Array(cap), semente: new Uint32Array(cap),
    flags: new Uint32Array(cap), obraIni: new Uint32Array(cap), obraFim: new Uint32Array(cap), cor: new Uint8Array(cap),
    moradores: new Uint16Array(cap), empregos: new Uint16Array(cap),
  };
  const lado = Math.ceil(Math.sqrt(n / 12));
  for (let i = 0; i < n; i++) {
    const q = Math.floor(i / 12), k = i % 12;
    const qx = (q % lado) - lado / 2, qz = Math.floor(q / lado) - lado / 2;
    const frente = k < 6 ? 1 : -1;
    const col = k % 6;
    P.viva[i] = 1; P.ger[i] = 1;
    P.zona[i] = 1 + (q % 4);
    P.tipo[i] = 0;
    P.w[i] = 16 + 8 * Math.floor(sortear() * 2);
    P.d[i] = 24;
    P.x[i] = qx * 112 - 40 + col * 16;
    P.z[i] = qz * 112 + frente * 24;
    P.rot[i] = frente > 0 ? 0 : Math.PI;
    P.nivel[i] = 1 + Math.floor(sortear() * (P.zona[i] === 2 ? 5 : 3));
    P.semente[i] = Math.floor(sortear() * 2 ** 32);
    P.moradores[i] = P.zona[i] <= 2 ? 4 * P.nivel[i] * (P.zona[i] === 2 ? 6 : 1) : 0;
    P.empregos[i] = P.zona[i] > 2 ? 10 * P.nivel[i] : 0;
  }
  return P;
}

export function criarSimFalsa({ cenario = 'meio', semente = 7 } = {}) {
  const c = CENARIOS[cenario] || CENARIOS.meio;
  const sortear = sorteio(semente);
  const E = {
    creditos: c.creditos, populacao: c.populacao, bemEstar: c.bemEstar, marco: c.marco, xp: c.xp, tique: c.tique,
    // a cidade do meio roda em 1x e sem alerta (o repouso da 7.1); a partida nova começa pausada. Quem quer o alerta
    // de água liga sim.estado.alertaAgua (a faixa de alerta da U1b)
    v: cenario === 'meio' ? 1 : 0, alertaAgua: false, divida: c.divida, tomadoAno: c.divida ? 40000 : 0, contratos: c.divida ? [{ id: 1, ano: ANO_INICIAL + 1, valor: 40000, saldo: 40000, ini: TIQUES_ANO + 100, fim: 11 * TIQUES_ANO + 100, mora: false }] : [],
    vendidas: 12, holding: { nome: 'Held', cor: '#D9BD84' }, nomes: new Map(), cores: new Map(), seq: 1, importarAuto: true,
    estoque: Object.fromEntries(ITENS_FALSOS.map((it, i) => [it.item, cenario === 'inicio' ? 0 : [140, 90, 60, 210, 45, 30, 64, 12][i]])),
    linhas: [
      { item: 'concreto', n: 10, auto: true, ativa: true, rodando: true, progresso: 0.42, parada: null, sugestaoLote: null },
      { item: 'concreto', n: 10, auto: true, ativa: true, rodando: false, progresso: 0, parada: 'estoque', sugestaoLote: 6 },
    ],
    decisoes: cenario === 'meio' ? ['febre.aurora'] : [], decididas: cenario === 'meio' ? [{ id: 'vila.agua', opcao: 'captacao', tique: 180, auto: false }] : [],
  };
  const ouvintes = new Map();
  // como o núcleo: quem ouve '*' recebe todo evento, com o nome
  const emitir = (nome, dados) => {
    for (const fn of ouvintes.get(nome) || []) fn(dados, nome);
    for (const fn of ouvintes.get('*') || []) fn(dados, nome);
  };
  const predios = gerarCidade(c.predios, sortear);
  let versao = 1;

  const tempo = () => {
    const mes0 = Math.floor(E.tique / TIQUES_MES);
    const fracMes = (E.tique % TIQUES_MES) / TIQUES_MES;
    const hora = (7 + 24 * fracMes) % 24;
    return {
      tique: E.tique, frac: 0, velocidade: E.v, mult: [0, 1, 2, 4][E.v], mes: (mes0 % 12) + 1, ano: ANO_INICIAL + Math.floor(E.tique / TIQUES_ANO),
      fracMes, hora, fase: FASES.find(([h]) => hora < h)[1], diaDoAno: ((mes0 % 12) + fracMes) * 365 / 12, clima: { nuvens: 0.3, vento: [2, 1] },
    };
  };
  const tarifa = () => { const b = Math.round(E.bemEstar); return b <= 30 ? 5 : b <= 60 ? 8 : 11; };
  const faixa = () => { const t = tarifa(); return t === 5 ? [0, 30] : t === 8 ? [31, 60] : [61, 100]; };
  const refDe = (idx) => idx + 2 ** 20;
  const idxDe = (ref) => ref % 2 ** 20;

  const espelho = {
    get versao() { return versao; },
    get tempo() { return tempo(); },
    mapa: { semente, tam: 8192, origem: [-4096, -4096], latitude: -23.5, norteAz: 0, nivelMar: 0 },
    ladrilhos: { n: 16, estado: new Uint8Array(256).map((_, i) => (i % 16 >= 6 && i % 16 <= 9 && i >> 4 >= 6 && i >> 4 <= 9 ? 2 : 1)), preco: new Float64Array(256).fill(40000) },
    areas: [],
    vias: { nos: { n: 0, cap: 0 }, arestas: { n: 0, cap: 0 } },
    celulas: { n: 0, cap: 0 },
    predios,
    fluxos: null, entregas: [],
    arcologia: { plano: 'A', etapas: [{ id: 'lago.e1', parte: 'lago', estado: 3, fase: 3, progresso: 1 }, { id: 'torre.e1', parte: 'torre', estado: 3, fase: 3, progresso: 1 }, { id: 'torre.e2', parte: 'torre', estado: 2, fase: 2, progresso: 0.46 }, { id: 'torre.e3', parte: 'torre', estado: 0, fase: 0, progresso: 0 }, { id: 'torre.e4', parte: 'torre', estado: 0, fase: 0, progresso: 0 }] },
    get holding() { return E.holding; },
    partida: { modo: 'normal' },
  };

  const alertas = () => (E.creditos <= 0 ? [{ id: 'caixa', gravidade: 'grave', glifo: 'semCreditos', codigo: 'caixaZerado', params: {}, alvo: { tela: 'economia' } }] : E.alertaAgua
    ? [{ id: 'agua', gravidade: 'atencao', glifo: 'semAgua', codigo: 'faltaAgua', params: { n: 14 }, alvo: { x: 120, z: -80 } }] : []);
  // o saldo por hora é receitas menos despesas (a tela Economia mostra a conta ao lado do saldo)
  const receitas = () => ({ moradores: E.populacao * tarifa(), cidade: cenario === 'meio' ? 18400 : 0, deposito: cenario === 'meio' ? 2100 : 0, marcos: 0 });
  // juros por hora de jogo: 10% ao ano e o ano tem 2 h (TIQUES_ANO / 3.600), então 5% da dívida por hora
  const despesas = () => ({ servicos: 14200, vias: 3100, ligacao: 1200, salarios: 2400, juros: Math.round((E.divida * 0.1 * 3600) / TIQUES_ANO), importacao: 0, importacaoCidade: 600 });
  const soma = (o) => Object.values(o).reduce((a, v) => a + v, 0);
  const saldoHora = () => Math.round(soma(receitas()) - soma(despesas()));
  // serviço de mentira para o cartão (um em cada 9 prédios), no formato de q.predio: o tipo é o id do catálogo
  // (data/servicos.js, seção 8.1 do desenho da simulação), sem campo de categoria
  const SERVICOS_FALSOS = [['clinica', 'Clínica da Família', 800, 1200, 700], ['escolaF', 'Escola Municipal', 600, 1500, 900], ['delegacia', 'Base Comunitária', 10000, 1500, 800], ['bombeiros', 'Posto de Bombeiros', 12000, 1800, 900]];
  const servicoDe = (ref, i) => {
    const [tipo, nome, capacidade, alcance, manutencaoHora] = SERVICOS_FALSOS[Math.floor(i / 9) % SERVICOS_FALSOS.length];
    const categoria = { clinica: 'saude', escolaF: 'educacao', delegacia: 'seguranca', bombeiros: 'bombeiros' }[tipo];
    return {
      ref, tipo: 'servico', id: tipo, modelo: 0, nome: E.nomes.get(ref) || `${nome} Santa Cida`, zona: 0, nivel: 1, estado: 'ok', obra: null, moradia: null, trabalho: null, nivelProx: null,
      servicos: { agua: 'ok', esgoto: 'ok', energia: 'ok', saude: 1, educacao: 1, seguranca: 1, bombeiros: 1, lazer: 0 },
      servico: { tipo, categoria, capacidade, uso: Math.round(capacidade * 0.78), eficiencia: 0.74, alcance, manutencaoHora, rede: false },
      holding: null, cor: E.cores.get(ref) || 0, via: { ref: 2, nome: 'Rua da Matriz' },
      avisos: [{ codigo: 'semTrabalhadores', gravidade: 'atencao', desde: E.tique - 240, acao: null }],
      faz: `atende quem mora a até ${alcance} m`,
    };
  };
  // prédio da Holding de mentira (um em cada 9, no formato de q.predio com o bloco holding da S3a)
  const holdingDe = (ref, i) => ({
    ref, tipo: 'holding', id: 'concreteira', modelo: 4, nome: E.nomes.get(ref) || 'Concreteira Held', zona: 0, nivel: 1, estado: 'ok', obra: null, moradia: null, trabalho: null, nivelProx: null,
    servicos: { agua: 'ok', esgoto: null, energia: 'ok', saude: 0, educacao: 0, seguranca: 0, bombeiros: 0, lazer: 0 }, servico: null,
    holding: {
      tipo: 'concreteira', nivel: 1, nivelMax: 3, proximoNivel: { custo: 20000, materiais: { concreto: 20, aco: 5 }, marco: 4 },
      linhas: E.linhas.map((l) => ({ ...l, fimTique: l.rodando ? E.tique + 245 : null })), produz: ['concreto'],
      vagas: [4, 5, 3, 1], ocupadas: [4, 5, 2, 1], distArmazem: 640, produtividade: 0.9,
    },
    avisos: [], cor: E.cores.get(ref) || 0, via: { ref: 3, nome: 'Rua do Porto' }, x: predios.x[i % predios.n], z: predios.z[i % predios.n], y: 0,
    faz: 'mistura concreto com cimento, brita e areia',
  });

  const q = {
    barra: () => {
      const t = tempo();
      const b = Math.round(E.bemEstar);
      const degrau = b >= 61 ? 61 : b >= 31 ? 31 : null;
      return {
        creditos: E.creditos, saldoHora: saldoHora(), populacao: E.populacao, popHora: cenario === 'meio' ? 1240 : 0, bemEstar: E.bemEstar,
        bemEstarTarifa: b, tarifa: tarifa(), faixa: faixa(), margem: { degrau, delta: degrau == null ? null : b - degrau },
        demanda: cenario === 'meio' ? { R: 62, C: 41, I: 35, E: 0 } : { R: 80, C: 20, I: 30, E: 0 }, data: { mes: t.mes, ano: t.ano, fracMes: t.fracMes, fase: t.fase },
        velocidade: E.v, mult: t.mult,
        marco: { n: E.marco, nome: MARCOS_FALSOS[E.marco], xp: E.xp, xpIni: XP_MARCOS[E.marco], xpProx: XP_MARCOS[E.marco + 1] ?? null, requisito: E.marco === 6 ? 'torre.e4' : null },
        divida: E.divida, valuation: 2.4e6, caixaZerado: E.creditos <= 0, alertas: alertas(), decisoesPendentes: E.decisoes.length,
        objetivos: cenario === 'meio' ? [
          { id: 'cidade.bemEstar', texto: 's3.objetivo.cidade.bemEstar', params: { n: 61 }, paramsChave: {}, quem: 'cida', dominio: 'cidade', feito: 63, total: 61, alvo: { tela: 'cidade' }, recompensa: { xp: 80, creditos: 10000 } },
          { id: 'holding.estoque', texto: 's3.objetivo.holding.estoque', params: { n: 40, item: 'concreto' }, paramsChave: { item: 's3.item.concreto' }, quem: 'tome', dominio: 'holding', feito: 24, total: 40, alvo: { tela: 'holding' }, recompensa: { xp: 0, creditos: 0 } },
          { id: 'arcologia.etapa', texto: 's3.objetivo.arcologia.falta.torre.e2', params: { n: 40, item: 'concreto' }, paramsChave: { item: 's3.item.concreto' }, quem: 'iris', dominio: 'arcologia', feito: 80, total: 120, alvo: { x: 0, z: -600 }, recompensa: { xp: 0, creditos: 0 } },
        ] : [
          { ...EXEMPLO_BARRA.objetivos[0] },
          { id: 'holding.escritorio', texto: 's3.objetivo.holding.escritorio', params: {}, paramsChave: {}, quem: 'tome', dominio: 'holding', feito: 0, total: 1, alvo: { ui: 'ferramenta.empresas' }, recompensa: { xp: 20, creditos: 0 } },
          { id: 'arcologia.lago', texto: 's3.objetivo.arcologia.lago', params: {}, paramsChave: {}, quem: 'iris', dominio: 'arcologia', feito: 0, total: 1, alvo: { tela: 'arcologia' }, recompensa: { xp: 0, creditos: 0 } },
        ],
      };
    },
    retomar: () => ({ objetivo: q.barra().objetivos[2], problema: alertas()[0] ? { codigo: alertas()[0].codigo, params: alertas()[0].params, alvo: alertas()[0].alvo } : null, desde: Math.max(0, E.tique - 1800) }),
    predio: (ref) => {
      // com o render de verdade (?ui=vitrine) o índice vem da cidade sintética, maior que a da mentira: vale qualquer um
      const i0 = idxDe(ref);
      if (!predios.n) return null;
      if (i0 % 9 === 4) return servicoDe(ref, i0);
      if (i0 % 9 === 7) return holdingDe(ref, i0);
      const i = i0 % predios.n;
      const res = predios.zona[i] <= 2;
      const tar = tarifa();
      return {
        ref, tipo: 'zona', id: res ? 'resBaixa' : 'comBaixa', modelo: predios.modelo[i], nome: E.nomes.get(ref) || (res ? 'Edifício Aurora' : 'Galpão Horizonte'), zona: predios.zona[i],
        familia: res ? 'res' : predios.zona[i] === 4 ? 'ind' : 'com', nivel: predios.nivel[i],
        estado: 'ok', obra: null,
        moradia: res ? { lares: predios.moradores[i] / 4, moradores: predios.moradores[i], capacidade: predios.moradores[i] + 4, escolaridade: [0.2, 0.4, 0.3, 0.1], bemEstar: 64, fatores: [{ id: 'base', v: 40 }, { id: 'saude', v: 8 }, { id: 'educacao', v: 6 }, { id: 'lazer', v: 4 }, { id: 'comercio', v: 3 }, { id: 'desemprego', v: -0.9 }], tarifa: tar, contribuicaoHora: predios.moradores[i] * tar } : null,
        trabalho: res ? null : { vagas: [10, 8, 4, 1], ocupadas: [10, 6, 3, 0], clientes: 140, produtividade: 0.92, fatores: [{ id: 'ocupacao', v: -0.06 }, { id: 'clientes', v: 0.02 }] },
        nivelProx: { pontos: 64, meta: 70, falta: ['educacao', 'valor'] },
        servicos: { agua: 'ok', esgoto: null, energia: 'racionado', saude: 0.8, educacao: 0.6, seguranca: 0.7, bombeiros: 0.5, lazer: 0.4 },
        servico: null, holding: null, avisos: [], cor: E.cores.get(ref) || 0, via: { ref: 1, nome: 'Avenida das Palmeiras' },
        x: predios.x[i], z: predios.z[i], y: 0,
        faz: res ? 'abriga famílias que pagam a Contribuição' : 'vende para os moradores e emprega o bairro',
      };
    },
    deposito: () => ({
      janela: { fimTique: E.tique + 9000, vendidas: E.vendidas, max: 100 },
      itens: ITENS_FALSOS.map((it) => ({ item: it.item, estoque: E.estoque[it.item], reserva: 0, precoBase: it.precoBase, precoVenda: it.precoBase * 1.5, precoImportacao: it.precoBase * 1.6, vendeCidade: true, auto: null })),
      importarAuto: E.importarAuto, importacoes: [],
    }),
    emprestimo: () => ({ disponivelAno: 50000 - E.tomadoAno, tomadoAno: E.tomadoAno, limiteAno: 50000, divida: E.divida, dividaMax: 500000, taxa: 0.1, jurosDevidos: Math.round(E.divida * 0.1 / 12), ano: tempo().ano, contratos: E.contratos.map((x) => ({ ...x })) }),
    orcamento: () => ({
      receitas: receitas(),
      despesas: despesas(),
      naoPago: { servicos: 0, salarios: 0 }, saldoHora: saldoHora(), caixa: E.creditos,
      serie: Array.from({ length: 12 }, (_, i) => ({ ...dataFalsa(E.tique - (11 - i) * TIQUES_MES), caixa: 60000 + i * 11000, receitas: 90000 + i * 5000, despesas: 70000 + i * 2500, moradores: 4000 + i * 700, bemEstar: 58 + i * 0.5, desemprego: 0.06 })),
    }),
    producao: () => ({
      itens: ITENS_FALSOS.map((it, k) => ({ item: it.item, estoque: E.estoque[it.item], produzHora: [60, 48, 0, 0, 0, 0, 30, 0][k], consomeHora: [42, 18, 0, 0, 0, 30, 0, 0][k], cidadeHora: [18, 12, 0, 6, 0, 0, 24, 0][k], reserva: 0, precoBase: it.precoBase, liberado: k < 7 })),
      predios: [{ ref: refDe(7), tipo: 'concreteira', nivel: 1, produtividade: 0.92, linhas: E.linhas.map((l) => ({ ...l, fimTique: l.rodando ? E.tique + 245 : null })) }, { ref: refDe(16), tipo: 'pedreira', nivel: 2, produtividade: 1, linhas: [{ item: 'brita', n: 10, auto: true, ativa: true, rodando: true, progresso: 0.8, fimTique: E.tique + 60, parada: null, sugestaoLote: null }] }],
      frota: { usados: 4, total: 6, fila: 1, atrasoMedio: 12 }, armazem: { usado: 651, capacidade: 1200 }, importarAuto: E.importarAuto,
    }),
    arcologia: () => ({ plano: 'A', progressoTotal: 0.31, partes: [{ id: 'lago', nome: 'Mirror Lake', etapas: [{ id: 'lago.e1', nome: 'Reservatório e portões', estado: 3, marco: 0, creditos: 60000, materiais: [], minutos: 5, fase: 3, progresso: 1, efeitos: [] }] }, { id: 'torre', nome: 'Blade Tower', etapas: espelho.arcologia.etapas.filter((e) => e.parte === 'torre').map((e, k) => ({ id: e.id, nome: ['Fundações e pódio', 'Sede operacional', 'Moradias de luxo', 'Coroa e heliponto'][k], estado: e.estado, marco: 3 + k, creditos: 60000 * (k + 1), materiais: [{ item: 'concreto', pede: 120, entregue: e.estado === 3 ? 120 : 80, estoque: E.estoque.concreto }], minutos: 5 + 5 * k, fase: e.fase, progresso: e.progresso, efeitos: [] })) }] }),
    holding: () => ({ nome: E.holding.nome, cor: E.holding.cor, influencia: 22, legado: 10, efeitos: { descontoLadrilho: 0.044, atratividade: 0.5 }, divisoes: [], valuation: 2.4e6, empresa: 'Holding Held', pais: 'República de Vera Cruz do Leste', jogador: 'Diogo Holanda', ato: 1 }),
    marcos: () => MARCOS_FALSOS.map((nome, n) => ({ n, nome, xp: XP_MARCOS[n], feito: n <= E.marco, atual: n === E.marco, libera: LIBERA_FALSOS[n], licencas: n >= 2 ? 1 : 0, premio: 10000 * n, requisito: n === 7 ? 'torre.e4' : null, requisitoOk: n === 7 ? false : true, tique: n <= E.marco ? n * 1200 : null })),
    objetivos: () => q.barra().objetivos,
    decisoes: (op = {}) => (op?.historico
      ? E.decididas.map((d) => ({ id: d.id, opcao: d.opcao, tique: d.tique, data: dataFalsa(d.tique), auto: d.auto, titulo: `s3.decisao.${d.id}.titulo`, texto: `s3.decisao.${d.id}.${d.opcao}`, quem: d.id === 'vila.agua' ? 'cida' : 'livia' }))
      : E.decisoes.map((id) => {
        const opcoes = id === 'febre.aurora' ? [['comprar', 'livia', 8, 0, 40000], ['proteger', 'cida', 0, 8, 20000]] : id === 'canal.seshat' ? [['navios', 'livia', 6, 0, 50000], ['local', 'tome', 0, 6, 0]] : [['captacao', 'cida', 0, 5, 0], ['reservatorio', 'tome', 5, 0, 0]];
        return {
          id, ato: 1, titulo: `s3.decisao.${id}.titulo`, texto: `s3.decisao.${id}.texto`, quem: opcoes.map((o) => o[1]), desde: E.tique - 300, prazo: E.tique + 1500, adiada: false, podeAdiar: true,
          data: dataFalsa(E.tique - 300), area: null, padrao: opcoes[1][0],
          opcoes: opcoes.map(([o, quem, influencia, legado, creditos]) => ({ id: o, quem, texto: `s3.decisao.${id}.${o}`, ganho: `s3.decisao.${id}.${o}.ganho`, custo: `s3.decisao.${id}.${o}.custo`, creditos, influencia, legado })),
        };
      })),
    mural: () => [{ id: 1, autor: 'nara', tique: E.tique - 300, chave: 's3.mural.evento.rivais', params: {}, data: dataFalsa(E.tique - 300), alvo: { x: 300, z: 200 } }],
    demanda: () => ({
      resBaixa: 70, resMedia: 55, resAlta: 0, comBaixa: 41, comAlta: 0, escritorio: 0, industria: 35, R: 62, C: 41, I: 35, E: 0, ativas: ['resBaixa', 'resMedia', 'comBaixa', 'industria'],
      fatores: { resBaixa: [{ id: 'vagas', v: 22 }, { id: 'bemEstar', v: 9 }, { id: 'vazias', v: -6 }], comBaixa: [{ id: 'consumo', v: 18 }, { id: 'maoDeObra', v: -4 }], industria: [{ id: 'maoDeObra', v: 12 }, { id: 'rodovia', v: -10 }] },
    }),
    cidade: () => ({
      populacao: E.populacao, lares: Math.round(E.populacao / 3.2), popHora: cenario === 'meio' ? 1240 : 0, bemEstar: E.bemEstar, bemEstarTarifa: Math.round(E.bemEstar), tarifa: tarifa(), desemprego: 0.06, trabalhadores: Math.round(E.populacao * 0.5),
      empregos: { vagas: [2400, 2100, 1300, 400], ocupadas: [2300, 1900, 1100, 300], desemprego: [0.05, 0.06, 0.07, 0.04] }, escolaridade: [0.3, 0.38, 0.24, 0.08],
      predios: { total: predios.n, porZona: {}, porNivel: [420, 260, 140, 60, 20], emObra: 18, abandonados: 3, servicos: 12 },
      redes: { agua: { oferta: 3200, demanda: 2900 }, energia: { oferta: 18000, demanda: 19400 }, esgoto: { oferta: 0, demanda: 0 }, importado: { energia: 1400 } },
      servicos: [{ tipo: 'captacao', categoria: 'agua', n: 1, prontos: 1, capacidade: 30, carga: 27, eficiencia: 0.95, manutencaoHora: 800 }, { tipo: 'clinica', categoria: 'saude', n: 2, prontos: 2, capacidade: 16000, carga: 12400, eficiencia: 0.74, manutencaoHora: 1400 }, { tipo: 'escolaF', categoria: 'educacao', n: 1, prontos: 1, capacidade: 1500, carga: 1380, eficiencia: 0.9, manutencaoHora: 900 }],
      fatoresBemEstar: [{ id: 'base', v: 40 }, { id: 'saude', v: 6.4 }, { id: 'educacao', v: 4.1 }, { id: 'seguranca', v: 3.2 }, { id: 'lazer', v: 2.8 }, { id: 'comercio', v: 2.5 }, { id: 'energia', v: -1.6 }, { id: 'desemprego', v: -0.9 }],
      ligacaoExterna: { energia: { teto: 5000, usado: 1400, ligada: true } },
    }),
    catalogo: () => [],
    ladrilhos: () => ({ n: 16, estado: espelho.ladrilhos.estado, preco: espelho.ladrilhos.preco, licencas: 1 }),
    sugestoes: () => [],
    aresta: (ref) => (ref ? { ref, tipo: 'avenida', nome: 'Avenida das Palmeiras', comprimento: 412, declive: 0.021, mao: 0, ponte: false, rodovia: false, arcologia: false, fluxo: null, manutencaoHora: 41, devolve: 6200, melhoraPara: ['avenidaG'] } : null),
    avisos: () => alertas(),
    viasPerto: () => [],
    camada: (id) => ({ id, fonte: 'predios', dados: new Float32Array(predios.n).map((_, i) => (predios.nivel[i] / 5)), grade: null, tipo: 'seq', escala: { min: 0, max: 1, unidade: '' }, categorias: null, legenda: [], resumo: { chave: 'camada.resumo', params: {} }, versao }),
    avisosPredios: () => ({ versao, idx: new Int32Array([3, 17]), glifo: new Uint8Array([1, 2]), gravidade: new Uint8Array([1, 2]) }),
    via: { previa: () => ({ ok: true, segmentos: [], nosNovos: 0, divisoes: 0, encaixes: [], guias: [], demolir: { predios: [], custo: 0 }, comprimento: 0, custo: 0, manutencaoHora: 0, erros: [] }) },
    zona: { previa: () => ({ celulas: new Int32Array(0), comPredio: 0, efeitoMedia: 0 }) },
    construir: { previa: (a) => ({ ok: true, x: a.x, z: a.z, rot: a.rot, custo: 25000, manutencaoHora: 400, alcance: 600, efeitos: [] }) },
    hash: () => (E.creditos * 31 + E.tique * 7 + E.v) >>> 0,
  };

  const muda = () => { versao++; };
  const ok = (dados) => ({ ok: true, dados });
  const nao = (codigo, dados) => ({ ok: false, codigo, dados });
  const cmds = {
    velocidade: ({ v }) => { if (![0, 1, 2, 3].includes(v)) return nao('valor'); E.v = v; muda(); emitir('velocidade', { v }); return ok(); },
    'emprestimo.tomar': ({ valor }) => {
      if (!(valor > 0) || valor % 1000) return nao('valor');
      if (E.tomadoAno + valor > 50000) return nao('limiteAno');
      if (E.divida + valor > 500000) return nao('limiteDivida');
      E.tomadoAno += valor; E.divida += valor; E.creditos += valor;
      E.contratos.push({ id: ++E.seq, ano: tempo().ano, valor, saldo: valor, ini: E.tique, fim: E.tique + 10 * TIQUES_ANO, mora: false });
      muda(); emitir('financas', { tipo: 'emprestimo' }); return ok();
    },
    'emprestimo.quitar': () => { if (!E.divida) return nao('nada'); if (E.creditos < E.divida) return nao('creditos'); E.creditos -= E.divida; E.divida = 0; E.contratos = []; muda(); emitir('financas', { tipo: 'quitou' }); return ok(); },
    'emprestimo.pagarJuros': () => (E.divida ? ok() : nao('nada')),
    'emprestimo.pagarParcela': () => (E.divida ? ok() : nao('nada')),
    'linha.ordem': ({ linha = 0, item, n, auto }) => { if (!(n >= 1 && n <= 10) || n % 1) return nao('lote'); const l = E.linhas[linha] ?? E.linhas[0]; Object.assign(l, { item: item ?? l.item, n, auto: !!auto, ativa: true }); muda(); return ok(); },
    'linha.parar': () => ok(),
    'deposito.vender': ({ item, n }) => {
      if (!(n > 0)) return nao('valor');
      if (E.vendidas + n > 100) return nao('limite');
      if ((E.estoque[item] || 0) < n) return nao('nada');
      const it = ITENS_FALSOS.find((x) => x.item === item);
      E.estoque[item] -= n; E.vendidas += n; E.creditos += Math.round(it.precoBase * 1.5) * n; muda(); return ok();
    },
    'deposito.auto': () => ok(), 'estoque.reserva': () => ok(), 'estoque.vendeCidade': () => ok(), 'cidade.importarAuto': ({ sim: v }) => { E.importarAuto = !!v; muda(); return ok(); },
    'predio.cor': ({ ref, cor }) => { E.cores.set(ref, cor); muda(); return ok(); },
    'predio.nome': ({ ref, nome }) => { if (!nome || nome.length > 40) return nao('valor'); E.nomes.set(ref, nome); muda(); return ok(); },
    'holding.identidade': ({ nome, cor }) => { if (!nome) return nao('valor'); E.holding = { nome, cor }; muda(); return ok(); },
    'decisao.escolher': ({ id, opcao }) => { if (!E.decisoes.includes(id)) return nao('inexistente'); E.decisoes = E.decisoes.filter((x) => x !== id); E.decididas.push({ id, opcao, tique: E.tique, auto: false }); muda(); return ok(); },
    'decisao.adiar': ({ id }) => (E.decisoes.includes(id) ? ok() : nao('inexistente')),
    'zona.pintar': () => ok(), 'via.construir': () => ok({}), 'via.desfazer': () => nao('nada'), 'via.melhorar': () => ok(), 'via.demolir': () => ok(),
    construir: () => { if (E.creditos < 25000) return nao('creditos'); E.creditos -= 25000; muda(); return ok({ id: refDe(0) }); },
    demolir: () => ok(), 'predio.nivel': () => nao('marco'), 'ladrilho.comprar': () => nao('licenca'), importar: () => ok(),
    'arcologia.iniciar': () => nao('emObra'), 'arcologia.enviar': () => ok(), 'arcologia.enviarTudo': () => ok(), 'arcologia.envio': () => ok(), acelerar: ({ minutos }) => { const preco = { 1: 100, 5: 500, 10: 1000, 30: 2500, 60: 5000 }[minutos]; if (!preco) return nao('valor'); if (E.creditos < preco) return nao('creditos'); E.creditos -= preco; muda(); return ok(); },
  };

  return {
    falsa: true,
    espelho,
    q,
    cmd(nome, args = {}) { const f = cmds[nome]; return f ? f(args) : nao('comando'); }, // desconhecido: o código do núcleo
    on(nome, fn) { const l = ouvintes.get(nome) || []; l.push(fn); ouvintes.set(nome, l); return () => ouvintes.set(nome, (ouvintes.get(nome) || []).filter((x) => x !== fn)); },
    mudancas: { desde: (v) => ({ versao, tudo: { terreno: v === 0, floresta: v === 0, vias: v === 0, celulas: v === 0, predios: v === 0 }, realocado: [], n: { nos: 0, arestas: 0, celulas: 0, predios: predios.n }, terreno: [], floresta: [], nos: new Int32Array(0), arestas: new Int32Array(0), celulas: new Int32Array(0), predios: new Int32Array(0), ladrilhos: false, fluxos: false, entregas: false, arcologia: false, holding: false, grades: [] }) },
    // anda o relógio da mentira (só quando a cena pede: a vitrine congela o tempo para a captura sair igual)
    avancar(dtSeg) { const n = Math.floor(dtSeg * [0, 1, 2, 4][E.v]); if (n > 0) { E.tique += n; muda(); } return n; },
    // acesso direto para as cenas montarem o estado que querem mostrar
    estado: E,
    emitir,
  };
}

export function criarJogoFalso(sim) {
  const ouvintes = new Map();
  // serve à simulação falsa e à real: lê tudo pela consulta da barra
  const b = sim.q.barra();
  const saves = [{ slot: 'auto1', nome: 'Held', data: 0, tique: sim.tique ?? sim.estado?.tique ?? 0, populacao: b.populacao, creditos: b.creditos, marco: b.marco?.n ?? 0, versao: 1, capa: null }];
  return {
    falso: true,
    novaPartida: async ({ nome, cor, modo }) => sim.cmd('holding.identidade', { nome, cor, modo }),
    salvar: async (slot) => { for (const fn of ouvintes.get('salvo') || []) fn({ slot }); return { ok: true }; },
    carregar: async () => ({ ok: true }),
    listarSaves: async () => saves.map((s) => ({ ...s })),
    exportar: async () => new Blob(['HELD'], { type: 'application/octet-stream' }),
    importar: async () => ({ ok: false, codigo: 'valor' }),
    prefs: { qualidade: 'media', som: 0.8, musica: 0.5, vibrar: true, dicas: true, tamanho: 1 },
    on(nome, fn) { const l = ouvintes.get(nome) || []; l.push(fn); ouvintes.set(nome, l); return () => {}; },
  };
}
