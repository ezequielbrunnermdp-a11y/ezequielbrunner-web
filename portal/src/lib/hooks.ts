import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '@/components/Toast';
import { errorMessage } from './errors';

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Mutación con invalidación y mensajes de éxito/error estándar. */
export function useAction<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, opts: { success?: string | ((r: TRes) => string); invalidate?: QueryKey[]; onDone?: (r: TRes) => void } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (opts.success) toast(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onDone?.(r);
    },
    onError: (e) => toast(errorMessage(e), 'bad'),
  });
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
