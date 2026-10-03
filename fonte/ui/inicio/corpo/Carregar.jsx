// Saves (D31, desenho da UI 8.17 "Salvamento"; dona: U2a), sob demanda: os 3 automáticos e os 8 manuais com a capa, a
// Holding, a população, a data do calendário e quando foi salvo; Carregar, Exportar e Apagar (dois toques) em cada um;
// no jogo, "Salvar aqui" nos manuais; Importar um arquivo .held; as cópias danificadas guardadas na quarentena, com
// Exportar (para mandar). A mesma lista serve à tela 'carregar' do jogo e ao Carregar do menu inicial.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../textos.js';
import { avisar } from '../../loja.js';
import { Tela, Secao } from '../../comp/Tela.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { DoisToques } from '../../comp/DoisToques.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { Vazio } from '../../comp/Vazio.jsx';
import { mostrarRetomar } from '../../hud/Retomar.jsx';
import { rotuloSlot, haQuanto, subSave, useCapa, exportarSave } from './comum.js';
import { usarEstilo } from '../estilo.js';
import { CSS_CORPO } from './estilo.js';
import { SLOTS_AUTO, SLOTS_MANUAIS } from '../../../app/armazem.js';

/** Frase da falha de uma operação de save. */
export const fraseFalha = (r) => t(`u2.falha.${['nada', 'ocupado', 'outraPagina', 'danificado', 'valor'].includes(r?.codigo) ? r.codigo : 'erro'}`);

function Cartao({ s, slot, noJogo, ocupado, aoCarregar, aoExportar, aoApagar, aoSalvar }) {
  const capa = useCapa(s?.capa);
  if (!s) {
    return (
      <article class="sv-cartao sv-vazio" data-slot={slot}>
        <div class="sv-corpo">
          <span class="sv-titulo">{rotuloSlot(slot)}</span>
          <span class="sv-sub">{t('u2.slot.vazio')}</span>
        </div>
        {noJogo && aoSalvar ? (
          <div class="sv-acoes">
            <Botao a="sv.salvar" k={slot} rotulo={t('u2.sv.salvarAqui')} class="bt-sec" desligado={!!ocupado} onClick={() => aoSalvar(slot)}>
              <Glifo n="salvar" tam={18} />
              <span>{t('u2.sv.salvarAqui')}</span>
            </Botao>
          </div>
        ) : null}
      </article>
    );
  }
  return (
    <article class="sv-cartao" data-slot={slot}>
      {capa ? <img class="sv-capa" src={capa} alt="" /> : <div class="sv-capa" aria-hidden="true" />}
      <div class="sv-corpo">
        <span class="sv-titulo">
          <span>{rotuloSlot(slot)}</span>
          <span>{haQuanto(s.data)}</span>
        </span>
        <span class="sv-nome">{s.nome || t('u2.holdingSemNome')}</span>
        <span class="sv-sub">{subSave(s)}</span>
      </div>
      <div class="sv-acoes">
        <Botao a="sv.carregar" k={slot} rotulo={t('u2.sv.carregar')} class="bt-pri" desligado={!!ocupado} onClick={() => aoCarregar(slot)}>
          {t('u2.sv.carregar')}
        </Botao>
        <Botao a="sv.exportar" k={slot} rotulo={t('u2.sv.exportar')} class="bt-sec" onClick={() => aoExportar(slot)}>
          <Glifo n="exportar" tam={18} />
        </Botao>
        {noJogo && aoSalvar && slot.startsWith('manual') ? (
          <DoisToques a="sv.substituir" k={slot} rotulo={t('u2.sv.substituir')} rotuloArmado={t('u2.sv.substituirArmado')} glifo="salvar" aoConfirmar={() => aoSalvar(slot)} />
        ) : null}
        <DoisToques a="sv.apagar" k={slot} rotulo={t('u2.sv.apagar')} rotuloArmado={t('u2.sv.apagarArmado')} glifo="lixo" perigo aoConfirmar={() => aoApagar(slot)} />
      </div>
    </article>
  );
}

/**
 * Lista dos saves.
 * @param {{ ui: object, noJogo: boolean, aoEntrar: (modo: 'carregar' | 'importar', op) => Promise<object> }} p
 */
