import { Image, Line, Rect, Svg, Text, View, G } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { base, pdfColors } from './theme';

type C = ReturnType<typeof pdfColors>;

export function Header({ c, logo, company, title }: { c: C; logo: string | null; company: string; title: string }) {
  return (
    <View fixed style={{ position: 'absolute', top: 22, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: c.accent, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {logo && <Image src={logo} style={{ height: 22, marginRight: 8, objectFit: 'contain' }} />}
        <Text style={{ fontFamily: 'Times-Bold', fontSize: 11, color: c.primary, letterSpacing: 1.2 }}>{company}</Text>
      </View>
      <Text style={{ fontSize: 7.5, color: c.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Text>
    </View>
  );
}

export function Footer({ c, left }: { c: C; left: string }) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 22, left: 42, right: 42, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: c.line, paddingTop: 6 }}>
      <Text style={{ fontSize: 7, color: c.muted }}>{left}</Text>
      <Text style={{ fontSize: 7, color: c.muted }} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function SectionTitle({ c, children, eyebrow }: { c: C; children: ReactNode; eyebrow?: string }) {
  return (
    <View style={{ marginBottom: 10 }} minPresenceAhead={80}>
      {eyebrow && <Text style={{ fontSize: 7, color: c.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{eyebrow}</Text>}
      <Text style={[base.h2, { color: c.primary, marginBottom: 4 }]}>{children}</Text>
      <View style={{ width: 36, height: 1.5, backgroundColor: c.accent }} />
    </View>
  );
}

export function KV({ c, label, value, width = '50%' }: { c: C; label: string; value: ReactNode; width?: string }) {
  return (
    <View style={{ width, paddingVertical: 4, paddingRight: 8 }}>
      <Text style={{ fontSize: 7, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ fontSize: 10, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export interface Col<T> { title: string; width: string; render: (row: T, i: number) => ReactNode; align?: 'left' | 'right' | 'center' }

export function Table<T>({ c, cols, rows, zebra = true }: { c: C; cols: Col<T>[]; rows: T[]; zebra?: boolean }) {
  return (
    <View style={{ borderTopWidth: 0.8, borderTopColor: c.primary }}>
      <View style={[base.row, { borderBottomWidth: 0.5, borderBottomColor: c.line, backgroundColor: c.cream }]} fixed>
        {cols.map((col) => <Text key={col.title} style={[base.th, { width: col.width, textAlign: col.align ?? 'left' }]}>{col.title}</Text>)}
      </View>
      {rows.map((r, i) => (
        <View key={i} wrap={false} style={[base.row, { borderBottomWidth: 0.5, borderBottomColor: c.line, backgroundColor: zebra && i % 2 ? '#fcfaf6' : '#ffffff' }]}>
          {cols.map((col) => {
            const v = col.render(r, i);
            return (
              <View key={col.title} style={{ width: col.width, ...base.td }}>
                {typeof v === 'string' || typeof v === 'number' ? <Text style={{ textAlign: col.align ?? 'left' }}>{v}</Text> : v}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Barras horizontales nítidas (vectoriales) para porcentajes 0–100. */
export function HBarChart({ c, items, width = 510, colorFor }: { c: C; items: { label: string; value: number | null; note?: string }[]; width?: number; colorFor: (v: number | null) => string }) {
  const labelW = 150, valueW = 38, rowH = 15, barW = width - labelW - valueW - 6;
  const h = items.length * rowH + 16;
  return (
    <Svg width={width} height={h}>
      {[0, 25, 50, 75, 100].map((t) => {
        const x = labelW + (barW * t) / 100;
        return (
          <G key={t}>
            <Line x1={x} y1={0} x2={x} y2={h - 12} stroke={c.line} strokeWidth={0.5} />
            <Text x={x} y={h - 2} style={{ fontSize: 6, fill: c.muted } as never} textAnchor="middle">{`${t}`}</Text>
          </G>
        );
      })}
      {items.map((it, i) => {
        const y = i * rowH + 2;
        const v = it.value;
        return (
          <G key={i}>
            <Text x={labelW - 6} y={y + 9} style={{ fontSize: 7, fill: c.ink } as never} textAnchor="end">{it.label.length > 34 ? it.label.slice(0, 33) + '…' : it.label}</Text>
            <Rect x={labelW} y={y + 2} width={barW} height={9} fill="#f3ede2" />
            {v != null && <Rect x={labelW} y={y + 2} width={Math.max(0.5, (barW * Math.min(100, v)) / 100)} height={9} fill={colorFor(v)} />}
            <Text x={labelW + barW + 6} y={y + 9} style={{ fontSize: 7, fill: c.ink, fontFamily: 'Helvetica-Bold' } as never}>{v == null ? (it.note ?? 'N/A') : `${v.toFixed(1)}%`}</Text>
          </G>
        );
      })}
    </Svg>
  );
}

/** Línea de evolución temporal. */
export function LineChart({ c, series, labels, width = 510, height = 170 }: { c: C; series: { name: string; color: string; values: (number | null)[] }[]; labels: string[]; width?: number; height?: number }) {
  const padL = 26, padB = 22, padT = 8, w = width - padL - 8, h = height - padB - padT;
  const n = Math.max(1, labels.length - 1);
  const x = (i: number) => padL + (labels.length === 1 ? w / 2 : (w * i) / n);
  const min = 40;
  const y = (v: number) => padT + h - ((Math.max(min, v) - min) / (100 - min)) * h;
  return (
    <Svg width={width} height={height}>
      {[40, 55, 70, 80, 90, 100].map((t) => (
        <G key={t}>
          <Line x1={padL} y1={y(t)} x2={padL + w} y2={y(t)} stroke={t === 70 || t === 90 ? '#d9c9ad' : c.line} strokeWidth={0.5} />
          <Text x={padL - 4} y={y(t) + 2} style={{ fontSize: 6, fill: c.muted } as never} textAnchor="end">{`${t}`}</Text>
        </G>
      ))}
      {labels.map((l, i) => <Text key={i} x={x(i)} y={height - 8} style={{ fontSize: 6, fill: c.muted } as never} textAnchor="middle">{l}</Text>)}
      {series.map((s) => {
        const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
        return (
          <G key={s.name}>
            {pts.slice(1).map((p, i) => <Line key={i} x1={pts[i][0]} y1={pts[i][1]} x2={p[0]} y2={p[1]} stroke={s.color} strokeWidth={1.4} />)}
            {pts.map((p, i) => <Rect key={'d' + i} x={p[0] - 1.6} y={p[1] - 1.6} width={3.2} height={3.2} fill={s.color} />)}
          </G>
        );
      })}
    </Svg>
  );
}

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: color + '22' }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color }}>{text}</Text>
    </View>
  );
}
