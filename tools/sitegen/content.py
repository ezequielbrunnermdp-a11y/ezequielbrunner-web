"""Contenido del sitio (una sola página). Todo el texto visible sale de acá y de data/publicaciones.json.

Reglas: solo hechos que ya estaban publicados o que dio el titular. Nada de clientes, resultados,
premios ni publicaciones inventadas. El contenido del sitio anterior está en respaldo/.
"""
from html import escape


def esc(s):
    return escape(str(s), quote=True)


SITE = 'https://ezequielbrunner.com'
NAME = 'Ezequiel Brunner'
PLACE = 'Mar del Plata, Argentina'
EMAIL = 'ezequielbrunnermdp@gmail.com'
WA_NUMBER = '5492236343371'
WA_DISPLAY = '223 634-3371'
WA_URL = 'https://wa.me/' + WA_NUMBER
TEL_LD = '+54 9 223 634-3371'
LINKEDIN = 'https://ar.linkedin.com/in/ezequielbrunner'
ABOUTME = 'https://about.me/ezequielbrunner'
# Pendiente: la cuenta de Instagram. Cuando esté, va acá (por ejemplo 'https://www.instagram.com/usuario/')
# y aparece sola en Contacto y en los datos estructurados.
INSTAGRAM = None
INSTAGRAM_HANDLE = None  # por ejemplo '@usuario'

SEO = {
    'title': 'Ezequiel Brunner · Gastronomía, negocios y tecnología',
    'desc': ('Ayudo a transformar negocios gastronómicos con estrategia, gestión operativa y soluciones '
             'digitales con inteligencia artificial. Mar del Plata, Argentina.'),
    'og_alt': 'Ezequiel Brunner. Gastronomía, negocios y tecnología.',
    'job': 'Consultor en gestión gastronómica, negocios y soluciones digitales con inteligencia artificial',
}

# Menú: cuatro accesos. Las demás secciones se recorren con el desplazamiento.
# Cada acceso se marca mientras se lee cualquiera de sus secciones.
NAV = [
    ('inicio', 'Inicio', ['inicio']),
    ('servicios', 'Servicios', ['servicios', 'sobre-mi']),
    ('proyectos', 'Proyectos', ['proyectos', 'medios', 'galeria']),
    ('contacto', 'Contacto', ['contacto']),
]

HERO = {
    'eyebrow': 'Ezequiel Brunner · Consultor',
    # El título se arma en tres renglones; el último va en itálica.
    'title': ['Gastronomía,', 'negocios', 'y tecnología.'],
    'title_plain': 'Gastronomía, negocios y tecnología.',
    'sub': ('Ayudo a transformar negocios gastronómicos mediante estrategia, gestión operativa '
            'y soluciones digitales con inteligencia artificial.'),
    'cta_services': 'Servicios',
    'cta_contact': 'Contactar',
    # La animación conecta las tres áreas; las palabras de cada nodo salen de los servicios.
    'nodes': [
        ('gastronomia', 'Gastronomía', 'operación · equipos · costos'),
        ('negocios', 'Negocios', 'estrategia · gestión · rentabilidad'),
        ('tecnologia', 'Tecnología', 'IA · automatización · sistemas'),
    ],
}

SERVICES = [
    {
        'n': '01', 'key': 'asesoramiento',
        'title': 'Asesoramiento gastronómico',
        'desc': ('Consultoría para restaurantes, cafeterías, bares y negocios gastronómicos. '
                 'Organización operativa, costos, equipos, procesos y rentabilidad.'),
    },
    {
        'n': '02', 'key': 'negocios',
        'title': 'Gestión y desarrollo de negocios',
        'desc': ('Estructuración de operaciones, apertura de locales, optimización de recursos, '
                 'capacitación y profesionalización de equipos.'),
    },
    {
        'n': '03', 'key': 'ia',
        'title': 'Inteligencia artificial y automatizaciones',
        'desc': ('Desarrollo de soluciones digitales, automatización de tareas, sistemas de gestión, '
                 'aplicaciones web y herramientas de IA para negocios.'),
    },
    {
        'n': '04', 'key': 'digital',
        'title': 'Soluciones digitales',
        'desc': ('Diseño y desarrollo de aplicaciones, sistemas de pedidos, plataformas internas '
                 'y herramientas tecnológicas para mejorar la operación comercial.'),
    },
]
SERVICE_CTA = 'Consultar'

ABOUT = {
    'h2': 'Sobre mí',
    'text': ('Soy Ezequiel Brunner, profesional de la gestión gastronómica y estudiante de Abogacía. '
             'Trabajo en la dirección y organización de negocios gastronómicos, combinando experiencia '
             'operativa, gestión de equipos y tecnología aplicada a los negocios.'),
    # Datos ya publicados en el sitio anterior (trayectoria, sectores y formación).
    'facts': [
        ('Trayectoria', 'Más de 15 años en operaciones gastronómicas.'),
        ('Sectores', 'Restaurantes, cafeterías, producción y eventos.'),
        ('Formación', 'Abogacía en la Universidad Kennedy (en curso), análisis de sistemas y gerenciamiento gastronómico.'),
    ],
    'photo_alt': 'Retrato de Ezequiel Brunner',
    'linkedin': 'Trayectoria completa en LinkedIn',
}

