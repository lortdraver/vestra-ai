import { NextResponse } from 'next/server'
import { getSupportSessionUser } from '@/lib/support/auth'
import {
  addSupportMessage,
  cleanSupportBody,
  getThreadWithUser,
  listThreadMessages,
  markThreadRead,
} from '@/lib/support/service'
import { notifyUserOfReply } from '@/lib/support/notify'
import { isUuid } from '@/lib/validation/uuid'

async function loadThread(params: Promise<unknown>) {
  const currentUser = await getSupportSessionUser()
  if (!currentUser?.isAdmin) return { error: 403 as const }
  const { id } = (await params) as { id: string }
  if (!isUuid(id)) return { error: 404 as const }
  const row = await getThreadWithUser(id)
  if (!row) return { error: 404 as const }
  return { currentUser, row }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<unknown> },
) {
  const result = await loadThread(params)
  if ('error' in result) {
    return NextResponse.json(
      { error: 'not_available' },
      { status: result.error },
    )
  }
  if (result.row.thread.unreadByAdmin) {
    await markThreadRead(result.row.thread.id, 'admin')
  }
  return NextResponse.json({
    user: { name: result.row.userName, email: result.row.userEmail },
    messages: await listThreadMessages(result.row.thread.id),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<unknown> },
) {
  const result = await loadThread(params)
  if ('error' in result) {
    return NextResponse.json(
      { error: 'not_available' },
      { status: result.error },
    )
  }
  const payload = (await request.json().catch(() => null)) as {
    body?: unknown
  } | null
  const body = cleanSupportBody(payload?.body)
  if (!body) {
    return NextResponse.json({ error: 'invalid_message' }, { status: 400 })
  }
  const shouldNotify = !result.row.thread.unreadByUser
  await addSupportMessage({
    threadId: result.row.thread.id,
    senderRole: 'admin',
    senderId: result.currentUser.id,
    body,
  })
  await markThreadRead(result.row.thread.id, 'admin')
  if (shouldNotify) {
    await notifyUserOfReply({ userEmail: result.row.userEmail, body })
  }
  return NextResponse.json({
    user: { name: result.row.userName, email: result.row.userEmail },
    messages: await listThreadMessages(result.row.thread.id),
  })
}
