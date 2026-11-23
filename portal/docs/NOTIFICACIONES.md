# Notificaciones

## Implementado

- **Centro de notificaciones persistente** (tabla `notifications`) generado por el servidor para: solicitudes de
  amistad, mensajes (sin el contenido), comentarios, menciones, comunicados, cambios de horario, reuniones,
  solicitudes, documentos, capacitaciones, reconocimientos y consultas a gerencia.
- Actualización en **tiempo real** del indicador (Supabase Realtime) y preferencias individuales por tipo.
- Textos visibles **sin datos laborales sensibles** (p. ej. "Tenés un documento nuevo disponible").
- En el dispositivo: el service worker ya maneja eventos `push` y `notificationclick`, y la app registra la suscripción
  del navegador en `push_subscriptions` cuando existe `VITE_VAPID_PUBLIC_KEY`.

## Pendiente para activar push web

No se simula: hasta completar estos pasos, la app indica que el envío push no está configurado.

1. Generar claves VAPID: `npx web-push generate-vapid-keys`.
2. Netlify: `VITE_VAPID_PUBLIC_KEY=<pública>`. Supabase secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:soporte@<dominio>`.
3. Crear una Edge Function `send-push` que, ante cada inserción en `notifications` (Database Webhook), envíe a las
   suscripciones del usuario (librería `web-push` en Deno vía `npm:web-push`) y elimine las suscripciones vencidas (HTTP 404/410).
4. Respetar `notification_prefs` y horario (p. ej. no enviar push de comunidad fuera de jornada).

## Diferencias entre plataformas

- **Android / Chrome / Edge / Firefox**: push web disponible con permiso del usuario.
- **iPhone / iPad (iOS 16.4+)**: solo si la app está **instalada en la pantalla de inicio**; la app lo explica en Configuración.
- Sin permiso o sin soporte, las novedades siguen disponibles en el centro de notificaciones.
