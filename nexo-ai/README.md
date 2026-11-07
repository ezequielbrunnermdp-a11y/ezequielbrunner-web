# NEXO AI — Operational Intelligence Platform

Aplicación web privada que convierte chats laborales exportados de WhatsApp en tareas, decisiones e incidencias **trazables**, para empresas gastronómicas con varias sucursales.

Principio central: **nada se convierte en un hecho sin evidencia y validación humana.** El análisis (IA o reglas) sólo *propone*; cada propuesta cita el mensaje original y una persona decide.

---

## 1. Puesta en marcha

```bash
cd nexo-ai
npm install
cp .env.example .env.local   # completar NEXO_ENCRYPTION_KEY (y opcionalmente ANTHROPIC_API_KEY)
npm run dev                  # http://localhost:3000 → /setup la primera vez
npm test                     # 45 pruebas automatizadas
```

- **Sin `DATABASE_URL`** usa Postgres embebido (PGlite) en `./.data` — ideal para desarrollo.
- **Con `DATABASE_URL`** usa Postgres/Supabase. Las migraciones se aplican solas al iniciar (o con `npm run db:migrate`).
- En la configuración inicial podés crear, además de tu empresa, una **empresa de demostración** separada con conversaciones ficticias (marcada con un banner violeta en toda la interfaz).

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión a Postgres/Supabase (rol de servidor). |
| `NEXO_ENCRYPTION_KEY` | 32 bytes en base64. **Obligatoria en producción.** `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ANTHROPIC_API_KEY` | Sólo servidor. Sin ella, el análisis usa reglas locales y el buscador muestra mensajes sin respuesta generada. |
| `NEXO_CLAUDE_MODEL` | Por defecto `claude-opus-5-5`. |
| `NEXO_TIMEZONE` | Zona para mostrar fechas de eventos (por defecto `America/Argentina/Buenos_Aires`). |

### Despliegue en Supabase
1. Crear el proyecto y copiar el *connection string* (rol `postgres`, pooler) a `DATABASE_URL`.
2. Iniciar la app una vez (o `npm run db:migrate`).
3. Ejecutar `src/lib/db/supabase_rls.sql` en el SQL Editor: habilita RLS y bloquea toda tabla a los roles `anon`/`authenticated`, así la API pública de Supabase no expone nada aunque se filtre la anon key.
4. Desplegar en Vercel u otro host Node con las variables de arriba.

---

## 2. Arquitectura

```
Navegador ──► Next.js 16 (App Router, React 19, Tailwind 4)
               ├─ proxy.ts ............ filtro rápido de sesión
               ├─ Server Components ... lectura (siempre vía servicios con permisos)
               ├─ Server Actions ...... mutaciones (validadas con zod)
               └─ /api/imports, /api/reports/export (subida y descargas)
                        │
                 src/lib (servicios de dominio, sin dependencias de UI)
                 ├─ whatsapp/  parser · ZIP · huellas anti-duplicados
                 ├─ imports/   importación idempotente con procedencia
                 ├─ analysis/  motores (Claude / reglas) → compuerta de evidencia → bandeja
                 ├─ tasks/     máquina de estados + historial
                 ├─ search/    texto completo en español + preguntas con citas
                 ├─ reports/   agregados del período + PDF (pdf-lib) + Excel (exceljs)
                 ├─ admin/     sucursales, miembros, privacidad, retención, borrado
                 └─ auth/      sesiones, roles, authorize()
                        │
                 PostgreSQL (pg) o PGlite — mismo SQL
                        │
                 Claude API (sólo desde el servidor, salida JSON con esquema)
```

**Aislamiento entre empresas.** Cada fila de negocio tiene `company_id`. Toda operación pasa por `authorize(db, userId, companyId, permiso)`, que verifica en la base la membresía y el rol; cada servicio vuelve a comprobar el permiso y filtra por `company_id`. Ser administrador de plataforma **no** da acceso a datos de empresas.

