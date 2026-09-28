// Raiz da interface (Preact, por cima do canvas): criarUI(raiz, { sim, R, jogo }) → { quadro(t), trocarSim(sim), ... }.
// A interface nunca toca em objetos do three nem no estado interno da simulação: lê sinais (loja.js), consulta por
// consultas.js e age por acoes.js. Tudo entra por registro; este arquivo tem o ÍNDICE FIXO dos módulos da interface e
// nenhuma parcela o edita. Cada módulo exporta registrar(ui) e usa:
//   ui.registrarHud(lugar, Componente, { ordem, nome })   lugares: 'cima', 'centro', 'direita', 'baixo', 'mundo',
//                                                          'folha', 'sobre' (posições em tema/base.css)
//   ui.registrarTela(id, Componente)                       telas de gestão (loja.tela; ui.abrirTela(id))
//   ui.registrarSecao(id, Componente, { ordem })           seções da folha do selecionado (U1b lista por ui.secoes())
//   ui.registrarTextos, ui.registrarGlifos, ui.aoQuadro(fn(tMs)) e o acesso a R, jogo, loja, consultas, comando, t, fmt
import { render } from 'preact';
import { signal } from '@preact/signals';
import * as loja from './loja.js';
import { criarPonte } from './ponte.js';
import { ligarAcoes, comando, velocidade, frase, SESSAO } from './acoes.js';
import { ligarConsultas, consultas, consultar } from './consultas.js';
import { t, registrarTextos } from './textos.js';
import * as fmt from './formato.js';
import { registrarGlifos } from './glifos/glifos.js';
import { aplicarPrefs } from './prefs.js';

import * as hudBarraCima from './hud/BarraCima.jsx';
import * as hudVelocidade from './hud/Velocidade.jsx';
import * as hudTrilho from './hud/Trilho.jsx';
import * as hudObjetivo from './hud/Objetivo.jsx';
import * as hudFaixaAlerta from './hud/FaixaAlerta.jsx';
import * as hudAvisos from './hud/Avisos.jsx';
import * as hudMenu from './hud/Menu.jsx';
import * as hudRetomar from './hud/Retomar.jsx';
import * as hudConstrucao from './hud/Construcao.jsx';
import * as hudBandeja from './hud/Bandeja.jsx';
import * as hudBarraFerramenta from './hud/BarraFerramenta.jsx';
import * as selCartao from './selecao/Cartao.jsx';
import * as selFolha from './selecao/Folha.jsx';
import * as secResidencial from './selecao/secoes/residencial.jsx';
import * as secComercial from './selecao/secoes/comercial.jsx';
import * as secIndustrial from './selecao/secoes/industrial.jsx';
import * as secServico from './selecao/secoes/servico.jsx';
import * as secEmpresa from './selecao/secoes/empresa.jsx';
import * as secVia from './selecao/secoes/via.jsx';
import * as secTerreno from './selecao/secoes/terreno.jsx';
import * as secArcologia from './selecao/secoes/arcologia.jsx';
import * as telaEconomia from './telas/Economia.jsx';
import * as telaHolding from './telas/Holding.jsx';
import * as telaCidade from './telas/Cidade.jsx';
import * as telaProgresso from './telas/Progresso.jsx';
import * as telaConselho from './telas/Conselho.jsx';
import * as telaDecisao from './telas/Decisao.jsx';
import * as telaMomento from './telas/Momento.jsx';
import * as telaLivroArcologia from './telas/LivroArcologia.jsx';
import * as telaCamadas from './telas/Camadas.jsx';
import * as telaProblemas from './telas/Problemas.jsx';
import * as telaConfiguracoes from './telas/Configuracoes.jsx';
import * as telaTesteDesempenho from './telas/TesteDesempenho.jsx';
import * as telaFoto from './telas/Foto.jsx';
import * as telaMural from './telas/Mural.jsx';
import * as mundoMenuContexto from './mundo/MenuContexto.jsx';
import * as mundoMarcadores from './mundo/marcadores.js';
import * as mundoRotulos from './mundo/Rotulos.jsx';
import * as mundoLupa from './mundo/Lupa.jsx';
import * as mundoCotas from './mundo/Cotas.jsx';
import * as glifosAtlas from './glifos/atlas.js';
import * as inicioCarga from './inicio/carga.js';
import * as inicioMenuInicial from './inicio/MenuInicial.jsx';
import * as inicioNovaPartida from './inicio/NovaPartida.jsx';
import * as inicioGirar from './inicio/Girar.jsx';
import * as inicioAbertura from './inicio/Abertura.jsx';
import * as guiaObjetivos from './guia/objetivos.js';
import * as guiaDicas from './guia/dicas.js';
import * as guiaSugestoes from './guia/sugestoes.js';
import * as ferVia from './ferramentas/via.js';
import * as ferZona from './ferramentas/zona.js';
import * as ferColocar from './ferramentas/colocar.js';
import * as ferDemolir from './ferramentas/demolir.js';
import * as ferAreas from './ferramentas/areas.js';
import * as ferSessao from './ferramentas/sessao.js';

