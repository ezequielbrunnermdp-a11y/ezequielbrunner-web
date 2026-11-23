# Privacidad, Ley 25.326 y validaciones legales

> Este documento describe cómo está diseñado el sistema. **No es asesoramiento legal.** Las funciones marcadas con ⚖️
> requieren validación de un profesional (derecho laboral y protección de datos) antes de su uso formal.

## Principios aplicados (Ley 25.326 y normativa complementaria)

| Principio | Implementación |
|---|---|
| Finalidad específica | Datos laborales: gestión de personal, horarios, asistencia y comunicaciones institucionales. Datos sociales: comunidad voluntaria. |
| Minimización | El perfil social es opcional (cumpleaños solo día/mes y por elección; fecha de ingreso visible solo si se autoriza). La geolocalización se toma **solo al fichar**: no hay seguimiento continuo ni fuera de jornada. |
| Separación | `profiles` (social), `employments` (laboral) y `employee_private` (sensible) son tablas distintas con políticas distintas. Mensajes privados separados del canal institucional. |
| Acceso restringido | RLS en todas las tablas; datos sensibles solo para el titular y roles con permiso específico (`employees.view_private`, `payroll.view`). MFA para roles administrativos. |
| Confidencialidad de comunicaciones | Sin acceso de gerencia ni superadministración a mensajes privados. No se afirma cifrado de extremo a extremo (no existe). |
| Derechos del titular | Acceso: *Configuración → Descargar una copia de mis datos* (JSON). Rectificación: solicitud "Actualización de datos". Supresión: ver pendientes (requiere procedimiento definido por el responsable). |
| Seguridad | TLS, cifrado en reposo del proveedor, contraseñas con hash (Supabase Auth), PIN con bcrypt, tokens QR y secretos de dispositivo solo como hash, auditoría inmutable, mínimos privilegios. |
| Participación voluntaria | La red social no es obligatoria; se puede desactivar sin afectar lo laboral. Las notificaciones no generan obligación de responder fuera de jornada. |

## Pendientes del responsable del tratamiento ⚖️

- Redactar y publicar la **política de privacidad** y el aviso informativo (art. 6) con: responsable, finalidades,
  destinatarios (incluido el proveedor de infraestructura y su ubicación —transferencia internacional—), plazo de
  conservación y forma de ejercer derechos. El texto actual de *Configuración* es un borrador informativo.
- **Inscripción de la base de datos** ante la Agencia de Acceso a la Información Pública (AAIP), si corresponde.
- Definir **plazos de conservación** (asistencia, documentos, mensajes, auditoría) y programar su depuración.
- Acuerdo de tratamiento de datos con el proveedor (Supabase) y evaluación de transferencia internacional.
- Procedimiento de **respuesta a incidentes** (detección, contención, evaluación, notificación a titulares/AAIP según
  corresponda, registro). Contactos responsables y plazos internos.
- Procedimiento para supresión/bloqueo de cuentas al finalizar la relación laboral, conservando lo exigido por ley.

## Control horario y documentación laboral ⚖️

- Los registros digitales de asistencia **no sustituyen automáticamente** los requisitos legales de control horario
  (LCT, Ley 11.544, convenio colectivo aplicable —p. ej. CCT 389/04 para gastronomía— y normas provinciales).
  Validar si el registro sirve como libro/planilla de horarios o como complemento.
- Las **reglas operativas** (horas máximas, descanso mínimo, tolerancias) son parámetros: no garantizan cumplimiento.
- Las **alertas** (llegada tarde, salida anticipada, sin fichada) son automáticas y requieren revisión humana; no son
  sanciones ni presumen ausencia injustificada.
- **Geolocalización y QR**: informar al personal el método de control y su finalidad; reducen el riesgo de fraude pero
  no lo eliminan (un QR puede compartirse y una ubicación puede falsificarse).
- **Documentos**: publicar un recibo o una comunicación en el portal **no** equivale a notificación fehaciente ni a
  firma con validez jurídica. El sistema distingue "publicado", "visualizado", "descargado" y "lectura confirmada";
  la firma digital/electrónica apta (Ley 25.506) y la notificación formal **no están implementadas**.
- **Recibos de haberes digitales**: verificar requisitos vigentes (autorizaciones, firma, conservación) antes de
  reemplazar el soporte actual.
- **Encuestas**: los votos no son técnicamente anónimos (se registra quién votó para evitar duplicados), aunque ningún
  rol de la aplicación ve votos individuales. Se informa en pantalla.
- **Sugerencias**: son identificadas; no se ofrece anonimato porque no podría garantizarse.
- **Moderación**: las denuncias y acciones de moderación quedan auditadas; definir política de uso aceptable.
