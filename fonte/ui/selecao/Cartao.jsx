// Cartão do selecionado (desenho da UI 7.3 e 8.7): 360 px à esquerda, logo acima da barra de construção, sem cobrir o
// centro. Cabeçalho com o glifo na cor da família, nome, tipo e nível, Localizar e Fechar; o aviso mais grave com a
// ação que resolve; três números do tipo; a via, o que o prédio faz e "Detalhes" (a folha da U1b).
//   residencial: moradores de capacidade, bem-estar, contribuição por hora de jogo (D42: nunca "Aluguel")
//   serviço: atendidos de capacidade, eficiência, manutenção por hora de jogo
//   comercial e indústria: trabalhadores de vagas, produtividade, nível
//   Holding (sem o bloco trabalho): trabalhadores de vagas, linhas de produção ativas, nível
//   serviço: o tipo do catálogo (clinica, escolaF...) dá o glifo e o nome; o contrato não tem categoria
// A consulta q.predio(ref) (ou q.aresta(ref), na via) é relida 2 vezes por segundo enquanto há seleção e fica em
// loja.detalhe (a folha usa). A Arcologia não é prédio: o ref dela não vai para q.predio (daria o prédio de mesmo
// índice). Decisão da U1b: se a primeira leitura vem nula (o render conhece, a simulação não), a seleção e o destaque
// caem juntos, nunca um destaque sem cartão. Dinheiro sempre em dólar por ui/formato.js (D87). No PC a seleção abre
// direto a folha (desenho da UI 8.7); Arcologia e terreno não têm cartão e abrem a folha.
import { signal, effect } from '@preact/signals';
import { VIAS } from '../../data/vias.js';
import { selecao, detalhe } from '../loja.js';
import { consultar } from '../consultas.js';
import * as fmt from '../formato.js';
import { t, temTexto } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { glifoBemEstar, glifo } from '../glifos/glifos.js';
import { Aviso } from '../comp/Aviso.jsx';
import { Barra } from '../comp/Barra.jsx';
import { zona as dadosZona, FAMILIAS_ZONA } from '../../data/zonas.js';
import { MINUTO } from '../../comum/relogio.js';
import { tarifaDoBemEstar, bemEstarArredondado } from '../../data/economia.js';

/** A folha completa (U1b) abre por aqui; o cartão some enquanto ela está aberta. */
export const folhaAberta = signal(false);
/** A folha pede para ficar aberta na próxima troca de seleção (a pilha do Voltar, selecao/Folha.jsx). */
export const manterFolha = { proxima: false };

// O que a ação de um aviso faz ("Ver camada de energia", "Construir usina") é de quem conhece o destino (U1b, X3a):
// registrarAcaoAviso('verCamadaEnergia', ({ ui, predio, selecao }) => ...). Sem registro, o botão não aparece (um
// botão que não faz nada seria pior que nenhum).
const acoesAviso = new Map();
export function registrarAcaoAviso(id, fn) {
  if (typeof fn !== 'function') throw new Error(`registrarAcaoAviso(${id}): fn`);
  acoesAviso.set(id, fn);
}

