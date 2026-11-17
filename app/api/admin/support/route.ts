import { NextResponse } from 'next/server'
import { getSupportSessionUser } from '@/lib/support/auth'
import { listThreadsForAdmin } from '@/lib/support/service'

export async function GET() {
  const currentUser = await getSupportSessionUser()
  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return NextResponse.json({ threads: await listThreadsForAdmin() })
}
