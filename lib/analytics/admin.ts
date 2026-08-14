import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  analyticsEvent,
  outfit,
  outfitRequest,
  subscription,
  user,
  wardrobeItem,
  wearLog,
} from '@/lib/db/schema'
import type { AnalyticsEventName } from './events'

export const adminRangePresets = ['today', '7d', '30d', '90d'] as const
export type AdminRangePreset = (typeof adminRangePresets)[number]

export type AdminSeriesPoint = {
  date: string
  value: number
}

export type AdminUserRow = {
  id: string
  email: string
  registeredAt: string
  isVerified: boolean
  plan: 'free' | 'premium' | 'trial'
  wardrobeItemCount: number
  lastMeaningfulActivityAt: string | null
  stylistGenerationCount: number
}

export type AdminRetentionMetric = {
  days: 1 | 7 | 30
  eligibleCohortSize: number
  retainedUsers: number
  rate: number | null
  state: 'ready' | 'not_enough_data'
}

export type AdminAnalyticsSnapshot = {
  preset: AdminRangePreset
  range: {
    label: string
    from: string
    to: string
    days: number
  }
  overview: {
    totalUsers: number
    verifiedUsers: number
    newUsersToday: number
    newUsersLast7Days: number
    newUsersLast30Days: number
  }
  activity: {
    dau: number
    wau: number
    mau: number
    dauMauRatio: number | null
  }
  activation: {
    activatedUsers: number
    activationRate: number | null
  }
  product: {
    totalActiveWardrobeItems: number
    averageWardrobeSize: number
    wardrobeItemsCreatedInRange: number
    wardrobeItemsCreatedLast7Days: number
    wardrobeItemsCreatedLast30Days: number
    stylistGenerationsInRange: number
    stylistFailureRate: number | null
    aiAnalysisFailureRate: number | null
    outfitsCreatedInRange: number
    plannerSchedulesInRange: number
    wearLogsInRange: number
  }
  subscriptions: {
    freeUsers: number
    premiumUsers: number
    trialUsers: number
    monthlyProUsers: number
    annualProUsers: number
    pastDueUsers: number
    canceledUsers: number
    cancelingUsers: number
    pausedUsers: number
    expiredUsers: number
  }
  funnel: {
    stages: Array<{
      key:
        | 'registered'
        | 'verified'
        | 'first_wardrobe'
        | 'first_stylist'
        | 'first_saved'
      count: number
      conversionFromPrevious: number | null
    }>
    approximation: 'operational_and_event_based' | 'operational' | 'event_based'
  }
  retention: {
    activeDefinition: 'meaningful_first_party_event'
    d1: AdminRetentionMetric
    d7: AdminRetentionMetric
    d30: AdminRetentionMetric
  }
  charts: {
    newUsers: AdminSeriesPoint[]
    activeUsers: AdminSeriesPoint[]
    stylistGenerations: AdminSeriesPoint[]
    wardrobeItemsCreated: AdminSeriesPoint[]
  }
  fashionInsights: {
    categories: Array<{ key: string; count: number }>
    subtypes: Array<{ key: string; count: number }>
    colors: Array<{ key: string; count: number }>
    styles: Array<{ key: string; count: number }>
    seasons: Array<{ key: string; count: number }>
  }
  health: {
    stylistSuccessRate: number | null
    aiAnalysisSuccessRate: number | null
    backgroundRemovalSuccessRate: number | null
  }
  users: AdminUserRow[]
  externalTools: {
    gaUrl: string
    clarityUrl: string
  }
}

export type AdminAnalyticsSource = {
  users: Array<{
    id: string
    email: string
    emailVerified: boolean
    createdAt: Date
  }>
  subscriptions: Array<{
    userId: string
    planKey: string
    status: string
    billingInterval: string | null
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
    updatedAt: Date
  }>
  wardrobeItems: Array<{
    userId: string
    createdAt: Date
    category: string
    clothingType: string
    colors: string[]
    styles: string[]
    seasons: string[]
    imageDeletionStatus: string
    analysisStatus: string
    backgroundRemovalStatus: string
  }>
  outfitRequests: Array<{
    userId: string
    createdAt: Date
  }>
  analyticsEvents: Array<{
    userId: string | null
    eventName: string
    occurredAt: Date
  }>
  wearLogs: Array<{
    userId: string
    wornAt: Date
  }>
  savedOutfitUserIds: string[]
  lastActivityByUserId: Record<string, Date>
}

