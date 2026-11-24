/**
 * Cover image for a university or scholarship. With a photo: the photo. Without one: a deterministic
 * folded-paper composition (same seed → same art), tinted by category so the board reads at a glance.
 */
const CAT: Record<string, string> = { dream: "var(--cat-dream)", reach: "var(--cat-reach)", target: "var(--cat-target)", safety: "var(--cat-safety)" };

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

export function CoverArt({ seed, category, className }: { seed: string; category?: string | null; className?: string }) {
  const r = rng(seed);
  const tint = (category && CAT[category]) || "var(--ink)";
  const W = 320, H = 200;
  const fx = 70 + r() * 180, fy = 50 + r() * 100; // the fold point
  const edge: [number, number][] = [[0, 0], [W * (0.25 + r() * 0.2), 0], [W * (0.6 + r() * 0.2), 0], [W, 0], [W, H * (0.3 + r() * 0.4)], [W, H], [W * (0.55 + r() * 0.3), H], [W * (0.15 + r() * 0.25), H], [0, H], [0, H * (0.3 + r() * 0.4)]];
  const facets = edge.map((p, i) => { const q = edge[(i + 1) % edge.length]; return { d: `M${fx.toFixed(1)} ${fy.toFixed(1)}L${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}Z`, o: 0.06 + r() * 0.32 }; });
  const cx = 40 + r() * 240, cy = 30 + r() * 120;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width={W} height={H} fill="var(--paper-2)" />
      {facets.map((f, i) => <path key={i} d={f.d} fill={tint} fillOpacity={f.o} stroke="var(--card)" strokeOpacity=".55" strokeWidth=".8" />)}
      <g transform={`translate(${cx} ${cy}) scale(.32)`} opacity=".9">
        <path d="M30 66 L60 60 L84 66 L60 80 Z M60 60 L108 30 L84 66 Z M52 62 L20 26 L66 54 Z M36 66 L16 30 L22 32 L42 64 Z" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M16 30 L8 34 L18 26 Z" fill="var(--lacquer)" />
      </g>
    </svg>
  );
}

export function Cover({ src, seed, category, alt, className = "" }: { src?: string | null; seed: string; category?: string | null; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-paper-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- private, pre-compressed images served by our own route */}
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" /> : <CoverArt seed={seed} category={category} className="absolute inset-0 size-full" />}
    </div>
  );
}

export function ScoreRing({ value, size = 48, label }: { value: number | null; size?: number; label: string }) {
  const v = value ?? 0, R = 20, C = 2 * Math.PI * R;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value?.toFixed(1) ?? "—"}`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={R} fill="var(--card)" stroke="var(--line)" strokeWidth="4" />
        <circle cx="24" cy="24" r={R} fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(C * v) / 100} ${C}`} />
      </svg>
      <span className="relative font-display text-[0.95rem] leading-none tabular-nums" style={{ fontSize: size * 0.3 }}>{value?.toFixed(0) ?? "—"}</span>
    </span>
  );
}
