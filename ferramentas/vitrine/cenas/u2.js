// Cenas da vitrine da U2a (sistema): entrada ("Clique para entrar"), menu inicial com a capa e o Continuar, nova
// partida, saves, configurações (vídeo com o PC e a resolução dinâmica, som, salvamento), teste de desempenho com um
// resultado da PC1 e da PC2, painel do F9 e a primeira hora (dica com a mão fantasma e o anel de guia em Vias).
//   node ferramentas/vitrine-ui.mjs <pasta> u2-entrada,u2-menu,u2-nova,u2-carregar,u2-config,u2-teste 1376x768,986x443
// A vitrine usa o jogo falso (sim-falsa.js), sem salvamento: as cenas põem nele o que o menu e os saves leem.
import { Inicio } from '../../../fonte/ui/inicio/Entrada.jsx';
import { abrirInicio, saves, capaFundo } from '../../../fonte/ui/inicio/estado.js';
import { usarEstilo, CSS_INICIO } from '../../../fonte/ui/inicio/estilo.js';
import { mostrarResultado } from '../../../fonte/ui/inicio/corpo/TesteDesempenho.jsx';
import { dicaAtual } from '../../../fonte/ui/guia/Dica.jsx';
import { DICAS } from '../../../fonte/ui/guia/dicas.js';
import { AnelGuia } from '../../../fonte/ui/guia/Guia.jsx';
import { usarEstiloGuia } from '../../../fonte/ui/guia/estilo.js';

const AGORA = Date.now();

/** Uma capa de 640 x 288 desenhada (o render falso não tem a cidade): céu de fim de tarde, mar e uma linha de prédios. */
function capaFalsa(semente = 1) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 288;
  const g = c.getContext('2d');
  const ceu = g.createLinearGradient(0, 0, 0, 288);
  ceu.addColorStop(0, '#2b3b55');
  ceu.addColorStop(0.55, '#c98a5a');
  ceu.addColorStop(0.56, '#33475e');
  ceu.addColorStop(1, '#1d2a38');
  g.fillStyle = ceu;
  g.fillRect(0, 0, 640, 288);
  let s = semente * 9301;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < 640; x += 14) {
    const h = 20 + r() * 70 + (Math.abs(x - 330) < 30 ? 120 : 0);
    g.fillStyle = `rgba(16,22,30,${0.75 + r() * 0.2})`;
    g.fillRect(x, 160 - h, 12, h);
  }
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
}

/** Saves de mentira no formato do armazém (meta do IndexedDB), com as capas. */
async function savesFalsos() {
  const base = { nome: 'Holding Held', cor: '#c9a86a', versao: 1, partida: 'p1', ramo: 'r1', criador: 'Diogo Holanda' };
  return [
    { ...base, slot: 'auto2', data: AGORA - 7 * 60e3, tique: 9000, populacao: 12480, creditos: 184350, marco: 4, mes: 3, ano: 2021, auto: true, capa: await capaFalsa(1) },
    { ...base, slot: 'manual1', data: AGORA - 2 * 3600e3, tique: 8400, populacao: 11920, creditos: 160000, marco: 4, mes: 2, ano: 2021, capa: await capaFalsa(2) },
    { ...base, slot: 'auto1', data: AGORA - 12 * 60e3, tique: 8800, populacao: 12310, creditos: 180000, marco: 4, mes: 3, ano: 2021, auto: true, capa: await capaFalsa(3) },
    { ...base, nome: 'Held Pórtico', slot: 'manual3', data: AGORA - 70 * 3600e3, tique: 2400, populacao: 860, creditos: 90000, marco: 1, mes: 5, ano: 2020, capa: null },
  ];
}

/** O jogo falso com o que o menu inicial e os saves pedem. */
async function prepararJogo(jogo) {
  const lista = await savesFalsos();
  Object.assign(jogo, {
    continuar: async () => ({ ok: false, codigo: 'nada' }),
    temDiario: () => true,
    temPartida: () => true,
    listarSaves: async () => lista,
    quarentena: async () => [],
    armazenamento: async () => ({ persistente: true, usadoMB: 41.6, cotaMB: 120000 }),
    exportar: async () => ({ ok: false, codigo: 'nada' }),
    apagarSave: async () => ({ ok: true }),
    salvamento: { estado: () => ({ criador: 'Diogo Holanda' }) },
  });
  saves.value = lista;
  capaFundo.value = URL.createObjectURL(lista[0].capa);
  return lista;
}

/** Monta o início sobre a interface (no jogo falso a carga não liga o início sozinha). */
function montarInicio(ui) {
  usarEstilo('inicio', CSS_INICIO);
  ui.ui.registrarHud('sobre', Inicio, { ordem: 90, nome: 'inicio' });
}

async function esperarSeletor(esperar, seletor, ms = 3000) {
  for (let t = 0; t < ms; t += 30) {
    if (document.querySelector(seletor)) return true;
    await esperar(30);
  }
  return false;
}

