import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BookOpen, ClipboardList, Film, GraduationCap, Home, Info, Library, Menu, Search, Settings, TrendingUp, UserRound, Users } from 'lucide-react';
import { useRoute, type Route } from './router';
import { Brand } from '../components/Brand';
import { Modal, Toasts } from '../components/ui';
import { HomePage } from '../features/home/HomePage';
import { ModuleList, ModulePage } from '../features/learn/LearnPages';
import { PrintPage } from '../features/learn/PrintPage';
import { EvaluationHub, QuizPage } from '../features/quiz/QuizPages';
import { CasePage, CasesList, FacilitatorPage } from '../features/practice/CasesPages';
import { ConsultHub } from '../features/consult/ConsultHub';
import { ProgressPage } from '../features/progress/ProgressPage';
import { VideosPage } from '../features/videos/VideosPage';
import { ManagePage } from '../features/manage/ManagePage';
import { ProfilesPage } from '../features/profiles/ProfilesPage';
import { AboutPage } from '../features/about/AboutPage';
import { profileName, store, useActiveProfile } from '../storage/store';
import { PageHeader } from '../components/ui';

const PRIMARY = [
  { href: '#/', section: '', label: 'Inicio', Icon: Home },
  { href: '#/aprender', section: 'aprender', label: 'Aprender', Icon: BookOpen },
  { href: '#/consultar', section: 'consultar', label: 'Consultar', Icon: Search },
  { href: '#/progreso', section: 'progreso', label: 'Progreso', Icon: TrendingUp },
];
const PRACTICE = [
  { href: '#/casos', section: 'casos', label: 'Casos', Icon: ClipboardList },
  { href: '#/evaluacion', section: 'evaluacion', label: 'Evaluaciones', Icon: GraduationCap },
  { href: '#/videos', section: 'videos', label: 'Videos', Icon: Film },
  { href: '#/consultar/biblioteca', section: 'biblioteca', label: 'Biblioteca', Icon: Library },
];
const TOOLS = [
  { href: '#/facilitador', section: 'facilitador', label: 'Modo facilitador', Icon: Users },
  { href: '#/gestionar', section: 'gestionar', label: 'Gestionar contenido', Icon: Settings },
  { href: '#/perfiles', section: 'perfiles', label: 'Perfiles locales', Icon: UserRound },
  { href: '#/acerca', section: 'acerca', label: 'Acerca y límites', Icon: Info },
];

function currentSection(r: Route) {
  if (r.path[0] === 'consultar' && r.path[1] === 'biblioteca') return 'biblioteca';
  if (r.path[0] === 'imprimir') return 'aprender';
  return r.path[0] ?? '';
}

const TITLES: Record<string, string> = { '': 'Inicio', aprender: 'Aprender', consultar: 'Consultar', progreso: 'Progreso', casos: 'Casos', evaluacion: 'Evaluaciones', videos: 'Videos', biblioteca: 'Biblioteca', facilitador: 'Modo facilitador', gestionar: 'Gestionar contenido', perfiles: 'Perfiles', acerca: 'Acerca' };

function Page({ r }: { r: Route }) {
  const [a, b] = r.path;
  switch (a) {
    case undefined: return <HomePage />;
    case 'aprender': return b ? <ModulePage key={b} id={b} focus={r.query.get('l')} /> : <ModuleList />;
    case 'imprimir': return <PrintPage id={b ?? ''} />;
    case 'evaluacion': return b ? <QuizPage key={b} quizKey={b} resultId={r.query.get('r')} reviewOnly={r.query.get('errores') === '1'} /> : <EvaluationHub />;
    case 'casos': return b ? <CasePage key={b} id={b} /> : <CasesList />;
    case 'facilitador': return <FacilitatorPage moduleFilter={r.query.get('m')} index={Number(r.query.get('i') ?? 0) || 0} />;
    case 'consultar': return <ConsultHub section={b ?? ''} query={r.query} />;
    case 'progreso': return <ProgressPage />;
    case 'videos': return <VideosPage focus={r.query.get('v')} />;
    case 'gestionar': return <ManagePage tab={r.query.get('t') ?? 'textos'} />;
    case 'perfiles': return <ProfilesPage />;
    case 'acerca': return <AboutPage />;
    default: return <PageHeader title="Sección no encontrada" lead={<>La dirección no corresponde a ninguna sección. <a href="#/">Volver al inicio</a>.</>} />;
  }
}

