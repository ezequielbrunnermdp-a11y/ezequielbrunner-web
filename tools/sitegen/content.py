"""Contenido real del sitio: textos, servicios, trayectoria y publicaciones.

Todo lo que se publica sale de este archivo y de data/publicaciones.json (doctrina, dossier y notas
en medios, transcriptos de la versión publicada con sus enlaces originales). No se inventan datos:
cada cifra o reconocimiento tiene su fuente en la trayectoria o en una publicación enlazada.
"""
import json, os, html as _html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SITE = 'https://ezequielbrunner.com'
EMAIL = 'ezequielbrunnermdp@gmail.com'
WA_NUMBER = '5492236343371'
WA_DISPLAY = '223 634-3371'
WA_URL = 'https://wa.me/' + WA_NUMBER
LINKEDIN = 'https://ar.linkedin.com/in/ezequielbrunner'
ABOUTME = 'https://about.me/ezequielbrunner'
RRHH_EMAIL = 'rrhhmdpgastronomia@gmail.com'


def publications():
    """Doctrina, dossier, medios y prensa gastronómica (data/publicaciones.json)."""
    return json.load(open(os.path.join(HERE, 'data', 'publicaciones.json'), encoding='utf8'))


# ---------------------------------------------------------------- textos compartidos

PERSON = {
    'name': 'Ezequiel Brunner',
    'place': 'Mar del Plata, Argentina',
    'about_h2': 'Una mirada construida en la operación.',
    'about': 'Trayectoria en dirección y gestión gastronómica, liderazgo de equipos, implementación de tecnología y optimización de procesos. Estudiante avanzado de Abogacía; no ejerzo como abogado matriculado.',
    'manifesto': ['Vengo de la operación: salones, cocinas, sucursales y equipos. Por eso uso la tecnología donde le ',
                  ('em', 'simplifica el trabajo a las personas'), ', y no donde suma complejidad. Sin promesas mágicas.'],
    'lead': 'Inteligencia artificial, gestión gastronómica y organización de equipos. Transformo procesos complejos en operaciones más eficientes.',
    'statement': 'Hago que la tecnología, los números, los equipos y los procesos trabajen a tu favor.',
}

# ---------------------------------------------------------------- áreas (brief de Ezequiel + textos existentes)

GAS = {
    'key': 'gastronomia', 'href': 'gastronomia.html', 'path': '/gastronomia',
    'label': 'Gastronomía', 'num': '01',
    'title': 'Asesoramiento gastronómico',
    'title_html': 'Asesoramiento <em>gastronómico</em>',
    'title_lines': ['Asesoramiento', '<em>gastronómico</em>'],
    'subtitle': 'Transformo operaciones gastronómicas en negocios más eficientes, rentables y profesionales.',
    'cta': 'Solicitar asesoramiento', 'explore': 'Explorar gastronomía',
    'services': [
        'Consultoría y diagnóstico gastronómico integral.',
        'Gerenciamiento operativo y estratégico.',
        'Auditorías de restaurantes, cafeterías y cadenas gastronómicas.',
        'Control de costos, CMV y rentabilidad.',
        'Gestión de compras, proveedores y stock.',
        'Reducción de desperdicios y mermas.',
        'Optimización de procesos operativos.',
        'Organización de equipos y recursos humanos.',
        'Diseño de estructuras de supervisión.',
        'Capacitación de personal y mandos medios.',
        'Desarrollo y estandarización de procedimientos.',
        'Apertura y reorganización de establecimientos.',
        'Desarrollo y gestión de franquicias.',
        'Indicadores de gestión y tableros de control.',
        'Optimización de ventas y experiencia del cliente.',
    ],
    'teaser': ['Costos y CMV', 'Auditorías', 'Equipos', 'Aperturas', 'Franquicias'],
}

IA = {
    'key': 'automatizacion', 'href': 'inteligencia-artificial.html', 'path': '/inteligencia-artificial',
    'label': 'Automatización & IA', 'num': '02',
    'title': 'Automatización & Inteligencia Artificial',
    'title_html': 'Automatización &amp; <em>inteligencia artificial</em>',
    'title_lines': ['Automatización &amp;', '<em>inteligencia</em>', '<em>artificial</em>'],
    'subtitle': 'Tecnología inteligente para automatizar procesos, optimizar decisiones y transformar empresas.',
    'cta': 'Evaluar mi empresa', 'explore': 'Explorar automatización',
    'services': [
        'Consultoría en inteligencia artificial aplicada a empresas.',
        'Automatización de tareas administrativas.',
        'Diseño de agentes inteligentes.',
        'Desarrollo de asistentes virtuales empresariales.',
        'Chatbots y automatizaciones de WhatsApp.',
        'Integraciones entre sistemas mediante APIs.',
        'Automatización de reportes operativos.',
        'Dashboards de indicadores en tiempo real.',
        'Análisis inteligente de ventas y rendimiento.',
        'Sistemas de gestión de personal.',
        'Automatización de procesos de RR. HH.',
        'Integración de plataformas comerciales.',
        'Digitalización de procesos internos.',
        'Desarrollo de herramientas web a medida.',
        'Automatización de alertas y seguimiento de objetivos.',
        'Implementación de soluciones de IA adaptadas a cada negocio.',
    ],
    'teaser': ['Agentes y asistentes', 'WhatsApp', 'APIs', 'Dashboards', 'RR. HH.'],
}


def _s(text):
    """Servicio del brief sin el punto final, para listas (respeta «RR. HH.»)."""
    return text[:-1] if text.endswith('.') and not text.endswith('HH.') else text


# ---------------------------------------------------------------- gastronomía: página

