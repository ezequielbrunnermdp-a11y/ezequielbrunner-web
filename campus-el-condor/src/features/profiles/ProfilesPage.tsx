import { useState } from 'react';
import { Check, Plus, Trash2, UserRound } from 'lucide-react';
import { Badge, Callout, ConfirmModal, Field, PageHeader, toast } from '../../components/ui';
import { profileName, store, useStore } from '../../storage/store';
import { overallStats } from '../../lib/learning';
import { formatTimestamp } from '../../lib/format';
import type { Profile } from '../../storage/schema';

const SECTORS = ['Salón', 'Recepción', 'Barra', 'Cocina', 'Caja', 'Encargado/a'];

export function ProfilesPage() {
  const profiles = useStore((s) => s.profiles);
  const activeId = useStore((s) => s.activeId);
  const [alias, setAlias] = useState('');
  const [sector, setSector] = useState('');
  const [toDelete, setToDelete] = useState<Profile | null>(null);
  const active = profiles.find((p) => p.id === activeId)!;
  const [editAlias, setEditAlias] = useState(active.alias);
  const [editSector, setEditSector] = useState(active.sector);

  return (
    <>
      <PageHeader eyebrow="Perfiles locales" title="¿Quién usa este dispositivo?" lead="Si varias personas comparten un teléfono o una tablet, cada una puede tener su propio perfil. El progreso de cada perfil se guarda por separado." />
      <Callout tone="info" title="Datos opcionales y locales">El alias y el sector son opcionales. No pedimos DNI ni datos personales. Un perfil no es una cuenta: no tiene contraseña y no se sincroniza. La etiqueta “Encargado/a” no otorga permisos.</Callout>

      <section className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.4rem' }}>Perfil activo</h2>
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); store.updateProfile(active.id, { alias: editAlias.trim(), sector: editSector }); toast('Perfil actualizado'); }}>
          <Field label="Alias (opcional)" htmlFor="pa-alias"><input id="pa-alias" className="input" value={editAlias} onChange={(e) => setEditAlias(e.target.value)} maxLength={40} /></Field>
          <Field label="Sector (opcional)" htmlFor="pa-sector">
            <select id="pa-sector" className="input" value={editSector} onChange={(e) => setEditSector(e.target.value)}><option value="">Sin indicar</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <div className="full"><button type="submit" className="btn btn-primary"><Check aria-hidden="true" />Guardar cambios</button></div>
        </form>
      </section>

      <section className="section">
        <h2>Perfiles en este dispositivo</h2>
        <ul className="list-plain">
          {profiles.map((p, i) => {
            const st = overallStats(store.readProgressOf(p.id));
            const isActive = p.id === activeId;
            return (
              <li key={p.id} className="card-flat row-between">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <span className="avatar" aria-hidden="true"><UserRound size={18} /></span>
                  <div>
                    <strong>{profileName(p, i)}</strong> {isActive && <Badge tone="dark">Activo</Badge>}
                    <div className="small muted">{p.sector || 'Sector sin indicar'} · {st.lessonsRead} lecturas · {st.completed} módulos completados · creado {formatTimestamp(p.createdAt)}</div>
                  </div>
                </div>
                <div className="row">
                  {!isActive && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { store.switchProfile(p.id); toast(`Perfil activo: ${profileName(p, i)}`); }}>Usar este perfil</button>}
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setToDelete(p)} aria-label={`Eliminar ${profileName(p, i)}`}><Trash2 aria-hidden="true" />Eliminar</button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.4rem' }}>Crear un perfil</h2>
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); const p = store.createProfile(alias, sector); setAlias(''); setSector(''); setEditAlias(p.alias); setEditSector(p.sector); toast('Perfil creado y activado'); }}>
          <Field label="Alias (opcional)" htmlFor="np-alias" hint="Por ejemplo, tu nombre de pila o un apodo."><input id="np-alias" className="input" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} /></Field>
          <Field label="Sector (opcional)" htmlFor="np-sector">
            <select id="np-sector" className="input" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">Sin indicar</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <div className="full"><button type="submit" className="btn btn-primary"><Plus aria-hidden="true" />Crear y usar</button></div>
        </form>
      </section>

      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar perfil" confirmLabel="Eliminar definitivamente" danger
        onConfirm={() => { if (toDelete) { store.deleteProfile(toDelete.id); const a = store.get().profiles.find((p) => p.id === store.get().activeId); setEditAlias(a?.alias ?? ''); setEditSector(a?.sector ?? ''); toast('Perfil eliminado'); } }}>
        <p>Vas a eliminar <strong>{toDelete ? profileName(toDelete) : ''}</strong> y todo su progreso en este dispositivo: lecturas, prácticas, evaluaciones, favoritos y plan de repaso.</p>
        <p>No se puede deshacer. Si querés conservarlo, activá ese perfil y exportá un respaldo desde Progreso antes de eliminarlo.</p>
      </ConfirmModal>
    </>
  );
}
