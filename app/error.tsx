'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { normalizeLocale } from '@/lib/i18n/config'

const copy = {
  az: {
    title: 'Nəsə alınmadı',
    body: 'Səhifəni yükləyə bilmədik. Yenidən cəhd edin — məlumatlarınız itməyib.',
    retry: 'Yenidən cəhd et',
    home: 'Ana səhifəyə',
  },
  en: {
    title: 'Something went wrong',
    body: 'We could not load this page. Please try again — your data is safe.',
    retry: 'Try again',
    home: 'Go to home',
  },
  ru: {
    title: 'Что-то пошло не так',
    body: 'Не удалось загрузить страницу. Попробуйте ещё раз — ваши данные в порядке.',
    retry: 'Попробовать снова',
    home: 'На главную',
  },
} as const

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  // Error boundaries render in the browser, so the root <html lang> set by the
  // server layout tells us the visitor's language.
  const locale = normalizeLocale(
    typeof document === 'undefined' ? null : document.documentElement.lang,
  )
  const t = copy[locale]

  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-balance">
          {t.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            {t.retry}
          </Button>
          <Link href="/" className={buttonVariants({ variant: 'outline' })}>
            {t.home}
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 font-mono text-xs text-muted-foreground">
            {error.digest}
          </p>
        ) : null}
      </div>
    </main>
  )
}
