// Worker `oficina` (seção 2.8, D39, D45): despachante das malhas do render. Recebe { id, tipo, chave, dados } e chama o
// gerador registrado para o tipo; responde { id, chave, malhas: [{ material, atributos, indices }] } (ou { id, chave,
// grade } no 'alturasCidade') com os arrays transferidos, ou { id, chave, erro }.
//
// Os geradores moram nos arquivos das parcelas donas, em render/geracao/ (puros: sem three, sem DOM; a guarda de texto
// confere) e em render/colocaveis/index.js (R5). Cada um exporta registrar(api) e, aqui no worker, chama
// api.registrarGeradorOficina(tipo, modulo) com modulo = função(dados) ou { gerar(dados) }. Este índice é fixo: nenhuma
// parcela edita este arquivo. A thread principal (mundo/oficina.js, R4a) cria o worker pelo endereço de
// window.__HELD_MONTAGEM__.workers.oficina e manda no máximo um setor e um anexo por quadro.
// Tipos: os de TIPOS_OFICINA (fonte/contratos/render.js) e 'prova' (F0: uma caixa, para o teste e a página de teste).
import { TIPOS_OFICINA } from '../../contratos/render.js';
import { buffersDe } from '../../comum/util.js';
import * as ruido from '../geracao/ruido.js';
import * as arvores from '../geracao/arvores.js';
import * as impostor from '../geracao/impostor.js';
import * as perfilVia from '../geracao/perfilVia.js';
import * as malhaVia from '../geracao/malhaVia.js';
import * as cruzamento from '../geracao/cruzamento.js';
import * as planoPredio from '../geracao/planoPredio.js';
import * as malhaPredio from '../geracao/malhaPredio.js';
import * as fundir from '../geracao/fundir.js';
import * as quantizar from '../geracao/quantizar.js';
import * as ponte from '../geracao/ponte.js';
import * as colocaveis from '../colocaveis/index.js';
import * as campoAlturas from '../ambiente/campoAlturas.js';

/**
 * Índice fixo dos módulos que registram geradores. A figura de gente (geracao/pessoas.js, R3b) e os carros
 * (geracao/veiculos.js e veiculos-luxo.js, com registrar() vazio) não entram: rodam na thread principal, sob demanda
 * (mundo/pedestres.js e mundo/trafego.js), e aqui só pesariam no teto do worker.
 */
export const MODULOS_OFICINA = Object.freeze([
  ruido, arvores, impostor, perfilVia, malhaVia, cruzamento, planoPredio, malhaPredio, fundir, quantizar, ponte,
  colocaveis, campoAlturas,
]);

const TIPOS = new Set([...TIPOS_OFICINA, 'prova']);

/**
 * Caixa de prova (tipo 'prova'): { w, h, d } em metros, centrada no chão. Posição em Float32 (a de verdade é Int16
 * quantizada, D39), índices Uint16.
 */
export function geradorProva({ w = 10, h = 10, d = 10 } = {}) {
  const x = w / 2;
  const z = d / 2;
  const pos = new Float32Array([
    -x, 0, -z, x, 0, -z, x, h, -z, -x, h, -z, // trás
    -x, 0, z, x, 0, z, x, h, z, -x, h, z, // frente
  ]);
  const faces = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 3, 7, 6, 3, 6, 2, 0, 1, 5, 0, 5, 4];
  return { malhas: [{ material: 'prova', atributos: { posicao: pos }, indices: new Uint16Array(faces) }] };
}

/**
 * Cria o despachante: um registro de geradores e a função que responde uma mensagem. Serve ao worker de verdade e ao
 * Node (testes).
 * @returns {{ registrarGeradorOficina: Function, tipos: () => string[], responder: (msg) => { resposta, transferir } }}
 */
export function criarDespachante(modulos = MODULOS_OFICINA) {
  const geradores = new Map([['prova', geradorProva]]);
  function registrarGeradorOficina(tipo, modulo) {
    if (!TIPOS.has(tipo)) throw new Error(`oficina: tipo fora do contrato: ${tipo}`);
    const fn = typeof modulo === 'function' ? modulo : modulo?.gerar?.bind(modulo);
    if (typeof fn !== 'function') throw new Error(`oficina: gerador de ${tipo} sem função`);
    geradores.set(tipo, fn);
  }
  for (const m of modulos) m.registrar?.({ registrarGeradorOficina });
  function responder(msg) {
    const { id, tipo, chave } = msg ?? {};
    const fn = geradores.get(tipo);
    if (!fn) return { resposta: { id, chave, erro: `oficina: nenhum gerador para '${tipo}'` }, transferir: [] };
    try {
      const saida = fn(msg.dados ?? {});
      const resposta = { id, chave, ...saida };
      return { resposta, transferir: buffersDe(saida) };
    } catch (e) {
      return { resposta: { id, chave, erro: String(e?.message ?? e) }, transferir: [] };
    }
  }
  return { registrarGeradorOficina, responder, tipos: () => [...geradores.keys()] };
}

// dentro de um worker de verdade, liga sozinho
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  const d = criarDespachante();
  self.onmessage = (ev) => {
    const { resposta, transferir } = d.responder(ev.data);
    self.postMessage(resposta, transferir);
  };
}
