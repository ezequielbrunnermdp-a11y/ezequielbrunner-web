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

## 5. Capa visual avanzada (6 de noviembre de 2026)

Todas las páginas comparten un escenario WebGL detrás del contenido. Es un único sistema de partículas que cambia de forma a medida que se baja por la página: el retrato de Ezequiel se deshace en una nube, se ordena como una red neuronal, sube como vapor sobre el plato, se estructura en un organigrama, se reparte en una retícula, fluye, se abre como un portal en el contacto y termina escribiendo el nombre sobre el pie de página.

### Archivos

| Archivo | Función |
| --- | --- |
| `assets/js/scene.js` | Motor WebGL2 propio: partículas con formas, planos de imagen con refracción y disolución. Sin dependencias |
| `assets/js/fx.js` | Orquestador: une el scroll con las escenas, cursor, transición entre páginas, revelados, arranque |
| `assets/js/home.js` | Comportamiento propio del inicio (menú móvil, frases que rotan, manifiesto, contadores, formulario) |
| `assets/css/fx.css` | Capa visual compartida: lienzo, cursor, cortina, vidrio y borde de luz |
| `assets/css/home.css` | Composición de la página de inicio |
| `site.css` / `site.js` | Páginas interiores (la parte final de `site.css`, “Nivel 2”, adapta su aspecto) |
| `assets/portrait-map.png` | Mapa de densidad del retrato (R = brillo, G = relieve). Genera las partículas de la cara |
| `assets/js/vendor/` | GSAP, ScrollTrigger y SplitText 3.15 (licencia estándar sin cargo de GreenSock) y Lenis 1.3 (MIT). Se sirven desde el propio sitio |

### Cómo se asigna una forma a cada sección

Cada sección lleva atributos `data-scene` en el HTML:

- `data-scene="portrait | network | steam | org | cloud | lattice | flow | ring | wordmark"`: la forma.
- `data-anchor=".selector"`: la forma se centra sobre ese elemento (por ejemplo, la imagen de la sección). Sin ancla, se usa `data-pos="x,y"` (fracción de la pantalla) y `data-size`.
- `data-fit`, `data-fit-mode` (`min`, `h`, `w`) y `data-off="x,y"`: ajustan tamaño y desplazamiento.
- `data-intensity`: brillo (0 a 1). Las variantes `-m` (`data-pos-m`, `data-size-m`, `data-intensity-m`) valen para el celular; `data-anchor-m="none"` desactiva el ancla en el celular.
- `data-warm`: usa la paleta cálida (gastronomía).
- `data-gl-image`: la imagen se dibuja en WebGL con refracción y disolución (`data-gray`, `data-zoom`, `data-par` ajustan el filtro).
- `data-intro="n"`: orden de entrada de los elementos de la portada.

Para cambiar una forma basta con editar el atributo de la sección. No hay que tocar el código.

### Rendimiento, accesibilidad y respaldo

- **Calidad adaptativa:** 36.000 partículas en computadoras potentes, 14.000 a 22.000 en celulares y equipos medios. Si la fluidez cae, se reduce la cantidad, luego la resolución, y por último se quita el desenfoque del vidrio (clase `fx-lite`). Con “ahorro de datos” activado se usa la calidad mínima.
- **Pausa automática** cuando la pestaña no está visible.
- **Reducir movimiento:** con la preferencia del sistema activada no hay arranque animado, cursor propio, cortina ni scroll suave. El escenario muestra formas quietas y el contenido aparece completo.
- **Sin WebGL o sin JavaScript:** el sitio sigue completo. En el inicio se ve la foto real con su máscara original.
- **Accesibilidad:** el texto sigue siendo texto real (los títulos animados conservan su lectura para lectores de pantalla), los lienzos son decorativos, el cursor nativo se mantiene y la navegación por teclado y los enlaces de salto no cambian.
- **Transición entre páginas:** una cortina circular que nace donde se hizo clic. Respeta los atajos del navegador (Ctrl/Cmd+clic, nueva pestaña) y el botón Atrás.

### Detalles que se descubren

- El cursor ilumina y aparta las partículas; los botones y tarjetas envían una onda al escenario.
- Al mantener apretado el mouse (o el dedo quieto en el celular) la nube se arremolina hacia el puntero y, al soltar, sale despedida.
- El nombre de la portada engrosa su tipografía según la cercanía del cursor.
- En “Sobre mí” la foto real aparece en blanco y negro y recupera el color bajo el cursor.
- Al bajar rápido, las partículas dejan estela.

### Pruebas y herramientas

Parámetros de dirección para revisar el sitio: `?fxq=high|mid|low` fija la calidad (y desactiva la adaptación), `?fxs=3.5` fija la escena. No afectan a los visitantes.

Los textos se verificaron contra la versión anterior: no cambió ninguno. Solo se agregaron adornos ocultos para lectores de pantalla: el riel lateral con los nombres de las secciones del menú y la firma grande del pie.

## Operación del sitio

La publicación conserva el repositorio y el alojamiento actuales. Los cambios se guardan juntos para que no queden páginas con sistemas visuales distintos durante una actualización.
