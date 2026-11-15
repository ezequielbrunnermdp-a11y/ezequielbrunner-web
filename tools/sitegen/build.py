"""Genera index.html, gastronomia.html, inteligencia-artificial.html, publicaciones.html y 404.html.

Uso:  python3 tools/sitegen/build.py      (escribe las páginas en la raíz del repositorio)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import (ROOT, SITE, EMAIL, LINKEDIN, ABOUTME, RRHH_EMAIL, GAS, IA, GAS_PAGE, IA_PAGE, PERSON, HOME, ABOUT,
                     NARRATIVE, DEMO, DEPTS, publications, esc, _s)
from tpl import (head, header, menu, dock, footer, scripts, sec_head, btn, tlink, form, direct_contact, pub_row,
                 ARR, EXT, REMEMBER, V, wa_float, wa_link, WA_ICON)

P = publications()
TEAM_ALT = 'Equipo de Puerto de Palos en un evento en Bendu Arena'
OPS_ALT = 'Coordinación del equipo durante un evento'


def pic(name, alt='', cls='', sizes='100vw', lazy=False, prio=False, w=1800, h=1200, widths=(1000, 1800)):
    """Foto con AVIF y respaldo WebP, en dos anchos."""
    def srcset(ext):
        return ', '.join(f'assets/img/{name}{"" if x == widths[-1] else "-" + str(x)}.{ext} {x}w' for x in widths)
    c = f' class="{cls}"' if cls else ''
    load = 'loading="lazy" ' if lazy else ''
    fp = 'fetchpriority="high" ' if prio else ''
    return (f'<picture><source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
            f'<img{c} src="assets/img/{name}.webp" srcset="{srcset("webp")}" sizes="{sizes}" alt="{esc(alt)}" '
            f'width="{w}" height="{h}" {load}{fp}decoding="async"></picture>')


def portrait(cls='', sizes='(max-width: 900px) 100vw, 40vw', lazy=True):
    return pic('retrato', 'Retrato de Ezequiel Brunner', cls, sizes, lazy=lazy, w=697, h=1046, widths=(480, 697))


def field_canvas(cls, t, mode, sizes='100vw'):
    """Relieve de líneas con red de nodos (assets/js/lines.js). Debajo, una imagen fija del mismo dibujo:
    se ve al instante, sin JavaScript y con movimiento reducido, hasta que el lienzo está listo."""
    poster = pic('lineas', cls='pm-poster', sizes=sizes, prio=True)
    return f'<div class="{cls} pm-lines" aria-hidden="true">{poster}<canvas data-lines data-t="{t}" data-mode="{mode}"></canvas></div>'


def title_lines(a, key='title_lines'):
    return ''.join(f'<span class="ln" style="--l:{i}"><span>{t}</span></span>' for i, t in enumerate(a[key]))


def _norm_doc(d):
    href = d['href']
    outlet = ('SAIJ' if 'saij' in href or 'SAIJ' in ' '.join(d['paras']) else 'SSRN' if 'ssrn' in href
              else 'Universidad Kennedy' if 'kennedy' in href else d['outlet'])
    labor = any(w in d['title'] for w in ('Laboral', 'laboral', 'Certificados', 'licencias'))
    kind = 'Doctrina · Derecho Laboral' if (d['kind'] == 'Doctrina' and labor) else d['kind']
    last = d['meta'].split(' · ')[-1]
    date = d['human_date'] if ('saij' in href and len(d['human_date']) > 4) else (last if last.isdigit() else '')
    return dict(d, outlet=outlet, kind=kind, human_date=date)


DOCT = [_norm_doc(d) for d in P['doctrina']]


def doc_by(title_start):
    return next(d for d in DOCT if d['title'].startswith(title_start))


def write(name, html):
    open(os.path.join(ROOT, name), 'w', encoding='utf8').write(html)
    print(f'{name:32s} {len(html):7d} bytes')


# ======================================================================= inicio

LEGACY_HOME = """<script>
/* Enlaces viejos a secciones que cambiaron de lugar. */
(function (l) {
  var map = {'#gastronomia': 'gastronomia.html', '#servicios-gastronomia': 'gastronomia.html#servicios', '#trabaja-conmigo': 'gastronomia.html#trabaja-conmigo',
    '#personas': 'gastronomia.html#recursos-humanos', '#servicios-personas': 'gastronomia.html#recursos-humanos', '#capas': 'gastronomia.html#operacion',
    '#metodo': 'gastronomia.html#metodo', '#procesos': 'inteligencia-artificial.html#metodo', '#ia': 'inteligencia-artificial.html',
    '#servicios-ia': 'inteligencia-artificial.html#servicios', '#dossier': 'publicaciones.html#dossier', '#medios': 'publicaciones.html#medios',
    '#novedades': 'publicaciones.html', '#notas': 'publicaciones.html', '#enfoque': '#sobre-mi'};
  var h = l.hash, to = map[h];
  if (to) { if (to.charAt(0) === '#') { try { history.replaceState(null, '', to); } catch (e) {} } else { l.replace(to); } }
})(location);
</script>
"""


def panel(a):
    """Un universo de la portada: rótulo, título, una promesa y dos datos. Sin catálogo."""
    k = a['key']
    proof = ''.join(f'<li><span class="pp-n">{esc(n)}</span><span class="pp-l">{esc(l)}</span></li>' for n, l in HOME['proof'][k])
    if k == 'gastronomia':
        media = ('<div class="p-media pm-photo" aria-hidden="true">'
                 + pic('equipo', cls='pm-base', sizes='(max-width: 640px) 100vw, (max-width: 900px) 50vw, 62vw', prio=True)
                 + '<div class="pm-litwrap">' + pic('equipo', cls='pm-lit', sizes='(max-width: 640px) 100vw, (max-width: 900px) 50vw, 62vw') + '</div></div>')
    else:
        media = field_canvas('p-media', 38000, 'panel', '(max-width: 640px) 100vw, (max-width: 900px) 50vw, 62vw')
    return f"""<article class="panel panel-{k}" data-panel="{k}" aria-labelledby="t-{k}">
{media}
<div class="p-shade" aria-hidden="true"></div>
<div class="p-body">
<p class="p-label"><span class="p-num">{a['num']}</span><span class="p-name">{esc(a['label'])}</span><span class="p-last">Tu última visita</span></p>
<h2 class="p-title" id="t-{k}">{title_lines(a)}</h2>
<p class="p-sub">{esc(a['subtitle'])}</p>
<div class="p-more"><div class="p-more-in"><ul class="p-proof">{proof}</ul></div></div>
<a class="p-cta" href="{a['href']}" data-go="{k}"><span>{esc(a['explore'])}</span> {ARR}</a>
</div>
</article>"""


def home():
    page = {'file': 'index.html', 'path': '/', 'area': None, 'css': 'home',
            'title': 'Ezequiel Brunner · Asesoramiento gastronómico y automatización con IA',
            'desc': 'Consultoría en gestión gastronómica y en automatización e inteligencia artificial para empresas. Costos, equipos, procesos, agentes, asistentes y tableros. Ezequiel Brunner, Mar del Plata.',
            'og': 'assets/og/inicio.jpg', 'og_alt': 'Ezequiel Brunner: asesoramiento gastronómico y automatización con inteligencia artificial',
            'pre_head': LEGACY_HOME,
            'ld': [{'@type': 'WebSite', 'name': 'Ezequiel Brunner', 'url': SITE + '/', 'inLanguage': 'es-AR'},
                   {'@type': 'ProfessionalService', 'name': 'Ezequiel Brunner · Consultoría', 'url': SITE + '/',
                    'founder': {'@id': SITE + '/#ezequiel'}, 'areaServed': 'AR', 'email': EMAIL,
                    'address': {'@type': 'PostalAddress', 'addressLocality': 'Mar del Plata', 'addressCountry': 'AR'},
                    'knowsAbout': ['Asesoramiento gastronómico', 'Automatización de procesos', 'Inteligencia artificial aplicada a empresas']}]}
    dz = P['dossier']
    feat = [
        {'outlet': 'Biblioteca del Congreso', 'kind': 'Selección bibliográfica', 'human_date': 'Abril de 2026',
         'title': f"{dz['h2']}: {dz['title']}", 'href': dz['href'], 'link': dz['link'], 'paras': []},
        dict(doc_by('Transparencia algorítmica como garantía'), paras=[]),
        dict(doc_by('Algorithmic Transparency'), paras=[]),
        dict(doc_by('Inteligencia Artificial y Derecho'), paras=[]),
    ]
    outlets = []
    for m in P['medios'] + P['gastro']:
        if m['outlet'] not in outlets and m['outlet'] != 'Instagram':
            outlets.append(m['outlet'])
    chapters = ''.join(f'<li class="ch" data-rv><span class="ch-n">{n}</span><h3 class="ch-t">{esc(t)}</h3><p>{esc(p)}</p></li>' for n, t, p in ABOUT['chapters'])
    body = f"""<body class="pg-home">
