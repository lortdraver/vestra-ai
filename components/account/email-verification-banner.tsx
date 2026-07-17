'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type ResendResponse = {
  ok?: boolean
  status?: 'sent' | 'already_verified'
  code?: string
  error?: string
  retryAfter?: number
}

function format(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

export function EmailVerificationBanner({
  email,
  dictionary,
}: {
  email: string
  dictionary: Dictionary
}) {
  const t = dictionary.emailVerification
  const [isSending, setIsSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(
    null,
  )

  useEffect(() => {
    if (cooldown <= 0) return
    const interval = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [cooldown])

  const resend = async () => {
    if (isSending || cooldown > 0) return

    setIsSending(true)
    setMessage(null)
    setMessageKind(null)

    try {
      const response = await fetch('/api/account/resend-verification', {
        method: 'POST',
      })
      const data = (await response
        .json()
        .catch(() => null)) as ResendResponse | null

      if (response.status === 429) {
        setCooldown(data?.retryAfter ?? 60)
        setMessage(t.rateLimited)
        setMessageKind('error')
        return
      }

      if (!response.ok) {
        setMessage(t.resendError)
        setMessageKind('error')
        return
      }

      if (data?.status === 'already_verified') {
        setMessage(t.resendAlreadyVerified)
      } else {
        setMessage(t.resendSuccess)
        setCooldown(60)
      }
      setMessageKind('success')
    } catch {
      setMessage(t.resendError)
      setMessageKind('error')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section
      className="border-b border-amber-200/70 bg-amber-50/80 px-4 py-3 text-amber-950 md:px-6"
      aria-labelledby="email-verification-title"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-amber-700 shadow-sm">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="email-verification-title" className="text-sm font-semibold">
              {t.bannerTitle}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
              {format(t.bannerBody, { email })}
            </p>
            {message && (
              <p
                className="mt-2 flex items-center gap-1.5 text-sm"
                role="status"
              >
                {messageKind === 'success' ? (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                ) : (
                  <AlertCircle className="size-4" aria-hidden="true" />
                )}
                {message}
              </p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-amber-300 bg-white/80 text-amber-950 hover:bg-white"
          onClick={resend}
          disabled={isSending || cooldown > 0}
        >
          {cooldown > 0
            ? format(t.resendCooldown, { seconds: cooldown })
            : t.resend}
        </Button>
      </div>
    </section>
  )
}
