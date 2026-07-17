import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, MailCheck, TriangleAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/server'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()
  return { title: `${dictionary.emailVerification.pageTitle} | Vestra` }
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getState(input: {
  status?: string
  error?: string
  dictionary: Awaited<ReturnType<typeof getDictionary>>
}) {
  const t = input.dictionary.emailVerification
  const normalizedError = input.error?.toUpperCase()

  if (normalizedError === 'TOKEN_EXPIRED') {
    return {
      tone: 'warning' as const,
      title: t.expiredTitle,
      body: t.expiredBody,
    }
  }

  if (
    normalizedError === 'INVALID_TOKEN' ||
    normalizedError === 'USER_NOT_FOUND'
  ) {
    return {
      tone: 'error' as const,
      title: t.invalidTitle,
      body: t.invalidBody,
    }
  }

  if (input.status === 'sent') {
    return {
      tone: 'neutral' as const,
      title: t.sentTitle,
      body: t.sentBody,
    }
  }

  if (input.status === 'already_verified') {
    return {
      tone: 'success' as const,
      title: t.alreadyVerifiedTitle,
      body: t.alreadyVerifiedBody,
    }
  }

  return {
    tone: 'success' as const,
    title: t.successTitle,
    body: t.successBody,
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [dictionary, params] = await Promise.all([
    getDictionary(),
    searchParams,
  ])
  const state = getState({
    status: first(params.status),
    error: first(params.error),
    dictionary,
  })
  const Icon =
    state.tone === 'success'
      ? CheckCircle2
      : state.tone === 'neutral'
        ? MailCheck
        : TriangleAlert

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-medium text-muted-foreground">
          {dictionary.emailVerification.pageTitle}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-medium tracking-tight">
          {state.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {state.body}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className={buttonVariants()}>
            {dictionary.emailVerification.openDashboard}
          </Link>
          <Link
            href="/sign-in"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            {dictionary.emailVerification.signIn}
          </Link>
        </div>
      </section>
    </main>
  )
}
