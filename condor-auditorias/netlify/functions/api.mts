// API de datos, sesiones y archivos (compatible con @supabase/supabase-js).
import type { Config } from '@netlify/functions';
import { handle } from '../lib/gateway';
import { gatewayEnv } from '../lib/runtime';

export default async (req: Request) => {
  try {
    return await handle(req, await gatewayEnv());
  } catch (e) {
    console.error('api', e);
    return Response.json({ message: 'Servicio no disponible: revise la configuración del servidor.' }, { status: 503 });
  }
};

export const config: Config = { path: ['/rest/v1/*', '/auth/v1/*', '/storage/v1/*'] };
