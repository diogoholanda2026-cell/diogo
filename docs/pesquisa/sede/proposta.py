# Planta proposta da sede (plano A revisto) sobre o terreno real, na mesma escala das referências (0,5 px por metro).
import json, math
from PIL import Image, ImageDraw, ImageFont
T = json.load(open('terreno.json')); nx, nz, p, tx0, tz0 = T['nx'], T['nz'], T['p'], T['x0'], T['z0']
MEIA, PX = 700, 700
CX, CZ = 160, 560                     # centro da janela (centro da gleba)
k = PX / (2 * MEIA)
im = Image.new('RGB', (PX, PX + 40), (238, 234, 226)); px = im.load()
def P(x, z): return (PX / 2 + (x - CX) * k, 40 + PX / 2 + (z - CZ) * k)
# fundo: relevo e água
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
try:
    F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13); FT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception: F = FT = ImageFont.load_default()
C = (160, 600); VERDE = (126, 166, 98); MATA = (92, 132, 78); PREDIO = (226, 214, 190); CONT = (70, 60, 50); AGUA = (70, 125, 165); VIA = (120, 120, 118)
def arco(r0, r1, a0, a1, cor, cont=None, passo=1):
    """setor de anel entre os raios r0 e r1, ângulos em graus (0 = leste, 90 = norte)"""
    pts = [P(C[0] + r1 * math.cos(math.radians(t)), C[1] - r1 * math.sin(math.radians(t))) for t in frange(a0, a1, passo)]
    pts += [P(C[0] + r0 * math.cos(math.radians(t)), C[1] - r0 * math.sin(math.radians(t))) for t in frange(a1, a0, -passo)]
    d.polygon(pts, fill=cor, outline=cont)
def frange(a, b, s):
    n = max(1, int(abs(b - a) / abs(s))); return [a + (b - a) * i / n for i in range(n + 1)]
def circ(x, z, r, cor, cont=None):
    X, Y = P(x, z); d.ellipse([X - r * k, Y - r * k, X + r * k, Y + r * k], fill=cor, outline=cont)
def retang(x, z, lx, lz, ang, cor, cont=CONT):
    c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    pts = [(x + c * u - s * v, z + s * u + c * v) for u, v in ((-lx/2, -lz/2), (lx/2, -lz/2), (lx/2, lz/2), (-lx/2, lz/2))]
    d.polygon([P(*q) for q in pts], fill=cor, outline=cont)
def texto(x, z, t, cor=(20, 20, 20)):
    X, Y = P(x, z); d.text((X, Y), t, fill=cor, font=F, anchor='mm')
# gleba
g = [(-340, 180), (660, 180), (660, 940), (-340, 940)]
for i in range(4): d.line([P(*g[i]), P(*g[(i + 1) % 4])], fill=(255, 255, 255), width=1)
# mata e bosques (cinturão entre o crescente e o anel viário, como o pomar da Apple Park)
arco(236, 292, 0, 180, MATA)
circ(C[0], C[1], 0, None)
# anel viário e raios até os portões
arco(292, 306, 0, 360, VIA, passo=2)
for (x0, z0, x1, z1) in [(160, 180, 160, 294), (-340, 600, -134, 600), (660, 600, 454, 600)]:
    d.line([P(x0, z0), P(x1, z1)], fill=VIA, width=max(3, int(16 * k)))
