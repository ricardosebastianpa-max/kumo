import type { Metadata } from "next";
import { Kumo, type KumoState } from "@/components/kumo";
import { Button, Card, CategoryChip, ConfidenceBadge, Field, inputCls } from "@/components/ui";

export const metadata: Metadata = { title: "Design system" };

const COLORS = ["paper", "paper-2", "card", "ink", "ink-2", "mute", "line", "lacquer", "lacquer-soft", "cat-dream", "cat-reach", "cat-target", "cat-safety", "conf-confirmed", "conf-estimated", "conf-unverified"];
const STATES: KumoState[] = ["awake", "focused", "cheering", "celebrating", "resting"];
const MOTION = [["--dur-in", "220ms ease-out (enter)"], ["--dur-out", "160ms ease-in (exit)"], ["--spring", "celebrations only"]];

/** Living design system. Every screen is built from these pieces; dark mode follows the OS. */
export default function Design() {
  return (
    <main id="main" className="mx-auto grid max-w-5xl gap-12 px-4 py-10 sm:px-6">
      <header className="grid gap-2">
        <p className="text-sm font-medium text-[var(--lacquer)]">Kumo</p>
        <h1 className="text-5xl">Design system</h1>
        <p className="max-w-[60ch] text-lg text-ink-2">Warm paper, deep ink, one lacquer accent. Calm by default; colour carries meaning, never decoration.</p>
      </header>

      <section className="grid gap-4"><h2 className="text-3xl">Colour tokens</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map((c) => (
            <div key={c} className="overflow-hidden rounded-2xl border border-line bg-card">
              <div className="h-16" style={{ background: `var(--${c})` }} />
              <p className="p-3 font-mono text-xs">--{c}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4"><h2 className="text-3xl">Type</h2>
        <Card className="grid gap-3 p-6">
          <p className="font-display text-5xl leading-none">Fraunces display</p>
          <p className="font-display text-3xl">Headings carry warmth</p>
          <p className="text-lg">Geist for interface text: calm, legible, neutral. 16px minimum body size.</p>
          <p className="text-sm text-mute">Secondary text uses --mute and still passes WCAG AA on paper.</p>
        </Card>
      </section>

      <section className="grid gap-4"><h2 className="text-3xl">Kumo states</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STATES.map((s) => <Card key={s} className="grid justify-items-center gap-2 p-4"><Kumo state={s} size={110} className="text-ink" /><p className="text-sm font-medium">{s}</p></Card>)}
        </div>
      </section>

      <section className="grid gap-4"><h2 className="text-3xl">Controls</h2>
        <Card className="grid gap-6 p-6">
          <div className="flex flex-wrap gap-3"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Remove</Button><Button disabled>Disabled</Button></div>
          <div className="flex flex-wrap gap-3"><Button size="lg">Empezar</Button></div>
          <div className="grid max-w-sm gap-4">
            <Field id="d1" label="Email" hint="We never share it."><input id="d1" className={inputCls} placeholder="tu@correo.com" /></Field>
            <Field id="d2" label="With error" error="Escribe un correo válido."><input id="d2" className={inputCls} aria-invalid defaultValue="ricardo@" /></Field>
          </div>
        </Card>
      </section>

      <section className="grid gap-4"><h2 className="text-3xl">Meaning chips</h2>
        <Card className="grid gap-4 p-6">
          <div className="flex flex-wrap gap-2"><ConfidenceBadge level="confirmed" label="Confirmado" /><ConfidenceBadge level="estimated" label="Estimado" /><ConfidenceBadge level="unverified" label="Por verificar" /></div>
          <div className="flex flex-wrap gap-2"><CategoryChip category="dream" label="Sueño" /><CategoryChip category="reach" label="Reach" /><CategoryChip category="target" label="Target" /><CategoryChip category="safety" label="Safety" /></div>
          <p className="text-sm text-mute">Confidence uses shape + label (solid, dashed, triangle), never colour alone.</p>
        </Card>
      </section>

      <section className="grid gap-4"><h2 className="text-3xl">Motion</h2>
        <Card className="grid gap-2 p-6">{MOTION.map(([k, v]) => <p key={k}><code className="font-mono text-sm">{k}</code> <span className="text-ink-2">{v}</span></p>)}<p className="text-sm text-mute">prefers-reduced-motion disables everything non-essential.</p></Card>
      </section>
    </main>
  );
}