<a class="skip" href="#elegir">Saltar a la elección de área</a>
<main id="contenido">
<section class="split" id="elegir" aria-label="Elegí un área de trabajo" data-split>
<div class="split-top">
<p class="st-tag">Mar del Plata · Argentina</p>
<div class="st-id">
<h1 class="st-brand"><a href="#elegir">Ezequiel Brunner</a></h1>
<p class="st-line">{esc(HOME['tagline'])}</p>
</div>
<nav class="st-nav" aria-label="Accesos"><a href="publicaciones.html">Publicaciones</a><a href="#contacto">Contacto</a></nav>
</div>
<p class="split-intro">{esc(HOME['intro_m'])}</p>
{panel(GAS)}
<div class="split-line" aria-hidden="true"><span class="sl-tag">Elegí un área</span></div>
{panel(IA)}
<a class="split-down" href="#sobre-mi"><span>Conocé mi trayectoria</span> <span class="sd-ico" aria-hidden="true">↓</span></a>
</section>

<section class="sec about" id="sobre-mi" aria-labelledby="about-t">
<div class="wrap about-grid">
<figure class="about-photo" data-rv>{portrait('about-img')}<figcaption>Ezequiel Brunner · Mar del Plata</figcaption></figure>
<div class="about-copy">
<p class="label">{esc(ABOUT['label'])}</p>
<h2 class="h2 h2-xl" id="about-t">{ABOUT['h2']}</h2>
<p class="manifesto">{ABOUT['manifesto']}</p>
<ol class="chapters">{chapters}</ol>
<p class="about-note">{esc(ABOUT['note'])}</p>
<div class="row-links">{tlink('Trayectoria completa', 'gastronomia.html#trayectoria')}{tlink('Publicaciones', 'publicaciones.html')}{tlink('LinkedIn', LINKEDIN, ext=True)}</div>
</div>
</div>
</section>

<section class="sec home-pubs" id="publicaciones" aria-labelledby="hp-t">
<div class="wrap">
<div class="sec-top">{sec_head('Publicaciones', 'Doctrina, investigación <em>y prensa.</em>', esc(P['heads']['doctrina']['intro']), h2_id='hp-t')}
{btn('Ver la biblioteca completa', 'publicaciones.html', ghost=True)}</div>
<ol class="plist plist-feat">{''.join(pub_row(f, desc=False) for f in feat)}</ol>
<div class="outlets" data-rv><p class="label">En los medios</p><ul>{''.join(f'<li>{esc(o)}</li>' for o in outlets)}</ul></div>
</div>
</section>

<section class="sec home-contact" id="contacto" aria-labelledby="hc-t">
<div class="wrap hc-grid">
<div>
{sec_head('Contacto', 'Conversemos sobre tu <em>próximo paso.</em>', 'Contame qué necesitás ordenar, mejorar o poner en marcha. Elegí el área para que la consulta llegue con la información justa.', h2_id='hc-t')}
{direct_contact(PERSON['place'] + ' · Modalidad a definir según el proyecto.')}
</div>
<div class="choices">
<a class="choice lit" href="gastronomia.html#contacto" data-go-area="gastronomia"><span class="ch-k">01 · Gastronomía</span><span class="ch-h">{esc(GAS['cta'])}</span><span class="ch-d">Restaurantes, cafeterías, cadenas y franquicias.</span>{ARR}</a>
<a class="choice lit" href="inteligencia-artificial.html#contacto" data-go-area="automatizacion"><span class="ch-k">02 · Automatización &amp; IA</span><span class="ch-h">{esc(IA['cta'])}</span><span class="ch-d">Empresas de cualquier sector.</span>{ARR}</a>
</div>
</div>
</section>
</main>
{footer()}
{wa_float()}
{scripts(['gsap', 'split', 'lenis'], 'lines', 'split')}
</body>
</html>"""
    write('index.html', head(page) + '\n' + body)


# ======================================================================= piezas comunes de las áreas

def hero(a, page):
    k = a['key']
    if k == 'gastronomia':
        # sin prioridad alta: el contenido principal es el texto y sus fuentes van primero
        media = '<div class="hero-media" aria-hidden="true">' + pic('operacion') + '</div>'
    else:
        media = field_canvas('hero-media', 51000, 'hero')
    down = {'gastronomia': 'operacion', 'automatizacion': 'soluciones'}[k]
    return f"""<section class="hero" id="inicio" aria-labelledby="hero-t">
{media}
<div class="hero-shade" aria-hidden="true"></div>
<div class="wrap hero-in">
<p class="label hero-label" data-in="1">{esc(page['hero_label'])}</p>
<h1 class="hero-t" id="hero-t">{title_lines(a)}</h1>
<div class="hero-row">
<p class="hero-sub" data-in="3">{esc(a['subtitle'])}</p>
<div class="hero-cta" data-in="4">{btn(a['cta'], '#contacto')}{btn('Ver servicios', '#servicios', ghost=True)}</div>
</div>
<p class="hero-fine" data-in="5">{esc(page['hero_fine'])}</p>
</div>
<a class="hero-down" href="#{down}"><span class="sr">Bajar a la siguiente sección</span><span aria-hidden="true"></span></a>
</section>"""


def method(m, sid='metodo', num='', modes=None):
    steps = ''.join(f'<li class="step" style="--i:{i}"><span class="st-n">{i + 1:02d}</span><h3 class="st-t">{esc(t)}</h3><p class="st-k">{esc(k)}</p><p class="st-p">{esc(p)}</p></li>'
                    for i, (t, k, p) in enumerate(m['steps']))
    return f"""<section class="sec method" id="{sid}" aria-labelledby="{sid}-t">
