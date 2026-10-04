// Cena 'rua' (desenho do render 15.2, A6 e A10: 16h): a avenida comercial do bairro Sudeste da cidade sintética, com
// canteiro de palmeiras, cruzamento com semáforo, faixas do CTB, calçadas, postes, árvores, carros, gente e caminhões.
// ?vista= troca a câmera sem sair do lugar: rasante (padrão: no nível da rua, olhando a avenida), 300 (a vista de
// 300 m do bairro), cruzamento (de cima, a 45 graus: meio-fio, zebras e retenção), fila (a chegada ao cruzamento,
// com a fila no vermelho e a gente na faixa), caminhao (um comboio de caminhões da Holding pela avenida, com brita,
// tijolo, areia e concreto, a câmera indo junto), calcada (VIS1b: a gente na calçada de perto, a câmera na pista
// olhando o grupo mais cheio perto do cruzamento, de três quartos) e orla (a avenida da orla com pedra portuguesa);
// ?hora= a hora do céu (21 dá a noite com a luz da rua e os faróis; 18 põe o sol baixo atrás da câmera na rasante).
// A cena espera a oficina entregar os setores de vias e de prédios da vista, povoa o tráfego e a gente, adianta a rua
// 40 s (as filas se formam e a gente se espalha antes da primeira imagem; na vista fila, até o fim de um vermelho com
// 3 carros parados na chegada pelo oeste) e deixa tudo andando; o resultado traz as medidas das vias, dos objetos,
// dos carros, da gente e dos caminhões, a fila e as famílias do quadro.

import { Rede } from '../mundo/vias.js';
import { GradeSetores } from '../mundo/setores.js';
import { planoDaRota, distanciaDaViagem, poseDaViagem } from '../mundo/caminhoes.js';
import { faseSemaforo, restaVermelho } from '../mundo/trafego.js';
import { grupoSemaforo, defasagemSemaforo } from '../geracao/cruzamento.js';

/**
 * O cruzamento da avenida com a rua no Sudeste da cidade sintética (nó 336) e as vistas. Com a área inicial da D90 o
 * cruzamento de antes, em (907, 526,3), caiu no disco da sede; este é o mais perto fora dele (133 m da borda), na mesma
 * avenida, e as vistas andaram junto (175,3 m para leste e 3,1 m para o sul).
 */
export const RUA = Object.freeze({ x: 1082.3, z: 529.4 });
export const VISTAS_RUA = Object.freeze({
  // na faixa da direita da avenida, 30 m antes do cruzamento, olhando para leste
  rasante: { x: 1055.3, z: 534.3, dist: 16, inclinacao: 4, guinada: 92 },
  300: { x: 1087.3, z: 523.1, dist: 300, inclinacao: 32, guinada: 38 },
  cruzamento: { x: 1082.3, z: 529.4, dist: 70, inclinacao: 48, guinada: 62 },
  // a chegada pela avenida (as faixas para leste), de cima e de trás da fila: a retenção, a zebra e quem atravessa
  fila: { x: 1063, z: 535, dist: 34, inclinacao: 26, guinada: 90 },
  // o comboio (a câmera vai junto do segundo caminhão; esta é a de partida)
  caminhao: { x: 1040, z: 534, dist: 26, inclinacao: 14, guinada: 92 },
  // a calçada de perto: a de partida (a cena troca pelo grupo mais cheio perto do cruzamento)
  calcada: { x: 1076, z: 541, dist: 10, inclinacao: 6, guinada: 140 },
  orla: { x: 1543, z: 1570, dist: 30, inclinacao: 5, guinada: 110 },
});

/**
 * Vista calcada: o grupo de gente mais cheio (vizinhos a menos de 8 m) a até `raio` m do cruzamento da cena, fora da
 * travessia, e a câmera na pista (do lado do eixo da via dele), olhando a calçada quase de lado. pessoas: pedestres.amostra(); rede:
 * a do domínio vias. Devolve { x, z, dist, inclinacao, guinada, n } ou null sem gente.
 */