GAS_PAGE = {
    'hero_label': 'Asesoramiento gastronómico · Gestión y operaciones',
    'hero_fine': 'Experiencia en la gestión diaria. Un plan a la medida de tu realidad.',
    'value': {
        'label': 'Propuesta de valor',
        'h2': 'Un buen negocio se construye en <em>la operación.</em>',
        'lead': 'Te ayudo a ordenar costos, recursos humanos y procedimientos para que tu restaurante, cafetería o grupo gastronómico funcione con más control y una dirección clara.',
        'sub_h': 'El servicio se ve. La gestión lo sostiene.',
        'paras': ['Mi asesoramiento parte de <strong>entender lo que pasa en tu operación</strong> y convertirlo en un plan de trabajo: prioridades, responsables, herramientas de control y seguimiento.'],
        'facts': [
            {'n': 15, 'suffix': '+', 'label': 'años de experiencia en operaciones, liderazgo de equipos y gestión de servicios'},
            {'n': 135, 'prefix': 'hasta ', 'label': 'personas en equipos para eventos multitudinarios'},
            {'text': 'Restaurantes · Cafeterías · Producción · Eventos', 'label': 'operaciones gestionadas en el sector'},
        ],
        'sectors': ['Restaurantes', 'Cafeterías y bares', 'Sucursales y producción', 'Eventos'],
    },
    'services_head': {
        'label': 'Servicios de asesoramiento',
        'h2': 'Lo que tu negocio necesita. <em>Con un plan para hacerlo.</em>',
        'intro': 'Desde una revisión puntual hasta un acompañamiento de gestión. El foco se define según la etapa y los puntos críticos de tu operación.',
    },
    'categories': [
        {'id': 'diagnostico', 'name': 'Diagnóstico y gestión',
         'desc': 'Revisión del funcionamiento del negocio: ventas, compras, circuitos de caja, organización, servicio y puntos de pérdida. Priorización de las decisiones que necesitan atención.',
         'items': [GAS['services'][0], GAS['services'][1], GAS['services'][2], GAS['services'][13]],
         'detail': [('Diagnóstico y control de gestión', 'Revisión del funcionamiento del negocio: ventas, compras, circuitos de caja, organización, servicio y puntos de pérdida. Priorización de las decisiones que necesitan atención.', 'mapa de situación · prioridades · plan de acción')],
         'form': 'Diagnóstico y gestión'},
        {'id': 'costos', 'name': 'Costos, ventas y servicio',
         'desc': 'Costos, precios, compras y stock para entender dónde se genera margen y dónde se pierde. Atención, experiencia del cliente y ejecución para que el servicio acompañe la propuesta del negocio.',
         'items': [GAS['services'][3], GAS['services'][4], GAS['services'][5], GAS['services'][14]],
         'detail': [('Costos, stock y rentabilidad', 'Costeo de productos, revisión de precios, costo de mercadería vendida, inventarios, mermas y abastecimiento. Información para entender qué deja cada venta y dónde se pierde margen.', 'fichas de costos · circuitos de stock · indicadores de seguimiento'),
                    ('Ventas, experiencia y eventos', 'Revisión del recorrido del cliente, coordinación del servicio y oportunidades comerciales. Para eventos: planificación de barras, personal, abastecimiento, reposición y cobro.', 'plan de servicio · organización operativa · seguimiento de la ejecución')],
         'form': 'Costos, ventas y servicio'},
        {'id': 'procesos', 'name': 'Procesos y expansión',
         'desc': 'Aperturas, nuevas sucursales y procesos consistentes para crecer con una operación preparada.',
         'items': [GAS['services'][6], GAS['services'][10], GAS['services'][11], GAS['services'][12]],
         'detail': [('Aperturas y nuevas sucursales', 'Acompañamiento operativo desde la planificación hasta la puesta en marcha. Organización de equipos, proveedores, compras, sistemas y pruebas de servicio antes de abrir.', 'plan de preapertura · lista de verificación · seguimiento inicial'),
                    ('Procesos y gestión de varias unidades', 'Estandarización de pedidos, producción, compras, reportes y controles entre sucursales y fábrica. Una forma de trabajar consistente que permita comparar y corregir desvíos.', 'procedimientos operativos · controles por unidad · reuniones de gestión')],
         'form': 'Procesos, aperturas y franquicias'},
        {'id': 'equipos', 'name': 'Equipos y liderazgo',
         'desc': 'Selección, roles, turnos, capacitación y seguimiento del personal, con criterios claros para encargados y supervisores.',
         'items': [GAS['services'][7], GAS['services'][8], GAS['services'][9]],
         'detail': [('Equipos, liderazgo y servicio', 'Perfiles de selección, entrevistas e incorporación. Definición de roles, organización de turnos y capacitación de encargados y equipos. Seguimiento del desempeño y coordinación entre cocina, barra y salón.', 'perfiles de puesto · guía de incorporación · plan de capacitación y seguimiento'),
                    ('Gestión del personal', 'Desde el perfil del puesto hasta el seguimiento del desempeño, con criterios compartidos por encargados y supervisores.', 'perfiles de puesto · guía de ingreso · tablero de seguimiento',
                     ['Selección, entrevistas e incorporación.', 'Roles, turnos, francos y cobertura.', 'Capacitación y evaluación del desempeño.']),
                    ('Microprocedimientos operativos', 'Guías breves para resolver tareas y desvíos cotidianos: qué se hace, quién lo hace, cuándo y cómo se controla.', 'fichas de una página · listas de verificación · registros de control',
                     ['Apertura, cierre y cambios de turno.', 'Consumos internos, caja, pedidos y mermas.', 'Registro de incidentes y comunicación entre áreas.']),
                    ('Procedimientos disciplinarios', 'Un circuito interno para gestionar incumplimientos con información completa, responsables definidos y revisión del asesor laboral de la empresa.', 'formulario de solicitud · circuito de revisión · registro de decisiones',
                     ['Informe del supervisor y registro de los hechos.', 'Evaluación por la gerencia y revisión laboral.', 'Comunicación, registro y seguimiento de la decisión.'])],
         'intro': 'La gestión del personal también es parte del negocio. Te ayudo a ordenar responsabilidades, rutinas y circuitos de seguimiento para que cada encargado sepa qué hacer, cómo registrarlo y cuándo escalarlo.',
         'form': 'Equipos y recursos humanos'},
    ],
    'rrhh': {
        'label': 'Personas y operación',
        'h2': 'Recursos humanos. <em>Orden en cada paso.</em>',
        'intro': 'La gestión del personal también es parte del negocio. Te ayudo a ordenar responsabilidades, rutinas y circuitos de seguimiento para que cada encargado sepa qué hacer, cómo registrarlo y cuándo escalarlo.',
        'cards': [
            {'id': 'gestion-del-personal', 'label': '01 / Recursos humanos', 'h3': 'Gestión del personal',
             'p': 'Desde el perfil del puesto hasta el seguimiento del desempeño, con criterios compartidos por encargados y supervisores.',
             'li': ['Selección, entrevistas e incorporación.', 'Roles, turnos, francos y cobertura.', 'Capacitación y evaluación del desempeño.'],
             'out': 'perfiles de puesto · guía de ingreso · tablero de seguimiento'},
            {'id': 'microprocedimientos', 'label': '02 / Rutinas claras', 'h3': 'Microprocedimientos operativos',
             'p': 'Guías breves para resolver tareas y desvíos cotidianos: qué se hace, quién lo hace, cuándo y cómo se controla.',
             'li': ['Apertura, cierre y cambios de turno.', 'Consumos internos, caja, pedidos y mermas.', 'Registro de incidentes y comunicación entre áreas.'],
             'out': 'fichas de una página · listas de verificación · registros de control'},
            {'id': 'procedimientos-disciplinarios', 'label': '03 / Criterios y seguimiento', 'h3': 'Procedimientos disciplinarios',
             'p': 'Un circuito interno para gestionar incumplimientos con información completa, responsables definidos y revisión del asesor laboral de la empresa.',
             'li': ['Informe del supervisor y registro de los hechos.', 'Evaluación por la gerencia y revisión laboral.', 'Comunicación, registro y seguimiento de la decisión.'],
             'out': 'formulario de solicitud · circuito de revisión · registro de decisiones'},
        ],
        'scope': 'Alcance: se trata de consultoría operativa y administrativa. No constituye asesoramiento jurídico, que corresponde a profesionales matriculados.',
    },
    'problems': {
        'label': 'Problemas que ayudo a resolver',
        'h2': 'Vender más no siempre significa <em>ganar más.</em>',
        'intro': 'Un stock que no cierra, pedidos sin planificación o equipos sin responsabilidades claras terminan afectando al negocio y a la experiencia del cliente.',
        # Cada problema sale de los textos publicados; la respuesta, de los servicios.
        'items': [
            ('Un stock que no cierra.', 'Costeo, inventarios y mermas con circuitos de control.', 'costos'),
            ('Pedidos sin planificación.', 'Compras y proveedores con una planificación acordada.', 'costos'),
            ('Equipos sin responsabilidades claras.', 'Roles, turnos y rutinas para que cada encargado sepa qué hacer.', 'equipos'),
            ('Una operación que depende de que estés en todo.', 'Prioridades, responsables e indicadores de seguimiento.', 'diagnostico'),
            ('Margen que se pierde sin saber dónde.', 'Información para entender qué deja cada venta.', 'costos'),
            ('Sucursales que trabajan cada una a su manera.', 'Criterios compartidos y visibilidad sobre cada local.', 'procesos'),
        ],
    },
    'stages': {
        'id': 'tu-negocio', 'label': 'Tu punto de partida',
        'h2': 'Cada etapa pide <em>una intervención distinta.</em>',
        'intro': 'Elegí la situación más cercana a tu negocio para conocer un posible enfoque de trabajo.',
        'items': [
            {'label': 'Local en marcha', 'h3': 'Recuperar el control del día a día.',
             'p': 'Si la operación depende de que estés en todo, empezamos por mirar cómo se organiza el trabajo y qué información necesitás para decidir.',
             'li': ['Relevar costos, compras y stock.', 'Revisar roles y circuitos de control.', 'Definir prioridades y responsables.', 'Acordar indicadores de seguimiento.']},
            {'label': 'Nueva apertura', 'h3': 'Llegar al primer servicio con un plan.',
             'p': 'Antes de abrir, ordenamos lo que va a sostener la operación: equipo, abastecimiento, tareas, sistemas y coordinación.',
             'li': ['Definir la estructura operativa.', 'Planificar compras y proveedores.', 'Preparar procedimientos y capacitar.', 'Probar el servicio antes de abrir.']},
            {'label': 'Varias sucursales', 'h3': 'Crecer sin perder consistencia.',
             'p': 'Cuando una marca suma unidades, necesita criterios compartidos y visibilidad sobre cada local. Trabajamos sobre la coordinación y los controles.',
             'li': ['Unificar pedidos y reportes.', 'Coordinar sucursales y producción.', 'Comparar resultados por unidad.', 'Dar seguimiento a los desvíos.']},
        ],
    },
    'method': {
        'label': 'Metodología', 'h2': 'Del diagnóstico <em>a la práctica.</em>',
        'intro': 'El objetivo es que cada propuesta pueda llevarse al trabajo cotidiano y sostenerse con tu equipo.',
        'steps': [
            ('Diagnóstico', 'Escuchar y relevar', 'Entiendo tu negocio, recorro los procesos y reviso la información disponible.'),
            ('Planificación', 'Definir el plan', 'Ordenamos prioridades, entregables, responsables y plazos de trabajo.'),
            ('Implementación', 'Implementar juntos', 'Acompaño la puesta en marcha de controles, rutinas y herramientas con tu equipo.'),
            ('Seguimiento', 'Medir y ajustar', 'Revisamos avances, identificamos desvíos y ajustamos lo que haga falta.'),
        ],
    },
    'modes': {
        'label': 'Alcance a medida', 'h2': 'Formas de <em>trabajar juntos.</em>',
        'items': [
            ('Diagnóstico puntual', 'Para entender dónde estás', 'Una revisión enfocada de tu operación. Identificación de los puntos críticos y una hoja de ruta con prioridades.'),
            ('Proyecto de mejora', 'Para resolver una necesidad', 'Intervención sobre un área concreta: costos, stock, servicio, equipos, apertura o coordinación de sucursales.'),
            ('Acompañamiento', 'Para sostener el cambio', 'Seguimiento de indicadores, reuniones de gestión y ajustes para consolidar el trabajo con tu equipo.'),
        ],
        'note': 'El alcance, los plazos y los honorarios se definen según el punto de partida y las necesidades del proyecto.',
    },
    'career': {
        'label': 'Experiencia operativa y trayectoria', 'h2': 'Gerente gastronómico',
        'intro': 'Más de 15 años de experiencia en operaciones, liderazgo de equipos y gestión de servicios. Restaurantes, cafeterías, producción y eventos de gran escala.',
        'blocks': [
            ('Gestión con presencia en la operación', ['Planificación del servicio, coordinación de personas, control de costos, compras, abastecimiento y seguimiento de resultados. Mi trabajo combina organización, decisiones en tiempo real y atención a la experiencia del cliente.']),
            ('Restaurantes y eventos', ['Gerencia en El Cóndor Coffee Shop y Puerto de Palos, con operaciones en el Casino Central y el Centro Comercial del Puerto. Coordinación de producción de panificados y servicios gastronómicos para espectáculos.',
                                        'Experiencia en barras para eventos multitudinarios, equipos de hasta 135 personas, reposición, despacho, atención VIP y sistemas de cobro sin efectivo.']),
        ],
        'timeline': [
            ('2026 · El Cóndor Coffee Shop', 'Gerente general operativo', 'Coordinación de sucursales y fábrica, organización de equipos y procesos, seguimiento de costos, stock, pedidos y calidad de servicio.'),
            ('Desde 2023 · Puerto de Palos', 'Del liderazgo de salón a la gerencia', 'Ingreso como supervisor gastronómico en el Casino Central en marzo de 2023 y posterior crecimiento hacia la gerencia. En 2024, incorporación de la sucursal del Centro Comercial del Puerto y la planta de panificados a las responsabilidades de gestión.'),
            ('Desarrollo comercial · Sector cervecero', 'Encargado, jefe de ventas y coordinador de proyectos', 'Cinco años de trayectoria en una cervecería de Mar del Plata. Desarrollo comercial, primera exportación de la empresa y venta de franquicias en Comodoro Rivadavia, San Juan y Malargüe.'),
            ('Primeros pasos · Gastronomía y espectáculos', 'Encargado de bar de shows musicales', 'Inicio del recorrido profesional en la organización del servicio y la coordinación operativa.'),
        ],
        'source': 'Trayectoria y actividad profesional:',
        'press_h': 'Gastronomía en los medios',
        'pubs_h': 'Publicaciones sobre gestión del personal',
        'pubs_intro': 'Doctrina sobre Derecho Laboral vinculada a la gestión de equipos: licencias, control médico y procedimientos disciplinarios.',
        'training': [
            ('Universidad Kennedy · En curso', 'Abogacía — tercer año', 'Formación universitaria en Derecho.'),
            ('Formación tecnológica', 'Analista de Sistemas', 'Formación en análisis de sistemas informáticos.'),
            ('Academia Gastro Argentina', 'Gerenciamiento Gastronómico', 'Curso completado · 3 de mayo de 2024'),
            ('Academia Gastro Argentina', 'Recursos Humanos de la Gastronomía', 'Curso completado · 24 de mayo de 2024'),
            ('Academia Gastro Argentina', 'Asesor Gastronómico', 'Curso completado · 22 de junio de 2024'),
            ('United Nations Volunteers (UNV)', 'BSAFE', ''),
            ('United Nations Volunteers (UNV)', 'Conflict Management', ''),
        ],
    },
    'faq': [
        ('¿El asesoramiento es solo para negocios que tienen problemas?', 'También puede servir para preparar una apertura, ordenar una etapa de crecimiento o profesionalizar una operación que ya funciona. El alcance se define según lo que necesites resolver.'),
        ('¿Podés trabajar sobre un área puntual?', 'Sí. Podemos enfocarnos en costos y stock, organización de equipos, servicio, compras, aperturas o coordinación de sucursales. Si hace falta una mirada más amplia, la planteamos durante el diagnóstico.'),
        ('¿Qué necesito para empezar?', 'Una conversación sobre el negocio y la información que tengas disponible. Según el proyecto, podemos revisar ventas, compras, inventarios, costos, organización del personal y procedimientos actuales.'),
        ('¿Incluye recursos humanos y procedimientos disciplinarios?', 'Sí. Podemos trabajar sobre selección, incorporación, roles, turnos, capacitación y seguimiento del personal; también sobre microprocedimientos operativos y circuitos internos para registrar y evaluar incumplimientos. Las decisiones con impacto laboral se coordinan con tu gerencia y el asesor laboral de la empresa.'),
        ('¿La propuesta incluye implementación?', 'Puede incluirla. Antes de comenzar dejamos definido si el trabajo comprende diagnóstico, diseño de herramientas, capacitación, puesta en marcha y seguimiento, y qué participación tendrá tu equipo.'),
        ('¿Cómo se define el presupuesto?', 'Se define después de conocer el tipo de negocio, la cantidad de unidades y el alcance. La propuesta detalla el trabajo, los entregables, los plazos y los honorarios antes de comenzar.'),
    ],
    'bridge': {
        'label': 'Gestión + tecnología', 'h2': 'La operación también puede trabajar más inteligente.',
        'p': 'Cuando el proceso lo necesita, sumo automatización e inteligencia artificial para ordenar información, preparar reportes y reducir tareas repetitivas.',
        'link': 'Conocé los servicios de automatización e IA',
    },
    'contact': {
        'label': 'Solicitar asesoramiento', 'h2': 'Hablemos de <em>tu negocio.</em>',
        'p': 'Contame qué tipo de negocio tenés, en qué etapa está y qué necesitás mejorar. El primer paso es entender la operación y definir dónde puedo aportar valor.',
        'place': 'Mar del Plata, Argentina · Modalidad a definir según el proyecto.',
    },
    'jobs': {
        'label': 'Sumate al equipo', 'h2': 'Trabajá conmigo',
        'p': 'Si querés formar parte de los equipos gastronómicos que coordino en Mar del Plata, enviá tu CV e indicá el puesto que te interesa, tu experiencia y disponibilidad horaria.',
        'help': 'El botón abre tu correo. Adjuntá tu CV antes de enviarlo.',
        'mailto': 'mailto:rrhhmdpgastronomia@gmail.com?subject=Postulaci%C3%B3n%20laboral%20-%20Gastronom%C3%ADa&body=Hola%2C%20quiero%20postularme%20para%20el%20puesto%20de%3A%0A%0ANombre%3A%0AExperiencia%3A%0ADisponibilidad%20horaria%3A%0ATel%C3%A9fono%3A%0A%0AAdjunto%20mi%20CV.',
    },
}

