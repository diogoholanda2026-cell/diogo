# Elevação sul (vista do mar) da proposta e silhuetas reais na mesma escala, em metros.
from PIL import Image, ImageDraw, ImageFont
S = 0.95                                   # px por metro
W, H = 2300, 1020
CHAO = H - 150
im = Image.new('RGB', (W, H), (246, 244, 238)); d = ImageDraw.Draw(im)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
FT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24)
def X(x, base): return base + x * S
def ret(base, x0, x1, h0, h1, cor, cont=(60, 55, 50)):
    d.rectangle([X(x0, base), CHAO - h1 * S, X(x1, base), CHAO - h0 * S], fill=cor, outline=cont)
def rot(base, x, h, t, fonte=F, cor=(25, 25, 25)):
    d.text((X(x, base), CHAO - h * S - 8), t, fill=cor, font=fonte, anchor='mb')
# linhas de altura
for h in range(0, 900, 100):
    y = CHAO - h * S; d.line([(40, y), (W - 20, y)], fill=(222, 218, 208)); d.text((8, y), f'{h} m', fill=(120, 115, 105), font=F, anchor='lm')
d.line([(40, CHAO), (W - 20, CHAO)], fill=(80, 75, 65), width=2)
d.text((20, 14), 'Alturas e comprimentos da proposta (vista do mar, olhando para o norte) e das referências reais, na mesma escala', fill=(20, 20, 20), font=FT)
# ---------------- proposta (x do jogo: -340 a 660) ----------------
B = 60 + 340 * S
PRED = (226, 214, 190); VID = (150, 175, 190); FUNDO = (205, 200, 188); VERDE = (110, 150, 95)
# fundo: moradia, universidade, escola
for (a, b, h) in ((-190, -48, 48), (-73, 122, 66), (198, 393, 66), (437, 514, 48)): ret(B, a, b, 0, h, FUNDO, (150, 145, 135))
ret(B, -245, -115, 0, 22, FUNDO, (150, 145, 135)); ret(B, 446, 546, 0, 14, FUNDO, (150, 145, 135))
# Sede em crescente com o pórtico no eixo
ret(B, -74, 394, 0, 33, PRED); d.rectangle([X(140, B), CHAO - 20 * S, X(180, B), CHAO], fill=(246, 244, 238), outline=(60, 55, 50))
# Torres do Conselho (gêmeas)
ret(B, -77, -37, 0, 150, VID); ret(B, 357, 397, 0, 150, VID)
# Torre Lâmina: três lâminas (163, 232, 301), coroa até 330, mastro
ret(B, 142, 178, 0, 163, (95, 100, 110)); ret(B, 146, 178, 163, 232, (95, 100, 110)); ret(B, 152, 178, 232, 301, (95, 100, 110))
ret(B, 150, 178, 301, 330, (140, 130, 110)); d.line([(X(164, B), CHAO - 330 * S), (X(164, B), CHAO - 348 * S)], fill=(60, 60, 60), width=2)
# Vida: anel de vidro com cúpula
d.pieslice([X(-302, B), CHAO - 40 * S, X(-158, B), CHAO + 40 * S], 180, 360, fill=VID, outline=(60, 55, 50))
# Supertrees
for x, h in ((-150, 50), (-125, 42), (-100, 36), (-80, 46), (-60, 30)):
    d.line([(X(x, B), CHAO), (X(x, B), CHAO - h * S)], fill=(70, 95, 80), width=3); d.polygon([(X(x - 7, B), CHAO - h * S), (X(x + 7, B), CHAO - h * S), (X(x, B), CHAO - (h - 12) * S)], fill=(70, 95, 80))
# Biblioteca e Física
ret(B, 505, 575, 0, 25, PRED); d.pieslice([X(524, B), CHAO - 41 * S, X(556, B), CHAO - 9 * S], 180, 360, fill=(200, 190, 170), outline=(60, 55, 50))
ret(B, 578, 640, 0, 18, PRED)
# lago à frente
d.rectangle([X(-66, B), CHAO, X(386, B), CHAO + 10], fill=(80, 130, 170))
rot(B, 160, 348, 'Torre Lâmina 330 m', FB); rot(B, -57, 150, 'Conselho 150 m'); rot(B, 377, 150, 'Conselho 150 m')
rot(B, 280, 33, 'Sede 33 m'); rot(B, -230, 40, 'Vida 40 m'); rot(B, 540, 41, 'Biblioteca 41 m'); rot(B, 20, 66, 'Moradia 48 a 66 m', F, (110, 105, 95))
d.line([(X(-74, B), CHAO + 30), (X(394, B), CHAO + 30)], fill=(40, 40, 40), width=2)
d.text((X(160, B), CHAO + 34), 'crescente da Sede: 468 m de ponta a ponta, 650 m de fachada curva', fill=(30, 30, 30), font=F, anchor='mt')
d.line([(X(-340, B), CHAO + 62), (X(660, B), CHAO + 62)], fill=(120, 120, 120), width=1)
d.text((X(160, B), CHAO + 66), 'área da sede: 1.000 m de leste a oeste', fill=(90, 90, 90), font=F, anchor='mt')
d.text((X(160, B), CHAO + 96), 'PROPOSTA', fill=(200, 60, 40), font=FT, anchor='mt')
# ---------------- referências ----------------
x0 = 60 + 1000 * S + 70
def ref(larg, nome, desenho):
    global x0
    desenho(x0); d.text((x0 + larg * S / 2, CHAO + 34), nome, fill=(30, 30, 30), font=F, anchor='mt'); x0 += larg * S + 55
def burj(b):
    degraus = [(0, 60, 0, 160), (8, 52, 160, 330), (14, 46, 330, 480), (20, 40, 480, 600), (24, 36, 600, 700), (27, 33, 700, 828)]
    for a, c, h0, h1 in degraus: ret(b, a, c, h0, h1, (175, 180, 190))
    rot(b, 30, 828, 'Burj Khalifa 828 m', FB)
def petronas(b):
    ret(b, 0, 46, 0, 452, (190, 190, 195)); ret(b, 104, 150, 0, 452, (190, 190, 195)); ret(b, 46, 104, 170, 180, (150, 150, 155))
    rot(b, 75, 452, 'Petronas 452 m', FB)
def mbs(b):
    for x in (20, 140, 260): ret(b, x, x + 60, 0, 194, (195, 190, 180))
    ret(b, 0, 340, 194, 204, (120, 140, 110)); rot(b, 170, 204, 'Marina Bay Sands 194 m', FB)
def apple(b):
    ret(b, 0, 461, 0, 23, (215, 210, 200)); rot(b, 230, 23, 'Apple Park 23 m (anel de 461 m)', FB)
ref(60, 'na ponta do lago', burj); ref(150, 'duas torres, ponte a 170 m', petronas); ref(340, 'três torres e o parque no topo', mbs)
x0 -= 20
ref(461, '4 andares, 1,4 km de fachada', apple)
im.save('elevacao.png'); print('ok', x0)
