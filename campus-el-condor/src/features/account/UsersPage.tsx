import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, LogOut, RefreshCw, Shield, Trash2, UserPlus, UserRound, Cloud, CloudOff, Pencil } from 'lucide-react';
import { Badge, Callout, ConfirmModal, Field, Modal, PageHeader, toast } from '../../components/ui';
import { api, ApiError, generatePassword, type AdminUserRow } from '../../auth/api';
import { refreshUser, signOut, useSession } from '../../auth/session';
import { overallStats } from '../../lib/learning';
import { emptyProgress, type Progress } from '../../storage/schema';
import { formatTimestamp } from '../../lib/format';
import { PasswordForm } from './LoginPage';

const SECTORS = ['Salón', 'Recepción', 'Barra', 'Cocina', 'Caja', 'Encargado/a'];

function summary(p: unknown) {
  const prog = { ...emptyProgress(), ...((p as Partial<Progress>) ?? {}) } as Progress;
  const s = overallStats(prog);
  const pct = Math.round(((s.lessonsRead + s.practicesDone + s.per.filter((x) => x.s.quizPassed).length) / (s.lessonsTotal + s.practicesTotal + s.per.length)) * 100);
  return { ...s, pct, attempts: prog.attempts.length, last: prog.lastActivity };
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast('Copiado'), () => toast('No se pudo copiar: seleccioná el texto'));
}

function CredentialsNote({ username, password }: { username: string; password: string }) {
  const text = `Campus El Cóndor\nUsuario: ${username}\nContraseña temporal: ${password}\nAl ingresar por primera vez vas a elegir tu propia contraseña.`;
  return (
    <div className="cred-note">
      <p className="small muted" style={{ margin: '0 0 8px' }}>Pasale estos datos a la persona. La contraseña temporal no se vuelve a mostrar.</p>
      <dl className="kv">
        <dt>Usuario</dt><dd><strong>{username}</strong></dd>
        <dt>Contraseña temporal</dt><dd><code className="kbd" style={{ fontSize: '1rem' }}>{password}</code></dd>
      </dl>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => copy(text)}><Copy aria-hidden="true" />Copiar datos de acceso</button>
    </div>
  );
}

function CreateUserForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [f, setF] = useState({ username: '', displayName: '', sector: '', role: 'empleado', password: generatePassword() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = f.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) { setError('El usuario debe tener entre 3 y 32 caracteres: letras sin tildes, números, punto, guion o guion bajo. Sin espacios.'); return; }
    if (f.password.length < 8) { setError('La contraseña temporal debe tener al menos 8 caracteres.'); return; }
    setBusy(true); setError(null);
    try {
      await api.createUser(token, { ...f, username });
      setCreated({ username, password: f.password });
      setF({ username: '', displayName: '', sector: '', role: 'empleado', password: generatePassword() });
      onCreated();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="stack">
      {created && <Callout tone="ok" title={`Usuario “${created.username}” creado`}><CredentialsNote username={created.username} password={created.password} /></Callout>}
      <form className="form-grid" onSubmit={submit} noValidate>
        <Field label="Usuario" htmlFor="nu-user" hint="Para ingresar. Ej.: maria.gomez"><input id="nu-user" className="input" autoCapitalize="none" spellCheck={false} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
        <Field label="Nombre para mostrar" htmlFor="nu-name"><input id="nu-name" className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
        <Field label="Sector" htmlFor="nu-sector"><select id="nu-sector" className="input" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">Sin indicar</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Rol" htmlFor="nu-role" hint="Administrador: puede crear y gestionar usuarios y ver el avance del equipo."><select id="nu-role" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="empleado">Equipo</option><option value="admin">Administrador</option></select></Field>
        <Field label="Contraseña temporal" htmlFor="nu-pass" hint="La persona la cambia en su primer ingreso." full>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="nu-pass" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} spellCheck={false} />
            <button type="button" className="icon-btn" onClick={() => setF({ ...f, password: generatePassword() })} aria-label="Generar otra contraseña"><RefreshCw aria-hidden="true" /></button>
          </div>
        </Field>
        {error && <div className="full"><Callout tone="err">{error}</Callout></div>}
        <div className="full"><button type="submit" className="btn btn-primary" disabled={busy}><UserPlus aria-hidden="true" />{busy ? 'Creando…' : 'Crear usuario'}</button></div>
      </form>
    </div>
  );
}

