/* Ilustraciones SVG originales del campus: taza, vapor, cuaderno y escenas. */

export function HeroCup({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 300 280" role="img" aria-label="Ilustración de una taza de café con vapor">
      <defs>
        <linearGradient id="cupG" x1="0" x2="1">
          <stop offset="0" stopColor="#f6f2ea" />
          <stop offset="1" stopColor="#e6dccb" />
        </linearGradient>
      </defs>
      <circle cx="150" cy="150" r="118" fill="#2b241f" />
      <circle cx="150" cy="150" r="118" fill="none" stroke="#a77c49" strokeOpacity="0.5" strokeDasharray="2 7" />
      <g fill="none" stroke="#c9a273" strokeWidth="5" strokeLinecap="round">
        <path className="steam" d="M122 104c-12-14 10-22-2-38" />
        <path className="steam s2" d="M150 98c-12-14 10-22-2-40" />
        <path className="steam s3" d="M178 104c-12-14 10-22-2-38" />
      </g>
      <ellipse cx="150" cy="222" rx="96" ry="14" fill="#a77c49" opacity="0.55" />
      <ellipse cx="150" cy="216" rx="86" ry="11" fill="#c9a273" />
      <path d="M86 128h128v34c0 36-28 58-64 58s-64-22-64-58z" fill="url(#cupG)" />
      <path d="M214 138h10a22 22 0 0 1 0 44h-16" fill="none" stroke="#e6dccb" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="150" cy="128" rx="64" ry="11" fill="#6b4a2b" />
      <ellipse cx="150" cy="127" rx="52" ry="7" fill="#8a6038" />
      <path d="M118 158c10 8 54 8 64 0" fill="none" stroke="#a77c49" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyCup({ className = 'empty-art' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true">
      <ellipse cx="60" cy="80" rx="44" ry="6" fill="#e1d7c6" />
      <path d="M30 34h56v14c0 16-12 26-28 26S30 64 30 48z" fill="#fffdf9" stroke="#a77c49" strokeWidth="2" />
      <path d="M86 40h5a9 9 0 0 1 0 18h-7" fill="none" stroke="#a77c49" strokeWidth="2" />
      <g fill="none" stroke="#c9a273" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4">
        <path d="M48 26c-5-6 5-9 0-16" /><path d="M62 24c-5-6 5-9 0-16" />
      </g>
    </svg>
  );
}

export function EmptyBook({ className = 'empty-art' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true">
      <ellipse cx="60" cy="82" rx="46" ry="5" fill="#e1d7c6" />
      <path d="M18 18c14-4 28-2 42 6v54c-14-8-28-10-42-6z" fill="#fffdf9" stroke="#a77c49" strokeWidth="2" />
      <path d="M102 18c-14-4-28-2-42 6v54c14-8 28-10 42-6z" fill="#f3e9da" stroke="#a77c49" strokeWidth="2" />
      <g stroke="#cdbfa8" strokeWidth="2" strokeLinecap="round"><path d="M28 32h22M28 42h22M28 52h16M70 32h22M70 42h22" /></g>
    </svg>
  );
}

export function EmptyTag({ className = 'empty-art' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" aria-hidden="true">
      <ellipse cx="60" cy="82" rx="40" ry="5" fill="#e1d7c6" />
      <path d="M30 20h40l24 24-34 34-30-30z" fill="#fffdf9" stroke="#a77c49" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="48" cy="36" r="6" fill="none" stroke="#a77c49" strokeWidth="2" />
      <path d="M58 56l14-14M58 42h.01M72 56h.01" stroke="#c9a273" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function VideoPendingArt() {
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      <rect x="14" y="14" width="76" height="52" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M90 32l18-10v36l-18-10z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M44 30v20l16-10z" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

export interface HazardDef { id: string; zone: string; label: string; detail: string; action: string; cx: number; cy: number; r: number }

export const HAZARDS: HazardDef[] = [
  { id: 'vajilla', zone: 'Mesada con tazas', label: 'Vajilla sucia mezclada con limpia', detail: 'Sobre la mesada, tazas usadas quedaron junto a la pila de tazas limpias.', action: 'Separar lo sucio de lo limpio y llevar la vajilla usada al sector de lavado. Volver a verificar lo que estuvo en contacto.', cx: 150, cy: 118, r: 52 },
  { id: 'paso', zone: 'Pasillo de circulación', label: 'Paso obstruido', detail: 'Una caja de mercadería quedó en el medio del pasillo de circulación.', action: 'Despejar el paso y ubicar la caja en su lugar asignado; si pesa demasiado, pedir ayuda.', cx: 345, cy: 250, r: 48 },
  { id: 'derrame', zone: 'Piso junto a la barra', label: 'Derrame sin señalizar', detail: 'Hay líquido en el piso junto a la barra, sin ningún aviso.', action: 'Señalizar el área enseguida y limpiar según el procedimiento.', cx: 540, cy: 268, r: 50 },
  { id: 'rotulo', zone: 'Heladera', label: 'Producto sin identificación', detail: 'Un recipiente con preparación en la heladera no tiene rótulo.', action: 'Separarlo del servicio y avisar al responsable para que defina su destino.', cx: 640, cy: 112, r: 44 },
];

/** Escena original de un sector de barra con cuatro riesgos. Cada riesgo es un control accesible. */
export function HazardScene({ found, onFind }: { found: string[]; onFind: (id: string) => void }) {
  return (
    <svg viewBox="0 0 720 320" role="group" aria-label="Escena de la barra con riesgos para identificar">
      {/* pared y piso */}
      <rect width="720" height="320" fill="#f3ece0" />
      <rect y="210" width="720" height="110" fill="#e4d8c4" />
      <path d="M0 210h720" stroke="#cdbfa8" strokeWidth="2" />
      {/* estantes */}
      <rect x="40" y="40" width="200" height="8" rx="3" fill="#a77c49" />
      <g fill="#fffdf9" stroke="#8c8174" strokeWidth="1.5">
        <rect x="56" y="20" width="22" height="20" rx="3" /><rect x="88" y="16" width="22" height="24" rx="3" /><rect x="120" y="22" width="22" height="18" rx="3" />
      </g>
      {/* mesada */}
      <rect x="30" y="150" width="300" height="16" rx="4" fill="#6b4a2b" />
      <rect x="40" y="166" width="280" height="44" fill="#8a6038" />
      {/* tazas limpias */}
      <g fill="#fffdf9" stroke="#8c8174" strokeWidth="1.5">
        <path d="M70 128h30v14a15 15 0 0 1-30 0z" /><path d="M70 112h30v14a15 15 0 0 1-30 0z" />
        <path d="M110 128h30v14a15 15 0 0 1-30 0z" />
      </g>
      {/* tazas sucias */}
      <g fill="#fffdf9" stroke="#8c8174" strokeWidth="1.5">
        <path d="M150 128h30v14a15 15 0 0 1-30 0z" /><path d="M190 128h30v14a15 15 0 0 1-30 0z" />
      </g>
      <g fill="#6b4a2b"><ellipse cx="165" cy="131" rx="12" ry="3" /><ellipse cx="205" cy="131" rx="12" ry="3" /></g>
      <path d="M158 140c2 4 6 6 10 3M198 142c3 3 7 3 9 0" stroke="#8a6038" strokeWidth="2" fill="none" />
      {/* cafetera */}
      <rect x="240" y="96" width="70" height="54" rx="6" fill="#3a312a" />
      <rect x="252" y="106" width="46" height="10" rx="3" fill="#c9a273" />
      {/* caja en el paso */}
      <g>
        <rect x="308" y="222" width="76" height="56" rx="3" fill="#c9a273" stroke="#7a5426" strokeWidth="2" />
        <path d="M308 236h76M346 222v14" stroke="#7a5426" strokeWidth="2" />
      </g>
      <path d="M260 300c40-6 120-6 220 0" stroke="#cdbfa8" strokeWidth="2" strokeDasharray="8 8" fill="none" />
      {/* barra y derrame */}
      <rect x="440" y="150" width="240" height="16" rx="4" fill="#6b4a2b" />
      <rect x="450" y="166" width="220" height="44" fill="#8a6038" />
      <path d="M500 262c10-14 40-16 64-8 20 7 34 4 44 14 6 8-18 16-52 14-34-1-64-6-56-20z" fill="#9fc2d4" opacity="0.85" />
      <path d="M548 186l-6 40" stroke="#9fc2d4" strokeWidth="3" strokeLinecap="round" />
      <path d="M560 140l-10 10h20z" fill="#9fc2d4" />
      <rect x="548" y="122" width="16" height="18" rx="3" fill="#fffdf9" stroke="#8c8174" strokeWidth="1.5" transform="rotate(-30 556 131)" />
      {/* heladera */}
      <rect x="590" y="40" width="110" height="110" rx="8" fill="#fffdf9" stroke="#8c8174" strokeWidth="2" />
      <path d="M590 84h110" stroke="#cdbfa8" strokeWidth="2" />
      <rect x="604" y="56" width="26" height="22" rx="3" fill="#e8f1e4" stroke="#8c8174" />
      <rect x="607" y="60" width="20" height="6" fill="#fffdf9" />
      <rect x="624" y="98" width="34" height="30" rx="4" fill="#f1dfc2" stroke="#8c8174" />
      <rect x="664" y="100" width="24" height="28" rx="4" fill="#e8f1e4" stroke="#8c8174" />
      <rect x="667" y="106" width="18" height="6" fill="#fffdf9" />
      {HAZARDS.map((h) => {
        const isFound = found.includes(h.id);
        return (
          <g key={h.id} className={`hazard-hit${isFound ? ' found' : ''}`} role="button" tabIndex={0}
            aria-label={isFound ? `${h.zone}: ${h.label} (identificado)` : `Revisar zona: ${h.zone}`} aria-pressed={isFound}
            onClick={() => onFind(h.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFind(h.id); } }}>
            <circle className="hit-ring" cx={h.cx} cy={h.cy} r={h.r} />
            {isFound && (
              <g>
                <circle cx={h.cx + h.r * 0.7} cy={h.cy - h.r * 0.7} r="13" fill="#286140" />
                <path d={`M${h.cx + h.r * 0.7 - 6} ${h.cy - h.r * 0.7}l4 4 8-8`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
