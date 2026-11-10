# El Cóndor · Pedidos mayoristas

App web para que los clientes mayoristas de El Cóndor hagan sus pedidos desde el celular, y para que la administración y la fábrica los reciban ordenados.

- **Frontend:** React + Vite, publicado en Netlify.
- **Base de datos y login:** Supabase. Cada cliente ve solo lo suyo.
- **Emails y PDF:** Netlify Functions, con envío por Gmail o por Resend.

## Estado

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Login, alta de clientes, catálogo, pedido, email con PDF, modificaciones hasta la hora de corte | ✅ |
| 2 | Pedido habitual / repetir último, cancelar, PDF "Pedidos del día" automático, totales para producción | ✅ |
| 3 | Usuario Fábrica, estados de entrega, faltantes y pendientes, hoja de reparto | ✅ |

---

## 1. Puesta en marcha (una sola vez)

### A. Supabase (base de datos y login)

1. Entrá a <https://supabase.com>, creá una cuenta y tocá **New project**.
   - Nombre: `el-condor-pedidos`. Región: **South America (São Paulo)**.
   - Guardá la contraseña de la base en un lugar seguro.
2. **SQL Editor → New query**: pegá todo el archivo `supabase/01_esquema.sql` y tocá **Run**.
3. Otra query nueva: pegá `supabase/03_etapas_2_y_3.sql` y tocá **Run**.
4. Otra query nueva: pegá `supabase/02_datos_prueba.sql` y tocá **Run**. Carga los 142 productos y 3 clientes de ejemplo.
5. **Authentication → Sign In / Providers → Email**: desactivá **Allow new users to sign up**. Así nadie se puede registrar solo.
6. **Authentication → URL Configuration**:
   - **Site URL:** la dirección de Netlify (paso C), por ejemplo `https://pedidos-el-condor.netlify.app`.
   - **Redirect URLs:** agregá `https://pedidos-el-condor.netlify.app/definir-clave`.
7. **Crear tu usuario administrador:**
   - **Authentication → Users → Add user → Create new user**: tu email y una contraseña, con **Auto Confirm User** tildado.
   - Después, en **SQL Editor**, corré esto con tu email:
     ```sql
     insert into perfiles (id, rol, nombre, email)
     select id, 'admin', 'Ezequiel', email from auth.users where email = 'TU-EMAIL@gmail.com';
     ```
8. **Project Settings → API**: copiá la **Project URL**, la clave **anon public** y la clave **service_role** (esta última es secreta).

### B. Envío de emails con Gmail

Sin dominio propio, los emails salen desde tu Gmail.