# Proyectos y experiencia: solo lo que ya figuraba en la trayectoria y en los casos publicados.
# Los dos casos de automatización se cuentan sin nombres de locales ni de personas, como antes.
PROJECTS = [
    {
        'key': 'condor', 'cover': 'taza',
        'meta': '2026 · Gerencia general operativa',
        'title': 'El Cóndor Coffee Shop',
        'desc': ('Coordinación de sucursales y fábrica, organización de equipos y procesos, '
                 'y seguimiento de costos, stock, pedidos y calidad de servicio.'),
    },
    {
        'key': 'palos', 'cover': 'salon',
        'meta': 'Desde 2023 · Del salón a la gerencia',
        'title': 'Puerto de Palos',
        'desc': ('Gestión gastronómica en el Casino Central, la sucursal del Centro Comercial del Puerto '
                 'y la planta de panificados.'),
    },
    {
        'key': 'salones', 'cover': 'asignacion',
        'meta': 'Automatización · Restaurante con varios salones',
        'title': 'Asignación de salones por desempeño',
        'desc': ('Cada mañana, un proceso toma las ventas del sistema de gestión, arma un ranking por '
                 'indicadores y propone qué camarero va a cada salón. La decisión es del encargado.'),
    },
    {
        'key': 'eventos', 'cover': 'equipo',
        'meta': 'Eventos de gran escala',
        'title': 'Barras para eventos multitudinarios',
        'desc': ('Equipos de hasta 135 personas: reposición, despacho, atención VIP '
                 'y sistemas de cobro sin efectivo.'),
    },
    {
        'key': 'ranking', 'cover': 'ranking',
        'meta': 'Automatización · Cafetería',
        'title': 'Ranking semanal de ventas',
        'desc': ('Todos los lunes suma las ventas de cada camarero, incluidas las promociones, '
                 'y envía el ranking por email al responsable. Sin trabajo manual.'),
    },
    {
        'key': 'cerveceria', 'cover': 'mapa',
        'meta': 'Cinco años · Desarrollo comercial',
        'title': 'Sector cervecero',
        'desc': ('Jefe de ventas y coordinador de proyectos en una cervecería de Mar del Plata: primera '
                 'exportación de la empresa y franquicias en Comodoro Rivadavia, San Juan y Malargüe.'),
    },
]

PROJECTS_HEAD = {
    'h2': 'Proyectos y experiencia',
    'note': 'Los casos de automatización están en funcionamiento; se omiten los nombres de los locales y del personal.',
}

PRESS = {
    'label': 'Prensa y publicaciones',
    'h2': 'En los medios',
    # Las tres notas destacadas (por su enlace); el resto se despliega ordenado por fecha.
    'featured': [
        'https://www.lacapitalmdp.com/certificados-medicos-digitales-el-nuevo-foco-de-conflicto-entre-trabajadores-y-empleadores/',
        'https://elretratodehoy.com.ar/2026/05/10/ezequiel-brunner-el-desafio-del-derecho-argentino-frente-a-la-ia-en-el-estado/',
        'https://mdpok.ar/noticia/ciudad/2026/02/08/puerto-de-palos-referente-gastronmico-en-producciones-de-gran-escala/28301.html',
    ],
    'more': 'Ver todas las publicaciones',
    'less': 'Ver menos',
    'undated': 'Sin fecha',
}

GALLERY = {
    'h2': 'Galería',
    'items': [
        {
            'src': 'equipo', 'w': 1800, 'h': 1200,
            'alt': 'Equipo de Puerto de Palos en Bendu Arena, frente al escenario.',
            'caption': 'Equipo de Puerto de Palos en Bendu Arena',
            'meta': 'Eventos',
        },
        {
            'src': 'operacion', 'w': 1800, 'h': 1200,
            'alt': 'Ezequiel Brunner coordina a dos integrantes del equipo durante un evento.',
            'caption': 'Coordinación del equipo durante un evento',
            'meta': 'Operación',
        },
    ],
}

CONTACT = {
    'h2': '¿Hablamos de tu próximo proyecto?',
    'text': ('Si necesitás mejorar tu negocio gastronómico, desarrollar una solución digital '
             'o implementar inteligencia artificial en tu operación, podemos conversar.'),
    'wa': 'Escribime por WhatsApp',
    'email': 'Email',
    'linkedin': 'LinkedIn',
    'instagram': 'Instagram',
    'linkedin_display': 'in/ezequielbrunner',
}

WA_MSG = 'Hola Ezequiel, te escribo desde tu web.'
WA_MSG_SERVICE = 'Hola Ezequiel, quiero consultar por {}.'

FOOTER = {
    'rights': '© 2026 Ezequiel Brunner',
    'top': 'Volver arriba',
}

NOT_FOUND = {
    'title': 'Página no encontrada · Ezequiel Brunner',
    'h1': 'Esta página no existe.',
    'p': 'Puede que la dirección haya cambiado: el sitio ahora es una sola página.',
    'back': 'Ir al inicio',
}
