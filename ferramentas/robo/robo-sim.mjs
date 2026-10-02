// Robô da simulação (A4, A5; dona: S3a): a estratégia de jogo pelo mesmo cmd() da interface, no Node e no navegador,
// e o relatório de marcos, moradores, bem-estar, renda, caixa, dívida, fila da frota, objetivos e ms por tique (p95,
// p99 e máximo), com o cenário de uma via a cada 10 tiques. O simular --robo chama.
//
//   node ferramentas/robo/robo-sim.mjs [--horas 12] [--semente s] [--comprarTempo] [--fazDeConta] [--json arquivo]
//
// Modos: com a cidade da S2a publicada, o robô joga a cidade de verdade (vias, zonas, serviços pelo construir); com
// --fazDeConta (ou sem a S2a), a cidade é a de faz de conta pelos agregados (cidade-faz-de-conta.mjs), com as vias e
// as zonas de verdade. Sem a X1b, a Arcologia não anda e o marco 7 não chega (o relatório diz).
// No navegador: import { criarEstrategia } e chame estrategia.passo() a cada rodada (20 tiques) com a sim do jogo.
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { criarSimulacao } from '../../fonte/sim/estado.js';
import { ZONAS_ORDEM } from '../../fonte/data/zonas.js';
import { VIAS_ORDEM } from '../../fonte/data/vias.js';
import { XP } from '../../fonte/data/marcos.js';
import { dataDoTique, ANO_INICIAL } from '../../fonte/data/historia.js';
import { idxDaRef } from '../../fonte/contratos/espelho.js';
import { ligarCidadeFalsa, SERVICOS_FALSOS } from './cidade-faz-de-conta.mjs';

const RODADA = 20;
const HORA = 3600;
const MIN = 60;
const z = (id) => ZONAS_ORDEM.indexOf(id);
const TIPOS_VIA = Object.fromEntries(VIAS_ORDEM.map((id, i) => [id, i]));

/** Minutos de jogo de um tique, como "1:05" (h:mm). */
export const hm = (t) => `${Math.floor(t / HORA)}:${String(Math.floor((t % HORA) / MIN)).padStart(2, '0')}`;

const temComando = (sim, nome) => !!sim._comandos?.get(nome);

/**
 * A estratégia do robô. op: { comprarTempo, cidadeFalsa (de ligarCidadeFalsa ou null), registro (lista de ações) }.
 * passo() decide uma rodada: decisões, vias, zonas, serviços, Holding, Arcologia, empréstimo e Depósito.
 */