export const RELER_MS = 500;
/** Tipos de R.selecionar cujo ref é de prédio (seção 2.7): o marcador aponta o prédio do aviso. */
export const TIPOS_PREDIO = Object.freeze(['predio', 'colocavel', 'marcador']);
/** A seleção é de prédio (e tem ref)? */
export const ehPredio = (s) => !!s && TIPOS_PREDIO.includes(s.tipo) && s.ref !== null && s.ref !== undefined;
/** A seleção é de via (aresta com ref)? */
export const ehVia = (s) => !!s && s.tipo === 'aresta' && s.ref !== null && s.ref !== undefined;
/** Seleção que abre a folha sem cartão: Arcologia e terreno (o menu de contexto). */
export const semCartao = (s) => !!s && (s.tipo === 'arcologia' || s.tipo === 'terreno');
// PC (mouse e tela larga): a seleção abre direto a folha, como no CS2; o jogador pode preferir o cartão
const noPC = () => typeof matchMedia === 'function' && matchMedia('(pointer: fine) and (min-width: 1200px)').matches;
const GLIFO_FAMILIA = { res: 'residencial', com: 'comercial', ind: 'industrial', esc: 'escritorio' };
const GLIFO_SERVICO = {
  agua: 'agua', esgoto: 'esgoto', energia: 'energia', saude: 'saude', educacao: 'educacao', seguranca: 'policia',
  policia: 'policia', bombeiros: 'bombeiros', lazer: 'praca', praca: 'praca', parque: 'parque',
};
// O q.predio diz o serviço pelo tipo (os ids de data/servicos.js, tabela da seção 8.1 do desenho da simulação), não por
// uma categoria: sem esta tabela toda clínica e toda escola de verdade cairia no glifo e no nome genéricos.
const CATEGORIA_DO_TIPO = {
  captacao: 'agua', poco: 'agua', ete: 'esgoto', solar: 'energia', termica: 'energia', praca: 'praca', clinica: 'saude',
  hospital: 'saude', escolaF: 'educacao', escolaM: 'educacao', delegacia: 'seguranca', bombeiros: 'bombeiros',
  parque: 'parque', parqueG: 'parque',
};
/** Categoria do serviço: a que a simulação mandar ou a do tipo do catálogo (null se nenhuma). */
export const categoriaServico = (p) => p?.servico?.categoria ?? p?.categoria ?? CATEGORIA_DO_TIPO[p?.tipo] ?? null;
// código do aviso para o glifo; o código que já é nome de glifo (transito, lixo, incendio...) usa o próprio
const GLIFO_AVISO = {
  semEsgoto: 'esgoto', semAcesso: 'semVia', racionado: 'semEnergia', caixaZerado: 'semCreditos',
};
const glifoDoAviso = (codigo) => GLIFO_AVISO[codigo] ?? (glifo(codigo) ? codigo : 'alerta');
const ORDEM_GRAVIDADE = { grave: 0, atencao: 1, info: 2, holding: 3 };
// fases da obra no vértice (seção 2.4): canteiro até 0,1, fundação até 0,25, estrutura até 0,6, fechamento até 1
const FASES_OBRA = [[0.1, 'canteiro'], [0.25, 'fundacao'], [0.6, 'estrutura'], [1.01, 'fechamento']];

// ------------------------------------------------------------------------------------------ leitura (puras)

// o tipo pelo contrato ('servico', 'holding') ou pelo bloco que só aquele tipo tem (o q.predio não fixa a forma do
// tipo; um serviço com tipo numérico não pode cair na zona 0 e ganhar o glifo residencial)
const ehServico = (p) => p?.tipo === 'servico' || (!!p?.servico && p?.tipo !== 'holding');
const ehHolding = (p) => p?.tipo === 'holding' || (!!p?.holding && !p?.servico);

/** Família e glifo do prédio: zona pela família (D23), serviço pela categoria, Holding pelo monograma. */
export function aparencia(p) {
  if (!p) return { glifo: 'info', cor: null, familia: null };
  if (ehServico(p)) return { glifo: GLIFO_SERVICO[categoriaServico(p)] ?? 'servicos', cor: null, familia: 'servico' };
  if (ehHolding(p)) return { glifo: 'holding', cor: 'var(--ch)', familia: 'holding' };
  const z = dadosZona(p.zona);
  const fam = z?.familia ?? null;
  return { glifo: GLIFO_FAMILIA[fam] ?? 'zonas', cor: fam ? FAMILIAS_ZONA[fam].cor : null, familia: fam };
}

