import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { getDictionary } from '@/lib/i18n/server'
import { deleteWearLogForUser } from '@/lib/wear/server'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<unknown> },
) {
  const userId = await getCurrentUserId()
  if (!userId) return apiError('unauthorized', 401)

  const { id } = (await params) as { id: string }
  const deleted = await deleteWearLogForUser(userId, id)
  if (!deleted) {
    const dictionary = await getDictionary()
    return NextResponse.json(
      { error: 'not_found', message: dictionary.wear.errors.not_found },
      { status: 404 },
    )
  }

  return NextResponse.json({ ok: true })
}
