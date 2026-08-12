'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarDays,
  CreditCard,
  HeartHandshake,
  Home,
  Images,
  LogOut,
  Cookie,
  Shield,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  X,
} from 'lucide-react'
import { authClient, useSession } from '@/lib/auth-client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LanguageSwitcher } from '@/components/language-switcher'
import { openCookiePreferences } from '@/components/privacy/consent-manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  getAccountMenuItems,
  getUserInitials,
  type AccountMenuItemKey,
} from '@/lib/account-menu'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { DESKTOP_NAV_CLASS, MOBILE_BOTTOM_NAV_CLASS } from '@/lib/ui/responsive'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', key: 'home' },
  { href: '/dashboard/wardrobe', key: 'wardrobe' },
  { href: '/dashboard/stylist', key: 'stylist' },
  { href: '/dashboard/planner', key: 'planner' },
  { href: '/dashboard/outfits', key: 'outfits' },
] as const

type AppHeaderUser = {
  name?: string | null
  email?: string | null
  image?: string | null
  role?: string | null
  emailVerified?: boolean | null
  planKey?: string | null
}

type MobileAccountCopy = {
  title: string
  accountSection: string
  quickActions: string
}

const menuIcons: Record<
  AccountMenuItemKey,
  ComponentType<{ className?: string }>
> = {
  accountSettings: UserCog,
  subscription: CreditCard,
  stylistPreferences: SlidersHorizontal,
  privacy: Shield,
  admin: HeartHandshake,
}

const mobileNavIcons: Record<
  (typeof navItems)[number]['key'],
  ComponentType<{ className?: string }>
> = {
  home: Home,
  wardrobe: Shirt,
  stylist: Sparkles,
  planner: CalendarDays,
  outfits: Images,
}

function getNavLabel(
  dictionary: Dictionary,
  locale: Locale,
  key: (typeof navItems)[number]['key'],
) {
  if (key === 'planner') {
    return {
      az: 'Planlay\u0131c\u0131',
      en: 'Planner',
      ru: '\u041f\u043b\u0430\u043d',
    }[locale]
  }

  return dictionary.dashboard[
    key as keyof typeof dictionary.dashboard
  ] as string
}

