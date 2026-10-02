// "Onde você parou" (D58): ao carregar um save (evento 'carregado' da simulação), um cartão no alto, ao centro, com o
// objetivo mais atrasado e o problema mais grave (q.retomar), cada um com o "Ir" que resolve, e Continuar. Some com
// Continuar, com qualquer "Ir" ou sozinho em 20 s. mostrarRetomar() abre por fora (U2a, depois do menu inicial).
import { signal, effect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { eventos, tela } from '../loja.js';
import { t } from '../textos.js';
import * as fmt from '../formato.js';
import { Botao } from '../comp/Botao.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { FormaGravidade } from '../comp/Aviso.jsx';
import { calendario } from '../../comum/relogio.js';
import { irParaAlvo } from './Menu.jsx';
import { textoObjetivo } from './Objetivo.jsx';
import { textoAlerta } from './FaixaAlerta.jsx';

export const RETOMAR_MS = 20000;
const aberto = signal(null); // a leitura de q.retomar() mostrada

/** Abre o cartão com a leitura de agora (sem objetivo nem problema, não abre). */
export function mostrarRetomar(ui) {
  const r = ui.consultar('retomar');
  aberto.value = r && (r.objetivo || r.problema) ? r : null;
  return !!aberto.value;
}

/** Fecha o cartão. */
export const fecharRetomar = () => (aberto.value = null);

export function Retomar({ ui }) {
  const r = aberto.value;
  useEffect(() => {
    if (!r) return undefined;
    const id = setTimeout(fecharRetomar, RETOMAR_MS);
    return () => clearTimeout(id);
  }, [r]);
  if (!r || tela.value) return null;
  const ir = (alvo) => {
    fecharRetomar();
    irParaAlvo(ui, alvo);
  };
  const desde = Number.isFinite(r.desde) && r.desde > 0 ? fmt.dataCalendario(calendario(r.desde)) : null;
  return (
    <section class="retomar vidro" data-hud="retomar" role="dialog" aria-label={t('retomar.titulo')}>
      <header class="retomar-cab">
        <span class="rot">{t('retomar.titulo')}</span>
        {desde ? <span class="retomar-desde num">{t('retomar.desde', { data: desde })}</span> : null}
      </header>
      {r.objetivo ? (
        <div class="retomar-linha">
          <Glifo n="objetivo" tam={18} class="tx-ac" />
          <span class="retomar-texto">{textoObjetivo(r.objetivo)}</span>
          {r.objetivo.alvo ? (
            <Botao a="retomar.objetivo" rotulo={t('obj.ir')} class="bt-fan" onClick={() => ir(r.objetivo.alvo)}>
              {t('obj.ir')}
            </Botao>
          ) : null}
        </div>
      ) : null}
      {r.problema ? (
        <div class="retomar-linha">
          <FormaGravidade gravidade={r.problema.gravidade ?? 'atencao'} />
          <span class="retomar-texto">{textoAlerta(r.problema)}</span>
          {r.problema.alvo ? (
            <Botao a="retomar.problema" rotulo={t('faixa.acao.ver')} class="bt-fan" onClick={() => ir(r.problema.alvo)}>
              {t('faixa.acao.ver')}
            </Botao>
          ) : null}
        </div>
      ) : null}
      <Botao a="retomar.continuar" rotulo={t('retomar.continuar')} class="bt-sec retomar-continuar" onClick={fecharRetomar}>
        {t('retomar.continuar')}
      </Botao>
    </section>
  );
}

let soltar = null;

export function registrar(ui) {
  soltar?.();
  aberto.value = null;
  const vistos = new WeakSet();
  soltar = effect(() => {
    for (const e of eventos.value) {
      if (vistos.has(e)) continue;
      vistos.add(e);
      if (e.nome === 'carregado') mostrarRetomar(ui);
    }
  });
  ui.registrarHud('centro', Retomar, { ordem: 20, nome: 'retomar' });
}
