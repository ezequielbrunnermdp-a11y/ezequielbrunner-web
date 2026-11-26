# Diseño y entrega · ezequielbrunner.com

Rediseño integral del 26 de noviembre de 2026: el sitio pasa de seis páginas a **una sola página**, corta, visual y clara.

El sitio anterior quedó respaldado en `respaldo/`:

- `contenido-sitio-anterior.md`: todos sus textos, datos de contacto, formación y publicaciones.
- `sitio-anterior-2026-11-26.zip`: copia íntegra de sus archivos, incluido este documento en su versión anterior, con la historia de diseño hasta la sección 11.

## 1. Objetivo

Una web personal profesional que genere interés, confianza y oportunidades: negra, sobria, tecnológica y editorial. Pocas palabras, buena tipografía, mucho aire y un movimiento sutil. Nada de plantilla corporativa.

## 2. Estructura

| Sección | Contenido |
| --- | --- |
| Portada | «Gastronomía, negocios y tecnología.», la frase de propuesta, los botones Servicios y Contactar, y la animación de las tres áreas conectadas |
| Servicios | Los cuatro servicios, cada uno con un acceso a WhatsApp con el mensaje ya escrito |
| Sobre mí | Retrato profesional, el texto breve y tres datos: trayectoria, sectores y formación |
| Proyectos y experiencia | Seis tarjetas: El Cóndor Coffee Shop, Puerto de Palos, la asignación de salones por desempeño, las barras para eventos multitudinarios, el ranking semanal de ventas y el sector cervecero |
| En los medios | Tres notas destacadas y «Ver todas las publicaciones» con las 26 restantes, de la más nueva a la más vieja, cada una con medio, título, fecha y enlace original |
| Galería | Las dos fotos reales de eventos, grandes, con visor a pantalla completa |
| Contacto | «¿Hablamos de tu próximo proyecto?», WhatsApp destacado, email (con botón para copiarlo) y LinkedIn |

El menú tiene cuatro accesos: **Inicio · Servicios · Proyectos · Contacto**. El acceso de la sección que se está leyendo queda marcado. Sobre mí cuenta como Servicios; En los medios y Galería, como Proyectos.

## 3. Dirección visual

- **Color.** Negro `#0a0a0b`, texto marfil `#eeebe5`, dos grises para jerarquía y una sola tinta cálida, `#d7ac82`. La tinta se usa solo para lo que se mueve o se destaca: el punto final del título, los números de los servicios, la señal de la animación.
- **Tipografía.**
  - Fraunces para los títulos: romana variable, con su tamaño óptico, e itálica para «y tecnología.».
  - Geist para leer.
  - Geist Mono para rótulos, fechas y medios.
- **Retícula.** Hasta 1320 px de ancho, márgenes de 20 a 64 px, secciones separadas por líneas finas.
- **Ilustraciones de línea fina en SVG, sin imágenes generadas.**
  - La red de la portada.
  - Las portadas de los proyectos:
    - una taza vista desde arriba;
    - el salón con el recorrido de un turno;
    - el ranking que asigna salones;
    - 135 puntos, el tamaño máximo de los equipos;
    - la semana con el ranking que llega por email;
    - Mar del Plata y las franquicias, con coordenadas reales.
- **Fotos.**
  - Solo las propias: el retrato, sobre el negro de la página, y las dos fotos de eventos. Estas estaban oscurecidas para el diseño anterior y se les devolvió su rango natural.
  - Las imágenes de stock o generadas del sitio anterior no se usan.

## 4. Movimiento

- **Portada.** El anillo se dibuja y aparecen los tres nodos. Después, una señal cálida recorre el anillo de Gastronomía a Negocios y de Negocios a Tecnología; cada nodo emite un pulso al recibirla. Es un ciclo de 7,5 s, con un dial que gira muy lento. La animación se pausa fuera de la pantalla.
- **Proyectos.** Las portadas se animan al pasar el cursor; en pantallas táctiles, una vez al aparecer.
- **Resto.** Aparición suave de cada bloque.
- **Movimiento reducido.** Con «reducir movimiento» activado en el sistema, nada se mueve.

No hay WebGL ni bibliotecas de animación: todo es CSS y un script propio de 9 KB (3 KB comprimido).

El dibujo de la portada va en tres capas para que cada cuadro repinte solo lo que se mueve:

- la base quieta, con la trama de puntos;
- el dial, que gira en el compositor sin repintar;
- la capa viva, con el anillo, los nodos y la señal.

## 5. Celular

- La portada entra en la primera pantalla con el título, la frase y los dos botones.
- El menú ocupa la pantalla completa: cuatro accesos grandes, más WhatsApp y el email.
- Los proyectos se deslizan de costado, como en una app, con una barra de avance.
- El botón de WhatsApp de Contacto ocupa todo el ancho y muestra el número.
- Un botón flotante de WhatsApp aparece después de la portada y se retira al llegar a Contacto.
- Acostado, la portada pasa a dos columnas.

## 6. Contenido: qué se conservó y qué salió de la página

