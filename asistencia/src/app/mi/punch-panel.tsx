"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { LogIn, LogOut, MapPin, Loader2, CheckCircle2, AlertTriangle, ScanLine, ShieldCheck, WifiOff, LocateFixed } from "lucide-react";
import { QrScanner } from "@/components/qr-scanner";

type Reading = { latitude: number; longitude: number; accuracy: number };
type Step =
  | { s: "idle" }
  | { s: "locating"; type: "in" | "out" }
  | { s: "scanning"; type: "in" | "out"; reading: Reading }
  | { s: "confirm"; type: "in" | "out"; reading: Reading; qr: string }
  | { s: "sending"; type: "in" | "out" }
  | { s: "done"; type: "in" | "out"; time: string; branch: string }
  | { s: "error"; message: string; kind: "geo" | "outside" | "net" | "other" };

/** Toma la mejor lectura GPS en hasta 10 s (la primera suele ser imprecisa). */
function getBestPosition(): Promise<Reading> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject({ code: 0 });
    let best: GeolocationPosition | null = null;
    const finish = () => {
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      if (best) resolve({ latitude: best.coords.latitude, longitude: best.coords.longitude, accuracy: best.coords.accuracy });
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
        if (p.coords.accuracy <= 20) finish();
      },
      (err) => { if (!best) { navigator.geolocation.clearWatch(id); clearTimeout(timer); reject(err); } },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    const timer = setTimeout(() => (best ? finish() : (navigator.geolocation.clearWatch(id), reject({ code: 3 }))), 10000);
  });
}

function geoErrorMessage(e: { code?: number }): string {
  if (e?.code === 1) return "Bloqueaste el acceso a la ubicación. Para fichar desde el celular, habilitá la ubicación para este sitio en los ajustes del navegador y volvé a intentar.";
  if (e?.code === 2) return "Tu dispositivo no pudo determinar la ubicación (GPS desactivado o sin señal). Activá la ubicación o usá la terminal del local.";
  if (e?.code === 3) return "No se pudo obtener tu ubicación a tiempo. Acercate a una ventana e intentá de nuevo, o usá la terminal del local.";
  return "Este dispositivo no permite obtener la ubicación. Usá la terminal del local.";
}

const newKey = () => (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);

