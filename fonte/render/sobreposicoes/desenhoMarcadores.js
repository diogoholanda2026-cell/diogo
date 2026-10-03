// Marcadores de aviso sobre os prédios (D28; desenho do render 11.3; desenho da UI 6.3 e 8.9; X3a): as notificações
// do CS2. Placas viradas para a câmera no vértice, numa chamada só (geometria instanciada), com o tamanho fixo em pixels
// de tela, a forma pela gravidade (losango grave, triângulo atenção, círculo informação, círculo de aro duplo da
// Holding: a cor nunca carrega o sentido sozinha) e o glifo do atlas que a UI desenha (ui/glifos/atlas.js). Oclusão
// pela profundidade: um marcador atrás de uma torre some. Teto por perfil (200 no PC e no Alta, 60 no Média, 30 no
// Leve), os mais importantes e mais perto primeiro; de longe, um marcador por setor de 256 m com o número de avisos.
//
// Avisos ouvidos: 'marcadores.atlas' { canvas, mapa: { nome: célula } } (células de 64 px num canvas de 512) e
// 'marcadores' [{ idx, glifo, gravidade, prioridade }] (a UI escolhe O QUE mostrar, ui/mundo/marcadores.js; aqui se
// escolhe QUAIS cabem). Este é o desenho, que vem sob demanda (A1) na criação do domínio; o registro e a seleção (um
// marcador a até 22 px do toque ganha de tudo o que está atrás dele, D40) ficam em marcadores.js.
import * as THREE from 'three';
import { porPerfil } from '../motor/perfis.js';
import { refDe } from '../../contratos/espelho.js';

/** Números dos marcadores (perfis pela tabela; o 'pc' herda o Alta). */
export const MARC = Object.freeze({
  teto: Object.freeze({ ultra: 200, alta: 200, media: 60, leve: 30 }),
  // além desta distância da câmera (m), os avisos de um setor viram um marcador só, com a contagem
  longe: Object.freeze({ ultra: 1600, alta: 1400, media: 1000, leve: 800 }),
  setor: 256,
  tamPx: 30, // lado do marcador em px de tela (CSS)
  tamGrupoPx: 34,
  acima: 5, // m acima do topo do prédio
  toquePx: 22,
  refazerMs: 200,
  topoMs: 3000, // validade da altura do topo guardada
  perto: 0.985, // o marcador anda 1,5% da distância para a câmera (não briga com o telhado)
  grade: 8, // células por lado no atlas
});

/** Forma pela gravidade (índice no shader) e a ordem de importância (maior primeiro). */
export const FORMA = Object.freeze({ grave: 0, atencao: 1, info: 2, holding: 3 });
const PESO = Object.freeze([4, 3, 1, 2]); // por forma
const GRAVIDADES = ['info', 'atencao', 'grave']; // q.avisosPredios().gravidade (contratos/flags.js)

/** Cores do aro por forma (tokens da UI: --er, --al, --ac, --ch) e o vidro do fundo. */
export const CORES_MARC = Object.freeze({ aro: ['#ff7b6e', '#f2b14c', '#5ab0ff', '#d9bd84'], fundo: '#10151c' });

/** Gravidade (texto ou o número de q.avisosPredios) para o índice da forma. */
export function formaDe(g) {
  const nome = typeof g === 'number' ? GRAVIDADES[g] ?? 'info' : g;
  return FORMA[nome] ?? FORMA.info;
}

/**
 * Escolhe os marcadores que cabem (puro, para os testes). itens: [{ idx, x, y, z, celula, forma, prioridade }] com a
 * posição no chão; op: { cam: [x, y, z], teto, longe, setor, visivel(x, y, z) → bool }. Perto, um por prédio; além de
 * `longe`, um por setor (a forma do pior, a soma, a maior prioridade, o prédio mais importante para o toque). Devolve
 * até `teto`, na ordem prioridade, forma, distância: [{ idx, x, y, z, celula, forma, n, dist, prioridade }].
 */
