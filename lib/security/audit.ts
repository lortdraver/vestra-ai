import { db } from '@/lib/db'
import { auditLog, securityEvent } from '@/lib/db/schema'

type RequestMetadata = {
  ipAddress?: string | null
  userAgent?: string | null
}

export async function writeAuditLog(input: {
  actorUserId?: string | null
  targetUserId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  request?: RequestMetadata
  metadata?: Record<string, unknown>
}) {
  await db.insert(auditLog).values({
    actorUserId: input.actorUserId ?? null,
    targetUserId: input.targetUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    ipAddress: input.request?.ipAddress ?? null,
    userAgent: input.request?.userAgent ?? null,
    metadata: input.metadata ?? {},
  })
}

export async function writeSecurityEvent(input: {
  userId?: string | null
  email?: string | null
  eventType: string
  severity?: 'info' | 'warning' | 'critical'
  request?: RequestMetadata
  metadata?: Record<string, unknown>
}) {
  await db.insert(securityEvent).values({
    userId: input.userId ?? null,
    email: input.email ?? null,
    eventType: input.eventType,
    severity: input.severity ?? 'info',
    ipAddress: input.request?.ipAddress ?? null,
    userAgent: input.request?.userAgent ?? null,
    metadata: input.metadata ?? {},
  })
}

export async function safeAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    await writeAuditLog(input)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Audit log write failed', error)
    }
  }
}

export async function safeSecurityEvent(
  input: Parameters<typeof writeSecurityEvent>[0],
) {
  try {
    await writeSecurityEvent(input)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Security event write failed', error)
    }
  }
}
