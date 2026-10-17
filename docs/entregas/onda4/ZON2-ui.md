# ZON2, interface (D112 e D113)

Entregue em 17/10/2026. Só `fonte/ui`, textos e vitrine; nada de `sim/`, `render/`, `app/` ou índices.

## O que o jogador vê

1. **Painel de crescimento da zona.** Na barra da ferramenta de zonas há um chip com o modo da zona escolhida (`data-a="zon2.painel"`,
   "Automático" ou "Manual por lote"). Ele abre o painel acima da barra (fecha sozinho com a ferramenta):
   - seletor Automático / Manual por lote (`zon2.modo`, manda `zona.modo`; ao voltar ao Automático avisa quantas construções do lote
     foram canceladas);
   - no Manual: demanda acumulada (`espera`, em construções), campo da quantidade (`zon2.qtd`, texto numérico, padrão 10, valida de 1
     a 1000 e a soma com o lote em andamento), "Usar a demanda" (preenche com a espera), "Começar lote" (`zon2.lote`,
     `data-principal`, manda `zona.lote`), lote em andamento (`pedido`) e "Cancelar o que falta" (`zon2.cancelar`, `zona.lote` n = 0);
   - linha de resumo (prontas, em obra, frentes livres).
2. **Contornos nomeados no mundo.** Com a zona Indústria ativa, o Distrito Industrial (âmbar, tracejado, com o vento predominante no
   rótulo). Ao posicionar captação, poço, usina solar, ETE, termelétrica (ou qualquer tipo de `q.zona.regras().utilidades.tipos`, ou item
   com `zona: 'utilidades'`) a Zona de Utilidades (azul). Prédio da Holding com `zona: 'industrial'` destaca o distrito. O polígono
   acompanha o relevo (arestas quebradas a cada 100 m) e o rótulo fica no ponto do contorno à vista mais perto do meio da tela,
   fugindo do HUD.
3. **Motivo legível das recusas.** Pincel industrial só fora do distrito: a barra diz "Nada aqui é do Distrito Industrial..." e, no
   traço, vem o aviso `codigo.distrito`; pincel misto mostra "N células ficaram de fora" na barra e no aviso (`foraDoDistrito`).
   Colocar fora da área: o botão principal diz "Fora da Zona de Utilidades" ou "Fora do Distrito Industrial" e o painel de dica traz a
   frase longa (`colocar.dicaDoBloqueio` ganhou os casos `distrito` e `utilidades`).
4. **Rede de longo alcance.** A linha de baixo da barra de colocar ganha "Adutora (ou Linha de transmissão, Emissário) · Linha de N m
   até a rede da cidade: custo (custo por metro)" e uma marca no mundo junto do fantasma ("Linha de transmissão: 420 m, US$ 1,3 mi").
   Sem alcance, a barra diz quantos metros ("A rede da cidade está longe demais (3.400 m)...").

## Arquivos

- `fonte/ui/ferramentas/zon2.js` (puro): `validarLote`, `esperaInteira`, `areasDaSessao`, `densificar`, `textoLongoAlcance`, `regrasAtuais`.
- `fonte/ui/hud/Zon2.jsx`: `ChipCrescimento`, `PainelCrescimento`, contornos (HUD `mundo`, registrado por `BarraFerramenta.registrar`, sem
  mexer no índice).
- `fonte/ui/hud/BarraFerramenta.jsx` (chip, painel, linha da zona e da colocação), `fonte/ui/mundo/Cotas.jsx` (marca da rede),
  `fonte/ui/ferramentas/sessao.js` (avisos do pintar), `fonte/ui/ferramentas/colocar.js` (dica do bloqueio).
- `fonte/ui/tema/zon2.css` (novo, entra sozinho na montagem), `fonte/ui/textos/zon2.js` (chaves novas: `zon2.painel.*`, `zon2.lote.campo|usarEspera|invalido|demanda|demandaValor`, `zon2.contorno.*`, `zon2.dica.*`, `zon2.curto.*`, `zon2.rede.marca`).
- Vitrine: `ferramentas/vitrine/cenas/zon2.js` (9 cenas, com consultas e comandos da ZON2 de mentira sobre a simulação falsa).
- Teste: `ferramentas/testes/ui-zon2.teste.mjs` (8 testes, um deles contra a simulação real pela porta `acoes.js`).

## Verificação

- Vitrine fora de `previa/`, 4 tamanhos (986x443, 915x412, 1376x768, 1920x1080), cenas `zon2-*`, `x2-zona`, `x2-colocar`, `inicial`: verde.
- `node ferramentas/simular.mjs --testes`: tudo ok (o `mundo` falhou uma vez sob carga com o resto rodando e passou 18 de 18 sozinho; a guarda de texto ok).
- `montar.mjs` numa pasta temporária: sem avisos; jogo 2343,6 KB contra o teto de 2355 KB (folga de 11 KB, vale vigiar).

## Limites e pendências

- A linha de longo alcance não é desenhada no chão: a prévia traz só `rec`, `metros`, `custo` e `alcanca`, sem o ponto de chegada. Se a
  simulação passar o nó, dá para traçar via `R.ferramenta.via.previa`.
- O contorno é do DOM (SVG sobre o canvas), como o contorno das Áreas; não é pintado no terreno pelo render.
- O modo vale por tipo de zona (como na simulação), então o chip e o painel seguem a zona escolhida na barra.
- O teto do jogo montado está a 11 KB; o acréscimo desta parcela foi de poucos KB.
