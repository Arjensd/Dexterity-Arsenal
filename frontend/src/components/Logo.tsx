export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6C3AED" /><stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <path d="M8 6h14c11 0 18 7 18 18s-7 18-18 18H8" stroke="url(#lg)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 15v18M17 15h5c5 0 8 3.4 8 9s-3 9-8 9h-5" stroke="url(#lg)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-[1.05]">
        <div className="text-[17px] font-bold text-ink-900">Dexterity</div>
        <div className="text-[17px] font-bold text-ink-900">Arsenal</div>
        <div className="mt-1 h-[3px] w-7 rounded-full bg-primary" />
      </div>
    </div>
  );
}
