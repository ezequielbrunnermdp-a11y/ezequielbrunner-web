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
- **Opcional · guardar las consultas en Netlify:** en Netlify → *Project configuration → Forms*, activar *Enable form detection*; después, en `tools/sitegen/tpl.py` (función `form`), cambiar `data-endpoint="whatsapp"` por `data-endpoint="netlify"`, generar las páginas con `python3 tools/sitegen/build.py` y volver a publicar. Las consultas quedan en Netlify (formularios `solicitar-asesoramiento` y `evaluar-empresa`), el visitante ve «¡Gracias! Recibí tu consulta» sin salir de la página y, si Netlify falla, se pasa solo a WhatsApp. Para recibirlas por email: *Forms → Form notifications → Email notification*. Tiene un campo trampa contra spam. Las consultas guardadas consumen créditos del plan de Netlify.

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

## 8. Digital Experience 2026 (15 de noviembre de 2026)

La portada y el lenguaje visual de este punto fueron reemplazados por el punto 9; el resto sigue vigente.

### Auditoría (fase A)

Se revisaron el código, los generadores y la versión de `main` (la misma que está publicada) en un navegador automatizado, en 320, 390, 430, 768, 1024, 1280 y 1440 px de ancho. El dominio publicado no era accesible desde el entorno de trabajo, así que se auditó el mismo código en un servidor local.

Hallazgos, por prioridad:

1. **Rendimiento.**
   - El lienzo de líneas corría en el hilo principal: unos 6 s de trabajo en la portada y bloqueos de 1,3 s (inicio) y 1,7 s (IA).
   - Google Fonts y las entradas que esperaban a las fuentes demoraban el contenido principal (LCP de 2,7 a 3,5 s).
2. **Portada.**
   - Al pasar el cursor mostraba 15 y 16 servicios, y al elegir un área esperaba 900 ms antes de navegar.
   - En tablet era un celular agrandado.
   - En 320 px el nombre chocaba con la etiqueta y el botón de WhatsApp tapaba un botón.
3. **Gastronomía.** «Por capas» usaba renders 3D con estética de plantilla y repetía la idea de la palabra «operación».
4. **IA.** Cuatro secciones distintas describían la oferta (soluciones, servicios, ejemplos y departamentos), y el flujo de ejemplo era decorativo.
5. **Accesibilidad.**
   - Contraste de 4,4:1 en los desplegables de los formularios.
   - «Cambiar de área» sin nombre en el celular.
   - El texto visible de la marca no coincidía con su nombre accesible.

**Se conservó:**
- la paleta y las tipografías;
- la estructura de páginas y las direcciones;
- las fotos reales y el relieve de líneas;
- los formularios por WhatsApp;
- la regla de Netlify que evita publicar por cambios de Pulso Informativo.

### Dirección creativa (fase B)

**Concepto: la estructura que sostiene.** La frase propia «El servicio se ve. La gestión lo sostiene.» une las tres dimensiones:

- la operación detrás de cada servicio (gastronomía);
- los datos detrás de cada proceso (automatización);
- los algoritmos detrás de cada decisión (transparencia algorítmica, Derecho).

Cada efecto tiene esa función: **mostrar lo que hay detrás**. Ninguno está solo para decorar.

- La luz revela los colores reales de la foto del equipo.
- La palabra «operación» se abre hasta mostrar a las personas.
- Las conexiones aparecen entre los nodos de la red.
- La demostración muestra qué pasa en cada etapa de una automatización, y quién decide.

### Qué se implementó (fase C)

