// Modelos dos prédios colocáveis (D60, R5): os serviços da S2a (data/servicos.js) e os prédios da Holding da S3a
// (data/holding.js). Para cada tipo: a família, a parte do jogo, o modelo em palavras, a referência real (a folha do
// prédio mostra "Inspirado em ..."), a pegada (a mesma planta da simulação, [frente, fundo] em metros), a altura
// aproximada (seleção e corte da obra antes de a malha chegar) e os tetos de triângulos do LOD0 (Média e Ultra) e do
// LOD1, da tabela da ficha R5. Só dados: os geradores em render/colocaveis/ desenham pela semente.
import { congelar } from '../comum/util.js';
import { SERVICOS, SERVICOS_ORDEM } from './servicos.js';
import { PREDIOS_HOLDING, HOLDING_ORDEM } from './holding.js';
import { TIPO_PREDIO } from '../contratos/flags.js';

/** Uma linha da tabela: tetos em triângulos [Média, Ultra, LOD1]. */
function linha(familia, modelo, referencia, altura, [media, ultra, lod1]) {
  return { familia, modelo, referencia, altura, tris: { media, ultra, lod1 } };
}

const TABELA = {
  // serviços do M1a
  captacao: linha('servico', "tomada d'água com comportas, passarela e teto verde na margem", 'Marina Barrage (Singapura)', 15, [3000, 8000, 300]),
  poco: linha('servico', "casa de bombas com cobogó e caixa d'água em torre", "torres d'água modernistas brasileiras, como a de Olinda", 25, [1500, 4000, 150]),
  solar: linha('servico', 'campo de painéis com rastreadores e prédio de controle', 'complexo solar de Pirapora (MG) e o prédio de controle de Noor Ouarzazate', 9, [4000, 10000, 200]),
  praca: linha('servico', 'pedra portuguesa em ondas, bancos e ipês', 'calçadão de Copacabana, de Burle Marx', 11, [2000, 5000, 100]),
  clinica: linha('servico', 'pavilhão baixo com sheds curvos e jardim interno', 'hospitais da Rede Sarah, de Lelé', 12, [3000, 8000, 250]),
  escolaF: linha('servico', "bloco didático longo sobre pilotis, quadra coberta e caixa d'água em torre", 'CEU de São Paulo', 30, [4000, 10000, 300]),
  delegacia: linha('servico', 'lâmina sobre pilotis com brise-soleil', 'Palácio Capanema (Rio)', 30, [3000, 8000, 250]),
  bombeiros: linha('servico', 'volumes em cunha de concreto com marquise em balanço', 'Vitra Fire Station, de Zaha Hadid', 18, [3000, 8000, 250]),
  // serviços do M1b (prontos nos dados; a S2b liga)
  ete: linha('servico', 'ovos digestores de aço e tanques redondos', 'ovos digestores de Newtown Creek (Nova York)', 26, [5000, 12000, 400]),
  termica: linha('servico', 'caixa de alumínio em degraus com rampa verde no teto e chaminé', 'CopenHill (Copenhague)', 70, [5000, 12000, 400]),
  escolaM: linha('servico', 'dois blocos com passarela e pátio coberto', 'CEU com os blocos escolares da FDE', 30, [5000, 12000, 400]),
  parque: linha('servico', 'marquise sinuosa, lago e gramado', 'marquise do Ibirapuera, de Niemeyer', 14, [4000, 10000, 300]),
  hospital: linha('servico', 'pódio de atendimento com sheds, jardim no meio e bloco de internação', 'Rede Sarah com o sanduíche de funções do Kampung Admiralty', 42, [8000, 20000, 600]),
  parqueG: linha('servico', 'aterro com jardins, palmeiras e pedra portuguesa', 'Aterro do Flamengo, de Burle Marx', 30, [6000, 15000, 400]),
  // prédios da Holding do M1a (com a cor da Holding)
  escritorioObra: linha('holding', 'canteiro de megaprojeto: contêineres empilhados, grua e galpão-armazém', 'canteiros de Hudson Yards (Nova York)', 46, [3000, 8000, 250]),
  pedreira: linha('holding', 'cava de granito em bancadas, britador e correias', 'pedreiras de brita reais, com bancadas, britador e correias', 22, [4000, 10000, 300]),
  areal: linha('holding', 'draga na margem e pilhas cônicas', 'areais de rio reais, com draga e pilhas cônicas', 12, [2000, 5000, 150]),
  olaria: linha('holding', 'fornos-túnel e chaminé de tijolo aparente', 'cerâmicas de tijolo reais, com forno-túnel e chaminé', 30, [3000, 8000, 250]),
  concreteira: linha('holding', 'silos, central dosadora e betoneiras', 'centrais de concreto usinado reais', 26, [3000, 8000, 250]),
  // M1b e linha de corte
  mina: linha('holding', 'cava clara de calcário em bancadas', 'minas de calcário reais em bancadas', 20, [3000, 8000, 250]),
  cimenteira: linha('holding', 'torre de ciclones, forno rotativo e silos', 'fábricas de cimento com pré-aquecedor de ciclones', 60, [6000, 15000, 450]),
  vidraria: linha('holding', 'galpão longo com forno float', 'fábricas de vidro float', 30, [3000, 8000, 250]),
  serraria: linha('holding', 'galpão e pátio de toras', 'serrarias reais com pátio de toras', 14, [3000, 8000, 250]),
  manejo: linha('holding', 'posto de manejo na mata', 'postos de manejo florestal na mata', 10, [3000, 8000, 250]),
};

