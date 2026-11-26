"""Ilustraciones del sitio en SVG, de línea fina: la red de la portada y las portadas de los proyectos.

Todo usa currentColor (el color del texto) con distintas opacidades, y el acento cálido solo para
lo que se mueve o se destaca. Las animaciones viven en la hoja de estilos (site.css) y se apagan
con «reducir movimiento».
"""
import math


def _f(x):
    """Número corto para el SVG."""
    s = f'{x:.2f}'.rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


# ---------------------------------------------------------------- portada: la red
# Tres nodos sobre un anillo: Gastronomía (arriba), Negocios (abajo a la derecha) y Tecnología
# (abajo a la izquierda). Una señal recorre el anillo de nodo a nodo, en el orden del título.
CX = CY = 300
R = 175
ANG = {'gastronomia': 270, 'negocios': 30, 'tecnologia': 150}


def node_xy(key):
    a = math.radians(ANG[key])
    return CX + R * math.cos(a), CY + R * math.sin(a)


def label_pos(key):
    """Posición de la etiqueta HTML de cada nodo, en % del cuadro (0 a 100)."""
    x, y = node_xy(key)
    dy = -11.5 if key == 'gastronomia' else 7.2
    return x / 6, y / 6 + dy


def hero_net():
    g = node_xy('gastronomia')
    n = node_xy('negocios')
    t = node_xy('tecnologia')

    def arc(p, q):
        return f'M{_f(p[0])} {_f(p[1])}A{R} {R} 0 0 1 {_f(q[0])} {_f(q[1])}'

    arcs = [arc(g, n), arc(n, t), arc(t, g)]
    ticks = []
    for i in range(72):
        a = math.radians(i * 5)
        r1, r2 = (236, 246) if i % 6 == 0 else (240, 244)
        ticks.append(f'M{_f(CX + r1 * math.cos(a))} {_f(CY + r1 * math.sin(a))}'
                     f'L{_f(CX + r2 * math.cos(a))} {_f(CY + r2 * math.sin(a))}')
    ring = f'M{CX} {CY - R}A{R} {R} 0 1 1 {CX - 0.01} {CY - R}'
    tri = f'M{_f(g[0])} {_f(g[1])}L{_f(n[0])} {_f(n[1])}L{_f(t[0])} {_f(t[1])}Z'

    nodes = ''
    for k, (x, y) in (('g', g), ('n', n), ('t', t)):
        nodes += (f'<g class="nd nd-{k}"><circle class="nd-ping" cx="{_f(x)}" cy="{_f(y)}" r="11"/>'
                  f'<circle class="nd-ring" cx="{_f(x)}" cy="{_f(y)}" r="11"/>'
                  f'<circle class="nd-core" cx="{_f(x)}" cy="{_f(y)}" r="3.6"/></g>')
    sig = ''.join(f'<path class="sg-halo sg-{i}" d="{d}" pathLength="100"/><path class="sg sg-{i}" d="{d}" pathLength="100"/>'
                  for i, d in enumerate(arcs, 1))
    # Tres capas: la base quieta (con la máscara y la trama de puntos, que son caras de pintar), el dial que gira
    # (lo rota el compositor, sin volver a pintar) y la capa viva con el anillo, los nodos y la señal.
    svg = '<svg class="net {}" viewBox="0 0 600 600" fill="none" focusable="false" aria-hidden="true">'
    return (
        svg.format('net-base') +
        '<defs>'
        '<radialGradient id="net-fade" cx="50%" cy="50%" r="50%">'
        '<stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".72" stop-color="#fff" stop-opacity=".35"/>'
        '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
        '<pattern id="net-dots" width="20" height="20" patternUnits="userSpaceOnUse">'
        '<circle cx="10" cy="10" r=".8" fill="currentColor"/></pattern>'
        '<mask id="net-mask"><rect width="600" height="600" fill="url(#net-fade)"/></mask>'
        '</defs>'
        '<rect class="net-dots" width="600" height="600" fill="url(#net-dots)" mask="url(#net-mask)"/>'
        f'<circle class="net-orbit" cx="{CX}" cy="{CY}" r="262"/>'
        f'<path class="net-tri" d="{tri}"/>'
        f'<path class="net-c" d="M{CX - 7} {CY}H{CX + 7}M{CX} {CY - 7}V{CY + 7}"/>'
        '</svg>'
        '<div class="net-spin">' + svg.format('net-dial') + f'<path class="net-ticks" d="{"".join(ticks)}"/></svg></div>'
        + svg.format('net-live') +
        f'<path class="net-ring" d="{ring}" pathLength="100"/>'
        f'<circle class="net-c-dot" cx="{CX}" cy="{CY}" r="2.4"/>'
        f'{sig}{nodes}'
        '</svg>'
    )


