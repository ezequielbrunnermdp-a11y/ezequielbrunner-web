# Seguridad, antifraude y privacidad

## Contra fichadas remotas (prioridad absoluta)

Toda fichada móvil requiere, verificado **en el servidor**:

1. Sesión válida de un usuario con legajo activo, en empresa activa.
2. QR firmado (HMAC-SHA256), vigente (~45 s), emitido por una terminal activa de esa sucursal, no usado antes por ese empleado.
3. Empleado autorizado en esa sucursal y misma empresa.
4. Lectura GPS con precisión ≤ máxima configurada y punto dentro del radio. Se distingue *fuera de zona* de *ubicación poco confiable* y de *sin permiso/sin GPS*.
5. Secuencia coherente (no doble entrada, no salida sin entrada, no doble toque < 60 s), bajo bloqueo transaccional por empleado.
6. Hora tomada de la base de datos (nunca del dispositivo). Clave de idempotencia para reintentos.

Las fichadas de terminal acreditan presencia por el dispositivo vinculado al local (token propio, cookie `httpOnly`) y la identidad con legajo + PIN.

Las correcciones nunca crean una “fichada geolocalizada”: quedan con origen *Corrección administrativa*, sin coordenadas ni QR (lo impone la base), con motivo, solicitante y aprobador.

### Límites honestos

GPS y QR **no son infalibles**: existen apps que simulan ubicación y alguien dentro del local podría enviar una foto del QR a un compañero que también simule su ubicación. Mitigaciones incluidas:
- QR que vence en segundos y no se reutiliza; foto vieja = inválida.
- Alertas por intentos fuera del perímetro, reiterados, firma inválida, QR reutilizado y PIN incorrecto.
- Marcas de lectura sospechosa en la fichada (precisión irreal, coordenadas redondeadas, lectura idéntica repetida, desplazamiento imposible) que generan alerta.
- Límite de intentos por empleado, IP y terminal; bloqueo de cuenta tras 5 contraseñas erróneas.

Recomendaciones operativas: colocar la terminal en un lugar visible por el encargado, revisar alertas, y considerar a futuro WebAuthn/biometría del dispositivo o una cámara en la terminal si se detectan abusos.

## Controles generales

- Contraseñas con scrypt (sal individual); contraseñas temporales con cambio obligatorio al primer ingreso.
- Sesiones opacas (sólo el hash se guarda), cookies `httpOnly`, `Secure`, `SameSite`; revocación al desactivar usuarios o restablecer contraseñas.
- CSRF: verificación de `Origin` en las API y protección nativa de Server Actions.
- Autorización centralizada (`permissions.ts`): capacidades por rol + alcance por empresa/sucursal, aplicado en cada consulta (`scopeSql`) y cada acción.
- Auditoría de solo inserción para acciones administrativas, logins, exportaciones y correcciones.
- Encabezados: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy` (cámara y ubicación sólo para el propio sitio).
- Exportación CSV protegida contra inyección de fórmulas.
- Secretos sólo en variables de entorno (`QR_SIGNING_SECRET`, `CRON_SECRET`, credenciales de BD y correo).
- La base no se expone al navegador: sólo el servidor se conecta. En Supabase, no publicar la `anon key` para estas tablas (o activar RLS sin políticas).

## Privacidad (Ley 25.326) — privacidad desde el diseño

- **Sin seguimiento**: la ubicación se pide sólo al tocar fichar o “Verificar mi ubicación” (esta última no se guarda).
- **Minimización**: se guarda la lectura del momento de la fichada. Al vencer la retención configurada (365 días por defecto) se borran latitud/longitud y se conserva sólo la distancia y la precisión validadas. Los intentos rechazados conservan coordenadas como máximo 90 días.
- **Información al trabajador**: textos visibles en el login y en el portal.
- **Alternativa sin celular personal**: terminal del local con legajo + PIN; no se obliga a usar el teléfono propio.
- Derechos de acceso y rectificación: el empleado ve su historial completo; las rectificaciones se canalizan por correcciones auditadas.

Se recomienda que la empresa informe por escrito la política de control de asistencia y registre la base ante la autoridad de aplicación si corresponde, con asesoramiento legal/laboral.

## Copias de seguridad

`scripts/backup.sh` genera un `pg_dump` diario (programarlo con cron y copiarlo a otro almacenamiento). En Supabase se suman los backups automáticos del plan.
