# -*- coding: utf-8 -*-
"""
Recorta as construções a partir das imagens originais (arte/originais)
e gera codigo-fonte/imagens.js com todas as imagens embutidas (WebP em base64).

Uso:  python3 codigo-fonte/ferramentas/preparar-imagens.py [--folha]
      --folha  também salva arte/folha-de-contato.png para conferência visual.

Cada recorte é desenhado no jogo com largura = w quadrados; a altura segue a
proporção do recorte (o que sobra acima da base é a "altura" do prédio).
"""
import base64, io, json, pathlib, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
ORIG = RAIZ / 'arte' / 'originais'
SAIDA = RAIZ / 'codigo-fonte' / 'imagens.js'

FONTES = {
    'held':      'held-composicao-total.png',
    'ciencia':   'modelo02-ciencia-educacao.png',
    'santuario': 'modelo02-santuario-expandido.png',
    'holding':   'modelo02-holding-santuario-global.png',
    'arcoCirc':  'modelo01-arcologia-circular.jpg',
    'sede':      'sede-holding-por-do-sol.jpg',
}
PX_POR_QUADRADO = 128   # resolução máxima dos sprites

# chave: (fonte, caixa (x0,y0,x1,y1), largura em quadrados, altura em quadrados, remendos)
# remendo = (retângulo com etiqueta de texto, deslocamento y, deslocamento x) — copia a área vizinha por cima.
RECORTES = {
    # ---- zona residencial (7 estágios, todos 3x2) ----
    'res1': ('held',     (935, 490, 1175, 610), 3, 2, None),
    'res2': ('held',     (345, 320, 585, 480),  3, 2, [((362, 383, 498, 412), 31, 0)]),
    'res3': ('arcoCirc', (100, 130, 340, 290),  3, 2, None),
    'res4': ('arcoCirc', (230, 285, 470, 445),  3, 2, None),
    'res5': ('arcoCirc', (1000, 285, 1240, 445), 3, 2, None),
    'res6': ('arcoCirc', (1060, 110, 1300, 270), 3, 2, None),
    'res7': ('arcoCirc', (460, 120, 700, 280),  3, 2, None),
    # ---- fábricas ----
    'fab1': ('held',     (560, 512, 722, 632),  3, 2, None),
    'fab2': ('holding',  (720, 440, 930, 580),  3, 2, None),
    'fab3': ('holding',  (700, 430, 1060, 610), 4, 2, None),
    'fab4': ('arcoCirc', (195, 455, 435, 615),  3, 2, None),
    # ---- lojas ----
    'loja1': ('ciencia', (585, 270, 735, 370),  3, 2, None),
    'loja2': ('holding', (520, 430, 670, 530),  3, 2, [((533, 432, 636, 460), 30, 0)]),
    'loja3': ('ciencia', (1040, 285, 1200, 392), 3, 2, None),
    'loja4': ('arcoCirc', (860, 190, 1010, 300), 3, 2, None),
    'loja5': ('held',    (430, 190, 690, 320),  4, 2, [((430, 272, 520, 320), -50, 0)]),
    # ---- energia ----
    'ener1': ('ciencia', (975, 175, 1125, 275), 3, 2, None),
    'ener2': ('holding', (40, 112, 400, 292),   4, 2, None),
    'ener3': ('ciencia', (680, 215, 1200, 475), 4, 2, None),
    # ---- água ----
    'agua1': ('ciencia', (520, 480, 720, 600),  2, 1, None),
    'agua2': ('ciencia', (320, 500, 480, 600),  2, 1, None),
    'agua3': ('ciencia', (425, 105, 950, 280),  3, 1, None),
    # ---- reciclagem ----
    'rec1': ('holding',  (1000, 318, 1120, 410), 2, 2, None),
    'rec2': ('holding',  (1100, 430, 1260, 540), 3, 2, None),
    'rec3': ('held',     (230, 115, 560, 250),  4, 2, None),
    # ---- segurança ----
    'seg1': ('ciencia',  (930, 505, 1030, 605), 2, 2, None),
    'seg2': ('holding',  (520, 455, 670, 540),  3, 2, None),
    # ---- saúde ----
    'sau1': ('ciencia',  (1140, 390, 1280, 483), 3, 2, None),
    'sau2': ('ciencia',  (80, 240, 260, 340),   3, 2, None),
    'sau3': ('ciencia',  (640, 300, 880, 460),  3, 2, None),
    # ---- educação ----
    'edu1': ('held',     (40, 352, 330, 545),   3, 2, None),
    'edu2': ('santuario', (80, 215, 545, 525),  3, 2, None),
    'edu3': ('held',     (670, 262, 990, 582),  2, 2, None),
    'edu4': ('ciencia',  (250, 100, 530, 300),  4, 2, None),
    # ---- parques e bem-estar ----
    'par1': ('ciencia',  (530, 445, 690, 525),  2, 1, None),
    'par2': ('santuario', (235, 325, 405, 410), 2, 1, None),
    'par3': ('held',     (880, 400, 1085, 510), 3, 2, None),
    'par4': ('santuario', (1035, 572, 1255, 682), 2, 1, None),
    'par5': ('santuario', (600, 520, 840, 640), 2, 1, None),
    'par6': ('arcoCirc', (880, 380, 1120, 540), 3, 2, None),
    'par7': ('arcoCirc', (400, 380, 640, 540),  3, 2, None),
    'par8': ('ciencia',  (1180, 300, 1330, 400), 3, 2, None),
    'par9': ('santuario', (1000, 250, 1270, 520), 2, 2, None),
    'par10': ('held',    (1045, 300, 1255, 440), 3, 2, [((1203, 318, 1255, 352), 0, -58)]),
    'par11': ('santuario', (640, 320, 1010, 505), 4, 2, None),
    'par12': ('held',    (1110, 148, 1330, 262), 4, 1, None),
    # ---- transporte e comércio ----
    'tra1': ('arcoCirc', (1160, 195, 1400, 355), 3, 2, None),
    'tra2': ('ciencia',  (520, 350, 700, 440),  2, 1, None),
    'mer1': ('arcoCirc', (600, 215, 840, 375),  3, 2, None),
    # ---- sede e marcos (megaestruturas) ----
    'sede':     ('sede',     (50, 1095, 1108, 1518), 5, 2, None),
    'arco':     ('santuario', (440, 55, 1000, 335), 4, 2, None),
    'arcoCirc': ('arcoCirc', (100, 90, 1330, 617),  7, 3, None),
    'ciencia':  ('ciencia',  (60, 98, 1300, 629),   7, 3, None),
    'santuario': ('santuario', (60, 98, 1300, 629), 7, 3, None),
    'holding':  ('holding',  (60, 98, 1300, 629),   7, 3, None),
    'held':     ('held',     (60, 98, 1300, 629),   7, 3, None),
}
# imagens inteiras para a ficha da construção
INTEIRAS = {
    'sedeFull':      ('sede', (50, 758, 1108, 1816), 560),
    'arcoCircFull':  ('arcoCirc', None, 720),
    'cienciaFull':   ('ciencia', None, 720),
    'santuarioFull': ('santuario', None, 720),
    'holdingFull':   ('holding', None, 720),
    'heldFull':      ('held', None, 720),
}


