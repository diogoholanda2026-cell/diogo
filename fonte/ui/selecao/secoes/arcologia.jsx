// Seção da folha de uma parte da Arcologia (dona: X1b): o que o R.selecionar devolve no domínio 'arcologia' ({ idx da
// parte em PARTES_ORDEM, ref do trecho do Horizon Ring }). Nome em inglês (D89), o que a parte é, se está construída, em
// obra ou em fantasma; a etapa do Ato 1 que vale agora, com o progresso, o que falta e o botão de começar; o prazo da
// história do que vem depois; e o caminho para o Livro da Arcologia. Lê só q.arcologia (a parte não tem q.predio).
import { t, temTexto } from '../../textos.js';
import * as fmt from '../../formato.js';
import { Bloco, Par } from '../Folha.jsx';
import { folhaAberta } from '../Cartao.jsx';
import { Barra } from '../../comp/Barra.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { PARTES_ORDEM } from '../../../data/arcologia-plano.js';
import { nomeParte, nomeTrecho, nomeEtapa, fraseEfeito, fraseRecusa, iniciarEtapa } from '../../telas/LivroArcologia.jsx';

/** A parte da seleção: { id, trecho } (idx da PARTES_ORDEM; o trecho do Horizon Ring em ref). */
export function parteDaSelecao(sel) {
  const id = PARTES_ORDEM[sel?.idx] ?? (typeof sel?.ref === 'string' && sel.ref.startsWith('horizon.') ? 'horizon' : null);
  return { id, trecho: typeof sel?.ref === 'string' ? sel.ref : null };
}

/** A etapa que vale agora numa parte: a em obra, senão a primeira que não ficou pronta, senão a última. */
export const etapaDaVez = (etapas = []) => etapas.find((e) => e.estado === 2) ?? etapas.find((e) => e.estado !== 3) ?? etapas[etapas.length - 1] ?? null;

export function SecaoArcologia({ ui, sel }) {
  const { id, trecho } = parteDaSelecao(sel);
  const a = ui.consultar('arcologia');
  const parte = a?.partes?.find((p) => p.id === id) ?? null;
  const etapas = parte?.etapas ?? [];
  const e = etapaDaVez(etapas);
  const prontas = etapas.length > 0 && etapas.every((x) => x.estado === 3);
  const estado = prontas ? 'pronta' : etapas.some((x) => x.estado >= 2) ? 'obra' : 'fantasma';
  const futuras = (parte?.futuras ?? []).filter((f) => !trecho || f.id.startsWith(`${trecho}.`));
  const caixa = ui.loja?.barra?.value?.creditos;
  const abrirLivro = () => {
    folhaAberta.value = false;
    ui.abrirTela('arcologia');
  };
  return (
    <>
      <Bloco titulo={t('folha.resumo')}>
        {id && temTexto(`x1.faz.${id}`) ? <p class="fl-nota">{t(`x1.faz.${id}`)}</p> : null}
        <Par k="estado" rotulo={t('x1.situacao')} valor={t(`x1.estadoParte.${estado}`)} estado={estado === 'pronta' ? 'ok' : estado === 'obra' ? 'ch' : null} glifo={estado === 'pronta' ? 'check' : estado === 'obra' ? 'obra' : null} />
      </Bloco>
      {e && !prontas ? (
        <Bloco titulo={`${nomeEtapa(e)} · ${t(`x1.estado.${e.estado ?? 0}`)}`}>
          {e.estado === 2 ? <Barra valor={e.progresso ?? 0} estado="ch" rotulo={nomeEtapa(e)} texto={t('x1.progresso', { p: fmt.pct(e.progresso ?? 0) })} /> : null}
          {e.estado === 2 && e.parada ? <p class="fl-nota tx-al">{t(`x1.parada.${e.parada}`)}</p> : null}
          {e.estado < 2 ? <p class="fl-nota">{fraseRecusa(e, etapas, Number.isFinite(caixa) ? caixa : Infinity) ?? t('x1.estado.1')}</p> : null}
          {(e.materiais ?? []).map((m) => (
            <Par k={m.item} rotulo={temTexto(`s3.item.${m.item}`) ? t(`s3.item.${m.item}`) : m.item} valor={t('x1.material', { entregue: fmt.numero(m.entregue ?? 0), pede: fmt.numero(m.pede) })} estado={(m.entregue ?? 0) >= m.pede ? 'ok' : e.estado === 2 ? 'al' : null} />
          ))}
          {(e.efeitos ?? []).map((ef) => fraseEfeito(ef)).filter(Boolean).map((x) => (
            <p class="fl-nota">{x}</p>
          ))}
          {e.estado === 1 ? (
            <Botao a="folha.arcologia.iniciar" rotulo={t('x1.iniciar', { v: fmt.dinheiro(e.creditos ?? 0) })} principal class="bt-pri" desligado={Number.isFinite(caixa) && caixa < (e.creditos ?? 0)} onClick={() => iniciarEtapa(e.id)}>
              <Glifo n="construir" tam={18} />
              {t('x1.iniciar', { v: fmt.dinheiro(e.creditos ?? 0) })}
            </Botao>
          ) : null}
        </Bloco>
      ) : null}
      {futuras.length ? (
        <Bloco titulo={t('x1.futuras')}>
          {futuras.map((f) => (
            <Par k={f.id} rotulo={f.nome} valor={t('x1.prazo', { data: fmt.dataCalendario(f.prazo) })} />
          ))}
          <p class="fl-nota">{t('x1.futuras.nota')}</p>
        </Bloco>
      ) : null}
      <Botao a="folha.arcologia.livro" rotulo={t('x1.abrirLivro')} class="bt-ch" onClick={abrirLivro}>
        <Glifo n="arcologia" tam={18} />
        {t('x1.abrirLivro')}
      </Botao>
    </>
  );
}

SecaoArcologia.titulo = ({ sel }) => {
  const { id, trecho } = parteDaSelecao(sel);
  const nome = (trecho && nomeTrecho(trecho)) || nomeParte(id) || t('folha.arcologia');
  return { nome, sub: trecho ? t('x1.trecho', { n: trecho.split('.')[1] }) : t('x1.sede'), glifo: 'arcologia', cor: 'var(--ch)' };
};

export function registrar(ui) {
  ui.registrarSecao('arcologia', SecaoArcologia, { ordem: 80 });
}
