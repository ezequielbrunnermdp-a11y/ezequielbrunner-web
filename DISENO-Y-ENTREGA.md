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

Primera versión en negro: tipografía protagonista, publicaciones al frente y la sección «Por capas». La reemplazó el rediseño del punto 6; de esa etapa quedan la sección por capas (ahora en Gastronomía) y el criterio de movimiento discreto.

## 6. Black premium con dos experiencias (noviembre de 2026)

La portada es una elección: **Asesoramiento gastronómico** o **Automatización & Inteligencia Artificial**. Cada área es una experiencia propia, con su recorrido, su acento de color y su formulario. Las publicaciones profesionales tienen página propia y las noticias de IA salieron del sitio.

### Identidad

| Uso | Valor |
| --- | --- |
| Fondo principal | `#101315` |
| Negro profundo (portada, contacto, pie) | `#080A0B` |
| Superficies | `#171B1D`, `#1C2124` al pasar el cursor |
| Texto principal · blanco cálido | `#F5F3EF` |
| Texto de lectura · gris | `#A8ADAF` (8:1 sobre el fondo) |
| Rótulos y datos | `#82898D` (5:1) |
| Acento Gastronomía · cobre | `#C9956A` |
| Acento Automatización · turquesa apagado | `#82B0AA` |
| Acento común · champagne | `#D8C8A8` |
| Líneas | blanco cálido al 9, 16 y 30 % |

**Títulos:** Fraunces liviana (300), con itálica en la segunda línea. **Lectura, navegación y botones:** Inter. Rótulos en mayúsculas pequeñas con interletrado amplio, botones rectangulares (el principal en blanco cálido y, al pasar el cursor, se llena con el acento del área), grilla de 12 columnas y mucho espacio. Gastronomía usa fotos reales de trabajo y Automatización, líneas de datos que se dibujan en el navegador (punto 7).

### Portada: pantalla dividida

- Ocupa toda la pantalla. A la izquierda Gastronomía y a la derecha Automatización, con «Ezequiel Brunner» centrado arriba y una línea divisoria fina con el rótulo «Elegí un área».
- En escritorio, al pasar el cursor el panel crece, el otro se reduce y se oscurece, y aparecen los 15 y 16 servicios de cada área. Los títulos se ajustan al ancho de cada panel. La imagen acompaña al cursor con un movimiento de profundidad mínimo.
- Al elegir, el panel ocupa toda la pantalla, el texto se desvanece y se entra al área sobre la misma imagen (transición entre páginas del navegador; en los que no la tienen, un fundido corto).
- En el celular son dos paneles verticales, uno sobre otro, con título, subtítulo y botón.
- Debajo: Sobre mí, publicaciones destacadas y contacto con las dos vías.

**Preferencia:** la elección queda guardada en el navegador del visitante. En la visita siguiente la portada se ve igual —ya no redirige— y el área de la última visita lleva la marca «Tu última visita» (en escritorio). «Cambiar de área» está siempre a la vista (encabezado, menú, pie y barra inferior en el celular) y lleva a la elección (`index.html#elegir`).

### Las dos experiencias

| Gastronomía (`gastronomia.html`) | Automatización & IA (`inteligencia-artificial.html`) |
| --- | --- |
| Portada · propuesta de valor con datos (15+ años, equipos de hasta 135 personas) | Portada · soluciones tecnológicas y principios (alcance, control humano, información cuidada) |
| Por capas (la pieza que se arma al bajar) | Automatizaciones por categoría (los 16 servicios del brief + capacitación) |
| Servicios en 4 categorías con «Qué incluye» y entregables · Recursos humanos | Ejemplos prácticos de IA y un flujo de proceso que se enciende paso a paso |
| Problemas habituales · tu punto de partida (local en marcha, apertura, sucursales) | Soluciones por departamento (Administración, Ventas, Operaciones, RR. HH., Gerencia) |
| Metodología: diagnóstico, planificación, implementación, seguimiento · formas de trabajo | Proceso: diagnóstico, diseño, desarrollo, implementación, mantenimiento · formas de trabajo |
| Trayectoria, prensa gastronómica, doctrina sobre gestión del personal, formación | IA y Derecho: doctrina, Dossier Legislativo, perfil y formación |
| Preguntas frecuentes · formulario «Solicitar asesoramiento» · Trabajá conmigo | Preguntas frecuentes · formulario «Evaluar mi empresa» |

