// HUD "Prancheta da Maquete": sobre o mundo, vidro escuro fino com texto branco de contorno limpo; nada cobre a
// Sede nem a Biblioteca. No alto à esquerda, o selo do nível com o anel de experiência e as pílulas de moradores
// (com a renda por hora), bem-estar, composição concluída (a única com anel de progresso) e calendário; no alto à
// direita, créditos (com o botão Trocas), Mutirão com a barra de disposição e os aceleradores, Apreciar e
// Configurações. À direita, a coluna de botões-ícone (Produção, Estoque, Pedidos e Trocas; os dois últimos ficam
// no lugar, trancados, até o capítulo em que abrem) e, embaixo, o capacete de Obras com aro de latão e o
// "Próximo" (só aparece sem a pílula Agora, ou com a folha aberta). Embaixo à esquerda, a medalha do capítulo
// (abre o cartão de metas, em uma coluna) e a pílula "Agora", a bússola: uma chamada de ação por vez; no
// tutorial ela vira o cartão do passo ("Passo 1 de 8"). A fala do conselho mora na faixa inferior, entre a Agora
// e o capacete, revelada letra a letra; 4 s depois recolhe para o retrato (a fila continua andando) e, com a folha
// aberta, vira um chip de uma linha no alto da área livre. Os brindes saem no canto superior direito (dois no
// máximo). Toque longo em qualquer controle abre um cartão de duas linhas (o que é e onde conseguir).
// Os toques do calendário e da renda são ligados por extras.js (aoCalendario, aoPop).
import { el, fmt, clamp, easeOutCubic, easeInCubic } from '../core/util.js';
import { img, icone } from './icones.js';
import { CONSELHO } from '../data/historia.js';
import { XP_NIVEL } from '../data/itens.js';
import { REGRAS } from '../sim/estado.js';

const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
// retrato redondo do conselheiro (desenhado em icones.js; a inicial fica por baixo até a imagem aparecer);
// cls: 'p32' (escolhas do Conselho), 'mini'
const retrato = (q, cls = '') => { const c = CONSELHO[q] || CONSELHO.iris; return `<div class="retrato ${cls}" style="--cor:${c.cor}"><b aria-hidden="true">${c.ini}</b>${img('retrato:' + (CONSELHO[q] ? q : 'iris'))}</div>`; };
const pct = (v) => (v <= 0 ? '0%' : v.toLocaleString('pt-BR', { minimumFractionDigits: v < 10 ? 1 : 0, maximumFractionDigits: v < 10 ? 1 : 0 }) + '%');
const nivelDe = (xp, max) => { let n = 1; while (n < max && xp >= XP_NIVEL[n + 1]) n++; return n; };
// carinha do bem-estar: verde a partir do que o último pavimento pede, amarela na faixa do meio, vermelha abaixo da base
const carinha = (b) => (b >= 70 ? 'bem' : b >= 35 ? 'bem-medio' : 'bem-baixo');
export { retrato };
// quando partes da interface aparecem (regras só da interface: a simulação não fecha o Depósito; as dela vêm de REGRAS)
export const ABRE = { trocasCap: 2, depositoNivel: 3 };
export const depositoAberto = (S) => S.nivel >= ABRE.depositoNivel || S.cap >= ABRE.trocasCap;
// calendário do jogo (1 dia = 20 s, mês de 30 dias, ano de 12 meses): o da simulação ou, enquanto ela não o tiver,
// o mesmo cálculo a partir do início do save (S.calendario.inicio ou S.criado)
const DIA_MS = 20000;
export function calendarioDe(J) {
  const c = J.calendario?.(); if (c) return c;
  const S = J.S; const ini = S.calendario?.inicio ?? S.criado ?? J.agora; const t = Math.max(0, (J.agora || Date.now()) - ini);
  const dia = Math.floor(t / DIA_MS); return { dia, diaDoMes: (dia % 30) + 1, mes: (Math.floor(dia / 30) % 12) + 1, ano: Math.floor(dia / 360) + 1, progDia: (t % DIA_MS) / DIA_MS, diaMs: DIA_MS };
}
// renda dos moradores por hora real (a nova, por faixa de bem-estar; ou a taxa antiga de repasse por minuto × 60)
export const rendaHoraDe = (J) => (typeof J.rendaHora === 'function' ? J.rendaHora() : Math.round((J.taxaRepasse?.() || 0) * 60));
// prêmio em créditos por subir ao nível n (a regra da simulação: 300 + 50 × nível)
export const premioNivel = (n) => 300 + 50 * n;
// cartão do toque longo, por controle: [título, o que é, onde conseguir]. A interface é o manual.
const INFO = {
  nivel: ['Nível', 'Sobe com a experiência das obras, coletas e pedidos.', 'Cada nível paga créditos e libera itens e prédios.'],
  pop: ['Moradores', 'Quem já vive nos módulos do Anel e nas casas.', 'Cada morador rende créditos por hora, conforme o bem-estar.'],
  bem: ['Bem-estar', 'A qualidade de vida na arcologia.', 'Sobe com obras aprovadas e serviços; os pavimentos altos pedem um mínimo.'],
  vida: ['Composição concluída', 'Quanto da Composição Total já está de pé.', 'Aprove etapas e módulos para avançar. Toque curto abre Obras.'],
  calendario: ['Calendário', 'Um dia do jogo dura 20 s; a virada do ano renova o limite de empréstimo.', 'Toque curto abre as Finanças.'],
  creditos: ['Créditos', 'O caixa da arcologia.', 'Vêm dos moradores, das etapas aprovadas e dos pedidos. Toque curto abre o Escritório.'],
  deposito: ['Trocas', 'Compra de matéria-prima e venda de produtos no Depósito de Trocas.', `Abre no capítulo ${ABRE.trocasCap} ou no nível ${ABRE.depositoNivel}.`],
  mutirao: ['Mutirão', 'Fichas que adiantam obras e produção.', 'A disposição da comunidade enche com obras, módulos e pedidos; cheia, vira uma ficha.'],
  apreciar: ['Apreciar', 'Passeio pela arcologia sem a interface.', 'Compare com a foto de referência e fotografe.'],
  config: ['Configurações', 'Vídeo, som, jogo, salvamento e acessibilidade.', 'Tamanho da interface, movimento e contraste ficam aqui.'],
  producao: ['Produção', 'Usinas e oficinas: o que está sendo feito agora.', 'Toque numa linha para abrir o prédio.'],
  almox: ['Almoxarifado', 'O estoque de materiais e produtos.', 'Toque num item para ir a quem produz.'],
  pedidos: ['Pedidos da comunidade', 'Entregas que pagam créditos, experiência e disposição.', `Abrem no capítulo ${REGRAS.capPedidos}.`],
  trocas: ['Depósito de Trocas', 'Compra de matéria-prima e venda de produtos.', `Abre no capítulo ${ABRE.trocasCap}.`],
  obras: ['Obras', 'Todas as etapas da Composição Total, da prancha à aprovação.', 'Verde: pronta; laranja: faltam materiais; azul: em obra.'],
  capmin: ['Capítulo', 'As metas do capítulo e o prêmio da Holding.', 'Com todas cumpridas, apresente ao Conselho.'],
  proximo: ['Próximo', 'O passo mais útil agora.', 'Toque para ir até ele.'],
  agora: ['Agora', 'A bússola: o próximo passo até a apresentação ao Conselho.', 'Toque para ir até ele.'],
  vaga: ['Espaço de produção', 'Um lote por espaço; pronto, vai sozinho para o Almoxarifado.', 'Novo espaço custa créditos; o Mutirão adianta o tempo.'],
};

