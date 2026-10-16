// Apoio dos testes do M1b (S2b): abre a parte, monta uma rua com água e energia, faz nascer prédios prontos e põe um
// serviço pronto numa posição (sem a margem do rio: a ETE e a captação pedem água a 40 m). Não é um teste.
import assert from 'node:assert/strict';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { noPerto } from '../../fonte/sim/vias/grafo.js';
import { refDe } from '../../fonte/contratos/espelho.js';
import { CELULA, TIPO_PREDIO } from '../../fonte/contratos/flags.js';
import { indiceZona, definirParteAtual } from '../../fonte/data/zonas.js';
import { SERVICOS, SERVICOS_ORDEM } from '../../fonte/data/servicos.js';
import { HOLDING_ORDEM, PREDIOS_HOLDING } from '../../fonte/data/holding.js';
import { nascerNaFrente, terminarObra } from '../../fonte/sim/zonas/crescimento.js';
import { trans } from '../../fonte/sim/predios.js';

/** Abre o M1b nesta execução (cada teste roda num processo à parte). Devolve a função que fecha. */
export function abrirM1b() {
  const antes = definirParteAtual('M1b');
  return () => definirParteAtual(antes);
}

/** Uma rua reta (480 m) a z = -480; com `redes`, água e energia de produtores registrados no nó oeste. */
export function ruaComRedes(semente, { redes = true, agua = 1000, energia = 1e6, modo = 'livre', pontos = [[-760, -480], [-280, -480]] } = {}) {
  const sim = criarSimulacao({ semente, modo });
  assert.ok(sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'rua', pontos, sessao: 1, encaixe: false } }).ok);
  const prod = {};
  if (redes) {
    const no = noPerto(sim.grafo, pontos[0][0], pontos[0][1], 12);
    const ref = refDe(no, sim.tabelas.nos.ger[no]);
    if (agua) prod.agua = sim.redes.produtor({ tipo: 'agua', ref: 1, capacidade: agua, no: ref });
    if (energia) prod.energia = sim.redes.produtor({ tipo: 'energia', ref: 2, capacidade: energia, no: ref });
  }
  return { sim, prod };
}

export const pintar = (sim, x, z, raio, zona) => assert.ok(sim.cmd('zona.pintar', { pincel: { modo: 'circulo', x, z, raio }, zona: indiceZona(zona) }).ok);

/** Faz nascer e termina na hora até `max` prédios da zona nas frentes livres (na ordem dos índices). */
export function nascerVarios(sim, zona, max = 1, rng = sim.rng('teste')) {
  const C = sim.tabelas.celulas;
  const z = indiceZona(zona);
  const feitos = [];
  for (let c = 0; c < C.n && feitos.length < max; c++) {
    if (!C.viva[c] || C.zona[c] !== z || C.linha[c] !== 0 || C.estado[c] !== CELULA.LIVRE) continue;
    const i = nascerNaFrente(sim, c, z, rng);
    if (i >= 0) {
      terminarObra(sim, i);
      feitos.push(i);
    }
  }
  return feitos;
}

/** Pinta um círculo e faz nascer prédios prontos da zona ali. */
export function povoar(sim, zona, x, z, raio, max = 40) {
  pintar(sim, x, z, raio, zona);
  return nascerVarios(sim, zona, max);
}

/**
 * Põe um serviço pronto (sem obra) de frente para a rua de z = -480, em x: o mesmo lugar que a prévia daria, sem pedir a
 * margem do rio nem o marco. Devolve o idx.
 */
export function servicoPronto(sim, tipo, x, zRua = -480, lado = -1) {
  const def = SERVICOS[tipo];
  const P = sim.tabelas.predios;
  const i = P.alocar();
  assert.ok(i >= 0);
  const [w, d] = def.planta;
  P.tipo[i] = TIPO_PREDIO.SERVICO;
  P.modelo[i] = SERVICOS_ORDEM.indexOf(tipo);
  P.zona[i] = 0;
  P.x[i] = x;
  P.z[i] = zRua + lado * (8 + d / 2 + 1);
  P.y[i] = sim.alturaEm(P.x[i], P.z[i]);
  P.rot[i] = lado < 0 ? 0 : Math.PI; // a frente olha para a rua
  P.w[i] = w;
  P.d[i] = d;
  P.nivel[i] = 1;
  P.flags[i] = 0;
  P.efic[i] = 1;
  P.marcar(i);
  const t = trans(sim);
  t.servSujo = true;
  t.redesSujas = true;
  return i;
}

/** Põe um prédio da Holding pronto (pedreira, mina, cimenteira...) de frente para a rua, sem validar o recurso. */
export function holdingPronto(sim, tipo, x, zRua = -480, lado = -1) {
  const def = PREDIOS_HOLDING[tipo];
  const P = sim.tabelas.predios;
  const i = P.alocar();
  assert.ok(i >= 0);
  const [w, d] = def.planta;
  P.tipo[i] = TIPO_PREDIO.HOLDING;
  P.modelo[i] = HOLDING_ORDEM.indexOf(tipo);
  P.zona[i] = 0;
  P.x[i] = x;
  P.z[i] = zRua + lado * (8 + d / 2 + 1);
  P.y[i] = sim.alturaEm(P.x[i], P.z[i]);
  P.rot[i] = lado < 0 ? 0 : Math.PI;
  P.w[i] = w;
  P.d[i] = d;
  P.nivel[i] = 1;
  P.flags[i] = 0;
  P.marcar(i);
  const t = trans(sim);
  t.servSujo = true;
  t.redesSujas = true;
  return i;
}

/** Roda n rodadas (20 tiques cada) sem pressa. */
export const rodadas = (sim, n) => sim.rodar(20 * n, { sincrono: true });
