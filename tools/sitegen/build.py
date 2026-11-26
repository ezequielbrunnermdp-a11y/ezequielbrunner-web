"""Genera la web de una página: index.html, 404.html y sitemap.xml.

Uso (desde la raíz del repositorio):  python3 tools/sitegen/build.py
Textos: content.py y data/publicaciones.json. Estilos: site.css (se incrusta minificado en cada página).
Comportamiento: assets/js/site.js. Ilustraciones: art.py.
"""
import json
import os
import re
from datetime import date
from urllib.parse import quote

import art
import content as C
from content import esc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
V = '20261126'
TODAY = date(2026, 11, 26)

MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

# ---------------------------------------------------------------- íconos
WA_PATH = ('M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z')


def ico(name, cls=''):
    paths = {
        'arrow': '<path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>',
        'ne': '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
        'up': '<path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/>',
        'down': '<path d="M12 4v15M6.5 13.5 12 19l5.5-5.5"/>',
        'close': '<path d="m6 6 12 12M18 6 6 18"/>',
        'plus': '<path d="M12 5v14M5 12h14"/>',
        'prev': '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
        'next': '<path d="M9 5.5 15.5 12 9 18.5"/>',
        'copy': '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 5.5v-.5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5"/>',
        'mail': '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
    }
    if name == 'wa':
        return (f'<svg class="ico ico-wa {cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
                f'<path fill="currentColor" d="{WA_PATH}"/></svg>')
    if name == 'in':
        return (f'<svg class="ico {cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" '
                'd="M5.2 8.6h3.2V19H5.2zM6.8 3.8a1.86 1.86 0 1 1 0 3.72 1.86 1.86 0 0 1 0-3.72M10.4 8.6h3.07v1.42h.04c.43-.81 '
                '1.47-1.66 3.03-1.66 3.24 0 3.84 2.13 3.84 4.9V19h-3.2v-5.06c0-1.2-.02-2.76-1.68-2.76-1.69 0-1.94 1.32-1.94 '
                '2.67V19h-3.16z"/></svg>')
    if name == 'ig':
        return (f'<svg class="ico {cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" '
                'stroke-width="1.5"><rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4.5"/><circle cx="12" cy="12" r="3.9"/>'
                '<circle cx="17.1" cy="6.9" r=".6" fill="currentColor" stroke="none"/></svg>')
    return (f'<svg class="ico {cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" '
            f'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">{paths[name]}</svg>')


def wa(msg=C.WA_MSG):
    return C.WA_URL + '?text=' + quote(msg)


EXT = 'target="_blank" rel="noopener noreferrer"'

# ---------------------------------------------------------------- fechas y publicaciones


def fmt_date(d):
    """'2026-07-03' → ('3 jul 2026', '2026-07-03'); '2024-00-00' → ('2024', '2024'); '' → ('', '')."""
    if not d:
        return '', ''
    y, m, dd = (d.split('-') + ['00', '00'])[:3]
    if m == '00':
        return y, y
    if dd == '00':
        return f'{MONTHS[int(m) - 1]} {y}', f'{y}-{m}'
    return f'{int(dd)} {MONTHS[int(m) - 1]} {y}', f'{y}-{m}-{dd}'


KIND = {
    'Artículo de autor': 'Artículo de autor',
    'Carta al director': 'Carta al director',
    'Carta de autor': 'Carta de autor',
    'En los medios': 'Nota',
    'Gastronomía': 'Nota',
    'Doctrina': 'Doctrina',
    'Investigación': 'Investigación',
    'Congreso académico': 'Ponencia premiada',
}
OUTLET = {'Investigación': 'SSRN', 'Congreso académico': 'Universidad Kennedy', 'MDPok': 'MDP OK'}


