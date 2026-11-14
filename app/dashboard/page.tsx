import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Shirt,
  Sparkles,
} from 'lucide-react'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { outfit, outfitItem, wardrobeItem } from '@/lib/db/schema'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { toIntlLocale } from '@/lib/i18n/format'
import type { Locale } from '@/lib/i18n/config'
import { WeatherChip } from '@/components/dashboard/weather-chip'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.dashboard.home,
  }
}

const copy = {
  az: {
    hello: 'Salam',
    outfitOfDay: 'Günün obrazı',
    newOutfit: 'Yeni obraz',
    plan: 'Həftə planı',
    noOutfitTitle: 'Hələ obraz yoxdur',
    noOutfitBody: 'Stilist geyimlərinizdən ilk obrazı yığsın.',
    buildFirst: 'İlk obrazı yığ',
    add: 'Geyim əlavə et',
    addHint: 'Foto → 3 saniyəyə skan',
    planHint: 'Havaya uyğun obrazlar',
    build: 'Obraz yığ',
    buildHint: 'Dərs, iş, toy, görüş…',
    recent: 'Son əlavə olunanlar',
    all: 'Bütün qarderob · {count}',
    emptyTitle: 'Qarderobunuz boşdur',
    emptyBody: 'Bir neçə geyimin şəklini çəkin — qalanını biz edəcəyik.',
    steps: ['Geyimi çəkin', 'Avtomatik tanıyırıq', 'Obraz alın'],
  },
  en: {
    hello: 'Hello',
    outfitOfDay: 'Outfit of the day',
    newOutfit: 'New outfit',
    plan: 'Week plan',
    noOutfitTitle: 'No outfits yet',
    noOutfitBody: 'Let the stylist build your first look from your clothes.',
    buildFirst: 'Build my first outfit',
    add: 'Add an item',
    addHint: 'Photo → scanned in 3 s',
    planHint: 'Outfits for the weather',
    build: 'Build an outfit',
    buildHint: 'Class, work, wedding, date…',
    recent: 'Recently added',
    all: 'Whole wardrobe · {count}',
    emptyTitle: 'Your wardrobe is empty',
    emptyBody: 'Snap a few pieces — we will take care of the rest.',
    steps: ['Snap an item', 'We recognise it', 'Get outfits'],
  },
  ru: {
    hello: 'Привет',
    outfitOfDay: 'Образ дня',
    newOutfit: 'Новый образ',
    plan: 'План недели',
    noOutfitTitle: 'Образов пока нет',
    noOutfitBody: 'Пусть стилист соберёт первый образ из ваших вещей.',
    buildFirst: 'Собрать первый образ',
    add: 'Добавить вещь',
    addHint: 'Фото → скан за 3 сек',
    planHint: 'Образы под погоду',
    build: 'Собрать образ',
    buildHint: 'Учёба, работа, той, свидание…',
    recent: 'Недавно добавлено',
    all: 'Весь гардероб · {count}',
    emptyTitle: 'Гардероб пока пуст',
    emptyBody: 'Сфотографируйте несколько вещей — остальное сделаем мы.',
    steps: ['Сфотографируйте вещь', 'Мы её распознаем', 'Получите образы'],
  },
} as const

type Thumb = { id: string; name: string; src: string }

function thumbOf(row: typeof wardrobeItem.$inferSelect): Thumb {
  return {
    id: row.id,
    name: row.name,
    src: row.thumbnailImageUrl ?? row.processedImageUrl ?? row.imageUrl,
  }
}

async function loadHome(userId: string) {
  const [latestOutfit] = await db
    .select()
    .from(outfit)
    .where(and(eq(outfit.userId, userId), isNull(outfit.deletedAt)))
    .orderBy(desc(outfit.isSaved), desc(outfit.createdAt))
    .limit(1)

  let outfitThumbs: Thumb[] = []
  if (latestOutfit) {
    const items = await db
      .select({ wardrobeItemId: outfitItem.wardrobeItemId })
      .from(outfitItem)
      .where(
        and(
          eq(outfitItem.userId, userId),
          eq(outfitItem.outfitId, latestOutfit.id),
        ),
      )
    const ids = items.map((item) => item.wardrobeItemId)
    if (ids.length > 0) {
      const rows = await db
        .select()
        .from(wardrobeItem)
        .where(
          and(
            eq(wardrobeItem.userId, userId),
            inArray(wardrobeItem.id, ids),
            eq(wardrobeItem.imageDeletionStatus, 'active'),
          ),
        )
      outfitThumbs = ids
        .map((id) => rows.find((row) => row.id === id))
        .filter((row) => row !== undefined)
        .map(thumbOf)
    }
  }

  const activeItems = and(
    eq(wardrobeItem.userId, userId),
    eq(wardrobeItem.imageDeletionStatus, 'active'),
  )
  const [recentRows, [total]] = await Promise.all([
    db
      .select()
      .from(wardrobeItem)
      .where(activeItems)
      .orderBy(desc(wardrobeItem.createdAt))
      .limit(8),
    db.select({ value: count() }).from(wardrobeItem).where(activeItems),
  ])

  return {
    outfitTitle: outfitThumbs.length > 0 ? latestOutfit?.title : null,
    outfitThumbs,
    recent: recentRows.map(thumbOf),
    total: total?.value ?? 0,
  }
}

