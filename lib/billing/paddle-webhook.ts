import { and, desc, eq, or } from 'drizzle-orm'
import { trackServerEvent } from '@/lib/analytics/server'
import { db } from '@/lib/db'
import {
  billingTransaction,
  billingWebhookEvent,
  subscription,
  user,
} from '@/lib/db/schema'
import {
  getIntervalForPaddlePriceId,
  getPaddleEnvironment,
  getPaddleWebhookConfig,
  paddleMetadataMatchesConfiguredEnvironment,
} from './paddle-config'
import {
  isSubscriptionLifecycleEvent,
  supportedPaddleWebhookEvents,
} from './paddle-events'
import { verifyPaddleSignature } from './paddle-signature'

export type PaddleWebhookProcessResult = {
  ok: true
  eventId: string
  eventType: string
  status: 'processed' | 'ignored' | 'duplicate' | 'unmatched_user'
}

export class PaddleWebhookError extends Error {
  constructor(
    public code:
      | 'paddle_webhook_invalid_signature'
      | 'paddle_not_configured'
      | 'paddle_webhook_processing_failed',
    public status = 400,
  ) {
    super(code)
  }
}

function toDate(value: unknown) {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function getNestedString(record: Record<string, unknown>, keys: string[]) {
  let cursor: unknown = record
  for (const key of keys) {
    cursor = asRecord(cursor)[key]
  }
  return typeof cursor === 'string' ? cursor : null
}

function getNestedNumber(record: Record<string, unknown>, keys: string[]) {
  let cursor: unknown = record
  for (const key of keys) {
    cursor = asRecord(cursor)[key]
  }
  const value = typeof cursor === 'string' ? Number(cursor) : cursor
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function firstPriceId(data: Record<string, unknown>) {
  const items = Array.isArray(data.items) ? data.items : []
  for (const item of items) {
    const record = asRecord(item)
    const priceId =
      getNestedString(record, ['price', 'id']) ||
      getNestedString(record, ['price', 'price_id']) ||
      (typeof record.price_id === 'string' ? record.price_id : null)
    if (priceId) return priceId
  }
  return null
}

function normalizeStatus(eventType: string, providerStatus: string | null) {
  if (eventType === 'subscription.canceled') return 'canceled'
  if (eventType === 'subscription.past_due') return 'past_due'
  if (eventType === 'subscription.paused') return 'paused'
  if (eventType === 'subscription.resumed') return 'active'
  if (eventType === 'subscription.trialing') return 'trialing'
  if (
    ['active', 'trialing', 'past_due', 'paused', 'canceled'].includes(
      providerStatus ?? '',
    )
  ) {
    return providerStatus as string
  }
  return eventType === 'transaction.payment_failed' ? 'past_due' : 'active'
}

function extractPaddleData(payload: Record<string, unknown>) {
  const data = asRecord(payload.data)
  const eventType = String(payload.event_type ?? payload.eventType ?? '')
  const eventId = String(payload.event_id ?? payload.id ?? '')
  const customData = asRecord(data.custom_data ?? data.customData)
  const priceId =
    firstPriceId(data) ||
    getNestedString(data, ['price', 'id']) ||
    (typeof data.price_id === 'string' ? data.price_id : null)
  const period = asRecord(
    data.current_billing_period ?? data.currentBillingPeriod,
  )
  const scheduledChange = asRecord(
    data.scheduled_change ?? data.scheduledChange,
  )
  const details = asRecord(data.details)
  const totals = asRecord(details.totals)
  const transactionId =
    eventType.startsWith('transaction.') && typeof data.id === 'string'
      ? data.id
      : null

  return {
    eventId,
    eventType,
    occurredAt: toDate(String(payload.occurred_at ?? payload.occurredAt ?? '')),
    userId:
      typeof customData.vestraUserId === 'string'
        ? customData.vestraUserId
        : null,
    customerId:
      typeof data.customer_id === 'string'
        ? data.customer_id
        : typeof data.customerId === 'string'
          ? data.customerId
          : null,
    subscriptionId:
      typeof data.subscription_id === 'string'
        ? data.subscription_id
        : typeof data.subscriptionId === 'string'
          ? data.subscriptionId
          : typeof data.id === 'string' && eventType.startsWith('subscription.')
            ? data.id
            : null,
    priceId,
    status: normalizeStatus(
      eventType,
      typeof data.status === 'string' ? data.status : null,
    ),
    currentPeriodStart: toDate(
      String(period.starts_at ?? period.startsAt ?? ''),
    ),
    currentPeriodEnd: toDate(String(period.ends_at ?? period.endsAt ?? '')),
    scheduledChangeAction:
      typeof scheduledChange.action === 'string'
        ? scheduledChange.action
        : null,
    scheduledChangeAt: toDate(
      String(scheduledChange.effective_at ?? scheduledChange.effectiveAt ?? ''),
    ),
    cancelAtPeriodEnd: scheduledChange.action === 'cancel' || false,
    canceledAt:
      eventType === 'subscription.canceled'
        ? (toDate(String(payload.occurred_at ?? payload.occurredAt ?? '')) ??
          new Date())
        : null,
    transactionId,
    transactionStatus:
      eventType === 'transaction.payment_failed'
        ? 'failed'
        : eventType === 'transaction.completed'
          ? 'completed'
          : null,
    currency:
      typeof data.currency_code === 'string'
        ? data.currency_code
        : typeof data.currencyCode === 'string'
          ? data.currencyCode
          : typeof totals.currency_code === 'string'
            ? totals.currency_code
            : null,
    amount:
      getNestedNumber(data, ['details', 'totals', 'total']) ??
      getNestedNumber(data, ['details', 'totals', 'grand_total']) ??
      null,
  }
}

async function findUserId(input: {
  userId: string | null
  customerId: string | null
  subscriptionId: string | null
}) {
  if (input.userId) {
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
    if (row) return row.id
  }

  const subscriptionRows = await db
    .select({ userId: subscription.userId, metadata: subscription.metadata })
    .from(subscription)
    .where(
      and(
        eq(subscription.providerKey, 'paddle'),
        or(
          input.subscriptionId
            ? eq(subscription.providerSubscriptionId, input.subscriptionId)
            : undefined,
          input.customerId
            ? eq(subscription.providerCustomerId, input.customerId)
            : undefined,
        ),
      ),
    )
    .orderBy(desc(subscription.updatedAt))
    .limit(10)

  const subscriptionRow = subscriptionRows.find((row) =>
    paddleMetadataMatchesConfiguredEnvironment(row.metadata),
  )
  return subscriptionRow?.userId ?? null
}

async function upsertPaddleSubscription(
  data: ReturnType<typeof extractPaddleData>,
) {
  const matchedUserId = await findUserId(data)
  if (!matchedUserId) return 'unmatched_user' as const

  const interval = getIntervalForPaddlePriceId(data.priceId)
  const values = {
    userId: matchedUserId,
    planKey: 'premium',
    status: data.status,
    providerKey: 'paddle',
    providerCustomerId: data.customerId,
    providerSubscriptionId: data.subscriptionId,
    providerPriceId: data.priceId,
    billingInterval: interval,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    scheduledChangeAction: data.scheduledChangeAction,
    scheduledChangeAt: data.scheduledChangeAt,
    canceledAt: data.canceledAt,
    lastProviderEventAt: data.occurredAt ?? new Date(),
    metadata: {
      paddleEnvironment: getPaddleEnvironment(),
    },
    updatedAt: new Date(),
  }

  const existingRows = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.providerKey, 'paddle'),
        data.subscriptionId
          ? eq(subscription.providerSubscriptionId, data.subscriptionId)
          : eq(subscription.userId, matchedUserId),
      ),
    )
    .limit(10)
  const existing = existingRows.find((row) =>
    paddleMetadataMatchesConfiguredEnvironment(row.metadata),
  )

  if (existing) {
    const existingEventAt = existing.lastProviderEventAt?.getTime() ?? 0
    const incomingEventAt = values.lastProviderEventAt.getTime()
    if (existingEventAt > incomingEventAt) {
      console.info('[paddle] WEBHOOK_STALE_EVENT_IGNORED', {
        eventType: data.eventType,
        eventId: data.eventId.slice(0, 12),
        existingEventAt: existing.lastProviderEventAt?.toISOString(),
        incomingEventAt: values.lastProviderEventAt.toISOString(),
      })
      return 'stale' as const
    }
    await db
      .update(subscription)
      .set(values)
      .where(eq(subscription.id, existing.id))
  } else {
    await db.insert(subscription).values(values)
  }

  return 'processed' as const
}