# ---------------------------------------------------------------- automatización e IA: página

IA_PAGE = {
    'hero_label': 'IA y optimización de procesos para empresas',
    'hero_fine': 'Primero el proceso. Después, la herramienta adecuada.',
    'value': {
        'label': 'Soluciones tecnológicas',
        'h2': 'Menos tareas repetidas. <em>Más capacidad.</em>',
        'lead': 'Diseño soluciones de organización, automatización e inteligencia artificial para que tu empresa ordene información, simplifique tareas y trabaje con mejores procesos.',
        'quote': 'Incorporo IA con criterio: donde ahorra tiempo real y donde la información ayuda a decidir mejor. Sin promesas mágicas.',
        'sub_h': 'La tecnología sirve cuando resuelve algo.',
        'paras': ['Copiar datos de un sistema a otro, buscar documentos, responder las mismas consultas o armar reportes a mano consume tiempo que tu equipo podría dedicar a tareas de mayor valor.',
                  'Trabajo sobre esos procesos para identificar qué conviene simplificar, qué puede automatizarse y dónde la IA aporta una mejora concreta. La solución se define según tus herramientas, tu información y las personas que la van a usar.'],
        'sectors': ['Para empresas de cualquier sector', 'Administración', 'Ventas', 'Operaciones', 'Personas'],
        'principles': [('Alcance definido', 'Cada solución empieza con una tarea y un objetivo concreto.'),
                       ('Control humano', 'Los puntos de revisión forman parte del diseño del proceso.'),
                       ('Información cuidada', 'Se acuerdan fuentes, accesos y pautas de uso de los datos.')],
    },
    'services_head': {
        'label': 'Automatizaciones para empresas',
        'h2': 'Procesos más claros. <em>Herramientas que se usan.</em>',
        'intro': 'Proyectos acotados y objetivos definidos. Desde detectar una oportunidad hasta acompañar su puesta en marcha.',
        'note': 'Cada solución se evalúa y se desarrolla según la viabilidad del proyecto: las herramientas que ya usa tu empresa, sus posibilidades de integración y la información disponible.',
    },
    'categories': [
        {'id': 'ia-aplicada', 'name': 'IA aplicada a la empresa',
         'desc': 'Asistentes, conocimiento interno y respuestas asistidas, con contexto y criterios de revisión.',
         'items': [IA['services'][0], IA['services'][15], IA['services'][2], IA['services'][3], 'Capacitación y adopción de IA.'],
         'detail': [('Asistentes internos y conocimiento', 'Diseño de asistentes para consultar procedimientos, preparar borradores y encontrar información de trabajo. Definición de qué pueden responder y cuándo deben derivar a una persona.', 'casos de uso · base documental · pautas de respuesta'),
                    ('Capacitación y adopción de IA', 'Formación práctica para aplicar herramientas de IA al trabajo cotidiano. Ejercicios sobre tareas del equipo, criterios para revisar respuestas y pautas de uso de la información.', 'talleres aplicados · guías de uso · acompañamiento inicial')],
         'form': 'IA aplicada'},
        {'id': 'procesos', 'name': 'Automatización de procesos',
         'desc': 'Ordenar circuitos de trabajo, reducir tareas repetitivas y conectar información con reglas claras.',
         'items': [IA['services'][1], IA['services'][12], IA['services'][6], IA['services'][14]],
         'detail': [('Diagnóstico y rediseño de procesos', 'Relevamiento de tareas, circuitos de información y trabajos repetitivos. Identificación de cuellos de botella y oportunidades para simplificar antes de incorporar tecnología.', 'mapa de procesos · prioridades · hoja de ruta'),
                    ('Automatización administrativa', 'Diseño de flujos para organizar datos, documentos, correos, solicitudes y recordatorios. Evaluación de cómo conectar las herramientas existentes según sus posibilidades de integración.', 'flujo de trabajo · reglas de validación · documentación')],
         'form': 'Automatización de procesos'},
        {'id': 'integraciones', 'name': 'Integraciones y canales',
         'desc': 'Conectar las herramientas que ya usa la empresa y ordenar la atención por los canales donde llegan las consultas.',
         'items': [IA['services'][4], IA['services'][5], IA['services'][11], IA['services'][13]],
         'detail': [('Atención y comunicación', 'Organización de consultas frecuentes, respuestas asistidas y circuitos de derivación. Un tono consistente con tu empresa y revisión humana en situaciones que requieren criterio.', 'guías de respuesta · circuitos de atención · criterios de derivación')],
         'form': 'Integraciones y canales'},
        {'id': 'datos', 'name': 'Datos, indicadores y personas',
         'desc': 'Reportes, resúmenes y alertas para transformar información dispersa en una lectura útil del negocio.',
         'items': [IA['services'][7], IA['services'][8], IA['services'][9], IA['services'][10]],
         'detail': [('Reportes e información para decidir', 'Organización de fuentes y preparación de resúmenes, reportes y alertas. Definición de qué información necesita cada responsable, con criterios de revisión y trazabilidad.', 'estructura de reporte · fuentes definidas · criterios de control')],
         'form': 'Datos e indicadores'},
    ],
    'cases': {
        'id': 'casos', 'label': 'Casos reales',
        'h2': 'Automatizaciones que ya <em>funcionan todos los días.</em>',
        'intro': 'Dos procesos en marcha en operaciones gastronómicas, con datos del sistema de gestión de cada local. Se cuentan sin nombres ni cifras internas.',
        'items': [
            {'k': 'Restaurante con varios salones · Operación diaria',
             'h3': 'Asignación de salones según el desempeño de cada camarero.',
             'need': 'Asignar a los camareros a los salones de cada turno con un criterio comercial parejo y conocido por todos.',
             'how': 'Cada mañana, un proceso toma las ventas del día anterior del sistema de gestión, calcula un ranking con indicadores acordados (facturación por cubierto, ticket promedio y venta de productos clave) y propone qué camarero va a cada salón en el turno del mediodía y de la noche. El encargado carga la disponibilidad del equipo en una página web y recibe la propuesta por email.',
             'result': 'La asignación se apoya en datos, con los mismos criterios para todos, y la decisión final sigue siendo del encargado.',
             'tags': ['Sistema de gestión', 'Ranking por indicadores', 'Email diario', 'Página para el encargado']},
            {'k': 'Cafetería · Ventas',
             'h3': 'Ranking semanal de ventas para premiar al equipo.',
             'need': 'Premiar cada semana a quien más vende un producto, con un conteo claro y sin trabajo manual.',
             'how': 'Todos los lunes se toman las ventas de la semana anterior del sistema de gestión, se suman las unidades de cada camarero, incluidas las que van dentro de promociones, y se envía el ranking completo por email al responsable.',
             'result': 'El ganador y el ranking llegan solos cada lunes, con los datos del sistema.',
             'tags': ['Sistema de gestión', 'Conteo automático', 'Email semanal']},
        ],
        'note': 'Casos propios, en funcionamiento. Se omiten los nombres de los locales y del personal.',
    },
    'examples': {
        'id': 'aplicaciones', 'label': 'Ejemplos prácticos de IA',
        'h2': 'Empezar por una tarea. <em>Hacerla funcionar mejor.</em>',
        'intro': 'Estos ejemplos muestran posibles aplicaciones. Su viabilidad depende de la información, las herramientas y el alcance de cada proyecto.',
        'flow': {
            'h3': 'Así se conecta un proceso.',
            'nodes': [('01 / Información de origen', 'Datos que tu empresa ya genera', 'Correos · Planillas · Pedidos · Documentos'),
                      ('02 / Un proceso definido', 'Organizar. Analizar. Validar.', 'IA + reglas de tu negocio'),
                      ('03 / Resultado', 'Información lista para revisar', ''),
                      ('04 / Decisión', 'Tu equipo mantiene el control', '')],
            'caption': ('Ejemplo ilustrativo', 'El alcance se define en el diagnóstico.'),
        },
        'items': [
            {'label': 'Ejemplo ilustrativo · Administración', 'h3': 'De información dispersa a un circuito claro.',
             'p': 'Una solicitud que llega por correo puede ordenarse, clasificarse y convertirse en una tarea para el responsable, con los controles que el proceso necesite.',
             'li': ['Recibir y clasificar una solicitud.', 'Extraer los datos necesarios.', 'Validar la información y asignar.', 'Preparar un resumen para revisión.'], 'area': 'Administración'},
            {'label': 'Ejemplo ilustrativo · Operaciones', 'h3': 'De reportes sueltos a una lectura útil.',
             'p': 'En una empresa con varias unidades, un flujo puede organizar los reportes disponibles, señalar datos faltantes y preparar una síntesis para la revisión del responsable.',
             'li': ['Reunir reportes de cada unidad.', 'Detectar información incompleta.', 'Preparar un resumen de desvíos.', 'Revisar antes de tomar decisiones.'], 'area': 'Operaciones'},
            {'label': 'Ejemplo ilustrativo · Atención', 'h3': 'Responder con contexto y un criterio común.',
             'p': 'Una base de respuestas y un circuito de derivación pueden ayudar a resolver consultas frecuentes y reservar la intervención del equipo para situaciones específicas.',
             'li': ['Identificar el motivo de la consulta.', 'Consultar información autorizada.', 'Preparar una respuesta consistente.', 'Derivar lo que requiere una persona.'], 'area': 'Ventas y atención'},
        ],
        'note': 'Ejemplos de diseño de procesos. No se presentan como casos de clientes ni como resultados ya obtenidos.',
    },
    'departments': {
        'id': 'departamentos', 'label': 'Soluciones por departamento',
        'h2': 'Cada área de la empresa, <em>con su propia mejora.</em>',
        'intro': 'Las mismas herramientas resuelven necesidades distintas según quién las usa. Estas son posibles líneas de trabajo para evaluar en tu empresa.',
        'tabs': [
            ('administracion', 'Administración', 'Tareas de oficina repetitivas resueltas de forma ordenada y verificable.',
             [IA['services'][1], IA['services'][12], 'Organización de datos, documentos, correos, solicitudes y recordatorios.', 'Preparación de resúmenes para revisión.']),
            ('ventas', 'Ventas', 'Consultas atendidas a tiempo e información comercial ordenada.',
             [IA['services'][8], IA['services'][4], IA['services'][11], 'Respuestas asistidas y circuitos de derivación.']),
            ('operaciones', 'Operaciones', 'Procesos mapeados, simplificados y llevados a herramientas digitales.',
             [IA['services'][6], IA['services'][14], IA['services'][5], IA['services'][13]]),
            ('rrhh', 'RR. HH.', 'Ordeno la estructura y la documentación para que encargados y dueños sepan quién hace qué y cómo se registra.',
             [IA['services'][9], IA['services'][10], 'Asistentes para consultar procedimientos internos.', 'Capacitación y adopción de IA.']),
            ('gerencia', 'Gerencia', 'Tableros claros para ver qué pasa en el negocio sin perseguir planillas.',
             [IA['services'][7], IA['services'][8], 'Resúmenes, reportes y alertas para cada responsable.', IA['services'][0]]),
        ],
    },
    'method': {
        'label': 'Proceso de trabajo', 'h2': 'Un proceso de mejora. <em>De principio a uso real.</em>',
        'intro': 'Cinco etapas para que cada solución llegue al trabajo cotidiano y se sostenga en el tiempo.',
        'steps': [
            ('Diagnóstico', 'Entender la tarea', 'Relevo el proceso actual, sus responsables, herramientas y puntos de fricción.'),
            ('Diseño', 'Definir una solución', 'Acordamos el alcance, los datos necesarios y los criterios para evaluar si funciona.'),
            ('Desarrollo', 'Probar y ajustar', 'Preparamos un piloto acotado, validamos sus resultados y corregimos con el equipo.'),
            ('Implementación', 'Documentar y acompañar', 'Dejamos instrucciones de uso, responsables y una forma de revisar su funcionamiento.'),
            ('Mantenimiento', 'Sostener el cambio', 'Seguimiento del uso, revisión de resultados y ajustes para que las herramientas se integren al trabajo cotidiano.'),
        ],
    },
    'modes': {
        'label': 'Alcance a medida', 'h2': 'Formas de <em>trabajar juntos.</em>',
        'items': [
            ('Diagnóstico puntual', 'Para entender dónde estás', 'Relevamiento de un proceso, oportunidades de mejora y evaluación de qué conviene automatizar.'),
            ('Proyecto de mejora', 'Para resolver una necesidad', 'Diseño y puesta en marcha de un flujo de trabajo acotado, con pruebas, documentación y capacitación.'),
            ('Acompañamiento', 'Para sostener el cambio', 'Seguimiento del uso, revisión de resultados y ajustes para que las herramientas se integren al trabajo cotidiano.'),
        ],
        'note': 'El alcance, los plazos y los honorarios se definen según el punto de partida y las necesidades del proyecto.',
    },
    'research': {
        'label': 'Investigación y publicaciones', 'h2': 'Inteligencia Artificial <em>y Derecho.</em>',
        'intro': 'Transparencia algorítmica, garantías y responsabilidad pública. Un espacio de investigación, publicaciones y análisis jurídico.',
        'about_h': 'Sobre mí', 'about_h2': 'Trayectoria, enfoque y línea de trabajo',
        'about': [('Perfil', 'Ezequiel Brunner es estudiante de Abogacía en la Universidad Kennedy y autor enfocado en inteligencia artificial, derecho y transparencia algorítmica. Su trabajo se centra en el análisis de los desafíos jurídicos que plantea la tecnología, con especial interés en la regulación, las decisiones automatizadas y el impacto institucional de la IA.'),
                  ('Enfoque y desarrollo', 'Ha desarrollado publicaciones y análisis sobre estas materias, combinando reflexión jurídica, actualidad tecnológica y observación crítica de los cambios que la inteligencia artificial introduce en el ámbito normativo y social. Su interés está puesto en construir una mirada clara, seria y accesible sobre debates que ya no pertenecen al futuro, sino al presente del derecho.')],
        'training': [
            ('Formación tecnológica', 'Analista de Sistemas', 'Formación en análisis de sistemas informáticos.'),
            ('Universidad Kennedy · En curso', 'Abogacía — tercer año', 'Formación universitaria en Derecho.'),
            ('Redes informáticas', 'Administrador de Redes SOHO', ''),
            ('Informática', 'Reparación de PC', ''),
            ('United Nations Volunteers (UNV)', 'Information Security Awareness', ''),
        ],
    },
    'faq': [
        ('¿Tengo que cambiar los sistemas que uso?', 'No necesariamente. Primero revisamos las herramientas existentes y sus posibilidades de integración. Si hace falta sumar una herramienta o un desarrollo, se explica y se presupuesta dentro del alcance.'),
        ('¿Toda mejora necesita inteligencia artificial?', 'No. Algunas tareas se resuelven mejor con un procedimiento claro, una plantilla o una automatización simple. La IA se incorpora cuando aporta valor al proceso y puede revisarse su resultado.'),
        ('¿Por dónde conviene empezar?', 'Por una tarea repetitiva, frecuente y de alcance acotado. Acordamos qué problema se busca resolver, qué información hace falta y cómo se va a evaluar el piloto antes de extenderlo.'),
        ('¿Qué pasa con los datos de mi empresa?', 'El diseño debe definir qué información se usa, quién accede y en qué herramientas. Antes de implementar, se acuerdan permisos, fuentes y pautas de manejo de la información según el proyecto.'),
        ('¿La IA puede tomar todas las decisiones?', 'El proyecto define qué tareas puede asistir o ejecutar la herramienta y qué requiere revisión. Las decisiones sensibles y las excepciones necesitan responsables y criterios claros de intervención.'),
        ('¿Las herramientas externas están incluidas?', 'Las suscripciones, licencias y consumos que pueda necesitar una solución se identifican antes de implementar. El presupuesto distingue esos costos del trabajo de diagnóstico, diseño y acompañamiento.'),
    ],
    'bridge': {
        'label': 'La experiencia también cuenta', 'h2': 'Gestión real. Una base para pensar procesos.',
        'p': 'Mi experiencia en operaciones gastronómicas aporta una mirada práctica sobre equipos, circuitos de trabajo, coordinación e información para decidir.',
        'link': 'Conocé el asesoramiento gastronómico',
    },
    'contact': {
        'label': 'Evaluar mi empresa', 'h2': 'Empecemos por <em>un proceso.</em>',
        'p': 'Contame qué tarea te consume tiempo, dónde se repite el trabajo o qué información necesitás ordenar. A partir de ahí, evaluamos una solución concreta.',
        'place': 'Mar del Plata, Argentina · Modalidad a definir según el proyecto.',
    },
}

