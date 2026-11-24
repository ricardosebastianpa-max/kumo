"use client";
import { authClient } from "@/lib/auth-client";
export function SignOut({ label }: { label: string }) {
  return <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-paper-2"
    onClick={async () => { await authClient.signOut(); window.location.href = "/"; }}>{label}</button>;
}