/** Planta e parte de cada tipo: as da simulação (uma fonte só). */
function completar(id, l) {
  const def = l.familia === 'servico' ? SERVICOS[id] : PREDIOS_HOLDING[id];
  if (!def) throw new Error(`colocável sem definição na simulação: ${id}`);
  return { ...l, nome: def.nome, pegada: [def.planta[0], def.planta[1]], parte: def.parte ?? 'M1a' };
}

/**
 * Colocáveis por tipo (o id da simulação): { familia: 'servico' | 'holding', nome, parte, modelo, referencia,
 * pegada: [frente, fundo] (m), altura (m), tris: { media, ultra, lod1 } }.
 */
export const COLOCAVEIS = congelar(Object.fromEntries(Object.entries(TABELA).map(([id, l]) => [id, completar(id, l)])));

/** Ordem fixa dos tipos (o índice vai no pedido à oficina). Só se acrescenta no fim. */
export const COLOCAVEIS_ORDEM = Object.freeze(Object.keys(COLOCAVEIS));

/**
 * Detalhe do LOD0 por perfil (porPerfil: o 'pc' herda do Alta): 'ultra' usa a coluna Ultra da tabela (medido na
 * bancada aberta do 'pc', dentro das 800 chamadas e 2,5 milhões de triângulos); 'media' a coluna Média.
 */
export const DETALHE_COLOCAVEIS = congelar({ ultra: 'ultra', alta: 'ultra', media: 'media', leve: 'media' });

/** O tipo (id) do colocável pelo tipo do prédio no espelho e pelo modelo; null se não for colocável. */
export function tipoColocavel(tipoPredio, modelo) {
  if (tipoPredio === TIPO_PREDIO.SERVICO) return SERVICOS_ORDEM[modelo] ?? null;
  if (tipoPredio === TIPO_PREDIO.HOLDING) return HOLDING_ORDEM[modelo] ?? null;
  return null;
}

/** Teto de triângulos do LOD0 de um tipo no detalhe ('media' | 'ultra'), ou do LOD1. */
export function tetoTris(tipo, detalhe = 'media', lod = 0) {
  const t = COLOCAVEIS[tipo]?.tris;
  if (!t) return 0;
  return lod === 1 ? t.lod1 : detalhe === 'ultra' ? t.ultra : t.media;
}
