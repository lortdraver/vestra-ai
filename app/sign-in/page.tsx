import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'
import { AuthForm } from '@/components/auth-form'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: dictionary.common.signIn,
  }
}

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/dashboard')

  const dictionary = await getDictionary()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <AuthForm mode="sign-in" dictionary={dictionary} />
    </main>
  )
}
