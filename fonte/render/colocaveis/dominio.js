// Registro do domínio 'colocaveis' (R5, D60): os serviços e os prédios da Holding desenhados no mundo. Só a thread
// principal importa este módulo (o worker importa index.js): a fábrica devolve um invólucro na hora e troca pelo
// domínio de verdade (desenho.js, com o three) quando ele chega por import(), um pedaço sob demanda (A1). Antes disso
// não há nada a desenhar: o domínio lê o espelho inteiro no primeiro quadro dele.
// O índice fixo do render liga este módulo (pendência da R5 ao integrador: MODULOS_RENDER, depois de colocaveis).

/** Fábrica do domínio sob demanda. */
export function criarDominioColocaveis(ctx) {
  let real = null;
  let falhou = false;
  const chegou = import('./desenho.js')
    .then((m) => {
      real = m.criarColocaveis(ctx);
      return real;
    })
    .catch((e) => {
      falhou = true;
      console.error('colocaveis: o domínio não carregou', e);
      return null;
    });
  return {
    nome: 'colocaveis',
    get carregado() {
      return !!real;
    },
    chegou,
    aplicar(d, esp, c, prazo) {
      real?.aplicar(d, esp, c, prazo);
    },
    quadro(t, c) {
      real?.quadro(t, c);
    },
    async preparar(op) {
      const r = await chegou;
      return r?.preparar(op) ?? null;
    },
    // o aquecimento da carga espera o domínio chegar (motor/quadro.js, AQUECER.sobDemanda); a falha não prende
    pronto: () => falhou || !!real?.pronto(),
    medidas: () => real?.medidas() ?? null,
    caixa: (i) => real?.caixa(i) ?? null,
    silhueta: (tipo, nivel) => real?.silhueta(tipo, nivel) ?? null,
    descartar() {
      if (real) real.descartar();
      else chegou.then((r) => r?.descartar());
    },
  };
}

export function registrar(api) {
  api.registrarDominio?.('colocaveis', criarDominioColocaveis);
}
