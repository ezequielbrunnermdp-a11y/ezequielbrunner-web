"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setError((await res.json()).error ?? "Error");
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 p-8 shadow-2xl">
        <div className="mb-6">
          <div className="font-serif text-2xl text-white">JURIS <span className="text-gold-400">IA</span></div>
          <p className="mt-1 text-sm text-ink-400">Plataforma de inteligencia judicial</p>
        </div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-ink-400">Email</label>
        <input className="mb-4 w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 outline-none focus:border-gold-500" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <label className="mb-1 block text-xs uppercase tracking-wide text-ink-400">Contraseña</label>
        <input className="mb-5 w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 outline-none focus:border-gold-500" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-gold-500 py-2 font-semibold text-ink-950 hover:bg-gold-400 disabled:opacity-50">{busy ? "Ingresando…" : "Ingresar"}</button>
        <p className="mt-6 text-[11px] leading-relaxed text-ink-400">El acceso queda registrado. Los datos personales de las causas están protegidos por la Ley 25.326.</p>
      </form>
    </main>
  );
}
