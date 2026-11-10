import { requireActor } from "@/lib/session";
import { Card } from "@/components/ui";

export const metadata = { title: "Sistema listo" };

export default async function Listo({ searchParams }: { searchParams: Promise<{ demo?: string; pin?: string }> }) {
  await requireActor({ roles: ["superadmin"] });
  const { demo, pin } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">¡Listo! El sistema está configurado.</h1>
      {demo && (
        <Card className="mt-6" title="Datos de la empresa DEMO (anotalos: no se vuelven a mostrar)">
          <ul className="space-y-1.5 text-sm">
            <li>Contraseña de todos los usuarios demo: <b className="font-mono">{demo}</b></li>
            <li>Usuarios: <span className="font-mono">admin@demo.local · gerencia@demo.local · encargado@demo.local · empleado1@demo.local · empleado2@demo.local · empleado3@demo.local</span></li>
            <li>PIN para la terminal: <b className="font-mono">{pin}</b> (legajos 9001, 9002, 9003)</li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Para probar el fichaje: en <b>Sucursales → Local demo</b> cargá tu ubicación actual, en <b>Terminales</b> generá un código y abrí <b>/terminal</b> en otra pantalla.
            Después ingresá desde el celular como empleado1 y fichá escaneando el QR.
          </p>
        </Card>
      )}
      <a href="/admin" className="mt-6 inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">Ir al panel</a>
    </main>
  );
}
