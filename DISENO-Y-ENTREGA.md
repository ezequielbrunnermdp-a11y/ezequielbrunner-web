# Ezequiel Brunner — dirección visual y entrega

Rediseño de la home, IA para empresas y asesoramiento gastronómico. Fecha: 1 de noviembre de 2026.

## 1. Dirección visual

Un sitio editorial oscuro, personal y sobrio. La fotografía y los títulos tienen protagonismo; la oferta, el método y las vías de consulta quedan claros. Una misma identidad acompaña las dos especialidades.

| Uso | Color |
| --- | --- |
| Superficie 1 · fondo | `#101315` |
| Superficie 2 · tarjetas y secciones | `#191E22` |
| Superficie 3 · énfasis | `#252C31` |
| Texto principal | `#F4EFE7` |
| Texto secundario | `#B8B5AF` |
| Texto auxiliar | `#A39F99` |
| Único acento · cálido | `#D7AC82` |
| Acento al interactuar · mismo tono | `#E5BD96` |
| Bordes de separación | `#394147` |

**Títulos:** Instrument Serif, regular e italic. **Lectura e interfaz:** DM Sans, con interlineado entre 1,75 y 1,9. Las fuentes se cargan con `display=swap` y tienen alternativas de sistema.

Las tarjetas usan bordes finos, radios de 13–22 px y elevación discreta al pasar el cursor. Los botones principales tienen fondo cálido y texto oscuro. El movimiento es breve, respeta `prefers-reduced-motion` y no bloquea la lectura.

### Contraste de la paleta

Las combinaciones de texto principal, secundario, auxiliar y acento con las tres superficies superan 4,5:1. El contraste mínimo de estas combinaciones es **5,38:1**; el botón principal alcanza **8,98:1**. Los estados de foco tienen contorno visible. Los bordes de campos de formulario usan `#71797D`, con un contraste mínimo de 3,79:1 frente a su superficie exterior.