const conferirTexto = (seletor, re, nome) => () => {
  const e = document.querySelector(seletor);
  if (!e) return [`${nome}: ${seletor} não apareceu`];
  return re.test(e.textContent) ? [] : [`${nome}: "${e.textContent.slice(0, 120)}" não bate com ${re}`];
};

/** Um resultado do teste como o da PC1 e da PC2 no PC do dono (RX 550, 1080p, resolução dinâmica a 80%). */
const RESULTADO = {
  rel: {
    cena: 'jogo', perfil: 'pc', sugerido: 'pc', motivo: 'AMD Radeon RX 550: placa de entrada de PC (RX 460 a 560)', pr: 0.8, msaa: 2,
    resolucao: { w: 1536, h: 864, pr: 0.8, nominal: 1, escala: 0.8, nativa: { w: 1920, h: 1080 }, modo: 'cronometro', alvoGpu: 15.5, cas: 0.72, trocas: 3 },
    msMedio: 19.4, p95: 24.8, qps: 51.5, calls: 412, tris: 1630000, pior: { calls: 468, tris: 1820000, callsSombra: 38, trisSombra: 241000, ms: 41.2 },
    gpuMs: 14.9, gpuMsTimer: 15.1, gpuPasses: { sombra: 1.4, preparo: 0.9, ceu: 0.3, terreno: 4.8, agua: 0.7, predios: 5.6, vias: 0.8, arcologia: 0.2, pos: 0.4 }, gpuQuadros: 120,
    memoria: { videoMB: 612, geometriaMB: 88 }, aquecimento: { estado: 'pronto', programas: 58, ms: 4120 }, compilacoes: { programas: 58, depois: [] },
    programas: [], gpu: 'AMD Radeon RX 550 (D3D11)',
  },
  longas: 1,
  quando: AGORA,
};

