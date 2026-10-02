// Nomes da história (D77 a D83; docs/desenho/historia.md, seções 5.5, 7 e 8) e nomes fictícios para moradores
// nomeados e empresas da cidade (dona: S3a). Todos os nomes de gente, empresa, país e evento são fictícios: nenhum
// nome real de empresa, país, doença ou pessoa entra no jogo.
import { congelar } from '../comum/util.js';

/** O jogador: o criador da Holding (D67). */
export const JOGADOR = /* @__PURE__ */ congelar({ nome: 'Diogo Holanda', papel: 'criador', nascimento: 1980 });

/** A empresa, o país anfitrião e a moeda da história (D77, D68). */
export const MUNDO = /* @__PURE__ */ congelar({
  holding: 'Holding Held',
  pais: 'República de Vera Cruz do Leste',
  laboratorio: 'The Axion Evergreen',
  ia: { interna: 'Super Cérebro', multimodal: 'Mosaico' },
  intermediarias: ['Held Capital', 'Held Litos', 'Held Silício', 'Held Pórtico'],
  fundo: 'Fundo Atlas',
});

/**
 * Os seis conselheiros (D35 e D83): id curto usado nas falas, nas decisões e nos objetivos (`quem`), nome completo e
 * cargo. Os outros 14 executivos estão em EXECUTIVOS.
 */
export const CONSELHEIROS = /* @__PURE__ */ congelar({
  iris: { nome: 'Íris Valverde', curto: 'Íris', cargo: 'Arquiteta-chefe e diretora de Heldópolis (urbanismo e Arcologia)' },
  tome: { nome: 'Tomé Carvalho', curto: 'Tomé', cargo: 'Chefe de construções de grande porte (obras e logística)' },
  nara: { nome: 'Nara Guimarães', curto: 'Nara', cargo: 'Diretora de meio ambiente, Santuário e Legado' },
  caio: { nome: 'Caio Montenegro', curto: 'Caio', cargo: 'Diretor científico do Super Cérebro, de energia e ciência' },
  cida: { nome: 'Dona Cida (Aparecida Moura)', curto: 'Dona Cida', cargo: 'Diretora de comunidade e moradia (voz dos moradores)' },
  livia: { nome: 'Lívia Andrade', curto: 'Lívia', cargo: 'Diretora financeira' },
});

export const CONSELHEIROS_ORDEM = Object.freeze(['iris', 'tome', 'nara', 'caio', 'cida', 'livia']);

/** Os 20 executivos (0,5% cada; seção 8 da história). `conselheiro`: o id curto quando é um dos seis. */
export const EXECUTIVOS = /* @__PURE__ */ congelar([
  { n: 1, nome: 'Lívia Andrade', cargo: 'Diretora financeira', conselheiro: 'livia' },
  { n: 2, nome: 'Otávio Brandão', cargo: 'Diretor jurídico' },
  { n: 3, nome: 'Helena Duarte', cargo: 'Chefe de relações públicas e governo' },
  { n: 4, nome: 'Anselmo Vidal', cargo: 'Diretor de pessoas e educação (faculdade e escola)' },
  { n: 5, nome: 'Rodrigo Valadares', cargo: 'Diretor de segurança e inteligência' },
  { n: 6, nome: 'Beatriz Camargo', cargo: 'Presidente da Held Capital' },
  { n: 7, nome: 'Sven Lindqvist', cargo: 'Chefe do Fundo Atlas' },
  { n: 8, nome: 'Joaquim Prado', cargo: 'Chefe de agroindústria' },
  { n: 9, nome: 'Camille Fontaine', cargo: 'Chefe de clientes VIP' },
  { n: 10, nome: 'Tomé Carvalho', cargo: 'Chefe de construções de grande porte (obras e logística)', conselheiro: 'tome' },
  { n: 11, nome: 'Wagner Takahashi', cargo: 'Chefe de alimentícia, siderurgia e sucroalcooleira' },
  { n: 12, nome: 'Amara Okonkwo', cargo: 'Presidente da Held Litos (terras raras)' },
  { n: 13, nome: 'Mei-Lin Zhao', cargo: 'Presidente da Held Silício (chips e hardware)' },
  { n: 14, nome: 'Arjun Mehta', cargo: 'Diretor da IA multimodal Mosaico' },
  { n: 15, nome: 'Caio Montenegro', cargo: 'Diretor científico do Super Cérebro, de energia e ciência', conselheiro: 'caio' },
  { n: 16, nome: 'Ibrahim Al-Rashid', cargo: 'Presidente da Held Pórtico (infraestrutura física)' },
  { n: 17, nome: 'Íris Valverde', cargo: 'Arquiteta-chefe e diretora de Heldópolis (urbanismo e Arcologia)', conselheiro: 'iris' },
  { n: 18, nome: 'Dona Cida (Aparecida Moura)', cargo: 'Diretora de comunidade e moradia (voz dos moradores)', conselheiro: 'cida' },
  { n: 19, nome: 'Nara Guimarães', cargo: 'Diretora de meio ambiente, Santuário e Legado', conselheiro: 'nara' },
  { n: 20, nome: 'Isabela Cordeiro', cargo: 'Diretora de turismo, eventos e hotelaria' },
]);

/** Nomes brasileiros comuns (fictícios na combinação) para moradores nomeados do Mural e da folha do prédio. */
export const NOMES_PROPRIOS = /* @__PURE__ */ congelar([
  'Ana', 'Antônio', 'Benedita', 'Bruno', 'Carla', 'Cícero', 'Damiana', 'Edson', 'Elaine', 'Francisco', 'Gabriela',
  'Geraldo', 'Helena', 'Iracema', 'Jair', 'Joana', 'José', 'Juliana', 'Leandro', 'Lúcia', 'Marcos', 'Maria',
  'Nilson', 'Otília', 'Paulo', 'Raimunda', 'Renato', 'Sebastiana', 'Sérgio', 'Tereza', 'Valdir', 'Vitória',
]);

export const SOBRENOMES = /* @__PURE__ */ congelar([
  'Almeida', 'Barbosa', 'Cardoso', 'Costa', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Machado', 'Melo', 'Moura',
  'Nascimento', 'Oliveira', 'Pereira', 'Ramos', 'Ribeiro', 'Rocha', 'Santana', 'Santos', 'Silva', 'Soares', 'Teixeira',
]);

/** Partes para nomes de comércios e indústrias da cidade (fictícios): `${tipo} ${nome}`. */
export const EMPRESAS = /* @__PURE__ */ congelar({
  tipos: ['Mercearia', 'Padaria', 'Ferragens', 'Armazém', 'Oficina', 'Confecções', 'Metalúrgica', 'Cerâmica', 'Distribuidora'],
  nomes: ['Santa Cida', 'Boa Vista', 'Rio Held', 'Praia Grande', 'Mirante', 'Estrela do Leste', 'Vera Cruz', 'Pedra Branca', 'Ipê Roxo'],
});
