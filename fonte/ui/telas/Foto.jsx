// Modo foto (desenho da UI 8.18; D42; dona: U2b): esconde toda a interface e deixa só um painel pequeno embaixo com a
// luz do céu por botões (a luz do jogo, manhã, tarde, fim de tarde e noite: nunca uma hora em número), o tamanho da
// imagem e "Salvar imagem", que o navegador baixa como arquivo. Sem câmera lenta e sem pausa: a câmera é a de sempre
// (arrastar, girar, aproximar) e o jogo segue. A luz fixa vale pelo render (R.tempo.forcar, nunca a hora do jogo) e a
// imagem sai do próprio canvas (R.foto), então a interface nunca entra nela. Abre pelo botão do trilho ou por F2; Esc
// sai; H esconde e mostra o painel. Tudo no pacote principal: é um painel só.
import { signal, effect } from '@preact/signals';
import { registrarItemTrilho } from '../hud/Trilho.jsx';
import { Botao } from '../comp/Botao.jsx';
import { Segmentado } from '../comp/Segmentado.jsx';
import { Glifo } from '../glifos/Glifo.jsx';
import { t } from '../textos.js';
import { usarEstilo } from '../inicio/estilo.js';

/** As luzes do céu em botões: null é a do jogo; as outras são as fases do sol (render/depuracao.js, HORA_DA_FASE). */
export const LUZES = Object.freeze([
  { v: 'jogo', rotulo: 'u2b.foto.luzJogo', glifo: 'relogio' },
  { v: 'manha', rotulo: 'fase.manha', glifo: 'solNascente' },
  { v: 'tarde', rotulo: 'fase.tarde', glifo: 'sol' },
  { v: 'fimDeTarde', rotulo: 'fase.fimDeTarde', glifo: 'solBaixo' },
  { v: 'noite', rotulo: 'fase.noite', glifo: 'lua' },
]);

/** null fora do modo foto; senão { luz, tamanho, painel, msg }. */
export const foto = signal(null);

const CSS_FOTO = `
html[data-foto] #ui .ui-raiz>*:not(.lugar-sobre),html[data-foto] #ui .lugar-sobre>*:not(.foto-painel){visibility:hidden;pointer-events:none}
.foto-painel{position:fixed;left:50%;bottom:var(--e5);transform:translateX(-50%);z-index:5;display:flex;flex-direction:column;gap:var(--e3);
  width:max-content;max-width:calc(100vw - 2*var(--e4));padding:var(--e3) var(--e4);border-radius:var(--r3);pointer-events:auto;
  background:var(--s1);box-shadow:var(--luz),var(--sombra2);color:var(--t1);font-family:var(--fonte)}
.foto-linha{display:flex;flex-wrap:wrap;align-items:center;gap:var(--e3)}
.foto-rot{font-size:var(--t12);font-weight:650;color:var(--t2);text-transform:uppercase;letter-spacing:.06em;min-width:64px}
.foto-acoes{display:flex;flex-wrap:wrap;gap:var(--e2);justify-content:flex-end;align-items:center}
.foto-acoes .bt{min-height:var(--alvo);padding:0 var(--e4)}
.foto-msg{margin:0;font-size:var(--t13);font-weight:600;color:var(--t2)}
.foto-msg[data-erro]{color:var(--er)}
`;

// -------------------------------------------------------------------------------------------------- entrar e sair

let ligada = null;

/** Entra no modo foto: a interface some, o render vai para o estado 'foto' e a seleção se limpa. */
export function entrarFoto(ui) {
  if (foto.peek()) return;
  if (ui.loja.tela.peek()) ui.fecharTela();
  ui.loja.selecao.value = null;
  ui.R?.selecionado?.(null);
  foto.value = { luz: 'jogo', tamanho: 'tela', painel: true, msg: null, erro: false, salvando: false };
  if (typeof document !== 'undefined') document.documentElement.dataset.foto = '1';
  ui.R?.estado?.('foto');
}

/** Sai do modo foto: volta a luz do jogo e o estado livre. */
export function sairFoto(ui) {
  if (!foto.peek()) return;
  ui.R?.tempo?.forcar?.(null);
  ui.R?.estado?.('livre');
  foto.value = null;
  if (typeof document !== 'undefined') delete document.documentElement.dataset.foto;
}

function mudarLuz(ui, v) {
  ui.R?.tempo?.forcar?.(v === 'jogo' ? null : { fase: v });
  foto.value = { ...foto.peek(), luz: v, msg: null };
}

/** Nome do arquivo: heldopolis-foto-AAAAMMDD-HHMMSS.jpg (a data real, para as fotos não se sobrescreverem). */
export function nomeDoArquivo(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${t('u2b.foto.arquivo')}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}

