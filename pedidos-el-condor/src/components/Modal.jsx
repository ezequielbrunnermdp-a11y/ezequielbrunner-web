export default function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fondo-modal" onClick={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="entre" style={{ marginBottom: 8 }}>
          <h1 style={{ margin: 0 }}>{titulo}</h1>
          {onCerrar && <button className="chico" onClick={onCerrar} aria-label="Cerrar">✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}
