import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { getLocale } from '@/lib/i18n/server'

const copy = {
  az: {
    title: 'Bu səhifə tapılmadı',
    body: 'Keçid köhnəlib və ya səhv yazılıb. Qarderobunuz yerindədir.',
    home: 'Ana səhifəyə',
    wardrobe: 'Qarderoba keç',
  },
  en: {
    title: 'This page could not be found',
    body: 'The link may be old or mistyped. Your wardrobe is safe.',
    home: 'Go to home',
    wardrobe: 'Open wardrobe',
  },
  ru: {
    title: 'Такой страницы нет',
    body: 'Возможно, ссылка устарела или в ней опечатка. Ваш гардероб на месте.',
    home: 'На главную',
    wardrobe: 'Открыть гардероб',
  },
} as const

export default async function NotFound() {
  const t = copy[await getLocale()]

  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <p className="font-serif text-7xl font-medium tracking-tight text-accent">
          404
        </p>
        <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight text-balance">
          {t.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants()}>
            {t.home}
          </Link>
          <Link
            href="/dashboard/wardrobe"
            className={buttonVariants({ variant: 'outline' })}
          >
            {t.wardrobe}
          </Link>
        </div>
      </div>
    </main>
  )
}
