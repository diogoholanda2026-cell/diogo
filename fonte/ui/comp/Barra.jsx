// Barra de progresso (desenho da UI 8.20): trilho de 4 px, preenchimento por estado ('ac', 'ok', 'al', 'er', 'ch'),
// texto opcional em 12/600 à direita (tempo restante, "37 de 100"). O preenchimento anda por transform (sem layout).
export const fracao = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export function Barra({ valor = 0, estado = 'ac', rotulo, texto = null, class: classe = '' }) {
  const v = fracao(valor);
  return (
    <div class={`barra-prog barra-${estado}${classe ? ` ${classe}` : ''}`} role="progressbar" aria-label={rotulo} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(v * 100)}>
      <div class="barra-trilho">
        <div class="barra-cheio" style={{ transform: `scaleX(${v})` }} />
      </div>
      {texto !== null && texto !== undefined ? <span class="barra-texto num">{texto}</span> : null}
    </div>
  );
}
