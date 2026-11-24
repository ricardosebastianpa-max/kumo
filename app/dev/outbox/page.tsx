import { notFound } from "next/navigation";
import { outbox } from "@/lib/email";

export const dynamic = "force-dynamic";
/** Development-only mail viewer: exists only when no email provider is configured. */
export default function Outbox() {
  if (process.env.NODE_ENV === "production" && process.env.KUMO_ALLOW_OUTBOX !== "1") notFound();
  if (process.env.RESEND_API_KEY) notFound();
  return (
    <main id="main" className="mx-auto grid max-w-2xl gap-4 p-6">
      <h1 className="text-3xl">Outbox (dev)</h1>
      {outbox.length === 0 ? <p className="text-mute">Empty.</p> : outbox.map((m, i) => (
        <article key={i} className="grid gap-2 rounded-2xl border border-line bg-card p-4" data-testid="mail">
          <p className="text-sm text-mute">{m.at} · {m.to}</p>
          <h2 className="text-xl">{m.subject}</h2>
          {[...m.text.matchAll(/https?:\/\/\S+/g)].map(([u]) => <a key={u} href={u} className="break-all font-medium underline" data-testid="mail-link">{u}</a>)}
        </article>
      ))}
    </main>
  );
}
