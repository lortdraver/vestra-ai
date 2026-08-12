import { cookies } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { ConsentManager } from '@/components/privacy/consent-manager'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { consentCopy } from '@/lib/privacy/copy'
import { consentCookieName, getConsent } from '@/lib/privacy/consent'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
})
const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-playfair',
})

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary()

  return {
    title: {
      default: dictionary.metadata.title,
      template: `%s | ${dictionary.common.brand}`,
    },
    description: dictionary.metadata.description,
    generator: 'v0.app',
    icons: {
      icon: [
        {
          url: '/icon-light-32x32.png',
          media: '(prefers-color-scheme: light)',
        },
        {
          url: '/icon-dark-32x32.png',
          media: '(prefers-color-scheme: dark)',
        },
        {
          url: '/icon.svg',
          type: 'image/svg+xml',
        },
      ],
      apple: '/apple-icon.png',
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#faf8f5',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()])
  const initialConsent = getConsent(cookieStore.get(consentCookieName)?.value)

  return (
    <html lang={locale} className="bg-background">
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        {children}
        <ConsentManager
          copy={consentCopy[locale]}
          initialConsent={initialConsent}
        />
      </body>
    </html>
  )
}
