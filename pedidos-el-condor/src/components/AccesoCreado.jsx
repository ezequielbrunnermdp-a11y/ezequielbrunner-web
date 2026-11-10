import Modal from './Modal.jsx';

// Muestra la contraseña provisoria o confirma que se envió la invitación
export default function AccesoCreado({ resultado, email, onCerrar }) {
  const app = window.location.origin;
  const texto = resultado.clave_provisoria
    ? `Hola! Ya podés hacer tus pedidos a El Cóndor desde ${app}\nUsuario: ${email}\nContraseña provisoria: ${resultado.clave_provisoria}\n(Después podés cambiarla desde "Olvidé mi contraseña").`
    : '';
  return (
    <Modal titulo="Acceso listo" onCerrar={onCerrar}>
      {resultado.clave_provisoria ? (
        <>
          <p>Pasale estos datos al cliente. <b>La contraseña no se vuelve a mostrar.</b></p>
          <p style={{ marginBottom: 4 }}>Usuario: <b>{email}</b></p>
          <div className="clave">{resultado.clave_provisoria}</div>
          <div className="fila" style={{ marginTop: 12 }}>
            <button className="crece" onClick={() => navigator.clipboard?.writeText(texto)}>Copiar mensaje</button>
            <a className="boton primario crece" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
          </div>
        </>
      ) : resultado.email_enviado ? (
        <div className="aviso ok">Le mandamos a <b>{email}</b> un email con el link para que defina su contraseña.</div>
      ) : (
        <div className="aviso alerta">El acceso se creó, pero no se pudo mandar el email. Usá “Reenviar invitación” o generá una contraseña provisoria.</div>
      )}
      <button className="ancho" style={{ marginTop: 12 }} onClick={onCerrar}>Listo</button>
    </Modal>
  );
}
