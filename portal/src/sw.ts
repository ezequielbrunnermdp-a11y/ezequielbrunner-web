/// <reference lib="webworker" />
// Service worker: cachea SOLO la aplicación (HTML/JS/CSS/íconos).
// Nunca cachea respuestas de Supabase (API, Storage, Auth): los documentos
// privados, mensajes y fichadas no quedan almacenados en el dispositivo.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

self.addEventListener('message', (e) => { if (e.data?.type === 'SKIP_WAITING') void self.skipWaiting(); });

// Notificaciones push (requiere configurar VAPID y la función de envío; ver docs).
// El texto visible nunca incluye datos laborales sensibles.
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; link?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'Novedad en tu portal' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Novedad en tu portal', {
    body: data.body || 'Abrí la app para ver el detalle.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: { link: data.link || '/notificaciones' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data as { link?: string })?.link || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all[0] as WindowClient | undefined;
    if (c) { await c.focus(); await c.navigate(link); } else await self.clients.openWindow(link);
  })());
});