<div class="wrap">
{sec_head(m['label'], m['h2'], esc(m['intro']), h2_id=sid + '-t', num=num)}
<ol class="steps steps-{len(m['steps'])}" data-steps><span class="steps-line" aria-hidden="true"><i></i></span>{steps}</ol>
{modes_row(modes) if modes else ''}
</div>
</section>"""


def modes_row(m):
    items = ''.join(f'<li class="md"><p class="md-k">{esc(k)}</p><h4 class="md-t">{esc(t)}</h4><p class="md-p">{esc(p)}</p>'
                    f'<a class="tlink" href="#contacto" data-prefill="modalidad:{esc(t)}"><span>Conversemos</span> {ARR}</a></li>'
                    for t, k, p in m['items'])
    return f"""<div class="modes-in" id="modalidades">
<h3 class="sub-h">{m['h2']}</h3>
<ul class="md-grid">{items}</ul>
<p class="note">{esc(m['note'])}</p>
</div>"""


def faq(items, ld_list, num=''):
    qs = ''.join(f'<details class="qa"><summary><span>{esc(q)}</span><i aria-hidden="true"></i></summary><div class="qa-a"><p>{esc(a)}</p></div></details>' for q, a in items)
    ld_list.append({'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in items]})
    return f"""<section class="sec faq" id="preguntas" aria-labelledby="preguntas-t">
<div class="wrap faq-grid">
{sec_head('Antes de empezar', 'Preguntas <em>frecuentes.</em>', h2_id='preguntas-t', num=num)}
<div class="qa-list">{qs}</div>
</div>
</section>"""


def bridge(b, href, other):
    return f"""<aside class="bridge" aria-label="{esc(other['label'])}">
<div class="wrap bridge-in">
<a class="bridge-a lit" href="{href}" data-go-area="{other['key']}">
<span class="label">{esc(b['label'])}</span>
<span class="bridge-t">{esc(b['h2'])}</span>
<span class="bridge-p">{esc(b['p'])}</span>
<span class="bridge-go">{esc(b['link'])} {ARR}</span>
</a>
</div>
</aside>"""


def contact(c, kind, services, num='', context=''):
    return f"""<section class="sec contact" id="contacto" aria-labelledby="contacto-t">
<div class="wrap contact-grid">
<div class="contact-l">
{sec_head(c['label'], c['h2'], esc(c['p']), h2_id='contacto-t', num=num)}
{direct_contact(c['place'], context)}
</div>
<div class="contact-r">{form(kind, services)}</div>
</div>
</section>"""


# ======================================================================= gastronomía

def narrative():
    """«Detrás de cada servicio hay una operación»: la palabra se abre y la operación se recorre en cuatro pilares."""
    N = NARRATIVE
    steps = []
    for i, pl in enumerate(N['pillars']):
        k = pl['k']
        if k == 'personas':
            vis = '<ul class="nv nv-list">' + ''.join(f'<li>{esc(x)}</li>' for x in pl['items']) + '</ul>'
        elif k == 'procesos':
            vis = ('<ol class="nv nv-flow">' + ''.join(f'<li style="--i:{j}"><span class="nf-n">{j + 1:02d}</span><span class="nf-t">{esc(x)}</span></li>'
                                                   for j, x in enumerate(pl['items'])) + '<span class="nf-line" aria-hidden="true"><i></i></span></ol>')
        elif k == 'costos':
            terms = ''.join(f'<span class="nfo-t{" nfo-res" if x.startswith("=") else ""}" style="--i:{j}">{esc(x)}</span>' for j, x in enumerate(pl['items']))
            vis = f'<p class="nv nv-formula" aria-label="Inventario inicial más compras menos inventario final es igual al costo de mercadería vendida">{terms}</p>'
        else:
            paths = ['M0 22 C 14 20, 22 12, 34 14 S 56 6, 70 8 S 92 4, 100 2', 'M0 8 C 16 10, 26 16, 40 14 S 62 20, 76 18 S 92 22, 100 21',
                     'M0 16 C 12 18, 24 10, 38 12 S 60 18, 72 12 S 90 10, 100 12', 'M0 12 C 18 12, 28 8, 44 10 S 66 14, 80 10 S 94 9, 100 8']
            rows = ''.join(f'<li style="--i:{j}"><span class="ni-t">{esc(x)}</span><svg class="ni-l" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="{paths[j]}" pathLength="1"/></svg></li>'
                           for j, x in enumerate(pl['items']))
            vis = f'<ul class="nv nv-ind" aria-label="Indicadores que se siguen">{rows}</ul>'
        steps.append(f"""<li class="ns ns-{k}" data-k="{k}">
<p class="ns-n"><span>{i + 1:02d}</span>{esc(pl['name'])}</p>
<h3 class="ns-t">{esc(pl['h3'])}</h3>
<p class="ns-p">{esc(pl['p'])}</p>
{vis}
</li>""")
    prog = ''.join(f'<li data-k="{pl["k"]}"><span>{i + 1:02d}</span>{esc(pl["name"])}</li>' for i, pl in enumerate(N['pillars']))
    return f"""<section class="nar" id="{N['id']}" aria-labelledby="nar-t" data-nar>
