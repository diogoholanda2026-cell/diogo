// Cenas da vitrine da X2 (ferramentas de construção): barra de construção e bandejas, a via em cada fase (mirando com a
// lupa, prévia curva com alças e cota, inválida, grade, melhorar), zonas (Preencher e o pincel com a lupa), colocar,
// demolir com dois toques e Áreas. Um bairro de teste entra no espelho da simulação falsa (ruas numa grade de 112 m,
// uma avenida no eixo, células de 8 m com 6 linhas de fundo, prédios de frente para a rua), e as prévias saem dos
// SUBSTITUTOS da interface (a falsa não planeja vias). O catálogo de serviços, lazer e empresas é de mentira, no
// formato de q.catalogo (o de verdade é da S2a e da S3a).
//   node ferramentas/vitrine-ui.mjs <pasta> x2-construcao,x2-via-previa,x2-zona-pincel 986x443,1376x768
import { reta } from '../../../fonte/comum/bezier.js';
import { VIAS_ORDEM } from '../../../fonte/data/vias.js';
import { ZONAS_ORDEM } from '../../../fonte/data/zonas.js';
import { CELULA, LADRILHO, TIPO_PREDIO, PREDIO } from '../../../fonte/contratos/flags.js';
import { ferramentas, vivo, categoria } from '../../../fonte/ui/ferramentas/sessao.js';

const REF = 1048576; // ger 1: ref = idx + 2^20
const XS = [-336, -224, -112, 0, 112, 224, 336];
const ZS = [-224, -112, 0, 112, 224];
// zonas dos blocos das ruas leste-oeste: [linha da rua (z), coluna do trecho, lado] → zona; o leste fica livre
const ZONAS_BLOCO = { resBaixa: [[0, 0], [0, 1], [1, 0], [2, 1], [3, 0]], comBaixa: [[1, 1], [2, 0]], industria: [[3, 1], [4, 0]] };

