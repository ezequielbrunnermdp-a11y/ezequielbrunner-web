"""Genera index.html, gastronomia.html, inteligencia-artificial.html, publicaciones.html y 404.html.

Uso:  python3 tools/sitegen/build.py      (escribe las páginas en la raíz del repositorio)
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import (ROOT, SITE, EMAIL, LINKEDIN, ABOUTME, RRHH_EMAIL, GAS, IA, GAS_PAGE, IA_PAGE, PERSON, HOME, ABOUT,
                     AXES, DEMO, DEPTS, publications, esc, _s)
from tpl import (head, header, menu, subnav, dock, footer, scripts, sec_head, btn, tlink, form, direct_contact, pub_row,
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


def field_canvas(cls, t, mode, sizes='100vw'):
    """Relieve de líneas con red de nodos (assets/js/lines.js). Debajo, una imagen fija del mismo dibujo:
    se ve al instante, sin JavaScript y con movimiento reducido, hasta que el lienzo está listo."""
    poster = pic('lineas', cls='pm-poster', sizes=sizes, prio=True)
    return f'<div class="{cls} pm-lines" aria-hidden="true">{poster}<canvas data-lines data-t="{t}" data-mode="{mode}"></canvas></div>'


def title_lines(a, key='title_lines'):
    # las líneas van separadas por un espacio: no se ve (son bloques), pero el texto queda «línea uno línea dos»
    return ' '.join(f'<span class="ln" style="--l:{i}"><span>{t}</span></span>' for i, t in enumerate(a[key]))


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


SCENE_ALT = ('Ilustración animada: la maqueta de una operación gastronómica (depósito, cocina, barra, salón y caja) con su capa de información. '
             'Los datos suben desde cada sector, se procesan y, cuando algo se desvía, la alerta llega a la persona que decide.')


def path_link(k):
    """Acceso a una especialidad: número, título, propósito y flecha. Al acercarse, la escena cambia de luz."""
    D = HOME['doors'][k]
    a = GAS if k == 'gastronomia' else IA
    t = D['title'] if k == 'gastronomia' else D['title_m']
    return (f'<a class="path path-{k}" id="door-{k}" href="{a["href"]}" data-go="{k}">'
            f'<span class="path-k" aria-hidden="true">{D["k"]}</span><span class="path-t">{t}</span>'
            f'<span class="path-s">{esc(D["sub"])}</span><span class="path-go" aria-hidden="true">→</span>'
            f'<span class="path-last" aria-hidden="true">Tu última visita</span></a>')


def firma():
    """Firma discreta: el retrato pequeño, en blanco y negro, junto al nombre y la ciudad
    (imagen generada por tools/imagenes/firma-retrato.py)."""
    return ('<figure class="firma">'
            f'<span class="firma-ph">{pic("retrato-firma", alt="Retrato de Ezequiel Brunner", sizes="84px", lazy=True, w=192, h=192, widths=(96, 192))}</span>'
            '<figcaption><span class="firma-n">Ezequiel Brunner</span><span class="firma-m">Mar del Plata · Argentina</span></figcaption></figure>')


def home():
    page = {'file': 'index.html', 'path': '/', 'area': None, 'css': 'home',
            'title': 'Ezequiel Brunner · Operaciones reales. Tecnología que resuelve.',
            'desc': 'Dirección gastronómica, optimización de procesos y automatización inteligente. Asesoramiento gastronómico y automatización con inteligencia artificial para empresas. Ezequiel Brunner, Mar del Plata.',
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
    npubs = len(DOCT) + 1 + len(P['medios']) + len(P['gastro'])
    c0, c1 = HOME['claim']
    chapters = ''.join(f'<li class="ch" data-rv><span class="ch-n">{n}</span><h3 class="ch-t">{esc(t)}</h3><p>{esc(p)}</p></li>' for n, t, p in ABOUT['chapters'])
    C = GAS_PAGE['career']
    facts = [('15', '+', 'años en operaciones gastronómicas, liderazgo de equipos y gestión de servicios'),
             ('135', '', 'personas en equipos para eventos de gran escala'),
             (str(npubs), '', 'publicaciones y apariciones en medios, con sus enlaces originales')]
    facts_html = ''.join(f'<li><span class="fact-n"><span class="count" data-to="{n}">{n}</span>{s_}</span><span class="fact-l">{esc(l)}</span></li>' for n, s_, l in facts)

    body = f"""<body class="pg-home">
{header('inicio')}
{menu('inicio')}
<main id="contenido">
<section class="stage" id="elegir" aria-labelledby="stage-t" data-stage>
<span class="anchor" id="inicio" aria-hidden="true"></span>
<div class="stage-3d"><canvas data-scene aria-hidden="true"></canvas><p class="sr">{esc(SCENE_ALT)}</p></div>
<div class="stage-shade" aria-hidden="true"></div>
<div class="wrap stage-in">
<p class="label stage-label">Consultoría · Mar del Plata, Argentina</p>
<h1 class="stage-name" id="stage-t"><span class="sn sn-a">{esc(HOME['name'][0])}</span> <span class="sn sn-b">{esc(HOME['name'][1])}</span></h1>
<p class="stage-claim"><span class="ln" style="--l:0"><span>{esc(c0)}</span></span> <span class="ln" style="--l:1"><span><em>{esc(c1)}</em></span></span></p>
<p class="stage-sub">{esc(HOME['sub'])}</p>
<nav class="paths" aria-label="Especialidades">{path_link('gastronomia')}{path_link('automatizacion')}</nav>
<p class="stage-proof">15+ años en operaciones gastronómicas · Doctrina en SAIJ · Automatizaciones propias en uso</p>
</div>
<ul class="legend" aria-hidden="true"><li class="lg-op">Operación</li> <li class="lg-in">Información</li> <li class="lg-de">Decisión humana</li></ul>
<a class="stage-down" href="#sobre-mi"><span class="sr">Bajar a Quién soy</span><span aria-hidden="true"></span></a>
</section>

