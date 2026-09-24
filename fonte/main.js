// Arcologia de Held — ponto de entrada: tela de carregamento, motor gráfico, mundo, save e jogo.
import * as THREE from 'three';
import { Engine, guessQuality } from './render/engine.js';
import { makeMaterials } from './render/materials.js';
import { Environment } from './render/env.js';
import { Ground } from './render/ground.js';
import { Forest } from './render/forest.js';
import { ExhibitTable } from './render/table.js';
import { CameraRig } from './render/camera.js';
import { Mundo } from './render/mundo.js';
import { Obras } from './render/obra.js';
import { MESA, VISTA_FOTO } from './data/planta.js';
import { PROJETOS } from './data/obras.js';
import { novoEstado, Jogo, prepararSave } from './sim/estado.js';
import { Controle } from './jogo.js';
import { instalarExtras } from './ui/extras.js';
import { Som } from './core/audio.js';
import { vibra } from './core/vibra.js';
import { carregar, gravar, gravarLocal, avisosSave, lerConfig, persistir } from './core/salvar.js';
import * as ICONES from './ui/icones.js';
import { el } from './core/util.js';

const VERSAO = typeof __VERSAO__ !== 'undefined' ? __VERSAO__ : 'dev';
const qs = new URLSearchParams(location.search);
const TESTE = qs.has('teste') || qs.has('tudo') || qs.has('vista');
const cfg = lerConfig();
const quadro = () => new Promise((r) => requestAnimationFrame(() => r()));
let salvarAgora = () => {}; // grava o localStorage na hora (antes de atualizar a versão ou perder o contexto)

// ---------------- tela de carregamento ----------------
const FOTO = window.__FOTO__ || 'foto.webp';
const carga = el('div', ''); carga.id = 'carga'; carga.style.backgroundImage = `url(${FOTO})`;
carga.innerHTML = `<h1>ARCOLOGIA DE HELD</h1><p>Composição total · maquete viva</p><div class="barra"><i></i></div><button class="toque">Toque para entrar</button><small>versão ${VERSAO}</small>`;
document.body.appendChild(carga);
const gire = el('div', ''); gire.id = 'gire'; gire.innerHTML = '<div>📱</div><b>Gire o celular</b><span>O ateliê é em paisagem.</span>'; document.body.appendChild(gire);
const barra = carga.querySelector('.barra i'); const passo = async (p) => { barra.style.width = p + '%'; await quadro(); };

