// Telas e modais sob demanda (A1: o JS principal tem teto): o registro fica no pacote principal e o corpo vem por
// import() na primeira vez que abre (um pedaço do pacote por tela, divisão do montar.mjs). Enquanto chega, a moldura da
// tela aparece com o cabeçalho e o X, para o toque nunca ficar sem resposta.
//   ui.registrarTela('holding', sobDemanda(() => import('./corpo/Holding.jsx'), { id: 'holding', glifo, titulo }))
// O módulo do corpo exporta `default` (o componente). precarregar() busca antes de abrir; precarregarNoOcioso(Comp)
// faz isso quando o navegador fica ocioso (os modais que abrem sozinhos, por evento, não esperam a rede).
import { useState, useEffect } from 'preact/hooks';
import { Tela } from '../../comp/Tela.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { t } from '../../textos.js';

export function sobDemanda(carregar, { id, glifo = null, titulo, moldura = true } = {}) {
  let Comp = null;
  let erro = false;
  let promessa = null;
  const buscar = () =>
    (promessa ??= carregar().then(
      (m) => {
        Comp = m.default;
        return Comp;
      },
      (e) => {
        console.error(`interface: a tela ${id} não carregou`, e);
        erro = true;
        promessa = null;
      },
    ));
  function SobDemanda(props) {
    const [, setVez] = useState(0);
    useEffect(() => {
      if (!Comp) buscar().then(() => setVez((v) => v + 1));
    }, []);
    if (Comp) return <Comp {...props} />;
    if (!moldura) return null;
    return (
      <Tela id={id} glifo={glifo} titulo={t(titulo)} aoFechar={props.fechar}>
        <Vazio glifo={erro ? 'alerta' : glifo ?? 'info'} texto={t(erro ? 'tela.erro' : 'tela.carregando')} />
      </Tela>
    );
  }
  SobDemanda.precarregar = buscar;
  return SobDemanda;
}

/** Busca o corpo quando o navegador fica ocioso (só no navegador; nos testes em node não faz nada). */
export function precarregarNoOcioso(Comp) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => Comp.precarregar?.(), { timeout: 10000 });
}
