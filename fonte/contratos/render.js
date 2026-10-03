// API do render usada pela UI e pelo app (seção 2.7), só como tipos e listas: a implementação é de fonte/render/.
// A UI nunca toca em objetos do three. Ângulos da câmera em graus.
import { congelar } from '../comum/util.js';

/**
 * @typedef {object} EstadoCamera
 * @property {number} x          alvo no chão (metros)
 * @property {number} z
 * @property {number} dist       distância do alvo, 10 a 9.000 m
 * @property {number} guinada    graus; 0 = olhando para o norte (-z), cresce no sentido horário visto de cima
 * @property {number} inclinacao graus acima do horizonte, 3 a 88
 */

/**
 * @typedef {object} Selecao    resposta de R.selecionar(xTela, yTela)
 * @property {'marcador' | 'predio' | 'colocavel' | 'aresta' | 'terreno' | 'agua' | 'arcologia'} tipo
 * @property {number} [ref]
 * @property {number} [idx]
 * @property {number[]} ponto    [x, y, z]
 */

/**
 * @typedef {object} StatsRender  R.stats: soma de TODOS os passes do quadro (autoReset desligado, zerado no começo)
 * @property {number} calls
 * @property {number} tris
 * @property {number} callsSombra
 * @property {number} trisSombra
 * @property {number} passes
 * @property {number} ms
 * @property {number} qps
 * @property {number} p95
 * @property {number} gpuMs          por fenceSync
 * @property {number} pr             razão de pixels
 * @property {number} msaa
 * @property {string} perfil
 * @property {Record<string, number>} familias   triângulos por família (FAMILIAS)
 * @property {number} pxPorTri
 * @property {{ calls: number, tris: number, ms: number }} pior   janela de 120 quadros
 * @property {{ lod0: number, anexos: number, fila: number, msEnvio: number }} setores
 * @property {{ predios: number, arvores: number, carros: number, pessoas: number, marcadores: number }} instancias
 * @property {{ geometriaMB: number, texturasMB: number, programas: number }} memoria
 * @property {{ clipControl: boolean, multiDraw: boolean, timer: boolean, limites: object }} capac
 * Campos do motor (R1a e PC1, D66), fora do statsVazio (o render falso não precisa deles):
 * @property {number} [gpuMsTimer]   ms de placa pelo cronômetro (EXT_disjoint_timer_query_webgl2)
 * @property {Record<string, number>} [gpuPasses]  ms médios de placa por passe (sombra, preparo, ceu, terreno, agua,
 *   predios, colocaveis, arvores, vias, vida, arcologia, resto, pos, outros)
 * @property {number} [gpuQuadros]    quadros na média de gpuPasses
 * @property {{ programas: number, depois: number, nomes: string[] }} [compilacoes]  depois: compilados depois do
 *   aquecimento (soluço no jogo)
 * @property {{ estado: 'espera' | 'aquecendo' | 'pronto', rodadas: number, ms: number, msThread: number,
 *   programas: number, fontes: number, grupos: object[] } | null} [aquecimento]
 * @property {{ w: number, h: number, pr: number, nominal: number, escala: number, nativa: number,
 *   modo: 'fixa' | 'cronometro' | 'quadro', alvoGpu: number, cas: boolean, trocas: number, ultimaTroca: object } | null} [resolucao]
 * memoria também traz videoMB, texturasGpuMB, alvosMB, buffersMB e telaMB (estimados pelo que o WebGL aloca).
 */

/**
 * Métodos do objeto R (criarRender(canvas, { sim: { espelho, mudancas }, qualidade, semClip })). Caminho: assinatura.
 * O render-falso da vitrine implementa todos com o mesmo formato.
 */