Los servicios se presentan como soluciones a evaluar según la viabilidad de cada proyecto. **Casos reales:** Automatización muestra dos automatizaciones propias que funcionan todos los días (asignación de salones según el desempeño de cada camarero y ranking semanal de ventas para premiar al equipo), sin nombres de locales ni de personas. Cuando haya un caso con autorización para nombrar al cliente, se suma en la misma sección.

Cada botón «Consultar por este servicio», «Quiero conversar sobre esto» o «Evaluar…» baja al formulario y deja elegido el servicio, la etapa o el área.

### Formularios

Dos formularios distintos, con nombre, empresa, email, teléfono y la necesidad, más campos propios de cada área (tipo de negocio, etapa y servicio; o rubro, tamaño del equipo y área a evaluar). Validan antes de enviar y avisan qué falta.

- **Cómo funcionan:** al enviar se abre WhatsApp (223 634-3371) con la consulta completa ya escrita; el visitante solo toca «Enviar». Debajo del botón está «Enviala por email», que abre el correo con los mismos datos dirigidos a ezequielbrunnermdp@gmail.com. Si WhatsApp no se abre, el aviso trae los dos enlaces.
- **Opcional · guardar las consultas en Netlify:** en Netlify → *Project configuration → Forms*, activar *Enable form detection*; después, en `gastronomia.html` e `inteligencia-artificial.html`, cambiar `data-endpoint="whatsapp"` por `data-endpoint="netlify"` y volver a publicar. Las consultas quedan en Netlify (formularios `solicitar-asesoramiento` y `evaluar-empresa`), el visitante ve «¡Gracias! Recibí tu consulta» sin salir de la página y, si Netlify falla, se pasa solo a WhatsApp. Para recibirlas por email: *Forms → Form notifications → Email notification*. Tiene un campo trampa contra spam. Las consultas guardadas consumen créditos del plan de Netlify.

### Publicaciones

`publicaciones.html` reúne el Dossier Legislativo n.º 335 (destacado), doctrina e investigación (con su etiqueta, como «Ponencia premiada»), artículos de autor y cartas, apariciones en medios y prensa gastronómica, con filtros y el enlace original de cada una. Cada publicación tiene una portada tipográfica con el nombre del medio: las fotos de las notas no se pudieron descargar desde el entorno de trabajo. Si se consiguen (o se autoriza el acceso a esos sitios), se reemplazan las portadas por fotos.

**Noticias de IA:** se retiraron la sección «Novedades», las notas de `news-data.js` y sus páginas (`article.html`, `articulo.html`). Los enlaces viejos a esas páginas redirigen a `/publicaciones` (archivo `_redirects`), igual que los enlaces a secciones que cambiaron de lugar.

### Movimiento

La palabra «operación» que se abre hasta mostrar al equipo, la luz que sigue al cursor sobre la foto de la portada, las líneas de datos de Automatización (punto 7), títulos que suben línea por línea, apariciones breves al bajar, imágenes con profundidad mínima, tarjetas cuyo borde se ilumina apenas siguiendo el cursor, subrayados que se dibujan, desplazamiento suave con mouse y transiciones entre páginas. Sin cursor personalizado: no mejoraba la experiencia. Con movimiento reducido no hay animaciones y todo se ve completo; sin JavaScript también.

### SEO

Título, descripción, Open Graph y Twitter propios por página, con imagen para compartir de 1200 × 630 (`assets/og/`). Datos estructurados: persona, servicio profesional, catálogo de servicios por área, preguntas frecuentes y migas. `sitemap.xml` actualizado, `404.html` propia y `/automatizacion` como dirección corta del área.

### Archivos