# ---------------------------------------------------------------- portadas de proyectos
# Cuadro de 400 × 250. Cada una dibuja el proyecto de forma abstracta, sin datos inventados.
W, H = 400, 250


def _svg(cls, body):
    return (f'<svg class="cv cv-{cls}" viewBox="0 0 {W} {H}" fill="none" focusable="false" aria-hidden="true">'
            f'<rect class="cv-grid" width="{W}" height="{H}" fill="url(#cv-dots)"/>{body}</svg>')


def cover_defs():
    """Patrón de puntos compartido por todas las portadas (va una sola vez en la página)."""
    return ('<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>'
            '<pattern id="cv-dots" width="16" height="16" patternUnits="userSpaceOnUse">'
            '<circle cx="8" cy="8" r=".7" fill="currentColor"/></pattern></defs></svg>')


def cover_taza():
    # Una taza sobre su plato, vista desde arriba: la cafetería.
    cx, cy = 200, 125
    body = (f'<circle class="l1" cx="{cx}" cy="{cy}" r="84"/>'
            f'<circle class="l0" cx="{cx}" cy="{cy}" r="70"/>'
            f'<path class="l2" d="M{cx + 47} {cy - 11}h14a11 11 0 0 1 0 22h-14"/>'
            f'<circle class="l2" cx="{cx}" cy="{cy}" r="48"/>'
            f'<circle class="fill-ac" cx="{cx}" cy="{cy}" r="39"/>'
            f'<g class="cv-spin"><path class="ac" d="M{cx} {cy - 20}c11 0 20 9 20 20s-9 20-20 20-16-7-16-16 7-14 14-14 10 5 10 10-4 8-8 8"/></g>'
            f'<path class="l0" d="M60 {cy}h40M300 {cy}h40"/>')
    return _svg('taza', body)


def cover_salon():
    # El salón visto desde arriba: barra, mesas y el recorrido de un turno.
    body = '<rect class="l1" x="34" y="26" width="332" height="198" rx="2"/>'
    body += '<rect class="l2" x="62" y="44" width="150" height="14" rx="7"/>'
    body += '<path class="bg-cut" d="M176 224h48"/>'
    tables = chairs = ''
    for i, x in enumerate((96, 152, 208, 264, 320)):
        for j, y in enumerate((96, 140, 184)):
            if (i, j) in ((4, 0),):
                continue
            tables += f'<circle class="l2" cx="{x}" cy="{y}" r="8.5"/>'
            chairs += ''.join(f'M{x + dx} {y + dy}h0' for dx, dy in ((0, -14), (14, 0), (0, 14), (-14, 0)))
    body += tables + f'<path class="dots" d="{chairs}"/>'
    body += ('<path class="ac route" pathLength="100" d="M137 58V74Q137 80 143 80H232Q240 80 240 88V118Q240 124 246 124'
             'H290Q296 124 296 130V162Q296 168 290 168H186Q180 168 180 174V214"/>')
    body += '<circle class="fill-ac2" cx="137" cy="58" r="3"/>'
    return _svg('salon', body)


def cover_asignacion():
    # Un ranking por indicadores que propone qué camarero va a cada salón.
    rows = (132, 116, 104, 90, 76, 62)
    body = ''
    for i, w in enumerate(rows):
        y = 52 + i * 28
        cls = 'ac' if i < 2 else 'l2'
        body += f'<circle class="dot" cx="44" cy="{y}" r="2"/>'
        body += f'<path class="bar {cls}" d="M58 {y}h{w}"/>'
    body += '<rect class="l2" x="282" y="40" width="84" height="72" rx="3"/>'
    body += '<rect class="l2" x="282" y="138" width="84" height="72" rx="3"/>'
    for bx, by in ((282, 40), (282, 138)):
        for i in range(3):
            for j in range(2):
                body += f'<circle class="l1" cx="{bx + 22 + i * 20}" cy="{by + 24 + j * 24}" r="5"/>'
    links = ''
    for i, w in enumerate(rows):
        y = 52 + i * 28
        ty = 76 if i % 2 == 0 else 174
        x0 = 58 + w + 8
        cls = 'ac flow' if i < 2 else 'l1 flow'
        links += f'<path class="{cls}" pathLength="100" d="M{x0} {y}C{x0 + 50} {y} {232} {ty} 278 {ty}"/>'
    return _svg('asignacion', body + links)


