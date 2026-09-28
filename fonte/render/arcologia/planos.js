// Planos diretores da Arcologia (D59, D63) e o domínio 'arcologia' do render: as torres, o lago e as partes do plano
// no mundo. No jogo, o plano é o do espelho (ou o escolhido, ou o padrão enquanto ninguém escolheu); as torres
// aparecem prontas quando torre.e4 fica pronta e, antes disso, como fantasma (a obra por etapas é da X1b); o lago
// aparece quando lago.e1 fica pronta e o chão já foi cavado (o aplainar); as outras partes são fantasma com a silhueta
// LOD1 de verdade (D26). As cenas pedem outras vistas pelo domínio:
//   ctx.dominio('arcologia').vitrine({ modo: 'torre' })               só as torres, prontas
//   ctx.dominio('arcologia').vitrine({ modo: 'plano', plano: 'B' })   o plano inteiro construído, com a paisagem, as
//                                                                      vias internas e os portões
//   ctx.dominio('arcologia').vitrine(null)                            volta ao jogo
// As partes com LOD (a Sede em anel e a cúpula) trocam o LOD0 pelo LOD1 pela distância da câmera ao centro do plano.
// Desempenho (D66): um programa por material, todos compilados na carga (criarAquecimento); nada muda de programa
// entre o dia e a noite, os LODs e o fantasma.
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
import { ETAPA } from '../../contratos/flags.js';
import {
  PLANOS, PLANO_ESCOLHIDO, PLANO_PADRAO, PARTES_ORDEM, GLEBA_ENVELOPE, TORRE_LAMINA, suavizar, torresGemeas,
} from '../../data/arcologia-plano.js';
import {
  criarTorre, criarPar, atualizarArcologia, estadoDoCeu, materiais, descartarMateriais, geometriaDe, Malha, acab, PADRAO,
  tampa, arvore, hashF, orientar, triangular, caixa, NIVEL, malhasTorreLod1, PONTOS_TORRE, criarJatos, criarAquecimento,
  DIST_EFEITOS,
} from './torre.js';
import { montarParte, deslocar, PECAS_COM_LOD } from './partes.js';
import { montarReservatorio, montarLagoCircular, materialAgua, quadroAgua, PASSEIO } from './lago.js';
import { materialFantasma, malhaFantasma, criarFantasma } from './fantasma.js';

/** Plano que o jogo mostra: o do espelho, o escolhido no portão 1 ou o padrão. */
export function planoDoJogo(esp) {
  const id = esp?.arcologia?.plano ?? PLANO_ESCOLHIDO ?? PLANO_PADRAO;
  return PLANOS[id] ? id : PLANO_PADRAO;
}

/** Estado de uma etapa no espelho (ETAPA.*), TRANCADA se não existir. */
export function estadoEtapa(esp, id) {
  return esp?.arcologia?.etapas?.find((e) => e.id === id)?.estado ?? ETAPA.TRANCADA;
}

/** Cota do chão num ponto: a do terreno (a plataforma do aplainar), ou a da gleba sem terreno. */
export function cotaEm(T, x, z) {
  return T?.altura ? alturaEm(T, x, z) : GLEBA_ENVELOPE.cota;
}

/** Centro de um plano (o do anel no A v2; nos outros, a Torre). */
export const centroDoPlano = (P) => P.centro ?? [P.torre.x, P.torre.z];

/**
 * Ponto onde se mede a cota da plataforma de um plano: a Torre; no par (D64), sob o pódio da Lâmina, longe do poço da
 * fenda (que faz parte da cava do lago e desce com ela).
 */
export function pontoDaCota(P) {
  const t = P.torre;
  if (!t.gemeas) return [t.x, t.z];
  const [lam] = torresGemeas(t);
  return [lam.x + 10 * Math.cos(t.rot ?? 0), lam.z - 10 * Math.sin(t.rot ?? 0)];
}

// ================================================================================================ paisagem

const KP = {
  // gramado cuidado: um pouco mais verde e mais claro que o capim do platô (sem chegar ao verde-lima)
  grama: acab('#5b6a3a', { rugo: 0.95, padrao: PADRAO.grama }),
  gramaEscura: acab('#4f5d34', { rugo: 0.95, padrao: PADRAO.grama }),
  piso: acab('#b0a695', { rugo: 0.8, padrao: PADRAO.piso }),
  portuguesa: acab('#8c877c', { rugo: 0.85, padrao: PADRAO.portuguesa }),
  asfalto: acab('#2c2e31', { rugo: 0.85 }),
  calcada: acab('#a39c90', { rugo: 0.8, padrao: PADRAO.piso }),
  canteiro: acab('#46532f', { rugo: 0.95, padrao: PADRAO.grama }),
  pedra: acab('#c3b79f', { rugo: 0.72, padrao: PADRAO.pedra }),
  champanhe: acab('#b8a684', { rugo: 0.32, metal: 1, padrao: PADRAO.metal }),
};

/**
 * Polígono deitado no relevo: triangula, subdivide os triângulos até o lado de ~passo metros e põe cada vértice em
 * chao(x, z) + dy. uv = (x, z).
 */
