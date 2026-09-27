// Planos diretores da Arcologia (D59) e o domínio 'arcologia' do render: a Torre, o reservatório e as partes do plano
// no mundo. No jogo, o plano é o do espelho (ou o escolhido, ou o padrão enquanto ninguém escolheu); a Torre aparece
// pronta quando torre.e4 fica pronta e, antes disso, como fantasma (a obra por etapas é da X1b); o reservatório aparece
// quando lago.e1 fica pronta e o chão já foi cavado (o aplainar); as outras partes são fantasma com a silhueta LOD1
// de verdade (D26). As cenas pedem outras vistas pelo domínio:
//   ctx.dominio('arcologia').vitrine({ modo: 'torre' })               só a Torre, pronta, com a esplanada
//   ctx.dominio('arcologia').vitrine({ modo: 'plano', plano: 'B' })   o plano inteiro construído, com a paisagem, as
//                                                                      vias internas e os portões candidatos
//   ctx.dominio('arcologia').vitrine(null)                            volta ao jogo
// Chamadas no Média: Torre 2, partes 3 (vidro, opaco, árvores), água 1, fantasma 1, sombra 2 (callsSombra).
import * as THREE from 'three';
import { alturaEm } from '../../comum/altura.js';
import { pontoNoPoligono } from '../../comum/vetor.js';
import { ETAPA } from '../../contratos/flags.js';
import { PLANOS, PLANO_ESCOLHIDO, PLANO_PADRAO, PARTES_ORDEM, GLEBA_ENVELOPE } from '../../data/arcologia-plano.js';
import {
  criarTorre, atualizarArcologia, estadoDoCeu, materiais, geometriaDe, Malha, acab, PADRAO, tampa, arvore, hashF,
  orientar, triangular, caixa, bloco, cilindro, NIVEL, malhasTorreLod1, contornoPodio,
} from './torre.js';
import { montarParte, deslocar } from './partes.js';
import { montarReservatorio, materialAgua, quadroAgua, PASSEIO } from './lago.js';
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
  let u = 0;
  for (let i = 0; i + 1 < lados.length; i++) {
    const [e0, d0] = lados[i];
    const [e1, d1] = lados[i + 1];
    const du = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
    const v = (p) => [p[0], chao(p[0], p[1]) + dy, p[1]];
    m.quad(v(e0), v(d0), v(d1), v(e1), [0, 1, 0], [e0[0], e0[1]], [d0[0], d0[1]], [d1[0], d1[1]], [e1[0], e1[1]], k);
    u += du;
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

/**
 * Paisagem de um plano: parques e praças deitados no relevo, passeios (pedra portuguesa no plano C, o calçadão do
 * Aterro), bosques e fileiras de árvores (palmeiras-imperiais nos passeios de orla), vias internas candidatas
 * (avenida de 24 m com canteiro de palmeiras) e os portões.
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
  P.parques.forEach((poly, i) => {
    deitar(opaco, poly, chao, 0.14, i % 2 ? KP.gramaEscura : KP.grama);
    // caminho de 3 m em volta: a borda do parque lê como paisagismo (Burle Marx), não como um tapete colado no chão
    const C = orientar(poly);
    fita(opaco, [...C, C[0], C[1]], 3, chao, 0.18, orla ? KP.portuguesa : KP.calcada);
  });
  for (const poly of P.pracas) deitar(opaco, poly, chao, 0.2, orla ? KP.portuguesa : KP.piso);
  for (const ps of P.passeios) {
    fita(opaco, ps.caminho, ps.largura, chao, 0.24, orla ? KP.portuguesa : KP.piso);
    const palmas = orla || ps.largura >= 14;
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
  // maciços de árvores dentro dos parques (grade larga e mexida; clareiras onde o hash não planta)
  P.parques.forEach((poly, ip) => {
    const C = orientar(poly);
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
  P.parques.forEach((poly, ip) => {
    const C = orientar(poly);
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
  // vias internas candidatas: avenida de 24 m (calçada 3, pista 7, canteiro 4 com palmeiras, pista 7, calçada 3)
  for (const v of plano.vias) {
    fita(opaco, v.pontos, 24, chao, 0.1, KP.calcada);
    fita(opaco, v.pontos, 7, chao, 0.13, KP.asfalto, -5.5);
    fita(opaco, v.pontos, 7, chao, 0.13, KP.asfalto, 5.5);
    fita(opaco, v.pontos, 4, chao, 0.16, KP.canteiro);
    for (const q of aoLongoDe(v.pontos, 14)) plantar(q.x, q.z, { tipo: 'palmeira', altura: 15 + 4 * hashF(Math.round(q.x), 9), raio: 3.2, semente: Math.round(q.x + q.z * 3) });
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

/**
 * Malhas de um plano (sem a Torre, que é do torre.js): as partes prontas em material de verdade, as outras no
 * fantasma, o reservatório e, se pedida, a paisagem.
 * @param {string} id  'A' | 'B' | 'C'
 * @param {{ chao: Function, prontas: Set<string> | 'todas', lagoReal?: boolean, paisagem?: boolean, nivel?: number }} op
 */
export function malhasDoPlano(id, { chao, prontas = 'todas', lagoReal = true, paisagem = true, nivel = 1 } = {}) {
  const plano = PLANOS[id];
  const real = { vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco'), agua: new Malha('agua') };
  const sombra = { vidro: new Malha('vidro'), opaco: new Malha('opaco') };
  const fant = { vidro: new Malha('vidro'), opaco: new Malha('opaco'), arvores: new Malha('opaco') };
  const caixas = [];
  const cota = chao(plano.torre.x, plano.torre.z);
  const lago = plano.partes.find((p) => p.id === 'lago');
  const res = lago.pecas.find((p) => p.tipo === 'reservatorio');
  const nivelAgua = cota + res.nivel;
  for (const parte of plano.partes) {
    if (parte.id === 'torre') continue;
    const pronta = prontas === 'todas' || prontas.has(parte.id);
    const idx = PARTES_ORDEM.indexOf(parte.id);
    if (parte.id === 'lago') {
      if (pronta && lagoReal) {
        const r = montarReservatorio(res, { opaco: real.opaco, agua: real.agua, cota });
        caixas.push({ parte: parte.id, idx, caixa: r.caixa });
      } else {
        // espelho prometido: o contorno da água em holograma, logo acima do chão
        tampa(fant.opaco, orientar(res.contorno), cota + 0.4, [0, 0, 0, 0], true);
      }
      const outras = { ...parte, pecas: parte.pecas.filter((p) => p.tipo !== 'reservatorio') };
      if (outras.pecas.length) {
        const r = montarParte(outras, { chao, nivelAgua, ...(pronta && lagoReal ? real : fant) });
        for (const c of r.caixas) caixas.push({ parte: parte.id, idx, caixa: c });
      }
      continue;
    }
    const alvo = pronta ? real : fant;
    const r = montarParte(parte, { chao, nivelAgua, ...alvo });
    for (const c of r.caixas) caixas.push({ parte: parte.id, idx, caixa: c });
    if (pronta) montarParte(parte, { chao, nivelAgua, vidro: sombra.vidro, opaco: sombra.opaco, arvores: null });
  }
  let nArvores = 0;
  if (paisagem) {
    // o espelho d'água e a esplanada da Torre ficam livres de árvores
    const T = plano.torre;
    const fora = (x, z) => {
      const dx = x - T.x;
      const dz = z - T.z;
      if (Math.hypot(dx, dz) < 72) return true;
      return pontoNoPoligono(x, z, deslocar(orientar(res.contorno), PASSEIO * 0.5));
    };
    nArvores = montarPaisagem(plano, { chao, opaco: real.opaco, arvores: real.arvores, nivel, fora }).arvores;
  }
  return { real, fantasma: fant, sombra, caixas, nivelAgua, cota, arvores: nArvores };
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

// ================================================================================================ domínio

function criarDominio(ctx) {
  const raiz = new THREE.Group();
  raiz.name = 'arcologia';
  ctx.cena.add(raiz);
  const mats = materiais(ctx);
  const matAgua = materialAgua(ctx.ganchos);
  mats.lista.add(matAgua);
  const matFantasma = materialFantasma(ctx.ganchos);
  let torre = null;
  let torreFantasma = null;
  let partes = null; // { grupo, caixas, gemeo, volume }
  let vitrine = null; // { modo, plano }
  let chave = '';
  let sujo = true;
  const estadoCeu = {};

  const limparPartes = () => {
    if (!partes) return;
    raiz.remove(partes.grupo);
    if (partes.volume) ctx.sombra.soltar(partes.volume);
    partes.grupo.traverse((o) => o.geometry?.dispose());
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
    const cota = chao(P.torre.x, P.torre.z);
    const [cx, cz] = pontoDentro(res.contorno);
    const cavado = chao(cx, cz) < cota + res.nivel - 0.5;
    const lagoPronto = modo === 'plano' || estadoEtapa(esp, 'lago.e1') === ETAPA.PRONTA;
    const nova = `${modo}|${plano}|${torrePronta}|${lagoPronto}|${cavado}|${ctx.perfil?.id}|${T?.altura?.length ?? 0}`;
    if (nova === chave && !sujo) return;
    chave = nova;
    sujo = false;

    // Torre: pronta (LOD0/LOD1) ou fantasma
    if (!torre) {
      torre = criarTorre(ctx);
      raiz.add(torre.grupo);
    }
    const yT = chao(P.torre.x, P.torre.z);
    torre.posicionar(P.torre.x, yT, P.torre.z, P.torre.rot);
    torre.grupo.visible = torrePronta;
    if (torreFantasma) {
      raiz.remove(torreFantasma);
      torreFantasma.geometry.dispose();
      torreFantasma = null;
    }
    if (!torrePronta) {
      const m1 = malhasTorreLod1();
      torreFantasma = criarFantasma(ctx, malhaFantasma(m1.vidro, m1.opaco), matFantasma);
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
    const add = (malha, mat, fam, nome) => {
      if (!malha.triangulos) return null;
      const o = new THREE.Mesh(geometriaDe(malha), mat);
      o.name = nome;
      ctx.medidas.familia(o, fam);
      grupo.add(o);
      return o;
    };
    add(m.real.vidro, mats.vidroLod1, 'arcologia', 'plano:vidro');
    add(m.real.opaco, mats.opaco, 'arcologia', 'plano:opaco');
    add(m.real.arvores, mats.opaco, 'arvores', 'plano:arvores');
    add(m.real.agua, matAgua, 'resto', 'plano:agua');
    const f = criarFantasma(ctx, malhaFantasma(m.fantasma.vidro, m.fantasma.opaco, m.fantasma.arvores), matFantasma);
    if (f) grupo.add(f);
    // volume de sombra das partes prontas (os volumes LOD1, sem chão nem árvores)
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
    partes = { grupo, caixas: m.caixas, volume, plano, arvores: m.arvores };
  }

  const tmpC = new THREE.Vector3();
  const dom = {
    nome: 'arcologia',
    aplicar(d, esp) {
      if (d.arcologia || d.tudo?.terreno || d.terreno?.length || !chave) sujo = true;
      if (sujo) montar(esp);
    },
    quadro(tMs, c) {
      estadoDoCeu(c, estadoCeu);
      atualizarArcologia(c, tMs, estadoCeu);
      quadroAgua(tMs);
      matFantasma.uniforms.uNoiteF.value = estadoCeu.noite;
      torre?.quadro();
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
    /** Raio da tela contra as caixas das partes e a Torre: { tipo: 'arcologia', idx da parte, ponto, dist }. */
    selecionar(raio) {
      const o = raio.origem;
      const dv = raio.dir;
      let melhor = null;
      const testar = (b, idx) => {
        let t0 = 0;
        let t1 = Infinity;
        for (let e = 0; e < 3; e++) {
          const lo = b[e];
          const hi = b[e + 3];
          if (Math.abs(dv[e]) < 1e-9) {
            if (o[e] < lo || o[e] > hi) return;
            continue;
          }
          let a = (lo - o[e]) / dv[e];
          let bb = (hi - o[e]) / dv[e];
          if (a > bb) [a, bb] = [bb, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, bb);
          if (t0 > t1) return;
        }
        if (!melhor || t0 < melhor.dist) melhor = { tipo: 'arcologia', ref: null, idx, dist: t0, ponto: [o[0] + dv[0] * t0, o[1] + dv[1] * t0, o[2] + dv[2] * t0] };
      };
      if (torre?.grupo) {
        // a Torre: caixa local levada ao mundo (aproximada pela esfera de 30 m do eixo)
        const g = torre.grupo;
        tmpC.set(0, 0, 0).applyMatrix4(g.matrixWorld);
        testar([tmpC.x - 28, tmpC.y, tmpC.z - 28, tmpC.x + 28, tmpC.y + 350, tmpC.z + 28], PARTES_ORDEM.indexOf('torre'));
      }
      for (const c of partes?.caixas ?? []) testar(c.caixa, c.idx);
      return melhor;
    },
    descartar() {
      torre?.descartar();
      limparPartes();
      if (torreFantasma) torreFantasma.geometry.dispose();
      matAgua.dispose();
      matFantasma.dispose();
      ctx.cena.remove(raiz);
    },
  };
  return dom;
}

export function registrar(api) {
  api.registrarDominio('arcologia', criarDominio);
  api.registrarSelecionavel('arcologia', (raio, ctx) => ctx.dominio('arcologia')?.selecionar?.(raio) ?? null);
}

export { contornoPodio, bloco, cilindro };
