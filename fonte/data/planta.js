// Planta mestra da maquete, traçada a partir da foto "Composição total da Arcologia de Held"
// retificada (vista de cima). Coordenadas em unidades da mesa: x de -32 (esquerda) a 32 (direita),
// z de -20 (fundo) a 20 (frente, onde fica a placa).
export const MESA = { x0: -32, x1: 32, z0: -20, z1: 20 };

// Vista que reproduz o enquadramento da foto de referência.
export const VISTA_FOTO = { x: 6.89, z: 6.84, dist: 54.9, yaw: 0.493, pitch: 0.612, fov: 32, roll: -0.172 };

// pista (retângulo arredondado, superelipse) — o Santuário e a sua zona usam a mesma forma
export function pistaPts(cx, cz, rx, rz, rot, n = 220) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a); const k = 3.2; const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k) * rx, z = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k) * rz; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}

// Âncoras de cada conjunto (usadas pelos modelos 3D, pelo terreno e pela floresta). Nos polígonos, cada ponto
// tem ao menos uma coordenada fracionária: um par só de inteiros vira outro tipo de vetor no motor de JS e deixa
// as consultas do terreno (feitas para cada vértice) mais de 2 vezes mais lentas.
export const A = {
  // Anel do Campus: grande anel elíptico em terraços (Escola e Campus Jovem + faculdades)
  anel: { c: [-9.6, 8.4], rx: 11.4, rz: 9.2, rot: -0.1 },
  campo: { c: [-6.8, 9.2], w: 5.6, d: 3.4, rot: -0.28 },
  // Campus Universitário: fita longa em "C" que desce do fundo à esquerda até o Anel (o Elo Norte fecha
  // a ligação), com a ala alta de brises e o campo gramado por dentro da curva
  uni: { c: [-21.2, -10.6], path: [[-15.8, -15.8], [-20.4, -15.6], [-23.8, -13.8], [-25.0, -10.8], [-24.4, -7.2], [-22.8, -4.2], [-20.6, -2.2]],
    elo: [[-20.6, -2.2], [-18.4, -0.9], [-16.0, -0.2], [-14.2, 0.1]],
    campo: { c: [-18.0, -12.4], w: 4.6, d: 2.6, rot: -0.06 }, ala: { c: [-21.6, -10.6], w: 3.4, d: 1.2, rot: 0.62, andares: 8 } },
  // Faculdade de Ciências Avançadas e Tecnologia (forma orgânica com laboratórios em corte)
  ciencias: { c: [-5.9, -1.7], rx: 7.4, rz: 3.0, rot: -0.12, // (z -1.7: a frente dos lóbulos não entra na fita do Anel)
    // espelho em gota do vale urbanizado (em (4.0, 3.8) batia na Ponte do Instituto) e o canal até o bulevar
    gota: { c: [5.0, 3.4], rx: 1.3, rz: 0.85, rot: 0.25, canal: [[5.3, 6.4], [5.2, 9.6]] } },
  // Lago central (inteiro dentro da curva da Sede) e a ilha arborizada
  lago: [[-5.4, -9.2], [-3.8, -10.4], [-1.2, -11.0], [1.8, -10.9], [3.8, -10.2], [4.6, -9.2], [5.8, -8.0], [7.2, -6.9], [7.05, -5.0], [5.6, -4.0], [2.6, -3.6], [-0.8, -3.4], [-3.05, -4.0], [-4.8, -5.6], [-5.8, -7.4]],
  ilha: { c: [-1.0, -6.6], r: 1.3 },
  // Sede Administrativa da Holding Guarda-Chuva: fita aberta (arco de a0 a a1) que abraça o lago pelo
  // fundo e pela direita e encosta na ponta esquerda do Santuário; o0 = largura da fita (para dentro)
  sede: { c: [2.4, -8.2], rx: 10.6, rz: 5.9, rot: 0.04, a0: 4.0, a1: 6.9, o0: -1.9, piscina: { c: [6.3, -10.0], r: 0.95 } },
  // Biblioteca Central (torre) + Centro de Recursos Digitais (abóbada) + anel em terraços
  // (dossel quadrado de 6.5 de lado a 5.2 de altura, girado 0.66: na câmera da foto os cantos da esquerda e da
  // direita caem a 2 px dos da foto e a largura dá 255 px, como na foto; os cantos de cima e de baixo ficam
  // ~23 px mais abertos, porque na foto o dossel é um losango achatado que nenhum quadrado reproduz.
  // Torre em vaso de raio 2.75: ~160 px de largura, como na foto. O CRD fica à frente, com posição própria)
  biblio: { c: [14.9, 8.1], r: 2.75, canopy: 6.5, canopyRot: 0.66, canopyY: 5.2, crd: { c: [14.2, 12.9], rot: -0.32 } },
  anelBib: { c: [14.9, 8.1], r0: 3.7, r1: 6.5, a0: 2.9, a1: 4.6 }, // do lado esquerdo ao fundo (a frente fica com o CRD)
  // Santuário de Animais e Centro de Conservação (pista de 4 andares; lagoa por dentro, pasto atrás)
  santuario: { c: [21.4, -7.8], rx: 8.4, rz: 5.0, rot: -0.04, lago: { c: [21.8, -9.3], rx: 2.0, rz: 1.15, rot: 0.2 } },
  // Habitats expandidos (piquetes de pasto entre o Santuário, a Biblioteca e o Bioma)
  savana: { poly: [[12.2, -1.6], [16.4, -2.1], [20.6, -1.7], [20.8, 1.4], [19.4, 5.4], [16.8, 6.4], [14.8, 3.6], [14.4, 0.6]],
    // 3 piquetes de pasto separados pelas trilhas (esquerda, meio, fundo à direita)
    piquetes: [[[13.4, -1.75], [15.0, 0.8], [16.0, 5.3], [14.8, 3.6], [14.4, 0.6], [12.2, -1.6]],
      [[13.4, -1.75], [16.4, -2.1], [18.4, -1.91], [19.0, 0.4], [20.74, 0.5], [20.8, 1.4], [19.4, 5.4], [16.8, 6.4], [16.0, 5.3], [15.0, 0.8]],
      [[18.4, -1.91], [20.6, -1.7], [20.74, 0.5], [19.0, 0.4]]] },
  // Bioma Aquático de Conservação (cúpula geodésica)
  bioma: { c: [24.6, 4.0], r: 3.1 },
  // Vila Estudantil Expandida: anfiteatro + casas
  anfiteatro: { c: [20.6, 11.6], r: 2.5 },
  vila: { c: [24.3, 12.4], w: 4.4, d: 2.6, rot: 0.62 }, // fileira de casas na diagonal, do anfiteatro ao Bioma
  // Recinto dos gorilas (cerca de vidro com corrimão)
  gorilas: { c: [26.2, 17.0], rx: 2.8, rz: 2.3 },
  // Acelerador de partículas subterrâneo & Centro de Física
  acelerador: { c: [11.9, 17.6], rx: 2.6, rz: 1.7 },
  // Praça central
  praca: { poly: [[-2.5, 12.6], [3.0, 11.6], [8.6, 12.4], [9.6, 14.8], [9.2, 19.4], [0.0, 19.6], [-3.4, 17.2]] },
  lagosPraca: [{ c: [1.4, 17.9], rx: 2.2, rz: 1.0, rot: -0.1 }, { c: [7.2, 17.4], rx: 1.2, rz: 0.8, rot: 0.3 }],
  // caminhos curvos em leque saindo do bulevar (pintados no piso da praça)
  pracaCaminhos: [
    [[2.2, 13.6], [4.6, 14.4], [6.8, 15.0], [9.05, 16.0]],
    [[2.2, 13.6], [0.4, 13.6], [-1.0, 13.2], [-2.0, 13.05]],
    [[2.2, 13.6], [0.6, 15.0], [-1.6, 16.4], [-2.4, 17.6]],
    [[2.2, 13.6], [4.0, 15.6], [4.8, 17.6], [4.9, 19.4]],
    [[2.2, 13.6], [5.0, 13.2], [7.4, 12.8], [9.0, 12.6]],
  ],
  // Canteiro de obras (canto frontal esquerdo, fora do enquadramento da foto)
  canteiro: { poly: [[-31.2, 10.2], [-22.0, 10.8], [-19.4, 14.2], [-21.0, 19.4], [-31.2, 19.4]], c: [-26.0, 15.0] },
  // trilhas de terra batida que dividem a savana em 3 piquetes
  savanaTrilhas: [[[13.4, -1.75], [15.0, 0.8], [16.0, 5.3]], [[18.4, -1.91], [19.0, 0.4], [20.74, 0.5]]],
  // escarpa contínua de arenito entre a Vila e o recinto dos gorilas
  escarpa: [[20.9, 16.1], [22.47, 15.54], [23.77, 14.55], [25.39, 13.68], [26.8, 12.75], [27.5, 11.3], [27.9, 9.9]],
  // rochedos soltos de arenito
  rochas: [[21.8, 17.6, 0.7], [23.0, 9.6, 0.6], [30.2, 18.6, 0.8]],
  // Vias cinzas no nível do chão (como na foto): a do canteiro, que contorna o Anel pelo oeste até o
  // Campus Universitário, e a do leste, que desce do Santuário por fora do Bioma e da Vila até os gorilas
  vias: [
    { id: 'oeste', pts: [[-19.6, 16.4], [-21.4, 15.0], [-23.4, 13.2], [-25.4, 10.8], [-26.8, 7.4], [-26.6, 3.8], [-25.0, 1.2]], w: 0.45 },
    { id: 'leste', pts: [[29.0, -2.4], [30.0, 1.2], [30.4, 5.4], [30.4, 9.0], [30.0, 12.2], [29.6, 14.8], [29.6, 17.8]], w: 0.45 },
  ],
};

