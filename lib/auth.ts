import { betterAuth } from 'better-auth'
import { buildAccountEmailTemplate } from '@/lib/account/email-templates'
import {
  getAccountEmailProvider,
  getAccountEmailProviderDiagnostics,
} from '@/lib/account/email-provider'
import { getAuthTrustedOrigins } from '@/lib/auth-origin'
import { pool } from '@/lib/db'
import { getAppUrl, getBetterAuthSecret } from '@/lib/env'
import { sanitizeBetterAuthVerificationUrl } from '@/lib/email-verification-links'
import {
  localeCookieName,
  normalizeLocale,
  type Locale,
} from '@/lib/i18n/config'
import {
  buildPasswordResetUrl,
  passwordResetConfig,
} from '@/lib/password-reset'
import { trackServerEvent } from '@/lib/analytics/server'

const appUrl = getAppUrl()
const trustedOrigins = getAuthTrustedOrigins(appUrl)

function getRequestLocale(request?: Request | null): Locale {
  const cookieHeader = request?.headers.get('cookie')
  const cookieLocale = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieName}=`))
    ?.split('=')[1]

  return normalizeLocale(
    cookieLocale ??
      request?.headers.get('accept-language')?.split(',')[0] ??
      undefined,
  )
}

function getEmailVerificationExpiresIn() {
  const parsed = Number(
    process.env.EMAIL_VERIFICATION_EXPIRES_SECONDS ?? 86_400,
  )
  if (!Number.isFinite(parsed)) return 86_400
  return Math.min(Math.max(parsed, 900), 60 * 60 * 24 * 7)
}

export const auth = betterAuth({
  database: pool,
  secret: getBetterAuthSecret(),
  baseURL: appUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: passwordResetConfig.tokenExpiresInSeconds,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }, request) => {
      const resetUrl = buildPasswordResetUrl(token)
      const locale = getRequestLocale(request)
      const template = buildAccountEmailTemplate({
        kind: 'password_reset',
        locale,
        actionUrl: resetUrl,
      })
      const providerDiagnostics = getAccountEmailProviderDiagnostics()
      console.info('[password-reset] EMAIL_PROVIDER_SELECTED', {
        provider: providerDiagnostics.provider,
        fromConfigured: providerDiagnostics.fromConfigured,
        replyToConfigured: providerDiagnostics.replyToConfigured,
        resendApiKeyConfigured: providerDiagnostics.resendApiKeyConfigured,
        senderDomain: providerDiagnostics.senderDomain,
      })
      const provider = getAccountEmailProvider()
      await provider.send({
        to: user.email,
        kind: 'password_reset',
        locale,
        actionUrl: resetUrl,
        ...template,
      })
    },
    onPasswordReset: async ({ user }) => {
      console.info('[password-reset] PASSWORD_RESET_COMPLETED', {
        userId: user.id,
      })
      void trackServerEvent({
        eventName: 'password_reset_completed',
        userId: user.id,
        dedupeKey: `password-reset:${user.id}:${new Date().toISOString().slice(0, 13)}`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: getEmailVerificationExpiresIn(),
    sendVerificationEmail: async ({ user, url }, request) => {
      const safeUrl = sanitizeBetterAuthVerificationUrl(url)
      const locale = getRequestLocale(request)
      const template = buildAccountEmailTemplate({
        kind: 'email_verification',
        locale,
        actionUrl: safeUrl,
      })
      const providerDiagnostics = getAccountEmailProviderDiagnostics()
      console.info('[email-verification] EMAIL_PROVIDER_SELECTED', {
        provider: providerDiagnostics.provider,
        fromConfigured: providerDiagnostics.fromConfigured,
        replyToConfigured: providerDiagnostics.replyToConfigured,
        resendApiKeyConfigured: providerDiagnostics.resendApiKeyConfigured,
        senderDomain: providerDiagnostics.senderDomain,
      })
      const provider = getAccountEmailProvider()
      await provider.send({
        to: user.email,
        kind: 'email_verification',
        locale,
        actionUrl: safeUrl,
        ...template,
      })
    },
  },
  trustedOrigins,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