# ---------------------------------------------------------------- portada (2026)
# Lo justo para elegir: una promesa por área y dos datos acreditados. El catálogo vive en cada página.

HOME = {
    # portada cinematográfica (textos del brief de Ezequiel)
    'name': ('Ezequiel', 'Brunner'),
    'claim': ('Operaciones reales.', 'Tecnología que resuelve.'),
    'sub': 'Dirección gastronómica, optimización de procesos y automatización inteligente.',
    'doors': {
        'gastronomia': {'k': '01', 'title': 'Gastronomía', 'sub': 'Dirección, operación y gestión de establecimientos.', 'go': 'Entrar'},
        'automatizacion': {'k': '02', 'title': 'Automatización &amp; Inteligencia Artificial', 'title_m': 'Automatización &amp; IA',
                           'sub': 'Procesos más simples, equipos más eficientes y decisiones con información.', 'go': 'Entrar'},
    },
    'strip': [('#trayectoria', 'Trayectoria', '15+ años en operaciones gastronómicas'),
              ('#publicaciones', 'Producción académica', 'Doctrina en SAIJ · Dossier n.º 335 · SSRN'),
              ('#contacto', 'Contacto', 'WhatsApp · email')],
}

ABOUT = {
    'label': 'Sobre mí',
    'h2': 'Una mirada construida en <em>la operación.</em>',
    'manifesto': 'Vengo de la operación: salones, cocinas, sucursales y equipos. Por eso uso la tecnología donde le <em>simplifica el trabajo a las personas</em>, y no donde suma complejidad.',
    'chapters': [
        ('01', 'Operación', 'Más de 15 años en gastronomía: del liderazgo de salón a la gerencia de restaurantes, cafeterías, producción y eventos de gran escala.'),
        ('02', 'Tecnología', 'Formación en análisis de sistemas y automatizaciones propias que hoy ordenan información en operaciones gastronómicas.'),
        ('03', 'Derecho', 'Estudiante de Abogacía en la Universidad Kennedy. Doctrina publicada en SAIJ sobre transparencia algorítmica y Derecho Laboral.'),
    ],
    'note': 'No ejerzo como abogado matriculado.',
}