<section class="sec who" id="sobre-mi" aria-labelledby="about-t">
<div class="wrap who-grid">
<div class="who-head">
<p class="label">Quién soy</p>
<h2 class="h2 h2-xl" id="about-t">{ABOUT['h2']}</h2>
{firma()}
</div>
<div class="who-copy">
<p class="manifesto">{ABOUT['manifesto']}</p>
<ol class="chapters">{chapters}</ol>
</div>
</div>
</section>

<section class="sec home-career amb amb-warm" id="trayectoria" aria-labelledby="hcar-t">
<div class="wrap">
<div class="sec-top">{sec_head('Trayectoria', 'Experiencia que se puede <em>comprobar.</em>', esc(C['intro']), h2_id='hcar-t')}
{btn('Ver la trayectoria completa', 'trayectoria.html', ghost=True)}</div>
<ul class="facts">{facts_html}</ul>
</div>
</section>

<section class="sec home-pubs amb amb-cool" id="publicaciones" aria-labelledby="hp-t">
<div class="wrap">
<div class="sec-top">{sec_head('Producción académica', 'Doctrina, investigación <em>y prensa.</em>', esc(P['heads']['doctrina']['intro']), h2_id='hp-t')}
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
{scripts(['gsap', 'split', 'lenis'], 'scene', 'home')}
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
<div class="hero-row hero-glass">
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
    amb = 'amb-warm' if kind == 'gastronomia' else 'amb-cool'
    return f"""<section class="sec contact amb {amb}" id="contacto" aria-labelledby="contacto-t">
<div class="wrap contact-grid">
<div class="contact-l">
{sec_head(c['label'], c['h2'], esc(c['p']), h2_id='contacto-t', num=num)}
{direct_contact(c['place'], context)}
</div>
<div class="contact-r">{form(kind, services)}</div>
</div>
</section>"""


# ======================================================================= gastronomía

# ======================================================================= gastronomía: los siete ejes

