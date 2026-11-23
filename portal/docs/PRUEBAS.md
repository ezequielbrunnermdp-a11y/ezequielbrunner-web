# Pruebas y resultados

Última ejecución: 23/11/2026 · Todas las suites en verde.

| Suite | Herramienta | Resultado |
|---|---|---|
| Base de datos: RLS, permisos, aislamiento, fichaje, QR, kiosco, horarios, documentos | `npm run test:db` (PostgreSQL 16 real + migraciones reales) | **140 / 140** |
| Lógica (zonas horarias, turnos nocturnos, geocerca, QR, cola offline, errores) y pantalla de fichaje | `npm test` (Vitest + Testing Library) | **26 / 26** |
| Tipos | `npm run typecheck` (TypeScript estricto, `noUncheckedIndexedAccess`) | Sin errores |
| Build de producción + service worker | `npm run build` | OK |
| Revisión visual (móvil, escritorio, tablet, modo oscuro) | Playwright con datos simulados en el navegador | Revisada manualmente |

## Cómo ejecutar las pruebas de base de datos

`scripts/test-db.mjs` crea una base limpia, aplica `supabase/tests/00_supabase_shim.sql` (emulación mínima de
roles `anon/authenticated/service_role`, `auth.uid()`, `auth.jwt()` y `storage.objects`) y **todas las migraciones
reales**, y luego actúa como cada rol con `set local role` + claims JWT, igual que PostgREST. Es decir: las pruebas
hacen las mismas consultas que haría alguien llamando directamente a la API.

```bash
# PostgreSQL local (ejemplo)
initdb -D /tmp/pgdata -A trust && pg_ctl -D /tmp/pgdata -o "-p 54329 -k /tmp" start
PGHOST=/tmp PGPORT=54329 PGUSER=postgres npm run test:db
```

Límite conocido: la emulación no es Supabase completo (Auth real, envío de correos, Realtime y Storage HTTP no se
prueban aquí). Ver "Pruebas pendientes en un proyecto real" abajo.

## Criterios de funcionamiento (sección 28 del pedido)

| # | Criterio | Cobertura | Estado |
|---|---|---|---|
| 1 | Usuarios: invitación, activación, persistencia | SQL: invitación con permisos, vínculo por service_role, activación, contexto persistente, anon sin acceso | ✅ (envío real del correo: pendiente en proyecto real) |
| 2 | Amistades | SQL: solicitud, aceptación, ambos amigos; bloqueo de otra empresa/marca | ✅ |
| 3 | Publicaciones | SQL: publicar, ver, reaccionar, comentar, persistencia, visibilidad por amigos/marca/empresa | ✅ |
| 4 | Mensajería | SQL: envío, recepción, no leídos; terceros, gerencia, admin y superadmin **no** leen; bloqueo | ✅ (tiempo real: probar en proyecto real) |
| 5 | Horarios | SQL: borrador invisible, publicación, modificación con historial y notificación, sin solapamientos | ✅ |
| 6 | Fichaje fuera del perímetro / excepción / registro visible para gerente | SQL + interfaz | ✅ |
| 7 | QR vencido / reutilizado | SQL: vencido, reutilizado, inventado, otra sucursal; tokens ilegibles por API | ✅ |
| 8 | Tablet | SQL: vinculación de un uso, fichada con PIN, mismo almacenamiento, bloqueo, revocación | ✅ |
| 9 | Reunión | SQL: destinatarios autorizados, propuesta de fecha, privacidad | ✅ |
| 10 | Seguridad entre empresas vía API | SQL: 7 tablas + RPC + fichaje + escalamiento de privilegios + MFA | ✅ |
| 11 | Jornada nocturna 22:00 → 06:00 | SQL (una jornada, 7 h 59 min, asociada al turno, no se divide) + Vitest | ✅ |
| 12 | Recibo de otro empleado aunque conozca la ruta | SQL sobre `storage.objects` con políticas reales | ✅ |

## Errores encontrados y corregidos por las pruebas

- Recursión infinita de RLS entre `employments` y `employment_branches` (se resolvió con funciones `security definer`).
- Un `grant select on all tables` posterior anulaba la ocultación de columnas sensibles (`kiosk_pin_hash`, `secret_hash`,
  `last_read_at`); ahora la migración `…001000_column_privileges.sql` se aplica al final.
- Una persona con permiso de horarios podía aprobar **su propio** cambio de turno; ahora el servidor lo impide.

## Pruebas pendientes en un proyecto real de Supabase

