// Cena 'aberta' (A6, A10, 4.8): a vista aberta da cidade inteira, a 3 km e 35 graus, com a cidade sintética de 12 mil
// prédios, às 10h (?hora= troca; a bancada faz o sol andar com ?sol=anda). É a cena do orçamento do Média (300
// chamadas e 900 mil triângulos no pior quadro de 120, com os tetos por família) e a primeira captura do dono: céu
// físico com nuvens, sol pela latitude, AgX, neblina de altura que azula o longe e a sombra própria.
import { conferirAmbiente } from './horizonte.js';

export const CAMERA_ABERTA = Object.freeze({ x: 60, z: 150, dist: 3000, guinada: 18, inclinacao: 35 });

export function registrar(registrarCena) {
  registrarCena('aberta', {
    sim: 'sintetica',
    hora: 10,
    camera: CAMERA_ABERTA,
    async montar(ctx) {
      return { resultado: () => conferirAmbiente(ctx) };
    },
  });
}
