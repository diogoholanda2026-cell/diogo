// Arranque do jogo novo (seção 2.8): tela de carga (o primeiro quadro já veio em HTML e CSS, A1), simulação, render,
// interface e laço, pelo controle. Parâmetros da página:
//   ?cena=<nome>     cena fixa da bancada e das provas (render/cenas/); sai sem interface (?ui=1 põe)
//   ?sintetica=1     a cidade sintética de 12 mil prédios em vez da partida
//   ?ui=vitrine      a pele da interface sobre a cena, com a simulação falsa (&cenario=inicio|meio, &tela=<id>)
//   ?ui=0            sem interface
//   ?q=ultra|alta|pc|media|leve   perfil (padrão: o sugerido pelo aparelho, D33 e D66); ?pr=1 fixa a razão de pixels
//   ?hora=17.5 &sol=anda       hora do céu fixa e, com sol=anda, andando a partir dela
//   ?semClip=1  ?depuracao=1   duas faixas de profundidade; mantém a vista de depuração da F0
//   ?semente=<texto>           semente da partida
// Para os testes: window.__held = { sim, R, ui, app }, window.__resultado (cena) e window.__pronto.
import { criarControle } from './controle.js';
import { t } from '../ui/textos.js';

const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

const carga = {
  fase(chave, pct) {
    const f = $('carga-fase');
    const b = $('carga-barra');
    if (f) f.textContent = t(chave);
    if (b && Number.isFinite(pct)) b.style.width = `${Math.max(4, Math.min(100, pct))}%`;
  },
  erro(e) {
    const c = $('carga');
    if (!c) return;
    c.classList.remove('sai');
    c.classList.add('erro');
    const f = $('carga-fase');
    if (f) f.textContent = `${t('carga.erro')} (${String(e?.message ?? e).slice(0, 160)})`;
    console.error(e);
  },
  sair() {
    const c = $('carga');
    if (!c) return;
    c.classList.add('sai');
    setTimeout(() => c.remove(), 500);
  },
};

const quadro = () => new Promise((ok) => requestAnimationFrame(() => ok()));

/**
 * Teto da espera pelo aquecimento: uma placa lenta não prende a carga (a rodada final vem a partir de 2,5 s, quando o
 * código sob demanda chegou; no PC do dono em poucos segundos, AQUECER em render/motor/quadro.js).
 */
const TETO_AQUECER_MS = 20000;

/** Espera os programas da placa compilados (R.aquecido, D66), com teto; o laço continua desenhando por trás da carga. */
function esperarAquecimento(R) {
  const p = R.aquecido?.();
  if (!p) return Promise.resolve();
  carga.fase('carga.graficos', 100);
  return Promise.race([p, new Promise((ok) => setTimeout(ok, TETO_AQUECER_MS))]);
}

async function iniciar() {
  carga.fase('carga.codigo', 8);
  try {
    const app = await criarControle({ canvas: $('mundo'), raizUI: $('ui'), qs, carga });
    window.__held = {
      get sim() {
        return app.sim;
      },
      R: app.R,
      get ui() {
        return app.ui;
      },
      app,
      montagem: window.__HELD_MONTAGEM__ ?? null,
    };
    // dois quadros desenhados antes de tirar a carga (e de a cena conferir o que desenhou)
    await quadro();
    await quadro();
    await quadro();
    if (app.cena) {
      try {
        window.__resultado = app.R.resultado();
      } catch (e) {
        window.__resultado = { ok: false, falhas: [`a cena falhou ao conferir: ${e?.message ?? e}`] };
        console.error(e);
      }
    } else {
      // no jogo a carga fica até o aquecimento: nada compila (e engasga) no primeiro minuto. As cenas fixas saem logo
      // (a bancada e a página de teste esperam o aquecimento por conta própria)
      await esperarAquecimento(app.R);
    }
    carga.sair();
    window.__pronto = true;
  } catch (e) {
    carga.erro(e);
    window.__erro = String(e?.stack ?? e);
    window.__pronto = true;
  }
}

iniciar();
