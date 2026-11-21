// Función privilegiada: alta y gestión de usuarios (verifica que quien llama sea administrador).
import type { Config } from '@netlify/functions';
import { adminUsers } from '../lib/admin-users';
import { gatewayEnv } from '../lib/runtime';

export default async (req: Request) => adminUsers(req, await gatewayEnv());

export const config: Config = { path: '/api/admin-users', method: ['POST'] };
