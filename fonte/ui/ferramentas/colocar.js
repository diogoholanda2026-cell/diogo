// Ferramenta de colocar serviço ou prédio da Holding (desenho da UI 9.4, D60, D98): máquina PURA. O fantasma segue a mira
// e gira a QUALQUER ângulo: a prévia (q.construir.previa, da simulação) gruda a planta na frente da via mais perto
// (alinhar à via, o padrão quando há via a 60 m) ou deixa a planta onde está, na rotação que o jogador escolheu. Girar vira
// 90 graus (o botão), as teclas Q e E viram 15 graus e o puxador do fantasma gira pelo ímã de 15 graus (ou livre com o
// Shift). Construir põe e a ferramenta fica aberta para o próximo. previaColocarLocal é o SUBSTITUTO da consulta enquanto
// a simulação não responde (a vitrine): a mesma regra de grudar, de girar e de pedir via, com a pegada do catálogo.
// dicaDoBloqueio diz o motivo de cada vermelho e o que fazer (os textos ficam em ui/textos/ux1.js).
import { VIAS, VIAS_ORDEM } from '../../data/vias.js';
import { COLOCAVEIS } from '../../data/colocaveis.js';
import { MARCOS } from '../../data/marcos.js';
import { arestaPerto } from './via.js';

/** Um quarto de volta (o botão Girar) e o passo do ímã (15 graus), em radianos. */
export const QUARTO = Math.PI / 2;
export const PASSO_IMA = Math.PI / 12;
const DOIS_PI = 2 * Math.PI;

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
export const normalizarRot = (r) => ((r % DOIS_PI) + DOIS_PI) % DOIS_PI;

/** Ímã: o ângulo arredondado ao múltiplo de `passo` (15 graus) mais perto. */
export const imantar = (rot, passo = PASSO_IMA) => normalizarRot(Math.round(rot / passo) * passo);

/** Graus inteiros de 0 a 359 de um ângulo (o rótulo do giro). */
export const graus = (rot) => Math.round((normalizarRot(rot) * 180) / Math.PI) % 360;

/**
 * Rotação cuja frente (sen rot, cos rot) aponta do centro `c` para o ponto `p` do chão, ou null com o ponto sobre o centro
 * (a distância mínima evita que o dedo em cima do eixo faça o fantasma girar à toa).
 */
export function azimuteDe(c, p, minimo = 1.5) {
  const dx = p[0] - c[0];
  const dz = p[1] - c[1];
  if (Math.hypot(dx, dz) < minimo) return null;
  return normalizarRot(Math.atan2(dx, dz));
}

/**
 * Estado novo. rot: a rotação absoluta efetiva (a da prévia); giro: o ângulo em relação à via (0 = de frente para ela);
 * alinhar: gruda na via mais perto até 60 m (o padrão).
 * @param {{ tipo: string, item?: object }} op  item: a linha do catálogo ({ tipo, nome, custo, manutencaoHora, alcance, pegada })
 */
export function criarColocar({ tipo, item = null } = {}) {
  return { tipo, item, rot: 0, giro: 0, alinhar: true, x: null, z: null, dedo: false, mira: null, efeitos: [] };
}

const previaDe = (e, x, z, o = e) => ({ efeito: 'previa', x, z, rot: o.rot, giro: o.giro, alinhar: o.alinhar });

/**
 * Um passo. Eventos: inicio, move, fim, hover ({ ponto, tela }); { tipo: 'girar', sentido: 1 | -1, passo? } (passo em radianos,
 * um quarto de volta se faltar); { tipo: 'angulo', rot, giro? } (a rotação absoluta, já com o ímã); { tipo: 'alinhar', valor?,
 * rot? } (liga ou desliga; ao desligar, rot é a rotação efetiva que o fantasma já tem); { tipo: 'cancelar' }.
 * Efeitos: { efeito: 'previa', x, z, rot, giro, alinhar }, 'sair'.
 */