async function iniciar() {
  await passo(5);
  const canvas = document.getElementById('c');
  const engine = new Engine(canvas, { quality: qs.get('q') || 'alta', fixedPR: +qs.get('pr') || 0, fpsCap: cfg.fps || 60 }); engine.carregando = true;
  const auto = guessQuality(engine.renderer); engine.gpu = auto.gpu;
  const qual = qs.get('q') || (cfg.qualidade && cfg.qualidade !== 'auto' ? cfg.qualidade : auto.id); if (qual !== engine.q.id) engine.setQuality(qual);
  engine.mats = makeMaterials(); await passo(15);
  let forest = null;
  // troca de perfil de qualidade: sombra e árvores (o raio da sombra é da própria luz, no env)
  const env = new Environment(engine); const aoPerfil = (q) => { env.setShadowSize(q.shadow); forest?.setShadows(q.treeShadow); };
  if (Array.isArray(engine.aoQualidade)) engine.aoQualidade.push(aoPerfil); else engine.onQuality = aoPerfil;
  env.setShadowSize(engine.q.shadow); if (cfg.luz) env.setMode(cfg.luz);
  const ground = new Ground(engine); await passo(30);
  forest = new Forest(engine); forest.setShadows(engine.q.treeShadow); await passo(45);
  const table = new ExhibitTable(engine); const rig = new CameraRig(engine, canvas, MESA);
  const mundo = new Mundo(engine, ground, forest); await passo(70);
  // compatibilidade: 'Desmontar o canteiro' ainda sem peça própria; a obra usa a área do canteiro
  if (!mundo.modelos.reflorestar) { const root = new THREE.Group(); root.name = 'reflorestar'; const e0 = new THREE.Group(); const area = new THREE.Object3D(); area.geometry = new THREE.BoxGeometry(11, 1.5, 8.5).translate(-25.5, 0.75, 14.75); e0.add(area); root.add(e0); mundo.root.add(root); mundo.modelos.reflorestar = { id: 'reflorestar', root, partes: { e0 }, esqueletos: {}, grua: {}, foco: { x: -25.5, z: 15, dist: 16 }, ancora: [-25.5, 2.2, 15] }; }
  const obras = new Obras(engine);
  // save: nunca recomeça por causa de versão; guarda uma cópia do save antes de migrar
  let S = qs.has('novo') ? null : await carregar();
  if (S) { try { localStorage.setItem('held-save-backup-v' + (S.v || 1), JSON.stringify(S)); } catch (_) {} try { S = prepararSave(S, Date.now()); } catch (e) { console.error(e); try { localStorage.setItem('held-save-corrompido-' + Date.now(), JSON.stringify(S)); } catch (_) {} S = null; } }
  if (!S) S = novoEstado(Date.now());
  const J = new Jogo(S); await passo(80);
  try { await ICONES.prepararIcones?.(); } catch (_) {}
  const som = new Som(); som.efeitos = cfg.efeitos !== false; som.musica = cfg.musica !== false; vibra.on = cfg.vibra !== false;
  const ui = document.getElementById('ui');
  const C = new Controle({ engine, rig, env, ground, forest, table, mundo, obras, J, som, vibra, ui, cfg });
  // vista da foto de referência (com a leve rolagem da foto)
  C.vistaFoto = (anim) => { const v = VISTA_FOTO; rig.pitchFix = v.pitch; const o = { x: v.x, z: v.z, dist: v.dist, yaw: v.yaw, fov: v.fov, roll: v.roll }; C._naFoto = true; if (anim) rig.flyTo(o, 1600, { cine: true }); else { rig.target.set(o.x, 0, o.z); rig.dist = o.dist; rig.yaw = o.yaw; rig.fov = o.fov; rig.roll = o.roll; rig.apply(); } };
  rig.onMove = () => { C._naFoto = false; };
  let promptInstalar = null; window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalar = e; });
  const telaCheia = async (alternar) => { try { if (alternar && document.fullscreenElement) { await document.exitFullscreen(); return; } if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape'); } catch (_) {} };
  instalarExtras(C, { engine, env, rig, cfg, fotoURL: FOTO, versao: VERSAO, qualidadeAuto: auto.id, telaCheia, get instalar() { return promptInstalar ? () => { promptInstalar.prompt(); promptInstalar = null; } : null; } });
  C.vistaFoto(false);
  // ajustes de luz pela URL (para comparar com a foto): exp, sat, con, key, hemi, envi, bloom
  for (const [k, f] of Object.entries({ exp: (v) => (engine.params.exposure = v), sat: (v) => (engine.params.saturation = v), con: (v) => (engine.params.contrast = v), key: (v) => (env.key.intensity = v), hemi: (v) => (env.hemi.intensity = v), envi: (v) => (engine.scene.environmentIntensity = v), bloom: (v) => (engine.params.bloomStrength = v), vin: (v) => (engine.params.vignette = v) })) if (qs.has(k)) f(+qs.get(k));
  const V = qs.get('vista'); if (V && V !== 'foto') { const [x, z, d, y, p, f] = V.split(',').map(Number); rig.pitchFix = null; rig.roll = 0; rig.target.set(x, 0, z); rig.dist = d; rig.yaw = y; rig.tilt = p || 0; if (f) rig.fov = f; rig.apply(); }
  if (qs.get('tudo')) { mundo.tudoPronto(); for (const g of Object.values(mundo.predios)) g.visible = false; mundo.canteiro.visible = false; forest.setReflorestamento(1); ground.flags.reflorestado = true; ground.paint(); }
  await passo(92);
  engine.prepararHAO?.();
  try { await engine.renderer.compileAsync(engine.scene, engine.camera); } catch (_) {}
  try { await obras.aquecer?.(); } catch (_) {}
  await passo(100);
  for (const m of avisosSave()) setTimeout(() => C.hud.brinde(m, null, 5000), 2500);
  // laço principal: só trabalha nos quadros que serão desenhados (numa tela de 120 Hz com limite de 60 qps,
  // simulação, multidões e interface andam 60 vezes por segundo, não 120)
  let last = performance.now(), frames = 0, ocioso = 0;
  const loop = (t) => {
    requestAnimationFrame(loop);
    if (!engine.shouldRender(t)) return;
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    const moveu = rig.update(dt);
    ocioso = moveu || rig.g ? 0 : ocioso + dt; engine.ocioso = ocioso; engine.idle = ocioso > 8 && !rig.anim;
    env.update(t, rig.target, rig.dist * 1.15); ground.update(t); forest.update(t); mundo.update(dt, t); obras.update(dt, t);
    if (!qs.get('tudo')) C.update(dt, t);
    C.atualizarRotulos?.();
    engine.render(t); frames++; if (frames === 3) window.__pronto = true;
  };
  requestAnimationFrame(loop);
  window.__held = { engine, rig, env, ground, forest, table, mundo, obras, J, C, THREE, save: { gravar, carregar, gravarLocal } }; window.__PROJ = PROJETOS;
  // entrada: o primeiro toque libera som, tela cheia, orientação e tela sempre acesa
  const entrar = async () => {
    carga.style.opacity = 0; setTimeout(() => { carga.remove(); engine.carregando = false; }, 800);
    som.iniciar(); if (!TESTE) await telaCheia(false); persistir();
    try { let wl = await navigator.wakeLock?.request('screen'); document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') wl = await navigator.wakeLock?.request('screen').catch(() => null); }); } catch (_) {}
    if (qs.get('tudo')) return;
    C.iniciar();
    if (TESTE) return;
    if (!S.dicas.voo) { // primeira vez: a planta holográfica mostra a meta, depois a câmera desce ao canteiro
      S.dicas.voo = 1; ui.classList.add('intro'); mundo.mostrarFantasma(true, 1600);
      setTimeout(() => { mundo.mostrarFantasma(false, 1400); rig.flyTo({ x: -24.5, z: 18.5, dist: 16, yaw: 0.35, tilt: 0, fov: 38, roll: 0 }, 2800, { cine: true }); }, 6000); setTimeout(() => { rig.pitchFix = null; ui.classList.remove('intro'); }, 8800);
    }
    else { rig.pitchFix = null; rig.roll = 0; rig.flyTo({ x: -24.5, z: 16.5, dist: 22, yaw: 0.35, tilt: 0, fov: 38, roll: 0 }, 1400, { cine: true }); }
  };
  const bt = carga.querySelector('.toque'); bt.classList.add('vis'); bt.addEventListener('click', entrar, { once: true });
  if (TESTE) entrar();
  // salvar ao sair, esconder ou congelar (o Android congela abas em segundo plano)
  const salvar = () => { if (!C.naoSalvar) gravar(J.S); };
  salvarAgora = () => { if (!C.naoSalvar) gravarLocal(J.S); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salvar(); else { J.tick(Date.now()); C.sincronizar?.(); } });
  window.addEventListener('pagehide', salvar); document.addEventListener('freeze', salvar);
  engine.onLost = () => { salvarAgora(); salvar(); };
}
iniciar().catch((e) => { console.error(e); carga.querySelector('p').textContent = 'Erro ao iniciar: ' + e.message; });

// service worker (jogar offline e atualizar sozinho)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { const b = el('button', 'botao ouro', 'Nova versão: toque para atualizar'); b.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:40'; b.onclick = () => { salvarAgora(); w.postMessage('atualizar'); }; document.body.appendChild(b); } }); });
  }).catch(() => {});
  let recarregou = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!recarregou) { recarregou = true; location.reload(); } });
}
