# Planta da sede v2: anel fechado da Apple Park, lago central com fontes e a cachoeira entre as torres gêmeas,
# cúpula de vidro no eixo oeste. Mesma escala das pranchas (0,5 px por metro), sobre o relevo real do jogo.
import json, math
from PIL import Image, ImageDraw, ImageFont
T = json.load(open('terreno.json')); nx, nz, p, tx0, tz0 = T['nx'], T['nz'], T['p'], T['x0'], T['z0']
MEIA, PX = 700, 700
CX, CZ = 160, 560
k = PX / (2 * MEIA)
im = Image.new('RGB', (PX, PX + 40), (238, 234, 226)); px = im.load()
def P(x, z): return (PX / 2 + (x - CX) * k, 40 + PX / 2 + (z - CZ) * k)
for j in range(PX):
    for i in range(PX):
        x = CX + (i - PX / 2) / k; z = CZ + (j - PX / 2) / k
        a = int((x - tx0) / p); b = int((z - tz0) / p)
        if not (0 <= a < nx - 1 and 0 <= b < nz - 1): continue
        h = T['h'][b * nx + a]; w = T['a'][b * nx + a]
        if w or h < 0: px[i, j + 40] = (95, 140, 170) if h < 0 else (110, 160, 190)
        else:
            s = max(0, min(1, 0.6 - 0.12 * ((T['h'][b * nx + a + 1] - h) + (T['h'][(b + 1) * nx + a] - h))))
            base = (196, 186, 150) if h < 2.5 else (178, 190, 150) if h < 25 else (140, 160, 120)
            px[i, j + 40] = tuple(int(c * (0.7 + 0.45 * s)) for c in base)
d = ImageDraw.Draw(im)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12); FT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
C = (250, 570); VERDE = (126, 166, 98); MATA = (92, 132, 78); PREDIO = (232, 226, 212); CONT = (70, 60, 50)
AGUA = (70, 125, 165); VIA = (120, 120, 118); VIDRO = (185, 212, 226); PEDRA = (214, 206, 188)
def frange(a, b, s):
    n = max(1, int(abs(b - a) / abs(s))); return [a + (b - a) * i / n for i in range(n + 1)]
def arco(r0, r1, a0, a1, cor, cont=None, c=C):
    pts = [P(c[0] + r1 * math.cos(math.radians(t)), c[1] - r1 * math.sin(math.radians(t))) for t in frange(a0, a1, 1)]
    pts += [P(c[0] + r0 * math.cos(math.radians(t)), c[1] - r0 * math.sin(math.radians(t))) for t in frange(a1, a0, -1)]
    d.polygon(pts, fill=cor, outline=cont)
def circ(x, z, r, cor, cont=None, w=1):
    X, Y = P(x, z); d.ellipse([X - r * k, Y - r * k, X + r * k, Y + r * k], fill=cor, outline=cont, width=w)
def elipse(x, z, rx, rz, cor, cont=None):
    X, Y = P(x, z); d.ellipse([X - rx * k, Y - rz * k, X + rx * k, Y + rz * k], fill=cor, outline=cont)
def retang(x, z, lx, lz, ang, cor, cont=CONT):
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    pts = [(x + c * u - s * v, z + s * u + c * v) for u, v in ((-lx/2, -lz/2), (lx/2, -lz/2), (lx/2, lz/2), (-lx/2, lz/2))]
    d.polygon([P(*q) for q in pts], fill=cor, outline=cont)
def linha(x0, z0, x1, z1, cor, larg):
    d.line([P(x0, z0), P(x1, z1)], fill=cor, width=max(1, int(larg * k)))
def texto(x, z, t, cor=(20, 20, 20), f=F):
    X, Y = P(x, z); d.text((X, Y), t, fill=cor, font=f, anchor='mm')
g = [(-340, 180), (660, 180), (660, 940), (-340, 940)]
for i in range(4): d.line([P(*g[i]), P(*g[(i + 1) % 4])], fill=(255, 255, 255), width=1)
# cinturão de mata em volta do anel (como o bosque da Apple Park) e o anel viário
arco(241, 272, 0, 360, MATA)
arco(272, 290, 0, 360, VIA)
# eixos: norte até o portão, sul até a praia, leste até a Biblioteca, oeste até a cúpula
linha(250, 180, 250, 329, PEDRA, 24); linha(250, 811, 250, 935, PEDRA, 24)
linha(491, 570, 540, 570, PEDRA, 24); linha(-55, 570, 9, 570, PEDRA, 24)
linha(-340, 745, -40, 745, VIA, 16); linha(660, 430, 530, 430, VIA, 16)
# o anel da Sede (Apple Park: 481 m por fora, 358 m por dentro, 4 andares), com os quatro pórticos nos eixos
for a0, a1 in ((5, 85), (95, 175), (185, 265), (275, 355)): arco(180, 241, a0, a1, PREDIO, CONT)
for a in (0, 90, 180, 270): arco(180, 241, a - 5, a + 5, (215, 208, 192), CONT)
# pátio: parque em volta do lago central
circ(C[0], C[1], 180, VERDE)
for ang in range(0, 360, 12):
    for rr in (150, 166):
        circ(C[0] + rr * math.cos(math.radians(ang + rr)), C[1] - rr * math.sin(math.radians(ang + rr)), 3, MATA)