export function vistaDaCalcada(pessoas, rede, raio = 70) {
  const perto = pessoas.filter((p) => p.estado !== 'esquina' && Math.hypot(p.x - RUA.x, p.z - RUA.z) < raio);
  let melhor = null;
  for (const p of perto) {
    let n = 0;
    for (const q of perto) if (Math.hypot(q.x - p.x, q.z - p.z) < 8) n += q.n;
    if (!melhor || n > melhor.n) melhor = { p, n };
  }
  if (!melhor) return null;
  const { p } = melhor;
  // o ponto do eixo da via mais perto (a curva de Bézier da aresta) dá o lado da pista
  const ar = rede?.arestas.get(p.e);
  let ux = RUA.x - p.x;
  let uz = RUA.z - p.z;
  if (ar?.p) {
    let d2 = Infinity;
    for (let k = 0; k <= 32; k++) {
      const t = k / 32;
      const a = (1 - t) ** 3;
      const b = 3 * (1 - t) ** 2 * t;
      const c = 3 * (1 - t) * t * t;
      const d = t ** 3;
      const x = a * ar.p[0] + b * ar.p[2] + c * ar.p[4] + d * ar.p[6];
      const z = a * ar.p[1] + b * ar.p[3] + c * ar.p[5] + d * ar.p[7];
      const q = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (q < d2) {
        d2 = q;
        ux = x - p.x;
        uz = z - p.z;
      }
    }
  }
  const l = Math.hypot(ux, uz) || 1;
  // a câmera fica do lado da pista (a direção do alvo para a câmera é (-sen g, cos g)), girada 50 graus para pegar a
  // calçada ao comprido, com o grupo no meio
  const guinada = (Math.atan2(-ux / l, uz / l) * 180) / Math.PI + 50;
  return { x: p.x, z: p.z, dist: 10, inclinacao: 8, guinada, n: melhor.n };
}

/** O comboio da vista caminhao: as cargas da Holding do M1a, uma por caminhão. */
export const COMBOIO = Object.freeze([['brita', 10], ['tijolo', 8], ['areia', 10], ['concreto', 10]]);

/**
 * Caminho de entrega pela avenida a partir de um nó, seguindo em frente (o braço mais alinhado) por uns `metros`:
 * Int32Array no formato de espelho.entregas (idx de a para b, ~idx de b para a). Também serve aos testes.
 */
export function caminhoEmFrente(rede, n0, metros = 600, direcao = null) {
  const refs = [];
  let n = n0;
  let dir = direcao;
  let total = 0;
  let veio = -1;
  for (let k = 0; k < 40 && total < metros; k++) {
    const no = rede.nos.get(n);
    if (!no) break;
    let melhor = null;
    for (const b of no.analise.bracos) {
      if (b.e === veio) continue;
      const ar = rede.arestas.get(b.e);
      if (!ar || ar.mao === (b.inverte ? 1 : -1)) continue;
      const alinhado = dir ? b.dx * dir[0] + b.dz * dir[1] : b.P.velocidade / 100;
      if (!melhor || alinhado > melhor.alinhado) melhor = { b, ar, alinhado };
    }
    // em frente quando dá; senão, a virada mais suave (a avenida pode acabar numa rua)
    if (!melhor || (dir && melhor.alinhado < -0.3)) break;
    const { b, ar } = melhor;
    refs.push(b.inverte ? ~ar.e : ar.e);
    total += ar.L;
    veio = ar.e;
    n = b.inverte ? ar.a : ar.b;
    // a direção de chegada no nó seguinte (a tangente da aresta no fim)
    const p = ar.p;
    const [fx, fz] = b.inverte ? [p[0] - p[2], p[1] - p[3]] : [p[6] - p[4], p[7] - p[5]];
    const l = Math.hypot(fx, fz) || 1;
    dir = [fx / l, fz / l];
  }
  return Int32Array.from(refs);
}

