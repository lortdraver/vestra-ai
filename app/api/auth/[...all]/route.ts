import { auth } from '@/lib/auth'
import {
  extractAuthErrorDetails,
  sanitizeDiagnosticMessage,
} from '@/lib/auth-diagnostics/shared'
import { getServerAuthOriginDiagnostic } from '@/lib/auth-diagnostics/server'
import { toNextJsHandler } from 'better-auth/next-js'

const handlers = toNextJsHandler(auth.handler)

export const GET = handlers.GET

function isEmailSignInRequest(request: Request) {
  return new URL(request.url).pathname.endsWith('/sign-in/email')
}

async function readErrorPayload(response: Response) {
  try {
    return await response.clone().json()
  } catch {
    const text = await response
      .clone()
      .text()
      .catch(() => '')
    return text ? { message: sanitizeDiagnosticMessage(text) } : null
  }
}

export async function POST(request: Request) {
  if (!isEmailSignInRequest(request)) {
    return handlers.POST(request)
  }

  const originDiagnostics = getServerAuthOriginDiagnostic(request.headers)
  console.info('[auth] SIGN_IN_STARTED', {
    requestOrigin: originDiagnostics.requestOrigin,
    betterAuthHost: originDiagnostics.betterAuthHost,
    requestOriginMatchesTrustedOrigins:
      originDiagnostics.requestOriginMatchesTrustedOrigins,
  })

  try {
    const response = await handlers.POST(request)
    const errorPayload = response.ok ? null : await readErrorPayload(response)
    const errorDetails = errorPayload
      ? extractAuthErrorDetails(errorPayload)
      : null

    console.info('[auth] SIGN_IN_RESPONSE_RECEIVED', {
      httpStatus: response.status,
      betterAuthCode: errorDetails?.code ?? null,
      safeMessage: errorDetails?.message ?? null,
      requestOrigin: originDiagnostics.requestOrigin,
      betterAuthHost: originDiagnostics.betterAuthHost,
      requestOriginMatchesTrustedOrigins:
        originDiagnostics.requestOriginMatchesTrustedOrigins,
      isTopLevelError: errorDetails?.isTopLevelError ?? false,
      isNestedBetterFetchError: errorDetails?.isNestedBetterFetchError ?? false,
    })

    if (response.ok) {
      console.info('[auth] SIGN_IN_SUCCEEDED', {
        httpStatus: response.status,
        requestOrigin: originDiagnostics.requestOrigin,
        betterAuthHost: originDiagnostics.betterAuthHost,
        requestOriginMatchesTrustedOrigins:
          originDiagnostics.requestOriginMatchesTrustedOrigins,
      })
    } else {
      console.warn('[auth] SIGN_IN_FAILED', {
        httpStatus: response.status,
        betterAuthCode: errorDetails?.code ?? null,
        safeMessage: errorDetails?.message ?? null,
        requestOrigin: originDiagnostics.requestOrigin,
        betterAuthHost: originDiagnostics.betterAuthHost,
        requestOriginMatchesTrustedOrigins:
          originDiagnostics.requestOriginMatchesTrustedOrigins,
        isTopLevelError: errorDetails?.isTopLevelError ?? false,
        isNestedBetterFetchError:
          errorDetails?.isNestedBetterFetchError ?? false,
      })
    }

    return response
  } catch (error) {
    const errorDetails = extractAuthErrorDetails(error)

    console.error('[auth] SIGN_IN_FAILED', {
      httpStatus: errorDetails.status,
      betterAuthCode: errorDetails.code,
      safeMessage: errorDetails.message,
      requestOrigin: originDiagnostics.requestOrigin,
      betterAuthHost: originDiagnostics.betterAuthHost,
      requestOriginMatchesTrustedOrigins:
        originDiagnostics.requestOriginMatchesTrustedOrigins,
      isTopLevelError: errorDetails.isTopLevelError,
      isNestedBetterFetchError: errorDetails.isNestedBetterFetchError,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : null,
    })

    throw error
  }
}