async function recordPaddleTransaction(
  data: ReturnType<typeof extractPaddleData>,
) {
  if (!data.transactionId || !data.transactionStatus) return
  const matchedUserId = await findUserId(data)
  if (!matchedUserId) return

  await db
    .insert(billingTransaction)
    .values({
      userId: matchedUserId,
      provider: 'paddle',
      providerTransactionId: data.transactionId,
      providerSubscriptionId: data.subscriptionId,
      status: data.transactionStatus,
      currency: data.currency,
      amount: data.amount,
      occurredAt: data.occurredAt,
    })
    .onConflictDoNothing()
}

function analyticsEventForPaddle(eventType: string) {
  return (
    {
      'transaction.completed': 'checkout_completed_client',
      'transaction.payment_failed': 'subscription_payment_failed',
      'subscription.activated': 'subscription_activated',
      'subscription.canceled': 'subscription_canceled',
      'subscription.past_due': 'subscription_payment_failed',
      'subscription.resumed': 'subscription_resumed',
      'subscription.updated': 'subscription_plan_changed',
      'subscription.paused': 'subscription_grace_expired',
    } as const
  )[eventType]
}

export async function processPaddleWebhook(
  rawBody: string,
  signature: string | null,
) {
  const startedAt = Date.now()
  const config = getPaddleWebhookConfig()
  console.info('[paddle] WEBHOOK_RECEIVED', {
    environment: config.environment,
    verified: false,
  })
  if (
    !verifyPaddleSignature({
      rawBody,
      signatureHeader: signature,
      secret: config.webhookSecret,
    })
  ) {
    console.warn('[paddle] WEBHOOK_FAILED', {
      code: 'paddle_webhook_invalid_signature',
      environment: config.environment,
      verified: false,
      durationMs: Date.now() - startedAt,
    })
    throw new PaddleWebhookError('paddle_webhook_invalid_signature', 401)
  }
  console.info('[paddle] WEBHOOK_VERIFIED', {
    environment: config.environment,
    verified: true,
  })

  const payload = JSON.parse(rawBody) as Record<string, unknown>
  const data = extractPaddleData(payload)
  if (!data.eventId || !data.eventType) {
    throw new PaddleWebhookError('paddle_webhook_processing_failed', 400)
  }

  const [existingEvent] = await db
    .select()
    .from(billingWebhookEvent)
    .where(
      and(
        eq(billingWebhookEvent.provider, 'paddle'),
        eq(billingWebhookEvent.eventId, data.eventId),
      ),
    )
    .limit(1)
  if (
    existingEvent?.status === 'processed' ||
    existingEvent?.status === 'ignored'
  ) {
    console.info('[paddle] WEBHOOK_DUPLICATE', {
      eventType: data.eventType,
      eventId: data.eventId.slice(0, 12),
    })
    return {
      ok: true,
      eventId: data.eventId,
      eventType: data.eventType,
      status: 'duplicate',
    } satisfies PaddleWebhookProcessResult
  }

  const [eventRow] = existingEvent
    ? [existingEvent]
    : await db
        .insert(billingWebhookEvent)
        .values({
          provider: 'paddle',
          eventId: data.eventId,
          eventType: data.eventType,
          occurredAt: data.occurredAt,
          status: 'received',
          metadata: { paddleEnvironment: config.environment },
        })
        .returning()

  if (!supportedPaddleWebhookEvents.has(data.eventType)) {
    await db
      .update(billingWebhookEvent)
      .set({
        status: 'ignored',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(billingWebhookEvent.id, eventRow.id))
    return {
      ok: true,
      eventId: data.eventId,
      eventType: data.eventType,
      status: 'ignored',
    }
  }

  const upsertStatus = isSubscriptionLifecycleEvent(data.eventType)
    ? await upsertPaddleSubscription(data)
    : 'processed'
  await recordPaddleTransaction(data)
  const status =
    upsertStatus === 'stale'
      ? 'ignored'
      : upsertStatus === 'processed'
        ? 'processed'
        : 'unmatched_user'
  await db
    .update(billingWebhookEvent)
    .set({ status, processedAt: new Date(), updatedAt: new Date() })
    .where(eq(billingWebhookEvent.id, eventRow.id))

  const eventName = analyticsEventForPaddle(data.eventType)
  if (status === 'processed' && eventName) {
    const matchedUserId = await findUserId(data)
    void trackServerEvent({
      eventName,
      userId: matchedUserId,
      properties: { provider: 'paddle', status: data.status },
      dedupeKey: `paddle:${data.eventId}:${eventName}`,
    })
  }

  console.info('[paddle] WEBHOOK_PROCESSED', {
    environment: config.environment,
    eventType: data.eventType,
    eventId: data.eventId.slice(0, 12),
    matchedSubscription: status === 'processed',
    verified: true,
    providerStatus: data.status,
    durationMs: Date.now() - startedAt,
  })

  return { ok: true, eventId: data.eventId, eventType: data.eventType, status }
}
