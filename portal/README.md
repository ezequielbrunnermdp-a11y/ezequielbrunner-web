# Equipo · Plataforma corporativa de empleados

Red social privada + mensajería + portal integral de empleados para empresas gastronómicas
(inicialmente **El Cóndor Coffee Shop** y **Puerto de Palos**), diseñada para evolucionar como SaaS multiempresa.

> Este directorio es una aplicación independiente del sitio `ezequielbrunner.com` que vive en la raíz del
> repositorio. Se publica como **otro sitio de Netlify** con *Base directory* = `portal`. Los cambios en
> `portal/` no republican el sitio principal.

## Estado

| Área | Estado |
|---|---|
| Base de datos (11 migraciones SQL versionadas, 64 tablas), RLS en todas las tablas, funciones de servidor | ✅ Implementado y probado (140 pruebas SQL) |
| Autenticación por invitación, recuperación, MFA TOTP para roles administrativos | ✅ Implementado (flujo con Supabase Auth; requiere proyecto real para probar el correo) |
| Portal del empleado, comunidad, amistades, mensajería en tiempo real | ✅ Implementado |
| Horarios, francos, cambios de turno, solicitudes, reuniones, "Hablar con gerencia" | ✅ Implementado |
| Fichaje GPS + QR dinámico, modo tablet (PIN), contingencias, correcciones, panel de asistencia | ✅ Implementado y probado (servidor + interfaz) |
| Gerencia: personal, sucursales, dispositivos, planificador, reportes Excel/PDF, roles, auditoría | ✅ Implementado |
| Documentos privados, capacitaciones, beneficios, eventos, encuestas, reconocimientos, sugerencias | ✅ Implementado (versión inicial) |
| Notificaciones push web | ⚠️ Suscripción del dispositivo lista; **falta** el envío (claves VAPID + función). Ver `docs/NOTIFICACIONES.md` |
| Despliegue en Supabase y Netlify | ⏳ Preparado; **faltan** el proyecto de Supabase y el sitio de Netlify. Ver `docs/INSTALACION.md` |

Detalle completo: [`docs/PENDIENTES.md`](docs/PENDIENTES.md) · Resultados de pruebas: [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

## Stack

- **Frontend**: React 18 + TypeScript estricto + Vite 7 + Tailwind CSS 3, TanStack Query, React Router. PWA instalable (service worker propio con Workbox: cachea solo la aplicación, nunca datos ni documentos).
- **Backend**: Supabase (PostgreSQL 15+, Auth, Storage privado, Realtime). La lógica sensible vive en **funciones SQL `security definer`** transaccionales y en una **Edge Function** (`invite-employee`) que usa la clave de servicio solo en el servidor.
- **Hosting**: Netlify (SPA, cabeceras de seguridad y CSP en `netlify.toml`).

## Estructura

```
portal/
├── supabase/
│   ├── migrations/        # SQL versionado: esquema, RLS, funciones, datos de referencia
│   ├── seed.sql           # Marcas y sucursales iniciales (editables, "a verificar")
│   ├── functions/         # Edge Functions (invite-employee)
│   ├── tests/             # Emulación mínima de Supabase para pruebas locales
│   └── config.toml        # Configuración de Supabase CLI (registro público deshabilitado)
├── scripts/
│   ├── test-db.mjs        # 140 pruebas de RLS/permisos/fichaje contra PostgreSQL real
│   └── generate-icons.mjs
├── src/
│   ├── auth/              # Sesión, contexto de permisos, MFA
│   ├── components/        # Sistema de diseño (ui/), marca, avisos
│   ├── layout/            # Barra inferior (móvil) / lateral (escritorio)
│   ├── features/          # Pantallas por módulo (empleado, gerencia, kiosco)
│   ├── lib/               # Supabase, fechas/zonas horarias, geo, QR, exportaciones, cola offline
│   └── sw.ts              # Service worker
└── docs/                  # Arquitectura, instalación, manual, pruebas, privacidad, pendientes
```

## Comandos

```bash
npm install
cp .env.example .env.local      # completar URL y anon key de Supabase
npm run dev                     # http://localhost:5173
npm run typecheck               # TypeScript estricto
npm test                        # Vitest: lógica y pantalla de fichaje
npm run test:db                 # Pruebas SQL (requiere PostgreSQL local; ver docs/PRUEBAS.md)
npm run build                   # Build de producción + service worker
```

## Documentación

- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- [Instalación: Supabase, Netlify y primer administrador](docs/INSTALACION.md)
- [Manual de uso (empleados, gerencia, tablet)](docs/MANUAL.md)
- [Pruebas y resultados](docs/PRUEBAS.md)
- [Privacidad y validaciones legales (Ley 25.326, LCT)](docs/PRIVACIDAD-Y-LEGAL.md)
- [Notificaciones push](docs/NOTIFICACIONES.md)
- [Pendientes y verificaciones antes de producción](docs/PENDIENTES.md)