export const API_RENDER = congelar({
  quadro: '(tMs) lê o diário e desenha',
  'camera.irPara': '(EstadoCamera parcial, ms) → Promise',
  'camera.estado': '() → EstadoCamera',
  'camera.definir': '(EstadoCamera)',
  'entrada.modo': "('camera' | 'ferramenta')",
  'entrada.aoFerramenta': "(fn({ fase: 'inicio' | 'move' | 'fim', x, y, ponto, dedos }))",
  'entrada.opcoes': '({ deslocY: 56, bordaPx: 48 })',
  selecionar: '(xTela, yTela) → Selecao | null',
  projetar: '([x, y, z]) → { x, y, visivel, dist, frente, prof } (frente: além do plano próximo, mesmo fora da tela; prof: distância no eixo da câmera, negativa atrás)',
  raio: '(xTela, yTela) → [x, y, z] | null (sobre alturaEm)',
  ancoras: '(lista) → posições de tela (a forma de projetar; até 40 com a oclusão pelo relevo, domínio ancoras)',
  'camadas.mostrar': '({ id, fonte, dados, grade, cores, min, max, categorico, porPredio?: { dados, categorico, min, max } })',
  'camadas.ocultar': '()',
  'ferramenta.via.previa': "(plano, 'normal' | 'invalido' | 'sugestao')",
  'ferramenta.zona.mostrar': '(bool)',
  'ferramenta.zona.celulas': '(Int32Array, zona)',
  'ferramenta.pincel': '({ x, z, raio })',
  'ferramenta.ladrilhos': '(bool)',
  'ferramenta.fantasma': '({ tipo, x, z, rot, alcance, ok })',
  'ferramenta.demolir': '(refs)',
  'ferramenta.limpar': '()',
  'marcadores.atlas': '(canvas, mapa)',
  'marcadores.definir': '([{ idx, glifo, gravidade, prioridade }])',
  selecionado: "({ tipo: 'predio' | 'colocavel' | 'marcador' | 'aresta' | 'arcologia', ref } | ref | null) (só a ref vale como prédio; o marcador acende o prédio dele)",
  'tempo.forcar': '({ fase } | null)',
  sempreDia: '(bool)',
  estado: "('livre' | 'coberto' | 'foto' | 'teste')",
  qualidade: '(id)',
  perfil: '() → { id, sugerido, capac }',
  resolucao: "({ dinamica?: bool, nitidez?: 'auto' | 'desligada' }) → { dinamica, nitidez } (preferência do jogador: a dinâmica desligada trava no nominal do perfil, a nitidez desligada tira o CAS)",
  aquecido: '() → Promise<relatório do aquecimento> (os programas compilados na carga, D66; o app segura a tela de carga até ela)',
  stats: 'StatsRender (propriedade)',
  bancada: '() → Promise<{ perfil, sugerido, motivo, msMedio, p95, qps, calls, tris, pior, gpuMs, gpuPasses, gpuQuadros, familias, resolucao, memoria, aquecimento, compilacoes, programas: [{ nome, amostradores: { v, f }, varyings, uniformesF, atributos, msCompilar, msBloqueio }], capac }>',
  capa: '(640, 288) → Promise<Blob>',
  foto: '({ w, h }) → Promise<Blob>',
  voo: '(alvo) → Promise',
});

/** Registros do render (D45), criados pela F0 em fonte/render/. */
export const REGISTROS_RENDER = congelar([
  'registrarTextura(nome, gerador)',
  'registrarGeradorOficina(tipo, modulo)',
  'registrarSelecionavel(dominio, fn)',
  'registrarDominio(nome, modulo)',
  'registrarCena(nome, modulo)',
  'ganchos.definir(nome, glsl)',
]);

/** Ganchos GLSL comuns (nomes estáveis; R1a publica os uniformes). */
export const GANCHOS = congelar(['neblina', 'sombra', 'sombraLonge', 'hao', 'camada', 'noite', 'selecao', 'mascara']);

/** Tipos de trabalho da oficina (worker de malhas). */
export const TIPOS_OFICINA = congelar(['setor', 'anexo', 'vias', 'arvores', 'fora', 'colocavel', 'alturasCidade']);

/**
 * Mensagens do worker `oficina` (2.8): o despachante (render/mundo/oficina.worker.js) chama o gerador registrado por
 * registrarGeradorOficina(tipo, modulo). A thread principal envia no máximo um setor e um anexo por quadro.
 */
export const MENSAGENS_OFICINA = congelar({
  pedido: '{ id, tipo, chave, dados }',
  resposta: '{ id, chave, malhas: [{ material, atributos /* quantizados: posição Int16, normal 2 x Int8, uv Half, aId Uint32, AO Uint8 */, indices }] } | { id, chave, grade: Float32Array } (alturasCidade)',
});

/**
 * Perfis de qualidade (D33, D66), do mais pesado ao mais leve. O 'pc' é o PC do dono (Radeon RX 550 em 1080p nativo,
 * resolução dinâmica pelo cronômetro da placa) e herda do Alta as tabelas dos domínios (porPerfil); o Poco X7 cai no
 * Média pela regra Mali-G6xx MC2.
 */
export const PERFIS = congelar(['ultra', 'alta', 'pc', 'media', 'leve']);

/** Famílias de R.stats.familias. */
export const FAMILIAS = congelar(['terreno', 'predios', 'colocaveis', 'arvores', 'vias', 'vida', 'arcologia', 'sombra', 'resto']);

/**
 * Teto da família 'arcologia' no quadro (D63 a D66): de perto (cenas torre e planos, a sede v2 inteira no LOD0), por
 * perfil, e na vista aberta (tudo no LOD1), no Alta e no 'pc'. No Média a vista aberta segue a 4.8 (60 mil); de perto
 * dá cerca de 75 mil (medido pela SEDE2).
 */
export const TETO_ARCOLOGIA = congelar({ perto: { ultra: 250000, alta: 250000, pc: 250000, media: 90000 }, aberta: 60000 }); // aberta: 60 mil com a sede v3 (D88 a D90)

