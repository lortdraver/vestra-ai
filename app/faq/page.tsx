import Link from 'next/link'
import type { Metadata } from 'next'
import { FaqAccordion } from '@/components/faq-accordion'
import { PublicFooter } from '@/components/public-footer'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { faqCopy } from '@/lib/public-content/copy'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const copy = faqCopy[locale]

  return {
    title: copy.title,
    description: copy.description,
  }
}

export default async function FaqPage() {
  const [dictionary, locale] = await Promise.all([getDictionary(), getLocale()])
  const copy = faqCopy[locale]

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

        <div className="py-10">
          <FaqAccordion sections={copy.sections} />
        </div>
      </main>
      <PublicFooter locale={locale} />
    </div>
  )
}
