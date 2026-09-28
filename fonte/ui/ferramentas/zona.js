// Ferramenta de zonas (desenho da UI 9.3, D23): máquina PURA e o pincel substituto. Preencher (padrão: um toque
// pinta as células livres da quadra), Pincel (arrastar pinta pela mira; P, M e G são 1, 2 e 4 células de raio),
// Retângulo (apoiar, arrastar a diagonal e soltar) e Apagar (as três formas com a zona 0). A pintura vale na hora; o
// Desfazer da sessão volta. A cola (sessao.js) pede q.zona.previa, manda zona.pintar e guarda as zonas antigas.
import { ZONAS, ZONAS_ORDEM } from '../../data/zonas.js';
import { CELULA } from '../../contratos/flags.js';
import { CELULA_M } from '../../contratos/espelho.js';

/** Raio do pincel por tamanho: 1, 2 e 4 células de 8 m. */
export const TAMANHOS_PINCEL = Object.freeze({ P: CELULA_M, M: 2 * CELULA_M, G: 4 * CELULA_M });

export const MODOS_ZONA = Object.freeze(['preencher', 'pincel', 'retangulo']);

/** Zonas que a barra oferece nesta parte (M1a: as 4 da D23; M1b acrescenta as outras 3). */
export function zonasDaParte(parte = 'M1a') {
  return ZONAS_ORDEM.filter((z) => z && (parte === 'M1b' || ZONAS[z].parte === 'M1a'));
}

/**
 * Estado novo.
 * @param {{ zona?: string, modo?: string, tamanho?: 'P' | 'M' | 'G', apagar?: boolean }} op
 */
export function criarZona({ zona = 'resBaixa', modo = 'preencher', tamanho = 'M', apagar = false } = {}) {
  return {
    zona: ZONAS[zona] ? zona : 'resBaixa',
    modo: MODOS_ZONA.includes(modo) ? modo : 'preencher',
    tamanho: TAMANHOS_PINCEL[tamanho] ? tamanho : 'M',
    apagar: !!apagar,
    dedo: false,
    inicio: null, // retângulo: o canto de apoio
    ultimo: null, // pincel: o último centro pintado
    mira: null,
    traco: 0, // número do traço (o Desfazer junta um traço inteiro numa ação)
    efeitos: [],
  };
}

/** Índice da zona que o pincel aplica (0 apaga). */
export const zonaAplicada = (e) => (e.apagar ? 0 : Math.max(0, ZONAS_ORDEM.indexOf(e.zona)));

/** Raio do pincel em metros. */
export const raioPincel = (e) => TAMANHOS_PINCEL[e.tamanho] ?? TAMANHOS_PINCEL.M;

/** Pincel do contrato (zona.pintar) para a forma atual num ponto (ou num retângulo de `de` a `p`). */
export function pincelEm(e, p, de = null) {
  if (e.modo === 'preencher') return { modo: 'quadra', x: p[0], z: p[1] };
  if (e.modo === 'retangulo' && de) return { modo: 'retangulo', x: Math.min(de[0], p[0]), z: Math.min(de[1], p[1]), x2: Math.max(de[0], p[0]), z2: Math.max(de[1], p[1]) };
  return { modo: 'circulo', x: p[0], z: p[1], raio: raioPincel(e) };
}

/**
 * Um passo. Eventos: { tipo: 'inicio' | 'move' | 'fim' | 'hover', ponto, tela, t }, { tipo: 'opcao', zona?, modo?,
 * tamanho?, apagar? }, { tipo: 'cancelar' }. Efeitos: { efeito: 'previa', pincel }, { efeito: 'pintar', pincel, traco },
 * { efeito: 'fimTraco', traco }, 'limpar', 'sair'.
 */
