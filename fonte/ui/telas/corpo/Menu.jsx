// Corpo da tela 'menu' (desenho da UI 7.6 e 8.19), sob demanda: Retomar, Salvar (pelo app, a U2a grava de verdade),
// as telas que existem (Carregar, Holding, Economia, Cidade, Progresso, Conselho, Camadas, Mural, Configurações),
// Ajuda (glossário curto e atalhos do PC) e Sair para o menu (quando o app tiver). Item sem quem faça não aparece.
import { useState } from 'preact/hooks';
import { avisar } from '../../loja.js';
import { t } from '../../textos.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Linha } from '../../comp/Linha.jsx';
import { telaArcologia } from '../../hud/Menu.jsx';

// telas da lista, na ordem do desenho (as de outras parcelas entram quando registradas)
const TELAS = [
  ['carregar', 'carregar'],
  ['holding', 'holding'],
  ['economia', 'dinheiro'],
  ['cidade', 'populacao'],
  ['progresso', 'marco'],
  ['conselho', 'conselho'],
  ['arcologia', 'arcologia'],
  ['camadas', 'camadas'],
  ['mural', 'mural'],
  ['configuracoes', 'ajustes'],
];
const GLOSSARIO = ['demanda', 'bemEstar', 'marco', 'lote', 'deposito', 'medidores', 'hora'];
const ATALHOS = ['espaco', 'velocidades', 'telas', 'construir', 'camera', 'esc'];

/** Itens do menu: [{ id, glifo, tela? }], só os que existem. */
export function itensMenu(ui) {
  const telas = ui.telas();
  const l = [];
  for (const [id, glifo] of TELAS) {
    const destino = id === 'arcologia' ? telaArcologia(ui) : telas.includes(id) ? id : null;
    if (destino) l.push({ id, glifo, tela: destino });
  }
  return l;
}

function Ajuda() {
  return (
    <div class="gest-colunas">
      <Secao titulo={t('menu.glossario')}>
        {GLOSSARIO.map((k) => (
          <p class="menu-def">
            <b>{t(`menu.g.${k}`)}</b> {t(`menu.g.${k}.def`)}
          </p>
        ))}
      </Secao>
      <Secao titulo={t('menu.atalhos')}>
        {ATALHOS.map((k) => (
          <p class="menu-def">
            <b class="num">{t(`menu.a.${k}`)}</b> {t(`menu.a.${k}.def`)}
          </p>
        ))}
      </Secao>
    </div>
  );
}

export default function Menu({ ui, fechar }) {
  const [ajuda, setAjuda] = useState(false);
  const jogo = ui.jogo;
  const salvar = async () => {
    const r = await jogo?.salvar?.('manual');
    avisar({ texto: t(r?.ok === false ? 'menu.naoSalvo' : 'menu.salvo'), gravidade: r?.ok === false ? 'atencao' : 'info', glifo: 'salvar' });
    fechar();
  };
  if (ajuda) {
    return (
      <Tela id="menu" glifo="ajuda" titulo={t('menu.ajuda')} aoFechar={() => setAjuda(false)}>
        <Ajuda />
      </Tela>
    );
  }
  return (
    <Tela id="menu" glifo="menu" titulo={t('menu.titulo')} aoFechar={fechar} class="tela-menu">
      <div class="menu-lista">
        <Linha a="menu.item" k="retomar" glifo="vel1" titulo={t('menu.retomar')} onClick={fechar} />
        {typeof jogo?.salvar === 'function' ? <Linha a="menu.item" k="salvar" glifo="salvar" titulo={t('menu.salvar')} onClick={salvar} /> : null}
        {itensMenu(ui).map((it) => (
          <Linha a="menu.item" k={it.id} glifo={it.glifo} titulo={t(`menu.tela.${it.id}`)} onClick={() => ui.abrirTela(it.tela)} />
        ))}
        <Linha a="menu.item" k="ajuda" glifo="ajuda" titulo={t('menu.ajuda')} onClick={() => setAjuda(true)} />
        {typeof jogo?.sairParaMenu === 'function' ? <Linha a="menu.item" k="sair" glifo="sair" titulo={t('menu.sair')} onClick={() => { fechar(); jogo.sairParaMenu(); }} /> : null}
      </div>
    </Tela>
  );
}