def axis_vis(kind):
    """Visual de cada eje: foto real, diagrama o una calculadora. Sin cifras inventadas."""
    if kind == 'photo-team':
        return f'<figure class="ax-photo">{pic("equipo", alt=TEAM_ALT, sizes="(max-width: 900px) 100vw, 44vw", lazy=True)}<figcaption>{esc(TEAM_ALT)}.</figcaption></figure>'
    if kind == 'photo-ops':
        steps = ['Planificar', 'Coordinar', 'Controlar', 'Decidir']
        items = ''.join(f'<li style="--i:{i}"><span class="cy-n">{i + 1:02d}</span><span class="cy-t">{t}</span></li>' for i, t in enumerate(steps))
        return (f'<div class="ax-vis ax-cycle" aria-label="Ciclo de gestión: planificar, coordinar, controlar y decidir">'
                f'<svg class="cy-ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><circle cx="100" cy="100" r="84" pathLength="1"/></svg>'
                f'<ol>{items}</ol><p class="cy-c">Gestión diaria</p></div>')
    if kind == 'units':
        return ('<div class="ax-vis ax-units" aria-label="Varias unidades conectadas a un tablero común: pedidos, stock, ventas y personal">'
                '<svg viewBox="0 0 360 230" aria-hidden="true" focusable="false">'
                '<path class="u-l" pathLength="1" d="M64 168 C64 120 180 128 180 74"/><path class="u-l" pathLength="1" d="M180 168 L180 74"/><path class="u-l" pathLength="1" d="M296 168 C296 120 180 128 180 74"/>'
                '<rect class="u-hub" x="112" y="26" width="136" height="48" rx="10"/><text class="u-ht" x="180" y="56">Tablero común</text>'
                '<rect class="u-box" x="16" y="168" width="96" height="44" rx="9"/><text x="64" y="195">Local 1</text>'
                '<rect class="u-box" x="132" y="168" width="96" height="44" rx="9"/><text x="180" y="195">Local 2</text>'
                '<rect class="u-box" x="248" y="168" width="96" height="44" rx="9"/><text x="296" y="195">Producción</text>'
                '</svg><ul class="u-ind"><li>Pedidos</li><li>Stock</li><li>Ventas</li><li>Personal</li></ul></div>')
    if kind == 'flow':
        steps = ['Apertura', 'Servicio', 'Cierre', 'Registro']
        items = ''.join(f'<li style="--i:{i}"><span class="fl-n">{i + 1:02d}</span><span class="fl-t">{t}</span></li>' for i, t in enumerate(steps))
        return f'<div class="ax-vis ax-flow" aria-label="Rutina de cada turno: apertura, servicio, cierre y registro"><ol>{items}</ol><span class="fl-line" aria-hidden="true"><i></i></span><p class="ax-cap">Qué se hace, quién lo hace, cuándo y cómo se controla.</p></div>'
    if kind == 'journey':
        steps = ['Llegada', 'Recepción', 'Pedido', 'Servicio', 'Pago', 'Regreso']
        items = ''.join(f'<li style="--i:{i}"><span class="jr-d" aria-hidden="true"></span><span class="jr-t">{t}</span></li>' for i, t in enumerate(steps))
        return f'<div class="ax-vis ax-journey" aria-label="Recorrido del cliente: llegada, recepción, pedido, servicio, pago y regreso"><ol>{items}</ol><p class="ax-cap">Cada punto del recorrido es una oportunidad de servicio.</p></div>'
    if kind == 'opening':
        steps = ['Concepto y plan', 'Estructura y equipo', 'Proveedores y compras', 'Sistemas y procedimientos', 'Prueba de servicio', 'Apertura y seguimiento']
        items = ''.join(f'<li style="--i:{i}"><span class="op-c" aria-hidden="true"></span><span class="op-t">{t}</span></li>' for i, t in enumerate(steps))
        return f'<div class="ax-vis ax-opening" aria-label="Plan de apertura en seis pasos"><ol>{items}</ol></div>'
    if kind == 'calc':
        return ('<div class="ax-vis ax-calc">'
                '<form class="calc" data-calc novalidate onsubmit="return false">'
                '<p class="calc-h">Probalo: costo de un plato</p>'
                '<div class="calc-in">'
                '<label class="calc-f"><span>Precio de venta</span><span class="calc-i"><b aria-hidden="true">$</b><input type="number" inputmode="decimal" min="0" step="any" value="12000" data-price></span></label>'
                '<label class="calc-f"><span>Costo de los ingredientes</span><span class="calc-i"><b aria-hidden="true">$</b><input type="number" inputmode="decimal" min="0" step="any" value="3600" data-cost></span></label>'
                '<label class="calc-c"><input type="checkbox" checked data-iva><span>El precio incluye IVA (21 %)</span></label>'
                '</div>'
                '<div class="calc-out" aria-live="polite">'
                '<p><span class="co-k">Costo sobre la venta</span><output class="co-v" data-pct>36 %</output></p>'
                '<p><span class="co-k">Margen bruto por plato</span><output class="co-v" data-margin>$ 6.317</output></p>'
                '<span class="co-bar" aria-hidden="true"><i data-bar style="--p:.36"></i></span>'
                '</div>'
                '<p class="calc-note">Ejemplo con datos que podés cambiar. El costo se calcula sobre el precio sin IVA; el porcentaje adecuado depende de cada negocio.</p>'
                '</form>'
                '<p class="cmv" aria-label="Inventario inicial más compras menos inventario final es igual al costo de mercadería vendida"><span>Inventario inicial</span><span>+ Compras</span><span>− Inventario final</span><span class="cmv-r">= CMV</span></p>'
                '</div>')
    return ''


