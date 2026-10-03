// Cena 'camadas' (desenho do render 15.2; A10; X3a): a cidade sintética com uma camada ligada e os marcadores de aviso,
// a 1,1 km e 38 graus sobre o bairro de prova. ?camada= escolhe (zonas, agua, energia, bemEstar, servicos, recursos,
// valor; padrão zonas); ?vista=perto|aberta troca a câmera; ?avisos=muitos põe 3 mil avisos (o teto do perfil corta).
// Os dados são de prova (camadaSintetica, no formato de q.camada) e passam pelo mesmo caminho da interface: paraRender
// e o atlas da UI. Com ?ui=1, a cena registra as camadas e os avisos de prova na simulação e liga a camada pela loja:
// a legenda, o popover e o filtro são os do jogo.
// O resultado diz o que ficou ligado, os marcadores desenhados contra o teto e o quadro.
import { paraRender, ZONAS_POR_VALOR, RECURSOS_POR_VALOR, REDE_POR_VALOR } from '../../ui/mundo/camadas.js';
import { escolherAvisos, GLIFOS_PADRAO as NOMES } from '../../ui/mundo/marcadores.js';
import { desenharAtlas } from '../../ui/glifos/atlas.js';
import { GRAVIDADE } from '../../contratos/flags.js';

/** Vista da cena: o bairro de prova da cidade sintética (o mesmo centro da cena bairro), de mais longe. */
export const CAMERA_CAMADAS = Object.freeze({ x: -1000, z: -460, dist: 1100, guinada: 32, inclinacao: 38 });
/** ?vista=: perto (o bairro a 320 m, os prédios pintados de perto) e aberta (a cidade inteira a 3 km). */
export const VISTAS_CAMADAS = Object.freeze({ perto: { dist: 320, inclinacao: 34 }, aberta: { x: 60, z: 150, dist: 3000, guinada: 18, inclinacao: 35 } });
export const CAMADAS_CENA = Object.freeze(['zonas', 'agua', 'energia', 'bemEstar', 'servicos', 'recursos', 'valor']);

/**
 * Avisos de prova no formato de q.avisosPredios: pelos dados da camada de água (sem água e racionada), pelo nível
 * (abandono nos prédios velhos) e obras paradas; com `muitos`, um aviso em 3 mil prédios.
 */
export function avisosSinteticos(esp, { muitos = false } = {}) {
  const P = esp?.predios;
  if (!P?.n) return { versao: 1, idx: new Int32Array(0), glifo: new Uint8Array(0), gravidade: new Uint8Array(0), nomes: NOMES };
  const agua = camadaSintetica('agua', esp).dados;
  const idx = [];
  const glifo = [];
  const grav = [];
  const por = (i, nome, g) => {
    idx.push(i);
    glifo.push(NOMES.indexOf(nome));
    grav.push(GRAVIDADE[g]);
  };
  for (let i = 0; i < P.n; i++) {
    if (!P.viva[i]) continue;
    const r = ((Math.imul(i, 2654435761) >>> 0) % 1000) / 1000;
    if (muitos && idx.length < 3000 && r < 0.3) por(i, NOMES[1 + (i % (NOMES.length - 1))], r < 0.1 ? 'grave' : 'atencao');
    else if (agua[i] === 3 && r < 0.12) por(i, 'semAgua', 'grave');
    else if (r > 0.994) por(i, 'abandonado', 'grave');
    else if (r > 0.988) por(i, 'semMaterial', 'atencao');
    else if (r > 0.982) por(i, 'semTrabalhadores', 'atencao');
    else if (r > 0.978) por(i, 'semVia', 'grave');
  }
  return { versao: 1, idx: Int32Array.from(idx), glifo: Uint8Array.from(glifo), gravidade: Uint8Array.from(grav), nomes: NOMES };
}

/**
 * Dados de camada da cidade sintética (o substituto da simulação nas cenas e na vitrine), no formato de q.camada:
 * zonas pelas células, água e energia por bairro (atendido, racionado e sem), bem-estar pelo nível, serviços pela
 * distância a três "centros" de atendimento, recursos e valor pela distância do centro e da água. Determinístico.
 */