/** Subtítulo: "Residencial média · nível 3 de 5", "Saúde · alcance de 600 m". */
export function subtitulo(p) {
  if (!p) return '';
  if (ehServico(p)) {
    const cat = categoriaServico(p);
    const nome = cat && temTexto(`cartao.servico.${cat}`) ? t(`cartao.servico.${cat}`) : t('cartao.servico');
    return p.servico?.alcance > 0 ? t('cartao.sub.alcance', { tipo: nome, m: fmt.numero(p.servico.alcance) }) : nome;
  }
  const z = ehHolding(p) ? null : dadosZona(p.zona);
  const tipo = ehHolding(p) ? t('cartao.holding') : z?.nome ?? t('cartao.predio');
  return p.nivel > 0 ? t('cartao.sub.nivel', { tipo, nivel: p.nivel }) : tipo;
}

/** Os três números do cartão, pelo tipo: [{ id, rotulo, valor, glifo?, estado?, frac?, dica? }]. */
export function numerosDoCartao(p) {
  if (!p) return [];
  const hora = fmt.dicaHora();
  if (p.moradia) {
    const m = p.moradia;
    const bem = bemEstarArredondado(m.bemEstar); // sem número (prédio vazio) vale 0, nunca "NaN" no cartão
    const tar = tarifaDoBemEstar(m.bemEstar); // as faixas do dono (uma fonte só: data/economia.js)
    return [
      { id: 'moradores', rotulo: t('cartao.moradores'), valor: t('cartao.deN', { a: fmt.numero(m.moradores), b: fmt.numero(m.capacidade) }), frac: m.capacidade ? m.moradores / m.capacidade : 0 },
      // o rosto é o do prédio (a faixa do bem-estar dele), não o da tarifa da cidade
      { id: 'bemEstar', rotulo: t('cartao.bemEstar'), valor: fmt.numero(bem), glifo: glifoBemEstar(tar), estado: tar >= 11 ? 'ok' : tar >= 8 ? null : 'er' },
      { id: 'contribuicao', rotulo: t('cartao.contribuicao'), valor: fmt.dinheiroHora(m.contribuicaoHora ?? 0), estado: 'ch', dica: hora },
    ];
  }
  if (p.servico) {
    const s = p.servico;
    const efic = s.eficiencia ?? 0;
    return [
      { id: 'atendidos', rotulo: t('cartao.atendidos'), valor: t('cartao.deN', { a: fmt.numero(s.uso ?? 0), b: fmt.numero(s.capacidade ?? 0) }), frac: s.capacidade ? (s.uso ?? 0) / s.capacidade : 0 },
      { id: 'eficiencia', rotulo: t('cartao.eficiencia'), valor: fmt.pct(efic), estado: efic < 0.5 ? 'er' : efic < 0.8 ? 'al' : null, glifo: efic < 0.8 ? 'alerta' : null },
      { id: 'manutencao', rotulo: t('cartao.manutencao'), valor: fmt.dinheiroHora(-(s.manutencaoHora ?? 0)), dica: hora },
    ];
  }
  // soma das vagas por escolaridade ([4]) ou o número direto; campo torto vale 0
  const soma = (l) => (Array.isArray(l) ? l.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0) : Number.isFinite(l) ? l : 0);
  if (p.holding && !p.trabalho) {
    // prédio da Holding (q.predio.holding: nível, linhas de produção, vagas e ocupadas): sem os três números, o cartão
    // ficava com a faixa dos números vazia
    const h = p.holding;
    const linhas = Array.isArray(h.linhas) ? h.linhas : [];
    const paradas = linhas.filter((l) => l?.parada).length;
    const nivel = h.nivel > 0 ? h.nivel : p.nivel > 0 ? p.nivel : 1;
    return [
      { id: 'trabalhadores', rotulo: t('cartao.trabalhadores'), valor: t('cartao.deN', { a: fmt.numero(soma(h.ocupadas)), b: fmt.numero(soma(h.vagas)) }), frac: soma(h.vagas) ? soma(h.ocupadas) / soma(h.vagas) : 0 },
      { id: 'linhas', rotulo: t('cartao.linhas'), valor: t('cartao.deN', { a: fmt.numero(linhas.length - paradas), b: fmt.numero(linhas.length) }), estado: paradas ? 'al' : null, glifo: paradas ? 'alerta' : null },
      { id: 'nivel', rotulo: t('cartao.nivel'), valor: t('cartao.deN', { a: nivel, b: 5 }) },
    ];
  }
  if (p.trabalho) {
    const w = p.trabalho;
    const prod = w.produtividade ?? 0;
    return [
      { id: 'trabalhadores', rotulo: t('cartao.trabalhadores'), valor: t('cartao.deN', { a: fmt.numero(soma(w.ocupadas)), b: fmt.numero(soma(w.vagas)) }), frac: soma(w.vagas) ? soma(w.ocupadas) / soma(w.vagas) : 0 },
      { id: 'produtividade', rotulo: t('cartao.produtividade'), valor: fmt.pct(prod), estado: prod < 0.5 ? 'er' : prod < 0.8 ? 'al' : null, glifo: prod < 0.8 ? 'alerta' : null },
      { id: 'nivel', rotulo: t('cartao.nivel'), valor: t('cartao.deN', { a: p.nivel > 0 ? p.nivel : 1, b: 5 }) },
    ];
  }
  return [];
}

