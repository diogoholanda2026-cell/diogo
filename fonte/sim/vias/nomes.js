// Nomes das ruas e avenidas (dona: S1b): um nome por traço, que passa para as metades quando a via se divide e para
// o trecho que continua em linha reta a partir da ponta de uma via. O prefixo sai do tipo (Rua, Avenida, Rodovia), então
// melhorar uma rua para avenida troca "Rua das Palmeiras" por "Avenida das Palmeiras". As vias do mapa (Vila e rodovia)
// têm nomes fixos. O número fica na coluna `nomeVia` das arestas (0: sem nome, "Rua Projetada" com o número da vaga).
import { refDe, idxDaRef, gerDaRef } from '../../contratos/espelho.js';
import { ARESTA } from '../../contratos/flags.js';
import { VIAS_ORDEM } from '../../data/vias.js';

/** Nomes das ruas novas (sem o prefixo do tipo). Sem a palavra que some da interface (D42). */
export const BANCO_NOMES = Object.freeze([
  'das Palmeiras', 'dos Ipês', 'das Acácias', 'dos Oitis', 'das Mangueiras', 'dos Jacarandás', 'das Paineiras',
  'dos Flamboyants', 'das Quaresmeiras', 'dos Jequitibás', 'das Bromélias', 'das Orquídeas', 'das Hortênsias',
  'dos Girassóis', 'das Gaivotas', 'dos Sabiás', 'dos Bem-te-vis', 'das Garças', 'dos Guarás', 'das Andorinhas',
  'do Farol', 'da Enseada', 'do Mirante', 'da Pedreira', 'do Porto', 'da Restinga', 'das Dunas', 'dos Coqueiros',
  'da Lagoa', 'do Rio Held', 'da Serra', 'do Horto', 'Atlântica', 'Beira-Mar', 'do Sol Nascente', 'da Aurora',
  'Cruzeiro do Sul', 'Sete de Setembro', 'Quinze de Novembro', 'Tiradentes', 'Rio Branco', 'Santos Dumont',
  'Marechal Rondon', 'Anita Garibaldi', 'Princesa Isabel', 'Castro Alves', 'Machado de Assis', 'Carlos Gomes',
  'Villa-Lobos', 'Tom Jobim', 'Vinicius de Moraes', 'Cecília Meireles', 'Clarice Lispector', 'Cora Coralina',
  'Rachel de Queiroz', 'Oscar Niemeyer', 'Lúcio Costa', 'Burle Marx', 'Lina Bo Bardi', 'Candido Portinari',
  'Tarsila do Amaral', 'Anita Malfatti', 'Di Cavalcanti', 'Chiquinha Gonzaga', 'Pixinguinha', 'Cartola',
  'Dorival Caymmi', 'Guimarães Rosa', 'Carlos Drummond', 'Manuel Bandeira', 'Monteiro Lobato', 'Oswaldo Cruz',
  'Vital Brazil', 'Carlos Chagas', 'Adolpho Lutz', 'César Lattes', 'Bartolomeu de Gusmão', 'dos Navegantes',
  'dos Pescadores', 'das Rendeiras', 'dos Tropeiros', 'dos Imigrantes', 'da Liberdade', 'da Esperança',
  'da Harmonia', 'da Amizade', 'da Paz', 'das Flores', 'das Pitangueiras', 'dos Cajueiros', 'das Jabuticabeiras',
  'dos Araçás', 'das Goiabeiras', 'dos Jambeiros', 'das Figueiras', 'dos Cedros', 'das Aroeiras', 'dos Manacás',
  'das Embaúbas', 'dos Tucanos', 'dos Colibris', 'das Araras', 'dos Periquitos', 'das Maritacas', 'dos Beija-flores',
  'das Corujas', 'das Ostras', 'das Conchas', 'dos Corais', 'das Marés', 'dos Ventos', 'das Estrelas', 'da Lua Cheia',
  'do Arco-Íris', 'das Cachoeiras', 'das Nascentes', 'do Vale', 'da Colina', 'do Outeiro', 'da Ladeira', 'do Recanto',
  'do Pontal', 'da Barra', 'da Ponta', 'do Cais', 'da Marina', 'do Mercado', 'da Matriz', 'da Capela', 'do Rosário',
  'da Glória', 'São Pedro', 'São Jorge', 'Santa Luzia', 'Santo Antônio', 'São Francisco', 'Bom Jesus',
  'dos Operários', 'dos Artesãos', 'dos Ferroviários', 'dos Estivadores', 'das Lavadeiras', 'dos Seringueiros',
  'Frei Caneca', 'Joaquim Nabuco', 'André Rebouças', 'Luiz Gama', 'Maria Quitéria', 'Bárbara de Alencar',
  'Nísia Floresta', 'Bertha Lutz', 'Zilda Arns', 'Irmã Dulce', 'Chico Mendes', 'Cândido Rondon',
]);