def axes():
    A = AXES
    idx = ''.join(f'<li><a href="#eje-{x["k"]}" data-ax="{x["k"]}"><span class="axi-n">{i + 1:02d}</span><span class="axi-t">{esc(x["name"])}</span></a></li>' for i, x in enumerate(A['items']))
    arts = []
    for i, x in enumerate(A['items']):
        anchors = ''.join(f'<span class="anchor" id="{a}" aria-hidden="true"></span>' for a in x.get('anchors', []))
        li = ''.join(f'<li>{esc(_s(t))}</li>' for t in x['li'])
        fact = f'<p class="ax-fact"><span class="label">Experiencia</span>{esc(x["fact"])}</p>' if x.get('fact') else ''
        scope = f'<p class="note ax-scope">{esc(x["scope"])}</p>' if x.get('scope') else ''
        arts.append(f"""<article class="ax ax-{x['k']}" id="eje-{x['k']}" data-ax="{x['k']}" aria-labelledby="ax-{x['k']}-t">{anchors}
<div class="ax-copy">
<p class="ax-n"><span>{i + 1:02d}</span>{esc(x['name'])}</p>
<h3 class="ax-t" id="ax-{x['k']}-t">{esc(x['h3'])}</h3>
<p class="ax-p">{esc(x['p'])}</p>
<div class="ax-inc"><p class="label">Qué incluye</p><ul class="ticks">{li}</ul></div>
<p class="ax-out"><b>Entregables</b> {esc(x['out'])}</p>
{fact}{scope}
<a class="tlink" href="#contacto" data-prefill="servicio:{esc(x['form'])}"><span>Consultar por este tema</span> {ARR}</a>
</div>
{axis_vis(x['vis'])}
</article>""")
    return f"""<section class="axes" id="{A['id']}" aria-labelledby="axes-t" data-axes>
<span class="anchor" id="servicios" aria-hidden="true"></span><span class="anchor" id="propuesta" aria-hidden="true"></span>
<div class="wrap">
<div class="axes-head">
<p class="label"><span class="lab-n">01</span>{esc(A['label'])}</p>
<h2 class="axes-h2" id="axes-t">{A['h2']}</h2>
<p class="intro">{esc(A['intro'])}</p>
</div>
<div class="axes-grid">
<nav class="axes-idx" aria-label="Los siete ejes"><ol>{idx}</ol><span class="axi-line" aria-hidden="true"><i></i></span></nav>
<div class="axes-list">{''.join(arts)}</div>
</div>
<div class="axes-close"><p class="nar-cl">{A['close']}</p>{btn(GAS['cta'], '#contacto')}</div>
</div>
</section>"""



LEGACY_GAS = """<script>
/* Enlaces viejos: la formación vive ahora en la página de trayectoria. */
(function (l) { var map = {'#formacion': 'trayectoria.html#formacion'}; if (map[l.hash]) l.replace(map[l.hash]); })(location);
</script>
"""


PROB_AXIS = {'costos': 'costos', 'equipos': 'equipos', 'diagnostico': 'direccion', 'procesos': 'sucursales'}


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
            'og': 'assets/og/gastronomia.jpg', 'boot': REMEMBER % 'gastronomia', 'pre_head': LEGACY_GAS, 'ld': ld}
    nav = [('#operacion', 'Los siete ejes'), ('#problemas', 'Problemas'), ('#trayectoria', 'Experiencia'), ('#metodo', 'Método'), ('#preguntas', 'Preguntas'), ('#contacto', 'Contacto')]

    probs = ''.join(f'<li class="prob" data-rv><span class="pr-n">{i + 1:02d}</span><p class="pr-t">{esc(t)}</p><p class="pr-a"><span class="pr-k">Cómo lo abordo</span>{esc(a)}</p>'
                    f'<a class="pr-go" href="#eje-{PROB_AXIS[c]}"><span class="sr">Ver el eje relacionado</span>{ARR}</a></li>' for i, (t, a, c) in enumerate(G['problems']['items']))
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
    J = G['jobs']
    services = [x['form'] for x in AXES['items']]

    body = f"""<body class="pg-area pg-gas">
{header('gastronomia')}
{menu('gastronomia', sub=nav)}
<main id="contenido">
{hero(GAS, G)}
{subnav(nav)}
{axes()}

<section class="sec problems amb amb-warm" id="problemas" aria-labelledby="problemas-t">
<div class="wrap">
{sec_head(G['problems']['label'], G['problems']['h2'], esc(G['problems']['intro']), h2_id='problemas-t', num='02')}
<ol class="probs">{probs}</ol>
<div class="stages-wrap" id="tu-negocio">
<h3 class="sub-h">{st['h2']}</h3>
<div class="stg-grid">{stages}</div>
</div>
</div>
</section>


<section class="sec career amb amb-warm" id="trayectoria" aria-labelledby="trayectoria-t">
<span class="anchor" id="gastronomia" aria-hidden="true"></span>
<div class="wrap">
<div class="career-top">
<div class="career-copy">
{sec_head(C['label'], 'Un buen negocio se construye en <em>la operación.</em>', esc(C['intro']), h2_id='trayectoria-t', num='03')}
<ul class="facts">{''.join(facts)}</ul>
<div class="row-links">{btn('Ver la trayectoria completa', 'trayectoria.html', ghost=True)}{tlink('Trabajá conmigo', '#trabaja-conmigo')}</div>
</div>
<figure class="career-photo" data-rv>{pic('operacion', alt=OPS_ALT, sizes='(max-width: 900px) 100vw, 42vw', lazy=True)}<figcaption>{esc(OPS_ALT)}.</figcaption></figure>
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
  var map = {'#publicaciones': 'publicaciones.html#doctrina', '#dossier': 'publicaciones.html#dossier', '#medios': 'publicaciones.html#medios', '#novedades': 'publicaciones.html', '#sobre-mi': 'trayectoria.html#investigacion', '#formacion': 'trayectoria.html#formacion'};
  if (map[l.hash]) l.replace(map[l.hash]);
})(location);
</script>
"""


