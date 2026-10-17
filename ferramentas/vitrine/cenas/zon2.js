// Cenas da vitrine da ZON2 (interface): o painel de crescimento da zona (Automático, Manual com a demanda acumulada, o
// campo do lote e o lote em andamento), os contornos nomeados do Distrito Industrial e da Zona de Utilidades quando a
// ferramenta pede, a recusa de lugar com o motivo legível e a prévia da rede de longo alcance. A simulação é a falsa, com
// as consultas e os comandos da ZON2 de mentira (zona.crescimento, zona.regras, zona.modo, zona.lote, construir.previa).
//   node ferramentas/vitrine-ui.mjs <pasta> zon2-painel-auto,zon2-painel-manual,zon2-distrito,zon2-utilidades-recusa,zon2-rede 986x443,915x412,1376x768,1920x1080
import { DISTRITO_INDUSTRIAL, ZONA_UTILIDADES, VENTO_PREDOMINANTE, LONGO_ALCANCE, MODOS_CRESCIMENTO } from '../../../fonte/data/zon2.js';
import { ZONAS } from '../../../fonte/data/zonas.js';
import { ferramentas } from '../../../fonte/ui/ferramentas/sessao.js';

const REGRAS = {
  ligadas: true,
  distrito: { id: DISTRITO_INDUSTRIAL.id, nome: DISTRITO_INDUSTRIAL.nome, contorno: DISTRITO_INDUSTRIAL.contorno.map((p) => [...p]), zonas: ['industria'], tipos: ['pedreira'] },
  utilidades: { id: ZONA_UTILIDADES.id, nome: ZONA_UTILIDADES.nome, contorno: ZONA_UTILIDADES.contorno.map((p) => [...p]), tipos: ['captacao', 'poco', 'solar', 'ete', 'termica'] },
  vento: { de: VENTO_PREDOMINANTE.de, para: VENTO_PREDOMINANTE.para, angulo: VENTO_PREDOMINANTE.angulo },
  longoAlcance: { custoPorMetro: { ...LONGO_ALCANCE.custoPorMetro }, alcanceMax: LONGO_ALCANCE.alcanceMax },
  modos: [...MODOS_CRESCIMENTO],
  lote: { min: 1, max: 1000 },
};

const ITEM_SOLAR = { tipo: 'solar', nome: 'Usina solar', custo: 30000, manutencaoHora: 500, marco: 0, liberado: true, grupo: 'Energia', glifo: 'energia', zona: 'utilidades', pegada: [40, 40] };

/** Instala as consultas e os comandos da ZON2 de mentira na simulação falsa. */
function instalar(sim, { modo = 'automatico', pedido = 0, espera = 0, previa = null } = {}) {
  const E = { modo: {}, pedido: {}, espera: {} };
  const item = (id) => ({
    zona: id, id, nome: ZONAS[id].nome, familia: ZONAS[id].familia, modo: E.modo[id] ?? modo, pedido: E.pedido[id] ?? pedido, espera: E.espera[id] ?? espera,
    demanda: 64, frentes: 18, construidos: 42, emObra: 3,
  });
  sim.q.zona = {
    previa: (a) => ({ celulas: new Int32Array(0), comPredio: 0, efeitoMedia: 0, foraDoDistrito: a?.zona === 7 ? 24 : 0 }),
    crescimento: (a) => (a && a.zona !== undefined ? item(a.zona) : Object.keys(ZONAS).map(item)),
    regras: () => REGRAS,
    lugar: () => ({ distrito: false, utilidades: false }),
  };
  if (previa) sim.q.construir = { previa: () => ({ ...previa }) };
  const cmd = sim.cmd.bind(sim);
  sim.cmd = (nome, args = {}) => {
    if (nome === 'zona.modo') {
      if ((E.modo[args.zona] ?? modo) === args.modo) return { ok: false, codigo: 'nada' };
      const cancelados = args.modo === 'automatico' ? E.pedido[args.zona] ?? pedido : 0;
      E.modo[args.zona] = args.modo;
      E.pedido[args.zona] = 0;
      return { ok: true, dados: { zona: args.zona, modo: args.modo, cancelados } };
    }
    if (nome === 'zona.lote') {
      if ((E.modo[args.zona] ?? modo) !== 'manual') return { ok: false, codigo: 'modo' };
      if (args.n === 0) {
        const cancelados = E.pedido[args.zona] ?? pedido;
        E.pedido[args.zona] = 0;
        return { ok: true, dados: { pedido: 0, cancelados } };
      }
      E.pedido[args.zona] = (E.pedido[args.zona] ?? pedido) + args.n;
      return { ok: true, dados: { pedido: E.pedido[args.zona], cancelados: 0 } };
    }
    return cmd(nome, args);
  };
  return E;
}

function evento(R, tipo, p, t) {
  const s = R.projetar([p[0], 0, p[1]]);
  return { tipo, ponto: [...p], tela: [s.x, s.y], dedo: [s.x, s.y], t };
}

