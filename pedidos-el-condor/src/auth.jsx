import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [perfil, setPerfil] = useState(undefined);
  const [cliente, setCliente] = useState(null);
  const [perfilDe, setPerfilDe] = useState(null); // uid del perfil cargado

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;
  const cargarPerfil = useCallback(async () => {
    if (!uid) { setPerfil(null); setCliente(null); setPerfilDe(null); return; }
    const { data: p } = await supabase.from('perfiles').select('*').eq('id', uid).maybeSingle();
    setPerfil(p || null);
    if (p?.cliente_id) {
      const { data: c } = await supabase.from('clientes').select('*').eq('id', p.cliente_id).maybeSingle();
      setCliente(c || null);
    } else setCliente(null);
    setPerfilDe(uid);
  }, [uid]);

  useEffect(() => { if (session !== undefined) cargarPerfil(); }, [session, cargarPerfil]);

  const salir = () => supabase.auth.signOut();
  const cargando = session === undefined || (session && perfilDe !== uid);
  return <Ctx.Provider value={{ session, perfil, cliente, cargando, salir, recargar: cargarPerfil }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
