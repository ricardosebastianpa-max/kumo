"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Kumo } from "@/components/kumo";
import { Button, inputCls } from "@/components/ui";
import { Suspense } from "react";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("La contraseña necesita al menos 8 caracteres.");
    if (pw !== pw2) return setErr("Las dos contraseñas no coinciden.");
    setErr(null); setState("busy");
    const r = await authClient.resetPassword({ newPassword: pw, token });
    if (r.error) { setErr("El enlace venció o ya se usó. Pide uno nuevo."); setState("idle"); return; }
    setState("done");
  };
  if (state === "done") return (<div className="grid gap-4" role="status"><Kumo state="celebrating" size={110} /><h1 className="text-3xl">Listo, ya tienes contraseña nueva</h1><a href="/login" className="btn3d w-fit rounded-2xl bg-brand px-5 py-3 font-extrabold text-brand-ink [--edge:var(--brand-deep)]">Entrar</a></div>);
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Kumo state="awake" size={96} />
      <h1 className="text-3xl">Elige una contraseña nueva</h1>
      {!token && <p role="alert" className="text-[var(--lacquer)]">Falta el código del enlace. Abre el enlace completo.</p>}
      <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Contraseña nueva" aria-label="Contraseña nueva" className={inputCls} />
      <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repítela" aria-label="Repite la contraseña" className={inputCls} />
      {err && <p role="alert" className="text-[var(--lacquer)]">{err}</p>}
      <Button type="submit" size="lg" disabled={state === "busy" || !token}>Guardar contraseña</Button>
    </form>
  );
}
export default function ResetPassword() {
  return <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center px-4 py-10"><Suspense><Form /></Suspense></main>;
}
