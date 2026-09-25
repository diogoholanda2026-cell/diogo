// Controle do jogo: liga a simulação ao mundo 3D e à interface (balões, painéis, HUD, canteiros animados,
// toques no mundo, câmera, falas, tutorial, Meta em foco, capítulos, fila de modais, som e salvamento automático).
import * as THREE from 'three';
import { el, fmt, lerp, clamp } from './core/util.js';
import { img } from './ui/icones.js';
import { Hud, retrato, ABRE, depositoAberto } from './ui/hud.js';
import { Paineis } from './ui/paineis.js';
import { Bolhas } from './ui/bolhas.js';
import { ITENS, PREDIOS, USINAS, OFICINAS } from './data/itens.js';
import { PROJETOS, PROJ, MODULOS, POP_NIVEL, alvoEtapa } from './data/obras.js';
import { CAPITULOS, DICAS, ABERTURA, CONSELHO, TUTORIAL } from './data/historia.js';
import { LOTES } from './render/models/canteiro.js';
import { A } from './data/planta.js';
import { M } from './render/materials.js';
import { gravar } from './core/salvar.js';
import { descartar } from './render/descartar.js';
import { REGRAS, bemMinimo } from './sim/estado.js';

// caixas de uma malha no mundo: a base (todos os vértices até 30% da altura) e o que sobe acima disso, quando
// o que sobe ocupa menos de 60% da planta; senão a caixa inteira. Instanciada: a caixa das instâncias.
function caixasMalha(o, L) {
  if (o.isInstancedMesh) { const b = o.boundingBox || (o.computeBoundingBox(), o.boundingBox); if (b && !b.isEmpty()) L.push(b.clone().applyMatrix4(o.matrixWorld)); return; }
  const pa = o.geometry.attributes.position; if (!pa) return; const v = new THREE.Vector3(), b = new THREE.Box3();
  for (let i = 0; i < pa.count; i++) b.expandByPoint(v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld));
  if (b.isEmpty()) return; const H = b.max.y - b.min.y; if (H < 1) { L.push(b); return; }
  const y1 = b.min.y + 0.3 * H, alto = new THREE.Box3(), baixo = new THREE.Box3();
  for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); (v.y >= y1 ? alto : baixo).expandByPoint(v); }
  const area = (x) => (x.max.x - x.min.x) * (x.max.z - x.min.z);
  if (alto.isEmpty() || baixo.isEmpty() || area(alto) > 0.6 * area(b)) { L.push(b); return; }
  alto.min.y = b.min.y; L.push(alto, baixo);
}

const FAIXA_PROJ = { sede: 'sede', humanidades: 'humanidades', onda: 'onda', uniElo: 'uniElo' };
// eventos da simulação que mudam o painel aberto (o redesenho só acontece se o HTML mudar)
const EV_PAINEL = new Set(['produto', 'coleta', 'enfileirar', 'produzir', 'pedido', 'troca', 'entregar', 'etapaIniciada', 'etapaPronta', 'etapaFeita', 'moduloIniciado', 'moduloPronto', 'moduloFeito', 'topografo', 'mutirao', 'ampliar', 'almox', 'repasse', 'predio', 'novoCapitulo', 'aviso']);
// passarelas e a praça povoam as vias (a chave muda quando uma delas fica pronta)
const POVO = [...PROJETOS.filter((p) => p.id.startsWith('pas_')).flatMap((p) => p.etapas.map((e) => p.id + '.' + e.id)), 'praca.e3'];
const VERBO = { pronta: 'Aprovar', coleta: 'Coletar', moedas: 'Moedas', subir: 'Subir módulo', bloq: 'Módulo', obra: 'Obra' };
const VERBO_PLANO = { aprovar: 'Aprovar', coletar: 'Coletar', iniciar: 'Iniciar', entregar: 'Entregar', produzir: 'Produzir', construir: 'Construir', apresentar: 'Conselho', vender: 'Vender' };
const ICONE_PLANO = { aprovar: 'check', coletar: 'repasse', iniciar: 'grua', entregar: 'almox', produzir: 'producao', construir: 'grua', apresentar: 'sede', vender: 'troca', aguardar: 'obras' };
// o que o anel-guia do tutorial procura dentro do painel aberto, por passo
// (presos à obra do passo: a prancha de outra obra não recebe o anel; botão esmaecido por falta de material: o anel vai
// para a ficha vermelha do material que falta, no mesmo painel)
const TUT_PAINEL = { brita: ['[data-a=produzir][data-k=brita]'], caminho: ['.item-lista[data-alvo*="pas_frente.e1"]', '[data-a=entregarIniciar][data-key="pas_frente.e1"]', '[data-a=entregarTudo][data-key="pas_frente.e1"]'], coletar: ['[data-a=coletarU]', '[data-a=coletarO]', '[data-a=produzir][data-k=brita]'],
  aprovar: ['.item-lista[data-alvo*="pas_frente.e1"]', '[data-a=aprovar][data-key="pas_frente.e1"]'], carpintaria: ['[data-a=construir][data-p=carpintaria]', '[data-a=enfileirar][data-k=viga]'],
  lago: ['.item-lista[data-alvo*="lago.e1"]', '[data-a=entregarIniciar][data-key="lago.e1"]', '[data-a=entregarTudo][data-key="lago.e1"]', '[data-a=mutirao][data-alvo*="lago.e1"]'], anel: ['[data-a=melhorar][data-f=anel]'] };
const curto = (s, n = 14) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const centro = (e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth ? [r.left + r.width / 2, r.top + r.height / 2] : null; };

