// Ferramenta de colocar serviço ou prédio da Holding (desenho da UI 9.4, D60): máquina PURA. O fantasma segue a mira,
// gruda na frente da via mais perto e gira para ela (quem ajusta é q.construir.previa, da simulação); Girar vira 90
// graus; Construir põe e a ferramenta fica aberta para o próximo. previaColocarLocal é o SUBSTITUTO da consulta
// enquanto a S2a e a S3a não publicam: a mesma regra de grudar na frente da via, com a pegada do catálogo.
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { COLOCAVEIS } from '../../data/colocaveis.js';
import { arestaPerto } from './via.js';

const MEIA_VOLTA = Math.PI / 2;

/** Pegada padrão (m) quando o catálogo ainda não tem a do modelo. */
export const PEGADA_PADRAO = Object.freeze([24, 24]);

/** Pegada [frente, fundo] em metros do tipo (catálogo da R5, ou o item da bandeja, ou a padrão). */
export function pegadaDe(tipo, item = null) {
  const c = COLOCAVEIS?.[tipo];
  const p = item?.pegada ?? c?.pegada;
  if (Array.isArray(p) && p.length >= 2 && p[0] > 0 && p[1] > 0) return [p[0], p[1]];
  return [...PEGADA_PADRAO];
}

/** Ângulo em [0, 2 pi). */
export const normalizarRot = (r) => ((r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/**
 * Estado novo.
 * @param {{ tipo: string, item?: object }} op  item: a linha do catálogo ({ tipo, nome, custo, manutencaoHora, alcance, pegada })
 */
export function criarColocar({ tipo, item = null } = {}) {
  return { tipo, item, rot: 0, x: null, z: null, dedo: false, mira: null, efeitos: [] };
}

/**
 * Um passo. Eventos: inicio, move, fim, hover ({ ponto, tela }); { tipo: 'girar', sentido: 1 | -1 };
 * { tipo: 'cancelar' }. Efeitos: { efeito: 'previa', x, z, rot }, 'sair'.
 */
export function passoColocar(e, ev) {
  if (ev.tipo === 'cancelar') return { ...e, efeitos: ['sair'] };
  if (ev.tipo === 'girar') {
    const rot = normalizarRot(e.rot + (ev.sentido === -1 ? -MEIA_VOLTA : MEIA_VOLTA));
    return { ...e, rot, efeitos: e.x === null ? [] : [{ efeito: 'previa', x: e.x, z: e.z, rot }] };
  }
  if (!ev.ponto) return { ...e, efeitos: [] };
  const mira = { ponto: [ev.ponto[0], ev.ponto[1]], tela: ev.tela ?? null, dedo: ev.dedo ?? null };
  if (ev.tipo === 'hover' && e.dedo) return { ...e, efeitos: [] };
  const dedo = ev.tipo === 'inicio' ? true : ev.tipo === 'fim' ? false : e.dedo;
  const x = ev.ponto[0];
  const z = ev.ponto[1];
  return { ...e, x, z, dedo, mira, efeitos: [{ efeito: 'previa', x, z, rot: e.rot }] };
}

/**
 * SUBSTITUTO de q.construir.previa: gruda a planta na frente da via mais perto (até 60 m da borda): a frente encosta
 * na calçada e olha para a via (rot na convenção do espelho, frente para +z com rot 0). Sem via perto: codigo 'acesso'.
 * @returns {{ ok, codigo?, x, z, rot, custo, manutencaoHora, alcance, efeitos: [] }}
 */
export function previaColocarLocal(esp, { tipo, x, z, rot = 0 }, item = null) {
  const [w, d] = pegadaDe(tipo, item);
  const base = { custo: item?.custo ?? 0, manutencaoHora: item?.manutencaoHora ?? 0, alcance: item?.alcance ?? 0, efeitos: [], substituto: true };
  const ar = arestaPerto(esp, [x, z], 60, (e) => VIAS[VIAS_ORDEM[esp.vias.arestas.tipo[e]]]?.constroi || VIAS_ORDEM[esp.vias.arestas.tipo[e]] === 'terra');
  if (!ar) return { ...base, ok: false, codigo: 'acesso', x, z, rot };
  const [tx, tz] = ar.tangente;
  // lado da via em que a mira está: (−tz, tx) é a direita de a para b
  const lado = (x - ar.ponto[0]) * -tz + (z - ar.ponto[1]) * tx >= 0 ? 1 : -1;
  const nx = -tz * lado;
  const nz = tx * lado;
  const off = ar.meia + d / 2 + 1;
  const cx = ar.ponto[0] + nx * off;
  const cz = ar.ponto[1] + nz * off;
  // a frente olha de volta para a via: frente = (−nx, −nz) = (sen rot, cos rot); Girar soma meias voltas por cima
  const rotVia = Math.atan2(-nx, -nz);
  const giro = Math.round(normalizarRot(rot) / MEIA_VOLTA) % 4;
  const rotF = normalizarRot(rotVia + giro * MEIA_VOLTA);
  return { ...base, ok: true, x: cx, z: cz, rot: rotF, pegada: [w, d], via: ar.ref };
}
