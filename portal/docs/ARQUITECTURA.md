# Arquitectura y decisiones técnicas

## Visión general

```
Teléfono / PC (PWA React)          Tablet de sucursal (modo kiosco)
        │  JWT de usuario                 │  secreto de dispositivo
        ▼                                 ▼
  Supabase PostgREST / Realtime / Storage / Auth ──► PostgreSQL
        │                                   ├─ RLS en TODAS las tablas
        │                                   ├─ funciones security definer (operaciones sensibles)
        ▼                                   └─ auditoría inmutable
  Edge Function invite-employee (clave de servicio solo en servidor)
```

## Decisiones clave (y por qué)

1. **Operaciones sensibles como funciones SQL transaccionales** (`clock_punch`, `kiosk_punch`, `review_*`,
   `assign_role`, `publish_schedule`, etc.) en lugar de muchas Edge Functions. Motivos: se ejecutan en la
   misma transacción que los datos, usan el reloj del servidor (`now()`), son idempotentes, se prueban con
   PostgreSQL real (140 pruebas) y no requieren claves de servicio. Solo la invitación por correo necesita la
   API de administración de Auth y por eso es una Edge Function.
2. **El cliente nunca decide.** Ocultar botones es solo UX: cada permiso se vuelve a comprobar en RLS o en la
   función. Ver `app.has_perm_branch / has_perm_le / has_perm_org`.
3. **Separación estricta de datos** (marca ≠ razón social ≠ sucursal ≠ sector ≠ persona ≠ responsable):
   - `organizations` (cliente SaaS) → `brands`, `legal_entities` (razón social empleadora) → `branches` (pertenece a una marca y a una razón social) → `sectors`.
   - `profiles` (perfil social voluntario) separado de `employments` (relación laboral) y de `employee_private` (datos sensibles).
   - Una persona = una identidad (`auth.users`); puede tener varias relaciones laborales y sucursales adicionales (`employment_branches`) sin duplicarse.
4. **Roles por alcance**: `role_assignments(scope_type = organization | legal_entity | branch)`. Un permiso
   otorgado a nivel organización cubre sus razones sociales y sucursales; uno de sucursal, solo esa sucursal.
   Roles iniciales: Administrador de empresa, Gerente general, Gerente de sucursal, Encargado, RR. HH., Auditor.
   El rol "Empleado" es implícito (relación laboral activa). La superadministración técnica (`platform_admins`)
   **no** obtiene lectura de mensajes ni de contenido social restringido.
5. **MFA obligatoria para permisos administrativos** (configurable por organización): todas las funciones
   de permiso exigen `aal2` en el JWT. Sin MFA, una persona con rol de gerencia solo ve lo de empleado.
6. **Sin puertas traseras en la mensajería**: las políticas de `messages`/`conversations` solo admiten
   participantes. La moderación de mensajes trabaja únicamente con el extracto que quien denuncia decide
   compartir. No hay cifrado de extremo a extremo (se informa así en la app).
7. **Comunidad acotada**: por defecto la comunidad social es *organización + marca*. Ver perfiles o
   publicaciones de otra marca requiere activar `cross_brand_social` en la organización. Bloqueos
   bidireccionales afectan perfiles, mensajes, comentarios y amistades.
8. **Tiempo**: todo se guarda en `timestamptz` (UTC) y se presenta en la zona de la organización
   (por defecto `America/Argentina/Buenos_Aires`). Los turnos son intervalos `[inicio, fin)` de hasta 24 h,
   por lo que una jornada 22:00 → 06:00 es **una** unidad. Una restricción de exclusión (`btree_gist`) impide
   solapamientos por persona en cualquier sucursal.

## Fichaje (módulo prioritario)

### Modalidad A · Celular con GPS + QR dinámico

1. La pantalla/tablet de la sucursal (dispositivo vinculado) pide `kiosk_issue_qr` cada 30 s. El servidor genera
   24 bytes aleatorios, guarda **solo el hash SHA-256**, con vigencia de 45 s y asociado a sucursal y dispositivo.
   El QR contiene `https://<app>/fichaje?b=<sucursal>&t=<token>` (puede abrirse con la cámara del teléfono).
2. El empleado abre Fichar: la app pide la ubicación **solo en ese momento** (toma la mejor lectura durante
   unos segundos, sin seguimiento) y escanea el QR (BarcodeDetector o jsQR).
3. `clock_punch` (servidor) verifica en orden: sesión → idempotencia (`client_request_id`) → límite de intentos →
   relación laboral y sucursal habilitada (principal, adicional o con turno) → jornada ya abierta → QR
   (existe, misma sucursal, vigente, no reutilizado por esa persona) → geolocalización.
4. Geolocalización (`app.geo_classify`): `inside` si `distancia − min(precisión, radio) ≤ radio`; `imprecise`
   si la precisión supera el máximo configurado; `outside` en otro caso; `unavailable` sin coordenadas.
   Radio inicial sugerido 40 m, **editable por sucursal** (se advierte que suele ser poco para interiores).
