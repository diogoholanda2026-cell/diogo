// Planta mestra da maquete, traçada a partir da foto "Composição total da Arcologia de Held"
// retificada (vista de cima). Coordenadas em unidades da mesa: x de -32 (esquerda) a 32 (direita),
// z de -20 (fundo) a 20 (frente, onde fica a placa).
export const MESA = { x0: -32, x1: 32, z0: -20, z1: 20 };

// Vista que reproduz o enquadramento da foto de referência.
export const VISTA_FOTO = { x: 6.89, z: 6.84, dist: 54.9, yaw: 0.493, pitch: 0.612, fov: 32, roll: -0.172 };

// Âncoras de cada conjunto (usadas pelos modelos 3D, pelo terreno e pela floresta).
export const A = {
  // Anel do Campus: grande anel elíptico em terraços (Escola e Campus Jovem + faculdades)
  anel: { c: [-9.6, 8.4], rx: 11.4, rz: 9.2, rot: -0.1 },
  campo: { c: [-6.8, 9.2], w: 5.6, d: 3.4, rot: -0.28 },
  // Campus Universitário (fundo à esquerda)
  uni: { c: [-21.5, -12.8], rx: 8.2, rz: 5.6, rot: 0.15 },
  // Faculdade de Ciências Avançadas e Tecnologia (forma orgânica com laboratórios em corte)
  ciencias: { c: [-6.5, -1.4], rx: 7.4, rz: 3.0, rot: -0.12 },
  // Lago central
  lago: [[-9.2, -10.2], [-5.6, -12.4], [-0.8, -12.6], [3.6, -11.4], [6.8, -9.0], [7.2, -5.8], [4.4, -3.8], [0.4, -4.6], [-3.4, -4.0], [-7.2, -5.2], [-9.6, -7.6]],
  ilha: { c: [-0.8, -8.2], r: 1.4 },
  // Sede Administrativa da Holding Guarda-Chuva (anel de vidro ao fundo)
  sede: { c: [4.8, -15.2], rx: 7.0, rz: 4.2, rot: 0.06 },
  // Biblioteca Central (torre) + Centro de Recursos Digitais (abóbada) + anel em terraços
  biblio: { c: [13.4, 7.4], r: 3.15, canopy: 9.6, canopyRot: 0.12, canopyY: 6.75 },
  anelBib: { c: [13.4, 7.4], r0: 3.7, r1: 6.5, a0: 1.5, a1: 4.6 },
  // Santuário de Animais e Centro de Conservação (anel alongado em forma de pista)
  santuario: { c: [17.8, -10.2], rx: 12.2, rz: 5.2, rot: -0.04 },
  // Habitats expandidos (savana)
  savana: { poly: [[10.6, -3.4], [16.4, -4.2], [20.6, -2.6], [20.4, 1.6], [18.8, 5.8], [15.6, 6.4], [12.6, 3.2]] },
  // Bioma Aquático de Conservação (cúpula geodésica)
  bioma: { c: [23.0, 4.6], r: 3.9 },
  // Vila Estudantil Expandida: anfiteatro + casas
  anfiteatro: { c: [20.0, 13.2], r: 2.8 },
  vila: { c: [24.2, 13.4], w: 4.4, d: 2.6 },
  // Recinto dos gorilas
  gorilas: { c: [27.0, 17.3], rx: 3.2, rz: 2.2 },
  // Acelerador de partículas subterrâneo & Centro de Física
  acelerador: { c: [14.3, 17.4], rx: 2.9, rz: 1.8 },
  // Praça central
  praca: { poly: [[-2.5, 12.6], [3.0, 11.6], [8.6, 12.4], [12.0, 14.8], [11.6, 19.4], [0.0, 19.6], [-3.4, 17.2]] },
  lagosPraca: [{ c: [0.6, 16.6], rx: 2.2, rz: 1.0, rot: -0.1 }, { c: [7.6, 15.8], rx: 1.3, rz: 0.8, rot: 0.3 }],
  // Canteiro de obras (canto frontal esquerdo, fora do enquadramento da foto)
  canteiro: { poly: [[-31.2, 10.2], [-22.0, 10.8], [-19.4, 14.2], [-21.0, 19.4], [-31.2, 19.4]], c: [-26.0, 15.0] },
  // Rochedos de arenito ao redor da vila e dos gorilas
  rochas: [[24.6, 11.6, 1.2], [26.4, 12.2, 1.0], [29.2, 13.0, 1.3], [23.2, 16.2, 0.9], [30.0, 16.0, 1.1], [21.4, 11.0, 0.7], [29.8, 9.8, 0.9]],
};