/**
 * Vista fila: adianta a rua 40 s e depois de meio em meio segundo até o fim de um vermelho de quem chega ao cruzamento
 * da cena pelo oeste (faltando até 6 s) com a fila formada (3 carros parados na chegada), no máximo `max` s. Devolve
 * os segundos adiantados e os parados na chegada.
 */
export function adiantarAteFila(trafego, rede, ctx, max = 240) {
  trafego.avancar(40, ctx);
  const no = rede && [...rede.nos.values()].find((n) => Math.hypot(n.x - RUA.x, n.z - RUA.z) < 1);
  const b = no?.analise.bracos.find((x) => x.dx < -0.9);
  const ar = b && rede.arestas.get(b.e);
  if (!ar || !no.semaforos) return { segundos: 40, parados: 0 };
  const g = grupoSemaforo(b.theta);
  const defas = defasagemSemaforo(no.n);
  const chega = (c) => c.e === ar.e && !c.curva && (c.sentido > 0 ? ar.b : ar.a) === no.n && c.v < 0.3;
  let t = 40;
  let parados = 0;
  for (; t < max; t += 0.5) {
    const tempo = ctx.relogioRua ?? 0;
    if (faseSemaforo(tempo, g, defas) === 2 && restaVermelho(tempo, g, defas) <= 6) {
      parados = trafego.amostra().filter(chega).length;
      if (parados >= 3) break;
    }
    trafego.avancar(0.5, ctx);
  }
  return { segundos: t, parados };
}

