import { useEffect } from 'react';

/**
 * Branded splash shown right after a successful sign-in, before the
 * dashboard is revealed.
 */
export function SplashScreen({
  name,
  duration = 1600,
  onDone,
}: {
  name?: string | null;
  duration?: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink text-paper animate-[fadeIn_.3s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="h-14 w-14 rounded-2xl bg-gold-400 flex items-center justify-center text-ink text-2xl font-bold animate-pulse">
          P
        </span>
        <span className="font-serif text-3xl">Product Manager</span>
      </div>
      <p className="mt-4 text-paper/70 text-sm">
        {name ? `Welcome back, ${name}` : 'Welcome back'} — preparing your dashboard…
      </p>
      <div className="mt-8 h-1 w-56 overflow-hidden rounded-full bg-paper/15">
        <div className="h-full w-1/3 rounded-full bg-gold-300 animate-[splashBar_1.4s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes splashBar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(340%); }
        }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}
