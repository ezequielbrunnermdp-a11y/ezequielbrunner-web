"""Imagen para compartir en redes (1200 × 630): assets/og/inicio.jpg.

Uso (desde la raíz del repositorio):
    python3 tools/sitegen/og.py
Arma og.html con las mismas fuentes y el mismo dibujo de la portada, lo fotografía con Chromium
sin ventana y lo guarda en JPEG. Necesita Chromium o Chrome (variable CHROME si no está en el PATH).
"""
import os
import shutil
import subprocess
import tempfile

from PIL import Image

import art
import content as C
from content import esc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
FONTS = 'file://' + os.path.join(ROOT, 'assets', 'fonts')


def og_html():
    t = C.HERO['title']
    labels = ''
    for key, name, _ in C.HERO['nodes']:
        x, y = art.label_pos(key)
        labels += f'<span class="nl" style="left:{x:.1f}%;top:{y:.1f}%">{esc(name)}</span>'
    return f"""<!doctype html><html lang="es"><meta charset="utf-8"><style>
@font-face {{ font-family: F; src: url({FONTS}/fraunces-roman.woff2) format('woff2'); font-weight: 300 500; }}
@font-face {{ font-family: F; font-style: italic; src: url({FONTS}/fraunces-italic-display.woff2) format('woff2'); font-weight: 300; }}
@font-face {{ font-family: M; src: url({FONTS}/geist-mono.woff2) format('woff2'); font-weight: 100 900; }}
html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #0a0a0b; color: #eeebe5; }}
body {{ position: relative; background: radial-gradient(52% 70% at 80% 50%, rgba(215,172,130,.09), transparent 70%), #0a0a0b; }}
.k {{ position: absolute; left: 80px; top: 74px; font: 500 15px/1 M; letter-spacing: .18em; text-transform: uppercase; color: #b4afa6; display: flex; align-items: center; gap: 16px; }}
.k::before {{ content: ""; width: 34px; height: 1px; background: #d7ac82; }}
h1 {{ position: absolute; left: 76px; top: 128px; margin: 0; font: 300 96px/.94 F; letter-spacing: -.036em; }}
h1 > span {{ display: block; }}
em {{ font-style: italic; letter-spacing: -.024em; }}
.dot {{ color: #d7ac82; }}
.u {{ position: absolute; left: 80px; bottom: 66px; font: 500 15px/1 M; letter-spacing: .16em; color: #8f8a82; }}
.art {{ position: absolute; right: 40px; top: 50%; width: 470px; height: 470px; transform: translateY(-50%); color: #eeebe5; }}
.art svg, .art .net-spin {{ position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }}
.net-dots {{ opacity: .16; }} .net-orbit {{ stroke: rgba(238,235,229,.1); }} .net-ticks {{ stroke: #eeebe5; opacity: .22; }}
.net-tri {{ stroke: #eeebe5; stroke-dasharray: 2 6; opacity: .22; }} .net-ring {{ stroke: #eeebe5; opacity: .34; }}
.net-c {{ stroke: #eeebe5; opacity: .5; }} .net-c-dot {{ fill: #d7ac82; stroke: none; }}
.nd-ring {{ stroke: #eeebe5; opacity: .55; fill: #0a0a0b; }} .nd-core {{ fill: #eeebe5; }} .nd-ping {{ display: none; }}
.sg, .sg-halo {{ stroke: #d7ac82; stroke-linecap: round; stroke-dasharray: 9 230; }}
.sg {{ stroke-width: 2; }} .sg-halo {{ stroke-width: 8; opacity: .16; }}
.sg-1 {{ stroke-dashoffset: -46; }} .sg-2, .sg-3 {{ stroke-dashoffset: 12; }}
.nl {{ position: absolute; transform: translate(-50%, -50%); font: 500 13px/1 M; letter-spacing: .18em; text-transform: uppercase; white-space: nowrap;
      text-shadow: 0 0 6px #0a0a0b, 0 0 12px #0a0a0b; }}
</style><body>
<p class="k">{esc(C.NAME)} · Consultor</p>
<h1><span>{esc(t[0])}</span><span>{esc(t[1])}</span><span><em>{esc(t[2][:-1])}</em><span class="dot">.</span></span></h1>
<p class="u">ezequielbrunner.com</p>
<div class="art">{art.hero_net()}{labels}</div>
</body></html>"""


def chrome():
    for c in (os.environ.get('CHROME'), shutil.which('chromium'), shutil.which('google-chrome'), shutil.which('chrome')):
        if c:
            return c
    import glob
    found = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux64/chrome'))
    if found:
        return found[-1]
    raise SystemExit('No encuentro Chromium: indicá la ruta con CHROME=/ruta/al/chrome')


if __name__ == '__main__':
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, 'og.html')
        png = os.path.join(tmp, 'og.png')
        open(page, 'w', encoding='utf8').write(og_html())
        subprocess.run([chrome(), '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                        '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=3000',
                        f'--screenshot={png}', 'file://' + page], check=True, capture_output=True)
        out = os.path.join(ROOT, 'assets', 'og', 'inicio.jpg')
        Image.open(png).convert('RGB').crop((0, 0, 1200, 630)).save(out, quality=88, optimize=True, progressive=True)
        print('assets/og/inicio.jpg', os.path.getsize(out) // 1024, 'KB')