def demo_vis(pr):
    """Lo que se ve de la automatización: el mensaje que llega, los datos ordenados, la alerta y el registro."""
    S = pr['sample']
    rows = ''.join(f'<li class="dv-row" data-st="{st}" style="--i:{j}"><span class="dv-p">{esc(p_)}</span><span class="dv-q">{esc(q)}</span>'
                   f'<span class="dv-s"><i aria-hidden="true"></i><span>{esc(note)}</span></span></li>' for j, (p_, q, st, note) in enumerate(S['rows']))
    bars = ''.join(f'<span{" class=hi" if j == len(S["bars"]) - 1 else ""} style="--h:{h}"></span>' for j, h in enumerate(S['bars']))
    return f"""<div class="dv" aria-hidden="true">
<div class="dv-msg"><p class="dv-from"><b data-f="from">{esc(S['from'])}</b> · <i data-f="channel">{esc(S['channel'])}</i><span data-f="time">{esc(S['time'])}</span></p><p class="dv-text" data-f="msg">{esc(S['msg'])}</p></div>
<div class="dv-sheet">
<p class="dv-cap"><b data-f="id">{esc(S['id'])}</b><span data-f="cap">{esc(S['cap'])}</span></p>
<ul class="dv-rows" data-f="rows">{rows}</ul>
</div>
<div class="dv-report"><p class="dv-cap"><b>Resumen para el responsable</b><span data-f="rcap">{esc(S['rcap'])}</span></p>
<p class="dv-alert" data-f="alert">{esc(S['alert'])}</p>
<div class="dv-bars" data-f="bars">{bars}</div>
<p class="dv-fine" data-f="fine">{esc(S['fine'])}</p></div>
<div class="dv-log"><span class="dv-dot"></span><span data-log>Pendiente de decisión</span></div>
</div>"""