# esplanada leste-oeste (diâmetro) e passeio da praia
retang(160, 600, 520, 34, 0, (214, 206, 188), None)
# lago: meio disco ao sul, completando o círculo do crescente (lição da McLaren)
arco(0, 226, 180, 360, AGUA, passo=1)
retang(160, 600, 470, 34, 0, (214, 206, 188), None)
# crescente da Sede: meio anel ao norte com o pórtico no eixo (lição da Apple Park e da McLaren)
arco(200, 234, 0, 86, PREDIO, CONT); arco(200, 234, 94, 180, PREDIO, CONT)
# Torres do Conselho nas pontas do crescente
circ(C[0] + 217, 600, 20, PREDIO, CONT); circ(C[0] - 217, 600, 20, PREDIO, CONT)
# Torre Lâmina no centro, de frente para a baía
retang(160, 600, 36, 50, 0, (60, 60, 70), (20, 20, 20))
# anel de moradia: segundo arco, fora do anel viário, com aberturas nos raios
for a0, a1 in ((12, 40), (50, 84), (96, 130), (140, 168)): arco(330, 362, a0, a1, PREDIO, CONT)
# raios diagonais (lição dos píeres de Daxing)
for ang in (45, 135):
    x1 = C[0] + 470 * math.cos(math.radians(ang)); z1 = C[1] - 470 * math.sin(math.radians(ang))
    d.line([P(C[0] + 306 * math.cos(math.radians(ang)), C[1] - 306 * math.sin(math.radians(ang))), P(x1, z1)], fill=(200, 190, 170), width=3)
# Universidade (NO) e Escola (NE) nos raios, voltadas para o centro
retang(C[0] - 480 * 0.7071, C[1] - 480 * 0.7071, 130, 80, 45, PREDIO)
retang(C[0] + 475 * 0.7071, C[1] - 475 * 0.7071, 100, 70, -45, PREDIO)
# Vida em anel de vidro (lição da Jewel Changi) na ponta oeste do eixo, com a cascata no centro
circ(-230, 600, 72, (190, 215, 225), CONT); circ(-230, 600, 20, VERDE, CONT); circ(-230, 600, 5, AGUA)
# Biblioteca na ponta leste do eixo
retang(540, 600, 70, 70, 0, PREDIO)
circ(540, 600, 16, (200, 190, 170), CONT)
# Física: anel do acelerador no raio SE; bosque de Supertrees no raio SO
circ(C[0] + 390 * 0.7071, C[1] + 390 * 0.7071, 55, None, CONT); circ(C[0] + 390 * 0.7071, C[1] + 390 * 0.7071, 45, VERDE, CONT)
retang(C[0] + 330 * 0.7071 - 10, C[1] + 330 * 0.7071 - 10, 60, 30, -45, PREDIO)
# jardim da Vida: as Supertrees em bosque junto do anel de vidro, como o Supertree Grove ao lado das cúpulas
d.polygon([P(*q) for q in ((-300, 660), (-160, 660), (-60, 760), (-90, 860), (-200, 880), (-300, 800))], fill=VERDE)
for (dx, dz) in ((-250, 700), (-205, 690), (-165, 720), (-230, 745), (-185, 770), (-140, 790), (-215, 815), (-165, 835), (-115, 830)):
    circ(dx, dz, 7, (70, 105, 80), CONT)
# praça de chegada no norte com bosques de estacionamento dos lados
retang(160, 225, 110, 70, 0, (214, 206, 188), None)
retang(20, 225, 150, 70, 0, MATA, None); retang(300, 225, 150, 70, 0, MATA, None)
# rótulos
texto(160, 470, 'Sede (crescente)'); texto(160, 720, 'Lago'); texto(160, 650, 'Torre'); texto(-230, 690, 'Vida (Jewel)')
texto(540, 650, 'Biblioteca'); texto(-170, 205, 'Universidade'); texto(495, 205, 'Escola'); texto(450, 800, 'Física')
texto(-190, 900, 'Jardim e Supertrees'); texto(160, 205, 'Portão norte'); texto(160, 250, '')
texto(20, 330, 'Moradia'); texto(300, 330, 'Moradia'); texto(-40, 598, 'Conselho', (255, 255, 255)); texto(360, 598, 'Conselho', (255, 255, 255))
# régua e título
x0, y0 = 20, PX + 20
d.line([(x0, y0), (x0 + 200 * k, y0)], fill=(0, 0, 0), width=3); d.text((x0 + 200 * k + 8, y0 - 9), '200 m', fill=(0, 0, 0), font=F)
d.text((12, 8), 'Proposta: sede da Holding (plano A revisto)', fill=(20, 20, 20), font=FT)
im.save('proposta.png'); print('ok')
