'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { FaqSection } from '@/lib/public-content/copy'
import { cn } from '@/lib/utils'

export function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set())

  function toggleItem(id: string) {
    setOpenItems((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="grid gap-8">
      {sections.map((section, sectionIndex) => (
        <section key={section.title} className="grid gap-3">
          <h2 className="font-serif text-2xl font-medium text-foreground">
            {section.title}
          </h2>
          <div className="grid gap-3">
            {section.items.map((item, itemIndex) => {
              const id = `faq-${sectionIndex}-${itemIndex}`
              const panelId = `${id}-panel`
              const isOpen = openItems.has(id)

              return (
                <article
                  key={item.question}
                  className="rounded-2xl border border-border bg-card shadow-sm"
                >
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left font-medium text-foreground outline-none transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5"
                      onClick={() => toggleItem(id)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    hidden={!isOpen}
                    className="border-t border-border px-4 py-4 sm:px-5"
                  >
                    <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {item.answer}
                    </p>
                    {item.links?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.links.map((link) => (
                          <Link
                            key={`${link.href}-${link.label}`}
                            href={link.href}
                            className="inline-flex min-h-10 items-center rounded-full border border-border px-3 text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
