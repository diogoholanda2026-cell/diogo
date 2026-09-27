// Contrato interno da simulação (seção 2.10): como os domínios conversam sem editar o arquivo uns dos outros.
// A F0 cria cada serviço com um substituto simples (fonte/sim/substitutos.js); a parcela dona troca o substituto por
// sim.implementar(servico, funcoes) no seu registrar(sim). Nenhuma parcela edita nucleo.js nem estado.js.
import { congelar } from '../comum/util.js';

/**
 * S.agregados: números da cidade inteira, escritos por S2a e S2b e lidos por S3a, X1b e q.barra. O núcleo o registra
 * como a seção JSON 'agregados' (vai no save e no hash): quem lê entre duas somas precisa do mesmo valor numa partida
 * carregada. Escreva nos campos (sim.agregados.populacao = ...), nunca troque o objeto, e não guarde objetos de dentro
 * dele entre tiques (ao carregar o conteúdo é trocado no lugar). Só números, arrays e arrays tipados.
 * @example criarAgregados().redes.agua // { oferta: 0, demanda: 0 }
 */
export function criarAgregados() {
  return {
    populacao: 0,
    lares: 0,
    popHora: 0,
    bemEstarMedio: 0,
    bemEstarTarifa: 0, // média suavizada em 1 mês e arredondada (D11)
    tarifa: 5,
    demanda: {
      resBaixa: 0, resMedia: 0, resAlta: 0, comBaixa: 0, comAlta: 0, escritorio: 0, industria: 0,
      R: 0, C: 0, I: 0, E: 0, fatores: {},
    },
    empregos: { vagas: [0, 0, 0, 0], ocupadas: [0, 0, 0, 0], desemprego: [0, 0, 0, 0] },
    redes: {
      agua: { oferta: 0, demanda: 0 },
      esgoto: { oferta: 0, demanda: 0 },
      energia: { oferta: 0, demanda: 0 },
      importado: { energia: 0 },
    },
    trajeto: null, // S1c (M1b): { porZona: Float32Array }
    mercadoria: null, // S2b (M1b): { producao, consumo, importada }
  };
}

/**
 * Serviços do contrato interno: quem implementa, quem usa, e o que o substituto da F0 faz.
 * sim.implementar(nome, { funcao: fn, ... }) troca as funções listadas em `funcoes` e desliga o sistema substituto.
 */
export const SERVICOS_INTERNOS = congelar({
  holding: {
    dono: 'S3a',
    funcoes: ['pagar', 'receber', 'comprarParaObra', 'entregar', 'efeito', 'caixa'],
    substituto:
      'pagar(valor, categoria) → bool, real desde a F0: o caixa nunca fica abaixo de 0 (D41); receber soma; comprarParaObra importa sem receita ({ espera: false }); entregar é instantânea (aoChegar na hora); efeito guarda; caixa() lê sim.json.holding.caixa',
  },
  progresso: {
    dono: 'S3a',
    funcoes: ['xp', 'liberado', 'requisito', 'marco'],
    substituto: 'xp soma em sim.json.progresso.xp; liberado(id) → true; requisito guarda; marco() pelos limiares da D51',
  },
  agregados: { dono: 'S2a', funcoes: [], substituto: 'soma moradores e empregos da tabela de prédios a cada rodada' },
  economia: { dono: 'S3a', funcoes: [], substituto: 'a cada tique recebe a contribuição (moradores x tarifa por hora) e paga os custos registrados' },
});

/**
 * Registros do contrato interno (todos no objeto sim):
 *   sim.custos.registrar(nome, fn → créditos por hora de jogo)     S1b (vias), S2a (serviços, ligação); S3a soma e paga (D41)
 *   sim.holding.pagar(valor, categoria) → bool; .receber(valor, categoria); .comprarParaObra(ref, nivel, materiais) → { espera }
 *   sim.holding.entregar({ item, n, origem, destino, aoChegar, visual }) → id;  .efeito(id, { produtividade, caminhoes })
 *   sim.progresso.xp(n, motivo); .liberado(id) → bool; .requisito(marco, fn)
 *   sim.redes.produtor({ tipo: 'agua' | 'energia', ref, capacidade, no }) → id     S2a; X1b registra o reservatório
 *   sim.formas.registrar({ tipo: 'via' | 'plataforma' | 'cava', ref, contorno | eixo, meiaLargura?, cota }) → id   (D5)
 *   sim.colocaveis.registrar(tipo, def)                                S2a (serviços), S3a (Holding): um só comando construir
 *   sim.camadas.registrar(id, fn);  sim.avisos.registrar(codigo, fn)   cada domínio os seus
 *   sim.travessia.registrar(fn)                                        X4 (M1b): validar() de S1b pergunta se vira ponte
 */
export const REGISTROS = congelar([
  'custos', 'holding', 'progresso', 'redes', 'formas', 'colocaveis', 'camadas', 'avisos', 'travessia',
]);

/**
 * Faixas de ordem dos sistemas no tique (registrarSistema(..., { ordem })): dentro da mesma faixa vale a ordem de
 * registro, que é a do índice fixo em fonte/sim/estado.js.
 */
export const ORDEM = congelar({
  tarefas: 0, // resultados do worker entram antes de tudo (o núcleo faz)
  mundo: 100, // terreno, aplainar, floresta, ladrilhos
  vias: 200, // obras de via, blocos, células
  zonas: 300, // demanda e crescimento
  cidade: 400, // prédios, cidadãos, bem-estar
  servicos: 500, // cobertura e redes
  transito: 600,
  economia: 700, // receitas e pagamentos na ordem da D41
  holding: 800, // produção, mercado, logística
  arcologia: 900,
  progresso: 1000, // XP, marcos, objetivos, história
  agregados: 1100, // substituto da F0
});

/**
 * Formas do aplainar (D5), registradas em sim.formas:
 * @typedef {object} Forma
 * @property {'via' | 'plataforma' | 'cava'} tipo
 * @property {number} ref            ref da coisa dona (aresta, prédio, etapa); desempate depois da distância e do tipo
 * @property {Float64Array} [contorno] polígono x, z (plataforma e cava)
 * @property {number} [cota]          cota do núcleo (plataforma e cava), já com o desconto da pista quando houver
 * @property {Float64Array} [eixo]    via: triplas x, z, y ao longo do eixo (a cota do núcleo vem do y interpolado)
 * @property {number} [meiaLargura]   via: meia largura do núcleo, em metros
 */
export const FORMA = congelar({ faixaPlana: 8, transicao: 16, ordemTipo: { via: 0, plataforma: 1, cava: 2 } });