const meaningfulEventNames = new Set<AnalyticsEventName>([
  'signup_completed',
  'email_verified',
  'login_completed',
  'password_reset_completed',
  'wardrobe_item_created',
  'first_wardrobe_item_created',
  'wardrobe_item_deleted',
  'wardrobe_item_analysis_completed',
  'wardrobe_item_analysis_failed',
  'background_removal_completed',
  'background_removal_failed',
  'stylist_generation_completed',
  'stylist_generation_failed',
  'stylist_outfit_saved',
  'stylist_feedback_submitted',
  'stylist_preferences_updated',
  'outfit_created',
  'outfit_deleted',
  'outfit_worn',
  'planner_outfit_scheduled',
  'planner_outfit_deleted',
])

const trackedRangeEventNames = [
  'stylist_generation_completed',
  'stylist_generation_failed',
  'wardrobe_item_analysis_completed',
  'wardrobe_item_analysis_failed',
  'background_removal_completed',
  'background_removal_failed',
  'outfit_created',
  'planner_outfit_scheduled',
  'stylist_outfit_saved',
] as const

function toDate(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = new Date(value)
    if (!Number.isNaN(normalized.getTime())) return normalized
  }

  return new Date(0)
}

export function resolveAdminRangePreset(value: string | null | undefined) {
  return adminRangePresets.includes(value as AdminRangePreset)
    ? (value as AdminRangePreset)
    : '30d'
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000)
}

function differenceInUtcDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000)
}

function toDateKey(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10)
}

function inRange(date: Date, from: Date, to: Date) {
  return date >= from && date < to
}

function countRange(dates: Date[], from: Date, to: Date) {
  return dates.filter((date) => inRange(date, from, to)).length
}

function distinctUserIds(
  rows: Array<{ userId: string | null | undefined }>,
  predicate?: (userId: string) => boolean,
) {
  return new Set(
    rows.flatMap((row) =>
      row.userId && (!predicate || predicate(row.userId)) ? [row.userId] : [],
    ),
  )
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return null
  return numerator / denominator
}

function average(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return numerator / denominator
}

function mapLatestSubscriptionByUser(
  subscriptions: AdminAnalyticsSource['subscriptions'],
) {
  const latest = new Map<
    string,
    AdminAnalyticsSource['subscriptions'][number]
  >()

  for (const entry of subscriptions) {
    const current = latest.get(entry.userId)
    if (!current || current.updatedAt < entry.updatedAt) {
      latest.set(entry.userId, entry)
    }
  }

  return latest
}

function planForSubscription(
  subscriptionEntry: AdminAnalyticsSource['subscriptions'][number] | undefined,
): 'free' | 'premium' | 'trial' {
  if (subscriptionEntry?.status === 'trialing') return 'trial'
  if (
    subscriptionEntry?.planKey === 'premium' &&
    (subscriptionEntry.status === 'active' ||
      subscriptionEntry.status === 'past_due' ||
      (subscriptionEntry.status === 'canceled' &&
        subscriptionEntry.cancelAtPeriodEnd &&
        subscriptionEntry.currentPeriodEnd &&
        subscriptionEntry.currentPeriodEnd > new Date()))
  ) {
    return 'premium'
  }

  return 'free'
}

function buildSeries(
  from: Date,
  to: Date,
  rows: Array<{ date: Date; userId?: string | null; value?: number }>,
  options?: { distinctByUser?: boolean },
) {
  const buckets = new Map<string, number>()
  for (
    let cursor = startOfUtcDay(from);
    cursor < to;
    cursor = addUtcDays(cursor, 1)
  ) {
    buckets.set(toDateKey(cursor), 0)
  }

  if (options?.distinctByUser) {
    const perDayUsers = new Map<string, Set<string>>()
    for (const row of rows) {
      const key = toDateKey(row.date)
      if (!buckets.has(key) || !row.userId) continue
      const users = perDayUsers.get(key) ?? new Set<string>()
      users.add(row.userId)
      perDayUsers.set(key, users)
    }
    for (const [key, users] of perDayUsers) {
      buckets.set(key, users.size)
    }
  } else {
    for (const row of rows) {
      const key = toDateKey(row.date)
      if (!buckets.has(key)) continue
      buckets.set(key, (buckets.get(key) ?? 0) + (row.value ?? 1))
    }
  }

  return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }))
}