def cover_equipo():
    # Ciento treinta y cinco puntos: el tamaño de los equipos para eventos multitudinarios.
    body = '<path class="l2" d="M128 30h144l18 26H110z"/>'
    body += '<path class="l1" d="M96 24v46M304 24v46M90 24h12M298 24h12"/>'
    # cada punto es un trazo de largo cero con punta redonda: 15 × 9 = 135
    rows = ''
    for j in range(9):
        d = ''.join(f'M{95 + i * 15} {90 + j * 16}h0' for i in range(15))
        rows += f'<path class="row" style="--r:{j}" d="{d}"/>'
    body += f'<g class="crowd">{rows}</g>'
    return _svg('equipo', body)


def cover_ranking():
    # La semana: el lunes se cuentan las ventas y el ranking llega por email.
    body = ''
    for i in range(7):
        cls = 'ac' if i == 0 else 'l1'
        body += f'<rect class="{cls}" x="{40 + i * 22}" y="34" width="14" height="14" rx="2"/>'
    for i, w in enumerate((210, 176, 148, 120, 96)):
        y = 86 + i * 30
        cls = 'ac' if i == 0 else 'l2'
        body += f'<path class="bar {cls}" d="M40 {y}h{w}"/>'
        body += f'<circle class="dot" cx="{40 + w + 10}" cy="{y}" r="1.8"/>'
    body += '<path class="l1 flow" pathLength="100" d="M262 86C292 86 300 110 316 120"/>'
    body += '<rect class="l2" x="306" y="108" width="62" height="42" rx="3"/>'
    body += '<path class="l2" d="M306 111l31 21 31-21"/>'
    return _svg('ranking', body)


# Coordenadas reales (latitud, longitud) de la cervecería y sus franquicias.
PLACES = {
    'mdp': (-38.00, -57.55),
    'sanjuan': (-31.54, -68.53),
    'malargue': (-35.47, -69.58),
    'comodoro': (-45.86, -67.48),
}


def _proj(lat, lon):
    # Equirectangular, escalada por el coseno de la latitud media; ajustada al cuadro.
    k = 12.6
    x = 210 + (lon + 63.5) * k * math.cos(math.radians(38.5))
    y = 125 - (lat + 38.7) * k
    return x, y


def cover_mapa():
    # Mar del Plata y las franquicias en Comodoro Rivadavia, San Juan y Malargüe; la flecha, la exportación.
    o = _proj(*PLACES['mdp'])
    body = ''
    for key in ('sanjuan', 'malargue', 'comodoro'):
        p = _proj(*PLACES[key])
        mx, my = (o[0] + p[0]) / 2, (o[1] + p[1]) / 2 - 34
        body += f'<path class="l2 flow" pathLength="100" d="M{_f(o[0])} {_f(o[1])}Q{_f(mx)} {_f(my)} {_f(p[0])} {_f(p[1])}"/>'
        body += f'<circle class="l3" cx="{_f(p[0])}" cy="{_f(p[1])}" r="3.2"/>'
    body += (f'<path class="ac flow" pathLength="100" d="M{_f(o[0])} {_f(o[1])}Q{_f(o[0] + 60)} {_f(o[1] - 70)} 372 46"/>'
             '<path class="ac" d="M362 42l10 4-6 9"/>')
    body += f'<circle class="ring-ac" cx="{_f(o[0])}" cy="{_f(o[1])}" r="9"/><circle class="fill-ac2" cx="{_f(o[0])}" cy="{_f(o[1])}" r="3.6"/>'
    return _svg('mapa', body)


COVERS = {
    'taza': cover_taza,
    'salon': cover_salon,
    'asignacion': cover_asignacion,
    'equipo': cover_equipo,
    'ranking': cover_ranking,
    'mapa': cover_mapa,
}
