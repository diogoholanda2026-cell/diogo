# Nota de entrega da U2b: Modo livre, sons do mundo, música generativa, Mural, modo foto e abertura de 40 s

Resultado: pronta e verde. `node ferramentas/simular.mjs --testes` verde (inclui `ui.teste.mjs`, `u2b.teste.mjs` e a guarda de texto,
373 arquivos). Vitrine das 6 cenas da U2b (`u2b-mural`, `u2b-mural-arcologia`, `u2b-foto`, `u2b-foto-noite`, `u2b-abertura`,
`u2b-nova-livre`) verde em 986x443, 915x412, 1376x768 e 1920x1080, sem erros de página (saída em `/tmp/u2bui/ui`, fora de `previa/`).
Sem commit.

## O que existe
- Modo livre na nova partida (`ui/inicio/corpo/Inicio.jsx`, textos `u2b.nova.*`).
- Sons do mundo por altura da câmera (`fonte/som/mundo.js`) e música generativa (`fonte/som/musica.js`).
- Mural (`ui/telas/Mural.jsx` e `ui/telas/corpo/Mural.jsx`, carga sob demanda), com abas por assunto e "Ver no mapa".
- Modo foto (`ui/telas/Foto.jsx`): luz, tamanho, salvar imagem, Esc sai, H esconde o painel.
- Abertura de 40 s (`ui/inicio/Abertura.jsx`), com quatro legendas, pular por Esc ou Espaço e opção nas configurações.
- Textos: todas as chaves `u2b.*` (44) têm texto em `fonte/ui/textos/u2b.js`, incluindo `u2b.mural.*`.

## Pendente
- Nada da ficha. Os ajustes de som (volumes, altura de corte) e a música pedem escuta no PC do dono.
- Mexida em `fonte/render` (veiculos-luxo, vidaLuxo) é da R6, não desta parcela.
