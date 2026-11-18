# Generador del sitio

Las seis páginas (`index.html`, `gastronomia.html`, `inteligencia-artificial.html`, `trayectoria.html`, `publicaciones.html` y `404.html`) se generan con este generador. Así comparten encabezado, menú, pie, formularios y datos estructurados sin copias a mano. El HTML generado se guarda en el repositorio y Netlify lo publica tal cual: no hay un paso de compilación en Netlify.

## Cómo cambiar un texto

1. Editá `content.py`. Ahí están los textos, los servicios, la trayectoria, las preguntas frecuentes, los siete ejes de Gastronomía (`AXES`), los procesos de la demostración de IA (`DEMO`) y los servicios por área.
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
| `css/main.css` | Sistema común: fuentes, colores, tipografía, botones, navegación global, menú, pie, apariciones, publicaciones como índice, lenguaje cinematográfico (luz de color, vidrio) y la firma con el retrato pequeño |
| `css/home.css` | Portada: escena 3D, nombre, propuesta y accesos; quién soy (titular y firma), trayectoria resumida, publicaciones destacadas y contacto |
| `css/trayectoria.css` | Trayectoria: dirección gastronómica con línea de tiempo, formación, investigación, publicaciones y medios |
| `css/areas.css` | Gastronomía e IA: portada, índice de la página, los siete ejes y la calculadora, demostración con procesos, casos, método, contacto |
| `css/publicaciones.css` | Biblioteca de publicaciones |
| `js/main.js` | Común: menú, desplazamiento suave, apariciones, formularios, pestañas, filtros, barra inferior |
| `js/home.js` | Portada: los accesos le avisan a la escena (cálido o frío), elección del área, última visita y transición |
| `js/scene.js`, `scene-engine.js`, `scene-worker.js` | Escena 3D de la portada («la operación y su capa de información»): WebGL2 y GLSL propios, en un hilo aparte cuando el navegador lo permite; imagen fija sin WebGL2 (`assets/img/escena*.avif\|webp`). El encuadre lo define el CSS con `--scene-l/r/t/b` |
| `js/lines.js`, `lines-engine.js`, `lines-worker.js` | Líneas de datos con red de nodos (portada de IA). Corren en un hilo aparte cuando el navegador lo permite |
| `js/gastronomia.js` | Los siete ejes: índice que sigue la lectura, visuales que se dibujan y calculadora de costo de un plato |
| `js/ia.js` | Demostración interactiva: cuatro procesos y cinco etapas |

## Retrato de la portada

El retrato es la foto real (`assets/profile.jpeg`), recortada en el equipo con OpenCV, sin IA generativa: solo se quita la pared del fondo y no se toca el rostro. Para regenerarlo:

```bash
pip install opencv-python-headless pillow
python3 tools/imagenes/recorte-retrato.py             # deja el recorte y dos vistas de control en tools/imagenes/
python3 tools/imagenes/recorte-retrato.py --exportar  # además escribe assets/img/retrato-recorte*.avif|webp
python3 tools/imagenes/firma-retrato.py               # la firma discreta (96 y 192 px, blanco y negro) a partir del recorte
```

Si se cambia la foto, hay que revisar las zonas marcadas a mano en el script (el mueble junto al hombro derecho). Los PNG y JPG de control no se guardan en el repositorio.

## Formularios

Por defecto envían la consulta por WhatsApp; el visitante puede elegir email. Para guardar las consultas en Netlify Forms:

1. Activá la detección de formularios en Netlify.
2. En `tpl.py`, función `form`, cambiá `data-endpoint="whatsapp"` por `data-endpoint="netlify"`.
3. Volvé a generar las páginas.

## Publicación

Netlify publica la rama `main`. La regla de `netlify.toml` evita publicar cuando solo cambian archivos de Pulso Informativo. Esta carpeta no forma parte del sitio publicado: `_redirects` la responde con un 404.
