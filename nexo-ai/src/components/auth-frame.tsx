import { ShieldCheck, Quote, Workflow } from "lucide-react";
import { Logo } from "./logo";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-fade-up">
          <Logo />
          <h1 className="mt-10 text-[28px] font-semibold tracking-[-0.03em]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(700px_420px_at_70%_20%,rgb(94_234_212/0.16),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]" />
        <div className="relative flex h-full flex-col justify-center gap-4 px-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent/80">Operational Intelligence</p>
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.03em] text-fg">
            Del chat del equipo a una operación que se puede seguir, medir y auditar.
          </p>
          <ul className="mt-6 grid max-w-md gap-3 text-sm text-muted">
            {[
              { icon: Quote, t: "Cada hallazgo cita el mensaje original del que proviene." },
              { icon: Workflow, t: "Nada se confirma sin validación humana o evidencia." },
              { icon: ShieldCheck, t: "Datos separados por empresa, cifrado y auditoría." },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
                <Icon className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
