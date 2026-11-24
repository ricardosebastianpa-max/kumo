/** Kumo as a happy round cloud face: the copilot's avatar. Blinks; respects reduced motion via CSS. */
export function KumoFace({ size = 64, mood = "happy" }: { size?: number; mood?: "happy" | "thinking" }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <circle cx="32" cy="32" r="30" fill="var(--sky)" />
      <path d="M10 30 a10 10 0 0 1 12 -10 a12 12 0 0 1 22 0 a10 10 0 0 1 10 12" fill="#fff" opacity=".28" />
      <g className="blink"><ellipse cx="23" cy="31" rx="4" ry={mood === "thinking" ? 2 : 5} fill="#fff" /><ellipse cx="41" cy="31" rx="4" ry={mood === "thinking" ? 2 : 5} fill="#fff" />
        <circle cx="24" cy="32" r="2.2" fill="#1B2A3A" /><circle cx="42" cy="32" r="2.2" fill="#1B2A3A" /></g>
      <circle cx="16" cy="40" r="3.5" fill="#FF8FA3" opacity=".7" /><circle cx="48" cy="40" r="3.5" fill="#FF8FA3" opacity=".7" />
      {mood === "thinking" ? <path d="M26 45 h12" stroke="#1B2A3A" strokeWidth="3" strokeLinecap="round" /> : <path d="M24 42 q8 8 16 0" fill="none" stroke="#1B2A3A" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  );
}