export class Controle {
  constructor(o) {
    Object.assign(this, o); // engine, rig, env, ground, forest, table, mundo, obras, J, som, vibra, ui, cfg
    this.hud = new Hud(this.ui, this.J); this.paineis = new Paineis(this.ui, this); this.bolhas = new Bolhas(this.ui, this.engine.camera, this.engine);
    this.bolhas.onBorda = (b) => this._irMundo(b.pos, b.alvo); this.bolhas.onGrupo = (b) => this._irMundo(b.pos, null, 0.6);
    this.sites = new Map(); this._tBolhas = 0; this._tSim = 0; this._tSalvar = 0; this._tFila = 0; this.fantasmas = [];
    this._modais = []; this._filaModais = []; this._festaAte = 0; this._aprovando = new Set(); this._guiaCache = { t: -1e9, pt: null };
    this.ativo = false; // só depois de iniciar() (o toque na tela de carga) o laço chama update()
    this._bind();
    this.J.on((tipo, d) => this._evento(tipo, d));
    // obra: sons ligados ao que se vê e o brinde do time-lapse (encadeados a quem já estiver ouvindo)
    if (this.obras) {
      const ev0 = this.obras.onEvento; this.obras.onEvento = (t, k, d) => { ev0?.(t, k, d); this._eventoObra(t, k, d); };
      const tl0 = this.obras.onTimelapse; this.obras.onTimelapse = (k, de, para) => { tl0?.(k, de, para); this._timelapse(k, de, para); };
    }
    // desfoque atrás da folha só no perfil ultra (custa caro no Mali)
    const q = (p) => document.body.classList.toggle('q-ultra', p?.id === 'ultra'); q(this.engine.q);
    if (Array.isArray(this.engine.aoQualidade)) this.engine.aoQualidade.push(q); else { const f = this.engine.onQuality; this.engine.onQuality = (p) => { f?.(p); q(p); }; }
  }
  get S() { return this.J.S; }
  // ------------------------------------------------------------ início
  iniciar() {
    this.ativo = true; this.J.tick(Date.now()); this.sincronizarMundo(); this.hud.atualizar(); this.hud.capitulo(); this.calcBolhas();
    const S = this.S;
    if (!S.dicas.abertura) { S.dicas.abertura = 1; const cap1 = () => this.S.cap === 1 && !this.J.feita('pas_frente.e1'); ABERTURA.forEach(([q, t]) => this.hud.falar(q, t, { se: cap1, grupo: 'abertura' })); }
    this._tutorial();
    // capítulo concluído enquanto o jogo estava fechado (o último, sem escolha, conclui sozinho: vem o fim do jogo)
    const c = this.J.capitulo(); if (this._capituloPronto(c)) { if (S.dicas.depoisCap !== c.n) this._fila(() => this.modalCapitulo(c), 1500, 'capitulo'); this.hud.conselho(true); }
    this._verCapSemEscolha(1500);
  }
  _bind() {
    this.ui.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b || this.paineis.el?.contains(b) || b.closest('.veu')) return; const a = b.dataset.a;
      this.som.toque(); if (a !== 'meta' && a !== 'agora') this.vibra.tique();
      switch (a) {
        case 'obras': case 'producao': this.paineis.abrir(a); break;
        case 'almox': this.paineis.abrir('almox'); this.irPara({ predio: 'almox' }, false); break;
        case 'pedidos': this.paineis.abrir('pedidos'); if (this.S.cap >= REGRAS.capPedidos) this._dica('pedidos'); break;
        case 'trocas': this.paineis.abrir('deposito'); this._dica('deposito'); break;
        // '+' dos créditos: o Depósito de Trocas (antes de abrir, diz quando abre)
        case 'deposito': if (depositoAberto(this.S)) { this.paineis.abrir('deposito'); this._dica('deposito'); } else this.hud.brinde(`O Depósito de Trocas abre no nível ${ABRE.depositoNivel}`, 'troca'); break;
        case 'apreciar': this.apreciar?.(true); break;
        case 'config': this.config?.(); break;
        case 'proximo': this.proximo(); break;
        case 'capmin': this.hud.alternarMetas(); break;
        case 'meta': this._irMeta(+b.dataset.i); break;
        case 'agora': this.S.dicas.metaFoco = 1; this._irPlano(this._plano); break;
        case 'conselho': this.modalCapitulo(this.J.capitulo()); break;
        case 'creditos': case 'nivel': case 'pop': this.paineis.abrir('escritorio'); break;
        case 'vida': this.paineis.abrir('obras'); break;
        case 'bem': this._infoBem(); break;
        case 'mutirao': this._infoMutirao(); break;
      }
    });
    this.rig.onTap = (x, y) => this.toque(x, y);
  }
  // folha aberta: o centro da imagem vai para a área livre e o motor limita a 60 qps
  painelMudou(on) { this.rig.deslocAlvo = on ? (this.paineis.largura + 8 - 70) / 2 : 0; if (on) { this.hud.alternarMetas(false); this.hud.fecharInfo(); } this._ocupado(); this.hud._tRects = 0; }
  _ocupado() { this.engine.ocupado = this._modais.length ? 'modal' : this.paineis.el ? 'painel' : null; }
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
    // tudo que ficou pronto vira uma malha só por material (a visibilidade do canteiro entra na conta: os prédios dele
    // saem da fusão quando ele some)
    const ass = JSON.stringify([Object.entries(this.S.etapas).filter(([, v]) => v.estado === 'feita').map(([k]) => k).sort(), Object.values(this.S.modulos).map((a) => a.map((m) => m.nivel).join('')), Object.entries(this.S.predios).filter(([k, v]) => v.ok && !W.predios[k]?.userData.animando).map(([k]) => k), !!W.canteiro.visible]);
    if (ass !== this._assinatura) { this._assinatura = ass; W.refundir(); }
    this.povoar();
  }
  sincronizar() { this.sincronizarMundo(); this.calcBolhas(); this.hud.atualizar(); this.hud.capitulo(); this.hud.revalidarFalas(); }
  _reflorestado(on) { this.mundo.canteiro.visible = !on; this.forest.setReflorestamento(on ? 1 : 0); if (!!this.ground.flags.reflorestado !== on) { this.ground.flags.reflorestado = on; this.ground.paint(); } }
  povoar() { const W = this.mundo; const k = this._chavePovo(); if (this._povoKey === k) return; this._povoKey = k; W.povoar(); }
  _chavePovo() { return POVO.map((k) => (this.J.feita(k) ? 1 : 0)).join(''); }
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
      } else if (modo0 === 'desmontar') { // os prédios do canteiro são desmontados um a um; cada um sai da fusão só na sua vez
        const pecas = []; for (const g of Object.values(W.predios)) if (g.userData.pronto || g.visible) pecas.push(g); const amb = W.canteiro.children.find((c) => c.name === 'canteiroAmb'); if (amb) pecas.push(amb);
        const soltar = (lista) => { let n = 0; for (const g of lista) if (g !== amb && g.userData && !g.userData.animando) { g.userData.animando = true; n++; } if (n) W.refundir?.(); for (const g of lista) g.visible = true; };
        const b = new THREE.Box3(); for (const [x, z] of A.canteiro.poly) b.expandByPoint(new THREE.Vector3(x, 0, z)); b.max.y = 1.5;
        opts = { ...base, alvo: W.canteiro, alvos: pecas, soltar, modo: 'desmontar', box: b, operarios: 8, acesso: A.vias?.[0]?.pts?.[0] || [-19.6, 16.4] };
        site.aoFim = () => { W.canteiro.visible = false; for (const g of pecas) if (g.userData) { g.userData.animando = false; if (g.parent === W.canteiro && g !== amb) g.visible = false; } };
        site.aoRemover = () => { let n = 0; for (const g of pecas) if (g !== amb && g.userData?.animando) { g.userData.animando = false; n++; } if (n) W.refundir?.(); }; // obra desfeita sem aprovar: as peças voltam à fusão
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
  // caixas das peças prontas perto da obra (a grua e o pátio ficam no lado mais livre). Uma por malha; malha alta
  // de base larga (a laje e o núcleo da Biblioteca fundidos numa só) vira duas: a base baixa e o que sobe dela.
  // Assim a lança só evita a torre, e não a laje em volta. Calculadas uma vez por peça.
  _obstaculos(box, alvo) {
    if (!box || box.isEmpty()) return []; const W = this.mundo, out = []; const c = box.getCenter(new THREE.Vector3()); this._cxObs = this._cxObs || new WeakMap();
    for (const m of Object.values(W.modelos)) for (const pt of Object.values(m.partes)) {
      if (pt === alvo || !pt.userData.feito || !pt.children.length) continue; let L = this._cxObs.get(pt);
      if (!L) { L = []; pt.updateWorldMatrix(true, true); pt.traverse((o) => { if (o.isMesh && o.geometry) caixasMalha(o, L); }); this._cxObs.set(pt, L); }
      for (const b of L) if (b.distanceToPoint(c) < 9) out.push(b);
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
  _removerSite(k) { const s = this.sites.get(k); if (!s) return; this.obras.remover(k); for (const x of s.extras) { x.parent?.remove(x); descartar(x); } this.sites.delete(k); s.aoRemover?.(); }
  // aprovação coreografada: o = {aoImpacto, baque} (impacto em 380 ms; o callback vem em ~1200 ms). Sem canteiro
  // (obra que não chegou a montar) a mesma linha do tempo roda com temporizadores.
  _concluirSite(k, cb, o = {}) {
    const s = this.sites.get(k); if (!s) { if (o.aoImpacto) { setTimeout(o.aoImpacto, 380); setTimeout(() => cb && cb(), 1200); } else cb && cb(); return; } s.concluindo = true;
    this.obras.concluir(k, () => { for (const x of s.extras) { x.parent?.remove(x); descartar(x); } s.aoFim && s.aoFim(); this.sites.delete(k); cb && cb(); this.e_shadow(); }, { rig: this.rig, ...o });
  }
  e_shadow() { this.engine.shadowDirty = true; }
  agendar() { this._sujo = true; }
  // planta fantasma (azul) da etapa enquanto a prancha está aberta; a das fitas (geometria própria) fica guardada
  // para a mesma prancha e é descartada quando outra toma o lugar
  aoAbrir(tipo, arg) {
    this._limparFantasma(); if (tipo !== 'etapa') return; const [pid, eid] = arg.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const s = this.J.situacao(p, e);
    if (!['disponivel', 'prancha', 'bloqueada', 'futura'].includes(s)) return;
    const faixa = p.faixa && e.nivel; const cur = faixa ? this.nivelFaixaProj(p) : 0; const chave = arg + ':' + cur; let g = null;
    if (this._prev?.chave === chave) g = this._prev.g;
    else {
      if (this._prev?.proprio) descartar(this._prev.g); this._prev = null;
      if (faixa) { const F = this.mundo.faixas[p.faixa]; g = new THREE.Group(); F.mods.forEach((m, i) => { for (let f = cur; f < e.nivel; f++) { const a = F.andar(i, f, e.nivel); g.add(a.acabado); if (a.esqueleto) descartar(a.esqueleto); } }); }
      else { const a = alvoEtapa(p, e); const part = this.mundo.parte(a.modelo, a.parte); if (part && part.children.length) { g = part.clone(true); g.visible = true; part.parent.updateMatrixWorld(true); g.applyMatrix4(part.parent.matrixWorld); } }
      if (!g) return; g.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.material = M.blueprint; o.castShadow = false; o.receiveShadow = false; } }); g.renderOrder = 5;
      this._prev = { chave, g, proprio: !!faixa };
    }
    this.mundo.root.add(g); this.fantasmas.push(g);
  }
  aoFechar() { this._limparFantasma(); }
  _limparFantasma() { for (const g of this.fantasmas) g.parent?.remove(g); this.fantasmas.length = 0; }
  // ------------------------------------------------------------ eventos da simulação
  _evento(tipo, d) {
    const J = this.J;
    switch (tipo) {
      case 'nivel': { // os créditos do nível voam do modal; se ele demorar (folha aberta), o contador sobe sozinho
        this.som.nivel(); this.vibra.sucesso(); const ret = { v: d.creditos || 0, aberto: false }; d._ret = ret; this.hud.reter('creditos', ret.v);
        setTimeout(() => { if (!ret.aberto && ret.v) { this.hud.soltar('creditos', ret.v); ret.v = 0; } }, 4000);
        this._fila(() => { ret.aberto = true; this.modalNivel(d); }, 0, 'nivel' + (d.para ?? d.nivel)); break; }
      case 'etapaIniciada': this._siteEtapa(d.key); this._dica('obraComecou'); break;
      case 'etapaPronta': this.obras.pronta('e:' + d.key); this.som.sino?.(); this.calcBolhas(); break;
      case 'moduloIniciado': this._siteModulo(d.faixa, d.i); this._dica('modulo'); break;
      case 'moduloPronto': this.obras.pronta(`m:${d.faixa}:${d.i}`); this.som.sino?.(); this.calcBolhas(); break;
      case 'capituloCompleto': if (d.cap?.escolha) { if (this.S.dicas.depoisCap !== d.cap.n) this._fila(() => this.modalCapitulo(d.cap), 2200, 'capitulo'); } else this._verCapSemEscolha(2200); break;
      case 'novoCapitulo': this._novoCapitulo(d); break;
      case 'fimDeJogo': this.finalComposicao(); break;
      case 'dica': this._dica(d.id); break;
      case 'fala': setTimeout(() => this.hud.falar(d.quem, d.texto), d.atraso || 0); break;
      case 'aviso': this._aviso(d); break;
      case 'mutirao': this._mutiraoT = performance.now(); break;
      case 'moduloFeito': { const bm = bemMinimo(d.nivel + 1); if (bm && J.bem < bm) this._dica('bemEstar'); break; } // o próximo pavimento pede bem-estar
      case 'coleta': if (d.especial) setTimeout(() => this.hud.brinde(`Achado: ${ITENS[d.especial].nome}!`, d.especial, 2600), 500); break;
    }
    if (EV_PAINEL.has(tipo)) this.paineis.agendar();
    if (tipo !== 'xp') this._sujo = true;
  }
  _dica(id, o) { if (this.S.dicas[id]) return; const d = DICAS[id]; if (!d) return; this.S.dicas[id] = 1; this.hud.falar(d[0], d[1], o); }
  // aviso da simulação: brinde; com créditos, as moedas voam até o contador (o número só sobe na chegada)
  _aviso(d) {
    this.hud.brinde(d.texto, d.icone || null, 3000); if (d.creditos > 0 && this._somaAvisos) this._somaAvisos.v += d.creditos;
    if (d.creditos > 0) { const [x, y] = this._pontoCel || [innerWidth / 2, innerHeight * 0.45]; this._moedas(d.creditos, x, y, 6); }
  }
  _moedas(v, x, y, n = 5) {
    if (!(v > 0)) return; this.hud.reter('creditos', v); const k = Math.min(8, n); const parte = Math.floor(v / k);
    this.hud.voar('creditos', x, y, 'creditos', (i, vis, ult) => { this.hud.soltar('creditos', ult ? v - parte * (vis - 1) : parte); if (i % 2 === 0) this.som.moeda?.(); }, { n: k, passo: 70 });
  }
  _estrelas(xp, x, y, n = 5) {
    if (!(xp > 0)) return; this.hud.reter('xp', xp); const parte = Math.floor(xp / n);
    this.hud.voar('xp', x, y, 'xp', (i, vis, ult) => this.hud.soltar('xp', ult ? xp - parte * (vis - 1) : parte), { n, passo: 70 });
  }
  // recompensa de um pedido (ou outra entrega): moedas, estrelas e itens voam do ponto (x, y)
  recompensa(R, x, y) { if (!R) return; this._moedas(R.creditos, x, y, 5); setTimeout(() => this._estrelas(R.xp, x, y, 3), 120); let d = 240; for (const [k, n] of Object.entries(R.itens || {})) { setTimeout(() => this.hud.voar(k, x, y, 'almox', null, { n }), d); d += 90; } this.hud.atualizar(); }
  _novoCapitulo(d) {
    const n = d.cap; this.hud.capitulo(); this.sincronizar(); if (!n) return;
    this.hud.brinde(`Capítulo ${n.n}: ${n.nome}`, 'obras', 3600); this._introCap(n);
    if (n.n >= REGRAS.capPedidos) this._dica('pedidos');
  }
  // ------------------------------------------------------------ obra: sons e time-lapse
  _pertoObra(k) {
    const s = this.sites.get(k); const b = s?.obra?.box; if (!b) return 0.5; const tg = this.rig.target;
    return clamp(1 - Math.hypot((b.min.x + b.max.x) / 2 - tg.x, (b.min.z + b.max.z) / 2 - tg.z) / (this.rig.dist * 0.9), 0, 1);
  }
  _eventoObra(tipo, k) {
    if (this.modoApreciar && tipo === 'martelo') return;
    switch (tipo) {
      case 'martelo': { const p = this._pertoObra(k); if (p > 0.05) this.som.martelo?.(p); break; }
      case 'pouso': { const p = this._pertoObra(k); if (p > 0.05) this.som.pouso?.(p); break; }
      case 'caminhao': { const p = this._pertoObra(k); if (p > 0.05) this.som.caminhao?.(p); break; }
      case 'montagem': { const p = this._pertoObra(k); if (p > 0.05) this.som.montagem?.(p); break; }
      case 'impacto': this.som.andaime?.(); break;
      case 'confete': this.som.confete?.(); break;
      case 'fogos': this.som.fogos?.(); break;
    }
  }
  _nomeSite(k) { if (k.startsWith('e:')) { const [pid, eid] = k.slice(2).split('.'); const p = PROJ[pid]; const e = p?.etapas.find((x) => x.id === eid); return p ? `${p.nome}${e ? ' (' + e.nome + ')' : ''}` : k; } const [, f, i] = k.split(':'); return `${MODULOS[f]?.nome || f}, módulo ${+i + 1}`; }
  _timelapse(k, de, para) {
    const n = Math.round((para - de) * 100); if (n < 5) return; const mut = performance.now() - (this._mutiraoT || -1e9) < 4000;
    this.hud.brinde(`${mut ? 'Mutirão' : 'Enquanto você esteve fora'}: +${n}% na obra ${this._nomeSite(k)}`, mut ? 'mutirao' : 'grua', 3600);
  }
  // ------------------------------------------------------------ ações com efeitos
  _voarItens(itens, x, y) { const cont = {}; for (const k of itens) cont[k] = (cont[k] || 0) + 1; let d = 0; for (const [k, n] of Object.entries(cont)) { setTimeout(() => this.hud.voar(k, x, y, 'almox', () => this.som.coleta(), { n }), d); d += 90; } }
  coletarUsina(id, i, elBalao) {
    const J = this.J; const idx = i >= 0 ? [i] : J.prontosUsina(id); const [x, y] = this._pontoTela(elBalao, LOTES[id]); const itens = [];
    for (const k of idx) { const it = J.S.predios[id].slots[k]?.item; const r = J.coletarUsina(id, k); if (r === 'ok') itens.push(it); else if (r === 'almox') { this.falha('almox'); break; } }
    if (itens.length) { this._voarItens(itens, x, y); this.vibra.tique(); this._dica('primeiraColeta'); } this.calcBolhas(); this.paineis.agendar();
  }
  coletarOficina(id, elBalao) {
    const J = this.J; const itens = J.S.predios[id].prontos.slice(); const r = J.coletarOficina(id); const [x, y] = this._pontoTela(elBalao, LOTES[id]);
    if (r === 'ok') { const n = itens.length - J.S.predios[id].prontos.length; this._voarItens(itens.slice(0, n), x, y); this.vibra.tique(); this._dica('primeiraColeta'); }
    else if (r === 'almox') this.falha('almox'); this.calcBolhas(); this.paineis.agendar();
  }
  coletarRepasse(elBalao) {
    const v = Math.floor(this.S.repasse.acum); if (this.J.coletarRepasse() !== 'ok') return; const pos = this._posRepasse(); const [x, y] = this._pontoTela(elBalao, { x: pos[0], z: pos[2] });
    this._moedas(v, x, y, 6); this.som.moedas(); this.vibra.tique(); this.hud.brinde(`+${fmt(v)} créditos de repasse`, 'creditos'); this.calcBolhas(); this.paineis.agendar();
  }
  _pontoTela(elB, lote) { if (elB?.getBoundingClientRect) { const r = elB.getBoundingClientRect(); if (r.width) return [r.left + r.width / 2, r.top + r.height / 2]; } if (lote) return this.bolhas.tela([lote.x, 1.2, lote.z]); return [innerWidth / 2, innerHeight / 2]; }
  // ponto da tela sobre a obra (as estrelas e moedas da aprovação saem dele)
  _pontoSite(k, reserva) { const a = this.obras.ancora?.(k) || reserva; if (!a) return [innerWidth / 2, innerHeight * 0.45]; const [x, y] = this.bolhas.tela(a); return [clamp(x, 40, innerWidth - 40), clamp(y, 80, innerHeight - 40)]; }
  // linha do tempo: balão sai (120 ms), carimbo cai (380 ms), impacto (som, vibração, anel e achatamento),
  // obra festeja; aos ~1200 ms a simulação aprova, vêm o aviso e as estrelas; modal de nível só depois de 2,6 s
  aprovarEtapa(key) {
    const J = this.J; if (J.etapa(key).estado !== 'pronta' || this.sites.get('e:' + key)?.concluindo || this._aprovando.has(key)) return; this.paineis.fechar(true); this._aprovando.add(key);
    const [pid, eid] = key.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const a = alvoEtapa(p, e); const ultima = p.etapas[p.etapas.length - 1] === e;
    this._festaAte = this.ground.adiarAte = performance.now() + 2600; this.engine.acordar?.(3200); this._pontoCel = this._pontoSite('e:' + key, this.ancoraEtapa(p, e)); // o chão repinta depois da festa
    const carimbo = this._carimbo(); const box = this.sites.get('e:' + key)?.obra?.box?.clone();
    this._concluirSite('e:' + key, () => {
      this._aprovando.delete(key); const xp0 = J.S.xp; J.aprovarEtapa(key); if (!(p.faixa && e.nivel)) this.mundo.setEtapa(a.modelo, a.parte, true); if (e.extra) this.mundo.setEtapa(e.extra.modelo, e.extra.parte, true);
      if (e.modo === 'reflorestar') this._reflorestado(true);
      this.sincronizar(); this._celebrar(p, e); const [x, y] = this._pontoCel; this._estrelas(J.S.xp - xp0, x, y, 5);
      if (ultima && !this.modoApreciar && e.modo !== 'reflorestar') this._cine(box); // o fim do jogo tem a sua própria câmera (vista da foto)
    }, { aoImpacto: () => { this.som.aprovado(); this.vibra.sucesso(); carimbo.classList.add('bate'); } });
  }
  aprovarModulo(f, i) {
    const J = this.J, k = `m:${f}:${i}`; if (J.S.modulos[f][i].obra?.estado !== 'pronta' || this.sites.get(k)?.concluindo || this._aprovando.has(k)) return; this.paineis.fechar(true); this._aprovando.add(k);
    this._festaAte = this.ground.adiarAte = performance.now() + 2600; this.engine.acordar?.(3200); this._pontoCel = this._pontoSite(k, this.ancoraModulo(f, i)); const carimbo = this._carimbo();
    this._concluirSite(k, () => { this._aprovando.delete(k); const xp0 = J.S.xp; J.aprovarModulo(f, i); this.sincronizar(); const m = J.S.modulos[f][i]; this.hud.brinde(`${MODULOS[f].nome}: módulo ${i + 1} no nível ${m.nivel}`, 'subir'); const [x, y] = this._pontoCel; this._estrelas(J.S.xp - xp0, x, y, 5); },
      { aoImpacto: () => { this.som.aprovado(); this.vibra.sucesso(); carimbo.classList.add('bate'); } });
  }
  _celebrar(p, e) {
    this.hud.brinde(`${p.nome}: ${e.nome}`, 'ok', 3000);
    if (e.servico) { const s = Object.entries(e.servico).map(([k, v]) => `+${fmt(v)} ${k === 'agua' ? 'de água' : k === 'energia' ? 'de energia' : 'de saneamento'}`).join(', '); setTimeout(() => this.hud.brinde(s, Object.keys(e.servico)[0], 2800), 700); }
  }
  // última etapa de um projeto: órbita de cinema com barras (um toque na tela cancela)
  _cine(box) {
    if (this._cineEl) return; const c = el('div', 'cine passa', '<i></i><i></i>'); this.ui.appendChild(c); this.ui.classList.add('cine-on'); this._cineEl = c; this._cineT0 = performance.now(); this.engine.acordar?.(4200);
    const fim = () => { if (this._cineEl !== c) return; this._cineEl = null; this.ui.classList.remove('cine-on'); c.classList.add('sai'); setTimeout(() => c.remove(), 320); };
    const orbita = () => { if (this._cineEl === c) this.rig.orbitaCine?.(3200, 0.5, fim); else fim(); };
    if (box) { const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2; this.rig.flyTo({ x: cx, z: cz, cine: true, done: orbita }, 700); } else orbita();
    this._cineFim = fim;
  }
  // prédio novo do canteiro: sobe por um plano de corte em 3 lances (sem esticar)
  predioConstruido(id) { const g = this.mundo.predios[id]; g.userData.animando = true; g.userData.pronto = false; g.visible = true; g.scale.set(1, 1, 1); const fim = () => { g.userData.animando = false; this.sincronizarMundo(); }; if (this.obras.erguer) this.obras.erguer(g, { ms: 1400, aoFim: fim }); else fim(); this.e_shadow(); this.hud.brinde(PREDIOS[id].nome + ' pronto!', 'predio:' + id); this.calcBolhas(); setTimeout(() => this.paineis.abrir(PREDIOS[id].tipo === 'usina' ? 'usina' : 'oficina', id), 700); }
  falha(r, fx = {}) {
    this.som.erro(); this.vibra.erro();
    const serv = (fx.servicos || []).map((k) => ({ agua: 'água', energia: 'energia', saneamento: 'saneamento' }[k])).filter(Boolean).join(', ');
    const msg = { creditos: 'Créditos insuficientes', falta: 'Faltam materiais no almoxarifado', faltaPrancha: 'Entregue todos os materiais na prancha', nadaEntregar: 'Nada no almoxarifado para esta prancha: toque num material para produzir', cheio: 'Todos os espaços estão ocupados', almox: 'Almoxarifado cheio', nivel: 'Nível insuficiente', requer: 'Antes, conclua a obra que libera este prédio', bloqueado: 'Ainda não liberado', bloqueada: 'Etapa ainda não liberada', fechado: 'Construa o prédio primeiro',
      servico: `Faltam serviços para os novos moradores${serv ? ': ' + serv : ''}`, bem: `Bem-estar abaixo de ${fx.bemMin || 'mínimo'}${fx.bemMin ? '%' : ''}`, sem: 'Sem fichas de Mutirão: a disposição da comunidade enche a próxima', max: 'Já está no máximo', nada: 'Nada para fazer aqui', ja: 'Já construído', esgotado: 'Esgotado nesta janela: o estoque renova em breve', limite: 'Limite de vendas desta janela', ocupado: 'O Topógrafo já está fazendo uma licença', nao: 'Este item não é vendido', limiteCap: 'Nível máximo por enquanto' }[r] || 'Não foi possível';
    this.hud.brinde(msg, r === 'creditos' ? 'creditos' : r === 'almox' ? 'almox' : r === 'sem' ? 'mutirao' : null, 2800);
  }
  // leva até quem produz um item (usina, oficina ou o topógrafo) e abre o painel com a ficha destacada
  irProdutor(k) {
    const I = ITENS[k]; if (!I) return; const S = this.S;
    if (I.tipo === 'especial') { if (I.grupo === 'licenca') { this.paineis._empilhar = true; this.irPara({ predio: 'escritorio' }, true, `[data-a=topografo][data-k=${k}]`); this._dica('licenca'); return; } this.hud.brinde('Estrados, etiquetas e cadeados caem ao coletar produção, ao subir de nível e nos pedidos', k, 3200); this._dica('almoxCheio'); return; }
    if ((I.cap || 1) > S.cap && !S.legado?.includes(k)) { this.hud.brinde(`${I.nome} libera no capítulo ${I.cap}`, k, 2600); return; }
    if (I.nivel > S.nivel) { this.hud.brinde(`${I.nome} libera no nível ${I.nivel}`, k, 2600); return; }
    const id = I.tipo === 'bruto' ? (USINAS.find((u) => S.predios[u].ok) || 'usina1') : I.oficina;
    this.paineis._empilhar = !!this.paineis.el; this.irPara({ predio: id }, true, `[data-k="${k}"]`); this.paineis._empilhar = false;
    this.hud.brinde(S.predios[id]?.ok ? `${I.nome}: produzido aqui` : `${I.nome}: construa ${PREDIOS[id].nome}`, k, 2200);
  }
  // produz a cadeia de um item (sub-itens nas oficinas e matéria-prima nas usinas); naFila: o item já entrou em espera
  produzirCadeia(k, naFila = false) {
    const J = this.J; const falta = {}; const conta = (it, n) => { const I = ITENS[it]; const tem = J.S.itens[it] || 0; const f = Math.max(0, n - tem); if (!f) return; if (I.tipo === 'bruto') { falta[it] = (falta[it] || 0) + f; return; } for (const [r, q] of Object.entries(I.req)) conta(r, q * f); falta[it] = (falta[it] || 0) + f; };
    for (const [r, q] of Object.entries(ITENS[k].req)) conta(r, q);
    let feitos = 0; for (const [it, n] of Object.entries(falta)) { const I = ITENS[it]; for (let c = 0; c < n; c++) { let r = 'x'; if (I.tipo === 'bruto') { for (const u of USINAS) if (J.S.predios[u].ok && (r = J.produzir(u, it)) === 'ok') break; } else r = J.enfileirar(I.oficina, it, true); if (r === 'ok') feitos++; else break; } }
    this.hud.brinde(naFila ? `${ITENS[k].nome} na fila${feitos ? ` e ${feitos} insumo(s) encomendados` : ': espera os insumos'}` : feitos ? `${feitos} pedido(s) de produção lançados na cadeia` : 'Sem espaço livre nas usinas e oficinas', naFila || feitos ? k : null, 3000); this.calcBolhas(); this.paineis.agendar();
  }
  // ------------------------------------------------------------ balões
  _posRepasse() {
    if (this.J.feita('sede.e2')) { const F = this.mundo.faixas?.sede; if (F?.centro && F.alturaTopo) { const [x, z] = F.centro(Math.min(1, F.mods.length - 1)); return [x, F.alturaTopo(this.nivelFaixaProj(PROJ.sede)) + 0.6, z]; } if (A.sede.repasse) return A.sede.repasse.slice(); const s = A.sede; return [s.c[0], 2.6, s.c[1] + s.rz]; }
    const l = LOTES.escritorio; return [l.x, 1.6, l.z];
  }
  ancoraEtapa(p, e) {
    const W = this.mundo; if (p.faixa) { const F = W.faixas[p.faixa]; const n = Math.max(e.nivel || 0, this.nivelFaixaProj(p)); const i = (F.mods.length / 2) | 0; const [x, z] = F.centro(Math.min(i, F.mods.length - 1)); return [x, F.alturaTopo(n) + 0.8, z]; }
    const a = alvoEtapa(p, e); const m = W.modelos[a.modelo]; return m?.ancora || [0, 2, 0];
  }
  ancoraModulo(f, i) { const W = this.mundo; const F = f === 'casas' ? W.casas : W.faixas[f]; const [x, z] = F.centro(i); const m = this.S.modulos[f][i]; return [x, F.alturaTopo(Math.max(1, m.obra ? m.obra.para : m.nivel)) + 0.5, z]; }
  calcBolhas() {
    const J = this.J, S = this.S, W = this.mundo, L = [];
    // canteiro desmontado (ou sendo desmontado): sem balões de produção sobre a mata
    const semCanteiro = !W.canteiro.visible || this.sites.has('e:reflorestar.e0') || J.feita('reflorestar.e0') || J.feita('reflorestar.e1');
    if (!semCanteiro) {
      for (const id of USINAS) { const st = S.predios[id]; if (!st.ok) continue; const pr = J.prontosUsina(id); const l = LOTES[id]; if (pr.length) L.push({ id: 'u' + id, tipo: 'coleta', icone: st.slots[pr[0]].item, n: pr.length, pos: [l.x, 1.5, l.z], coletavel: true, alvo: { predio: id }, acao: (el) => this.coletarUsina(id, -1, el) }); else if (!st.slots.some(Boolean)) L.push({ id: 'u' + id, tipo: 'placa', icone: 'producao', pos: [l.x, 1.5, l.z], alvo: { predio: id }, verbo: 'Produzir', acao: () => this.irPara({ predio: id }) }); }
      for (const id of OFICINAS) { const st = S.predios[id]; const l = LOTES[id];
        if (st.ok) { if (st.prontos.length) L.push({ id: 'o' + id, tipo: 'coleta', icone: st.prontos[0], n: st.prontos.length, pos: [l.x, 1.3, l.z], coletavel: true, alvo: { predio: id }, acao: (el) => this.coletarOficina(id, el) }); }
        else if (J.predioLiberado ? J.predioLiberado(id) : PREDIOS[id].nivel <= S.nivel) L.push({ id: 'o' + id, tipo: 'placa', icone: 'grua', pos: [l.x, 1.0, l.z], alvo: { predio: id }, verbo: 'Construir', acao: () => this.irPara({ predio: id }) }); }
      for (const id of USINAS) { const P = PREDIOS[id]; if (!S.predios[id].ok && P.nivel <= S.nivel) { const l = LOTES[id]; L.push({ id: 'n' + id, tipo: 'placa', icone: 'grua', pos: [l.x, 1.0, l.z], alvo: { predio: id }, verbo: 'Construir', acao: () => this.irPara({ predio: id }) }); } }
    }
    let placaEtapa = false;
    for (const p of PROJETOS) {
      if (p.cap > S.cap) continue; const nx = J.proximaEtapa(p); if (!nx) continue; const key = p.id + '.' + nx.e.id; const site = this.sites.get('e:' + key); if (site?.concluindo || this._aprovando.has(key)) continue;
      const pos = (site && this.obras.ancora?.('e:' + key)) || this.ancoraEtapa(p, nx.e); const alvo = { etapa: key };
      if (nx.s === 'pronta') L.push({ id: 'e' + key, tipo: 'pronta', icone: 'check', pos, alvo, acao: () => this.aprovarEtapa(key) });
      else if (nx.s === 'obra') { const st = J.etapa(key); L.push({ id: 'e' + key, tipo: 'obra', icone: 'grua', p: (J.agora - st.ini) / (st.fim - st.ini), pos, alvo, verbo: 'Obra: ' + curto(p.nome), acao: () => this.irPara(alvo) }); }
      else if (nx.s === 'disponivel' || nx.s === 'prancha') { placaEtapa = true; L.push({ id: 'e' + key, tipo: 'placa', icone: 'placa', pos, alvo, verbo: 'Obra: ' + curto(p.nome), acao: () => this.irPara(alvo) }); }
    }
    for (const [f, arr] of Object.entries(S.modulos)) arr.forEach((m, i) => {
      const s = J.situacaoModulo(f, i); const k = `m:${f}:${i}`; const site = this.sites.get(k); if (site?.concluindo || this._aprovando.has(k)) return;
      const pos = (site && this.obras.ancora?.(k)) || this.ancoraModulo(f, i); const alvo = { modulo: [f, i] };
      if (s === 'pronta') L.push({ id: `m${f}${i}`, tipo: 'pronta', icone: 'check', pos, alvo, acao: () => this.aprovarModulo(f, i) });
      else if (s === 'obra') L.push({ id: `m${f}${i}`, tipo: 'obra', icone: 'grua', p: (J.agora - m.obra.ini) / (m.obra.fim - m.obra.ini), pos, alvo, acao: () => this.irPara(alvo) });
      else if (s === 'disponivel') {
        const r = J.requisitosModulo(f, i); const ok = r.servOk && r.bemOk && S.creditos >= r.custo && Object.entries(r.itens).every(([k2, n]) => J.temItem(k2, n));
        if (!r.servOk || !r.bemOk) { const falta = r.servOk ? 'bem' : (r.servicos || []).find((x) => (J.servicoInfo ? J.servicoInfo(x).cap : J.serv[x]) < r.popDepois) || 'agua'; L.push({ id: `m${f}${i}`, tipo: 'bloq', icone: falta, pos, alvo, acao: () => this.irPara(alvo) }); }
        else if (ok || m.nivel === 0) L.push({ id: `m${f}${i}`, tipo: ok ? 'subir' : 'placa', icone: ok ? 'subir' : 'placa', pos, alvo, verbo: ok ? 'Subir módulo' : 'Módulo', acao: () => this.irPara(alvo) });
      }
    });
    const r = S.repasse; if (r.acum >= Math.max(15, J.taxaRepasse() * 4)) L.push({ id: 'repasse', tipo: 'moedas', icone: 'repasse', pos: this._posRepasse(), coletavel: true, alvo: { repasse: true }, acao: (el) => this.coletarRepasse(el) });
    this.bolhas.definir(L); this._listaBolhas = L;
    // pontos nos botões
    let prontos = 0; for (const id of USINAS) prontos += J.prontosUsina(id).length; for (const id of OFICINAS) prontos += S.predios[id].prontos.length; this.hud.ponto('producao', prontos);
    let aprov = 0; for (const p of PROJETOS) { const nx = J.proximaEtapa(p); if (nx && nx.s === 'pronta') aprov++; } this.hud.ponto('obras', aprov);
    this.hud.ponto('pedidos', S.cap >= REGRAS.capPedidos ? S.pedidos.filter((p) => p.itens && Object.entries(p.itens).every(([k, n]) => J.temItem(k, n))).length : 0);
    const pc = J.ocupado / J.capacidade; this.hud.ponto('almox', pc >= 0.95 ? '!' : 0);
    // a primeira placa de obra à vista (fora do primeiro passo do tutorial) explica a prancha
    // (no tutorial, cai da fila se a obra do Caminho começar antes de ela tocar: explicaria a prancha tarde demais)
    if (placaEtapa && S.cap === 1 && !this.S.dicas.primeiraEtapa && !(this._tutAtivo() && (S.dicas.guia || 0) < 1)) this._dica('primeiraEtapa', { se: () => !this._tutAtivo() || (this.S.dicas.guia || 0) <= 1 });
    // Meta em foco e Próximo
    const passo = this._passoTut(); this._plano = J.planoMeta ? J.planoMeta() : null; const agora = !passo || passo.id === 'meta' ? this._plano : null;
    this.hud.meta(agora, agora && (agora.item && ITENS[agora.item] ? agora.item : ICONE_PLANO[agora.acao] || 'obras'));
    this._prox = this._calcProximo(L, passo); this.hud.proximo(this._prox && { icone: this._prox.icone, verbo: this._prox.verbo, pulsa: L.some((b) => b.tipo === 'pronta' || b.tipo === 'coleta'), compacto: !!(this._prox.plano && agora) });
  }
  // ------------------------------------------------------------ Próximo, Meta em foco e metas
  _calcProximo(L, passo) {
    if (passo) { for (const a of [].concat(passo.alvo)) { if (a.startsWith('balao:')) { const b = L.find((x) => x.id === a.slice(6)); if (b) return this._proxBalao(b); } else if (a.startsWith('bt:')) return { painel: a.slice(3), icone: a.slice(3), verbo: a.slice(3) === 'obras' ? 'Obras' : 'Abrir' }; } }
    const pl = this._plano; if (pl && pl.alvo && pl.acao !== 'aguardar') return { alvo: pl.alvo, destaque: this._selPlano(pl), icone: pl.item && ITENS[pl.item] ? pl.item : ICONE_PLANO[pl.acao] || 'subir', verbo: pl.acao === 'iniciar' && pl.alvo.modulo ? 'Subir módulo' : VERBO_PLANO[pl.acao] || 'Ir', plano: true };
    for (const t of ['pronta', 'coleta', 'moedas', 'subir', 'placa', 'obra']) { const b = L.find((x) => x.tipo === t); if (b) return this._proxBalao(b); }
    return null;
  }
  _proxBalao(b) { return { alvo: b.alvo, icone: b.tipo === 'obra' || b.tipo === 'placa' ? (b.alvo?.etapa ? PROJ[b.alvo.etapa.split('.')[0]]?.icone || b.icone : b.icone) : b.icone, verbo: b.verbo || VERBO[b.tipo] || 'Ir', destaque: b.tipo === 'pronta' ? '[data-a=aprovar],[data-a=aprovarMod]' : b.tipo === 'coleta' ? '[data-a=coletarU],[data-a=coletarO]' : null }; }
  // elemento do painel que corresponde ao passo do plano
  _selPlano(pl) {
    if (!pl) return null; const k = pl.item;
    switch (pl.acao) {
      case 'produzir': return pl.alvo?.topografo ? `[data-a=topografo][data-k=${pl.alvo.topografo}]` : k ? `[data-k="${k}"]` : null;
      case 'coletar': return pl.alvo?.repasse ? '[data-a=repasse]' : '[data-a=coletarU],[data-a=coletarO]';
      case 'entregar': case 'iniciar': return pl.alvo?.modulo ? '[data-a=melhorar]' : '[data-a=entregarIniciar],[data-a=entregarTudo]';
      case 'aprovar': return '[data-a=aprovar],[data-a=aprovarMod]';
      case 'construir': return pl.alvo?.almox ? '[data-a=ampliarAlmox]' : pl.alvo?.ampliar ? '[data-a=ampliar]' : '[data-a=construir]';
    }
    return null;
  }
  proximo() { const P = this._prox; if (!P) { this.hud.brinde('Tudo em dia! As obras seguem sozinhas.', 'ok'); return; } if (P.painel) { this.paineis.abrir(P.painel); return; } this._irAlvo(P.alvo, P.destaque); }
  _irPlano(pl) { if (!pl) return; this._irAlvo(pl.alvo, this._selPlano(pl)); }
  _irAlvo(alvo, destaque) {
    if (!alvo) { this.paineis.abrir('producao'); return; }
    if (alvo.etapa || alvo.modulo || alvo.predio) return this.irPara(alvo, true, destaque);
    if (alvo.repasse) { const p = this._posRepasse(); this._irMundo(p); this.paineis.abrir('escritorio', undefined, { destaque: destaque || '[data-a=repasse]' }); return; }
    if (alvo.topografo) return this.irPara({ predio: 'escritorio' }, true, `[data-a=topografo][data-k=${alvo.topografo}]`);
    if (alvo.capitulo) return this.modalCapitulo(this.J.capitulo());
    if (alvo.almox) return this.irPara({ predio: 'almox' }, true, '[data-a=ampliarAlmox]');
    if (alvo.deposito) return this.paineis.abrir('deposito', undefined, { destaque: destaque });
    if (alvo.ampliar) return this.irPara({ predio: alvo.ampliar }, true, '[data-a=ampliar]');
  }
  _irMeta(i) {
    const J = this.J, c = J.capitulo(); const m = c?.metas[i]; if (!m) return; this.S.dicas.metaFoco = 1; this.hud.alternarMetas(false);
    if (m.tipo === 'predio') this.irPara({ predio: m.id }, true, '[data-a=construir]');
    else if (m.tipo === 'etapa') { const [pid] = m.id.split('.'); const nx = J.proximaEtapa(PROJ[pid]); this.irPara({ etapa: nx ? pid + '.' + nx.e.id : m.id }); }
    else if (m.tipo === 'modulos') { const arr = J.S.modulos[m.faixa]; let k = arr.findIndex((x, q) => x.nivel < m.nivel && ['pronta', 'disponivel', 'obra'].includes(J.situacaoModulo(m.faixa, q))); if (k < 0) k = Math.max(0, arr.findIndex((x) => x.nivel < m.nivel)); this.irPara({ modulo: [m.faixa, k] }); }
    else this.paineis.abrir('producao');
  }
  _infoBem() {
    const J = this.J; const bi = J.bemInfo?.(); if (!bi) { this.paineis.abrir('escritorio'); return; }
    const f = bi.fontes.slice(0, 3).map((x) => `<li><b>+${x.v}%</b>${x.txt}</li>`).join('');
    const nv = POP_NIVEL.length - 1, quem = Object.values(MODULOS).filter((M) => M.max >= nv).map((M) => M.nome).join(' e '); // só os módulos que têm esse pavimento
    this.hud.info('[data-a="bem"]', `<h4>Bem-estar ${bi.total}%</h4><ul><li><b>${bi.base}%</b>Base</li>${f}${bi.pressao ? `<li class="nao"><b>−${bi.pressao}%</b>Pressão de moradia</li>` : ''}</ul><small>Mais bem-estar aumenta os repasses. O ${nv}º pavimento (${quem}) pede ${bemMinimo(nv)}%.</small>`);
  }
  _infoMutirao() {
    const S = this.S; this.hud.info('[data-a="mutirao"]', `<h4>Mutirão ${S.mutirao}/${REGRAS.fichasMax}</h4><p>Cada ficha reduz até ${REGRAS.mutiraoH} h de uma obra (na usina, de todos os espaços; na oficina, do item atual).</p><div class="linha"><div class="barra"><i style="width:${S.disposicao || 0}%"></i></div><b class="num">${Math.round(S.disposicao || 0)}/100</b></div><small>Disposição da comunidade: obras aprovadas, módulos e pedidos enchem a barra; cheia, vira uma ficha.</small>`);
  }
  // ------------------------------------------------------------ tutorial (primeiros passos)
  _tutAtivo() { const T = TUTORIAL || []; return this.S.cap === 1 && (this.S.dicas.guia || 0) < T.length; }
  _passoTut() { return this._tutAtivo() ? TUTORIAL[this.S.dicas.guia || 0] : null; }
  _tutorial() {
    const S = this.S, T = TUTORIAL || []; if (S.cap !== 1) return; let i = S.dicas.guia || 0; while (i < T.length && T[i].feito(this.J)) i++;
    if (i !== (S.dicas.guia || 0) || S.dicas.guia === undefined) S.dicas.guia = i;
    if (i < T.length && this._guiaFalou !== i) { this._guiaFalou = i; const p = T[i]; this.hud.falar(p.quem, p.fala, { se: () => this.S.cap === 1 && (this.S.dicas.guia || 0) === i, grupo: 'tutorial' }); }
  }
  // anel-guia: dentro do painel aberto, o controle que o passo pede; senão o balão, o botão ou a Meta em foco
  // alvos do passo lidos uma vez por passo (o guia roda a cada quadro e não aloca): do último para o primeiro,
  // cada um com o tipo e o id já separados, e os seletores procurados dentro do painel aberto
  _alvosTut(p) {
    const A = this._tutA; if (A && A.id === p.id) return A; const L = [].concat(p.alvo);
    const rev = L.slice().reverse().map((a) => (a.startsWith('balao:') ? { a, tipo: 'balao', id: a.slice(6) } : a.startsWith('bt:') ? { a, tipo: 'bt', id: a.slice(3), sel: `[data-a="${a.slice(3)}"]:not(.oculto)` } : { a, tipo: a === 'meta' ? 'meta' : a.includes(':') ? 'nada' : 'sel', sel: '#ui ' + a }));
    return (this._tutA = { id: p.id, rev, painel: TUT_PAINEL[p.id] || L.filter((a) => !a.includes(':') && a !== 'meta') });
  }
  _guia(t) {
    const p = this._passoTut(); if (!p || !this.hud._visivel || this.modoApreciar || this._modais.length || this.ui.classList.contains('intro')) { this.hud.guia(null); return; }
    let pt = null; const G = this._guiaCache; const A = this._alvosTut(p);
    if (this.paineis.el) { if (t - G.t > 200) { G.t = t; G.pt = null; for (let i = 0; i < A.painel.length; i++) { const e = this.paineis.el.querySelector(A.painel[i]); if (e) { const f = e.classList.contains('fraco') && this.paineis.el.querySelector('.ficha.falta[data-a=produtor]'); G.pt = centro(f || e); break; } } } pt = G.pt; }
    if (!pt) for (let i = 0; i < A.rev.length; i++) {
      const r = A.rev[i];
      // balão apagado sob a fala (sem toque): o anel vai para o Próximo, que leva ao mesmo alvo
      if (r.tipo === 'balao') { pt = this.bolhas.posTela(r.id); if (pt && this.bolhas.sob(r.id)) { if (t - (G.tp || -1e9) > 200) { G.tp = t; G.prox = this.hud.prox.classList.contains('oculto') ? null : centro(this.hud.prox); } pt = G.prox; } }
      else if (t - G.t > 200 || G.a !== r.a) { G.t = t; G.a = r.a; const e = r.tipo === 'bt' ? this.hud.botao(r.id) : r.tipo === 'meta' ? (this.hud.agora.classList.contains('oculto') ? this.hud.cap : this.hud.agora) : r.tipo === 'nada' || this.paineis.el ? null : document.querySelector(r.sel); G.pt = e && !(this.paineis.el && r.tipo === 'bt' && this.paineis.atual?.tipo === r.id) ? centro(e) : null; pt = G.pt; }
      else pt = G.pt;
      if (pt) break;
    }
    this.hud.guia(pt ? pt[0] : null, pt ? pt[1] : null);
  }
  // ------------------------------------------------------------ câmera e seleção
  irPara(alvo, abrir = true, destaque = null) {
    let foco = null; const o = destaque ? { destaque } : {};
    if (alvo.etapa) { const [pid, eid] = alvo.etapa.split('.'); const p = PROJ[pid], e = p.etapas.find((x) => x.id === eid); const a = alvoEtapa(p, e); const m = this.mundo.modelos[a.modelo]; const an = this.ancoraEtapa(p, e); foco = m?.foco && !p.faixa ? m.foco : { x: an[0], z: an[2] + 1.5, dist: 16 }; if (abrir) this.paineis.abrir('etapa', alvo.etapa, o); }
    else if (alvo.modulo) { const [f, i] = alvo.modulo; const an = this.ancoraModulo(f, i); foco = { x: an[0], z: an[2] + 1, dist: 11 }; if (abrir) this.paineis.abrir('modulo', alvo.modulo, o); }
    else if (alvo.predio) { const l = LOTES[alvo.predio]; if (l) foco = { x: l.x + 0.8, z: l.z, dist: 13 }; if (abrir) this.paineis.abrir(PREDIOS[alvo.predio].tipo === 'usina' ? 'usina' : PREDIOS[alvo.predio].tipo === 'oficina' ? 'oficina' : alvo.predio === 'almox' ? 'almox' : 'escritorio', alvo.predio, o); }
    else if (alvo.repasse) return this._irAlvo(alvo, destaque);
    if (foco) { this.rig.pitchFix = null; this.rig.flyTo({ x: foco.x, z: foco.z, dist: foco.dist, tilt: 0, yaw: this.rig.yaw, fov: 38 }); }
  }
  // leva a câmera até um ponto do mundo (balão na borda; grupo de balões: aproxima para separar)
  _irMundo(pos, alvo, k) { if (!pos) return; this.rig.pitchFix = null; if (k) { this.rig.flyTo({ x: pos[0], z: pos[2] + 0.6, dist: Math.max(this.rig.minDist || 4, this.rig.dist * k) }); return; } this.rig.flyTo({ x: pos[0], z: pos[2] + 1.5, dist: Math.min(this.rig.dist, 16), tilt: 0 }); }
  toque(x, y) {
    if (this.modoApreciar) { this.aoToqueApreciar?.(); return; }
    this.hud.alternarMetas(false); this.hud.fecharInfo(); if (this._cineEl) this._cineFim?.();
    const ray = this.rig.ray(x, y); let p = null;
    if (this.mundo.pick) { const h = this.mundo.pick(ray); if (h) p = { pick: h.pick, point: h.point }; }
    else { const hits = ray.intersectObjects([this.mundo.root], true); for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o && o.visible) { p = { pick: o.userData.pick, point: h.point }; break; } } }
    const g = p?.point || this.rig.ground(x, y); if (!g) { this.paineis.fechar(); return; }
    const alvo = p ? this._pickAlvo(p.pick, g) : this._maisProximo(g);
    if (alvo) { this.som.toque(); this.vibra.tique(); this.irPara(alvo, true); } else this.paineis.fechar();
  }
  _pickAlvo(pick, pt) {
    if (pick.tipo === 'predio') return this.mundo.canteiro.visible ? { predio: pick.id } : null;
    if (pick.tipo === 'modulos') { const F = pick.id === 'casas' ? this.mundo.casas : this.mundo.faixas[pick.id]; let best = 0, bd = 1e9; F.mods.forEach((m, i) => { const [x, z] = F.centro(i); const d = Math.hypot(x - pt.x, z - pt.z); if (d < bd) { bd = d; best = i; } }); return { modulo: [pick.id, best] }; }
    if (pick.tipo === 'proj') { const p = PROJ[pick.id]; if (!p) return this._maisProximo(pt); const nx = this.J.proximaEtapa(p) || { e: p.etapas[p.etapas.length - 1] }; return { etapa: p.id + '.' + nx.e.id }; }
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
  // ------------------------------------------------------------ modais (fila: nenhum abre com painel, outro modal ou festa)
  _fila(fn, atraso = 0, chave = null) { if (chave && (this._filaModais.some((x) => x.chave === chave) || (chave === 'capitulo' && this._modalCap))) return; this._filaModais.push({ fn, t: performance.now() + atraso, chave }); }
  _verModais() {
    for (const r of [...this._modais]) if (!r.v.isConnected) r.fechar(true, true); // tirado do DOM por fora (testes): limpa como fechar
    this._ocupado(); const q = this._filaModais; if (!q.length) return; const t = performance.now();
    if (this._modais.length || this.paineis.el || t < this._festaAte || this.ui.classList.contains('intro')) return;
    const i = q.findIndex((x) => x.t <= t); if (i < 0) return; const [x] = q.splice(i, 1); x.fn();
  }
  _carimbo() {
    const c = el('div', 'carimbo', '<span>APROVADO</span>'); this.ui.appendChild(c);
    setTimeout(() => c.classList.add('some'), 1300); setTimeout(() => c.remove(), 1900); return c;
  }
  // o = {fixo (o véu não fecha; o modal treme), aoFechar, cls}
  modal(html, aoMontar, o = {}) {
    const v = el('div', 'veu'); v.innerHTML = `<div class="modal ${o.cls || ''}" role="dialog" aria-modal="true">${html}</div>`; this.ui.appendChild(v); this.som.abrir();
    const m = v.querySelector('.modal'); const reg = { v, o }; this._modais.push(reg); this._ocupado(); this.hud.alternarMetas(false); this.hud.fecharInfo(); this.engine.acordar?.(400);
    let feito = false;
    const fechar = (quieto, jaFora) => {
      if (feito) return; feito = true; this._modais = this._modais.filter((x) => x !== reg); this._ocupado();
      if (!jaFora) { v.classList.add('sai'); const fim = (e) => { if (!e || e.target === v) v.remove(); }; v.addEventListener('animationend', fim); setTimeout(() => v.remove(), 200); }
      if (!quieto) this.som.fechar(); try { o.aoFechar?.(); } catch (e) { console.error(e); }
    };
    reg.fechar = fechar;
    v.addEventListener('click', (e) => { if (e.target === v) { if (o.fixo) { m.classList.remove('treme'); void m.offsetWidth; m.classList.add('treme'); this.vibra.erro(); } else fechar(); return; } if (e.target.closest('[data-fecha]')) fechar(); });
    aoMontar && aoMontar(m, fechar); return fechar;
  }
  // subiu de nível: raios, cartões de recompensa; 'Continuar' faz as recompensas voarem para o HUD
  modalNivel(d) {
    const de = d.de ?? d.nivel - 1, para = d.para ?? d.nivel; const n = para - de; const tit = n > 2 ? `Níveis ${de + 1} a ${para}` : n === 2 ? `Níveis ${de + 1} e ${para}` : `Nível ${para}`;
    const esp = (d.especiais?.length ? d.especiais : [d.especial]).filter((k) => ITENS[k]); const cont = {}; for (const k of esp) cont[k] = (cont[k] || 0) + 1;
    const cards = [`<div class="premio" data-p="creditos">${img('creditos')}<b>+${fmt(d.creditos || 0)}</b><small>créditos</small></div>`, ...Object.entries(cont).map(([k, q]) => `<div class="premio" data-p="${k}">${img(k)}<b>+${q}</b><small>${ITENS[k].nome}</small></div>`), ...(d.vagas || []).map((id) => `<div class="premio" data-p="predio:${id}">${img('predio:' + id)}<b>+1 vaga</b><small>${PREDIOS[id]?.nome || id}</small></div>`)].join('');
    const novos = [...(d.novos || []).map((k) => `<span class="etiq">${img(k)}${ITENS[k].nome}</span>`), ...(d.predios || []).map((k) => `<span class="etiq">${img('predio:' + k)}${PREDIOS[k].nome}</span>`)].join('');
    // retido: o que ainda falta somar no contador (0 se ele já subiu enquanto o modal esperava na fila)
    const ret = d._ret || { v: d.creditos || 0 }; let voou = false; const voar = (m) => {
      if (voou) return; voou = true; const cs = m ? [...m.querySelectorAll('.premio')] : []; let t = 0; const v = ret.v; ret.v = 0;
      for (const c of cs) { const r = c.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const p = c.dataset.p; setTimeout(() => { if (p === 'creditos') { const k = 6, parte = Math.floor(v / k); this.hud.voar('creditos', x, y, 'creditos', v ? (i, vis, ult) => this.hud.soltar('creditos', ult ? v - parte * (vis - 1) : parte) : null, { n: k }); this.som.moedas(); } else this.hud.voar(p, x, y, 'almox', null, { n: cont[p] || 1 }); }, t); t += 90; }
      if (!cs.length && v) this.hud.soltar('creditos', v);
    };
    this.modal(`<div class="festa" aria-hidden="true"></div><h3>Subiu de nível</h3><h1>${tit}</h1><div class="premios">${cards}</div>${novos ? `<p class="lib">Liberado agora</p><div class="linha centro">${novos}</div>` : ''}<button class="botao ouro grande" data-continuar>Continuar</button>`,
      (m, fechar) => { m.querySelector('[data-continuar]').addEventListener('click', () => { voar(m); fechar(); }); this._modalNivelEl = m; },
      { cls: 'festivo', aoFechar: () => { voar(this._modalNivelEl); if (de < ABRE.depositoNivel && para >= ABRE.depositoNivel) setTimeout(() => this._dica('deposito'), 400); } });
    this.calcBolhas();
  }
  _capituloPronto(c) { return !!(c && c.escolha && this.S.capEscolhas[c.n] === undefined && c.metas.every((m) => this.J.metaFeita(m))); }
  // capítulo sem escolha (o epílogo) cumprido e ainda não concluído: conclui pela fila (também depois de recarregar)
  _capSemEscolha() { const c = this.J.capitulo(); return !!(c && !c.escolha && this.S.capEscolhas[c.n] === undefined && c.metas.every((m) => this.J.metaFeita(m))); }
  _verCapSemEscolha(atraso) { if (this._capSemEscolha()) this._fila(() => { if (this._capSemEscolha()) this._concluirCap(null, innerWidth / 2, innerHeight * 0.4); }, atraso, 'capitulo'); }
  // conclui o capítulo e faz voar o que a Holding pagou (os marcos do capítulo seguinte já voam nos próprios avisos)
  _concluirCap(esc, x, y) {
    const J = this.J; const cr0 = J.S.creditos; const av = (this._somaAvisos = { v: 0 }); let r;
    try { r = J.concluirCapitulo(esc); } finally { this._somaAvisos = null; }
    if (r !== 'ok') return r; this.som.nivel(); this.vibra.sucesso(); this._moedas(J.S.creditos - cr0 - av.v, x, y, 8); return r;
  }
  // o que a apresentação paga, medido na própria regra: uma cópia do jogo, sem ouvintes, conclui o capítulo (com as
  // metas dadas por cumpridas na cópia: o modal também abre por fora, nos testes e na vitrine)
  _premioCap() {
    const J = this.J; try {
      // só as metas do capítulo atual valem por cumpridas: as do seguinte seguem o estado (senão os marcos dele dariam
      // disposição e fichas que a conclusão real não dá)
      const D = new J.constructor(structuredClone(J.S)); D.agora = J.agora; const c = J.capitulo(), mf = D.metaFeita.bind(D); D.metaFeita = (m) => c.metas.includes(m) || mf(m); let marcos = 0; D.on((t, d) => { if (t === 'aviso' && d.creditos > 0) marcos += d.creditos; });
      if (D.concluirCapitulo(null) !== 'ok') return null; return { creditos: D.S.creditos - J.S.creditos - marcos, fichas: D.S.mutirao - J.S.mutirao };
    } catch (e) { return null; }
  }
  _falasHtml(fala) { return (fala || []).map(([q, t]) => `<div class="conselho">${retrato(q)}<div class="fala"><b>${CONSELHO[q]?.nome || ''}</b>${t}</div></div>`).join(''); }
  // apresentação ao Conselho: não some com um toque fora; 'Decidir depois' deixa a pílula 'Conselho aguarda' no topo
  modalCapitulo(c) {
    if (!c || this._modalCap || !c.escolha || this.S.capEscolhas[c.n] !== undefined) return; this._modalCap = true; this.hud.conselho(false);
    const prox = CAPITULOS[c.n]; const falas = this._falasHtml(c.fala); const pr = this._premioCap();
    const esc = c.escolha.map((o) => `<button class="escolha" data-esc="${o.id}">${retrato(o.quem, 'p32')}<div class="tx"><b>${o.txt}</b><span class="ganho">${o.ganho}</span><span class="custo">Custo: ${o.custo}</span><small>${o.porque}</small></div></button>`).join('');
    const premio = `<span class="etiq">${img('creditos')}${pr?.creditos > 0 ? `<b class="cred">+${fmt(pr.creditos)}</b>&nbsp;da Holding` : 'Créditos da Holding'}</span>${!pr || pr.fichas > 0 ? `<span class="etiq">${img('mutirao')}${pr ? `+${pr.fichas} ficha${pr.fichas > 1 ? 's' : ''} de Mutirão` : 'Ficha de Mutirão'}</span>` : ''}`;
    this.modal(`<h3>Apresentação ao Conselho</h3><h1>Capítulo ${c.n}: ${c.nome}</h1><div class="linha centro"><span class="etiq ok">${img('ok')}Aprovado</span>${premio}</div><div class="falas">${falas}</div>${prox?.abre?.length ? `<p class="novas"><b>Novas obras:</b> ${prox.abre.join(', ')}</p>` : ''}<p class="pergunta"><span>O Conselho pede uma decisão. Ela vale para os próximos capítulos.</span><button class="botao sec depois" data-depois>Decidir depois</button></p><div class="escolhas">${esc}</div>`, (m, fechar) => {
      m.addEventListener('click', (e) => {
        if (e.target.closest('[data-depois]')) { this.S.dicas.depoisCap = c.n; fechar(); return; } // não reabre sozinho (nem ao reabrir o jogo): fica a pílula
        const b = e.target.closest('[data-esc]'); if (!b) return; const r = m.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height * 0.3;
        // conclui antes de fechar (o fechar não pode pôr a pílula de volta); som, vibração e moedas vêm na conclusão
        const res = this._concluirCap(b.dataset.esc || null, x, y); this._modalCap = false; fechar(true); if (res !== 'ok') return;
        const o = c.escolha.find((q) => q.id === b.dataset.esc); if (o) this.hud.brinde(`Escolha do Conselho: ${o.txt}`, 'sede', 3200); this.hud.capitulo(); this.sincronizar();
      });
    }, { fixo: true, cls: 'larga capitulo', aoFechar: () => { this._modalCap = false; if (this._capituloPronto(this.J.capitulo())) this.hud.conselho(true); } });
  }
  _introCap(c) { const t = { 2: ['iris', 'Agora o Anel pode crescer e a praça sai do papel. Veja as novas obras no botão Obras.'], 3: ['iris', 'Chegou a vez da Biblioteca Central, das faculdades e da Faculdade de Ciências.'], 4: ['caio', 'Um acelerador de partículas debaixo da praça. E a Vila Estudantil ao lado.'], 5: ['nara', 'Santuário, savana, bioma aquático e gorilas. É a parte mais delicada.'], 6: ['iris', 'Último passo: desmontar o canteiro e devolver a área à mata.'] }[c.n]; if (t) this.hud.falar(t[0], t[1]); }
  // fim do jogo (evento 'fimDeJogo'): vista da foto no modo Apreciar e o modal da composição total
  finalComposicao() {
    if (this._final) return; this._final = true;
    setTimeout(() => { this.apreciar?.(true); this.vistaFoto?.(true); }, 1500);
    const c = CAPITULOS[CAPITULOS.length - 1]; const falas = this._falasHtml(c?.fala);
    this._fila(() => this.modal(`<div class="festa" aria-hidden="true"></div><h3>Composição total</h3><h1>Arcologia de Held</h1><p>A maquete na mesa agora é igual à do Conselho. Cada etapa aprovada virou obra de verdade.</p>${falas}<p>Use <b>Comparar</b> no modo Apreciar para ver a foto por cima da maquete.</p><button class="botao ouro grande" data-fecha>Apreciar a composição</button>`, null, { fixo: true, cls: 'festivo larga', aoFechar: () => { this._modalCap = false; } }), 5200, 'final');
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
    this.som.obraAtiva = this.modoApreciar ? 0 : perto;
    this._tProd = (this._tProd || 0) + dt; if (this._tProd > 1) { this._tProd = 0; this._repasseProducao(); }
    this._tBolhas += dt; if (this._tBolhas > 0.5 || this._sujo) { this._tBolhas = 0; this._sujo = false; this.calcBolhas(); this.hud.atualizar(); this.hud.capitulo(); this._tutorial(); this.hud.conselho(this._capituloPronto(J.capitulo()) && !this._modalCap && !this._filaModais.some((x) => x.chave === 'capitulo')); }
    this._tPainel = (this._tPainel || 0) + dt; if (this._tPainel > 1) { this._tPainel = 0; this.paineis.tick(); }
    const tf = performance.now(); if (tf - this._tFila > 250) { this._tFila = tf; this._verModais(); } // relógio de parede: com poucos quadros por segundo a fila não atrasa
    // balões: retângulos do HUD (apagam o que fica por baixo) e o cartão das metas aberto (empurra a borda)
    this.bolhas.rects = this.hud.retangulos(t); this.bolhas.cartao = this.hud.metasAbertas ? Math.min(300, innerWidth * 0.34) + 18 : 0;
    this.bolhas.atualizar(); this._guia(t);
    if (this._cineEl && !this.rig.anim && !this.rig._orb && t - this._cineT0 > 900) this._cineFim?.(); // o toque cancelou a órbita
    this._tSalvar += dt; if (this._tSalvar > 12) { this._tSalvar = 0; if (!this.naoSalvar) gravar(this.S); }
  }
}
