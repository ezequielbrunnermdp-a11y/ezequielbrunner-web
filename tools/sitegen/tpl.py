"""Componentes comunes: <head>, encabezado, menú, barra inferior, pie, formularios y filas de publicaciones."""
import json
from urllib.parse import quote
from content import esc, SITE, EMAIL, LINKEDIN, ABOUTME, GAS, IA, WA_URL, WA_DISPLAY

V = '20261117'

ARR = '<span class="arr" aria-hidden="true">→</span>'
EXT = '<span class="arr ext" aria-hidden="true">↗</span>'

WA_ICON = ('<svg class="ico ico-wa" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>')


def wa_link(context=''):
    """Enlace a WhatsApp con un saludo listo según el área."""
    msg = 'Hola Ezequiel, te escribo desde tu web' + (f' ({context})' if context else '') + '.'
    return WA_URL + '?text=' + quote(msg)


def wa_float(context=''):
    return (f'<a class="wa-float" href="{wa_link(context)}" target="_blank" rel="noopener noreferrer" aria-label="Escribime por WhatsApp">'
            f'{WA_ICON}<span class="wa-tip" aria-hidden="true">WhatsApp</span></a>')


# Antes de pintar: clase js y movimiento reducido. Las entradas arrancan con el primer cuadro,
# sin esperar a las fuentes (las fuentes se precargan y tienen respaldo con métricas ajustadas).
BOOT = """<script>
(function (d, w) {
  var h = d.documentElement;
  h.classList.remove('no-js'); h.classList.add('js');
  try { if (w.matchMedia('(prefers-reduced-motion: reduce)').matches) h.classList.add('rm'); } catch (e) {}
  (w.requestAnimationFrame || setTimeout)(function () { h.classList.add('ready'); });
  %s
})(document, window);
</script>"""

REMEMBER = ("try { localStorage.setItem('eb:area', '%s'); } catch (e) {}\n"
            "  try { var r = d.referrer && new URL(d.referrer); if (r && r.origin === location.origin && /^\\/(index\\.html)?$/.test(r.pathname)) h.classList.add('from-home'); } catch (e) {}")
IN_SITE = ''

FONTS = ['fraunces-roman', 'fraunces-italic', 'inter']


def person_ld():
    return {
        '@type': 'Person', '@id': SITE + '/#ezequiel', 'name': 'Ezequiel Brunner', 'url': SITE + '/',
        'image': SITE + '/assets/ezequiel-brunner-perfil.webp', 'email': 'mailto:' + EMAIL, 'telephone': '+54 9 223 634-3371',
        'jobTitle': 'Consultor en gestión gastronómica y automatización con inteligencia artificial',
        'address': {'@type': 'PostalAddress', 'addressLocality': 'Mar del Plata', 'addressRegion': 'Buenos Aires', 'addressCountry': 'AR'},
        'sameAs': [LINKEDIN, ABOUTME],
        'knowsAbout': ['Gestión gastronómica', 'Control de costos', 'Recursos humanos', 'Automatización de procesos',
                       'Inteligencia artificial', 'Transparencia algorítmica'],
    }


def head(page):
    """page: file, path, title, desc, og, area, ld, css (hoja propia de la página), preload (imágenes)."""
    canonical = SITE + page['path']
    root = page.get('root', '')
    ld = {'@context': 'https://schema.org', '@graph': [person_ld()] + page.get('ld', [])}
    fonts = ''.join(f'<link rel="preload" href="{root}assets/fonts/{f}.woff2" as="font" type="font/woff2" crossorigin>\n' for f in FONTS)
    imgs = ''.join(f'<link rel="preload" as="image" href="{p[0]}" imagesrcset="{p[1]}" imagesizes="{p[2]}" fetchpriority="high">\n'
                   for p in page.get('preload', []))
    css = f'<link rel="stylesheet" href="{root}assets/css/main.css?v={V}">\n'
    if page.get('css'):
        css += f'<link rel="stylesheet" href="{root}assets/css/{page["css"]}.css?v={V}">\n'
    return f"""<!doctype html>
<html lang="es-AR" class="no-js"{f' data-area="{page["area"]}"' if page.get('area') else ''}>
<head>
<meta charset="utf-8">
<style>@view-transition {{ navigation: auto; }} @media (prefers-reduced-motion: reduce) {{ @view-transition {{ navigation: none; }} }}</style>
{page.get('pre_head', '')}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(page['title'])}</title>
<meta name="description" content="{esc(page['desc'])}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#101315">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:site_name" content="Ezequiel Brunner">
<meta property="og:title" content="{esc(page.get('og_title', page['title']))}">
<meta property="og:description" content="{esc(page['desc'])}">
<meta property="og:type" content="website">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE}/{page['og']}?v={V}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(page.get('og_alt', page['title']))}">
<meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(page.get('og_title', page['title']))}">
<meta name="twitter:description" content="{esc(page['desc'])}">
<meta name="twitter:image" content="{SITE}/{page['og']}?v={V}">
{BOOT % page.get('boot', '')}
{fonts}{imgs}{css}<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(',', ':'))}</script>
</head>"""


