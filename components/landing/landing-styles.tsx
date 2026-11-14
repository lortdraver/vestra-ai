// Keyframes and palette for the landing page only. Kept here instead of
// globals.css so the rest of the app is untouched.
const css = `
.landing {
  --landing-camel: oklch(0.72 0.085 70);
  --landing-camel-dark: oklch(0.6 0.09 65);
  --landing-cream: oklch(0.95 0.02 85);
  --landing-cream-dark: oklch(0.82 0.03 80);
  --landing-denim: oklch(0.42 0.05 250);
  --landing-denim-light: oklch(0.7 0.04 245);
  --landing-ink: oklch(0.3 0.012 60);
}
.landing-blob { filter: blur(40px); opacity: .55; }
.landing-blob-a { background: var(--landing-camel); animation: landing-drift 14s ease-in-out infinite; }
.landing-blob-b { background: var(--landing-cream-dark); animation: landing-drift 18s ease-in-out infinite reverse; }
.landing-float { animation: landing-float 6s ease-in-out infinite; }
.landing-float-slow { animation: landing-float 7s ease-in-out infinite; }
.landing-float-slower { animation: landing-float 9s ease-in-out infinite reverse; }
.landing-pulse { animation: landing-pulse 1.6s ease-in-out infinite; }
.landing-scan {
  top: -4rem;
  background: linear-gradient(to bottom, transparent, color-mix(in oklch, var(--accent) 22%, transparent) 70%, color-mix(in oklch, var(--accent) 70%, transparent) 98%, transparent);
  animation: landing-scan 8s ease-in-out infinite;
}
.landing-tag { opacity: 0; animation: landing-tag 8s ease-out infinite; }
.landing-hero-in > * { opacity: 0; animation: landing-rise .9s cubic-bezier(.2,.7,.2,1) forwards; }
.landing-hero-in > *:nth-child(2) { animation-delay: .1s; }
.landing-hero-in > *:nth-child(3) { animation-delay: .2s; }
.landing-hero-in > *:nth-child(4) { animation-delay: .3s; }

@keyframes landing-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(18px, -14px) scale(1.08); }
}
@keyframes landing-float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -8px; }
}
@keyframes landing-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .35; transform: scale(.7); }
}
@keyframes landing-scan {
  0% { top: -4rem; opacity: 0; }
  8% { opacity: 1; }
  40% { top: 100%; opacity: 1; }
  48%, 100% { top: 100%; opacity: 0; }
}
@keyframes landing-tag {
  0% { opacity: 0; transform: translateY(6px) scale(.96); }
  6%, 82% { opacity: 1; transform: none; }
  92%, 100% { opacity: 0; transform: none; }
}
@keyframes landing-rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-blob-a, .landing-blob-b, .landing-float, .landing-float-slow,
  .landing-float-slower, .landing-pulse, .landing-scan { animation: none; }
  .landing-scan { display: none; }
  .landing-tag, .landing-hero-in > * { animation: none; opacity: 1; }
}
`

export function LandingStyles() {
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