// Passarelas elevadas (pontos x, z, altura). Cada uma começa e termina num ponto físico (prédio,
// praça ou chão); 'frente2' e 'caracol' só aparecem com os projetos pas_frente2 e pas_caracol.
export const PASSARELAS = {
  bulevar: { nome: 'Bulevar Verde', pts: [[-1.8, 16.0, 0.08], [2.2, 13.6, 0.7], [6.4, 12.4, 0.75], [9.7, 12.25, 0.6]], w: 0.9 },
  ponte: { nome: 'Ponte do Instituto', pts: [[1.5, 4.7, 0.8], [4.8, 5.4, 1.0], [8.5, 6.1, 0.8]], w: 0.55 },
  trilhaBioma: { nome: 'Trilha do Bioma', pts: [[25.2, -2.95, 0.8], [28.2, 0.6, 0.85], [29.0, 5.4, 0.9], [29.1, 10.4, 0.85], [28.8, 13.6, 0.5], [29.4, 15.4, 0.1]], w: 0.6 },
  elo: { nome: 'Elo do Santuário', pts: [[14.0, 2.0, 0.8], [14.6, 0.2, 0.9], [15.6, -1.6, 0.9], [17.2, -2.75, 0.8]], w: 0.6 },
  vila: { nome: 'Passarela da Vila', pts: [[16.47, 9.78, 0.93], [19.2, 9.0, 0.9], [22.6, 8.6, 0.8], [25.2, 9.4, 0.45], [26.4, 9.9, 0.1]], w: 0.55 },
  frente: { nome: 'Caminho da Frente', pts: [[-19.6, 17.8, 0.12], [-17.0, 18.4, 0.12], [-14.0, 18.88, 0.12], [-10.0, 19.28, 0.12], [-7.6, 19.3, 0.12], [-4.0, 19.35, 0.12], [-0.4, 19.35, 0.12]], w: 0.6 },
  anel: { nome: 'Passeio do Anel', pts: [[-21.8, 10.6, 0.1], [-20.2, 13.4, 0.4], [-17.6, 15.9, 0.55], [-14.0, 17.68, 0.6], [-10.0, 18.08, 0.55], [-7.6, 17.75, 0.5], [-5.6, 17.1, 0.35], [-3.8, 16.3, 0.1]], w: 0.5 },
  santuario: { nome: 'Passeio do Santuário', pts: [[27.4, -3.2, 0.8], [29.8, -4.6, 0.85], [31.0, -7.8, 0.85], [30.4, -11.8, 0.8], [28.0, -14.4, 0.5], [24.6, -15.4, 0.25], [21.6, -15.6, 0.1]], w: 0.55 },
  // fita elevada da frente: sai do chão ao lado do canteiro, corre entre o Passeio do Anel e o Caminho da Frente
  // (as três fitas em camadas da foto) e desce até o piso da praça
  frente2: { nome: 'Fita da Frente', pts: [[-20.2, 15.9, 0.1], [-17.4, 17.1, 0.6], [-14.0, 18.26, 0.95], [-10.0, 18.65, 1.0], [-6.8, 18.55, 0.95], [-4.2, 17.6, 0.7], [-2.4, 16.6, 0.1]], w: 0.45 },
  // rampa em "S" do chão do vale até o terraço do 3º pavimento do Anel, pelo lado de fora
  caracol: { nome: 'Caracol do Anel', pts: [[3.9, 11.2, 0.1], [4.4, 9.6, 0.35], [3.0, 8.8, 0.6], [4.2, 7.6, 0.85], [2.9, 6.9, 1.05], [2.05, 7.4, 1.2]], w: 0.45 },
};