export function camadaSintetica(id, esp) {
  const P = esp?.predios;
  const C = esp?.celulas;
  const A = esp?.vias?.arestas;
  const h = (i, s) => {
    let x = Math.imul(i ^ s, 0x9e3779b1);
    x ^= x >>> 15;
    x = Math.imul(x, 0x85ebca6b);
    return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
  };
  const centros = [[-900, -700], [400, 300], [1300, -1200]];
  const atend = (x, z) => Math.max(...centros.map(([cx, cz]) => Math.max(0, 1 - Math.hypot(x - cx, z - cz) / 1500)));
  const base = { id, grade: null, categorias: null, legenda: [], resumo: { chave: 'x3.legenda.sintetica', params: {} }, versao: 1 };
  if (id === 'zonas' && C) {
    const dados = new Float32Array(C.n);
    for (let c = 0; c < C.n; c++) if (C.viva[c]) dados[c] = C.zona[c];
    const cats = ZONAS_POR_VALOR.map((z, v) => ({ v, chave: v ? `zona.${z}` : 'zona.nenhuma' })).filter((c) => c.v && c.v !== 3 && c.v !== 5 && c.v !== 6);
    return { ...base, fonte: 'celulas', dados, tipo: 'cat', escala: { min: 0, max: 7, unidade: '' }, categorias: cats, legenda: cats };
  }
  if ((id === 'agua' || id === 'energia') && P) {
    const dados = new Float32Array(P.n);
    for (let i = 0; i < P.n; i++) {
      if (!P.viva[i]) continue;
      // por quadra de 300 m: a maior parte atendida, umas racionadas e umas sem (as da ponta da rede)
      const q = h(Math.floor(P.x[i] / 300) * 7919 + Math.floor(P.z[i] / 300), id === 'agua' ? 7 : 11);
      const a = q + 0.35 * atend(P.x[i], P.z[i]) + 0.12 * (h(i, 5) - 0.5);
      dados[i] = a > 0.62 ? 1 : a > 0.42 ? 2 : 3;
      if (h(i, 3) < 0.004) dados[i] = 4;
    }
    const cats = [1, 2, 3, 4].map((v) => ({ v, chave: `camada.${id}.${REDE_POR_VALOR[v]}` }));
    return { ...base, fonte: 'predios', dados, tipo: 'cat', escala: { min: 0, max: 4, unidade: id === 'agua' ? 'm³/h' : 'kW' }, categorias: cats, legenda: cats };
  }
  if (id === 'bemEstar' && P) {
    const dados = new Float32Array(P.n).fill(-1);
    for (let i = 0; i < P.n; i++) if (P.viva[i] && P.zona[i] >= 1 && P.zona[i] <= 3) dados[i] = Math.min(100, 20 + 60 * atend(P.x[i], P.z[i]) + 8 * P.nivel[i] * h(i, 5));
    return { ...base, fonte: 'predios', dados, tipo: 'seq', escala: { min: 0, max: 100, meio: 60, unidade: '' }, legenda: [{ v: 30, chave: 'camada.bemEstar.faixa5' }, { v: 60, chave: 'camada.bemEstar.faixa8' }, { v: 100, chave: 'camada.bemEstar.faixa11' }] };
  }
  if (id === 'servicos' && A) {
    const dados = new Float32Array(A.n);
    for (let e = 0; e < A.n; e++) {
      if (!A.viva[e]) continue;
      const x = (A.p[8 * e] + A.p[8 * e + 6]) / 2;
      const z = (A.p[8 * e + 1] + A.p[8 * e + 7]) / 2;
      // a cobertura cai do centro de atendimento para a borda do bairro, com ruas melhores e piores
      const raio = Math.hypot(x + 700, z + 820) / 1300;
      dados[e] = Math.min(1, Math.max(0, 1.15 - raio + 0.3 * (h(e, 23) - 0.5)));
    }
    return { ...base, fonte: 'arestas', dados, tipo: 'seq', escala: { min: 0, max: 1, unidade: '%' }, legenda: [{ v: 0, chave: 'camada.servicos.sem' }, { v: 1, chave: 'camada.servicos.completo' }] };
  }
  if (id === 'valor' || id === 'recursos') {
    const n = 256;
    const passo = 32;
    const origem = [-4096 + passo / 2, -4096 + passo / 2];
    const dados = new Float32Array(n * n);
    const categoria = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = origem[0] + i * passo;
        const z = origem[1] + j * passo;
        const k = j * n + i;
        // o valor sobe para o centro antigo e para a orla, com o grão de cada célula de 32 m
        if (id === 'valor') dados[k] = Math.round(120 + 1050 * Math.max(0, 1 - Math.hypot(x + 700, z + 900) / 1600) ** 1.4 + 90 * h(k, 9));
        else {
          const r = h(Math.floor(x / 400) * 131 + Math.floor(z / 400), 13);
          categoria[k] = r < 0.55 ? 0 : 1 + Math.floor(((r - 0.55) / 0.45) * 6);
          dados[k] = categoria[k] ? 0.5 + 0.5 * h(k, 17) : 0;
        }
      }
    }
    if (id === 'valor') {
      return { ...base, fonte: 'grade', dados, grade: { n, passo, origem }, tipo: 'seq', escala: { min: 0, max: 1200, unidade: '' }, legenda: [{ v: 0, chave: 'camada.valor.baixo' }, { v: 600, chave: 'camada.valor.nivel5' }, { v: 1200, chave: 'camada.valor.alto' }] };
    }
    const legenda = RECURSOS_POR_VALOR.slice(1).map((r, k) => ({ v: k + 1, chave: `recurso.${r}` }));
    return { ...base, fonte: 'grade', dados, categoria, grade: { n, passo, origem }, tipo: 'seq', escala: { min: 0, max: 1, unidade: '' }, categorias: legenda, legenda };
  }
  return null;
}

