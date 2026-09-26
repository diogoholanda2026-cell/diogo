// Planta mestra da maquete, traçada a partir da foto "Composição total da Arcologia de Held"
// retificada (vista de cima). Coordenadas em unidades da mesa: x de -32 (esquerda) a 32 (direita),
// z de -20 (fundo) a 20 (frente, onde fica a placa).
export const MESA = { x0: -32, x1: 32, z0: -20, z1: 20 };

// Vista que reproduz o enquadramento da foto de referência.
export const VISTA_FOTO = { x: 6.89, z: 6.84, dist: 54.9, yaw: 0.493, pitch: 0.612, fov: 32, roll: -0.172 };

// pista (retângulo arredondado, superelipse): forma antiga do Santuário, mantida para quem ainda a usa
export function pistaPts(cx, cz, rx, rz, rot, n = 220) {
  const out = []; const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const ca = Math.cos(a), sa = Math.sin(a); const k = 3.2; const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / k) * rx, z = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / k) * rz; out.push([cx + x * c - z * s, cz + x * s + z * c]); }
  return out;
}
// pegada aproximada de um trecho de fita: um quadrilátero por segmento da polilinha (alongado 0,3 nas pontas),
// entre os deslocamentos oA e oB da normal [tz, -tx] (a mesma convenção de geom.normals para caminhos abertos)
function pegadaFita(pts, oA, oB) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; let tx = bx - ax, tz = bz - az; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = tz, nz = -tx;
    const a = [ax - tx * 0.3, az - tz * 0.3], b = [bx + tx * 0.3, bz + tz * 0.3];
    out.push([[a[0] + nx * oA, a[1] + nz * oA], [b[0] + nx * oA, b[1] + nz * oA], [b[0] + nx * oB, b[1] + nz * oB], [a[0] + nx * oB, a[1] + nz * oB]]);
  }
  return out;
}