**Portada**
- Una promesa por área y, al acercar el cursor, dos datos acreditados: «15+ años en operaciones gastronómicas» y «135 personas en equipos para eventos»; en IA, «02 automatizaciones propias» y «05 áreas».
- El catálogo completo queda en cada página.
- **Gastronomía:** el panel crece, la foto gana luz y una luz sigue al cursor.
- **IA:** la red de nodos se enciende, las conexiones se dibujan una tras otra y viajan pulsos de información.
- **Al elegir:** se navega al instante, sin la espera de 900 ms. Con View Transitions (Chrome, Edge y Safari 18.2+), la imagen y el título del panel se convierten en la portada del área; en Firefox se navega sin animación. La transición solo se activa al llegar desde la elección, así otras navegaciones no animan elementos fuera de pantalla.
- **Tablet:** dos paneles táctiles lado a lado.
- **Celular:** una composición propia, con una línea de identidad («Gestión gastronómica, automatización con inteligencia artificial y Derecho aplicado a la tecnología.») y dos puertas con recortes cuidados, botón redondo y respuesta al toque. Las dos se ven completas desde 320 × 568.
- El botón flotante de WhatsApp se oculta mientras se elige y aparece después.

**Gastronomía**
- Nueva sección «Detrás de cada servicio hay una operación», que integra la palabra «operación». En escritorio la sección queda fija y cada pilar cambia la composición:
  1. **Personas:** la foto del equipo a pantalla completa.
  2. **Procesos:** la foto se corre a la derecha y se dibuja la rutina (apertura, servicio, cierre, registro).
  3. **Costos:** la foto se angosta y se arma la fórmula del costo de mercadería vendida.
  4. **Resultados:** la foto se cierra y se dibujan los indicadores que se siguen, sin cifras inventadas.

  Cierre: «El servicio se ve. La gestión lo sostiene.». En el celular, con movimiento reducido y sin JavaScript, los pilares se leen uno debajo del otro.
- La sección «Por capas» y sus renders 3D se retiraron. Las imágenes siguen en `assets/capas/`, sin uso.
- **Servicios:** un índice editorial de cuatro filas que se despliegan, con el detalle y los entregables. Se mantienen todas las anclas, por ejemplo `#recursos-humanos`, `#gestion-del-personal` y `#cat-costos`.
- **Trayectoria:** cifras animadas solo con datos acreditados (15+ años; equipos de hasta 135 personas), la foto de coordinación, el recorrido profesional, la prensa, la doctrina laboral y la formación.

**Automatización & IA**
- Las líneas de datos suman una red de nodos apoyados sobre el relieve: procesos que se conectan.
  - Los nodos cercanos al cursor se encienden.
  - En pantallas táctiles, una ola lenta enciende la red sola.
- **Demostración interactiva**, identificada como ficticia: un pedido de reposición recorre «Solicitud → Registro → Procesamiento → Informe → Decisión humana».
  - Cada etapa muestra qué hace la tecnología, cómo era sin automatización y qué hace la persona.
  - Se reproduce una vez al entrar en pantalla y se puede pausar.
  - Se recorre con el teclado.
  - En la última etapa, el visitante decide (aprobar o ajustar) y la decisión queda registrada.
- Los 16 servicios reales se agrupan por área (Administración, Operaciones, Ventas y atención, RR. HH. y Gerencia), más una fila «En todas las áreas». Cada área tiene un ejemplo de aplicación; en RR. HH. el ejemplo es uno de los casos reales.
- Se unificaron cuatro secciones de oferta en una.

**Sobre mí (portada).** Retrato real en color, el manifiesto propio y tres capítulos breves: Operación, Tecnología y Derecho. Se aclara «No ejerzo como abogado matriculado».

**Publicaciones**
- Una biblioteca editorial:
  - trabajos destacados (Dossier n.º 335, la doctrina principal en SAIJ, la investigación en SSRN y la ponencia premiada);
  - filtros que quedan fijos al bajar y muestran cuántas publicaciones hay en cada grupo;
  - un índice por tipo con fuente, fecha y enlace original.
- Se conservan las 31 publicaciones.

### Lenguaje de movimiento