### Esquema de datos (`netlify/database/migrations/`)

| Tabla | Contenido |
|---|---|
| `users`, `sessions` | Cuentas (scrypt) y sesiones (token aleatorio guardado como SHA-256). |
| `companies`, `memberships`, `branches` | Empresas, rol de cada persona por empresa, sucursales. `companies.settings` guarda la privacidad. |
| `conversations`, `participants` | Chats importados y sus participantes (nombres enmascarados si son números). |
| `imports` | Procedencia: archivo, SHA-256, formato de fecha detectado, totales, advertencias. |
| `messages` | Hora local, autor, texto, tipo, **huella única por conversación**, línea de origen, línea original cifrada, marca de sospecha de inyección, índice de búsqueda en español. |
| `analysis_runs` | Cada ejecución del análisis: motor, modelo, mensajes, hallazgos creados y salidas rechazadas. |
| `findings`, `finding_evidence` | Hallazgos propuestos y las citas textuales que los respaldan. `dedupe_key` evita repetirlos al reanalizar. |
| `tasks`, `task_events` | Tareas y su historial completo (quién, cuándo, de qué estado a cuál, nota, mensaje de evidencia). |
| `audit_log` | Registro de acciones (nunca guarda contenido de mensajes). |

### Pantallas

| Ruta | Función |
|---|---|
| `/setup`, `/login` | Configuración inicial (una sola vez) e ingreso. |
| `/dashboard` | KPIs, mensajes por día, tareas abiertas por sucursal, lo que requiere atención, novedades. |
| `/imports` | Subida .txt/.zip, resultado (nuevos / duplicados / advertencias) e historial con borrado. |
| `/conversations/[id]` | Lectura del chat con procedencia por mensaje, ejecución del análisis, edición y borrado. |
| `/inbox` | Bandeja de validación: evidencia resaltada, confianza, validar / sin info suficiente / descartar; confirmar cumplimientos. |
| `/tasks`, `/tasks/[id]` | Filtros, alta manual, cambio de estado con reglas, evidencia e historial. |
| `/search` | Preguntas en lenguaje natural con citas verificadas + búsqueda por palabras. |
| `/reports` | Diario / semanal / mensual, exportación PDF y Excel. |
| `/admin` | Sucursales, usuarios y roles, privacidad y retención, auditoría, empresas, borrado total. |

---

## 3. Flujo de importación

1. **Lectura** (`whatsapp/archive.ts`): acepta `.txt` (UTF-8 o UTF-16) o `.zip`. Del ZIP sólo se descomprime el `.txt` del chat, validando el tamaño declarado (protección ante *zip bombs*); fotos y audios se descartan sin guardarse.
2. **Parseo** (`whatsapp/parser.ts`): Android y iPhone, 24 h y 12 h (`a. m.`, `PM`, espacios finos), separadores `/ . -`, años de 2/4 dígitos, ISO, día/mes o mes/día (detección automática con aviso si es ambiguo, o forzado), multilínea, mensajes de sistema, multimedia, eliminados y editados, marcas invisibles. Cada mensaje guarda la línea donde empieza.
3. **Minimización**: teléfonos y correos se enmascaran en el texto visible; autores sin agendar se muestran como `Contacto ••34`. La línea original se guarda cifrada (AES-256-GCM) sólo para trazabilidad.
4. **Anti-duplicados** (`whatsapp/dedupe.ts`): huella = hora + autor + tipo + texto normalizado + nº de ocurrencia. Inserción con `on conflict do nothing` sobre `(conversación, huella)`. Reimportar el mismo archivo no inserta nada; una exportación más nueva sólo agrega lo nuevo; mensajes idénticos legítimos en el mismo minuto se conservan.
5. **Detección de inyección**: mensajes con frases como "ignorá las instrucciones" se marcan como sospechosos y se muestran así en la interfaz.

## 4. Motor de análisis y reglas de veracidad

