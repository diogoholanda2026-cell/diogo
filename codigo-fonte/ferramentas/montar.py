# -*- coding: utf-8 -*-
"""Junta as partes num único arquivo HTML jogável: arcologia-de-held.html (na raiz do repositório)."""
import pathlib
RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
CF = RAIZ / 'codigo-fonte'
head = (CF / 'estilo-e-cabecalho.html').read_text(encoding='utf-8')
body = (CF / 'estrutura.html').read_text(encoding='utf-8')
imgs = (CF / 'imagens.js').read_text(encoding='utf-8')
three = (CF / 'lib' / 'three.min.js').read_text(encoding='utf-8')
partes = sorted((CF / 'js').glob('*.js'))
jogo = '\n'.join(p.read_text(encoding='utf-8') for p in partes)
html = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n'
        + head + '\n</head>\n<body>\n' + body + '\n<script>' + three + '</script>\n<script>' + imgs + '</script>\n<script>\n\'use strict\';\n(function () {\n' + jogo + '\n})();\n</script>\n</body>\n</html>\n')
saida = RAIZ / 'arcologia-de-held.html'
saida.write_text(html, encoding='utf-8')
print('Pronto:', saida, f'({saida.stat().st_size / 1e6:.2f} MB, {len(partes)} módulos)')