| Efecto | Para qué | Duración y curva | Distancia | Cuándo | Táctil | Movimiento reducido |
| --- | --- | --- | --- | --- | --- | --- |
| Título de cada portada, línea por línea | Presentar la promesa | 1,2 s, `cubic-bezier(.16, 1, .3, 1)`, 90 ms entre líneas | Sube 46 % de la línea con fundido | Al cargar, sin esperar a las fuentes | Igual | Aparece quieto |
| Títulos de sección | Ordenar la lectura | 1,15 s `power4.out`, 80 ms entre líneas | 108 % de la línea, dentro de una máscara | Al entrar en pantalla, una vez | Igual | Sin animación |
| Apariciones de contenido | Dar ritmo | 0,9 s (opacidad) y 1,1 s (posición), salida suave | 18 px | Al verse, una vez; 80 ms entre hermanos | Igual | Visible desde el inicio |
| Panel de la portada que crece | Foco en un universo | 1,1 s `cubic-bezier(.7, 0, .25, 1)` | De 50 % a 60 % del ancho | Cursor o foco del teclado | No: paneles fijos | Sin transición |
| Luz sobre la foto | Revelar la operación real | Cuadro a cuadro | Radio de 300 px | Cursor | No | No |
| Red de nodos | Procesos que se conectan | Conexiones en cerca de 1 s; pulsos de 0,8 a 1,7 s | — | Cursor y paso sobre el panel | Ola automática lenta | Un cuadro quieto con la red visible |
| Transición entre páginas | Continuidad | 0,7 s `cubic-bezier(.65, 0, .35, 1)` | La imagen del panel pasa a la portada | Al elegir un área | Igual (Safari 18.2+) | Desactivada |
| Narrativa de la operación | Explicar la gestión | 4,6 pantallas, arrastre de 0,6 s | Cambia la composición entera | Desplazamiento | Versión apilada | Versión apilada |
| Demostración | Entender una automatización | Una etapa cada 3,6 s; transiciones de 0,6 a 0,8 s | — | Una vez al verse, con pausa | Igual | Sin reproducción automática |
| Botones y enlaces | Respuesta inmediata | 0,45 a 0,6 s | Flecha 5 px; relleno desde abajo | Cursor y foco | Estado activo al tocar | Sin transición |
| Cifras | Dato acreditado | 1,7 s, salida cúbica | — | Al verse | Igual | Número final |

No hay cursor personalizado ni animaciones en bucle que distraigan de la lectura. La única excepción es el pulso discreto del botón de WhatsApp.

### Rendimiento: antes y después

| Página | Rendimiento | LCP | TBT | FCP | CLS | Peso | Accesibilidad |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inicio | 73 → **97** | 2,69 → **2,54 s** | 1288 → **0 ms** | 1,48 → **0,96 s** | 0 → 0 | 428 → 297 KB | 100 → 100 |
| Gastronomía | 88 → **97** | 3,47 → **2,57 s** | 190 → **25 ms** | 1,52 → **1,00 s** | 0 → 0 | 385 → 300 KB | 92 → **100** |
| Automatización & IA | 64 → **98** | 3,45 → **2,47 s** | 1724 → **18 ms** | 1,54 → **0,97 s** | 0 → 0 | 357 → 254 KB | 94 → **100** |
| Publicaciones | 90 → **99** | 3,41 → **2,14 s** | 21 → **0 ms** | 1,56 → **0,94 s** | 0 → 0 | 274 → 200 KB | 96 → **100** |

Buenas prácticas y SEO: 100 en las cuatro páginas, antes y después. TBT (tiempo de bloqueo) es la medida de laboratorio que anticipa la respuesta a la interacción (INP); no se pudo medir INP con usuarios reales.

**Condiciones de la medición:**
- Lighthouse 12.6.1, perfil móvil, red 4G lenta simulada (1,6 Mbps, 150 ms) y CPU ×4.
- Servidor local con compresión brotli, sin HTTP/2, en el mismo equipo para las dos versiones.
- Mediana de 3 corridas por página.
- **Antes:** el código de `main`, idéntico al publicado. **Después:** esta rama.
- Son mediciones de laboratorio: no hay datos de usuarios reales ni pruebas en celulares físicos.

