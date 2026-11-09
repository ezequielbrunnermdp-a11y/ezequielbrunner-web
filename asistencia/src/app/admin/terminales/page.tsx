import { requireActor } from "@/lib/session";
import { q } from "@/lib/db";
import { scopeSql } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/time";
import { Card, PageHeader, Badge, Field, Input, Select, TableWrap, Empty } from "@/components/ui";
import { ActionForm, Submit } from "@/components/action-form";
import { InlineAction } from "@/components/inline-action";
import { createTerminal, terminalPairing, toggleTerminal } from "../actions";
import { filterOptions } from "../data";

export const metadata = { title: "Terminales" };

export default async function Terminales() {
  const a = await requireActor({ cap: "terminals.manage" });
  const p: unknown[] = [];
  const rows = await q(
    `select t.*, b.name as branch_name, c.name as company_name, t.token_hash is not null as paired from terminals t
     join branches b on b.id = t.branch_id join companies c on c.id = b.company_id
     where ${scopeSql(a, "b.company_id", "b.id", p)} order by c.name, b.name, t.name`, p);
  const { branches } = await filterOptions(a);
  return (
    <>
      <PageHeader title="Terminales" subtitle="Pantallas internas que muestran el QR dinámico y permiten el fichaje presencial con legajo + PIN." />
      <Card padded={false} className="mb-6">
        {rows.length === 0 ? <div className="p-5"><Empty>No hay terminales. Creá una por sucursal.</Empty></div> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Terminal</th><th>Sucursal</th><th>Estado</th><th>Fichaje con PIN</th><th>Última conexión</th><th /></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td>{t.company_name} · {t.branch_name}</td>
                    <td>{!t.active ? <Badge tone="red">Desactivada</Badge> : t.paired ? <Badge tone="green">Vinculada</Badge> : <Badge tone="amber">Sin vincular</Badge>}</td>
                    <td>{t.allow_kiosk_punch ? "Sí" : "No"}</td>
                    <td className="text-xs text-muted">{t.last_seen_at ? fmtDateTime(t.last_seen_at) : "—"}</td>
                    <td className="space-x-1 whitespace-nowrap text-right">
                      <InlineAction action={terminalPairing} fields={{ id: t.id }} label="Código de vinculación" />
                      <InlineAction action={toggleTerminal} fields={{ id: t.id, field: "kiosk" }} label={t.allow_kiosk_punch ? "Quitar PIN" : "Permitir PIN"} />
                      <InlineAction action={toggleTerminal} fields={{ id: t.id, field: "active" }} label={t.active ? "Desactivar" : "Activar"} variant={t.active ? "danger" : "primary"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
      <Card title="Nueva terminal">
        <ActionForm action={createTerminal} className="grid gap-3 sm:grid-cols-4">
          <Field label="Sucursal"><Select name="branch_id">{branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.company_name} · {b.name}</option>)}</Select></Field>
          <Field label="Nombre"><Input name="name" placeholder="Pantalla caja" required /></Field>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm"><input type="checkbox" name="allow_kiosk_punch" defaultChecked /> Permitir fichar con legajo + PIN</label>
          <div className="self-end"><Submit>Crear terminal</Submit></div>
        </ActionForm>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Instalación: en el dispositivo del local abrí <b>/terminal</b>, ingresá el código de vinculación y dejá la pantalla visible para el personal.
          El QR se renueva solo y está firmado por el servidor: una foto del código deja de servir en segundos y no funciona fuera del perímetro.
        </p>
      </Card>
    </>
  );
}
