// Bandeja dos itens da categoria (desenho da UI 8.4, o menu de itens do CS2): sobe acima do grupo que a abriu, até 560
// px de largura; sub-abas em cima quando a categoria tem grupos; cartões de 88 x 80 com glifo, nome em duas linhas e
// preço (vermelho com o glifo quando falta dinheiro), ou o cadeado com "Marco 4". Tocar num cartão abre a ferramenta
// e recolhe a bandeja; o toque longo (ou passar o mouse) mostra o detalhe; tocar fora fecha. Vias e zonas saem dos
// dados; serviços, lazer e empresas de q.catalogo (itensDaCategoria em ferramentas/sessao.js).
import { useState, useEffect, useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Botao } from '../comp/Botao.jsx';
import { Abas } from '../comp/Abas.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { barra, avisar } from '../loja.js';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { VIAS } from '../../data/vias.js';
import { ZONAS } from '../../data/zonas.js';
import { categoria, sessao, ferramentas, itensDaCategoria } from '../ferramentas/sessao.js';

const TOQUE_LONGO = 450;
const caixa = computed(() => barra.value?.creditos ?? 0);
const marcoAtual = computed(() => barra.value?.marco?.n ?? 0);

/** Cor da família da zona (tokens da D23) para a amostra do cartão. */
export const COR_FAMILIA = Object.freeze({ res: 'var(--zR)', com: 'var(--zC)', ind: 'var(--zI)', esc: 'var(--zC)' });

/** Linha de preço de um cartão: { texto, falta } (falta: créditos que faltam, 0 se dá). */
export function precoDoCartao(c, creditos) {
  if (c.acao === 'via') return { texto: t('x2.bandeja.porMetro', { v: fmt.numero(c.porMetro ?? 0) }), falta: 0 };
  if (c.acao === 'zona') return { texto: c.dados?.apagar ? '' : t('x2.bandeja.gratis'), falta: 0 };
  const custo = c.custo ?? 0;
  const falta = Math.max(0, custo - (creditos ?? 0));
  return { texto: falta ? t('x2.bandeja.faltam', { n: fmt.creditos(falta) }) : fmt.creditos(custo), falta };
}