// Âncoras de cada conjunto (usadas pelos modelos 3D, pelo terreno e pela floresta). Nos polígonos, cada ponto
// tem ao menos uma coordenada fracionária: um par só de inteiros vira outro tipo de vetor no motor de JS e deixa
// as consultas do terreno (feitas para cada vértice) mais de 2 vezes mais lentas.
export const A = {
  // Anel do Campus: grande anel elíptico em terraços (Escola e Campus Jovem + faculdades)
  anel: { c: [-9.6, 8.4], rx: 11.4, rz: 9.2, rot: -0.1 },
  campo: { c: [-6.8, 9.2], w: 5.6, d: 3.4, rot: -0.28 },
  // Campus Universitário: arena elíptica rasa (parede vertical de células, aberta para a frente) com cinco torres na
  // platibanda; na frente, a ala do portal (8 faixas finas com plano inclinado e tambor), a fita reta de 2 pavimentos e
  // o laço em U com a escadaria-jardim; o campo com pista fica dentro do oval; o Elo desce pelo oeste até o Anel
  uni: { c: [-17.0, -8.8],
    arena: { c: [-15.6, -12.2], rx: 7.7, rz: 3.8, rot: 0, a0: 2.95, a1: 5.64, torres: [0.17, 0.36, 0.51, 0.68, 0.94], torreW: [2.0, 1.2, 1.6, 2.0, 2.0], torreH: [1.1, 0.88, 0.88, 0.88, 1.1] },
    elo: [[-23.3, -11.7], [-25.6, -9.4], [-25.0, -5.0], [-20.6, -1.6], [-14.2, 0.1]],
    campo: { c: [-18.0, -12.2], w: 4.0, d: 2.4, rot: -0.1, pista: { c: [-16.8, -12.1], rx: 3.3, rz: 1.5, rot: -0.1 } },
    ala: { c: [-21.5, -10.2], w: 3.6, d: 1.2, rot: 0.15, faixas: 8, rampa: 1.1, tambor: { r: 0.5, h: 1.0 } },
    frente: [[-19.5, -9.7], [-14.6, -10.3]], laco: { c: [-12.6, -11.8], w: 3.0, d: 2.6, fita: 0.9, degraus: 8 }, rampa: [[-9.8, -13.6], [-10.9, -12.0]] },
  // Faculdade de Ciências Avançadas e Tecnologia (platô de concreto com células de vidro espelhado)
  ciencias: { c: [-5.9, -1.7], rx: 7.4, rz: 3.0, rot: -0.12, // (z -1.7: a frente dos lóbulos não entra na fita do Anel)
    // espelho em gota do vale urbanizado (em (4.0, 3.8) batia na Ponte do Instituto) e o canal até o bulevar
    gota: { c: [5.0, 3.4], rx: 1.3, rz: 0.85, rot: 0.25, canal: [[5.3, 6.4], [5.2, 9.6]] } },
  // Lago central (corpo principal, baía a leste do passeio em S e a piscina redonda num só corpo de água); sem ilha (r 0)
  lago: [[-3.0, -9.2], [-1.7, -9.9], [0.9, -10.2], [2.4, -10.0], [3.8, -9.6], [4.4, -10.9], [5.8, -10.3], [6.5, -9.1], [5.9, -7.3], [5.7, -5.7], [4.6, -5.0], [2.7, -4.7], [1.4, -4.1], [-0.3, -4.3], [-2.3, -6.1], [-3.0, -7.8]],
  ilha: { c: [3.9, -7.5], r: 0 },
  // Sede Administrativa da Holding Guarda-Chuva: anel elíptico aberto (path = eixo da borda externa, do fundo à esquerda
  // pelo fundo e pelo leste até o canto sudeste) com varandas brancas contínuas; o0 = largura da fita (para dentro).
  // interna = a segunda fita concêntrica do leste (alta, 4 pavimentos) que segue baixa (2 pavimentos) até a Ciências.
  // rx, rz, rot, a0, a1 = arco legado (quem ainda desenha a Sede por elipse). Rótulo e zona continuam em c.
  // repasse = onde aparece o balão dos repasses: sobre o meio do 2º módulo (= W.faixas.sede.centro(1)), acima do teto
  sede: { c: [2.4, -8.2], rx: 10.6, rz: 5.9, rot: 0.04, a0: 4.0, a1: 6.9, o0: -2.1,
    path: [[-6.6, -9.6], [-5.6, -11.6], [-3.0, -13.3], [0.3, -13.9], [3.8, -13.8], [7.2, -12.8], [10.0, -10.8], [11.9, -8.5], [12.4, -5.9], [12.9, -3.6], [12.5, -2.2]],
    interna: { alta: [[8.2, -12.8], [9.0, -11.0], [9.4, -8.6], [9.2, -5.8], [8.6, -3.6]], baixa: [[8.6, -3.6], [7.6, -1.9], [6.4, -1.0], [4.8, -0.8], [3.2, -1.3], [1.5, -1.9]] },
    piscina: { c: [5.1, -8.9], r: 1.3 }, pavilhao: { c: [1.2, -10.7], w: 1.8, d: 1.0, rot: 0.05, h: 0.6 }, repasse: [2.44, 2.7, -12.89] },
  // Biblioteca Central (torre) + Centro de Recursos Digitais (casco em leque) + anel em terraços
  // (jardim de cobertura quadrado de 6.5 de lado a 5.2 de altura, com um lado encarando a câmera: canopyRot -0.125.
  // Torre em vaso de raio 2.75: ~160 px de largura, como na foto. O CRD fica à frente, com posição própria)
  biblio: { c: [14.9, 8.1], r: 2.75, canopy: 6.5, canopyRot: -0.125, canopyY: 5.2, crd: { c: [14.2, 12.9], rot: -0.32 } },
  anelBib: { c: [14.9, 8.1], r0: 3.7, r1: 6.5, a0: 2.9, a1: 4.6 }, // do lado esquerdo ao fundo (a frente fica com o CRD)
  // Santuário de Animais e Centro de Conservação: fita aberta em "6" (laço = duas voltas encostadas, o eixo corre na
  // fresta entre elas: interna, U e externa; a rampa em 3 patamares desce da ponta oeste até a Sede ao longo do campo
  // de rúgbi). lago = lagoa clara em trevo com ilhota (relevo); lago2 = lagoa escura (só pintura); piquete = terra com
  // muro de pedra clara entre a ponta e a cúpula; caminhos cinza a oeste da lagoa. c, rx, rz, rot = zona, foco e rótulo
  santuario: { c: [21.4, -7.8], rx: 8.4, rz: 5.0, rot: -0.04,
    laco: { interna: [[27.0, -11.4], [28.0, -9.8], [27.9, -8.0], [26.9, -6.6], [25.6, -5.5], [24.4, -4.7]], u: [[23.75, -4.45], [23.45, -4.15]],
      externa: [[24.2, -4.4], [25.5, -5.2], [26.8, -6.3], [27.9, -7.9], [28.4, -9.6], [28.0, -11.0], [25.0, -12.3], [22.0, -12.4], [19.3, -12.2]] },
    rampa: [[11.2, -12.0], [13.9, -12.3], [16.6, -12.3], [19.3, -12.2]],
    lago: { c: [21.5, -9.7], rx: 1.0, rz: 0.85, rot: 0.3, ilha: { c: [21.4, -10.1], r: 0.22 } }, lago2: { c: [21.7, -11.6], rx: 1.45, rz: 0.7, rot: -0.1 },
    piquete: [[19.9, -5.0], [21.0, -6.4], [22.1, -6.3], [22.7, -4.5], [22.7, -2.7], [22.2, -0.4], [21.6, 0.1], [20.6, -0.8], [19.7, -3.0]],
    caminhos: [[[17.2, -11.2], [19.1, -7.8], [18.7, -5.8], [19.9, -5.0]]] },
  // Habitats expandidos (piquetes de pasto entre o Santuário, a Biblioteca e o Bioma; o norte abriga o Centro de
  // Reabilitação); lago = bebedouro pequeno
  savana: { poly: [[13.1, -1.5], [15.0, -3.4], [19.6, -2.0], [20.6, -1.7], [20.8, 1.4], [19.4, 5.4], [16.8, 6.4], [14.8, 3.6], [14.4, 0.6]],
    lago: { c: [17.6, 3.4], rx: 0.6, rz: 0.4, rot: 0.2 },
    // 3 piquetes de pasto separados pelas trilhas (esquerda, meio, fundo à direita)
    piquetes: [[[13.4, -1.75], [15.0, 0.8], [16.0, 5.3], [14.8, 3.6], [14.4, 0.6], [13.1, -1.5]],
      [[13.4, -1.75], [16.4, -2.1], [18.4, -1.91], [19.0, 0.4], [20.74, 0.5], [20.8, 1.4], [19.4, 5.4], [16.8, 6.4], [16.0, 5.3], [15.0, 0.8]],
      [[18.4, -1.91], [20.6, -1.7], [20.74, 0.5], [19.0, 0.4]]] },
  // Bioma Aquático de Conservação (cúpula geodésica) e o pasto dos elefantes em frente
  bioma: { c: [24.6, 4.0], r: 3.1, pasto: { c: [24.3, 8.2], rx: 1.8, rz: 0.8 } },
  // Vila Estudantil Expandida: anfiteatro + casas
  anfiteatro: { c: [20.6, 11.6], r: 2.5 },
  // faixa diagonal de casas do penhasco (sudoeste) ao Bioma (nordeste): 6 caixas de tamanhos diferentes em coordenadas
  // locais (+x = nordeste/Bioma, +z = frente/penhasco); tipo: 'barra' (3 pavimentos), 'gable' (duas águas), 'grande'
  vila: { c: [24.3, 12.4], w: 4.2, d: 2.3, rot: 0.62, mods: [
    { c: [-1.3, 0.5], w: 1.0, d: 0.55, tipo: 'barra' }, { c: [-0.35, 0.55], w: 0.5, d: 0.6, tipo: 'gable' }, { c: [0.5, 0.55], w: 0.8, d: 0.8 },
    { c: [-1.35, -0.5], w: 0.8, d: 0.8 }, { c: [-0.3, -0.5], w: 1.1, d: 0.9 }, { c: [1.05, -0.5], w: 1.4, d: 1.1, tipo: 'grande' }] },
  // Recinto dos gorilas (cerca de vidro por dentro da galeria anelar de deque)
  gorilas: { c: [26.2, 17.0], rx: 2.8, rz: 2.3 },
  // Acelerador de partículas subterrâneo & Centro de Física
  acelerador: { c: [11.9, 17.6], rx: 2.6, rz: 1.7 },
  // Praça central (o bordo sul recua para a faixa de grama e a via em S)
  praca: { poly: [[-2.5, 12.6], [3.0, 11.6], [8.6, 12.4], [9.6, 14.8], [9.2, 18.3], [0.0, 18.5], [-3.4, 16.6]] },
  lagosPraca: [{ c: [1.2, 16.8], rx: 2.1, rz: 0.95, rot: -0.15 }, { c: [7.0, 16.4], rx: 1.15, rz: 0.75, rot: 0.3 }],
  // caminhos curvos em leque saindo do bulevar (pintados no piso da praça)
  pracaCaminhos: [
    [[2.2, 13.6], [4.6, 14.4], [6.8, 15.0], [9.05, 16.0]],
    [[2.2, 13.6], [0.4, 13.6], [-1.0, 13.2], [-2.0, 13.05]],
    [[2.2, 13.6], [0.6, 15.0], [-1.6, 16.4], [-2.4, 16.9]],
    [[2.2, 13.6], [4.0, 15.6], [4.8, 17.6], [4.9, 18.2]],
    [[2.2, 13.6], [5.0, 13.2], [7.4, 12.8], [9.0, 12.6]],
  ],
  // Canteiro de obras (canto frontal esquerdo, fora do enquadramento da foto)
  canteiro: { poly: [[-31.2, 10.2], [-22.0, 10.8], [-19.4, 14.2], [-21.0, 19.4], [-31.2, 19.4]], c: [-26.0, 15.0] },
  // trilhas de terra batida que dividem a savana em 3 piquetes
  savanaTrilhas: [[[13.4, -1.75], [15.0, 0.8], [16.0, 5.3]], [[18.4, -1.91], [19.0, 0.4], [20.74, 0.5]]],
  // escarpa contínua de arenito entre a Vila e o recinto dos gorilas (crista a 0,6 da fachada sul das casas)
  escarpa: [[19.8, 15.9], [20.9, 15.8], [22.5, 15.2], [23.8, 14.2], [25.4, 13.4], [26.8, 12.7], [27.5, 11.3], [27.9, 9.9]],
  // rochedos soltos de arenito
  rochas: [[21.8, 17.6, 0.7], [23.0, 9.6, 0.6], [30.2, 18.6, 0.8], [18.9, 2.6, 0.6]],
  // Vias cinzas no nível do chão (como na foto): a do canteiro, que contorna o Anel pelo oeste até o Campus
  // Universitário; a do leste, que desce do Santuário por fora do Bioma e da Vila e morre sob a galeria dos gorilas;
  // e a via em S ao sul da praça (aparece com a praça)
  vias: [
    { id: 'oeste', pts: [[-19.6, 16.4], [-21.4, 15.0], [-23.4, 13.2], [-25.4, 10.8], [-26.8, 7.4], [-26.6, 3.8], [-25.0, 1.2]], w: 0.45 },
    { id: 'leste', pts: [[29.0, -2.4], [30.0, 1.2], [30.4, 5.4], [30.4, 9.0], [30.0, 12.2], [28.3, 12.6], [27.3, 15.0]], w: 0.45 },
    { id: 'sul', pts: [[-3.2, 19.95], [0.5, 19.75], [4.0, 19.5], [7.0, 19.35], [8.9, 19.6], [9.8, 20.0]], w: 0.62, quando: 'praca' },
  ],
  // trilhas bege pela mata (norte da Sede e oeste do Anel, ligada à via oeste)
  trilhasMata: [
    { id: 'norte', pts: [[-14.0, -17.6], [-6.0, -17.9], [2.0, -18.0], [9.0, -17.4], [12.4, -16.2]] },
    { id: 'anelOeste', pts: [[-21.9, 6.0], [-24.0, 5.2], [-26.6, 3.8]] },
  ],
  // aldeia de casinhas de telhado terracota a oeste do Anel, entre ciprestes
  aldeia: { c: [-27.5, 3.0], rx: 3.2, rz: 2.6, n: 9 },
};
// onde a mata não nasce: a pegada da fita do Santuário (eixo o0 - 0,28 a o1 + 0,28) e da rampa
{ const l = A.santuario.laco; const eixo = [...l.interna, ...l.u, ...l.externa, ...[...A.santuario.rampa].reverse().slice(1)]; A.semMata = pegadaFita(eixo, -1.48, 0.28); }

