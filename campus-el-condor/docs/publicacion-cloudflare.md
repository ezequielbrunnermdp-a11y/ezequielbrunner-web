# Publicar el campus en Cloudflare Pages

> Estado: los archivos están **preparados** para publicar. Ninguna versión fue publicada todavía
> y no existe una URL de despliegue. Cloudflare asigna la dirección al crear el proyecto.

## Qué hay que subir

| Archivo / carpeta | Qué es | ¿Se sube a Pages? |
| --- | --- | --- |
| `entrega/campus-el-condor-publicar.zip` | Archivos compilados (contenido de `dist/`), con `index.html` en la raíz | **Sí** |
| `dist/` | Los mismos archivos compilados, sin comprimir | Sí (alternativa al ZIP) |
| `entrega/campus-el-condor-codigo-fuente.zip` | Código fuente para modificar y volver a compilar | No |

**Código fuente** (`src/`, `package.json`, etc.) es lo que se edita. **Archivos compilados** (`dist/`) son el
resultado de `npm run build`: HTML, CSS, JavaScript y fuentes listos para el navegador. Pages solo necesita los compilados.

El ZIP de publicación contiene `index.html`, `favicon.svg`, `_headers`, `assets/`, `brand/` y `materiales/` en su raíz,
sin carpeta intermedia.

## Generar los paquetes

```bash
npm ci            # instalación reproducible a partir de package-lock.json
npm run build     # verifica TypeScript y compila en dist/
npm run package   # crea entrega/*.zip y controla que ningún archivo supere 25 MiB
```

## Crear el proyecto (carga directa, sin Git)

1. Ingresá al panel de Cloudflare → **Workers & Pages** → **Create** → pestaña **Pages** → **Upload assets** (carga directa).
2. Escribí un nombre de proyecto (por ejemplo `campus-el-condor`). El nombre define el subdominio `*.pages.dev`.
3. Arrastrá `campus-el-condor-publicar.zip` o la carpeta `dist/`.
4. Elegí **Deploy site**. Cloudflare muestra la dirección asignada.

No hace falta configurar comando de compilación, variables de entorno, Functions ni reglas de redirección:
la navegación usa `#/` (por ejemplo `…/#/consultar/codigos`), así que cualquier sección abre y recarga sin reglas del proveedor.

## Publicar una nueva versión

1. Hacé los cambios en el código fuente y ejecutá `npm run build` y `npm run package`.
2. En el proyecto de Pages → **Deployments** → **Create deployment** (o “Upload assets” de nuevo).
3. Subí el nuevo ZIP o la nueva carpeta `dist/`. La versión anterior queda en el historial y puede restaurarse.

## Comprobar que funciona

- Abrí la dirección asignada: tiene que aparecer “Cada buen servicio empieza por un equipo preparado”.
- Abrí directamente `…/#/consultar/biblioteca` y recargá: debe mostrar la biblioteca.
- Marcá una lección como leída, cerrá y volvé a abrir: el progreso debe seguir.
- Probá desde un teléfono: navegación inferior con Inicio, Aprender, Consultar, Progreso y Más.
- Opcional, desde el código fuente: `npm run preview` y `node tests/e2e/verify.cjs <url>` contra la dirección publicada.

## Límites de Cloudflare Pages a tener en cuenta

No pude consultar la documentación de Cloudflare desde el entorno de desarrollo (el sitio no era accesible),
así que estos valores provienen de la documentación conocida y **conviene confirmarlos** en
<https://developers.cloudflare.com/pages/platform/limits/> antes de publicar:

- Tamaño máximo por archivo: **25 MiB**. `npm run package` rechaza archivos más grandes.
- Cantidad de archivos por sitio en el plan gratuito: **20.000**. Esta versión genera unos 25.
- La carga por arrastrar y soltar en el panel tiene un límite de archivos menor que la carga por línea de comandos (Wrangler); para este sitio no es un problema.

## Videos y documentos propios

- Un video de varios minutos en 1080p suele superar 25 MiB. Opciones: exportarlo en MP4 H.264 a 720p
  (a 1,5–2 Mbps cada minuto ocupa unos 11–15 MB, así que dos minutos rondan los 22–30 MB), dividirlo,
  o alojarlo en un servicio de video y enlazarlo. No lo incluyas en `public/` si supera el límite: la publicación falla.
- Los archivos de `public/materiales/` quedan accesibles para cualquiera que conozca su URL.
  No publiques documentos confidenciales.
- Los archivos asociados desde “Gestionar contenido” se guardan solo en ese navegador y **no** se publican.

## Limitaciones de esta versión

- Sin servidor, sin cuentas y sin base de datos: el progreso vive en el navegador de cada persona.
- No hay sincronización entre dispositivos ni reportes del equipo.
- La gestión local de contenido no publica cambios para los demás.
- El modo facilitador y la etiqueta “Encargado/a” no crean permisos.
- No hay funcionamiento sin conexión (PWA): se priorizó una web estable. Queda como mejora futura.