function Cartao({ c, ativo, aoDetalhe }) {
  const espera = useRef(0);
  const longo = useRef(false);
  const preco = precoDoCartao(c, caixa.value);
  const nome = c.nome ?? t('x2.bandeja.apagar');
  const detalhe = c.acao === 'via' ? t('x2.bandeja.largura', { n: VIAS[c.id]?.largura ?? '' }) : c.efeito ? t('x2.bandeja.atende', { n: fmt.numero(c.efeito) }) : null;
  const cor = c.acao === 'zona' && c.familia ? COR_FAMILIA[c.familia] : null;
  const soltar = () => clearTimeout(espera.current);
  return (
    <Botao
      a="item"
      k={c.id}
      rotulo={c.trancado ? `${nome}. ${t('x2.trancado', { n: c.marco })}` : nome}
      ativo={ativo}
      class={`item-cartao${c.trancado ? ' trancado' : ''}${ativo ? ' ativo' : ''}`}
      role="listitem"
      onPointerDown={(ev) => {
        longo.current = false;
        clearTimeout(espera.current);
        espera.current = setTimeout(() => {
          longo.current = true;
          aoDetalhe(c);
        }, ev.pointerType === 'mouse' ? 700 : TOQUE_LONGO);
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onClick={() => {
        soltar();
        if (longo.current) return;
        if (c.trancado) {
          avisar({ texto: t('x2.trancadoSemNome', { n: c.marco }), gravidade: 'info' });
          return;
        }
        ferramentas.escolherItem(c);
      }}
    >
      <span class="item-glifo">
        {cor ? <i class="item-amostra" style={{ background: cor }} data-densidade={c.densidade} /> : null}
        <Glifo n={c.trancado ? 'cadeado' : c.glifo} tam={c.trancado ? 22 : 28} />
      </span>
      <span class="item-nome">{nome}</span>
      {c.trancado ? (
        <span class="item-preco item-trancado">{t('x2.trancado', { n: c.marco })}</span>
      ) : preco.texto ? (
        <span class={`item-preco num${preco.falta ? ' falta' : ''}`}>
          {preco.falta ? <Glifo n="semCreditos" tam={12} /> : null}
          {preco.texto}
        </span>
      ) : detalhe ? (
        <span class="item-preco">{detalhe}</span>
      ) : null}
    </Botao>
  );
}

function Detalhe({ c, fechar }) {
  const linhas = [];
  if (c.acao === 'via') {
    const v = VIAS[c.id];
    linhas.push([t('x2.bandeja.detalhe.custo'), t('x2.bandeja.porMetro', { v: fmt.numero(v.custoM ?? 0) })]);
    linhas.push([t('x2.bandeja.detalhe.manutencao'), t('x2.bandeja.porKm', { v: `${fmt.numero(v.manutKmH ?? 0)}${t('unid.porHora')}` })]);
  } else if (c.acao === 'colocar') {
    const x = c.dados.item;
    linhas.push([t('x2.bandeja.detalhe.custo'), fmt.creditos(x.custo ?? 0)]);
    if (x.manutencaoHora) linhas.push([t('x2.bandeja.detalhe.manutencao'), `${fmt.numero(x.manutencaoHora)}${t('unid.porHora')}`]);
    if (x.alcance) linhas.push([t('x2.bandeja.detalhe.alcance'), `${fmt.numero(x.alcance)} m`]);
  } else if (c.acao === 'zona' && ZONAS[c.id]) {
    linhas.push([ZONAS[c.id].nome, t('x2.bandeja.andares', { a: ZONAS[c.id].andares[0], b: ZONAS[c.id].andares[1] })]);
  }
  if (c.marco) linhas.push([t('x2.bandeja.detalhe.marco'), String(c.marco)]);
  return (
    <div class="bandeja-detalhe" role="tooltip" onClick={fechar}>
      <b>{c.nome ?? t('x2.bandeja.apagar')}</b>
      {linhas.map(([a, b]) => (
        <span class="par">
          <span class="par-rot">{a}</span>
          <span class="par-valor num">{b}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * @param {{ ui: object, cat: string, lado: 'esquerda' | 'direita' }} p
 */
export function Bandeja({ ui, cat, lado = 'esquerda' }) {
  const ref = useRef(null);
  const [aba, setAba] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const esp = ui.obterSim()?.espelho;
  const { abas, itens } = itensDaCategoria(cat, { consultar: ui.consultar, marco: marcoAtual.value, livre: esp?.partida?.modo === 'livre' });
  const abaAtiva = abas ? (abas.some((a) => a.id === aba) ? aba : abas[0].id) : null;
  const lista = abaAtiva ? itens.filter((i) => i.aba === abaAtiva) : itens;
  // tocar fora da bandeja (e fora do botão que a abriu) fecha
  useEffect(() => {
    const fora = (ev) => {
      if (ref.current?.contains(ev.target)) return;
      if (ev.target?.closest?.('[data-a="categoria"], [data-a="ferr.tipo"]')) return;
      categoria.value = null;
    };
    document.addEventListener('pointerdown', fora, true);
    return () => document.removeEventListener('pointerdown', fora, true);
  }, []);
  const s = sessao.value;
  const ativo = (c) => (s?.tipo === 'via' && c.acao === 'via' ? s.maquina.tipo === c.id : s?.tipo === 'zona' && c.acao === 'zona' ? (c.dados.apagar ? s.maquina.apagar : !s.maquina.apagar && s.maquina.zona === c.id) : false);
  const nome = t(`x2.cat.${cat}`);
  return (
    <div ref={ref} class={`bandeja vidro bandeja-${lado}`} data-hud="bandeja" role="dialog" aria-label={t('x2.bandeja.rotulo', { nome })}>
      {abas ? <Abas abas={abas} ativa={abaAtiva} aoTrocar={setAba} a="bandeja.aba" rotulo={nome} class="bandeja-abas" /> : null}
      {lista.length ? (
        <div class="bandeja-itens" role="list">
          {lista.map((c) => (
            <Cartao key={c.id} c={c} ativo={ativo(c)} aoDetalhe={setDetalhe} />
          ))}
        </div>
      ) : (
        <p class="bandeja-vazia">{t('x2.bandeja.vazia')}</p>
      )}
      {detalhe ? <Detalhe c={detalhe} fechar={() => setDetalhe(null)} /> : null}
    </div>
  );
}

export function registrar() {}
