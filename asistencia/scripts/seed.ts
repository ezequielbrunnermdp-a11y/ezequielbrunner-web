/**
 * Estructura inicial real (editable desde el panel). No crea empleados ni fichadas.
 * Las coordenadas quedan SIN configurar a propósito: no se permite fichar en una sucursal
 * hasta que un administrador cargue su ubicación real y su radio.
 */
import "./env";
import { pool } from "../src/lib/db";

const STRUCTURE = [
  { name: "Puerto de Palos", slug: "puerto-de-palos", branches: ["Casino Central", "Local 15, Centro Comercial del Puerto"] },
  { name: "El Cóndor", slug: "el-condor", branches: ["Güemes", "Colón", "Peña", "Juan B. Justo", "Alem", "Fábrica central"] },
];

export async function seed() {
  const p = pool();
  for (const c of STRUCTURE) {
    const { rows } = await p.query(
      `insert into companies (name, slug) values ($1,$2) on conflict (slug) do update set name = companies.name returning id`,
      [c.name, c.slug],
    );
    for (const b of c.branches)
      await p.query(`insert into branches (company_id, name) values ($1,$2) on conflict (company_id, name) do nothing`, [rows[0].id, b]);
  }
  console.log("✔ Estructura de empresas y sucursales cargada (sin coordenadas: configurarlas desde Administración → Sucursales).");
}

if (require.main === module) seed().then(() => pool().end()).catch((e) => { console.error(e); process.exit(1); });