<span class="anchor" id="equipo" aria-hidden="true"></span><span class="anchor" id="capas" aria-hidden="true"></span><span class="anchor" id="propuesta" aria-hidden="true"></span>
<div class="nar-pin">
<div class="nar-media">{pic('equipo', alt=TEAM_ALT, sizes='100vw', lazy=True)}</div>
<div class="nar-shade" aria-hidden="true"></div>
<svg class="nar-mask" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs><mask id="nar-m" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
<rect width="1600" height="900" fill="#fff"/>
<g class="nar-word"><text x="800" y="530" text-anchor="middle">{esc(N['word'])}</text></g>
</mask></defs>
<rect class="nar-veil" width="1600" height="900" mask="url(#nar-m)"/>
</svg>
<div class="wrap nar-in">
<div class="nar-head">
<p class="label">{esc(N['label'])}</p>
<h2 class="nar-h2" id="nar-t">{N['h2']}</h2>
</div>
<ol class="nar-steps">{''.join(steps)}</ol>
<div class="nar-close"><p class="nar-cl">{N['close']}</p>{btn(GAS['cta'], '#contacto')}</div>
</div>
<ol class="nar-prog" aria-hidden="true">{prog}</ol>
<p class="nar-cap">{esc(TEAM_ALT)}.</p>
</div>
</section>"""


ANCHORS = {'Gestión del personal': 'gestion-del-personal', 'Microprocedimientos operativos': 'microprocedimientos',
           'Procedimientos disciplinarios': 'procedimientos-disciplinarios'}


def services_index(cats, head_html, note_after=''):
    """Servicios como índice editorial: cuatro filas numeradas que se despliegan con el detalle y los entregables."""
    rows = []
    for i, c in enumerate(cats):
        items = ''.join(f'<li>{esc(_s(x))}</li>' for x in c['items'])
        det = f'<p class="si-intro">{esc(c["intro"])}</p>' if c.get('intro') else ''
        for d in c['detail']:
            h, p_, o = d[0], d[1], d[2]
            li = ''.join(f'<li>{esc(x)}</li>' for x in d[3]) if len(d) > 3 else ''
            aid = f' id="{ANCHORS[h]}"' if h in ANCHORS else ''
            det += (f'<div class="si-d"{aid}><h3>{esc(h)}</h3><p>{esc(p_)}</p>' + (f'<ul class="ticks">{li}</ul>' if li else '')
                    + f'<p class="si-out"><b>Entregables</b> {esc(o)}</p></div>')
        anchor = '<span class="anchor" id="recursos-humanos" aria-hidden="true"></span>' if c['id'] == 'equipos' else ''
        rows.append(f"""<li class="si" id="cat-{c['id']}" data-rv>{anchor}
<details class="si-x"{' open' if i == 0 else ''}>
<summary><span class="si-n">{i + 1:02d}</span><span class="si-h"><span class="si-t">{esc(c['name'])}</span><span class="si-s">{esc(c['desc'])}</span></span><i class="si-i" aria-hidden="true"></i></summary>
<div class="si-body">
<ul class="si-list">{items}</ul>
<div class="si-more">{det}</div>
<a class="btn ghost btn-sm si-cta" href="#contacto" data-prefill="servicio:{esc(c['form'])}"><span>Consultar por este servicio</span> {ARR}</a>
</div>
</details>
</li>""")
    return f"""<section class="sec services" id="servicios" aria-labelledby="servicios-t">
<div class="wrap">
{head_html}
<ol class="sindex">{''.join(rows)}</ol>
{f'<p class="note">{esc(note_after)}</p>' if note_after else ''}
</div>
</section>"""


def gastronomia():
    G = GAS_PAGE
    ld = [{'@type': 'Service', 'name': 'Asesoramiento gastronómico', 'serviceType': 'Consultoría gastronómica',
           'provider': {'@id': SITE + '/#ezequiel'}, 'areaServed': 'AR', 'url': SITE + GAS['path'],
           'description': GAS['subtitle'],
           'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Servicios de asesoramiento gastronómico',
                               'itemListElement': [{'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': _s(s)}} for s in GAS['services']]}},
          {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE + '/'},
                                                          {'@type': 'ListItem', 'position': 2, 'name': 'Asesoramiento gastronómico', 'item': SITE + GAS['path']}]}]
    page = {'file': 'gastronomia.html', 'path': GAS['path'], 'area': 'gastronomia', 'css': 'areas',
            'title': 'Asesoramiento gastronómico: costos, equipos y operación | Ezequiel Brunner',
            'og_title': 'Asesoramiento gastronómico | Ezequiel Brunner',
            'desc': 'Consultoría y diagnóstico gastronómico: control de costos y CMV, auditorías, compras y stock, equipos y recursos humanos, procedimientos, aperturas y franquicias. Mar del Plata.',
            'og': 'assets/og/gastronomia.jpg', 'boot': REMEMBER % 'gastronomia', 'ld': ld}
    nav = [('#operacion', 'Operación'), ('#servicios', 'Servicios'), ('#trayectoria', 'Trayectoria'), ('#metodo', 'Método'), ('publicaciones.html', 'Publicaciones')]

    probs = ''.join(f'<li class="prob" data-rv><span class="pr-n">{i + 1:02d}</span><p class="pr-t">{esc(t)}</p><p class="pr-a"><span class="pr-k">Cómo lo abordo</span>{esc(a)}</p>'
                    f'<a class="pr-go" href="#cat-{c}"><span class="sr">Ver el servicio relacionado</span>{ARR}</a></li>' for i, (t, a, c) in enumerate(G['problems']['items']))
    st = G['stages']
    stages = ''.join(f'<article class="stg" data-rv><p class="stg-k">{esc(s["label"])}</p><h4 class="stg-t">{esc(s["h3"])}</h4>'
                     f'<ul class="ticks">{"".join(f"<li>{esc(x)}</li>" for x in s["li"])}</ul>'
                     f'<a class="tlink" href="#contacto" data-prefill="etapa:{esc(s["label"])}"><span>Quiero conversar sobre esto</span> {ARR}</a></article>' for s in st['items'])
    V_ = G['value']
    facts = []
    for f in V_['facts']:
        if 'n' in f:
            big = f'{esc(f.get("prefix", ""))}<span class="count" data-to="{f["n"]}">{f["n"]}</span>{esc(f.get("suffix", ""))}'
            facts.append(f'<li><span class="fact-n">{big}</span><span class="fact-l">{esc(f["label"])}</span></li>')
        else:
            facts.append(f'<li><span class="fact-n fact-txt">{esc(f["text"])}</span><span class="fact-l">{esc(f["label"])}</span></li>')
    C = G['career']
    tl = ''.join(f'<li class="tl" data-rv><span class="tl-k">{esc(k)}</span><h4 class="tl-t">{esc(t)}</h4><p>{esc(p)}</p></li>' for k, t, p in C['timeline'])
    press = ''.join(pub_row(m, desc=False) for m in P['gastro'])
    labor = ''.join(pub_row(d, desc=False) for d in [doc_by('La sanción disciplinaria'), doc_by('Certificados Médicos Digitales'), doc_by('La salud como prioridad')])
    train = ''.join(f'<li><span class="tr-k">{esc(k)}</span><span class="tr-t">{esc(t)}</span>{f"<span class=tr-d>{esc(d)}</span>" if d else ""}</li>' for k, t, d in C['training'])
    J = G['jobs']
    services = [c['form'] for c in G['categories']]

    body = f"""<body class="pg-area pg-gas">
{header('gastronomia', nav)}
{menu('gastronomia', nav)}
<main id="contenido">
{hero(GAS, G)}
{narrative()}

