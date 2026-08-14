import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicFooter } from '@/components/public-footer'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { getTermsCopy } from '@/lib/legal/copy'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const copy = getTermsCopy(locale, process.env.PRIVACY_CONTACT_EMAIL)

  return {
    title: copy.title,
    description: copy.description,
  }
}

export default async function TermsPage() {
  const [dictionary, locale] = await Promise.all([getDictionary(), getLocale()])
  const copy = getTermsCopy(locale, process.env.PRIVACY_CONTACT_EMAIL)

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
            {copy.description}
          </p>
          <div className="mt-5 grid gap-2 text-sm text-muted-foreground">
            <p>{copy.effectiveDate}</p>
            <p>{copy.ownerReviewNotice}</p>
            <p>
              {copy.contactLabel}:{' '}
              <span className="font-medium text-foreground">
                {copy.contactValue}
              </span>
            </p>
          </div>
        </section>

        <div className="grid gap-8 py-10">
          {copy.sections.map((section) => (
            <section key={section.title} className="grid gap-3">
              <h2 className="font-serif text-2xl font-medium text-foreground">
                {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <PublicFooter locale={locale} />
    </div>
  )
}
