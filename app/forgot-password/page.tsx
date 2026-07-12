import type { Metadata } from 'next'
import { RecoveryForm } from '@/components/account/recovery-form'
import { getDictionary } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()
  return { title: dictionary.auth.forgotPasswordTitle }
}

export default async function ForgotPasswordPage() {
  const dictionary = await getDictionary()

  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <RecoveryForm dictionary={dictionary} mode="forgot" />
    </main>
  )
}
