import { createHmac, timingSafeEqual } from 'node:crypto'

function parseSignatureHeader(header: string | null) {
  if (!header) return null
  const parts = Object.fromEntries(
    header.split(';').flatMap((part) => {
      const [key, value] = part.split('=')
      return key && value ? [[key.trim(), value.trim()]] : []
    }),
  )
  return parts.ts && parts.h1
    ? { timestamp: parts.ts, signature: parts.h1 }
    : null
}

export function verifyPaddleSignature(input: {
  rawBody: string
  signatureHeader: string | null
  secret: string
}) {
  const parsed = parseSignatureHeader(input.signatureHeader)
  if (!parsed || !input.secret) return false

  const signedPayload = `${parsed.timestamp}:${input.rawBody}`
  const expected = createHmac('sha256', input.secret)
    .update(signedPayload)
    .digest('hex')

  try {
    const expectedBuffer = Buffer.from(expected, 'hex')
    const actualBuffer = Buffer.from(parsed.signature, 'hex')
    return (
      expectedBuffer.length === actualBuffer.length &&
      timingSafeEqual(expectedBuffer, actualBuffer)
    )
  } catch {
    return false
  }
}
