# Desenha contornos do OSM em metros (projeção local), com a mesma escala para todos.
import json, math, sys
from PIL import Image, ImageDraw, ImageFont
def carregar(nome):
    return json.load(open(nome + '.json'))['elements']
def cor(tags):
    if tags.get('natural') == 'water': return (70, 120, 160), None
    if tags.get('aeroway') in ('runway',): return (90, 90, 95), None
    if tags.get('aeroway') in ('apron', 'taxiway'): return (150, 150, 150), None
    if tags.get('leisure') in ('park', 'garden') or tags.get('landuse') in ('grass', 'meadow', 'orchard', 'forest') or tags.get('natural') == 'wood':
        return (150, 185, 120), None
    if 'building' in tags: return (215, 205, 185), (60, 55, 50)
    return None, None
def ordem(tags):
    if 'building' in tags: return 3
    if tags.get('natural') == 'water': return 2
    if 'aeroway' in tags: return 1
    return 0
def desenhar(nome, lat0, lon0, meia, px, titulo, saida):
    els = carregar(nome)
    k = px / (2 * meia)
    im = Image.new('RGB', (px, px + 40), (238, 234, 226))
    d = ImageDraw.Draw(im)
    def xy(lat, lon):
        x = (lon - lon0) * 111320 * math.cos(math.radians(lat0))
        y = (lat - lat0) * 110540
        return (px / 2 + x * k, 40 + px / 2 - y * k)
    polis = []
    for e in els:
        tags = e.get('tags', {})
        if e['type'] == 'way' and 'geometry' in e:
            polis.append((ordem(tags), tags, [e['geometry']]))
        elif e['type'] == 'relation':
            aneis = [m['geometry'] for m in e.get('members', []) if m.get('geometry') and m.get('role') in ('outer', '')]
            furos = [m['geometry'] for m in e.get('members', []) if m.get('geometry') and m.get('role') == 'inner']
            if aneis: polis.append((ordem(tags), dict(tags, _furos=furos), aneis))
    for _, tags, aneis in sorted(polis, key=lambda p: p[0]):
        f, l = cor(tags)
        if f is None: continue
        if tags.get('_furos'):
            m = Image.new('L', im.size, 0); dm = ImageDraw.Draw(m)
            for g in aneis: dm.polygon([xy(p['lat'], p['lon']) for p in g], fill=255)
            for g in tags['_furos']: dm.polygon([xy(p['lat'], p['lon']) for p in g], fill=0)
            im.paste(Image.new('RGB', im.size, f), (0, 0), m)
            for g in aneis + tags['_furos']: d.line([xy(p['lat'], p['lon']) for p in g], fill=l or f, width=1)
            continue
        for g in aneis:
            pts = [xy(p['lat'], p['lon']) for p in g]
            if len(pts) < 2: continue
            if tags.get('aeroway') == 'runway' and pts[0] != pts[-1]:
                d.line(pts, fill=f, width=max(2, int(45 * k)))
            elif len(pts) >= 3:
                d.polygon(pts, fill=f, outline=l)
    # régua de 200 m
    x0, y0 = 20, px + 20
    d.line([(x0, y0), (x0 + 200 * k, y0)], fill=(0, 0, 0), width=3)
    try: fonte = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
    except Exception: fonte = ImageFont.load_default()
    d.text((x0 + 200 * k + 8, y0 - 10), '200 m', fill=(0, 0, 0), font=fonte)
    d.text((12, 10), titulo, fill=(20, 20, 20), font=fonte)
    im.save(saida)
    print('ok', saida)
if __name__ == '__main__':
    desenhar(*sys.argv[1:4] and [sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5]), sys.argv[6], sys.argv[7]])