def press_items():
    P = json.load(open(os.path.join(HERE, 'data', 'publicaciones.json'), encoding='utf8'))
    out, seen = [], set()
    for it in P['medios'] + P['gastro'] + P['doctrina']:
        href = it['href']
        # La publicación genérica de Instagram no dice qué muestra: queda en el respaldo.
        if href in seen or it.get('outlet') == 'Instagram':
            continue
        seen.add(href)
        outlet = OUTLET.get(it.get('outlet'), it.get('outlet'))
        kind = KIND.get(it.get('kind'), it.get('kind', ''))
        out.append({'href': href, 'outlet': outlet, 'kind': kind, 'title': it['title'], 'date': it.get('date', '')})
    d = P['dossier']
    out.append({'href': d['href'], 'outlet': 'Biblioteca del Congreso', 'kind': 'Doctrina citada',
                'title': f'{d["h2"]}: «{d["title"]}»', 'date': '2026-04-00'})
    return out


def sort_key(it):
    d = it['date'] or '0000-00-00'
    return d.replace('-00', '-99') if d != '0000-00-00' else d


# ---------------------------------------------------------------- head


def minify_css(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    # sin «+»: dentro de calc() los signos necesitan sus espacios
    css = re.sub(r'\s*([{};,>~])\s*', r'\1', css)
    css = re.sub(r':\s+', ':', css)
    css = css.replace(';}', '}')
    # «and (» y «) and» necesitan los espacios en las consultas de medios
    css = re.sub(r'\band\(', 'and (', css)
    return css.strip()


CSS = minify_css(open(os.path.join(HERE, 'site.css'), encoding='utf8').read())

BOOT = ("<script>(function(d){var h=d.documentElement;h.classList.remove('no-js');h.classList.add('js');"
        "try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('rm')}catch(e){}})(document)</script>")

FONT_PRELOAD = ''.join(f'<link rel="preload" href="/assets/fonts/{f}.woff2" as="font" type="font/woff2" crossorigin>'
                       for f in ('fraunces-roman', 'fraunces-italic-display', 'geist'))


def structured_data():
    same = [C.LINKEDIN, C.ABOUTME] + ([C.INSTAGRAM] if C.INSTAGRAM else [])
    person = {
        '@type': 'Person', '@id': C.SITE + '/#ezequiel', 'name': C.NAME, 'url': C.SITE + '/',
        'image': C.SITE + '/assets/img/retrato-697.webp', 'email': 'mailto:' + C.EMAIL, 'telephone': C.TEL_LD,
        'jobTitle': C.SEO['job'],
        'address': {'@type': 'PostalAddress', 'addressLocality': 'Mar del Plata', 'addressRegion': 'Buenos Aires',
                    'addressCountry': 'AR'},
        'sameAs': same,
        'knowsAbout': ['Gestión gastronómica', 'Costos y rentabilidad', 'Organización de equipos', 'Procesos operativos',
                       'Apertura de locales', 'Automatización de procesos', 'Inteligencia artificial',
                       'Desarrollo de aplicaciones web'],
    }
    service = {
        '@type': 'ProfessionalService', '@id': C.SITE + '/#servicios', 'name': 'Ezequiel Brunner · Gastronomía, negocios y tecnología',
        'url': C.SITE + '/', 'image': C.SITE + '/assets/og/inicio.jpg', 'founder': {'@id': C.SITE + '/#ezequiel'},
        'email': C.EMAIL, 'telephone': C.TEL_LD,
        'address': {'@type': 'PostalAddress', 'addressLocality': 'Mar del Plata', 'addressRegion': 'Buenos Aires',
                    'addressCountry': 'AR'},
        'areaServed': [{'@type': 'City', 'name': 'Mar del Plata'}, {'@type': 'Country', 'name': 'Argentina'}],
        'description': C.HERO['sub'],
        'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Servicios', 'itemListElement': [
            {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': s['title'], 'description': s['desc']}}
            for s in C.SERVICES]},
    }
    site = {'@type': 'WebSite', '@id': C.SITE + '/#sitio', 'url': C.SITE + '/', 'name': C.NAME, 'inLanguage': 'es-AR',
            'publisher': {'@id': C.SITE + '/#ezequiel'}}
    page = {'@type': 'WebPage', '@id': C.SITE + '/#pagina', 'url': C.SITE + '/', 'name': C.SEO['title'],
            'description': C.SEO['desc'], 'inLanguage': 'es-AR', 'isPartOf': {'@id': C.SITE + '/#sitio'},
            'about': {'@id': C.SITE + '/#ezequiel'}, 'primaryImageOfPage': C.SITE + '/assets/og/inicio.jpg'}
    return {'@context': 'https://schema.org', '@graph': [person, service, site, page]}


def head(title, desc, path='/', index=True, ld=None):
    canonical = C.SITE + path
    og = C.SITE + '/assets/og/inicio.jpg?v=' + V
    meta_robots = '' if index else '<meta name="robots" content="noindex">'
    ld_tag = (f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>'
              if ld else '')
    return f"""<!doctype html>
<html lang="es-AR" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{meta_robots}<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#0a0a0b">
<meta name="color-scheme" content="dark">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:site_name" content="{esc(C.NAME)}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(C.SEO['og_alt'])}">
<meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{og}">
{BOOT}
{FONT_PRELOAD}
<style>{CSS}</style>
<script src="/assets/js/site.js?v={V}" defer></script>
{ld_tag}
</head>"""


# ---------------------------------------------------------------- partes de la página


def header(home=True):
    base = '' if home else '/'
    links = ''.join(f'<a href="{base}#{k}" data-nav="{k}">{esc(t)}</a>' for k, t, _ in C.NAV)
    return f"""<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="hdr" data-hdr>
<div class="wrap hdr-in">
<a class="brand" href="{base}#inicio">Ezequiel Brunner<span class="dot" aria-hidden="true">.</span></a>
<nav class="nav" aria-label="Principal">{links}</nav>
<a class="menu-btn" href="#menu" role="button" aria-expanded="false" aria-controls="menu" data-menu-open><span class="menu-btn-t">Menú</span><span class="menu-btn-i" aria-hidden="true"><i></i><i></i></span></a>
</div>
</header>"""


def menu(home=True):
    base = '' if home else '/'
    links = ''.join(f'<li><a href="{base}#{k}" data-nav="{k}"><span class="mn-i">0{i}</span><span class="mn-t">{esc(t)}</span></a></li>'
                    for i, (k, t, _) in enumerate(C.NAV, 1))
    return f"""<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menú" data-menu>
<div class="menu-in wrap">
<div class="menu-top"><span class="brand" aria-hidden="true">Ezequiel Brunner<span class="dot">.</span></span>
<a class="menu-close" href="#" role="button" data-menu-close>Cerrar{ico('close')}</a></div>
<nav aria-label="Secciones"><ol class="menu-nav">{links}</ol></nav>
<div class="menu-foot">
<a class="btn btn-solid btn-wa" href="{esc(wa())}" {EXT}>{ico('wa')}<span>WhatsApp</span></a>
<a class="menu-mail" href="mailto:{C.EMAIL}">{esc(C.EMAIL)}</a>
</div>
</div>
</div>"""


def hero():
    H = C.HERO
    t = H['title']
    title = (f'<span class="ln">{esc(t[0])}</span> <span class="ln">{esc(t[1])}</span> '
             f'<span class="ln"><em>{esc(t[2][:-1])}</em><span class="dot">.</span></span>')
    labels = ''
    for key, name, sub in H['nodes']:
        x, y = art.label_pos(key)
        labels += (f'<span class="nl nl-{key}" style="--x:{x:.1f}%;--y:{y:.1f}%">'
                   f'<span class="nl-t">{esc(name)}</span><span class="nl-s">{esc(sub)}</span></span>')
    return f"""<section class="hero" id="inicio" aria-labelledby="hero-t" data-sec>
<div class="wrap hero-in">
<div class="hero-copy">
<p class="eyebrow">{esc(H['eyebrow'])}</p>
<h1 class="hero-t" id="hero-t">{title}</h1>
<p class="hero-sub">{esc(H['sub'])}</p>
<div class="hero-cta">
<a class="btn btn-ghost" href="#servicios">{esc(H['cta_services'])}{ico('down', 'ar')}</a>
<a class="btn btn-solid" href="#contacto">{esc(H['cta_contact'])}{ico('arrow', 'ar')}</a>
</div>
</div>
<div class="hero-art" aria-hidden="true" data-art>
{art.hero_net()}
{labels}
</div>
</div>
<div class="wrap hero-foot" aria-hidden="true"><span>{esc(C.PLACE)}</span><span class="hero-scroll">Servicios{ico('down')}</span></div>
</section>"""


def sec_head(sid, title, note=''):
    note_html = f'<p class="sec-note">{esc(note)}</p>' if note else ''
    return f'<div class="sec-head" data-rv><h2 class="sec-t" id="{sid}-t">{esc(title)}</h2>{note_html}</div>'


def services():
    items = ''
    for s in C.SERVICES:
        msg = C.WA_MSG_SERVICE.format(s['title'].lower() if s['key'] != 'ia' else 'inteligencia artificial y automatizaciones')
        items += f"""<li class="svc" data-rv>
<span class="svc-n" aria-hidden="true">{s['n']}</span>
<h3 class="svc-t">{esc(s['title'])}</h3>
<p class="svc-d">{esc(s['desc'])}</p>
<a class="svc-cta" href="{esc(wa(msg))}" {EXT}>{esc(C.SERVICE_CTA)}<span class="sr"> por {esc(s['title'].lower())} en WhatsApp</span>{ico('arrow', 'ar')}</a>
</li>"""
    return f"""<section class="sec svc-sec" id="servicios" aria-labelledby="servicios-t" data-sec>
<div class="wrap">
{sec_head('servicios', 'Servicios')}
<ol class="svc-list">{items}</ol>
</div>
</section>"""


def about():
    A = C.ABOUT
    facts = ''.join(f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k, v in A['facts'])
    return f"""<section class="sec about" id="sobre-mi" aria-labelledby="sobre-mi-t" data-sec>
<div class="wrap about-in">
<figure class="about-ph" data-rv>
<picture>
<source type="image/avif" srcset="/assets/img/retrato-420.avif 420w, /assets/img/retrato-697.avif 697w" sizes="(min-width: 900px) 38vw, 82vw">
<img src="/assets/img/retrato-697.webp" srcset="/assets/img/retrato-420.webp 420w, /assets/img/retrato-697.webp 697w" sizes="(min-width: 900px) 38vw, 82vw" width="697" height="1046" alt="{esc(A['photo_alt'])}" loading="lazy" decoding="async">
</picture>
</figure>
<div class="about-tx" data-rv>
<h2 class="kicker" id="sobre-mi-t">{esc(A['h2'])}</h2>
<p class="about-st">{esc(A['text'])}</p>
<dl class="about-dl">{facts}</dl>
<a class="link" href="{C.LINKEDIN}" {EXT}>{esc(A['linkedin'])}{ico('ne', 'ar')}</a>
</div>
</div>
</section>"""


def projects():
    cards = ''
    for i, p in enumerate(C.PROJECTS, 1):
        cards += f"""<li class="prj" data-rv style="--i:{(i - 1) % 3}">
<div class="prj-cv" data-cv>{art.COVERS[p['cover']]()}</div>
<p class="prj-meta">{esc(p['meta'])}</p>
<h3 class="prj-t">{esc(p['title'])}</h3>
<p class="prj-d">{esc(p['desc'])}</p>
</li>"""
    H = C.PROJECTS_HEAD
    return f"""<section class="sec prj-sec" id="proyectos" aria-labelledby="proyectos-t" data-sec>
<div class="wrap">
{sec_head('proyectos', H['h2'])}
{art.cover_defs()}
<ul class="prj-grid" data-carousel aria-label="{esc(H['h2'])}">{cards}</ul>
<div class="prj-bar" aria-hidden="true"><i data-carousel-bar></i></div>
<p class="prj-note">{esc(H['note'])}</p>
</div>
</section>"""


def press():
    P = C.PRESS
    items = press_items()
    by_href = {it['href']: it for it in items}
    feat = [by_href[h] for h in P['featured']]
    rest = sorted((it for it in items if it['href'] not in P['featured']), key=sort_key, reverse=True)
    cards = ''
    for it in feat:
        txt, iso = fmt_date(it['date'])
        cards += f"""<li><a class="pf" href="{esc(it['href'])}" {EXT} data-rv>
<span class="pf-mast">{esc(it['outlet'])}</span>
<span class="pf-meta">{esc(it['kind'])} · <time datetime="{iso}">{esc(txt)}</time></span>
<span class="pf-t">{esc(it['title'])}</span>
<span class="pf-go">Leer en el medio{ico('ne', 'ar')}<span class="sr"> (se abre en otra pestaña)</span></span>
</a></li>"""
    rows = ''
    for it in rest:
        txt, iso = fmt_date(it['date'])
        when = f'<time datetime="{iso}">{esc(txt)}</time>' if iso else f'<span class="pl-nd">{esc(P["undated"])}</span>'
        rows += f"""<li><a class="pl" href="{esc(it['href'])}" {EXT}>
<span class="pl-d">{when}</span>
<span class="pl-o">{esc(it['outlet'])}<span class="pl-k"> · {esc(it['kind'])}</span></span>
<span class="pl-t">{esc(it['title'])}</span>{ico('ne', 'pl-a')}<span class="sr"> (se abre en otra pestaña)</span>
</a></li>"""
    return f"""<section class="sec press" id="medios" aria-labelledby="medios-t" data-sec>
<div class="wrap">
<div class="sec-head" data-rv><div><p class="kicker">{esc(P['label'])}</p><h2 class="sec-t" id="medios-t">{esc(P['h2'])}</h2></div></div>
<ul class="pf-grid">{cards}</ul>
<details class="press-more">
<summary><span class="pm-more">{esc(P['more'])} <span class="pm-n">({len(rest)})</span></span><span class="pm-less">{esc(P['less'])}</span>{ico('plus', 'pm-i')}</summary>
<ul class="pl-list">{rows}</ul>
</details>
</div>
</section>"""


def gallery():
    G = C.GALLERY
    figs = ''
    for i, g in enumerate(G['items']):
        s = g['src']
        figs += f"""<figure class="gal-f" data-rv>
<a class="gal-a" href="/assets/img/{s}-1800.webp" data-lb="{i}" aria-label="Ampliar: {esc(g['caption'])}">
<picture>
<source type="image/avif" srcset="/assets/img/{s}-640.avif 640w, /assets/img/{s}-1080.avif 1080w, /assets/img/{s}-1800.avif 1800w" sizes="(min-width: 900px) {'56vw' if i == 0 else '40vw'}, 100vw">
<img src="/assets/img/{s}-1080.webp" srcset="/assets/img/{s}-640.webp 640w, /assets/img/{s}-1080.webp 1080w, /assets/img/{s}-1800.webp 1800w" sizes="(min-width: 900px) {'56vw' if i == 0 else '40vw'}, 100vw" width="{g['w']}" height="{g['h']}" alt="{esc(g['alt'])}" loading="lazy" decoding="async">
</picture>
</a>
<figcaption><span class="gal-m">{esc(g['meta'])}</span><span class="gal-c">{esc(g['caption'])}</span></figcaption>
</figure>"""
    return f"""<section class="sec gal-sec" id="galeria" aria-labelledby="galeria-t" data-sec>
<div class="wrap">
<h2 class="kicker gal-h" id="galeria-t" data-rv>{esc(G['h2'])}</h2>
<div class="gal">{figs}</div>
</div>
</section>"""


def lightbox():
    return f"""<dialog class="lb" aria-label="Galería" data-lb-dialog>
<div class="lb-in">
<figure class="lb-f"><img alt="" data-lb-img><figcaption data-lb-cap></figcaption></figure>
<button class="lb-b lb-prev" type="button" data-lb-prev aria-label="Foto anterior">{ico('prev')}</button>
<button class="lb-b lb-next" type="button" data-lb-next aria-label="Foto siguiente">{ico('next')}</button>
<button class="lb-b lb-x" type="button" data-lb-close aria-label="Cerrar">{ico('close')}</button>
<p class="lb-n" aria-live="polite" data-lb-n></p>
</div>
</dialog>"""


def contact():
    K = C.CONTACT
    rows = (f'<li><a class="ch" href="mailto:{C.EMAIL}"><span class="ch-k">{esc(K["email"])}</span>'
            f'<span class="ch-v">{esc(C.EMAIL)}</span>{ico("arrow", "ch-a")}</a>'
            f'<button class="ch-copy" type="button" data-copy="{C.EMAIL}" aria-label="Copiar el email">{ico("copy")}'
            f'<span class="ch-copied" aria-hidden="true">Copiado</span></button></li>')
    rows += (f'<li><a class="ch" href="{C.LINKEDIN}" {EXT}><span class="ch-k">{esc(K["linkedin"])}</span>'
             f'<span class="ch-v">{esc(K["linkedin_display"])}</span>{ico("ne", "ch-a")}</a></li>')
    if C.INSTAGRAM:
        rows += (f'<li><a class="ch" href="{C.INSTAGRAM}" {EXT}><span class="ch-k">{esc(K["instagram"])}</span>'
                 f'<span class="ch-v">{esc(C.INSTAGRAM_HANDLE or "")}</span>{ico("ne", "ch-a")}</a></li>')
    return f"""<section class="sec ct" id="contacto" aria-labelledby="contacto-t" data-sec>
<div class="wrap">
<h2 class="ct-t" id="contacto-t" data-rv>{esc(K['h2'])}</h2>
<div class="ct-grid">
<div class="ct-main" data-rv>
<p class="ct-p">{esc(K['text'])}</p>
<a class="btn btn-solid btn-wa btn-xl" href="{esc(wa())}" {EXT}>{ico('wa')}<span class="btn-tx"><span>{esc(K['wa'])}</span><span class="btn-sub">{esc(C.WA_DISPLAY)}</span></span></a>
</div>
<ul class="ch-list" data-rv aria-label="Otros canales">{rows}</ul>
</div>
<p class="sr" role="status" data-copy-status></p>
</div>
</section>"""


def footer(home=True):
    base = '' if home else '/'
    return f"""<footer class="ftr">
<div class="wrap ftr-in">
<p>{esc(C.FOOTER['rights'])}<span class="ftr-sep" aria-hidden="true"> · </span><span class="ftr-pl">{esc(C.PLACE)}</span></p>
<a class="ftr-top" href="{base}#inicio">{esc(C.FOOTER['top'])}{ico('up')}</a>
</div>
</footer>"""


def wa_float():
    return (f'<a class="wa-float" href="{esc(wa())}" {EXT} aria-label="Escribime por WhatsApp" data-wa-float>'
            f'{ico("wa")}</a>')


# ---------------------------------------------------------------- páginas


def page_index():
    body = '\n'.join([
        header(), menu(),
        '<main id="contenido">', hero(), services(), about(), projects(), press(), gallery(), contact(), '</main>',
        footer(), wa_float(), lightbox(),
    ])
    html = (head(C.SEO['title'], C.SEO['desc'], '/', True, structured_data())
            + f'\n<body>\n{body}\n</body>\n</html>\n')
    # La portada usa rutas relativas (assets/...): así también se ve desde una vista previa en una subcarpeta.
    # La 404 conserva las absolutas porque se sirve en cualquier dirección.
    return re.sub(r'(?<=["( ,])/assets/', 'assets/', html)


def page_404():
    N = C.NOT_FOUND
    body = f"""{header(False)}
{menu(False)}
<main id="contenido" class="nf">
<div class="wrap nf-in">
<p class="kicker">Error 404</p>
<h1 class="nf-t">{esc(N['h1'])}</h1>
<p class="nf-p">{esc(N['p'])}</p>
<a class="btn btn-solid" href="/">{esc(N['back'])}{ico('arrow', 'ar')}</a>
</div>
</main>
{footer(False)}"""
    return head(N['title'], N['p'], '/404', False) + f'\n<body class="is-404">\n{body}\n</body>\n</html>\n'


def sitemap():
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f'  <url><loc>{C.SITE}/</loc><lastmod>{TODAY.isoformat()}</lastmod></url>\n'
            '</urlset>\n')


def write(name, text):
    with open(os.path.join(ROOT, name), 'w', encoding='utf8') as f:
        f.write(text)
    print(f'{name}: {len(text.encode("utf8")):,} bytes')


if __name__ == '__main__':
    write('index.html', page_index())
    write('404.html', page_404())
    write('sitemap.xml', sitemap())