# ---------------------------------------------------------------- gastronomía: «Detrás de cada servicio hay una operación»

NARRATIVE = {
    'id': 'operacion', 'label': 'Detrás de escena',
    'h2': 'Detrás de cada servicio hay <em>una operación.</em>',
    'word': 'operación',
    'pillars': [
        {'k': 'personas', 'name': 'Personas', 'h3': 'Equipos que saben qué hacer.',
         'p': 'Selección, roles, turnos y capacitación, con criterios compartidos por encargados y supervisores. Equipos de hasta 135 personas en eventos de gran escala.',
         'items': ['Perfiles y selección', 'Roles, turnos y francos', 'Capacitación de encargados']},
        {'k': 'procesos', 'name': 'Procesos', 'h3': 'Rutinas claras en cada turno.',
         'p': 'Microprocedimientos para abrir, servir, cerrar y registrar: qué se hace, quién lo hace, cuándo y cómo se controla.',
         'items': ['Apertura', 'Servicio', 'Cierre', 'Registro']},
        {'k': 'costos', 'name': 'Costos', 'h3': 'Saber qué deja cada venta.',
         'p': 'Costeo de productos, precios, compras, stock y mermas. El costo de mercadería vendida como punto de partida para decidir.',
         'items': ['Inventario inicial', '+ Compras', '− Inventario final', '= CMV']},
        {'k': 'resultados', 'name': 'Resultados', 'h3': 'Información para decidir a tiempo.',
         'p': 'Indicadores de gestión y tableros de control para ver qué pasa en cada local sin perseguir planillas.',
         'items': ['Ventas por turno', 'Costo de mercadería', 'Mermas', 'Horas de personal']},
    ],
    'close': 'El servicio se ve. <em>La gestión lo sostiene.</em>',
}

