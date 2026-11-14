'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Camera, Home, Shirt, Sparkles, User } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import {
  dashboardNavItems,
  getDashboardNavLabel,
  isDashboardNavActive,
  type DashboardNavKey,
} from '@/lib/ui/dashboard-nav'
import { cn } from '@/lib/utils'

export const dashboardNavIcons: Record<DashboardNavKey, typeof Home> = {
  home: Home,
  wardrobe: Shirt,
  stylist: Sparkles,
  me: User,
}

const addLabel = {
  az: 'Geyim əlavə et',
  en: 'Add an item',
  ru: 'Добавить вещь',
} as const

/** Desktop navigation: a fixed left rail with the four main sections. */
export function DashboardSidebar({ locale }: { locale: Locale }) {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card/85 px-4 py-6 backdrop-blur md:flex">
      <Link
        href="/dashboard"
        className="px-3 pb-6 font-serif text-2xl font-medium tracking-tight"
      >
        Vestra
      </Link>
      <nav aria-label="Vestra" className="flex flex-col gap-1">
        {dashboardNavItems.map((item) => {
          const Icon = dashboardNavIcons[item.key]
          const active = isDashboardNavActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors',
                active
                  ? 'bg-secondary font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {getDashboardNavLabel(locale, item.key)}
            </Link>
          )
        })}
      </nav>
      <Link
        href="/dashboard/wardrobe?add=1"
        className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        <Camera className="size-4" aria-hidden="true" />
        {addLabel[locale]}
      </Link>
    </aside>
  )
}