def area_of(key):
    return GAS if key == 'gastronomia' else IA


GLOBAL_NAV = [('gastronomia.html', 'Gastronomía', 'gastronomia'), ('inteligencia-artificial.html', 'Automatización & IA', 'automatizacion'),
              ('trayectoria.html', 'Trayectoria', 'trayectoria'), ('publicaciones.html', 'Publicaciones', 'publicaciones')]


def _cur(k, current):
    return ' aria-current="page"' if k == current else ''


def header(current=None, cta=None):
    """Encabezado común. current: inicio | gastronomia | automatizacion | trayectoria | publicaciones | None."""
    links = ''.join(f'<a href="{h}"{_cur(k, current)}>{esc(t)}</a>' for h, t, k in GLOBAL_NAV)
    area = area_of(current) if current in ('gastronomia', 'automatizacion') else None
    cta = cta or ((area['cta'], '#contacto') if area else ('Contacto', '#contacto'))
    return f"""<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="hdr" data-hdr>
<div class="hdr-in">
<a class="brand" href="index.html"{_cur('inicio', current)}><span class="brand-name">Ezequiel Brunner</span><span class="sr"> · inicio</span></a>
<nav class="nav" aria-label="Principal">{links}</nav>
<div class="hdr-act">
<a class="btn btn-sm hdr-cta" href="{cta[1]}">{esc(cta[0])}</a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" data-menu-btn><span class="mb-lines" aria-hidden="true"><i></i><i></i></span><span class="sr">Abrir menú</span></button>
</div>
</div>
</header>"""


def menu(current=None, sub=None, cta=None):
    """Menú del celular: los destinos del sitio y, en las áreas, las secciones de la página."""
    area = area_of(current) if current in ('gastronomia', 'automatizacion') else None
    nav = [('index.html', 'Inicio', 'inicio')] + GLOBAL_NAV
    items = ''.join(f'<li><a href="{h}"{_cur(k, current)}><span class="mi-n">{i + 1:02d}</span>{esc(t)}</a></li>' for i, (h, t, k) in enumerate(nav))
    cta = cta or ((area['cta'], '#contacto') if area else ('Contacto', '#contacto'))
    here = ''
    if sub:
        here = ('<nav class="menu-here" aria-label="En esta página"><p class="label">En esta página</p><ul>'
                + ''.join(f'<li><a href="{h}">{esc(t)}</a></li>' for h, t in sub) + '</ul></nav>')
    return f"""<div class="menu" id="menu" role="dialog" aria-modal="true" aria-label="Menú" hidden data-menu>
<div class="menu-in">
<nav aria-label="Menú principal"><ol>{items}</ol></nav>
{here}
<div class="menu-foot">
<a class="btn" href="{cta[1]}">{esc(cta[0])} {ARR}</a>
<a class="menu-wa" href="{wa_link(area['label'] if area else '')}" target="_blank" rel="noopener noreferrer">{WA_ICON}<span>WhatsApp · {WA_DISPLAY}</span></a>
<a class="menu-mail" href="mailto:{EMAIL}">{EMAIL}</a>
</div>
</div>
</div>"""


def subnav(items):
    """Índice de la página (áreas): queda a mano al bajar y marca la sección que se está leyendo."""
    links = ''.join(f'<a href="{h}" data-sec>{esc(t)}</a>' for h, t in items)
    return f'<nav class="subnav" aria-label="En esta página"><div class="wrap subnav-in"><span class="subnav-k" aria-hidden="true">En esta página</span>{links}</div></nav>'


def dock(area_key):
    """Barra inferior en el celular: la acción principal y WhatsApp, siempre a mano."""
    area = area_of(area_key)
    return f"""<div class="dock" data-dock aria-hidden="true">
<a class="btn dock-cta" href="#contacto" tabindex="-1">{esc(area['cta'])} {ARR}</a>
<a class="dock-ico dock-wa" href="{wa_link(area['label'])}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-label="WhatsApp">{WA_ICON}</a>
</div>"""


