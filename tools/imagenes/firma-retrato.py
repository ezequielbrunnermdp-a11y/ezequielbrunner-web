# Uso: python3 tools/imagenes/firma-retrato.py
#
# Genera la firma discreta del retrato: un recorte cuadrado de cabeza y hombros, en blanco y negro,
# sobre el fondo del sitio (#101315), en 96 y 192 px (AVIF y WebP). Parte de assets/img/retrato-recorte.webp.
# Salida: assets/img/retrato-firma-96.(avif|webp) y assets/img/retrato-firma.(avif|webp) (192 px).
import os
from PIL import Image, ImageEnhance, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMG = os.path.join(ROOT, 'assets', 'img')
FONDO = (16, 19, 21, 255)  # --bg

src = Image.open(os.path.join(IMG, 'retrato-recorte.webp')).convert('RGBA')
base = Image.new('RGBA', src.size, FONDO)
base.alpha_composite(src)
w, h = base.size
cuadro = base.crop((0, 0, w, w)).convert('RGB')          # cabeza y hombros (la parte superior del retrato)
cuadro = ImageOps.grayscale(cuadro).convert('RGB')
cuadro = ImageEnhance.Brightness(cuadro).enhance(0.9)    # un poco más apagado: acompaña, no protagoniza

for size, name in ((96, 'retrato-firma-96'), (192, 'retrato-firma')):
    im = cuadro.resize((size, size), Image.LANCZOS)
    im.save(os.path.join(IMG, name + '.avif'), 'AVIF', quality=60, speed=6)
    im.save(os.path.join(IMG, name + '.webp'), 'WEBP', quality=80, method=6)
    print(name, size, 'px:', os.path.getsize(os.path.join(IMG, name + '.avif')), 'B avif,', os.path.getsize(os.path.join(IMG, name + '.webp')), 'B webp')
