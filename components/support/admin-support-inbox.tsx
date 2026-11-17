'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Inbox } from 'lucide-react'
import type { Locale } from '@/lib/i18n/config'
import { formatDate } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'
import { ChatView, usePolling, type ChatMessage } from './chat-view'

type ThreadSummary = {
  id: string
  unreadByAdmin: boolean
  lastMessageAt: string
  userName: string
  userEmail: string
  preview: string
  lastSender: 'user' | 'admin'
}

const copy = {
  az: {
    title: 'Dəstək çatları',
    empty: 'Hələ mesaj yoxdur.',
    pick: 'Söhbət seçin',
    you: 'Siz: ',
    back: 'Siyahı',
  },
  en: {
    title: 'Support chats',
    empty: 'No messages yet.',
    pick: 'Pick a conversation',
    you: 'You: ',
    back: 'List',
  },
  ru: {
    title: 'Чаты поддержки',
    empty: 'Сообщений пока нет.',
    pick: 'Выберите переписку',
    you: 'Вы: ',
    back: 'Список',
  },
} as const

/** Admin inbox: every user's conversation, newest and unread first. */
export function AdminSupportInbox({
  locale,
  initialThreadId,
}: {
  locale: Locale
  initialThreadId: string | null
}) {
  const t = copy[locale]
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(initialThreadId)
  const [active, setActive] = useState<{
    user: { name: string; email: string }
    messages: ChatMessage[]
  } | null>(null)

  const loadThreads = useCallback(async () => {
    const response = await fetch('/api/admin/support', { cache: 'no-store' })
    if (response.ok) {
      setThreads(
        ((await response.json()) as { threads: ThreadSummary[] }).threads,
      )
    }
  }, [])

  const loadActive = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/support/${id}`, {
      cache: 'no-store',
    })
    if (response.ok) setActive(await response.json())
  }, [])

  useEffect(() => {
    // The loaders only set state after an awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThreads()
  }, [loadThreads])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeId) void loadActive(activeId)
  }, [activeId, loadActive])
  usePolling(() => {
    void loadThreads()
    if (activeId) void loadActive(activeId)
  }, 15000)

  return (
    <section className="grid h-[calc(100svh-13rem)] min-h-[28rem] overflow-hidden rounded-3xl border border-foreground/10 bg-card shadow-sm md:h-[calc(100svh-10rem)] md:grid-cols-[20rem_minmax(0,1fr)]">
      <aside
        className={cn(
          'flex min-h-0 flex-col border-r border-border',
          activeId && 'hidden md:flex',
        )}
      >
        <h1 className="border-b border-border px-5 py-4 font-serif text-xl font-medium">
          {t.title}
        </h1>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {threads.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">{t.empty}</p>
          )}
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setActiveId(thread.id)}
              className={cn(
                'flex w-full flex-col gap-0.5 border-b border-border/60 px-5 py-3 text-left transition-colors hover:bg-muted/60',
                activeId === thread.id && 'bg-muted',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'truncate',
                    thread.unreadByAdmin && 'font-semibold',
                  )}
                >
                  {thread.userName}
                </span>
                {thread.unreadByAdmin && (
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-accent"
                    aria-label="new"
                  />
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {thread.lastSender === 'admin' ? t.you : ''}
                {thread.preview}
              </span>
              <span className="text-[0.7rem] text-muted-foreground">
                {formatDate(thread.lastMessageAt, locale)}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div
        className={cn('flex min-h-0 flex-col', !activeId && 'hidden md:flex')}
      >
        {activeId && active ? (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setActiveId(null)
                  setActive(null)
                }}
                aria-label={t.back}
                className="grid size-9 place-items-center rounded-full hover:bg-muted md:hidden"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="truncate font-medium">{active.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {active.user.email}
                </p>
              </div>
            </header>
            <ChatView
              locale={locale}
              messages={active.messages}
              mine="admin"
              otherLabel={active.user.name}
              onSend={async (body) => {
                const response = await fetch(`/api/admin/support/${activeId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ body }),
                })
                if (!response.ok) return 'error'
                setActive(await response.json())
                void loadThreads()
                return 'ok'
              }}
            />
          </>
        ) : (
          <div className="m-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="size-8" aria-hidden="true" />
            {t.pick}
          </div>
        )}
      </div>
    </section>
  )
}