def carregar(nome):
    return Image.open(ORIG / FONTES[nome]).convert('RGB')


def remendar(im, rect, dy, dx=0, suave=6):
    """Cobre um retângulo (etiqueta de texto) com a área vizinha deslocada, com bordas suaves."""
    x0, y0, x1, y1 = rect
    origem = im.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy))
    coberto = im.copy(); coberto.paste(origem, (x0, y0))
    mascara = Image.new('L', im.size, 0)
    ImageDraw.Draw(mascara).rectangle((x0, y0, x1 - 1, y1 - 1), fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(suave))
    return Image.composite(coberto, im, mascara)


def para_b64(im, q, alfa=False):
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6, **({'lossless': False} if alfa else {}))
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def main():
    folha = '--folha' in sys.argv
    cache = {}
    def fonte(n):
        if n not in cache: cache[n] = carregar(n)
        return cache[n]
    saida = {}; meta = {}; total = 0; amostras = []
    for k, (f, caixa, w, h, remendos) in RECORTES.items():
        im = fonte(f)
        if remendos:
            for r, dy, dx in remendos: im = remendar(im, r, dy, dx)
        im = im.crop(caixa)
        if k == 'sede':
            im = ImageEnhance.Brightness(im).enhance(1.35); im = ImageEnhance.Contrast(im).enhance(1.08)
        lw = min(im.width, PX_POR_QUADRADO * w); lh = round(im.height * lw / im.width)
        im = im.resize((lw, lh), Image.LANCZOS)
        s, n = para_b64(im, 78 if w >= 5 else 82); saida[k] = s; total += n
        meta[k] = [w, h, round(im.height / im.width, 4)]
        amostras.append((k, im)); print(f'{k:10s} {im.size} {n:7d} B')
    for k, (f, caixa, lw) in INTEIRAS.items():
        im = fonte(f)
        if caixa: im = im.crop(caixa)
        im = im.resize((lw, round(im.height * lw / im.width)), Image.LANCZOS)
        s, n = para_b64(im, 70); saida[k] = s; total += n; print(f'{k:10s} {im.size} {n:7d} B')
    saida['meta'] = meta
    SAIDA.write_text('const ASSETS=' + json.dumps(saida, separators=(',', ':')) + ';\n', encoding='utf-8')
    print('total bytes', total, '->', SAIDA)
    if folha:
        cols = 4; cw = 300; ch = 230
        rows = (len(amostras) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cw, rows * ch), (18, 22, 34)); d = ImageDraw.Draw(sheet)
        for i, (k, im) in enumerate(amostras):
            sc = min((cw - 10) / im.width, (ch - 26) / im.height)
            t = im.resize((int(im.width * sc), int(im.height * sc)), Image.LANCZOS)
            x = (i % cols) * cw + 5; y = (i // cols) * ch + 20
            sheet.paste(t, (x, y)); d.text((x, y - 15), f'{k} {meta[k][0]}x{meta[k][1]}', fill=(255, 230, 120))
        sheet.save(RAIZ / 'arte' / 'folha-de-contato.png'); print('folha salva em arte/folha-de-contato.png')


if __name__ == '__main__':
    main()
