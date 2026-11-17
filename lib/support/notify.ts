/**
 * Short e-mail notifications for the support chat, sent through Resend (the
 * same provider as account e-mails). Failures are logged and never block the
 * chat message itself.
 */
function appUrl(path: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    'https://vestraapp.uk'
  return new URL(path, base).toString()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function send(input: {
  to: string[]
  subject: string
  text: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (
    process.env.EMAIL_PROVIDER !== 'resend' ||
    !apiKey ||
    !from ||
    input.to.length === 0
  ) {
    console.info('[support] e-mail notification skipped (email not configured)')
    return
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, ...input }),
    })
    if (!response.ok) {
      console.warn('[support] e-mail notification failed', response.status)
    }
  } catch (error) {
    console.warn(
      '[support] e-mail notification failed',
      error instanceof Error ? error.message : error,
    )
  }
}

export async function notifyAdminsOfMessage(input: {
  adminEmails: string[]
  userName: string
  userEmail: string
  body: string
  threadId: string
}) {
  const link = appUrl(`/dashboard/admin/support?thread=${input.threadId}`)
  const preview = input.body.slice(0, 500)
  await send({
    to: input.adminEmails,
    subject: `Vestra: новое сообщение от ${input.userName}`,
    text: `${input.userName} (${input.userEmail}) написал(а) в чат поддержки:\n\n${preview}\n\nОтветить: ${link}`,
    html: `<p><strong>${escapeHtml(input.userName)}</strong> (${escapeHtml(input.userEmail)}) написал(а) в чат поддержки:</p><blockquote style="white-space:pre-wrap;border-left:3px solid #a8865a;padding-left:12px;color:#333">${escapeHtml(preview)}</blockquote><p><a href="${link}">Открыть чат и ответить</a></p>`,
  })
}

export async function notifyUserOfReply(input: {
  userEmail: string
  body: string
}) {
  const link = appUrl('/dashboard/support')
  const preview = input.body.slice(0, 500)
  await send({
    to: [input.userEmail],
    subject: 'Vestra: ответ поддержки · Dəstək cavabı · Support reply',
    text: `${preview}\n\n${link}`,
    html: `<blockquote style="white-space:pre-wrap;border-left:3px solid #a8865a;padding-left:12px;color:#333">${escapeHtml(preview)}</blockquote><p><a href="${link}">Vestra</a></p>`,
  })
}
