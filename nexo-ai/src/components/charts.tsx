/**
 * Gráficos livianos en HTML/CSS (sin librerías), renderizables en servidor.
 * - Una sola serie → sin leyenda; el título la nombra.
 * - Barras con extremo redondeado de 4px anclado a la base y 2px de separación.
 * - Tooltip por barra en hover y foco de teclado; tabla equivalente para lectores de pantalla.
 * Paleta categórica validada (oscuro, superficie #15191c): azul, naranja, aqua.
 */

export const SERIES = { blue: "#3987e5", orange: "#d95926", aqua: "#199e70" } as const;

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export function ActivityBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((a, d) => a + d.value, 0);
  const ticks = [max, Math.round(max / 2), 0];
  return (
    <figure className="m-0">
      <div className="flex gap-3">
        <div className="flex h-40 flex-col justify-between py-0 text-right text-[10px] text-faint tabular" aria-hidden>
          {ticks.map((t, i) => <span key={i} className="leading-none">{t}</span>)}
        </div>
        <div className="relative h-40 flex-1">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((_, i) => <div key={i} className="border-t border-dashed border-white/[0.06]" />)}
          </div>
          <div className="absolute inset-0 flex items-end gap-[2px]" role="img" aria-label={`${label}: ${total} en total`}>
            {data.map((d) => (
              <div key={d.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none" aria-label={`${fmtDay(d.day)}: ${d.value}`}>
                <div
                  className="w-full rounded-t-[4px] bg-accent/70 transition-[background,height] duration-300 group-hover:bg-accent group-focus-visible:bg-accent"
                  style={{ height: d.value ? `${Math.max(3, (d.value / max) * 100)}%` : "0%" }}
                />
                {d.value === 0 && <div className="absolute bottom-0 h-px w-full bg-white/10" />}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-surface-3 px-2.5 py-1.5 text-[11px] opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="text-muted">{fmtDay(d.day)}</span> <span className="ml-1 font-semibold text-fg tabular">{d.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-8 text-[10px] text-faint tabular" aria-hidden>
        <span>{fmtDay(data[0]?.day ?? "")}</span>
        <span>{fmtDay(data[Math.floor(data.length / 2)]?.day ?? "")}</span>
        <span>hoy</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr><th>Día</th><th>Cantidad</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export interface StackRow {
  label: string;
  segments: { key: string; label: string; value: number; color: string }[];
  note?: string;
}

export function StackedBars({ rows, caption }: { rows: StackRow[]; caption: string }) {
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)));
  const legend = rows[0]?.segments ?? [];
  return (
    <figure className="m-0">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted" aria-label="Leyenda">
        {legend.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="grid gap-3.5">
        {rows.map((r) => {
          const total = r.segments.reduce((a, s) => a + s.value, 0);
          return (
            <div key={r.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-fg">{r.label}</span>
                <span className="shrink-0 text-muted tabular">
                  {total}
                  {r.note && <span className="ml-2 text-danger">{r.note}</span>}
                </span>
              </div>
              <div className="flex h-2.5 gap-[2px]" style={{ width: `${(total / max) * 100}%`, minWidth: total ? "8px" : 0 }}>
                {r.segments.filter((s) => s.value > 0).map((s, i, arr) => (
                  <div
                    key={s.key}
                    tabIndex={0}
                    className="group relative h-full outline-none transition-[filter] hover:brightness-125 focus-visible:brightness-125"
                    style={{
                      flexGrow: s.value,
                      background: s.color,
                      borderTopLeftRadius: i === 0 ? 4 : 0,
                      borderBottomLeftRadius: i === 0 ? 4 : 0,
                      borderTopRightRadius: i === arr.length - 1 ? 4 : 0,
                      borderBottomRightRadius: i === arr.length - 1 ? 4 : 0,
                    }}
                    aria-label={`${r.label}, ${s.label}: ${s.value}`}
                  >
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-surface-3 px-2.5 py-1.5 text-[11px] opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="text-muted">{s.label}</span> <span className="ml-1 font-semibold text-fg tabular">{s.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th>Sucursal</th>{legend.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td>{r.segments.map((s) => <td key={s.key}>{s.value}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}
