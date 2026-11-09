"use client";
import { Moon, Sun } from "lucide-react";

/** Script que aplica el tema antes de pintar (evita parpadeo). */
export const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Cambiar tema"
      className="rounded-lg p-2 text-muted hover:bg-[var(--surface-2)]"
      onClick={() => {
        const d = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", d);
        try { localStorage.setItem("theme", d ? "dark" : "light"); } catch {}
      }}
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  );
}
