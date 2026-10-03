// Robô da interface no navegador (A8; dona: C1, feito na C1a): fumaça com o jogo montado, o laço, o render e a
// interface ligados, até o tique 1.800 (30 min de jogo) a 4x, com teto de 15 min reais. Joga a primeira meia hora pelas
// sugestões da primeira hora (D36), como o "Usar sugestão": Escritório, Areal, captação e usina, avenida, Pedreira, as
// ruas da Vila com rede, a ligação e as três quadras. Os comandos vão por sim.cmd, que é o que ui/acoes.js chama (o
// mesmo livro; a interface não expõe as ações em window, pendência do integrador). No fim põe em window.__resultado:
// { ok, tique, marco, xp, populacao, caixa, erros, hash, semente, livro, msReais, velocidadeEfetiva, falhas }.
// O hash é conferido no Node pela reprodução do livro (ferramentas/robo/a8.mjs).
// Roda como expressão pelo testar.mjs (--script), sem export: devolve a Promise que o testar espera.
(async () => {
  const ALVO = 1800;
  const TETO_MS = 15 * 60 * 1000;
  const RITMO = 20; // um passo do robô por rodada de jogo, como o robô do Node
  // índices de ZONAS_ORDEM (fonte/data/zonas.js)
  const ZONA = { resBaixa: 1, resMedia: 2, resAlta: 3, comBaixa: 4, comAlta: 5, escritorio: 6, industria: 7 };
  const res = { ok: false, falhas: [], esqueleto: false };
  window.__resultado = res;
  const H = window.__held;
  const sim = H?.sim;
  if (!sim?.cmd || !sim.q) {
    res.falhas.push('sem window.__held.sim (a página não abriu a partida)');
    return res;
  }
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const t0 = performance.now();
  const tique0 = sim.tique;
  const S = Object.fromEntries((sim.q.sugestoes?.() ?? []).map((s) => [s.id, s]));
  const feito = new Set();
  let sessao = 0;
  const recusas = {};
  const cmd = (nome, args) => {
    let r;
    try {
      r = sim.cmd(nome, args);
    } catch (e) {
      res.falhas.push(`${nome}: ${e?.message ?? e}`);
      return { ok: false, codigo: 'erro' };
    }
    if (!r?.ok) recusas[`${nome}:${r?.codigo}`] = (recusas[`${nome}:${r?.codigo}`] ?? 0) + 1;
    return r ?? { ok: false };
  };
  const caixa = () => sim.holding?.caixa?.() ?? 0;
  const via = (modo, tipo, pontos) => cmd('via.construir', { plano: { modo, tipo, pontos, sessao: `a8.${++sessao}` } }).ok;

  /** Um prédio sugerido, encaixado pela prévia como o "Usar sugestão" faz (o comando recebe o lugar final). */
  const construir = (id) => {
    const s = S[id];
    if (!s) return true;
    const pedido = { tipo: s.construir, x: s.x, z: s.z, rot: s.rot ?? 0 };
    const pv = sim.q.construir?.previa?.(pedido);
    const ok = pv && Number.isFinite(pv.x) && Number.isFinite(pv.z) && Number.isFinite(pv.rot);
    return cmd('construir', ok ? { ...pedido, x: pv.x, z: pv.z, rot: pv.rot } : pedido).ok;
  };
  /** Uma via sugerida, trecho a trecho; true quando todos os trechos estão feitos. */
  const trechos = (id) => {
    const s = S[id];
    if (!s) return true;
    for (let k = 0; k + 1 < s.pontos.length; k++) {
      if (feito.has(`${id}.${k}`)) continue;
      if (!via('reta', s.via ?? 'rua', [s.pontos[k], s.pontos[k + 1]])) return false;
      feito.add(`${id}.${k}`);
      return k + 2 === s.pontos.length;
    }
    return true;
  };
  /** As ruas de terra da Vila com rede (a sugestão 'melhorar', relida: as refs mudam quando a via divide). */
  const vila = () => {
    const s = (sim.q.sugestoes?.() ?? []).find((x) => x.id === 'vila');
    if (!s) return true;
    return cmd('via.melhorar', { arestas: s.arestas, tipo: s.via, sessao: `a8.${++sessao}` }).ok;
  };
  /** Uma quadra sugerida: a grade de ruas da caixa e a zona pintada nela. */
  const quadra = (id) => {
    const s = S[id];
    if (!s) return true;
    const xs = s.pontos.map((p) => p[0]);
    const zs = s.pontos.map((p) => p[1]);
    const [x0, z0, x1, z1] = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
    if (!feito.has(`${id}.grade`)) {
      if (!via('grade', 'rua', [[x0, z0], [x1, z0], [x1, z1]])) return false;
      feito.add(`${id}.grade`);
    }
    const r = cmd('zona.pintar', { pincel: { modo: 'retangulo', x: x0, z: z0, x2: x1, z2: z1 }, zona: ZONA[s.zona] ?? 1 });
    return r.ok || r.codigo === 'nada';
  };

  // a ordem da primeira meia hora (roteiro da seção 4.1): uma obra por passo, com folga de caixa
  const PASSOS = [
    ['escritorio', () => construir('escritorio')],
    ['areal', () => construir('areal')],
    ['captacao', () => construir('captacao')],
    ['usina', () => construir('usina')],
    ['avenida', () => trechos('avenida')],
    ['pedreira', () => construir('pedreira')],
    ['vila', vila],
    ['ligacao', () => trechos('ligacao')],
    ['quadra1', () => quadra('quadra1')],
    ['quadra2', () => quadra('quadra2')],
    ['quadra3', () => quadra('quadra3')],
    ['olaria', () => sim.progresso.marco().n < 1 || construir('olaria')],
  ];
  const tentativas = {};
  function passo() {
    for (const d of sim.q.decisoes?.() ?? []) cmd('decisao.escolher', { id: d.id, opcao: d.id === 'vila.agua' ? 'captacao' : d.padrao });
    for (const [id, fn] of PASSOS) {
      if (feito.has(id)) continue;
      if (caixa() < 15000) return;
      if (fn()) feito.add(id);
      // uma sugestão recusada muitas vezes (o lugar mudou) não prende as outras
      else if ((tentativas[id] = (tentativas[id] ?? 0) + 1) > 30) feito.add(id);
      return;
    }
  }

  cmd('velocidade', { v: 3 });
  let ultimo = -RITMO;
  while (sim.tique < ALVO && performance.now() - t0 < TETO_MS) {
    if (sim.tique - ultimo >= RITMO) {
      ultimo = sim.tique;
      try {
        passo();
      } catch (e) {
        res.falhas.push(`passo: ${e?.message ?? e}`);
      }
    }
    // a página em segundo plano pausa o jogo: o robô volta a velocidade
    if ((sim.velocidade ?? 3) === 0) cmd('velocidade', { v: 3 });
    await espera(100);
  }
  cmd('velocidade', { v: 0 });
  const ms = performance.now() - t0;
  const marco = sim.progresso?.marco?.() ?? { n: 0, xp: 0 };
  Object.assign(res, {
    tique: sim.tique,
    marco: marco.n,
    xp: sim.json?.progresso?.xp ?? marco.xp ?? 0,
    populacao: sim.agregados?.populacao ?? 0,
    caixa: Math.round(caixa()),
    erros: (sim.erros ?? []).slice(0, 10).map((e) => String(e?.mensagem ?? e?.message ?? JSON.stringify(e))),
    nErros: (sim.erros ?? []).length,
    hash: sim.q.hash(),
    semente: sim.semente,
    livro: JSON.parse(JSON.stringify(sim.livro?.entradas ?? [])),
    feitos: [...feito].filter((k) => !k.includes('.')),
    recusas,
    msReais: Math.round(ms),
    // tiques de jogo por segundo de verdade (a 4x o alvo é 4), e a medida do laço do app
    velocidadeEfetiva: Math.round(((sim.tique - tique0) / (ms / 1000)) * 100) / 100,
    velocidadeEfetivaApp: H.app?.velocidadeEfetiva ?? null,
  });
  if (sim.tique < ALVO) res.falhas.push(`teto de ${TETO_MS / 60000} min reais no tique ${sim.tique}`);
  if (marco.n < 1) res.falhas.push(`marco ${marco.n} no tique ${sim.tique} (o A8 pede o marco 1)`);
  if (res.nErros) res.falhas.push(`${res.nErros} erro(s) na simulação`);
  res.ok = res.falhas.length === 0;
  return res;
})();
