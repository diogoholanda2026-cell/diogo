# Desenha linhas de costa (natural=coastline) como terra preenchida aproximada: traça as linhas grossas sobre o mar.
import json, math, sys
from PIL import Image, ImageDraw, ImageFont
nome, lat0, lon0, meia, px, titulo, saida = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), sys.argv[6], sys.argv[7]
els = json.load(open(nome + '.json'))['elements']
k = px / (2 * meia)
im = Image.new('RGB', (px, px + 40), (238, 234, 226)); d = ImageDraw.Draw(im)
d.rectangle([0, 40, px, px + 40], fill=(110, 150, 180))
def xy(lat, lon):
    return (px / 2 + (lon - lon0) * 111320 * math.cos(math.radians(lat0)) * k, 40 + px / 2 - (lat - lat0) * 110540 * k)
for e in els:
    g = e.get('geometry')
    if not g: continue
    pts = [xy(p['lat'], p['lon']) for p in g]
    if len(pts) > 2 and g[0]['lat'] == g[-1]['lat'] and g[0]['lon'] == g[-1]['lon']:
        d.polygon(pts, fill=(222, 208, 170), outline=(120, 100, 70))
    else:
        d.line(pts, fill=(120, 100, 70), width=2)
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
x0, y0 = 20, px + 20
bar = 1000 if meia > 1500 else 200
d.line([(x0, y0), (x0 + bar * k, y0)], fill=(0, 0, 0), width=3); d.text((x0 + bar * k + 8, y0 - 10), f'{bar} m', fill=(0, 0, 0), font=F)
d.text((12, 10), titulo, fill=(20, 20, 20), font=F)
im.save(saida); print('ok', saida, len(els))