export function criarEstrategia(sim, { comprarTempo = false, cidadeFalsa = null, anotar = () => {}, ritmo = 60 } = {}) {
  const E = {
    sessao: 0,
    feito: new Set(),
    blocos: [], // { x0, z0, x1, z1, zona, feito }
    tentativasBloco: 0,
    servicos: {},
    holding: {},
    ultimaVenda: 0,
    falhas: {},
  };
  // ritmo de gente: no máximo uma obra (via, prédio, serviço) a cada `ritmo` tiques
  const OBRAS = new Set(['via.construir', 'construir']);
  let proximaObra = 0;
  const podeObra = () => sim.tique >= proximaObra;
  const cmd = (nome, args) => {
    if (OBRAS.has(nome) && !podeObra()) return { ok: false, codigo: 'ritmo' };
    let r;
    try {
      r = sim.cmd(nome, args);
    } catch (e) {
      r = { ok: false, codigo: 'erro', dados: { mensagem: String(e?.message ?? e) } };
    }
    if (!r.ok) E.falhas[`${nome}:${r.codigo}`] = (E.falhas[`${nome}:${r.codigo}`] ?? 0) + 1;
    else {
      anotar(sim.tique, nome, args);
      if (OBRAS.has(nome)) proximaObra = sim.tique + ritmo;
    }
    return r;
  };
  const caixa = () => sim.holding.caixa();
  const marco = () => sim.progresso.marco().n;
  const sugestoes = () => (sim.q.sugestoes ? sim.q.sugestoes() : []);
  const sug = (id) => sugestoes().find((s) => s.id === id);
  const plano = (modo, tipo, pontos) => ({ plano: { modo, tipo, pontos, sessao: `robo.${++E.sessao}` } });

  /** Tenta uma via; devolve true se construiu. Confere o custo pela prévia antes. */
  function via(modo, tipo, pontos, reserva = 20000) {
    if (!sim.q.via?.previa || !podeObra()) return false;
    const pv = sim.q.via.previa({ modo, tipo, pontos });
    if (!pv?.ok || !(pv.custo >= 0) || pv.custo > caixa() - reserva) return false;
    return cmd('via.construir', plano(modo, tipo, pontos)).ok;
  }

  /** Procura um lugar perto de (x, z) onde a prévia de construir aceita o tipo. */
  function acharLugar(tipo, x, z, raio = 260, passo = 32) {
    if (!sim.q.construir?.previa || !podeObra()) return null;
    for (let r = 0; r <= raio; r += passo) {
      const n = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / passo));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const px = x + r * Math.cos(a);
        const pz = z + r * Math.sin(a);
        const pv = sim.q.construir.previa({ tipo, x: px, z: pz, rot: null });
        if (pv?.ok) return { x: pv.x ?? px, z: pv.z ?? pz, rot: Number.isFinite(pv.rot) ? pv.rot : 0 };
        if (pv?.codigo === 'creditos' || pv?.codigo === 'marco') return null;
      }
    }
    return null;
  }

  function construir(tipo, x, z, raio) {
    const l = acharLugar(tipo, x, z, raio);
    if (!l) return null;
    const r = cmd('construir', { tipo, x: l.x, z: l.z, rot: l.rot });
    return r.ok ? r.id : null;
  }

  /** Nós de vias com calçada (sem a rodovia e a terra), do mais perto ao mais longe de (x, z). */
  function nosPerto(x, z) {
    const N = sim.tabelas.nos;
    const A = sim.tabelas.arestas;
    const bons = new Set();
    for (let e = 0; e < A.n; e++) {
      if (!A.viva[e]) continue;
      const tipo = A.tipo[e];
      if (tipo === TIPOS_VIA.rodovia || tipo === TIPOS_VIA.terra) continue;
      bons.add(A.a[e]);
      bons.add(A.b[e]);
    }
    return [...bons].filter((i) => N.viva[i]).map((i) => ({ x: N.x[i], z: N.z[i], d: Math.hypot(N.x[i] - x, N.z[i] - z) })).sort((p, q) => p.d - q.d);
  }

  /** Leva uma rua do nó mais perto até a frente do lugar sugerido (os prédios da primeira hora ficam longe das vias). */
  function levarAcesso(x, z) {
    for (const n of nosPerto(x, z).slice(0, 4)) {
      if (n.d < 30) return true;
      const k = Math.max(0, (n.d - 40) / n.d);
      const fim = [n.x + (x - n.x) * k, n.z + (z - n.z) * k];
      if (via('reta', 'rua', [[n.x, n.z], fim], 15000)) return true;
    }
    return false;
  }

  /** Constrói num lugar sugerido; sem acesso, leva a rua antes. */
  function construirSugerido(tipo, s, raio = 160) {
    let id = construir(tipo, s.x, s.z, raio);
    if (id === null && sim.q.construir?.previa) {
      const pv = sim.q.construir.previa({ tipo, x: s.x, z: s.z, rot: s.rot });
      if (pv?.codigo === 'acesso' && levarAcesso(s.x, s.z)) id = construir(tipo, s.x, s.z, raio);
    }
    return id;
  }

  /** Centro de massa das vias do robô (para os serviços ficarem perto de quem mora). */
  function centroCidade() {
    const b = E.blocos.filter((x) => x.feito);
    if (!b.length) return [100, -200];
    const s = b.reduce((a, x) => [a[0] + (x.x0 + x.x1) / 2, a[1] + (x.z0 + x.z1) / 2], [0, 0]);
    return [s[0] / b.length, s[1] / b.length];
  }

  // blocos de expansão: os das sugestões primeiro, depois uma coroa em volta da avenida (dentro dos 4 x 4 ladrilhos)
  function prepararBlocos() {
    for (const s of sugestoes().filter((x) => x.tipo === 'zona')) {
      const xs = s.pontos.map((p) => p[0]);
      const zs = s.pontos.map((p) => p[1]);
      E.blocos.push({ x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs), zona: s.zona, feito: false });
    }
    const L = 336;
    const H = 224;
    const zonas = ['resBaixa', 'resBaixa', 'comBaixa', 'resBaixa', 'industria', 'resBaixa', 'resMedia', 'resMedia', 'comBaixa', 'resMedia'];
    let k = 0;
    for (let anel = 1; anel <= 4; anel++) {
      for (let i = -anel; i <= anel; i++) {
        for (let j = -anel; j <= anel; j++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== anel) continue;
          const x0 = -150 + i * (L + 40);
          const z0 = -320 + j * (H + 40);
          if (x0 < -1000 || x0 + L > 1000 || z0 < -1000 || z0 + H > 1000) continue;
          E.blocos.push({ x0, z0, x1: x0 + L, z1: z0 + H, zona: zonas[k++ % zonas.length], feito: false });
        }
      }
    }
  }

  function decidir() {
    if (!sim.q.decisoes) return;
    for (const d of sim.q.decisoes()) {
      const escolha = { 'vila.agua': 'captacao', 'febre.aurora': caixa() > 150000 ? 'comprar' : 'proteger', 'canal.seshat': 'local' }[d.id] ?? d.padrao;
      cmd('decisao.escolher', { id: d.id, opcao: escolha });
    }
  }

  function vias() {
    if (!podeObra()) return;
    if (!E.feito.has('avenida')) {
      const s = sug('avenida');
      if (!s) return E.feito.add('avenida');
      let ok = true;
      for (let k = 0; k + 1 < s.pontos.length; k++) {
        if (E.feito.has(`avenida.${k}`)) continue;
        if (!podeObra()) return;
        if (via('reta', s.via ?? 'avenida', [s.pontos[k], s.pontos[k + 1]], 0)) E.feito.add(`avenida.${k}`);
        else ok = false;
      }
      if (ok || ++E.tentativasBloco > 20) E.feito.add('avenida');
      return;
    }
    // um bloco novo quando a cidade pede espaço (ou no começo): o primeiro que a prévia aceita
    const feitos = E.blocos.filter((b) => b.feito);
    const pop = sim.agregados.populacao;
    const demandaR = sim.agregados.demanda?.R ?? 0;
    const precisa = feitos.length < 2 || (cidadeFalsa ? cidadeFalsa.estado.pop > cidadeFalsa.estado.capacidade * 0.75 : demandaR > 35 || pop > feitos.length * 700);
    if (!precisa) return;
    for (const b of E.blocos) {
      if (b.feito || b.descartado || (b.zona === 'resMedia' && marco() < 2)) continue;
      const pontos = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1]];
      const pv = sim.q.via.previa({ modo: 'grade', tipo: 'rua', pontos });
      if (!pv?.ok) {
        const soCaixa = (pv?.erros ?? []).length > 0 && pv.erros.every((e) => e.codigo === 'creditos');
        if (!soCaixa) {
          b.descartado = true;
          continue;
        }
        E.querEmprestimo = true;
        return;
      }
      if (pv.custo > caixa() - 15000) {
        E.querEmprestimo = true;
        return;
      }
      if (via('grade', 'rua', pontos, 15000)) {
        b.feito = true;
        cmd('zona.pintar', { pincel: { modo: 'retangulo', x: b.x0, z: b.z0, x2: b.x1, z2: b.z1 }, zona: z(b.zona) });
      } else b.descartado = true;
      return;
    }
  }

  function servicos() {
    const [cx, cz] = centroCidade();
    // [tipo, marco, sugestão, moradores a partir de]
    const lista = [
      ['captacao', 0, 'captacao', 0], ['solar', 0, 'usina', 0], ['praca', 0, null, 500], ['clinica', 1, null, 800],
      ['escolaF', 1, null, 800], ['delegacia', 1, null, 2500], ['bombeiros', 2, null, 4000],
    ];
    const pop0 = sim.agregados.populacao;
    for (const [tipo, m, s, pmin] of lista) {
      if (E.servicos[tipo] || marco() < m || pop0 < pmin || caixa() < (s ? 32000 : 40000)) continue;
      if (cidadeFalsa) {
        const t = tipo === 'solar' ? 'usinaSolar' : tipo;
        if (cidadeFalsa.porServico(t)) {
          E.servicos[tipo] = 1;
          sim.progresso.xp(XP.servico, 'servicos');
        }
        continue;
      }
      const lugar = s ? sug(s) : null;
      const id = lugar ? construirSugerido(tipo, lugar) : construir(tipo, cx, cz, 300);
      if (id !== null) E.servicos[tipo] = id;
    }
    // mais serviços quando a cidade cresce (um a cada ~5 mil moradores)
    const pop = sim.agregados.populacao;
    const extra = Math.floor(pop / 5000);
    if (extra > (E.extras ?? 0) && caixa() > 120000) {
      const tipo = ['clinica', 'escolaF', 'praca', 'captacao', 'solar', 'delegacia'][(E.extras ?? 0) % 6];
      if (cidadeFalsa) cidadeFalsa.porServico(tipo === 'solar' ? 'usinaSolar' : tipo);
      else construir(tipo, cx, cz, 400);
      E.extras = (E.extras ?? 0) + 1;
    }
  }

  function holding() {
    const passos = [
      ['escritorioObra', 0, 'escritorio'], ['pedreira', 0, 'pedreira'], ['areal', 0, 'areal'], ['olaria', 1, 'olaria'], ['concreteira', 3, null],
    ];
    for (const [tipo, m, s] of passos) {
      if (E.holding[tipo] || marco() < m || caixa() < 30000) continue;
      const lugar = s ? sug(s) : null;
      const id = lugar ? construirSugerido(tipo, lugar) : construir(tipo, ...(E.holding.escritorioObra ? Object.values(posicaoDe(E.holding.escritorioObra)) : [250, -470]), 300);
      if (id !== null) E.holding[tipo] = id;
    }
    // Olaria: a segunda linha faz tijolo com a argila da primeira
    const ola = E.holding.olaria;
    if (ola && !E.feito.has('olaria.tijolo')) {
      const f = sim.q.predio?.(ola)?.holding;
      if (f && f.linhas.length >= 1 && f.linhas[0].item === 'argila' && f.proximoNivel && marco() >= f.proximoNivel.marco) {
        if (f.linhas.length < 2) cmd('predio.nivel', { ref: ola });
        if (sim.q.predio(ola).holding.linhas.length > 1 && cmd('linha.ordem', { predio: ola, linha: 1, item: 'tijolo', n: 10, auto: true }).ok) E.feito.add('olaria.tijolo');
      }
    }
    // armazém maior quando enche
    const esc = E.holding.escritorioObra;
    const prod = sim.q.producao?.();
    if (esc && prod && prod.armazem.usado > prod.armazem.capacidade * 0.85 && caixa() > 60000) {
      const prox = sim.q.predio?.(esc)?.holding?.proximoNivel;
      const tem = (item) => prod.itens.find((i) => i.item === item)?.estoque ?? 0;
      if (prox && marco() >= prox.marco && Object.entries(prox.materiais).every(([k, q]) => tem(k) >= q)) cmd('predio.nivel', { ref: esc });
    }
    // Depósito: vende o que sobra de brita e areia (uma vez por janela de meia hora)
    if (prod && sim.tique - E.ultimaVenda > 1800) {
      for (const it of prod.itens) {
        if (['brita', 'areia', 'tijolo', 'argila'].includes(it.item) && it.estoque > 250) cmd('deposito.vender', { item: it.item, n: it.estoque - 200 });
      }
      E.ultimaVenda = sim.tique;
    }
    // aço e cimento importados quando a Concreteira e a Torre pedem
    if (prod && marco() >= 3) {
      const cim = prod.itens.find((i) => i.item === 'cimento');
      if (E.holding.concreteira && cim && cim.estoque < 20 && caixa() > 50000) cmd('importar', { item: 'cimento', n: 30 });
    }
    if (comprarTempo && caixa() > 250000) {
      for (const ref of Object.values(E.holding)) {
        const f = sim.q.predio?.(ref)?.holding;
        f?.linhas.forEach((l, k) => l.rodando && cmd('acelerar', { alvo: { predio: ref, linha: k }, minutos: 5 }));
      }
    }
  }

  function posicaoDe(ref) {
    const P = sim.tabelas.predios;
    const i = idxDaRef(ref);
    return { x: P.x[i], z: P.z[i] };
  }

  function arcologia() {
    if (!temComando(sim, 'arcologia.iniciar') || !sim.q.arcologia) return;
    const a = sim.q.arcologia();
    for (const parte of a?.partes ?? []) {
      for (const et of parte.etapas ?? []) {
        if (et.estado !== 1) continue;
        if (caixa() < (et.creditos ?? 0) + 40000) continue;
        cmd('arcologia.iniciar', { etapa: et.id });
        // materiais que faltam: importa o aço e o vidro (a Holding não produz no M1a)
        for (const m of et.materiais ?? []) {
          if ((m.item === 'aco' || m.item === 'vidro') && m.estoque < m.pede && caixa() > 80000) cmd('importar', { item: m.item, n: Math.min(100, m.pede - m.estoque) });
        }
      }
    }
  }

  function financas() {
    const e = sim.q.emprestimo();
    const o = sim.q.orcamento();
    const ano = Math.floor(sim.tique / 7200) + 1;
    // empréstimo: quando o caixa aperta, ou para abrir bairro novo quando a cidade pede espaço (anos 1 e 2)
    const querCrescer = ano <= 2 && E.querEmprestimo;
    E.querEmprestimo = false;
    if ((caixa() < 25000 && o.saldoHora < 2000) || querCrescer) {
      if (e.disponivelAno >= 10000) cmd('emprestimo.tomar', { valor: Math.min(50000, e.disponivelAno) });
    }
    if (ano >= 3 && e.divida > 0) {
      if (caixa() > e.divida + 150000) cmd('emprestimo.quitar');
      else if (caixa() > 200000) cmd('emprestimo.pagarParcela');
    }
  }

  prepararBlocos();
  return {
    estado: E,
    passo() {
      decidir();
      servicos();
      holding();
      vias();
      arcologia();
      financas();
    },
  };
}

