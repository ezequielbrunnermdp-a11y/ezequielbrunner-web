"use client";
import Link from "next/link";

export function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-ink-700 bg-ink-900 px-4">
      <Link href="/" className="font-serif text-lg text-white">JURIS <span className="text-gold-400">IA</span></Link>
      <div className="min-w-0 flex-1">{children}</div>
      <Link href="/causas/nueva" className="rounded-md border border-ink-600 px-3 py-1.5 text-sm hover:border-gold-500">+ Incorporar causa</Link>
      <button
        className="text-sm text-ink-400 hover:text-white"
        onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
      >Salir</button>
    </header>
  );
}
