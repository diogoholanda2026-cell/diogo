// Objetivos (D58): 3 abertos por vez, um da cidade, um da Holding e um da Arcologia, tirados do estado (dona: S3a).
// Em cada domínio vale o primeiro da lista que ainda não foi feito e que já pode abrir (`marco`, `requer`); o último de
// cada lista é contínuo (refeito pelo estado, nunca acaba), então sempre há um aberto. A conta de cada `medida` fica em
// fonte/sim/objetivos.js; o texto é 's3.objetivo.<id>' com os parâmetros da medida.
//
// Formato: { id, dominio, quem, medida, total?, marco?, requer? (marca de decisão, ou lista: vale uma delas), parte?
//            ('M1b': só com o M1b no jogo), aoCumprir? (o que acontece ao cumprir, em sim/objetivos.js), recompensa: { xp,
//            creditos, legado? }, alvo?: 'sugestao:<id>' | 'tela:<id>' | 'ferramenta:<id>' }
import { congelar } from '../comum/util.js';

export const OBJETIVOS = /* @__PURE__ */ congelar([
  // cidade
  { id: 'cidade.avenida', dominio: 'cidade', quem: 'iris', medida: 'rodoviaGleba', total: 1, recompensa: { xp: 40, creditos: 0 }, alvo: 'sugestao:avenida' },
  { id: 'cidade.captacao', dominio: 'cidade', quem: 'cida', medida: 'servico:captacao', total: 1, requer: 'vila.agua:captacao', recompensa: { xp: 30, creditos: 0 }, alvo: 'sugestao:captacao' },
  { id: 'cidade.agua', dominio: 'cidade', quem: 'cida', medida: 'redeAgua', total: 1, recompensa: { xp: 30, creditos: 0 }, alvo: 'sugestao:captacao' },
  { id: 'cidade.energia', dominio: 'cidade', quem: 'caio', medida: 'redeEnergia', total: 1, recompensa: { xp: 30, creditos: 0 }, alvo: 'sugestao:usina' },
  // C1a: a Vila na rede logo depois da primeira avenida (o começo não pune: as casas das ruas de terra ficam sem água
  // nem energia, e a demanda residencial nasce perto de 0), e a rede da Vila até a primeira quadra antes de zonear
  { id: 'cidade.vila', dominio: 'cidade', quem: 'cida', medida: 'vilaNaRede', recompensa: { xp: 40, creditos: 0 }, total: 1, alvo: 'sugestao:vila' },
  { id: 'cidade.ligacao', dominio: 'cidade', quem: 'iris', medida: 'redeAte:quadra1', total: 1, recompensa: { xp: 20, creditos: 0 }, alvo: 'sugestao:ligacao' },
  { id: 'cidade.zonas', dominio: 'cidade', quem: 'iris', medida: 'celulasZoneadas', total: 300, recompensa: { xp: 20, creditos: 0 }, alvo: 'sugestao:quadra1' },
  { id: 'cidade.mil', dominio: 'cidade', quem: 'cida', medida: 'moradores', total: 1000, recompensa: { xp: 50, creditos: 5000 } },
  { id: 'cidade.saudeEducacao', dominio: 'cidade', quem: 'cida', medida: 'servicos:clinica,escolaF', total: 2, marco: 1, recompensa: { xp: 60, creditos: 5000 }, alvo: 'ferramenta:servicos' },
  { id: 'cidade.media', dominio: 'cidade', quem: 'iris', medida: 'celulasZona:resMedia', total: 200, marco: 2, recompensa: { xp: 40, creditos: 0 }, alvo: 'ferramenta:zonas' },
  { id: 'cidade.bemEstar', dominio: 'cidade', quem: 'cida', medida: 'bemEstar', total: 61, marco: 2, recompensa: { xp: 80, creditos: 10000 }, alvo: 'tela:cidade' },
  // S3b (M1b): o objetivo de Legado do Ato 1. A decisão vila.futuro o põe na frente; ao cumprir, a Holding requalifica a
  // Vila (as casas de autoconstrução passam ao padrão alto da D95)
  {
    id: 'cidade.vilaNova', dominio: 'cidade', quem: 'cida', medida: 'vilaNova', total: 3, marco: 3, parte: 'M1b',
    requer: ['vila.futuro:reformar', 'vila.futuro:substituir'], aoCumprir: 'vilaNova',
    recompensa: { xp: 120, creditos: 0, legado: 8 }, alvo: 'tela:cidade',
  },
  { id: 'cidade.marco', dominio: 'cidade', quem: 'iris', medida: 'xpMarco', recompensa: { xp: 0, creditos: 0 }, alvo: 'tela:progresso' },

  // Holding
  { id: 'holding.escritorio', dominio: 'holding', quem: 'tome', medida: 'holding:escritorioObra', total: 1, recompensa: { xp: 20, creditos: 0 }, alvo: 'sugestao:escritorio' },
  { id: 'holding.pedreiraAreal', dominio: 'holding', quem: 'tome', medida: 'linhasAuto:pedreira,areal', total: 2, recompensa: { xp: 40, creditos: 0 }, alvo: 'sugestao:pedreira' },
  { id: 'holding.olaria', dominio: 'holding', quem: 'tome', medida: 'holding:olaria', total: 1, marco: 1, recompensa: { xp: 30, creditos: 0 }, alvo: 'sugestao:olaria' },
  { id: 'holding.deposito', dominio: 'holding', quem: 'livia', medida: 'vendasDeposito', total: 1, recompensa: { xp: 20, creditos: 0 }, alvo: 'tela:holding.mercado' },
  { id: 'holding.concreteira', dominio: 'holding', quem: 'tome', medida: 'holding:concreteira', total: 1, marco: 3, recompensa: { xp: 40, creditos: 0 }, alvo: 'ferramenta:empresas' },
  // S3b (M1b): a cadeia do cimento, os vidros e os alimentos
  { id: 'holding.mina', dominio: 'holding', quem: 'tome', medida: 'holding:mina', total: 1, marco: 2, parte: 'M1b', recompensa: { xp: 30, creditos: 0 }, alvo: 'ferramenta:empresas' },
  { id: 'holding.cimenteira', dominio: 'holding', quem: 'tome', medida: 'holding:cimenteira', total: 1, marco: 2, parte: 'M1b', recompensa: { xp: 40, creditos: 0 }, alvo: 'ferramenta:empresas' },
  { id: 'holding.alimentos', dominio: 'holding', quem: 'cida', medida: 'holding:agroindustria', total: 1, marco: 3, parte: 'M1b', recompensa: { xp: 40, creditos: 0 }, alvo: 'ferramenta:empresas' },
  { id: 'holding.vidraria', dominio: 'holding', quem: 'tome', medida: 'holding:vidraria', total: 1, marco: 4, parte: 'M1b', recompensa: { xp: 40, creditos: 0 }, alvo: 'ferramenta:empresas' },
  { id: 'holding.estoque', dominio: 'holding', quem: 'tome', medida: 'estoqueEtapa', recompensa: { xp: 0, creditos: 0 }, alvo: 'tela:holding' },

  // Arcologia
  { id: 'arcologia.lago', dominio: 'arcologia', quem: 'iris', medida: 'etapaIniciada:lago.e1', total: 1, recompensa: { xp: 0, creditos: 0 }, alvo: 'tela:arcologia' },
  { id: 'arcologia.etapa', dominio: 'arcologia', quem: 'iris', medida: 'proximaEtapa', recompensa: { xp: 0, creditos: 0 }, alvo: 'tela:arcologia' },
]);

/** Domínios na ordem em que aparecem na barra (D58). */
export const DOMINIOS_OBJETIVO = Object.freeze(['cidade', 'holding', 'arcologia']);

/** Etapas do M1a na ordem (a Arcologia de verdade é da X1b; isto só guia o objetivo enquanto ela não publica). */
export const ETAPAS_M1A = Object.freeze(['lago.e1', 'torre.e1', 'torre.e2', 'torre.e3', 'torre.e4']);