**Qué cambió:**
- Las líneas de datos se dibujan en un hilo aparte (Worker con OffscreenCanvas). Se pausan fuera de pantalla y con la pestaña oculta. En equipos modestos usan menos líneas y menos resolución; con movimiento reducido o ahorro de datos, un solo cuadro quieto.
- **Fuentes propias:** Fraunces e Inter, recortadas a los caracteres y las funciones que usa el sitio, conservando los ejes de peso y tamaño óptico. Pasaron de 197 KB a 148 KB. Se precargan y tienen respaldos con métricas ajustadas (CLS 0).
- Fotos en AVIF, con WebP de respaldo. La imagen de las líneas pasó de un fondo CSS de 76 KB a una imagen AVIF de 16 a 39 KB que el navegador descubre temprano.
- Las entradas arrancan con el primer cuadro, sin esperar a las fuentes. Sin demoras al navegar.
- **Estilos y scripts por página:**
  - ScrollTrigger solo se carga en las áreas;
  - se quitaron unos 22 KB de reglas de secciones retiradas;
  - `main.css`, `home.css`, `areas.css` y `publicaciones.css` reemplazan al archivo único.

El LCP es ahora un texto y queda en el orden de los 2,5 s. Lo que falta para bajarlo son las fuentes. Fijar el tamaño óptico de Fraunces ahorraría cerca de 40 KB, pero empobrecería los títulos grandes, que son la firma visual, así que no se hizo.

### Accesibilidad y responsive (WCAG 2.2 AA)

- **Lighthouse:** 100 de accesibilidad en las cuatro páginas.
- **Matriz automática** (9 tamaños: 320 × 568, 390 × 844, 430 × 932, 768 × 1024, 1024 × 768, 1280 × 800, 1440 × 900, 1440 × 700 y 390 × 600; 5 páginas), sin observaciones:
  - sin desplazamiento horizontal;
  - sin textos que se pisen en la primera pantalla;
  - todos los controles tienen nombre;
  - un solo h1 por página y sin saltos de títulos;
  - objetivos táctiles de al menos 24 × 24 px.
- **Teclado:**
  - pestañas de la demostración y de las áreas con flechas, Inicio y Fin;
  - desplegables nativos;
  - menú con foco contenido y cierre con Escape;
  - foco visible de 2 px.
- **Movimiento reducido:** sin secciones fijas, sin reproducción automática, con el lienzo quieto y todo el contenido visible. Sin JavaScript, todo el contenido se lee: cada sección tiene su versión estática.

### Pruebas (fase D)

- **51 pruebas de comportamiento, todas superadas:**
  - portada: cursor, elección inmediata, última visita, WhatsApp;
  - enlaces viejos y anclas de las cuatro páginas;
  - formularios por WhatsApp, por email y con Netlify Forms, incluida la caída a WhatsApp si Netlify falla;
  - demostración: reproducción y pausa, teclado y decisión;
  - servicios por área y los 16 servicios publicados;
  - narrativa fija en escritorio y apilada en el celular;
  - menú y barra inferior del celular;
  - filtros y las 31 publicaciones;
  - movimiento reducido.
- Sin errores de consola ni recursos faltantes.

### Código

- **Generador:** el de las páginas está en `tools/sitegen/` (ver su `README.md`). Los textos se editan en `content.py` y las publicaciones en `data/publicaciones.json`; las páginas se generan con `python3 tools/sitegen/build.py`. Ya no depende de un commit viejo ni de bibliotecas externas.
- **Archivos nuevos:**
  - `assets/css/home.css`, `areas.css` y `publicaciones.css`;
  - `assets/js/gastronomia.js`, `ia.js`, `lines-engine.js` y `lines-worker.js`;
  - `assets/fonts/`;
  - imágenes AVIF y `assets/img/retrato*`.
