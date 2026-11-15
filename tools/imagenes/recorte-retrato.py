# Uso: pip install opencv-python-headless pillow && python3 tools/imagenes/recorte-retrato.py [--exportar]
# Recorte local del retrato real (GrabCut de OpenCV): solo se quita la pared del fondo.
# No se generan ni se modifican píxeles del rostro o la ropa; el borde se suaviza para integrarlo sobre negro.
# Sin --exportar deja retrato-recorte.png y dos vistas de control junto a este script (no se guardan en el repositorio).
# Con --exportar, además escribe assets/img/retrato-recorte(.avif|.webp) y retrato-recorte-480(.avif|.webp), con transparencia,
# y actualiza en assets/css/home.css la silueta vectorial (--sil) que usan como máscara las luces de borde y el tono.
import cv2, numpy as np, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'profile.jpeg')
OUT = HERE
img = cv2.imread(SRC)
h, w = img.shape[:2]
print('original', w, h)

mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
# zona probable de la persona: cabeza, cuello y torso
cv2.ellipse(mask, (w // 2, int(h * 0.30)), (int(w * 0.24), int(h * 0.25)), 0, 0, 360, cv2.GC_PR_FGD, -1)
cv2.rectangle(mask, (int(w * 0.02), int(h * 0.52)), (int(w * 0.98), h - 1), cv2.GC_PR_FGD, -1)
# seguro persona: centro de la cara y el pecho
cv2.ellipse(mask, (w // 2, int(h * 0.31)), (int(w * 0.13), int(h * 0.16)), 0, 0, 360, cv2.GC_FGD, -1)
cv2.rectangle(mask, (int(w * 0.30), int(h * 0.62)), (int(w * 0.70), h - 1), cv2.GC_FGD, -1)
# seguro fondo: franja superior y laterales altos
mask[: int(h * 0.05), :] = cv2.GC_BGD
mask[: int(h * 0.48), : int(w * 0.16)] = cv2.GC_BGD
mask[: int(h * 0.48), int(w * 0.84):] = cv2.GC_BGD
# mueble al costado del hombro derecho: fondo por encima de la línea real del hombro (medida en la foto),
# persona por debajo de esa línea
cv2.fillPoly(mask, [np.array([(585, 520), (w - 1, 520), (w - 1, 634), (650, 617), (600, 600), (585, 594)], np.int32)], int(cv2.GC_BGD))
cv2.fillPoly(mask, [np.array([(585, 600), (650, 625), (w - 1, 645), (w - 1, 720), (585, 720)], np.int32)], int(cv2.GC_FGD))

bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(img, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

# limpieza: la figura más grande, sin agujeros, borde parejo
n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
m = np.where(lab == big, 255, 0).astype(np.uint8)
inv = cv2.bitwise_not(m)
n2, lab2, stats2, _ = cv2.connectedComponentsWithStats(inv, 4)
for i in range(1, n2):
    x, y, ww, hh, area = stats2[i]
    if x > 0 and y > 0 and x + ww < w and y + hh < h:   # agujero interior
        m[lab2 == i] = 255
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
# alfa con borde suave: se retrae un píxel (evita el halo claro de la pared) y se difumina
m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
alpha = cv2.GaussianBlur(m, (0, 0), 1.4)

# bordes: los píxeles semitransparentes se oscurecen apenas (quitan el gris de la pared) sin tocar el interior
a = alpha.astype(np.float32) / 255.0
edge = (a > 0.02) & (a < 0.98)
rgb = img.astype(np.float32)
rgb[edge] *= (0.55 + 0.45 * a[edge])[:, None]
rgba = np.dstack([rgb.clip(0, 255).astype(np.uint8), alpha])
cv2.imwrite(OUT + '/retrato-recorte.png', rgba)

# vista de control sobre negro y sobre un fondo de luz cobre / turquesa
def comp(bg):
    a3 = a[..., None]
    return (rgb * a3 + bg * (1 - a3)).clip(0, 255).astype(np.uint8)
black = np.zeros_like(rgb)
grad = np.zeros_like(rgb)
xs = np.linspace(0, 1, w)[None, :, None]
grad[:] = (np.array([106, 149, 201]) * (1 - xs) * 0.45 + np.array([170, 176, 130]) * xs * 0.45)  # BGR: cobre a turquesa
cv2.imwrite(OUT + '/control-negro.jpg', comp(black), [cv2.IMWRITE_JPEG_QUALITY, 90])
cv2.imwrite(OUT + '/control-luz.jpg', comp(grad), [cv2.IMWRITE_JPEG_QUALITY, 90])
ys, xs2 = np.where(alpha > 128)
print('figura: x', xs2.min(), '-', xs2.max(), ' y', ys.min(), '-', ys.max())
# ancho de la cabeza a la altura de los ojos (para ubicar el nombre a los costados)
for frac in (0.25, 0.30, 0.35, 0.45, 0.55):
    row = alpha[int(h * frac)] > 128
    xx = np.where(row)[0]
    print(f'fila {frac:.2f}: x {xx.min()}–{xx.max()} ancho {xx.max() - xx.min()}')

# exportación para la web: AVIF y WebP con canal alfa, en el ancho original y en 480 px (celulares)
if '--exportar' in sys.argv:
    from PIL import Image
    im = Image.open(OUT + '/retrato-recorte.png').convert('RGBA')
    for ww in (im.width, 480):
        x = im if ww == im.width else im.resize((ww, round(im.height * ww / im.width)), Image.LANCZOS)
        base = os.path.join(ROOT, 'assets', 'img', 'retrato-recorte' + ('' if ww == im.width else '-480'))
        x.save(base + '.webp', 'WEBP', quality=86, method=6)
        x.save(base + '.avif', 'AVIF', quality=62, speed=4)
        print(os.path.relpath(base, ROOT), 'webp', os.path.getsize(base + '.webp') // 1024, 'KB · avif', os.path.getsize(base + '.avif') // 1024, 'KB')
    # silueta como trazado SVG (error menor al 0,05 % de los píxeles): va en línea en home.css, sin otra descarga
    import re
    _, mm = cv2.threshold(alpha, 127, 255, cv2.THRESH_BINARY)
    cs, _ = cv2.findContours(mm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    ap = cv2.approxPolyDP(max(cs, key=cv2.contourArea), 0.8, True).reshape(-1, 2)
    d = 'M' + ' '.join(f'{x} {y}' for x, y in ap) + 'Z'
    sil = f"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}'><path d='{d}'/></svg>\")"
    css_path = os.path.join(ROOT, 'assets', 'css', 'home.css')
    css = open(css_path, encoding='utf8').read()
    css, n = re.subn(r'^(\s*--sil: ).*;$', lambda mo: mo.group(1) + sil + ';', css, count=1, flags=re.M)
    open(css_path, 'w', encoding='utf8').write(css)
    print('silueta:', len(ap), 'puntos ·', 'home.css actualizado' if n else 'no se encontró --sil en home.css')