function aggregateCounts(values: string[], limit = 5) {
  const counts = new Map<string, number>()
  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

export function getAdminRange(preset: AdminRangePreset, now = new Date()) {
  const end = now
  const todayStart = startOfUtcDay(now)

  switch (preset) {
    case 'today':
      return {
        preset,
        from: todayStart,
        to: end,
        days: 1,
        label: 'Today',
      }
    case '7d':
      return {
        preset,
        from: addUtcDays(todayStart, -6),
        to: end,
        days: 7,
        label: '7 days',
      }
    case '90d':
      return {
        preset,
        from: addUtcDays(todayStart, -89),
        to: end,
        days: 90,
        label: '90 days',
      }
    case '30d':
    default:
      return {
        preset: '30d' as const,
        from: addUtcDays(todayStart, -29),
        to: end,
        days: 30,
        label: '30 days',
      }
  }
}

function buildRetentionMetric(input: {
  days: 1 | 7 | 30
  activationDatesByUser: Map<string, Date>
  eventDatesByUser: Map<string, Date[]>
  cohortFrom: Date
  cohortTo: Date
  now: Date
}) {
  const eligibleUsers = Array.from(
    input.activationDatesByUser.entries(),
  ).filter(
    ([, activationDate]) =>
      inRange(activationDate, input.cohortFrom, input.cohortTo) &&
      differenceInUtcDays(activationDate, input.now) >= input.days,
  )

  if (eligibleUsers.length === 0) {
    return {
      days: input.days,
      eligibleCohortSize: 0,
      retainedUsers: 0,
      rate: null,
      state: 'not_enough_data' as const,
    }
  }

  const retainedUsers = eligibleUsers.filter(([userId, activationDate]) => {
    const eventDates = input.eventDatesByUser.get(userId) ?? []
    const retainedFrom = addUtcDays(activationDate, input.days)
    const retainedTo = addUtcDays(retainedFrom, 1)
    return eventDates.some((eventDate) =>
      inRange(eventDate, retainedFrom, retainedTo),
    )
  }).length

  return {
    days: input.days,
    eligibleCohortSize: eligibleUsers.length,
    retainedUsers,
    rate: ratio(retainedUsers, eligibleUsers.length),
    state: 'ready' as const,
  }
}

export function buildAdminAnalyticsSnapshot(
  source: AdminAnalyticsSource,
  input: {
    preset: AdminRangePreset
    now?: Date
  },
): AdminAnalyticsSnapshot {
  const now = input.now ?? new Date()
  const range = getAdminRange(input.preset, now)
  const todayStart = startOfUtcDay(now)
  const last7Start = addUtcDays(todayStart, -6)
  const last30Start = addUtcDays(todayStart, -29)
  const last1DayStart = new Date(now.getTime() - 86400000)
  const last7DayWindow = new Date(now.getTime() - 7 * 86400000)
  const last30DayWindow = new Date(now.getTime() - 30 * 86400000)

  const userCreatedDates = source.users.map((entry) => entry.createdAt)
  const verifiedUsers = source.users.filter((entry) => entry.emailVerified)
  const verifiedUserIds = new Set(verifiedUsers.map((entry) => entry.id))

  const wardrobeItemsByUser = source.wardrobeItems.reduce<
    Map<string, typeof source.wardrobeItems>
  >((accumulator, item) => {
    const items = accumulator.get(item.userId) ?? []
    items.push(item)
    accumulator.set(item.userId, items)
    return accumulator
  }, new Map())

  const activeWardrobeItems = source.wardrobeItems.filter(
    (item) => item.imageDeletionStatus === 'active',
  )
  const activeWardrobeUserIds = new Set(
    source.wardrobeItems
      .filter((item) => verifiedUserIds.has(item.userId))
      .map((item) => item.userId),
  )
  const stylistRequestUserIds = new Set(
    source.outfitRequests
      .filter((entry) => verifiedUserIds.has(entry.userId))
      .map((entry) => entry.userId),
  )
  const savedStageUserIds = new Set(
    source.savedOutfitUserIds.filter(
      (userId) =>
        verifiedUserIds.has(userId) &&
        activeWardrobeUserIds.has(userId) &&
        stylistRequestUserIds.has(userId),
    ),
  )

  const eventDatesByUser = source.analyticsEvents.reduce<Map<string, Date[]>>(
    (accumulator, event) => {
      if (
        !event.userId ||
        !meaningfulEventNames.has(event.eventName as AnalyticsEventName)
      ) {
        return accumulator
      }
      const dates = accumulator.get(event.userId) ?? []
      dates.push(event.occurredAt)
      accumulator.set(event.userId, dates)
      return accumulator
    },
    new Map(),
  )

  const activationDatesByUser = new Map<string, Date>()
  const activationEventDatesByUser = source.analyticsEvents.reduce<
    Map<string, Date[]>
  >((accumulator, event) => {
    if (
      !event.userId ||
      !verifiedUserIds.has(event.userId) ||
      (event.eventName !== 'wardrobe_item_created' &&
        event.eventName !== 'first_wardrobe_item_created')
    ) {
      return accumulator
    }

    const dates = accumulator.get(event.userId) ?? []
    dates.push(event.occurredAt)
    accumulator.set(event.userId, dates)
    return accumulator
  }, new Map())

  for (const userId of verifiedUserIds) {
    const eventDates = activationEventDatesByUser.get(userId) ?? []
    const wardrobeDates =
      wardrobeItemsByUser.get(userId)?.map((item) => item.createdAt) ?? []
    const earliest = [...eventDates, ...wardrobeDates].sort(
      (left, right) => left.getTime() - right.getTime(),
    )[0]
    if (earliest) activationDatesByUser.set(userId, earliest)
  }

  const recentMeaningfulEvents = source.analyticsEvents.filter((event) =>
    meaningfulEventNames.has(event.eventName as AnalyticsEventName),
  )
  const dau = distinctUserIds(
    recentMeaningfulEvents.filter((event) => event.occurredAt >= last1DayStart),
  ).size
  const wau = distinctUserIds(
    recentMeaningfulEvents.filter(
      (event) => event.occurredAt >= last7DayWindow,
    ),
  ).size
  const mau = distinctUserIds(
    recentMeaningfulEvents.filter(
      (event) => event.occurredAt >= last30DayWindow,
    ),
  ).size

  const rangeEvents = source.analyticsEvents.filter((event) =>
    inRange(event.occurredAt, range.from, range.to),
  )
  const rangeEventCounts = trackedRangeEventNames.reduce<
    Record<string, number>
  >((accumulator, eventName) => {
    accumulator[eventName] = 0
    return accumulator
  }, {})

  for (const event of rangeEvents) {
    if (event.eventName in rangeEventCounts) {
      rangeEventCounts[event.eventName] += 1
    }
  }

  const latestSubscriptionByUser = mapLatestSubscriptionByUser(
    source.subscriptions,
  )
  const subscriptionPlans = source.users.map((entry) =>
    planForSubscription(latestSubscriptionByUser.get(entry.id)),
  )
  const premiumUsers = subscriptionPlans.filter(
    (plan) => plan === 'premium',
  ).length
  const trialUsers = subscriptionPlans.filter((plan) => plan === 'trial').length
  const freeUsers = Math.max(source.users.length - premiumUsers - trialUsers, 0)
  const latestSubscriptionRows = Array.from(latestSubscriptionByUser.values())
  const monthlyProUsers = latestSubscriptionRows.filter(
    (entry) =>
      entry.planKey === 'premium' &&
      entry.billingInterval === 'monthly' &&
      (entry.status === 'active' || entry.status === 'past_due'),
  ).length
  const annualProUsers = latestSubscriptionRows.filter(
    (entry) =>
      entry.planKey === 'premium' &&
      entry.billingInterval === 'annual' &&
      (entry.status === 'active' || entry.status === 'past_due'),
  ).length
  const pastDueUsers = latestSubscriptionRows.filter(
    (entry) => entry.status === 'past_due',
  ).length
  const cancelingUsers = latestSubscriptionRows.filter(
    (entry) => entry.cancelAtPeriodEnd,
  ).length
  const pausedUsers = latestSubscriptionRows.filter(
    (entry) => entry.status === 'paused',
  ).length
  const canceledUsers = latestSubscriptionRows.filter(
    (entry) => entry.status === 'canceled',
  ).length
  const expiredUsers = latestSubscriptionRows.filter(
    (entry) =>
      entry.status === 'canceled' &&
      (!entry.currentPeriodEnd || entry.currentPeriodEnd <= now),
  ).length

  const recentUsers = [...source.users]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20)

  return {
    preset: input.preset,
    range: {
      label: range.label,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      days: range.days,
    },
    overview: {
      totalUsers: source.users.length,
      verifiedUsers: verifiedUsers.length,
      newUsersToday: countRange(
        userCreatedDates,
        todayStart,
        addUtcDays(todayStart, 1),
      ),
      newUsersLast7Days: countRange(userCreatedDates, last7Start, range.to),
      newUsersLast30Days: countRange(userCreatedDates, last30Start, range.to),
    },
    activity: {
      dau,
      wau,
      mau,
      dauMauRatio: ratio(dau, mau),
    },
    activation: {
      activatedUsers: activationDatesByUser.size,
      activationRate: ratio(activationDatesByUser.size, verifiedUsers.length),
    },
    product: {
      totalActiveWardrobeItems: activeWardrobeItems.length,
      averageWardrobeSize: average(
        activeWardrobeItems.length,
        Math.max(source.users.length, 1),
      ),
      wardrobeItemsCreatedInRange: countRange(
        source.wardrobeItems.map((item) => item.createdAt),
        range.from,
        range.to,
      ),
      wardrobeItemsCreatedLast7Days: countRange(
        source.wardrobeItems.map((item) => item.createdAt),
        last7Start,
        range.to,
      ),
      wardrobeItemsCreatedLast30Days: countRange(
        source.wardrobeItems.map((item) => item.createdAt),
        last30Start,
        range.to,
      ),
      stylistGenerationsInRange:
        rangeEventCounts.stylist_generation_completed ?? 0,
      stylistFailureRate: ratio(
        rangeEventCounts.stylist_generation_failed ?? 0,
        (rangeEventCounts.stylist_generation_completed ?? 0) +
          (rangeEventCounts.stylist_generation_failed ?? 0),
      ),
      aiAnalysisFailureRate: ratio(
        rangeEventCounts.wardrobe_item_analysis_failed ?? 0,
        (rangeEventCounts.wardrobe_item_analysis_completed ?? 0) +
          (rangeEventCounts.wardrobe_item_analysis_failed ?? 0),
      ),
      outfitsCreatedInRange: rangeEventCounts.outfit_created ?? 0,
      plannerSchedulesInRange: rangeEventCounts.planner_outfit_scheduled ?? 0,
      wearLogsInRange: source.wearLogs.filter((entry) =>
        inRange(entry.wornAt, range.from, range.to),
      ).length,
    },
    subscriptions: {
      freeUsers,
      premiumUsers,
      trialUsers,
      monthlyProUsers,
      annualProUsers,
      pastDueUsers,
      canceledUsers,
      cancelingUsers,
      pausedUsers,
      expiredUsers,
    },
    funnel: {
      stages: [
        {
          key: 'registered',
          count: source.users.length,
          conversionFromPrevious: null,
        },
        {
          key: 'verified',
          count: verifiedUsers.length,
          conversionFromPrevious: ratio(
            verifiedUsers.length,
            source.users.length,
          ),
        },
        {
          key: 'first_wardrobe',
          count: activeWardrobeUserIds.size,
          conversionFromPrevious: ratio(
            activeWardrobeUserIds.size,
            verifiedUsers.length,
          ),
        },
        {
          key: 'first_stylist',
          count: stylistRequestUserIds.size,
          conversionFromPrevious: ratio(
            stylistRequestUserIds.size,
            activeWardrobeUserIds.size,
          ),
        },
        {
          key: 'first_saved',
          count: savedStageUserIds.size,
          conversionFromPrevious: ratio(
            savedStageUserIds.size,
            stylistRequestUserIds.size,
          ),
        },
      ],
      approximation: 'operational_and_event_based',
    },
    retention: {
      activeDefinition: 'meaningful_first_party_event',
      d1: buildRetentionMetric({
        days: 1,
        activationDatesByUser,
        eventDatesByUser,
        cohortFrom: range.from,
        cohortTo: range.to,
        now,
      }),
      d7: buildRetentionMetric({
        days: 7,
        activationDatesByUser,
        eventDatesByUser,
        cohortFrom: range.from,
        cohortTo: range.to,
        now,
      }),
      d30: buildRetentionMetric({
        days: 30,
        activationDatesByUser,
        eventDatesByUser,
        cohortFrom: range.from,
        cohortTo: range.to,
        now,
      }),
    },
    charts: {
      newUsers: buildSeries(
        range.from,
        addUtcDays(startOfUtcDay(range.to), 1),
        source.users
          .filter((entry) => inRange(entry.createdAt, range.from, range.to))
          .map((entry) => ({ date: entry.createdAt, value: 1 })),
      ),
      activeUsers: buildSeries(
        range.from,
        addUtcDays(startOfUtcDay(range.to), 1),
        rangeEvents
          .filter((event) =>
            meaningfulEventNames.has(event.eventName as AnalyticsEventName),
          )
          .map((event) => ({ date: event.occurredAt, userId: event.userId })),
        { distinctByUser: true },
      ),
      stylistGenerations: buildSeries(
        range.from,
        addUtcDays(startOfUtcDay(range.to), 1),
        rangeEvents
          .filter((event) => event.eventName === 'stylist_generation_completed')
          .map((event) => ({ date: event.occurredAt, value: 1 })),
      ),
      wardrobeItemsCreated: buildSeries(
        range.from,
        addUtcDays(startOfUtcDay(range.to), 1),
        source.wardrobeItems
          .filter((item) => inRange(item.createdAt, range.from, range.to))
          .map((item) => ({ date: item.createdAt, value: 1 })),
      ),
    },
    fashionInsights: {
      categories: aggregateCounts(
        activeWardrobeItems.map((item) => item.category),
      ),
      subtypes: aggregateCounts(
        activeWardrobeItems.map((item) => item.clothingType),
      ),
      colors: aggregateCounts(
        activeWardrobeItems.flatMap((item) => item.colors),
      ),
      styles: aggregateCounts(
        activeWardrobeItems.flatMap((item) => item.styles),
      ),
      seasons: aggregateCounts(
        activeWardrobeItems.flatMap((item) => item.seasons),
      ),
    },
    health: {
      stylistSuccessRate: ratio(
        rangeEventCounts.stylist_generation_completed ?? 0,
        (rangeEventCounts.stylist_generation_completed ?? 0) +
          (rangeEventCounts.stylist_generation_failed ?? 0),
      ),
      aiAnalysisSuccessRate: ratio(
        rangeEventCounts.wardrobe_item_analysis_completed ?? 0,
        (rangeEventCounts.wardrobe_item_analysis_completed ?? 0) +
          (rangeEventCounts.wardrobe_item_analysis_failed ?? 0),
      ),
      backgroundRemovalSuccessRate: ratio(
        rangeEventCounts.background_removal_completed ?? 0,
        (rangeEventCounts.background_removal_completed ?? 0) +
          (rangeEventCounts.background_removal_failed ?? 0),
      ),
    },
    users: recentUsers.map((entry) => ({
      id: entry.id,
      email: entry.email,
      registeredAt: entry.createdAt.toISOString(),
      isVerified: entry.emailVerified,
      plan: planForSubscription(latestSubscriptionByUser.get(entry.id)),
      wardrobeItemCount: activeWardrobeItems.filter(
        (item) => item.userId === entry.id,
      ).length,
      lastMeaningfulActivityAt:
        source.lastActivityByUserId[entry.id]?.toISOString() ?? null,
      stylistGenerationCount: source.outfitRequests.filter(
        (request) => request.userId === entry.id,
      ).length,
    })),
    externalTools: {
      gaUrl: 'https://analytics.google.com/',
      clarityUrl: 'https://clarity.microsoft.com/',
    },
  }
}