/** Glifo do tipo da via (a rodovia usa o da avenida grande). */
export const glifoDaVia = (tipo) => ({ rua: 'rua', ruaMao: 'ruaMao', avenida: 'avenida', avenidaG: 'avenidaG', terra: 'terra', rodovia: 'avenidaG' })[tipo] ?? 'vias';

/** Nome do tipo da via ('Avenida') pelo catálogo; tipo desconhecido, 'Via'. */
export const nomeTipoVia = (tipo) => VIAS[tipo]?.nome ?? t('cartao.via');

/** Os números do cartão da via (q.aresta): comprimento, manutenção por hora e o fluxo (M1b) ou o declive. */
export function numerosDaVia(a) {
  if (!a) return [];
  const l = [
    { id: 'comprimento', rotulo: t('cartao.via.comprimento'), valor: t('cartao.via.m', { m: fmt.numero(a.comprimento ?? 0) }) },
    { id: 'manutencao', rotulo: t('cartao.manutencao'), valor: fmt.dinheiroHora(-(a.manutencaoHora ?? 0)), dica: fmt.dicaHora() },
  ];
  if (a.fluxo) l.push({ id: 'fluxo', rotulo: t('cartao.via.fluxo'), valor: fmt.pct(a.fluxo.vel ?? 1), estado: (a.fluxo.vel ?? 1) < 0.5 ? 'al' : null });
  else l.push({ id: 'declive', rotulo: t('cartao.via.declive'), valor: fmt.pct(Math.abs(a.declive ?? 0), 1) });
  return l;
}

/** Aviso mais grave com a frase: da simulação (aviso.<codigo>), do cartão ou genérico pela gravidade. */
export function avisoPrincipal(p, agora = null) {
  const l = [...(p?.avisos ?? [])];
  if (p?.estado === 'abandonado' && !l.some((a) => a.codigo === 'abandonado')) l.push({ codigo: 'abandonado', gravidade: 'grave' });
  if (!l.length) return null;
  l.sort((a, b) => (ORDEM_GRAVIDADE[a.gravidade] ?? 9) - (ORDEM_GRAVIDADE[b.gravidade] ?? 9));
  const a = l[0];
  const g = a.gravidade in ORDEM_GRAVIDADE ? a.gravidade : 'atencao';
  const texto = temTexto(`aviso.${a.codigo}`) ? t(`aviso.${a.codigo}`, a.params) : temTexto(`cartao.aviso.${a.codigo}`) ? t(`cartao.aviso.${a.codigo}`) : t(`cartao.aviso.${g}`);
  const desde = Number.isFinite(a.desde) && Number.isFinite(agora) && agora > a.desde ? t('cartao.desde', { n: fmt.numero(Math.max(1, Math.floor((agora - a.desde) / MINUTO))) }) : null;
  const acao = a.acao && acoesAviso.has(a.acao) && temTexto(`acao.${a.acao}`) ? t(`acao.${a.acao}`) : null;
  return { codigo: a.codigo, gravidade: g, glifo: glifoDoAviso(a.codigo), texto, sub: desde, acao, alvo: a.acao ?? null, mais: l.length - 1 };
}

