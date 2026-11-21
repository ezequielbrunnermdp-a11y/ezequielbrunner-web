import { useSession } from '../lib/session';
import { BrandMark } from '../components/Brand';

export default function Inactive() {
  const { profile, signOut } = useSession();
  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="card max-w-md p-8 text-center">
        <BrandMark className="justify-center" />
        <h1 className="mt-6 font-serif text-2xl font-semibold">Cuenta sin habilitar</h1>
        <p className="mt-2 text-sm text-cafe-500">
          El usuario {profile?.email} todavía no fue habilitado por la administración o se encuentra desactivado.
          Solicite el alta al administrador general.
        </p>
        <button className="btn-outline mt-6" onClick={signOut}>Cerrar sesión</button>
      </div>
    </div>
  );
}