// Passarelas elevadas (pontos x, z, altura). Cada uma começa e termina num ponto físico (prédio,
// praça ou chão); 'frente2' e 'caracol' só aparecem com os projetos pas_frente2 e pas_caracol.
export const PASSARELAS = {
  bulevar: { nome: 'Bulevar Verde', pts: [[-1.8, 16.0, 0.08], [2.2, 13.6, 0.7], [6.4, 12.4, 0.75], [9.7, 12.25, 0.6]], w: 0.9 },
  ponte: { nome: 'Ponte do Instituto', pts: [[1.5, 4.7, 0.8], [4.8, 5.4, 1.0], [8.5, 6.1, 1.19]], w: 0.55 },
  // da base da ponta do Santuário, pelo leste do Bioma, até o ponto norte da galeria dos gorilas
  trilhaBioma: { nome: 'Trilha do Bioma', pts: [[24.2, -3.2, 0.3], [28.2, 0.6, 0.85], [29.0, 5.4, 0.9], [29.1, 10.4, 0.85], [28.0, 12.8, 1.0], [26.2, 14.75, 1.05]], w: 0.6 },
  // da 2ª laje do Anel da Biblioteca, ao norte das cunhas da Reabilitação, até o muro oeste do piquete
  elo: { nome: 'Elo do Santuário', pts: [[14.0, 2.0, 1.19], [14.4, -1.2, 1.0], [15.2, -4.0, 0.9], [17.6, -5.2, 0.8], [19.6, -4.4, 0.3]], w: 0.6 },
  // da laje E da Biblioteca, contornando o pasto dos elefantes, até o portal direito do Bioma
  vila: { nome: 'Passarela da Vila', pts: [[16.2, 9.45, 0.8], [19.2, 9.0, 0.9], [21.4, 8.65, 0.9], [23.4, 9.45, 0.85], [25.8, 9.4, 0.75], [27.0, 8.0, 0.65], [27.4, 5.7, 0.55]], w: 0.55 },
  frente: { nome: 'Caminho da Frente', pts: [[-20.45, 17.72, 0.12], [-17.0, 18.4, 0.12], [-14.0, 18.88, 0.12], [-10.0, 19.28, 0.12], [-7.6, 19.3, 0.12], [-4.0, 19.35, 0.12], [-0.8, 19.1, 0.12]], w: 0.9 },
  anel: { nome: 'Passeio do Anel', pts: [[-21.8, 10.6, 0.1], [-20.2, 13.4, 0.6], [-17.6, 15.9, 0.85], [-14.0, 17.68, 0.95], [-10.0, 18.08, 0.85], [-7.6, 17.75, 0.75], [-5.6, 17.1, 0.5], [-3.8, 16.3, 0.1]], w: 0.85 },
  // caminho no chão rente ao flanco leste da cúpula, da ponta do Santuário até o pasto
  santuario: { nome: 'Passeio do Santuário', pts: [[22.75, -4.1, 0.1], [24.6, -1.7, 0.1], [26.6, 1.2, 0.1], [27.6, 5.2, 0.1]], w: 0.45 },
  // fita elevada da frente: sai do chão ao lado do canteiro, corre entre o Passeio do Anel e o Caminho da Frente
  // (as três fitas em camadas da foto) e desce até o piso da praça
  frente2: { nome: 'Fita da Frente', pts: [[-20.2, 15.9, 0.1], [-17.4, 17.5, 0.6], [-14.0, 18.66, 0.95], [-10.0, 19.05, 1.0], [-6.8, 18.95, 0.95], [-4.2, 18.0, 0.7], [-2.4, 16.6, 0.1]], w: 0.8 },
  // rampa em "S" do piso do vale (ao lado do fim do canal) até o Anel, pelo lado de fora: termina num patamar
  // próprio sobre pilares, encostado no módulo 7 do Anel a 1.28 (o terraço do teto com 3 andares, ou o piso do
  // 4º andar com 4 ou 5)
  caracol: { nome: 'Caracol do Anel', pts: [[4.5, 10.2, 0.08], [4.65, 9.3, 0.3], [3.0, 8.8, 0.6], [4.2, 7.6, 0.85], [2.9, 6.9, 1.08], [2.05, 7.4, 1.28]], w: 0.45,
    patamar: { c: [2.09, 7.46], w: 1.0, d: 0.56, rot: -0.03, em: 'anel' } },
};

