"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import clsx from "clsx";
import { Loader2, KeyRound, QrCode, CheckCircle2, AlertTriangle, Delete } from "lucide-react";

export function PairForm() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <form
        className="surface w-full max-w-sm space-y-4 rounded-2xl p-6"
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setMsg(null);
          const r = await fetch("/api/terminal/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
          if (r.ok) location.reload(); else { setMsg((await r.json()).message ?? "Error"); setBusy(false); }
        }}
      >
        <h1 className="text-xl font-semibold">Vincular terminal</h1>
        <p className="text-sm text-muted">Ingresá el código de 8 dígitos generado en Administración → Terminales. Este dispositivo quedará asociado a la sucursal.</p>
        <input className="input text-center text-2xl tracking-[.4em] tabular-nums" inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        {msg && <p className="text-sm text-rose-600">{msg}</p>}
        <button disabled={code.length !== 8 || busy} className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white disabled:opacity-50">Vincular</button>
      </form>
    </main>
  );
}

function useClock(tz: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now ? new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "--:--";
}

export function TerminalScreen({ branch, company, kiosk, tz }: { branch: string; company: string; kiosk: boolean; tz: string }) {
  const [mode, setMode] = useState<"qr" | "kiosk">("qr");
  const clock = useClock(tz);
  return (
    <main className="flex min-h-dvh flex-col p-6">
      <header className="flex items-center justify-between">
        <div><div className="text-sm text-muted">{company}</div><div className="text-2xl font-semibold tracking-tight">{branch}</div></div>
        <div className="text-4xl font-semibold tabular-nums" suppressHydrationWarning>{clock}</div>
      </header>
      <div className="flex flex-1 items-center justify-center py-6">{mode === "qr" ? <QrPanel /> : <Kiosk onDone={() => setMode("qr")} />}</div>
      {kiosk && (
        <nav className="mx-auto flex gap-2 rounded-2xl surface p-1.5">
          <button onClick={() => setMode("qr")} className={clsx("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium", mode === "qr" && "bg-brand-600 text-white")}><QrCode className="size-4" />Fichar con celular</button>
          <button onClick={() => setMode("kiosk")} className={clsx("flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium", mode === "kiosk" && "bg-brand-600 text-white")}><KeyRound className="size-4" />Fichar sin celular</button>
        </nav>
      )}
    </main>
  );
}

function QrPanel() {
  const [img, setImg] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [err, setErr] = useState(false);
  const exp = useRef(0);
  const skew = useRef(0);
  useEffect(() => {
    let stop = false; let timer: any;
    const load = async () => {
      try {
        const r = await fetch("/api/terminal/qr", { cache: "no-store" });
        if (r.status === 401) { location.reload(); return; }
        const d = await r.json();
        skew.current = d.serverTime - Date.now();
        exp.current = d.expiresAt;
        setLeft(Math.round((d.expiresAt - d.serverTime) / 1000));
        setImg(await QRCode.toDataURL(d.url, { margin: 1, width: 560, errorCorrectionLevel: "M" }));
        setErr(false);
        const ttl = d.expiresAt - d.serverTime;
        // Renueva antes de que venza (a mitad de su vigencia).
        if (!stop) timer = setTimeout(load, Math.max(5000, ttl / 2));
      } catch {
        setErr(true);
        if (!stop) timer = setTimeout(load, 4000);
      }
    };
    load();
    const tick = setInterval(() => setLeft(Math.max(0, Math.round((exp.current - (Date.now() + skew.current)) / 1000))), 500);
    return () => { stop = true; clearTimeout(timer); clearInterval(tick); };
  }, []);
  return (
    <div className="text-center">
      <div className="mx-auto rounded-3xl bg-white p-5 shadow-xl">
        {img && !err ? <img src={img} alt="Código QR de fichaje" className="size-[min(70vw,420px)]" /> : <div className="grid size-[min(70vw,420px)] place-items-center text-slate-500">{err ? "Sin conexión con el servidor…" : <Loader2 className="size-10 animate-spin" />}</div>}
      </div>
      <p className="mt-5 text-lg font-medium">Abrí la app Asistencia y tocá “Registrar entrada” o “Registrar salida”</p>
      <p className="mt-1 text-sm text-muted">El código se renueva automáticamente · válido por {left} s</p>
    </div>
  );
}