def footer(area_key=None):
    return f"""<footer class="ftr">
<div class="wrap">
<div class="ftr-grid">
<div class="ftr-brand">
<p class="ftr-name">Ezequiel Brunner</p>
<p class="ftr-desc">Asesoramiento gastronómico y automatización con inteligencia artificial para empresas. Mar del Plata, Argentina.</p>
</div>
<nav class="ftr-col" aria-label="Áreas">
<p class="label">Áreas</p>
<a href="gastronomia.html">Asesoramiento gastronómico</a>
<a href="inteligencia-artificial.html">Automatización &amp; IA</a>
<a href="trayectoria.html">Trayectoria</a>
<a href="gastronomia.html#trabaja-conmigo">Trabajá conmigo</a>
</nav>
<nav class="ftr-col" aria-label="Publicaciones">
<p class="label">Publicaciones</p>
<a href="publicaciones.html#doctrina">Doctrina e investigación</a>
<a href="publicaciones.html#dossier">Dossier legislativo</a>
<a href="publicaciones.html#medios">Prensa y medios</a>
</nav>
<div class="ftr-col">
<p class="label">Contacto</p>
<a href="{wa_link()}" target="_blank" rel="noopener noreferrer">WhatsApp · {WA_DISPLAY}</a>
<a href="mailto:{EMAIL}">{EMAIL}</a>
<a href="{LINKEDIN}" target="_blank" rel="noopener noreferrer">LinkedIn {EXT}</a>
<a href="{ABOUTME}" target="_blank" rel="noopener noreferrer">Perfil biográfico {EXT}</a>
</div>
</div>
<div class="ftr-bottom">
<span>© 2026 Ezequiel Brunner · Mar del Plata, Argentina</span>
<a href="#top" data-top>Volver arriba <span aria-hidden="true">↑</span></a>
</div>
</div>
</footer>"""


VENDOR = {'gsap': 'gsap.min.js', 'st': 'ScrollTrigger.min.js', 'split': 'SplitText.min.js', 'lenis': 'lenis.min.js'}


def scripts(vendor, *own):
    """vendor: claves de VENDOR en orden; own: scripts propios (sin «assets/js/» ni «.js»). Todos diferidos."""
    out = ''.join(f'<script src="assets/js/vendor/{VENDOR[k]}" defer></script>\n' for k in vendor)
    out += ''.join(f'<script src="assets/js/{s}.js?v={V}" defer></script>\n' for s in ('main',) + own)
    return out


def sec_head(label, h2, intro='', num='', h2_id='', cls=''):
    n = f'<span class="lab-n">{num}</span>' if num else ''
    i = f'<p class="intro">{intro}</p>' if intro else ''
    hid = f' id="{h2_id}"' if h2_id else ''
    return f'<div class="sec-head {cls}"><p class="label">{n}{esc(label)}</p><h2 class="h2"{hid}>{h2}</h2>{i}</div>'


def btn(text, href, ghost=False, small=False, attrs=''):
    cls = 'btn' + (' ghost' if ghost else '') + (' btn-sm' if small else '')
    return f'<a class="{cls}" href="{href}"{attrs}><span>{esc(text)}</span> {ARR}</a>'


def tlink(text, href, ext=False, attrs=''):
    t = ' target="_blank" rel="noopener noreferrer"' if ext else ''
    return f'<a class="tlink" href="{href}"{t}{attrs}><span>{esc(text)}</span> {EXT if ext else ARR}</a>'


# ---------------------------------------------------------------- formulario

def field(fid, label, inp, wide=False, hint=''):
    h = f'<span class="f-hint">{hint}</span>' if hint else ''
    return f'<div class="f{" f-wide" if wide else ""}"><label for="{fid}">{label}</label>{inp}{h}</div>'


def select(fid, name, options, required=True, placeholder='Elegí una opción'):
    req = ' required' if required else ''
    ops = f'<option value="" disabled selected>{placeholder}</option>' + ''.join(f'<option>{esc(o)}</option>' for o in options)
    return f'<div class="sel"><select id="{fid}" name="{name}"{req}>{ops}</select></div>'