export function ListaSaves({ ui, noJogo = false, aoEntrar }) {
  const jogo = ui.jogo;
  const [lista, setLista] = useState(null);
  const [quarentena, setQuarentena] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  const arquivo = useRef(null);
  const reler = async () => {
    setLista((await jogo?.listarSaves?.()) ?? []);
    setQuarentena((await jogo?.quarentena?.()) ?? []);
  };
  useEffect(() => {
    usarEstilo('corpo-u2', CSS_CORPO);
    reler();
  }, []);
  const porSlot = new Map((lista ?? []).map((s) => [s.slot, s]));
  const fazer = async (nome, fn) => {
    setOcupado(nome);
    try {
      return await fn();
    } finally {
      setOcupado(null);
    }
  };
  const carregar = (slot) => fazer('carregar', async () => {
    const r = await aoEntrar('carregar', { slot });
    if (!r?.ok) {
      avisar({ texto: fraseFalha(r), gravidade: 'atencao', glifo: 'carregar' });
      reler();
    }
  });
  const exportar = (slot) => fazer('exportar', async () => {
    const r = await exportarSave(jogo, slot, { compartilhar: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches });
    avisar({ texto: r?.ok ? t('u2.sv.exportado', { nome: r.nome }) : fraseFalha(r), gravidade: r?.ok ? 'info' : 'atencao', glifo: 'exportar' });
  });
  const apagar = (slot) => fazer('apagar', async () => {
    await jogo.apagarSave?.(slot);
    await reler();
  });
  const salvar = (slot) => fazer('salvar', async () => {
    const r = await jogo.salvar(slot);
    avisar({ texto: r?.ok ? t('u2.sv.salvoEm', { espaco: rotuloSlot(r.slot) }) : fraseFalha(r), gravidade: r?.ok ? 'info' : 'atencao', glifo: 'salvar' });
    await reler();
  });
  const importar = (ev) => {
    const f = ev.currentTarget.files?.[0];
    ev.currentTarget.value = '';
    if (!f) return;
    fazer('importar', async () => {
      const r = await aoEntrar('importar', { arquivo: f });
      if (!r?.ok) avisar({ texto: t('u2.sv.naoImportou', { motivo: fraseFalha(r) }), gravidade: 'atencao', glifo: 'carregar' });
      reler();
    });
  };
  if (lista === null) return <Vazio glifo="carregar" texto={t('tela.carregando')} />;
  const temAlgum = lista.length > 0;
  return (
    <div class="sv">
      <div class="sv-topo">
        <Botao a="sv.importar" rotulo={t('u2.sv.importar')} class="bt-sec" desligado={!!ocupado} onClick={() => arquivo.current?.click()}>
          <Glifo n="carregar" tam={18} />
          <span>{t('u2.sv.importar')}</span>
        </Botao>
        <input ref={arquivo} type="file" accept=".held,application/octet-stream" hidden onChange={importar} />
        <span class="ini-nota">{t(ocupado ? `u2.sv.ocupado.${ocupado}` : 'u2.sv.nota')}</span>
      </div>
      {!temAlgum && !noJogo ? <Vazio glifo="carregar" texto={t('u2.sv.nenhum')} /> : null}
      <Secao titulo={t('u2.sv.automaticos')}>
        <div class="sv-grade">
          {SLOTS_AUTO.filter((s) => porSlot.has(s)).map((slot) => (
            <Cartao s={porSlot.get(slot)} slot={slot} noJogo={noJogo} ocupado={ocupado} aoCarregar={carregar} aoExportar={exportar} aoApagar={apagar} />
          ))}
        </div>
        {!SLOTS_AUTO.some((s) => porSlot.has(s)) ? <p class="ini-nota">{t('u2.sv.semAutomatico')}</p> : null}
      </Secao>
      <Secao titulo={t('u2.sv.manuais')}>
        <div class="sv-grade">
          {SLOTS_MANUAIS.filter((s) => porSlot.has(s) || noJogo).map((slot) => (
            <Cartao s={porSlot.get(slot)} slot={slot} noJogo={noJogo} ocupado={ocupado} aoCarregar={carregar} aoExportar={exportar} aoApagar={apagar} aoSalvar={noJogo ? salvar : null} />
          ))}
        </div>
        {!noJogo && !SLOTS_MANUAIS.some((s) => porSlot.has(s)) ? <p class="ini-nota">{t('u2.sv.semManual')}</p> : null}
      </Secao>
      {quarentena.length ? (
        <Secao titulo={t('u2.sv.quarentena')}>
          <p class="ini-nota">{t('u2.sv.quarentenaNota')}</p>
          {quarentena.map((q) => (
            <div class="cfg-linha">
              <span class="cfg-textos">
                <span class="cfg-rot">{rotuloSlot(q.origem ?? '')}</span>
                <span class="cfg-exp">{`${haQuanto(q.quando)} · ${q.motivo || t('u2.sv.semMotivo')}`}</span>
              </span>
              <Botao a="sv.exportarQuarentena" k={q.slot} rotulo={t('u2.sv.exportar')} class="bt-sec" onClick={() => exportar(q.slot)}>
                <Glifo n="exportar" tam={18} />
                <span>{t('u2.sv.exportar')}</span>
              </Botao>
            </div>
          ))}
        </Secao>
      ) : null}
    </div>
  );
}

/** A tela 'carregar' do jogo (menu: Carregar). */
export default function TelaCarregar({ ui, fechar }) {
  const aoEntrar = async (modo, op) => {
    const r = modo === 'importar' ? await ui.jogo.importar(op.arquivo) : await ui.jogo.carregar(op.slot);
    if (r?.ok) {
      fechar();
      setTimeout(() => mostrarRetomar(ui), 400);
    }
    return r;
  };
  return (
    <Tela id="carregar" glifo="carregar" titulo={t('u2.carregar.titulo')} aoFechar={fechar}>
      <ListaSaves ui={ui} noJogo={!!ui.jogo?.temPartida?.()} aoEntrar={aoEntrar} />
    </Tela>
  );
}