export function escolherMarcadores(itens, { cam, teto, longe, setor = MARC.setor, visivel = () => true }) {
  const perto = [];
  const grupos = new Map();
  for (const it of itens) {
    const dist = Math.hypot(it.x - cam[0], it.y - cam[1], it.z - cam[2]);
    if (dist <= longe) {
      perto.push({ ...it, n: 1, dist });
      continue;
    }
    const chave = `${Math.floor(it.x / setor)},${Math.floor(it.z / setor)}`;
    let g = grupos.get(chave);
    if (!g) {
      g = { idx: it.idx, x: 0, y: 0, z: 0, celula: -1, forma: it.forma, n: 0, prioridade: it.prioridade, dist: 0, melhor: it };
      grupos.set(chave, g);
    }
    g.x += it.x;
    g.y += it.y;
    g.z += it.z;
    g.n++;
    if (PESO[it.forma] > PESO[g.forma]) g.forma = it.forma;
    if (it.prioridade > g.melhor.prioridade || (it.prioridade === g.melhor.prioridade && PESO[it.forma] > PESO[g.melhor.forma])) g.melhor = it;
    g.prioridade = Math.max(g.prioridade, it.prioridade);
  }
  const lista = perto.filter((m) => visivel(m.x, m.y, m.z));
  for (const g of grupos.values()) {
    g.x /= g.n;
    g.y /= g.n;
    g.z /= g.n;
    g.idx = g.melhor.idx;
    // um setor com um aviso só continua sendo o marcador do prédio (com o glifo)
    if (g.n === 1) {
      g.x = g.melhor.x;
      g.y = g.melhor.y;
      g.z = g.melhor.z;
      g.celula = g.melhor.celula;
    }
    delete g.melhor;
    g.dist = Math.hypot(g.x - cam[0], g.y - cam[1], g.z - cam[2]);
    if (visivel(g.x, g.y, g.z)) lista.push(g);
  }
  lista.sort((a, b) => b.prioridade - a.prioridade || PESO[b.forma] - PESO[a.forma] || a.dist - b.dist);
  return lista.slice(0, Math.max(0, teto));
}

// ------------------------------------------------------------------------------------------------ shader

/** Vértice: a placa no ponto, virada para a tela, com o lado em px e a ponta de baixo no ponto. */
export const VERT_MARC = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aDados;     // célula do glifo (-1: nenhum), forma, contagem (1: um prédio), lado em px
uniform vec2 gMarcTela;    // tamanho da vista em px
uniform float gMarcPerto;  // fração da distância que fica (puxa para a câmera)
varying vec2 vUV;
flat varying vec4 vDados;
void main() {
  vec4 v = viewMatrix * vec4( aPos, 1.0 );
  v.xyz *= gMarcPerto;
  vec4 c = projectionMatrix * v;
  vec2 px = position.xy * aDados.w + vec2( 0.0, 0.5 * aDados.w + 2.0 );
  c.xy += px * 2.0 / gMarcTela * c.w;
  gl_Position = c;
  vUV = position.xy + 0.5;
  vDados = aDados;
}
`;

/** Fragmento: forma por distância com sinal (borda filtrada por fwidth), aro na cor da gravidade, glifo ou contagem. */
export const FRAG_MARC = /* glsl */ `
uniform sampler2D gMarcAtlas;
uniform vec4 gMarcAtlasInfo;   // tem atlas, célula do '0', células por lado, livre
uniform vec3 gMarcAro[ 4 ];
uniform vec3 gMarcFundo;
uniform float gMarcExpo;       // 1 / exposição da composição (a cor fica a da interface)
varying vec2 vUV;
flat varying vec4 vDados;