export function PunchPanel({ open, tz, initialQr }: { open: boolean; tz: string; initialQr?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ s: "idle" });
  const [now, setNow] = useState<Date | null>(null);
  const [key, setKey] = useState(newKey);
  const [pendingQr, setPendingQr] = useState<string | undefined>(initialQr);
  const [check, setCheck] = useState<null | "checking" | "inside" | "outside" | "low_accuracy" | "not_configured" | "error">(null);
  const [checkBranch, setCheckBranch] = useState("");

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const start = async (type: "in" | "out") => {
    setKey(newKey());
    setStep({ s: "locating", type });
    try {
      const reading = await getBestPosition();
      if (pendingQr) {
        setStep({ s: "confirm", type, reading, qr: pendingQr });
        setPendingQr(undefined);
      } else setStep({ s: "scanning", type, reading });
    } catch (e: any) {
      setStep({ s: "error", kind: "geo", message: geoErrorMessage(e) });
    }
  };

  const onScan = useCallback((qr: string) => {
    setStep((st) => (st.s === "scanning" ? { s: "confirm", type: st.type, reading: st.reading, qr } : st));
  }, []);

  const send = async (st: Extract<Step, { s: "confirm" }>) => {
    setStep({ s: "sending", type: st.type });
    try {
      const r = await fetch("/api/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: st.type, ...st.reading, qr: st.qr, idempotencyKey: key }),
      });
      const data = await r.json().catch(() => null);
      if (r.status === 401) { router.push("/login"); return; }
      if (!data) throw new Error("bad");
      if (data.ok) {
        const time = new Intl.DateTimeFormat("es-AR", { timeZone: data.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.occurredAt));
        navigator.vibrate?.([30, 50, 30]);
        setStep({ s: "done", type: data.type, time, branch: data.branchName });
        router.refresh();
      } else {
        setStep({ s: "error", kind: data.code === "outside_fence" ? "outside" : data.code === "low_accuracy" ? "geo" : "other", message: data.message });
      }
    } catch {
      setStep({ s: "error", kind: "net", message: "No se pudo conectar con el servidor. La fichada NO fue registrada. Verificá tu conexión y volvé a intentar." });
    }
  };

  const verify = async () => {
    setCheck("checking");
    try {
      const reading = await getBestPosition();
      const r = await fetch("/api/location-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reading) });
      const d = await r.json();
      setCheck(d.status ?? "error");
      setCheckBranch(d.branch ?? "");
    } catch { setCheck("error"); }
  };

  const busy = step.s === "locating" || step.s === "sending";
  return (
    <div className="space-y-4">
      <div className="surface rounded-3xl p-6 text-center animate-in">
        <div className="text-sm text-muted first-letter:uppercase" suppressHydrationWarning>
          {now ? new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(now) : " "}
        </div>
        <div className="mt-1 text-5xl font-semibold tabular-nums tracking-tight" suppressHydrationWarning>
          {now ? new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now) : "--:--:--"}
        </div>
        <p className="mt-1 text-[11px] text-muted">La hora oficial de la fichada la registra el servidor.</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            disabled={busy || open}
            onClick={() => start("in")}
            className={clsx("flex h-28 flex-col items-center justify-center gap-2 rounded-2xl text-lg font-semibold transition active:scale-[.98]",
              open ? "surface-2 text-muted opacity-60" : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700")}
          >
            <LogIn className="size-7" /> Registrar entrada
          </button>
          <button
            disabled={busy || !open}
            onClick={() => start("out")}
            className={clsx("flex h-28 flex-col items-center justify-center gap-2 rounded-2xl text-lg font-semibold transition active:scale-[.98]",
              !open ? "surface-2 text-muted opacity-60" : "bg-slate-900 text-white shadow-lg shadow-slate-900/25 hover:bg-slate-800 dark:bg-white dark:text-slate-900")}
          >
            <LogOut className="size-7" /> Registrar salida
          </button>
        </div>

        <button onClick={verify} disabled={check === "checking" || busy} className="mx-auto mt-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-[var(--surface-2)]">
          {check === "checking" ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
          {check === null || check === "checking" ? "Verificar mi ubicación" : null}
          {check === "inside" && <span className="text-emerald-600 dark:text-emerald-400">Estás dentro del área de {checkBranch}</span>}
          {check === "outside" && <span className="text-rose-600 dark:text-rose-400">Estás fuera del área autorizada</span>}
          {check === "low_accuracy" && <span className="text-amber-600">Ubicación poco precisa: acercate a una ventana</span>}
          {check === "not_configured" && <span className="text-amber-600">Tu sucursal aún no tiene ubicación configurada</span>}
          {check === "error" && <span className="text-amber-600">No se pudo obtener la ubicación</span>}
        </button>
      </div>

      {step.s !== "idle" && step.s !== "scanning" && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
          <div className="surface w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl animate-pop">
            {step.s === "locating" && (<>
              <MapPin className="mx-auto size-10 text-brand-600 animate-pulse" />
              <h3 className="mt-3 text-lg font-semibold">Verificando tu ubicación…</h3>
              <p className="mt-1 text-sm text-muted">Mantené el celular quieto unos segundos. Sólo se usa para validar esta fichada.</p>
            </>)}
            {step.s === "confirm" && (<>
              <ShieldCheck className="mx-auto size-10 text-brand-600" />
              <h3 className="mt-3 text-lg font-semibold">Confirmar {step.type === "in" ? "entrada" : "salida"}</h3>
              <p className="mt-1 text-sm text-muted">Ubicación obtenida (±{Math.round(step.reading.accuracy)} m) y código QR leído. El servidor verificará ambos.</p>
              <div className="mt-5 grid gap-2">
                <button onClick={() => send(step)} className={clsx("rounded-2xl py-4 text-base font-semibold text-white", step.type === "in" ? "bg-emerald-600" : "bg-slate-900 dark:bg-white dark:text-slate-900")}>
                  Confirmar {step.type === "in" ? "entrada" : "salida"}
                </button>
                <button onClick={() => setStep({ s: "idle" })} className="rounded-2xl py-3 text-sm text-muted">Cancelar</button>
              </div>
            </>)}
            {step.s === "sending" && (<>
              <Loader2 className="mx-auto size-10 animate-spin text-brand-600" />
              <h3 className="mt-3 text-lg font-semibold">Registrando…</h3>
              <p className="mt-1 text-sm text-muted">Esperando la confirmación del servidor.</p>
            </>)}
            {step.s === "done" && (<>
              <CheckCircle2 className="mx-auto size-14 text-emerald-600 animate-pop" />
              <h3 className="mt-3 text-xl font-semibold">{step.type === "in" ? "Entrada" : "Salida"} registrada correctamente — {step.time} hs.</h3>
              <p className="mt-1 text-sm text-muted">{step.branch}</p>
              <button onClick={() => setStep({ s: "idle" })} className="mt-5 w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white">Listo</button>
            </>)}
            {step.s === "error" && (<>
              {step.kind === "net" ? <WifiOff className="mx-auto size-10 text-amber-500" /> : <AlertTriangle className={clsx("mx-auto size-10", step.kind === "outside" ? "text-rose-500" : "text-amber-500")} />}
              <h3 className="mt-3 text-lg font-semibold">{step.kind === "outside" ? "Fichada rechazada" : "No se registró la fichada"}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.message}</p>
              <button onClick={() => setStep({ s: "idle" })} className="mt-5 w-full rounded-2xl surface-2 py-3.5 font-semibold">Entendido</button>
            </>)}
          </div>
        </div>
      )}
      {step.s === "scanning" && <QrScanner onResult={onScan} onCancel={() => setStep({ s: "idle" })} />}
      {pendingQr && step.s === "idle" && (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-brand-500/10 px-3 py-2 text-sm text-brand-700 dark:text-blue-300">
          <ScanLine className="size-4" /> Código QR leído. Tocá entrada o salida para continuar.
        </p>
      )}
    </div>
  );
}
