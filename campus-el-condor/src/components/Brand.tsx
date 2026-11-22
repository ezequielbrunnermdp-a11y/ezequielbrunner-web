import { useState } from 'react';
import { BRAND } from '../brand.config';

/** Logo oficial si está configurado; si falta o no carga, el nombre en texto. */
export function Brand({ onDark = false, href = '#/', tag }: { onDark?: boolean; href?: string; tag?: string }) {
  const src = (onDark ? BRAND.logoOnDark : null) ?? BRAND.logo;
  const [failed, setFailed] = useState(false);
  return (
    <a className="brand" href={href} aria-label={`${BRAND.fullName} · ${BRAND.subtitle} · Inicio`}>
      {src && !failed ? (
        <img className="brand-logo" src={src} alt={BRAND.logoAlt} width={420} height={385} onError={() => setFailed(true)} />
      ) : (
        <span className="brand-text">
          <span className="brand-name">{BRAND.name}</span>
          <span className="brand-sub">{BRAND.subtitle}</span>
        </span>
      )}
      {tag && src && !failed && <span className="topbar-tag">{tag}</span>}
    </a>
  );
}

/** Logo grande para portadas. */
export function BrandLarge({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = BRAND.logoLarge ?? BRAND.logo;
  if (!src || failed) return <p className="brand-name" style={{ fontSize: '2.2rem', color: 'var(--bronze-light)' }}>{BRAND.name}</p>;
  return <img className={className} src={src} alt={BRAND.logoAlt} width={832} height={762} onError={() => setFailed(true)} />;
}
