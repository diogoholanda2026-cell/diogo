// Configurações (modal largo em 4 colunas, sem rolar em 986x443), modo Apreciar (vista da foto, comparação com a
// foto, rótulos, planta, luz, passeio de câmera, fotografar e compartilhar, barra que some sozinha) e rótulos
// presos ao mundo.
import { el } from '../core/util.js';
import { img } from './icones.js';
import { ROTULOS } from '../data/rotulos.js';
import { QUALITY } from '../render/engine.js';
import { exportar, importar, apagar, persistir, gravar, gravarImportado, gravarConfig } from '../core/salvar.js';

const LUZ = { exposicao: 'Exposição', noite: 'Noite', dia: 'Dia' };
export function instalarExtras(C, o) {
  const { engine, env, rig, cfg, fotoURL, versao } = o;
  // ---------------- rótulos ----------------
  const camadaR = el('div', 'passa rotulos'); camadaR.style.cssText = 'position:absolute;inset:0;overflow:hidden'; C.ui.insertBefore(camadaR, C.ui.firstChild);
  const rot = ROTULOS.map((r) => { const d = el('div', 'rotulo3d', r.txt); camadaR.appendChild(d); return { ...r, el: d, tx: '' }; });
  const v = new (engine.camera.position.constructor)();
  C.atualizarRotulos = () => {
    const on = C.modoApreciar && cfg.rotulos !== false; if (camadaR._on !== on) { camadaR._on = on; camadaR.style.display = on ? '' : 'none'; } if (!on) return;
    for (const r of rot) { if (r.se && !C.J.feita(r.se)) { if (r.vis !== false) { r.vis = false; r.el.style.display = 'none'; } continue; } v.set(...r.pos).project(engine.camera); const vis = v.z <= 1; if (r.vis !== vis) { r.vis = vis; r.el.style.display = vis ? '' : 'none'; } if (!vis) continue; const tx = `translate(${((v.x * 0.5 + 0.5) * engine.vw).toFixed(0)}px,${((-v.y * 0.5 + 0.5) * engine.vh).toFixed(0)}px) translate(-50%,-100%)`; if (tx !== r.tx) { r.tx = tx; r.el.style.transform = tx; } }
  };
  // ---------------- apreciar ----------------
  const foto = el('div', ''); foto.id = 'foto-ref'; foto.style.backgroundImage = `url(${fotoURL})`; C.ui.appendChild(foto);
  let barra = null, tBarra = 0;
  // a barra some depois de 3,5 s sem toque e volta com um toque na maquete ou com a câmera andando
  const mostrar = () => { if (!barra) return; barra.classList.remove('oculta'); clearTimeout(tBarra); tBarra = setTimeout(() => barra?.classList.add('oculta'), 3500); };
  C.aoToqueApreciar = mostrar;
  const rigMove0 = rig.onMove; rig.onMove = (...a) => { rigMove0?.(...a); if (C.modoApreciar) mostrar(); };
  const estado = () => {
    if (!barra) return; const q = (x) => barra.querySelector(`[data-x="${x}"]`);
    const liga = (b, on) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    liga(q('rotulos'), cfg.rotulos !== false); liga(q('planta'), !!C._planta); q('luz').querySelector('span').textContent = LUZ[env.mode] || 'Luz';
  };
  C.apreciar = (on) => {
    C.modoApreciar = on; C.hud.visivel(!on); C.bolhas.visivel = !on; C.paineis.fechar(true); rig.passeio?.(on); C.som.ambiente?.(on); engine.acordar?.(on ? 1500 : 500);
    if (barra) { barra.remove(); barra = null; } clearTimeout(tBarra); foto.style.opacity = 0;
    if (!on) { rig.roll = 0; rig.pitchFix = null; if (C._planta) { C._planta = false; C.mundo.mostrarFantasma(false); } return; }
    barra = el('div', 'apreciar');
    barra.innerHTML = `<button class="botao sec" data-x="foto">${img('mapa')}<span>Vista da foto</span></button><label class="botao sec comparar">${img('foto')}<span>Comparar</span><input class="deslize" type="range" min="0" max="100" value="0" data-x="comparar" aria-label="Comparar com a foto"></label><button class="botao sec alterna" data-x="rotulos" aria-pressed="false">Rótulos</button><button class="botao sec alterna" data-x="planta" aria-pressed="false">Planta</button><button class="botao sec" data-x="luz">${img('energia')}<span>Luz</span></button><button class="botao ouro" data-x="fotografar">${img('apreciar')}<span>Fotografar</span></button><button class="botao sec" data-x="sair">Sair</button>`;
    C.ui.appendChild(barra); estado(); mostrar();
    barra.addEventListener('pointerdown', mostrar);
    barra.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (!b) return; C.som.toque(); const x = b.dataset.x;
      if (x === 'foto') C.vistaFoto(true); else if (x === 'rotulos') { cfg.rotulos = cfg.rotulos === false; gravarConfig(cfg); } else if (x === 'luz') { const m = { exposicao: 'noite', noite: 'dia', dia: 'exposicao' }[env.mode]; env.setMode(m); cfg.luz = m; gravarConfig(cfg); engine.acordar?.(800); } else if (x === 'planta') { C._planta = !C._planta; C.mundo.mostrarFantasma(C._planta); engine.acordar?.(1200); } else if (x === 'fotografar') fotografar(); else if (x === 'sair') C.apreciar(false);
      estado(); });
    barra.querySelector('[data-x="comparar"]').addEventListener('input', (e) => { const k = +e.target.value / 100; foto.style.opacity = k; if (k > 0 && !C._naFoto) C.vistaFoto(true); mostrar(); });
  };
  // fotografia do quadro: desenha agora e lê o canvas na mesma tarefa (o buffer não precisa ser preservado)
  const fotografar = () => {
    const cv = engine.renderer.domElement; try { engine.render(performance.now()); } catch (_) {}
    cv.toBlob((b) => {
      if (!b) { C.hud.brinde('Não foi possível fotografar'); return; } const nome = `arcologia-de-held-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
      const f = typeof File !== 'undefined' ? new File([b], nome, { type: 'image/jpeg' }) : null; C.som.foto?.(); C.vibra.tique();
      if (f && navigator.canShare?.({ files: [f] })) navigator.share({ files: [f], title: 'Arcologia de Held' }).catch(() => {});
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); C.hud.brinde(`Foto salva (${cv.width}×${cv.height})`, 'foto'); }
      C.ultimaFoto = { w: cv.width, h: cv.height, bytes: b.size, tipo: b.type };
    }, 'image/jpeg', 0.92);
  };
  C.fotografar = fotografar;
  // ---------------- configurações ----------------
  C.config = () => {
    const seg = (nome, ops, atual) => `<div class="seg" data-cfg="${nome}">${ops.map(([v, t]) => `<button data-v="${v}" class="${String(atual) === String(v) ? 'on' : ''}" aria-pressed="${String(atual) === String(v)}">${t}</button>`).join('')}</div>`;
    const html = `<header class="mh"><div><h3>Ateliê</h3><h1>Configurações</h1></div><div class="linha">${o.instalar ? `<button class="botao ouro" data-y="instalar">Instalar como app</button>` : ''}<small class="versao">${engine.gpu ? 'GPU: ' + engine.gpu + '<br>' : ''}versão ${versao}</small><button class="x" data-fecha aria-label="Fechar">×</button></div></header><div class="cfg">
      <label>Qualidade gráfica<small>Automática ajusta a resolução</small></label>${seg('qualidade', [['auto', 'Auto'], ...Object.values(QUALITY).map((q) => [q.id, q.label])], cfg.qualidade || 'auto')}
      <label>Quadros por segundo<small>120 exige Chrome 156+</small></label>${seg('fps', [[30, '30'], [60, '60'], [120, '120']], cfg.fps || 60)}
      <label>Ritmo da obra<small>Acelera os cronômetros</small></label>${seg('ritmo', [[1, '1×'], [2, '2×'], [4, '4×']], C.S.ritmo || 1)}
      <label>Luz da maquete</label>${seg('luz', [['exposicao', 'Exposição'], ['noite', 'Noite'], ['dia', 'Dia']], env.mode)}
      <label>Efeitos sonoros</label>${seg('efeitos', [[1, 'Sim'], [0, 'Não']], cfg.efeitos === false ? 0 : 1)}
      <label>Música ambiente</label>${seg('musica', [[1, 'Sim'], [0, 'Não']], cfg.musica === false ? 0 : 1)}
      <label>Vibração</label>${seg('vibra', [[1, 'Sim'], [0, 'Não']], cfg.vibra === false ? 0 : 1)}
      <label>Tela cheia</label><button class="botao sec" data-y="tela">${img('tela')} Alternar</button>
      <label>Salvamento<small id="persist">Verificando…</small></label><div class="linha"><button class="botao sec" data-y="exportar">Exportar</button><button class="botao sec" data-y="importar">Importar</button></div>
      <label>Recomeçar do zero<small>Apaga o progresso deste aparelho</small></label><button class="botao sec perigo" data-y="reset">Recomeçar</button>
      </div>`;
    C.modal(html, (m, fechar) => {
      persistir().then((ok) => { const s = m.querySelector('#persist'); if (s) s.textContent = ok ? 'Protegido: o Chrome não apaga o jogo' : 'Comum: instale o app para proteger'; });
      let tReset = 0;
      m.addEventListener('click', async (e) => {
        const sb = e.target.closest('.seg button'); if (sb) { const nome = sb.parentElement.dataset.cfg, val = sb.dataset.v; C.som.toque();
          if (nome === 'qualidade') { cfg.qualidade = val; engine.setQuality(val === 'auto' ? o.qualidadeAuto : val); }
          else if (nome === 'fps') { cfg.fps = +val; engine.fpsCap = +val; }
          else if (nome === 'ritmo') { C.S.ritmo = +val; C.hud.brinde('Ritmo ' + val + '× para as próximas produções e obras'); }
          else if (nome === 'luz') { env.setMode(val); cfg.luz = val; engine.acordar?.(800); }
          else if (nome === 'efeitos') { cfg.efeitos = val === '1'; C.som.setEfeitos(cfg.efeitos); }
          else if (nome === 'musica') { cfg.musica = val === '1'; C.som.setMusica(cfg.musica); }
          else if (nome === 'vibra') { cfg.vibra = val === '1'; C.vibra.on = cfg.vibra; }
          gravarConfig(cfg); for (const b of sb.parentElement.children) { b.classList.toggle('on', b === sb); b.setAttribute('aria-pressed', b === sb ? 'true' : 'false'); } return; }
        const b = e.target.closest('[data-y]'); if (!b) return; const y = b.dataset.y; C.som.toque();
        if (y === 'tela') o.telaCheia(true); else if (y === 'exportar') { await gravar(C.S); exportar(C.S); }
        else if (y === 'importar') { try { const S = await importar(); await gravarImportado(S); location.reload(); } catch (err) { C.hud.brinde('Arquivo inválido'); } } // os avisos da migração aparecem num brinde depois de recarregar
        else if (y === 'reset') { // dois toques: o primeiro arma por 3 s
          if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Toque de novo para apagar'; C.vibra.erro(); clearTimeout(tReset); tReset = setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Recomeçar'; }, 3000); return; }
          clearTimeout(tReset); C.naoSalvar = true; await apagar(); location.reload(); }
        else if (y === 'instalar') { o.instalar?.(); fechar(); }
      });
    }, { cls: 'larga config' });
  };
}