Referencias: [contraste de texto, W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) y [contraste de componentes, W3C](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## 2. Código completo

| Archivo | Función |
| --- | --- |
| `index.html` | Home, especialidades, experiencia, prueba social editable, método y contacto |
| `inteligencia-artificial.html` | Servicios de IA, ejemplos, proceso, FAQ, contacto y archivo de publicaciones |
| `gastronomia.html` | Servicios gastronómicos, experiencia, proceso, FAQ, formación y CV |
| `site.css` | Sistema de diseño y todos los componentes compartidos |
| `site.js` | Menú móvil, consulta por email, modo de edición, novedades y movimiento discreto |
| `articulo.html` / `article.html` | Plantillas compatibles para los artículos existentes |
| `article.js` / `news-data.js` | Presentación y contenido de los artículos existentes |
| `assets/` | Retrato WebP, imágenes de especialidades, retrato para Open Graph y favicon |
| `robots.txt` / `sitemap.xml` | Descubrimiento básico para buscadores |

HTML, CSS y JavaScript nativos. No requiere instalación de paquetes ni compilación. La capa visual avanzada (punto 5) se sirve con archivos propios y librerías incluidas en `assets/js/vendor/`; no depende de CDN externos. La navegación usa archivos `.html`, compatibles con la publicación actual; los enlaces canónicos usan las rutas públicas sin extensión.

### Editar logos y testimonios

La home incluye tres espacios para logos y dos testimonios **sin datos ficticios**. Están marcados con `data-draft` y `hidden` y no se muestran en la vista pública normal.

Para revisar su composición, abrí la home con `?edicion=1`. Este modo muestra explícitamente que son placeholders y agrega `noindex, nofollow` al documento. No es un panel de administración: es una vista de revisión de contenido pendiente.

Para publicarlos:

1. Reemplazá los placeholders por logos y testimonios reales y autorizados.
2. Incorporá el nombre, cargo y empresa de cada autor.
3. Quitá el aviso de maqueta y los atributos `data-draft` y `hidden` del bloque confirmado.

La página de IA incluye una plantilla equivalente para documentar un caso: empresa, problema, intervención, indicador, período y fuente. Los ejemplos visibles están identificados como ilustrativos y no prometen porcentajes ni ahorros inventados.

### Contacto

El formulario valida los campos y prepara una consulta en la aplicación de correo del visitante. El envío lo confirma la persona en su correo. No hay una base de datos ni un envío automático desde el servidor. El email directo y LinkedIn también quedan disponibles.

## 3. Qué cambió y por qué

- **Un único sistema:** se reemplazaron las capas de estilos anteriores por `site.css`, para mantener coherencia y facilitar futuras modificaciones.
- **Home con recorrido completo:** presenta a Ezequiel, ayuda a elegir una especialidad, muestra experiencia, explica el método y termina en una consulta concreta.
- **Dos ofertas ordenadas:** cuatro servicios principales por especialidad, con el alcance detallado disponible mediante controles nativos desplegables. Gastronomía incorpora un bloque de recursos humanos y procedimientos: gestión del personal, microprocedimientos operativos y circuito disciplinario interno coordinado con la gerencia y el asesor laboral de la empresa. Se puede acceder directamente desde el menú y consultar por cada servicio desde el formulario.
- **Prueba social responsable:** el dato de 15+ años se conserva del contenido existente y se refiere a operación gastronómica. Las organizaciones vinculadas a la trayectoria se presentan como experiencia de gestión. Los espacios de clientes y testimonios quedan pendientes de confirmación.
- **Contenido preservado:** trayectoria, formación, CV, publicaciones, dossier, menciones y artículos siguen disponibles. El archivo académico queda separado del recorrido comercial principal.
- **Imágenes livianas:** retrato de aproximadamente 50 KB y dos imágenes de especialidades de aproximadamente 166 y 207 KB, en WebP. Las imágenes bajo el primer pantallazo usan carga diferida.
- **Navegación por secciones:** el encabezado fijo incorpora desplegables de IA para empresas, Gastronomía y Sobre mí. Cada grupo lleva directamente a sus secciones. En celular, el botón visible “Menú” abre las mismas opciones. Se quitaron las filas de navegación repetidas bajo los encabezados; se conservan todos los contenidos y enlaces antiguos. Los desplegables funcionan con clic, toque y teclado, se cierran con Escape o al elegir un destino y mantienen una única categoría abierta.
- **SEO básico:** títulos, descripciones, canonical, Open Graph, Twitter Card, datos estructurados, sitemap y robots.
- **Mobile-first:** una columna como base; composiciones de dos y tres columnas cuando hay espacio, con controles táctiles y tipografía legible.

## 4. Material real que conviene conseguir

### Fotografías

- Un retrato profesional actual con buena resolución y una versión horizontal. Conviene mantener una sesión, iluminación y recorte consistentes.
- Imágenes propias trabajando: revisión de operación, coordinación de equipos, capacitación, servicio, producción y preparación de aperturas.
- Para IA, una escena real de trabajo o capacitación con información confidencial fuera de cuadro. Las capturas de herramientas deben tener datos de ejemplo claramente identificados.
- Mantener autorización para usar imágenes de personas, establecimientos y marcas. Las dos imágenes conceptuales actuales ayudan a ambientar y no funcionan como prueba de trabajos realizados.

### Logos y testimonios

- Logos de clientes que autoricen su publicación, preferentemente SVG; como alternativa, PNG con fondo transparente.
- Dos testimonios breves que describan una necesidad, el trabajo realizado y una mejora observada. Con nombre, cargo, empresa y aprobación del texto.
- Diferenciar siempre experiencia laboral, colaboraciones y clientes de consultoría.

### Datos y casos

- Confirmar el año de inicio de la trayectoria para mantener actualizado el dato de experiencia.
- Para cada caso: situación inicial, alcance, tiempo de trabajo, cambio implementado y evidencia del resultado.
- Si se publica un ahorro, reducción de merma o mejora de servicio: indicar cómo se midió, con qué base se compara y durante qué período.
- Definir modalidades de trabajo, alcance geográfico, disponibilidad y canal preferido de consulta.

## 5. Rediseño editorial en negro (noviembre de 2026)

El sitio abandona la estética futurista: no hay escenas 3D, partículas, brillos ni degradados. El impacto está en la tipografía, la composición, el espacio y transiciones discretas. Referencia: el lujo no necesita llamar la atención para demostrar su calidad.

### Identidad

| Uso | Valor |
| --- | --- |
| Fondo · negro profundo | `#0A0A0A` |
| Superficies · carbón y grafito | `#101010`, `#161616` |
| Texto principal · blanco cálido | `#F2EFE9` |
| Texto de lectura · gris marfil | `#B6B1A8` |
| Datos y rótulos · gris suave | `#87837C` |
| Itálicas y botón principal · marfil | `#E7E0D4` |
| Detalle puntual · champaña | `#CDBB98` (solo en categorías y rótulos destacados) |
| Líneas | blanco al 9 % y al 17 % |

**Títulos:** Instrument Serif, regular e itálica, a gran escala. **Lectura e interfaz:** Inter; los rótulos van en mayúsculas pequeñas con interletrado amplio. Las fotografías se muestran en blanco y negro. Los botones son rectangulares: el principal en marfil, el secundario con borde fino. El texto de lectura supera 9:1 de contraste sobre el fondo y los datos auxiliares, 5:1.

### Recorrido

- **Inicio:** el nombre ocupa todo el ancho al pie de la portada; arriba, la frase de presentación, los botones «Ver mis publicaciones» y «Hablemos», tres datos breves, el retrato y la última publicación.
- **Publicaciones** (01): nota destacada con título protagonista, cuatro lecturas en columnas separadas por líneas, doctrina y medios. Archivo completo en `publicaciones.html`, con filtros (Todo, Notas, Doctrina, Medios). Cada nota (`article.html?slug=…`) termina con una forma directa de conversar sobre ese tema.
- **Inteligencia artificial** (02), **Gastronomía** (03) y **Personas** (04): un capítulo por área con el mismo lenguaje y una composición propia.
- **Método** (05), **Sobre mí** (06) y **Contacto** (07).

El menú es el mismo en todas las páginas: Inicio, Publicaciones, IA, Gastronomía, Personas, Sobre mí y Contacto. En el celular se abre a pantalla completa. Los enlaces viejos del inicio (`#servicios-ia`, `#procesos`, `#medios`, etc.) llevan a su nuevo lugar.

### Por capas

Entre Publicaciones y las áreas de servicio, una sección queda fija mientras se baja y una pieza escultórica se arma capa por capa, al ritmo de tu frase «Hago que la tecnología, los números, los equipos y los procesos trabajen a tu favor»: mármol (los procesos), latón (los números), vidrio (la tecnología) y nogal (los equipos). Cada capa cae desde arriba y se asienta; cambian el título, el texto y el tono del fondo, y una barra fina marca el avance. Al final la pieza queda completa con el botón «Hablemos». Las palabras de cada capa (Automatización, Control de costos, Asistentes con IA, etc.) son las que antes estaban en la franja de capacidades.

Las imágenes están en `assets/capas/` (115 KB en total): son renders con transparencia generados con Three.js fuera del sitio, así que la página no carga 3D. Sin animación (movimiento reducido o sin JavaScript) se ve la pieza completa junto a las cuatro capas en lista.

### Movimiento

Todo es breve y casi imperceptible: el nombre sube desde su renglón al cargar; los títulos aparecen línea por línea al bajar; los textos, con un desplazamiento mínimo; las fotos se descubren de abajo hacia arriba; en «Mi enfoque» las palabras se encienden al leer. Subrayados que se dibujan al pasar el mouse, desplazamiento suave (Lenis), un encabezado que se aparta al bajar y vuelve al subir, y un fundido corto entre páginas. Con movimiento reducido no hay animaciones y el contenido se ve completo; sin JavaScript también.

### Archivos

| Archivo | Función |
| --- | --- |
| `assets/css/base.css` | Base común: colores, tipografía, encabezado, menú, pie, botones y enlaces |
| `assets/css/home.css` | Página de inicio |
| `assets/css/pages.css` | Archivo de publicaciones y lectura de notas |
| `site.css` | Páginas de IA y Gastronomía (la capa final, «Capa editorial», las alinea con el resto) |
| `assets/js/fx.js` | Encabezado y menú, desplazamiento suave, apariciones al bajar, fundido entre páginas, nombre a todo el ancho |
| `assets/js/home.js` | Inicio: frases que rotan, publicaciones al día con `news-data.js`, tema de consulta, formulario (sin cambios en su envío) |
| `assets/js/pubs.js` · `article.js` | Filtros del archivo · lectura de cada nota |
| `assets/js/vendor/` | GSAP, ScrollTrigger y SplitText 3.15 y Lenis 1.3, servidos desde el propio sitio |

### Publicar una nota nueva

Alcanza con sumarla a `news-data.js`, como hasta ahora: aparece sola como destacada en el inicio, en «Última publicación» y en el archivo, con su tiempo de lectura. Si la nota tiene imagen (`image`), se muestra integrada en blanco y negro.

### Verificación

Revisado en escritorio (1440 px) y en celular (390 y 449 px): sin desplazamiento horizontal, sin elementos superpuestos en la portada, un solo título principal por página, sin saltos en la jerarquía y todos los enlaces con nombre. El contenido de IA y Gastronomía es idéntico al de la versión publicada y en el inicio están todos los textos; solo cambiaron los dos botones de la portada («Ver mis publicaciones» y «Hablemos»), como se pidió antes.

## Operación del sitio

La publicación conserva el repositorio y el alojamiento actuales. Los cambios se guardan juntos para que no queden páginas con sistemas visuales distintos durante una actualización.
