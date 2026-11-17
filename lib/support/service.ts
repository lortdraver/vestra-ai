import { and, asc, count, desc, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { supportMessage, supportThread, user } from '@/lib/db/schema'
import { roles } from '@/lib/roles'

export const SUPPORT_MESSAGE_MAX_LENGTH = 2000
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX_MESSAGES = 20

export type SupportSender = 'user' | 'admin'

export type SupportMessageDto = {
  id: string
  senderRole: SupportSender
  body: string
  createdAt: string
}

export function cleanSupportBody(value: unknown) {
  if (typeof value !== 'string') return null
  const body = value.replace(/\r\n/g, '\n').trim()
  if (!body || body.length > SUPPORT_MESSAGE_MAX_LENGTH) return null
  return body
}

export async function getThreadForUser(userId: string) {
  const [thread] = await db
    .select()
    .from(supportThread)
    .where(eq(supportThread.userId, userId))
    .limit(1)
  return thread ?? null
}

export async function getOrCreateThreadForUser(userId: string) {
  const existing = await getThreadForUser(userId)
  if (existing) return existing
  const [created] = await db
    .insert(supportThread)
    .values({ userId })
    .onConflictDoNothing()
    .returning()
  return created ?? (await getThreadForUser(userId))!
}

export async function listThreadMessages(
  threadId: string,
): Promise<SupportMessageDto[]> {
  const rows = await db
    .select()
    .from(supportMessage)
    .where(eq(supportMessage.threadId, threadId))
    .orderBy(asc(supportMessage.createdAt))
    .limit(500)
  return rows.map((row) => ({
    id: row.id,
    senderRole: row.senderRole === 'admin' ? 'admin' : 'user',
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }))
}

/** True when the user has sent too many messages in the last 10 minutes. */
export async function isUserRateLimited(threadId: string) {
  const [result] = await db
    .select({ value: count() })
    .from(supportMessage)
    .where(
      and(
        eq(supportMessage.threadId, threadId),
        eq(supportMessage.senderRole, 'user'),
        gte(supportMessage.createdAt, new Date(Date.now() - RATE_WINDOW_MS)),
      ),
    )
  return (result?.value ?? 0) >= RATE_MAX_MESSAGES
}

export async function addSupportMessage(input: {
  threadId: string
  senderRole: SupportSender
  senderId: string
  body: string
}) {
  const now = new Date()
  const [message] = await db
    .insert(supportMessage)
    .values({ ...input, createdAt: now })
    .returning()
  await db
    .update(supportThread)
    .set(
      input.senderRole === 'user'
        ? { lastMessageAt: now, unreadByAdmin: true, status: 'open' }
        : { lastMessageAt: now, unreadByUser: true },
    )
    .where(eq(supportThread.id, input.threadId))
  return message
}

export async function markThreadRead(threadId: string, reader: SupportSender) {
  await db
    .update(supportThread)
    .set(
      reader === 'admin' ? { unreadByAdmin: false } : { unreadByUser: false },
    )
    .where(eq(supportThread.id, threadId))
}

export async function listThreadsForAdmin() {
  const threads = await db
    .select({
      id: supportThread.id,
      status: supportThread.status,
      unreadByAdmin: supportThread.unreadByAdmin,
      lastMessageAt: supportThread.lastMessageAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(supportThread)
    .innerJoin(user, eq(user.id, supportThread.userId))
    .orderBy(
      desc(supportThread.unreadByAdmin),
      desc(supportThread.lastMessageAt),
    )
    .limit(200)

  const ids = threads.map((thread) => thread.id)
  const latest = ids.length
    ? await db
        .selectDistinctOn([supportMessage.threadId], {
          threadId: supportMessage.threadId,
          body: supportMessage.body,
          senderRole: supportMessage.senderRole,
        })
        .from(supportMessage)
        .where(inArray(supportMessage.threadId, ids))
        .orderBy(supportMessage.threadId, desc(supportMessage.createdAt))
    : []

  return threads.map((thread) => {
    const last = latest.find((row) => row.threadId === thread.id)
    return {
      ...thread,
      lastMessageAt: thread.lastMessageAt.toISOString(),
      preview: last ? last.body.slice(0, 140) : '',
      lastSender: last?.senderRole === 'admin' ? 'admin' : 'user',
    }
  })
}

export async function getThreadWithUser(threadId: string) {
  const [row] = await db
    .select({
      thread: supportThread,
      userName: user.name,
      userEmail: user.email,
    })
    .from(supportThread)
    .innerJoin(user, eq(user.id, supportThread.userId))
    .where(eq(supportThread.id, threadId))
    .limit(1)
  return row ?? null
}

export async function getAdminEmails() {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.role, roles[2]))
  return rows.map((row) => row.email)
}
