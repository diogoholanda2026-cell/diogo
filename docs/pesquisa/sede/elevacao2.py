# Elevação sul da sede v2 e silhuetas reais na mesma escala (metros).
from PIL import Image, ImageDraw, ImageFont
S = 0.9
W, H = 2300, 1040
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
for h in range(0, 900, 100):
    y = CHAO - h * S; d.line([(40, y), (W - 20, y)], fill=(222, 218, 208)); d.text((8, y), f'{h} m', fill=(120, 115, 105), font=F, anchor='lm')
d.line([(40, CHAO), (W - 20, CHAO)], fill=(80, 75, 65), width=2)
d.text((20, 14), 'Sede v2 vista do mar (olhando para o norte) e referências reais na mesma escala', fill=(20, 20, 20), font=FT)
B = 60 + 340 * S
PRED = (232, 226, 212); VID = (170, 195, 210); FUNDO = (205, 200, 188); TORRE = (85, 90, 100)
for (a, b, h) in ((-44, 90, 48), (120, 210, 66), (290, 380, 66), (410, 530, 48)): ret(B, a, b, 0, h, FUNDO, (150, 145, 135))
ret(B, -93, 27, 0, 22, FUNDO, (150, 145, 135)); ret(B, 485, 581, 0, 14, FUNDO, (150, 145, 135))
def torre(xc, h, cor):
    f = (0.494, 0.703, 0.912)
    ret(B, xc - 18, xc + 18, 0, h * f[0], cor); ret(B, xc - 15, xc + 18, h * f[0], h * f[1], cor)
    ret(B, xc - 10, xc + 18, h * f[1], h * f[2], cor); ret(B, xc - 12, xc + 18, h * f[2], h, (140, 130, 110))
    d.line([(X(xc + 3, B), CHAO - h * S), (X(xc + 3, B), CHAO - (h + 20) * S)], fill=(60, 60, 60), width=2)
torre(202, 452, (105, 110, 122)); torre(298, 500, TORRE)
# ponte da cachoeira a 45 m e a cortina de água caindo no lago
ret(B, 220, 280, 45, 51, (160, 150, 130))
d.rectangle([X(224, B), CHAO - 45 * S, X(276, B), CHAO], fill=(200, 225, 240), outline=None)
# anel da Sede (30 m) com o pórtico sul no eixo
ret(B, 9, 491, 0, 30, PRED); d.rectangle([X(230, B), CHAO - 18 * S, X(270, B), CHAO], fill=(246, 244, 238), outline=(60, 55, 50))
# cúpula de vidro de 240 m por 80 m
d.pieslice([X(-295, B), CHAO - 80 * S, X(-55, B), CHAO + 80 * S], 180, 360, fill=VID, outline=(60, 55, 50))
for fr in (0.25, 0.5, 0.75): d.arc([X(-295 + 120 * fr, B), CHAO - 80 * S, X(-55 - 120 * fr, B), CHAO + 80 * S], 180, 360, fill=(140, 165, 180))
for x, h in ((-265, 50), (-235, 40), (-205, 46), (-175, 34), (-145, 44), (-115, 30)):
    d.line([(X(x, B), CHAO), (X(x, B), CHAO - h * S)], fill=(70, 95, 80), width=3); d.polygon([(X(x - 7, B), CHAO - h * S), (X(x + 7, B), CHAO - h * S), (X(x, B), CHAO - (h - 12) * S)], fill=(70, 95, 80))
ret(B, 540, 610, 0, 25, PRED); d.pieslice([X(559, B), CHAO - 41 * S, X(591, B), CHAO - 9 * S], 180, 360, fill=(200, 190, 170), outline=(60, 55, 50))
ret(B, 600, 656, 0, 18, PRED)
rot(B, 298, 520, 'Torre Lâmina 500 m', FB); rot(B, 202, 472, 'Torre irmã 452 m', FB)
rot(B, 250, 51, 'cachoeira 45 m'); rot(B, 400, 30, 'Sede em anel 30 m'); rot(B, -175, 80, 'Cúpula de vidro 80 m', FB)
rot(B, 575, 41, 'Biblioteca 41 m'); rot(B, 150, 66, 'Moradia 48 a 66 m', F, (110, 105, 95))
d.line([(X(9, B), CHAO + 30), (X(491, B), CHAO + 30)], fill=(40, 40, 40), width=2)
d.text((X(250, B), CHAO + 34), 'anel: 481 m de diâmetro, 1,5 km de fachada', fill=(30, 30, 30), font=F, anchor='mt')
d.line([(X(-295, B), CHAO + 30), (X(-55, B), CHAO + 30)], fill=(40, 40, 40), width=2)
d.text((X(-175, B), CHAO + 34), 'cúpula: 240 m', fill=(30, 30, 30), font=F, anchor='mt')
d.line([(X(-340, B), CHAO + 64), (X(660, B), CHAO + 64)], fill=(120, 120, 120), width=1)
d.text((X(160, B), CHAO + 68), 'área da sede: 1.000 m de leste a oeste', fill=(90, 90, 90), font=F, anchor='mt')
d.text((X(160, B), CHAO + 98), 'PROPOSTA v2', fill=(200, 60, 40), font=FT, anchor='mt')
x0 = 60 + 1000 * S + 80
def ref(larg, nome, desenho):
    global x0
    desenho(x0); d.text((x0 + larg * S / 2, CHAO + 34), nome, fill=(30, 30, 30), font=F, anchor='mt'); x0 += larg * S + 60
def burj(b):
    for a, c, h0, h1 in [(0, 60, 0, 160), (8, 52, 160, 330), (14, 46, 330, 480), (20, 40, 480, 600), (24, 36, 600, 700), (27, 33, 700, 828)]: ret(b, a, c, h0, h1, (175, 180, 190))
    rot(b, 30, 828, 'Burj Khalifa 828 m', FB)
def petronas(b):
    ret(b, 0, 46, 0, 452, (190, 190, 195)); ret(b, 104, 150, 0, 452, (190, 190, 195)); ret(b, 46, 104, 170, 180, (150, 150, 155))
    rot(b, 75, 452, 'Petronas 452 m', FB)
def mbs(b):
    for x in (20, 140, 260): ret(b, x, x + 60, 0, 194, (195, 190, 180))
    ret(b, 0, 340, 194, 204, (120, 140, 110)); rot(b, 170, 204, 'Marina Bay Sands 194 m', FB)
def apple(b):
    ret(b, 0, 481, 0, 30, (215, 210, 200)); rot(b, 240, 30, 'Apple Park 30 m', FB)
ref(60, 'na ponta do lago', burj); ref(150, 'gêmeas, ponte a 170 m', petronas); ref(340, 'três torres, parque no topo', mbs)
x0 -= 25
ref(481, 'anel de 481 m, 4 andares', apple)
im.save('elevacao2.png'); print('ok', x0)