/** Nomes das vias do mapa (inteiros, sem prefixo): o número é BANCO_NOMES.length + 1 + a posição aqui. */
export const NOMES_DO_MAPA = Object.freeze({
  principal: 'Rua Santa Cida',
  praia: 'Rua da Praia',
  deCima: 'Rua de Cima',
  travessaNorte: 'Travessa do Norte',
  travessaSul: 'Travessa do Sul',
  estrada: 'Estrada da Vila',
  rodovia: 'Rodovia BR-Held',
  acesso: 'Acesso Norte',
  arcologia: 'Alameda da Arcologia',
});
const IDS_MAPA = Object.keys(NOMES_DO_MAPA);
const BASE_MAPA = BANCO_NOMES.length + 1;

/** Número do nome de uma via do mapa. */
export const nomeDoMapa = (id) => BASE_MAPA + IDS_MAPA.indexOf(id);

const PREFIXO = { rua: 'Rua', ruaMao: 'Rua', avenida: 'Avenida', avenidaG: 'Avenida', rodovia: 'Rodovia', terra: 'Rua' };

/** Nome por extenso da aresta e. */
export function nomeDaAresta(sim, e) {
  const A = sim.tabelas.arestas;
  const k = A.nomeVia ? A.nomeVia[e] : 0;
  const tipo = VIAS_ORDEM[A.tipo[e]];
  if (k >= BASE_MAPA && k < BASE_MAPA + IDS_MAPA.length) return NOMES_DO_MAPA[IDS_MAPA[k - BASE_MAPA]];
  if (A.flags[e] & ARESTA.ARCOLOGIA) return NOMES_DO_MAPA.arcologia;
  if (k >= 1 && k <= BANCO_NOMES.length) return `${PREFIXO[tipo] ?? 'Rua'} ${BANCO_NOMES[k - 1]}`;
  return `${PREFIXO[tipo] ?? 'Rua'} Projetada ${e + 1}`;
}

/** Próximo nome da sequência da partida (passo 37 pelo banco, que é primo com o tamanho: todos saem antes de repetir). */
export function proximoNome(sim) {
  const J = sim.json.vias;
  const n = BANCO_NOMES.length;
  const k = ((J.nome * 37) % n) + 1;
  J.nome++;
  return k;
}

/** Dá nome às arestas criadas: o `herdado` (a via da qual o traço continua) ou o próximo da sequência. */
export function nomearTraco(sim, arestas, herdado = 0) {
  const A = sim.tabelas.arestas;
  if (!A.nomeVia || !arestas.length) return 0;
  const k = herdado || proximoNome(sim);
  for (const e of arestas) {
    A.nomeVia[e] = k;
    A.marcar(e);
  }
  return k;
}

/** Nome das vias do mapa (Vila e rodovia), pelas refs que o mapa guardou em sim.json.mapa. */
function nomearMapa(sim) {
  const A = sim.tabelas.arestas;
  const M = sim.json.mapa;
  if (!M) return;
  const por = (ref, id) => {
    const e = idxDaRef(ref);
    if (e < A.n && A.viva[e] && A.ger[e] === gerDaRef(ref)) A.nomeVia[e] = nomeDoMapa(id);
  };
  for (const [id, refs] of Object.entries(M.ruas ?? {})) if (IDS_MAPA.includes(id)) for (const r of refs) por(r, id);
  for (const r of M.rodovia ?? []) por(r, 'rodovia');
  for (const r of M.acesso ?? []) por(r, 'acesso');
}

export function registrar(sim) {
  const A = sim.tabelas.arestas;
  if (!A) return;
  if (!A.specs.nomeVia) A.novaColuna('nomeVia', Uint16Array);
  nomearMapa(sim);
}

export { refDe };
