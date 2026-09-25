// Configurações (modal largo com cartões de opção em duas colunas, sem rolar em 986x443, com o ciclo de dia e
// noite), modo Apreciar (vista geral, comparação discreta com a referência, rótulos, planta, hora do dia, passeio
// de câmera, fotografar e compartilhar, barra que some sozinha), rótulos presos ao mundo e as ligações da economia
// nova que o Controle não conhece: toque no calendário (abre Finanças) e na pílula de moradores (popover da renda),
// ícone voando ao Almoxarifado na coleta automática, redesenho do painel nos eventos novos, aviso do ano novo e o
// modal da etapa aprovada com a recompensa (150% do custo) e os aceleradores ganhos.
import { el, fmt, clamp } from '../core/util.js';
import { img, icone } from './icones.js';
import { ROTULOS } from '../data/rotulos.js';
import { QUALITY } from '../render/engine.js';
import { REGRAS } from '../sim/estado.js';
import { LOTES } from '../render/models/canteiro.js';
import { rendaHoraDe } from './hud.js';
import { exportar, importar, apagar, persistir, gravar, gravarImportado, gravarConfig } from '../core/salvar.js';

const CORES_CONFETE = ['#ff5a5a', '#ffcf2e', '#5cc234', '#2c9cf2', '#ff8ad0', '#ff9f1a'];
const confete = () => Array.from({ length: 16 }, (_, i) => `<i style="--x:${((i * 37 + 5) % 97) + 1}%;--c:${CORES_CONFETE[i % 6]};--d:${(2.1 + (i % 5) * 0.34).toFixed(2)}s;--t:${((i % 8) * 0.17).toFixed(2)}s;--dx:${((i % 7) - 3) * 16}px"></i>`).join('');
const numEx = (n) => Math.round(n || 0).toLocaleString('pt-BR');