/** Índice fixo, na ordem de registro. */
export const MODULOS_UI = Object.freeze([
  hudBarraCima, hudVelocidade, hudTrilho, hudObjetivo, hudFaixaAlerta, hudAvisos, hudMenu, hudRetomar,
  hudConstrucao, hudBandeja, hudBarraFerramenta,
  selCartao, selFolha, secResidencial, secComercial, secIndustrial, secServico, secEmpresa, secVia, secTerreno, secArcologia,
  telaEconomia, telaHolding, telaCidade, telaProgresso, telaConselho, telaDecisao, telaMomento, telaLivroArcologia,
  telaCamadas, telaProblemas, telaConfiguracoes, telaTesteDesempenho, telaFoto, telaMural,
  mundoMenuContexto, mundoMarcadores, mundoRotulos, mundoLupa, mundoCotas, glifosAtlas,
  inicioCarga, inicioMenuInicial, inicioNovaPartida, inicioGirar, inicioAbertura,
  guiaObjetivos, guiaDicas, guiaSugestoes,
  ferVia, ferZona, ferColocar, ferDemolir, ferAreas, ferSessao,
]);

export const LUGARES = Object.freeze(['cima', 'centro', 'direita', 'baixo', 'mundo', 'folha', 'sobre']);

/**
 * Monta a interface na raiz (o #ui do index.html).
 * @param {HTMLElement} raiz
 * @param {{ sim: object, R: object, jogo: object }} op  sim: a simulação (ou a falsa da vitrine); R: o render (ou o
 *   falso); jogo: o objeto do app (seção 2.8)
 */
