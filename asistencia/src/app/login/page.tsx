import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { LoginForm } from "./form";
import { needsSetup } from "../setup/actions";

export const metadata = { title: "Ingresar" };

export default async function LoginPage() {
  if (await getActor()) redirect("/");
  if (await needsSetup()) redirect("/setup");
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm animate-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/icon.svg" alt="" className="mb-4 size-14 rounded-2xl shadow-lg shadow-brand-600/20" />
          <h1 className="text-2xl font-semibold tracking-tight">Asistencia</h1>
          <p className="mt-1 text-sm text-muted">Ingresá con tu usuario para fichar o gestionar.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Tu ubicación se consulta únicamente en el momento de registrar una entrada o salida, para verificar que estés en tu lugar de trabajo.
          No se realiza seguimiento permanente.
        </p>
      </div>
    </main>
  );
}
