// Corpo do momento (desenho da UI 8.15; D49), sob demanda. Primeiro o título de terço inferior sobre o mundo por 3 s
// ("MARCO 3 · VILA PRÓSPERA", "BLADE TOWER · ETAPA 2 DE 4") com a fala de uma linha; na etapa, o voo de câmera até a
// peça (R.voo, ou camera.irPara em 2,5 s). Depois, no marco, o modal compacto com os prêmios em dólar, as licenças e
// "Liberado agora" em chips; na etapa, "Continuar" no próprio título. Um toque pula o título. Sem confete. Com "reduzir
// movimento" ou prefs.cenasMarco desligado, vai direto ao modal e sem voo.
import { useState, useEffect } from 'preact/hooks';
import { prefs } from '../../loja.js';
import * as fmt from '../../formato.js';
import { t } from '../../textos.js';
import { Modal } from '../../comp/Modal.jsx';
import { Botao } from '../../comp/Botao.jsx';
import { Chip } from '../../comp/Chip.jsx';
import { Glifo } from '../../glifos/Glifo.jsx';
import { quemFala } from '../../hud/Objetivo.jsx';
import { Quem, nomeLiberado, glifoLiberado } from './comum.jsx';

export const TITULO_MS = 3000;

const semCena = () =>
  prefs.peek()?.cenasMarco === false ||
  (typeof document !== 'undefined' && document.documentElement?.dataset?.movimento === 'reduzido') ||
  (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** Título e subtítulo do terço inferior. */
export function tituloDoMomento(m) {
  if (m.tipo === 'marco') return { sobre: t('mom.marco', { n: m.n ?? 0 }), titulo: m.nome ?? m.titulo ?? '' };
  const s = m.sub;
  return { sobre: m.titulo ?? '', titulo: s && typeof s === 'object' ? t('mom.etapa', { n: s.etapa, de: s.de, nome: s.nome ?? '' }) : s ?? '' };
}

function Premios({ m }) {
  const p = m.premios ?? {};
  const lib = (m.libera ?? []).map((id) => ({ id, nome: nomeLiberado(id) })).filter((x) => x.nome);
  return (
    <>
      {p.creditos > 0 || p.licencas > 0 ? (
        <div class="mom-premios">
          {p.creditos > 0 ? (
            <span class="mom-premio num">
              <Glifo n="creditos" tam={18} class="tx-ch" />
              {t('mom.premio', { v: fmt.dinheiro(p.creditos) })}
            </span>
          ) : null}
          {p.licencas > 0 ? (
            <span class="mom-premio num">
              <Glifo n="mapa" tam={18} class="tx-ch" />
              {t(p.licencas === 1 ? 'mom.licenca' : 'mom.licencas', { n: p.licencas })}
            </span>
          ) : null}
        </div>
      ) : null}
      {lib.length ? (
        <>
          <span class="rot">{t('mom.liberado')}</span>
          <div class="trilha-libera">
            {lib.map((x) => (
              <Chip glifo={glifoLiberado(x.id)} texto={x.nome} estado="ok" />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export default function Momento({ ui, m, fechar }) {
  const direto = semCena();
  const [fase, setFase] = useState(direto && m.tipo === 'marco' ? 'modal' : 'titulo');
  // o voo da etapa, uma vez por momento (R.voo pode devolver Promise ou nada; uma falha não derruba o título)
  useEffect(() => {
    if (m.tipo !== 'etapa' || !m.alvo || direto) return;
    const R = ui.R;
    try {
      if (R?.voo) Promise.resolve(R.voo(m.alvo)).catch(() => {});
      else R?.camera?.irPara?.({ x: m.alvo.x, z: m.alvo.z, dist: m.alvo.dist ?? 600 }, 2500);
    } catch (e) {
      console.error('momento: voo', e);
    }
  }, []);
  useEffect(() => {
    if (fase !== 'titulo' || m.tipo !== 'marco') return undefined;
    const id = setTimeout(() => setFase('modal'), TITULO_MS);
    return () => clearTimeout(id);
  }, [fase]);
  const tit = tituloDoMomento(m);
  const fala = m.fala ? { quem: quemFala(m.fala.quem), id: m.fala.quem, texto: m.fala.texto } : null;
  if (fase === 'titulo') {
    return (
      <div class="mom-terco" role="status" data-momento={m.tipo} onClick={() => (m.tipo === 'marco' ? setFase('modal') : null)}>
        <div class={`mom-faixa vidro${m.tipo !== 'marco' ? ' mom-com-acao' : ''}`}>
          <span class="mom-textos">
            <span class="rot mom-sobre">{tit.sobre}</span>
            <span class="mom-titulo">{tit.titulo}</span>
            {fala ? (
              <span class="mom-fala">
                <Quem id={fala.id} />
                <span>{fala.texto}</span>
              </span>
            ) : null}
          </span>
          {m.tipo !== 'marco' ? (
            <Botao a="mom.continuar" rotulo={t('mom.continuar')} principal class="bt-pri" onClick={fechar}>
              {t('mom.continuar')}
            </Botao>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <Modal
      sobretitulo={tit.sobre}
      titulo={tit.titulo}
      a="momento"
      largura={520}
      acoes={[
        <Botao a="mom.continuar" rotulo={t('mom.continuar')} principal class="bt-pri" onClick={fechar}>
          {t('mom.continuar')}
        </Botao>,
      ]}
    >
      {fala ? (
        <p class="mom-fala">
          <Quem id={fala.id} />
          <span>{fala.texto}</span>
        </p>
      ) : null}
      <Premios m={m} />
    </Modal>
  );
}
