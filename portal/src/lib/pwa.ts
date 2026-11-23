import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Actualización discreta: se aplica en la próxima apertura o al aceptar.
      if (confirm('Hay una nueva versión disponible. ¿Actualizar ahora?')) void update(true);
    },
  });
}

/** Suscripción a notificaciones push del navegador (solo con autorización explícita). */
export async function subscribePush(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado');
  const key = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (vapidPublicKey.length % 4)) % 4)), (c) => c.charCodeAt(0));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}

export const pushSupport = () => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, reason: ios && !standalone ? 'En iPhone/iPad, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio).' : 'Este navegador no admite notificaciones push.' };
  }
  return { supported: true, reason: '' };
};