const pct = (v, p) => (v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : 0);

/**
 * Joga e devolve o relatório. op: { horas, semente, comprarTempo, fazDeConta, aoProgresso(horas) }.
 */
export function rodarRobo({ horas = 12, semente = 'robo-1', comprarTempo = false, fazDeConta = null, aoProgresso = null } = {}) {
  const agora = () => performance.now();
  const sim = criarSimulacao({ semente, cronometro: agora });
  const real = !sim.substitutoAtivo('agregados') && !!sim._comandos?.get('construir') && !sim._comandos.get('construir').substituto;
  const usarFalsa = fazDeConta ?? !real;
  const cidadeFalsa = usarFalsa ? ligarCidadeFalsa(sim, { moradoresIniciais: Math.max(350, sim.agregados.populacao || 350) }) : null;
  const tomado = {};
  const anotar = (t, nome, args) => {
    if (nome === 'emprestimo.tomar') tomado[dataDoTique(t).ano] = (tomado[dataDoTique(t).ano] ?? 0) + args.valor;
  };
  const est = criarEstrategia(sim, { comprarTempo, cidadeFalsa, anotar });
  const T = Math.round(horas * HORA);
  const tiques = new Float64Array(T);
  const R = {
    modo: usarFalsa ? 'cidade de faz de conta (agregados)' : 'cidade da S2a',
    arcologia: temComando(sim, 'arcologia.iniciar') ? 'X1b' : 'sem a X1b (marco 7 indisponível)',
    semente, horas, comprarTempo,
    marcos: [],
    caixaMin: Infinity, caixaMinTique: 0, caixa1h: null, zeradoTiques: 0, zeradoNaPrimeiraHora: false,
    emprestimosPrimeiraHora: 0, dividaMax: 0, tomadoPorAno: {}, dividaFimAno: null,
    semObjetivo: 0, objetivosFeitos: [],
    filaMax: 0, vendasMarco5: null,
    bemEstarAbaixo61Apos3: 0,
  };
  let marcoAnt = 0;
  let mesesAbaixo = 0;
  sim.on('marco', (d) => R.marcos.push({ n: d.n, nome: d.nome, tique: sim.tique, hora: hm(sim.tique) }));
  sim.on('objetivo', (d) => d.estado === 'feito' && R.objetivosFeitos.push(`${d.id}@${hm(sim.tique)}`));
  for (let t = 0; t < T; t++) {
    if (t % RODADA === 0) est.passo();
    const a = agora();
    sim.rodar(1, { sincrono: true });
    tiques[t] = agora() - a;
    if (t % RODADA === 5) {
      const c = sim.holding.caixa();
      if (c < R.caixaMin) {
        R.caixaMin = c;
        R.caixaMinTique = t;
      }
      if (sim.json.economia.zerado) {
        R.zeradoTiques += RODADA;
        if (t < HORA) R.zeradoNaPrimeiraHora = true;
      }
      const e = sim.q.emprestimo();
      if (e.divida > R.dividaMax) R.dividaMax = e.divida;
      if (e.divida > 0) R.dividaFimAno = dataDoTique(t).ano;
      const pf = sim.q.producao().frota;
      if (pf.fila > R.filaMax) R.filaMax = pf.fila;
      if (sim.q.objetivos().length === 0) R.semObjetivo += RODADA;
      const m = sim.progresso.marco().n;
      if (m >= 5 && marcoAnt < 5) {
        const tot = sim.q.orcamento().totais.receitas;
        const soma = Object.values(tot).reduce((x, v) => x + v, 0);
        R.vendasMarco5 = soma > 0 ? ((tot.cidade ?? 0) + (tot.deposito ?? 0)) / soma : 0;
      }
      marcoAnt = m;
    }
    if (t === HORA - 1) {
      R.caixa1h = sim.holding.caixa();
      R.emprestimosPrimeiraHora = sim.q.emprestimo().contratos.length;
    }
    if (t % 600 === 599 && sim.progresso.marco().n >= 3) {
      if (sim.agregados.bemEstarTarifa < 61) mesesAbaixo++;
      else mesesAbaixo = 0;
      R.bemEstarAbaixo61Apos3 = Math.max(R.bemEstarAbaixo61Apos3, mesesAbaixo);
    }
    if (aoProgresso && t % HORA === HORA - 1) aoProgresso((t + 1) / HORA, sim);
  }
  R.tomadoPorAno = tomado;
  const v = [...tiques].sort((x, y) => x - y);
  const b = sim.q.barra();
  const o = sim.q.orcamento();
  const prod = sim.q.producao();
  Object.assign(R, {
    tiques: T,
    moradores: b.populacao,
    bemEstar: b.bemEstar,
    tarifa: b.tarifa,
    rendaHora: o.receitas.moradores,
    saldoHora: o.saldoHora,
    caixaFim: b.creditos,
    dividaFim: b.divida,
    marcoFim: b.marco,
    frota: prod.frota,
    estoque: Object.fromEntries(prod.itens.filter((i) => i.estoque > 0).map((i) => [i.item, i.estoque])),
    holding: prod.predios.map((p) => `${p.tipo} n${p.nivel}`),
    receitas: o.totais.receitas,
    despesas: o.totais.despesas,
    naoPago: o.totais.naoPago,
    tique: { media: v.reduce((a, x) => a + x, 0) / Math.max(1, v.length), p50: pct(v, 0.5), p95: pct(v, 0.95), p99: pct(v, 0.99), max: v[v.length - 1] ?? 0 },
    falhas: est.estado.falhas,
    erros: sim.erros.map((e) => `${e.onde}: ${String(e.mensagem).split('\n')[0]}`),
  });
  R.metas = metasA4(R);
  // cenário do A5: uma obra de via a cada 10 tiques, com o tique medido à parte (depois do relatório do jogo)
  R.via = cenarioVia(sim, agora);
  return { R, sim };
}