export function deitar(m, poly, chao, dy, k, passo = 24) {
  const { pontos, indices } = triangular(poly);
  const pt = (i) => [pontos[2 * i], pontos[2 * i + 1]];
  const pilha = [];
  for (let t = 0; t < indices.length; t += 3) pilha.push([pt(indices[t]), pt(indices[t + 1]), pt(indices[t + 2])]);
  let guarda = 0;
  while (pilha.length && guarda++ < 200000) {
    const [a, b, c] = pilha.pop();
    const lados = [[a, b, c], [b, c, a], [c, a, b]].map(([p, q, r]) => ({ l: Math.hypot(q[0] - p[0], q[1] - p[1]), p, q, r }));
    lados.sort((u, v) => v.l - u.l);
    const L = lados[0];
    if (L.l > passo) {
      const mid = [(L.p[0] + L.q[0]) / 2, (L.p[1] + L.q[1]) / 2];
      pilha.push([L.p, mid, L.r], [mid, L.q, L.r]);
      continue;
    }
    const i0 = m.v(a[0], chao(a[0], a[1]) + dy, a[1], 0, 1, 0, a[0], a[1], k);
    const i1 = m.v(b[0], chao(b[0], b[1]) + dy, b[1], 0, 1, 0, b[0], b[1], k);
    const i2 = m.v(c[0], chao(c[0], c[1]) + dy, c[1], 0, 1, 0, c[0], c[1], k);
    m.tri(i0, i1, i2);
  }
}

/** Faixa ao longo de uma polilinha (pares), largura w, deslocada lateralmente por o (+ à direita), no relevo. */
export function fita(m, pts, w, chao, dy, k, o = 0, passo = 12) {
  // reamostra a polilinha a cada passo metros
  const P = [];
  for (let i = 0; i + 2 < pts.length; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3];
    const l = Math.hypot(bx - ax, bz - az);
    const q = Math.max(1, Math.ceil(l / passo));
    for (let s = 0; s < q; s++) P.push([ax + ((bx - ax) * s) / q, az + ((bz - az) * s) / q]);
  }
  P.push([pts[pts.length - 2], pts[pts.length - 1]]);
  const lados = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const rx = -tz;
    const rz = tx;
    const e = [P[i][0] + rx * (o - w / 2), P[i][1] + rz * (o - w / 2)];
    const d = [P[i][0] + rx * (o + w / 2), P[i][1] + rz * (o + w / 2)];
    lados.push([e, d]);
  }
  for (let i = 0; i + 1 < lados.length; i++) {
    const [e0, d0] = lados[i];
    const [e1, d1] = lados[i + 1];
    const v = (p) => [p[0], chao(p[0], p[1]) + dy, p[1]];
    m.quad(v(e0), v(d0), v(d1), v(e1), [0, 1, 0], [e0[0], e0[1]], [d0[0], d0[1]], [d1[0], d1[1]], [e1[0], e1[1]], k);
  }
  return P;
}

/** Pontos a cada passo metros ao longo de uma polilinha, com a direção (para fileiras de árvores). */
function aoLongoDe(pts, passo) {
  const out = [];
  let resto = 0;
  for (let i = 0; i + 2 < pts.length; i += 2) {
    const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    let s = resto;
    while (s <= l) {
      out.push({ x: ax + ((bx - ax) * s) / l, z: az + ((bz - az) * s) / l, tx: (bx - ax) / l, tz: (bz - az) / l });
      s += passo;
    }
    resto = s - l;
  }
  return out;
}

/** Portão: dois pilares de pedra e a verga champanhe, de frente para a via que entra. */
function portao(m, x, z, dir, chao) {
  const y = chao(x, z);
  const [tx, tz] = dir;
  const rx = -tz;
  const rz = tx;
  for (const s of [-1, 1]) caixa(m, x + rx * 17 * s, z + rz * 17 * s, 2.2, 2.2, y - 1, y + 16, KP.pedra, { ux: tx, uz: tz });
  caixa(m, x, z, 1.2, 19.5, y + 13.8, y + 15.2, KP.champanhe, { ux: tx, uz: tz, base: true });
}

