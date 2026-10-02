// Folha lateral (desenho da UI 8.7): 360 px no celular e 400 no PC, à esquerda, de y 56 até embaixo. Cabeçalho de
// 56 px (voltar, glifo, título 17/650, subtítulo 12/500, localizar e fechar), abas de 44 px, corpo com rolagem e
// rodapé com a ação principal (48 px). A U1b monta as seções por tipo (registrarSecao) dentro dela. `titulo` pode ser
// um nó (o campo de renomear); aí `rotulo` dá o nome acessível. `acoes` entra antes do Localizar (o lápis de renomear).
import { Botao } from './Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { Abas } from './Abas.jsx';
import { t } from '../textos.js';

export function Folha({ glifo = null, cor = null, titulo, rotulo = null, sub = null, abas = null, aba = null, aoTrocarAba, aoVoltar = null, aoLocalizar = null, aoFechar, rodape = null, acoes = null, a = 'folha', children }) {
  const texto = typeof titulo === 'string';
  return (
    <section class="folha" role="dialog" aria-label={rotulo ?? (texto ? titulo : undefined)} data-hud="folha">
      <header class="folha-cab">
        {aoVoltar ? (
          <Botao a={`${a}.voltar`} rotulo={t('comp.voltar')} class="bt-glifo" onClick={aoVoltar}>
            <Glifo n="voltar" />
          </Botao>
        ) : null}
        {glifo ? (
          <span class="folha-glifo" style={cor ? { color: cor } : null}>
            <Glifo n={glifo} tam={20} />
          </span>
        ) : null}
        <div class="folha-titulos">
          {texto ? (
            <h1 class="folha-titulo" title={titulo}>
              {titulo}
            </h1>
          ) : (
            titulo
          )}
          {sub ? <span class="folha-sub">{sub}</span> : null}
        </div>
        {acoes}
        {aoLocalizar ? (
          <Botao a={`${a}.localizar`} rotulo={t('comp.localizar')} class="bt-glifo" onClick={aoLocalizar}>
            <Glifo n="localizar" />
          </Botao>
        ) : null}
        <Botao a={`${a}.fechar`} rotulo={t('comp.fechar')} class="bt-glifo" onClick={aoFechar}>
          <Glifo n="fechar" />
        </Botao>
      </header>
      {abas ? <Abas abas={abas} ativa={aba} aoTrocar={aoTrocarAba} a={`${a}.aba`} rotulo={titulo} class="folha-abas" /> : null}
      <div class="folha-corpo">{children}</div>
      {rodape ? <footer class="folha-rodape">{rodape}</footer> : null}
    </section>
  );
}