- **Claude** (`analysis/claude.ts`): los mensajes viajan como JSON dentro de `<datos_conversacion>`, con alias (`P1`, `P2`) en lugar de nombres e IDs cortos. El sistema declara que ese contenido es no confiable. El modelo no tiene herramientas: sólo devuelve JSON con un esquema fijo (structured outputs). Usa *fallback* del servidor ante rechazos.
- **Reglas locales** (`analysis/heuristics.ts`): patrones del español rioplatense, plazos relativos ("mañana", "antes del viernes", "para el 2/1"), responsables por vocativo o @mención. Confianza máxima 0,6.
- **Compuerta de evidencia** (`analysis/validate.ts`), igual para ambos motores: se descarta todo hallazgo sin evidencia, que cite un mensaje inexistente, cuya cita no aparezca literalmente en el mensaje, o que contenga evaluaciones de personas o sanciones.
- **Bandeja**: los hallazgos quedan `propuestos`. Sólo una persona con permiso los convierte en tareas (o decisiones registradas). Un "posible cumplimiento" sólo cierra una tarea cuando alguien elige cuál confirma.
- **Estados de tarea**: Pendiente, En curso, Cumplida, Descartada, Sin información suficiente. Para marcarla cumplida hace falta un mensaje de evidencia o una nota; descartar o reabrir exige motivo. Todo queda en el historial.
- El buscador conversacional oculta cualquier respuesta que no pueda respaldarse con citas verificadas.

## 5. Seguridad y privacidad

- Contraseñas con scrypt; verificación con costo constante; límite de intentos de ingreso.
- Cookies `httpOnly`, `sameSite=lax`, `secure` en producción; sesiones revocables.
- Server Actions con verificación de origen de Next; `/api/imports` verifica `Origin`.
- Cabeceras de seguridad (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
- Roles: **Propietario** (todo, incluido borrar la empresa) · **Administrador** (usuarios, sucursales, privacidad, importaciones) · **Encargado** (importar, analizar, validar, tareas) · **Analista** (consultar, analizar, reportes) · **Lectura**. Nadie asigna un rol superior al propio y siempre queda un propietario.
- Eliminación: por importación, por conversación, retención automática por días y borrado total de la empresa (con confirmación por identificador).
- Reportes con métricas agregadas; no hay rankings ni evaluaciones de empleados.

## 6. Pruebas

`npm test` (Vitest + Postgres real en memoria):

- `parser.test.ts` — formatos Android/iOS, 12 h, mes/día, ISO, multilínea, sistema, multimedia, fechas inválidas, ZIP, UTF-16.
- `dedupe.test.ts` — reimportación, exportaciones superpuestas, aislamiento por empresa, borrado y restauración, cifrado de la línea original.
- `tasks.test.ts` — máquina de estados, historial, hallazgo → tarea sólo con validación, confirmación de cumplimiento con evidencia, reanálisis sin duplicados.
- `permissions.test.ts` — matriz de roles, aislamiento entre empresas con IDs conocidos, jerarquía de miembros, borrado de empresa, sesiones.
- `analysis.test.ts` — compuerta de evidencia, motor de reglas, privacidad y un modelo "manipulado" por inyección que no logra crear hallazgos falsos ni cerrar tareas.
- `demo.test.ts` — la empresa demo pasa por el pipeline real.

## 7. Limitaciones conocidas y próximos pasos

- WhatsApp no exporta IDs ni zona horaria: dos exportaciones del mismo chat desde teléfonos distintos (con distinto nombre de contacto o con/sin segundos) no se reconocen como duplicadas.
- El análisis con IA corre dentro de la petición (hasta 3.000 mensajes por ejecución). Para volúmenes grandes conviene moverlo a una cola de trabajos.
- El límite de intentos de ingreso vive en memoria del proceso; con varias instancias conviene llevarlo a la base o a Redis.
- Pendiente: recuperación de contraseña por email, 2FA, invitaciones por enlace, notificaciones de vencimientos.