Se conservó todo lo que respalda la propuesta:

- servicios;
- trayectoria (El Cóndor, Puerto de Palos, eventos, sector cervecero);
- los dos casos reales de automatización;
- formación;
- prensa y publicaciones con sus enlaces originales;
- fotos reales;
- WhatsApp, email y LinkedIn.

Salieron de la página, y están en el respaldo:

- **De Gastronomía:**
  - los siete ejes y la calculadora de costo de un plato;
  - las preguntas frecuentes;
  - el formulario de asesoramiento.
- **De Automatización & IA:**
  - la lista de 16 servicios;
  - la demostración con procesos de ejemplo;
  - los ejemplos ilustrativos;
  - el formulario de evaluación.
- **De Trayectoria:**
  - la línea de tiempo detallada;
  - la lista completa de cursos.
- **Otros:**
  - el pedido de CV para búsquedas de personal (rrhhmdpgastronomia@gmail.com);
  - la publicación genérica de Instagram de la lista de medios, que no decía qué mostraba.

No se agregaron clientes, cifras, premios ni publicaciones que no estuvieran publicados antes.

## 7. Direcciones del sitio anterior

`_redirects` lleva cada dirección vieja a su sección (301):

| Dirección vieja | Sección |
| --- | --- |
| `/gastronomia`, `/inteligencia-artificial` y `/automatizacion` | `/#servicios` |
| `/trayectoria` | `/#sobre-mi` |
| `/publicaciones` y las notas de actualidad retiradas antes | `/#medios` |
| Retrato e imágenes para redes anteriores | Sus reemplazos |

`/tools/*`, `/respaldo/*` y este documento devuelven 404.

## 8. Buscadores y redes

- **Título:** «Ezequiel Brunner · Gastronomía, negocios y tecnología».
- **Descripción:** de 154 caracteres.
- **Canónica:** `https://ezequielbrunner.com/`.
- **Imagen para redes:** nueva, de 1200 × 630, generada con `tools/sitegen/og.py`.
- **Datos estructurados:**
  - `Person`, con LinkedIn y about.me;
  - `ProfessionalService`, con los cuatro servicios;
  - `WebSite`;
  - `WebPage`.
- **Mapa del sitio:** una sola dirección.

## 9. Archivos

- `index.html`, `404.html` y `sitemap.xml` se generan con `python3 tools/sitegen/build.py`. Cómo cambiar textos: `tools/sitegen/README.md`.
- `assets/js/site.js`: el único script.
- `assets/fonts/`: Fraunces, Geist y Geist Mono.
- `assets/img/`: retrato y galería, en AVIF y WebP.
- `assets/og/inicio.jpg`: imagen para redes.
- `tools/imagenes/`: fuentes de las fotos y los scripts que generan sus versiones.

## 10. Verificación

| Prueba | Resultado |
| --- | --- |
| Teléfonos | iPhone SE 1.ª (320 px), SE 3.ª (375), Android de 360, iPhone 15 Pro (393) y 15 Pro Max (430), parados y acostados, más el Pro Max acostado en pantalla completa. 20 de 20 cargas (portada y 404) sin desplazamiento horizontal, sin texto cortado y sin objetivos táctiles de menos de 24 px. Los botones de la portada quedan en la primera pantalla, también acostado |
| Menú del celular | En tres equipos: abre, mantiene el foco adentro, cierra con Escape y lleva a la sección |
| Escritorio y tableta | 1920, 1440, 1280, 1024, 1180, 820 y 768 px: 7 de 7 sin observaciones |
| axe-core | Sin violaciones en escritorio y celular: portada, lista de publicaciones abierta, menú abierto, visor de fotos y 404 |
| Lighthouse, celular | Rendimiento 99; accesibilidad, prácticas y SEO 100. LCP de 2,0 s, bloqueo de 0 a 110 ms según la corrida y CLS 0 |
| Lighthouse, escritorio | 100 en las cuatro categorías |
| Sin JavaScript | Todo el contenido visible; el menú funciona como ancla |
| Movimiento reducido | Ninguna animación en marcha |
| Redirecciones | Probadas con un servidor local que aplica las reglas de Netlify (comodines, reglas forzadas y archivos existentes) |
| Peso | 166 KB en la primera visita. El HTML, con los estilos incluidos, pesa 21 KB comprimido |

Limitaciones: se probó con Chromium y la emulación de cada equipo, no en Safari ni en teléfonos físicos.

## 11. Pendientes del titular

- **Instagram:** la cuenta no figuraba en el sitio anterior. Se completa en `content.py` (`INSTAGRAM`).
- **Fechas faltantes:** cinco publicaciones no tienen fecha en los datos y aparecen como «Sin fecha»:
  - tres notas de La Capital;
  - la carta sobre phishing en Diario Constitucional;
  - la doctrina sobre la Resolución 9/2025 en SAIJ.
- **Más fotos reales** (El Cóndor, cocina, salones, eventos): pueden reemplazar las portadas dibujadas de los proyectos o sumarse a la galería.
