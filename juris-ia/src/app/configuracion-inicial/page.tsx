"use client";
import { useEffect, useState } from "react";

const input = "mb-3 w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 outline-none focus:border-gold-500";

export default function Setup() {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [f, setF] = useState({ token: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/setup").then((r) => r.json()).then((j) => setDisponible(j.disponible)); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await fetch("/api/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (r.ok) window.location.href = "/";
    else setError((await r.json()).error);
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 p-8">
        <div className="mb-5 font-serif text-2xl text-white">Configuración inicial</div>
        {disponible === false ? (
          <p className="text-sm text-ink-400">La configuración inicial ya fue realizada. <a className="text-gold-400 underline" href="/login">Ingresar</a></p>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-400">Cree la cuenta del administrador. Solo puede hacerse una vez.</p>
            <input className={input} placeholder="Código de configuración" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} required />
            <input className={input} placeholder="Nombre y apellido" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
            <input className={input} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            <input className={input} type="password" placeholder="Contraseña (mín. 12 caracteres)" minLength={12} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <button className="w-full rounded-md bg-gold-500 py-2 font-semibold text-ink-950">Crear administrador</button>
          </>
        )}
      </form>
    </main>
  );
}
