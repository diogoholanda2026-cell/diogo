// Barra de construção (desenho da UI 7.1, 8.4 e 9.5; D24): dois grupos de vidro embaixo, divididos pelos polegares.
// À esquerda o que constrói a cidade (Vias, Zonas, Serviços, Lazer); à direita o da Holding (Demolir, Empresas e
// Arcologia, esta com o anel do progresso do megaprojeto e o selo quando uma etapa pode começar). Categoria sem item
// fica fora da barra; a que tem itens trancados mostra o cadeado no cartão. Tocar abre a bandeja acima do grupo;
// Demolir abre a ferramenta direto; Arcologia abre o Livro da Arcologia (X1b). Com uma ferramenta ativa a barra some e
// a barra da ferramenta toma o lugar (BarraFerramenta.jsx). No PC as dicas mostram o atalho (V, Z, X, G, H, M, B).
import { computed } from '@preact/signals';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { barra, ferramenta, eventos, tela } from '../loja.js';
import { t } from '../textos.js';
import { Bandeja } from './Bandeja.jsx';
import { categoria, sessao, ferramentas, GRUPOS, ATALHOS, GLIFO_CATEGORIA, categoriaVisivel, estadoArcologia } from '../ferramentas/sessao.js';

const marcoN = computed(() => barra.value?.marco?.n ?? 0);

/** Anel de progresso em volta do glifo (2 px, champanhe). */
function Anel({ fracao }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg class="arco-anel" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} class="arco-anel-fundo" />
      <circle cx="18" cy="18" r={r} class="arco-anel-cheio" stroke-dasharray={`${(c * fracao).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 18 18)" />
    </svg>
  );
}

function BotaoCategoria({ ui, cat }) {
  const aberta = categoria.value === cat || (cat === 'demolir' && sessao.value?.tipo === 'demolir');
  const nome = t(`x2.cat.${cat}`);
  const dica = t('x2.atalho', { k: ATALHOS[cat] });
  if (cat === 'arcologia') {
    const { progresso, pode } = estadoArcologia({ consultar: ui.consultar, espelho: ui.obterSim()?.espelho });
    return (
      <Botao a="categoria" k={cat} rotulo={t('x2.arcologia.progresso', { pct: ui.fmt.pct(progresso) })} dica={dica} class="cat-bt cat-arco" onClick={() => ferramentas.escolherCategoria(cat)}>
        <span class="cat-arco-glifo">
          <Anel fracao={progresso} />
          <Glifo n="arcologia" tam={22} class="ch" />
          {pode ? <i class="cat-selo" title={t('x2.arcologia.etapa')} /> : null}
        </span>
        <span class="cat-rot">{nome}</span>
      </Botao>
    );
  }
  return (
    <Botao
      a="categoria"
      k={cat}
      rotulo={aberta ? t('x2.cat.aberta', { nome }) : nome}
      dica={dica}
      class={`cat-bt${aberta ? ' aberta' : ''}${cat === 'demolir' ? ' cat-demolir' : ''}`}
      aria-expanded={cat === 'demolir' ? undefined : String(aberta)}
      aria-pressed={cat === 'demolir' ? String(aberta) : undefined}
      onClick={() => ferramentas.escolherCategoria(cat)}
    >
      <Glifo n={GLIFO_CATEGORIA[cat]} tam={22} />
      <span class="cat-rot">{nome}</span>
    </Botao>
  );
}

function Grupo({ ui, nome, lado }) {
  marcoN.value; // os cadeados mudam com o marco
  eventos.value; // e o catálogo com os desbloqueios (o evento da simulação)
  // com uma ferramenta ativa a barra dela toma o lugar; sob uma tela de gestão a barra some (o vidro da tela a deixava
  // aparecer por baixo)
  if (ferramenta.value || sessao.value || tela.value) return null;
  const esp = ui.obterSim()?.espelho;
  const cats = GRUPOS[nome].filter((c) => categoriaVisivel(c, { consultar: ui.consultar, espelho: esp }));
  if (!cats.length) return null;
  const aberta = categoria.value && cats.includes(categoria.value) ? categoria.value : null;
  return (
    <div class={`construcao construcao-${nome}`}>
      {aberta ? <Bandeja ui={ui} cat={aberta} lado={lado} /> : null}
      <nav class="construcao-grupo vidro" data-hud={`construcao-${nome}`} aria-label={t(`x2.grupo.${nome}`)}>
        {cats.map((c) => (
          <BotaoCategoria key={c} ui={ui} cat={c} />
        ))}
      </nav>
    </div>
  );
}

const GrupoCidade = ({ ui }) => <Grupo ui={ui} nome="cidade" lado="esquerda" />;
const GrupoHolding = ({ ui }) => <Grupo ui={ui} nome="holding" lado="direita" />;

export function registrar(ui) {
  ui.registrarHud('baixo', GrupoCidade, { ordem: 10, nome: 'construcao-cidade' });
  ui.registrarHud('baixo', GrupoHolding, { ordem: 90, nome: 'construcao-holding' });
}
