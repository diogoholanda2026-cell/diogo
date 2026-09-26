// Nomes das estruturas da Arcologia, em etiquetas no modo Apreciar (estilo BuildIt).
// 'se' = etapa que precisa estar concluída para o rótulo aparecer. A posição acompanha o plano diretor: âncora do
// conjunto + deslocamento, na altura y; o ponto é o pé do rótulo (centro da borda de baixo). 'foto' = onde ficava o
// ponto na foto de referência (o plano novo não segue a foto: null). 'curto' = legenda de maquete (até duas linhas de
// 16 caracteres, em maiúsculas pelo CSS); o nome longo fica na folha da obra.
import { A } from './planta.js';

const R = (txt, ancora, dx, y, dz, se, foto, curto) => ({ txt, curto: curto || txt, pos: [ancora[0] + dx, y, ancora[1] + dz], se, foto, obra: se.split('.')[0] });
export const ROTULOS = [
  R('Escola e Campus para\nJovens (10-17 anos)', A.anel.c, -5.6, 2.4, 0.2, 'escola.e1', null, 'Escola e Campus\npara Jovens'),
  R('Campus Universitário\nEcológico', A.uni.arena.c, 0, 5.0, -1.2, 'uni.1', null, 'Campus\nUniversitário'),
  R('Sede Administrativa da\nHolding Guarda-Chuva', A.sede.c, 0, 3.8, -9.3, 'sede.e2', null, 'Sede da Holding'),
  R('Torre da Holding\n(heliponto)', A.sede.torre.c, 0, 9.6, 0, 'sede.e4', null, 'Torre da Holding'),
  R('Faculdade de Ciências Avançadas\ne Tecnologia', A.ciencias.c, 3.2, 3.8, 0, 'ciencias.e1', null, 'Faculdade\nde Ciências'),
  R('Residencial Santuário', A.santuario.c, 0, 3.2, 0, 'santuario.1', null, 'Santuário'),
  R('Biblioteca Central e Centro\nde Recursos Digitais', A.biblio.c, 1.3, 8.0, 0.3, 'biblioteca.e1', null, 'Biblioteca\nCentral'),
  R('Cúpula da Vida\n(mata, água e névoa por dentro)', A.bioma.c, 0, 8.6, 0, 'bioma.e1', null, 'Cúpula da Vida'),
  R('Estufa Anexa', A.gorilas.c, 0, 4.4, 0, 'gorilas.e1', null, 'Estufa Anexa'),
  R('Vila Estudantil', A.vila.c, 1.49, 2.6, -0.16, 'anfiteatro.e1', null, 'Vila Estudantil'),
  R('Faculdade de Humanidades\ne Artes Integradas', A.anel.c, 1.07, 3.0, 0.69, 'humanidades.e1', null, 'Humanidades\ne Artes'),
  R('Instituto de Estudos Urbanos\ne Políticas Públicas', A.anel.c, 6.84, 3.0, -0.35, 'instituto.e1', null, 'Instituto de\nEstudos Urbanos'),
  R('Faculdade de Engenharia\nSustentável', A.anel.c, 8.65, 2.4, 5.42, 'engenharia.e1', null, 'Engenharia\nSustentável'),
  R('Acelerador de Partículas e\nCentro de Física Avançada', A.acelerador.c, 0, 2.0, 2.6, 'acelerador.e1', null, 'Acelerador de\nPartículas'),
  R('Praça da Entrada', A.praca.poly[0], 6.5, 1.6, 4.0, 'praca.e1', null, 'Praça da Entrada'),
];