function ItemTile({ item, className }: { item: Thumb; className?: string }) {
  return (
    <div
      className={cn(
        'aspect-square overflow-hidden rounded-2xl bg-[linear-gradient(135deg,_var(--muted),_var(--background))]',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className="size-full object-contain p-1.5"
      />
    </div>
  )
}

function ActionCard({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string
  icon: typeof Camera
  title: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-3 rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted transition group-hover:bg-foreground group-hover:text-background">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {hint}
        </span>
      </span>
    </Link>
  )
}

function formatToday(locale: Locale) {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

export default async function DashboardPage() {
  const [session, locale] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getLocale(),
  ])
  const t = copy[locale]
  const firstName = session?.user?.name?.split(' ')[0] ?? ''
  const home = session?.user?.id
    ? await loadHome(session.user.id)
    : { outfitTitle: null, outfitThumbs: [], recent: [], total: 0 }

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {formatToday(locale)}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            {t.hello}
            {firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <WeatherChip />
      </header>

      {home.total === 0 ? (
        <section className="rounded-3xl border border-foreground/10 bg-card p-6 text-center shadow-sm md:p-10">
          <h2 className="font-serif text-2xl font-medium">{t.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            {t.emptyBody}
          </p>
          <ol className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[Camera, Shirt, Sparkles].map((Icon, index) => (
              <li
                key={t.steps[index]}
                className="flex flex-col items-center gap-2 rounded-2xl bg-muted/50 p-4 text-sm"
              >
                <span className="grid size-12 place-items-center rounded-full bg-background">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span>
                  {index + 1}. {t.steps[index]}
                </span>
              </li>
            ))}
          </ol>
          <Link
            href="/dashboard/wardrobe?add=1"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 font-medium text-background"
          >
            <Camera className="size-4" aria-hidden="true" />
            {t.add}
          </Link>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="flex min-w-0 flex-col gap-4 rounded-3xl border border-foreground/10 bg-card p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.08em] text-accent">
                  {t.outfitOfDay}
                </p>
                {home.outfitTitle ? (
                  <p className="min-w-0 truncate text-sm text-muted-foreground">
                    {home.outfitTitle}
                  </p>
                ) : null}
              </div>
              {home.outfitThumbs.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {home.outfitThumbs.slice(0, 4).map((item) => (
                    <ItemTile key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/50 p-5 text-center">
                  <p className="font-medium">{t.noOutfitTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.noOutfitBody}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/stylist"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {home.outfitThumbs.length > 0 ? t.newOutfit : t.buildFirst}
                </Link>
                <Link
                  href="/dashboard/planner"
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-input px-5 text-sm"
                >
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {t.plan}
                </Link>
              </div>
            </section>

            <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-1">
              <ActionCard
                href="/dashboard/wardrobe?add=1"
                icon={Camera}
                title={t.add}
                hint={t.addHint}
              />
              <ActionCard
                href="/dashboard/planner"
                icon={CalendarDays}
                title={t.plan}
                hint={t.planHint}
              />
              <div className="col-span-2 lg:col-span-1">
                <ActionCard
                  href="/dashboard/stylist"
                  icon={Sparkles}
                  title={t.build}
                  hint={t.buildHint}
                />
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-xl font-medium md:text-2xl">
                {t.recent}
              </h2>
              <Link
                href="/dashboard/wardrobe"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {t.all.replace('{count}', String(home.total))}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-2 md:grid-cols-8 md:gap-3">
              {home.recent.map((item, index) => (
                <Link
                  key={item.id}
                  href="/dashboard/wardrobe"
                  className={cn(index >= 4 && 'hidden md:block')}
                >
                  <ItemTile item={item} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