export async function loadAdminAnalyticsSource(
  preset: AdminRangePreset,
  now = new Date(),
): Promise<AdminAnalyticsSource> {
  const range = getAdminRange(preset, now)
  const analyticsFrom = getAdminRange('90d', now).from

  const [
    users,
    subscriptions,
    wardrobeItems,
    outfitRequests,
    analyticsEvents,
    wearLogs,
    savedEventRows,
    currentSavedOutfits,
    lastActivityRows,
  ] = await Promise.all([
    db
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user),
    db
      .select({
        userId: subscription.userId,
        planKey: subscription.planKey,
        status: subscription.status,
        billingInterval: subscription.billingInterval,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        updatedAt: subscription.updatedAt,
      })
      .from(subscription),
    db
      .select({
        userId: wardrobeItem.userId,
        createdAt: wardrobeItem.createdAt,
        category: wardrobeItem.category,
        clothingType: wardrobeItem.clothingType,
        colors: wardrobeItem.colors,
        styles: wardrobeItem.styles,
        seasons: wardrobeItem.seasons,
        imageDeletionStatus: wardrobeItem.imageDeletionStatus,
        analysisStatus: wardrobeItem.analysisStatus,
        backgroundRemovalStatus: wardrobeItem.backgroundRemovalStatus,
      })
      .from(wardrobeItem),
    db
      .select({
        userId: outfitRequest.userId,
        createdAt: outfitRequest.createdAt,
      })
      .from(outfitRequest),
    db
      .select({
        userId: analyticsEvent.userId,
        eventName: analyticsEvent.eventName,
        occurredAt: analyticsEvent.occurredAt,
      })
      .from(analyticsEvent)
      .where(gte(analyticsEvent.occurredAt, analyticsFrom)),
    db
      .select({
        userId: wearLog.userId,
        wornAt: wearLog.wornAt,
      })
      .from(wearLog)
      .where(gte(wearLog.wornAt, range.from)),
    db
      .select({ userId: analyticsEvent.userId })
      .from(analyticsEvent)
      .where(eq(analyticsEvent.eventName, 'stylist_outfit_saved'))
      .groupBy(analyticsEvent.userId),
    db
      .select({ userId: outfit.userId })
      .from(outfit)
      .where(and(eq(outfit.isSaved, true), isNull(outfit.deletedAt)))
      .groupBy(outfit.userId),
    db
      .select({
        userId: analyticsEvent.userId,
        occurredAt: sql<Date>`max(${analyticsEvent.occurredAt})`,
      })
      .from(analyticsEvent)
      .where(
        and(
          sql`${analyticsEvent.userId} is not null`,
          inArray(analyticsEvent.eventName, Array.from(meaningfulEventNames)),
        ),
      )
      .groupBy(analyticsEvent.userId),
  ])

  return {
    users: users.map((entry) => ({
      ...entry,
      createdAt: toDate(entry.createdAt),
    })),
    subscriptions: subscriptions.map((entry) => ({
      ...entry,
      currentPeriodEnd: entry.currentPeriodEnd
        ? toDate(entry.currentPeriodEnd)
        : null,
      updatedAt: toDate(entry.updatedAt),
    })),
    wardrobeItems: wardrobeItems.map((entry) => ({
      ...entry,
      createdAt: toDate(entry.createdAt),
    })),
    outfitRequests: outfitRequests.map((entry) => ({
      ...entry,
      createdAt: toDate(entry.createdAt),
    })),
    analyticsEvents: analyticsEvents.map((entry) => ({
      ...entry,
      occurredAt: toDate(entry.occurredAt),
    })),
    wearLogs: wearLogs.map((entry) => ({
      ...entry,
      wornAt: toDate(entry.wornAt),
    })),
    savedOutfitUserIds: Array.from(
      new Set(
        [...savedEventRows, ...currentSavedOutfits].flatMap((row) =>
          row.userId ? [row.userId] : [],
        ),
      ),
    ),
    lastActivityByUserId: Object.fromEntries(
      lastActivityRows.flatMap((row) =>
        row.userId ? [[row.userId, toDate(row.occurredAt)]] : [],
      ),
    ),
  }
}

export async function getAdminAnalyticsSnapshot(
  preset: AdminRangePreset,
  now = new Date(),
) {
  const source = await loadAdminAnalyticsSource(preset, now)
  return buildAdminAnalyticsSnapshot(source, { preset, now })
}