/** Distância de um ponto a uma polilinha (pares). */
function distPolilinha(x, z, P) {
  let md = Infinity;
  for (let i = 0; i + 3 < P.length; i += 2) {
    const ax = P[i], az = P[i + 1], bx = P[i + 2], bz = P[i + 3];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    md = Math.min(md, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return md;
}

/** Coroa circular deitada no relevo (de r0 a r1), em n trechos com os raios subdivididos a cada ~12 m. */
function anelDeitado(m, cx, cz, r0, r1, chao, dy, k, n = 96) {
  const nr = Math.max(1, Math.ceil((r1 - r0) / 12));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    for (let j = 0; j < nr; j++) {
      const ra = r0 + ((r1 - r0) * j) / nr;
      const rb = r0 + ((r1 - r0) * (j + 1)) / nr;
      const P = [[ra, a0], [ra, a1], [rb, a1], [rb, a0]].map(([r, a]) => {
        const x = cx + r * Math.cos(a);
        const z = cz + r * Math.sin(a);
        return [x, chao(x, z) + dy, z];
      });
      m.quad(...P, [0, 1, 0], ...P.map((q) => [q[0], q[2]]), k);
    }
  }
}

/**
 * Paisagem de um plano: parques e praças deitados no relevo, passeios (pedra portuguesa no plano C, o calçadão do
 * Aterro; os eixos da sede v2 em pedra clara com palmeiras-imperiais), bosques, anéis (o bosque em volta do lago, o
 * cinturão de mata em volta da Sede, como na Apple Park, e a clareira da cúpula), fileiras de árvores, as vias internas
 * (avenida de 24 m com canteiro de palmeiras, ou o anel de 18 m) e os portões.
 */
export function montarPaisagem(plano, { chao, opaco, arvores, nivel = 1, fora = null }) {
  const P = plano.paisagem;
  const orla = plano.id === 'C';
  const livre = (x, z) => !fora || !fora(x, z);
  let nArv = 0;
  const maxArv = [200, 900, 1300, 1600][nivel];
  const plantar = (x, z, op) => {
    if (nArv >= maxArv || !livre(x, z)) return;
    nArv++;
    arvore(arvores, x, chao(x, z) + 0.15, z, { detalhe: 0, ...op });
  };
  // parques com a borda macia (Chaikin): de cima, curvas de paisagismo (Burle Marx), não polígonos de maquete. Sem
  // contorno pintado: quem marca o parque são os maciços de árvores e as clareiras
  const parques = P.parques.map((poly) => orientar(suavizar(poly, { voltas: 2 })));
  parques.forEach((poly, i) => deitar(opaco, poly, chao, 0.14, i % 2 ? KP.gramaEscura : KP.grama));
  for (const poly of P.pracas) deitar(opaco, poly, chao, 0.2, orla ? KP.portuguesa : KP.piso);
  for (const ps of P.passeios) {
    fita(opaco, ps.caminho, ps.largura, chao, 0.24, orla || ps.portuguesa ? KP.portuguesa : ps.eixo ? KP.pedra : KP.piso);
    const palmas = orla || ps.portuguesa || ps.largura >= 14;
    for (const q of aoLongoDe(ps.caminho, palmas ? 13 : 16)) {
      for (const s of [-1, 1]) {
        const off = (ps.largura / 2 + 2.5) * s;
        plantar(q.x - q.tz * off, q.z + q.tx * off, palmas ? { tipo: 'palmeira', altura: 16 + 5 * hashF(Math.round(q.x), Math.round(q.z)), raio: 3.4, semente: Math.round(q.x * 7 + q.z) } : { altura: 8, raio: 3, semente: Math.round(q.x * 3 + q.z * 5) });
      }
    }
  }
  // bosques: grade mexida com a densidade pedida
  for (const b of P.bosques) {
    const C = orientar(b.contorno);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < C.length; i += 2) {
      x0 = Math.min(x0, C[i]);
      x1 = Math.max(x1, C[i]);
      z0 = Math.min(z0, C[i + 1]);
      z1 = Math.max(z1, C[i + 1]);
    }
    const passo = 1 / Math.sqrt(b.densidade);
    for (let z = z0; z <= z1; z += passo) {
      for (let x = x0; x <= x1; x += passo) {
        const jx = x + (hashF(Math.round(x), Math.round(z), 1) - 0.5) * passo * 0.8;
        const jz = z + (hashF(Math.round(x), Math.round(z), 2) - 0.5) * passo * 0.8;
        if (!pontoNoPoligono(jx, jz, C)) continue;
        plantar(jx, jz, { altura: 9 + 6 * hashF(Math.round(jx), 3), raio: 3.2 + 1.6 * hashF(Math.round(jz), 4), semente: Math.round(jx * 13 + jz) });
      }
    }
    deitar(opaco, C, chao, 0.1, KP.gramaEscura);
  }
  // anéis: gramado deitado e, no bosque, árvores numa grade polar mexida (clareiras onde o hash não planta)
  for (const a of P.aneis ?? []) {
    anelDeitado(opaco, a.cx, a.cz, a.r0, a.r1, chao, 0.12, a.tipo === 'bosque' ? KP.gramaEscura : KP.grama);
    const bosque = a.tipo === 'bosque';
    const passo = bosque ? 1 / Math.sqrt(a.densidade ?? 0.006) : 26;
    for (let r = a.r0 + passo / 2; r < a.r1; r += passo) {
      const n = Math.floor((2 * Math.PI * r) / passo);
      for (let i = 0; i < n; i++) {
        const t = ((i + hashF(i, Math.round(r), 3) * 0.7) / n) * Math.PI * 2;
        const rr = r + (hashF(i, Math.round(r), 4) - 0.5) * passo * 0.6;
        const x = a.cx + rr * Math.cos(t);
        const z = a.cz + rr * Math.sin(t);
        if (!bosque && hashF(i, 7, Math.round(r)) < 0.5) continue;
        if (bosque && hashF(Math.floor(t * 6), Math.round(a.r0), 9) < 0.18) continue; // clareiras
        plantar(x, z, { altura: 9 + 7 * hashF(i, Math.round(r), 5), raio: 3 + 1.8 * hashF(Math.round(r), i, 6), semente: Math.round(x * 11 + z * 3) });
      }
    }
  }
  // maciços de árvores dentro dos parques (grade larga e mexida; clareiras onde o hash não planta)
  parques.forEach((C, ip) => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < C.length; i += 2) {
      x0 = Math.min(x0, C[i]);
      x1 = Math.max(x1, C[i]);
      z0 = Math.min(z0, C[i + 1]);
      z1 = Math.max(z1, C[i + 1]);
    }
    const passo = 17;
    for (let z = z0 + passo / 2; z <= z1; z += passo) {
      for (let x = x0 + passo / 2; x <= x1; x += passo) {
        const g = hashF(Math.floor(x / 80), Math.floor(z / 80), ip + 17);
        if (g < 0.4) continue; // clareira
        const jx = x + (hashF(Math.round(x), Math.round(z), 5) - 0.5) * passo;
        const jz = z + (hashF(Math.round(z), Math.round(x), 6) - 0.5) * passo;
        if (!pontoNoPoligono(jx, jz, C)) continue;
        plantar(jx, jz, { altura: 8 + 7 * hashF(Math.round(jx), 7), raio: 3 + 2 * hashF(Math.round(jz), 8), semente: Math.round(jx * 11 + jz * 3) });
      }
    }
  });
  // árvores soltas nos parques (poucas, nas bordas: o miolo fica aberto)
  parques.forEach((C, ip) => {
    for (let i = 0; i < C.length; i += 2) {
      const j = (i + 2) % C.length;
      const l = Math.hypot(C[j] - C[i], C[j + 1] - C[i + 1]);
      const q = Math.floor(l / 34);
      for (let s = 0; s < q; s++) {
        const t = (s + 0.5) / q;
        const x = C[i] + (C[j] - C[i]) * t;
        const z = C[i + 1] + (C[j + 1] - C[i + 1]) * t;
        const cx = x + (hashF(ip, i, s) - 0.5) * 14;
        const cz = z + (hashF(s, ip, i) - 0.5) * 14;
        if (pontoNoPoligono(cx, cz, C)) plantar(cx, cz, { altura: 8 + 5 * hashF(i, s), raio: 3 + 1.5 * hashF(s, i), semente: ip * 100 + i * 7 + s });
      }
    }
  });
  // vias internas: avenida de 24 m (calçada 3, pista 7, canteiro 4 com palmeiras, pista 7, calçada 3) ou o anel de 18 m
  // (calçada 2, pista 6,5, canteiro 1, pista 6,5, calçada 2)
  for (const v of plano.vias) {
    const w = v.largura ?? 24;
    const calc = w >= 24 ? 3 : 2;
    const cant = w >= 24 ? 4 : 1;
    const pista = (w - 2 * calc - cant) / 2;
    const off = cant / 2 + pista / 2;
    fita(opaco, v.pontos, w, chao, 0.1, KP.calcada);
    fita(opaco, v.pontos, pista, chao, 0.13, KP.asfalto, -off);
    fita(opaco, v.pontos, pista, chao, 0.13, KP.asfalto, off);
    fita(opaco, v.pontos, cant, chao, 0.16, cant >= 3 ? KP.canteiro : KP.calcada);
    if (cant >= 3) for (const q of aoLongoDe(v.pontos, 14)) plantar(q.x, q.z, { tipo: 'palmeira', altura: 15 + 4 * hashF(Math.round(q.x), 9), raio: 3.2, semente: Math.round(q.x + q.z * 3) });
  }
  // portões nas pontas das vias que tocam a borda da gleba
  for (const g of plano.portoes) {
    const v = plano.vias.reduce((mais, via) => {
      const d = Math.hypot(via.pontos[0] - g.x, via.pontos[1] - g.z);
      return !mais || d < mais.d ? { via, d } : mais;
    }, null);
    let dir = [0, 1];
    if (v) {
      const p = v.via.pontos;
      const l = Math.hypot(p[2] - p[0], p[3] - p[1]) || 1;
      dir = [(p[2] - p[0]) / l, (p[3] - p[1]) / l];
    }
    portao(opaco, g.x, g.z, dir, chao);
  }
  return { arvores: nArv };
}

