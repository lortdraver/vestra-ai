'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CreditCard,
  HeartHandshake,
  LogOut,
  Shield,
  SlidersHorizontal,
  UserCog,
} from 'lucide-react'
import { authClient, useSession } from '@/lib/auth-client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LanguageSwitcher } from '@/components/language-switcher'
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

function getNavLabel(
  dictionary: Dictionary,
  locale: Locale,
  key: (typeof navItems)[number]['key'],
) {
  if (key === 'planner') {
    return { az: 'Planlayıcı', en: 'Planner', ru: 'План' }[locale]
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

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } finally {
      router.push('/sign-in')
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="font-serif text-lg font-semibold tracking-tight text-foreground"
          >
            {dictionary.common.brand}
          </Link>
          <nav
            aria-label={dictionary.common.mainNavigation}
            className="hidden items-center gap-1 md:flex"
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

        <div className="flex items-center gap-2">
          <LanguageSwitcher
            currentLocale={locale}
            label={dictionary.common.language}
          />
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
                    className="rounded-full border border-transparent hover:border-border aria-expanded:border-border aria-expanded:bg-muted"
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
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
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

      <nav
        aria-label={dictionary.common.mobileNavigation}
        className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden"
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
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
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
    </header>
  )
}