const existe = (sel, nome) => () => (document.querySelector(sel) ? [] : [`${nome}: ${sel} não apareceu`]);
const textoTem = (sel, re, nome) => () => {
  const e = document.querySelector(sel);
  if (!e) return [`${nome}: ${sel} não apareceu`];
  return re.test(e.textContent) ? [] : [`${nome}: "${e.textContent.slice(0, 120)}" não bate com ${re}`];
};
const juntar = (...fs) => () => fs.flatMap((f) => f());
const barraCabe = () => {
  const b = document.querySelector('.barra-ferr');
  if (!b) return ['a barra da ferramenta não apareceu'];
  const r = b.getBoundingClientRect();
  return r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 ? ['barra da ferramenta fora da tela'] : [];
};
const painelCabe = () => {
  const p = document.querySelector('.zon2-painel');
  if (!p) return ['o painel não apareceu'];
  const r = p.getBoundingClientRect();
  return r.left < 0 || r.right > innerWidth + 1 || r.top < 0 ? [`painel fora da tela (${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)})`] : [];
};

export function registrar(registrarCenaVitrine) {
  // Automático: o seletor com o modo marcado e a dica; sem campo de lote
  registrarCenaVitrine('zon2-painel-auto', {
    cenario: 'meio',
    async preparar({ sim, R, esperar, acionar }) {
      instalar(sim, { modo: 'automatico' });
      ferramentas.abrir('zona', { zona: 'comBaixa' });
      R.camera.definir({ x: 250, z: 40, dist: 420, guinada: 16, inclinacao: 48 });
      await esperar(60);
      acionar('zon2.painel');
      await esperar(60);
    },
    conferir: juntar(
      existe('[data-a="zon2.modo"][data-k="automatico"][aria-checked="true"]', 'Automático marcado'),
      textoTem('.zon2-painel', /Crescimento da zona.*Automático.*Manual por lote.*nascerem sozinhas/s, 'painel'),
      () => (document.querySelector('[data-a="zon2.qtd"]') ? ['o campo do lote não devia aparecer no Automático'] : []),
      painelCabe,
      barraCabe,
    ),
  });
  // Manual: a demanda acumulada, o campo (padrão 10), Começar lote e o lote em andamento com Cancelar
  registrarCenaVitrine('zon2-painel-manual', {
    cenario: 'meio',
    async preparar({ sim, R, esperar, acionar }) {
      instalar(sim, { modo: 'manual', pedido: 25, espera: 37.4 });
      ferramentas.abrir('zona', { zona: 'resMedia' });
      R.camera.definir({ x: 250, z: 40, dist: 420, guinada: 16, inclinacao: 48 });
      await esperar(60);
      acionar('zon2.painel');
      await esperar(60);
    },
    conferir: juntar(
      textoTem('[data-k="espera"]', /Demanda acumulada.*37 construções/s, 'demanda acumulada'),
      textoTem('.zon2-painel', /Quantas construções começar.*Faltam 25 construções do lote.*Começar lote.*Cancelar o que falta/s, 'lote'),
      () => (document.querySelector('[data-a="zon2.qtd"]')?.value === '10' ? [] : ['o campo não começa em 10']),
      existe('[data-a="zon2.lote"][data-principal]', 'Começar lote como ação principal'),
      painelCabe,
      barraCabe,
    ),
  });
  // Manual: digita 2000, o campo recusa e o botão fica fraco; digita 50 e inicia; o aviso e o lote crescem
  let invalido = null;
  registrarCenaVitrine('zon2-lote-digitado', {
    cenario: 'meio',
    async preparar({ sim, R, esperar, acionar }) {
      instalar(sim, { modo: 'manual', pedido: 0, espera: 120 });
      ferramentas.abrir('zona', { zona: 'comBaixa' });
      R.camera.definir({ x: 250, z: 40, dist: 420, guinada: 16, inclinacao: 48 });
      await esperar(60);
      acionar('zon2.painel');
      await esperar(40);
      const campo = document.querySelector('[data-a="zon2.qtd"]');
      campo.value = '5000';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await esperar(60);
      invalido = document.querySelector('[data-a="zon2.qtd"]')?.getAttribute('aria-invalid');
      campo.value = '50';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await esperar(60);
      acionar('zon2.lote');
      await esperar(80);
    },
    conferir() {
      const f = textoTem('.zon2-painel', /Faltam 50 construções do lote/, 'lote iniciado')();
      if (invalido !== 'true') f.push('5000 devia marcar o campo como inválido');
      return f;
    },
  });
  // Troca de Manual para Automático com lote pendente: o painel volta sem o campo
  registrarCenaVitrine('zon2-troca-auto', {
    cenario: 'meio',
    async preparar({ sim, R, esperar, acionar }) {
      instalar(sim, { modo: 'manual', pedido: 8, espera: 3 });
      ferramentas.abrir('zona', { zona: 'comBaixa' });
      R.camera.definir({ x: 250, z: 40, dist: 420, guinada: 16, inclinacao: 48 });
      await esperar(60);
      acionar('zon2.painel');
      await esperar(40);
      acionar('zon2.modo', 'automatico');
      await esperar(80);
    },
    conferir: juntar(
      existe('[data-a="zon2.modo"][data-k="automatico"][aria-checked="true"]', 'Automático marcado'),
      () => (document.querySelector('[data-a="zon2.qtd"]') ? ['o campo ficou no Automático'] : []),
      textoTem('[data-a="zon2.painel"]', /Automático/, 'chip'),
    ),
  });
  // Zona industrial: o Distrito Industrial contornado e nomeado, com o vento; pincel fora dele diz o motivo
  registrarCenaVitrine('zon2-distrito', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      instalar(sim, { modo: 'automatico' });
      ferramentas.abrir('zona', { zona: 'industria' });
      R.camera.definir({ x: -830, z: -1240, dist: 1900, guinada: 0, inclinacao: 60 });
      ferramentas.evento(evento(R, 'hover', [-700, -1250], 0));
      await esperar(80);
    },
    conferir: juntar(
      textoTem('.z2-rotulo.z2-distrito', /Distrito Industrial.*Vento do sul-sudeste para o norte-noroeste/s, 'rótulo do distrito'),
      () => (document.querySelector('polygon[data-area="distrito"]')?.getAttribute('points')?.length > 20 ? [] : ['o contorno do distrito não foi desenhado']),
      () => (document.querySelector('.z2-utilidades') ? ['a Zona de Utilidades não devia aparecer na indústria'] : []),
      barraCabe,
    ),
  });
  // Pincel industrial fora do distrito: a barra diz que nada ali é do distrito
  registrarCenaVitrine('zon2-distrito-fora', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      instalar(sim, { modo: 'automatico' });
      ferramentas.abrir('zona', { zona: 'industria' });
      R.camera.definir({ x: 250, z: 40, dist: 420, guinada: 16, inclinacao: 48 });
      ferramentas.evento(evento(R, 'hover', [290, 60], 0));
      await esperar(80);
    },
    conferir: textoTem('.bf-linha', /Nada aqui é do Distrito Industrial/, 'fora do distrito'),
  });
  // Utilidade fora da Zona de Utilidades: contorno azul, fantasma vermelho e o motivo curto no botão
  registrarCenaVitrine('zon2-utilidades-recusa', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      instalar(sim, { previa: { ok: false, codigo: 'utilidades', x: -600, z: 100, rot: 0, custo: 30000, dados: { area: 'zonaUtilidades', nome: 'Zona de Utilidades' } } });
      sim.q.catalogo = (cat) => (cat === 'servicos' ? [{ ...ITEM_SOLAR }] : []);
      ferramentas.abrir('colocar', { item: { ...ITEM_SOLAR } });
      R.camera.definir({ x: -1000, z: -120, dist: 1500, guinada: 0, inclinacao: 58 });
      ferramentas.evento(evento(R, 'hover', [-600, 100], 0));
      await esperar(80);
    },
    conferir: juntar(
      textoTem('.z2-rotulo.z2-utilidades', /Zona de Utilidades/, 'rótulo da zona'),
      textoTem('[data-a="ferr.principal"]', /Fora da Zona de Utilidades/, 'motivo no botão'),
      () => (document.querySelector('polygon[data-area="utilidades"]')?.getAttribute('points')?.length > 20 ? [] : ['o contorno das utilidades não foi desenhado']),
      barraCabe,
    ),
  });
  // Utilidade dentro da zona com a linha de longo alcance: metros e custo na barra e na marca do mundo
  registrarCenaVitrine('zon2-rede', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      instalar(sim, { previa: { ok: true, x: -1200, z: 100, rot: 0, custo: 30000 + 420 * 5, alcance: 0, longoAlcance: { rec: 'energia', metros: 420, custo: 2100, alcanca: true } } });
      sim.q.catalogo = (cat) => (cat === 'servicos' ? [{ ...ITEM_SOLAR }] : []);
      ferramentas.abrir('colocar', { item: { ...ITEM_SOLAR } });
      R.camera.definir({ x: -1230, z: -100, dist: 1100, guinada: 0, inclinacao: 58 });
      ferramentas.evento(evento(R, 'hover', [-1200, 100], 0));
      await esperar(80);
    },
    conferir: juntar(
      textoTem('.bf-linha', /Linha de transmissão.*Linha de 420 m até a rede da cidade/s, 'linha na barra'),
      textoTem('.cota-rede', /Linha de transmissão: 420 m/, 'marca no mundo'),
      barraCabe,
    ),
  });
  // Rede fora do alcance: o motivo diz quantos metros faltam
  registrarCenaVitrine('zon2-rede-longe', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      instalar(sim, { previa: { ok: true, x: -1200, z: 100, rot: 0, custo: 30000, longoAlcance: { rec: 'agua', metros: 3400, custo: 0, alcanca: false } } });
      sim.q.catalogo = () => [];
      ferramentas.abrir('colocar', { item: { ...ITEM_SOLAR, tipo: 'captacao', nome: 'Captação de água' } });
      R.camera.definir({ x: -1230, z: -100, dist: 1100, guinada: 0, inclinacao: 58 });
      ferramentas.evento(evento(R, 'hover', [-1200, 100], 0));
      await esperar(80);
    },
    conferir: textoTem('.bf-linha', /3\.400 m/, 'sem alcance'),
  });
}
