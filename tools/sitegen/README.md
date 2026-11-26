# Generador del sitio

El sitio es una sola página (`index.html`) más la página de error (`404.html`) y el `sitemap.xml`. Los tres se generan con este generador y se guardan en el repositorio: Netlify publica los archivos tal cual, sin paso de compilación.

## Cómo cambiar un texto

1. Editá `content.py`. Ahí están todos los textos: portada, servicios, sobre mí, proyectos, galería, contacto y datos para buscadores.
2. Para las notas de prensa y las publicaciones, editá `data/publicaciones.json` (cada una con su medio, título, fecha y enlace original). Las tres destacadas se eligen por su enlace en `PRESS['featured']` de `content.py`; el resto aparece en «Ver todas las publicaciones», de la más nueva a la más vieja.
3. Generá las páginas:

```bash
python3 tools/sitegen/build.py
```

Necesita Python 3.10 o posterior, sin dependencias externas. Después revisá el resultado y guardá los cambios.

### Instagram

Cuando esté la cuenta, completá `INSTAGRAM` (dirección) e `INSTAGRAM_HANDLE` (por ejemplo `@usuario`) en `content.py` y generá de nuevo: aparece sola en Contacto y en los datos estructurados.

## Archivos

| Archivo | Qué contiene |
| --- | --- |
| `content.py` | Todo el texto visible. Solo hechos ya publicados o dados por el titular: nada de clientes, resultados, premios ni publicaciones inventadas |
| `data/publicaciones.json` | Prensa, artículos de autor, doctrina, investigación y el dossier de la Biblioteca del Congreso |
| `build.py` | Arma las páginas: `<head>` con datos para buscadores y redes, encabezado, menú, secciones, pie, visor de fotos |
| `art.py` | Ilustraciones en SVG: la red de la portada (Gastronomía, Negocios y Tecnología) y las seis portadas de proyectos |
| `site.css` | La hoja de estilos. Se incrusta minificada en cada página: no hay un archivo CSS aparte |
| `og.py` | Imagen para compartir en redes (`assets/og/inicio.jpg`, 1200 × 630). Usa Chromium sin ventana |

## Fuera de esta carpeta

| Archivo | Uso |
| --- | --- |
| `assets/js/site.js` | Comportamiento: encabezado, menú del celular, sección activa, apariciones, pausa de la animación fuera de pantalla, tarjetas deslizables, visor de fotos, copiar el email y botón flotante de WhatsApp |
| `assets/fonts/` | Fraunces (romana variable y una itálica fija para títulos), Geist y Geist Mono. Licencia SIL Open Font License |
| `assets/img/` | La firma (retrato chico en blanco y negro) y las fotos de la galería, en AVIF y WebP. `retrato-697.webp` no se muestra: lo usan los datos estructurados |
| `tools/imagenes/fotos.py` | Genera esas imágenes a partir de las fuentes de `tools/imagenes/fuente/` |
| `tools/imagenes/recorte-retrato.py` | Recorta el fondo del retrato original (solo la pared; no toca el rostro ni la ropa) |
| `_redirects` | Direcciones del sitio anterior que llevan a su sección, y carpetas que no se publican |

## Animación

Todo el movimiento está en `site.css`, sin bibliotecas:

- **Portada.** El anillo se dibuja, los tres nodos aparecen y una señal cálida recorre el anillo de Gastronomía a Negocios y a Tecnología, cada 7,5 s. La animación se pausa cuando la portada sale de la pantalla.
- **Proyectos.** Las portadas se animan al pasar el cursor; en pantallas táctiles, una vez al aparecer.
- **Resto.** Una aparición suave por bloque.

Con «reducir movimiento» activado en el sistema, todo queda quieto.