function Kiosk({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState("");
  const [pin, setPin] = useState("");
  const [field, setField] = useState<"file" | "pin">("file");
  const [state, setState] = useState<{ s: "idle" | "busy" | "ok" | "err"; msg?: string }>({ s: "idle" });
  const key = useRef("");
  const press = (d: string) => {
    if (field === "file") setFile((v) => (v + d).slice(0, 10)); else setPin((v) => (v + d).slice(0, 8));
  };
  const back = () => (field === "file" ? setFile((v) => v.slice(0, -1)) : setPin((v) => v.slice(0, -1)));
  const reset = () => { setFile(""); setPin(""); setField("file"); };
  const send = async (type: "in" | "out") => {
    if (!file || pin.length < 4) return;
    key.current = (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).replace(/[^A-Za-z0-9]/g, "");
    setState({ s: "busy" });
    try {
      const r = await fetch("/api/terminal/punch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileNumber: file, pin, type, idempotencyKey: key.current }) });
      const d = await r.json();
      if (d.ok) {
        const t = new Intl.DateTimeFormat("es-AR", { timeZone: d.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d.occurredAt));
        setState({ s: "ok", msg: `${d.name ? d.name + ": " : ""}${type === "in" ? "Entrada" : "Salida"} registrada correctamente — ${t} hs.` });
      } else setState({ s: "err", msg: d.message });
    } catch { setState({ s: "err", msg: "Sin conexión con el servidor. La fichada NO fue registrada." }); }
    reset();
    setTimeout(() => { setState({ s: "idle" }); onDone(); }, 5000);
  };
  if (state.s === "ok" || state.s === "err")
    return (
      <div className="max-w-md text-center animate-pop">
        {state.s === "ok" ? <CheckCircle2 className="mx-auto size-20 text-emerald-500" /> : <AlertTriangle className="mx-auto size-20 text-amber-500" />}
        <p className="mt-4 text-2xl font-semibold">{state.msg}</p>
      </div>
    );
  return (
    <div className="w-full max-w-sm">
      <div className="grid grid-cols-2 gap-2">
        {(["file", "pin"] as const).map((f) => (
          <button key={f} onClick={() => setField(f)} className={clsx("surface rounded-xl p-3 text-left", field === f && "ring-2 ring-brand-500")}>
            <div className="text-xs text-muted">{f === "file" ? "Legajo" : "PIN"}</div>
            <div className="h-8 text-2xl font-semibold tabular-nums tracking-widest">{f === "file" ? file : "•".repeat(pin.length)}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} onClick={() => press(d)} className="surface h-16 rounded-xl text-2xl font-semibold active:scale-95">{d}</button>)}
        <button onClick={() => setField(field === "file" ? "pin" : "file")} className="surface h-16 rounded-xl text-sm">{field === "file" ? "PIN →" : "← Legajo"}</button>
        <button onClick={() => press("0")} className="surface h-16 rounded-xl text-2xl font-semibold active:scale-95">0</button>
        <button onClick={back} className="surface grid h-16 place-items-center rounded-xl" aria-label="Borrar"><Delete className="size-6" /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={state.s === "busy" || !file || pin.length < 4} onClick={() => send("in")} className="h-16 rounded-xl bg-emerald-600 text-lg font-semibold text-white disabled:opacity-40">Entrada</button>
        <button disabled={state.s === "busy" || !file || pin.length < 4} onClick={() => send("out")} className="h-16 rounded-xl bg-slate-900 text-lg font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">Salida</button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Fichaje presencial: queda registrado como “Terminal del local”.</p>
    </div>
  );
}