<section class="sec problems light" id="problemas" aria-labelledby="problemas-t">
<div class="wrap">
{sec_head(G['problems']['label'], G['problems']['h2'], esc(G['problems']['intro']), h2_id='problemas-t', num='01')}
<ol class="probs">{probs}</ol>
<div class="stages-wrap" id="tu-negocio">
<h3 class="sub-h">{st['h2']}</h3>
<div class="stg-grid">{stages}</div>
</div>
</div>
</section>

{services_index(G['categories'], sec_head(G['services_head']['label'], G['services_head']['h2'], esc(G['services_head']['intro']), h2_id='servicios-t', num='02'), note_after=G['rrhh']['scope'])}

<section class="sec career" id="trayectoria" aria-labelledby="trayectoria-t">
<span class="anchor" id="gastronomia" aria-hidden="true"></span>
<div class="wrap">
<div class="career-top">
<div class="career-copy">
{sec_head(C['label'], 'Un buen negocio se construye en <em>la operación.</em>', esc(C['intro']), h2_id='trayectoria-t', num='03')}
<ul class="facts">{''.join(facts)}</ul>
</div>
<figure class="career-photo" data-rv>{pic('operacion', alt=OPS_ALT, sizes='(max-width: 900px) 100vw, 42vw', lazy=True)}<figcaption>{esc(OPS_ALT)}.</figcaption></figure>
</div>
<div class="sub-block">
<h3 class="sub-h">Trayectoria profesional</h3>
<ol class="timeline">{tl}</ol>
<div class="row-links">{tlink('Ver mi LinkedIn', LINKEDIN, ext=True)}{tlink('Perfil biográfico', ABOUTME, ext=True)}{tlink('Trabajá conmigo', '#trabaja-conmigo')}</div>
</div>
<div class="sub-block two-lists">
<div><h3 class="sub-h">{esc(C['press_h'])}</h3><ul class="plist">{press}</ul></div>
<div><h3 class="sub-h">{esc(C['pubs_h'])}</h3><ul class="plist">{labor}</ul></div>
</div>
<div class="sub-block" id="formacion">
<h3 class="sub-h">Formación</h3>
<ul class="training">{train}</ul>
</div>
</div>
</section>

{method(G['method'], num='04', modes=G['modes'])}
{faq(G['faq'], ld, '05')}
{bridge(G['bridge'], 'inteligencia-artificial.html', IA)}
{contact(G['contact'], 'gastronomia', services, '06', GAS['label'])}

<section class="sec jobs" id="trabaja-conmigo" aria-labelledby="jobs-t">
<div class="wrap jobs-in">
<div>{sec_head(J['label'], esc(J['h2']), esc(J['p']), h2_id='jobs-t', cls='sec-head-sm')}<p class="note">{esc(J['help'])}</p></div>
<div class="jobs-act"><a class="btn ghost" href="{esc(J['mailto'])}"><span>Enviá tu CV</span> {ARR}</a><a class="mail-s" href="mailto:{RRHH_EMAIL}">{RRHH_EMAIL}</a></div>
</div>
</section>
</main>
{footer('gastronomia')}
{wa_float(GAS['label'])}
{dock('gastronomia')}
{scripts(['gsap', 'st', 'split', 'lenis'], 'gastronomia')}
</body>
</html>"""
    write('gastronomia.html', head(page) + '\n' + body)


# ======================================================================= automatización e IA

LEGACY_IA = """<script>
(function (l) {
  var map = {'#publicaciones': 'publicaciones.html#doctrina', '#dossier': 'publicaciones.html#dossier', '#medios': 'publicaciones.html#medios', '#novedades': 'publicaciones.html'};
  if (map[l.hash]) l.replace(map[l.hash]);
})(location);
</script>
"""


def demo():
    """Demostración ficticia: un pedido recorre cinco etapas; cada una explica qué hace la tecnología y qué decide la persona."""
    D, S = DEMO, DEMO['sample']
    tabs = ''.join(f'<button class="dr" type="button" role="tab" id="dt-{s["k"]}" aria-controls="dp-{s["k"]}" aria-selected="{"true" if i == 0 else "false"}"'
                   f'{"" if i == 0 else " tabindex=\"-1\""} data-i="{i + 1}"><span class="dr-n">{i + 1:02d}</span><span class="dr-t">{esc(s["name"])}</span></button>'
                   for i, s in enumerate(D['stages']))
    panels = []
    for i, s in enumerate(D['stages']):
        extra = ''
        if s['k'] == 'decision':
            extra = ('<div class="dp-act" role="group" aria-label="Probá la decisión">'
                     '<button class="btn btn-sm" type="button" data-decide="ok"><span>Aprobar el pedido</span></button>'
                     '<button class="btn ghost btn-sm" type="button" data-decide="adj"><span>Ajustar el aceite a 3 L</span></button></div>'
                     '<p class="dp-res" role="status" data-decision></p>')
        panels.append(f"""<div class="dp" role="tabpanel" id="dp-{s['k']}" aria-labelledby="dt-{s['k']}"{'' if i == 0 else ' hidden'}>
<h3 class="dp-t">{esc(s['h3'])}</h3>
<p class="dp-w">{esc(s['what'])}</p>
<dl class="dp-dl">
<div><dt>Sin automatización</dt><dd>{esc(s['before'])}</dd></div>
<div><dt>Con automatización</dt><dd>{esc(s['after'])}</dd></div>
<div class="dp-h"><dt>Qué hace la persona</dt><dd>{esc(s['human'])}</dd></div>
</dl>{extra}
</div>""")
    rows = ''.join(f'<li class="dv-row" data-st="{st}" style="--i:{j}"><span class="dv-p">{esc(p)}</span><span class="dv-q">{esc(q)}</span>'
                   f'<span class="dv-s"><i aria-hidden="true"></i><span>{esc(note)}</span></span></li>' for j, (p, q, st, note) in enumerate(S['rows']))
    stage = f"""<div class="dv" aria-hidden="true">
