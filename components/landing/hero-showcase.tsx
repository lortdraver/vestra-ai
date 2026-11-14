import type { LandingCopy } from '@/lib/public-content/landing-copy'
import {
  BootIllustration,
  CoatIllustration,
  SweaterIllustration,
} from '@/components/landing/garments'

/**
 * Looping, CSS-only demo of the core flow: a garment is scanned and its
 * tags appear one by one. No JavaScript, honours prefers-reduced-motion.
 */
export function HeroShowcase({ copy }: { copy: LandingCopy['showcase'] }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
      {/* soft backdrop shapes */}
      <div className="landing-blob landing-blob-a absolute -left-10 top-6 size-56 rounded-full" />
      <div className="landing-blob landing-blob-b absolute -right-8 bottom-10 size-48 rounded-full" />

      {/* floating side cards */}
      <div className="landing-float-slow absolute -left-8 top-28 z-20 hidden w-24 rotate-[-8deg] rounded-xl border border-border bg-card p-2 shadow-lg sm:block">
        <SweaterIllustration className="h-auto w-full text-foreground" />
      </div>
      <div className="landing-float-slower absolute -right-6 bottom-16 z-20 hidden w-28 rotate-[7deg] rounded-xl border border-border bg-card p-2 shadow-lg sm:block">
        <BootIllustration className="h-auto w-full text-foreground" />
      </div>

      {/* main card */}
      <div className="relative z-10 flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-xl shadow-foreground/5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-widest text-muted-foreground">
            {copy.label}
          </span>
          <span className="flex items-center gap-1.5 text-accent">
            <span className="landing-pulse size-1.5 rounded-full bg-accent" />
            {copy.scanning}
          </span>
        </div>

        <div className="relative mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          <CoatIllustration className="landing-float h-[78%] w-auto text-foreground" />
          <div className="landing-scan pointer-events-none absolute inset-x-0 h-16" />
        </div>

        <p className="mt-4 font-serif text-lg leading-snug text-foreground">
          {copy.itemName}
        </p>
        <div className="mt-3 flex min-h-14 flex-wrap content-start gap-1.5">
          {copy.tags.map((tag, i) => (
            <span
              key={tag}
              className="landing-tag rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
              style={{ animationDelay: `${1.2 + i * 0.45}s` }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