def demo():
    """Demostración ficticia: se elige un proceso administrativo y se recorren sus cinco etapas
    (ingreso, registro, procesamiento, alerta y decisión humana)."""
    D = DEMO
    pr = D['procs'][0]
    procs = ''.join(f'<button class="dpc" type="button" role="radio" aria-checked="{"true" if i == 0 else "false"}"{"" if i == 0 else " tabindex=\"-1\""} data-proc="{q["k"]}">'
                    f'<span class="dpc-a">{esc(q["area"])}</span><span class="dpc-t">{esc(q["name"])}</span></button>' for i, q in enumerate(D['procs']))
    tabs = ''.join(f'<button class="dr" type="button" role="tab" id="dt-{k}" aria-controls="dp-{k}" aria-selected="{"true" if i == 0 else "false"}"'
                   f'{"" if i == 0 else " tabindex=\"-1\""} data-i="{i + 1}"><span class="dr-n">{i + 1:02d}</span><span class="dr-t">{esc(n)}</span></button>'
                   for i, (k, n) in enumerate(zip(D['keys'], D['names'])))
    panels = []
    for i, (k, st) in enumerate(zip(D['keys'], pr['stages'])):
        extra = ''
        if k == 'decision':
            extra = ('<div class="dp-act" role="group" aria-label="Probá la decisión">'
                     + ''.join(f'<button class="btn{" ghost" if j else ""} btn-sm" type="button" data-decide="{d[0]}"><span>{esc(d[1])}</span></button>' for j, d in enumerate(pr['decide']))
                     + '</div><p class="dp-res" role="status" data-decision></p>')
        panels.append(f"""<div class="dp" role="tabpanel" id="dp-{k}" aria-labelledby="dt-{k}"{'' if i == 0 else ' hidden'}>
<h3 class="dp-t">{esc(st['h3'])}</h3>
<p class="dp-w">{esc(st['what'])}</p>
<dl class="dp-dl">
<div><dt>Sin automatización</dt><dd data-f="before">{esc(st['before'])}</dd></div>
<div><dt>Con automatización</dt><dd data-f="after">{esc(st['after'])}</dd></div>
<div class="dp-h"><dt>Qué hace la persona</dt><dd data-f="human">{esc(st['human'])}</dd></div>
</dl>{extra}
</div>""")
    data = json.dumps(D['procs'], ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return f"""<section class="sec demo-sec amb amb-cool" id="{D['id']}" aria-labelledby="{D['id']}-t">
<span class="anchor" id="aplicaciones" aria-hidden="true"></span><span class="anchor" id="flujo" aria-hidden="true"></span>
<div class="wrap">
<div class="sec-top">{sec_head(D['label'], D['h2'], esc(D['intro']), h2_id=D['id'] + '-t', num='02')}<p class="badge">{esc(D['badge'])}</p></div>
<div class="demo" data-demo data-stage="1" data-proc="{pr['k']}">
<div class="demo-procs" role="radiogroup" aria-label="Elegí un proceso">{procs}</div>
<p class="demo-problem"><span class="label">El problema</span><span data-problem>{esc(pr['problem'])}</span></p>
<div class="demo-rail" role="tablist" aria-label="Etapas de la automatización">{tabs}<span class="dr-line" aria-hidden="true"><i></i></span></div>
<div class="demo-body">
<div class="demo-vis">{demo_vis(pr)}</div>
<div class="demo-panels">{''.join(panels)}</div>
</div>
<div class="demo-ctrl"><button class="demo-play" type="button" data-demo-play aria-pressed="false"><span class="dp-ico" aria-hidden="true"></span><span class="dp-lab">Reproducir el recorrido</span></button><p class="note">{esc(D['note'])}</p></div>
<script type="application/json" data-demo-data>{data}</script>
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
    return f"""<section class="sec cases amb amb-cool" id="{K['id']}" aria-labelledby="{K['id']}-t">
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
    nav = [('#demo', 'Demostración'), ('#casos', 'Casos reales'), ('#servicios', 'Servicios'), ('#metodo', 'Proceso'), ('#preguntas', 'Preguntas'), ('#contacto', 'Contacto')]
    V_ = I['value']
    principles = ''.join(f'<li class="pc" data-rv><span class="pc-n">{i + 1:02d}</span><h3>{esc(h)}</h3><p>{esc(p)}</p></li>' for i, (h, p) in enumerate(V_['principles']))
    R = I['research']
    keydocs = ''.join(pub_row(d, desc=False) for d in [doc_by('Transparencia algorítmica como garantía'), doc_by('Algorithmic Transparency'),
                                                       doc_by('Cuando explicar no alcanza'), doc_by('Resolución 9/2025')])
    dz = P['dossier']
    services = [t['form'] for t in DEPTS['tabs']]

    body = f"""<body class="pg-area pg-ia">
{header('automatizacion')}
{menu('automatizacion', sub=nav)}
<main id="contenido">
{hero(IA, I)}
{subnav(nav)}

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
<div class="row-links">{tlink('Investigación, formación y trayectoria', 'trayectoria.html#investigacion')}{tlink('Ver todas las publicaciones', 'publicaciones.html')}</div>
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
{header('publicaciones')}
{menu('publicaciones')}
<main id="contenido">
<section class="p-hero" aria-labelledby="ph-t">
<div class="wrap">
<p class="label" data-in="1">Publicaciones</p>
<h1 class="pubs-title" id="ph-t"><span class="ln" style="--l:0"><span>Doctrina, investigación</span></span> <span class="ln" style="--l:1"><span><em>y prensa.</em></span></span></h1>
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


# ======================================================================= trayectoria

TRAINING_GROUPS = [
    ('Universidad', [('Universidad Kennedy · En curso', 'Abogacía — tercer año', 'Formación universitaria en Derecho.')]),
    ('Tecnología', [('Formación tecnológica', 'Analista de Sistemas', 'Formación en análisis de sistemas informáticos.'),
                    ('Redes informáticas', 'Administrador de Redes SOHO', ''), ('Informática', 'Reparación de PC', '')]),
    ('Gastronomía', [('Academia Gastro Argentina', 'Gerenciamiento Gastronómico', 'Curso completado · 3 de mayo de 2024'),
                     ('Academia Gastro Argentina', 'Recursos Humanos de la Gastronomía', 'Curso completado · 24 de mayo de 2024'),
                     ('Academia Gastro Argentina', 'Asesor Gastronómico', 'Curso completado · 22 de junio de 2024')]),
    ('Formación internacional', [('United Nations Volunteers (UNV)', 'BSAFE', ''), ('United Nations Volunteers (UNV)', 'Conflict Management', ''),
                                 ('United Nations Volunteers (UNV)', 'Information Security Awareness', '')]),
]


def trayectoria():
    C = GAS_PAGE['career']
    R = IA_PAGE['research']
    dz = P['dossier']
    page = {'file': 'trayectoria.html', 'path': '/trayectoria', 'area': None, 'css': 'trayectoria',
            'title': 'Trayectoria: dirección gastronómica, formación e investigación | Ezequiel Brunner',
            'og_title': 'Trayectoria | Ezequiel Brunner',
            'desc': 'Más de 15 años en operaciones gastronómicas, formación en sistemas y Derecho, investigación sobre inteligencia artificial y transparencia algorítmica, publicaciones y apariciones en medios.',
            'og': 'assets/og/trayectoria.jpg', 'og_alt': 'Trayectoria de Ezequiel Brunner: experiencia que se puede comprobar',
            'ld': [{'@type': 'ProfilePage', 'url': SITE + '/trayectoria', 'name': 'Trayectoria de Ezequiel Brunner', 'mainEntity': {'@id': SITE + '/#ezequiel'}},
                   {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE + '/'},
                                                                   {'@type': 'ListItem', 'position': 2, 'name': 'Trayectoria', 'item': SITE + '/trayectoria'}]}]}
    npubs = len(DOCT) + 1 + len(P['medios']) + len(P['gastro'])
    facts = [('15', '+', 'años en operaciones gastronómicas, liderazgo de equipos y gestión de servicios'),
             ('135', '', 'personas en equipos para eventos de gran escala'),
             (str(npubs), '', 'publicaciones y apariciones en medios, con sus enlaces originales')]
    facts_html = ''.join(f'<li><span class="fact-n"><span class="count" data-to="{n}">{n}</span>{s_}</span><span class="fact-l">{esc(l)}</span></li>' for n, s_, l in facts)
    blocks = ''.join(f'<div class="tg-b" data-rv><h3 class="tg-h">{esc(h)}</h3>{"".join(f"<p>{esc(x)}</p>" for x in ps)}</div>' for h, ps in C['blocks'])
    tl = ''.join(f'<li class="tt" data-rv><span class="tt-dot" aria-hidden="true"></span><span class="tt-k">{esc(k)}</span><h3 class="tt-t">{esc(t)}</h3><p>{esc(p_)}</p></li>' for k, t, p_ in C['timeline'])
    groups = ''.join(f'<div class="tf-g" data-rv><h3 class="tf-h">{esc(g)}</h3><ul class="training training-1">'
                     + ''.join(f'<li><span class="tr-k">{esc(k)}</span><span class="tr-t">{esc(t)}</span>{f"<span class=tr-d>{esc(d)}</span>" if d else ""}</li>' for k, t, d in items)
                     + '</ul></div>' for g, items in TRAINING_GROUPS)
    about = ''.join(f'<div class="ti-p" data-rv><h3 class="tg-h">{esc(h)}</h3><p>{esc(t)}</p></div>' for h, t in R['about'])
    cases = ''.join(f'<li class="ti-case" data-rv><span class="label">{esc(c["k"])}</span><h4>{esc(c["h3"])}</h4><p>{esc(c["result"])}</p></li>' for c in IA_PAGE['cases']['items'])
    feat = [{'outlet': 'Biblioteca del Congreso', 'kind': 'Selección bibliográfica', 'human_date': 'Abril de 2026',
             'title': f"{dz['h2']}: {dz['title']}", 'href': dz['href'], 'link': dz['link'], 'paras': []}]
    feat += [dict(doc_by(t), paras=[]) for t in ('Transparencia algorítmica como garantía', 'Algorithmic Transparency', 'Inteligencia Artificial y Derecho',
                                                 'La sanción disciplinaria', 'Certificados Médicos Digitales')]
    press = [m for m in P['gastro']] + [m for m in P['medios'] if m['kind'] not in ('Carta al director', 'Carta de autor')]
    idx = [('#gastronomia', '01', 'Dirección gastronómica'), ('#formacion', '02', 'Formación'), ('#investigacion', '03', 'Investigación y tecnología'),
           ('#publicaciones', '04', 'Publicaciones'), ('#medios', '05', 'En los medios')]
    idx_html = ''.join(f'<li><a href="{h}"><span class="ti-n">{n}</span>{esc(t)}</a></li>' for h, n, t in idx)

    body = f"""<body class="pg-tray">
{header('trayectoria')}
{menu('trayectoria')}
<main id="contenido">
<section class="t-hero" aria-labelledby="t-t">
<div class="wrap t-hero-in">
<div class="t-hero-copy">
<p class="label" data-in="1">Trayectoria</p>
<h1 class="t-title" id="t-t"><span class="ln" style="--l:0"><span>Experiencia que se</span></span> <span class="ln" style="--l:1"><span><em>puede comprobar.</em></span></span></h1>
<p class="lead" data-in="3">{esc(C['intro'])} Formación en sistemas y Derecho, investigación sobre inteligencia artificial y automatizaciones propias en uso.</p>
{firma()}
<ul class="facts t-facts">{facts_html}</ul>
<nav class="t-index" aria-label="Secciones de la trayectoria"><ol>{idx_html}</ol></nav>
</div>
</div>
</section>

<section class="sec t-sec amb amb-warm" id="gastronomia" aria-labelledby="tg-t">
<span class="anchor" id="direccion" aria-hidden="true"></span>
<div class="wrap">
<div class="t-head">{sec_head('Dirección gastronómica', 'Gerente gastronómico. <em>Con presencia en la operación.</em>', '', num='01', h2_id='tg-t')}</div>
<div class="tg-grid">
<div class="tg-copy">{blocks}<div class="row-links">{tlink('Ver mi LinkedIn', LINKEDIN, ext=True)}{tlink('Perfil biográfico', ABOUTME, ext=True)}</div></div>
<figure class="tg-photo" data-rv>{pic('operacion', alt=OPS_ALT, sizes='(max-width: 900px) 100vw, 46vw', lazy=True)}<figcaption>{esc(OPS_ALT)}.</figcaption></figure>
</div>
<div class="t-line">
<h3 class="sub-h">Recorrido profesional</h3>
<ol class="t-timeline">{tl}</ol>
</div>
<figure class="t-team" data-rv>{pic('equipo', alt=TEAM_ALT, sizes='100vw', lazy=True)}<figcaption>{esc(TEAM_ALT)}.</figcaption></figure>
</div>
</section>

<section class="sec t-sec" id="formacion" aria-labelledby="tf-t">
<div class="wrap">
<div class="t-head">{sec_head('Formación', 'Sistemas, gastronomía <em>y Derecho.</em>', 'Formación universitaria en curso, formación técnica en sistemas y redes, cursos de gestión gastronómica y capacitaciones internacionales.', num='02', h2_id='tf-t')}</div>
<div class="tf-grid">{groups}</div>
</div>
</section>

<section class="sec t-sec amb amb-cool" id="investigacion" aria-labelledby="ti-t">
<span class="anchor" id="sobre-mi" aria-hidden="true"></span>
<div class="wrap">
<div class="t-head">{sec_head('Investigación y desarrollo tecnológico', 'Inteligencia artificial, <em>Derecho y procesos.</em>', esc(R['intro']), num='03', h2_id='ti-t')}</div>
<div class="ti-grid">{about}</div>
<div class="ti-dev">
<h3 class="sub-h">Desarrollo tecnológico: automatizaciones propias en uso</h3>
<ol class="ti-cases">{cases}</ol>
<div class="row-links">{tlink('Ver los casos en Automatización & IA', 'inteligencia-artificial.html#casos')}</div>
</div>
</div>
</section>

<section class="sec t-sec" id="publicaciones" aria-labelledby="tp-t">
<div class="wrap">
<div class="t-head sec-top">{sec_head('Publicaciones', 'Doctrina, dossier <em>e investigación.</em>', esc(P['heads']['doctrina']['intro']), num='04', h2_id='tp-t')}
{btn('Ver la biblioteca completa', 'publicaciones.html', ghost=True)}</div>
<ol class="plist plist-feat">{''.join(pub_row(f, desc=False) for f in feat)}</ol>
</div>
</section>

<section class="sec t-sec" id="medios" aria-labelledby="tm-t">
<div class="wrap">
<div class="t-head sec-top">{sec_head('En los medios', 'Entrevistas, notas <em>y artículos.</em>', 'Apariciones sobre gestión gastronómica, inteligencia artificial y Derecho, con sus enlaces originales.', num='05', h2_id='tm-t')}
{btn('Ver todas en la biblioteca', 'publicaciones.html#medios', ghost=True)}</div>
<ul class="plist">{''.join(pub_row(m, desc=False) for m in press)}</ul>
</div>
</section>

<section class="sec home-contact" id="contacto" aria-labelledby="tc-t">
<div class="wrap hc-grid">
<div>
{sec_head('Contacto', 'Conversemos sobre tu <em>próximo paso.</em>', 'Contame qué necesitás ordenar, mejorar o poner en marcha. Elegí el área para que la consulta llegue con la información justa.', h2_id='tc-t')}
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
{scripts(['gsap', 'split', 'lenis'])}
</body>
</html>"""
    write('trayectoria.html', head(page) + '\n' + body)



def notfound():
    page = {'file': '404.html', 'path': '/404', 'area': None, 'root': '/', 'title': 'Página no encontrada | Ezequiel Brunner',
            'desc': 'La página que buscás no existe o cambió de lugar.', 'og': 'assets/og/inicio.jpg'}
    body = f"""<body class="pg-404">
<main id="contenido" class="nf">
<div class="wrap">
<p class="label"><span class="lab-n">404</span>Página no encontrada</p>
<h1 class="pubs-title">Esta página <em>cambió de lugar.</em></h1>
<p class="lead">Elegí un área para seguir.</p>
<div class="nf-act">{btn('Asesoramiento gastronómico', '/gastronomia')}{btn('Automatización & IA', '/inteligencia-artificial', ghost=True)}{tlink('Trayectoria', '/trayectoria')}{tlink('Publicaciones', '/publicaciones')}</div>
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
    trayectoria()
    notfound()
