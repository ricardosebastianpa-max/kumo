"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStage } from "@/app/actions/list";

export function PursueButton({ kind, refId, pursuing, label, done }: { kind: "institution" | "scholarship"; refId: string; pursuing: boolean; label: string; done: string }) {
  const [on, setOn] = useOptimistic(pursuing);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" aria-pressed={on} onClick={() => start(async () => { setOn(!on); await setStage(kind, refId, on ? "shortlist" : "pursuing"); router.refresh(); })}
      className={`min-h-11 rounded-xl px-4 font-semibold transition-colors ${on ? "bg-[var(--lacquer)] text-white" : "border border-line bg-card hover:bg-paper-2"}`}>
      {on ? `✓ ${done}` : label}
    </button>
  );
}
