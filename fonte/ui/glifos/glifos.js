// Registro dos glifos (desenho da UI 6): traço de 1,75 numa grade de 24, pontas e juntas redondas, currentColor, sem
// preenchimento (detalhes pequenos a 35%). Um glifo é uma lista de caminhos SVG ('d'): string = traço; { d, cheio:
// true } = detalhe preenchido. Só caminhos (círculo vira arco), para o mesmo registro servir ao DOM (<Glifo>) e ao
// atlas dos marcadores no canvas (new Path2D(d), X3a). A F0 traz os poucos que a barra de cima usa; a U1a desenha os
// cerca de 130 do M1 (registrarGlifos no próprio arquivo ou no dela).

const glifos = new Map();

const circulo = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/**
 * Registra glifos: { nome: ['M...', { d: 'M...', cheio: true }] }. Registrar de novo troca o desenho.
 */
export function registrarGlifos(mapa) {
  for (const [nome, partes] of Object.entries(mapa)) {
    const lista = Array.isArray(partes) ? partes : [partes];
    glifos.set(nome, {
      tracos: lista.filter((p) => typeof p === 'string'),
      cheios: lista.filter((p) => p && typeof p === 'object' && p.cheio).map((p) => p.d),
    });
  }
}

/** O glifo pelo nome ({ tracos: [d], cheios: [d] }) ou null. */
export const glifo = (nome) => glifos.get(nome) ?? null;

/** Nomes registrados. */
export const nomesGlifos = () => [...glifos.keys()];

registrarGlifos({
  // monograma da Holding: H dentro de um anel
  holding: [circulo(12, 12, 9.25), 'M8.5 7.5v9M15.5 7.5v9M8.5 12h7'],
  // créditos: moeda com aro interno e H pequeno (glifo, não símbolo de moeda)
  creditos: [circulo(12, 12, 8.5), { d: circulo(12, 12, 6), cheio: true }, 'M10 9v6M14 9v6M10 12h4'],
  populacao: [circulo(9, 8.5, 3), 'M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6', 'M15.8 5.6a2.9 2.9 0 0 1 0 5.8', 'M17.6 14.6c1.6.5 2.6 2 2.9 4.4'],
  pausa: ['M9 6.5v11M15 6.5v11'],
  vel1: ['M9 6.5l7 5.5-7 5.5z'],
  vel2: ['M5.5 6.5l6.5 5.5-6.5 5.5zM12.5 6.5l6.5 5.5-6.5 5.5z'],
  vel3: ['M3.5 7.5L8 12l-4.5 4.5zM9.75 7.5l4.5 4.5-4.5 4.5zM16 7.5l4.5 4.5-4.5 4.5z'],
  sol: [circulo(12, 12, 4), 'M12 2.8v2.2M12 19v2.2M2.8 12H5M19 12h2.2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5'],
  solBaixo: ['M3 18h18', 'M7 18a5 5 0 0 1 10 0', 'M12 8.2v2.2M5.9 10.9l1.5 1.5M18.1 10.9l-1.5 1.5'],
  lua: ['M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z'],
  alerta: ['M12 4.2l8.6 15H3.4z', 'M12 10v4.2', { d: circulo(12, 16.9, 0.9), cheio: true }],
  menu: ['M5 7h14M5 12h14M5 17h14'],
});
