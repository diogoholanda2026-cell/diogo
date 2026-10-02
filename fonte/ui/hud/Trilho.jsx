// Trilho da vista (desenho da UI 7.1 e 8.3): botões de 44 x 44 na borda direita, sob a barra de cima, para o polegar
// direito: Camadas (X3a), Mural e Modo foto (U2b). Como a categoria sem item fica fora da barra (D24), cada botão só
// aparece quando a tela dele existe (ui.registrarTela) ou quando alguém registra o item aqui. Ligado: fundo --acF e
// glifo --ac. O nome vem no rótulo acessível e na dica do mouse.
//   registrarItemTrilho({ id, glifo, rotulo, ordem, aoTocar?, ligado? })  outra parcela põe um item com ação própria
//   (o popover de Camadas, por exemplo); sem aoTocar, o toque abre a tela de mesmo id.
import { signal } from '@preact/signals';
import { tela } from '../loja.js';
import { t } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';

const PADRAO = [
  { id: 'camadas', glifo: 'camadas', rotulo: 'trilho.camadas', ordem: 10 },
  { id: 'mural', glifo: 'mural', rotulo: 'trilho.mural', ordem: 20 },
  { id: 'foto', glifo: 'foto', rotulo: 'trilho.foto', ordem: 30 },
];
const extras = signal([]);

/** Item do trilho com ação própria (troca o padrão de mesmo id). */
export function registrarItemTrilho(item) {
  if (!item?.id) throw new Error('registrarItemTrilho: id');
  extras.value = [...extras.peek().filter((x) => x.id !== item.id), item];
}

/** Itens visíveis: os registrados e os padrões cuja tela existe, na ordem. */
export function itensTrilho(telas) {
  const ex = extras.value;
  const l = [...ex, ...PADRAO.filter((p) => !ex.some((x) => x.id === p.id) && telas.includes(p.id))];
  return l.sort((a, b) => (a.ordem ?? 50) - (b.ordem ?? 50));
}

export function Trilho({ ui }) {
  if (tela.value && tela.value !== 'camadas') return null; // sob uma tela de gestão o trilho não serve
  const itens = itensTrilho(ui.telas());
  if (!itens.length) return null;
  return (
    <nav class="trilho vidro" data-hud="trilho" aria-label={t('trilho.rotulo')}>
      {itens.map((it) => {
        const ligado = it.ligado ? it.ligado() : tela.value === it.id;
        const rotulo = t(it.rotulo);
        return (
          <Botao a="trilho" k={it.id} rotulo={rotulo} dica={rotulo} ativo={ligado} class="bt-glifo trilho-bt" onClick={() => (it.aoTocar ? it.aoTocar(ui) : ligado ? ui.fecharTela() : ui.abrirTela(it.id))}>
            <Glifo n={it.glifo} tam={22} />
          </Botao>
        );
      })}
    </nav>
  );
}

export function registrar(ui) {
  ui.registrarHud('direita', Trilho, { ordem: 10, nome: 'trilho' });
}