# ---------------------------------------------------------------- gastronomía: los siete ejes de la gestión
# Cada eje reúne servicios y textos que ya estaban publicados; los datos acreditados salen de la trayectoria.

AXES = {
    'id': 'operacion', 'label': 'La operación',
    'h2': 'Detrás de cada servicio hay <em>una operación.</em>',
    'intro': 'Siete ejes para dirigir un negocio gastronómico: desde la conducción diaria hasta la apertura de una nueva unidad. Cada uno con lo que incluye, lo que se entrega y cómo se trabaja.',
    'close': 'El servicio se ve. <em>La gestión lo sostiene.</em>',
    'items': [
        {'k': 'direccion', 'name': 'Dirección gastronómica', 'form': 'Dirección gastronómica',
         'h3': 'Conducir el negocio con presencia en la operación.',
         'p': 'Planificación del servicio, coordinación de personas, control de costos, compras, abastecimiento y seguimiento de resultados. Organización, decisiones en tiempo real y atención a la experiencia del cliente.',
         'li': [GAS['services'][0], GAS['services'][1], GAS['services'][2]],
         'out': 'diagnóstico · plan de acción · reuniones de gestión',
         'fact': 'Gerencia en El Cóndor Coffee Shop y Puerto de Palos, con operaciones en el Casino Central y el Centro Comercial del Puerto.',
         'vis': 'photo-ops', 'anchors': ['cat-diagnostico', 'diagnostico']},
        {'k': 'sucursales', 'name': 'Establecimientos y sucursales', 'form': 'Establecimientos y sucursales',
         'h3': 'Varias unidades, una misma forma de trabajar.',
         'p': 'Estandarización de pedidos, producción, compras, reportes y controles entre sucursales y fábrica, para comparar unidades y corregir desvíos a tiempo.',
         'li': ['Procesos y gestión de varias unidades.', GAS['services'][10], GAS['services'][13]],
         'out': 'procedimientos operativos · controles por unidad · tablero de seguimiento',
         'fact': 'Coordinación de sucursales y fábrica como gerente general operativo.',
         'vis': 'units', 'anchors': ['tu-negocio-sucursales']},
        {'k': 'equipos', 'name': 'Liderazgo de equipos', 'form': 'Liderazgo de equipos',
         'h3': 'Equipos que saben qué hacer.',
         'p': 'Selección, roles, turnos, capacitación y seguimiento del personal, con criterios compartidos por encargados y supervisores. Un circuito claro también para los incumplimientos.',
         'li': [GAS['services'][7], GAS['services'][8], GAS['services'][9], 'Procedimientos disciplinarios con revisión del asesor laboral de la empresa.'],
         'out': 'perfiles de puesto · guía de incorporación · plan de capacitación',
         'fact': 'Equipos de hasta 135 personas en eventos multitudinarios.',
         'vis': 'photo-team', 'anchors': ['cat-equipos', 'recursos-humanos', 'gestion-del-personal', 'procedimientos-disciplinarios', 'equipo'],
         'scope': 'Alcance: se trata de consultoría operativa y administrativa. No constituye asesoramiento jurídico, que corresponde a profesionales matriculados.'},
        {'k': 'costos', 'name': 'Costos y rentabilidad', 'form': 'Costos y rentabilidad',
         'h3': 'Saber qué deja cada venta.',
         'p': 'Costeo de productos, revisión de precios, costo de mercadería vendida, inventarios, mermas y abastecimiento: información para entender dónde se genera margen y dónde se pierde.',
         'li': [GAS['services'][3], GAS['services'][4], GAS['services'][5]],
         'out': 'fichas de costos · circuitos de stock · indicadores de seguimiento',
         'vis': 'calc', 'anchors': ['cat-costos', 'costos']},
        {'k': 'procesos', 'name': 'Optimización de procesos', 'form': 'Optimización de procesos',
         'h3': 'Rutinas claras en cada turno.',
         'p': 'Microprocedimientos para abrir, servir, cerrar y registrar: qué se hace, quién lo hace, cuándo y cómo se controla. Cuando el proceso lo pide, sumo automatización.',
         'li': [GAS['services'][6], 'Microprocedimientos: apertura, cierre, consumos internos, caja, pedidos y mermas.', 'Registro de incidentes y comunicación entre áreas.'],
         'out': 'fichas de una página · listas de verificación · registros de control',
         'vis': 'flow', 'anchors': ['cat-procesos', 'microprocedimientos', 'procesos', 'capas']},
        {'k': 'cliente', 'name': 'Experiencia del cliente', 'form': 'Experiencia del cliente',
         'h3': 'Que el servicio acompañe la propuesta.',
         'p': 'Revisión del recorrido del cliente, coordinación del servicio y oportunidades comerciales. Para eventos: planificación de barras, personal, abastecimiento, reposición y cobro.',
         'li': [GAS['services'][14], 'Plan de servicio y coordinación entre cocina, barra y salón.', 'Eventos: barras, reposición, atención VIP y cobro sin efectivo.'],
         'out': 'plan de servicio · organización operativa · seguimiento de la ejecución',
         'fact': 'Experiencia en barras para eventos multitudinarios, con atención VIP y sistemas de cobro sin efectivo.',
         'vis': 'journey', 'anchors': ['servicio']},
        {'k': 'aperturas', 'name': 'Aperturas y desarrollo', 'form': 'Aperturas y franquicias',
         'h3': 'Llegar al primer servicio con un plan.',
         'p': 'Acompañamiento operativo desde la planificación hasta la puesta en marcha: equipo, proveedores, compras, sistemas y pruebas de servicio antes de abrir. Y, para crecer, desarrollo y gestión de franquicias.',
         'li': [GAS['services'][11], GAS['services'][12]],
         'out': 'plan de preapertura · lista de verificación · seguimiento inicial',
         'fact': 'Primera exportación de una cervecería de Mar del Plata y venta de franquicias en Comodoro Rivadavia, San Juan y Malargüe.',
         'vis': 'opening', 'anchors': ['aperturas']},
    ],
}

# ---------------------------------------------------------------- automatización: demostración interactiva (ficticia)

