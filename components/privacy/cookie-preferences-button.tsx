'use client'

import { openCookiePreferences } from '@/components/privacy/consent-manager'
import { cn } from '@/lib/utils'

export function CookiePreferencesButton({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
      onClick={openCookiePreferences}
    >
      {label}
    </button>
  )
}
