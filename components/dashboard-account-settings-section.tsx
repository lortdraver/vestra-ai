'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Cookie,
  CreditCard,
  Headphones,
  LogOut,
  Shield,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import {
  getAccountMenuItems,
  type AccountMenuItemKey,
} from '@/lib/account-menu'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { buttonVariants, Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/language-switcher'
import { openCookiePreferences } from '@/components/privacy/consent-manager'
import { cn } from '@/lib/utils'

const actionIcons = {
  accountSettings: UserCog,
  subscription: CreditCard,
  stylistPreferences: SlidersHorizontal,
  privacy: Shield,
  admin: Shield,
} satisfies Record<AccountMenuItemKey, typeof UserCog>

export function DashboardAccountSettingsSection({
  dictionary,
  locale,
  role,
}: {
  dictionary: Dictionary
  locale: Locale
  role?: string | null
}) {
  const router = useRouter()
  const copy = getDashboardSettingsCopy(locale)
  const menuItems = getAccountMenuItems(role)

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } finally {
      router.push('/sign-in')
      router.refresh()
    }
  }

  return (
    <Card data-testid="dashboard-account-settings" className="shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-xl font-medium">
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => {
            const Icon = actionIcons[item.key]

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'min-h-12 justify-start rounded-xl px-3 text-sm',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {dictionary.accountMenu[item.key]}
              </Link>
            )
          })}

          <Link
            href="/dashboard/account#support"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'min-h-12 justify-start rounded-xl px-3 text-sm',
            )}
          >
            <Headphones className="size-4" aria-hidden="true" />
            {copy.support}
          </Link>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-medium">{dictionary.common.language}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {copy.languageDescription}
            </p>
          </div>
          <LanguageSwitcher
            currentLocale={locale}
            label={dictionary.common.language}
            variant="menu"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-start rounded-xl px-3 text-sm"
            onClick={openCookiePreferences}
          >
            <Cookie className="size-4" aria-hidden="true" />
            {dictionary.privacy.cookiePreferences}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-12 justify-start rounded-xl px-3 text-sm"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {dictionary.dashboard.signOut}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function getDashboardSettingsCopy(locale: Locale) {
  return {
    az: {
      title: 'İstifadəçi hesabı və tənzimləmələr',
      subtitle:
        'Profil, plan, dil, məxfilik və çıxış əməliyyatları mobil ekranda da buradadır.',
      support: 'Dəstək / kömək',
      languageDescription: 'Vestra interfeysi üçün dil seçimini dəyişin.',
    },
    en: {
      title: 'Account and settings',
      subtitle:
        'Profile, plan, language, privacy, and sign-out actions are always available here on mobile.',
      support: 'Support / help',
      languageDescription: 'Change the interface language for Vestra.',
    },
    ru: {
      title: 'Аккаунт и настройки',
      subtitle:
        'Профиль, план, язык, приватность и выход доступны здесь и на мобильном.',
      support: 'Поддержка / помощь',
      languageDescription: 'Измените язык интерфейса Vestra.',
    },
  }[locale]
}
