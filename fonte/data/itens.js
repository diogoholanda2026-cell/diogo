// Materiais e produtos. Matérias-primas saem das Usinas (vários espaços em paralelo);
// produtos saem das Oficinas (fila, um de cada vez). Tempos em segundos no ritmo normal.
export const ITENS = {
  // ---- matérias-primas (Usinas de Materiais) ----
  madeira: { nome: 'Madeira certificada', tipo: 'bruto', t: 45, nivel: 1, valor: 12, cor: '#b98652' },
  brita: { nome: 'Brita reciclada', tipo: 'bruto', t: 60, nivel: 1, valor: 14, cor: '#9c968c' },
  aco: { nome: 'Aço reciclado', tipo: 'bruto', t: 120, nivel: 2, valor: 22, cor: '#8d99a6' },
  argila: { nome: 'Argila', tipo: 'bruto', t: 90, nivel: 3, valor: 18, cor: '#b0643c' },
  mudas: { nome: 'Sementes nativas', tipo: 'bruto', t: 120, nivel: 4, valor: 20, cor: '#5e9a48' },
  vidro: { nome: 'Vidro reciclado', tipo: 'bruto', t: 180, nivel: 5, valor: 30, cor: '#7fc4de' },
  cobre: { nome: 'Cobre reciclado', tipo: 'bruto', t: 240, nivel: 8, valor: 38, cor: '#c8743a' },
  fibra: { nome: 'Fibra de bambu', tipo: 'bruto', t: 180, nivel: 10, valor: 34, cor: '#c9b46a' },
  // ---- Carpintaria ----
  viga: { nome: 'Viga laminada', tipo: 'produto', oficina: 'carpintaria', t: 120, nivel: 1, req: { madeira: 2 }, valor: 45 },
  deque: { nome: 'Deque de madeira', tipo: 'produto', oficina: 'carpintaria', t: 240, nivel: 4, req: { madeira: 2, brita: 1 }, valor: 70 },
  trelica: { nome: 'Treliça de madeira', tipo: 'produto', oficina: 'carpintaria', t: 480, nivel: 7, req: { viga: 1, aco: 1 }, valor: 130 },
  estante: { nome: 'Estante de livros', tipo: 'produto', oficina: 'carpintaria', t: 720, nivel: 14, req: { viga: 1, madeira: 2 }, valor: 150 },
  // ---- Central de Concreto ----
  cimento: { nome: 'Cimento verde', tipo: 'produto', oficina: 'concreto', t: 80, nivel: 2, req: { brita: 1, argila: 1 }, valor: 55 },
  concreto: { nome: 'Concreto', tipo: 'produto', oficina: 'concreto', t: 150, nivel: 2, req: { cimento: 1, brita: 2 }, valor: 110 },
  bloco: { nome: 'Bloco de solo-cimento', tipo: 'produto', oficina: 'concreto', t: 200, nivel: 5, req: { argila: 2, cimento: 1 }, valor: 120 },
  premoldado: { nome: 'Laje pré-moldada', tipo: 'produto', oficina: 'concreto', t: 280, nivel: 6, req: { concreto: 1, aco: 1 }, valor: 170 },
  // ---- Horto ----
  substrato: { nome: 'Substrato', tipo: 'produto', oficina: 'horto', t: 120, nivel: 4, req: { argila: 1, mudas: 1 }, valor: 50 },
  grama: { nome: 'Tapete de grama', tipo: 'produto', oficina: 'horto', t: 180, nivel: 4, req: { mudas: 2 }, valor: 55 },
  muda: { nome: 'Muda de árvore', tipo: 'produto', oficina: 'horto', t: 300, nivel: 5, req: { mudas: 2, substrato: 1 }, valor: 120 },
  jardim: { nome: 'Jardim vertical', tipo: 'produto', oficina: 'horto', t: 840, nivel: 12, req: { muda: 1, fibra: 1, perfil: 1 }, valor: 330 },
  // ---- Serralheria ----
  perfil: { nome: 'Perfil de aço', tipo: 'produto', oficina: 'serralheria', t: 180, nivel: 6, req: { aco: 2 }, valor: 60 },
  conector: { nome: 'Conectores', tipo: 'produto', oficina: 'serralheria', t: 150, nivel: 8, req: { aco: 1, cobre: 1 }, valor: 75 },
  guarda: { nome: 'Guarda-corpo', tipo: 'produto', oficina: 'serralheria', t: 600, nivel: 9, req: { perfil: 1, vidro: 1 }, valor: 150 },
  no: { nome: 'Nó geodésico', tipo: 'produto', oficina: 'serralheria', t: 540, nivel: 16, req: { perfil: 1, conector: 2 }, valor: 260 },
  // ---- Vidraçaria ----
  painel: { nome: 'Painel de vidro', tipo: 'produto', oficina: 'vidracaria', t: 170, nivel: 5, req: { vidro: 2 }, valor: 85 },
  duplo: { nome: 'Vidro duplo solar', tipo: 'produto', oficina: 'vidracaria', t: 400, nivel: 10, req: { painel: 1, cobre: 1 }, valor: 190 },
  cupula: { nome: 'Painel de cúpula', tipo: 'produto', oficina: 'vidracaria', t: 420, nivel: 17, req: { vidro: 2, perfil: 1 }, valor: 230 },
  acrilico: { nome: 'Acrílico de aquário', tipo: 'produto', oficina: 'vidracaria', t: 900, nivel: 18, req: { vidro: 3, fibra: 1 }, valor: 300 },
  // ---- Oficina Elétrica ----
  fiacao: { nome: 'Fiação', tipo: 'produto', oficina: 'eletrica', t: 240, nivel: 8, req: { cobre: 2 }, valor: 95 },
  luminaria: { nome: 'Luminária LED', tipo: 'produto', oficina: 'eletrica', t: 420, nivel: 9, req: { fiacao: 1, vidro: 1 }, valor: 150 },
  solar: { nome: 'Painel solar', tipo: 'produto', oficina: 'eletrica', t: 720, nivel: 11, req: { vidro: 1, cobre: 1, aco: 1 }, valor: 210 },
  sensor: { nome: 'Sensor ambiental', tipo: 'produto', oficina: 'eletrica', t: 600, nivel: 15, req: { fiacao: 1, fibra: 1 }, valor: 200 },
  computador: { nome: 'Estação de trabalho', tipo: 'produto', oficina: 'eletrica', t: 1200, nivel: 16, req: { fiacao: 2, painel: 1 }, valor: 360 },
  // ---- Laboratório de Campo (Faculdade de Ciências) ----
  kitlab: { nome: 'Kit de laboratório', tipo: 'produto', oficina: 'laboratorio', t: 720, nivel: 13, req: { vidro: 1, aco: 1, fiacao: 1 }, valor: 260 },
  racao: { nome: 'Ração de resgate', tipo: 'produto', oficina: 'laboratorio', t: 360, nivel: 19, req: { mudas: 2, fibra: 1 }, valor: 140 },
  kitvet: { nome: 'Kit veterinário', tipo: 'produto', oficina: 'laboratorio', t: 1080, nivel: 20, req: { kitlab: 1, fibra: 1 }, valor: 380 },
  // ---- especiais (caem ao coletar; não ocupam produção) ----
  estrado: { nome: 'Estrado', tipo: 'especial', grupo: 'almox', valor: 0 },
  etiqueta: { nome: 'Etiqueta RFID', tipo: 'especial', grupo: 'almox', valor: 0 },
  cadeado: { nome: 'Cadeado', tipo: 'especial', grupo: 'almox', valor: 0 },
  estaca: { nome: 'Estaca de topografia', tipo: 'especial', grupo: 'licenca', valor: 0 },
  baliza: { nome: 'Baliza', tipo: 'especial', grupo: 'licenca', valor: 0 },
  trena: { nome: 'Trena a laser', tipo: 'especial', grupo: 'licenca', valor: 0 },
};
export const BRUTOS = Object.keys(ITENS).filter((k) => ITENS[k].tipo === 'bruto');

