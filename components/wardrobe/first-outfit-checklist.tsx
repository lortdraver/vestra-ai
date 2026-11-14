import Link from 'next/link'
import { Check, Footprints, Shirt, Sparkles } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import type { WardrobeItemDto } from '@/lib/wardrobe/types'
import { cn } from '@/lib/utils'

const copy = {
  az: {
    title: 'İlk obrazınıza 3 addım',
    top: 'Üst geyim',
    bottom: 'Alt geyim və ya don',
    shoes: 'Ayaqqabı',
    ready: 'Hazırdır! Stilist ilk obrazı yığa bilər.',
    open: 'Obraz yığ',
  },
  en: {
    title: '3 steps to your first outfit',
    top: 'A top',
    bottom: 'A bottom or a dress',
    shoes: 'Shoes',
    ready: 'All set! The stylist can build your first outfit.',
    open: 'Build an outfit',
  },
  ru: {
    title: '3 шага до первого образа',
    top: 'Верх',
    bottom: 'Низ или платье',
    shoes: 'Обувь',
    ready: 'Готово! Стилист может собрать первый образ.',
    open: 'Собрать образ',
  },
} as const

/**
 * Shows which core pieces are still missing before the stylist can build a
 * complete outfit. Hidden once the wardrobe has a top, a bottom and shoes.
 */
export function FirstOutfitChecklist({
  locale,
  items,
}: {
  locale: Locale
  items: WardrobeItemDto[]
}) {
  const roles = new Set(items.map((item) => item.category))
  const steps = [
    {
      key: 'top',
      done: roles.has('top') || roles.has('one_piece'),
      Icon: Shirt,
    },
    {
      key: 'bottom',
      done: roles.has('bottom') || roles.has('one_piece'),
      Icon: Shirt,
    },
    { key: 'shoes', done: roles.has('shoes'), Icon: Footprints },
  ] as const
  const doneCount = steps.filter((step) => step.done).length
  const t = copy[locale]

  if (items.length === 0) return null
  if (doneCount === steps.length && items.length > 6) return null

  return (
    <section className="rounded-2xl border border-foreground/10 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-medium">{t.title}</h2>
        <span className="text-sm text-muted-foreground">
          {doneCount}/{steps.length}
        </span>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-2">
        {steps.map(({ key, done, Icon }) => (
          <li
            key={key}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
              done
                ? 'border-foreground/15 bg-muted/60 text-muted-foreground line-through'
                : 'border-accent/40 text-foreground',
            )}
          >
            {done ? (
              <Check className="size-4 text-accent" aria-hidden="true" />
            ) : (
              <Icon className="size-4" aria-hidden="true" />
            )}
            {t[key]}
          </li>
        ))}
      </ol>
      {doneCount === steps.length && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span>{t.ready}</span>
          <Link
            href="/dashboard/stylist"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-background"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {t.open}
          </Link>
        </div>
      )}
    </section>
  )
}
