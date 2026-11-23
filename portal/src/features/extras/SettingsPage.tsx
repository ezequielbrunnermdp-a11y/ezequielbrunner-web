import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Moon, Sun, Monitor, KeyRound, ShieldCheck, Smartphone, Download, Bell, Lock, UserX, Scale } from 'lucide-react';
import { rpc, supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import { useAction } from '@/lib/hooks';
import { env } from '@/lib/env';
import { pushSupport, subscribePush } from '@/lib/pwa';
import { errorMessage } from '@/lib/errors';
import { fmtDate } from '@/lib/format';
import { Button, Card, CardHeader, Field, Input, Notice, PageHeader, Switch, cx } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { passwordProblems } from '../auth/AuthPages';

const NOTIF_TYPES: [string, string][] = [
  ['friend_request', 'Solicitudes de amistad'], ['message', 'Mensajes nuevos'], ['comment', 'Comentarios'], ['mention', 'Menciones'],
  ['schedule', 'Cambios de horario'], ['meeting', 'Reuniones'], ['hr_request', 'Solicitudes'], ['document', 'Documentos disponibles'],
  ['training', 'Capacitaciones'], ['recognition', 'Reconocimientos'], ['ticket', 'Hablar con gerencia'],
];

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => { try { return (localStorage.getItem('theme') as 'light' | 'dark') || 'system'; } catch { return 'system'; } });
  useEffect(() => {
    try { if (theme === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', theme); } catch { /* */ }
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [theme]);
  return [theme, setTheme] as const;
}

export function SettingsPage() {
  const { ctx, refreshCtx, signOut } = useAuth();
  const toast = useToast();
  const p = ctx!.profile!;
  const [theme, setTheme] = useTheme();
  const updateProfile = useAction(async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('user_id', ctx!.user_id);
    if (error) throw error;
    await refreshCtx();
  }, { success: 'Preferencia guardada' });

  // Contraseña
  const [pw, setPw] = useState('');
  const changePw = useAction(async () => {
    const pr = passwordProblems(pw); if (pr) throw new Error(pr);
    const { error } = await supabase.auth.updateUser({ password: pw }); if (error) throw error;
  }, { success: 'Contraseña actualizada', onDone: () => setPw('') });

  // PIN de tablet
  const [pin, setPin] = useState('');
  const savePin = useAction(() => rpc('set_kiosk_pin', { p_pin: pin }), { success: 'PIN de tablet guardado', onDone: () => { setPin(''); void refreshCtx(); } });

  // MFA
  const factors = useQuery({ queryKey: ['mfa-factors'], queryFn: async () => { const { data, error } = await supabase.auth.mfa.listFactors(); if (error) throw error; return data.totp; } });
  const unenroll = useAction(async (id: string) => { const { error } = await supabase.auth.mfa.unenroll({ factorId: id }); if (error) throw error; }, { success: 'Verificación en dos pasos desactivada', invalidate: [['mfa-factors']] });

  // Bloqueos
  const blocked = useQuery({ queryKey: ['blocked'], queryFn: () => rpc<{ user_id: string; first_name: string; last_name: string; blocked_at: string }[]>('my_blocked_users') });
  const unblock = useAction((u: string) => rpc('unblock_user', { p_user: u }), { success: 'Desbloqueado', invalidate: [['blocked']] });

  const exportData = async () => {
    try {
      const data = await rpc('export_my_data');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast(errorMessage(e), 'bad'); }
  };

  const push = pushSupport();
  const enablePush = async () => {
    try {
      if (!env.vapidPublicKey) throw new Error('Las notificaciones push todavía no están configuradas por la empresa.');
      const sub = await subscribePush(env.vapidPublicKey);
      const { error } = await supabase.from('push_subscriptions').upsert({ user_id: ctx!.user_id, endpoint: sub.endpoint!, p256dh: sub.keys!.p256dh!, auth: sub.keys!.auth!, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
      if (error) throw error;
      toast('Notificaciones activadas en este dispositivo');
    } catch (e) { toast(errorMessage(e), 'bad'); }
  };
  const prefs = p.notification_prefs ?? {};
  const hasMfa = factors.data?.some((f) => f.status === 'verified');

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Configuración" />

      <Card><CardHeader title="Apariencia" />
        <div className="grid grid-cols-3 gap-2 p-5 pt-3">
          {([['light', 'Claro', <Sun key="s" className="h-4 w-4" />], ['dark', 'Oscuro', <Moon key="m" className="h-4 w-4" />], ['system', 'Automático', <Monitor key="a" className="h-4 w-4" />]] as const).map(([v, l, i]) => (
            <button key={v} onClick={() => setTheme(v)} aria-pressed={theme === v} className={cx('flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium', theme === v ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2')}>{i}{l}</button>
          ))}
        </div>
      </Card>

      <Card><CardHeader title="Privacidad" icon={<Lock className="h-4 w-4" />} />
        <div className="divide-y divide-line/70 px-5 pb-2">
          <Switch label="Participar en la comunidad" description="Si lo desactivás, tu perfil y publicaciones dejan de ser visibles para tus compañeros. No afecta tu trabajo." checked={p.social_enabled} onChange={(v) => updateProfile.mutate({ social_enabled: v })} />
          <Switch label="Confirmaciones de lectura" description="Si lo desactivás, tampoco verás cuándo leen tus mensajes." checked={p.show_read_receipts} onChange={(v) => updateProfile.mutate({ show_read_receipts: v })} />
        </div>
      </Card>

      <Card><CardHeader title="Notificaciones" icon={<Bell className="h-4 w-4" />} subtitle="Las notificaciones nunca incluyen datos laborales sensibles" />
        <div className="divide-y divide-line/70 px-5 pb-2">
          {NOTIF_TYPES.map(([k, l]) => <Switch key={k} label={l} checked={prefs[k] !== false} onChange={(v) => updateProfile.mutate({ notification_prefs: { ...prefs, [k]: v } })} />)}
        </div>
        <div className="border-t border-line/70 p-5">
          <p className="text-sm font-medium">Notificaciones en este dispositivo</p>
          {!push.supported ? <p className="mt-1 text-sm text-ink-3">{push.reason}</p>
            : !env.vapidPublicKey ? <p className="mt-1 text-sm text-ink-3">El envío push aún no fue configurado. Mientras tanto, las novedades se ven en el centro de notificaciones.</p>
            : <Button className="mt-2" variant="secondary" size="sm" onClick={() => void enablePush()}>Activar notificaciones push</Button>}
          <p className="mt-2 text-xs text-ink-3">Participar en la comunidad no implica obligación de responder fuera de tu jornada.</p>
        </div>
      </Card>

      <Card><CardHeader title="Tablet de fichaje" icon={<Smartphone className="h-4 w-4" />} subtitle={ctx?.employments[0]?.has_kiosk_pin ? 'Ya tenés un PIN configurado' : 'Configurá tu PIN para fichar en la tablet de la sucursal'} />
        <div className="space-y-3 p-5 pt-2">
          <p className="text-sm text-ink-2">Tu código de empleado es <strong className="font-mono">{ctx?.employments[0]?.employee_code}</strong>. El PIN es personal: no lo compartas.</p>
          <div className="flex gap-2">
            <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN de 6 dígitos" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="PIN de tablet" />
            <Button disabled={pin.length !== 6} loading={savePin.isPending} onClick={() => savePin.mutate(undefined)}>Guardar</Button>
          </div>
        </div>
      </Card>

      <Card><CardHeader title="Seguridad" icon={<KeyRound className="h-4 w-4" />} />
        <div className="space-y-5 p-5 pt-2">
          <Field label="Nueva contraseña" hint="Mínimo 10 caracteres, con letras y números.">
            <div className="flex gap-2"><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /><Button disabled={!pw} loading={changePw.isPending} onClick={() => changePw.mutate(undefined)}>Cambiar</Button></div>
          </Field>
          <div>
            <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" />Verificación en dos pasos</p>
            {hasMfa ? (
              <div className="mt-1 flex items-center justify-between text-sm text-ink-2"><span>Activada con app de autenticación</span>
                {!ctx?.mfa_required && <Button size="sm" variant="ghost" onClick={() => unenroll.mutate(factors.data!.find((f) => f.status === 'verified')!.id)}>Desactivar</Button>}</div>
            ) : <p className="mt-1 text-sm text-ink-3">{ctx?.mfa_required ? 'Obligatoria para tu rol: se te pedirá al ingresar.' : 'Disponible para roles con acceso administrativo.'}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void signOut('others').then(() => toast('Se cerraron las demás sesiones'))}>Cerrar sesión en otros dispositivos</Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut('global')}>Cerrar todas las sesiones</Button>
          </div>
        </div>
      </Card>

      {(blocked.data?.length ?? 0) > 0 && (
        <Card><CardHeader title="Personas bloqueadas" icon={<UserX className="h-4 w-4" />} />
          <ul className="divide-y divide-line/70 px-5 pb-2">{blocked.data!.map((b) => (
            <li key={b.user_id} className="flex items-center justify-between py-3 text-sm"><span>{b.first_name} {b.last_name}<span className="ml-2 text-xs text-ink-3">desde {fmtDate(b.blocked_at)}</span></span><Button size="sm" variant="ghost" onClick={() => unblock.mutate(b.user_id)}>Desbloquear</Button></li>
          ))}</ul>
        </Card>
      )}

      <Card><CardHeader title="Tus datos personales" icon={<Scale className="h-4 w-4" />} />
        <div className="space-y-3 p-5 pt-2 text-sm text-ink-2">
          <p>Tu empleador es responsable del tratamiento de tus datos laborales, con las finalidades de gestión de personal, horarios y asistencia (Ley 25.326). Tus datos sociales (perfil, publicaciones, mensajes) se guardan separados y son voluntarios.</p>
          <p>La ubicación se consulta solo al fichar; no hay seguimiento. Tus mensajes privados no son accesibles para la gerencia desde la plataforma.</p>
          <p>Podés ejercer tus derechos de acceso, rectificación y supresión. Para corregir datos laborales, enviá una solicitud de “Actualización de datos”.</p>
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => void exportData()}>Descargar una copia de mis datos</Button>
          <Notice tone="warn">Texto informativo a revisar por asesoría legal antes del uso formal (ver docs/PRIVACIDAD-Y-LEGAL.md).</Notice>
        </div>
      </Card>
    </div>
  );
}
