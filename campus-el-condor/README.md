# EL CÓNDOR · Campus de formación

Web de formación interna para El Cóndor Coffee Shop: diez módulos con lecciones, prácticas y evaluaciones explicadas,
seis casos interactivos y un simulador de mesa, buscador transversal, catálogo de productos, códigos y promociones
configurables, biblioteca, videos con texto equivalente, progreso local por perfil, modo facilitador y gestión local de contenido.

Es un **sitio estático** (React + TypeScript + Vite) preparado para Cloudflare Pages: sin servidor, sin Functions,
sin claves de API y sin servicios pagos.

## Uso rápido

```bash
npm ci              # instala exactamente las versiones de package-lock.json (Node 20 o superior)
npm run dev         # entorno de desarrollo en http://localhost:5173
npm run build       # verifica TypeScript y compila en dist/
npm run preview     # sirve dist/ en http://localhost:4173
npm test            # pruebas unitarias (Vitest)
npm run package     # genera entrega/campus-el-condor-publicar.zip y entrega/campus-el-condor-codigo-fuente.zip
node tests/e2e/verify.cjs http://localhost:4173/   # verificación en navegador (requiere Playwright + Chromium)
```

Para publicar, ver [docs/publicacion-cloudflare.md](docs/publicacion-cloudflare.md).

## Estructura

```
src/
  app/          Shell, navegación (lateral en escritorio, inferior en móvil) y router por hash
  components/   UI compartida (modales accesibles, insignias, avisos), marca e ilustraciones SVG
  content/      Contenido pedagógico: módulos, 30 preguntas, casos, guiones, biblioteca, tipos y metadatos
  features/     Pantallas: inicio, aprender, prácticas, evaluaciones, consultar, progreso, videos, gestionar, perfiles
  lib/          Lógica pura: progreso y evaluaciones, fechas y moneda AR, promociones, CSV, importación de códigos, búsqueda
  storage/      Persistencia (localStorage versionado + IndexedDB para archivos) y respaldos
  styles/       Tokens de marca y estilos
  brand.config.ts  ÚNICO punto para incorporar el logo
public/
  brand/        Logo oficial (pendiente)
  materiales/   Documentos publicados con el sitio (accesibles por URL)
  _headers      Encabezados para Cloudflare Pages
docs/           Publicación, guiones, contenidos pendientes y matriz de contenidos
tests/          Pruebas unitarias y verificación de punta a punta
```

## Incorporar el logo

1. Copiá el archivo en `public/brand/` (por ejemplo `logo-el-condor.svg`).
2. En `src/brand.config.ts`, completá `logo: 'brand/logo-el-condor.svg'` (y `logoOnDark` si hay versión clara para la barra lateral oscura).
3. Si los colores del logo difieren de la paleta provisoria, ajustá `src/styles/tokens.css` y verificá contraste (los valores actuales están documentados en el archivo).
4. `npm run build`.

## Contenido y estados

- Todo el contenido pedagógico es original y figura como **Contenido propuesto** (`approvalStatus: "sin-aprobar"`), con
  `approvedAt` y `approvedBy` vacíos. El **estado de publicación** (“Publicado en el campus”) es independiente del **estado de aprobación** empresarial.
- Los ejemplos se identifican como **Práctica**: seis productos genéricos con precio y código `null`, y una promoción ficticia.
- No hay precios, códigos, alérgenos, promociones, procedimientos de personal ni datos institucionales inventados.
  Ver [docs/contenidos-pendientes.md](docs/contenidos-pendientes.md).
- El umbral de 80 % de las evaluaciones es un parámetro de práctica configurable, no un requisito oficial.

## Persistencia y límites

- Progreso por **perfil local** en `localStorage` con claves versionadas (`condor.v1.*`); archivos propios como binarios en **IndexedDB**
  (las URL `blob:` se regeneran en cada sesión).
- Los datos quedan en ese navegador, pueden perderse al borrar el almacenamiento y **no se sincronizan** entre dispositivos.
- No hay reportes colectivos ni resultados de otras personas.
- “Gestionar contenido” modifica solo el dispositivo; no publica cambios para el equipo. No hay PIN ni rutas ocultas.
- El modo facilitador y la etiqueta “Encargado/a” no crean permisos. Las respuestas de las evaluaciones están en el cliente y no son secretas.
- Respaldos de progreso y de configuración con validación de tipo y versión, detección de conflictos y confirmación antes de reemplazar.
  El JSON de configuración no incluye archivos: trae un `fileManifest` con los que hay que volver a asociar.
- Sin modo sin conexión (PWA) en esta versión: se priorizó una web estable.

## Ampliación futura: acceso privado y sincronización

Si se necesita que el progreso siga a cada persona entre dispositivos, reportes para encargados o documentos privados, hace falta:

1. **Autenticación real** (por ejemplo Cloudflare Access para restringir el sitio, o un proveedor de identidad con cuentas por persona).
2. **Almacenamiento en servidor** para progreso y contenido (por ejemplo Cloudflare D1 o KV detrás de Pages Functions, o un backend propio), con permisos por rol verificados en el servidor.
3. **Archivos privados** servidos con control de acceso (por ejemplo R2 con URLs firmadas), en lugar de `public/materiales/`.
4. Migración: el formato de respaldo (`el-condor-campus/progreso`, versión 1) permite importar el progreso local existente.

## Accesibilidad

HTML semántico, encabezados ordenados, foco visible, navegación completa con teclado, modales sobre `<dialog>` con foco atrapado y devuelto,
alternativas sin arrastrar (botones y teclado para ordenar), lista equivalente para la escena ilustrada, estados que no dependen solo del color,
tablas que se reacomodan en el teléfono, `prefers-reduced-motion` respetado y contraste AA verificado.