- **Sin publicar:** `/tools/*` y este documento responden 404 en el sitio.
- **Sin cambios:**
  - `netlify.toml` y su regla para Pulso Informativo;
  - `pulso-news/`, `public/pulso-informativo/` y las automatizaciones de GitHub Actions.

### Limitaciones y pendientes

- **Dominio y dispositivos:** el dominio publicado no se pudo abrir desde el entorno de trabajo y no hubo pruebas en dispositivos físicos. La vista previa de Netlify de esta rama es la forma de revisarlo en celulares reales.
- **LCP:** en la medición simulada queda cerca de 2,5 s (ver tabla).
- **Netlify Forms:** sigue desactivado, porque consume créditos. Las consultas llegan por WhatsApp o email.
- **Analítica:** no se agregó. Si se quiere, conviene una herramienta respetuosa de la privacidad (por ejemplo Plausible, o Netlify Analytics en el plan de Netlify), configurada antes de activarla.
- **Fotos:** hay tres fotos reales (equipo, coordinación y retrato). Más fotos propias de trabajo (cocina, capacitación, aperturas) permitirían enriquecer Gastronomía.
- **Para confirmar:** la redacción de los dos casos reales de automatización y el email de postulaciones (rrhhmdpgastronomia@gmail.com).

## 9. Rediseño cinematográfico (15 de noviembre de 2026)

Este punto describe la versión vigente. Donde contradice a los anteriores (en especial la portada del punto 8), vale este.

**Referencia.** La imagen de referencia que menciona el pedido no llegó adjunta. Se trabajó con su descripción escrita:

- fondo negro profundo y un retrato cinematográfico al centro;
- Gastronomía en luz cobre a la izquierda e IA en turquesa a la derecha, separadas por la luz y no por cortes;
- dos accesos grandes en paneles de vidrio, unidos por líneas de luz;
- navegación limpia arriba y, abajo, trayectoria, producción académica y contacto.

El personaje de la imagen de referencia, generado con IA, no se usó.

### Retrato

- Es la foto real (`assets/profile.jpeg`). Se recortó en el equipo con OpenCV (GrabCut), sin IA generativa: solo se quitó la pared del fondo. El rostro y los rasgos no se modificaron. El script es `tools/imagenes/recorte-retrato.py`.
- La integración es solo con CSS:
  - una máscara elíptica funde los hombros, que la foto corta en línea recta;
  - luces de borde cobre y turquesa toman la forma de la silueta (un trazado vectorial de 1,6 KB dentro del CSS) y se difuminan alrededor de la figura;
  - un tono suave y un contraste leve lo integran a la escena.
- El retrato se mueve como bloque, como máximo 5 px, y no se escala ni se deforma.
- Peso: 37 KB (AVIF) o 40 KB (WebP); en celulares, 13 a 21 KB.

### Portada

- **Jerarquía:** quién soy (retrato y nombre) → qué hago («Operaciones reales. / Tecnología que resuelve.» y «Dirección gastronómica, optimización de procesos y automatización inteligente.») → los dos accesos → trayectoria, producción académica y contacto. Después siguen «Quién soy», la trayectoria, la producción académica y el contacto.
- **Escritorio:** el nombre flanquea el rostro a la altura de los ojos, por detrás del retrato. La propuesta va sobre el torso, los accesos a los costados y la franja de vidrio abajo.
- **Accesos** (paneles de vidrio):
  - **Gastronomía:** la foto real del equipo con tono cobre. «Dirección, operación y gestión de establecimientos.»
  - **Automatización & Inteligencia Artificial:** un gráfico de proceso animado (nodos, recorridos y barras), sin robots ni cerebros. «Procesos más simples, equipos más eficientes y decisiones con información.»
