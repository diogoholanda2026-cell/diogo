// Folha do selecionado (desenho da UI 7.3 e 8.7): 360 px no celular e 400 no PC, à esquerda, de sob a barra de cima até
// acima da barra de construção. Abre pelo "Detalhes" do cartão (direto no PC, na Arcologia e no terreno). Cabeçalho
// com Voltar (pilha de até 5: de um prédio ao fornecedor e de volta), glifo, nome (o lápis renomeia), tipo e nível,
// Localizar e Fechar; abas quando a seção pede; rodapé com Cor e Demolir (prédio), Melhorar e Demolir (via) ou Zonear
// e Construir (terreno).
// Seções por registro (ui.registrarSecao): uma por família, com o id da família, que recebe { ui, sel, p, aba } e
// devolve o corpo: 'residencial', 'comercial', 'industrial', 'servico', 'empresa' (Holding), 'via', 'terreno' (U1b) e
// 'arcologia' (X1b). Opcionais no componente: Comp.abas(p) → [{ id, rotulo }] e Comp.titulo({ sel, p, ui }) →
// { nome, sub, glifo } (a Arcologia e o terreno não têm q.predio). Os blocos daqui (Bloco, Par, Avisos, Nivel,
// Servicos, Fatores) servem às seções de todas as parcelas.
import { useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { selecao, detalhe, ferramenta, camada } from '../loja.js';
import { comando } from '../acoes.js';
import { t, temTexto } from '../textos.js';
import * as fmt from '../formato.js';
import { Folha as Moldura } from '../comp/Folha.jsx';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { Aviso } from '../comp/Aviso.jsx';
import { Barra } from '../comp/Barra.jsx';
import { Ancora, Popover } from '../comp/Popover.jsx';
import { ferramentas } from '../ferramentas/sessao.js';
import { zona as dadosZona } from '../../data/zonas.js';
import { CORES_PREDIO } from '../../data/estilos.js';
import { BotaoMover } from '../ferramentas/BotaoMover.jsx';
import { folhaAberta, manterFolha, aparencia, subtitulo, avisoPrincipal, registrarAcaoAviso, acaoDeAviso, nomeTipoVia, glifoDaVia, faseDaObra } from './Cartao.jsx';

export const PILHA_MAX = 5;
/** Seleções anteriores (o Voltar da folha). */
export const pilha = signal([]);

const FAMILIA_ZONA = { res: 'residencial', com: 'comercial', esc: 'comercial', ind: 'industrial' };

/** Família da seleção, que escolhe a seção: 'residencial' | 'comercial' | 'industrial' | 'servico' | 'empresa' | 'via' | 'terreno' | 'arcologia' | null. */
export function familiaDe(sel, p) {
  if (!sel) return null;
  if (sel.tipo === 'aresta') return 'via';
  if (sel.tipo === 'terreno' || sel.tipo === 'agua') return 'terreno';
  if (sel.tipo === 'arcologia') return 'arcologia';
  if (!p) return null;
  if (p.tipo === 'holding' || (p.holding && !p.servico)) return 'empresa';
  if (p.tipo === 'servico' || p.servico) return 'servico';
  const fam = p.familia ?? dadosZona(p.zona)?.familia;
  return FAMILIA_ZONA[fam] ?? (p.moradia ? 'residencial' : p.trabalho ? 'comercial' : null);
}

/** Leva a folha para outra seleção, guardando a atual no Voltar (até 5). */
export function navegar(ui, sel) {
  const atual = selecao.peek();
  if (atual) pilha.value = [...pilha.peek(), atual].slice(-PILHA_MAX);
  manterFolha.proxima = true;
  selecao.value = sel;
  ui.R?.selecionado?.(sel?.ref !== undefined && sel.tipo !== 'terreno' ? { tipo: sel.tipo, ref: sel.ref } : null);
}

function voltar(ui) {
  const l = pilha.peek();
  if (!l.length) return;
  const sel = l[l.length - 1];
  pilha.value = l.slice(0, -1);
  manterFolha.proxima = true;
  selecao.value = sel;
  ui.R?.selecionado?.(sel?.ref !== undefined && sel.tipo !== 'terreno' ? { tipo: sel.tipo, ref: sel.ref } : null);
}

// ------------------------------------------------------------------------------------------ blocos das seções

/** Seção da folha com rótulo de caixa alta. */
export const Bloco = ({ titulo, children, acao = null }) => (
  <section class="fl-bloco">
    {titulo ? (
      <header class="fl-bloco-cab">
        <h2 class="rot">{titulo}</h2>
        {acao}
      </header>
    ) : null}
    {children}
  </section>
);

/** Linha rótulo e valor (tabular à direita), com glifo e estado opcionais e a dica da hora de jogo. */
export const Par = ({ rotulo, valor, estado = null, glifo = null, dica = null, k }) => (
  <div class="fl-par" data-k={k}>
    <span class="fl-par-rot">{rotulo}</span>
    <span class={`fl-par-valor num${estado ? ` tx-${estado}` : ''}`} title={dica ?? undefined} data-dica={dica ? 'hora' : undefined}>
      {glifo ? <Glifo n={glifo} tam={16} /> : null}
      {valor}
    </span>
  </div>
);

/** Todos os avisos do prédio, do mais grave, com a ação que resolve (as registradas em registrarAcaoAviso). */
export function Avisos({ ui, p, sel }) {
  const agora = ui.obterSim()?.espelho?.tempo?.tique ?? null;
  const l = [...(p?.avisos ?? [])];
  if (p?.estado === 'abandonado' && !l.some((a) => a.codigo === 'abandonado')) l.push({ codigo: 'abandonado', gravidade: 'grave' });
  if (!l.length) return null;
  return (
    <Bloco titulo={t('folha.avisos')}>
      <div class="fl-avisos">
        {l.map((a) => {
          const x = avisoPrincipal({ avisos: [a] }, agora);
          const fazer = a.acao ? acaoDeAviso(a.acao) : null;
          return <Aviso gravidade={x.gravidade} glifo={x.glifo} texto={x.texto} sub={x.sub} acao={fazer ? x.acao : null} aoAcao={() => fazer?.({ ui, predio: p, selecao: sel })} a="folha.aviso" k={a.codigo} />;
        })}
      </div>
    </Bloco>
  );
}

/** Nível de 1 a 5 com a barra e o que falta para subir (q.predio().nivelProx). */
export function Nivel({ p }) {
  const n = p?.nivel > 0 ? p.nivel : 1;
  const prox = p?.nivelProx;
  const falta = (prox?.falta ?? []).filter((c) => c !== 'maximo');
  return (
    <Bloco titulo={t('folha.nivel')}>
      <Barra valor={n / 5} estado="ac" rotulo={t('folha.nivelDe', { n })} texto={t('folha.nivelDe', { n })} />
      {n >= 5 || (prox?.falta ?? []).includes('maximo') ? (
        <p class="fl-nota">{t('folha.nivelMax')}</p>
      ) : falta.length ? (
        <p class="fl-nota">{t('folha.nivelFalta', { lista: falta.map((c) => (temTexto(`falta.${c}`) ? t(`falta.${c}`) : c)).join(', ') })}</p>
      ) : prox ? (
        <p class="fl-nota">{t('folha.nivelPontos', { pontos: fmt.numero(prox.pontos ?? 0), meta: fmt.numero(prox.meta ?? 0) })}</p>
      ) : null}
    </Bloco>
  );
}

const REDE = { ok: ['check', 'ok'], racionado: ['alerta', 'al'], sem: ['alerta', 'er'] };
const COBERTURAS = ['saude', 'educacao', 'seguranca', 'bombeiros', 'lazer'];

/** Redes (água, energia; esgoto no M1b) e a cobertura de cada serviço na rua do prédio. */
export function Servicos({ p }) {
  const s = p?.servicos;
  if (!s) return null;
  return (
    <Bloco titulo={t('folha.servicos')}>
      <div class="fl-redes">
        {['agua', 'energia', 'esgoto'].map((r) => {
          if (!s[r]) return null;
          const [g, e] = REDE[s[r]] ?? REDE.sem;
          return (
            <span class={`chip chip-${e}`}>
              <Glifo n={g} tam={16} />
              <span class="chip-texto">{t(`folha.rede.${r}`)}</span>
            </span>
          );
        })}
      </div>
      {COBERTURAS.filter((c) => Number.isFinite(s[c])).map((c) => (
        <div class="fl-par fl-par-barra" data-k={c}>
          <span class="fl-par-rot">{t(`fator.${c}`)}</span>
          <Barra valor={s[c]} estado={s[c] >= 0.8 ? 'ok' : s[c] >= 0.4 ? 'ac' : 'al'} rotulo={t(`fator.${c}`)} texto={fmt.pct(s[c])} />
        </div>
      ))}
    </Bloco>
  );
}

/** Fatores com o número de cada um (bem-estar, demanda, produtividade): o "de onde vem". */
export function Fatores({ titulo, fatores, pct = false }) {
  const l = (fatores ?? []).filter((f) => Number.isFinite(f?.v));
  if (!l.length) return null;
  return (
    <Bloco titulo={titulo}>
      {l.map((f) => (
        <Par k={f.id} rotulo={temTexto(`fator.${f.id}`) ? t(`fator.${f.id}`) : f.id} valor={pct ? fmt.comSinal(f.v * 100, 0) + '%' : fmt.comSinal(f.v, f.v % 1 ? 1 : 0)} estado={f.v < 0 ? 'al' : null} glifo={f.v < 0 ? 'menos' : f.id === 'base' ? null : 'mais'} />
      ))}
    </Bloco>
  );
}

/** A obra em curso (fase, progresso e a falta de material). */
export function Obra({ p }) {
  if (p?.estado !== 'obra' || !p.obra) return null;
  const f = faseDaObra(p.obra);
  return (
    <Bloco titulo={t('folha.obra')}>
      <Barra valor={f.frac} estado="al" rotulo={t('cartao.obra', { fase: f.nome })} texto={`${t('cartao.obra', { fase: f.nome })} · ${fmt.pct(f.frac)}`} />
      {p.obra.semMaterial ? <p class="fl-nota tx-al">{t('folha.obraSemMaterial')}</p> : null}
    </Bloco>
  );
}

// ------------------------------------------------------------------------------------------ folha

function Cores({ ui, p }) {
  const [aberto, setAberto] = useState(false);
  const escolher = (cor) => {
    setAberto(false);
    comando('predio.cor', { ref: p.ref, cor });
  };
  return (
    <Ancora class="fl-cores">
      <Botao a="folha.cor" rotulo={t('folha.cor')} aria-expanded={String(aberto)} class="bt-sec" onClick={() => setAberto(!aberto)}>
        <Glifo n="cor" tam={18} />
        <span>{t('folha.cor')}</span>
      </Botao>
      <Popover aberto={aberto} aoFechar={() => setAberto(false)} titulo={t('folha.cor')} largura={268} a="folha.cores" lado="esquerda">
        <div class="fl-paleta">
          {CORES_PREDIO.map((c, i) => (
            <Botao a="folha.cor.escolher" k={i} rotulo={i ? t('folha.corN', { n: i }) : t('folha.corPadrao')} ativo={(p.cor ?? 0) === i} class={`fl-cor${i ? '' : ' padrao'}`} style={c ? { '--cor': c } : null} onClick={() => escolher(i)}>
              {i ? null : <Glifo n="fechar" tam={16} />}
            </Botao>
          ))}
        </div>
      </Popover>
    </Ancora>
  );
}

function Rodape({ ui, fam, sel, p }) {
  const fechar = () => {
    folhaAberta.value = false;
    selecao.value = null;
    ui.R?.selecionado?.(null);
  };
  const abrirFerramenta = (f) => {
    fechar();
    ferramenta.value = f;
  };
  if (fam === 'via') {
    return (
      <>
        {p?.melhoraPara?.length ? (
          <Botao a="folha.melhorar" rotulo={t('folha.melhorar')} class="bt-sec" onClick={() => abrirFerramenta({ tipo: 'via', modo: 'melhorar', tipoVia: p.melhoraPara[0] })}>
            {t('folha.melhorar')}
          </Botao>
        ) : null}
        {p && !p.rodovia && !p.arcologia ? (
          <Botao a="folha.demolir" rotulo={t('folha.demolir')} class="bt-perigo" onClick={() => abrirFerramenta({ tipo: 'demolir' })}>
            <Glifo n="demolir" tam={18} />
            {t('folha.demolir')}
          </Botao>
        ) : null}
      </>
    );
  }
  if (fam === 'terreno') {
    return (
      <>
        <Botao a="folha.zonear" rotulo={t('folha.zonear')} class="bt-sec" onClick={() => { fechar(); ferramentas.escolherCategoria('zonas'); }}>
          {t('folha.zonear')}
        </Botao>
        <Botao a="folha.construir" rotulo={t('folha.construir')} class="bt-sec" onClick={() => { fechar(); ferramentas.escolherCategoria('servicos'); }}>
          {t('folha.construir')}
        </Botao>
      </>
    );
  }
  if (!p || fam === 'arcologia') return null;
  return (
    <>
      <Cores ui={ui} p={p} />
      <BotaoMover p={p} aoAbrir={() => abrirFerramenta({ tipo: 'mover', ref: p.ref })} />
      <Botao a="folha.demolir" rotulo={t('folha.demolir')} class="bt-perigo" onClick={() => abrirFerramenta({ tipo: 'demolir' })}>
        <Glifo n="demolir" tam={18} />
        {t('folha.demolir')}
      </Botao>
    </>
  );
}

function Renomear({ p, aoFim }) {
  const [nome, setNome] = useState(p.nome ?? '');
  const salvar = async () => {
    const n = nome.trim();
    if (n && n !== p.nome) await comando('predio.nome', { ref: p.ref, nome: n.slice(0, 40) });
    aoFim();
  };
  return (
    <form class="fl-renomear" onSubmit={(ev) => { ev.preventDefault(); salvar(); }}>
      <input class="fl-renomear-campo" value={nome} maxLength={40} aria-label={t('folha.nome')} onInput={(ev) => setNome(ev.currentTarget.value)} autoFocus />
      <Botao a="folha.nome.ok" rotulo={t('folha.nome.ok')} class="bt-glifo" type="submit">
        <Glifo n="check" />
      </Botao>
    </form>
  );
}

/** Título, subtítulo e glifo da folha pela família (a seção pode dar os seus). */
function cabecalho(ui, fam, sel, p, Secao) {
  const proprio = Secao?.titulo?.({ sel, p, ui });
  if (proprio) return { glifo: 'info', cor: null, ...proprio };
  if (fam === 'via') return { nome: p?.nome || nomeTipoVia(p?.tipo), sub: nomeTipoVia(p?.tipo), glifo: glifoDaVia(p?.tipo), cor: null };
  if (fam === 'terreno') return { nome: t('folha.terreno'), sub: null, glifo: 'mapa', cor: null };
  if (fam === 'arcologia') return { nome: t('folha.arcologia'), sub: null, glifo: 'arcologia', cor: 'var(--ch)' };
  const ap = aparencia(p);
  return { nome: p?.nome || t('cartao.predio'), sub: subtitulo(p), glifo: ap.glifo, cor: ap.cor };
}

export function FolhaSelecao({ ui }) {
  const sel = selecao.value;
  const p = detalhe.value;
  const [abaDe, setAba] = useState({ chave: null, aba: null });
  // a chave da seleção em edição: trocar de prédio com o campo aberto não renomeia o outro com o nome do primeiro
  const [editando, setEditando] = useState(null);
  if (!folhaAberta.value || !sel) return null;
  const fam = familiaDe(sel, p);
  const Secao = ui.secoes().find((s) => s.id === fam)?.Comp ?? null;
  if (!Secao || (fam !== 'terreno' && fam !== 'arcologia' && !p)) return null;
  const chave = `${sel.tipo}:${sel.ref ?? sel.ponto?.join(',')}`;
  const abas = Secao.abas?.(p) ?? null;
  const aba = abas ? (abaDe.chave === chave && abas.some((a) => a.id === abaDe.aba) ? abaDe.aba : abas[0].id) : null;
  const cab = cabecalho(ui, fam, sel, p, Secao);
  const fechar = () => {
    folhaAberta.value = false;
    pilha.value = [];
    selecao.value = null;
    ui.R?.selecionado?.(null);
  };
  const localizar = () => {
    const pt = sel.ponto ?? (Number.isFinite(p?.x) ? [p.x, p.y ?? 0, p.z] : null);
    if (pt && ui.R?.camera?.irPara) ui.R.camera.irPara({ x: pt[0], z: pt[2], dist: 220 }, 900);
  };
  const podeRenomear = p && fam !== 'via' && fam !== 'terreno' && fam !== 'arcologia';
  const titulo = editando === chave && podeRenomear ? <Renomear key={chave} p={p} aoFim={() => setEditando(null)} /> : cab.nome;
  return (
    <div class="fl-moldura" data-familia={fam}>
      <Moldura
        glifo={cab.glifo}
        cor={cab.cor}
        titulo={titulo}
        rotulo={cab.nome}
        sub={cab.sub}
        abas={abas}
        aba={aba}
        aoTrocarAba={(id) => setAba({ chave, aba: id })}
        aoVoltar={pilha.value.length ? () => voltar(ui) : null}
        aoLocalizar={localizar}
        aoFechar={fechar}
        rodape={<Rodape ui={ui} fam={fam} sel={sel} p={p} />}
        acoes={
          podeRenomear && editando !== chave ? (
            <Botao a="folha.renomear" rotulo={t('folha.renomear')} class="bt-glifo" onClick={() => setEditando(chave)}>
              <Glifo n="editar" tam={18} />
            </Botao>
          ) : null
        }
      >
        <Secao ui={ui} sel={sel} p={p} aba={aba} />
      </Moldura>
    </div>
  );
}

// ações dos avisos de prédio que a U1b sabe fazer (o código vem de q.predio().avisos[].acao)
const verCamada = (id) => () => {
  camada.value = id;
  folhaAberta.value = false;
};

export function registrar(ui) {
  registrarAcaoAviso('verCamadaAgua', verCamada('agua'));
  registrarAcaoAviso('verCamadaEnergia', verCamada('energia'));
  registrarAcaoAviso('verCamadaBemEstar', verCamada('bemEstar'));
  registrarAcaoAviso('verCamadaEmpregos', verCamada('empregos'));
  registrarAcaoAviso('construirVia', () => {
    folhaAberta.value = false;
    selecao.value = null;
    ui.R?.selecionado?.(null);
    ferramenta.value = { tipo: 'via' };
  });
  registrarAcaoAviso('demolir', () => {
    folhaAberta.value = false;
    selecao.value = null;
    ui.R?.selecionado?.(null);
    ferramenta.value = { tipo: 'demolir' };
  });
  ui.registrarHud('folha', FolhaSelecao, { ordem: 20, nome: 'folha' });
}