export function UsersPage() {
  const { token, user } = useSession();
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [resetFor, setResetFor] = useState<AdminUserRow | null>(null);
  const [resetDone, setResetDone] = useState<{ username: string; password: string } | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    try { setRows(await api.listUsers(token)); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo cargar la lista.'); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  // Al volver a la pestaña se actualiza el avance del equipo.
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [load]);

  const stats = useMemo(() => (rows ?? []).map((r) => ({ r, s: summary(r.progress) })), [rows]);
  if (user?.role !== 'admin') return <PageHeader title="Sin permiso" lead="Esta sección es solo para administradores." />;
  const active = stats.filter((x) => x.r.active);

  const doReset = async () => {
    if (!token || !resetFor) return;
    const pw = generatePassword();
    try { await api.resetPassword(token, resetFor.id, pw); setResetDone({ username: resetFor.username, password: pw }); setResetFor(null); void load(); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'No se pudo restablecer'); }
  };

  return (
    <>
      <PageHeader eyebrow="Administración" title="Usuarios del campus" lead="Creá un usuario para cada persona del equipo. Cada una ingresa con el suyo y su progreso se guarda en el servidor.">
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><UserPlus aria-hidden="true" />Crear usuario</button>
        <button type="button" className="btn btn-ghost" onClick={() => load()}><RefreshCw aria-hidden="true" />Actualizar</button>
      </PageHeader>
      {error && <Callout tone="err">{error}</Callout>}
      {rows && (
        <div className="hero-stats" style={{ marginTop: 0, marginBottom: 24 }}>
          <div><strong>{active.length}</strong><span>Usuarios activos</span></div>
          <div><strong>{active.filter((x) => x.s.started).length}</strong><span>Empezaron el recorrido</span></div>
          <div><strong>{active.length ? Math.round(active.reduce((n, x) => n + x.s.pct, 0) / active.length) : 0}%</strong><span>Avance promedio</span></div>
        </div>
      )}
      {!rows && !error && <p className="muted">Cargando usuarios…</p>}
      <ul className="mod-rows">
        {stats.map(({ r, s }) => (
          <li key={r.id} className="mod-row user-row">
            <span className="avatar" aria-hidden="true">{r.role === 'admin' ? <Shield size={17} /> : <UserRound size={17} />}</span>
            <div style={{ minWidth: 0 }}>
              <span className="mtitle" style={{ fontWeight: 650 }}>{r.displayName || r.username}</span>
              <div className="mmeta">
                <span>@{r.username}</span>
                {r.sector && <span>{r.sector}</span>}
                <span>{r.lastLoginAt ? `Último ingreso: ${formatTimestamp(r.lastLoginAt)}` : 'Nunca ingresó'}</span>
              </div>
            </div>
            <div className="mbar">
              <div className="meter-label"><span>{s.lessonsRead}/{s.lessonsTotal} lecturas · {s.practicesDone}/{s.practicesTotal} prácticas · {s.completed} módulos</span><span>{s.pct} %</span></div>
              <div className={s.pct === 100 ? 'meter ok' : 'meter'} role="progressbar" aria-valuenow={s.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance de ${r.username}`}><span style={{ width: `${s.pct}%` }} /></div>
            </div>
            <div className="mstatus row" style={{ gap: 6 }}>
              {r.role === 'admin' && <Badge tone="dark">Admin</Badge>}
              {!r.active && <Badge tone="err">Desactivado</Badge>}
              {r.mustChangePassword && r.active && <Badge tone="warn">Contraseña temporal</Badge>}
              <button type="button" className="icon-btn" onClick={() => setEditing(r)} aria-label={`Editar ${r.username}`}><Pencil aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ marginTop: 16 }}>El avance se calcula con el progreso que cada persona guardó en el servidor. Es un dato pedagógico: no es una calificación laboral.</p>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Crear usuario" wide>
        {token && <CreateUserForm token={token} onCreated={() => load()} />}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Editar @${editing.username}` : 'Editar'}>
        {editing && token && <EditUser key={editing.id} row={editing} token={token} self={editing.id === user.id}
          onSaved={(u) => { refreshUser(u); setEditing(null); void load(); }}
          onReset={() => { setResetFor(editing); setEditing(null); }}
          onDelete={() => { setDeleting(editing); setEditing(null); }} />}
      </Modal>

      <ConfirmModal open={!!resetFor} onClose={() => setResetFor(null)} title="Restablecer contraseña" confirmLabel="Generar contraseña temporal" onConfirm={doReset}>
        <p>Se generará una contraseña temporal nueva para <strong>@{resetFor?.username}</strong> y se cerrarán sus sesiones abiertas. Al ingresar deberá elegir una propia.</p>
      </ConfirmModal>
      <Modal open={!!resetDone} onClose={() => setResetDone(null)} title="Contraseña restablecida">
        {resetDone && <CredentialsNote username={resetDone.username} password={resetDone.password} />}
      </Modal>
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar usuario" confirmLabel="Eliminar definitivamente" danger
        onConfirm={async () => { if (!token || !deleting) return; try { await api.deleteUser(token, deleting.id); toast('Usuario eliminado'); void load(); } catch (e) { toast(e instanceof ApiError ? e.message : 'No se pudo eliminar'); } }}>
        <p>Se eliminará <strong>@{deleting?.username}</strong> y todo su progreso guardado. No se puede deshacer. Si solo querés impedir que ingrese, desactivalo.</p>
      </ConfirmModal>
    </>
  );
}

function EditUser({ row, token, self, onSaved, onReset, onDelete }: { row: AdminUserRow; token: string; self: boolean; onSaved: (u: AdminUserRow) => void; onReset: () => void; onDelete: () => void }) {
  const [f, setF] = useState({ displayName: row.displayName, sector: row.sector, role: row.role, active: row.active });
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try { const u = await api.updateUser(token, row.id, f); toast('Usuario actualizado'); onSaved({ ...row, ...u }); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo guardar.'); }
  };
  return (
    <div className="stack">
      <div className="form-grid">
        <Field label="Nombre para mostrar" htmlFor="eu-name"><input id="eu-name" className="input" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
        <Field label="Sector" htmlFor="eu-sector"><select id="eu-sector" className="input" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">Sin indicar</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Rol" htmlFor="eu-role"><select id="eu-role" className="input" value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as 'admin' | 'empleado' })}><option value="empleado">Equipo</option><option value="admin">Administrador</option></select></Field>
        <Field label="Estado" htmlFor="eu-active"><select id="eu-active" className="input" value={f.active ? '1' : '0'} disabled={self} onChange={(e) => setF({ ...f, active: e.target.value === '1' })}><option value="1">Activo: puede ingresar</option><option value="0">Desactivado: no puede ingresar</option></select></Field>
      </div>
      {self && <p className="small muted">Es tu propio usuario: no podés quitarte el rol de administrador ni desactivarte.</p>}
      {error && <Callout tone="err">{error}</Callout>}
      <div className="row-between">
        <button type="button" className="btn btn-primary" onClick={save}>Guardar cambios</button>
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}><KeyRound aria-hidden="true" />Restablecer contraseña</button>
          {!self && <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}><Trash2 aria-hidden="true" />Eliminar</button>}
        </div>
      </div>
    </div>
  );
}

