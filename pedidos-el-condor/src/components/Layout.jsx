import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { nombreCliente } from '../lib/formato.js';

const MENUS = {
  cliente: [['/pedido', 'Hacer pedido'], ['/mis-pedidos', 'Mis pedidos']],
  admin: [['/admin/pedidos', 'Pedidos'], ['/admin/clientes', 'Clientes'], ['/admin/productos', 'Productos'],
    ['/admin/usuarios', 'Usuarios'], ['/admin/configuracion', 'Configuración']],
  fabrica: [['/fabrica', 'Pedidos']],
};

export default function Layout({ children }) {
  const { perfil, cliente, salir } = useAuth();
  return (
    <>
      <header className="barra">
        <div className="marca">EL CÓNDOR<small>{perfil.rol === 'cliente' ? nombreCliente(cliente) : perfil.rol === 'admin' ? 'Administración' : 'Fábrica'}</small></div>
        <div className="derecha"><button onClick={salir}>Salir</button></div>
      </header>
      <nav className="nav">
        {MENUS[perfil.rol].map(([to, txt]) => <NavLink key={to} to={to}>{txt}</NavLink>)}
      </nav>
      <main className="contenido">{children}</main>
    </>
  );
}
