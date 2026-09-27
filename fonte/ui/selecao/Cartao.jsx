// Cartão do selecionado (desenho da UI 7.3 e 8.7): 360 px à esquerda, logo acima da barra de construção, sem cobrir o
// centro. Cabeçalho com o glifo na cor da família, nome, tipo e nível, Localizar e Fechar; o aviso mais grave com a
// ação que resolve; três números do tipo; a via, o que o prédio faz e "Detalhes" (a folha da U1b).
//   residencial: moradores de capacidade, bem-estar, contribuição por hora de jogo (D42: nunca "Aluguel")
//   serviço: atendidos de capacidade, eficiência, manutenção por hora de jogo
//   comercial e indústria: trabalhadores de vagas, produtividade, nível
// A consulta q.predio(ref) é relida 2 vezes por segundo enquanto há seleção de prédio e fica em loja.detalhe (a folha
// usa). Via e Arcologia não são prédios: o ref delas não vai para q.predio (daria o prédio de mesmo índice).
import { signal, effect } from '@preact/signals';
import { selecao, detalhe } from '../loja.js';
import { consultar } from '../consultas.js';
import * as fmt from '../formato.js';
import { t, temTexto } from '../textos.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { glifoBemEstar } from '../glifos/glifos.js';
import { Aviso } from '../comp/Aviso.jsx';
import { Barra } from '../comp/Barra.jsx';
import { zona as dadosZona, FAMILIAS_ZONA } from '../../data/zonas.js';
import { MINUTO } from '../../comum/relogio.js';
import { tarifaDoBemEstar, bemEstarArredondado } from '../../data/economia.js';

/** A folha completa (U1b) abre por aqui; o cartão some enquanto ela está aberta. */
export const folhaAberta = signal(false);

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
const GLIFO_FAMILIA = { res: 'residencial', com: 'comercial', ind: 'industrial', esc: 'escritorio' };
const GLIFO_SERVICO = {
  agua: 'agua', esgoto: 'esgoto', energia: 'energia', saude: 'saude', educacao: 'educacao', seguranca: 'policia',
  policia: 'policia', bombeiros: 'bombeiros', lazer: 'praca', praca: 'praca', parque: 'parque',
};
const GLIFO_AVISO = {
  semAgua: 'semAgua', semEsgoto: 'esgoto', semEnergia: 'semEnergia', semAcesso: 'semVia', abandonado: 'abandonado',
  semMaterial: 'semMaterial', semTrabalhadores: 'semTrabalhadores', racionado: 'semEnergia', caixaZerado: 'caixa',
};
const ORDEM_GRAVIDADE = { grave: 0, atencao: 1, info: 2, holding: 3 };
// fases da obra no vértice (seção 2.4): canteiro até 0,1, fundação até 0,25, estrutura até 0,6, fechamento até 1
const FASES_OBRA = [[0.1, 'canteiro'], [0.25, 'fundacao'], [0.6, 'estrutura'], [1.01, 'fechamento']];

// ------------------------------------------------------------------------------------------ leitura (puras)

/** Família e glifo do prédio: zona pela família (D23), serviço pela categoria, Holding pelo monograma. */
export function aparencia(p) {
  if (!p) return { glifo: 'info', cor: null, familia: null };
  if (p.tipo === 'servico') return { glifo: GLIFO_SERVICO[p.servico?.categoria ?? p.categoria] ?? 'servicos', cor: null, familia: 'servico' };
  if (p.tipo === 'holding') return { glifo: 'holding', cor: 'var(--ch)', familia: 'holding' };
  const z = dadosZona(p.zona);
  const fam = z?.familia ?? null;
  return { glifo: GLIFO_FAMILIA[fam] ?? 'zonas', cor: fam ? FAMILIAS_ZONA[fam].cor : null, familia: fam };
}