/**
 * Obra: nome da fase e o progresso (0 a 1). O progresso manda; sem ele, a fase em número (0 a 1) ou pelo nome
 * ('estrutura'). Sem número nenhum (NaN, campo que falta), o canteiro: o cartão nunca quebra por um dado torto.
 */
export function faseDaObra(obra) {
  const nomeFase = FASES_OBRA.find(([, nome]) => nome === obra?.fase)?.[1] ?? null;
  const bruto = Number.isFinite(obra?.progresso) ? obra.progresso : Number.isFinite(obra?.fase) ? obra.fase : 0;
  const f = Math.min(1, Math.max(0, bruto));
  const nome = Number.isFinite(obra?.progresso) || !nomeFase ? FASES_OBRA.find(([ate]) => f < ate)[1] : nomeFase;
  return { nome: t(`cartao.obra.${nome}`), frac: f };
}

// ------------------------------------------------------------------------------------------ componente

/** Números em três colunas (cartão de prédio e de via). */
const Numeros = ({ lista }) => (
  <dl class="cartao-numeros">
    {lista.map((x) => (
      <div class="cartao-num" data-k={x.id}>
        <dt class="rot">{x.rotulo}</dt>
        <dd class={`num cartao-valor${x.estado ? ` tx-${x.estado}` : ''}`} title={x.dica ?? undefined} data-dica={x.dica ? 'hora' : undefined}>
          {x.glifo ? <Glifo n={x.glifo} tam={16} /> : null}
          {x.valor}
        </dd>
      </div>
    ))}
  </dl>
);