/** Conserva el punto de lectura de cada pantalla al volver a ella. */
function useScrollMemory(r: Route) {
  const key = r.path.join('/');
  const prev = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (prev.current !== null && prev.current !== key) {
      try { sessionStorage.setItem(`scroll:${prev.current}`, String(lastY.current)); } catch { /* sin acceso */ }
    }
    prev.current = key;
    if (r.query.get('l') || r.query.get('v')) return; // la propia pantalla lleva a la sección pedida
    let y = 0;
    try { y = Number(sessionStorage.getItem(`scroll:${key}`) ?? 0); } catch { /* sin acceso */ }
    window.scrollTo(0, y);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastY = useRef(0);
  useEffect(() => {
    const on = () => { lastY.current = window.scrollY; };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
}

export function App() {
  const r = useRoute();
  const section = currentSection(r);
  const profile = useActiveProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  useScrollMemory(r);

  useEffect(() => {
    document.title = `${TITLES[section] ?? 'Campus'} · El Cóndor · Campus de formación`;
    setMenuOpen(false);
    if (firstRender.current) { firstRender.current = false; return; }
    if (!r.query.get('l')) mainRef.current?.focus({ preventScroll: true });
  }, [r.path.join('/')]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = (it: (typeof PRIMARY)[number]) => (
    <a key={it.href} className="nav-link" href={it.href} aria-current={section === it.section ? 'page' : undefined}><it.Icon aria-hidden="true" />{it.label}</a>
  );
  const profiles = store.get().profiles;
  const idx = profiles.findIndex((p) => p.id === profile.id);

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>Saltar al contenido</a>
      <aside className="sidebar" aria-label="Navegación principal">
        <Brand onDark />
        <nav aria-label="Secciones">
          <div className="nav-group">{PRIMARY.map(link)}</div>
          <div className="nav-group"><div className="nav-group-label">Practicar</div>{PRACTICE.map(link)}</div>
          <div className="nav-group"><div className="nav-group-label">Herramientas</div>{TOOLS.map(link)}</div>
        </nav>
        <div className="sidebar-foot">
          <a className="sidebar-profile" href="#/perfiles" style={{ textDecoration: 'none' }}>
            <span className="avatar" aria-hidden="true"><UserRound size={16} /></span>
            <span><span style={{ display: 'block', fontWeight: 600 }}>{profileName(profile, idx)}</span><span className="small" style={{ color: '#bdb3a8' }}>Perfil local · cambiar</span></span>
          </a>
          Progreso guardado solo en este navegador.
        </div>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <Brand />
          <a className="icon-btn" href="#/perfiles" aria-label={`Perfil local: ${profileName(profile, idx)}`}><UserRound aria-hidden="true" /></a>
        </header>
        <main id="contenido" ref={mainRef} className="main" tabIndex={-1} style={{ outline: 'none' }}>
          <Page r={r} />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {PRIMARY.map((it) => (
          <a key={it.href} href={it.href} aria-current={section === it.section ? 'page' : undefined}><it.Icon aria-hidden="true" />{it.label}</a>
        ))}
        <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen}
          aria-current={[...PRACTICE, ...TOOLS].some((x) => x.section === section) ? 'page' : undefined}><Menu aria-hidden="true" />Más</button>
      </nav>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Más funciones" sheet>
        <nav className="menu-list" aria-label="Más funciones">
          <p className="nav-group-label" style={{ color: 'var(--muted)', padding: '0 12px' }}>Practicar</p>
          {PRACTICE.map((it) => <a key={it.href} href={it.href} aria-current={section === it.section ? 'page' : undefined} onClick={() => setMenuOpen(false)}><it.Icon aria-hidden="true" />{it.label}</a>)}
          <p className="nav-group-label" style={{ color: 'var(--muted)', padding: '8px 12px 0' }}>Herramientas</p>
          {TOOLS.map((it) => <a key={it.href} href={it.href} aria-current={section === it.section ? 'page' : undefined} onClick={() => setMenuOpen(false)}><it.Icon aria-hidden="true" />{it.label}</a>)}
        </nav>
      </Modal>
      <Toasts />
    </div>
  );
}
