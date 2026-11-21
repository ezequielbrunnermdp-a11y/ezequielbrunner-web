import { useSession } from '../lib/session';
import { cx } from './ui';

/** Marca de la plataforma. Si no hay logotipo oficial cargado se muestra solo el nombre (no se inventa un logo). */
export function BrandMark({ compact, light, className }: { compact?: boolean; light?: boolean; className?: string }) {
  const { brand, logoUrl } = useSession();
  const [main, rest] = brand.platform_name.split('|').map((s) => s.trim());
  return (
    <div className={cx('flex items-center gap-3', className)}>
      {logoUrl && <img src={logoUrl} alt={brand.company_name} className={cx('w-auto object-contain', compact ? 'h-9' : 'h-12')} />}
      <div className="leading-tight">
        <div className={cx('font-serif font-semibold tracking-[0.08em]', compact ? 'text-lg' : 'text-2xl', light ? 'text-crema-50' : 'text-cafe-900')}>{main}</div>
        {rest && <div className={cx('text-[10px] font-semibold uppercase tracking-[0.24em]', light ? 'text-oro-300' : 'text-brand-accent')}>{rest}</div>}
      </div>
    </div>
  );
}