// Pasto dos animais resgatados, atrás da pista do Santuário (clareira com cerca)
export const SANTUARIO_GRAMADO = { elipse: [[15.8, -15.6], 4.2, 1.5, -0.06] };

// Zonas de chão (pintura do terreno e clareiras da mata). 'quando' = id da etapa que faz a zona aparecer.
// Só elipses e polígonos de poucos lados: o terreno e a mata consultam todas as zonas em cada ponto (a carga
// fica tão rápida quanto antes). A fita do Santuário não precisa de clareira: é alta e fechada, e a mata
// fica por dentro da pista, como na foto.
const sd = A.sede;
export const ZONAS = [
  { id: 'anel', tipo: 'grama', elipse: [A.anel.c, A.anel.rx + 0.8, A.anel.rz + 0.8, A.anel.rot] },
  { id: 'uni', tipo: 'grama', elipse: [[-20.4, -9.2], 6.0, 7.8, 0.2] }, // a fita em C, o pátio, a ala alta e o campo
  { id: 'uni', tipo: 'grama', elipse: [[-17.4, -1.0], 3.6, 1.4, -0.35] }, // Elo Norte
  { id: 'ciencias', tipo: 'grama', elipse: [A.ciencias.c, A.ciencias.rx + 1.2, A.ciencias.rz + 1.6, A.ciencias.rot] },
  { id: 'sede', tipo: 'grama', elipse: [sd.c, sd.rx + 1.2, sd.rz + 1.2, sd.rot] }, // a fita aberta e o pátio até o lago
  { id: 'santuarioPasto', tipo: 'pasto', elipse: SANTUARIO_GRAMADO.elipse },
  { id: 'biblio', tipo: 'grama', elipse: [A.biblio.c, 8.8, 8.2, 0] },
  { id: 'savana', tipo: 'pasto', poly: A.savana.poly },
  { id: 'bioma', tipo: 'grama', elipse: [A.bioma.c, A.bioma.r + 1.2, A.bioma.r + 1.2, 0] },
  { id: 'vila', tipo: 'grama', elipse: [[21.6, 13.6], 5.4, 2.8, 0] },
  { id: 'gorilas', tipo: 'grama', elipse: [A.gorilas.c, A.gorilas.rx + 0.9, A.gorilas.rz + 0.9, 0] },
  { id: 'acelerador', tipo: 'grama', elipse: [A.acelerador.c, A.acelerador.rx + 1.6, A.acelerador.rz + 1.3, 0] },
  { id: 'praca', tipo: 'praca', poly: A.praca.poly },
  { id: 'corredor', tipo: 'praca', poly: [[1.6, 1.2], [6.05, 1.0], [8.2, 4.6], [7.6, 9.8], [3.6, 10.6], [1.2, 6.0]] },
  { id: 'canteiro', tipo: 'canteiro', poly: A.canteiro.poly },
];
