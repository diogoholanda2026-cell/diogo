// Controle do jogo: liga a simulação ao mundo 3D e à interface (balões, painéis, HUD,
// canteiros animados, toques no mundo, câmera, falas, capítulos, som e salvamento automático).
import * as THREE from 'three';
import { el, fmt, lerp, clamp } from './core/util.js';
import { img } from './ui/icones.js';
import { Hud } from './ui/hud.js';
import { Paineis } from './ui/paineis.js';
import { Bolhas } from './ui/bolhas.js';
import { ITENS, PREDIOS, USINAS, OFICINAS } from './data/itens.js';
import { PROJETOS, PROJ, MODULOS, alvoEtapa } from './data/obras.js';
import { CAPITULOS, DICAS, ABERTURA, CONSELHO } from './data/historia.js';
import { LOTES } from './render/models/canteiro.js';
import { A } from './data/planta.js';
import { M } from './render/materials.js';
import { gravar } from './core/salvar.js';
import { descartar } from './render/descartar.js';
import { REGRAS } from './sim/estado.js';

const FAIXA_PROJ = { sede: 'sede', humanidades: 'humanidades', onda: 'onda', uniElo: 'uniElo' };

export class Controle {
  constructor(o) {
    Object.assign(this, o); // engine, rig, env, ground, forest, table, mundo, obras, J, som, vibra, ui, cfg
    this.hud = new Hud(this.ui, this.J); this.paineis = new Paineis(this.ui, this); this.bolhas = new Bolhas(this.ui, this.engine.camera, this.engine);
    this.sites = new Map(); this._tBolhas = 0; this._tSim = 0; this._tSalvar = 0; this._capMin = false; this.fantasmas = [];
    this._bind();
    this.J.on((tipo, d) => this._evento(tipo, d));
  }
  get S() { return this.J.S; }
  // ------------------------------------------------------------ início
  iniciar() {
    this.J.tick(Date.now()); this.sincronizarMundo(); this.hud.atualizar(); this.hud.capitulo(this._capMin); this.calcBolhas();
    if (!this.S.dicas.abertura) { this.S.dicas.abertura = 1; ABERTURA.forEach(([q, t]) => this.hud.falar(q, t, 6500)); }
    // capítulo concluído enquanto o jogo estava fechado
    const c = this.J.capitulo(); if (c && this.S.capEscolhas[c.n] === undefined && c.metas.every((m) => this.J.metaFeita(m))) setTimeout(() => this.modalCapitulo(c), 1500);
  }
  _bind() {
    this.ui.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b || this.paineis.el?.contains(b)) return; const a = b.dataset.a;
      this.som.toque(); this.vibra.tique();
      if (a === 'obras') this.paineis.abrir('obras'); else if (a === 'producao') this.paineis.abrir('producao'); else if (a === 'almox') { this.paineis.abrir('almox'); this.irPara({ predio: 'almox' }, false); }
      else if (a === 'pedidos') { this.paineis.abrir('pedidos'); this._dica('pedidos'); } else if (a === 'apreciar') this.apreciar(true); else if (a === 'config') this.config?.();
      else if (a === 'proximo') this.proximo(); else if (a === 'capmin') { this._capMin = !this._capMin; this.hud.capitulo(this._capMin); }
      else if (a === 'creditos' || a === 'nivel') this.paineis.abrir('escritorio'); else if (a === 'vida') this.paineis.abrir('obras'); else if (a === 'mutirao') this.hud.brinde(`Mutirão: ${this.S.mutirao} ficha(s). Termina qualquer cronômetro na hora.`, 'mutirao', 3000);
      else if (a === 'pop' || a === 'bem') this.paineis.abrir('escritorio');
    });
    this.rig.onTap = (x, y) => this.toque(x, y);
  }
  // ------------------------------------------------------------ sincronia simulação → mundo 3D
  nivelFaixaProj(p) { let n = 0; for (const e of p.etapas) if (e.nivel && this.J.feita(p.id + '.' + e.id)) n = Math.max(n, e.nivel); return n; }
  sincronizarMundo() {
    const J = this.J, W = this.mundo; this.obras.rig = this.rig;
    for (const p of PROJETOS) {
      if (p.faixa) { const f = W.faixas[p.faixa]; const n = this.nivelFaixaProj(p); if (f.mods.some((m) => m.nivel !== n)) f.setTodos(n); }
      for (const e of p.etapas) { const key = p.id + '.' + e.id; const feita = J.feita(key); const emObra = this.sites.has('e:' + key); if (!(p.faixa && e.nivel) && !emObra) { const a = alvoEtapa(p, e); const pt = W.parte(a.modelo, a.parte); if (pt && !!pt.userData.feito !== feita) W.setEtapa(a.modelo, a.parte, feita); } if (e.extra) { const pt = W.parte(e.extra.modelo, e.extra.parte); if (pt && !!pt.userData.feito !== feita) W.setEtapa(e.extra.modelo, e.extra.parte, feita); } if (e.modo === 'reflorestar') this._reflorestado(feita); }
    }
    if (!this.sites.has('e:lago.e1')) this.ground.lake.position.y = J.feita('lago.e1') ? -0.1 : -0.32;
    // canteiro: desmontado na etapa 'Desmontar o canteiro' (some quando ela é aprovada) e replantado depois
    const desmontado = J.feita('reflorestar.e0') || J.feita('reflorestar.e1'); if (!this.sites.get('e:reflorestar.e0')?.concluindo) W.canteiro.visible = !desmontado;
    // chão: pasto degradado vira gramado quando a obra da área começa
    const verde = { anel: J.feita('anel.1'), uni: J.feita('uni.1'), ciencias: J.feita('ciencias.e1'), sede: J.feita('sede.e1'), biblio: J.feita('biblioteca.e1'), savana: J.feita('savana.e1'), bioma: J.feita('bioma.e1'), vila: J.feita('anfiteatro.e1'), gorilas: J.feita('gorilas.e1'), acelerador: J.feita('acelerador.e1'), santuario: J.feita('santuario.1') };
    const praca = J.feita('praca.e1'); const ck = JSON.stringify(verde) + praca;
    if (ck !== this._chaoKey) { this._chaoKey = ck; this.ground.flags.verde = verde; this.ground.flags.praca = praca; this.ground.paint(); }
    this.ground.tampa.visible = !['obra', 'pronta', 'feita'].includes(J.etapa('acelerador.e1').estado);
    for (const [f, arr] of Object.entries(this.S.modulos)) {
      const F = f === 'casas' ? W.casas : W.faixas[f]; let muda = false;
      arr.forEach((m, i) => { const mod = F.mods[i]; if (f === 'casas') { if (mod.nivel !== m.nivel) F.setNivel(i, m.nivel); return; } const lote = m.nivel === 0 && J.situacaoModulo(f, i) === 'disponivel' && !m.obra; if (mod.nivel !== m.nivel || !!mod.lote !== lote) { mod.nivel = m.nivel; mod.lote = lote; muda = true; } });
      if (muda && F.refresh) F.refresh();
    }
    for (const id of Object.keys(PREDIOS)) { const g = W.predios[id]; if (!g) continue; const ok = !!this.S.predios[id].ok; if (!g.userData.animando) { g.userData.pronto = ok; if (!ok) g.visible = false; } }
    // canteiros em andamento
    const vivos = new Set();
    for (const [key, st] of Object.entries(this.S.etapas)) if (st.estado === 'obra' || st.estado === 'pronta') { vivos.add('e:' + key); if (!this.sites.has('e:' + key)) this._siteEtapa(key); }
    for (const [f, arr] of Object.entries(this.S.modulos)) arr.forEach((m, i) => { if (m.obra) { vivos.add(`m:${f}:${i}`); if (!this.sites.has(`m:${f}:${i}`)) this._siteModulo(f, i); } });
    for (const k of [...this.sites.keys()]) if (!vivos.has(k) && !this.sites.get(k).concluindo) this._removerSite(k);
    // tudo que ficou pronto vira uma malha só por material
    const ass = JSON.stringify([Object.entries(this.S.etapas).filter(([, v]) => v.estado === 'feita').map(([k]) => k).sort(), Object.values(this.S.modulos).map((a) => a.map((m) => m.nivel).join('')), Object.entries(this.S.predios).filter(([k, v]) => v.ok && !W.predios[k]?.userData.animando).map(([k]) => k)]);
    if (ass !== this._assinatura) { this._assinatura = ass; W.refundir(); }
    this.povoar();
  }
  sincronizar() { this.sincronizarMundo(); this.calcBolhas(); this.hud.atualizar(); this.hud.capitulo(this._capMin); }
  _reflorestado(on) { if (on) this.mundo.canteiro.visible = false; this.forest.setReflorestamento(on ? 1 : 0); if (!!this.ground.flags.reflorestado !== on) { this.ground.flags.reflorestado = on; this.ground.paint(); } }
  povoar() { const W = this.mundo; if (this._povoKey === this._chavePovo()) return; this._povoKey = this._chavePovo(); W.povoar(); }
  _chavePovo() { return ['praca.e3', 'pas_bulevar.e1', 'pas_ponte.e1', 'pas_vila.e1', 'pas_trilhaBioma.e1', 'pas_elo.e1', 'pas_frente.e1', 'pas_anel.e1', 'pas_santuario.e1'].map((k) => (this.J.feita(k) ? 1 : 0)).join(''); }
  // canteiro de uma etapa
  _siteEtapa(key) {
    const [pid, eid] = key.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const W = this.mundo; const st = this.S.etapas[key];
    const site = { tipo: 'etapa', key, ini: st.ini, fim: st.fim, extras: [] };
    const ag = this.J.agora || Date.now(); const base = { itens: Object.keys(e.itens || {}), rig: this.rig, novo: ag - st.ini < 4000, p: clamp((ag - st.ini) / (st.fim - st.ini || 1), 0, 1) }; // novo: acabou de começar (monta o canteiro)
    let opts;
    if (p.faixa && e.nivel) {
      const F = W.faixas[p.faixa]; const cur = this.nivelFaixaProj(p); const G = new THREE.Group(), SK = new THREE.Group();
      F.mods.forEach((m, i) => { for (let f = cur; f < e.nivel; f++) { const a = F.andar(i, f, e.nivel); G.add(a.acabado); if (a.esqueleto) SK.add(a.esqueleto); } });
      W.root.add(G, SK); SK.visible = false; site.extras.push(G, SK); site.aoFim = () => F.setTodos(e.nivel);
      opts = { ...base, alvo: G, esqueleto: SK, grua: true, caminho: { path: F.def.path, closed: F.def.closed, o: F.prof.o1 + 0.2, o0: F.prof.o0, o1: F.prof.o1 }, operarios: 12 };
    } else {
      const a = alvoEtapa(p, e); const mod = W.modelos[a.modelo]; let alvo = W.parte(a.modelo, a.parte); const modo0 = e.modo || mod?.modos?.[a.parte] || 'subir';
      if (modo0 === 'nivel') { // desassoreamento: draga no lago, o nível sobe e a água clareia (AGUA.turvo segue o nível)
        alvo = new THREE.Group(); W.root.add(alvo); site.extras.push(alvo); const b = new THREE.Box3(); for (const [x, z] of A.lago) b.expandByPoint(new THREE.Vector3(x, -0.3, z)); b.max.y = 0.3;
        opts = { ...base, alvo, modo: 'draga', box: b, operarios: 5, nivelAgua: () => this.ground.lake.position.y, anim: (k) => { this.ground.lake.position.y = lerp(-0.32, -0.1, k); } };
        site.aoFim = () => { this.ground.lake.position.y = -0.1; };
      } else if (modo0 === 'desmontar') { // os prédios do canteiro saem da fusão e são desmontados um a um
        const pecas = []; for (const g of Object.values(W.predios)) if (g.userData.pronto || g.visible) { g.userData.animando = true; pecas.push(g); }
        W.refundir?.(); for (const g of pecas) g.visible = true; const amb = W.canteiro.children.find((c) => c.name === 'canteiroAmb'); if (amb) pecas.push(amb);
        const b = new THREE.Box3(); for (const [x, z] of A.canteiro.poly) b.expandByPoint(new THREE.Vector3(x, 0, z)); b.max.y = 1.5;
        opts = { ...base, alvo: W.canteiro, alvos: pecas, modo: 'desmontar', box: b, operarios: 8, acesso: A.vias?.[0]?.pts?.[0] || [-19.6, 16.4] };
        site.aoFim = () => { W.canteiro.visible = false; for (const g of pecas) if (g.userData) { g.userData.animando = false; if (g.parent === W.canteiro && g !== amb) g.visible = false; } };
      } else if (modo0 === 'reflorestar') { // replantio: mudas em linhas crescendo até virar a mata do canteiro
        alvo = new THREE.Group(); W.root.add(alvo); site.extras.push(alvo); const b = new THREE.Box3(); for (const [x, z] of A.canteiro.poly) b.expandByPoint(new THREE.Vector3(x, 0, z)); b.max.y = 1.2;
        opts = { ...base, alvo, modo: 'replantar', box: b, floresta: this.forest, operarios: 9 };
      } else {
        let placa = false;
        if (alvo && alvo.children.length === 0 && alvo.userData.chao) { // piso pintado no terreno: placa de terra provisória
          const poly = A.praca.poly; const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z))); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
          const terra = new THREE.Mesh(g, M.soil); terra.position.y = 0.02; terra.receiveShadow = true; alvo = new THREE.Group(); alvo.add(terra); W.root.add(alvo); site.extras.push(alvo); placa = true;
        }
        const box = alvo ? new THREE.Box3().setFromObject(alvo) : null; if (box && box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
        // passarelas e a ponte coberta avançam ao longo do trajeto; plantio e animais em caixas item a item
        const linear = a.modelo.startsWith('pas_') || a.modelo === 'ponteCoberta';
        let bichos = !!alvo?.userData.manadas; if (!bichos && modo0 === 'surgir') alvo?.traverse((o) => { if (o.isInstancedMesh) bichos = true; }); // bichos são sempre instanciados
        const modo = linear ? 'caminho' : modo0 === 'terra' ? (placa ? 'pavimento' : 'terra') : modo0 === 'crescer' ? 'plantio' : bichos ? 'caixas' : modo0 === 'surgir' ? 'plantio' : 'subir';
        opts = { ...base, alvo, esqueleto: mod?.esqueletos?.[a.parte], modo, grua: !!mod?.grua?.[a.parte], box, operarios: modo === 'caixas' ? 4 : modo === 'plantio' ? 5 : modo === 'caminho' ? 5 : 8,
          caminho: linear && mod?.caminho ? { path3: mod.caminho } : undefined, poligono: modo === 'pavimento' ? A.praca.poly : undefined, centro: modo === 'pavimento' ? A.pracaCaminhos?.[0]?.[0] : undefined };
      }
    }
    opts.obstaculos = this._obstaculos(opts.box || (opts.alvo ? new THREE.Box3().setFromObject(opts.alvo) : null), opts.alvo);
    site.obra = this._iniciarObra('e:' + key, opts); this.sites.set('e:' + key, site); this.e_shadow();
    if (st.estado === 'pronta') this.obras.pronta('e:' + key);
  }
  // uma falha no desenho da obra não pode travar a sincronia do jogo: o erro sai no próximo tique (aparece nos testes)
  _iniciarObra(k, opts) { try { return this.obras.iniciar(k, opts); } catch (e) { setTimeout(() => { throw e; }); try { this.obras.remover(k); } catch (_) {} return null; } }
  // caixas das peças prontas perto da obra (a grua e o pátio ficam no lado mais livre)
  _obstaculos(box, alvo) {
    if (!box || box.isEmpty()) return []; const W = this.mundo, out = []; const c = box.getCenter(new THREE.Vector3()); this._cxObs = this._cxObs || new WeakMap();
    for (const m of Object.values(W.modelos)) for (const pt of Object.values(m.partes)) {
      if (pt === alvo || !pt.userData.feito || !pt.children.length) continue; let b = this._cxObs.get(pt); if (!b) { b = new THREE.Box3().setFromObject(pt); this._cxObs.set(pt, b); }
      if (!b.isEmpty() && b.distanceToPoint(c) < 9) out.push(b);
    }
    return out;
  }
  _siteModulo(f, i) {
    const W = this.mundo; const m = this.S.modulos[f][i]; const F = f === 'casas' ? W.casas : W.faixas[f]; const para = m.obra.para;
    const a = F.andar(i, para - 1, para); const G = a.acabado; if (f === 'casas') { G.position.copy(F.group.position); G.rotation.copy(F.group.rotation); }
    W.root.add(G); const site = { tipo: 'modulo', f, i, ini: m.obra.ini, fim: m.obra.fim, extras: [G] }; const c = a.caminho ? { ...a.caminho, o0: F.prof?.o0, o1: F.prof?.o1 } : undefined;
    if (a.esqueleto) { W.root.add(a.esqueleto); site.extras.push(a.esqueleto); }
    G.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(G);
    site.aoFim = () => { F.setNivel(i, para); if (F.mods[i]) F.mods[i].lote = false; };
    site.obra = this._iniciarObra(`m:${f}:${i}`, { alvo: G, esqueleto: a.esqueleto, box, grua: para >= 3 && f !== 'casas', caminho: c, operarios: 6, itens: Object.keys(m.pedido?.itens || {}), rig: this.rig, obstaculos: this._obstaculos(box, G), novo: (this.J.agora || Date.now()) - m.obra.ini < 4000, p: clamp(((this.J.agora || Date.now()) - m.obra.ini) / (m.obra.fim - m.obra.ini || 1), 0, 1) });
    this.sites.set(`m:${f}:${i}`, site); if (m.obra.estado === 'pronta') this.obras.pronta(`m:${f}:${i}`);
  }
  _removerSite(k) { const s = this.sites.get(k); if (!s) return; this.obras.remover(k); for (const x of s.extras) { x.parent?.remove(x); descartar(x); } this.sites.delete(k); }
  // aprovação coreografada: o = {aoImpacto, baque} (impacto em 380 ms; o callback vem em ~1200 ms)
  _concluirSite(k, cb, o = {}) {
    const s = this.sites.get(k); if (!s) { cb && cb(); return; } s.concluindo = true;
    this.obras.concluir(k, () => { for (const x of s.extras) { x.parent?.remove(x); descartar(x); } s.aoFim && s.aoFim(); this.sites.delete(k); cb && cb(); this.e_shadow(); }, { rig: this.rig, ...o });
  }
  e_shadow() { this.engine.shadowDirty = true; }
  agendar() { this._sujo = true; }
  // planta fantasma (azul) da etapa enquanto a prancha está aberta
  aoAbrir(tipo, arg) {
    this._limparFantasma(); if (tipo !== 'etapa') return; const [pid, eid] = arg.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const s = this.J.situacao(p, e);
    if (!['disponivel', 'prancha', 'bloqueada', 'futura'].includes(s)) return; let g = null;
    if (p.faixa && e.nivel) { const F = this.mundo.faixas[p.faixa]; const cur = this.nivelFaixaProj(p); g = new THREE.Group(); F.mods.forEach((m, i) => { for (let f = cur; f < e.nivel; f++) g.add(F.andar(i, f, e.nivel).acabado); }); }
    else { const a = alvoEtapa(p, e); const part = this.mundo.parte(a.modelo, a.parte); if (part && part.children.length) { g = part.clone(true); g.visible = true; part.parent.updateMatrixWorld(true); g.applyMatrix4(part.parent.matrixWorld); } }
    if (!g) return; g.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.material = M.blueprint; o.castShadow = false; o.receiveShadow = false; } }); g.renderOrder = 5; this.mundo.root.add(g); this.fantasmas.push(g);
  }
  aoFechar() { this._limparFantasma(); }
  _limparFantasma() { for (const g of this.fantasmas) g.parent?.remove(g); this.fantasmas.length = 0; }
  // ------------------------------------------------------------ eventos da simulação
  _evento(tipo, d) {
    const J = this.J;
    if (tipo === 'nivel') { this.som.nivel(); this.vibra.sucesso(); this.modalNivel(d); }
    else if (tipo === 'etapaIniciada') { this._siteEtapa(d.key); this._dica('primeiraEtapa'); }
    else if (tipo === 'etapaPronta') { this.obras.pronta('e:' + d.key); this.calcBolhas(); }
    else if (tipo === 'moduloIniciado') { this._siteModulo(d.faixa, d.i); this._dica('modulo'); }
    else if (tipo === 'moduloPronto') { this.obras.pronta(`m:${d.faixa}:${d.i}`); this.calcBolhas(); }
    else if (tipo === 'capituloCompleto') setTimeout(() => this.modalCapitulo(d.cap), 2200);
    else if (tipo === 'dica') this._dica(d.id);
    else if (tipo === 'nivel') { if (d.nivel === 3) this._dica('deposito'); if (d.nivel === 4) this._dica('pedidos'); }
    else if (tipo === 'moduloFeito' && d.nivel >= 2) { if (this.J.bem < 60 && d.nivel >= 4) this._dica('bemEstar'); }
    else if (tipo === 'coleta' && d.especial) setTimeout(() => this.hud.brinde(`Achado: ${ITENS[d.especial].nome}!`, d.especial, 2600), 500);
    if (tipo !== 'xp') { this._sujo = true; }
  }
  _dica(id) { if (this.S.dicas[id]) return; const d = DICAS[id]; if (!d) return; this.S.dicas[id] = 1; this.hud.falar(d[0], d[1], 8000); }
  // ------------------------------------------------------------ ações com efeitos
  coletarUsina(id, i, elBalao) {
    const J = this.J; const idx = i >= 0 ? [i] : J.prontosUsina(id); let n = 0; const [x, y] = this._pontoTela(elBalao, LOTES[id]);
    for (const k of idx) { const it = J.S.predios[id].slots[k]?.item; const r = J.coletarUsina(id, k); if (r === 'ok') { n++; setTimeout(() => this.hud.voar(it, x, y, 'almox', () => this.hud.atualizar()), n * 90); this.som.coleta(); } else if (r === 'almox') { this.falha('almox'); break; } }
    if (n) { this.vibra.tique(); this._dica('primeiraColeta'); } this.calcBolhas(); this.paineis.render();
  }
  coletarOficina(id, elBalao) {
    const J = this.J; const itens = J.S.predios[id].prontos.slice(); const r = J.coletarOficina(id); const [x, y] = this._pontoTela(elBalao, LOTES[id]);
    if (r === 'ok') { const n = itens.length - J.S.predios[id].prontos.length; for (let k = 0; k < n; k++) setTimeout(() => { this.hud.voar(itens[k], x, y, 'almox', () => this.hud.atualizar()); this.som.coleta(); }, k * 110); this.vibra.tique(); }
    else if (r === 'almox') this.falha('almox'); this.calcBolhas(); this.paineis.render();
  }
  coletarRepasse(elBalao) { const v = Math.floor(this.S.repasse.acum); if (this.J.coletarRepasse() !== 'ok') return; const pos = this._posRepasse(); const [x, y] = this._pontoTela(elBalao, { x: pos[0], z: pos[2] }); for (let k = 0; k < 5; k++) setTimeout(() => this.hud.voar('creditos', x, y, 'creditos', () => this.hud.atualizar()), k * 70); this.som.moedas(); this.vibra.tique(); this.hud.brinde(`+${fmt(v)} créditos de repasse`, 'creditos'); this.calcBolhas(); }
  _pontoTela(elB, lote) { if (elB?.getBoundingClientRect) { const r = elB.getBoundingClientRect(); if (r.width) return [r.left + r.width / 2, r.top + r.height / 2]; } if (lote) return this.bolhas.tela([lote.x, 1.2, lote.z]); return [innerWidth / 2, innerHeight / 2]; }
  aprovarEtapa(key) {
    const J = this.J; if (J.etapa(key).estado !== 'pronta' || this.sites.get('e:' + key)?.concluindo) return; this.paineis.fechar(true);
    const [pid, eid] = key.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const a = alvoEtapa(p, e);
    this._carimbo(); this.som.aprovado(); this.vibra.sucesso();
    this._concluirSite('e:' + key, () => { J.aprovarEtapa(key); if (!(p.faixa && e.nivel)) this.mundo.setEtapa(a.modelo, a.parte, true); if (e.extra) this.mundo.setEtapa(e.extra.modelo, e.extra.parte, true); if (e.modo === 'reflorestar') { this._reflorestado(true); this.finalComposicao(); } this.sincronizar(); this._celebrar(p, e); });
  }
  aprovarModulo(f, i) {
    const J = this.J; if (J.S.modulos[f][i].obra?.estado !== 'pronta' || this.sites.get(`m:${f}:${i}`)?.concluindo) return; this.paineis.fechar(true); this.som.aprovado(); this.vibra.sucesso();
    this._concluirSite(`m:${f}:${i}`, () => { J.aprovarModulo(f, i); this.sincronizar(); const m = J.S.modulos[f][i]; this.hud.brinde(`${MODULOS[f].nome}: módulo ${i + 1} no nível ${m.nivel}`, 'subir'); });
  }
  _celebrar(p, e) {
    this.hud.brinde(`${p.nome}: ${e.nome}`, 'ok', 3000);
    if (e.servico) { const s = Object.entries(e.servico).map(([k, v]) => `+${fmt(v)} ${k === 'agua' ? 'de água' : k === 'energia' ? 'de energia' : 'de saneamento'}`).join(', '); setTimeout(() => this.hud.brinde(s, Object.keys(e.servico)[0], 2800), 1600); }
    const falas = { 'lago.e1': ['nara', 'A água voltou a correr para o lago. Agora dá para abastecer os primeiros moradores.'], 'sede.e2': ['iris', 'A Sede já recebe os repasses da Holding. Toque nas moedas para coletar.'], 'biblioteca.e5': ['iris', 'O dossel está no lugar. É a imagem que a maquete do Conselho mostra.'], 'bioma.e4': ['nara', 'A baleia nadou a primeira volta no aquário. Quase choramos aqui.'], 'gorilas.e4': ['nara', 'A família de gorilas chegou. Olha o tamanho deles!'], 'acelerador.e3': ['caio', 'Detectores ligados. Primeiro feixe hoje à noite!'] };
    const f = falas[p.id + '.' + e.id]; if (f) this.hud.falar(f[0], f[1]);
  }
  // prédio novo do canteiro: sobe por um plano de corte em 3 lances (sem esticar)
  predioConstruido(id) { const g = this.mundo.predios[id]; g.userData.animando = true; g.userData.pronto = false; g.visible = true; g.scale.set(1, 1, 1); const fim = () => { g.userData.animando = false; this.sincronizarMundo(); }; if (this.obras.erguer) this.obras.erguer(g, { ms: 1400, aoFim: fim }); else fim(); this.e_shadow(); this.hud.brinde(PREDIOS[id].nome + ' pronto!', 'producao'); this.calcBolhas(); setTimeout(() => this.paineis.abrir(PREDIOS[id].tipo === 'usina' ? 'usina' : 'oficina', id), 700); }
  falha(r, fx) {
    this.som.erro(); this.vibra.erro();
    const msg = { creditos: 'Créditos insuficientes', falta: 'Faltam materiais no almoxarifado', cheio: 'Todos os espaços estão ocupados', almox: 'Almoxarifado cheio', nivel: 'Nível insuficiente', bloqueado: 'Ainda não liberado', bloqueada: 'Etapa ainda não liberada', servico: 'Faltam serviços (água, energia ou saneamento)', bem: 'Bem-estar abaixo de 60%', sem: 'Sem fichas de Mutirão', max: 'Já está no máximo', nada: 'Nada para fazer aqui' }[r] || 'Não foi possível';
    this.hud.brinde(msg, r === 'creditos' ? 'creditos' : r === 'almox' ? 'almox' : null);
  }
  // leva até quem produz um item (usina ou oficina) e abre o painel
  irProdutor(k) {
    const I = ITENS[k]; if (!I) return; if (I.tipo === 'especial') { this.hud.brinde(I.grupo === 'licenca' ? 'Licenças caem ao coletar produção e ao subir de nível' : 'Itens de ampliação caem ao coletar produção', k, 3000); this._dica(I.grupo === 'licenca' ? 'licenca' : 'almoxCheio'); return; }
    const id = I.tipo === 'bruto' ? (USINAS.find((u) => this.S.predios[u].ok) || 'usina1') : I.oficina;
    if (I.nivel > this.S.nivel) { this.hud.brinde(`${I.nome} libera no nível ${I.nivel}`, k, 2600); return; }
    this.paineis.fechar(true); this.irPara({ predio: id }); this.hud.brinde(`${I.nome}: produzido aqui`, k, 2200);
  }
  // produz automaticamente a cadeia de um item (sub-itens nas oficinas e matéria-prima nas usinas)
  produzirCadeia(k) {
    const J = this.J; const falta = {}; const conta = (it, n) => { const I = ITENS[it]; const tem = J.S.itens[it] || 0; const f = Math.max(0, n - tem); if (!f) return; if (I.tipo === 'bruto') { falta[it] = (falta[it] || 0) + f; return; } for (const [r, q] of Object.entries(I.req)) conta(r, q * f); falta[it] = (falta[it] || 0) + f; };
    for (const [r, q] of Object.entries(ITENS[k].req)) conta(r, q);
    let feitos = 0; for (const [it, n] of Object.entries(falta)) { const I = ITENS[it]; for (let c = 0; c < n; c++) { let r = 'x'; if (I.tipo === 'bruto') { for (const u of USINAS) if (J.S.predios[u].ok && (r = J.produzir(u, it)) === 'ok') break; } else r = J.enfileirar(I.oficina, it); if (r === 'ok') feitos++; else break; } }
    this.hud.brinde(feitos ? `${feitos} pedido(s) de produção lançados na cadeia` : 'Sem espaço livre nas usinas e oficinas', feitos ? 'producao' : null, 2600); this.calcBolhas();
  }
  // ------------------------------------------------------------ balões
  _posRepasse() { if (this.J.feita('sede.e2')) { const s = A.sede; return [s.c[0], 2.6, s.c[1] + s.rz]; } const l = LOTES.escritorio; return [l.x, 1.6, l.z]; }
  ancoraEtapa(p, e) {
    const W = this.mundo; if (p.faixa) { const F = W.faixas[p.faixa]; const n = Math.max(e.nivel || 0, this.nivelFaixaProj(p)); const i = (F.mods.length / 2) | 0; const [x, z] = F.centro(Math.min(i, F.mods.length - 1)); return [x, F.alturaTopo(n) + 0.8, z]; }
    const a = alvoEtapa(p, e); const m = W.modelos[a.modelo]; return m?.ancora || [0, 2, 0];
  }
  ancoraModulo(f, i) { const W = this.mundo; const F = f === 'casas' ? W.casas : W.faixas[f]; const [x, z] = F.centro(i); const m = this.S.modulos[f][i]; return [x, F.alturaTopo(Math.max(1, m.obra ? m.obra.para : m.nivel)) + 0.5, z]; }
  calcBolhas() {
    const J = this.J, S = this.S, L = [];
    for (const id of USINAS) { const st = S.predios[id]; if (!st.ok) continue; const pr = J.prontosUsina(id); const l = LOTES[id]; if (pr.length) L.push({ id: 'u' + id, tipo: 'coleta', icone: st.slots[pr[0]].item, n: pr.length, pos: [l.x, 1.5, l.z], coletavel: true, acao: (el) => this.coletarUsina(id, -1, el) }); else if (!st.slots.some(Boolean)) L.push({ id: 'u' + id, tipo: 'placa', icone: 'producao', pos: [l.x, 1.5, l.z], acao: () => { this.paineis.abrir('usina', id); } }); }
    for (const id of OFICINAS) { const st = S.predios[id]; const l = LOTES[id]; const P = PREDIOS[id];
      if (st.ok) { if (st.prontos.length) L.push({ id: 'o' + id, tipo: 'coleta', icone: st.prontos[0], n: st.prontos.length, pos: [l.x, 1.3, l.z], coletavel: true, acao: (el) => this.coletarOficina(id, el) }); }
      else if (P.nivel <= S.nivel && (!P.requer || J.feita(P.requer)) && !this.J.feita('reflorestar.e1')) L.push({ id: 'o' + id, tipo: 'placa', icone: 'grua', pos: [l.x, 1.0, l.z], acao: () => { this.paineis.abrir('oficina', id); this.irPara({ predio: id }, false); } }); }
    for (const id of USINAS) { const P = PREDIOS[id]; if (!S.predios[id].ok && P.nivel <= S.nivel) { const l = LOTES[id]; L.push({ id: 'n' + id, tipo: 'placa', icone: 'grua', pos: [l.x, 1.0, l.z], acao: () => { this.paineis.abrir('usina', id); this.irPara({ predio: id }, false); } }); } }
    for (const p of PROJETOS) {
      if (p.cap > S.cap) continue; const nx = J.proximaEtapa(p); if (!nx) continue; const key = p.id + '.' + nx.e.id; const pos = this.ancoraEtapa(p, nx.e);
      if (nx.s === 'pronta') L.push({ id: 'e' + key, tipo: 'pronta', icone: 'ok', pos, acao: () => this.aprovarEtapa(key) });
      else if (nx.s === 'obra') { const st = J.etapa(key); L.push({ id: 'e' + key, tipo: 'obra', icone: 'grua', p: (J.agora - st.ini) / (st.fim - st.ini), pos, acao: () => { this.paineis.abrir('etapa', key); } }); }
      else if (nx.s === 'disponivel' || nx.s === 'prancha') L.push({ id: 'e' + key, tipo: 'placa', icone: 'placa', pos, acao: () => this.irPara({ etapa: key }) });
    }
    for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((m, i) => {
      const s = J.situacaoModulo(f, i); const pos = this.ancoraModulo(f, i);
      if (s === 'pronta') L.push({ id: `m${f}${i}`, tipo: 'pronta', icone: 'ok', pos, acao: () => this.aprovarModulo(f, i) });
      else if (s === 'obra') L.push({ id: `m${f}${i}`, tipo: 'obra', icone: 'grua', p: (J.agora - m.obra.ini) / (m.obra.fim - m.obra.ini), pos, acao: () => this.paineis.abrir('modulo', [f, i]) });
      else if (s === 'disponivel') { const r = J.requisitosModulo(f, i); const ok = r.servOk && r.bemOk && S.creditos >= r.custo && Object.entries(r.itens).every(([k, n]) => J.temItem(k, n)); if (ok || m.nivel === 0) L.push({ id: `m${f}${i}`, tipo: ok ? 'subir' : 'placa', icone: ok ? 'subir' : 'placa', pos, acao: () => this.irPara({ modulo: [f, i] }) }); }
    });
    const r = S.repasse; if (r.acum >= Math.max(15, J.taxaRepasse() * 4)) L.push({ id: 'repasse', tipo: 'moedas', icone: 'repasse', pos: this._posRepasse(), coletavel: true, acao: (el) => this.coletarRepasse(el) });
    this.bolhas.definir(L);
    // pontos nos botões
    let prontos = 0; for (const id of USINAS) prontos += J.prontosUsina(id).length; for (const id of OFICINAS) prontos += S.predios[id].prontos.length; this.hud.ponto('producao', prontos);
    let aprov = 0; for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (nx && nx.s === 'pronta') aprov++; } this.hud.ponto('obras', aprov);
    this.hud.ponto('pedidos', S.nivel >= 4 ? S.pedidos.filter((p) => p.itens && Object.entries(p.itens).every(([k, n]) => J.temItem(k, n))).length : 0);
    const pc = J.ocupado / J.capacidade; this.hud.ponto('almox', pc >= 0.95 ? '!' : 0);
    this._listaBolhas = L;
  }
  // ------------------------------------------------------------ câmera e seleção
  irPara(alvo, abrir = true) {
    const J = this.J; let foco = null;
    if (alvo.etapa) { const [pid, eid] = alvo.etapa.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const a = alvoEtapa(p, e); const m = this.mundo.modelos[a.modelo]; const an = this.ancoraEtapa(p, e); foco = m?.foco && !p.faixa ? m.foco : { x: an[0], z: an[2] + 1.5, dist: 16 }; if (abrir) this.paineis.abrir('etapa', alvo.etapa); }
    else if (alvo.modulo) { const [f, i] = alvo.modulo; const an = this.ancoraModulo(f, i); foco = { x: an[0], z: an[2] + 1, dist: 11 }; if (abrir) this.paineis.abrir('modulo', alvo.modulo); }
    else if (alvo.predio) { const l = LOTES[alvo.predio]; foco = { x: l.x + 0.8, z: l.z, dist: 13 }; if (abrir) this.paineis.abrir(PREDIOS[alvo.predio].tipo === 'usina' ? 'usina' : PREDIOS[alvo.predio].tipo === 'oficina' ? 'oficina' : alvo.predio === 'almox' ? 'almox' : 'escritorio', alvo.predio); }
    if (foco) { this.rig.pitchFix = null; const k = this.paineis.el ? foco.dist * 0.2 : 0; this.rig.flyTo({ x: foco.x + Math.sin(this.rig.yaw) * k, z: foco.z + Math.cos(this.rig.yaw) * k, dist: foco.dist, tilt: 0, yaw: this.rig.yaw, fov: 38 }, 900); }
  }
  toque(x, y) {
    if (this.modoApreciar) return;
    const ray = this.rig.ray(x, y); const hits = ray.intersectObjects([this.mundo.root], true);
    let p = null; for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o && o.visible) { p = { pick: o.userData.pick, point: h.point }; break; } }
    const g = p?.point || this.rig.ground(x, y); if (!g) { this.paineis.fechar(); return; }
    const alvo = p ? this._pickAlvo(p.pick, g) : this._maisProximo(g);
    if (alvo) { this.som.toque(); this.vibra.tique(); if (alvo.predio) this.irPara(alvo, true); else this.irPara(alvo, true); } else this.paineis.fechar();
  }
  _pickAlvo(pick, pt) {
    if (pick.tipo === 'predio') return { predio: pick.id };
    if (pick.tipo === 'modulos') { const F = pick.id === 'casas' ? this.mundo.casas : this.mundo.faixas[pick.id]; let best = 0, bd = 1e9; F.mods.forEach((m, i) => { const [x, z] = F.centro(i); const d = Math.hypot(x - pt.x, z - pt.z); if (d < bd) { bd = d; best = i; } }); return { modulo: [pick.id, best] }; }
    if (pick.tipo === 'proj') { const p = PROJ[pick.id]; if (!p) return null; const nx = this.J.proximaEtapa(p) || { e: p.etapas[p.etapas.length - 1] }; return { etapa: p.id + '.' + nx.e.id }; }
    return this._maisProximo(pt);
  }
  _maisProximo(g) {
    let best = null, bd = 1e9; const cand = (d, a, r) => { if (d < r && d < bd) { bd = d; best = a; } };
    for (const [id, l] of Object.entries(LOTES)) if (this.mundo.canteiro.visible) cand(Math.hypot(l.x - g.x, l.z - g.z), { predio: id }, 1.4);
    for (const p of PROJETOS) { if (p.cap > this.S.cap || p.faixa) continue; const nx = this.J.proximaEtapa(p); const e = nx ? nx.e : p.etapas[p.etapas.length - 1]; const an = this.ancoraEtapa(p, e); cand(Math.hypot(an[0] - g.x, an[2] - g.z), { etapa: p.id + '.' + e.id }, 2.6); }
    for (const [f, arr] of Object.entries(this.S.modulos)) { if (MODULOS[f].cap > this.S.cap) continue; arr.forEach((m, i) => { const [x, z] = (f === 'casas' ? this.mundo.casas : this.mundo.faixas[f]).centro(i); cand(Math.hypot(x - g.x, z - g.z), { modulo: [f, i] }, 1.8); }); }
    for (const [pid, fid] of Object.entries(FAIXA_PROJ)) { const p = PROJ[pid]; if (p.cap > this.S.cap) continue; const F = this.mundo.faixas[fid]; const nx = this.J.proximaEtapa(p); const e = nx ? nx.e : p.etapas[p.etapas.length - 1]; F.mods.forEach((m, i) => { const [x, z] = F.centro(i); cand(Math.hypot(x - g.x, z - g.z), { etapa: p.id + '.' + e.id }, 2.2); }); }
    return best;
  }
  proximo() {
    const L = this._listaBolhas || []; const ordem = ['pronta', 'coleta', 'moedas', 'subir', 'placa', 'obra'];
    for (const t of ordem) { const b = L.find((x) => x.tipo === t); if (b) { const [x, , z] = b.pos; this.rig.pitchFix = null; this.rig.flyTo({ x, z: z + 3, dist: 13, tilt: 0 }, 800); setTimeout(() => { if (b.coletavel) b.acao(null); else b.acao(null); }, 850); return; } }
    this.hud.brinde('Tudo em dia! Produza materiais para as próximas obras.', 'ok');
  }
  // ------------------------------------------------------------ modais e efeitos
  _carimbo() { const c = el('div', 'carimbo', 'APROVADO'); this.ui.appendChild(c); setTimeout(() => { c.style.transition = 'opacity .5s'; c.style.opacity = 0; }, 1300); setTimeout(() => c.remove(), 1900); }
  modal(html, aoMontar) { const v = el('div', 'veu'); v.innerHTML = `<div class="modal">${html}</div>`; this.ui.appendChild(v); this.som.abrir(); const fechar = () => { v.remove(); this.som.fechar(); }; v.addEventListener('click', (e) => { if (e.target === v) fechar(); const b = e.target.closest('[data-fecha]'); if (b) fechar(); }); aoMontar && aoMontar(v.querySelector('.modal'), fechar); return fechar; }
  modalNivel(d) {
    const novos = [...d.novos.map((k) => `<span class="etiq">${img(k)}${ITENS[k].nome}</span>`), ...d.predios.map((k) => `<span class="etiq">${img('grua')}${PREDIOS[k].nome}</span>`)].join(' ');
    this.modal(`<h3>Subiu de nível</h3><h1>Nível ${d.nivel}</h1><div class="linha" style="justify-content:center;margin:10px 0"><span class="etiq">${img('creditos')}+${fmt(d.creditos)}</span><span class="etiq">${img('mutirao')}+1 Mutirão</span><span class="etiq">${img(d.especial)}${ITENS[d.especial].nome}</span></div>${novos ? `<p>Liberado agora:</p><div class="linha" style="justify-content:center">${novos}</div>` : ''}<p></p><button class="botao ouro" data-fecha>Continuar</button>`);
    this.calcBolhas();
  }
  modalCapitulo(c) {
    if (this._modalCap) return; if (!c.escolha && c.n === 6) return; this._modalCap = true; const J = this.J;
    const falas = c.fala.map(([q, t]) => `<div class="conselho" style="text-align:left;margin:8px 0"><div class="retrato" style="background:radial-gradient(circle at 35% 30%,#fff,${CONSELHO[q].cor})">${CONSELHO[q].ini}</div><div class="fala"><b>${CONSELHO[q].nome}</b>${t}</div></div>`).join('');
    const esc = c.escolha ? `<p>O Conselho da Holding oferece um incentivo. Escolha um:</p><div class="escolhas">${c.escolha.map((o) => `<button class="escolha" data-esc="${o.id}"><b>${o.txt}</b><small>${o.dica}</small></button>`).join('')}</div>` : `<button class="botao ouro" data-esc="">Continuar</button>`;
    this.modal(`<h3>Apresentação ao Conselho</h3><h1>Capítulo ${c.n}: ${c.nome}</h1><p>Aprovado! ${fmt(2000 * c.n)} créditos e 1 ficha de Mutirão.</p>${falas}${esc}`, (m, fechar) => {
      m.addEventListener('click', (e) => { const b = e.target.closest('[data-esc]'); if (!b) return; this._modalCap = false; fechar(); J.concluirCapitulo(b.dataset.esc || null); this.som.nivel(); const n = J.capitulo(); this.hud.capitulo(this._capMin); this.sincronizar(); if (n && n.n !== c.n) { this.hud.brinde(`Capítulo ${n.n}: ${n.nome}`, 'obras', 3200); this._introCap(n); } });
    });
  }
  _introCap(c) { const t = { 2: ['iris', 'Agora o Anel pode crescer e a praça sai do papel. Veja as novas obras no botão Obras.'], 3: ['iris', 'Chegou a vez da Biblioteca Central, das faculdades e da Faculdade de Ciências.'], 4: ['caio', 'Um acelerador de partículas debaixo da praça. E a Vila Estudantil ao lado.'], 5: ['nara', 'Santuário, savana, bioma aquático e gorilas. É a parte mais delicada.'], 6: ['iris', 'Último passo: desmontar o canteiro e devolver a área à mata.'] }[c.n]; if (t) this.hud.falar(t[0], t[1], 9000); }
  finalComposicao() {
    setTimeout(() => { this.apreciar(true); this.vistaFoto?.(true); }, 1500);
    const c = this.J.capitulo(); const falas = (c?.fala || []).map(([q, t]) => `<div class="conselho" style="text-align:left;margin:8px 0"><div class="retrato" style="background:radial-gradient(circle at 35% 30%,#fff,${CONSELHO[q].cor})">${CONSELHO[q].ini}</div><div class="fala"><b>${CONSELHO[q].nome}</b>${t}</div></div>`).join('');
    setTimeout(() => this.modal(`<h3>Composição total</h3><h1>Arcologia de Held</h1><p>A maquete na mesa agora é igual à do Conselho. Cada etapa aprovada virou obra de verdade.</p>${falas}<p>Use <b>Comparar</b> no modo Apreciar para ver a foto por cima da maquete.</p><button class="botao ouro" data-fecha>Apreciar a composição</button>`, (m, fechar) => { m.querySelector('[data-fecha]').addEventListener('click', () => { if (this.J.capitulo()?.n === 6 && this.S.capEscolhas[6] === undefined) this.J.concluirCapitulo(null); }); }), 5200);
  }
  // estado de produção de cada prédio do canteiro para a obra mostrar atividade (a cada 1 s, sem alocar)
  _repasseProducao() {
    if (!this.obras.producao) return; const S = this.S, ag = this.J.agora || Date.now(); const fora = !this.mundo.canteiro.visible || this.sites.has('e:reflorestar.e0');
    for (const id of USINAS) { const st = S.predios[id]; let roda = false, pronto = false; if (st?.ok && !fora) for (const x of st.slots) { if (!x) continue; if (x.fim > ag) roda = true; else pronto = true; } this.obras.producao(id, !st?.ok || fora ? 'fora' : roda ? 'produzindo' : pronto ? 'cheio' : 'parado'); }
    for (const id of OFICINAS) { const st = S.predios[id]; if (!st?.ok || fora) { this.obras.producao(id, 'fora'); continue; } const f = st.fila[0]; const roda = !!(f && !f.pend && f.fim && f.ini <= ag && f.fim > ag); this.obras.producao(id, st.prontos.length >= REGRAS.bandeja ? 'cheio' : roda ? 'produzindo' : 'parado'); }
  }
  // ------------------------------------------------------------ quadro a quadro
  update(dt, t) {
    const J = this.J; const agora = Date.now();
    this._tSim += dt; if (this._tSim > 0.25) { this._tSim = 0; J.tick(agora); }
    // progresso das obras
    let perto = 0; const tg = this.rig.target;
    for (const [k, s] of this.sites) {
      if (s.concluindo) continue; let ini = s.ini, fim = s.fim;
      if (s.tipo === 'etapa') { const st = this.S.etapas[s.key]; if (st) { ini = st.ini; fim = st.fim; } } else { const m = this.S.modulos[s.f][s.i]; if (m.obra) { ini = m.obra.ini; fim = m.obra.fim; } }
      const p = clamp((agora - ini) / (fim - ini || 1), 0, 1); this.obras.progresso(k, p);
      const b = s.obra?.box; if (b) { const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2; perto = Math.max(perto, clamp(1 - Math.hypot(cx - tg.x, cz - tg.z) / (this.rig.dist * 0.8), 0, 1)); }
    }
    this.som.obraAtiva = perto;
    this._tProd = (this._tProd || 0) + dt; if (this._tProd > 1) { this._tProd = 0; this._repasseProducao(); }
    this._tBolhas += dt; if (this._tBolhas > 0.5 || this._sujo) { this._tBolhas = 0; this._sujo = false; this.calcBolhas(); this.hud.atualizar(); }
    this._tPainel = (this._tPainel || 0) + dt; if (this._tPainel > 1) { this._tPainel = 0; this.paineis.tick(); if (this.paineis.atual && ['usina', 'oficina', 'pedidos'].includes(this.paineis.atual.tipo)) this.paineis.render(); }
    this.bolhas.atualizar();
    this._tSalvar += dt; if (this._tSalvar > 12) { this._tSalvar = 0; if (!this.naoSalvar) gravar(this.S); }
  }
}
