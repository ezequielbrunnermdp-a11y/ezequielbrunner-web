# EL CÓNDOR | CONTROL DE FRANQUICIAS

Sistema Integral de Auditorías y Calidad Operativa de El Cóndor Coffee Shop: auditorías desde el celular con puntaje 0–5 por control, cálculo ponderado sobre 100, fotografías, incumplimientos y acciones correctivas, alertas críticas, historial por sucursal, panel ejecutivo e informes PDF corporativos.

- Despliegue, Supabase, administrador inicial y variables de entorno: **[DESPLIEGUE.md](DESPLIEGUE.md)**
- Esquema y reglas de negocio: `supabase/migrations/`
- Cuestionario inicial (fuente única): `supabase/seed/cuestionario_v1.json` → `node scripts/generar-seed.mjs`

```bash
npm install && npm run dev      # desarrollo
npm test                        # pruebas de cálculo y PDF
bash tests/db/run.sh            # pruebas de base de datos y permisos (PostgreSQL local)
npm run build                   # build de producción
```