1. En tu cuenta de Google activá la **verificación en 2 pasos** (<https://myaccount.google.com/security>).
2. Entrá a <https://myaccount.google.com/apppasswords>, creá una contraseña de aplicación llamada "Pedidos El Cóndor" y copiá los 16 caracteres.
3. Gmail permite unos 500 destinatarios por día, que alcanza de sobra.

> **Más adelante, si tienen dominio** (por ejemplo `elcondor.com.ar`): creá una cuenta en Resend, verificá el dominio y cargá `RESEND_API_KEY`. Si esa variable existe, la app usa Resend en lugar de Gmail.

### C. Netlify

1. **Add new site → Import an existing project → GitHub** → elegí el repo `ezequielbrunner-web`.
2. **Base directory:** `pedidos-el-condor`. El resto lo toma del archivo `netlify.toml`: comando `npm run build` y carpeta `dist`.
3. **Site configuration → Environment variables**: cargá estas variables.

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave **anon public** |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave **service_role** (secreta) |
| `APP_URL` | `https://pedidos-el-condor.netlify.app` (la dirección del sitio) |
| `EMAILS_PEDIDOS` | Emails que reciben cada pedido, separados por coma |
| `EMAILS_FABRICA` | (Opcional) Quién recibe el resumen "Pedidos del día" a la hora de corte. Si no la cargás, va a `EMAILS_PEDIDOS`. |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Tu Gmail |
| `SMTP_PASS` | La contraseña de aplicación del paso B |
| `EMAIL_FROM` | `El Cóndor Pedidos <tu-gmail@gmail.com>` |
| `VITE_WHATSAPP` | (Opcional) WhatsApp de El Cóndor, con formato `549223XXXXXXX`. Se usa en el botón "escribinos" cuando pasó la hora de corte. |

4. **Deploys → Trigger deploy**. Si cambiás una variable, hay que volver a publicar.
   - El envío automático del resumen (función `resumen-automatico`) solo corre en el sitio publicado. Podés verlo en **Logs → Functions**.
5. Para cambiar la dirección: **Domain management → Options → Edit site name**. Si la cambiás, actualizá también `APP_URL` y las URL de Supabase (paso A.6).

---

## 2. Uso diario

### Dar de alta un cliente

1. Entrá con tu usuario admin → **Clientes → + Nuevo cliente**.
2. Completá los datos:
   - **Razón social** (obligatorio) y **nombre de fantasía**: el de fantasía es el que aparece en los pedidos.
   - **Email de acceso:** con ese email entra a la app y recibe las confirmaciones.
   - Teléfono, dirección, horario límite (ej. "hasta las 11 hs") y días que está cerrado.
   - **Observaciones fijas:** salen en todos sus pedidos. Ej. "va sin cargo", "retira por sucursal Peña".
   - **Ve los precios:** si lo destildás, el cliente pide sin ver precios.
   - **Ve solo algunos productos:** después de guardar, elegís cuáles.
3. Elegí cómo recibe el acceso:
   - **Email con link:** le llega un email para que defina su contraseña. El link vence en 24 horas.
   - **Contraseña provisoria:** la app te la muestra **una sola vez**, con un botón para mandársela por WhatsApp.
4. Tocá **Crear cliente**.

Desde la ficha del cliente también podés reenviar la invitación, generar una contraseña nueva, **suspender** (no puede entrar ni pedir), **reactivar**, **dar de baja** (sus pedidos anteriores se conservan) o **cargar un pedido en su nombre**.

Los 3 clientes de ejemplo (Punta Marina, La Delfina y Alito) no tienen email ni acceso. Para probar, cargales un email y tocá "Crear acceso…".

> Tip para probar sin otras casillas: Gmail acepta `tu-gmail+puntamarina@gmail.com`, y llega a tu misma casilla.

### Cambiar la hora de corte

**Configuración → Hora de corte** → elegí la hora → **Guardar**.

Regla: un pedido para entregar el día **D** se puede cargar o modificar hasta esa hora del día **D-1**, en hora de Buenos Aires. Después queda bloqueado para el cliente, que ve un aviso para escribir por WhatsApp. El admin lo puede seguir editando.

### Cambiar precios

- **Uno por uno:** **Productos** → cambiá el número en el casillero del precio y tocá fuera (o Enter). Se guarda solo.
- **Todos juntos:** editá el CSV (`data/catalogo_el_condor.csv`, o uno nuevo con las mismas columnas) → **Productos → Importar CSV**. Antes de confirmar muestra cuántos productos son nuevos y cuáles cambian de precio.
  - Columnas: `seccion, categoria, producto, presentacion, precio_sin_iva`.
  - Un producto se reconoce por **nombre + presentación**. Si ya existe, se actualizan su precio y categoría; si no, se agrega.
  - No se borra nada. Para sacar un producto, tocá **Ocultar**.
  - El precio puede venir como `1890.00`, `1.890,00` o `$ 1.890,00`.
- Los precios son mayoristas **sin IVA**.
- Un pedido ya confirmado guarda el precio del momento: cambiar precios no altera pedidos anteriores.

### Agregar usuarios internos

**Usuarios → Nuevo usuario**, con rol **Administrador** o **Fábrica**.

### Resumen "Pedidos del día"

- **Automático:** a la hora de corte, en los 10 minutos siguientes, sale un email con el PDF "Pedidos del día" para la entrega del día siguiente.
  - Va a `EMAILS_FABRICA`, o a `EMAILS_PEDIDOS` si esa variable no existe.
  - El PDF trae una tabla con las columnas Cliente | Pedido | Cumplido | No cumplido | Observaciones, el total de pedidos y los **Totales para producción**.
  - Se envía una sola vez por fecha.
- **Manual:** **Producción** → elegí la fecha:
  - **PDF Pedidos del día** lo descarga.
  - **Enviar / Reenviar por email** lo manda con los datos actuales. Sirve si hubo cambios después del corte, y el asunto dice "REENVÍO".
- Si alguien modifica un pedido después del resumen (solo puede hacerlo el admin), igual llega el email "MODIFICADO" de ese pedido.

### Fábrica: entregas y faltantes

1. La fábrica entra con su usuario y ve **Pedidos** (con atajos Hoy / Mañana), **Producción** (totales por producto) y **Reparto** (ordenado por horario límite, con PDF para imprimir).
2. En cada pedido cambia el **Estado**: En preparación, Entregado o Entregado con faltantes.
   - Desde "En preparación", el cliente ya no puede modificar el pedido.
3. Con **Entregado con faltantes** se abre una lista: se tilda lo que no se entregó y la cantidad que faltó.
4. Los faltantes aparecen en **Pendientes** (admin):
   - **Pasar al [día]** lo suma al pedido de ese cliente para esa fecha (lo crea si no existe) y avisa por email como modificación.
   - **Cerrar** lo descarta, con una nota opcional.
5. El cliente ve el estado de cada pedido y lo que faltó en **Mis pedidos**.

### Pedido habitual, repetir y cancelar (cliente)

- **↺ Repetir mi último pedido:** carga las cantidades del último pedido, para revisar y confirmar.
- **★ Cargar pedido habitual:** al confirmar cualquier pedido, tildá "Guardar como mi pedido habitual". Desde ahí queda a un toque.
- **Cancelar este pedido:** disponible hasta la hora de corte. Avisa por email a El Cóndor (asunto "CANCELADO").

---

## 3. Cómo funciona un pedido

1. El cliente elige la fecha (por defecto, el primer día que todavía acepta pedidos), carga cantidades y confirma.
   - Los productos por kg aceptan medios (0,5).
   - Los demás van en enteros, según la presentación: docena, caja, pack, etc.
2. El pedido se guarda en la base de datos, que es el registro principal (el email no lo es).
3. Llega un email a `EMAILS_PEDIDOS` con asunto `Pedido #12 – Cliente – entrega mié 12/11`, el detalle legible desde el celular y el PDF adjunto.
4. El cliente recibe un email de confirmación.
5. Si el cliente vuelve a confirmar para la misma fecha, es una **modificación**:
   - El asunto empieza con `MODIFICADO –`.
   - Se resalta qué se agregó, qué cambió de cantidad y qué se quitó.
   - El pedido queda marcado como MODIFICADO en el panel.

Cada cliente tiene un solo pedido por fecha de entrega. Agregar algo es modificar ese mismo pedido.

---

## 4. Archivos

```
pedidos-el-condor/
├── data/catalogo_el_condor.csv     Catálogo (generado de la lista de oct-2026)
├── supabase/01_esquema.sql         Tablas, reglas de acceso y lógica de pedidos
├── supabase/02_datos_prueba.sql    Catálogo + 3 clientes de ejemplo
├── supabase/03_etapas_2_y_3.sql    Cancelar, estados de entrega, faltantes
├── netlify/functions/              Servidor: pedidos, emails, PDF, altas de usuarios
│   ├── pedido.mjs                  Guardar pedido + emails
│   ├── pedido-pdf.mjs              Descargar PDF de un pedido
│   ├── reenviar-pedido.mjs         Reenviar emails de un pedido
│   ├── admin.mjs                   Clientes, accesos y usuarios
│   ├── recuperar.mjs               "Olvidé mi contraseña"
│   ├── resumen.mjs                 PDF Pedidos del día / Reparto y reenvío
│   ├── resumen-automatico.mjs      Envío automático a la hora de corte (cada 10 min)
│   ├── pendientes.mjs              Pasar faltantes a otro día
│   └── _lib/                       Supabase, emails, PDF
└── src/                            Pantallas (React)
```

## 5. Desarrollo local (opcional)

```bash
cd pedidos-el-condor
npm install
cp .env.example .env      # completar
npx netlify dev            # app + funciones en http://localhost:8888
```
