# Uso: pip install opencv-python-headless pillow && python3 tools/imagenes/recorte-retrato.py [--exportar]
# Recorte local del retrato real (GrabCut de OpenCV): solo se quita la pared del fondo.
# No se generan ni se modifican píxeles del rostro o la ropa; el borde se suaviza para integrarlo sobre negro.
# Sin --exportar deja retrato-recorte.png y dos vistas de control junto a este script (no se guardan en el repositorio).
# Con --exportar, además actualiza fuente/retrato-recorte.webp (con transparencia), que usa tools/imagenes/fotos.py
# para armar el retrato de «Sobre mí».
import cv2, numpy as np, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'fuente', 'retrato-original.jpeg')
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

# exportación: el recorte con transparencia queda en fuente/ y fotos.py arma las versiones para la web
if '--exportar' in sys.argv:
    from PIL import Image
    im = Image.open(OUT + '/retrato-recorte.png').convert('RGBA')
    dest = os.path.join(HERE, 'fuente', 'retrato-recorte.webp')
    im.save(dest, 'WEBP', quality=92, method=6)
    print(os.path.relpath(dest, ROOT), os.path.getsize(dest) // 1024, 'KB · ahora: python3 tools/imagenes/fotos.py')
