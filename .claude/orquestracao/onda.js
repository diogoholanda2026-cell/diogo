export const meta = {
  name: 'jogo-novo-onda',
  description: 'Uma onda de parcelas do jogo novo: etapas em sequência, parcelas em paralelo, cada uma com revisor adversarial que corrige',
  phases: [
    { title: 'Implementação', detail: 'parcelas da etapa em paralelo, arquivos disjuntos' },
    { title: 'Revisão', detail: 'revisor adversarial por parcela, corrige nos arquivos dela' },
  ],
}

// args: { nome, base?, etapas: [[{ id, revisar?: true, impl? }]] }; impl já pronto pula a implementação.
// Para retomar depois de falha, relance só o que falta (não use resumeFromRunId: ele refaz tudo depois da primeira chamada que falhou): o contexto comum e o texto de cada parcela ficam em arquivos
const DIR = '/tmp/claude-0/-home-user-diogo/f46543ed-2f24-59fc-a862-962bb146c549/scratchpad/cs2'
const CTX = `Antes de tudo, leia inteiro ${DIR}/impl-ctx.txt (contexto e regras de trabalho do jogo novo).`
const TEXTO = (p) => `Sua parcela é ${p.id}. A descrição dela está em ${DIR}/parcelas/${p.id}.txt: leia inteira e siga.`
const RES = {
  type: 'object',
  properties: {
    arquivos: { type: 'array', items: { type: 'string' } },
    publicou: { type: 'string' },
    testes: { type: 'string' },
    capturas: { type: 'array', items: { type: 'string' } },
    pendencias: { type: 'array', items: { type: 'string' } },
  },
  required: ['arquivos', 'publicou', 'testes', 'capturas', 'pendencias'],
}
const REV = {
  type: 'object',
  properties: {
    corrigidos: { type: 'array', items: { type: 'string' } },
    restantes: { type: 'array', items: { type: 'string' } },
    testes: { type: 'string' },
    capturas: { type: 'array', items: { type: 'string' } },
  },
  required: ['corrigidos', 'restantes', 'testes', 'capturas'],
}
const revisor = (p, r) => `${CTX}

Você é o REVISOR ADVERSARIAL da parcela ${p.id}. Outra pessoa acabou de implementar a parcela descrita em ${DIR}/parcelas/${p.id}.txt (leia inteira).

Resumo que ela devolveu:
${JSON.stringify(r, null, 1)}

Sua tarefa é provar que está errado, incompleto ou fraco, e corrigir. Leia os arquivos da parcela (git diff ${args.base || 'HEAD'} e git status mostram o que mudou; arquivos novos aparecem como não rastreados), a ficha dela no docs/PROJETO.md e os contratos que ela consome e publica. Rode os testes (node ferramentas/simular.mjs --testes, quando existir), monte numa pasta temporária e confira no navegador o que for visual (no máximo 4 capturas). Procure: contrato diferente do PROJETO, casos de borda, determinismo, NaN, vazamento de memória, desempenho fora do orçamento, texto com travessão, arquivos de outra parcela editados, código morto, visual que lembre o jogo antigo (maquete, BuildIt, verde-lima, formas robóticas). Corrija direto nos arquivos DA PARCELA e rode os testes de novo. Não faça commit. Devolva o que corrigiu, o que ficou, os testes e as capturas.`

const saida = {}
for (const [k, etapa] of args.etapas.entries()) {
  phase('Implementação')
  log(`${args.nome}: etapa ${k + 1} de ${args.etapas.length} (${etapa.map((p) => p.id).join(', ')})`)
  const rs = await pipeline(etapa,
    (p) => (p.impl ? Promise.resolve(p.impl) : agent(`${CTX}\n\n${TEXTO(p)}`, { label: 'impl:' + p.id, phase: 'Implementação', schema: RES })),
    (r, p) => (p.revisar === false || !r ? Promise.resolve({ id: p.id, impl: r, rev: null }) : agent(revisor(p, r), { label: 'rev:' + p.id, phase: 'Revisão', schema: REV }).then((v) => ({ id: p.id, impl: r, rev: v }))),
  )
  for (const x of rs.filter(Boolean)) saida[x.id] = x
}
return saida
