// Nomes das estruturas da Arcologia, em etiquetas no modo Apreciar (estilo BuildIt), no plano mestre "Trevo da Holding".
// 'se' = etapa (ou 'modulos.nível') que precisa estar concluída para o rótulo aparecer no Apreciar; 'obra' = projeto ou
// conjunto de módulos (o foco da folha aberta). pos = pé do rótulo [x, y, z] (centro da borda de baixo), lido de A
// (planta.js): o centro da peça ou um ponto da linha média da fita, com y 0,6 acima do teto (0,8 na Torre, que tem o
// helicóptero). As fitas longas levam o rótulo no meio (A[k].meio); a Vila no meio da casa 2 (o meio da fita cai no vão
// entre duas casas); a Escola, a Sede e a Praça num ponto que não briga com os vizinhos na vista padrão. 'curto' =
// legenda de maquete (até duas linhas de 16 caracteres, em maiúsculas pelo CSS); o nome longo fica na folha da obra.
import { A, noCaminho, trechosDe } from './planta.js';

const Y = 0.6;                                         // folga do pé do rótulo acima do teto
const R = (txt, curto, [x, z], y, se) => ({ txt, curto: curto || txt, pos: [x, Math.round(y * 100) / 100, z], se, obra: se.split('.')[0] });
const meio = (k) => A[k].meio;                         // meio da linha média de uma fita (noCaminho(pts, f): ponto na fração f)
const modulo = (k, i) => { const [f0, f1] = trechosDe(A[k])[i]; return noCaminho(A[k].caminho, (f0 + f1) / 2); }; // meio do trecho i
const mais = (c, dx, dz) => [c[0] + dx, c[1] + dz];
const fis = A.acelerador.crescente;
export const ROTULOS = [
  // ---- Holding: Torre, Sede, Anel e o portal da boca sul
  R('Torre da Holding\n(heliponto)', 'Torre da Holding', A.torre.c, A.torre.topo + 0.8, 'sede.e4'),
  R('Sede Administrativa da\nHolding Guarda-Chuva', 'Sede da Holding', noCaminho(A.sede.caminho, 0.275), A.sede.hMax + Y, 'sede.e2'),
  R('Anel do Campus', 'Anel do Campus', [A.anel.c[0] - A.anel.rx, A.anel.c[1]], A.anel.hMax + Y, 'anel.1'),
  R('Portal do Anel', 'Portal do Anel', noCaminho(A.portal.caminho, 0.5), A.portal.topo + 0.55, 'pas_anel.e1'),
  // ---- Escola (folha sudoeste)
  R('Escola e Campus para\nJovens (10-17 anos)', 'Escola e Campus\npara Jovens', noCaminho(A.escola.caminho, 0.38), A.escola.hMax + Y, 'escola.e1'),
  R('Campo e arquibancadas', 'Campo', A.campo.gramado.c, 1.0, 'campo.e2'),
  R('Pátio da Escola', 'Pátio da Escola', A.patios.escola.c, Math.max(...A.patios.escola.morros.map((m) => m.h)) + Y, 'escola.e2'),
  // ---- Universidade (folha sudeste)
  R('Campus Universitário\nEcológico', 'Campus\nUniversitário', meio('uni'), A.uni.torreTopo + Y, 'uni.1'),
  R('Faculdade de Ciências Avançadas\ne Tecnologia', 'Faculdade\nde Ciências', A.ciencias.c, A.ciencias.h + Y, 'ciencias.e1'),
  R('Faculdade de Engenharia\nSustentável', 'Engenharia\nSustentável', A.engenharia.dossel.c, A.engenharia.dossel.topo + Y, 'engenharia.e1'),
  R('Instituto de Estudos Urbanos\ne Políticas Públicas', 'Instituto de\nEstudos Urbanos', A.instituto.dossel.c, A.instituto.dossel.topo + Y, 'instituto.e1'),
  // ---- Biblioteca (folha noroeste)
  R('Biblioteca Central', 'Biblioteca\nCentral', A.biblio.c, A.biblio.h + Y, 'biblioteca.e1'),
  R('Centro de Recursos\nDigitais', 'Recursos\nDigitais', A.crd.c, A.crd.h + Y, 'crd.e1'),
  R('Anel da Biblioteca', 'Anel da\nBiblioteca', meio('anelBib'), A.anelBib.hMax + Y, 'anelBib.1'),
  // ---- Vida (folha nordeste)
  R('Cúpula da Vida\n(mata, água e névoa por dentro)', 'Cúpula da Vida', A.bioma.c, A.bioma.h + Y, 'bioma.e1'),
  R('Estufa Anexa', 'Estufa Anexa', A.gorilas.c, A.gorilas.h + Y, 'gorilas.e1'),
  R('Galeria da Cúpula', 'Galeria', A.galeria.c, A.galeria.h + Y, 'santuarioInt.e1'),
  R('Santuário de Animais e\nCentro de Conservação', 'Santuário', meio('santuario'), A.santuario.hMax + Y, 'santuario.1'),
  // ---- vales: as fitas que ligam as folhas
  R('Ala em Onda', 'Ala em Onda', meio('onda'), A.onda.hMax + Y, 'onda.e1'),
  R('Elo Norte', 'Elo Norte', meio('uniElo'), A.uniElo.hMax + Y, 'uniElo.e1'),
  // ---- chegada e cultura (sul)
  R('Praça da Entrada', 'Praça da Entrada', mais(A.praca.c, 0, 3.4), 1.2, 'praca.e1'),
  R('Faculdade de Humanidades\ne Artes Integradas', 'Humanidades\ne Artes', meio('humanidades'), A.humanidades.hMax + Y, 'humanidades.e1'),
  R('Vila Estudantil', 'Vila Estudantil', modulo('casas', 2), A.casas.hMax + Y, 'casas.1'),
  R('Anfiteatro da Vila', 'Anfiteatro', A.anfiteatro.c, A.anfiteatro.h + Y, 'anfiteatro.e1'),
  // ---- Física (lobo norte)
  R('Acelerador de Partículas e\nCentro de Física Avançada', 'Centro de Física', [fis.c[0], fis.c[1] - fis.r - fis.w / 2], fis.h + Y, 'acelerador.e1'),
  R('Elo do Santuário', 'Elo do Santuário', noCaminho(A.eloSant.caminhos.O, 0.5), A.eloSant.topo + Y, 'pas_elo.e1'),
];
