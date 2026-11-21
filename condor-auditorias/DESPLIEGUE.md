# EL CÓNDOR | CONTROL DE FRANQUICIAS — Despliegue

Sistema Integral de Auditorías y Calidad Operativa. React + TypeScript + Vite + Tailwind, Supabase (PostgreSQL, Auth, Storage) y Netlify.

## 1. Arquitectura

```
Navegador (celular / tablet / PC)
  ├─ React SPA (Netlify CDN)        → interfaz, cálculo provisional, PDF (@react-pdf/renderer), cola sin conexión (IndexedDB)
  ├─ Supabase Auth                  → ingreso, recuperación de contraseña, sesiones
  ├─ Supabase PostgREST + RLS       → datos; permisos por perfil y sucursal en la base
  ├─ Supabase Storage (privado)     → fotografías, evidencias y manuales (URLs firmadas temporales)
  └─ Netlify Function /api/admin-users → alta y gestión de usuarios con la clave de servicio (solo servidor)
```

- **Fuente de verdad del puntaje**: `public.compute_audit_score` en PostgreSQL. `finalize_audit` valida, calcula, numera el informe y genera alertas. El navegador replica el cálculo (`src/lib/scoring.ts`) solo para mostrar el puntaje provisional; hay una prueba que verifica que ambos den lo mismo.
- **Versionado**: cada auditoría guarda la versión del cuestionario. Las versiones publicadas son inmutables (trigger). Los PDF se regeneran siempre con la versión y las ponderaciones originales.
- **Inmutabilidad**: una auditoría finalizada no puede modificarse (trigger, incluso con la clave de servicio). La única vía es `begin_audit_correction` (solo administración, motivo obligatorio), que guarda la versión anterior completa en `audit_revisions`.
- **Sin conexión**: cada cambio se guarda primero en IndexedDB y se sincroniza al servidor; el indicador solo muestra "Guardado en el servidor" cuando Supabase confirmó la escritura.

### Tablas principales
`profiles` (usuarios y roles), `branches`, `user_branches`, `questionnaire_versions`, `categories`, `questions`, `audits`, `audit_answers`, `audit_category_states`, `audit_revisions`, `nonconformities`, `nonconformity_events` (historial), `attachments`, `alerts`, `notifications`, `generated_reports`, `brand_settings`, `commercial_indicators`, `manual_documents`, `activity_log`.

## 2. Supabase

1. Cree un proyecto en <https://supabase.com> (región sugerida: São Paulo).
2. Aplique las migraciones (en orden):
   - Opción A, con la CLI (incluida en el proyecto):
     ```bash
     cd condor-auditorias
     npx supabase login
     npx supabase link --project-ref <REF-DEL-PROYECTO>
     npx supabase db push
     ```
   - Opción B: copie y ejecute en **SQL Editor** el contenido de
     `supabase/migrations/20261121000001_esquema.sql` y luego `20261121000002_datos_iniciales.sql`.
   Esto crea tablas, funciones, políticas RLS, los buckets `evidencias` (privado), `manual` (privado) y `marca` (público, solo logotipo), las 9 sucursales y el cuestionario v1 (15 categorías, 196 preguntas, ponderaciones = 100).
3. **Authentication → Providers → Email**: desactive *Allow new users to sign up* (las altas las hace la administración). Longitud mínima de contraseña sugerida: 10.
4. **Authentication → URL Configuration**:
   - Site URL: `https://<su-sitio>.netlify.app` (o el dominio definitivo)
   - Redirect URLs: `https://<su-sitio>.netlify.app/restablecer`
5. (Recomendado) Configure un SMTP propio en **Authentication → SMTP** para que los correos de invitación y recuperación no tengan el límite del servidor de prueba de Supabase.
6. Copie de **Project Settings → API**: `Project URL`, `anon public key` y `service_role key`.

## 3. Administrador inicial

Desde una computadora de confianza (la clave de servicio nunca va al navegador ni al repositorio):

```bash
cd condor-auditorias
npm install
SUPABASE_URL=https://<REF>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> \
  node scripts/crear-usuario.mjs --email gerencia@empresa.com --nombre "Nombre Apellido"
```

El script imprime una contraseña inicial aleatoria (o use `--password`). Después, el administrador crea auditores y franquiciados desde **Administración → Usuarios**.

## 4. Netlify

1. **Add new project → Import from Git** y elija este repositorio.
2. **Base directory**: `condor-auditorias` (el resto lo toma de `condor-auditorias/netlify.toml`: build `npm run build`, publish `dist`, funciones `netlify/functions`, redirección SPA).
3. **Environment variables** (Site configuration → Environment variables):

| Variable | Valor | Alcance |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto | Builds |
| `VITE_SUPABASE_ANON_KEY` | anon public key | Builds |
| `SUPABASE_URL` | URL del proyecto | Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secreta**) | Functions |

4. Deploy. Las variables `VITE_*` se incorporan en la compilación: si las cambia, vuelva a publicar.

Publicar nuevas versiones **no borra datos**: todo está en Supabase; Netlify solo sirve archivos estáticos y la función.

## 5. Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Supabase local completo (Docker): `npx supabase start` aplica las migraciones automáticamente.

## 6. Pruebas

| Comando | Qué verifica |
|---|---|
| `npm test` | Cálculo de ponderaciones, N/A, observaciones obligatorias, redistribución, clasificación, controles críticos, paridad con el servidor, informe consolidado y generación real de PDF A4 multipágina |
| `bash tests/db/run.sh` | Sobre PostgreSQL: migraciones, RLS entre franquicias, permisos por perfil, inmutabilidad de finalizadas, corrección autorizada con versión anterior, cuestionario versionado, alertas críticas, reiteración, vencidas, historial de incumplimientos |
| `npm run build` | Compilación TypeScript estricta y build de producción |

## 7. Integraciones futuras

No hay integraciones automáticas activas. `commercial_indicators.source` admite `integracion` y la carga actual es manual o por CSV/XLSX (plantilla descargable en *Indicadores comerciales*). Una integración con el sistema comercial o el Club El Cóndor puede implementarse como una Netlify Function programada que escriba en esa tabla con la clave de servicio, cuando existan API, permisos y credenciales.

## 8. Notas legales y de alcance

- La constancia de recepción es una **firma electrónica simple** (usuario, nombre y fecha registrados); no es una firma digital certificada.
- Los controles contractuales deben corresponder a obligaciones efectivamente pactadas; si no lo están, se marcan "No aplica" con justificación.
- La falta de documentación aportada al auditor se registra como "Pendiente de verificar", distinto de "No cumple".
- No se incluye un logotipo inventado: hasta cargar el oficial en *Identidad visual* se muestra el nombre en tipografía institucional.
