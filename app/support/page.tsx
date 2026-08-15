import Link from 'next/link'
import type { Metadata } from 'next'
import { Mail } from 'lucide-react'
import { PublicFooter } from '@/components/public-footer'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { supportCopy } from '@/lib/public-content/copy'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const copy = supportCopy[locale]

  return {
    title: copy.title,
    description: copy.description,
  }
}

export default async function SupportPage() {
  const [dictionary, locale] = await Promise.all([getDictionary(), getLocale()])
  const copy = supportCopy[locale]
  const contactEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim() || null

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-serif text-xl font-semibold tracking-tight text-foreground"
        >
          {dictionary.common.brand}
        </Link>
        <Link
          href="/sign-in"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {dictionary.common.signIn}
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="border-b border-border pb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">
            {copy.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-foreground text-balance md:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
            {copy.intro}
          </p>
        </section>

        <div className="grid gap-6 py-10 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-serif text-2xl font-medium text-foreground">
                  {copy.contactTitle}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {contactEmail
                    ? copy.contactAvailable
                    : copy.contactUnavailable}
                </p>
              </div>
            </div>
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {contactEmail}
              </a>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-muted/30 p-5">
            <h2 className="font-serif text-2xl font-medium text-foreground">
              {copy.sectionsTitle}
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
              {copy.topics.map((topic) => (
                <li key={topic} className="rounded-xl bg-background px-3 py-2">
                  {topic}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-2xl font-medium text-foreground">
              {copy.includeTitle}
            </h2>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground">
              {copy.includeItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
            <h2 className="font-serif text-2xl font-medium text-foreground">
              {copy.neverSendTitle}
            </h2>
            <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground">
              {copy.neverSendItems.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <PublicFooter locale={locale} />
    </div>
  )
}
