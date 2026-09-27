// Cena 'horizonte' (A6, A10, 15.2): a rasante às 17h30, com a câmera a ~100 m sobre a baía sul, 3 graus abaixo do
// horizonte, olhando para o norte por cima da praia e da cidade até os morros: é onde se vê a neblina de altura com
// perspectiva aérea em escala real (os morros a 4 a 6 km azulados), o céu físico com o sol baixo de lado e a costura
// entre o chão e o céu (não pode haver). A câmera fica longe do alvo (1,8 km) para não encostar na encosta, onde
// qualquer diferença entre a malha do terreno e a altura bilinear apareceria. Também roda com ?semClip=1 (as duas
// faixas de profundidade). Também exporta a conferência comum das cenas de ambiente (window.__resultado).

/**
 * Confere o ambiente desenhado: o céu montado, a exposição num intervalo são, a luz do ambiente pronta e nenhum
 * número torto nos uniformes da neblina e da sombra.
 * @returns {{ ok: boolean, falhas: string[], medidas: object }}
 */
export function conferirAmbiente(ctx, { noite = false } = {}) {
  const falhas = [];
  const amb = ctx.ambiente;
  if (!amb) return { ok: false, falhas: ['sem o domínio ceu (ctx.ambiente)'], medidas: {} };
  const exp = amb.exposicao.valor;
  if (!(exp > 0.3 && exp < 20)) falhas.push(`exposição fora do intervalo: ${exp}`);
  if (noite && !(amb.est.noite > 0.9)) falhas.push(`a cena de noite não está de noite (fator ${amb.est.noite})`);
  if (!noite && !(amb.ast.sol.elevacao > 0)) falhas.push('a cena de dia está com o sol abaixo do horizonte');
  if (!ctx.cena.environment) falhas.push('sem a luz do ambiente (PMREM)');
  const u = ctx.ganchos.uniformes;
  const nums = [...u.gNeblinaBeta.value.toArray(), u.gNeblinaQueda.value, ...u.gNeblinaAnel.value.flatMap((v) => v.toArray()), ...u.gSombraMatriz.value.elements];
  if (nums.some((x) => !Number.isFinite(x))) falhas.push('número não finito nos uniformes da neblina ou da sombra');
  const s = ctx.medidas.stats;
  if (!(s.calls > 0)) falhas.push('nenhuma chamada desenhada');
  // uma chamada recusada pelo WebGL (sampler de sombra sem textura, formato errado) some da imagem sem erro de página
  const erroGl = ctx.gl?.getError?.() ?? 0;
  if (erroGl) falhas.push(`o WebGL recusou chamadas (erro ${erroGl})`);
  return {
    ok: falhas.length === 0,
    falhas,
    medidas: {
      hora: +amb.hora.toFixed(2), elevacaoSol: +((amb.ast.sol.elevacao * 180) / Math.PI).toFixed(1), exposicao: +exp.toFixed(3),
      eChao: +amb.est.eChao.toFixed(4), chave: amb.sol.chave, luz: +amb.sol.intensidade.toFixed(4), faixas: s.faixas, msaa: s.msaa, alvo: s.alvo,
    },
  };
}

export function registrar(registrarCena) {
  registrarCena('horizonte', {
    sim: 'sintetica',
    hora: 17.5,
    camera: { x: -200, z: 200, dist: 1800, guinada: 352, inclinacao: 3 },
    async montar(ctx) {
      return { resultado: () => conferirAmbiente(ctx) };
    },
  });
}
