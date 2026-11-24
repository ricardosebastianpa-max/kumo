"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { id: number; text: string; action?: { label: string; run: () => void } };
const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** One calm toast at a time, bottom-center above the mobile bar; announced politely. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: Omit<Toast, "id">) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.action ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
        {toast && (
          <div key={toast.id} className="enter pointer-events-auto flex items-center gap-3 rounded-2xl bg-brand px-4 py-3 text-brand-ink shadow-[var(--shadow-2)]">
            <span className="font-medium">{toast.text}</span>
            {toast.action && <button type="button" className="min-h-10 rounded-lg px-3 font-medium underline underline-offset-4" onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