- **Líneas de luz:** siete hebras de cobre a turquesa unen los dos accesos y llevan pulsos hacia el área activa. Se dibujan en un hilo aparte (Worker con OffscreenCanvas) y se pausan fuera de pantalla.
- **Tablet:** retrato, nombre y propuesta en columna, y los dos accesos lado a lado.
- **Celular:** el retrato toma el alto que dejan libre el nombre, la propuesta y los accesos. Así, los dos accesos se ven completos en la primera pantalla desde 320 × 568, también en un iPhone con las barras de Safari visibles (390 × 664).
- **Pantallas bajas de escritorio** (por ejemplo 1440 × 700 o una tablet apaisada): el retrato gana alto y los accesos se compactan para que el nombre no los toque.
- La portada no muestra catálogos: los servicios están en cada área.

### Movimiento

| Efecto | Qué hace | Cuándo | Táctil | Movimiento reducido |
| --- | --- | --- | --- | --- |
| A. Luz que responde | Las luces cobre y turquesa siguen al cursor con inercia y se inclinan hacia el área activa | Cursor | Luces fijas | Luces fijas |
| B. Profundidad | Fondo, nombre y retrato se desplazan en capas (hasta 15, 7 y 5 px). El rostro no se deforma | Cursor | No | No |
| C. Líneas de luz | Siete hebras con pulsos que viajan hacia el área activa | Siempre, en pausa fuera de pantalla | Sí | Un cuadro quieto |
| D. Acceso activo | El panel sube 8 px, se enciende su perímetro, la escena cambia de temperatura y la flecha avanza | Cursor o foco del teclado | Leve presión al tocar | Sin animación |
| E. Transición entre páginas | El panel, su imagen y su título se convierten en el panel de vidrio, la portada y el título del área, en 0,7 s | Al elegir un acceso | Igual (Safari 18.2+) | Desactivada |
| F. Apariciones | Entrada escalonada del retrato, el nombre, la propuesta y los accesos; títulos línea por línea y contenidos al verse | Al cargar y al desplazarse | Igual | Todo visible desde el inicio |

### Lenguaje común en las páginas internas

- Fondo negro con luz de color en las esquinas: cobre en Gastronomía, turquesa en IA y champagne en Publicaciones.
- **Paneles de vidrio:** el texto de la portada de cada área (es el mismo panel que se eligió en la portada), las etapas, los casos, la demostración y los formularios.
- Las líneas de progreso brillan con el color del área.
- Se retiraron las secciones claras, que cortaban la continuidad.
- Publicaciones conserva los 31 enlaces originales y la distinción por tipo. El contacto mantiene WhatsApp, email y los formularios.

### Corrección: transición entre páginas

En la versión publicada, la transición entre páginas se cancelaba en cerca de la mitad de las navegaciones. Chromium informaba «ViewTransition opt-in disabled».

- **Causa:** un script inicial consultaba la preferencia de movimiento antes de que llegara `main.css`, donde estaba la regla `@view-transition`.
- **Arreglo:** la regla va en línea en el `<head>` de cada página.
- **Resultado:** 10 de 10 navegaciones con transición (antes, 3 de 6). Panel, imagen y título viajan desde el acceso elegido, en las dos áreas.

### Rendimiento: publicado y rediseño

Mediana de 3 corridas por página. Lighthouse 12.6.1, perfil móvil (4G lenta simulada y CPU ×4), mismo servidor local para las dos versiones. «Publicado» es el código de `main`, idéntico al sitio actual.

| Página | Rendimiento | LCP | TBT | FCP | CLS | Peso | Accesibilidad |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Inicio | 97 → 96 | 2,51 → 2,81 s | 0 → 0 ms | 0,93 → 0,94 s | 0 → 0 | 297 → 300 KB | 100 → 100 |
| Gastronomía | 97 → 97 | 2,54 → 2,61 s | 5 → 20 ms | 0,97 → 0,96 s | 0 → 0 | 300 → 301 KB | 100 → 100 |
| Automatización & IA | 98 → 97 | 2,45 → 2,61 s | 12 → 2 ms | 0,95 → 0,96 s | 0 → 0 | 254 → 256 KB | 100 → 100 |
| Publicaciones | 99 → 99 | 2,14 → 2,15 s | 3 → 0 ms | 0,94 → 0,95 s | 0 → 0 | 200 → 201 KB | 100 → 100 |

