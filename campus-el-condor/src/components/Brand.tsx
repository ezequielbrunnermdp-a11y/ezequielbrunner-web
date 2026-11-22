import { useState } from 'react';
import { BRAND } from '../brand.config';

/** Logo oficial si está configurado; si falta o no carga, el nombre en texto. */
export function Brand({ onDark = false, href = '#/' }: { onDark?: boolean; href?: string }) {
  const src = (onDark ? BRAND.logoOnDark : null) ?? BRAND.logo;
  const [failed, setFailed] = useState(false);
  return (
    <a className="brand" href={href} aria-label={`${BRAND.fullName} · ${BRAND.subtitle} · Inicio`}>
      {src && !failed ? (
        <img className="brand-logo" src={src} alt={BRAND.logoAlt} onError={() => setFailed(true)} />
      ) : (
        <span className="brand-text">
          <span className="brand-name">{BRAND.name}</span>
          <span className="brand-sub">{BRAND.subtitle}</span>
        </span>
      )}
    </a>
  );
}