export function registrar(registrarCena) {
  registrarCena('rua', {
    sim: 'sintetica',
    hora: 16,
    camera: { ...VISTAS_RUA.rasante },
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const nome = qs.get('vista') ?? 'rasante';
      const v = VISTAS_RUA[nome] ?? VISTAS_RUA.rasante;
      ctx.cameraApi.definir({ ...v });
      const falhas = [];
      const vias = ctx.dominio('vias');
      const predios = ctx.dominio('predios');
      const trafego = ctx.dominio('trafego');
      const pedestres = ctx.dominio('pedestres');
      const caminhoes = ctx.dominio('caminhoes');
      if (!vias?.preparar) falhas.push('o domínio vias é o substituto da F0 (a R3a não registrou)');
      // o comboio: quatro caminhões pela avenida, vindo do leste, passando o cruzamento da cena e seguindo. A rota sai
      // de uma rede lida aqui (a mesma conta da de vias.js), para a câmera já começar junto do comboio
      const ids = [];
      if (nome === 'caminhao' && caminhoes?.amostras) {
        const esp = ctx.sim.espelho;
        const rede = new Rede(new GradeSetores({ tam: esp.mapa?.tam ?? 8192, origem: esp.mapa?.origem ?? [-4096, -4096] }));
        rede.tudo(esp);
        const no = [...rede.nos.values()].find((n) => Math.hypot(n.x - RUA.x, n.z - RUA.z) < 1);
        const ida = no ? caminhoEmFrente(rede, no.n, 700, [1, 0]) : new Int32Array(0);
        // o mesmo caminho ao contrário (do leste para o cruzamento) e depois para oeste
        const volta = Int32Array.from([...ida].reverse().map((r) => ~r));
        const oeste = no ? caminhoEmFrente(rede, no.n, 300, [-1, 0]) : new Int32Array(0);
        const caminho = Int32Array.from([...volta, ...oeste]);
        const pl = planoDaRota(rede, caminho);
        if (!pl) falhas.push('a avenida da cena não tem caminho para o comboio');
        const agora = caminhoes.agora(ctx);
        const lista = COMBOIO.map(([item, n], k) => {
          const id = 900001 + k;
          ids.push(id);
          // espaçados uns 50 m (4 s a 45 km/h); a viagem leva o tempo da rua mais 20 s de pontas fora da via
          const tIni = agora - 30 + k * 4.2;
          return { id, item, n, caminho, tIni, tFim: tIni + (pl?.T ?? 90) + 20, visual: false };
        });
        caminhoes.amostras(lista);
        if (pl) {
          const d = distanciaDaViagem(lista[1], pl, agora) ?? 0;
          const p = poseDaViagem(pl, d);
          ctx.cameraApi.definir({ x: p.x, z: p.z, dist: v.dist, inclinacao: v.inclinacao, guinada: (Math.atan2(p.hx, -p.hz) * 180) / Math.PI + 180 - 32 });
        }
      }
      try {
        await Promise.all([vias?.preparar?.({ teto: 180000 }), predios?.preparar?.({ teto: 180000 }), pedestres?.preparar?.(), caminhoes?.preparar?.()]);
        if (vias?.pronto && !vias.pronto()) falhas.push('a oficina não entregou todos os setores de vias da vista a tempo');
      } catch (e) {
        falhas.push(`preparar falhou: ${e?.message ?? e}`);
      }
      trafego?.povoar?.(ctx);
      await pedestres?.povoar?.(ctx);
      // 40 s de rua antes da primeira imagem; na vista da fila, até o fim de um vermelho de quem chega pelo oeste com
      // a fila formada
      let fila = null;
      if (nome === 'fila' && trafego?.avancar) fila = adiantarAteFila(trafego, vias?.rede, ctx);
      else trafego?.avancar?.(40, ctx);
      let calcada = null;
      if (nome === 'calcada') {
        calcada = vistaDaCalcada(pedestres?.amostra?.() ?? [], vias?.rede);
        if (calcada) ctx.cameraApi.definir({ x: calcada.x, z: calcada.z, dist: calcada.dist, inclinacao: calcada.inclinacao, guinada: calcada.guinada });
        else falhas.push('nenhum grupo de gente perto do cruzamento para a vista calcada');
        ctx.vegetacao?.preparar?.();
      }
      trafego?.animar?.(true);
      pedestres?.animar?.(true);
      caminhoes?.animar?.(true);
      return {
        quadro() {
          if (nome !== 'caminhao' || !caminhoes?.estado) return;
          // a câmera vai junto do segundo caminhão, de frente, um pouco de lado
          const st = caminhoes.estado(ids[1]);
          if (!st) return;
          const ant = this._ant ?? st;
          const hx = st.x - ant.x;
          const hz = st.z - ant.z;
          if (Math.hypot(hx, hz) > 0.05) this._guinada = (Math.atan2(hx, -hz) * 180) / Math.PI + 180 - 32;
          this._ant = st;
          ctx.cameraApi.definir({ x: st.x, z: st.z, dist: v.dist, inclinacao: v.inclinacao, guinada: this._guinada ?? v.guinada });
        },
        resultado() {
          const s = ctx.stats;
          const mv = vias?.medidas?.() ?? null;
          // a conferência roda a cada chamada, sem acumular na lista da montagem
          const agora = [...falhas];
          if (mv && !mv.visiveis) agora.push('nenhum setor de via desenhado');
          return {
            ok: agora.length === 0,
            falhas: agora,
            vista: nome,
            vias: mv,
            objetos: ctx.dominio('props')?.medidas?.() ?? null,
            arvores: ctx.vegetacao?.medidas?.() ?? null,
            lotes: ctx.dominio('lotes')?.medidas?.() ?? null,
            calcada,
            carros: trafego?.medidas?.() ?? null,
            fila,
            pessoas: pedestres?.medidas?.() ?? null,
            caminhoes: caminhoes?.medidas?.() ?? null,
            luzRua: ctx.luzRua ? { luzes: ctx.luzRua.luzes, versao: ctx.luzRua.versao } : null,
            quadro: { calls: s.calls, tris: s.tris, callsSombra: s.callsSombra, trisSombra: s.trisSombra, familias: { ...s.familias } },
          };
        },
      };
    },
  });
}
