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
  projetar: '([x, y, z]) → { x, y, visivel, dist }',
  raio: '(xTela, yTela) → [x, y, z] | null (sobre alturaEm)',
  ancoras: '(lista) → posições de tela',
  'camadas.mostrar': '({ fonte, dados, grade, cores, min, max, categorico })',
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
  selecionado: '(ref | null)',
  'tempo.forcar': '({ fase } | null)',
  sempreDia: '(bool)',
  estado: "('livre' | 'coberto' | 'foto' | 'teste')",
  qualidade: '(id)',
  perfil: '() → { id, sugerido, capac }',
  stats: 'StatsRender (propriedade)',
  bancada: '() → Promise<{ perfil, sugerido, msMedio, p95, qps, calls, tris, pior, gpuMs, familias, programas: [{ nome, amostradores: { v, f }, varyings, uniformesF, atributos, msCompilar }], capac }>',
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

/** Perfis de qualidade (D33): o Poco X7 cai no Média pela regra Mali-G6xx MC2. */
export const PERFIS = congelar(['ultra', 'alta', 'media', 'leve']);

/** Famílias de R.stats.familias. */
export const FAMILIAS = congelar(['terreno', 'predios', 'colocaveis', 'arvores', 'vias', 'vida', 'arcologia', 'sombra', 'resto']);

/**
 * Orçamento gráfico do pior quadro de 120 (A6 e 4.8). Os tetos por família valem no Média (bancada aberta); resto =
 * água, props, obras e marcadores. O Alta usa os números do Ultra até a R1a medir.
 */
export const ORCAMENTO = congelar({
  ultra: { calls: 1500, tris: 5000000 },
  alta: { calls: 1500, tris: 5000000 },
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
      arcologia: { calls: [10, 15], alvo: 25000, teto: 60000, nota: '40 mil em LOD1 e até 20 mil do LOD0 da Torre de perto' },
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