/**
 * Orçamento gráfico do pior quadro de 120 (A6 e 4.8). Os tetos por família valem no Média e no 'pc' (bancada aberta);
 * resto = água, props, obras e marcadores. O Alta usa os números do Ultra até a R1a medir. O 'pc' (D66, PC do dono):
 * 800 chamadas e 2,5 milhões de triângulos na vista aberta com a cidade grande, 2,5 GB de vídeo; tetos por família
 * provisórios até a bancada no PC dele (calibrar), com a soma dentro dos 2,5 milhões.
 */
export const ORCAMENTO = congelar({
  ultra: { calls: 1500, tris: 5000000 },
  alta: { calls: 1500, tris: 5000000 },
  pc: {
    calls: 800,
    tris: 2500000,
    alvoTris: 1720000,
    videoMB: 2560,
    geometriaMB: 512,
    familias: {
      terreno: { calls: [1, 3], alvo: 200000, teto: 240000 },
      predios: { calls: [40, 90], alvo: 750000, teto: 950000, nota: 'LOD0 até 600 m, anexos, LOD1 e LOD2' },
      colocaveis: { calls: [8, 20], alvo: 60000, teto: 90000 },
      arvores: { calls: [14, 24], alvo: 220000, teto: 300000 },
      vias: { calls: [30, 60], alvo: 150000, teto: 200000 },
      vida: { calls: [10, 16], alvo: 50000, teto: 80000 },
      arcologia: { calls: [20, 40], alvo: 30000, teto: 60000, nota: 'LOD1 na vista aberta com a sede v3; de perto até 250 mil (TETO_ARCOLOGIA)' },
      sombra: { calls: [20, 60], alvo: 200000, teto: 300000, nota: 'callsSombra e trisSombra, 2 cascatas' },
      resto: { calls: [30, 50], alvo: 60000, teto: 110000, nota: 'água, props, obras e marcadores; chamadas com céu e pós' },
    },
  },
  media: {
    calls: 300,
    tris: 900000,
    alvoTris: 620000,
    geometriaMB: 64,
    familias: {
      terreno: { calls: [1, 2], alvo: 100000, teto: 120000 },
      predios: { calls: [16, 28], alvo: 210000, teto: 240000 },
      colocaveis: { calls: [4, 8], alvo: 25000, teto: 40000 },
      arvores: { calls: [10, 13], alvo: 80000, teto: 110000 },
      vias: { calls: [15, 25], alvo: 70000, teto: 90000 },
      vida: { calls: [8, 10], alvo: 25000, teto: 40000 },
      arcologia: { calls: [10, 15], alvo: 25000, teto: 60000, nota: '40 mil em LOD1 e até 20 mil do LOD0 da Torre de perto; de perto até 90 mil (TETO_ARCOLOGIA)' },
      sombra: { calls: [8, 15], alvo: 40000, teto: 60000, nota: 'callsSombra e trisSombra' },
      resto: { calls: [23, 28], alvo: 39000, teto: 85000, nota: 'água 20 mil, props 30 mil, obras 15 mil, marcadores 20 mil; chamadas com céu e pós' },
    },
  },
  leve: { calls: 200, tris: 500000 },
});

/** Guarda do Mali (D44): a bancada falha acima destes números por programa compilado; nenhum mediump. */
export const GUARDA_MALI = congelar({ amostradoresPorEstagio: 12, varyings: 12, uniformesF: 200, atributos: 14 });

/** Cenas fixas da bancada (?cena=nome) e as parcelas donas. */
export const CENAS = congelar({
  aberta: 'R1a', horizonte: 'R1a', noite: 'R1a', estresse: 'R1a', 'prova-sombra': 'F0 (R1a herda)',
  costa: 'R2a', materiais: 'R2a', rua: 'R3a', bairro: 'R4a', obra: 'R4b', servicos: 'R5', torre: 'X1a', planos: 'X1a',
  ferramentas: 'X2', camadas: 'X3a',
});

/** R.stats vazio (formato de partida para o render-falso e a bancada). */
export function statsVazio() {
  return {
    calls: 0, tris: 0, callsSombra: 0, trisSombra: 0, passes: 0, ms: 0, qps: 0, p95: 0, gpuMs: 0, pr: 1, msaa: 0, perfil: 'media',
    familias: Object.fromEntries(FAMILIAS.map((f) => [f, 0])), pxPorTri: 0,
    pior: { calls: 0, tris: 0, ms: 0 }, setores: { lod0: 0, anexos: 0, fila: 0, msEnvio: 0 },
    instancias: { predios: 0, arvores: 0, carros: 0, pessoas: 0, marcadores: 0 },
    memoria: { geometriaMB: 0, texturasMB: 0, programas: 0 },
    capac: { clipControl: false, multiDraw: false, timer: false, limites: {} },
  };
}