<div class="dv-msg"><p class="dv-from"><b>{esc(S['from'])}</b> · {esc(S['channel'])}<span>{esc(S['time'])}</span></p><p class="dv-text">{esc(S['msg'])}</p></div>
<div class="dv-sheet">
<p class="dv-cap"><b>{esc(S['id'])}</b><span>{esc(S['from'])} · entrega {esc(S['delivery'])}</span></p>
<ul class="dv-rows">{rows}</ul>
</div>
<div class="dv-report"><p class="dv-cap"><b>Resumen para el responsable</b><span>3 productos · 1 alerta</span></p>
<p class="dv-alert">Aceite: el pedido duplica el consumo habitual de la sucursal.</p>
<div class="dv-bars"><span style="--h:.42"></span><span style="--h:.48"></span><span style="--h:.4"></span><span style="--h:.46"></span><span class="hi" style="--h:.92"></span></div>
<p class="dv-fine">Consumo semanal de aceite · últimas 5 semanas</p></div>
<div class="dv-log"><span class="dv-dot"></span><span data-log>Pendiente de decisión</span></div>
</div>"""
    return f"""<section class="sec demo-sec" id="{D['id']}" aria-labelledby="{D['id']}-t">
<span class="anchor" id="aplicaciones" aria-hidden="true"></span><span class="anchor" id="flujo" aria-hidden="true"></span>
<div class="wrap">
<div class="sec-top">{sec_head(D['label'], D['h2'], esc(D['intro']), h2_id=D['id'] + '-t', num='02')}<p class="badge">{esc(D['badge'])}</p></div>
<div class="demo" data-demo data-stage="1">
<div class="demo-rail" role="tablist" aria-label="Etapas de la automatización">{tabs}<span class="dr-line" aria-hidden="true"><i></i></span></div>
<div class="demo-body">
<div class="demo-vis">{stage}</div>
<div class="demo-panels">{''.join(panels)}</div>
</div>
<div class="demo-ctrl"><button class="demo-play" type="button" data-demo-play aria-pressed="false"><span class="dp-ico" aria-hidden="true"></span><span class="dp-lab">Reproducir el recorrido</span></button><p class="note">{esc(D['note'])}</p></div>
</div>
</div>
</section>"""


def cases(K, num):
    items = ''.join(f"""<article class="case" data-rv>
<p class="case-k">{esc(c['k'])}</p>
<h3 class="case-t">{esc(c['h3'])}</h3>
<dl class="case-dl">
<div><dt>Necesidad</dt><dd>{esc(c['need'])}</dd></div>
<div><dt>Qué se automatizó</dt><dd>{esc(c['how'])}</dd></div>
<div><dt>Qué cambió</dt><dd>{esc(c['result'])}</dd></div>
</dl>
<p class="case-tags">{'<i aria-hidden="true">·</i>'.join(f'<span>{esc(t)}</span>' for t in c['tags'])}</p>
</article>""" for c in K['items'])
    return f"""<section class="sec cases light" id="{K['id']}" aria-labelledby="{K['id']}-t">
<div class="wrap">
{sec_head(K['label'], K['h2'], esc(K['intro']), h2_id=K['id'] + '-t', num=num)}
<div class="case-grid">{items}</div>
<p class="note">{esc(K['note'])}</p>
</div>
</section>"""


def depts():
    D = DEPTS
    TI = ' tabindex="-1"'
    tabs = ''.join(f'<button class="tab" type="button" role="tab" id="tab-{t["k"]}" aria-controls="pan-{t["k"]}" aria-selected="{"true" if i == 0 else "false"}"{"" if i == 0 else TI}>'
                   f'<span class="tab-n">{i + 1:02d}</span>{esc(t["name"])}</button>' for i, t in enumerate(D['tabs']))
    pans = []
    for i, t in enumerate(D['tabs']):
        det = ''.join(f'<div class="si-d"><h4>{esc(h)}</h4><p>{esc(p)}</p><p class="si-out"><b>Entregables</b> {esc(o)}</p></div>' for h, p, o in t['detail'])
        more = f'<details class="tp-more"><summary><span>Qué incluye</span><i aria-hidden="true"></i></summary><div class="tp-more-in">{det}</div></details>' if det else ''
        ex_k = 'Caso real' if t.get('real') else 'Ejemplo de aplicación'
        ex_link = f'<a class="tlink" href="#casos"><span>Ver los casos reales</span> {ARR}</a>' if t.get('real') else ''
        pans.append(f"""<div class="tabpanel" role="tabpanel" id="pan-{t['k']}" aria-labelledby="tab-{t['k']}"{'' if i == 0 else ' hidden'}>
<div class="tp-l">
<h3 class="tp-t">{esc(t['name'])}</h3>
<p class="tp-s">{esc(t['need'])}</p>
<ul class="tp-list">{''.join(f'<li>{esc(_s(x))}</li>' for x in t['services'])}</ul>
{more}
</div>
<div class="tp-r">
<div class="tp-ex"><p class="tp-k">{ex_k}</p><h4>{esc(t['example'][0])}</h4><p>{esc(t['example'][1])}</p>{ex_link}</div>
<a class="btn ghost" href="#contacto" data-prefill="area:{esc(t['form'])}"><span>Evaluar {esc(t['name'])}</span> {ARR}</a>
</div>
</div>""")
    X = D['transversal']
    xdet = X['detail']
    return f"""<section class="sec depts" id="{D['id']}" aria-labelledby="{D['id']}-t">
