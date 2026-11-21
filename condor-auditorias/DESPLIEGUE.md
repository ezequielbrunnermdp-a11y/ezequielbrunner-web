# EL CÓNDOR | CONTROL DE FRANQUICIAS — Despliegue

Sistema Integral de Auditorías y Calidad Operativa. React + TypeScript + Vite + Tailwind, Netlify Functions, Netlify Database (PostgreSQL) y Netlify Blobs.

## 1. Arquitectura

Todo corre en **Netlify** (sin servicios externos):

```
Navegador (celular / tablet / PC)
  ├─ React SPA (CDN de Netlify)     → interfaz, cálculo provisional, PDF (@react-pdf/renderer), cola sin conexión (IndexedDB)
  ├─ Función api  (/rest/v1, /auth/v1, /storage/v1)
  │     → datos con Row Level Security, sesiones (JWT propios) y archivos; compatible con el cliente supabase-js
  ├─ Función admin-users (/api/admin-users) → alta, edición y restablecimiento de contraseñas (solo administradores)
  ├─ Netlify Database (PostgreSQL)  → datos; migraciones en netlify/database/migrations, aplicadas en cada despliegue
  └─ Netlify Blobs                  → fotografías, evidencias, manuales y logotipo
```

- **Permisos en la base**: cada solicitud se ejecuta con el rol `app_anon` o `app_authenticated` y el usuario en `request.jwt.claim.sub`; las políticas RLS deciden qué ve y modifica cada perfil y sucursal.
- **Fuente de verdad del puntaje**: `public.compute_audit_score` / `finalize_audit` en PostgreSQL. El navegador replica el cálculo solo para el puntaje provisional (hay una prueba de paridad).
- **Versionado e inmutabilidad**: cada auditoría conserva su versión de cuestionario; una auditoría finalizada solo cambia mediante `begin_audit_correction` (administración, motivo obligatorio, versión anterior guardada).
- **Clave de sesiones**: se genera aleatoriamente dentro de la base al instalar (`auth.secrets`, no legible por los roles de la aplicación). Opcionalmente puede definirse `AUTH_JWT_SECRET` en Netlify.
- **Sin conexión**: los cambios se guardan primero en el dispositivo y se sincronizan; "Guardado en el servidor" solo aparece cuando la base confirmó.

## 2. Sitio publicado

- URL: **https://condor-control-franquicias.netlify.app** (proyecto Netlify `condor-control-franquicias`).
- Para volver a publicar: desde `condor-auditorias/`, con la CLI de Netlify (`netlify deploy --prod`) o conectando el repositorio en Netlify con **Base directory** `condor-auditorias`.
- Publicar una nueva versión **no borra datos**: las migraciones nuevas se aplican sobre la base existente y Netlify toma una instantánea antes de publicar.
- No hace falta configurar variables de entorno.

## 3. Administrador inicial y usuarios

- La migración `20261121000003_claves_y_administrador.sql` crea el usuario **admin@condor.local** si no existe ningún administrador. La contraseña inicial se entrega por un canal privado: **cámbiela en el primer ingreso** (menú → «Cambiar contraseña»).
- El resto de los usuarios se crean en **Administración → Usuarios** con una contraseña inicial.
- No hay envío de correos: si alguien olvida su contraseña, un administrador la restablece desde **Usuarios** (ícono de llave) y el usuario la cambia luego.

## 4. Límites

- Archivos de hasta 4 MB (las fotos se comprimen en el dispositivo antes de subir).
- Netlify Database se cobra en créditos según uso; el plan del equipo debe ser de créditos.

## 5. Desarrollo local

```bash
npm install
# PostgreSQL local: aplicar netlify/database/migrations/*.sql en una base vacía (como usuario propietario no superusuario)
DATABASE_URL=postgres://usuario:clave@127.0.0.1:5432/condor npx vite-node scripts/servidor-local.ts   # API en :8787
echo "VITE_SUPABASE_URL=http://localhost:8787" > .env.local
npm run dev
```

`scripts/crear-usuario.mjs` crea usuarios directamente en una base (`DATABASE_URL`).

## 6. Pruebas

| Comando | Qué verifica |
|---|---|
| `npm test` | Cálculo de ponderaciones, N/A, observaciones obligatorias, redistribución, clasificación, controles críticos, paridad con el servidor, informe consolidado y generación real de PDF A4 multipágina |
| `bash tests/db/run.sh` | Sobre PostgreSQL (mismas migraciones que producción): migraciones, RLS entre franquicias, permisos por perfil, inmutabilidad de finalizadas, corrección autorizada con versión anterior, cuestionario versionado, alertas críticas, reiteración, vencidas, historial de incumplimientos |
| `npm run build` | Compilación TypeScript estricta y build de producción |

## 7. Integraciones futuras

No hay integraciones automáticas activas. `commercial_indicators.source` admite `integracion` y la carga actual es manual o por CSV/XLSX (plantilla descargable en *Indicadores comerciales*). Una integración con el sistema comercial o el Club El Cóndor puede implementarse como una Netlify Function programada que escriba en esa tabla con la clave de servicio, cuando existan API, permisos y credenciales.

## 8. Notas legales y de alcance

- La constancia de recepción es una **firma electrónica simple** (usuario, nombre y fecha registrados); no es una firma digital certificada.
- Los controles contractuales deben corresponder a obligaciones efectivamente pactadas; si no lo están, se marcan "No aplica" con justificación.
- La falta de documentación aportada al auditor se registra como "Pendiente de verificar", distinto de "No cumple".
- No se incluye un logotipo inventado: hasta cargar el oficial en *Identidad visual* se muestra el nombre en tipografía institucional.
