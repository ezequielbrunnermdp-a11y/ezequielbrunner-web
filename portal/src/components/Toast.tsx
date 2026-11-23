import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cx } from './ui';

type Tone = 'ok' | 'bad' | 'info';
interface T { id: number; tone: Tone; text: string }
const Ctx = createContext<(text: string, tone?: Tone) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), tone === 'bad' ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-pop animate-sheet-in',
            t.tone === 'bad' ? 'bg-bad text-white' : 'bg-ink text-bg')}>
            {t.tone === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : t.tone === 'bad' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Info className="h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
