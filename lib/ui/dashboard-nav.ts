import type { Locale } from '@/lib/i18n/config'

/** The four primary sections of the signed-in app. */
export const dashboardNavItems = [
  { href: '/dashboard', key: 'home', also: ['/dashboard/planner'] },
  { href: '/dashboard/wardrobe', key: 'wardrobe', also: [] },
  { href: '/dashboard/stylist', key: 'stylist', also: ['/dashboard/outfits'] },
  {
    href: '/dashboard/account',
    key: 'me',
    also: ['/dashboard/subscription', '/dashboard/admin'],
  },
] as const

export type DashboardNavKey = (typeof dashboardNavItems)[number]['key']

const labels: Record<Locale, Record<DashboardNavKey, string>> = {
  az: {
    home: 'Ana səhifə',
    wardrobe: 'Qarderob',
    stylist: 'Stilist',
    me: 'Mən',
  },
  en: { home: 'Home', wardrobe: 'Wardrobe', stylist: 'Stylist', me: 'Me' },
  ru: { home: 'Главная', wardrobe: 'Гардероб', stylist: 'Стилист', me: 'Я' },
}

export function getDashboardNavLabel(locale: Locale, key: DashboardNavKey) {
  return labels[locale][key]
}

export function isDashboardNavActive(
  pathname: string,
  item: (typeof dashboardNavItems)[number],
) {
  if (item.href === '/dashboard') {
    return (
      pathname === '/dashboard' ||
      item.also.some((path) => pathname.startsWith(path))
    )
  }
  return [item.href, ...item.also].some((path) => pathname.startsWith(path))
}
