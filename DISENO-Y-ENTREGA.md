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

## 5. Rediseño con escena 3D y publicaciones (7 de noviembre de 2026)

### Recorrido

El inicio sigue el orden **Inicio · Publicaciones · Servicios · Método · Sobre mí · Contacto**. El menú es el mismo en todas las páginas; **Servicios** despliega **IA**, **Gastronomía** y **Personas**. En el celular, el menú ocupa la pantalla completa, se cierra con Escape y mantiene el foco dentro mientras está abierto.

- **Portada:** el nombre, la propuesta y los botones «Ver mis publicaciones» y «Hablemos» están en el HTML y se ven desde el primer instante. Debajo, la última nota publicada. El retrato aparece dentro de la escena 3D; las tres etiquetas quedan fuera del rostro (en el celular, debajo del retrato).
- **Publicaciones:** nota destacada con portada propia, cuatro lecturas más, una selección de doctrina y los medios donde apareció. Desde cada nota se puede pedir una conversación sobre ese tema.
- **Servicios:** un índice con los tres anillos y un capítulo por área (IA en turquesa, Gastronomía en ámbar, Personas en marfil).
- **`publicaciones.html`:** archivo completo con filtros (Todo, Notas, Doctrina, Medios): las cinco notas, los ocho trabajos de doctrina, el Dossier Legislativo y las diecinueve apariciones en medios.
- **Cada nota (`article.html?slug=…`):** lectura limpia, tiempo estimado, un cierre para conversar sobre el tema (email con el asunto listo o el formulario del inicio con el tema cargado) y otras lecturas.

### La metáfora: un giroscopio de tres anillos

Tres anillos que giran sobre ejes distintos y se sostienen entre sí: **datos** (vidrio turquesa con paquetes de luz que viajan), **operación** (metal grafito con marcas ámbar, como un instrumento de medición) y **personas** (cerámica marfil con nodos cálidos). En la portada orbitan alrededor del retrato, por delante del pecho y por detrás de la cabeza. Al bajar, la cámara atraviesa el anillo de datos y llega a la portada de la nota destacada; después los anillos se separan en el índice de servicios, cada uno pasa al frente en su área, se vuelven concéntricos en el método, orbitan la foto de «Sobre mí» y forman un portal detrás del formulario.

### Archivos

| Archivo | Función |
| --- | --- |
| `src/stage/main.js` | Fuente de la escena (Three.js r187): materiales físicos, iluminación de estudio, posproceso con brillo y los estados de cada sección |
| `assets/js/stage.js` | La escena compilada (145 KB comprimida). Se pide recién cuando la página terminó de cargar |
| `assets/js/fx.js` | Encabezado y menú, scroll suave, carga de la escena, cursor, cortina entre páginas y revelados |
| `assets/js/home.js` | Inicio: frases que rotan, publicaciones al día con `news-data.js`, tema de consulta, formulario (sin cambios en su envío) |
| `assets/js/pubs.js` · `article.js` | Filtros del archivo · lectura de cada nota y cierre para conversar |
| `assets/css/base.css` | Base común: colores, encabezado, menú, pie, botones, escena |
| `assets/css/home.css` · `pages.css` | Inicio · archivo de publicaciones y notas |
| `assets/hero-poster.webp` | Imagen fija de la portada generada desde la propia escena (se ve mientras carga el 3D) |
| `assets/ezequiel-recorte.webp` | Retrato recortado que usa la escena |

Para recompilar la escena: `npx esbuild src/stage/main.js --bundle --minify --format=iife --outfile=assets/js/stage.js` (con `three@0.187.0` instalado).

### Cómo se asigna un estado a cada sección

Cada sección lleva `data-stage="nombre"` (por ejemplo `hero`, `pubs`, `services`, `svc-ia`, `metodo`, `about`, `contact`, `frame`, `park`). El estado define dónde se ubican los anillos (un elemento ancla de la página), su orientación, tamaño y brillo; la escena pasa de uno a otro según el scroll. `data-stage-anchor=".selector"` cambia el ancla sin tocar el código.

### Publicar una nota nueva

Alcanza con sumarla a `news-data.js`, como hasta ahora: aparece sola como destacada en el inicio, en la portada («Última publicación») y en el archivo, con su tiempo de lectura.

### Rendimiento, accesibilidad y respaldo

- **El contenido primero:** textos, botones e imágenes cargan sin esperar al 3D. La escena se pide cuando la página ya cargó y el navegador está libre; el póster de la portada se funde con ella sin saltos.
- **Calidad adaptativa:** tres niveles según el equipo (vidrio con refracción en computadoras potentes; versión más liviana en celulares). Si la fluidez cae, primero se apaga el brillo y después baja la resolución. Se pausa con la pestaña oculta.
- **Sin WebGL, con ahorro de datos o con movimiento reducido:** composición estática cuidada: el póster del retrato en la portada y los anillos dibujados (SVG) en cada sección. Sin cursor propio, cortina ni scroll suave cuando se pidió reducir el movimiento.
- **Accesibilidad:** un solo título principal por página, sin saltos en la jerarquía, todos los enlaces y botones con nombre, foco visible, enlace para saltar al contenido y escena decorativa oculta para lectores de pantalla.

### Pruebas y herramientas

Parámetros de revisión que no afectan a los visitantes: `?tier=0|1|2` fija la calidad, `?s=2.5` fija el estado de la escena, `?nogl` muestra la versión estática y `?poster=1` deja solo la escena (para regenerar el póster).

Los textos se verificaron contra la versión anterior: el contenido de IA y Gastronomía es idéntico y en el inicio están todos los textos. Lo único que cambió son los dos botones de la portada, que pasaron a ser «Ver mis publicaciones» y «Hablemos», como se pidió.

## Operación del sitio

La publicación conserva el repositorio y el alojamiento actuales. Los cambios se guardan juntos para que no queden páginas con sistemas visuales distintos durante una actualización.