/** Subtítulo: "Residencial média · nível 3 de 5", "Saúde · alcance de 600 m". */
export function subtitulo(p) {
  if (!p) return '';
  if (p.tipo === 'servico') {
    const cat = p.servico?.categoria ?? p.categoria;
    const nome = cat && temTexto(`cartao.servico.${cat}`) ? t(`cartao.servico.${cat}`) : t('cartao.servico');
    return p.servico?.alcance ? t('cartao.sub.alcance', { tipo: nome, m: fmt.numero(p.servico.alcance) }) : nome;
  }
  const z = dadosZona(p.zona);
  const tipo = p.tipo === 'holding' ? t('cartao.holding') : z?.nome ?? t('cartao.predio');
  return p.nivel ? t('cartao.sub.nivel', { tipo, nivel: p.nivel }) : tipo;
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
      { id: 'contribuicao', rotulo: t('cartao.contribuicao'), valor: fmt.porHora(m.contribuicaoHora ?? 0), estado: 'ch', dica: hora },
    ];
  }
  if (p.servico) {
    const s = p.servico;
    const efic = s.eficiencia ?? 0;
    return [
      { id: 'atendidos', rotulo: t('cartao.atendidos'), valor: t('cartao.deN', { a: fmt.numero(s.uso ?? 0), b: fmt.numero(s.capacidade ?? 0) }), frac: s.capacidade ? (s.uso ?? 0) / s.capacidade : 0 },
      { id: 'eficiencia', rotulo: t('cartao.eficiencia'), valor: fmt.pct(efic), estado: efic < 0.5 ? 'er' : efic < 0.8 ? 'al' : null, glifo: efic < 0.8 ? 'alerta' : null },
      { id: 'manutencao', rotulo: t('cartao.manutencao'), valor: fmt.porHora(-(s.manutencaoHora ?? 0)), dica: hora },
    ];
  }
  if (p.trabalho) {
    const w = p.trabalho;
    const soma = (l) => (l ?? []).reduce((a, x) => a + (x || 0), 0);
    const prod = w.produtividade ?? 0;
    return [
      { id: 'trabalhadores', rotulo: t('cartao.trabalhadores'), valor: t('cartao.deN', { a: fmt.numero(soma(w.ocupadas)), b: fmt.numero(soma(w.vagas)) }), frac: soma(w.vagas) ? soma(w.ocupadas) / soma(w.vagas) : 0 },
      { id: 'produtividade', rotulo: t('cartao.produtividade'), valor: fmt.pct(prod), estado: prod < 0.5 ? 'er' : prod < 0.8 ? 'al' : null, glifo: prod < 0.8 ? 'alerta' : null },
      { id: 'nivel', rotulo: t('cartao.nivel'), valor: t('cartao.deN', { a: p.nivel ?? 1, b: 5 }) },
    ];
  }
  return [];
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
  return { codigo: a.codigo, gravidade: g, glifo: GLIFO_AVISO[a.codigo] ?? 'alerta', texto, sub: desde, acao, alvo: a.acao ?? null, mais: l.length - 1 };
}

/** Obra: nome da fase e o progresso (0 a 1). */
export function faseDaObra(obra) {
  const f = Math.min(1, Math.max(0, obra?.progresso ?? obra?.fase ?? 0));
  return { nome: t(`cartao.obra.${FASES_OBRA.find(([ate]) => f < ate)[1]}`), frac: f };
}

// ------------------------------------------------------------------------------------------ componente

export function Cartao({ ui }) {
  const s = selecao.value;
  const p = detalhe.value;
  if (!ehPredio(s) || !p || folhaAberta.value) return null;
  const ap = aparencia(p);
  const agora = ui.obterSim()?.espelho?.tempo?.tique ?? null;
  const aviso = avisoPrincipal(p, agora);
  const numeros = numerosDoCartao(p);
  const obra = p.estado === 'obra' ? faseDaObra(p.obra) : null;
  const temFolha = ui.secoes().length > 0;
  const fechar = () => {
    selecao.value = null;
    ui.R?.selecionado?.(null);
  };
  const localizar = () => {
    const pt = s.ponto;
    if (pt && ui.R?.camera?.irPara) ui.R.camera.irPara({ x: pt[0], z: pt[2], dist: 220 }, 900);
  };
  const via = p.via?.nome ?? null;
  return (
    <section class="cartao vidro" data-hud="cartao" role="dialog" aria-label={p.nome}>
      <header class="cartao-cab">
        <span class="cartao-glifo" style={ap.cor ? { '--cor': ap.cor } : null}>
          <Glifo n={ap.glifo} tam={20} />
        </span>
        <div class="cartao-titulos">
          <h2 class="cartao-nome">{p.nome}</h2>
          <span class="cartao-sub">{subtitulo(p)}</span>
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
      ) : (
        <dl class="cartao-numeros">
          {numeros.map((x) => (
            <div class="cartao-num" data-k={x.id}>
              <dt class="rot">{x.rotulo}</dt>
              <dd class={`num cartao-valor${x.estado ? ` tx-${x.estado}` : ''}`} title={x.dica ?? undefined} data-dica={x.dica ? 'hora' : undefined}>
                {x.glifo ? <Glifo n={x.glifo} tam={16} /> : null}
                {x.valor}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <footer class="cartao-pe">
        <div class="cartao-onde">
          {via ? <span class="cartao-via">{via}</span> : null}
          {p.faz ? <span class="cartao-faz">{p.faz}</span> : null}
        </div>
        {/* sem a folha (U1b) o botão fica fora, como a categoria sem item fica fora da barra (D24): um "Detalhes" que
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

// uma interface por página (loja.js): registrar de novo (a interface refeita) solta a leitura da anterior, que
// seguiria viva presa à loja e ao render antigo
let soltarLeitura = null;

/** Entra no lugar 'folha'; relê o selecionado ao trocar e 2 vezes por segundo. */
export function registrar(ui) {
  soltarLeitura?.();
  let refLida = null; // ref cujo detalhe já veio (para saber quando o prédio some)
  const reler = () => {
    const s = selecao.value;
    if (!ehPredio(s)) {
      refLida = null;
      detalhe.value = null;
      return;
    }
    const p = consultar('predio', s.ref);
    if (!p && refLida === s.ref) {
      // o prédio sumiu (demolido): a seleção e o destaque do render caem junto
      refLida = null;
      selecao.value = null;
      ui.R?.selecionado?.(null);
      return;
    }
    refLida = p ? s.ref : null;
    detalhe.value = p;
  };
  let ultima = -Infinity;
  const semEfeito = effect(() => {
    selecao.value; // a troca de seleção relê na hora e fecha a folha do anterior
    folhaAberta.value = false;
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