DEMO = {
    'id': 'demo', 'label': 'Demostración interactiva',
    'h2': 'Así trabaja <em>una automatización.</em>',
    'intro': 'Elegí un proceso administrativo y recorré sus cinco etapas: cómo ingresa la información, cómo se ordena y se procesa, qué alerta aparece y qué decide la persona.',
    'badge': 'Ejemplo ficticio · datos de muestra',
    'names': ['Ingreso', 'Registro', 'Procesamiento', 'Alerta', 'Decisión humana'],
    'keys': ['ingreso', 'registro', 'procesamiento', 'alerta', 'decision'],
    'note': 'Demostración ficticia con datos de muestra. No representa a un cliente ni un resultado obtenido.',
    'procs': [
        {'k': 'reposicion', 'name': 'Reposición de stock', 'area': 'Operaciones',
         'problem': 'Los pedidos de las sucursales llegan por distintos canales y se controlan a mano.',
         'stages': [
             {'h3': 'Llega el pedido.', 'what': 'Una sucursal pide reposición por WhatsApp o por email, como lo hace siempre.',
              'before': 'Alguien lo lee, lo copia y lo reenvía a mano.', 'after': 'El mensaje entra a un canal único y queda registrado con fecha y hora.',
              'human': 'La sucursal escribe como siempre: no cambia su forma de pedir.'},
             {'h3': 'Los datos quedan ordenados.', 'what': 'Se identifican la sucursal, los productos, las cantidades y la fecha de entrega.',
              'before': 'Cada pedido queda en un chat distinto.', 'after': 'Los datos pasan a una planilla o a un sistema, sin copiar y pegar.',
              'human': 'El encargado revisa lo que no se pudo interpretar.'},
             {'h3': 'Se aplican las reglas.', 'what': 'Cada producto se compara con el stock disponible y con el consumo habitual de la sucursal.',
              'before': 'Los controles dependen de quién atienda el pedido.', 'after': 'Las mismas reglas se aplican siempre y las excepciones quedan marcadas.',
              'human': 'Las reglas las define la empresa y se pueden ajustar.'},
             {'h3': 'Una alerta, con su contexto.', 'what': 'El aceite pedido duplica el consumo habitual. Se prepara un resumen con el pedido, la alerta y el historial.',
              'before': 'Para decidir hay que buscar la información en varios lugares.', 'after': 'El responsable recibe todo en un mismo lugar.',
              'human': 'Lee el resumen y ve la alerta antes de aprobar.'},
             {'h3': 'La persona decide.', 'what': 'El responsable aprueba o ajusta. Su decisión queda registrada y se avisa a la sucursal.',
              'before': 'Las decisiones quedan sin registro.', 'after': 'Cada decisión queda registrada y se comunica sola.',
              'human': 'La herramienta propone; la decisión final es de una persona.'}],
         'sample': {'from': 'Sucursal Centro', 'channel': 'WhatsApp', 'time': 'Jueves · 09:12',
                    'msg': 'Hola, para el sábado necesitamos 12 kg de harina, 6 L de aceite y 40 vasos. Gracias.',
                    'id': 'Pedido R-0412', 'cap': 'Sucursal Centro · entrega sábado',
                    'rows': [['Harina', '12 kg', 'ok', 'Dentro del consumo habitual'], ['Aceite', '6 L', 'alert', 'El doble del consumo habitual'], ['Vasos', '40 u.', 'ok', 'Dentro del consumo habitual']],
                    'rcap': '3 productos · 1 alerta', 'alert': 'Aceite: el pedido duplica el consumo habitual de la sucursal.',
                    'bars': [.42, .48, .4, .46, .92], 'fine': 'Consumo semanal de aceite · últimas 5 semanas'},
         'decide': [['ok', 'Aprobar el pedido', 'Pedido aprobado · aviso enviado a Sucursal Centro', 'pedido aprobado tal como llegó.'],
                    ['adj', 'Ajustar el aceite a 3 L', 'Aceite ajustado a 3 L · pedido aprobado y aviso enviado', 'aceite ajustado a 3 L y pedido aprobado.']]},
        {'k': 'facturas', 'name': 'Facturas de proveedores', 'area': 'Administración',
         'problem': 'Las facturas se cargan a mano y los aumentos de precio se descubren tarde.',
         'stages': [
             {'h3': 'Llega la factura.', 'what': 'El proveedor envía la factura en PDF al correo de compras, como siempre.',
              'before': 'Alguien la descarga, la abre y la tipea en una planilla.', 'after': 'La factura entra a una carpeta única y queda registrada al llegar.',
              'human': 'El proveedor no cambia nada: sigue enviando su factura.'},
             {'h3': 'Los datos quedan cargados.', 'what': 'Se leen el proveedor, la fecha, los productos, las cantidades y los importes.',
              'before': 'La carga manual tarda y deja errores de tipeo.', 'after': 'Los datos se cargan solos y quedan listos para revisar.',
              'human': 'Administración revisa los datos que no se pudieron leer.'},
             {'h3': 'Se comparan los precios.', 'what': 'Cada precio se compara con la lista acordada y con la última compra del mismo producto.',
              'before': 'Los aumentos se notan cuando ya se pagaron.', 'after': 'Las diferencias quedan marcadas antes del pago.',
              'human': 'La empresa define desde qué diferencia hay que avisar.'},
             {'h3': 'Una alerta antes de pagar.', 'what': 'El queso subió 18 % respecto de la última compra. Se arma un resumen con el historial de precios.',
              'before': 'Para comparar hay que buscar facturas anteriores.', 'after': 'El historial y la diferencia llegan juntos.',
              'human': 'Lee la alerta y decide antes de autorizar el pago.'},
             {'h3': 'La persona decide.', 'what': 'El responsable autoriza el pago o pide una nota de crédito. La decisión queda registrada.',
              'before': 'Los reclamos al proveedor dependen de la memoria.', 'after': 'Cada decisión queda registrada con su motivo.',
              'human': 'La herramienta compara; la decisión de pagar es de una persona.'}],
         'sample': {'from': 'Lácteos del Sur', 'channel': 'Email', 'time': 'Lunes · 08:40',
                    'msg': 'Adjuntamos la factura A 0003-00018422 correspondiente a la entrega del viernes.',
                    'id': 'Factura A-18422', 'cap': 'Lácteos del Sur · vence en 15 días',
                    'rows': [['Queso cremoso', '10 kg', 'alert', '18 % más que la última compra'], ['Crema de leche', '6 L', 'ok', 'Según la lista acordada'], ['Manteca', '5 kg', 'ok', 'Según la lista acordada']],
                    'rcap': '3 productos · 1 alerta', 'alert': 'Queso cremoso: el precio subió 18 % respecto de la última compra.',
                    'bars': [.5, .5, .52, .53, .9], 'fine': 'Precio del queso cremoso · últimas 5 compras'},
         'decide': [['ok', 'Autorizar el pago', 'Pago autorizado · factura registrada', 'pago autorizado con el precio nuevo.'],
                    ['adj', 'Pedir nota de crédito', 'Nota de crédito solicitada · pago en espera', 'se pidió una nota de crédito al proveedor.']]},
        {'k': 'turnos', 'name': 'Cobertura de turnos', 'area': 'RR. HH.',
         'problem': 'Las ausencias llegan a último momento y la cobertura se resuelve a ciegas.',
         'stages': [
             {'h3': 'Llega el aviso.', 'what': 'Una persona del equipo avisa por WhatsApp que no puede cubrir su turno.',
              'before': 'El aviso queda en un chat y el encargado se entera tarde.', 'after': 'El aviso entra a un canal único con fecha y hora.',
              'human': 'El equipo avisa como siempre, por el canal de siempre.'},
             {'h3': 'La ausencia queda registrada.', 'what': 'Se identifican la persona, el turno, el puesto y el motivo informado.',
              'before': 'Las ausencias se anotan cuando alguien se acuerda.', 'after': 'Cada ausencia queda registrada para el seguimiento.',
              'human': 'El encargado confirma el registro.'},
             {'h3': 'Se revisa la grilla.', 'what': 'Se compara el turno con la grilla, los francos y las horas de cada persona disponible.',
              'before': 'Hay que revisar planillas y llamar uno por uno.', 'after': 'Las opciones posibles aparecen ordenadas.',
              'human': 'Los criterios de cobertura los define la empresa.'},
             {'h3': 'Una alerta de cobertura.', 'what': 'La barra del sábado a la noche queda con 2 de 3 personas. Se proponen dos opciones.',
              'before': 'El problema aparece cuando el turno ya empezó.', 'after': 'El responsable lo sabe con tiempo y con opciones.',
              'human': 'Revisa las opciones antes de decidir.'},
             {'h3': 'La persona decide.', 'what': 'El encargado elige cómo cubrir el turno. Su decisión queda registrada y se avisa al equipo.',
              'before': 'Los cambios se comunican por varios chats.', 'after': 'La grilla se actualiza y el aviso sale solo.',
              'human': 'La herramienta propone; quién trabaja lo decide una persona.'}],
         'sample': {'from': 'Equipo de barra', 'channel': 'WhatsApp', 'time': 'Viernes · 18:05',
                    'msg': 'Hola, mañana no voy a poder cubrir mi turno de la noche. Aviso con tiempo. Disculpen.',
                    'id': 'Ausencia T-207', 'cap': 'Sábado · turno noche',
                    'rows': [['Barra', '2 de 3', 'alert', 'Falta una persona'], ['Salón', '6 de 6', 'ok', 'Turno cubierto'], ['Cocina', '4 de 4', 'ok', 'Turno cubierto']],
                    'rcap': '3 puestos · 1 alerta', 'alert': 'Barra: el turno del sábado a la noche queda con 2 de 3 personas.',
                    'bars': [.9, .9, .9, .9, .6], 'fine': 'Cobertura de la barra · últimos 5 sábados'},
         'decide': [['ok', 'Convocar un refuerzo disponible', 'Refuerzo convocado · grilla actualizada', 'se convocó a una persona disponible con horas libres.'],
                    ['adj', 'Reorganizar el turno', 'Turno reorganizado · aviso enviado al equipo', 'se movió una persona de salón a la barra.']]},
        {'k': 'caja', 'name': 'Cierre de caja', 'area': 'Gerencia',
         'problem': 'Las diferencias de caja se detectan días después, cuando ya es difícil explicarlas.',
         'stages': [
             {'h3': 'Llegan los datos del cierre.', 'what': 'El sistema de ventas y el arqueo del encargado se envían al terminar el turno.',
              'before': 'El arqueo queda en un papel o en una foto.', 'after': 'Ventas y arqueo llegan juntos y quedan registrados.',
              'human': 'El encargado hace el arqueo como siempre.'},
             {'h3': 'El cierre queda ordenado.', 'what': 'Se separan las ventas por medio de pago: tarjetas, billeteras virtuales y efectivo.',
              'before': 'Cada local arma el cierre a su manera.', 'after': 'Todos los cierres tienen la misma estructura.',
              'human': 'El encargado completa lo que falta.'},
             {'h3': 'Se concilia.', 'what': 'Cada medio de pago se compara con lo registrado en el sistema de ventas.',
              'before': 'La conciliación se hace a fin de mes.', 'after': 'La conciliación se hace en cada cierre.',
              'human': 'La empresa define qué diferencia se tolera.'},
             {'h3': 'Una alerta en el día.', 'what': 'El efectivo tiene una diferencia de $ 18.400 en el turno tarde. Se arma un resumen con el detalle.',
              'before': 'La diferencia aparece días después.', 'after': 'La alerta llega el mismo día, con los datos del turno.',
              'human': 'Revisa el detalle antes de decidir.'},
             {'h3': 'La persona decide.', 'what': 'El responsable pide una revisión al encargado o registra la justificación. Todo queda registrado.',
              'before': 'Las diferencias se discuten sin información.', 'after': 'Cada diferencia tiene su explicación registrada.',
              'human': 'La herramienta detecta; la decisión es de una persona.'}],
         'sample': {'from': 'Local Puerto', 'channel': 'Sistema de ventas', 'time': 'Domingo · 23:48',
                    'msg': 'Cierre del turno tarde enviado. Arqueo de efectivo cargado por el encargado.',
                    'id': 'Cierre C-0931', 'cap': 'Local Puerto · turno tarde',
                    'rows': [['Tarjetas', 'coincide', 'ok', 'Igual al sistema'], ['Billeteras', 'coincide', 'ok', 'Igual al sistema'], ['Efectivo', '− $ 18.400', 'alert', 'Diferencia con el sistema']],
                    'rcap': '3 medios de pago · 1 alerta', 'alert': 'Efectivo: diferencia de $ 18.400 en el turno tarde.',
                    'bars': [.08, .12, .06, .1, .78], 'fine': 'Diferencias de caja · últimos 5 cierres'},
         'decide': [['ok', 'Pedir revisión al encargado', 'Revisión pedida · el encargado recibe el detalle', 'se pidió una revisión con el detalle del turno.'],
                    ['adj', 'Registrar la justificación', 'Justificación registrada · cierre aprobado', 'la diferencia quedó justificada y el cierre aprobado.']]},
    ],
}

