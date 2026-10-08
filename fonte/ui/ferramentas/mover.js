// Mover e girar construções prontas (MOV1, D94, D98; dona: MOV1): a ferramenta REAPROVEITA a de colocar. Quem escolhe o
// lugar é o fantasma do colocar (giro livre, ímã de 15 graus, alinhar à via, motivo do vermelho, aplainar, puxador, giro de
// dois dedos), com três diferenças que moram aqui, em funções puras: a prévia vem de q.mover.previa (o mesmo lugar do
// construir, o custo de uns 10% e o que muda), o item é o prédio de hoje (nome, planta e alcance dele) e o comando é o
// `mover`. A cola (sessao.js) abre a sessão como 'colocar' com `maquina.mover = { ref, de }`; a barra, o painel do fantasma e
// o puxador são os de lá, e o painel "o que muda" (PainelMover.jsx) lê as linhas de linhasDoQueMuda.
import * as colocar from './colocar.js';
import { registrar as registrarTextosMov2 } from '../textos/mov2.js';
import { registrarTextos } from '../textos.js';

// os textos da zona (MOV2) entram com a ferramenta: a dica e o painel podem rodar antes de a folha ou o painel carregarem
registrarTextosMov2(registrarTextos);

/** Registra os textos da MOV2 (zona) num índice de textos (a folha e o painel chamam; é idempotente). */
export const registrarTextosDeZona = (registrar) => registrarTextosMov2(registrar);

/** Glifo de mover (quatro setas), registrado pela sessão no traço do registro. */
export const GLIFO_MOVER = Object.freeze({
  mover: ['M12 3.5v17', 'M3.5 12h17', 'M9 6.5 12 3.5l3 3', 'M9 17.5l3 3 3-3', 'M6.5 9 3.5 12l3 3', 'M17.5 9l3 3-3 3'],
});

/** A camada que mostra o alcance do serviço (a mesma da folha dele): água, energia e esgoto têm a sua; o resto, Serviços. */
const camadaDoServico = (cat) => (cat === 'agua' || cat === 'energia' || cat === 'esgoto' ? cat : 'servicos');

/**
 * Pode abrir a ferramenta para o prédio p (o q.predio)? { ok: true } ou { ok: false, chave, codigo }. A chave é o texto da
 * dica ('mov1.fixo.arcologia', 'mov1.fixo.obra' ou o 'codigo.inexistente' de um prédio que não existe mais).
 * Sem a consulta (a vitrine), vale o que o tipo diz.
 */
export function podeAbrir(p) {
  if (!p || !Number.isFinite(p.x)) return { ok: false, chave: 'codigo.inexistente', codigo: 'inexistente' };
  if (p.mover) return p.mover.pode ? { ok: true } : { ok: false, chave: `mov1.fixo.${p.mover.motivo ?? 'arcologia'}`, codigo: p.mover.codigo ?? 'fixo' };
  return { ok: true };
}

/**
 * O item que a ferramenta de colocar usa (o formato do q.catalogo) para o prédio p: o nome da barra diz que é mover, o custo
 * são os 10% (sem manutenção: mover não muda o que o prédio custa por hora) e a pegada e o alcance são os dele.
 * `nomeReal` é o nome do prédio, para os avisos.
 */
export function itemDoMover(p, t) {
  const nome = p.nome ?? p.id;
  // o prédio de zona tem a planta em metros na tabela (p.w e p.d), como o colocável
  return {
    tipo: p.id, nome: t('mov1.barra.nome', { nome }), nomeReal: nome, custo: p.mover?.custo ?? 0, manutencaoHora: 0, alcance: p.servico?.alcance ?? 0,
    pegada: [p.w, p.d], glifo: 'mover', camada: p.servico ? camadaDoServico(p.servico.categoria) : null, mover: true,
  };
}

/** A máquina do colocar para mover o prédio p: no lugar de agora, na rotação de agora, sem alinhar (ele só anda quando o jogador mexe). */
export function criarMover(p, item, { rot = null, giro = 0, alinhar = false } = {}) {
  return colocar.criarColocar({
    tipo: p.id, item, mover: { ref: p.ref, de: { x: p.x, z: p.z, rot: p.rot } }, rot: rot ?? p.rot, giro, alinhar, x: p.x, z: p.z,
  });
}