/** Tamanho em pixels da imagem pela escolha: o do canvas do jogo ou 1920 x 1080. */
export function tamanhoDaFoto(escolha, canvas = typeof document !== 'undefined' ? document.querySelector('canvas') : null) {
  if (escolha === 'hd' || !canvas?.width) return { w: 1920, h: 1080 };
  return { w: canvas.width, h: canvas.height };
}

async function salvar(ui) {
  const f = foto.peek();
  if (!f || f.salvando) return;
  foto.value = { ...f, salvando: true, msg: null, erro: false };
  let blob = null;
  try {
    blob = await ui.R?.foto?.(tamanhoDaFoto(f.tamanho));
  } catch (e) {
    console.error('modo foto', e);
  }
  if (!blob) {
    foto.value = { ...foto.peek(), salvando: false, erro: true, msg: t('u2b.foto.erro') };
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  foto.value = { ...foto.peek(), salvando: false, erro: false, msg: t('u2b.foto.salva') };
}

// -------------------------------------------------------------------------------------------------- painel

export function FotoPainel({ ui }) {
  const f = foto.value;
  if (!f || !f.painel) return null;
  return (
    <section class="foto-painel" data-hud="foto" role="dialog" aria-label={t('u2b.foto.titulo')}>
      <div class="foto-linha">
        <span class="foto-rot">{t('u2b.foto.luz')}</span>
        <Segmentado a="foto.luz" rotulo={t('u2b.foto.luz')} valor={f.luz} aoTrocar={(v) => mudarLuz(ui, v)} opcoes={LUZES.map((l) => ({ v: l.v, rotulo: t(l.rotulo), glifo: l.glifo }))} />
      </div>
      <div class="foto-linha">
        <span class="foto-rot">{t('u2b.foto.tamanho')}</span>
        <Segmentado
          a="foto.tamanho"
          rotulo={t('u2b.foto.tamanho')}
          valor={f.tamanho}
          aoTrocar={(v) => (foto.value = { ...foto.peek(), tamanho: v, msg: null })}
          opcoes={[
            { v: 'tela', rotulo: t('u2b.foto.tamanhoTela') },
            { v: 'hd', rotulo: t('u2b.foto.tamanhoHd') },
          ]}
        />
        <span class="tela-espaco" />
        <div class="foto-acoes">
          <Botao a="foto.salvar" rotulo={t('u2b.foto.salvar')} class="bt-pri" principal desligado={f.salvando} onClick={() => salvar(ui)}>
            <Glifo n="salvar" tam={18} />
            <span>{t(f.salvando ? 'u2b.foto.salvando' : 'u2b.foto.salvar')}</span>
          </Botao>
          <Botao a="foto.sair" rotulo={t('u2b.foto.sair')} class="bt-sec" onClick={() => sairFoto(ui)}>
            <Glifo n="fechar" tam={18} />
            <span>{t('u2b.foto.sair')}</span>
          </Botao>
        </div>
      </div>
      <p class="foto-msg" role="status" data-erro={f.erro ? '' : undefined}>
        {f.msg ?? t('u2b.foto.dica')}
      </p>
    </section>
  );
}

// -------------------------------------------------------------------------------------------------- registro

export function registrar(ui) {
  usarEstilo('foto', CSS_FOTO);
  registrarItemTrilho({ id: 'foto', glifo: 'foto', rotulo: 'trilho.foto', ordem: 30, aoTocar: () => (foto.peek() ? sairFoto(ui) : entrarFoto(ui)), ligado: () => !!foto.value });
  ui.registrarHud('sobre', FotoPainel, { ordem: 80, nome: 'foto' });
  ligada?.();
  // teclas: F2 entra e sai; no modo foto, Esc sai (antes de o menu abrir) e H esconde o painel
  const tecla = (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const alvo = ev.target;
    if (alvo && (/^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable)) return;
    if (ev.key === 'F2' && !ev.repeat) {
      ev.preventDefault();
      if (document.documentElement.dataset.inicio) return;
      if (foto.peek()) sairFoto(ui);
      else entrarFoto(ui);
      return;
    }
    if (!foto.peek()) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      sairFoto(ui);
    } else if ((ev.key === 'h' || ev.key === 'H') && !ev.repeat) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      foto.value = { ...foto.peek(), painel: !foto.peek().painel };
    }
  };
  if (typeof addEventListener === 'function') addEventListener('keydown', tecla, true);
  // clicar numa construção não deixa a seleção acesa na imagem
  const semSelecao = effect(() => {
    if (foto.value && ui.loja.selecao.value) {
      ui.loja.selecao.value = null;
      ui.R?.selecionado?.(null);
    }
  });
  // voltar ao menu inicial ou trocar de partida encerra o modo foto
  const soltarMenu = ui.jogo?.on?.('menuInicial', () => sairFoto(ui));
  ligada = () => {
    if (typeof removeEventListener === 'function') removeEventListener('keydown', tecla, true);
    semSelecao();
    soltarMenu?.();
  };
}
