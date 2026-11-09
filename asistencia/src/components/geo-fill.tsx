"use client";
import { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";

/** Completa latitud/longitud con la ubicación actual del dispositivo (estando dentro del local). */
export function GeoFill() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className="surface inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-[var(--surface-2)]"
        onClick={() => {
          setBusy(true); setMsg(null);
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const f = (n: string) => document.querySelector<HTMLInputElement>(`input[name="${n}"]`)!;
              f("latitude").value = p.coords.latitude.toFixed(6);
              f("longitude").value = p.coords.longitude.toFixed(6);
              setMsg(`Ubicación cargada (precisión ±${Math.round(p.coords.accuracy)} m). Revisá en el mapa antes de guardar.`);
              setBusy(false);
            },
            (e) => { setMsg(e.code === 1 ? "Permiso de ubicación denegado." : "No se pudo obtener la ubicación."); setBusy(false); },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
          );
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />} Usar mi ubicación actual
      </button>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
