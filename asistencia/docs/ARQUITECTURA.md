# Arquitectura

## Tecnología

| Capa | Elección | Motivo |
|---|---|---|
| Aplicación | Next.js 15 (App Router) + React 19 + TypeScript | Un solo proyecto con interfaz y backend; las validaciones sensibles corren en el servidor (Route Handlers y Server Actions). |
| Estilos | Tailwind CSS 4, modo claro/oscuro | Interfaz consistente y liviana. |
| Base de datos | PostgreSQL (directo con `pg`) | Transacciones, bloqueos consultivos, triggers de inmutabilidad, `timestamptz`. Funciona igual en Supabase, RDS, Neon o un servidor propio. |
| Autenticación | Propia: contraseñas con scrypt, sesiones opacas en BD | Sin dependencia de un proveedor; toda la autorización se decide en el servidor y la base no se expone al navegador. (Se puede migrar a Supabase Auth si se desea.) |
| QR | HMAC-SHA256 con secreto del servidor | Tokens cortos, verificables sin estado; anti‑reuso con tabla `qr_uses`. |
| Tareas | `npm run worker` o `/api/cron` con `CRON_SECRET` | Alertas, reporte diario, correo y retención sin depender del panel abierto. |
| Correo | Cola `email_outbox` + proveedor configurable (`log`, `resend`, `webhook`) | Reintentos y deduplicación. |
| Exportación | exceljs (Excel), CSV propio, pdfkit (PDF) | |

## Estructura

```
asistencia/
  db/migrations/        Esquema SQL versionado
  scripts/              migrate, seed, seed-demo, create-admin, worker, backup.sh
  src/lib/              Lógica de negocio (sin dependencias de UI)
    punch.ts            Fichaje móvil y de terminal (núcleo)
    geo.ts / qr.ts      Validación de perímetro y tokens QR
    sequence.ts         Reglas entrada/salida
    attendance.ts       Cálculo de estados (puro, testeable)
    board.ts            Tablero y KPIs por alcance
    corrections.ts      Correcciones auditables
    jobs.ts             Alertas, reporte diario, retención
    permissions.ts      Roles, capacidades y alcance (empresa/sucursal)
  src/app/
    mi/                 Portal del empleado
    terminal/           Pantalla QR + kiosco con PIN
    admin/              Panel de gestión
    api/                punch, location-check, terminal/*, reports/export, cron
  tests/                Unitarias e integración (PostgreSQL real)
```

## Modelo de datos (principales tablas)

- `companies`, `branches` (coordenadas, radio, precisión máxima, zona horaria, horario), `terminals`.
- `users` (roles: superadmin, company_admin, manager, supervisor, employee), `user_scopes` (empresa y opcionalmente sucursal), `sessions`.
- `employees` (legajo, sector, responsable, sucursal principal, PIN), `employee_branches` (sucursales autorizadas).
- `schedule_templates` (horario semanal), `shifts` (turnos concretos en UTC), `leaves` (francos, vacaciones, licencias).
- `punches` (**solo inserción**: trigger impide UPDATE/DELETE), `punch_voids` (anulaciones), `punch_attempts` (rechazos), `qr_uses`.
- `correction_requests`, `alerts`, `email_outbox`, `audit_log` (solo inserción), `rate_limits`, `job_runs`.

Restricciones en la propia base: una fichada `mobile` exige distancia, precisión y QR (y coordenadas al insertarse); una `terminal` exige terminal; una `correction` exige solicitud aprobada y **no puede** tener coordenadas ni QR.

## Roles

| Capacidad | Admin general | Admin empresa | Gerencia | Encargado | Empleado |
|---|:-:|:-:|:-:|:-:|:-:|
| Empresas | ✔ | | | | |
| Sucursales, terminales, empleados, usuarios, horarios | ✔ | ✔ | | | |
| Tablero, fichadas, reportes, alertas | ✔ | ✔ | ✔ | ✔ (sus sucursales) | |
| Solicitar corrección | ✔ | ✔ | ✔ | ✔ (sus sucursales) | |
| Aprobar corrección | ✔ | ✔ | ✔ | | |
| Auditoría | ✔ | ✔ | | | |
| Fichar | si tiene legajo | si tiene legajo | si tiene legajo | si tiene legajo | ✔ |

Nadie puede aprobar correcciones sobre sus propias fichadas.

## Horarios y zonas horarias

Todo se guarda en UTC (`timestamptz`) y se muestra en la zona de la sucursal (inicialmente `America/Argentina/Buenos_Aires`). Las plantillas semanales se convierten a turnos concretos en SQL (`(fecha + hora) at time zone tz`); si la hora de fin es menor o igual a la de inicio, el turno termina al día siguiente.

Estados del tablero: *Programado*, *No fichó* (pasó la tolerancia), *Ausente* (terminó el turno sin fichadas), *Presente*, *Finalizó*, *Fichada incompleta*, *Fichó sin turno*, *Con novedad* (franco/licencia/vacaciones: nunca se marca ausente). Las horas por encima de lo programado se informan como **adicionales a revisar**, sin calificarlas como horas extra.

## Escala

Consultas indexadas por empleado/sucursal/fecha y cálculo del tablero en bloque (3 consultas por rango, sin N+1). Pensado para cientos de empleados; el pool de conexiones se ajusta con `DATABASE_POOL_MAX`.