export function passoColocar(e, ev) {
  if (ev.tipo === 'cancelar') return { ...e, efeitos: ['sair'] };
  if (ev.tipo === 'girar') {
    const passo = ev.passo > 0 ? ev.passo : QUARTO;
    const d = ev.sentido === -1 ? -passo : passo;
    const n = { ...e, rot: normalizarRot(e.rot + d), giro: normalizarRot(e.giro + d) };
    return { ...n, efeitos: e.x === null ? [] : [previaDe(n, e.x, e.z)] };
  }
  if (ev.tipo === 'angulo') {
    const n = { ...e, rot: normalizarRot(Number.isFinite(ev.rot) ? ev.rot : e.rot), giro: Number.isFinite(ev.giro) ? normalizarRot(ev.giro) : e.giro };
    return { ...n, efeitos: e.x === null ? [] : [previaDe(n, e.x, e.z)] };
  }
  if (ev.tipo === 'alinhar') {
    const n = { ...e, alinhar: typeof ev.valor === 'boolean' ? ev.valor : !e.alinhar };
    if (Number.isFinite(ev.rot)) n.rot = normalizarRot(ev.rot);
    return { ...n, efeitos: e.x === null ? [] : [previaDe(n, e.x, e.z)] };
  }
  if (!ev.ponto) return { ...e, efeitos: [] };
  const mira = { ponto: [ev.ponto[0], ev.ponto[1]], tela: ev.tela ?? null, dedo: ev.dedo ?? null };
  if (ev.tipo === 'hover' && e.dedo) return { ...e, efeitos: [] };
  const dedo = ev.tipo === 'inicio' ? true : ev.tipo === 'fim' ? false : e.dedo;
  const x = ev.ponto[0];
  const z = ev.ponto[1];
  return { ...e, x, z, dedo, mira, efeitos: [previaDe(e, x, z)] };
}

/**
 * SUBSTITUTO de q.construir.previa: com alinhar (o padrão) e uma via a até 60 m da borda, gruda a planta na frente dela
 * (a frente encosta na calçada e olha para a via, rot na convenção do espelho, frente para +z com rot 0) e gira `giro` por
 * cima; sem via por perto, ou com alinhar desligado, a planta fica em (x, z) com a rotação `rot`. Sem via a 24 m da planta
 * (a 60 m com alinhar): codigo 'acesso'.
 * @returns {{ ok, codigo?, dados?, x, z, rot, alinhado, rotVia, giro, custo, manutencaoHora, alcance, efeitos: [] }}
 */
export function previaColocarLocal(esp, { tipo, x, z, rot = 0, giro = null, alinhar = true }, item = null) {
  const [w, d] = pegadaDe(tipo, item);
  const base = { custo: item?.custo ?? 0, manutencaoHora: item?.manutencaoHora ?? 0, alcance: item?.alcance ?? 0, efeitos: [], substituto: true, pegada: [w, d] };
  const filtro = (e) => VIAS[VIAS_ORDEM[esp.vias.arestas.tipo[e]]]?.constroi || VIAS_ORDEM[esp.vias.arestas.tipo[e]] === 'terra';
  const ar = alinhar === false ? null : arestaPerto(esp, [x, z], 60, filtro);
  if (!ar) {
    const r = normalizarRot(rot);
    // sem via no ímã: a via a 24 m da planta (pelo raio dela) dá o acesso
    const perto = arestaPerto(esp, [x, z], Math.hypot(w, d) / 2 + 24, filtro);
    const out = { ...base, x, z, rot: r, alinhado: false, rotVia: null, giro: null, via: perto?.ref ?? null };
    if (!perto && item?.acesso !== 'livre') return { ...out, ok: false, codigo: 'acesso', dados: { max: alinhar === false ? 24 : 60, alinhar: alinhar !== false } };
    return { ...out, ok: true };
  }
  const [tx, tz] = ar.tangente;
  // lado da via em que a mira está: (−tz, tx) é a direita de a para b
  const lado = (x - ar.ponto[0]) * -tz + (z - ar.ponto[1]) * tx >= 0 ? 1 : -1;
  const nx = -tz * lado;
  const nz = tx * lado;
  // a frente olha de volta para a via: frente = (−nx, −nz) = (sen rot, cos rot); o giro soma por cima
  const rotVia = Math.atan2(-nx, -nz);
  const rel = normalizarRot(giro ?? rot);
  const suporte = (d / 2) * Math.abs(Math.cos(rel)) + (w / 2) * Math.abs(Math.sin(rel));
  const off = ar.meia + suporte + 1;
  return { ...base, ok: true, x: ar.ponto[0] + nx * off, z: ar.ponto[1] + nz * off, rot: normalizarRot(rotVia + rel), alinhado: true, rotVia: normalizarRot(rotVia), giro: rel, via: ar.ref };
}