/** Os argumentos de q.mover.previa a partir do efeito 'previa' da máquina (o aplainar a interface sempre aceita pagar). */
export const argsDaPrevia = (maq, x) => ({ ref: maq.mover.ref, x: x.x, z: x.z, rot: x.rot, giro: x.giro, alinhar: x.alinhar, aplainar: true });

/** O comando mover com o lugar da prévia (o fantasma já é o lugar final: não gruda de novo). */
export const argsDoComando = (maq, previa) => ({ ref: maq.mover.ref, x: previa.x, z: previa.z, rot: previa.rot, alinhar: false, aplainar: true });

/**
 * A prévia que a ferramenta mostra: a da simulação, com 'nada' (o prédio está onde está: ainda não há o que confirmar)
 * virando a prévia PARADA, que não é erro (fica azul, mostra o custo de mover e deixa o Mover fraco), e o item em obra
 * ('ocupado') com o motivo certo.
 */
export function ajustarPrevia(r, item) {
  if (!r) return r;
  if (r.codigo === 'nada') return { ...r, ok: true, parado: true, codigo: 'nada', dados: null, custo: r.custo || item?.custo || 0, manutencaoHora: 0 };
  if (r.codigo === 'ocupado' && !r.dados) return { ...r, dados: { fixo: 'obra' } };
  return r;
}

/** O que valida o botão Mover: a prévia serve e o prédio saiu do lugar (ou girou). */
export const previaConfirmavel = (p) => !!p?.ok && !p.parado;

/**
 * SUBSTITUTO de q.mover.previa (a vitrine e a simulação falsa): a prévia do colocar para o tipo do prédio, na pegada dele,
 * com o custo de mover. Sem os dados da simulação, nada de "o que muda".
 */
export function previaMoverLocal(esp, args, maq, item) {
  const r = colocar.previaColocarLocal(esp, { tipo: maq.tipo, x: args.x, z: args.z, rot: args.rot, giro: args.giro, alinhar: args.alinhar }, item);
  const de = maq.mover.de;
  const mesmo = Math.hypot((r.x ?? args.x) - de.x, (r.z ?? args.z) - de.z) < 0.25 && colocar.graus(r.rot ?? 0) === colocar.graus(de.rot);
  const out = { ...r, custo: item?.custo ?? 0, manutencaoHora: 0, de, ref: maq.mover.ref, mobilizacao: 12, tiques: 36, desfazer: true };
  return mesmo && r.ok ? { ...out, ok: false, codigo: 'nada' } : out;
}

// ------------------------------------------------------------------------------------------------ o que muda

/**
 * As linhas do painel "o que muda" de uma prévia: [{ id, texto, tom: 'ok' | 'al' | 'er' | null }]. `ui` leva t e fmt (o
 * mesmo que a dica do colocar usa). Sem `previa.muda` (lugar vermelho, prévia parada ou substituta) só o que a prévia sabe.
 */