Buenas prácticas y SEO: 100 en las cuatro páginas, en las dos versiones.

- **Inicio:** el elemento principal ahora es la foto del retrato, y antes era un texto. Por eso el LCP sube 0,3 s en la red simulada. El peso es el mismo: la silueta de las luces de borde es un trazado vectorial de 1,6 KB dentro del CSS, sin otra descarga, y la foto del acceso de Gastronomía tiene una versión de 600 px. Antes de esos dos ajustes, la portada daba 94 y 3,04 s.
- **Páginas internas:** quedan prácticamente iguales. El panel de vidrio sobre la portada de cada área suma algo de trabajo de dibujo (+0,1 s de LCP).

### Accesibilidad y pruebas

- **64 pruebas de comportamiento, todas superadas.** 23 cubren la portada nueva:
  - nombre, claim, subtítulo y textos de los accesos exactos;
  - retrato real con texto alternativo;
  - luz y escena que responden al cursor y al teclado;
  - elección inmediata, área guardada, transición y última visita;
  - franja inferior;
  - en el celular, los dos accesos en la primera pantalla y el toque que navega.
- **Matriz de accesibilidad y maquetación** (13 tamaños × 5 páginas, incluidos 375 × 548 y 390 × 664 con las barras del navegador), sin observaciones:
  - sin desplazamiento horizontal;
  - sin textos que se pisen;
  - controles con nombre;
  - un h1 por página;
  - objetivos táctiles de al menos 24 × 24 px.
- **Primera pantalla de la portada:** 24 tamaños, de 320 × 568 a 2560 × 1440, sin superposiciones entre nombre, propuesta y accesos.
- **Títulos en varias líneas:** el texto queda separado («Operaciones reales. Tecnología que resuelve.»). Antes quedaba pegado para lectores de pantalla y buscadores («reales.Tecnología»).
- **Marca del encabezado:** el objetivo táctil pasa a 44 px de alto.

### Archivos

- **Nuevos:**
  - `assets/js/home.js`, que reemplaza a `split.js`;
  - `assets/img/retrato-recorte*.avif|webp` y `equipo-600.avif|webp`, la foto del acceso de Gastronomía;
  - `tools/imagenes/recorte-retrato.py`.
- **Cambiados:**
  - `assets/css/home.css` (reescrito), `main.css`, `areas.css` y `publicaciones.css`;
  - `assets/js/lines*.js` y `main.js`;
  - el generador (`tools/sitegen/`).
- **Sin cambios:**
  - `netlify.toml` y `_redirects`;
  - `pulso-news/`, `public/pulso-informativo/` y las automatizaciones de GitHub Actions;
  - los formularios.

### Limitaciones

- **Imagen de referencia:** no llegó. Con la imagen se puede ajustar la composición, la intensidad de la luz y la tipografía.
- **Resolución del retrato:** la foto mide 697 × 1046 px y en pantallas grandes se ve algo blanda. Una foto de mayor resolución, con fondo liso y luz lateral, daría un resultado más nítido.
- **Navegadores:**
  - sin `backdrop-filter`, los paneles se ven translúcidos sin desenfoque, igual de legibles;
  - Firefox navega sin transición.
- **Dispositivos:** no hubo pruebas en dispositivos físicos. La vista previa de Netlify sirve para revisarlo en celulares reales.

## Operación del sitio

La publicación conserva el repositorio y el alojamiento actuales. Los cambios se guardan juntos para que no queden páginas con sistemas visuales distintos durante una actualización.
