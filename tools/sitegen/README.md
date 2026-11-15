# Generador del sitio

Las cinco páginas (`index.html`, `gastronomia.html`, `inteligencia-artificial.html`, `publicaciones.html` y `404.html`) se generan con este generador. Así comparten encabezado, menú, pie, formularios y datos estructurados sin copias a mano. El HTML generado se guarda en el repositorio y Netlify lo publica tal cual: no hay un paso de compilación en Netlify.

## Cómo cambiar un texto

1. Editá `content.py`. Ahí están los textos, los servicios, la trayectoria, las preguntas frecuentes, la narrativa de Gastronomía, la demostración de IA y los servicios por área.
2. Para las publicaciones, editá `data/publicaciones.json` (doctrina, dossier, artículos y notas, con sus enlaces originales).
3. Generá las páginas:

```bash
python3 tools/sitegen/build.py
```

Necesita Python 3.12 o posterior, sin dependencias externas. Después revisá el resultado y guardá los cambios.

## Archivos

| Archivo | Qué contiene |
| --- | --- |
| `content.py` | Contenido real del sitio. No se publican cifras, clientes ni reconocimientos que no estén acreditados |
| `data/publicaciones.json` | Doctrina, dossier, medios y prensa gastronómica |
| `tpl.py` | Piezas comunes: `<head>`, encabezado, menú, barra inferior, pie, formularios y filas de publicaciones |
| `build.py` | Composición de cada página |

## Estilos y comportamiento (en `assets/`)

| Archivo | Uso |
| --- | --- |
| `css/main.css` | Sistema común: fuentes, colores, tipografía, botones, encabezado, menú, pie, apariciones y publicaciones como índice |
| `css/home.css` | Portada: pantalla dividida, sobre mí, publicaciones destacadas |
| `css/areas.css` | Gastronomía e IA: portada, narrativa, servicios, demostración, casos, método, trayectoria, contacto |
| `css/publicaciones.css` | Biblioteca de publicaciones |
| `js/main.js` | Común: menú, desplazamiento suave, apariciones, formularios, pestañas, filtros, barra inferior |
| `js/split.js` | Portada: reacción al cursor, luz sobre la foto, elección del área y transición |
| `js/lines.js`, `lines-engine.js`, `lines-worker.js` | Líneas de datos con red de nodos. Corren en un hilo aparte cuando el navegador lo permite |
| `js/gastronomia.js` | «Detrás de cada servicio hay una operación» |
| `js/ia.js` | Demostración interactiva |

## Formularios

Por defecto envían la consulta por WhatsApp; el visitante puede elegir email. Para guardar las consultas en Netlify Forms:

1. Activá la detección de formularios en Netlify.
2. En `tpl.py`, función `form`, cambiá `data-endpoint="whatsapp"` por `data-endpoint="netlify"`.
3. Volvé a generar las páginas.

## Publicación

Netlify publica la rama `main`. La regla de `netlify.toml` evita publicar cuando solo cambian archivos de Pulso Informativo. Esta carpeta no forma parte del sitio publicado: `_redirects` la responde con un 404.
