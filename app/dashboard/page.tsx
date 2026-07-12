import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.dashboard.home,
  }
}

const sections = [
  {
    href: '/dashboard/wardrobe',
    key: 'wardrobe',
  },
  {
    href: '/dashboard/stylist',
    key: 'stylist',
  },
  {
    href: '/dashboard/planner',
    key: 'planner',
  },
  {
    href: '/dashboard/outfits',
    key: 'outfits',
  },
] as const

const plannerCopy = {
  az: {
    title: 'Planlayici',
    description:
      'Bugunun havasi, planiniz ve qarderobunuzdaki real geyimlerle ne geyinmeyi secin.',
    cta: 'Plani ac',
    milestone: 'Aktiv: hava uygun planlama',
  },
  en: {
    title: 'Planner',
    description:
      'See today’s weather, planned outfit, and generate weather-aware options from clothes you own.',
    cta: 'Open planner',
    milestone: 'Live: weather-aware planning',
  },
  ru: {
    title: 'План',
    description:
      'Смотрите погоду на сегодня, запланированный образ и варианты из ваших вещей.',
    cta: 'Открыть план',
    milestone: 'Активно: план по погоде',
  },
} as const

export default async function DashboardPage() {
  const [session, dictionary, locale] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getDictionary(),
    getLocale(),
  ])
  const firstName = session?.user?.name?.split(' ')[0] ?? ''

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground text-balance">
          {dictionary.dashboard.greeting}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          {dictionary.dashboard.foundationReady}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => {
          const content =
            section.key === 'planner'
              ? plannerCopy[locale]
              : dictionary.dashboard.sections[section.key]
          const title =
            section.key === 'planner'
              ? plannerCopy[locale].title
              : dictionary.dashboard[section.key]

          return (
            <Card key={section.href} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-serif text-xl font-medium">
                  {title}
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  {content.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-accent">
                  {content.milestone}
                </p>
                <Link
                  href={section.href}
                  className={buttonVariants({
                    variant: 'outline',
                    className: 'w-fit',
                  })}
                >
                  {content.cta}
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
