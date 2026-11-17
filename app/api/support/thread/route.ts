import { NextResponse } from 'next/server'
import { getSupportSessionUser } from '@/lib/support/auth'
import {
  addSupportMessage,
  cleanSupportBody,
  getAdminEmails,
  getOrCreateThreadForUser,
  getThreadForUser,
  isUserRateLimited,
  listThreadMessages,
  markThreadRead,
} from '@/lib/support/service'
import { notifyAdminsOfMessage } from '@/lib/support/notify'

/** The signed-in user's conversation with support. */
export async function GET() {
  const currentUser = await getSupportSessionUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const thread = await getThreadForUser(currentUser.id)
  if (!thread) return NextResponse.json({ messages: [] })
  if (thread.unreadByUser) await markThreadRead(thread.id, 'user')
  return NextResponse.json({ messages: await listThreadMessages(thread.id) })
}

export async function POST(request: Request) {
  const currentUser = await getSupportSessionUser()
  if (!currentUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const payload = (await request.json().catch(() => null)) as {
    body?: unknown
  } | null
  const body = cleanSupportBody(payload?.body)
  if (!body) {
    return NextResponse.json({ error: 'invalid_message' }, { status: 400 })
  }

  const thread = await getOrCreateThreadForUser(currentUser.id)
  if (await isUserRateLimited(thread.id)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  // Only e-mail the team for the first unread message, not every line.
  const shouldNotify = !thread.unreadByAdmin
  await addSupportMessage({
    threadId: thread.id,
    senderRole: 'user',
    senderId: currentUser.id,
    body,
  })
  if (shouldNotify) {
    await notifyAdminsOfMessage({
      adminEmails: await getAdminEmails(),
      userName: currentUser.name,
      userEmail: currentUser.email,
      body,
      threadId: thread.id,
    })
  }
  return NextResponse.json({ messages: await listThreadMessages(thread.id) })
}