/** Bairro de teste no formato do espelho (seção 2.4): nós, arestas, células e prédios. */
export function bairroTeste() {
  const capN = 64;
  const capA = 128;
  const nos = { n: 0, cap: capN, viva: new Uint8Array(capN), ger: new Uint16Array(capN).fill(1), x: new Float64Array(capN), y: new Float64Array(capN), z: new Float64Array(capN), grau: new Uint8Array(capN), raio: new Float32Array(capN) };
  const arestas = { n: 0, cap: capA, viva: new Uint8Array(capA), ger: new Uint16Array(capA).fill(1), a: new Int32Array(capA).fill(-1), b: new Int32Array(capA).fill(-1), tipo: new Uint8Array(capA), p: new Float64Array(8 * capA), y: new Float32Array(2 * capA), comp: new Float32Array(capA), corte: new Float32Array(2 * capA), mao: new Int8Array(capA), flags: new Uint16Array(capA), idade: new Uint32Array(capA) };
  const no = new Map();
  for (const z of ZS) for (const x of XS) {
    const i = nos.n++;
    nos.viva[i] = 1;
    nos.x[i] = x;
    nos.z[i] = z;
    no.set(`${x},${z}`, i);
  }
  const ligar = (x0, z0, x1, z1, tipo) => {
    const a = no.get(`${x0},${z0}`);
    const b = no.get(`${x1},${z1}`);
    const e = arestas.n++;
    arestas.viva[e] = 1;
    arestas.a[e] = a;
    arestas.b[e] = b;
    arestas.tipo[e] = VIAS_ORDEM.indexOf(tipo);
    arestas.p.set(reta(x0, z0, x1, z1), 8 * e);
    arestas.comp[e] = Math.hypot(x1 - x0, z1 - z0);
    arestas.corte[2 * e + 1] = 1;
    nos.grau[a]++;
    nos.grau[b]++;
    return e;
  };
  const leste = [];
  for (const [j, z] of ZS.entries()) for (let i = 0; i + 1 < XS.length; i++) leste.push({ e: ligar(XS[i], z, XS[i + 1], z, 'rua'), j, i, z, x0: XS[i] });
  for (const x of XS) for (let j = 0; j + 1 < ZS.length; j++) ligar(x, ZS[j], x, ZS[j + 1], x === 0 ? 'avenida' : 'rua');

  // células: 10 colunas de 8 m por trecho e 6 linhas de cada lado (lado +1 ao sul, olhando para o norte)
  const capC = leste.length * 2 * 10 * 6;
  const C = { n: 0, cap: capC, viva: new Uint8Array(capC), x: new Float32Array(capC), z: new Float32Array(capC), y: new Float32Array(capC), ang: new Float32Array(capC), zona: new Uint8Array(capC), estado: new Uint8Array(capC), predio: new Int32Array(capC).fill(-1), aresta: new Int32Array(capC).fill(-1), lado: new Int8Array(capC), linha: new Uint8Array(capC), coluna: new Uint16Array(capC) };
  const zonaDoBloco = (j, i, lado) => {
    if (i >= 4) return 0;
    for (const [z, lista] of Object.entries(ZONAS_BLOCO)) if (lista.some(([a, b]) => a === j && (b + (lado > 0 ? 0 : 1)) % 2 === i % 2)) return ZONAS_ORDEM.indexOf(z);
    return 0;
  };
  const blocos = [];
  for (const t of leste) {
    for (const lado of [1, -1]) {
      if ((t.j === 0 && lado < 0) || (t.j === ZS.length - 1 && lado > 0)) continue; // fora do bairro
      const zona = zonaDoBloco(t.j, t.i, lado);
      const cols = [];
      for (let col = 0; col < 10; col++) {
        const coluna = [];
        for (let r = 0; r < 6; r++) {
          const c = C.n++;
          C.viva[c] = 1;
          C.x[c] = t.x0 + 20 + 8 * col;
          C.z[c] = t.z + lado * (12 + 8 * r);
          C.ang[c] = lado > 0 ? Math.PI : 0;
          C.aresta[c] = t.e;
          C.lado[c] = lado;
          C.linha[c] = r;
          C.coluna[c] = col;
          C.zona[c] = zona;
          coluna.push(c);
        }
        cols.push(coluna);
      }
      blocos.push({ zona, lado, cols, z: t.z });
    }
  }
  // prédios de 16 x 24 m (2 colunas e 3 linhas) nos blocos com zona, de frente para a rua
  const capP = 256;
  const P = { n: 0, cap: capP, viva: new Uint8Array(capP), ger: new Uint16Array(capP).fill(1), tipo: new Uint8Array(capP), modelo: new Uint16Array(capP), zona: new Uint8Array(capP), x: new Float64Array(capP), z: new Float64Array(capP), y: new Float32Array(capP), rot: new Float32Array(capP), w: new Uint16Array(capP), d: new Uint16Array(capP), nivel: new Uint8Array(capP), estilo: new Uint8Array(capP), semente: new Uint32Array(capP), flags: new Uint32Array(capP), obraIni: new Uint32Array(capP), obraFim: new Uint32Array(capP), cor: new Uint8Array(capP), moradores: new Uint16Array(capP), empregos: new Uint16Array(capP) };
  for (const b of blocos) {
    if (!b.zona) continue;
    for (let k = 0; k + 1 < b.cols.length; k += 2) {
      if ((k / 2) % 3 === 2) continue; // um lote vazio a cada três
      const i = P.n++;
      const lista = [b.cols[k][0], b.cols[k][1], b.cols[k][2], b.cols[k + 1][0], b.cols[k + 1][1], b.cols[k + 1][2]];
      P.viva[i] = 1;
      P.zona[i] = b.zona;
      P.x[i] = (C.x[b.cols[k][0]] + C.x[b.cols[k + 1][0]]) / 2;
      P.z[i] = C.z[b.cols[k][1]];
      P.rot[i] = b.lado > 0 ? Math.PI : 0;
      P.w[i] = 16;
      P.d[i] = 24;
      P.nivel[i] = 1 + ((i * 7) % 3);
      P.semente[i] = (i * 2654435761) >>> 0;
      P.moradores[i] = b.zona <= 3 ? 12 * P.nivel[i] : 0;
      P.empregos[i] = b.zona > 3 ? 8 * P.nivel[i] : 0;
      for (const c of lista) {
        C.estado[c] = CELULA.OCUPADA;
        C.predio[c] = i;
      }
    }
  }
  // um prédio da Holding (a Concreteira) no fim do bairro industrial
  const h = P.n - 1;
  P.tipo[h] = TIPO_PREDIO.HOLDING;
  P.flags[h] |= PREDIO.HOLDING;
  return { nos, arestas, celulas: C, predios: P };
}

/** Ladrilhos: os 4 x 4 da Holding e o anel vizinho comprável a 40 mil (com a Influência, 38.240). */
function ladrilhosTeste() {
  const estado = new Uint8Array(256);
  const preco = new Float64Array(256);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const k = j * 16 + i;
    if (i >= 6 && i <= 9 && j >= 6 && j <= 9) estado[k] = LADRILHO.HOLDING;
    else if (i >= 5 && i <= 10 && j >= 5 && j <= 10) {
      estado[k] = LADRILHO.COMPRAVEL;
      preco[k] = 38240;
    }
  }
  return { n: 16, estado, preco };
}