# ---------------------------------------------------------------- automatización: servicios agrupados por área (los 16 servicios reales)

DEPTS = {
    'id': 'servicios', 'label': 'Servicios por área',
    'h2': 'Cada área de la empresa, <em>con su propia mejora.</em>',
    'intro': 'Las mismas herramientas resuelven necesidades distintas según quién las usa. Elegí un área para ver qué se puede automatizar y qué cambia en el trabajo diario.',
    'note': 'Cada solución se evalúa y se desarrolla según la viabilidad del proyecto: las herramientas que ya usa tu empresa, sus posibilidades de integración y la información disponible.',
    'tabs': [
        {'k': 'administracion', 'name': 'Administración', 'form': 'Administración',
         'need': 'Tareas de oficina repetitivas resueltas de forma ordenada y verificable.',
         'services': [IA['services'][1], IA['services'][12], IA['services'][2]],
         'example': ('De información dispersa a un circuito claro.', 'Una solicitud que llega por correo puede ordenarse, clasificarse y convertirse en una tarea para el responsable, con los controles que el proceso necesite.'),
         'detail': [('Automatización administrativa', 'Diseño de flujos para organizar datos, documentos, correos, solicitudes y recordatorios. Evaluación de cómo conectar las herramientas existentes según sus posibilidades de integración.', 'flujo de trabajo · reglas de validación · documentación'),
                    ('Diagnóstico y rediseño de procesos', 'Relevamiento de tareas, circuitos de información y trabajos repetitivos. Identificación de cuellos de botella y oportunidades para simplificar antes de incorporar tecnología.', 'mapa de procesos · prioridades · hoja de ruta')]},
        {'k': 'operaciones', 'name': 'Operaciones', 'form': 'Operaciones',
         'need': 'Procesos mapeados, simplificados y llevados a herramientas digitales.',
         'services': [IA['services'][6], IA['services'][14], IA['services'][5], IA['services'][13]],
         'example': ('De reportes sueltos a una lectura útil.', 'En una empresa con varias unidades, un flujo puede organizar los reportes disponibles, señalar datos faltantes y preparar una síntesis para la revisión del responsable.'),
         'detail': []},
        {'k': 'ventas', 'name': 'Ventas y atención', 'form': 'Ventas y atención',
         'need': 'Consultas atendidas a tiempo e información comercial ordenada.',
         'services': [IA['services'][4], IA['services'][3], IA['services'][11], IA['services'][8]],
         'example': ('Responder con contexto y un criterio común.', 'Una base de respuestas y un circuito de derivación pueden ayudar a resolver consultas frecuentes y reservar la intervención del equipo para situaciones específicas.'),
         'detail': [('Atención y comunicación', 'Organización de consultas frecuentes, respuestas asistidas y circuitos de derivación. Un tono consistente con tu empresa y revisión humana en situaciones que requieren criterio.', 'guías de respuesta · circuitos de atención · criterios de derivación')]},
        {'k': 'rrhh', 'name': 'RR. HH.', 'form': 'RR. HH.', 'real': True,
         'need': 'Ordeno la estructura y la documentación para que encargados y dueños sepan quién hace qué y cómo se registra.',
         'services': [IA['services'][9], IA['services'][10], 'Asistentes para consultar procedimientos internos.'],
         'example': ('Turnos asignados con un criterio parejo.', 'Uno de mis casos reales: cada mañana se propone qué camarero va a cada salón según indicadores acordados, y el encargado toma la decisión final.'),
         'detail': [('Asistentes internos y conocimiento', 'Diseño de asistentes para consultar procedimientos, preparar borradores y encontrar información de trabajo. Definición de qué pueden responder y cuándo deben derivar a una persona.', 'casos de uso · base documental · pautas de respuesta')]},
        {'k': 'gerencia', 'name': 'Gerencia', 'form': 'Gerencia',
         'need': 'Tableros claros para ver qué pasa en el negocio sin perseguir planillas.',
         'services': [IA['services'][7], IA['services'][8], 'Resúmenes, reportes y alertas para cada responsable.'],
         'example': ('De muchas planillas a un tablero.', 'Indicadores acordados, actualizados desde las fuentes de la empresa y con alertas cuando algo se desvía de lo esperado.'),
         'detail': [('Reportes e información para decidir', 'Organización de fuentes y preparación de resúmenes, reportes y alertas. Definición de qué información necesita cada responsable, con criterios de revisión y trazabilidad.', 'estructura de reporte · fuentes definidas · criterios de control')]},
    ],
    'transversal': {
        'h': 'En todas las áreas',
        'services': [IA['services'][0], IA['services'][15], 'Capacitación y adopción de IA.'],
        'detail': ('Capacitación y adopción de IA', 'Formación práctica para aplicar herramientas de IA al trabajo cotidiano. Ejercicios sobre tareas del equipo, criterios para revisar respuestas y pautas de uso de la información.', 'talleres aplicados · guías de uso · acompañamiento inicial'),
    },
}


# ---------------------------------------------------------------- capas (sección por capas, textos ya publicados)

CAPAS_STEPS = [
    ('procesos', 'los procesos', 'Procesos mapeados, simplificados y llevados a herramientas digitales.', ['Automatización', 'Auditorías operativas', 'Apertura de locales'], '#metodo', 'Metodología'),
    ('numeros', 'los números', 'Una operación con números claros.', ['Control de costos', 'Tableros y reportes'], '#servicios', 'Servicios'),
    ('tecnologia', 'la tecnología', 'Incorporo IA con criterio: donde ahorra tiempo real y donde la información ayuda a decidir mejor.', ['Asistentes con IA'], 'inteligencia-artificial.html', 'Automatización e IA'),
    ('equipos', 'los equipos', 'Ordeno la estructura y la documentación para que encargados y dueños sepan quién hace qué y cómo se registra.', ['Selección de personal', 'Capacitación de encargados'], '#recursos-humanos', 'Recursos humanos'),
]


def esc(s):
    """Escapa HTML y evita cortes feos: «RR. HH.» y «n.º 335» quedan en una sola línea."""
    return _html.escape(s, quote=True).replace('RR. HH.', 'RR.\u00a0HH.').replace('n.º ', 'n.º\u00a0')


if __name__ == '__main__':
    p = publications()
    for d in p['doctrina']:
        print('D', d['kind'], '|', d['outlet'], '|', d['human_date'], '|', d['title'][:70])
    print('DOSSIER', p['dossier']['meta'], p['dossier']['title'])
    for m in p['medios']:
        print('M', m['kind'], '|', m['outlet'], '|', m['human_date'], '|', m['title'][:70])
    for m in p['gastro']:
        print('G', m['outlet'], '|', m['human_date'], '|', m['title'][:70])
    print(p['heads'])
    print(len(GAS['services']), len(IA['services']))
    print(sum(len(c['items']) for c in GAS_PAGE['categories']), sum(len(c['items']) for c in IA_PAGE['categories']))