| Archivo | Función |
| --- | --- |
| `assets/css/main.css` | Todo el sistema visual: colores, tipografía, componentes, portada dividida, áreas, publicaciones |
| `assets/js/main.js` | Encabezado y menú, desplazamiento suave, apariciones, formularios, pestañas, filtros, por capas, transiciones |
| `assets/js/split.js` | Portada: crecimiento de paneles, luz bajo el cursor, marca de última visita, elección del área |
| `assets/js/lines.js` | Líneas de datos de la portada y de Automatización (se pausan fuera de pantalla; quietas con movimiento reducido) |
| `assets/img/` | `equipo` y `operacion` (fotos reales) y `lineas` (imagen previa de las líneas), en 1000 y 1800 px |
| `assets/og/` · `assets/apple-touch-icon.png` | Imágenes para compartir e ícono para el celular |
| `_redirects` | Redirecciones de Netlify |
| `netlify.toml` | Netlify no publica el sitio cuando solo cambian archivos de Pulso Informativo (`pulso-news/`, `public/pulso-informativo/`, `.github/`): cada publicación consume créditos |

### Verificación

Revisado en escritorio (1440 × 900 y 1280 × 760) y celular (390 y 449 px): sin errores de consola, sin desplazamiento horizontal, un solo título principal por página, sin saltos de jerarquía, imágenes con texto alternativo y controles con nombre. Probados (33 pruebas automáticas, 14/11): elección de área, visita siguiente sin redirección y marca de última visita, «Cambiar de área», enlaces viejos, formularios por WhatsApp, por email y con Netlify Forms (incluida la caída a WhatsApp si Netlify falla), botones que completan el formulario, pestañas, filtros, WhatsApp en menú, barra inferior y botón flotante, efectos activos y movimiento reducido.

## 7. Contacto directo, fotos reales y efectos (14 de noviembre de 2026)

**Contacto.** Email: ezequielbrunnermdp@gmail.com (reemplaza a contacto@ezequielbrunner.com, que no está en uso). WhatsApp: 223 634-3371 (`wa.me/5492236343371`), con un mensaje inicial que dice desde qué página escribe la persona. Está en el botón flotante, el menú, la barra inferior del celular, los bloques de contacto, el pie y los datos estructurados. Las postulaciones de «Trabajá conmigo» siguen yendo a rrhhmdpgastronomia@gmail.com.

**Fotos reales.** Reemplazan a las imágenes que parecían generadas:

- `equipo.webp`: equipo de Puerto de Palos en Bendu Arena (portada y sección «operación» de Gastronomía).
- `operacion.webp`: coordinación durante un evento (portada de Gastronomía).
- `lineas.webp`: solo la imagen previa de Automatización; el fondo real son líneas dibujadas en el navegador.

**Efectos nuevos.**

- *Luz bajo el cursor* (portada, escritorio): sobre la foto del equipo, un círculo de luz revela los colores reales donde está el cursor.
- *La palabra «operación»* (Gastronomía): al bajar, la palabra se agranda hasta que su «i» abre la pantalla y deja ver al equipo; después aparece el dato de equipos de hasta 135 personas.
- *Líneas de datos* (portada y Automatización): un relieve de líneas que se mueve despacio, con pulsos turquesa y una reacción leve al cursor.

Con movimiento reducido no hay animaciones: la palabra y las líneas quedan quietas y todo el contenido se ve completo.

**Correcciones de la revisión.**

1. Casos reales de automatización (anonimizados) en lugar de ejemplos genéricos.
2. Fotos reales.
3. Una sola voz, en primera persona.
4. Páginas más cortas: prensa y doctrina en listas compactas, etapas y formas de trabajo resumidas.
5. WhatsApp en todo el sitio y formularios que llegan por WhatsApp.
6. La portada ya no redirige al área de la última visita: la marca.
7. Rótulos más grandes y secciones claras (fondo marfil) que alternan con las oscuras.

**Imágenes para compartir.** Regeneradas con las fotos reales y las líneas (`assets/og/`). La dirección lleva `?v=20261114` para que WhatsApp y LinkedIn no muestren la versión anterior guardada.

## Operación del sitio

La publicación conserva el repositorio y el alojamiento actuales. Los cambios se guardan juntos para que no queden páginas con sistemas visuales distintos durante una actualización.
