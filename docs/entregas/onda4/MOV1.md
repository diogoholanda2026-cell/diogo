# MOV1: mover e girar construcoes prontas (D94)
Arquivos: fonte/sim/mover.js (novo), fonte/sim/predios.js (comando 'mover', consulta), fonte/ui/ferramentas/{mover.js,BotaoMover.jsx,PainelMover.jsx} (novos), colocar.js, sessao.js, fonte/ui/selecao/Folha.jsx, fonte/ui/tema/mov1.css, fonte/ui/textos/mov1.js, fonte/render/camera/entrada.js (aoGiroDeFerramenta), fonte/app/controle.js (heldopolis.retomada, estadoParaRetomar/retomar), ferramentas/testes/{mover,mover-ui}.teste.mjs.
Regras: custo 10% (mais aplainar), obra curta, estoque, producao, nome, cor, nivel e trabalhadores mantidos, cobertura refeita, save, desfazer ate a obra comecar, recusa 'fixo' em zona e na Arcologia.
Testes: mover e mover-ui verdes; servicos e holding verdes; montar sem aviso (montagem2). simular --testes: falham arcologia, arcologia-render, terreno (SEDE4, em andamento) e mundo so sob carga (passa isolado).
Capturas: scratchpad/novo/MOV1/caps/mov1-{1-fantasma-valido,2-fantasma-invalido,3-obra-curta}.png
Pendencia: listar o codigo de recusa 'fixo' no contrato de textos; render/colocaveis/dominio.js nao foi alterado (0 compilacoes depois da primeira obra, medido em relatorio.json).
