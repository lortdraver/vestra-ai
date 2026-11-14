import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Reveal } from '@/components/landing/reveal'
import {
  BootIllustration,
  CameraIcon,
  CoatIllustration,
  JeansIllustration,
  OutfitIcon,
  SparkTagIcon,
  SweaterIllustration,
} from '@/components/landing/garments'
import type { LandingCopy } from '@/lib/public-content/landing-copy'

const STEP_ICONS = [CameraIcon, SparkTagIcon, OutfitIcon]

export function HowItWorks({ copy }: { copy: LandingCopy['steps'] }) {
  return (
    <section className="px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {copy.eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground text-balance md:text-4xl">
            {copy.title}
          </h2>
        </Reveal>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {copy.items.map((item, i) => {
            const Icon = STEP_ICONS[i] ?? CameraIcon
            return (
              <li key={item.title}>
                <Reveal
                  delay={i * 120}
                  className="group h-full rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-foreground/5"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-12 text-foreground transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
                    <span className="font-serif text-3xl text-border">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 font-serif text-xl text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </Reveal>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

export function OutfitOfTheDay({ copy }: { copy: LandingCopy['outfit'] }) {
  const pieces = [
    { key: 'coat', node: <CoatIllustration className="h-32 w-auto" /> },
    { key: 'sweater', node: <SweaterIllustration className="h-24 w-auto" /> },
    { key: 'jeans', node: <JeansIllustration className="h-32 w-auto" /> },
    { key: 'boots', node: <BootIllustration className="h-16 w-auto" /> },
  ]
  return (
    <section className="bg-secondary/60 px-6 py-20 md:px-10 md:py-28">
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {copy.eyebrow}
          </p>
          <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-foreground text-balance md:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground text-pretty">
            {copy.body}
          </p>
        </Reveal>

        <Reveal delay={150}>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-foreground/5">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>{copy.occasion}</span>
              <span className="flex gap-1" aria-hidden="true">
                <span
                  className="size-3 rounded-full"
                  style={{ background: 'var(--landing-camel)' }}
                />
                <span
                  className="size-3 rounded-full"
                  style={{ background: 'var(--landing-cream-dark)' }}
                />
                <span
                  className="size-3 rounded-full"
                  style={{ background: 'var(--landing-denim)' }}
                />
                <span
                  className="size-3 rounded-full"
                  style={{ background: 'var(--landing-ink)' }}
                />
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {pieces.map((piece, i) => (
                <Reveal
                  key={piece.key}
                  delay={300 + i * 140}
                  className="flex h-40 items-center justify-center rounded-xl bg-secondary p-3 text-foreground"
                >
                  {piece.node}
                </Reveal>
              ))}
            </div>
            <blockquote className="mt-5 border-l-2 border-accent pl-4">
              <p className="font-serif italic leading-relaxed text-foreground">
                “{copy.note}”
              </p>
              <footer className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                {copy.noteAuthor}
              </footer>
            </blockquote>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function FinalCta({
  copy,
  ctaLabel,
}: {
  copy: LandingCopy['cta']
  ctaLabel: string
}) {
  return (
    <section className="px-6 py-20 md:px-10 md:py-24">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground md:py-20">
        <div className="landing-blob landing-blob-a absolute -left-16 -top-16 size-64 rounded-full opacity-30" />
        <div className="relative">
          <h2 className="font-serif text-3xl font-medium tracking-tight text-balance md:text-5xl">
            {copy.title}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-primary-foreground/75">
            {copy.body}
          </p>
          <Link
            href="/sign-up"
            className={buttonVariants({
              size: 'lg',
              variant: 'secondary',
              className: 'mt-8 px-5',
            })}
          >
            {ctaLabel}
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