/** Cenário do A5: 600 tiques com uma via construída a cada 10, num lugar livre; tique e comando medidos à parte. */
function cenarioVia(sim, agora) {
  if (!sim.q.via?.previa) return null;
  sim.holding.receber(2000000, 'teste'); // caixa para as obras do cenário (fora do relatório do jogo)
  // acha um lugar livre para uma reta de 112 m
  let base = null;
  for (const [x, z] of [[600, -900], [-700, 700], [700, 700], [-800, -800], [400, 400]]) {
    const pv = sim.q.via.previa({ modo: 'reta', tipo: 'rua', pontos: [[x, z], [x + 112, z]] });
    if (pv?.ok) {
      base = [x, z];
      break;
    }
  }
  if (!base) return { nota: 'sem lugar livre para o cenário' };
  const tt = [];
  const tc = [];
  let feitas = 0;
  for (let i = 0; i < 600; i++) {
    // a cada 10 tiques uma obra de via: constrói a reta e, 10 tiques depois, desfaz (o lugar fica livre de novo)
    if (i % 10 === 0) {
      const a = agora();
      const r = (i / 10) % 2 === 0
        ? sim.cmd('via.construir', { plano: { modo: 'reta', tipo: 'rua', pontos: [base, [base[0] + 112, base[1]]], sessao: `cenario.${i}` } })
        : sim.cmd('via.desfazer', { sessao: `cenario.${i - 10}` });
      tc.push(agora() - a);
      if (r.ok) feitas++;
    }
    const a = agora();
    sim.rodar(1, { sincrono: true });
    tt.push(agora() - a);
  }
  tt.sort((x, y) => x - y);
  tc.sort((x, y) => x - y);
  return { vias: feitas, tique: { p95: pct(tt, 0.95), p99: pct(tt, 0.99), max: tt[tt.length - 1] }, comando: { p50: pct(tc, 0.5), p95: pct(tc, 0.95), max: tc[tc.length - 1] } };
}