// Passarelas elevadas (pontos x, z, altura)
export const PASSARELAS = {
  bulevar: { nome: 'Bulevar Verde', pts: [[-1.8, 16.0, 0.35], [2.2, 13.6, 0.7], [6.4, 12.4, 0.75], [9.6, 12.2, 0.6]], w: 0.9 },
  ponte: { nome: 'Ponte do Instituto', pts: [[1.4, 4.6, 0.9], [4.8, 5.3, 1.0], [7.6, 5.8, 0.9]], w: 0.55 },
  trilhaBioma: { nome: 'Trilha do Bioma', pts: [[25.8, 1.6, 0.5], [27.4, 4.6, 0.85], [26.6, 8.6, 0.9], [28.6, 12.2, 0.85], [29.0, 15.2, 0.6]], w: 0.6 },
  elo: { nome: 'Elo do Santuário', pts: [[8.8, -3.0, 0.8], [12.2, -4.8, 1.0], [15.6, -5.2, 0.9]], w: 0.6 },
  vila: { nome: 'Passarela da Vila', pts: [[16.2, 10.6, 0.7], [19.2, 9.8, 0.85], [22.8, 9.4, 0.8], [25.6, 10.0, 0.6]], w: 0.55 },
  frente: { nome: 'Caminho da Frente', pts: [[-19.0, 17.2, 0.12], [-12.0, 19.0, 0.12], [-4.0, 19.3, 0.12]], w: 0.8 },
};

// Zonas de chão (pintura do terreno). 'quando' = id da etapa que faz a zona aparecer.
export const ZONAS = [
  { id: 'anel', tipo: 'grama', elipse: [A.anel.c, A.anel.rx + 0.8, A.anel.rz + 0.8, A.anel.rot] },
  { id: 'uni', tipo: 'grama', elipse: [A.uni.c, A.uni.rx + 0.6, A.uni.rz + 0.6, A.uni.rot] },
  { id: 'ciencias', tipo: 'grama', elipse: [A.ciencias.c, A.ciencias.rx + 1.2, A.ciencias.rz + 1.6, A.ciencias.rot] },
  { id: 'sede', tipo: 'grama', elipse: [A.sede.c, A.sede.rx + 1.4, A.sede.rz + 1.2, A.sede.rot] },
  { id: 'biblio', tipo: 'grama', elipse: [A.biblio.c, 8.8, 8.2, 0] },
  { id: 'savana', tipo: 'areia', poly: A.savana.poly },
  { id: 'bioma', tipo: 'grama', elipse: [A.bioma.c, A.bioma.r + 1.2, A.bioma.r + 1.2, 0] },
  { id: 'vila', tipo: 'grama', elipse: [[21.4, 14.0], 5.4, 2.8, 0] },
  { id: 'gorilas', tipo: 'grama', elipse: [A.gorilas.c, A.gorilas.rx + 0.7, A.gorilas.rz + 0.7, 0] },
  { id: 'acelerador', tipo: 'grama', elipse: [A.acelerador.c, A.acelerador.rx + 1.6, A.acelerador.rz + 1.3, 0] },
  { id: 'praca', tipo: 'praca', poly: A.praca.poly },
  { id: 'canteiro', tipo: 'canteiro', poly: A.canteiro.poly },
];
// Áreas sem árvores (clareiras): as zonas acima + faixa das passarelas
export const SANTUARIO_GRAMADO = { elipse: [[12.4, -12.6], 4.6, 2.4, -0.1] };