export function AppHeader({
  user,
  dictionary,
  locale,
}: {
  user?: AppHeaderUser | null
  dictionary: Dictionary
  locale: Locale
}) {
  const pathname = usePathname()
  const router = useRouter()
  const session = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const sessionUser = session.data?.user
  const activeUser =
    session.data === null
      ? null
      : {
          ...user,
          name: sessionUser?.name ?? user?.name ?? null,
          email: sessionUser?.email ?? user?.email ?? null,
          image: sessionUser?.image ?? user?.image ?? null,
        }
  const isSessionLoading = session.isPending && !activeUser
  const initials = getUserInitials(activeUser)
  const planLabel =
    activeUser?.planKey === 'premium'
      ? dictionary.subscription.plans.premium
      : dictionary.subscription.plans.free
  const menuItems = getAccountMenuItems(activeUser?.role)
  const mobileCopy = getMobileAccountCopy(locale)

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } finally {
      setMobileMenuOpen(false)
      router.push('/sign-in')
      router.refresh()
    }
  }

  useEffect(() => {
    if (!mobileMenuOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    const firstControl =
      mobileMenuRef.current?.querySelector<HTMLElement>('button, a')
    firstControl?.focus()

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center justify-between gap-3 px-3 min-[390px]:px-4 md:h-16 md:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/dashboard"
            className="truncate font-serif text-lg font-semibold tracking-tight text-foreground"
          >
            {dictionary.common.brand}
          </Link>
          <nav
            aria-label={dictionary.common.mainNavigation}
            className={DESKTOP_NAV_CLASS}
          >
            {navItems.map((item) => {
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {getNavLabel(dictionary, locale, item.key)}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher
              currentLocale={locale}
              label={dictionary.common.language}
            />
          </div>
          <div className="md:hidden">
            {isSessionLoading ? (
              <div
                aria-label={dictionary.common.loading}
                className="size-11 animate-pulse rounded-full bg-muted"
              />
            ) : activeUser ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="size-11 rounded-full border border-transparent hover:border-border aria-expanded:border-border aria-expanded:bg-muted"
                aria-label={dictionary.common.accountMenu}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((current) => !current)}
              >
                <Avatar className="size-8">
                  {activeUser.image ? (
                    <AvatarImage
                      src={activeUser.image}
                      alt={activeUser.name ?? activeUser.email ?? ''}
                    />
                  ) : null}
                  <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                    {initials || dictionary.common.userFallback}
                  </AvatarFallback>
                </Avatar>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                  )}
                >
                  {dictionary.common.signIn}
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'sm' }),
                  )}
                >
                  {dictionary.common.signUp}
                </Link>
              </div>
            )}
          </div>
          <div className="hidden md:flex md:items-center md:gap-2">
            {isSessionLoading ? (
              <div
                aria-label={dictionary.common.loading}
                className="size-8 animate-pulse rounded-full bg-muted"
              />
            ) : activeUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11 rounded-full border border-transparent hover:border-border aria-expanded:border-border aria-expanded:bg-muted"
                      aria-label={dictionary.common.accountMenu}
                    />
                  }
                >
                  <Avatar className="size-8">
                    {activeUser.image ? (
                      <AvatarImage
                        src={activeUser.image}
                        alt={activeUser.name ?? activeUser.email ?? ''}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                      {initials || dictionary.common.userFallback}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="w-80 max-w-[calc(100vw-1rem)] rounded-2xl p-2 shadow-xl"
                >
                  <div className="p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-10">
                        {activeUser.image ? (
                          <AvatarImage
                            src={activeUser.image}
                            alt={activeUser.name ?? activeUser.email ?? ''}
                          />
                        ) : null}
                        <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">
                          {initials || dictionary.common.userFallback}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {activeUser.name || activeUser.email}
                        </p>
                        <p className="truncate text-xs font-normal text-muted-foreground">
                          {activeUser.email}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] font-medium text-secondary-foreground">
                            {planLabel}
                          </span>
                          {activeUser.emailVerified != null ? (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                              {activeUser.emailVerified
                                ? dictionary.accountMenu.emailVerified
                                : dictionary.accountMenu.emailUnverified}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {menuItems.map((item) => {
                      const Icon = menuIcons[item.key]
                      return (
                        <DropdownMenuItem
                          key={item.key}
                          render={<Link href={item.href} />}
                          className="gap-2 px-2.5 py-2"
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          {dictionary.accountMenu[item.key]}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={openCookiePreferences}
                      className="gap-2 px-2.5 py-2"
                    >
                      <Cookie className="size-4 text-muted-foreground" />
                      {dictionary.privacy.cookiePreferences}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleSignOut}
                    className="gap-2 px-2.5 py-2"
                  >
                    <LogOut className="size-4" />
                    {dictionary.dashboard.signOut}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                  )}
                >
                  {dictionary.common.signIn}
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(
                    buttonVariants({ variant: 'default', size: 'sm' }),
                  )}
                >
                  {dictionary.common.signUp}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeUser && mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-sm md:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMobileMenuOpen(false)
          }}
        >
          <div
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-account-menu-title"
            className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+3.9rem)] rounded-2xl border border-border bg-background p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  id="mobile-account-menu-title"
                  className="text-sm font-semibold text-foreground"
                >
                  {mobileCopy.title}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {activeUser.name || maskEmail(activeUser.email)}
                </p>
                {activeUser.email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {maskEmail(activeUser.email)}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label={dictionary.common.accountMenu}
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <section className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {mobileCopy.accountSection}
                </p>
                <div className="grid gap-1.5">
                  {menuItems.map((item) => {
                    const Icon = menuIcons[item.key]
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Icon className="size-4 text-muted-foreground" />
                        {dictionary.accountMenu[item.key]}
                      </Link>
                    )
                  })}
                </div>
              </section>

              <section className="grid gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {dictionary.common.language}
                </p>
                <LanguageSwitcher
                  currentLocale={locale}
                  label={dictionary.common.language}
                  variant="menu"
                  onLocaleChange={() => setMobileMenuOpen(false)}
                />
              </section>

              <section className="grid gap-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {mobileCopy.quickActions}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-start rounded-xl px-3 text-sm"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    window.setTimeout(() => openCookiePreferences(), 0)
                  }}
                >
                  <Cookie className="size-4" />
                  {dictionary.privacy.cookiePreferences}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="min-h-11 justify-start rounded-xl px-3 text-sm"
                  onClick={() => void handleSignOut()}
                >
                  <LogOut className="size-4" />
                  {dictionary.dashboard.signOut}
                </Button>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {activeUser && (
        <nav
          aria-label={dictionary.common.mobileNavigation}
          className={MOBILE_BOTTOM_NAV_CLASS}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
            const Icon = mobileNavIcons[item.key]

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'grid min-h-12 min-w-0 place-items-center gap-0.5 rounded-lg px-1 py-1 text-[0.68rem] font-medium leading-none transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="max-w-full truncate">
                  {getNavLabel(dictionary, locale, item.key)}
                </span>
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}

function maskEmail(email: string | null | undefined) {
  if (!email) return ''

  const [local, domain] = email.split('@')
  if (!domain) return email

  const start = local.slice(0, 1)
  const end = local.length > 2 ? local.slice(-1) : ''
  return `${start}${local.length > 2 ? '***' : '**'}${end}@${domain}`
}

function getMobileAccountCopy(locale: Locale): MobileAccountCopy {
  return {
    az: {
      title: 'Hesab',
      accountSection: 'Hesab',
      quickActions: 'S\u00fcr\u0259tli \u0259m\u0259liyyatlar',
    },
    en: {
      title: 'Account',
      accountSection: 'Account',
      quickActions: 'Quick actions',
    },
    ru: {
      title: '\u0410\u043a\u043a\u0430\u0443\u043d\u0442',
      accountSection: '\u0410\u043a\u043a\u0430\u0443\u043d\u0442',
      quickActions:
        '\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f',
    },
  }[locale]
}