<span class="anchor" id="departamentos" aria-hidden="true"></span>
<div class="wrap">
{sec_head(D['label'], D['h2'], esc(D['intro']), h2_id=D['id'] + '-t', num='04')}
<div class="tabs" data-tabs>
<div class="tablist" role="tablist" aria-label="Áreas de la empresa">{tabs}</div>
<div class="tabpanels">{''.join(pans)}</div>
</div>
<div class="transv" data-rv>
<p class="label">{esc(X['h'])}</p>
<ul class="tv-list">{''.join(f'<li>{esc(_s(x))}</li>' for x in X['services'])}</ul>
<p class="tv-d"><b>{esc(xdet[0])}.</b> {esc(xdet[1])}</p>
</div>
<p class="note">{esc(D['note'])}</p>
</div>
</section>"""


def ia():
    I = IA_PAGE
    ld = [{'@type': 'Service', 'name': 'Automatización e inteligencia artificial para empresas', 'serviceType': 'Consultoría en automatización e inteligencia artificial',
           'provider': {'@id': SITE + '/#ezequiel'}, 'areaServed': 'AR', 'url': SITE + IA['path'], 'description': IA['subtitle'],
           'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Soluciones de automatización e IA',
                               'itemListElement': [{'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': _s(s)}} for s in IA['services']]}},
          {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE + '/'},
                                                          {'@type': 'ListItem', 'position': 2, 'name': 'Automatización e inteligencia artificial', 'item': SITE + IA['path']}]}]
    page = {'file': 'inteligencia-artificial.html', 'path': IA['path'], 'area': 'automatizacion', 'css': 'areas',
            'title': 'Automatización e inteligencia artificial para empresas | Ezequiel Brunner',
            'og_title': 'Automatización & Inteligencia Artificial | Ezequiel Brunner',
            'desc': 'Automatización de procesos, agentes y asistentes con IA, chatbots de WhatsApp, integraciones por API, dashboards y reportes para empresas de cualquier sector. Ezequiel Brunner, Mar del Plata.',
            'og': 'assets/og/automatizacion.jpg', 'boot': REMEMBER % 'automatizacion', 'pre_head': LEGACY_IA, 'ld': ld}
    nav = [('#demo', 'Demostración'), ('#casos', 'Casos'), ('#servicios', 'Servicios'), ('#metodo', 'Proceso'), ('#investigacion', 'IA y Derecho')]
    V_ = I['value']
    principles = ''.join(f'<li class="pc" data-rv><span class="pc-n">{i + 1:02d}</span><h3>{esc(h)}</h3><p>{esc(p)}</p></li>' for i, (h, p) in enumerate(V_['principles']))
    R = I['research']
    keydocs = ''.join(pub_row(d, desc=False) for d in [doc_by('Transparencia algorítmica como garantía'), doc_by('Algorithmic Transparency'),
                                                       doc_by('Cuando explicar no alcanza'), doc_by('Resolución 9/2025')])
    about = ''.join(f'<div class="cb"><h4 class="h4">{esc(h)}</h4><p>{esc(p)}</p></div>' for h, p in R['about'])
    train = ''.join(f'<li><span class="tr-k">{esc(k)}</span><span class="tr-t">{esc(t)}</span>{f"<span class=tr-d>{esc(d)}</span>" if d else ""}</li>' for k, t, d in R['training'])
    dz = P['dossier']
    services = [t['form'] for t in DEPTS['tabs']]

    body = f"""<body class="pg-area pg-ia">
{header('automatizacion', nav)}
{menu('automatizacion', nav)}
<main id="contenido">
{hero(IA, I)}

<section class="sec value" id="soluciones" aria-labelledby="soluciones-t">
<div class="wrap">
<div class="value-grid">
<div class="value-l">
<p class="label"><span class="lab-n">01</span>{esc(V_['label'])}</p>
<h2 class="h2 h2-xl" id="soluciones-t">{V_['h2']}</h2>
</div>
<div class="value-r">
<p class="lead">{esc(V_['lead'])}</p>
<blockquote class="vq"><p>{esc(V_['quote'])}</p></blockquote>
<div class="prose">{''.join(f'<p>{esc(p)}</p>' for p in V_['paras'])}</div>
</div>
</div>
<ul class="principles">{principles}</ul>
</div>
</section>

{demo()}
{cases(I['cases'], '03')}
{depts()}
{method(I['method'], num='05', modes=I['modes'])}

<section class="sec research" id="investigacion" aria-labelledby="investigacion-t">
<div class="wrap">
<div class="research-top">
{sec_head(R['label'], R['h2'], esc(R['intro']), h2_id='investigacion-t', num='06')}
<a class="dossier-mini lit" href="{esc(dz['href'])}" target="_blank" rel="noopener noreferrer">
<span class="label">Biblioteca del Congreso de la Nación</span>
<span class="dm-t">{esc(dz['h2'])}</span>
<span class="dm-p">{esc(dz['paras'][0] if dz['paras'] else '')}</span>
<span class="pb-go">{esc(dz['link'])} {EXT}</span>
</a>
</div>
<ul class="plist plist-wide">{keydocs}</ul>
<div class="row-links">{tlink('Ver todas las publicaciones', 'publicaciones.html')}</div>
<div class="research-about" id="sobre-mi">
<div class="ra-l"><p class="label">{esc(R['about_h'])}</p><h3 class="h3 h3-l">{esc(R['about_h2'])}</h3></div>
<div class="ra-r">{about}</div>
</div>
<div class="sub-block" id="formacion">
<h3 class="sub-h">Formación</h3>
<ul class="training">{train}</ul>
</div>
</div>
</section>

{faq(I['faq'], ld, '07')}
{bridge(I['bridge'], 'gastronomia.html', GAS)}
{contact(I['contact'], 'automatizacion', services, '08', IA['label'])}
</main>
{footer('automatizacion')}
{wa_float(IA['label'])}
{dock('automatizacion')}
{scripts(['gsap', 'st', 'split', 'lenis'], 'lines', 'ia')}
</body>
</html>"""
    write('inteligencia-artificial.html', head(page) + '\n' + body)


# ======================================================================= publicaciones

def publicaciones():
    doct = DOCT
    authored = [m for m in P['medios'] if m['authored']]
    coverage = [dict(m, kind='Redes' if m['outlet'] == 'Instagram' else m['kind']) for m in P['medios'] if not m['authored']]
    dz = P['dossier']
    counts = [(len(doct) + 1, 'doctrina, investigación y dossier'), (len(authored), 'artículos de autor y cartas'), (len(coverage) + len(P['gastro']), 'notas y menciones en medios')]
    page = {'file': 'publicaciones.html', 'path': '/publicaciones', 'area': None, 'css': 'publicaciones',
            'title': 'Publicaciones, doctrina y prensa | Ezequiel Brunner',
            'desc': 'Doctrina publicada en SAIJ, investigación en SSRN, el Dossier Legislativo n.º 335 de la Biblioteca del Congreso, artículos de autor y notas en medios de Ezequiel Brunner.',
            'og': 'assets/og/publicaciones.jpg',
            'pre_head': "<script>if (location.hash === '#notas') { try { history.replaceState(null, '', location.pathname); } catch (e) {} }</script>\n",
            'ld': [{'@type': 'CollectionPage', 'name': 'Publicaciones de Ezequiel Brunner', 'url': SITE + '/publicaciones', 'about': {'@id': SITE + '/#ezequiel'}},
                   {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE + '/'},
                                                                   {'@type': 'ListItem', 'position': 2, 'name': 'Publicaciones', 'item': SITE + '/publicaciones'}]}]}
    nav = [('#doctrina', 'Doctrina'), ('#articulos', 'Artículos'), ('#medios', 'Medios'), ('gastronomia.html', 'Gastronomía'), ('inteligencia-artificial.html', 'Automatización & IA')]
    chips = [('todo', 'Todo', len(doct) + 1 + len(authored) + len(coverage) + len(P['gastro'])), ('doctrina', 'Doctrina e investigación', len(doct) + 1),
             ('articulos', 'Artículos y cartas', len(authored)), ('medios', 'En los medios', len(coverage)), ('prensa-gastronomia', 'Gastronomía', len(P['gastro']))]
    chip_html = ''.join(f'<button class="chip" type="button" data-filter="{k}" aria-pressed="{"true" if k == "todo" else "false"}">{esc(t)}<span class="chip-n">{n}</span></button>' for k, t, n in chips)
    lead = [doc_by('Transparencia algorítmica como garantía'), doc_by('Algorithmic Transparency'), doc_by('Inteligencia Artificial y Derecho')]
    rest = [d for d in doct if d not in lead]

    def block(sid, label, h2, items, intro='', num=''):
        return f"""<section class="sec p-sec" id="{sid}" data-group="{sid}" aria-labelledby="{sid}-t">