// hora do dia no Apreciar: Automático segue o ciclo das configurações; as outras fixam a hora (env.setHora pausa o
// ciclo e env.setCiclo o retoma). Sair do Apreciar volta ao automático.
const HORAS = [{ t: 'Automático', ic: 'ciclo' }, { t: 'Manhã', h: 7, ic: 'manha' }, { t: 'Meio-dia', h: 12, ic: 'sol' }, { t: 'Pôr do sol', h: 18, ic: 'por' }, { t: 'Noite', h: 22, ic: 'lua' }];
const CICLOS = [['acelerado', 'Acelerado'], ['relogio', 'Hora do celular'], ['dia', 'Sempre dia']];
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
  let barra = null, tBarra = 0, hora = 0;
  const automatico = () => { hora = 0; env.setCiclo?.(cfg.ciclo || 'acelerado'); };
  // a barra some depois de 3,5 s sem toque e volta com um toque na cidade ou com a câmera andando
  const mostrar = () => { if (!barra) return; barra.classList.remove('oculta'); clearTimeout(tBarra); tBarra = setTimeout(() => barra?.classList.add('oculta'), 3500); };
  C.aoToqueApreciar = mostrar;
  const rigMove0 = rig.onMove; rig.onMove = (...a) => { rigMove0?.(...a); if (C.modoApreciar) mostrar(); };
  const estado = () => {
    if (!barra) return; const q = (x) => barra.querySelector(`[data-x="${x}"]`);
    const liga = (b, on) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    liga(q('rotulos'), cfg.rotulos !== false); liga(q('planta'), !!C._planta);
    const H = HORAS[hora], l = q('luz'); l.querySelector('span').textContent = H.t; l.querySelector('img').src = icone(H.ic); l.setAttribute('aria-label', 'Hora do dia: ' + H.t);
  };
  C.apreciar = (on) => {
    C.modoApreciar = on; C.hud.visivel(!on); C.bolhas.visivel = !on; C.paineis.fechar(true); rig.passeio?.(on); C.som.ambiente?.(on); engine.acordar?.(on ? 1500 : 500);
    if (barra) { barra.remove(); barra = null; } clearTimeout(tBarra); foto.style.opacity = 0;
    if (!on) { rig.roll = 0; rig.pitchFix = null; if (C._planta) { C._planta = false; C.mundo.mostrarFantasma(false); } if (hora) automatico(); return; }
    barra = el('div', 'apreciar');
    barra.innerHTML = `<button class="botao sec" data-x="geral">${img('mapa')}<span>Vista geral</span></button><label class="comparar" title="Comparar com a referência">${img('foto')}<span>Comparar com a referência</span><input class="deslize" type="range" min="0" max="100" value="0" data-x="comparar" aria-label="Comparar com a referência"></label><button class="botao sec alterna" data-x="rotulos" aria-pressed="false">Rótulos</button><button class="botao sec alterna" data-x="planta" aria-pressed="false">Planta</button><button class="botao sec luz" data-x="luz">${img('ciclo')}<span>Automático</span></button><button class="botao ouro" data-x="fotografar">${img('apreciar')}<span>Fotografar</span></button><button class="botao sec" data-x="sair">Sair</button>`;
    C.ui.appendChild(barra); estado(); mostrar();
    barra.addEventListener('pointerdown', mostrar);
    barra.addEventListener('click', (e) => { const b = e.target.closest('[data-x]'); if (!b) return; C.som.toque(); const x = b.dataset.x;
      if (x === 'geral') { if (C.vistaGeral) C.vistaGeral(true); else C.vistaFoto?.(true); } else if (x === 'rotulos') { cfg.rotulos = cfg.rotulos === false; gravarConfig(cfg); }
      else if (x === 'luz') { hora = (hora + 1) % HORAS.length; const H = HORAS[hora]; if (H.h == null) automatico(); else env.setHora?.(H.h); engine.acordar?.(800); } else if (x === 'planta') { C._planta = !C._planta; C.mundo.mostrarFantasma(C._planta); engine.acordar?.(1200); } else if (x === 'fotografar') fotografar(); else if (x === 'sair') C.apreciar(false);
      estado(); });
    barra.querySelector('[data-x="comparar"]').addEventListener('input', (e) => { const k = +e.target.value / 100; foto.style.opacity = k; if (k > 0 && !C._naFoto) C.vistaFoto?.(true); mostrar(); });
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
    const op = (rotulo, controle) => `<div class="op"><label>${rotulo}</label>${controle}</div>`;
    const sec = (t) => `<h3 class="cfg-sec">${t}</h3>`;
    // seções: Vídeo, Som e toque, Jogo, Salvamento, Acessibilidade; Recomeçar isolado no fim
    const html = `<header class="mh"><div class="tt"><h1>Configurações</h1></div><div class="linha">${o.instalar ? `<button class="botao ouro" data-y="instalar">Instalar como app</button>` : ''}<small class="versao">${engine.gpu ? 'GPU: ' + engine.gpu + '<br>' : ''}versão ${versao}</small><button class="x" data-fecha aria-label="Fechar"></button></div></header><div class="mc"><div class="cfg">
      ${sec('Vídeo')}
      ${op('Qualidade gráfica<small>Automática ajusta a resolução</small>', seg('qualidade', [['auto', 'Auto'], ...Object.values(QUALITY).map((q) => [q.id, q.label])], cfg.qualidade || 'auto'))}
      ${op('Quadros por segundo<small>120 exige Chrome 156+</small>', seg('fps', [[30, '30'], [60, '60'], [120, '120']], cfg.fps || 60))}
      ${op('Tela cheia', `<button class="botao sec" data-y="tela">${img('tela')} Alternar</button>`)}
      ${sec('Som e toque')}
      ${op('Efeitos sonoros', seg('efeitos', [[1, 'Sim'], [0, 'Não']], cfg.efeitos === false ? 0 : 1))}
      ${op('Música ambiente', seg('musica', [[1, 'Sim'], [0, 'Não']], cfg.musica === false ? 0 : 1))}
      ${op('Vibração', seg('vibra', [[1, 'Sim'], [0, 'Não']], cfg.vibra === false ? 0 : 1))}
      ${sec('Jogo')}
      ${op('Ciclo de dia e noite<small>Acelerado: 1 min = 1 h</small>', seg('ciclo', CICLOS, cfg.ciclo || 'acelerado'))}
      ${op('Ritmo da obra<small>Acelera cronômetros: modo de teste</small>', seg('ritmo', [[1, '1×'], [2, '2×'], [4, '4×']], C.S.ritmo || 1))}
      ${sec('Salvamento')}
      ${op('Salvamento<small id="persist">Verificando…</small>', '<div class="linha"><button class="botao sec" data-y="exportar">Exportar</button><button class="botao sec" data-y="importar">Importar</button></div>')}
      ${sec('Acessibilidade')}
      ${op('Tamanho da interface<small>Grande aumenta textos e botões</small>', seg('escala', [['normal', 'Normal'], ['grande', 'Grande']], cfg.escala || 'normal'))}
      ${op('Reduzir movimento<small>Sem animações ociosas</small>', seg('menosMov', [[0, 'Não'], [1, 'Sim']], cfg.menosMov ? 1 : 0))}
      ${op('Alto contraste<small>Contornos e fios mais fortes</small>', seg('contraste', [[0, 'Não'], [1, 'Sim']], cfg.contraste ? 1 : 0))}
      ${sec('Recomeçar')}
      ${op('Recomeçar do zero<small>Apaga o progresso deste aparelho</small>', '<button class="botao perigo" data-y="reset">Recomeçar</button>')}
      </div></div>`;
    C.modal(html, (m, fechar) => {
      persistir().then((ok) => { const s = m.querySelector('#persist'); if (s) s.textContent = ok ? 'Protegido: o Chrome não apaga o jogo' : 'Comum: instale o app para proteger'; });
      let tReset = 0;
      m.addEventListener('click', async (e) => {
        const sb = e.target.closest('.seg button'); if (sb) { const nome = sb.parentElement.dataset.cfg, val = sb.dataset.v; C.som.toque();
          if (nome === 'qualidade') { cfg.qualidade = val; engine.setQuality(val === 'auto' ? o.qualidadeAuto : val); }
          else if (nome === 'fps') { cfg.fps = +val; engine.fpsCap = +val; }
          else if (nome === 'ritmo') { C.S.ritmo = +val; C.hud.brinde('Ritmo ' + val + '× para as próximas produções e obras'); }
          else if (nome === 'ciclo') { cfg.ciclo = val; delete cfg.luz; env.setCiclo?.(val); engine.acordar?.(800); } // (a luz antiga de exposição não vale mais)
          else if (nome === 'efeitos') { cfg.efeitos = val === '1'; C.som.setEfeitos(cfg.efeitos); }
          else if (nome === 'musica') { cfg.musica = val === '1'; C.som.setMusica(cfg.musica); }
          else if (nome === 'vibra') { cfg.vibra = val === '1'; C.vibra.on = cfg.vibra; }
          else if (nome === 'escala') { cfg.escala = val; o.aplicarAcess?.(cfg); }
          else if (nome === 'menosMov') { cfg.menosMov = val === '1'; o.aplicarAcess?.(cfg); }
          else if (nome === 'contraste') { cfg.contraste = val === '1'; o.aplicarAcess?.(cfg); }
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
  instalarEconomia(C);
}

// ---------------- economia nova: toques, eventos e o modal da etapa aprovada ----------------
function instalarEconomia(C) {
  const J = C.J; const abrirFinancas = () => { C.paineis.aba.escritorio = 'financas'; C.paineis.destaque = null; C.paineis.abrir('escritorio'); };
  // calendário: abre o Escritório na aba Finanças; pílula de moradores: popover da renda (faixa, tarifa, cofre, offline)
  C.hud.aoCalendario = () => { C.som.toque(); C.vibra.tique(); abrirFinancas(); };
  C.hud.aoPop = () => {
    C.som.toque(); const S = C.S; const ri = J.rendaInfo?.(); const rh = rendaHoraDe(J); const cofre = Math.floor(ri?.cofre ?? S.repasse.acum);
    const corpo = ri
      ? `<ul><li><b>${ri.tarifa}</b>por morador e por hora (bem-estar ${ri.faixa}%)</li><li><b>${fmt(cofre)}</b>no cofre, que guarda até ${ri.cofreH} h</li></ul><small>Faixas: até 30% de bem-estar, 5 por morador; 31 a 60%, 8; 61 a 100%, 11. Com o jogo fechado, rende ${Math.round(ri.offlineFator * 100)}% por até ${ri.offlineH} h.</small>`
      : `<ul><li><b>${fmt(cofre)}</b>no cofre, que guarda até ${REGRAS.cofreH} h</li></ul><small>A Holding repassa créditos conforme os moradores e o bem-estar.</small>`;
    C.hud.info('[data-a="pop"]', `<h4>${fmt(J.pop)} moradores · +${fmt(rh)}/h</h4>${corpo}<button class="botao sec" data-i="escritorio">${img('repasse')} Abrir o Escritório</button>`, 7000, (id) => { if (id === 'escritorio') { C.som.toque(); abrirFinancas(); } });
  };
  // eventos da simulação nova
  const REDESENHA = new Set(['valuation', 'emprestimo', 'acelerou', 'pedidoFabricando', 'dia', 'ano']); let ultimaEtapa = null;
  J.on((tipo, d) => {
    if (REDESENHA.has(tipo)) C.paineis.agendar();
    if (tipo === 'coleta' && d.auto) { // lote entrou sozinho no Almoxarifado: o ícone voa do prédio até o botão
      const l = LOTES[d.predio || d.origem]; const [x, y] = C._pontoTela(null, l); const ponto = l ? [clamp(x, 40, innerWidth - 40), clamp(y, 80, innerHeight - 40)] : [innerWidth / 2, innerHeight * 0.45];
      if (!document.hidden) C.hud.voar(d.item, ponto[0], ponto[1], 'almox', (i) => { if (i === 0) C.som.coleta?.(); }, { n: d.n || 1 }); C.calcBolhas?.();
    }
    else if (tipo === 'ano') C.hud.brinde(`Ano ${d.ano} do jogo: o limite anual de empréstimo (${numEx(REGRAS.empAno ?? 50000)}) renovou`, 'calendario', 3600);
    else if (tipo === 'dia' && d.saltou > 1) C.hud.brinde(`${d.saltou} dias do jogo passaram enquanto você esteve fora`, 'calendario', 3000);
    // etapa aprovada: a simulação emite 'etapaFeita' e logo o 'aviso' com o valor da recompensa; o modal entra na
    // fila depois da festa da aprovação (2,6 s) e não repete para a mesma etapa
    else if (tipo === 'etapaFeita') ultimaEtapa = { key: d.key, p: d.p, e: d.e, t: performance.now() };
    else if (tipo === 'aviso' && ultimaEtapa && d.creditos > 0 && performance.now() - ultimaEtapa.t < 200) { const u = ultimaEtapa; ultimaEtapa = null; C._fila(() => modalAprovacao(C, u, d.creditos), 2900, 'aprov:' + u.key); }
  });
}
function modalAprovacao(C, u, creditos) {
  const A = C.S.aceleradores; const p = u.p, e = u.e; if (!p || !e) return;
  const premios = [`<div class="premio">${img('creditos')}<b>+${fmt(creditos)}</b><small>${A ? '150% do custo' : 'medição da etapa'}</small></div>`, ...(A ? [`<div class="premio">${img('acelerar')}<b>+1</b><small>acelerador de obra</small></div>`, `<div class="premio">${img('acelerar')}<b>+1</b><small>acelerador de produção</small></div>`] : [])].join('');
  C.modal(`<header class="mh"><div class="tt"><h3>Etapa aprovada</h3><h1>${p.nome}</h1></div></header><div class="mc"><div class="festa" aria-hidden="true">${confete()}</div><p><b>${e.nome}</b> passou na medição da Holding.</p><div class="premios">${premios}</div>${A ? `<p class="lib">Aceleradores: ${A.obra || 0} de obra · ${A.producao || 0} de produção · cada um adianta ${REGRAS.aceleraH ?? 1} h</p>` : ''}<button class="botao grande" data-fecha>Continuar</button></div>`, null, { cls: 'festivo aprov' });
}
