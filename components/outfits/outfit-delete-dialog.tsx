'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { OutfitDto } from '@/lib/stylist'
import type { OutfitDeleteScope } from '@/lib/outfits/client'

export type OutfitDeleteDialogState = {
  outfit: OutfitDto
  scope: OutfitDeleteScope
  plannerReferences: number
}

export function OutfitDeleteDialog({
  dictionary,
  state,
  isDeleting,
  onClose,
  onConfirm,
}: {
  dictionary: Dictionary
  state: OutfitDeleteDialogState | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const t = dictionary.outfits

  useEffect(() => {
    if (!state) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    const firstControl = dialogRef.current?.querySelector<HTMLElement>('button')
    firstControl?.focus()

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDeleting, onClose, state])

  if (!state) return null

  const isSavedScope = state.scope === 'saved'
  const hasPlannerReferences = state.plannerReferences > 0

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end bg-foreground/25 p-3 backdrop-blur-sm md:place-items-center md:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outfit-delete-title"
        aria-describedby="outfit-delete-description"
        className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h2
              id="outfit-delete-title"
              className="font-serif text-2xl font-medium"
            >
              {t.deletion.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-foreground">
              {state.outfit.title}
            </p>
            <p
              id="outfit-delete-description"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            >
              {isSavedScope
                ? t.deletion.savedDescription
                : t.deletion.historyDescription}
            </p>
          </div>
        </div>

        {hasPlannerReferences && (
          <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="grid gap-1.5">
                <p>
                  {t.deletion.plannerWarning.replace(
                    '{count}',
                    String(state.plannerReferences),
                  )}
                </p>
                <p className="text-muted-foreground">
                  {t.deletion.plannerPreserved}
                </p>
                <p className="text-muted-foreground">
                  {t.deletion.wearHistoryPreserved}
                </p>
              </div>
            </div>
          </div>
        )}

        {!hasPlannerReferences && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t.deletion.wearHistoryPreserved}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t.actions.cancelDelete}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 />
            {isDeleting
              ? t.actions.deleting
              : hasPlannerReferences
                ? t.actions.confirmDeleteScheduled
                : t.actions.confirmDelete}
          </Button>
        </div>
      </div>
    </div>
  )
}