export function passoZona(e, ev) {
  const ef = [];
  if (ev.tipo === 'opcao') {
    const n = { ...e, efeitos: ['limpar'] };
    if (ev.zona && ZONAS[ev.zona]) {
      n.zona = ev.zona;
      n.apagar = false;
    }
    if (ev.modo && MODOS_ZONA.includes(ev.modo)) n.modo = ev.modo;
    if (ev.tamanho && TAMANHOS_PINCEL[ev.tamanho]) n.tamanho = ev.tamanho;
    if (typeof ev.apagar === 'boolean') n.apagar = ev.apagar;
    return { ...n, dedo: false, inicio: null, ultimo: null };
  }
  if (ev.tipo === 'cancelar') {
    if (e.dedo) return { ...e, dedo: false, inicio: null, ultimo: null, efeitos: ['limpar'] };
    return { ...e, efeitos: ['sair'] };
  }
  if (!ev.ponto) return { ...e, efeitos: [] };
  const p = [ev.ponto[0], ev.ponto[1]];
  const mira = { ponto: p, tela: ev.tela ?? null, dedo: ev.dedo ?? null };
  const base = { ...e, mira, efeitos: ef };
  if (ev.tipo === 'hover') {
    if (!e.dedo) ef.push({ efeito: 'previa', pincel: pincelEm(e, p) });
    return base;
  }
  if (ev.tipo === 'inicio') {
    const traco = e.traco + 1;
    if (e.modo === 'pincel') {
      const pincel = pincelEm(e, p);
      ef.push({ efeito: 'previa', pincel }, { efeito: 'pintar', pincel, traco });
      return { ...base, dedo: true, ultimo: p, traco };
    }
    if (e.modo === 'retangulo') {
      ef.push({ efeito: 'previa', pincel: pincelEm(e, p, p) });
      return { ...base, dedo: true, inicio: p, traco };
    }
    ef.push({ efeito: 'previa', pincel: pincelEm(e, p) });
    return { ...base, dedo: true, traco };
  }
  if (ev.tipo === 'move') {
    if (!e.dedo) return base;
    if (e.modo === 'pincel') {
      // pinta a cada meio raio pelo caminho (o dedo rápido não deixa buraco)
      const r = raioPincel(e);
      const passo = r / 2;
      let ult = e.ultimo ?? p;
      const d = Math.hypot(p[0] - ult[0], p[1] - ult[1]);
      if (d >= passo) {
        const k = Math.min(64, Math.floor(d / passo));
        for (let i = 1; i <= k; i++) {
          const q = [ult[0] + ((p[0] - ult[0]) * i) / k, ult[1] + ((p[1] - ult[1]) * i) / k];
          ef.push({ efeito: 'pintar', pincel: pincelEm(e, q), traco: e.traco });
        }
        ult = p;
      }
      ef.push({ efeito: 'previa', pincel: pincelEm(e, p) });
      return { ...base, ultimo: ult };
    }
    ef.push({ efeito: 'previa', pincel: pincelEm(e, p, e.modo === 'retangulo' ? e.inicio : null) });
    return base;
  }
  if (ev.tipo === 'fim') {
    if (!e.dedo) return base;
    if (e.modo === 'preencher') ef.push({ efeito: 'pintar', pincel: pincelEm(e, p), traco: e.traco });
    else if (e.modo === 'retangulo' && e.inicio) ef.push({ efeito: 'pintar', pincel: pincelEm(e, p, e.inicio), traco: e.traco });
    ef.push({ efeito: 'fimTraco', traco: e.traco }, { efeito: 'previa', pincel: null });
    return { ...base, dedo: false, inicio: null, ultimo: null };
  }
  return base;
}

// ------------------------------------------------------------------------------------------------ substituto

/**
 * Células que um pincel pega (SUBSTITUTO de q.zona.previa enquanto a S1b não publica): círculo e retângulo pelo centro
 * da célula; quadra pelas células livres do bloco (mesma aresta e mesmo lado) da célula mais perto do ponto (a quadra
 * inteira, com os blocos das outras vias, é da S1b). Só células vivas e não inválidas que mudam de zona.
 * @returns {{ celulas: Int32Array, comPredio: number, efeitoMedia: number }}
 */
export function previaZonaLocal(esp, pincel, zona) {
  const C = esp?.celulas;
  const vazio = { celulas: new Int32Array(0), comPredio: 0, efeitoMedia: 0, substituto: true };
  if (!C?.n || !pincel) return vazio;
  const lista = [];
  const pega = (c) => C.viva[c] && C.estado[c] !== CELULA.INVALIDA && C.zona[c] !== zona;
  if (pincel.modo === 'circulo') {
    const r2 = (pincel.raio + CELULA_M / 2) ** 2;
    for (let c = 0; c < C.n; c++) if (pega(c) && (C.x[c] - pincel.x) ** 2 + (C.z[c] - pincel.z) ** 2 <= r2) lista.push(c);
  } else if (pincel.modo === 'retangulo') {
    for (let c = 0; c < C.n; c++) if (pega(c) && C.x[c] >= pincel.x && C.x[c] <= pincel.x2 && C.z[c] >= pincel.z && C.z[c] <= pincel.z2) lista.push(c);
  } else if (pincel.modo === 'celulas') {
    for (const c of pincel.celulas ?? []) if (c >= 0 && c < C.n && pega(c)) lista.push(c);
  } else if (pincel.modo === 'quadra') {
    // a célula mais perto até 60 m diz o bloco
    let melhor = -1;
    let md = 60 * 60;
    for (let c = 0; c < C.n; c++) {
      if (!C.viva[c] || C.estado[c] === CELULA.INVALIDA) continue;
      const d = (C.x[c] - pincel.x) ** 2 + (C.z[c] - pincel.z) ** 2;
      if (d < md) {
        md = d;
        melhor = c;
      }
    }
    if (melhor < 0) return vazio;
    const bloco = (c) => `${C.aresta[c]}:${C.lado[c]}`;
    const alvo = bloco(melhor);
    for (let c = 0; c < C.n; c++) if (pega(c) && bloco(c) === alvo && C.estado[c] === CELULA.LIVRE) lista.push(c);
  }
  let comPredio = 0;
  for (const c of lista) if (C.estado[c] === CELULA.OCUPADA) comPredio++;
  return { celulas: Int32Array.from(lista), comPredio, efeitoMedia: 0, substituto: true };
}

/**
 * Zonas antigas das células (para o Desfazer): { zona: [células] }, só as que mudam.
 * @param {object} esp espelho
 * @param {Int32Array | number[]} celulas
 */
export function zonasAntigas(esp, celulas) {
  const C = esp?.celulas;
  const grupos = new Map();
  if (!C) return grupos;
  for (const c of celulas) {
    if (c < 0 || c >= C.n || !C.viva[c]) continue;
    const z = C.zona[c];
    if (!grupos.has(z)) grupos.set(z, []);
    grupos.get(z).push(c);
  }
  return grupos;
}