circ(C[0], C[1], 135, AGUA)
# fontes dançantes em arco no lado sul do lago
for ang in frange(205, 335, 6):
    circ(C[0] + 108 * math.cos(math.radians(ang)), C[1] - 108 * math.sin(math.radians(ang)), 2.2, (235, 245, 250))
# duas ilhas com as torres gêmeas e o vão da cachoeira entre elas
elipse(C[0] - 52, C[1], 40, 46, PEDRA, CONT); elipse(C[0] + 52, C[1], 40, 46, PEDRA, CONT)
retang(C[0] - 48, C[1], 36, 50, 0, (80, 85, 95), (20, 20, 20)); retang(C[0] + 48, C[1], 36, 50, 0, (60, 60, 70), (20, 20, 20))
retang(C[0], C[1], 60, 10, 0, (160, 150, 130), (20, 20, 20))
elipse(C[0], C[1] + 14, 12, 7, (225, 240, 250), None)
# cúpula de vidro no eixo oeste, com o bosque das Supertrees ao sul
circ(-175, 570, 120, VIDRO, CONT, 2)
for ang in range(0, 180, 20):
    x0 = -175 + 120 * math.cos(math.radians(ang)); z0 = 570 - 120 * math.sin(math.radians(ang))
    x1 = -175 - 120 * math.cos(math.radians(ang)); z1 = 570 + 120 * math.sin(math.radians(ang))
    d.line([P(x0, z0), P(x1, z1)], fill=(150, 175, 190), width=1)
circ(-175, 570, 60, None, (150, 175, 190)); circ(-175, 570, 14, VERDE, CONT)
d.polygon([P(*q) for q in ((-300, 770), (-150, 770), (-60, 820), (-80, 900), (-220, 915), (-310, 860))], fill=VERDE)
for (dx, dz) in ((-265, 800), (-220, 795), (-175, 805), (-130, 815), (-245, 845), (-200, 850), (-155, 860), (-110, 865), (-220, 890)):
    circ(dx, dz, 7, (70, 105, 80), CONT)
# Biblioteca no eixo leste
retang(575, 570, 70, 70, 0, PREDIO); circ(575, 570, 16, (200, 190, 170), CONT)
# moradia em arcos, fora do anel viário, com aberturas nos raios
for a0, a1 in ((22, 40), (58, 84), (96, 122), (140, 158)): arco(305, 338, a0, a1, PREDIO, CONT)
# raios de 45 graus: Universidade (NO), Escola (NE), Física (SE)
retang(C[0] - 405 * 0.7071, C[1] - 405 * 0.7071, 120, 76, 45, PREDIO)
retang(C[0] + 400 * 0.7071, C[1] - 400 * 0.7071, 96, 66, -45, PREDIO)
circ(C[0] + 395 * 0.7071, C[1] + 395 * 0.7071, 55, None, CONT); circ(C[0] + 395 * 0.7071, C[1] + 395 * 0.7071, 45, VERDE, CONT)
retang(C[0] + 335 * 0.7071, C[1] + 335 * 0.7071, 56, 28, -45, PREDIO)
# praça de chegada ao norte e passeio da praia ao sul
retang(250, 215, 110, 60, 0, PEDRA, None); retang(110, 215, 150, 60, 0, MATA, None); retang(390, 215, 150, 60, 0, MATA, None)
linha(-340, 930, 660, 930, (222, 212, 180), 14)
# rótulos
texto(250, 200, 'Portão norte'); texto(250, 350, 'Sede em anel (4 andares)'); texto(250, 505, 'Lago com fontes')
texto(250, 640, 'Torres 500 e 452 m, cachoeira no vão'); texto(-175, 500, 'Cúpula de vidro'); texto(-175, 520, '240 m, 80 m de altura')
texto(575, 625, 'Biblioteca'); texto(-45, 200, 'Universidade'); texto(545, 205, 'Escola'); texto(560, 900, 'Física')
texto(-190, 930, 'Jardim e Supertrees'); texto(250, 300, 'Moradia', (40, 40, 40))
x0, y0 = 20, PX + 20
d.line([(x0, y0), (x0 + 200 * k, y0)], fill=(0, 0, 0), width=3); d.text((x0 + 200 * k + 8, y0 - 8), '200 m', fill=(0, 0, 0), font=F)
d.text((12, 8), 'Sede da Holding v2: anel, lago, torres gêmeas e cúpula', fill=(20, 20, 20), font=FT)
im.save('proposta2.png'); print('ok')
