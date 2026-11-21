import { StyleSheet } from '@react-pdf/renderer';
import type { BrandSettings } from '../lib/types';

export function pdfColors(brand: BrandSettings) {
  return {
    primary: brand.color_primary,
    accent: brand.color_accent,
    cream: '#f7f1e7',
    paper: '#fffdf9',
    ink: '#2e2016',
    muted: '#7a6a5a',
    line: '#e6dccb',
    ok: '#2f6b4f',
    good: '#5a7a3a',
    warn: '#b07a1e',
    bad: '#a33b2b',
  };
}

export function toneFor(score: number | null | undefined, c: ReturnType<typeof pdfColors>) {
  if (score == null) return c.muted;
  if (score >= 90) return c.ok;
  if (score >= 80) return c.good;
  if (score >= 70) return c.warn;
  return c.bad;
}

export const base = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 56, paddingHorizontal: 42, fontFamily: 'Helvetica', fontSize: 9, color: '#2e2016', backgroundColor: '#ffffff' },
  h1: { fontFamily: 'Times-Bold', fontSize: 20, marginBottom: 6 },
  h2: { fontFamily: 'Times-Bold', fontSize: 15, marginBottom: 8, marginTop: 4 },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 4 },
  small: { fontSize: 7.5, color: '#7a6a5a' },
  p: { fontSize: 9, lineHeight: 1.45, marginBottom: 4 },
  row: { flexDirection: 'row' },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.5, color: '#7a6a5a', paddingVertical: 5, paddingHorizontal: 4 },
  td: { fontSize: 8.5, paddingVertical: 4.5, paddingHorizontal: 4 },
});
