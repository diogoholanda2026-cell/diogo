// Índice dos colocáveis (R5, D45, D60): os serviços e os prédios da Holding. Importado pelo worker `oficina` e pelo
// render; registrar(api) recebe a api do lugar onde roda:
//   no worker (api.registrarGeradorOficina): o gerador 'colocavel' (gerador.js). Ele vem por import(): o esbuild põe
//     o módulo dentro do worker (IIFE) e, no pacote do jogo, num pedaço sob demanda (A1); no worker a promessa resolve
//     antes da primeira mensagem. Sem worker, o despachante local da thread principal carrega o mesmo pedaço.
//   no render (api.registrarDominio): a seleção 'colocavel' (pela caixa que o domínio guarda, ou pela planta com a
//     altura da tabela enquanto ele não tem a malha).
// O desenho (o domínio 'colocaveis', com o three) mora em dominio.js e desenho.js: este índice não importa o three
// nem nada que o importe, porque o worker o importa (o three inteiro passaria do teto do worker, A1).
import { COLOCAVEIS, tipoColocavel } from '../../data/colocaveis.js';
import { TIPO_PREDIO } from '../../contratos/flags.js';
import { refDe } from '../../contratos/espelho.js';
import { PRIORIDADE } from '../camera/selecao.js';

let gerador = null;
let carregando = null;

/** Carrega o gerador (uma vez); a promessa resolve com o módulo. */
export function carregarGerador() {
  carregando ??= import('./gerador.js').then((m) => {
    gerador = m;
    return m;
  });
  return carregando;
}

/** O gerador da oficina: síncrono (o despachante responde na hora); o módulo já chegou quando a mensagem chega. */
function gerarNaOficina(dados) {
  if (!gerador) throw new Error('colocaveis: o gerador ainda está carregando');
  return gerador.gerarColocaveis(dados);
}

/**
 * Raio contra a caixa c = [x0, z0, x1, z1, y0, y1] do lote (centro cx, cy, cz e giro rot, na convenção do espelho).
 * Devolve a distância ou null.
 */
export function raioNaCaixaDoLote(o, d, cx, cy, cz, rot, c) {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const ox = o[0] - cx;
  const oz = o[2] - cz;
  const lo = [ox * cs - oz * sn, o[1] - cy, ox * sn + oz * cs];
  const ld = [d[0] * cs - d[2] * sn, d[1], d[0] * sn + d[2] * cs];
  const lim = [[c[0], c[2]], [c[4], c[5]], [c[1], c[3]]];
  let t0 = 0;
  let t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(ld[k]) < 1e-9) {
      if (lo[k] < lim[k][0] || lo[k] > lim[k][1]) return null;
      continue;
    }
    let a = (lim[k][0] - lo[k]) / ld[k];
    let b = (lim[k][1] - lo[k]) / ld[k];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
}

/**
 * Seleção dos colocáveis: o mais perto que o raio acerta, pela caixa do modelo (caixaDe(i), do domínio) ou pela
 * planta com a altura da tabela.
 */
export function selecionarColocavel(raio, esp, caixaDe = () => null) {
  const P = esp?.predios;
  if (!P) return null;
  const o = raio.origem;
  const d = raio.dir;
  let melhor = null;
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i] || P.tipo[i] === TIPO_PREDIO.ZONA) continue;
    const tipo = tipoColocavel(P.tipo[i], P.modelo[i]);
    if (!tipo) continue;
    const c = caixaDe(i) ?? [-P.w[i] / 2, -P.d[i] / 2, P.w[i] / 2, P.d[i] / 2, 0, COLOCAVEIS[tipo].altura];
    const t = raioNaCaixaDoLote(o, d, P.x[i], P.y[i], P.z[i], P.rot[i], c);
    if (t !== null && (!melhor || t < melhor.dist)) melhor = { tipo: 'colocavel', idx: i, ref: refDe(i, P.ger[i]), dist: t, ponto: [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] };
  }
  return melhor;
}

export function registrar(api) {
  if (api.registrarGeradorOficina) {
    carregarGerador();
    api.registrarGeradorOficina('colocavel', gerarNaOficina);
  }
  if (api.registrarSelecionavel && api.registrarDominio) {
    api.registrarSelecionavel(
      'colocaveis',
      (raio, ctx) => {
        const dom = ctx.dominio('colocaveis');
        return selecionarColocavel(raio, ctx.sim.espelho, (i) => dom?.caixa?.(i) ?? null);
      },
      { prioridade: PRIORIDADE.mundo },
    );
  }
}
