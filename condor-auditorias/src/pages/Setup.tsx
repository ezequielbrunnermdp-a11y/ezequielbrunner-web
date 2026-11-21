export default function Setup() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <div className="eyebrow mb-2">Configuración pendiente</div>
      <h1 className="section-title">EL CÓNDOR | CONTROL DE FRANQUICIAS</h1>
      <p className="mt-4 text-cafe-600">
        La aplicación todavía no está conectada a su base de datos. Configure en Netlify las variables
        <code className="mx-1 rounded bg-cafe-800/5 px-1.5 py-0.5">VITE_SUPABASE_URL</code> y
        <code className="mx-1 rounded bg-cafe-800/5 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code>
        y vuelva a publicar. Las instrucciones completas están en <strong>DESPLIEGUE.md</strong>.
      </p>
    </div>
  );
}