/** Metas parciais do A4 antes da calibração (marco 1 e marco 3) e as que já dá para medir. */
function metasA4(R) {
  const tq = (n) => R.marcos.find((m) => m.n === n)?.tique ?? null;
  const dentro = (v, a, b) => v !== null && v >= a && v <= b;
  const m1 = tq(1);
  const m3 = tq(3);
  return {
    marco1: { tique: m1, meta: '10 a 15 min', ok: dentro(m1, 600, 900) },
    marco3: { tique: m3, meta: '40 a 70 min', ok: dentro(m3, 2400, 4200) },
    caixaPrimeiraHora: { ok: !R.zeradoNaPrimeiraHora && R.emprestimosPrimeiraHora <= 1, meta: 'não zera na primeira hora, no máximo um empréstimo' },
    dividaMax: { ok: R.dividaMax <= 500000, meta: 'até 500 mil' },
    tomadoPorAno: { ok: Object.values(R.tomadoPorAno).every((v) => v <= 50000), meta: 'até 50 mil por ano' },
    // seção 12.6: o empréstimo nos 2 primeiros anos e quitado antes do ano 6 (só se mede com 12 h de jogo, 6 anos)
    emprestimoDoisAnos: { ok: Object.keys(R.tomadoPorAno).every((a) => +a <= ANO_INICIAL + 1), meta: 'empréstimo só em 2020 e 2021' },
    quitaAntesAno6: { ok: R.horas < 12 ? null : R.dividaFimAno === null || R.dividaFimAno <= ANO_INICIAL + 4, meta: 'sem dívida a partir de 2025' },
    vendasMarco5: { ok: R.vendasMarco5 === null ? null : R.vendasMarco5 >= 0.15 && R.vendasMarco5 <= 0.35, meta: '15% a 35% das receitas no marco 5' },
    sempreObjetivo: { ok: R.semObjetivo === 0, meta: 'sempre um objetivo aberto' },
    erros: { ok: R.erros.length === 0, meta: 'erros []' },
  };
}