// Campo de rúgbi ao norte da rampa do Santuário: elipse do gramado, orla clara (trilhas) e as 9 linhas brancas
// (frações do semieixo x; a 'curta' é a linha menor do meio), sem traves
export const SANTUARIO_GRAMADO = { elipse: [[13.8, -15.6], 3.7, 1.5, -0.06],
  trilhas: [{ elipse: [[13.8, -15.6], 3.55, 1.35, -0.06], w: 0.05 }], linhas: [-0.92, -0.73, -0.53, -0.32, -0.05, 0.12, 0.40, 0.50, 0.62], curta: 0.12 };

// Zonas de chão (pintura do terreno e clareiras da mata). 'quando' = id da etapa que faz a zona aparecer.
// Só elipses e polígonos de poucos lados: o terreno e a mata consultam todas as zonas em cada ponto (a carga
// fica tão rápida quanto antes). tipo 'terra' = piquete de terra batida (piso de solo com véu pardo).
export const ZONAS = [
  { id: 'anel', tipo: 'grama', elipse: [A.anel.c, A.anel.rx + 0.8, A.anel.rz + 0.8, A.anel.rot] },
  { id: 'uni', tipo: 'grama', elipse: [[-15.8, -12.6], 8.6, 4.8, 0] }, { id: 'uni', tipo: 'grama', elipse: [[-15.5, -11.2], 7.0, 1.8, -0.1] }, // a arena, o campo, a ala, a frente e o laço
  { id: 'uni', tipo: 'grama', elipse: [[-24.6, -7.4], 2.0, 4.0, 0] }, { id: 'uni', tipo: 'grama', elipse: [[-22.8, -3.3], 3.2, 1.6, 0.66] }, { id: 'uni', tipo: 'grama', elipse: [[-17.6, -0.8], 4.2, 1.6, 0.26] }, // Elo Norte
  { id: 'ciencias', tipo: 'grama', elipse: [A.ciencias.c, A.ciencias.rx + 1.2, A.ciencias.rz + 1.6, A.ciencias.rot] },
  { id: 'sede', tipo: 'grama', elipse: [[2.6, -7.6], 11.8, 7.9, 0.15] }, { id: 'sede', tipo: 'grama', elipse: [[7.6, -1.2], 6.4, 2.4, -0.25] }, // o anel, o pátio até o lago e a fita baixa
  { id: 'santuarioPasto', tipo: 'pasto', elipse: SANTUARIO_GRAMADO.elipse },
  { id: 'santuario', tipo: 'grama', elipse: [[15.9, -9.6], 1.3, 0.9, 0.3] }, { id: 'santuario', tipo: 'grama', elipse: [[17.3, -7.2], 1.1, 0.8, -0.2] }, // clareiras a oeste da lagoa
  { id: 'santuarioPiquete', tipo: 'terra', poly: A.santuario.piquete },
  { id: 'biblio', tipo: 'grama', elipse: [A.biblio.c, 8.8, 8.2, 0] },
  { id: 'savana', tipo: 'pasto', poly: A.savana.poly },
  { id: 'bioma', tipo: 'grama', elipse: [A.bioma.c, A.bioma.r + 0.75, A.bioma.r * 0.92 + 0.75, 0] },
  { id: 'bioma', tipo: 'pasto', elipse: [A.bioma.pasto.c, 2.1, 1.1, 0] }, // pasto dos elefantes
  { id: 'vila', tipo: 'grama', elipse: [[20.8, 12.0], 3.0, 3.0, 0] },
  { id: 'vila', tipo: 'grama', elipse: [[24.4, 12.0], 2.4, 1.4, -0.62] }, // a fileira na diagonal
  { id: 'gorilas', tipo: 'grama', elipse: [[26.4, 17.1], 3.3, 2.75, 0] }, { id: 'gorilas', tipo: 'grama', elipse: [[26.0, 19.7], 1.0, 0.6, 0] }, // a galeria e a clareira da rampa
  { id: 'acelerador', tipo: 'grama', elipse: [A.acelerador.c, A.acelerador.rx + 1.6, A.acelerador.rz + 1.3, 0] },
  { id: 'praca', tipo: 'praca', poly: A.praca.poly },
  { id: 'pracaSul', tipo: 'grama', poly: [[-3.6, 18.1], [9.4, 18.0], [9.9, 20.0], [-3.8, 20.0]] }, // talude gramado entre a praça e a via sul
  { id: 'corredor', tipo: 'praca', poly: [[1.6, 1.2], [6.05, 1.0], [8.2, 4.6], [7.6, 9.8], [3.6, 10.6], [1.2, 6.0]] },
  { id: 'canteiro', tipo: 'canteiro', poly: A.canteiro.poly },
];
