// Cena 'noite' (A10, 15.2): a vista aberta às 21h (?hora=2 dá a madrugada), com a exposição mínima que deixa a cidade
// legível, a lua pela fase, as estrelas, o céu escuro com o brilho da cidade no horizonte e a lua como luz chave. A
// R1b acrescenta as janelas acesas, a luz da rua e o brilho medido da cidade; aqui o brilho é o de uma cidade grande.
import { CAMERA_ABERTA } from './aberta.js';
import { conferirAmbiente } from './horizonte.js';

export function registrar(registrarCena) {
  registrarCena('noite', {
    sim: 'sintetica',
    hora: 21,
    camera: CAMERA_ABERTA,
    async montar(ctx) {
      return { resultado: () => conferirAmbiente(ctx, { noite: true }) };
    },
  });
}
