import Link from 'next/link'
import { CookiePreferencesButton } from '@/components/privacy/cookie-preferences-button'
import { getPublicLegalCopy } from '@/lib/legal/copy'
import type { Locale } from '@/lib/i18n/config'

export function PublicFooter({
  locale,
  className,
}: {
  locale: Locale
  className?: string
}) {
  const copy = getPublicLegalCopy(locale)

  return (
    <footer
      className={
        className ??
        'border-t border-border px-6 py-6 text-sm text-muted-foreground md:px-10'
      }
    >
      <nav
        aria-label="Legal"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2"
      >
        <Link
          href="/privacy"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {copy.privacy}
        </Link>
        <Link
          href="/terms"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {copy.terms}
        </Link>
        <Link
          href="/refund"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {copy.refund}
        </Link>
        <CookiePreferencesButton label={copy.cookiePreferences} />
      </nav>
    </footer>
  )
}