5. Resultado: solo `inside` (o GPS no exigido) confirma. Si no, **no se registra nada** y se ofrece pedir
   revisión: se guarda como `pending_review` con la hora del servidor, para validación humana.
6. Cada intento fallido o sospechoso queda en `punch_attempts` (visible para gerencia).

### Modalidad B · Tablet fija (kiosco)

- Vinculación con código de 8 caracteres de un solo uso (15 min) generado por gerencia → la tablet recibe un
  secreto de dispositivo (se guarda solo su hash). Revocable al instante.
- Identificación con **código de empleado + PIN de 6 dígitos** (bcrypt). 5 errores bloquean el PIN 15 min;
  20 errores en 15 min bloquean la tablet. Mismo mensaje para código inexistente o PIN incorrecto.
- Sin biometría. La tablet reinicia la pantalla por inactividad.

### Contingencias

| Situación | Procedimiento |
|---|---|
| Sin teléfono / GPS o cámara fallan | Tablet de la sucursal o **fichada supervisada** (`manual_punch`): responsable + motivo + auditoría |
| Ubicación imprecisa / fuera del perímetro | Pedido de revisión desde la app (queda pendiente, no confirmado) |
| QR vencido o reutilizado | Reescanear el código vigente |
| Sin internet en el teléfono | Se guarda localmente como **solicitud pendiente** (no es una fichada); al reconectar se envía con hora declarada + hora real de recepción, siempre `pending_review` |
| Falla del servidor | La app muestra "NO se registró" y ofrece reintentar o guardar como pendiente |
| Dispositivo no autorizado o revocado | Rechazado por el servidor |

### Sesiones y correcciones

- `attendance_sessions` agrupa ingreso y salida (una sola jornada abierta por persona; índice único parcial).
- Las fichadas son **inmutables** (trigger): no se editan ni borran. Una corrección aprobada crea un registro nuevo
  (`source = correction`, `supersedes_id`, aprobador y fecha) y conserva el original.
- Nadie aprueba sus propias correcciones, fichadas pendientes, solicitudes ni cambios de turno.

## Modelo de datos (resumen)

Tenancy: `organizations, brands, legal_entities, branches, sectors` · Personas: `profiles, employee_private, employments,
employment_branches, user_blocks` · Permisos: `permissions, roles, role_permissions, role_assignments, platform_admins` ·
Social: `friend_requests, friendships, groups, group_members, posts, post_comments, post_reactions, post_mentions,
content_reports, recognitions, polls, poll_votes, events, event_rsvps, benefits, suggestions` · Mensajería:
`conversations, conversation_participants, messages` · Trabajo: `labor_rules, shifts, days_off, shift_changes,
shift_swap_requests, hr_requests, meeting_requests, mgmt_categories, mgmt_tickets, mgmt_ticket_messages,
mgmt_ticket_events` · Fichaje: `kiosk_devices, qr_tokens, qr_token_uses, attendance_sessions, attendance_punches,
punch_attempts, attendance_corrections` · Documentos y formación: `documents, document_events, courses,
course_lessons, course_questions, course_assignments, course_progress, course_completions` · Otros:
`notifications, push_subscriptions, employee_invitations, audit_log`.

Todas las tablas usan UUID (salvo bitácoras con identidad), claves foráneas, restricciones `check`, índices para los
accesos frecuentes y marcas temporales.

## Almacenamiento privado

| Bucket | Ruta | Quién lee |
|---|---|---|
| `media` | `org/{org}/u/{usuario}/…` | Miembros de la organización (fotos de perfil y publicaciones). Cada persona sube solo en su carpeta. Las imágenes se re-codifican en el dispositivo (se eliminan metadatos EXIF/GPS). |
| `chat` | `conv/{conversación}/…` | Solo participantes |
| `documents` | `le/{razón social}/…` | Solo si la fila de `documents` lo autoriza (titular; RR. HH. con `payroll.view` para recibos, contratos, disciplinarios y médicos). Conocer la ruta no alcanza. |
| `branding` | `org/{org}/…` | Miembros; escritura con `org.manage` |

Los archivos se abren con URLs firmadas de corta duración (2 min para documentos).

## Seguridad en el navegador

- CSP estricta (`script-src 'self'`), `frame-ancestors 'none'`, HSTS, `Permissions-Policy` (solo ubicación y cámara propias).
- Sin `dangerouslySetInnerHTML`; los enlaces de publicaciones se renderizan como texto con `rel="noopener noreferrer nofollow"`.
- No se guarda información de negocio en `localStorage`: solo preferencias (tema), la cola de fichadas pendientes
  (hasta enviarse) y el secreto del dispositivo kiosco.
- CSRF: la API usa tokens Bearer (no cookies), por lo que no aplica CSRF clásico; la Edge Function restringe CORS por `ALLOWED_ORIGINS`.