export function criarUI(raiz, { sim, R = null, jogo = null } = {}) {
  let simAtual = sim;
  const obterSim = () => simAtual;
  const hud = new Map(LUGARES.map((l) => [l, []]));
  const telas = new Map();
  const secoes = [];
  const quadros = [];
  const versao = signal(0); // sobe quando algo se registra depois da montagem
  let semNome = 0;

  const ponte = criarPonte({ obterSim });
  ligarConsultas(obterSim);
  ligarAcoes({ obterSim, aoComando: () => ponte.marcar() });

  const ui = {
    R,
    jogo,
    obterSim,
    loja,
    consultas,
    consultar,
    comando,
    velocidade,
    frase,
    SESSAO,
    t,
    fmt,
    registrarTextos,
    registrarGlifos,
    registrarHud(lugar, Comp, { ordem = 50, nome = Comp?.name || `hud${++semNome}` } = {}) {
      if (!hud.has(lugar)) throw new Error(`registrarHud: lugar desconhecido '${lugar}' (${LUGARES.join(', ')})`);
      // o mesmo nome no mesmo lugar troca a peça (a U1a refaz a barra da F0); o nome também é a chave do Preact
      const l = hud.get(lugar).filter((p) => p.nome !== nome);
      l.push({ Comp, ordem, nome });
      l.sort((a, b) => a.ordem - b.ordem);
      hud.set(lugar, l);
      versao.value++;
    },
    registrarTela(id, Comp, op = {}) {
      telas.set(id, { Comp, ...op });
      versao.value++;
    },
    registrarSecao(id, Comp, { ordem = 50 } = {}) {
      const i = secoes.findIndex((s) => s.id === id);
      if (i >= 0) secoes.splice(i, 1);
      secoes.push({ id, Comp, ordem });
      secoes.sort((a, b) => a.ordem - b.ordem);
      versao.value++;
    },
    secoes: () => [...secoes],
    telas: () => [...telas.keys()],
    aoQuadro(fn) {
      quadros.push(fn);
      return () => {
        const i = quadros.indexOf(fn);
        if (i >= 0) quadros.splice(i, 1);
      };
    },
    /** Abre uma tela de gestão registrada; sem ela, avisa que ainda não existe. */
    abrirTela(id) {
      if (!telas.has(id)) {
        loja.avisar({ texto: t('app.emBreve'), gravidade: 'info' });
        return false;
      }
      loja.tela.value = id;
      R?.estado?.('coberto');
      return true;
    },
    fecharTela() {
      loja.tela.value = null;
      R?.estado?.('livre');
    },
  };

  for (const m of MODULOS_UI) {
    try {
      m.registrar?.(ui);
    } catch (e) {
      console.error('interface: registro falhou', e);
    }
  }

  function Lugar({ nome }) {
    versao.value; // redesenha quando algo se registra
    const pecas = hud.get(nome);
    if (!pecas.length) return null;
    return (
      <div class={`lugar lugar-${nome}`}>
        {pecas.map(({ Comp, nome: n }) => (
          <Comp key={n} ui={ui} />
        ))}
      </div>
    );
  }
  function TelaAberta() {
    versao.value;
    const id = loja.tela.value;
    const def = id ? telas.get(id) : null;
    if (!def) return null;
    const { Comp } = def;
    return <Comp ui={ui} fechar={() => ui.fecharTela()} />;
  }
  function App() {
    return (
      <div class="ui-raiz">
        <Lugar nome="mundo" />
        <Lugar nome="cima" />
        <Lugar nome="centro" />
        <Lugar nome="direita" />
        <Lugar nome="baixo" />
        <Lugar nome="folha" />
        <TelaAberta />
        <Lugar nome="sobre" />
      </div>
    );
  }

  aplicarPrefs(loja.prefs.value);
  ponte.ligar(simAtual);
  ponte.atualizar();
  render(<App />, raiz);

  // toque no mundo: seleciona pelo render (o árbitro de gestos é do render, D40)
  const soltarToque = R?.entrada?.aoToque?.(({ x, y, longo }) => {
    if (longo) return; // menu de contexto: U1b
    const s = R.selecionar(x, y);
    const util = s && s.tipo !== 'terreno' && s.tipo !== 'agua' ? s : null;
    loja.selecao.value = util;
    R.selecionado?.(util ? { tipo: util.tipo, ref: util.ref } : null);
  });
  const aoTecla = (ev) => {
    if (ev.key === 'Escape' && loja.tela.value) ui.fecharTela();
  };
  if (typeof addEventListener !== 'undefined') addEventListener('keydown', aoTecla);

  return {
    ui,
    quadro(tMs) {
      ponte.quadro(tMs);
      for (const fn of quadros) {
        try {
          fn(tMs);
        } catch (e) {
          console.error('interface: quadro falhou', e);
        }
      }
    },
    /** O app trocou de simulação (nova partida ou carregar). */
    trocarSim(s) {
      simAtual = s;
      loja.reiniciarLoja();
      ponte.ligar(s);
      ponte.atualizar();
    },
    desmontar() {
      soltarToque?.();
      if (typeof removeEventListener !== 'undefined') removeEventListener('keydown', aoTecla);
      render(null, raiz);
    },
  };
}
