/**
 * Kumo, the paper crane. Flat origami facets in ink + paper with a lacquer-red accent.
 * Five states change posture subtly; all share one silhouette so it reads as the same character.
 */
export type KumoState = "awake" | "focused" | "celebrating" | "resting" | "cheering";

const WING: Record<KumoState, string> = {
  awake: "rotate(0)", focused: "rotate(6 60 58)", celebrating: "rotate(-18 60 58)", resting: "rotate(14 60 58)", cheering: "rotate(-10 60 58)",
};

export function Kumo({ state = "awake", size = 96, title, className }: { state?: KumoState; size?: number; title?: string; className?: string }) {
  const sleeping = state === "resting";
  return (
    <svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} className={className}>
      {title ? <title>{title}</title> : null}
      {/* ground shadow */}
      <ellipse cx="60" cy="92" rx={sleeping ? 30 : 24} ry="3" fill="currentColor" opacity=".08" />
      <g transform={state === "celebrating" ? "translate(0 -6)" : sleeping ? "translate(0 4)" : undefined}>
        {/* tail */}
        <path d="M60 60 L108 30 L84 66 Z" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
        {/* body */}
        <path d="M30 66 L60 60 L84 66 L60 80 Z" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M60 60 L60 80" stroke="var(--ink)" strokeWidth="1" opacity=".35" />
        {/* far wing */}
        <g transform={WING[state]}>
          <path d="M60 58 L44 14 L72 50 Z" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
        </g>
        {/* near wing */}
        <g transform={WING[state]}>
          <path d="M52 62 L20 26 L66 54 Z" fill="var(--card)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M52 62 L34 40" stroke="var(--ink)" strokeWidth="1" opacity=".3" />
        </g>
        {/* neck + head */}
        <path d={sleeping ? "M36 66 L22 60 L18 66 L30 68 Z" : "M36 66 L16 30 L22 32 L42 64 Z"} fill="var(--card)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d={sleeping ? "M18 66 L10 68 L18 62 Z" : "M16 30 L8 34 L18 26 Z"} fill="var(--lacquer)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
        {/* eye */}
        {sleeping ? (
          <path d="M20 64 q2 1.4 4 0" stroke="var(--ink)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        ) : (
          <circle cx={state === "focused" ? 19.5 : 19} cy="31" r="1.4" fill="var(--ink)" />
        )}
      </g>
      {state === "celebrating" ? (
        <g fill="var(--lacquer)">
          <rect x="94" y="12" width="4" height="4" rx="1" transform="rotate(20 96 14)" />
          <rect x="102" y="44" width="3" height="3" rx="1" opacity=".7" />
          <circle cx="12" cy="14" r="2" opacity=".6" />
        </g>
      ) : null}
      {sleeping ? <text x="88" y="22" fontSize="11" fill="var(--mute)" fontFamily="var(--font-serif)">z</text> : null}
    </svg>
  );
}
