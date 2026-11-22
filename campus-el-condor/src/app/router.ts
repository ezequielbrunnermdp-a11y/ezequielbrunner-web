import { useSyncExternalStore } from 'react';

/* Navegación por hash (#/ruta?clave=valor): funciona en cualquier alojamiento estático,
   incluso al abrir una sección directamente o recargar, sin reglas del proveedor. */

export interface Route {
  path: string[];
  query: URLSearchParams;
  raw: string;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q), raw };
}

let current = parse(typeof location !== 'undefined' ? location.hash : '');
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parse(location.hash);
    subs.forEach((s) => s());
  });
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => current,
    () => current,
  );
}

export function navigate(href: string, opts: { replace?: boolean } = {}) {
  const target = href.startsWith('#') ? href : `#${href}`;
  if (opts.replace) {
    history.replaceState(null, '', target);
    current = parse(target);
    subs.forEach((s) => s());
  } else {
    location.hash = target;
  }
}

/** Cambia parámetros de la ruta actual sin crear una entrada nueva de historial. */
export function setQuery(patch: Record<string, string | null>) {
  const r = current;
  const q = new URLSearchParams(r.query);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') q.delete(k);
    else q.set(k, v);
  }
  const qs = q.toString();
  navigate(`#/${r.path.map(encodeURIComponent).join('/')}${qs ? `?${qs}` : ''}`, { replace: true });
}

export function isActive(routePath: string[], section: string) {
  return (routePath[0] ?? '') === section;
}