/** Com ?ui=1: as camadas e os avisos de prova entram na simulação (só os que ninguém registrou) e a loja liga a camada. */
function ligarPelaInterface(held, id, avisos) {
  const sim = held.sim;
  for (const c of CAMADAS_CENA) if (!sim.camadas?.obter?.(c)) sim.camadas?.registrar?.(c, (s) => camadaSintetica(c, s.espelho));
  if (!sim.q?.avisosPredios) sim.registrarConsulta?.('avisosPredios', () => avisos);
  held.ui.ui.loja.camada.value = id;
}

export function registrar(registrarCena) {
  registrarCena('camadas', {
    sim: 'sintetica',
    hora: 11,
    camera: CAMERA_CAMADAS,
    async montar(ctx) {
      const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
      const id = CAMADAS_CENA.includes(qs.get('camada')) ? qs.get('camada') : 'zonas';
      const vista = VISTAS_CAMADAS[qs.get('vista')];
      if (vista) ctx.cameraApi.definir({ ...CAMERA_CAMADAS, ...vista });
      const esp = ctx.sim.espelho;
      const falhas = [];
      const dom = ctx.dominio('predios');
      if (dom?.preparar) {
        try {
          await dom.preparar({ teto: 220000 });
        } catch (e) {
          falhas.push(`preparar falhou: ${e?.message ?? e}`);
        }
      }
      // o desenho dos marcadores vem sob demanda: a cena espera por ele para o resultado contar o que desenhou
      await ctx.dominio('marcadores')?.carregado?.();
      const dados = camadaSintetica(id, esp);
      if (!dados) falhas.push(`sem dados de prova para a camada ${id}`);
      const pedido = paraRender(dados, { predios: esp.predios, celulas: esp.celulas });
      ctx.emitir('camadas', pedido);
      const avisos = avisosSinteticos(esp, { muitos: qs.get('avisos') === 'muitos' });
      if (typeof document !== 'undefined') {
        const { canvas, mapa } = desenharAtlas();
        ctx.emitir('marcadores.atlas', { canvas, mapa });
      }
      // com a camada ligada, só os avisos dela (a mesma regra da interface); ?avisos=todos mostra todos
      ctx.emitir('marcadores', escolherAvisos(avisos, { camada: qs.get('avisos') ? null : id }));
      let comUI = false;
      return {
        quadro() {
          if (comUI || typeof window === 'undefined') return;
          const held = window.__held;
          if (!held?.ui || !held.sim) return;
          comUI = true;
          ligarPelaInterface(held, id, avisos);
        },
        resultado() {
          const f = [...falhas];
          const cam = ctx.dominio('camadas')?.estado?.() ?? null;
          const marc = ctx.dominio('marcadores')?.medidas?.() ?? null;
          if (!cam?.ligada) f.push('a camada não ligou no render');
          if (marc && marc.mostrados > marc.teto) f.push(`marcadores acima do teto (${marc.mostrados} de ${marc.teto})`);
          const s = ctx.stats;
          return { ok: f.length === 0, falhas: f, camada: id, fonte: pedido?.fonte, cores: pedido?.cores?.length ?? 0, render: cam, marcadores: marc, avisos: avisos.idx.length, quadro: { calls: s.calls, tris: s.tris, resto: s.familias.resto, instancias: s.instancias.marcadores } };
        },
      };
    },
  });
}
