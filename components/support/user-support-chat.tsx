'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { ChatView, usePolling, type ChatMessage } from './chat-view'

const copy = {
  az: {
    title: 'Dəstək',
    subtitle: 'Bizə burada yazın — cavab bu çatda və e-poçtunuzda görünəcək.',
    team: 'Vestra komandası',
    empty:
      'Sualınızı və ya problemi yazın. Adətən 24 saat ərzində cavab veririk.',
  },
  en: {
    title: 'Support',
    subtitle:
      'Write to us here — replies appear in this chat and in your e-mail.',
    team: 'Vestra team',
    empty:
      'Describe your question or problem. We usually reply within 24 hours.',
  },
  ru: {
    title: 'Поддержка',
    subtitle:
      'Пишите нам здесь — ответ появится в этом чате и придёт на почту.',
    team: 'Команда Vestra',
    empty: 'Опишите вопрос или проблему. Обычно отвечаем в течение 24 часов.',
  },
} as const

export function UserSupportChat({ locale }: { locale: Locale }) {
  const t = copy[locale]
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const load = useCallback(async () => {
    const response = await fetch('/api/support/thread', { cache: 'no-store' })
    if (response.ok) {
      const data = (await response.json()) as { messages: ChatMessage[] }
      setMessages(data.messages)
    }
  }, [])

  useEffect(() => {
    // load() only sets state after an awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  usePolling(() => void load(), 15000)

  return (
    <section className="flex h-[calc(100svh-13rem)] min-h-[26rem] flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-card shadow-sm md:h-[calc(100svh-10rem)]">
      <header className="border-b border-border px-5 py-4">
        <h1 className="font-serif text-2xl font-medium">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </header>
      <ChatView
        locale={locale}
        messages={messages}
        mine="user"
        otherLabel={t.team}
        emptyState={
          <div className="m-auto flex max-w-xs flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <span className="grid size-12 place-items-center rounded-full bg-muted">
              <MessageCircle className="size-6" aria-hidden="true" />
            </span>
            {t.empty}
          </div>
        }
        onSend={async (body) => {
          const response = await fetch('/api/support/thread', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body }),
          })
          if (response.status === 429) return 'rate_limited'
          if (!response.ok) return 'error'
          const data = (await response.json()) as { messages: ChatMessage[] }
          setMessages(data.messages)
          return 'ok'
        }}
      />
    </section>
  )
}
