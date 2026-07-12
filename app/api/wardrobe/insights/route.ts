import { headers } from 'next/headers'
import { apiError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { getWardrobeInsightsForUser } from '@/lib/wear/server'
import { parseWearRange } from '@/lib/wear/validation'

async function getCurrentUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return apiError('unauthorized', 401)

  const url = new URL(request.url)
  const range = parseWearRange(url.searchParams.get('range'))
  const insights = await getWardrobeInsightsForUser({ userId, range })

  return Response.json({ insights })
}