/**
 * O puxador de giro aparece? Com o mouse e a planta solta do cursor (sem alinhar, ou sem via a 60 m) o fantasma anda
 * colado ao cursor e a alça com ele, sempre à mesma distância: nunca se alcança. Então com o mouse só aparece alinhada à via
 * (a planta fica parada na calçada enquanto o cursor chega nela); no toque aparece sempre, e o mouse livre gira com Q e E.
 */
export const puxadorVisivel = (previa, comMouse) => !!previa && Number.isFinite(previa.x) && Number.isFinite(previa.z) && !(comMouse && !previa.alinhado);

// ------------------------------------------------------------------------------------------------ dica do bloqueio

/**
 * A dica de uma prévia que não serve (D98): o motivo e o que fazer, como chave de texto (ui/textos/ux1.js), parâmetros
 * crus (metros, unidades, marco) que a sessão formata, e a parte que colide ('via' ou 'predio', com a ref) para o
 * fantasma mostrar. Prévia boa com aplainar volta uma dica de informação (tom 'info'). null se não há o que dizer.
 * @returns {{ codigo: string, chave: string, params: object, tom: 'er' | 'info', colide: { com: string, ref: number } | null } | null}
 */
export function dicaDoBloqueio(p) {
  if (!p) return null;
  if (p.ok) {
    if (!p.aplainar) return null;
    return {
      codigo: 'aplainar', chave: 'ux1.dica.aplainar', tom: 'info', colide: null,
      params: { custo: p.custoAplainar ?? p.aplainar.custo, tiques: p.aplainar.tiques, desnivel: p.aplainar.desnivel },
    };
  }
  const d = p.dados ?? {};
  const mk = (chave, params = {}, colide = null) => ({ codigo: p.codigo ?? 'outro', chave, params, tom: 'er', colide });
  switch (p.codigo) {
    case 'marco': {
      const n = d.marco ?? 0;
      return mk('ux1.dica.marco', { marco: n, nome: MARCOS[n]?.nome ?? '' });
    }
    case 'ladrilho':
      return mk(d.estado === 'compravel' ? 'ux1.dica.ladrilho.compravel' : 'ux1.dica.ladrilho.trancado');
    case 'gleba':
      return mk('ux1.dica.gleba');
    case 'agua':
      return d.margem ? mk('ux1.dica.agua.margem', { m: d.margem }) : mk('ux1.dica.agua.sobre');
    case 'acesso':
      return mk(d.alinhar === false ? 'ux1.dica.acesso.livre' : 'ux1.dica.acesso.via', { max: d.max ?? 60 });
    case 'colisao':
      if (d.com === 'predio') return mk(d.nome ? 'ux1.dica.colisao.predioNome' : 'ux1.dica.colisao.predio', { afastar: d.afastar ?? 1, nome: d.nome ?? '' }, { com: 'predio', ref: d.ref });
      return mk('ux1.dica.colisao.via', { afastar: d.afastar ?? 1 }, d.ref !== undefined ? { com: 'via', ref: d.ref } : null);
    case 'declive':
      return mk('ux1.dica.declive', { desnivel: d.desnivel ?? 0, max: d.max ?? 0 });
    case 'recurso':
      return mk('ux1.dica.recurso', { recurso: d.recurso ?? '' });
    case 'creditos':
      return mk('ux1.dica.creditos', { faltam: d.faltam ?? p.faltam ?? 0 });
    default:
      return mk('ux1.dica.outro');
  }
}
