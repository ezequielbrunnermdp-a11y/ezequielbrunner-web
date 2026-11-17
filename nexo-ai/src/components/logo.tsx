export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-b from-surface-3 to-surface-2 ring-1 ring-inset ring-white/10 shadow-[0_0_24px_-6px_rgb(94_234_212/0.5)]">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M9 23V9l14 14V9" fill="none" stroke="#5EEAD4" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-fg">
        NEXO<span className="ml-1 font-medium text-accent">AI</span>
      </span>
    </span>
  );
}
