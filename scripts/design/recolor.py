"""One-off migration of the stylesheets onto the Hausbuch palette.

Each hard-coded colour keeps its lightness and moves to the hue family of its
role: neutrals and grey-greens to warm oat and espresso, lime accents to butter,
clay and reds to brick, positive greens to sage. Colours that carry meaning
(energy classes, share-network brands, error red) are left alone.
"""
import colorsys, re, sys

KEEP = {c.lower() for c in '''#3e9b4f #7bb342 #c0ca33 #fdd835 #fbc02d #f57c00 #d84315 #e9b949
#25a85a #2a9fd8 #1877f2 #0a66c2 #b42318 #fff #ffffff #000 #000000'''.split()}

def parse(hex_):
    h = hex_.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))

def fmt(rgb):
    return '#' + ''.join(f'{round(max(0, min(1, c)) * 255):02x}' for c in rgb)

def remap(rgb):
    h, l, s = colorsys.rgb_to_hls(*rgb)
    deg = h * 360
    if s >= 0.42 and 48 <= deg <= 110 and l >= 0.55:        # lime and pale yellow-green accents
        return colorsys.hls_to_rgb(43 / 360, l, 0.82)
    if s >= 0.2 and (deg <= 32 or deg >= 340):              # clay, brick, error-ish reds
        return colorsys.hls_to_rgb(13 / 360, l, max(s, 0.5))
    if s >= 0.28 and 80 <= deg <= 170 and l < 0.55:         # positive greens
        return colorsys.hls_to_rgb(105 / 360, l, 0.24)
    if 33 <= deg <= 60 and s >= 0.45:                        # golds stay gold, warmed slightly
        return colorsys.hls_to_rgb(40 / 360, l, s)
    # Neutrals and grey-greens: warm, low saturation, same lightness.
    sat = 0.14 if l < 0.3 else 0.10 if l < 0.7 else min(0.55, 0.25 + (1 - l) * 2)
    return colorsys.hls_to_rgb(30 / 360, l, sat)

INK_RGB = '43 36 32'
pattern = re.compile(r'#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])')

def run(path):
    text = open(path, encoding='utf8').read()
    out = pattern.sub(lambda m: m.group(0) if m.group(0).lower() in KEEP else fmt(remap(parse(m.group(0)))), text)
    out = re.sub(r'rgba?\(\s*(?:29 48 43|30 48 42|25 51 45|8 26 21|8 16 13)\b', lambda m: m.group(0).split('(')[0] + '(' + INK_RGB, out)
    if out != text:
        open(path, 'w', encoding='utf8').write(out)
        print('recoloured', path)

for path in sys.argv[1:]:
    run(path)
