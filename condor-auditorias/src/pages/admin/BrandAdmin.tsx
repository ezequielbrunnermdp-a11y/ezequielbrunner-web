import { useEffect, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { supabase, friendlyError } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import type { BrandSettings } from '../../lib/types';
import { BrandMark } from '../../components/Brand';
import { Card, ErrorBox, Field, Input, Notice, PageHeader } from '../../components/ui';

export default function BrandAdmin() {
  const { brand, refreshBrand, logoUrl } = useSession();
  const [f, setF] = useState<BrandSettings>(brand);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => setF(brand), [brand]);

  const save = async (patch: Partial<BrandSettings> = {}) => {
    setBusy(true); setErr(null); setOk(false);
    const next = { ...f, ...patch };
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('brand_settings').update({
      company_name: next.company_name, platform_name: next.platform_name, subtitle: next.subtitle, logo_path: next.logo_path,
      color_primary: next.color_primary, color_accent: next.color_accent, color_background: next.color_background, receipt_enabled: next.receipt_enabled,
      updated_at: new Date().toISOString(), updated_by: u.user?.id,
    }).eq('id', 1);
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    await supabase.rpc('log_activity', { p_action: 'editar', p_entity: 'identidad_visual', p_entity_id: '1', p_details: { colores: [next.color_primary, next.color_accent, next.color_background], logo: !!next.logo_path } });
    await refreshBrand();
    setOk(true);
  };

  const uploadLogo = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) return setErr('Formato no admitido. Use PNG, JPG, SVG o WEBP.');
    if (file.size > 2 * 1024 * 1024) return setErr('El archivo supera 2 MB.');
    setBusy(true); setErr(null);
    const path = `logo-${Date.now()}.${file.name.split('.').pop()?.toLowerCase() ?? 'png'}`;
    const { error } = await supabase.storage.from('marca').upload(path, file, { contentType: file.type, upsert: true });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    if (f.logo_path) await supabase.storage.from('marca').remove([f.logo_path]);
    await save({ logo_path: path });
  };

  const color = (k: 'color_primary' | 'color_accent' | 'color_background', label: string) => (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-11 w-14 cursor-pointer rounded-xl border border-cafe-800/15 bg-white p-1" />
        <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} pattern="^#[0-9a-fA-F]{6}$" />
      </div>
    </Field>
  );

  return (
    <div className="fade-in space-y-5">
      <PageHeader eyebrow="Administración" title="Identidad visual" subtitle="Logotipo oficial y colores institucionales. Se aplican automáticamente en la plataforma y en los informes PDF." />
      <Notice>La plataforma no incluye un logotipo inventado: hasta que se cargue el logotipo oficial se muestra únicamente el nombre en tipografía institucional.</Notice>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Logotipo oficial">
          <div className="flex min-h-32 items-center justify-center rounded-xl bg-crema-100 p-4">
            {logoUrl ? <img src={logoUrl} alt="Logotipo" className="max-h-28 object-contain" /> : <span className="text-sm text-cafe-500">Sin logotipo cargado</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer"><Upload className="h-4 w-4" /> {logoUrl ? 'Reemplazar' : 'Cargar logotipo'}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; if (x) uploadLogo(x); }} />
            </label>
            {f.logo_path && <button className="btn-outline" onClick={async () => { await supabase.storage.from('marca').remove([f.logo_path!]); save({ logo_path: null }); }}><Trash2 className="h-4 w-4" /> Quitar</button>}
          </div>
          <p className="mt-2 text-xs text-cafe-500">Recomendado: PNG con fondo transparente, al menos 600 px de ancho. Máximo 2 MB.</p>
        </Card>
        <Card title="Vista previa">
          <div className="space-y-4">
            <div className="rounded-xl p-5" style={{ background: f.color_primary }}><BrandMark light /></div>
            <div className="rounded-xl p-5" style={{ background: f.color_background }}><BrandMark /><button className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: f.color_accent }}>Botón de acento</button></div>
          </div>
        </Card>
      </div>
      <Card title="Textos y colores">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Empresa"><Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} /></Field>
          <Field label="Nombre de la plataforma" hint="Use «|» para separar la línea secundaria."><Input value={f.platform_name} onChange={(e) => setF({ ...f, platform_name: e.target.value })} /></Field>
          <Field label="Subtítulo"><Input value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} /></Field>
          {color('color_primary', 'Color principal')}
          {color('color_accent', 'Color de acento')}
          {color('color_background', 'Color de fondo')}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={f.receipt_enabled} onChange={(e) => setF({ ...f, receipt_enabled: e.target.checked })} /> Habilitar constancia de recepción del franquiciado (firma electrónica simple)</label>
        <div className="mt-4 flex items-center justify-end gap-3">
          {ok && <span className="text-sm text-[#2f6b4f]">Cambios guardados.</span>}
          <button className="btn-primary" onClick={() => save()} disabled={busy}>Guardar cambios</button>
        </div>
        <ErrorBox>{err}</ErrorBox>
      </Card>
    </div>
  );
}
