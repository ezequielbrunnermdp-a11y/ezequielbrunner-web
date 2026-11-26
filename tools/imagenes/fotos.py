"""Genera las imágenes del sitio a partir de las fotos propias.

- Retrato: el recorte del retrato profesional sobre el negro de la página, con una luz cálida muy suave
  detrás de la cabeza para separar el pelo del fondo.
- Galería: las dos fotos de eventos. Estaban oscurecidas para el diseño anterior; se les devuelve
  su rango tonal natural (niveles, una curva suave y un poco de color).

Uso (desde la raíz del repositorio):  python3 tools/imagenes/fotos.py
Fuentes, en tools/imagenes/fuente/ (no se publican): retrato-recorte.webp (recorte con transparencia,
697 × 1046) y las fotos de eventos equipo.webp y operacion.webp (1800 × 1200).
Escribe en assets/img/ los tamaños que usa la página, en AVIF y WebP.
"""
import os
import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'assets', 'img')
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fuente')
BG = (10, 10, 11)  # --bg en la hoja de estilos


def save(im, name, widths, q_avif=58, q_webp=80):
    for w in widths:
        out = im if w >= im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        out.save(os.path.join(IMG, f'{name}-{w}.avif'), quality=q_avif, speed=4)
        out.save(os.path.join(IMG, f'{name}-{w}.webp'), quality=q_webp, method=6)


def retrato():
    cut = Image.open(os.path.join(SRC, 'retrato-recorte.webp')).convert('RGBA')
    w, h = cut.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # luz cálida detrás de la cabeza (centro aproximado del rostro en el recorte)
    d = np.sqrt(((xx - w * 0.5) / (w * 0.62)) ** 2 + ((yy - h * 0.30) / (h * 0.42)) ** 2)
    glow = np.clip(1 - d, 0, 1) ** 2.2
    base = np.zeros((h, w, 3), np.float32) + np.array(BG, np.float32)
    base += glow[..., None] * np.array([26, 20, 15], np.float32)
    bg = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).convert('RGBA')
    bg.alpha_composite(cut)
    save(bg.convert('RGB'), 'retrato', (420, 697))


def evento(name, hi=228, sat=1.12):
    im = Image.open(os.path.join(SRC, f'{name}.webp')).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    L = a.mean(2)
    lo_v, hi_v = np.percentile(L, 0.4), np.percentile(L, 99.7)
    t = np.clip((a - lo_v) / max(1.0, hi_v - lo_v), 0, 1) ** 0.92
    out = Image.fromarray(np.clip(6 + t * (hi - 6), 0, 255).astype(np.uint8))
    out = ImageEnhance.Color(out).enhance(sat)
    save(out, name, (640, 1080, 1800))


if __name__ == '__main__':
    retrato()
    for n in ('equipo', 'operacion'):
        evento(n)
    print('listo')
