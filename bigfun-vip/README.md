# BIG FUN – Control de consumos VIP

Aplicación web estática, pensada para el celular, que registra las bebidas consumidas por
los clientes VIP de BIG FUN y descuenta su precio de un crédito precargado de **$300.000**.

- **No procesa pagos.** Solo registra consumos y descuenta crédito.
- Sin usuarios, contraseñas ni servicios pagos.
- HTML + CSS + JavaScript sin dependencias. El "build" solo copia archivos y escribe la
  configuración del cliente.
- Un mismo código fuente genera **dos sitios de Netlify** (Cliente VIP 1 y Cliente VIP 2) que
  se configuran con variables de entorno.

---

## ⚠ Limitación importante: los datos quedan en UN teléfono

Los consumos se guardan en el `localStorage` del navegador **del celular donde se cargan**.

- Si la camarera cierra la página, bloquea el teléfono, cambia de app, recarga o apaga el
  celular, **no se pierde nada**: al volver a abrir el enlace aparece el último saldo con todo
  su historial.
- **No se sincroniza entre celulares.** Si dos camareras cargan consumos del mismo cliente en
  dos teléfonos distintos, cada teléfono tendrá su propio saldo. Usar **un solo celular por
  cliente**.
- Los datos están atados al **navegador**: si se abre el enlace en Safari y después en Chrome
  (o dentro de WhatsApp y después en Safari), son almacenes distintos. Abrir siempre el enlace
  de la misma forma (recomendado: Safari en iPhone, Chrome en Android, o el ícono instalado en
  la pantalla de inicio).
- **No usar modo privado / incógnito**: el navegador borra los datos al cerrarlo. Si el
  navegador no permite guardar, la app muestra un aviso rojo.
- Borrar los datos del navegador ("Borrar historial y datos de sitios") elimina los consumos.

Por eso la app incluye **exportación CSV**, **respaldo JSON** e **importación del respaldo**
(ver más abajo). Se recomienda exportar un respaldo JSON cada tanto durante el evento y al
cerrarlo, y enviarlo por WhatsApp o mail al organizador.

---

## Cómo se usa (camareras)

1. Abrir el enlace del cliente (llega por WhatsApp). La primera vez aparecen **$300.000**.
2. Buscar la foto de la bebida (las categorías de arriba llevan directo a cada sección).
3. Tocar la foto → aparece la confirmación con precio y cantidad (por defecto 1; con **+** y
   **−** se cambian las unidades).
4. **CONFIRMAR** → se descuenta, aparece "Consumo registrado" y el nuevo saldo. Se sigue en el
   catálogo para el próximo pedido. **CANCELAR** no descuenta nada.

Consejo: en el iPhone, abrir el enlace en Safari → botón Compartir → **Agregar a inicio**.
En Android, Chrome → menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**.
Queda un ícono BIG FUN que abre la app a pantalla completa.

### Reglas de seguridad del saldo

- El saldo nunca puede quedar negativo: si el total supera lo disponible se muestra
  **"Saldo insuficiente"** y no se puede confirmar (por ejemplo Baron B, $850.000).
- Con poco saldo (≤ $50.000 por defecto) el saldo se pone ámbar con el aviso **SALDO BAJO**.
- Con saldo $0 aparece **CRÉDITO AGOTADO** y se deshabilitan todas las bebidas.
- Tocar varias veces CONFIRMAR registra **un solo** consumo.
- Nada se descuenta hasta confirmar.
- Todos los importes son números enteros en pesos (sin decimales ni redondeos).

### Ver consumos

El botón **Ver consumos** muestra la lista (hora – producto – importe), el total consumido y el
saldo. Desde ahí:

- **Anular**: pide confirmación, devuelve el importe al saldo y deja el consumo tachado como
  "ANULADO" más una línea de anulación. Nada se borra.
- **Exportar CSV**: planilla con fecha, hora, producto, cantidad, precio, importe, estado y
  saldo luego de cada movimiento (separador `;`, se abre directo en Excel).
- **Respaldo JSON**: copia completa de los datos de ese cliente.
- **Importar respaldo**: carga un respaldo JSON (por ejemplo para pasar los datos a otro
  teléfono si el primero se queda sin batería). Solo acepta respaldos del **mismo cliente** y
  pide confirmación antes de reemplazar.
- **Reiniciar crédito**: doble confirmación. Vuelve el saldo al crédito inicial; el historial
  anterior se conserva como ciclo cerrado (no se puede anular ni se pierde).

---

## Estructura

