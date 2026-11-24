/**
 * Kumo, the paper crane, in the friendly style: chunky rounded shapes, a thick soft outline,
 * sky-blue wings, coral crest, a shiny eye and blush. Five states share one silhouette.
 */
export type KumoState = "awake" | "focused" | "celebrating" | "resting" | "cheering";

const WING: Record<KumoState, number> = { awake: 0, focused: 6, celebrating: -22, resting: 14, cheering: -12 };
const O = "#2B2A33"; // outline

export function Kumo({ state = "awake", size = 96, title, className }: { state?: KumoState; size?: number; title?: string; className?: string }) {
  const sleeping = state === "resting";
  const w = WING[state];
  return (
    <svg viewBox="0 0 120 104" width={size} height={(size * 104) / 120} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} className={className}>
      {title ? <title>{title}</title> : null}
      <ellipse cx="62" cy="98" rx={sleeping ? 30 : 26} ry="4" fill={O} opacity=".12" />
      <g transform={state === "celebrating" ? "translate(0 -6)" : sleeping ? "translate(0 4)" : undefined} strokeLinejoin="round" strokeLinecap="round">
        {/* tail */}
        <path d="M66 62 Q92 40 110 30 Q100 56 88 70 Z" fill="#E3F3FE" stroke={O} strokeWidth="3.5" />
        {/* far wing */}
        <g transform={`rotate(${w} 62 58)`}><path d="M62 58 Q52 30 48 14 Q70 30 78 52 Z" fill="#9AD3FA" stroke={O} strokeWidth="3.5" /></g>
        {/* body: a round folded paper belly */}
        <path d="M28 68 Q44 54 66 58 Q90 62 88 72 Q76 90 54 88 Q34 86 28 68 Z" fill="#FFFFFF" stroke={O} strokeWidth="3.5" />
        <path d="M58 60 Q60 74 56 86" fill="none" stroke={O} strokeWidth="2" opacity=".25" />
        {/* near wing */}
        <g transform={`rotate(${w} 56 62)`}><path d="M56 64 Q30 46 18 26 Q46 34 70 56 Z" fill="var(--sky, #3FA9F5)" stroke={O} strokeWidth="3.5" /></g>
        {/* neck + head */}
        <path d={sleeping ? "M36 70 Q28 64 20 64 Q16 70 24 74 Q32 76 38 74 Z" : "M38 68 Q30 52 22 34 Q20 26 28 26 Q36 28 46 64 Z"} fill="#FFFFFF" stroke={O} strokeWidth="3.5" />
        {/* crest / beak */}
        <path d={sleeping ? "M20 64 L10 68 L20 70 Z" : "M24 28 L12 31 L24 35 Z"} fill="var(--brand, #D64232)" stroke={O} strokeWidth="3" />
        {sleeping ? (
          <path d="M24 67 q3 2 6 0" stroke={O} strokeWidth="2.5" fill="none" />
        ) : (
          <g className="blink"><circle cx={state === "focused" ? 30 : 29} cy="32" r="3.6" fill={O} /><circle cx={state === "focused" ? 31 : 30} cy="30.6" r="1.2" fill="#fff" /></g>
        )}
        <circle cx={sleeping ? 30 : 34} cy={sleeping ? 72 : 40} r="3" fill="#FF8FA3" opacity=".75" />
      </g>
      {state === "celebrating" || state === "cheering" ? (
        <g>
          <circle cx="98" cy="14" r="4" fill="var(--sun, #FFC93C)" /><circle cx="108" cy="46" r="3" fill="var(--leaf, #3DBE6B)" />
          <rect x="10" y="8" width="6" height="6" rx="1.5" fill="var(--brand, #D64232)" transform="rotate(20 13 11)" />
        </g>
      ) : null}
      {sleeping ? <text x="88" y="22" fontSize="14" fontWeight="900" fill="var(--sky, #3FA9F5)">z</text> : null}
    </svg>
  );
}
