import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { configurado } from './lib/supabase.js';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Recuperar from './pages/Recuperar.jsx';
import DefinirClave from './pages/DefinirClave.jsx';
import HacerPedido from './pages/cliente/HacerPedido.jsx';
import MisPedidos from './pages/cliente/MisPedidos.jsx';
import Pedidos from './pages/admin/Pedidos.jsx';
import Clientes from './pages/admin/Clientes.jsx';
import ClienteFicha from './pages/admin/ClienteFicha.jsx';
import Productos from './pages/admin/Productos.jsx';
import Usuarios from './pages/admin/Usuarios.jsx';
import Configuracion from './pages/admin/Configuracion.jsx';

const INICIO = { admin: '/admin/pedidos', fabrica: '/fabrica', cliente: '/pedido' };

function Protegida({ roles, children }) {
  const { session, perfil, cargando, salir } = useAuth();
  if (cargando) return <div className="cargando">Cargando…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!perfil || !perfil.activo) {
    return (
      <div className="login">
        <div className="aviso error">Tu usuario no está habilitado. Comunicate con El Cóndor.</div>
        <button className="ancho" onClick={salir}>Salir</button>
      </div>
    );
  }
  if (roles && !roles.includes(perfil.rol)) return <Navigate to={INICIO[perfil.rol]} replace />;
  return <Layout>{children}</Layout>;
}

function Inicio() {
  const { session, perfil, cargando } = useAuth();
  if (cargando) return <div className="cargando">Cargando…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={INICIO[perfil?.rol] || '/login'} replace />;
}

export default function App() {
  if (!configurado) {
    return (
      <div className="login">
        <div className="aviso alerta">
          Falta configurar Supabase: cargá <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en las variables de entorno de Netlify y volvé a publicar.
        </div>
      </div>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar" element={<Recuperar />} />
      <Route path="/definir-clave" element={<DefinirClave />} />

      <Route path="/pedido" element={<Protegida roles={['cliente']}><HacerPedido /></Protegida>} />
      <Route path="/mis-pedidos" element={<Protegida roles={['cliente']}><MisPedidos /></Protegida>} />

      <Route path="/admin/pedidos" element={<Protegida roles={['admin']}><Pedidos /></Protegida>} />
      <Route path="/admin/cargar-pedido" element={<Protegida roles={['admin']}><HacerPedido modoAdmin /></Protegida>} />
      <Route path="/admin/clientes" element={<Protegida roles={['admin']}><Clientes /></Protegida>} />
      <Route path="/admin/clientes/:id" element={<Protegida roles={['admin']}><ClienteFicha /></Protegida>} />
      <Route path="/admin/productos" element={<Protegida roles={['admin']}><Productos /></Protegida>} />
      <Route path="/admin/usuarios" element={<Protegida roles={['admin']}><Usuarios /></Protegida>} />
      <Route path="/admin/configuracion" element={<Protegida roles={['admin']}><Configuracion /></Protegida>} />

      <Route path="/fabrica" element={<Protegida roles={['fabrica', 'admin']}><Pedidos soloLectura /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