```
bigfun-vip/
├── netlify.toml        Build y cabeceras para Netlify (base directory: bigfun-vip)
├── build.mjs           Genera dist/ con la configuración del cliente (sin dependencias)
├── package.json        Atajos: npm run build:1, build:2, test, test:e2e
├── src/
│   ├── index.html      Pantalla única
│   ├── styles.css      Estilo negro y dorado, mobile first
│   ├── catalog.js      Catálogo y precios (único lugar donde están los precios)
│   ├── core.js         Lógica de crédito (enteros, validaciones, CSV, respaldo)
│   ├── app.js          Pantalla, guardado en localStorage, diálogos
│   ├── sw.js           Service worker (abre aunque haya mala señal)
│   ├── img/            Fotos optimizadas (480×480 JPEG, ~20–55 KB)
│   └── icons/          Íconos de la app
├── tests/
│   ├── core.test.js    Pruebas de cálculo y reglas
│   └── e2e.js          Prueba en navegador real con los dos clientes
└── CREDITOS-FOTOS.md   Autoría y licencia de cada fotografía
```

### Variables de entorno

| Variable | Obligatoria | Ejemplo | Uso |
| --- | --- | --- | --- |
| `VIP_CLIENT_ID` | Sí | `cliente1` | Identificador único. Define la clave de guardado `bigfun-vip:v1:cliente1`. Solo minúsculas, números y guiones. |
| `VIP_CLIENT_NAME` | Recomendada | `CLIENTE VIP 1` | Texto que se ve en el encabezado. |
| `VIP_INITIAL_CREDIT` | No | `300000` | Crédito inicial en pesos enteros, **sin puntos**. Por defecto 300000. |
| `VIP_LOW_BALANCE` | No | `50000` | Umbral de "saldo bajo". Por defecto 50000. |

Si falta `VIP_CLIENT_ID` el build falla a propósito, para no publicar un sitio sin cliente.

> Cambiar `VIP_INITIAL_CREDIT` después de que un teléfono ya empezó a cargar consumos no
> modifica ese teléfono (conserva sus datos). Para aplicar un crédito nuevo hay que usar
> "Reiniciar crédito" o empezar en un navegador sin datos.

### Independencia de los dos clientes

Cada sitio de Netlify tiene su propio dominio (`bigfun-cliente1.netlify.app`,
`bigfun-cliente2.netlify.app`), y el navegador guarda los datos de cada dominio por separado.
Además la clave de guardado incluye el `VIP_CLIENT_ID`, y la importación rechaza respaldos de
otro cliente. Así, saldos, consumos e historiales nunca se mezclan, incluso si un mismo
teléfono abre los dos enlaces.

---

## Publicar los dos sitios en Netlify

Los dos sitios salen de este mismo repositorio. Repetir estos pasos dos veces, una por cliente.

### Opción A – Desde el panel de Netlify (recomendada)

1. Entrar a <https://app.netlify.com> → **Add new project** → **Import an existing project**
   → GitHub → elegir el repositorio `ezequielbrunner-web`.
2. Configuración del build:
   - **Branch to deploy**: la rama donde está esta carpeta (por ejemplo `main` una vez
     integrada, o `claude/bigfun-vip-tracker-86sxyc` mientras tanto).
   - **Base directory**: `bigfun-vip`
   - **Build command**: `node build.mjs` (ya viene de `netlify.toml`)
   - **Publish directory**: `dist` (Netlify lo muestra como `bigfun-vip/dist`)
3. En **Environment variables** agregar:
   - Sitio 1: `VIP_CLIENT_ID` = `cliente1`, `VIP_CLIENT_NAME` = `CLIENTE VIP 1`,
     `VIP_INITIAL_CREDIT` = `300000`
   - Sitio 2: `VIP_CLIENT_ID` = `cliente2`, `VIP_CLIENT_NAME` = `CLIENTE VIP 2`,
     `VIP_INITIAL_CREDIT` = `300000`
4. **Deploy**.
5. **Project configuration → Change project name**: `bigfun-cliente1` (y `bigfun-cliente2`
   para el otro). Si el nombre está ocupado, elegir otro (por ejemplo `bigfun-vip1-2026`).
   El enlace queda `https://<nombre>.netlify.app`.

Si se cambian variables después del primer deploy: **Deploys → Trigger deploy → Deploy
project** para que tomen efecto.

### Opción B – Con Netlify CLI (sin conectar Git)

```bash
cd bigfun-vip
npm i -g netlify-cli
netlify login

# Cliente 1
VIP_CLIENT_ID=cliente1 VIP_CLIENT_NAME="CLIENTE VIP 1" VIP_INITIAL_CREDIT=300000 node build.mjs
netlify sites:create --name bigfun-cliente1
netlify deploy --prod --dir dist --site bigfun-cliente1

# Cliente 2
VIP_CLIENT_ID=cliente2 VIP_CLIENT_NAME="CLIENTE VIP 2" VIP_INITIAL_CREDIT=300000 node build.mjs
netlify sites:create --name bigfun-cliente2
netlify deploy --prod --dir dist --site bigfun-cliente2
```