/** Catálogo de mentira no formato de q.catalogo (seção 2.6): o de verdade é da S2a (serviços) e da S3a (Holding). */
const CATALOGO = {
  servicos: [
    { tipo: 'captacao', nome: 'Captação no rio', custo: 25000, manutencaoHora: 600, marco: 0, liberado: true, grupo: 'Água', glifo: 'agua', capacidade: 5000 },
    { tipo: 'poco', nome: 'Poço artesiano', custo: 8000, manutencaoHora: 200, marco: 0, liberado: true, grupo: 'Água', glifo: 'agua', capacidade: 900 },
    { tipo: 'solar', nome: 'Usina solar', custo: 30000, manutencaoHora: 500, marco: 0, liberado: true, grupo: 'Energia', glifo: 'energia' },
    { tipo: 'clinica', nome: 'Clínica da Família', custo: 22000, manutencaoHora: 400, marco: 1, liberado: true, grupo: 'Saúde', glifo: 'saude', alcance: 600, capacidade: 1200, pegada: [24, 32] },
    { tipo: 'escolaF', nome: 'Escola Municipal', custo: 28000, manutencaoHora: 500, marco: 2, liberado: true, grupo: 'Educação', glifo: 'educacao', alcance: 800, capacidade: 900 },
    { tipo: 'delegacia', nome: 'Base Comunitária', custo: 26000, manutencaoHora: 450, marco: 6, liberado: false, grupo: 'Segurança', glifo: 'policia', alcance: 900 },
    { tipo: 'bombeiros', nome: 'Posto de Bombeiros', custo: 240000, manutencaoHora: 700, marco: 3, liberado: true, grupo: 'Segurança', glifo: 'bombeiros', alcance: 1000 },
  ],
  lazer: [{ tipo: 'praca', nome: 'Praça', custo: 6000, manutencaoHora: 80, marco: 0, liberado: true, glifo: 'praca', alcance: 400 }],
  empresas: [{ tipo: 'pedreira', nome: 'Pedreira', custo: 40000, manutencaoHora: 900, marco: 0, liberado: true, glifo: 'industrial' }],
};

/** Põe o bairro no espelho da simulação falsa e desliga as prévias dela (as da interface entram, os substitutos). */
function prepararMundo(sim, R, ui = null) {
  const b = bairroTeste();
  sim.espelho.vias = { nos: b.nos, arestas: b.arestas };
  sim.espelho.celulas = b.celulas;
  sim.espelho.predios = b.predios;
  sim.espelho.ladrilhos = ladrilhosTeste();
  delete sim.q.via;
  delete sim.q.zona;
  delete sim.q.construir;
  sim.q.catalogo = (cat) => (CATALOGO[cat] ?? []).map((x) => ({ ...x }));
  sim.q.ladrilhos = () => ({ ...sim.espelho.ladrilhos });
  olhar(R, [60, 30], 520);
  ui?.ui?.loja?.registrarEvento('desbloqueio', { ids: ['catalogo'] }); // a barra relê o catálogo
  return b;
}

/** Câmera sobre um ponto (guinada de 16 graus: o leste fica à direita, o norte para o fundo). */
function olhar(R, [x, z], dist = 420, inclinacao = 48) {
  R.camera.definir({ x, z, dist, guinada: 16, inclinacao });
}

/** Evento da ferramenta num ponto do mundo (a tela sai da câmera de mentira). */
function evento(R, tipo, p, t, { toque = false } = {}) {
  const s = R.projetar([p[0], 0, p[1]]);
  const tela = [s.x, s.y];
  const dedo = toque ? [s.x, s.y + 56] : tela;
  return { tipo, ponto: [...p], tela, dedo, t };
}

/** Traça A e B pela máquina (toque e soltura) e deixa a prévia. */
function tracar(R, a, b, { t0 = 0 } = {}) {
  ferramentas.evento(evento(R, 'inicio', a, t0));
  ferramentas.evento(evento(R, 'fim', a, t0 + 400));
  ferramentas.evento(evento(R, 'inicio', b, t0 + 900));
  ferramentas.evento(evento(R, 'move', b, t0 + 950));
  ferramentas.evento(evento(R, 'fim', b, t0 + 1000));
}

