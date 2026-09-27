// Tela de gestão (desenho da UI 7.3 e 8.13): cobre de y 56 até embaixo e de borda a borda (a barra de cima fica: o
// dinheiro muda enquanto se decide). Cabeçalho de 48 px com glifo, título 20/650, abas e o X à direita (polegar
// direito); corpo com rolagem. Acima de 900 px de largura o corpo pode ter duas colunas (classe tela-colunas).
// abas = [{ id, rotulo }] (opcional). Quem registra a tela recebe fechar() de ui/index.jsx.
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { Abas } from './Abas.jsx';
import { t } from '../textos.js';

export function Tela({ id, glifo = null, titulo, abas = null, aba = null, aoTrocarAba, aoFechar, acoes = null, children, class: classe = '' }) {
  return (
    <section class={`tela${classe ? ` ${classe}` : ''}`} role="dialog" aria-label={titulo} data-tela={id} data-hud="tela">
      <header class="tela-cab">
        {glifo ? <Glifo n={glifo} tam={22} class="tela-glifo" /> : null}
        <h1 class="tela-titulo">{titulo}</h1>
        {abas ? <Abas abas={abas} ativa={aba} aoTrocar={aoTrocarAba} a={`${id}.aba`} rotulo={titulo} class="tela-abas" /> : null}
        <span class="tela-espaco" />
        {acoes}
        <Botao a={`${id}.fechar`} rotulo={t('comp.fechar')} class="bt-glifo tela-fechar" onClick={aoFechar}>
          <Glifo n="fechar" />
        </Botao>
      </header>
      <div class="tela-corpo" role={abas ? 'tabpanel' : undefined}>
        {children}
      </div>
    </section>
  );
}

/** Seção com rótulo de caixa alta dentro de uma tela ou folha. */
export function Secao({ titulo, acao = null, children, class: classe = '' }) {
  return (
    <section class={`secao${classe ? ` ${classe}` : ''}`}>
      {titulo ? (
        <header class="secao-cab">
          <h2 class="rot">{titulo}</h2>
          {acao}
        </header>
      ) : null}
      {children}
    </section>
  );
}
