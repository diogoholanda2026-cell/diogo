# S2b. Cidade completa (M1b)

Entregue em 16/10/2026. Nada liga sozinho no jogo: o M1b entra quando o integrador trocar `PARTE_ATUAL = 'M1a'` por `'M1b'` em `fonte/data/zonas.js` (binding vivo; os testes usam `definirParteAtual('M1b')`). Até lá o M1a e o robô A2 não mudam: esgoto, ar, ruído e mercadoria conferem `m1bAtivo()` e não fazem nada.

## O que já existia (não refeito)
Dados dos 6 serviços e das 3 zonas, modelos de residencial alta, comercial alta e escritório (R4c, D95), geradores 3D e glifos dos 6 serviços (R5), valor do terreno e `S.agregados.redes.esgoto`.

## O que mudou
- Esgoto separado (`sim/redes.js`): terceira rede, a água devolvida; a ETE (categoria `esgoto`, 30 m³/h) trata; mesmo racionamento pelos mais distantes e quadro de pessoal. Sem ETE na cidade a falta é alerta da cidade e não conta para o abandono (como a água); com ETE conta. Bit `SEM_ESGOTO`, aviso `semEsgoto`, −15 de bem-estar, nível 2 pede esgoto, camada Esgoto.
- Ambiente (`sim/ambiente.js`, `data/ambiente.js`): grades `ar` e `ruido` 128 x 128 (64 m, Uint8) no save e no hash. Refeitas por rodada em 4 faixas de linhas (uma por fatia). Ar: vento do mês pela semente, difusão, decaimento de 10%. Fontes: indústria zoneada (cai 12% por nível), Pedreira, Mina, Cimenteira, termelétrica, comércio (ruído) e vias grandes (pelo tipo e por `espelho.fluxos` da S1c). Efeitos: bem-estar (ar até −15, ruído até −10), valor do terreno (ar x 0,6, ruído x 0,36, razão 1 para 0,6), aviso `poluicao` no prédio, alerta da cidade. Camadas Ar, Ruído e Empregos (divergente: vagas abertas contra desemprego).
- Mercadoria (`sim/mercadoria.js`, `data/mercadoria.js`): produção = empregos ocupados da indústria x 1 un./h (+8% por nível); consumo = empregos ocupados do comércio x 1 un./h; a falta é importada a 160% do preço base (3) como despesa `ligacao.mercadoria`. Entra em `S.agregados.mercadoria { producao, consumo, importada, excedente }`, no fator `bens` da demanda da indústria, em `q.demanda().mercadoria`, na seção Mercadoria da tela Cidade (aba Demanda) e num alerta.
- Parque da orla: `atratividade` 3 soma na demanda residencial (`atratividadeDosServicos`).
- Ligação mínima: `AV.SEM_ESGOTO` e `AV.POLUICAO` no fim da lista, `m1bAtivo()` em `predios.js`, ganchos em `bemestar.js`, `crescimento.js`, `demanda.js`, `servicos.js`; textos em `ui/textos/s2b.js` (registrado no índice); ações `verCamadaEsgoto` e `verCamadaAr` na folha; esgoto na lista de redes da tela Cidade.
- D112 (aviso da coordenação): `zona: 'utilidades'` em captação, poço, usina solar, ETE e termelétrica (`data/servicos.js`) e `zona: 'industrial'` na zona Indústria (`data/zonas.js`). Só marcam; a restrição é da ZON2. As fontes da Holding (Pedreira, Mina, Cimenteira) ficam para a S3b marcar.

## Testes
`esgoto`, `ambiente`, `mercadoria` e `cidade-completa` (novos), com `apoio-m1b.mjs`. Cobrem o M1a intacto, cada fonte, faixas, vento, efeitos, camadas, salvar no meio da rodada e determinismo.

## Números de partida (calibrar)
Pico de uma fábrica de 60 empregos: ar 150; Cimenteira 195; Pedreira 125 (ruído 175). A 200 m o ar cai a menos de um terço; o ruído chega a 288 a 352 m. Preço da mercadoria 3 (importada 4,8 por unidade/h).

## Pendências para o integrador
- Abrir o M1b (`PARTE_ATUAL`). A partir daí a cidade sem ETE leva −15 de bem-estar e o robô A2 precisa de uma ETE na estratégia (`ferramentas/robo/robo-sim.mjs`); não rodei o A2 com o M1b ligado.
- Save: as grades `ar` e `ruido` novas mudam o hash; save antigo abre mas o hash gravado não bate. Se importar, subir `versaoSave` com `MIGRACOES[1]` vazia.
- ZON2 e D112: o vento é sorteado por mês; o Distrito Industrial "a sotavento" pede um vento predominante (hoje `ventoDoMes(semente, tique)`).
- X3b: glifos das camadas Ar, Ruído e Empregos (só `esgoto` existe).

## Medidas e o que não verifiquei
Medidas do tique no fim desta nota. Não verifiquei na tela: camadas, painel de mercadoria e os 6 prédios; sem Chromium aqui.