// ================================================================================================ um plano em malhas

const novas = () => ({ vidro: new Malha('vidro'), opaco: new Malha('opaco'), claro: new Malha('claro'), arvores: new Malha('opaco') });

/**
 * O que ocupa o chão de um plano (as árvores da paisagem não entram): o lago e a ilha, a Sede em anel, as vias, os
 * passeios, a cúpula e as caixas das outras peças. Para o A v2 as regras são círculos (o anel, o lago); nos outros,
 * a Torre e o contorno do reservatório.
 */
function ocupadoDoPlano(plano, caixas) {
  const T = plano.torre;
  const res = plano.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
  const anelSede = plano.partes.flatMap((p) => p.pecas).find((p) => p.tipo === 'sedeAnel');
  const cupulas = plano.partes.flatMap((p) => p.pecas).filter((p) => p.tipo === 'cupula');
  const vias = plano.vias;
  const passeios = plano.paisagem.passeios;
  const contornoRes = res.forma === 'circulo' ? null : deslocar(orientar(res.contorno), PASSEIO * 0.5);
  const outras = caixas.filter((c) => c.parte !== 'sede' && c.parte !== 'lago' && c.parte !== 'vida').map((c) => c.caixa);
  return (x, z) => {
    if (!T.gemeas && Math.hypot(x - T.x, z - T.z) < 72) return true;
    if (res.forma === 'circulo') {
      if (Math.hypot(x - res.cx, z - res.cz) < res.raio + 14) return true;
    } else if (pontoNoPoligono(x, z, contornoRes)) return true;
    if (anelSede) {
      const d = Math.hypot(x - anelSede.cx, z - anelSede.cz);
      if (d > anelSede.rDentro - 4 && d < anelSede.rFora + 6) return true;
    }
    for (const c of cupulas) if (Math.hypot(x - c.x, z - c.z) < c.diametro / 2 + 8) return true;
    for (const v of vias) if (distPolilinha(x, z, v.pontos) < (v.largura ?? 24) / 2 + 3) return true;
    for (const p of passeios) if (distPolilinha(x, z, p.caminho) < p.largura / 2 + 1.5) return true;
    for (const b of outras) if (x > b[0] - 4 && x < b[3] + 4 && z > b[2] - 4 && z < b[5] + 4) return true;
    return false;
  };
}

