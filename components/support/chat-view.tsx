'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { formatDate, toIntlLocale } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'

export type ChatMessage = {
  id: string
  senderRole: 'user' | 'admin'
  body: string
  createdAt: string
}

const copy = {
  az: {
    placeholder: 'Mesajınızı yazın…',
    send: 'Göndər',
    failed: 'Mesaj göndərilmədi. Yenidən cəhd edin.',
    tooMany: 'Çox mesaj göndərildi. Bir neçə dəqiqə sonra yazın.',
  },
  en: {
    placeholder: 'Type your message…',
    send: 'Send',
    failed: 'The message was not sent. Please try again.',
    tooMany: 'Too many messages. Please wait a few minutes.',
  },
  ru: {
    placeholder: 'Напишите сообщение…',
    send: 'Отправить',
    failed: 'Сообщение не отправилось. Попробуйте ещё раз.',
    tooMany: 'Слишком много сообщений. Подождите несколько минут.',
  },
} as const

function formatTime(value: string, locale: Locale) {
  const date = new Date(value)
  const sameDay = new Date().toDateString() === date.toDateString()
  const time = new Intl.DateTimeFormat(toIntlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return sameDay ? time : `${formatDate(date, locale)} · ${time}`
}

/**
 * A chat transcript with a composer. `mine` decides which side is drawn on
 * the right: the user sees their own messages on the right, the admin theirs.
 */
export function ChatView({
  locale,
  messages,
  mine,
  otherLabel,
  emptyState,
  onSend,
  maxLength = 2000,
}: {
  locale: Locale
  messages: ChatMessage[]
  mine: 'user' | 'admin'
  otherLabel: string
  emptyState?: React.ReactNode
  onSend: (body: string) => Promise<'ok' | 'rate_limited' | 'error'>
  maxLength?: number
}) {
  const t = copy[locale]
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const submit = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const result = await onSend(body)
    setSending(false)
    if (result === 'ok') setDraft('')
    else setError(result === 'rate_limited' ? t.tooMany : t.failed)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && emptyState}
        {messages.map((message) => {
          const isMine = message.senderRole === mine
          return (
            <div
              key={message.id}
              className={cn(
                'flex max-w-[85%] flex-col gap-1',
                isMine ? 'self-end items-end' : 'self-start items-start',
              )}
            >
              {!isMine && (
                <span className="text-xs font-medium text-accent">
                  {otherLabel}
                </span>
              )}
              <p
                className={cn(
                  'whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  isMine
                    ? 'rounded-br-md bg-foreground text-background'
                    : 'rounded-bl-md border border-border bg-card',
                )}
              >
                {message.body}
              </p>
              <span className="text-[0.7rem] text-muted-foreground">
                {formatTime(message.createdAt, locale)}
              </span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          rows={1}
          maxLength={maxLength}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          className="max-h-40 min-h-11 flex-1 resize-y rounded-2xl border border-input bg-background px-4 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label={t.send}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-5" aria-hidden="true" />
          )}
        </button>
      </form>
      {error && (
        <p role="alert" className="px-4 pb-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Re-runs `callback` every `ms` while the tab is visible. */
export function usePolling(callback: () => void, ms: number) {
  const saved = useRef(callback)
  useEffect(() => {
    saved.current = callback
  }, [callback])
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') saved.current()
    }
    const id = window.setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms])
}
