import { useAuth } from '@/auth/AuthProvider';
import { useSignedUrl } from '@/lib/storage';

/** Marca: usa el logo oficial cuando se cargue (bucket "branding"); si no, un monograma sobrio. */
export function BrandMark({ compact }: { compact?: boolean }) {
  const { ctx } = useAuth();
  const emp = ctx?.employments[0];
  const logoPath = emp?.brand_logo || ctx?.organization?.logo_path;
  const { data: logo } = useSignedUrl('branding', logoPath);
  const name = emp?.brand || ctx?.organization?.name || 'Equipo';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logo ? (
        <img src={logo} alt={name} className="h-8 w-8 rounded-lg object-contain" />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent text-[13px] font-bold tracking-tight text-accent-ink" aria-hidden>
          {name.replace(/^(El|La|Los|Las)\s+/i, '').slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[14px] font-semibold tracking-tight">{name}</p>
        {!compact && <p className="truncate text-2xs text-ink-3">Portal del equipo</p>}
      </div>
    </div>
  );
}