<div class="wrap">
<div class="sec-top">{sec_head(label, h2, intro, h2_id=sid + '-t', num=num)}<p class="p-count" aria-label="{len(items)} publicaciones">{len(items):02d}</p></div>
<ol class="plist plist-lib">{''.join(pub_row(i) for i in items)}</ol>
</div>
</section>"""

    feat_cards = ''.join(f"""<li class="fc" data-rv><a href="{esc(d['href'])}" target="_blank" rel="noopener noreferrer">
<span class="fc-k">{esc(d['outlet'])}{(' · ' + esc(d['human_date'])) if d['human_date'] else ''}</span>
{f'<span class="pb-tag">{esc(d["tag"])}</span>' if d.get('tag') else ''}
<h3 class="fc-t">{esc(d['title'])}</h3>
<span class="pb-go">{esc(d['link'])} {EXT}</span></a></li>""" for d in lead)

    body = f"""<body class="pg-pubs">
{header(None, nav, cta=('Contacto', '#contacto'))}
{menu(None, nav, cta=('Contacto', '#contacto'))}
<main id="contenido">
<section class="p-hero" aria-labelledby="ph-t">
<div class="wrap">
<p class="label" data-in="1">Publicaciones</p>
<h1 class="pubs-title" id="ph-t"><span class="ln" style="--l:0"><span>Doctrina, investigación</span></span><span class="ln" style="--l:1"><span><em>y prensa.</em></span></span></h1>
<div class="p-hero-row" data-in="3">
<p class="lead">{esc(P['heads']['doctrina']['intro'])} {esc(P['heads']['medios']['h2'])}.</p>
<ul class="p-counts">{''.join(f'<li><span class="pc-n">{n:02d}</span><span>{esc(t)}</span></li>' for n, t in counts)}</ul>
</div>
</div>
</section>

<div class="pfilter" data-pfilter>
<div class="wrap"><div class="chips" role="group" aria-label="Filtrar publicaciones">{chip_html}</div></div>
</div>

<section class="sec p-sec p-feat" id="destacados" data-group="doctrina" aria-labelledby="feat-t">
<div class="wrap">
<h2 class="sr" id="feat-t">Trabajos destacados</h2>
<div class="feat-grid">
<a class="dossier-card" id="dossier" href="{esc(dz['href'])}" target="_blank" rel="noopener noreferrer" data-rv>
<span class="dc-mark" aria-hidden="true">335</span>
<span class="label">{esc(dz['eyebrow'])}</span>
<span class="dc-t">{esc(dz['h2'])}</span>
<span class="dc-m">{esc(dz['meta'])} · {esc(dz['title'])}</span>
<span class="dc-p">{esc(' '.join(dz['paras']))}</span>
<span class="pb-go">{esc(dz['link'])} {EXT}</span>
</a>
<ol class="feat-list">{feat_cards}</ol>
</div>
</div>
</section>

{block('doctrina', 'Doctrina e investigación', 'Doctrina y trabajos <em>publicados.</em>', rest, 'Publicaciones jurídicas en SAIJ sobre transparencia algorítmica y Derecho Laboral, además de los trabajos destacados.', '01')}
{block('articulos', 'Artículos de autor y cartas', 'Opinión con <em>firma propia.</em>', authored, 'Artículos de autor y cartas publicadas en medios de Argentina, Chile y España.', '02')}
{block('medios', P['heads']['medios']['eyebrow'], 'Medios, menciones <em>y reconocimientos.</em>', coverage, '', '03')}
{block('prensa-gastronomia', 'Gastronomía en los medios', 'Operación gastronómica <em>en la prensa.</em>', P['gastro'], '', '04')}

<section class="sec pubs-cta" id="contacto" aria-labelledby="pcta-t">
<div class="wrap hc-grid">
<div>{sec_head('Contacto', '¿Por dónde <em>empezamos?</em>', 'Elegí el área de tu consulta.', h2_id='pcta-t')}{direct_contact(PERSON['place'])}</div>
<div class="choices">
<a class="choice lit" href="gastronomia.html#contacto" data-go-area="gastronomia"><span class="ch-k">01 · Gastronomía</span><span class="ch-h">{esc(GAS['cta'])}</span><span class="ch-d">Restaurantes, cafeterías, cadenas y franquicias.</span>{ARR}</a>
<a class="choice lit" href="inteligencia-artificial.html#contacto" data-go-area="automatizacion"><span class="ch-k">02 · Automatización &amp; IA</span><span class="ch-h">{esc(IA['cta'])}</span><span class="ch-d">Empresas de cualquier sector.</span>{ARR}</a>
</div>
</div>
</section>
</main>
{footer()}
{wa_float('Publicaciones')}
{scripts(['gsap', 'split', 'lenis'])}
</body>
</html>"""
    write('publicaciones.html', head(page) + '\n' + body)


def notfound():
    page = {'file': '404.html', 'path': '/404', 'area': None, 'root': '/', 'title': 'Página no encontrada | Ezequiel Brunner',
            'desc': 'La página que buscás no existe o cambió de lugar.', 'og': 'assets/og/inicio.jpg'}
    body = f"""<body class="pg-404">
<main id="contenido" class="nf">
<div class="wrap">
<p class="label"><span class="lab-n">404</span>Página no encontrada</p>
<h1 class="pubs-title">Esta página <em>cambió de lugar.</em></h1>
<p class="lead">Elegí un área para seguir.</p>
<div class="nf-act">{btn('Asesoramiento gastronómico', '/gastronomia')}{btn('Automatización & IA', '/inteligencia-artificial', ghost=True)}{tlink('Publicaciones', '/publicaciones')}</div>
</div>
</main>
</body>
</html>"""
    html = head(page).replace('<link rel="canonical" href="https://ezequielbrunner.com/404">\n', '<meta name="robots" content="noindex">\n')
    write('404.html', html + '\n' + body)


if __name__ == '__main__':
    home()
    gastronomia()
    ia()
    publicaciones()
    notfound()