export function AccountPage() {
  const { user, sync, lastSyncedAt } = useSession();
  if (!user) return null;
  return (
    <>
      <PageHeader eyebrow="Mi cuenta" title={user.displayName || user.username} lead={`Usuario @${user.username}${user.sector ? ` · ${user.sector}` : ''}${user.role === 'admin' ? ' · Administrador' : ''}`}>
        <button type="button" className="btn btn-secondary" onClick={() => signOut()}><LogOut aria-hidden="true" />Cerrar sesión</button>
      </PageHeader>
      <div className="grid-2">
        <section className="card">
          <h2 style={{ fontSize: '1.35rem' }}>Progreso en la nube</h2>
          <p className="row" style={{ gap: 8 }}>{sync === 'offline' || sync === 'error' ? <CloudOff aria-hidden="true" color="var(--warn)" /> : <Cloud aria-hidden="true" color="var(--ok)" />}
            {sync === 'saving' ? 'Guardando…' : sync === 'offline' ? 'Sin conexión: se guardará al reconectar.' : sync === 'error' ? 'No se pudo guardar; se reintentará.' : 'Tu progreso está guardado en el servidor.'}</p>
          <p className="small muted">Última sincronización: {formatTimestamp(lastSyncedAt)}. Podés ingresar desde cualquier teléfono o computadora con tu usuario y vas a ver el mismo avance.</p>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.35rem' }}>Cambiar contraseña</h2>
          <PasswordForm />
        </section>
      </div>
    </>
  );
}
