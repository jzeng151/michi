/**
 * Static hero art: SSR paint, prefers-reduced-motion, and no-WebGL fallback.
 * Colors ride the theme tokens, so it matches every season/mode.
 */
export function HeroPoster() {
  return (
    <svg
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
    >
      <rect width="1200" height="800" fill="var(--canvas)" />
      <ellipse cx="600" cy="790" rx="700" ry="180" fill="var(--wash)" />
      <ellipse cx="240" cy="200" rx="180" ry="52" fill="var(--wash)" opacity="0.8" />
      <ellipse cx="920" cy="150" rx="220" ry="60" fill="var(--wash)" opacity="0.6" />
      <g fill="#b8432a">
        <rect x="440" y="300" width="26" height="330" rx="8" />
        <rect x="734" y="300" width="26" height="330" rx="8" />
        <rect x="392" y="268" width="416" height="30" rx="10" />
        <rect x="430" y="360" width="340" height="22" rx="8" />
        <rect x="588" y="298" width="24" height="62" rx="6" />
      </g>
      <rect x="376" y="242" width="448" height="24" rx="10" fill="var(--ink)" opacity="0.75" />
      <g fill="var(--accent)" opacity="0.5">
        <circle cx="180" cy="330" r="6" />
        <circle cx="320" cy="480" r="4" />
        <circle cx="250" cy="600" r="5" />
        <circle cx="890" cy="420" r="5" />
        <circle cx="1020" cy="300" r="4" />
        <circle cx="960" cy="560" r="6" />
        <circle cx="620" cy="180" r="4" />
        <circle cx="740" cy="120" r="5" />
      </g>
    </svg>
  );
}