export function linhasDoQueMuda(previa, { t, fmt }) {
  if (!previa || previa.parado) return [];
  const out = [];
  const add = (id, texto, tom = null) => out.push({ id, texto, tom });
  if (previa.ok || previa.codigo === 'creditos') {
    const pct = previa.valor > 0 ? fmt.pct((previa.custoMover ?? 0) / previa.valor) : fmt.pct(0.1);
    const zona = previa.zona;
    const custoMover = fmt.dinheiro(previa.custoMover ?? previa.custo ?? 0);
    // zona em obra: a base é o que a obra já gastou; sem gasto, mover é de graça
    if (zona?.emObra) add('custo', previa.valor > 0 ? t('mov2.linha.custoObra', { custo: custoMover, pct }) : t('mov2.linha.custoZeroObra'));
    else add('custo', t('mov1.linha.custo', { custo: custoMover, pct }));
    const n = previa.demolir?.length ?? 0;
    if (n) add('demolir', t(n === 1 ? 'mov1.linha.demolir1' : 'mov1.linha.demolirN', { n, custo: fmt.dinheiro(previa.custoDemolir ?? 0) }), 'al');
    if (zona?.emObra) add('obra', t('mov2.linha.zonaObra', { pct: fmt.pct(zona.progresso ?? 0) }), 'ok');
    else if (zona && Number.isFinite(previa.tiques)) add('obra', t('mov2.linha.zonaPronto', { tempo: fmt.minutosDeJogo(previa.tiques + (previa.mobilizacao ?? 0)) }), 'ok');
    else if (Number.isFinite(previa.tiques)) add('obra', t('mov1.linha.obra', { tempo: fmt.minutosDeJogo(previa.tiques + (previa.mobilizacao ?? 0)) }));
    const cel = zona?.celulas;
    if (cel) add('celulas', cel.ocupam > 0 ? t('mov2.linha.zonaCelulas', { liberam: fmt.numero(cel.liberam), ocupam: fmt.numero(cel.ocupam) }) : t('mov2.linha.zonaLivre', { liberam: fmt.numero(cel.liberam) }));
  }
  const m = previa.muda;
  if (m) {
    const c = m.cobertura;
    if (c) {
      const categoria = t(`fator.${c.categoria}`).replace(/^\?\?.*/, c.categoria);
      add('cobertura', t('mov1.linha.cobertura', { antes: fmt.numero(c.antes), depois: fmt.numero(c.depois), categoria }), c.depois < c.antes ? 'al' : c.depois > c.antes ? 'ok' : null);
      if (c.deixam > 0) add('deixam', t('mov1.linha.deixam', { n: fmt.numero(c.deixam) }), 'al');
      if (c.passam > 0) add('passam', t('mov1.linha.passam', { n: fmt.numero(c.passam) }), 'ok');
    }
    const v = m.via;
    if (v) {
      if (!v.depois) add('via', t('mov1.linha.semVia'), 'er');
      else {
        const nome = v.depois.nome ?? null;
        const antes = v.antes?.nome ?? null;
        const mudou = v.antes?.ref !== v.depois.ref;
        add('via', nome ? t(mudou && antes && antes !== nome ? 'mov1.linha.viaDe' : 'mov1.linha.via', { nome, antes }) : t('mov1.linha.viaSemNome'));
      }
    }
    if (m.rede) add('rede', t(m.rede.depois ? 'mov1.linha.rede' : 'mov1.linha.semRede'), m.rede.depois ? 'ok' : 'al');
    if (m.armazem) {
      const a = m.armazem;
      const efeito = a.penalDepois > 0 ? `${fmt.comSinal(-100 * a.penalDepois, 0)}%` : null;
      add(
        'armazem',
        efeito ? t('mov1.linha.armazem', { antes: fmt.numero(a.antes), depois: fmt.numero(a.depois), efeito }) : t('mov1.linha.armazemIgual', { antes: fmt.numero(a.antes), depois: fmt.numero(a.depois) }),
        a.penalDepois > a.penalAntes ? 'al' : a.penalDepois < a.penalAntes ? 'ok' : null,
      );
    }
  }
  if (previa.ok && previa.desfazer && Number.isFinite(previa.mobilizacao)) add('desfazer', t('mov1.linha.desfazer', { tempo: fmt.minutosDeJogo(previa.mobilizacao) }));
  return out;
}

// ------------------------------------------------------------------------------------------------ dica

/**
 * A dica das recusas que são do mover (o formato de colocar.dicaDoBloqueio) ou null para as que o colocar já sabe dizer.
 * 'nada' é só a instrução (tom info); 'ocupado' e as fixas dizem o motivo; o resto (acesso, colisão, declive, créditos...)
 * é o do colocar.
 */
export function dicaDeMover(p) {
  if (!p) return null;
  if (p.parado || p.codigo === 'nada') return { codigo: 'nada', chave: 'mov1.dica.nada', params: {}, tom: 'info', colide: null };
  if (p.ok) return null;
  // zona de outro tipo pintada no lugar novo (MOV2): o mover diz, o colocar não conhece
  if (p.codigo === 'colisao' && p.dados?.com === 'zona') return { codigo: 'colisao', chave: 'mov2.dica.zonaOutra', params: {}, tom: 'er', colide: null };
  if (p.codigo === 'ocupado' || p.codigo === 'fixo' || p.dados?.fixo) {
    const f = p.dados?.fixo ?? 'obra';
    return { codigo: p.codigo, chave: `mov1.dica.fixo.${f}`, params: {}, tom: 'er', colide: null };
  }
  return null;
}
