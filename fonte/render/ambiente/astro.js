// Sol e lua pela latitude, dia do ano e hora do céu (D9, desenho do render 2.1). Conta pura, sem three: roda no Node
// (testes) e no navegador. Erro menor que 1 grau com a declinação de Cooper e a equação do tempo de Spencer
// simplificada. Eixos do jogo: x leste, y para cima, z sul (norte em -z), girados por norteAz (graus, sentido horário
// visto de cima) quando o mapa pedir outro norte.
//
// A lua do jogo: um ciclo de sol e lua vale um mês do calendário (D7), então a fase não pode seguir os dias do ano
// (daria quase a mesma fase toda noite e mudaria no meio dela). A fase anda um oitavo por mês de jogo e fica parada
// dentro do ciclo; a posição sai da mesma conta do sol, atrasada pela fase.

const RAD = Math.PI / 180;
const DOIS_PI = 2 * Math.PI;

/** Elevação do nascer e do pôr do sol (refração e meio disco), em graus. */
export const ELEVACAO_NASCER = -0.833;

/** Declinação do sol (rad) no dia do ano (0 a 365). */
export function declinacao(diaDoAno) {
  return 23.44 * RAD * Math.sin((DOIS_PI * (284 + diaDoAno)) / 365);
}

/** Equação do tempo (minutos) no dia do ano: o meio-dia solar anda até 16 min em volta das 12h. */
export function equacaoDoTempo(diaDoAno) {
  const b = (DOIS_PI * (diaDoAno - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

/**
 * Direção unitária para um astro de declinação dec e ângulo horário h (rad), na latitude lat (rad), girada pelo norte
 * do mapa. Devolve [x, y, z] e a elevação.
 */
function direcaoAstro(dec, h, lat, norteAz, alvo) {
  const sEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sEl)));
  // azimute a partir do norte, crescendo para leste
  const az = Math.atan2(-Math.sin(h) * Math.cos(dec), Math.cos(lat) * Math.sin(dec) - Math.sin(lat) * Math.cos(dec) * Math.cos(h));
  const a = az + norteAz * RAD;
  const c = Math.cos(el);
  alvo[0] = c * Math.sin(a);
  alvo[1] = Math.sin(el);
  alvo[2] = -c * Math.cos(a);
  return el;
}

/**
 * Posição do sol.
 * @param {number} hora       hora do céu (0 a 24; D9)
 * @param {number} diaDoAno   0 a 365
 * @param {number} latitude   graus (Heldópolis: -23,5)
 * @param {number} norteAz    graus
 * @returns {{ dir: number[], elevacao: number, horaSolar: number }} dir aponta PARA o sol; elevação em rad
 * @example posicaoSol(12, 355, -23.5).dir[1] > 0.99 // quase a pino no solstício de verão do sul
 */
export function posicaoSol(hora, diaDoAno, latitude = -23.5, norteAz = 0, alvo = { dir: [0, 1, 0], elevacao: 0, horaSolar: 12 }) {
  const horaSolar = hora + equacaoDoTempo(diaDoAno) / 60;
  const h = (horaSolar - 12) * 15 * RAD;
  alvo.elevacao = direcaoAstro(declinacao(diaDoAno), h, latitude * RAD, norteAz, alvo.dir);
  alvo.horaSolar = horaSolar;
  return alvo;
}

/**
 * Horas do nascer e do pôr do sol (hora do céu) num dia do ano; noite polar ou dia polar não acontecem no trópico.
 * @returns {{ nascer: number, por: number, meioDia: number }}
 */
export function nascerEPor(diaDoAno, latitude = -23.5) {
  const dec = declinacao(diaDoAno);
  const lat = latitude * RAD;
  const c = (Math.sin(ELEVACAO_NASCER * RAD) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  const h0 = Math.acos(Math.max(-1, Math.min(1, c))) / (15 * RAD);
  const meioDia = 12 - equacaoDoTempo(diaDoAno) / 60;
  return { nascer: meioDia - h0, por: meioDia + h0, meioDia };
}

/** Fase da lua (0 nova, 0,5 cheia) de um mês absoluto do jogo (0 no primeiro mês): um oitavo de lunação por mês. */
export function faseDaLua(mesAbs) {
  const f = 0.42 + mesAbs / 8;
  return f - Math.floor(f);
}

/** Fração iluminada do disco da lua pela fase. */
export const iluminacaoDaLua = (fase) => (1 - Math.cos(DOIS_PI * fase)) / 2;

/**
 * Posição da lua: a do sol atrasada pela fase (a lua cheia nasce quando o sol se põe), na eclíptica aproximada.
 * @returns {{ dir: number[], elevacao: number, fase: number, iluminada: number }}
 */
export function posicaoLua(hora, diaDoAno, mesAbs, latitude = -23.5, norteAz = 0, alvo = { dir: [0, 1, 0], elevacao: 0, fase: 0, iluminada: 0 }) {
  const fase = faseDaLua(mesAbs);
  const horaSolar = hora + equacaoDoTempo(diaDoAno) / 60;
  const h = (horaSolar - 12 - 24 * fase) * 15 * RAD;
  // longitude eclíptica da lua = a do sol mais a fase; declinação pela eclíptica (inclinação de 5 graus ignorada)
  const lonSol = (DOIS_PI * (diaDoAno - 80)) / 365;
  const dec = Math.asin(Math.sin(23.44 * RAD) * Math.sin(lonSol + DOIS_PI * fase));
  alvo.elevacao = direcaoAstro(dec, h, latitude * RAD, norteAz, alvo.dir);
  alvo.fase = fase;
  alvo.iluminada = iluminacaoDaLua(fase);
  return alvo;
}

/** Mês absoluto (0 no primeiro mês do jogo) pelo tempo do espelho. */
export function mesAbsoluto(tempo) {
  if (!tempo) return 0;
  return ((tempo.ano ?? 1) - 1) * 12 + ((tempo.mes ?? 1) - 1);
}

/** Tudo de uma vez para o quadro: sol, lua e o fator de dia (0 noite, 1 dia) pela elevação do sol. */
export function astros(hora, tempo, mapa, alvo = { sol: undefined, lua: undefined, dia: 1 }) {
  const lat = mapa?.latitude ?? -23.5;
  const norte = mapa?.norteAz ?? 0;
  const dia = tempo?.diaDoAno ?? 0;
  alvo.sol = posicaoSol(hora, dia, lat, norte, alvo.sol);
  alvo.lua = posicaoLua(hora, dia, mesAbsoluto(tempo), lat, norte, alvo.lua);
  alvo.dia = fatorDia(alvo.sol.elevacao);
  return alvo;
}

/** 0 de noite (sol 8 graus abaixo do horizonte) a 1 de dia (sol 6 graus acima), suave. */
export function fatorDia(elevacao) {
  const e = elevacao / RAD;
  const t = Math.max(0, Math.min(1, (e + 8) / 14));
  return t * t * (3 - 2 * t);
}