export function registrar(registrarCenaVitrine) {
  // entrada: a mesma tela da carga, com "Clique para entrar" (mouse) ou "Toque para entrar" (toque)
  registrarCenaVitrine('u2-entrada', {
    async preparar({ ui, esperar }) {
      montarInicio(ui);
      abrirInicio('entrada');
      await esperarSeletor(esperar, '[data-a="inicio.entrar"]');
    },
    conferir: conferirTexto('[data-a="inicio.entrar"]', /(Clique|Toque) para entrar/, 'entrada'),
  });
  // menu inicial sobre a capa do último save: Continuar com a Holding, a população, a data do calendário e há quanto
  registrarCenaVitrine('u2-menu', {
    espera: 400,
    async preparar({ ui, jogo, esperar }) {
      await prepararJogo(jogo);
      montarInicio(ui);
      abrirInicio('menu');
      await esperarSeletor(esperar, '[data-a="inicio.continuar"]');
    },
    conferir: conferirTexto('[data-a="inicio.continuar"]', /Continuar.*Holding Held · 12\.480 moradores.*mar\. 2021 · salvo há 7 min/, 'continuar'),
  });
  registrarCenaVitrine('u2-nova', {
    async preparar({ ui, jogo, esperar }) {
      await prepararJogo(jogo);
      montarInicio(ui);
      abrirInicio('nova');
      await esperarSeletor(esperar, '[data-a="nova.nome"]');
    },
    conferir: () => {
      const nome = document.querySelector('[data-a="nova.nome"]')?.value;
      const criador = document.querySelector('[data-a="nova.criador"]')?.value;
      const f = [];
      if (nome !== 'Holding Held') f.push(`nome "${nome}"`);
      if (criador !== 'Diogo Holanda') f.push(`criador "${criador}"`);
      if (!/jan\. 2020/.test(document.querySelector('[data-tela="nova"]')?.textContent ?? '')) f.push('sem jan. 2020');
      return f;
    },
  });
  registrarCenaVitrine('u2-carregar', {
    espera: 400,
    async preparar({ ui, jogo, esperar }) {
      await prepararJogo(jogo);
      montarInicio(ui);
      abrirInicio('carregar');
      await esperarSeletor(esperar, '[data-a="sv.carregar"]');
    },
    conferir: conferirTexto('[data-tela="carregar"]', /Automático 2.*Holding Held/, 'saves'),
  });
  // configurações no jogo: Vídeo com o PC no seletor, resolução dinâmica e nitidez
  registrarCenaVitrine('u2-config', {
    async preparar({ ui, jogo, esperar }) {
      await prepararJogo(jogo);
      ui.ui.abrirTela('configuracoes');
      await esperarSeletor(esperar, '[data-a="cfg.qualidade"][data-k="pc"]');
    },
    conferir: conferirTexto('[data-tela="configuracoes"]', /PC.*Resolução dinâmica.*Nitidez/, 'vídeo'),
  });
  registrarCenaVitrine('u2-config-som', {
    async preparar({ ui, jogo, esperar, acionar }) {
      await prepararJogo(jogo);
      ui.ui.abrirTela('configuracoes');
      await esperarSeletor(esperar, '[data-a="configuracoes.aba"][data-k="som"]');
      acionar('configuracoes.aba', 'som');
      await esperar(60);
    },
    conferir: conferirTexto('[data-tela="configuracoes"]', /Geral.*Música.*Ambiente.*Efeitos do mundo.*Interface/, 'som'),
  });
  // as linhas que a integração ligou (C1b): o filtro dos avisos (X3a) na Interface e a paleta para daltonismo
  registrarCenaVitrine('u2-config-interface', {
    async preparar({ ui, jogo, esperar, acionar }) {
      await prepararJogo(jogo);
      ui.ui.abrirTela('configuracoes');
      await esperarSeletor(esperar, '[data-a="configuracoes.aba"][data-k="interface"]');
      acionar('configuracoes.aba', 'interface');
      await esperarSeletor(esperar, '[data-a="cfg.avisos"]');
    },
    conferir: conferirTexto('[data-tela="configuracoes"]', /Avisos sobre os prédios.*Todos.*Graves e atenção.*Nenhum/, 'interface'),
  });
  registrarCenaVitrine('u2-config-acessibilidade', {
    async preparar({ ui, jogo, esperar, acionar }) {
      await prepararJogo(jogo);
      ui.ui.abrirTela('configuracoes');
      await esperarSeletor(esperar, '[data-a="configuracoes.aba"][data-k="acessibilidade"]');
      acionar('configuracoes.aba', 'acessibilidade');
      await esperarSeletor(esperar, '[data-cfg="daltonismo"]');
    },
    conferir: conferirTexto('[data-tela="configuracoes"]', /Alto contraste.*Reduzir movimento.*Cores das camadas para daltonismo/, 'acessibilidade'),
  });
  registrarCenaVitrine('u2-config-salvamento', {
    async preparar({ ui, jogo, esperar, acionar }) {
      await prepararJogo(jogo);
      ui.ui.abrirTela('configuracoes');
      await esperarSeletor(esperar, '[data-a="configuracoes.aba"][data-k="salvamento"]');
      acionar('configuracoes.aba', 'salvamento');
      await esperar(120);
    },
    conferir: conferirTexto('[data-tela="configuracoes"]', /Salvar agora.*Exportar.*persistente/, 'salvamento'),
  });
  // teste de desempenho com o resultado: perfil e motivo, resolução interna, passes, aquecimento e compilações
  registrarCenaVitrine('u2-teste', {
    async preparar({ ui, esperar }) {
      mostrarResultado(RESULTADO);
      ui.ui.abrirTela('testeDesempenho');
      await esperarSeletor(esperar, '[data-a="td.resultado"]');
    },
    conferir: conferirTexto('[data-a="td.resultado"]', /PC.*RX 550.*1536 x 864 \(80% da nativa\).*cronômetro.*prédios.*58 programas/, 'resultado'),
  });
  // painel do F9 sobre o jogo
  registrarCenaVitrine('u2-painel', {
    async preparar({ ui, esperar }) {
      ui.ui.loja.prefs.value = { ...ui.ui.loja.prefs.peek(), painel: true };
      await esperarSeletor(esperar, '[data-painel="desempenho"]');
    },
    conferir: conferirTexto('[data-painel="desempenho"]', /qps.*chamadas.*triângulos/, 'painel'),
  });
  // primeira hora: a dica da via com a mão fantasma e o anel de guia em Vias
  registrarCenaVitrine('u2-dica', {
    cenario: 'inicio',
    async preparar({ ui, sim, esperar }) {
      usarEstiloGuia();
      ui.ui.registrarHud('sobre', AnelGuia, { ordem: 60, nome: 'anelGuia' });
      // o objetivo da primeira avenida aberto (a barra da simulação falsa é relida 4 vezes por segundo)
      const barra0 = sim.q.barra;
      const avenida = { id: 'cidade.avenida', texto: 's3.objetivo.cidade.avenida', params: {}, paramsChave: {}, quem: 'iris', dominio: 'cidade', feito: 0, total: 1, alvo: null, recompensa: { xp: 40, creditos: 0 } };
      sim.q.barra = () => {
        const b = barra0();
        return { ...b, objetivos: [avenida, ...(b.objetivos ?? []).filter((o) => o.dominio !== 'cidade')] };
      };
      ui.ui.loja.barra.value = sim.q.barra();
      dicaAtual.value = { ...DICAS.find((d) => d.id === 'numeros') };
      await esperarSeletor(esperar, '[data-dica="numeros"]');
    },
    conferir: () => {
      const f = conferirTexto('[data-dica="numeros"]', /Lívia Andrade.*(Toque|Clique) nos números/, 'dica')();
      if (!document.querySelector('.mao')) f.push('sem a mão fantasma');
      if (!document.querySelector('[data-guia="vias"]')) f.push('sem o anel de guia em Vias');
      return f;
    },
  });
}
