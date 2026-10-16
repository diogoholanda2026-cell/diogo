# S1c: trânsito agregado com efeitos (D15, D37)
Arquivos: fonte/sim/transito.js, fonte/sim/tarefas/transito.js, fonte/ui/textos/s1c.js (+ índice textos.js), ferramentas/testes/transito.teste.mjs. Ligação mínima: fonte/sim/tarefas.js (opção `fatiado` e `andar`), servicos.js (busca congestionada), bemestar.js, zonas/crescimento.js, zonas/demanda.js, holding/producao.js (uma linha cada, `sim.transito?.`), ferramentas/robo/robo-sim.mjs (meta do gargalo), contratos/interno.js (só comentário).

Modelo: zonas de tráfego de 256 m (512 m acima de 150 ativas); P = (empregados + 0,3 moradores) x 0,25 por hora de pico; A = vagas ocupadas + 0,3 x vagas do comércio; gravidade exp(-0,08 c); 3 passadas (50, 30, 20%) com BPR no worker a cada 60 tiques, aplicadas 60 depois. Varredura dos prédios em 6 fatias (somas na seção salva), pedido na última. Árvore reaproveitada só quando continua ótima.

Publica: espelho.fluxos { versao, ida, volta, vel } (arrays reaproveitados); S.agregados.trajeto { porZona, destino, medio, comercio }; seção `transito`; sim.transito (custoAresta, versaoCusto, fatorTrabalho, fatorClientes, bemEstar, gargalos, sugestao, resumo); camada Trânsito (v/c); alerta `transito` (transitoParado, transitoParadoMao, transitoParadoParalela, com via, ref, sugestão e ponto); q.predio().transito e q.cidade().transito.

Efeitos D37 (calibrar): produtividade (zona e linha da Holding) até -30% de 12 a 40 min; clientes do comércio até -25% de 10 a 35 min; saúde e bombeiros pelo comprimento x custo congestionado (degraus de 25%, refaz só esses tipos); bem-estar até -8 de 10 a 45 min (fator `transito`).

Sem worker (Node) a tarefa anda em fatias por tique (tarefas.js `fatiado`/`andar`) e termina antes do T + K; o resultado é o mesmo (hash igual com Node, worker de atraso aleatório e worker que morre).

Medidas (Node, máquina compartilhada, ruidosas): sintética de 40 mil moradores (72 zonas, 817 nós): fatias da varredura 0,1 a 0,3 ms, última 0,7 ms; aplicar 0,4 ms; atribuir 12 a 17 ms (no worker no jogo; no Node soma uns 0,3 ms por tique em média). Robô A2: 12 h com e sem trânsito dão os mesmos 9.195 moradores e caixa 25.165 (travessias curtas, abaixo dos limiares). v/c máximo do robô 0,67 a 10 mil moradores; a sintética de 40 mil tem 19 gargalos e melhorar a via sugerida tira a aresta da lista.

Testes: transito.teste.mjs (17). Montar sem avisos.
Pendências: o robô só mede a meta do gargalo com 25 mil moradores (hoje fica "sem medida"); o save antigo muda de hash pela seção nova (versaoSave e MIGRACOES do integrador); calibrar P, limiares e perdas com a cidade grande; trânsito do Arcologia e visitantes não entram nas viagens; o bench A5 já estava fora da meta antes (sintética de 126 mil moradores).
