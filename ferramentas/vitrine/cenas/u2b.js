// Cenas da vitrine da U2b: o Mural com as notícias de todos os assuntos (marcos, decisões, Arcologia, mundo e Vila) e a
// aba filtrada, o Modo foto (a interface some, fica o painel das luzes e do salvar) com a noite escolhida, a legenda da
// abertura (terceiro tempo, a Arcologia) e a nova partida com o Modo livre ligado.
//   node ferramentas/vitrine-ui.mjs <pasta> u2b-mural,u2b-mural-arcologia,u2b-foto,u2b-foto-noite,u2b-abertura,u2b-nova-livre 986x443,1376x768
import { Inicio } from '../../../fonte/ui/inicio/Entrada.jsx';
import { abrirInicio } from '../../../fonte/ui/inicio/estado.js';
import { usarEstilo, CSS_INICIO } from '../../../fonte/ui/inicio/estilo.js';
import { ligarAbertura, abertura } from '../../../fonte/ui/inicio/Abertura.jsx';

const esperarSeletor = async (esperar, seletor, ms = 2500) => {
  for (let t = 0; t < ms; t += 30) {
    if (document.querySelector(seletor)) return true;
    await esperar(30);
  }
  return false;
};

const conferirTexto = (seletor, re, nome) => () => {
  const el = document.querySelector(seletor);
  if (!el) return [`${nome}: ${seletor} não apareceu`];
  return re.test(el.textContent ?? '') ? [] : [`${nome}: "${(el.textContent ?? '').slice(0, 140)}" não bate com ${re}`];
};

const T = (mes, ano) => (ano - 2020) * 7200 + (mes - 1) * 600;

/** As notícias que a simulação posta (chaves de s3, s3b e x1), do jogo falso. */
function postsFalsos() {
  const p = (id, mes, ano, autor, texto, params = {}, alvo = null) => ({ id, tique: T(mes, ano), autor, texto, params, alvo, data: { mes, ano } });
  return [
    p(1, 1, 2020, 'iris', 's3.mural.evento.inicio'),
    p(2, 3, 2020, 'iris', 's3.mural.marco', { n: 1, nome: 'Povoado' }),
    p(3, 4, 2020, 'cida', 's3.mural.decisao.vila.agua.captacao', {}, { x: -420, z: -310 }),
    p(4, 6, 2020, 'livia', 's3.mural.evento.dinheiroBarato'),
    p(5, 9, 2020, 'iris', 's3.mural.marco', { n: 2, nome: 'Vila' }),
    p(6, 2, 2021, 'cida', 's3.mural.vilaNova.reformar', { n: 38 }, { x: -420, z: -310 }),
    p(7, 5, 2021, 'tome', 'x1.mural.lago.e1', {}, { x: 380, z: 1210 }),
    p(8, 8, 2021, 'caio', 's3.mural.decisao.energia.2022.solar'),
    p(9, 2, 2022, 'iris', 'x1.mural.torre.e1', {}, { x: 380, z: 1210 }),
    p(10, 3, 2022, 'iris', 'x1.mural.blade330', { m: 330 }, { x: 380, z: 1210 }),
    p(11, 4, 2022, null, 's3.mural.evento.energia2022'),
  ];
}

export function registrar(registrarCenaVitrine) {
  registrarCenaVitrine('u2b-mural', {
    espera: 250,
    async preparar({ sim, ui, esperar }) {
      sim.q.mural = () => postsFalsos();
      ui.ui.abrirTela('mural');
      await esperarSeletor(esperar, '.mu-nota');
    },
    conferir: () => {
      const f = conferirTexto('[data-tela="mural"]', /Mural.*Tudo.*Decisões.*Marcos.*Arcologia.*Mundo.*Vila.*11 notícias/s, 'mural')();
      const primeira = document.querySelector('.mu-nota')?.textContent ?? '';
      if (!/Energia de 2022|energia, aço e fertilizantes/.test(primeira)) f.push('a notícia mais nova não vem primeiro');
      if (!document.querySelector('[data-a="mural.ver"]')) f.push('sem "Ver no mapa"');
      return f;
    },
  });
  registrarCenaVitrine('u2b-mural-arcologia', {
    espera: 250,
    async preparar({ sim, ui, esperar, acionar }) {
      sim.q.mural = () => postsFalsos();
      ui.ui.abrirTela('mural');
      await esperarSeletor(esperar, '.mu-nota');
      acionar('mural.aba', 'arcologia');
      await esperar(80);
    },
    conferir: () => {
      const notas = [...document.querySelectorAll('.mu-nota')];
      return notas.length === 3 && notas.every((n) => n.dataset.assunto === 'arcologia') ? [] : [`aba Arcologia com ${notas.length} notícias`];
    },
  });
  registrarCenaVitrine('u2b-foto', {
    async preparar({ ui, esperar, acionar }) {
      acionar('trilho', 'foto');
      await esperarSeletor(esperar, '.foto-painel');
    },
    conferir: () => {
      const f = conferirTexto('.foto-painel', /Luz.*Luz do jogo.*Manhã.*Tarde.*Fim de tarde.*Noite.*Tamanho.*Salvar imagem.*Sair/s, 'foto')();
      if (document.documentElement.dataset.foto !== '1') f.push('a interface não foi escondida');
      const vis = [...document.querySelectorAll('#ui .ui-raiz > *')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.querySelector('[data-a]') && !e.querySelector('.foto-painel'));
      if (vis.length) f.push(`ficou à vista: ${vis.map((e) => e.className).join(', ')}`);
      return f;
    },
  });
  registrarCenaVitrine('u2b-foto-noite', {
    async preparar({ ui, esperar, acionar }) {
      acionar('trilho', 'foto');
      await esperarSeletor(esperar, '.foto-painel');
      acionar('foto.luz', 'noite');
      await esperar(80);
    },
    conferir: () => (document.querySelector('[data-a="foto.luz"][data-k="noite"][aria-checked="true"]') ? [] : ['a luz da noite não ficou marcada']),
  });
  registrarCenaVitrine('u2b-abertura', {
    espera: 300,
    async preparar({ ui, esperar }) {
      ligarAbertura(ui.ui);
      document.documentElement.dataset.abertura = '1';
      abertura.value = { cena: 2, vez: 2 };
      await esperarSeletor(esperar, '.ab-legenda');
    },
    conferir: () => [
      ...conferirTexto('.abertura', /A Arcologia de Held.*Park of Future Dreams.*Pular abertura/s, 'abertura')(),
      ...(document.querySelector('[data-a="abertura.pular"]') ? [] : ['sem o botão de pular']),
    ],
  });
  registrarCenaVitrine('u2b-nova-livre', {
    async preparar({ ui, esperar, acionar }) {
      usarEstilo('inicio', CSS_INICIO);
      ui.ui.registrarHud('sobre', Inicio, { ordem: 90, nome: 'inicio' });
      abrirInicio('nova');
      await esperarSeletor(esperar, '[data-a="nova.livre"]');
      acionar('nova.livre');
      await esperar(80);
    },
    conferir: () => [
      ...conferirTexto('[data-tela="nova"]', /Modo livre: ligado.*Sem licença de ladrilho e sem custo.*Não conta recordes/s, 'nova livre')(),
    ],
  });
}