export function Cartao({ ui }) {
  const s = selecao.value;
  const p = detalhe.value;
  const via = ehVia(s);
  if ((!ehPredio(s) && !via) || !p || folhaAberta.value) return null;
  const ap = via ? { glifo: glifoDaVia(p.tipo), cor: null } : aparencia(p);
  const agora = ui.obterSim()?.espelho?.tempo?.tique ?? null;
  const aviso = via ? null : avisoPrincipal(p, agora);
  const numeros = via ? numerosDaVia(p) : numerosDoCartao(p);
  const obra = !via && p.estado === 'obra' ? faseDaObra(p.obra) : null;
  const temFolha = ui.secoes().length > 0;
  const fechar = () => {
    selecao.value = null;
    ui.R?.selecionado?.(null);
  };
  const localizar = () => {
    const pt = s.ponto;
    if (pt && ui.R?.camera?.irPara) ui.R.camera.irPara({ x: pt[0], z: pt[2], dist: 220 }, 900);
  };
  const nome = p.nome || (via ? nomeTipoVia(p.tipo) : t('cartao.predio'));
  const onde = via ? null : p.via?.nome ?? null;
  const faz = via ? (p.rodovia ? t('cartao.via.rodovia') : p.mao ? t('cartao.via.mao') : null) : p.faz;
  return (
    <section class="cartao vidro" data-hud="cartao" role="dialog" aria-label={nome}>
      <header class="cartao-cab">
        <span class="cartao-glifo" style={ap.cor ? { '--cor': ap.cor } : null}>
          <Glifo n={ap.glifo} tam={20} />
        </span>
        <div class="cartao-titulos">
          <h2 class="cartao-nome" title={nome}>
            {nome}
          </h2>
          <span class="cartao-sub">{via ? nomeTipoVia(p.tipo) : subtitulo(p)}</span>
        </div>
        <Botao a="cartao.localizar" rotulo={t('comp.localizar')} class="bt-glifo" onClick={localizar}>
          <Glifo n="localizar" />
        </Botao>
        <Botao a="cartao.fechar" rotulo={t('comp.fechar')} class="bt-glifo" onClick={fechar}>
          <Glifo n="fechar" />
        </Botao>
      </header>
      {aviso ? (
        <Aviso
          gravidade={aviso.gravidade}
          glifo={aviso.glifo}
          texto={aviso.texto}
          sub={aviso.sub}
          acao={aviso.acao}
          aoAcao={() => acoesAviso.get(aviso.alvo)?.({ ui, predio: p, selecao: s })}
          a="cartao.aviso"
          k={aviso.codigo}
          class="cartao-aviso"
        />
      ) : null}
      {obra ? (
        <div class="cartao-obra">
          <span class="rot">{t('cartao.obra', { fase: obra.nome })}</span>
          <Barra valor={obra.frac} estado="al" rotulo={t('cartao.obra', { fase: obra.nome })} texto={fmt.pct(obra.frac)} />
        </div>
      ) : numeros.length ? (
        <Numeros lista={numeros} />
      ) : null}
      <footer class="cartao-pe">
        <div class="cartao-onde">
          {onde ? <span class="cartao-via">{onde}</span> : null}
          {faz ? <span class="cartao-faz">{faz}</span> : null}
        </div>
        {/* sem a folha o botão fica fora, como a categoria sem item fica fora da barra (D24): um "Detalhes" que
            não abre nada seria um toque mudo */}
        {temFolha ? (
          <Botao a="cartao.detalhes" rotulo={t('cartao.detalhes')} class="bt-sec bt-curto" onClick={() => (folhaAberta.value = true)}>
            <span>{t('cartao.detalhes')}</span>
            <Glifo n="setaDir" tam={16} />
          </Botao>
        ) : null}
      </footer>
    </section>
  );
}

/** Ação de aviso registrada (a folha usa o mesmo registro). */
export const acaoDeAviso = (id) => acoesAviso.get(id) ?? null;

// uma interface por página (loja.js): registrar de novo (a interface refeita) solta a leitura da anterior, que
// seguiria viva presa à loja e ao render antigo
let soltarLeitura = null;

/** Entra no lugar 'folha'; relê o selecionado ao trocar e 2 vezes por segundo. */
export function registrar(ui) {
  soltarLeitura?.();
  const soltar = () => {
    selecao.value = null;
    ui.R?.selecionado?.(null);
  };
  const reler = () => {
    const s = selecao.value;
    const via = ehVia(s);
    if (!ehPredio(s) && !via) {
      detalhe.value = null;
      return;
    }
    const p = consultar(via ? 'aresta' : 'predio', s.ref);
    // nulo na primeira leitura (o render destacou o que a simulação não conhece) ou depois (demolido): a seleção e
    // o destaque do render caem juntos
    if (!p) return soltar();
    detalhe.value = p;
  };
  let ultima = -Infinity;
  const semEfeito = effect(() => {
    const s = selecao.value; // a troca de seleção relê na hora e fecha a folha do anterior (salvo a pilha do Voltar)
    const manter = manterFolha.proxima;
    manterFolha.proxima = false;
    folhaAberta.value = !!s && (manter || semCartao(s) || (noPC() && !ui.loja.prefs.peek()?.cartaoNoPC && ui.secoes().length > 0));
    reler();
  });
  const semQuadro = ui.aoQuadro((tMs) => {
    if (!selecao.value || tMs - ultima < RELER_MS) return;
    ultima = tMs;
    reler();
  });
  soltarLeitura = () => {
    semEfeito();
    semQuadro?.();
  };
  ui.registrarHud('folha', Cartao, { ordem: 10, nome: 'cartao' });
}