/**
 * Malhas de um plano (sem as torres, que são do torre.js): as partes prontas em material de verdade, as outras no
 * fantasma, o lago e, se pedida, a paisagem. As peças com LOD (a Sede em anel, a cúpula) saem duas vezes, em lod0 e
 * lod1; as outras, uma vez só em comum.
 * @param {string} id  'A' | 'B' | 'C'
 * @param {{ chao: Function, prontas: Set<string> | 'todas', lagoReal?: boolean, paisagem?: boolean, nivel?: number }} op
 * @returns {{ comum, lod0, lod1, agua: Malha, efeitos: Malha, jatos: object[], fantasma, sombra, caixas, nivelAgua: number,
 *   cota: number, arvores: number }}
 */
export function malhasDoPlano(id, { chao, prontas = 'todas', lagoReal = true, paisagem = true, nivel = 1 } = {}) {
  const plano = PLANOS[id];
  const comum = novas();
  const lod0 = novas();
  const lod1 = novas();
  const agua = new Malha('agua');
  const efeitos = new Malha('cascata');
  const jatos = [];
  const sombra = { vidro: new Malha('vidro'), opaco: new Malha('opaco') };
  const fant = { vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco') };
  const caixas = [];
  const cota = chao(...pontoDaCota(plano));
  const lago = plano.partes.find((p) => p.id === 'lago');
  const res = lago.pecas.find((p) => p.tipo === 'reservatorio');
  const nivelAgua = cota + res.nivel;
  const semLod = (p) => !PECAS_COM_LOD.has(p.tipo);
  const comLod = (p) => PECAS_COM_LOD.has(p.tipo);
  for (const parte of plano.partes) {
    if (parte.id === 'torre') continue;
    const pronta = prontas === 'todas' || prontas.has(parte.id);
    const idx = PARTES_ORDEM.indexOf(parte.id);
    if (parte.id === 'lago') {
      const real = pronta && lagoReal;
      if (real) {
        const r = res.forma === 'circulo'
          ? montarLagoCircular(res, { opaco: comum.opaco, agua, efeitos, arvores: comum.arvores, cota, lod: 1 })
          : montarReservatorio(res, { opaco: comum.opaco, agua, cota });
        caixas.push({ parte: parte.id, idx, caixa: r.caixa });
      } else {
        // espelho prometido: o contorno da água em holograma, logo acima do chão
        tampa(fant.opaco, orientar(res.contorno), cota + 0.4, [0, 0, 0, 0], true);
      }
      const outras = { ...parte, pecas: parte.pecas.filter((p) => p.tipo !== 'reservatorio') };
      if (outras.pecas.length) {
        const r = montarParte(outras, real ? { chao, nivelAgua, ...comum, jatos } : { chao, nivelAgua, ...fant, fantasma: true });
        for (const c of r.caixas) caixas.push({ parte: parte.id, idx, caixa: c });
      }
      continue;
    }
    if (!pronta) {
      const r = montarParte(parte, { chao, nivelAgua, ...fant, fantasma: true, lod: 1 });
      for (const c of r.caixas) caixas.push({ parte: parte.id, idx, caixa: c });
      continue;
    }
    const r = montarParte(parte, { chao, nivelAgua, ...comum, efeitos, lod: 1, so: semLod });
    montarParte(parte, { chao, nivelAgua, ...lod0, efeitos, lod: 0, so: comLod });
    const r1 = montarParte(parte, { chao, nivelAgua, ...lod1, lod: 1, so: comLod });
    for (const c of [...r.caixas, ...r1.caixas]) caixas.push({ parte: parte.id, idx, caixa: c });
    montarParte(parte, { chao, nivelAgua, vidro: sombra.vidro, opaco: sombra.opaco, arvores: null, lod: 1, sombra: true });
  }
  let nArvores = 0;
  if (paisagem) nArvores = montarPaisagem(plano, { chao, opaco: comum.opaco, arvores: comum.arvores, nivel, fora: ocupadoDoPlano(plano, caixas) }).arvores;
  return { comum, lod0, lod1, agua, efeitos, jatos, fantasma: fant, sombra, caixas, nivelAgua, cota, arvores: nArvores };
}

/** Caixa de seleção de uma torre sozinha no espaço local dela: o pódio com a marquise, do chão ao mastro. */
const CAIXA_TORRE = Object.freeze([
  -PONTOS_TORRE.podio.x - 1, -3, PONTOS_TORRE.podio.z0 - TORRE_LAMINA.podio.marquise, PONTOS_TORRE.podio.x + 1, PONTOS_TORRE.topo,
  PONTOS_TORRE.podio.z1 + 1,
]);

/** Caixa de seleção do par no espaço do par: as duas torres com os pódios, do chão ao mastro da Lâmina. */
const CAIXA_PAR = Object.freeze([-71, -3, -28, 71, TORRE_LAMINA.mastro.topo, 28]);

/** Folga em volta do envelope da gleba (passeio do reservatório, esplanada e a transição do aplainar), em metros. */
const FOLGA_GLEBA = 60;

/**
 * true se algum retângulo sujo do terreno ([x0, z0, x1, z1]) toca o envelope da gleba com a folga: o resto da cidade
 * mexe no chão o tempo todo (vias, lotes) e não pede refazer a Arcologia.
 */
export function tocaGleba(rets) {
  if (!rets?.length) return false;
  const [gx0, gz0, gx1, gz1] = GLEBA_ENVELOPE.caixa;
  return rets.some(([x0, z0, x1, z1]) => x1 >= gx0 - FOLGA_GLEBA && x0 <= gx1 + FOLGA_GLEBA && z1 >= gz0 - FOLGA_GLEBA && z0 <= gz1 + FOLGA_GLEBA);
}

/** Um ponto certamente dentro de um polígono (o centro do maior triângulo da triangulação). */
export function pontoDentro(poly) {
  const { pontos, indices } = triangular(poly);
  let melhor = [pontos[0], pontos[1]];
  let area = -1;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const ax = pontos[2 * a], az = pontos[2 * a + 1], bx = pontos[2 * b], bz = pontos[2 * b + 1], cx = pontos[2 * c], cz = pontos[2 * c + 1];
    const ar = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax));
    if (ar > area) {
      area = ar;
      melhor = [(ax + bx + cx) / 3, (az + bz + cz) / 3];
    }
  }
  return melhor;
}