/** Relatório em texto. */
export function textoRelatorio(R) {
  const f = (v, c = 0) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) : String(v));
  const linhas = [];
  linhas.push(`robô da simulação: ${R.horas} h de jogo, semente ${R.semente}, ${R.modo}, Arcologia ${R.arcologia}${R.comprarTempo ? ', comprando tempo' : ''}`);
  linhas.push(`  marcos: ${R.marcos.map((m) => `${m.n} ${m.nome} em ${m.hora}`).join(' · ') || 'nenhum'}`);
  linhas.push(`  fim: ${f(R.moradores)} moradores, bem-estar ${f(R.bemEstar, 1)} (tarifa ${R.tarifa}), contribuição ${f(R.rendaHora)}/h, saldo ${f(R.saldoHora)}/h, marco ${R.marcoFim.n} (${f(R.marcoFim.xp)} XP)`);
  linhas.push(`  caixa: mínimo ${f(R.caixaMin)} em ${hm(R.caixaMinTique)}, com 1 h ${f(R.caixa1h)}, no fim ${f(R.caixaFim)}; zerado por ${f(R.zeradoTiques / 60, 1)} min de jogo`);
  linhas.push(`  dívida: máxima ${f(R.dividaMax)}, no fim ${f(R.dividaFim)}; tomado por ano ${JSON.stringify(R.tomadoPorAno)}; última dívida em ${R.dividaFimAno ?? 'nunca'}`);
  linhas.push(`  Holding: ${R.holding.join(', ') || 'nada'}; estoque ${JSON.stringify(R.estoque)}; vendas no marco 5 ${R.vendasMarco5 === null ? 'sem marco 5' : f(R.vendasMarco5 * 100, 1) + '% das receitas'}`);
  linhas.push(`  frota: ${R.frota.total} caminhões, fila máxima ${R.filaMax}, espera média ${f(R.frota.atrasoMedio, 1)} tiques, ${R.frota.feitas} entregas`);
  linhas.push(`  objetivos: ${R.semObjetivo ? `${R.semObjetivo} tiques sem objetivo aberto` : 'sempre um aberto'}; feitos: ${R.objetivosFeitos.join(', ') || 'nenhum'}`);
  linhas.push(`  receitas: ${JSON.stringify(Object.fromEntries(Object.entries(R.receitas).map(([k, v]) => [k, Math.round(v)])))}`);
  linhas.push(`  tique (${R.tiques}): média ${f(R.tique.media, 3)} · p50 ${f(R.tique.p50, 3)} · p95 ${f(R.tique.p95, 3)} · p99 ${f(R.tique.p99, 3)} · máximo ${f(R.tique.max, 3)} ms`);
  if (R.via?.nota) linhas.push(`  cenário de vias: ${R.via.nota}`);
  if (R.via?.tique) linhas.push(`  cenário uma obra de via a cada 10 tiques (${R.via.vias} feitas): tique p95 ${f(R.via.tique.p95, 3)} · p99 ${f(R.via.tique.p99, 3)} · máximo ${f(R.via.tique.max, 3)} ms; via.construir p50 ${f(R.via.comando.p50, 2)} · p95 ${f(R.via.comando.p95, 2)} · máximo ${f(R.via.comando.max, 2)} ms`);
  linhas.push(`  metas A4 parciais: ${Object.entries(R.metas).map(([k, m]) => `${k} ${m.ok === null ? 'sem medida' : m.ok ? 'dentro' : 'FORA'}`).join(' · ')}`);
  const falhas = Object.entries(R.falhas).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (falhas.length) linhas.push(`  recusas mais comuns: ${falhas.map(([k, n]) => `${k} x${n}`).join(', ')}`);
  linhas.push(`  erros: ${R.erros.length ? R.erros.slice(0, 5).join(' | ') : '[]'}`);
  return linhas.join('\n');
}

function lerArgs(argv) {
  const o = { horas: 12, semente: 'robo-1', comprarTempo: false, fazDeConta: null, json: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--horas') o.horas = +argv[++i];
    else if (k === '--semente') o.semente = argv[++i];
    else if (k === '--comprarTempo') o.comprarTempo = true;
    else if (k === '--fazDeConta') o.fazDeConta = true;
    else if (k === '--cidadeReal') o.fazDeConta = false;
    else if (k === '--json') o.json = argv[++i];
  }
  return o;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const o = lerArgs(process.argv.slice(2));
  const t0 = performance.now();
  const { R } = rodarRobo({ ...o, aoProgresso: (h) => process.stdout.write(`  ... ${h} h de jogo (${((performance.now() - t0) / 1000).toFixed(0)} s)\n`) });
  console.log(textoRelatorio(R));
  console.log(`  ${((performance.now() - t0) / 1000).toFixed(1)} s reais`);
  if (o.json) writeFileSync(o.json, JSON.stringify(R, null, 1));
  process.exit(R.erros.length ? 1 : 0);
}
