// Pré-carga do robô: passarelas de mentira (Fita da Frente e Caracol) antes de obras.js montar os projetos, para
// testar os projetos que só existem quando a planta desenha essas passarelas (simular.mjs --todos roda isso sozinho).
// Uso: node --import ./ferramentas/passarelas-teste.mjs ferramentas/simular.mjs --passarelas
import { PASSARELAS } from '../fonte/data/planta.js';
PASSARELAS.frente2 ||= { nome: 'Fita da Frente', pts: [[-19.0, 17.6, 0.9], [-12.0, 19.4, 1.0], [-4.0, 19.7, 0.9]], w: 0.8, teste: true };
PASSARELAS.caracol ||= { nome: 'Caracol do Anel', pts: [[-21.0, 12.0, 0.1], [-20.2, 13.2, 0.8], [-21.4, 13.8, 1.4]], w: 0.5, teste: true };