def form(kind, services):
    """kind: 'gastronomia' | 'automatizacion'. Envío por WhatsApp (o email); Netlify Forms queda preparado."""
    if kind == 'gastronomia':
        name, subject, button = 'solicitar-asesoramiento', 'Solicitud de asesoramiento gastronómico', GAS['cta']
        extra = (field('f-tipo', 'Tipo de negocio', select('f-tipo', 'tipo', ['Restaurante', 'Cafetería o bar', 'Cadena o franquicia', 'Producción o eventos', 'Otro'], required=False))
                 + field('f-etapa', 'Etapa del negocio', select('f-etapa', 'etapa', ['Local en marcha', 'Nueva apertura', 'Varias sucursales', 'Otra situación'], required=False))
                 + field('f-servicio', 'Servicio de interés *', select('f-servicio', 'servicio', services + ['Recursos humanos y procedimientos', 'Todavía no lo sé']), wide=True))
        msg_label, msg_ph = 'Contame brevemente tu proyecto *', 'Qué está pasando y qué te gustaría mejorar.'
        company_req = ''
    else:
        name, subject, button = 'evaluar-empresa', 'Evaluación de empresa: automatización e IA', IA['cta']
        extra = (field('f-rubro', 'Rubro o sector', '<input id="f-rubro" name="rubro" maxlength="120" autocomplete="off" placeholder="Por ejemplo: comercio, servicios, salud">')
                 + field('f-tam', 'Tamaño del equipo', select('f-tam', 'tamano', ['1 a 10 personas', '11 a 50 personas', '51 a 200 personas', 'Más de 200 personas'], required=False))
                 + field('f-area', 'Área a evaluar *', select('f-area', 'area', services + ['Varias áreas', 'Todavía no lo sé']), wide=True))
        msg_label, msg_ph = 'Qué tarea o proceso te gustaría mejorar *', 'Qué se repite, dónde se pierde tiempo o qué información necesitás ordenar.'
        company_req = ' *'
    req = ' required' if company_req else ''
    return f"""<form class="form" name="{name}" method="post" action="mailto:{EMAIL}" enctype="text/plain" data-netlify="true" netlify-honeypot="bot-field" data-form data-endpoint="whatsapp" data-subject="{esc(subject)}">
<input type="hidden" name="form-name" value="{name}">
<p class="hp" aria-hidden="true"><label>No completar <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
<div class="f-grid">
{field('f-nombre', 'Nombre y apellido *', '<input id="f-nombre" name="nombre" required maxlength="100" autocomplete="name">')}
{field('f-empresa', 'Empresa' + company_req, f'<input id="f-empresa" name="empresa" maxlength="150" autocomplete="organization"{req}>')}
{field('f-email', 'Email *', '<input id="f-email" name="email" type="email" required maxlength="150" autocomplete="email" inputmode="email">')}
{field('f-tel', 'Teléfono', '<input id="f-tel" name="telefono" type="tel" maxlength="40" autocomplete="tel" inputmode="tel">')}
{extra}
{field('f-msg', msg_label, f'<textarea id="f-msg" name="mensaje" rows="5" minlength="15" maxlength="2000" required placeholder="{esc(msg_ph)}"></textarea>', wide=True)}
</div>
<div class="f-foot">
<button class="btn btn-lg" type="submit" name="via" value="whatsapp"><span class="b-t">{esc(button)}</span> {ARR}</button>
<p class="f-note">{WA_ICON}<span>Se abre WhatsApp con tu consulta completa, lista para enviar. ¿Preferís email? <button class="f-alt" type="submit" name="via" value="email">Enviala por email</button></span></p>
</div>
<div class="f-status" role="status" aria-live="polite" data-status></div>
</form>"""


def direct_contact(place, context=''):
    return f"""<div class="direct">
<p class="label">Contacto directo</p>
<a class="btn btn-wa" href="{wa_link(context)}" target="_blank" rel="noopener noreferrer">{WA_ICON}<span>Escribime por WhatsApp</span></a>
<p class="wa-num">WhatsApp {WA_DISPLAY}</p>
<div class="mailrow"><a class="mail" href="mailto:{EMAIL}">{EMAIL}</a><button class="copy" type="button" data-copy="{EMAIL}">Copiar</button></div>
<a class="tlink" href="{LINKEDIN}" target="_blank" rel="noopener noreferrer"><span>LinkedIn /in/ezequielbrunner</span> {EXT}</a>
<p class="place">{esc(place)}</p>
</div>"""


# ---------------------------------------------------------------- publicaciones: filas de biblioteca

def pub_row(it, heading='h3', desc=True, rv=True):
    """Una publicación como entrada de índice: tipo, medio, fecha, título y enlace original."""
    meta = ' · '.join(x for x in [it['outlet'], it.get('human_date', '')] if x)
    kind = f'<span class="pb-kind">{esc(it["kind"])}</span>' if it.get('kind') else ''
    tag = f'<span class="pb-tag">{esc(it["tag"])}</span>' if it.get('tag') else ''
    d = f'<span class="pb-d">{esc(" ".join(it["paras"]))}</span>' if desc and it.get('paras') else ''
    return (f'<li class="prow"{" data-rv" if rv else ""}><a href="{esc(it["href"])}" target="_blank" rel="noopener noreferrer">'
            f'<span class="pb-meta">{kind}<span class="pb-src">{esc(meta)}</span></span>'
            f'<span class="pb-main"><{heading} class="pb-t">{esc(it["title"])}</{heading}>{tag}{d}</span>'
            f'<span class="pb-go">{esc(it.get("link") or "Leer en el medio")} {EXT}</span></a></li>')