Con esta opción las variables se pasan al construir en la propia computadora; conviene
igualmente cargarlas en el panel por si después se conecta Git.

### Opción C – GitHub Pages (gratis, si Netlify no tiene créditos)

El repositorio es público, así que GitHub Pages lo publica sin costo. `npm run pages`
genera `docs/cliente1/` y `docs/cliente2/` en la raíz del repositorio (ya están generadas).

1. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
2. **Branch**: la rama que tiene la carpeta `docs/` (por ejemplo
   `claude/bigfun-vip-tracker-86sxyc`) y carpeta **/docs** → **Save**.
3. En uno o dos minutos quedan:
   - Cliente 1: `https://ezequielbrunnermdp-a11y.github.io/ezequielbrunner-web/cliente1/`
   - Cliente 2: `https://ezequielbrunnermdp-a11y.github.io/ezequielbrunner-web/cliente2/`

Los dos comparten dominio, pero cada uno guarda sus datos con su propia clave
(`bigfun-vip:v1:cliente1` / `cliente2`), así que saldos e historiales siguen independientes.
Si se cambia algo de la app, volver a correr `npm run pages` y subir los cambios.

### Probar que funcionan (antes del evento)

En cada enlace, desde el celular que se va a usar:

1. Se ve **BIG FUN**, el nombre correcto del cliente y **$300.000** / **$0**.
2. Se ven las fotos (y el nombre en grande en las bebidas sin foto).
3. Tocar Heineken → CONFIRMAR → saldo **$290.000** y "Consumo registrado".
4. Cerrar el navegador por completo, volver a abrir el enlace → sigue en **$290.000**.
5. Abrir el **otro** enlace → muestra el otro cliente con **$300.000** (independiente).
6. Ver consumos → Anular la Heineken → vuelve a **$300.000** y queda la anulación registrada.
7. Ver consumos → Reiniciar crédito (doble confirmación) para dejar el ciclo de prueba
   cerrado antes del evento. *(El historial de prueba queda guardado como ciclo anterior; si
   se prefiere empezar totalmente limpio, borrar los datos del sitio en el navegador de ese
   teléfono.)*

Después, compartir cada enlace por WhatsApp **solo** con la camarera de ese cliente.

---

## Desarrollo y pruebas

Requiere Node 18 o superior.

```bash
cd bigfun-vip
npm test                 # cálculos, saldo, anulación, reinicio, respaldo, CSV
npm run build:1          # genera dist-cliente1/
npm run build:2          # genera dist-cliente2/
npx serve dist-cliente1  # (o cualquier servidor estático) para verlo en el navegador
npm run test:e2e         # prueba completa en Chromium; requiere Playwright
```

La prueba `e2e` construye los dos clientes, los sirve en dos orígenes distintos (como dos
sitios de Netlify) y verifica en un iPhone emulado: pantalla inicial, fotos, confirmación,
cálculos (300.000 − Heineken − Fernet = 278.000), cantidades, doble toque, bloqueo por saldo
insuficiente, persistencia tras recargar y reabrir, independencia de los dos sitios,
historial, anulación, exportación CSV/JSON, importación, rechazo de respaldos de otro
cliente, reinicio con doble confirmación, saldo bajo y saldo cero.

### Modificar el catálogo

Los productos y precios están únicamente en `src/catalog.js`. Cada producto usa la foto
`src/img/<id>.jpg` (cuadrada, 480×480). Los productos de la lista `NO_PHOTO` (Sernova,
Johnnie Walker Red y Black, Chandon, Baron B, agua, gaseosa y Speed) no tienen foto: su
tarjeta muestra el nombre en grande. Para agregarles foto: `scripts/foto.sh <archivo> <id>`
y sacar el id de `NO_PHOTO`. Las pruebas de `tests/core.test.js` verifican los
precios acordados: si se cambia un precio a propósito, actualizar también la prueba.

## Fotografías

15 productos tienen foto; los otros 8 muestran el nombre en grande. Las fotos provienen de Wikimedia Commons, con licencias libres (Creative Commons / dominio
público) que permiten su uso con atribución. Están descargadas y optimizadas dentro del
proyecto, sin enlaces externos. Autor, licencia y fuente de cada una: `CREDITOS-FOTOS.md`.
Las marcas que aparecen en las botellas pertenecen a sus respectivos dueños; se muestran solo
para identificar el producto servido.
