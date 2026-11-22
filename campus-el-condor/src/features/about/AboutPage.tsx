import { Callout, PageHeader } from '../../components/ui';

export function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="Acerca del campus" title="Cómo funciona esta versión" lead="Una primera versión estática: no tiene servidor, cuentas ni base de datos. Todo lo que hacés queda en el navegador que estás usando." />
      <div className="grid-2">
        <section className="card">
          <h2 style={{ fontSize: '1.4rem' }}>Dónde se guarda tu progreso</h2>
          <ul>
            <li>Los datos permanecen en este navegador, en este dispositivo.</li>
            <li>Pueden perderse si se borra el historial o el almacenamiento del navegador.</li>
            <li>No se sincronizan entre teléfonos ni computadoras.</li>
            <li>Podés exportar un respaldo desde <a href="#/progreso">Progreso</a> e importarlo en otro dispositivo.</li>
            <li>No existen reportes colectivos ni resultados de otras personas.</li>
          </ul>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.4rem' }}>Contenido y aprobaciones</h2>
          <ul>
            <li>Las lecciones son una propuesta pedagógica original, identificada como “Contenido propuesto”.</li>
            <li>Que algo esté publicado en el campus no lo convierte en política oficial de El Cóndor.</li>
            <li>Los ejemplos marcados como “Práctica” no son productos, precios ni promociones reales.</li>
            <li>Las evaluaciones son pedagógicas: no son certificaciones ni calificaciones laborales.</li>
          </ul>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.4rem' }}>Gestión local de contenido</h2>
          <ul>
            <li>Lo que se carga en <a href="#/gestionar">Gestionar contenido</a> solo cambia este dispositivo.</li>
            <li>No hay PIN ni rutas ocultas: cualquiera que use el dispositivo puede verlo y editarlo.</li>
            <li>La etiqueta “Encargado/a” o el modo facilitador no crean permisos.</li>
            <li>Para que un cambio llegue a todo el equipo hay que publicar una nueva versión del sitio.</li>
          </ul>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.4rem' }}>Privacidad y documentos</h2>
          <ul>
            <li>El campus no usa claves de API, no rastrea ubicación y no envía datos a terceros.</li>
            <li>Los archivos publicados como parte del sitio pueden abrirse por su dirección: no publiques documentos confidenciales.</li>
            <li>Las respuestas de las evaluaciones están en la aplicación y no son secretas.</li>
          </ul>
        </section>
      </div>
      <div style={{ marginTop: 24 }}>
        <Callout tone="pending" title="Próxima etapa posible">Si se necesita acceso privado, sincronización entre dispositivos o reportes del equipo, habrá que incorporar autenticación y almacenamiento reales en un servidor. Esa ampliación está descripta en el README del proyecto.</Callout>
      </div>
    </>
  );
}
