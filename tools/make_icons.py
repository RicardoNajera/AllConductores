from PIL import Image, ImageDraw

GREEN = (22, 224, 163, 255)
DARK = (11, 15, 20, 255)
S = 4


def draw_icon(size, rounded=True, scale=1.0):
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.226), fill=DARK)
    else:
        d.rectangle([0, 0, n - 1, n - 1], fill=DARK)

    cx, cy = n * 0.5, n * 0.5

    def sc(v):
        return (v - 0.5) * scale + 0.5

    # halo ring
    r = n * 0.10 * scale
    d.ellipse([n * sc(0.5) - n * 0.44 * scale, n * sc(0.5) - n * 0.44 * scale,
               n * sc(0.5) + n * 0.44 * scale, n * sc(0.5) + n * 0.44 * scale],
              outline=(22, 224, 163, 55), width=max(2, int(n * 0.012)))

    # pin
    px, py, pr = n * sc(0.5), n * sc(0.365), n * 0.155 * scale
    d.ellipse([px - pr * 1.38, py - pr * 1.38, px + pr * 1.38, py + pr * 1.38],
              outline=(22, 224, 163, 110), width=max(2, int(n * 0.022)))
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=GREEN)
    d.ellipse([px - pr * 0.36, py - pr * 0.36, px + pr * 0.36, py + pr * 0.36], fill=DARK)

    # moto body bar
    base = n * sc(0.655)
    d.rounded_rectangle([n * sc(0.255), base - n * 0.055 * scale,
                         n * sc(0.745), base + n * 0.055 * scale],
                        radius=int(n * 0.028 * scale), fill=GREEN)

    # wheels
    wr = n * 0.072 * scale
    wy = base + n * 0.028 * scale
    for wxr in (0.365, 0.635):
        wx = n * sc(wxr)
        d.ellipse([wx - wr, wy - wr, wx + wr, wy + wr], fill=GREEN)
        d.ellipse([wx - wr * 0.42, wy - wr * 0.42, wx + wr * 0.42, wy + wr * 0.42], fill=DARK)

    # handlebar accents
    d.rounded_rectangle([n * sc(0.245), base - n * 0.105 * scale,
                         n * sc(0.385), base - n * 0.048 * scale],
                        radius=int(n * 0.018 * scale), fill=GREEN)
    d.rounded_rectangle([n * sc(0.615), base - n * 0.105 * scale,
                         n * sc(0.755), base - n * 0.048 * scale],
                        radius=int(n * 0.018 * scale), fill=GREEN)

    return img.resize((size, size), Image.LANCZOS)


out = '/Users/annymena/Desktop/All ConductorCancun/icons/'
draw_icon(512).save(out + 'icon-512.png')
draw_icon(192).save(out + 'icon-192.png')
draw_icon(512, rounded=False, scale=0.80).save(out + 'icon-maskable-512.png')
print('icons ok')