export class Hud {
  constructor(raiz, J) {
    this.J = J; this.raiz = raiz;
    this.topo = el('div', 'topo');
    this.topo.innerHTML = `
      <div class="nivel" data-a="nivel" role="button" aria-label="Nível 1"><i class="anel"></i>${img('nivel', 'selo')}<b class="nv">1</b><small class="xp">0/40</small></div>
      <div class="stat pop" data-a="pop" role="button" aria-label="Moradores e renda por hora">${img('pop')}<span class="pp">0</span><small class="ph">+0/h</small></div>
      <div class="stat bem" data-a="bem" role="button" aria-label="Bem-estar">${img('bem-medio')}<span class="bb">35%</span></div>
      <div class="stat vida" data-a="vida" role="button" aria-label="Composição concluída"><i class="anel-vida" style="--p:0%">${img('vida')}</i><span class="vv">0%</span></div>
      <div class="stat cal" data-a="calendario" role="button" aria-label="Calendário: dia 1, mês 1, ano 1"><i class="anel-dia" style="--p:0%">${img('calendario')}</i><span class="cd"><b class="longo">Dia 1 · Mês 1 · Ano 1</b><b class="curto">1/1 · A1</b></span></div>
      <div class="esp"></div>
      <div class="stat creditos" data-a="creditos" role="button" aria-label="Créditos">${img('creditos')}<span class="cc">0</span><button class="mais" data-a="deposito" aria-label="Trocas: comprar matéria-prima e vender produtos">${img('troca')}</button></div>
      <div class="stat mutirao" data-a="mutirao" role="button" aria-label="Mutirão e disposição">${img('mutirao')}<span class="mm">0/3</span><div class="disp"><i></i></div><span class="ac oculto" aria-label="Aceleradores">${img('acelerar')}<b>0</b></span></div>
      <button class="redondo" data-a="apreciar" aria-label="Apreciar a cidade">${img('apreciar')}</button>
      <button class="redondo" data-a="config" aria-label="Configurações">${img('config')}</button>`;
    // embaixo à esquerda: medalha do capítulo (com o selo "Conselho aguarda"), metas (cartão acima dela) e a linha "Agora"
    this.esq = el('div', 'esq');
    this.cap = el('button', 'cap'); this.cap.dataset.a = 'capmin'; this.cap.setAttribute('aria-expanded', 'false');
    this.cap.innerHTML = `<span class="medalha">${img('trofeu')}<b class="c">1</b></span><span class="prog">0/0</span><i class="selo-cons oculto" aria-label="O Conselho aguarda a apresentação">1</i>`;
    this.metas = el('div', 'cartao metas oculto');
    this.feita = el('div', 'cartao meta-feita oculto');
    // "Agora": uma pílula clara (toque em qualquer ponto leva à ação), com o ícone da ação e o botão verde
    this.agora = el('button', 'agora oculto'); this.agora.dataset.a = 'agora'; this.agora.innerHTML = '<img class="ico" alt="" draggable="false"><span class="tx"><b>Agora</b><span class="t"></span></span><i class="ir" aria-hidden="true">Ir</i>';
    this.esq.append(this.cap, this.metas, this.feita, this.agora);
    // faixa inferior: a fala do conselho (balão com retrato); brindes no canto superior direito, filhos da raiz
    this.doca = el('div', 'doca');
    this.fala = el('div', 'fala-dock oculto'); this.fala.setAttribute('role', 'status');
    this.doca.append(this.fala);
    this.brindes = el('div', 'brindes');
    // coluna direita de botões-ícone (halo e rótulo em mini pílula) e o capacete de Obras embaixo
    this.dir = el('div', 'dir');
    const bts = [['producao', 'producao', 'Produção', 'Produção'], ['almox', 'almox', 'Estoque', 'Almoxarifado'], ['pedidos', 'pedidos', 'Pedidos', 'Pedidos da comunidade'], ['trocas', 'troca', 'Trocas', 'Depósito de Trocas']];
    this.dir.innerHTML = bts.map(([a, i, t, l]) => `<button class="bt" data-a="${a}" aria-label="${l}">${img(i)}${img('cadeado', 'cad')}<span>${t}</span></button>`).join('');
    this.obrasBt = el('button', 'obras-bt'); this.obrasBt.dataset.a = 'obras'; this.obrasBt.setAttribute('aria-label', 'Obras'); this.obrasBt.innerHTML = `${img('obras')}<span>Obras</span>`;
    this.prox = el('button', 'proximo oculto'); this.prox.dataset.a = 'proximo'; this.prox.innerHTML = `${img('subir')}<span><small>Próximo</small><b>Ir</b></span>`;
    this.guiaEl = el('div', 'guia oculto passa');
    raiz.append(this.topo, this.esq, this.doca, this.brindes, this.dir, this.obrasBt, this.prox, this.guiaEl);
    this.filaFalas = []; this._falaAtual = null; this._falaResta = 0; this._falaT = 0; this._revela = 0; this._tRecolhe = 0;
    // toque na fala: Pular sai da fala e do grupo; a revelação em andamento completa; recolhida abre; o chip (folha
    // aberta) expande; aberta e já lida, avança
    this.fala.addEventListener('click', (e) => {
      e.stopPropagation(); if (e.target.closest('.pular')) { this._pularFala(true); return; }
      if (this._revela) { this._fimRevela(); return; }
      if (this.fala.classList.contains('recolhida')) { this._recolher(false); return; }
      if (this.raiz.classList.contains('painel-aberto') && !this.fala.classList.contains('aberta')) { this.fala.classList.add('aberta'); this._armarRecolhe(); return; }
      this._pularFala(false);
    });
    // toques que o controlador não conhece (calendário e renda dos moradores): tratados aqui quando alguém liga
    // aoCalendario / aoPop (extras.js); sem eles, o toque segue o caminho de sempre (abre o Escritório)
    this.aoCalendario = null; this.aoPop = null;
    this.topo.addEventListener('click', (e) => { if (this.longoRecente()) { e.stopPropagation(); return; } const b = e.target.closest('[data-a="calendario"],[data-a="pop"]'); if (!b) return; const fn = b.dataset.a === 'calendario' ? this.aoCalendario : this.aoPop; if (!fn) return; e.stopPropagation(); fn(b); });
    // cartão de metas: tocar ou rolar dentro dele desarma o fechamento automático (fecha no toque fora ou na medalha)
    const desarmar = () => { if (this.metasAbertas) clearTimeout(this._metasT); }; this.metas.addEventListener('pointerdown', desarmar); this.metas.addEventListener('scroll', desarmar, { passive: true });
    // números: valor mostrado separado do real (o que está voando fica retido) e contagem de 480 ms
    this.ret = { creditos: 0, xp: 0 }; this.mostra = { creditos: null, xp: null }; this._an = {}; this._raf = 0; this._passo = (t) => this._contagem(t);
    this._pool = []; this._metasT = 0; this._visivel = true; this._rects = []; this._tRects = 0; this._dirVis = {};
    this.J0 = null; this.vibra = null; this.premioCap = null; this.capituloPronto = null; this._longoAte = 0;
    this._toqueLongo(); addEventListener('resize', () => this._larguras());
  }
  get S() { return this.J.S; }
  // botão do HUD pelo data-a: coluna direita, Obras ou barra de cima (só os visíveis; os trancados contam)
  botao(a) { return this.dir.querySelector(`[data-a="${a}"]:not(.oculto)`) || (a === 'obras' ? this.obrasBt : null) || this.topo.querySelector(`[data-a="${a}"]:not(.oculto)`); }
  // ------------------------------------------------ toque longo (500 ms) em qualquer controle: cartão de duas linhas
  _toqueLongo() {
    let t = 0, x0 = 0, y0 = 0, alvo = null;
    const cancela = () => { clearTimeout(t); t = 0; alvo = null; };
    this.raiz.addEventListener('pointerdown', (e) => {
      const a = e.target.closest('.stat,.nivel,.redondo,.bt,.obras-bt,.cap,.proximo,.agora,.vaga'); if (!a || e.target.closest('.metas,.info-pop')) return;
      cancela(); alvo = a; x0 = e.clientX; y0 = e.clientY;
      t = setTimeout(() => { t = 0; const el0 = alvo; alvo = null; if (!el0) return; this._longoAte = performance.now() + 900; this.vibra?.tique?.(); this._infoLongo(el0); }, 500);
    }, { passive: true });
    this.raiz.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancela(); }, { passive: true });
    this.raiz.addEventListener('pointerup', cancela, { passive: true }); this.raiz.addEventListener('pointercancel', cancela, { passive: true });
  }
  // o clique que vem logo depois de um toque longo não deve abrir nada (o controlador e os painéis consultam isto)
  longoRecente() { return performance.now() < this._longoAte; }
  _infoLongo(e) {
    const a = e.classList.contains('vaga') ? 'vaga' : e.dataset.a; const I = INFO[a]; if (!I) return; const S = this.S; let extra = '';
    if (a === 'nivel') { const n = S.nivel, prox = XP_NIVEL[n + 1]; extra = prox ? `<ul><li><b>${fmt(Math.max(0, prox - S.xp))} XP</b>para o nível ${n + 1}: +${fmt(premioNivel(n + 1))} créditos</li></ul>` : ''; }
    else if (a === 'creditos') extra = `<ul><li><b>${fmt(S.creditos)}</b>em caixa</li></ul>`;
    else if (a === 'mutirao') extra = `<ul><li><b>${S.mutirao}/${REGRAS.fichasMax}</b>fichas · disposição ${Math.round(S.disposicao || 0)}/100</li></ul>`;
    // com a janela de clique fechada, o toque longo só informa: quem chega aqui pelo clique curto segue o caminho normal
    const come = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; window.addEventListener('click', come, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', come, { capture: true }), 800);
    this.info(e, `<h4>${I[0]}</h4><p>${I[1]}</p>${extra}<small>${I[2]}</small>`, 5000);
  }
  // ------------------------------------------------ barra superior
  atualizar() {
    const J = this.J, S = J.S; const q = (s) => this.topo.querySelector(s);
    const vida = J.vida(); q('.vv').textContent = pct(vida); q('.anel-vida').style.setProperty('--p', clamp(vida, 0, 100).toFixed(1) + '%');
    q('.pp').textContent = fmt(J.pop); q('.bb').textContent = J.bem + '%';
    const cb = carinha(J.bem); if (cb !== this._carinha) { this._carinha = cb; q('.bem img').src = icone(cb); }
    q('.mm').textContent = `${S.mutirao}/${REGRAS.fichasMax}`; q('.disp i').style.transform = `scaleX(${(clamp(S.disposicao || 0, 0, 100) / 100).toFixed(3)})`;
    this._contar('creditos', Math.max(0, S.creditos - this.ret.creditos));
    this._contar('xp', Math.max(0, S.xp - this.ret.xp));
    // calendário: texto por dia e o anel do dia (20 s); na virada, o anel volta a zero sem transição
    const cal = calendarioDe(J); const ce = q('.cal'); const an = ce.querySelector('.anel-dia');
    if (cal.dia !== this._calDia) { this._calDia = cal.dia; ce.querySelector('.longo').textContent = `Dia ${cal.diaDoMes} · Mês ${cal.mes} · Ano ${cal.ano}`; ce.querySelector('.curto').textContent = `${cal.diaDoMes}/${cal.mes} · A${cal.ano}`; ce.setAttribute('aria-label', `Calendário: dia ${cal.diaDoMes}, mês ${cal.mes}, ano ${cal.ano}`); }
    if (cal.progDia < (this._calP ?? 0)) { an.classList.add('semtr'); an.style.setProperty('--p', '0%'); void an.offsetWidth; an.classList.remove('semtr'); } this._calP = cal.progDia;
    an.style.setProperty('--p', (cal.progDia * 100).toFixed(0) + '%');
    // renda dos moradores por hora e o contador de aceleradores (só quando a simulação os tem)
    const rh = rendaHoraDe(J); if (rh !== this._rh) { this._rh = rh; q('.ph').textContent = '+' + fmt(rh) + '/h'; }
    const ac = S.aceleradores; const ae = q('.ac');
    if (ac) { const n = (ac.obra || 0) + (ac.producao || 0); ae.classList.remove('oculto'); if (n !== this._acN) { this._acN = n; ae.querySelector('b').textContent = n; ae.setAttribute('aria-label', `Aceleradores: ${ac.obra || 0} de obra e ${ac.producao || 0} de produção`); this._tRects = 0; } } else if (!ae.classList.contains('oculto')) { ae.classList.add('oculto'); this._tRects = 0; }
    // trilho: Pedidos e Trocas ficam no lugar, trancados até o capítulo em que abrem
    this._bt('pedidos', S.cap >= REGRAS.capPedidos); this._bt('trocas', S.cap >= ABRE.trocasCap);
  }
  _bt(a, on) { const b = this.dir.querySelector(`[data-a="${a}"]`); if (!b) return; const era = this._dirVis[a]; if (era === on) return; this._dirVis[a] = on; b.classList.toggle('trancado', !on); b.setAttribute('aria-disabled', on ? 'false' : 'true'); if (on && era === false) this.pulsa(b); this._tRects = 0; }
  trancado(a) { return this._dirVis[a] === false; }
  _txt(k, v) {
    if (k === 'creditos') { this.topo.querySelector('.cc').textContent = fmt(Math.round(v)); return; }
    const S = this.S; const xp = Math.round(v); const n = nivelDe(xp, S.nivel); const a = XP_NIVEL[n] || 0, b = XP_NIVEL[n + 1] || a + 1;
    const p = clamp((xp - a) / (b - a), 0, 1); const an = this.topo.querySelector('.anel'); const nv = this.topo.querySelector('.nivel');
    if (this._nv !== n) { const sobe = this._nv != null && n > this._nv; this._nv = n; an.classList.add('semtr'); an.style.setProperty('--p', (sobe ? 0 : p * 100).toFixed(1) + '%'); void an.offsetWidth; an.classList.remove('semtr'); nv.querySelector('.nv').textContent = n; if (sobe) this.pulsa(nv); }
    an.style.setProperty('--p', (p * 100).toFixed(1) + '%'); nv.querySelector('.xp').textContent = fmt(Math.max(0, xp - a)) + '/' + fmt(b - a);
    nv.setAttribute('aria-label', `Nível ${n}: ${fmt(Math.max(0, xp - a))} de ${fmt(b - a)} de experiência`);
  }
  _contar(k, alvo) {
    if (this.mostra[k] == null) { this.mostra[k] = alvo; this._txt(k, alvo); return; }
    const a = this._an[k]; if ((a ? a.para : this.mostra[k]) === alvo) return;
    const de = this.mostra[k]; this._an[k] = { de, para: alvo, t0: performance.now() };
    // créditos: vermelho breve ao gastar, latão claro por 500 ms ao receber
    if (k === 'creditos') { const e = this.topo.querySelector('[data-a="creditos"]'); const cls = alvo < de ? 'gasto' : 'ganho'; e.classList.remove('gasto', 'ganho'); void e.offsetWidth; e.classList.add(cls); clearTimeout(this._tGasto); this._tGasto = setTimeout(() => e.classList.remove(cls), cls === 'gasto' ? 300 : 500); }
    if (!this._raf) this._raf = requestAnimationFrame(this._passo);
  }
  _contagem(t) {
    this._raf = 0; let vivo = false;
    for (const [k, a] of Object.entries(this._an)) { if (!a) continue; const u = clamp((t - a.t0) / 480, 0, 1); const v = a.de + (a.para - a.de) * easeOutCubic(u); this.mostra[k] = v; this._txt(k, v); if (u < 1) vivo = true; else this._an[k] = null; }
    if (vivo) this._raf = requestAnimationFrame(this._passo);
  }
  // valor voando para o HUD: o número só muda na chegada (soltar)
  reter(k, v) { if (!(v > 0)) return; this.ret[k] += v; this.atualizar(); }
  soltar(k, v) { this.ret[k] = Math.max(0, this.ret[k] - (v == null ? this.ret[k] : v)); this.atualizar(); }
  // ------------------------------------------------ capítulo: medalha, metas e Meta em foco
  capitulo() {
    const J = this.J, c = J.capitulo(); if (!c) { this.cap.classList.add('oculto'); this.metas.classList.add('oculto'); return; }
    this.cap.classList.remove('oculto'); const feitas = c.metas.filter((m) => J.metaFeita(m)).length;
    const h = c.n + '|' + feitas + '|' + c.metas.length;
    if (h !== this._capH) {
      this._capH = h; this.cap.querySelector('.c').textContent = c.n; this.cap.querySelector('.prog').textContent = `${feitas}/${c.metas.length}`;
      this.cap.classList.toggle('completo', feitas === c.metas.length); this.cap.setAttribute('aria-label', `Capítulo ${c.n}, ${c.nome}: ${feitas} de ${c.metas.length} metas`);
    }
    // meta cumprida: pulso verde e a meta por 2,5 s
    const ok = c.metas.map((m) => J.metaFeita(m)); const antes = this._metasOk;
    if (antes && antes.cap === c.n) ok.forEach((v, i) => { if (v && !antes.v[i]) this._metaCumprida(c.metas[i]); });
    this._metasOk = { cap: c.n, v: ok };
    if (!this.metas.classList.contains('oculto')) this._htmlMetas();
  }
  // cartão de metas em uma coluna: cabeçalho noite, metas com contador, linha do próximo nível (toque no selo) e o
  // rodapé com o prêmio do capítulo ou o botão "Apresentar ao Conselho" quando tudo está cumprido
  _htmlMetas() {
    const J = this.J, S = J.S, c = J.capitulo(); if (!c) return;
    const feitas = c.metas.filter((m) => J.metaFeita(m)).length; const pk = c.n + '|' + feitas;
    if (pk !== this._premioK) { this._premioK = pk; this._premio = this.premioCap ? this.premioCap() : null; }
    const pr = this._premio; const pronto = !!this.capituloPronto?.();
    const nv = this._mostraNivel && XP_NIVEL[S.nivel + 1] ? `<div class="meta nivel-prox"><i>${img('xp')}</i><span>Nível ${S.nivel + 1} em ${fmt(Math.max(0, XP_NIVEL[S.nivel + 1] - S.xp))} XP</span><small>+${fmt(premioNivel(S.nivel + 1))}</small></div>` : '';
    const rodape = pronto ? `<button class="botao apresentar" data-a="conselho">${img('sede')}Apresentar ao Conselho</button>`
      : `<div class="premio-cap" aria-label="Prêmio do capítulo: ${pr ? fmt(pr.creditos) + ' créditos e ' + pr.fichas + ' ficha(s) de Mutirão' : 'créditos e ficha de Mutirão'}"><span>Prêmio do capítulo</span>${img('creditos')}<b>${pr && pr.creditos > 0 ? '+' + fmt(pr.creditos) : ''}</b>${!pr || pr.fichas > 0 ? `${img('mutirao')}<b>${pr ? '+' + pr.fichas : ''}</b>` : ''}</div>`;
    const h = `<h3><small>Capítulo ${c.n}</small>${c.nome}</h3><div class="lm">${nv}${c.metas.map((m, i) => { const f = J.metaFeita(m); const p = J.metaProgresso?.(m); return `<button class="meta ${f ? 'ok' : ''} ${this._metaNova === i ? 'nova' : ''}" data-a="meta" data-i="${i}"><i></i><span>${m.txt}</span><small>${f ? '' : p?.txt || ''}</small></button>`; }).join('')}</div>${rodape}`;
    if (h !== this._metasH) { this._metasH = h; this.metas.innerHTML = h; }
  }
  // on: abre ou fecha; o.nivel: mostra a linha do próximo nível (toque no selo). Abrir recolhe a fala para o retrato.
  alternarMetas(on = this.metas.classList.contains('oculto'), o = {}) {
    clearTimeout(this._metasT); this._mostraNivel = !!(on && o.nivel); this.metas.classList.toggle('oculto', !on); this.raiz.classList.toggle('metas-on', on); this.cap.setAttribute('aria-expanded', on ? 'true' : 'false'); this.cap.classList.toggle('aberta', on); this._tRects = 0;
    if (on) { this.feita.classList.add('oculto'); this._metasH = null; this._htmlMetas(); this._armarMetas(); if (this._falaAtual && !this._revela) this._recolher(true); }
  }
  _armarMetas() { clearTimeout(this._metasT); this._metasT = setTimeout(() => this.alternarMetas(false), 12000); }
  get metasAbertas() { return !this.metas.classList.contains('oculto'); }
  _metaCumprida(m) {
    const c = this.cap; c.classList.remove('cumpriu'); void c.offsetWidth; c.classList.add('cumpriu'); setTimeout(() => c.classList.remove('cumpriu'), 700);
    if (this.metasAbertas) return;
    this.feita.innerHTML = `${img('check')}<span><small>Meta cumprida</small>${m.txt}</span>`; this.feita.classList.remove('oculto'); clearTimeout(this._feitaT); this._feitaT = setTimeout(() => this.feita.classList.add('oculto'), 2500);
  }
  // linha "Agora": plano = J.planoMeta() (ou null para esconder); ic = ícone da ação. O plano pode trazer rotulo
  // ("Passo 1 de 8", no tutorial) e feito (check verde por um instante antes de trocar). Pulsa quando o texto muda.
  meta(plano, ic) {
    if (!plano) { if (this._agoraTx != null) { this.agora.classList.add('oculto'); this.esq.classList.remove('com-agora'); this._agoraTx = null; this._tRects = 0; this._larguras(); } return; }
    const t = plano.texto || ''; const novo = this._agoraTx == null; if (novo) { this.agora.classList.remove('oculto'); this.esq.classList.add('com-agora'); this._tRects = 0; }
    if (t !== this._agoraTx) { this._agoraTx = t; this.agora.querySelector('.t').textContent = t; this.agora.setAttribute('aria-label', (plano.rotulo || 'Agora') + ': ' + t); if (!novo) { this.agora.classList.remove('troca'); void this.agora.offsetWidth; this.agora.classList.add('troca'); clearTimeout(this._tTroca); this._tTroca = setTimeout(() => this.agora.classList.remove('troca'), 300); } this._larguras(); }
    const r = plano.rotulo || 'Agora'; if (r !== this._agoraR) { this._agoraR = r; this.agora.querySelector('.tx b').textContent = r; }
    const k = plano.feito ? 'check' : ic || 'obras'; if (k !== this._agoraIc) { this._agoraIc = k; this.agora.querySelector('.ico').src = icone(k); }
    this.agora.classList.toggle('espera', plano.acao === 'aguardar'); this.agora.classList.toggle('feito', !!plano.feito);
  }
  // larguras que a fala precisa contornar: --esqW (medalha mais a Agora) e --dirW (capacete mais o Próximo)
  _larguras() {
    const ag = this.agora.classList.contains('oculto') ? 0 : this.agora.offsetWidth; const px = this.prox.classList.contains('oculto') || this.raiz.classList.contains('painel-aberto') ? 0 : this.prox.offsetWidth;
    const e = 82 + (ag ? ag + 10 : 0), d = 92 + (px ? px + 8 : 0);
    if (e !== this._esqW) { this._esqW = e; this.raiz.style.setProperty('--esqW', e + 'px'); } if (d !== this._dirW) { this._dirW = d; this.raiz.style.setProperty('--dirW', d + 'px'); }
  }
  conselho(on) { on = !!on; if (this._cons === on) return; this._cons = on; this.cap.querySelector('.selo-cons').classList.toggle('oculto', !on); this._tRects = 0; if (this.metasAbertas) { this._metasH = null; this._htmlMetas(); } }
  // ------------------------------------------------ conselheiro: fila de falas
  // o: número (ms, compatível) ou {ms, se: () => bool (a fala só vale enquanto for verdade), grupo}
  falar(quem, txt, o = {}) {
    if (typeof o === 'number') o = { ms: o }; const ms = o.ms || clamp(2600 + 50 * txt.length, 4500, 10000);
    this.filaFalas.push({ quem, txt, ms, se: o.se, grupo: o.grupo });
    // fila longa (muitas aprovações seguidas, volta do jogo fechado): as falas soltas mais antigas saem; tutorial e abertura ficam
    while (this.filaFalas.length > 4) { const i = this.filaFalas.findIndex((f) => !f.grupo); if (i < 0) break; this.filaFalas.splice(i, 1); }
    if (!this._falaAtual) this._proxFala();
  }
  _proxFala() {
    let f; while ((f = this.filaFalas.shift()) && f.se && !f.se());
    clearTimeout(this._revela); this._revela = 0; clearTimeout(this._tRecolhe);
    if (!f) { this._falaAtual = null; this.fala.classList.add('oculto'); this.fala.classList.remove('recolhida', 'aberta'); clearInterval(this._falaT); this._falaT = 0; this._tRects = 0; return; }
    this._falaAtual = f; this._falaResta = f.ms; this._falaUlt = performance.now(); const c = CONSELHO[f.quem] || CONSELHO.iris;
    this.fala.style.setProperty('--cor', c.cor);
    this.fala.innerHTML = `${retrato(f.quem, 'acena')}<div class="fala"><b>${c.nome} · ${c.cargo}</b><span></span></div><button class="pular" aria-label="Pular a fala">Pular</button>`;
    this.fala.classList.remove('oculto', 'recolhida', 'aberta', 'entra'); void this.fala.offsetWidth; this.fala.classList.add('entra'); this._tRects = 0;
    // revelação letra a letra (12 ms por caractere, no máximo 2,4 s); o relógio da fala só corre depois dela
    const sp = this.fala.querySelector('.fala span'); const txt = f.txt; const passo = Math.max(12, Math.floor(2400 / Math.max(1, txt.length))); let i = 0;
    const tique = () => { i = Math.min(txt.length, i + 1); sp.textContent = txt.slice(0, i); if (i < txt.length) this._revela = setTimeout(tique, passo); else { this._revela = 0; this._fimRevela(); } };
    this._revela = setTimeout(tique, passo);
    if (!this._falaT) this._falaT = setInterval(() => this._relogioFala(), 200);
  }
  _fimRevela() { clearTimeout(this._revela); this._revela = 0; const f = this._falaAtual; if (!f) return; const sp = this.fala.querySelector('.fala span'); if (sp) sp.textContent = f.txt; f.revelada = true; this._falaUlt = performance.now(); this._armarRecolhe(); }
  // 4 s depois da última interação a fala recolhe para o retrato (com um ponto azul); o relógio continua
  _armarRecolhe() { clearTimeout(this._tRecolhe); this._tRecolhe = setTimeout(() => { this._recolher(true); this.fala.classList.remove('aberta'); }, 4000); }
  _recolher(on) { if (!this._falaAtual) return; this.fala.classList.toggle('recolhida', on); this._tRects = 0; if (!on) this._armarRecolhe(); }
  _relogioFala() {
    const t = performance.now(), dt = t - this._falaUlt; this._falaUlt = t; const f = this._falaAtual; if (!f) return;
    if (f.se && !f.se()) { this._proxFala(); return; }
    if (!f.revelada || document.hidden || this.raiz.querySelector('.veu') || document.getElementById('carga')) return;
    this._falaResta -= dt; if (this._falaResta <= 0) this._proxFala();
  }
  _pularFala(tudo) { const g = this._falaAtual?.grupo; if (tudo && g) this.filaFalas = this.filaFalas.filter((f) => f.grupo !== g); this._proxFala(); }
  revalidarFalas() { const f = this._falaAtual; if (f?.se && !f.se()) this._proxFala(); }
  get falando() { return !!this._falaAtual; }
  // ------------------------------------------------ brindes no canto superior direito (até 2; o mais antigo vira secundário)
  brinde(txt, ic, ms = 2600) {
    const vivos = [...this.brindes.children].filter((x) => !x.classList.contains('sai')); while (vivos.length > 1) this._sairBrinde(vivos.shift());
    for (const v of vivos) v.classList.add('sec');
    const b = el('div', 'brinde', (ic ? img(ic) : '') + `<span>${txt}</span>`); b.style.setProperty('--i', vivos.length); this.brindes.appendChild(b);
    b._t = setTimeout(() => this._sairBrinde(b), ms); return b;
  }
  _sairBrinde(b) { if (!b || b.classList.contains('sai')) return; clearTimeout(b._t); b.classList.add('sai'); const fim = () => b.remove(); b.addEventListener('animationend', fim, { once: true }); setTimeout(fim, 260); }
  // popover de informação preso a um elemento do HUD, com a ponta apontando para ele (abaixo, ou acima se não couber)
  // aoClique(id, botão): um botão [data-i] dentro do popover (por exemplo "Abrir o Escritório")
  info(ancora, html, ms = 5000, aoClique = null) {
    this.fecharInfo(); const a = typeof ancora === 'string' ? this.topo.querySelector(ancora) : ancora; if (!a) return;
    const p = el('div', 'cartao info-pop', html); this.raiz.appendChild(p); const r = a.getBoundingClientRect(); const w = p.offsetWidth, h = p.offsetHeight;
    const cx = r.left + r.width / 2; const left = clamp(cx - w / 2, 8, innerWidth - w - 8); const acima = r.bottom + 12 + h > innerHeight - 8;
    p.style.left = left + 'px'; p.style.top = (acima ? Math.max(8, r.top - 12 - h) : r.bottom + 12) + 'px'; p.classList.toggle('acima', acima); p.style.setProperty('--px', clamp(cx - left, 16, w - 16).toFixed(0) + 'px');
    this._info = p; this._infoT = setTimeout(() => this.fecharInfo(), ms); p.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); this.fecharInfo(); if (b && aoClique) aoClique(b.dataset.i, b); });
  }
  fecharInfo() { clearTimeout(this._infoT); if (this._info) { this._info.remove(); this._info = null; } }
  // ------------------------------------------------ trilho, Obras, Próximo e guia
  ponto(botao, n) { const b = botao === 'obras' ? this.obrasBt : this.dir.querySelector(`[data-a="${botao}"]`); if (!b) return; let p = b.querySelector('.ponto'); b.classList.toggle('tem-ponto', !!n); if (!n) { p?.remove(); return; } if (!p) { p = el('i', 'ponto'); b.appendChild(p); } const t = n > 9 ? '9+' : String(n); if (p.textContent !== t) p.textContent = t; }
  // o = {icone, verbo, pulsa} ou null (null sempre que a Agora está visível com a folha fechada: uma chamada por vez)
  proximo(o) {
    const k = o ? o.icone + '|' + o.verbo + '|' + !!o.pulsa : ''; if (k === this._proxK) return; this._proxK = k;
    this.prox.classList.toggle('oculto', !o); this._tRects = 0; if (!o) { this._larguras(); return; }
    this.prox.innerHTML = `${img(o.icone || 'subir')}<span><small>Próximo</small><b>${o.verbo}</b></span>`; this.prox.classList.toggle('pulsa', !!o.pulsa); this.prox.setAttribute('aria-label', 'Próximo: ' + o.verbo); this._larguras();
  }
  // anel pulsante do tutorial sobre um ponto da tela (ou null); r = diâmetro do alvo (o anel fica 16 px maior)
  guia(x, y, r) {
    const g = this.guiaEl; if (x == null) { if (!g.classList.contains('oculto')) g.classList.add('oculto'); this._gx = null; return; }
    if (g.classList.contains('oculto')) g.classList.remove('oculto');
    const d = Math.round(clamp((r || 58) + 16, 60, 140)); if (d !== this._gd) { this._gd = d; g.style.setProperty('--d', d + 'px'); }
    if (this._gx == null || Math.abs(x - this._gx) > 0.5 || Math.abs(y - this._gy) > 0.5) { this._gx = x; this._gy = y; g.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  }
  // centro do destino de um voo: um botão do HUD pelo nome ou um elemento qualquer (um espaço de produção, por exemplo)
  alvoBotao(nome) {
    const b = nome instanceof Element ? nome : nome === 'xp' || nome === 'nivel' ? this.topo.querySelector('.anel') : this.botao(nome);
    if (!b || (!this._visivel && !(nome instanceof Element))) return [innerWidth - 40, innerHeight / 2, null]; const r = b.getBoundingClientRect(); if (!r.width) return [innerWidth - 40, innerHeight / 2, null]; return [r.left + r.width / 2, r.top + r.height / 2, b];
  }
  pulsa(e) { if (!e) return; e.classList.remove('pulsa-hud'); void e.offsetWidth; e.classList.add('pulsa-hud'); clearTimeout(e._pt); e._pt = setTimeout(() => e.classList.remove('pulsa-hud'), 260); }
  // retângulos do HUD visível (os balões por baixo ficam apagados e sem toque); relidos a cada 0,5 s. As pílulas
  // entram com o ícone que sai pela ponta esquerda; a fala recolhida conta só o retrato.
  retangulos(t) {
    if (t - this._tRects < 500 && this._rects.length) return this._rects; this._tRects = t; const R = this._rects; R.length = 0; if (!this._visivel) return R;
    const add = (e) => { if (!e || e.classList.contains('oculto')) return; const r = e.getBoundingClientRect(); if (r.width && r.height) R.push(r.left - 4, r.top - 4, r.right + 4, r.bottom + 4); };
    for (const e of this.topo.children) { if (e.classList.contains('esp')) continue; add(e); if (e.classList.contains('stat') && !e.classList.contains('oculto')) add(e.firstElementChild); }
    for (const e of this.esq.children) add(e); for (const e of this.dir.children) add(e); add(this.obrasBt); add(this.prox);
    if (!this.fala.classList.contains('oculto')) add(this.fala.classList.contains('recolhida') ? this.fala.querySelector('.retrato') : this.fala);
    return R;
  }
  // ------------------------------------------------ voo de ícones (explosão e sucção em arco até o destino)
  _img() { let v = this._pool.find((x) => !x._uso); if (!v && this._pool.length < 12) { v = el('img', 'voa'); v.alt = ''; v.draggable = false; document.body.appendChild(v); this._pool.push(v); } if (v) { v._uso = true; v.style.display = ''; v.style.opacity = ''; } return v; }
  // n ícones de 'ic' saindo de (x0, y0) até 'destino' (nome de botão do HUD ou elemento); cada chegada chama aoChegar(i, n)
  voar(ic, x0, y0, destino = 'almox', aoChegar, o = {}) {
    const n = Math.max(1, o.n || 1), vis = Math.min(8, n), passo = o.passo || 70; const src = icone(ic);
    for (let i = 0; i < vis; i++) setTimeout(() => {
      const v = this._img(); const ult = i === vis - 1;
      if (!v) { aoChegar?.(i, vis, ult); if (ult) this._chegou(destino); return; }
      if (v.getAttribute('src') !== src) v.src = src; v.style.transform = `translate(${(x0 - 19).toFixed(1)}px,${(y0 - 19).toFixed(1)}px) scale(.6)`;
      if (ult && n > vis) { v.dataset.mais = '+' + (n - vis); v.classList.add('mais'); } else v.classList.remove('mais');
      const [x1, y1] = this.alvoBotao(destino); const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 20; const xe = x0 + Math.cos(a) * r, ye = y0 + Math.sin(a) * r;
      const hold = 60 + Math.random() * 60, suc = 420 + Math.random() * 100; const t0 = performance.now(); const arco = 60 + Math.random() * 30;
      const step = (t) => {
        const tt = t - t0; let x, y, s;
        if (tt < 160) { const k = easeOutQuad(tt / 160); x = x0 + (xe - x0) * k; y = y0 + (ye - y0) * k; s = 0.6 + 0.7 * k; }
        else if (tt < 160 + hold) { x = xe; y = ye - (tt - 160) * 0.02; s = 1.3; }
        else { // curva quadrática com o ponto de controle acima do meio do trajeto
          const k = clamp((tt - 160 - hold) / suc, 0, 1), e = easeInCubic(k); const ys = ye - hold * 0.02; const xm = (xe + x1) / 2, ym = Math.min(ys, y1) - arco; const u = 1 - e;
          x = u * u * xe + 2 * u * e * xm + e * e * x1; y = u * u * ys + 2 * u * e * ym + e * e * y1; s = 1.3 - 0.8 * e; v.style.opacity = (1 - 0.3 * e).toFixed(2);
          if (k >= 1) { v._uso = false; v.style.display = 'none'; aoChegar?.(i, vis, ult); if (ult || i === 0) this._chegou(destino); return; } }
        v.style.transform = `translate(${(x - 19).toFixed(1)}px,${(y - 19).toFixed(1)}px) scale(${s.toFixed(3)})`; requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, i * passo);
  }
  // chegada: o destino dá um pulo; nos créditos e no nível, o número fica em latão claro por 500 ms
  _chegou(destino) { const [, , b] = this.alvoBotao(destino); this.pulsa(b); if (!b) return; const s = b.classList.contains('stat') ? b : b.closest('.stat, .nivel'); if (s) { s.classList.add('ganho'); clearTimeout(s._tg); s._tg = setTimeout(() => s.classList.remove('ganho'), 500); } }
  visivel(on) { this._visivel = on; for (const e of [this.topo, this.esq, this.dir, this.obrasBt, this.prox, this.doca]) e.classList.toggle('escondido', !on); if (!on) { this.guia(null); this.fecharInfo(); } this._tRects = 0; }
}
