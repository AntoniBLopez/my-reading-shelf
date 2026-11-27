import { useEffect, useState } from 'react';
import type { ActiveToast } from '@/hooks/useBookMarks';
import { copy } from '@/lib/marks/copy';

export function MarkToast({
  toast,
  panelOpen,
  onUndo,
  onDismiss,
}: {
  toast: ActiveToast | null;
  panelOpen: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setPaused(false);
  }, [toast?.id]);

  useEffect(() => {
    if (!toast || paused) return undefined;
    const timer = window.setTimeout(onDismiss, toast.undo ? 5000 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast, paused, onDismiss]);

  if (!toast) return null;

  return (
    <div
      data-mark-ui=""
      className={`pointer-events-none absolute inset-x-0 z-50 flex justify-center px-4 sm:p-6 ${panelOpen ? 'bottom-24 pb-2 sm:justify-start' : 'bottom-0 pb-4 sm:justify-end'}`}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-[360px] items-center gap-2.5 rounded-xl bg-[#14213D] px-4 py-3 text-[15px] font-medium text-[#FBF7F1] shadow-[0_8px_24px_rgba(16,38,63,0.25)] animate-in fade-in slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {toast.color && (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: toast.color }} aria-hidden />
        )}
        <span className="min-w-0 truncate">{toast.text}</span>
        {toast.undo && (
          <button
            type="button"
            className="min-h-10 shrink-0 px-2 font-semibold text-[#F2B53A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2B53A]"
            onClick={onUndo}
          >
            {copy.undo}
          </button>
        )}
      </div>
    </div>
  );
}