/** Um ponto na água do reservatório (no lago circular, no meio do anel de água ao sul da ilha). */
export function pontoNaAgua(res) {
  if (res.forma === 'circulo') return [res.cx, res.cz + (res.raio + res.ilha.rz) / 2];
  return pontoDentro(res.contorno);
}

/**
 * Distância (m) da câmera ao centro do plano em que as partes com LOD (a Sede em anel, a cúpula) trocam o LOD1 pelo
 * LOD0: as marquises de 0,5 m e as barras da cúpula cobrem ~1 pixel ali, em 1080p.
 */
export const DIST_PARTES_LOD0 = Object.freeze({ leve: 700, media: 1100, alta: 1500, ultra: 1900, pc: 1500 });

// ================================================================================================ domínio

function criarDominio(ctx) {
  const raiz = new THREE.Group();
  raiz.name = 'arcologia';
  ctx.cena.add(raiz);
  // o conjunto fixo de materiais: todos existem desde a carga (D66)
  const mats = materiais(ctx);
  const matAgua = materialAgua(ctx.ganchos);
  const matFantasma = materialFantasma(ctx.ganchos);
  const aquecer = criarAquecimento(ctx, [...mats.lista, matAgua, matFantasma]);
  raiz.add(aquecer.grupo);
  let torre = null;
  let torrePerfil = null; // perfil do LOD0 montado (a troca de qualidade refaz a geometria, nunca o programa)
  let torreFantasma = null;
  let partes = null; // { grupo, lod0, lod1, efeitos, jatos, caixas, volume, plano, arvores, centro }
  let vitrine = null; // { modo, plano }
  let chave = '';
  let sujo = true;
  let lodPartes = 1;
  const estadoCeu = {};

  const limparPartes = () => {
    if (!partes) return;
    raiz.remove(partes.grupo);
    if (partes.volume) ctx.sombra.soltar(partes.volume);
    partes.grupo.traverse((o) => o.geometry?.dispose());
    // o InstancedMesh dos jatos guarda o buffer das matrizes e o VAO fora da geometria: só o dispose() dele os solta
    partes.jatos?.dispose();
    partes = null;
  };

  function montar(esp) {
    const modo = vitrine?.modo ?? 'jogo';
    const plano = vitrine?.plano ?? planoDoJogo(esp);
    const P = PLANOS[plano];
    const T = esp?.terreno;
    const chao = (x, z) => cotaEm(T, x, z);
    const torrePronta = modo !== 'jogo' || estadoEtapa(esp, 'torre.e4') === ETAPA.PRONTA;
    const res = P.partes.find((p) => p.id === 'lago').pecas.find((p) => p.tipo === 'reservatorio');
    // o reservatório só aparece de verdade quando o chão já foi cavado (o aplainar do jogo ou a cena)
    const [ccx, ccz] = centroDoPlano(P);
    const cota = chao(...pontoDaCota(P));
    const [ax, az] = pontoNaAgua(res);
    const cavado = chao(ax, az) < cota + res.nivel - 0.5;
    const lagoPronto = modo === 'plano' || estadoEtapa(esp, 'lago.e1') === ETAPA.PRONTA;
    const nova = `${modo}|${plano}|${torrePronta}|${lagoPronto}|${cavado}|${ctx.perfil?.id}|${T?.altura?.length ?? 0}`;
    if (nova === chave && !sujo) return;
    chave = nova;
    sujo = false;

    // torres: prontas (LOD0/LOD1) ou fantasma; o LOD0 é do perfil, então a troca de qualidade refaz a geometria
    const gemeas = !!P.torre.gemeas;
    if (torre && (torrePerfil !== ctx.perfil?.id || !!torre.gemeas !== gemeas)) {
      torre.descartar();
      torre = null;
    }
    if (!torre) {
      torre = gemeas ? criarPar(ctx) : criarTorre(ctx);
      torrePerfil = ctx.perfil?.id;
      raiz.add(torre.grupo);
    }
    const yT = cota;
    torre.posicionar(P.torre.x, yT, P.torre.z, P.torre.rot);
    torre.mostrar(torrePronta);
    if (torreFantasma) {
      raiz.remove(torreFantasma);
      torreFantasma.geometry.dispose();
      torreFantasma = null;
    }
    if (!torrePronta) {
      const partesF = [];
      if (gemeas) {
        for (const t of torresGemeas({ x: 0, z: 0, rot: 0 })) {
          const m1 = malhasTorreLod1({ spec: t.spec, gemea: true });
          partesF.push(m1.vidro.transformar(t.x, 0, t.z, t.rot), m1.opaco.transformar(t.x, 0, t.z, t.rot));
        }
      } else {
        const m1 = malhasTorreLod1();
        partesF.push(m1.vidro, m1.opaco);
      }
      torreFantasma = criarFantasma(ctx, malhaFantasma(...partesF), matFantasma);
      torreFantasma.position.set(P.torre.x, yT, P.torre.z);
      torreFantasma.rotation.y = P.torre.rot;
      raiz.add(torreFantasma);
    }

    // partes do plano
    limparPartes();
    if (modo === 'torre') return;
    const prontas = modo === 'plano' ? 'todas' : new Set(lagoPronto ? ['lago'] : []);
    const nivel = NIVEL[ctx.perfil?.id] ?? 1;
    const m = malhasDoPlano(plano, { chao, prontas, lagoReal: cavado, paisagem: modo === 'plano', nivel });
    const grupo = new THREE.Group();
    grupo.name = `arcologia:plano-${plano}`;
    const g0 = new THREE.Group();
    const g1 = new THREE.Group();
    g0.name = 'plano:lod0';
    g1.name = 'plano:lod1';
    const add = (alvo, malha, mat, fam, nome, ordem = 0) => {
      if (!malha?.triangulos) return null;
      const o = new THREE.Mesh(geometriaDe(malha), mat);
      o.name = nome;
      o.renderOrder = ordem;
      ctx.medidas.familia(o, fam);
      alvo.add(o);
      return o;
    };
    add(grupo, m.comum.vidro, mats.vidroLod1, 'arcologia', 'plano:vidro');
    add(grupo, m.comum.opaco, mats.opaco, 'arcologia', 'plano:opaco');
    add(grupo, m.comum.arvores, mats.opaco, 'arvores', 'plano:arvores');
    add(g0, m.lod0.vidro, mats.vidro, 'arcologia', 'plano:lod0:vidro');
    add(g0, m.lod0.opaco, mats.opaco, 'arcologia', 'plano:lod0:opaco');
    add(g0, m.lod0.arvores, mats.opaco, 'arvores', 'plano:lod0:arvores');
    add(g0, m.lod0.claro, mats.claro, 'arcologia', 'plano:lod0:claro', 20);
    add(g1, m.lod1.vidro, mats.vidroLod1, 'arcologia', 'plano:lod1:vidro');
    add(g1, m.lod1.opaco, mats.opaco, 'arcologia', 'plano:lod1:opaco');
    add(g1, m.lod1.arvores, mats.opaco, 'arvores', 'plano:lod1:arvores');
    add(g1, m.lod1.claro, mats.claroLod1, 'arcologia', 'plano:lod1:claro', 20);
    grupo.add(g0, g1);
    add(grupo, m.agua, matAgua, 'resto', 'plano:agua');
    const efeitos = add(grupo, m.efeitos, mats.cascata, 'arcologia', 'plano:efeitos', 11);
    let jatos = null;
    if (m.jatos.length) {
      jatos = criarJatos(ctx, m.jatos, m.nivelAgua, mats.jato);
      grupo.add(jatos);
    }
    const f = criarFantasma(ctx, malhaFantasma(m.fantasma.vidro, m.fantasma.opaco, m.fantasma.arvores), matFantasma);
    if (f) grupo.add(f);
    // volume de sombra das partes prontas (os volumes LOD1, sem chão nem árvores nem o vidro da cúpula)
    let volume = null;
    const vs = malhaFantasma(m.sombra.vidro, m.sombra.opaco);
    if (vs.triangulos) {
      volume = new THREE.Mesh(geometriaDe(vs), mats.opaco);
      volume.visible = false;
      volume.name = 'plano:sombra';
      grupo.add(volume);
      ctx.medidas.familia(ctx.sombra.projetor(volume), 'sombra');
    }
    raiz.add(grupo);
    grupo.updateMatrixWorld(true);
    ctx.sombra.marcar();
    partes = { grupo, lod0: g0, lod1: g1, efeitos, jatos, caixas: m.caixas, volume, plano, arvores: m.arvores, centro: new THREE.Vector3(ccx, cota + 20, ccz) };
    lodPartes = -1;
  }

  /** LOD das partes pela distância da câmera ao centro do plano (histerese de 5%) e os efeitos só de perto. */
  function quadroPartes() {
    if (!partes) return;
    const d = ctx.camera.position.distanceTo(partes.centro);
    const limite = (DIST_PARTES_LOD0[ctx.perfil?.id] ?? 1500) * (lodPartes === 0 ? 1.05 : 0.95);
    const lod = dom.forcarLodPartes ?? (d < limite ? 0 : 1);
    if (lod !== lodPartes) {
      lodPartes = lod;
      partes.lod0.visible = lod === 0;
      partes.lod1.visible = lod === 1;
    }
    const perto = d < DIST_EFEITOS;
    if (partes.efeitos) partes.efeitos.visible = perto;
    if (partes.jatos) partes.jatos.visible = perto;
  }

  const dom = {
    nome: 'arcologia',
    /** Força o LOD das partes (0 ou 1) ou volta ao automático (null). */
    forcarLodPartes: null,
    /**
     * Refaz a escolha dos LODs e dos efeitos com a câmera do momento: uma cena que põe a câmera depois dos domínios
     * (as vistas fixas) chama no quadro dela, antes do desenho.
     */
    atualizarLods() {
      torre?.quadro();
      quadroPartes();
    },
    aplicar(d, esp) {
      // o chão refaz tudo só quando mexe na gleba; o sinal 'arcologia' (progresso das etapas a cada tique) só remonta
      // quando a chave muda (etapa pronta, plano escolhido); a troca de qualidade refaz as torres e as partes
      if (d.tudo?.terreno || tocaGleba(d.terreno) || ctx.perfil?.id !== torrePerfil) sujo = true;
      if (sujo || d.arcologia || d.tudo?.predios || !chave) montar(esp);
    },
    quadro(tMs, c) {
      aquecer.quadro();
      estadoDoCeu(c, estadoCeu);
      atualizarArcologia(c, tMs, estadoCeu);
      quadroAgua(tMs);
      matFantasma.uniforms.uNoiteF.value = estadoCeu.noite;
      torre?.quadro();
      quadroPartes();
    },
    /** Vista pedida por uma cena (null volta ao jogo). */
    vitrine(v) {
      vitrine = v ?? null;
      sujo = true;
      montar(ctx.sim?.espelho);
    },
    /** Refaz tudo (a cena mexeu no chão). */
    refazer() {
      sujo = true;
      montar(ctx.sim?.espelho);
    },
    get torre() {
      return torre;
    },
    get partes() {
      return partes;
    },
    get lodPartes() {
      return lodPartes;
    },
    /** Os materiais da Arcologia (o conjunto fixo, a água e o fantasma): o teste de programas e a bancada leem. */
    get materiais() {
      return [...mats.lista, matAgua, matFantasma];
    },
    /** Raio da tela contra as caixas das partes e as torres: { tipo: 'arcologia', idx da parte, ponto, dist }. */
    selecionar(raio) {
      const o = raio.origem;
      const dv = raio.dir;
      let melhor = null;
      // raio contra uma caixa [x0, y0, z0, x1, y1, z1]; oo e dd são o raio no espaço da caixa (o mundo, ou o local da
      // Torre, que só gira e desloca: a distância t é a mesma nos dois)
      const testar = (b, idx, oo = o, dd = dv) => {
        let t0 = 0;
        let t1 = Infinity;
        for (let e = 0; e < 3; e++) {
          const lo = b[e];
          const hi = b[e + 3];
          if (Math.abs(dd[e]) < 1e-9) {
            if (oo[e] < lo || oo[e] > hi) return;
            continue;
          }
          let a = (lo - oo[e]) / dd[e];
          let bb = (hi - oo[e]) / dd[e];
          if (a > bb) [a, bb] = [bb, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, bb);
          if (t0 > t1) return;
        }
        if (!melhor || t0 < melhor.dist) melhor = { tipo: 'arcologia', ref: null, idx, dist: t0, ponto: [o[0] + dv[0] * t0, o[1] + dv[1] * t0, o[2] + dv[2] * t0] };
      };
      if (torre?.grupo) {
        // as torres: o raio levado ao espaço local (girado pelo plano) contra a caixa do pódio ao mastro
        const g = torre.grupo;
        const c = Math.cos(g.rotation.y);
        const sn = Math.sin(g.rotation.y);
        const ox = o[0] - g.position.x;
        const oz = o[2] - g.position.z;
        testar(torre.gemeas ? CAIXA_PAR : CAIXA_TORRE, PARTES_ORDEM.indexOf('torre'), [c * ox - sn * oz, o[1] - g.position.y, sn * ox + c * oz], [c * dv[0] - sn * dv[2], dv[1], sn * dv[0] + c * dv[2]]);
      }
      for (const c of partes?.caixas ?? []) testar(c.caixa, c.idx);
      return melhor;
    },
    descartar() {
      torre?.descartar();
      limparPartes();
      if (torreFantasma) torreFantasma.geometry.dispose();
      aquecer.descartar();
      matAgua.dispose();
      matFantasma.dispose();
      // os materiais da Arcologia são deste render
      descartarMateriais(ctx);
      ctx.cena.remove(raiz);
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('arcologia', criarDominio);
  api.registrarSelecionavel('arcologia', (raio, ctx) => ctx.dominio('arcologia')?.selecionar?.(raio) ?? null);
}
