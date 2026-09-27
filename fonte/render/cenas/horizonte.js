// Cena 'horizonte' (A6, A10, 15.2): a rasante, a 150 m do alvo e 3 graus, às 17h30, da encosta dos morros ao norte
// olhando para o sul, por cima da cidade, até o mar e o horizonte: é onde se vê a neblina de altura com perspectiva aérea em escala real, o céu físico com o sol baixo e a
// costura entre o chão e o céu (não pode haver). Também roda com ?semClip=1 (as duas faixas de profundidade).
// Também exporta a conferência comum das cenas de ambiente (window.__resultado).

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
  if (!(exp > 0.3 && exp < 12)) falhas.push(`exposição fora do intervalo: ${exp}`);
  if (noite && !(amb.est.noite > 0.9)) falhas.push(`a cena de noite não está de noite (fator ${amb.est.noite})`);
  if (!noite && !(amb.ast.sol.elevacao > 0)) falhas.push('a cena de dia está com o sol abaixo do horizonte');
  if (!ctx.cena.environment) falhas.push('sem a luz do ambiente (PMREM)');
  const u = ctx.ganchos.uniformes;
  const nums = [...u.gNeblinaBeta.value.toArray(), u.gNeblinaQueda.value, ...u.gNeblinaAnel.value.flatMap((v) => v.toArray()), ...u.gSombraMatriz.value.elements];
  if (nums.some((x) => !Number.isFinite(x))) falhas.push('número não finito nos uniformes da neblina ou da sombra');
  const s = ctx.medidas.stats;
  if (!(s.calls > 0)) falhas.push('nenhuma chamada desenhada');
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
    camera: { x: 0, z: -2350, dist: 150, guinada: 192, inclinacao: 3 },
    async montar(ctx) {
      return { resultado: () => conferirAmbiente(ctx) };
    },
  });
}