float marcTriangulo( vec2 p, float r ) {
  const float k = 1.7320508;
  p.x = abs( p.x ) - r;
  p.y = p.y + r / k;
  if ( p.x + k * p.y > 0.0 ) p = vec2( p.x - k * p.y, - k * p.x - p.y ) / 2.0;
  p.x -= clamp( p.x, -2.0 * r, 0.0 );
  return - length( p ) * sign( p.y );
}
float marcForma( vec2 p, float f ) {
  if ( f < 0.5 ) return ( abs( p.x ) + abs( p.y ) - 0.94 ) * 0.7071;
  if ( f < 1.5 ) return marcTriangulo( p + vec2( 0.0, 0.24 ), 0.9 );
  return length( p ) - 0.86;
}
float marcCelula( vec2 q, float c ) {
  if ( q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 ) return 0.0;
  float n = gMarcAtlasInfo.z;
  vec2 cel = vec2( mod( c, n ), floor( c / n ) );
  return texture( gMarcAtlas, ( cel + vec2( q.x, 1.0 - q.y ) ) / n ).a;
}
void main() {
  vec2 p = vUV * 2.0 - 1.0;
  float f = vDados.y;
  float d = marcForma( p, f );
  float w = max( fwidth( d ), 1e-4 );
  float dentro = 1.0 - smoothstep( -w, w, d );
  float aro = 1.0 - smoothstep( -w, w, abs( d + 0.1 ) - 0.075 );
  if ( f > 2.5 ) aro = max( aro, 1.0 - smoothstep( -w, w, abs( d + 0.3 ) - 0.045 ) );
  float g = 0.0;
  if ( gMarcAtlasInfo.x > 0.5 ) {
    // o miolo: menor e mais baixo no triângulo
    float s = f > 0.5 && f < 1.5 ? 0.44 : 0.56;
    vec2 m = ( p - vec2( 0.0, f > 0.5 && f < 1.5 ? -0.14 : 0.0 ) ) / s * 0.5 + 0.5;
    if ( vDados.z > 1.5 ) {
      float n = min( vDados.z, 99.0 );
      float dez = floor( n / 10.0 );
      float um = n - 10.0 * dez;
      if ( dez > 0.5 ) {
        // dois algarismos lado a lado, um pouco menores e na proporção da fonte (espremidos pela metade, o 11 virava ||)
        vec2 q = ( m - 0.5 ) * 1.3 + 0.5;
        g = max( marcCelula( q + vec2( 0.24, 0.0 ), gMarcAtlasInfo.y + dez ), marcCelula( q - vec2( 0.24, 0.0 ), gMarcAtlasInfo.y + um ) );
      } else g = marcCelula( m, gMarcAtlasInfo.y + um );
    } else if ( vDados.x > -0.5 ) g = marcCelula( m, vDados.x );
  }
  vec3 cor = mix( gMarcFundo, vec3( 0.93, 0.95, 0.97 ), g );
  cor = mix( cor, gMarcAro[ int( f + 0.5 ) ], aro );
  float a = max( dentro * 0.94, aro );
  if ( a < 0.01 ) discard;
  gl_FragColor = vec4( cor * gMarcExpo, a );
}
`;

// ------------------------------------------------------------------------------------------------ domínio

/** O domínio dos marcadores (a casca de marcadores.js delega para ele). */
export function criarMarcadores(ctx) {
  const max = Math.max(...Object.values(MARC.teto));
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const aDados = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aDados.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aDados', aDados);
  geo.instanceCount = 0;
  const cor = (h) => new THREE.Color(h);
  const U = {
    gMarcTela: { value: new THREE.Vector2(1, 1) },
    gMarcPerto: { value: MARC.perto },
    gMarcAtlas: { value: null },
    gMarcAtlasInfo: { value: new THREE.Vector4(0, 0, MARC.grade, 0) },
    gMarcAro: { value: CORES_MARC.aro.map(cor) },
    gMarcFundo: { value: cor(CORES_MARC.fundo) },
    gMarcExpo: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT_MARC, fragmentShader: FRAG_MARC, transparent: true, depthWrite: false, depthTest: true });
  mat.name = 'marcador';
  const malha = ctx.medidas.familia(new THREE.Mesh(geo, mat), 'resto');
  malha.name = 'marcadores';
  malha.frustumCulled = false;
  malha.renderOrder = 40;
  malha.visible = false;
  malha.userData.faixa = 'perto';
  ctx.cena.add(malha);
  // aquecimento (D66): uma cópia visível da malha (fora da cena) para o programa compilar na carga, mesmo sem aviso à
  // vista; a casca (marcadores.js) a entrega ao aquecimento, que a registrou antes da primeira rodada
  const ensaio = new THREE.Mesh(geo, mat);

  let atlas = null; // { tex, mapa }
  let pedidos = []; // os da UI, já com a forma
  let mostrados = []; // os desenhados no último refazer (para a seleção)
  let sujo = true;
  let tRefeito = -Infinity;
  const camAnt = new THREE.Vector3(Infinity, 0, 0);
  const topos = new Map(); // idx → { y, t }
  const _v = new THREE.Vector3();

  function trocarAtlas(a) {
    atlas?.tex.dispose();
    atlas = null;
    U.gMarcAtlasInfo.value.x = 0;
    if (!a?.canvas) return;
    const tex = new THREE.CanvasTexture(a.canvas);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    atlas = { tex, mapa: a.mapa ?? {} };
    U.gMarcAtlas.value = tex;
    U.gMarcAtlasInfo.value.set(1, atlas.mapa['0'] ?? 0, MARC.grade, 0);
    sujo = true;
  }

  function trocarPedidos(lista) {
    pedidos = (Array.isArray(lista) ? lista : [])
      .filter((m) => Number.isInteger(m?.idx) && m.idx >= 0)
      .map((m) => ({ idx: m.idx, glifo: m.glifo ?? null, forma: formaDe(m.gravidade), prioridade: Number.isFinite(m.prioridade) ? m.prioridade : 0 }));
    sujo = true;
  }

  /** Cota do topo do prédio (a caixa do LOD1 da R4a ou do colocável da R5; sem ela, pela altura do nível). */
  function topo(P, i, t) {
    const c = topos.get(i);
    if (c && t - c.t < MARC.topoMs) return c.y;
    const cx = ctx.dominio('predios')?.caixaDoPredio?.(i) ?? ctx.dominio('colocaveis')?.caixa?.(i) ?? null;
    const y = P.y[i] + (cx ? Math.max(4, cx[5]) : 6 + 4 * (P.nivel?.[i] ?? 1));
    topos.set(i, { y, t });
    return y;
  }

  function telaVisivel(x, y, z) {
    _v.set(x, y, z).project(ctx.camera);
    return _v.z > -1 && _v.z < 1 && Math.abs(_v.x) < 1.08 && Math.abs(_v.y) < 1.08;
  }

  function refazer(t) {
    const P = ctx.sim.espelho.predios;
    if (topos.size > 8192) topos.clear();
    const cam = ctx.camera.position;
    const itens = [];
    if (P) {
      for (const m of pedidos) {
        if (m.idx >= P.n || !P.viva[m.idx]) continue;
        const celula = atlas && m.glifo != null && atlas.mapa[m.glifo] !== undefined ? atlas.mapa[m.glifo] : -1;
        itens.push({ idx: m.idx, x: P.x[m.idx], y: P.y[m.idx], z: P.z[m.idx], celula, forma: m.forma, prioridade: m.prioridade });
      }
    }
    const lista = escolherMarcadores(itens, {
      cam: [cam.x, cam.y, cam.z],
      teto: porPerfil(MARC.teto, ctx.perfil),
      longe: porPerfil(MARC.longe, ctx.perfil),
      visivel: telaVisivel,
    });
    for (let k = 0; k < lista.length; k++) {
      const m = lista[k];
      // o do prédio fica acima do topo; o do setor, acima da média das cotas
      m.y = m.n === 1 && P ? topo(P, m.idx, t) + MARC.acima : m.y + 40;
      m.ref = P ? refDe(m.idx, P.ger?.[m.idx] ?? 0) : null;
      aPos.array.set([m.x, m.y, m.z], 3 * k);
      aDados.array.set([m.celula, m.forma, m.n, m.n > 1 ? MARC.tamGrupoPx : MARC.tamPx], 4 * k);
    }
    aPos.clearUpdateRanges();
    aDados.clearUpdateRanges();
    aPos.needsUpdate = true;
    aDados.needsUpdate = true;
    geo.instanceCount = lista.length;
    malha.visible = lista.length > 0;
    mostrados = lista;
    ctx.stats.instancias.marcadores = lista.length;
    camAnt.copy(cam);
    tRefeito = t;
    sujo = false;
  }

  const soltar = [ctx.ouvir('marcadores.atlas', trocarAtlas), ctx.ouvir('marcadores', trocarPedidos)];
  if (ctx.sobre['marcadores.atlas']) trocarAtlas(ctx.sobre['marcadores.atlas']);
  if (ctx.sobre.marcadores) trocarPedidos(ctx.sobre.marcadores);

  return {
    nome: 'marcadores',
    quadro(tMs, c) {
      const el = c.canvas;
      U.gMarcTela.value.set(Math.max(1, el?.clientWidth || el?.width || 1), Math.max(1, el?.clientHeight || el?.height || 1));
      const comp = c.ambiente?.composicao;
      U.gMarcExpo.value = comp && c.renderer.toneMapping === THREE.NoToneMapping ? 1 / Math.max(0.05, comp.exposicao) : 1;
      // no modo foto a interface some, e os marcadores com ela
      if ((!pedidos.length && !mostrados.length) || c.sobre?.estado === 'foto') {
        malha.visible = false;
        return;
      }
      if (!malha.visible && mostrados.length) malha.visible = true;
      const cam = c.camera.position;
      const andou = cam.distanceTo(camAnt) > Math.max(2, 0.01 * Math.abs(cam.y));
      if (sujo || (andou && tMs - tRefeito >= MARC.refazerMs) || tMs - tRefeito >= 4 * MARC.refazerMs) refazer(tMs);
    },
    /** O que o aquecimento compila (a cópia da malha). */
    aquecimento: () => [ensaio],
    /** Os desenhados agora (cenas e testes): [{ idx, ref, x, y, z, forma, n, celula }]. */
    mostrados: () => mostrados.map(({ idx, ref, x, y, z, forma, n, celula }) => ({ idx, ref, x, y, z, forma, n, celula })),
    medidas: () => ({ pedidos: pedidos.length, mostrados: mostrados.length, atlas: !!atlas, teto: porPerfil(MARC.teto, ctx.perfil) }),
    /** Seleção pela tela: o marcador mais perto do toque, a até 22 px (ou meio lado), sem uma torre na frente. */
    selecionar(raio) {
      if (!mostrados.length || !Number.isFinite(raio.xTela)) return null;
      const el = ctx.canvas;
      const w = el?.clientWidth || 1;
      const h = el?.clientHeight || 1;
      let melhor = null;
      let md = Infinity;
      for (const m of mostrados) {
        _v.set(m.x, m.y, m.z).project(ctx.camera);
        if (_v.z <= -1 || _v.z >= 1) continue;
        const lado = m.n > 1 ? MARC.tamGrupoPx : MARC.tamPx;
        const sx = ((_v.x + 1) / 2) * w;
        const sy = ((1 - _v.y) / 2) * h - (0.5 * lado + 2);
        const d = Math.hypot(sx - raio.xTela, sy - raio.yTela);
        if (d <= Math.max(MARC.toquePx, lado / 2 + 4) && d < md) {
          md = d;
          melhor = m;
        }
      }
      if (!melhor) return null;
      const dist = Math.hypot(melhor.x - raio.origem[0], melhor.y - raio.origem[1], melhor.z - raio.origem[2]);
      // oclusão: um prédio acertado bem antes do marcador (e que não é o dele) esconde o marcador
      const P = ctx.sim.espelho.predios;
      const atras = P ? ctx.dominio('predios')?.selecionar?.(raio, ctx.sim.espelho) : null;
      if (atras && atras.idx !== melhor.idx && atras.dist < dist - 15) return null;
      return { tipo: 'marcador', ref: melhor.ref, idx: melhor.idx, ponto: [melhor.x, melhor.y, melhor.z], dist, n: melhor.n };
    },
    descartar() {
      for (const s of soltar) s();
      ctx.cena.remove(malha);
      geo.dispose();
      quad.dispose();
      mat.dispose();
      atlas?.tex.dispose();
    },
  };
}
