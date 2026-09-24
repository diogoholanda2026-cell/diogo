// Rótulos da maquete (como na foto de referência), mostrados no modo Apreciar.
// 'se' = etapa que precisa estar concluída para o rótulo aparecer. A posição acompanha a planta: âncora do
// conjunto + deslocamento, na altura y; o ponto é o pé do rótulo (centro da borda de baixo). 'foto' = onde
// fica esse ponto na foto de 1376x768 (com a vista da foto, os dois coincidem).
import { A } from './planta.js';

const centroSavana = A.savana.poly.reduce((s, [x, z]) => [s[0] + x / A.savana.poly.length, s[1] + z / A.savana.poly.length], [0, 0]);
const R = (txt, ancora, dx, y, dz, se, foto) => ({ txt, pos: [ancora[0] + dx, y, ancora[1] + dz], se, foto });
export const ROTULOS = [
  R('Escola e Campus para\nJovens (10-17 anos)', A.anel.c, -16.45, 2.0, -7.22, 'escola.e1', [152, 218]),
  R('ECOLOGICAL ACADEMIC\n& CAMPUS UNIVERSITÁRIO', A.uni.c, 9.26, 5.0, 4.02, 'uni.1', [439, 112]),
  R('SEDE ADMINISTRATIVA DA\nHOLDING GUARDA-CHUVA', A.sede.c, 2.3, 4.5, -2.51, 'sede.e2', [770, 98]),
  R('FACULDADE DE CIÊNCIAS AVANÇADAS\nE TECNOLOGIA (Biotecnologia,\nNanotecnologia)', A.ciencias.c, 11.74, 5.0, 0.38, 'ciencias.e1', [721, 180]),
  R('SANTUÁRIO DE ANIMAIS\nE CENTRO DE CONSERVAÇÃO', A.santuario.c, 3.84, 3.2, -2.3, 'santuario.1', [1212, 148]),
  R('BIBLIOTECA CENTRAL E CENTRO\nDE RECURSOS DIGITAIS DA ARC', A.biblio.c, 1.3, 8.0, 0.3, 'biblioteca.e1', [888, 253]),
  R('EXPANDED ANIMAL HABITATS\n& REHABILITATION CENTRE', centroSavana, 10.78, 2.5, -0.92, 'savana.e1', [1253, 298]),
  R('BIOMA AQUÁTICO\nDE CONSERVAÇÃO', A.bioma.c, 3.87, 4.2, 2.38, 'bioma.e1', [1270, 350]),
  R('VILA ESTUDANTIL\nEXPANDIDA', A.vila.c, 1.49, 2.6, -0.16, 'anfiteatro.e1', [1160, 487]),
  R('FACULDADE DE\nHUMANIDADES E\nARTES INTEGRADAS', A.anel.c, 1.07, 3.0, 0.69, 'humanidades.e1', [330, 316]),
  R('INSTITUTO DE\nESTUDOS URBANOS E\nPOLÍTICAS PÚBLICAS', A.anel.c, 6.84, 3.0, -0.35, 'instituto.e1', [456, 316]),
  R('FACULDADE DE\nENGENHARIA SUSTENTÁVEL', A.anel.c, 8.65, 2.4, 5.42, 'engenharia.e1', [424, 415]),
  R('ACELERADOR DE PARTÍCULAS\nSUBTERRÂNEO & CENTRO DE\nFÍSICA AVANÇADA', A.acelerador.c, 4.95, 2.0, 3.16, 'acelerador.e1', [807, 640]),
];