// Prédios do canteiro. Usinas: espaços paralelos. Oficinas: fila.
export const PREDIOS = {
  escritorio: { nome: 'Escritório de Obra', tipo: 'base', nivel: 1, desc: 'Coordena a obra. Recebe os repasses enquanto a Sede não fica pronta.' },
  almox: { nome: 'Almoxarifado', tipo: 'armazem', nivel: 1, desc: 'Guarda tudo o que é produzido. Amplie com estrados, etiquetas e cadeados.' },
  usina1: { nome: 'Usina de Materiais', tipo: 'usina', nivel: 1, custo: 0, desc: 'Transforma resíduos e recursos renováveis em matéria-prima.' },
  usina2: { nome: 'Usina de Materiais II', tipo: 'usina', nivel: 7, custo: 6000, desc: 'Mais espaços de produção em paralelo.' },
  usina3: { nome: 'Usina de Materiais III', tipo: 'usina', nivel: 13, custo: 30000, desc: 'A usina maior, para os capítulos finais.' },
  carpintaria: { nome: 'Carpintaria', tipo: 'oficina', nivel: 1, custo: 400, desc: 'Vigas laminadas, deques, treliças e estantes.' },
  concreto: { nome: 'Central de Concreto', tipo: 'oficina', nivel: 2, custo: 900, desc: 'Cimento verde, concreto, blocos e lajes pré-moldadas.' },
  horto: { nome: 'Horto', tipo: 'oficina', nivel: 4, custo: 1800, desc: 'Substrato, grama, mudas e jardins verticais.' },
  serralheria: { nome: 'Serralheria', tipo: 'oficina', nivel: 6, custo: 3500, desc: 'Perfis, conectores, guarda-corpos e nós geodésicos.' },
  vidracaria: { nome: 'Vidraçaria', tipo: 'oficina', nivel: 5, custo: 2600, desc: 'Painéis de vidro, vidro solar, cúpula e aquário.' },
  eletrica: { nome: 'Oficina Elétrica', tipo: 'oficina', nivel: 8, custo: 6500, desc: 'Fiação, luminárias, painéis solares e computadores.' },
  laboratorio: { nome: 'Laboratório de Campo', tipo: 'oficina', nivel: 13, custo: 18000, desc: 'Kits de laboratório, ração e kits veterinários para o santuário.', requer: 'ciencias.e2' },
};
export const USINAS = Object.keys(PREDIOS).filter((k) => PREDIOS[k].tipo === 'usina');
export const OFICINAS = Object.keys(PREDIOS).filter((k) => PREDIOS[k].tipo === 'oficina');
export function receitas(oficina) { return Object.keys(ITENS).filter((k) => ITENS[k].oficina === oficina); }

// XP necessário para cada nível (1..30)
export const XP_NIVEL = [0, 0, 40, 100, 190, 340, 540, 810, 1170, 1620, 2190, 2880, 3720, 4740, 5940, 7320, 8940, 10800, 12960, 15420, 18240, 21420, 25020, 29040, 33600, 38700, 44400, 50700, 57600, 66000, 75000];