- Envío y apertura del correo de invitación y de recuperación (plantillas, redirecciones, SMTP).
- MFA TOTP de punta a punta (alta, desafío, `aal2` en el JWT).
- Realtime (mensajes, notificaciones y tablero de asistencia) con varias sesiones simultáneas.
- Subida/descarga en Storage por HTTP con URLs firmadas (las políticas ya están probadas en SQL).
- GPS en interiores de cada sucursal con varios teléfonos (calibrar radio y precisión).
- Escaneo del QR con iPhone (Safari) y Android (Chrome), incluida la cámara nativa.
- Instalación PWA en iOS y Android; modo kiosco en la tablet real.
- Prueba de carga básica (p. ej. 200 fichadas en 5 minutos en cambio de turno).

## Salida de la última ejecución SQL

```

PRUEBA 1 — Usuarios (invitación, activación, persistencia)
  ✔ el administrador crea la invitación
  ✔ un empleado NO puede invitar
  ✔ complete_employee_invitation no es invocable por usuarios
  ✔ la Edge Function (service_role) vincula identidad y relación laboral
  ✔ la cuenta queda activa y su información persiste
  ✔ sin sesión no hay acceso (anon)

PRUEBA 2 — Amistades
  ✔ emp1 envía solicitud a emp2
  ✔ emp2 la ve como recibida
  ✔ emp2 acepta
  ✔ ambos aparecen como amigos
  ✔ no se puede agregar a alguien de otra empresa
  ✔ entre marcas distintas está deshabilitado por defecto
  ✔ el directorio no muestra personas de otra empresa

PRUEBA 3 — Publicaciones
  ✔ emp1 publica
  ✔ emp2 (misma comunidad) la ve
  ✔ emp2 reacciona y comenta
  ✔ contadores persistidos
  ✔ otra empresa no ve la publicación (consulta directa)
  ✔ otra marca no la ve por defecto
  ✔ una publicación "solo amigos" no es visible para quien no es amigo (ni administración)
  ✔ el autor recibe notificación del comentario
  ✔ un empleado no puede publicar contenido institucional

PRUEBA 4 — Mensajería privada
  ✔ emp1 envía un mensaje
  ✔ emp2 lo recibe (persistido)
  ✔ indicador de no leídos
  ✔ emp3 NO puede leer la conversación (consulta directa)
  ✔ manager NO puede leer la conversación (consulta directa)
  ✔ admin NO puede leer la conversación (consulta directa)
  ✔ platform NO puede leer la conversación (consulta directa)
  ✔ empB NO puede leer la conversación (consulta directa)
  ✔ un tercero no puede escribir en la conversación
  ✔ no es posible sumarse a una conversación ajena
  ✔ tras un bloqueo no se pueden enviar mensajes
  ✔ el bloqueo eliminó la amistad

PRUEBA 5 — Horarios
  ✔ el gerente crea un turno
  ✔ un borrador no es visible para el empleado
  ✔ el gerente publica el horario
  ✔ el empleado ve su turno publicado
  ✔ el gerente modifica el turno
  ✔ queda historial y el empleado recibe la novedad
  ✔ se impiden solapamientos
  ✔ un empleado no puede modificar su horario publicado
  ✔ un gerente de sucursal no programa en otra sucursal
  ✔ se puede asignar personal a otra sucursal de la misma razón social sin duplicar identidad
  ✔ no se asigna a una razón social con la que no hay relación laboral

PRUEBA 6 — Fichaje móvil (GPS + QR)
  ✔ la tablet se vincula con código de un solo uso
  ✔ el código de vinculación no se reutiliza
  ✔ fuera del perímetro: no se confirma y se ofrece revisión
  ✔ …y no se registra ninguna fichada
  ✔ precisión insuficiente se informa como imprecisa
  ✔ dentro del perímetro y con QR vigente: el servidor confirma
  ✔ reintento con el mismo id: idempotente
  ✔ un segundo ingreso con jornada abierta no se registra
  ✔ el gerente visualiza el registro en el panel
  ✔ otra empresa no ve las fichadas
  ✔ procedimiento de excepción: queda pendiente de revisión, no confirmada
  ✔ el responsable valida la fichada pendiente
  ✔ queda registrado quién aprobó
  ✔ el empleado no puede alterar la hora de su fichada
  ✔ nadie puede borrar fichadas desde la API
  ✔ fichada sin conexión: pendiente, con hora declarada y de recepción
  ✔ sin QR no se registra (sucursal con QR obligatorio)
  ✔ no se puede fichar sin sesión

PRUEBA 7 — QR dinámico
  ✔ el mismo QR no puede reutilizarse por la misma persona
  ✔ un QR vencido no se acepta
  ✔ un QR inventado se rechaza
  ✔ un QR de otra sucursal se rechaza
  ✔ los intentos sospechosos quedan registrados y visibles para gerencia
  ✔ los tokens no son legibles desde la API
  ✔ con un QR nuevo y vigente, la salida se confirma

PRUEBA 8 — Tablet de fichaje (kiosco)
  ✔ se rechazan PIN triviales
  ✔ el hash del PIN no es legible desde la API
  ✔ el empleado ficha desde la tablet autorizada
  ✔ se guarda en el mismo sistema que las fichadas móviles
  ✔ PIN incorrecto y código inexistente responden igual (sin enumeración)
  ✔ bloqueo tras intentos fallidos repetidos
  ✔ un dispositivo revocado deja de funcionar
  ✔ un dispositivo no autorizado no puede fichar

PRUEBA 9 — Reuniones
  ✔ el empleado solo ve responsables autorizados
  ✔ gerencia recibe la solicitud
  ✔ el empleado ve la fecha propuesta
  ✔ otros trabajadores no ven la reunión
  ✔ se crea un mensaje a gerencia
  ✔ el canal institucional es exclusivo de sus participantes

PRUEBA 10 — Aislamiento entre empresas y escalamiento de privilegios
  ✔ empB no lee employments de otra empresa
  ✔ empB no lee profiles de otra empresa
  ✔ empB no lee attendance_sessions de otra empresa
  ✔ empB no lee shifts de otra empresa
  ✔ empB no lee hr_requests de otra empresa
  ✔ empB no lee branches de otra empresa
  ✔ empB no lee audit_log de otra empresa
  ✔ perfil de otra empresa no disponible vía RPC
  ✔ no se puede fichar en sucursales de otra empresa
  ✔ un empleado no puede autoasignarse roles
  ✔ un gerente de sucursal no puede otorgar roles
  ✔ un empleado no puede modificar relaciones laborales
  ✔ sin MFA (aal1) los permisos administrativos no se aplican
  ✔ con MFA (aal2) el gerente ve a su equipo
  ✔ un gerente de sucursal no ve personal de otras sucursales
  ✔ un gerente de sucursal no accede a datos personales sensibles
  ✔ la superadministración técnica no lee mensajes privados
  ✔ el administrador de empresa sí puede asignar roles (auditado)
  ✔ la asignación queda en auditoría

PRUEBA 11 — Jornada nocturna (22:00 → 06:00)
  ✔ el turno de 8 h que cruza la medianoche se guarda como una unidad
  ✔ la jornada nocturna figura como UNA jornada, en el día de inicio
  ✔ duración correcta (7 h 59 min)
  ✔ se asocia al turno nocturno programado
  ✔ no se divide en el día siguiente

PRUEBA 12 — Documentos privados (recibos)
  ✔ RR. HH./administración publica el recibo
  ✔ el titular puede acceder a su recibo
  ✔ emp2 NO puede abrirlo aunque conozca la ruta
  ✔ manager NO puede abrirlo aunque conozca la ruta
  ✔ empB NO puede abrirlo aunque conozca la ruta
  ✔ platform NO puede abrirlo aunque conozca la ruta
  ✔ un gerente de sucursal no publica recibos
  ✔ se registra la visualización (distinta de firma o notificación fehaciente)

Extra — Correcciones, solicitudes y privacidad
  ✔ el empleado solicita una corrección
  ✔ no puede aprobarla él mismo
  ✔ el responsable la aprueba
  ✔ la corrección genera un registro nuevo con aprobador; el original no se altera
  ✔ solicitud de vacaciones creada
  ✔ otro empleado no ve la solicitud
  ✔ al aprobarse, los días figuran en su calendario
  ✔ la persona puede exportar sus datos (Ley 25.326) sin secretos
  ✔ no se vota en encuestas inexistentes o ajenas

Extra — Cambio de turno, grupos y almacenamiento
  ✔ el empleado ve turnos compatibles para intercambiar
  ✔ gerencia no puede aprobar antes de que acepte el compañero
  ✔ el empleado no puede autoaprobar el cambio
  ✔ el responsable aprueba el cambio
  ✔ los turnos quedan intercambiados
  ✔ el intercambio queda en el historial
  ✔ un empleado crea un grupo de interés
  ✔ otro empleado se une
  ✔ publicación de grupo: no visible para no miembros
  ✔ no se puede crear un grupo a nombre de otra persona
  ✔ adjuntos de chat: solo participantes
  ✔ un tercero no puede subir archivos a una conversación ajena
  ✔ fotos: cada uno sube solo en su carpeta; otra empresa no las ve
  ✔ un gerente de sucursal no ve la asistencia de otras sucursales
  ✔ feed_post respeta la visibilidad

140 pruebas superadas, 0 fallidas
```
