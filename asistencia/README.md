# Asistencia — Control de asistencia con geolocalización y QR dinámico

Aplicación web progresiva (PWA) para que el personal registre entrada y salida **sólo estando dentro del establecimiento**, y para que la gerencia supervise asistencia, puntualidad y novedades de varias empresas y sucursales.

- **Portal del empleado** (`/mi`): reloj, estado, botones grandes de entrada/salida, horarios, historial y horas.
- **Terminal del local** (`/terminal`): muestra el QR dinámico firmado y permite fichar con legajo + PIN a quien no tiene celular.
- **Panel de gestión** (`/admin`): tablero, fichadas, alertas, correcciones, horarios y novedades, reportes (Excel/CSV/PDF), empleados, sucursales, empresas, terminales, usuarios y auditoría.

## Cómo se valida una fichada desde el celular

1. El empleado inicia sesión (usuario y contraseña).
2. Toca *Registrar entrada/salida*: el navegador pide la ubicación (sólo en ese momento).
3. Escanea con la cámara el QR que muestra la pantalla del local (cambia cada ~45 s, firmado con HMAC).
4. Confirma. El **servidor** verifica: firma y vigencia del QR, que no se haya usado antes, que la terminal y la sucursal estén activas, que el empleado esté autorizado en esa sucursal, que la precisión GPS sea suficiente y que el punto esté dentro del radio. Luego aplica la secuencia entrada→salida dentro de una transacción con bloqueo por empleado y registra la hora con **el reloj de la base de datos**.
5. La pantalla confirma sólo con la respuesta exitosa del servidor: *“Entrada registrada correctamente — 08:57 hs.”*

Sin conexión no se puede fichar ni se guardan fichadas para enviar después. Si el GPS falla, el camino es la terminal del local (presencial y auditada) o una corrección administrativa con motivo y aprobación.

## Requisitos

- Node.js 20+ y PostgreSQL 14+ (probado con 16; compatible con Supabase).

## Puesta en marcha local

```bash
cd asistencia
npm install
cp .env.example .env.local            # completar DATABASE_URL, QR_SIGNING_SECRET y CRON_SECRET
npm run db:migrate                    # crea el esquema
npm run db:seed                       # empresas y sucursales iniciales (sin coordenadas)
npm run admin:create -- tu@correo.com "Tu Nombre" 'ContraseñaSegura123'
npm run dev                           # http://localhost:3000
npm run worker                        # en otra terminal: alertas, reportes y correo cada minuto
```

Datos de demostración (sólo en una base de pruebas): `ALLOW_DEMO_SEED=true npm run db:seed-demo`. Crea la empresa “DEMO — Datos de prueba”, usuarios `@demo.local` y una terminal; no son registros laborales reales.

## Primeros pasos en el panel

1. **Sucursales**: cargar dirección y coordenadas reales de cada local (botón “Usar mi ubicación actual” estando en el local), radio (50–150 m recomendado) y precisión máxima. Sin coordenadas, nadie puede fichar con celular ahí.
2. **Terminales**: crear una por local, abrir `/terminal` en una tablet/PC del local e ingresar el código de vinculación.
3. **Usuarios y permisos**: crear gerencia y encargados (cada encargado con sus sucursales).
4. **Empleados**: alta con legajo, sucursales autorizadas, correo (genera contraseña temporal) y PIN opcional para la terminal.
5. **Horarios y novedades**: horario semanal (soporta turnos nocturnos), turnos puntuales, francos, vacaciones y licencias.
6. **Empresas**: tolerancias, umbral de horas adicionales, hora y destinatarios del reporte diario, retención de coordenadas.

## Pruebas

```bash
createdb asistencia_test   # base exclusiva para pruebas (se borra y recrea)
TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/asistencia_test npm test
```

59 pruebas unitarias y de integración contra PostgreSQL real, entre ellas: fichada fuera del perímetro, precisión insuficiente, sin ubicación, parámetros manipulados, QR ausente/vencido/falsificado/reutilizado/de otra sucursal/de otra empresa/de terminal desactivada, sucursal sin configurar, solicitudes duplicadas y simultáneas, secuencia entrada/salida, turnos nocturnos, inmutabilidad de fichadas y auditoría, aislamiento entre empresas, alcance de encargados, flujo de correcciones, alertas, bloqueo de cuenta y purga por retención.

Más documentación: [Arquitectura](docs/ARQUITECTURA.md) · [Seguridad y privacidad](docs/SEGURIDAD.md) · [Despliegue](docs/DESPLIEGUE.md).
