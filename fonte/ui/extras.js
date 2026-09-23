// Configurações, modo Apreciar (vista da foto, comparação com a foto, rótulos, luz) e
// rótulos presos ao mundo.
import { el } from '../core/util.js';
import { img } from './icones.js';
import { ROTULOS } from '../data/rotulos.js';
import { QUALITY } from '../render/engine.js';
import { exportar, importar, apagar, persistir, gravar, gravarConfig } from '../core/salvar.js';

export function instalarExtras(C, o) {
  const { engine, env, rig, cfg, fotoURL, versao } = o;
  // ---------------- rótulos ----------------
  const camadaR = el('div', 'passa'); camadaR.style.cssText = 'position:absolute;inset:0;overflow:hidden'; C.ui.insertBefore(camadaR, C.ui.firstChild);
  const rot = ROTULOS.map((r) => { const d = el('div', 'rotulo3d', r.txt); camadaR.appendChild(d); return { ...r, el: d }; });
  const v = new (engine.camera.position.constructor)();
  C.atualizarRotulos = () => {
    const on = C.modoApreciar && cfg.rotulos !== false; camadaR.style.display = on ? '' : 'none'; if (!on) return;
    for (const r of rot) { if (r.se && !C.J.feita(r.se)) { r.el.style.display = 'none'; continue; } v.set(...r.pos).project(engine.camera); if (v.z > 1) { r.el.style.display = 'none'; continue; } r.el.style.display = ''; r.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * engine.vw).toFixed(0)}px,${((-v.y * 0.5 + 0.5) * engine.vh).toFixed(0)}px) translate(-50%,-100%)`; }
  };
  // ---------------- apreciar ----------------
  const foto = el('div', ''); foto.id = 'foto-ref'; foto.style.backgroundImage = `url(${fotoURL})`; C.ui.appendChild(foto);
  let barra = null;
  C.apreciar = (on) => {
    C.modoApreciar = on; C.hud.visivel(!on); C.bolhas.visivel = !on; C.paineis.fechar(true);
    if (barra) { barra.remove(); barra = null; } foto.style.opacity = 0;
    if (!on) { rig.roll = 0; rig.pitchFix = null; if (C._planta) { C._planta = false; C.mundo.mostrarFantasma(false); } return; }
    barra = el('div', 'apreciar'); barra.innerHTML = `<button class="botao sec" data-x="foto">${img('foto')}<span>Foto</span></button><label class="botao sec" style="gap:6px">${img('apreciar')}<input class="deslize" type="range" min="0" max="100" value="0" data-x="comparar" aria-label="Comparar com a foto"></label><button class="botao sec" data-x="rotulos">Rótulos</button><button class="botao sec" data-x="planta">Planta</button><button class="botao sec" data-x="luz">Luz</button><button class="botao" data-x="sair">Sair</button>`;
    C.ui.appendChild(barra);
    barra.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (!b) return; C.som.toque(); const x = b.dataset.x;
      if (x === 'foto') C.vistaFoto(true); else if (x === 'rotulos') { cfg.rotulos = cfg.rotulos === false; gravarConfig(cfg); } else if (x === 'luz') { const m = { exposicao: 'noite', noite: 'dia', dia: 'exposicao' }[env.mode]; env.setMode(m); cfg.luz = m; gravarConfig(cfg); C.hud.brinde({ exposicao: 'Luz de exposição', noite: 'Noite', dia: 'Dia' }[m]); } else if (x === 'planta') { C._planta = !C._planta; C.mundo.mostrarFantasma(C._planta); } else if (x === 'sair') C.apreciar(false); });
    barra.querySelector('[data-x="comparar"]').addEventListener('input', (e) => { const k = +e.target.value / 100; foto.style.opacity = k; if (k > 0 && !C._naFoto) C.vistaFoto(true); });
    // tocar duas vezes no vazio esconde a barra
  };
  // ---------------- configurações ----------------
  C.config = () => {
    const seg = (nome, ops, atual) => `<div class="seg" data-cfg="${nome}">${ops.map(([v, t]) => `<button data-v="${v}" class="${String(atual) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const html = () => `<h3>Ateliê</h3><h1>Configurações</h1><div class="cfg" style="margin-top:12px">
      <label>Qualidade gráfica<small>Automática ajusta a resolução para manter a fluidez</small></label>${seg('qualidade', [['auto', 'Auto'], ...Object.values(QUALITY).map((q) => [q.id, q.label])], cfg.qualidade || 'auto')}
      <label>Quadros por segundo<small>120 exige Chrome 156+ em tela cheia</small></label>${seg('fps', [[30, '30'], [60, '60'], [120, '120']], cfg.fps || 60)}
      <label>Ritmo da obra<small>Acelera todos os cronômetros</small></label>${seg('ritmo', [[1, '1×'], [2, '2×'], [4, '4×']], C.S.ritmo || 1)}
      <label>Luz da maquete</label>${seg('luz', [['exposicao', 'Exposição'], ['noite', 'Noite'], ['dia', 'Dia']], env.mode)}
      <label>Efeitos sonoros</label>${seg('efeitos', [[1, 'Sim'], [0, 'Não']], cfg.efeitos === false ? 0 : 1)}
      <label>Música ambiente</label>${seg('musica', [[1, 'Sim'], [0, 'Não']], cfg.musica === false ? 0 : 1)}
      <label>Vibração</label>${seg('vibra', [[1, 'Sim'], [0, 'Não']], cfg.vibra === false ? 0 : 1)}
      <label>Tela cheia</label><button class="botao sec" data-y="tela">${img('tela')} Alternar</button>
      <label>Salvamento<small id="persist">Armazenamento: verificando…</small></label><div class="linha"><button class="botao sec" data-y="exportar">Exportar</button><button class="botao sec" data-y="importar">Importar</button></div>
      <label>Recomeçar do zero<small>Apaga o progresso deste aparelho</small></label><button class="botao sec" data-y="reset" style="color:#ffb3a8">Recomeçar</button>
      </div>${o.instalar ? `<p><button class="botao ouro" data-y="instalar">Instalar como app</button></p>` : ''}<p style="font-size:11px">${engine.gpu ? 'GPU: ' + engine.gpu + ' · ' : ''}versão ${versao}</p><button class="botao" data-fecha>Fechar</button>`;
    C.modal(html(), (m, fechar) => {
      persistir().then((ok) => { const s = m.querySelector('#persist'); if (s) s.textContent = ok ? 'Armazenamento protegido: o Chrome não apaga o jogo.' : 'Armazenamento comum (instale o app para proteger).'; });
      m.addEventListener('click', async (e) => {
        const sb = e.target.closest('.seg button'); if (sb) { const nome = sb.parentElement.dataset.cfg, val = sb.dataset.v; C.som.toque();
          if (nome === 'qualidade') { cfg.qualidade = val; engine.setQuality(val === 'auto' ? o.qualidadeAuto : val); }
          else if (nome === 'fps') { cfg.fps = +val; engine.fpsCap = +val; }
          else if (nome === 'ritmo') { C.S.ritmo = +val; C.hud.brinde('Ritmo ' + val + '× para as próximas produções e obras'); }
          else if (nome === 'luz') { env.setMode(val); cfg.luz = val; }
          else if (nome === 'efeitos') { cfg.efeitos = val === '1'; C.som.setEfeitos(cfg.efeitos); }
          else if (nome === 'musica') { cfg.musica = val === '1'; C.som.setMusica(cfg.musica); }
          else if (nome === 'vibra') { cfg.vibra = val === '1'; C.vibra.on = cfg.vibra; }
          gravarConfig(cfg); for (const b of sb.parentElement.children) b.classList.toggle('on', b === sb); return; }
        const b = e.target.closest('[data-y]'); if (!b) return; const y = b.dataset.y; C.som.toque();
        if (y === 'tela') o.telaCheia(true); else if (y === 'exportar') { await gravar(C.S); exportar(C.S); } else if (y === 'importar') { try { const S = await importar(); await gravar(S); location.reload(); } catch (err) { C.hud.brinde('Arquivo inválido'); } }
        else if (y === 'reset') { if (confirm('Apagar todo o progresso e recomeçar?')) { C.naoSalvar = true; await apagar(); location.reload(); } }
        else if (y === 'instalar') { o.instalar?.(); fechar(); }
      });
    });
  };
}