const existe = (sel, nome) => () => (document.querySelector(sel) ? [] : [`${nome}: ${sel} não apareceu`]);
const juntar = (...fs) => () => fs.flatMap((f) => f());
const textoTem = (sel, re, nome) => () => {
  const e = document.querySelector(sel);
  if (!e) return [`${nome}: ${sel} não apareceu`];
  return re.test(e.textContent) ? [] : [`${nome}: "${e.textContent.slice(0, 80)}" não bate com ${re}`];
};
// nada da barra da ferramenta sai da tela nem fica sob a barra de cima
const barraCabe = () => {
  const b = document.querySelector('.barra-ferr');
  if (!b) return ['a barra da ferramenta não apareceu'];
  const r = b.getBoundingClientRect();
  return r.left < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 ? [`barra da ferramenta fora da tela (${Math.round(r.left)} a ${Math.round(r.right)})`] : [];
};

export function registrar(registrarCenaVitrine) {
  // a barra de construção em repouso: os dois grupos, com Serviços, Lazer e Empresas pelo catálogo
  registrarCenaVitrine('x2-construcao', {
    cenario: 'meio',
    repouso: true,
    async preparar({ sim, R, ui, esperar }) {
      prepararMundo(sim, R, ui);
      await esperar(40);
    },
    conferir: juntar(existe('[data-hud="construcao-cidade"]', 'grupo da cidade'), existe('[data-hud="construcao-holding"]', 'grupo da Holding'), existe('[data-a="categoria"][data-k="servicos"]', 'Serviços')),
  });
  // bandeja das vias (sem ferramenta): cartões com preço por metro e cadeado no que abre depois
  registrarCenaVitrine('x2-bandeja-vias', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      sim.estado.marco = 2;
      categoria.value = 'vias';
      await esperar(40);
    },
    conferir: juntar(existe('.bandeja [data-a="item"][data-k="avenida"]', 'avenida'), existe('.item-cartao.trancado', 'cadeado')),
  });
  // bandeja de serviços com abas, um trancado e um que falta dinheiro
  registrarCenaVitrine('x2-bandeja-servicos', {
    cenario: 'meio',
    async preparar({ sim, R, ui, esperar, acionar }) {
      prepararMundo(sim, R, ui);
      categoria.value = 'servicos';
      await esperar(40);
      acionar('bandeja.aba', 'Segurança');
      await esperar(40);
    },
    conferir: juntar(existe('.bandeja [role="tablist"]', 'abas'), existe('.bandeja .item-preco.falta', 'preço que falta')),
  });
  // via mirando B com o dedo apoiado: a mira acima do dedo, o fio e a lupa esquemática
  registrarCenaVitrine('x2-via-mirando', {
    cenario: 'meio',
    tamanhos: ['986x443', '915x412'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('via', { tipoVia: 'rua' });
      const a = [336, 112];
      const b = [470, 70];
      olhar(R, [440, 150], 420);
      ferramentas.evento(evento(R, 'inicio', a, 0, { toque: true }));
      ferramentas.evento(evento(R, 'fim', a, 400, { toque: true }));
      const ev = evento(R, 'inicio', b, 900, { toque: true });
      ferramentas.evento(ev);
      ferramentas.evento({ ...evento(R, 'move', b, 1000, { toque: true }) });
      Object.assign(vivo, { mira: ev.tela, dedo: ev.dedo, toque: true, apoiado: true, mpp: 1.1 });
      await esperar(80);
    },
    conferir: juntar(existe('.lupa[data-ligada]', 'lupa'), barraCabe),
  });
  // prévia da avenida em curva: alças de A, B e do meio, cota e o chip do encaixe no nó
  registrarCenaVitrine('x2-via-previa', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('via', { tipoVia: 'avenida', modo: 'curva' });
      olhar(R, [400, 40], 460);
      tracar(R, [336, 0], [336 + 170, 150]);
      const meio = [336 + 85, 75];
      const pega = evento(R, 'inicio', meio, 3000);
      ferramentas.evento(pega);
      ferramentas.evento(evento(R, 'move', [meio[0] + 40, meio[1] - 50], 3100));
      ferramentas.evento(evento(R, 'fim', [meio[0] + 40, meio[1] - 50], 3200));
      await esperar(60);
    },
    conferir: juntar(existe('.alca-meio', 'alça do meio'), textoTem('.cota', /\d+ m · /, 'cota'), textoTem('.bf-linha', /US\$/, 'total'), barraCabe),
  });
  // prévia inválida: a rua sai das áreas da Holding (o motivo no botão, na cota e na linha)
  registrarCenaVitrine('x2-via-invalida', {
    cenario: 'meio',
    tamanhos: ['986x443', '1376x768'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('via', { tipoVia: 'rua' });
      olhar(R, [700, -60], 900, 44);
      tracar(R, [336, -112], [1180, -60]);
      await esperar(60);
    },
    conferir: juntar(textoTem('[data-a="ferr.principal"]', /Fora das áreas/, 'motivo no botão'), existe('.cota-er', 'cota vermelha')),
  });
  // Grade: a primeira rua e o fundo com duas quadras
  registrarCenaVitrine('x2-via-grade', {
    cenario: 'meio',
    tamanhos: ['986x443', '1376x768'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('via', { tipoVia: 'rua', modo: 'grade' });
      olhar(R, [520, -60], 760, 50);
      tracar(R, [448, -224], [672, -224]);
      await esperar(60);
    },
    conferir: juntar(existe('.alca-fundo', 'alça do fundo'), textoTem('.bf-linha', /ruas/, 'total da grade')),
  });
  // Melhorar: duas ruas escolhidas para avenida
  registrarCenaVitrine('x2-via-melhorar', {
    cenario: 'meio',
    tamanhos: ['986x443', '1920x1080'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('via', { tipoVia: 'avenida', modo: 'melhorar' });
      ferramentas.evento({ tipo: 'aresta', ref: 3 + REF, somar: false });
      ferramentas.evento({ tipo: 'aresta', ref: 4 + REF, somar: true });
      await esperar(60);
    },
    conferir: textoTem('.bf-linha', /2 trechos/, 'trechos'),
  });
  // zonas: Preencher numa quadra livre (a contagem de células na barra)
  registrarCenaVitrine('x2-zona', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('zona', { zona: 'resMedia' });
      olhar(R, [250, 40], 420);
      ferramentas.evento(evento(R, 'hover', [290, 60], 0));
      await esperar(60);
    },
    conferir: juntar(textoTem('.bf-linha', /células/, 'células'), barraCabe),
  });
  // pincel G com o dedo apoiado: a lupa mostra as células
  registrarCenaVitrine('x2-zona-pincel', {
    cenario: 'meio',
    tamanhos: ['986x443', '915x412'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('zona', { zona: 'comBaixa', modo: 'pincel', tamanho: 'G' });
      olhar(R, [290, 60], 360);
      const ev = evento(R, 'inicio', [290, 30], 0, { toque: true });
      ferramentas.evento(ev);
      Object.assign(vivo, { mira: ev.tela, dedo: ev.dedo, toque: true, apoiado: true, mpp: 0.9 });
      await esperar(80);
    },
    conferir: juntar(existe('.lupa[data-ligada]', 'lupa'), existe('[data-a="ferr.tamanho"]', 'tamanhos do pincel')),
  });
  // colocar: a clínica grudada na frente da rua, com o alcance
  registrarCenaVitrine('x2-colocar', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      ferramentas.abrir('colocar', { item: CATALOGO.servicos[3] });
      olhar(R, [380, 120], 460);
      ferramentas.evento(evento(R, 'hover', [400, 150], 0));
      await esperar(60);
    },
    conferir: juntar(textoTem('.bf-linha', /alcance 600 m/, 'alcance'), existe('[data-a="ferr.girar"]', 'Girar')),
  });
  // demolir: dois prédios (um da Holding) e um trecho de rua; o botão pede dois toques
  registrarCenaVitrine('x2-demolir', {
    cenario: 'meio',
    async preparar({ sim, R, esperar }) {
      const b = prepararMundo(sim, R);
      ferramentas.abrir('demolir');
      olhar(R, [120, 60], 520);
      const h = b.predios.n - 1;
      ferramentas.evento({ tipo: 'alvo', alvo: { ref: REF, tipo: 'predio', holding: false, recusa: null }, somar: false });
      ferramentas.evento({ tipo: 'alvo', alvo: { ref: h + REF, tipo: 'predio', holding: true, recusa: null }, somar: true });
      ferramentas.evento({ tipo: 'alvo', alvo: { ref: 2 + REF, tipo: 'aresta', holding: false, recusa: null }, somar: true });
      await esperar(60);
    },
    conferir: juntar(existe('.dois-toques', 'dois toques'), textoTem('.bf-linha', /moradores/, 'o que se perde')),
  });
  // Áreas: os preços das áreas vizinhas e uma escolhida
  registrarCenaVitrine('x2-areas', {
    cenario: 'meio',
    tamanhos: ['986x443', '1376x768'],
    async preparar({ sim, R, esperar }) {
      prepararMundo(sim, R);
      olhar(R, [0, 0], 7200, 58);
      ferramentas.abrir('areas');
      ferramentas.evento(evento(R, 'fim', [1280, 256], 0));
      await esperar(60);
    },
    conferir: juntar(existe('.cota-area.sel', 'área escolhida'), textoTem('.bf-linha', /US\$/, 'preço')),
  });
}
