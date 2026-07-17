import type { Locale } from '@/lib/i18n/config'

export type AccountEmailTemplateInput = {
  kind: 'password_reset' | 'email_verification'
  locale: Locale
  actionUrl: string
  appName?: string
}

const copy = {
  az: {
    verificationSubject: 'Vestra e-poçtunuzu təsdiqləyin',
    verificationTitle: 'E-poçtunuzu təsdiqləyin',
    verificationBody:
      'Vestra hesabınızı aktivləşdirmək üçün aşağıdakı təhlükəsiz linki açın.',
    verificationCta: 'E-poçtu təsdiqlə',
    resetSubject: 'Vestra şifrə bərpası',
    resetTitle: 'Şifrənizi bərpa edin',
    resetBody: 'Şifrənizi yeniləmək üçün aşağıdakı təhlükəsiz linki açın.',
    resetCta: 'Şifrəni yenilə',
    expiry:
      'Bu linkin vaxtı bitəcək. Linki siz istəməmisinizsə, bu məktubu nəzərə almayın.',
    fallback: 'Düymə işləmirsə, bu linki brauzerinizə yapışdırın:',
  },
  en: {
    verificationSubject: 'Verify your Vestra email',
    verificationTitle: 'Verify your email',
    verificationBody:
      'Open the secure link below to activate your Vestra account.',
    verificationCta: 'Verify email',
    resetSubject: 'Reset your Vestra password',
    resetTitle: 'Reset your password',
    resetBody: 'Open the secure link below to update your password.',
    resetCta: 'Reset password',
    expiry:
      'This link expires soon. If you did not request it, you can ignore this email.',
    fallback: 'If the button does not work, paste this link into your browser:',
  },
  ru: {
    verificationSubject: 'Подтвердите e-mail Vestra',
    verificationTitle: 'Подтвердите e-mail',
    verificationBody:
      'Откройте безопасную ссылку ниже, чтобы активировать аккаунт Vestra.',
    verificationCta: 'Подтвердить e-mail',
    resetSubject: 'Сброс пароля Vestra',
    resetTitle: 'Сбросьте пароль',
    resetBody: 'Откройте безопасную ссылку ниже, чтобы обновить пароль.',
    resetCta: 'Сбросить пароль',
    expiry:
      'Срок действия ссылки ограничен. Если вы не запрашивали письмо, просто проигнорируйте его.',
    fallback: 'Если кнопка не работает, вставьте эту ссылку в браузер:',
  },
} as const

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildAccountEmailTemplate(input: AccountEmailTemplateInput) {
  const t = copy[input.locale]
  const isVerification = input.kind === 'email_verification'
  const subject = isVerification ? t.verificationSubject : t.resetSubject
  const title = isVerification ? t.verificationTitle : t.resetTitle
  const body = isVerification ? t.verificationBody : t.resetBody
  const cta = isVerification ? t.verificationCta : t.resetCta
  const appName = input.appName ?? 'Vestra'
  const safeUrl = escapeHtml(input.actionUrl)

  const text = [
    `${appName}: ${title}`,
    '',
    body,
    '',
    input.actionUrl,
    '',
    t.expiry,
  ].join('\n')

  const html = `<!doctype html>
<html lang="${input.locale}">
  <body style="margin:0;background:#f7f4ef;font-family:Inter,Arial,sans-serif;color:#1f1a17;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e7ddd0;border-radius:24px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 18px;font-size:14px;color:#7b6f65;">${escapeHtml(appName)}</p>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;font-weight:600;color:#1f1a17;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4f463f;">${escapeHtml(body)}</p>
                <p style="margin:0 0 24px;">
                  <a href="${safeUrl}" style="display:inline-block;border-radius:999px;background:#1f1a17;color:#fff;padding:12px 18px;text-decoration:none;font-size:14px;font-weight:600;">${escapeHtml(cta)}</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#7b6f65;">${escapeHtml(t.fallback)}</p>
                <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#7b6f65;word-break:break-all;">${safeUrl}</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#7b6f65;">${escapeHtml(t.expiry)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  return { subject, text, html }
}
