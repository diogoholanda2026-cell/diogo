// Botão base da interface (desenho da UI 8.20): <button> de verdade, com data-a (o robô e a vitrine clicam por ele),
// data-k quando há chave, aria-label pelo texto e aria-pressed quando liga e desliga. Alvo de 44 px no toque e 32 no
// PC fica a cargo da classe (o ::after estende a área sem aumentar o desenho). Estado desligado continua explicando o
// motivo (nada some sem porquê): quem usa passa `dica`.
export function Botao({ a, k, rotulo, ativo, desligado = false, dica, principal = false, class: classe = '', onClick, children, ...resto }) {
  return (
    <button
      type="button"
      class={`bt ${classe}`}
      data-a={a}
      data-k={k}
      data-principal={principal ? '' : undefined}
      aria-label={rotulo}
      aria-pressed={ativo === undefined || ativo === null ? undefined : String(!!ativo)}
      aria-disabled={desligado ? 'true' : undefined}
      title={dica}
      onClick={(ev) => {
        if (desligado) return;
        onClick?.(ev);
      }}
      {...resto}
    >
      {children}
    </button>
  );
}
