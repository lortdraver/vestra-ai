import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('emailVerified').notNull().default(false),
    image: text('image'),
    role: text('role').notNull().default('user'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('user_email_idx').on(table.email),
    roleIdx: index('user_role_idx').on(table.role),
  }),
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expiresAt').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    userIdIdx: index('session_user_id_idx').on(table.userId),
    tokenIdx: index('session_token_idx').on(table.token),
    expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),
  }),
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
    refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('account_user_id_idx').on(table.userId),
    providerAccountIdx: index('account_provider_account_idx').on(
      table.providerId,
      table.accountId,
    ),
  }),
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    createdAt: timestamp('createdAt').defaultNow(),
    updatedAt: timestamp('updatedAt').defaultNow(),
  },
  (table) => ({
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
    expiresAtIdx: index('verification_expires_at_idx').on(table.expiresAt),
  }),
)

// --- App tables ------------------------------------------------------------
// Add your app tables below. Always include a plain `userId` column so queries
// can be scoped per user — the security model depends on this column existing,
// not on a foreign key. Do NOT add a foreign key constraint
// (`.references(() => user.id, ...)`) unless the user explicitly asks for
// foreign keys or referential integrity; FK constraints make iterating on the
// schema harder.
//
// Example:
//
// import { serial } from "drizzle-orm/pg-core"
//
// export const todos = pgTable("todos", {
//   id: serial("id").primaryKey(),
//   userId: text("userId").notNull(),
//   title: text("title").notNull(),
//   completed: boolean("completed").notNull().default(false),
//   createdAt: timestamp("createdAt").notNull().defaultNow(),
// })
//
// If the user asks for foreign keys, add the reference back in:
//   userId: text("userId")
//     .notNull()
//     .references(() => user.id, { onDelete: "cascade" }),

export const wardrobeItem = pgTable(
  'wardrobe_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    clothingType: text('clothingType').notNull(),
    colors: jsonb('colors')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    seasons: jsonb('seasons')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    styles: jsonb('styles')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    material: text('material').notNull().default(''),
    brand: text('brand').notNull().default(''),
    notes: text('notes').notNull().default(''),
    imageUrl: text('imageUrl').notNull(),
    imageStorageKey: text('imageStorageKey').notNull(),
    imageContentType: text('imageContentType').notNull(),
    imageSize: text('imageSize').notNull(),
    imageColorHints: jsonb('imageColorHints').$type<{
      colors: string[]
      dominantHexColors: string[]
    } | null>(),
    originalImageUrl: text('originalImageUrl'),
    originalImageStorageKey: text('originalImageStorageKey'),
    originalImageContentType: text('originalImageContentType'),
    originalImageSize: text('originalImageSize'),
    processedImageUrl: text('processedImageUrl'),
    processedImageStorageKey: text('processedImageStorageKey'),
    processedImageContentType: text('processedImageContentType'),
    processedImageSize: text('processedImageSize'),
    backgroundRemovalStatus: text('backgroundRemovalStatus')
      .notNull()
      .default('pending'),
    backgroundRemovalProvider: text('backgroundRemovalProvider'),
    backgroundRemovalModelId: text('backgroundRemovalModelId'),
    imageDeletionStatus: text('imageDeletionStatus')
      .notNull()
      .default('active'),
    imageDeleteRequestedAt: timestamp('imageDeleteRequestedAt'),
    analysisStatus: text('analysisStatus').notNull().default('pending'),
    aiAnalysis: jsonb('aiAnalysis').$type<Record<string, unknown> | null>(),
    userCorrections: jsonb('userCorrections').$type<Record<
      string,
      unknown
    > | null>(),
    analysisError: text('analysisError'),
    analysisPromptVersion: text('analysisPromptVersion'),
    analysisModelId: text('analysisModelId'),
    analyzedAt: timestamp('analyzedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('wardrobe_item_user_id_idx').on(table.userId),
    userCreatedAtIdx: index('wardrobe_item_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    categoryIdx: index('wardrobe_item_category_idx').on(
      table.userId,
      table.category,
    ),
    clothingTypeIdx: index('wardrobe_item_clothing_type_idx').on(
      table.userId,
      table.clothingType,
    ),
    analysisStatusIdx: index('wardrobe_item_analysis_status_idx').on(
      table.userId,
      table.analysisStatus,
    ),
  }),
)

export const wardrobeImageDeletionQueue = pgTable(
  'wardrobe_image_deletion_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    wardrobeItemId: uuid('wardrobeItemId'),
    storageKey: text('storageKey').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    requestedAt: timestamp('requestedAt').notNull().defaultNow(),
    processedAt: timestamp('processedAt'),
  },
  (table) => ({
    userStatusIdx: index('wardrobe_image_deletion_queue_user_status_idx').on(
      table.userId,
      table.status,
    ),
    storageKeyIdx: index('wardrobe_image_deletion_queue_storage_key_idx').on(
      table.storageKey,
    ),
  }),
)

export const paymentProvider = pgTable(
  'payment_provider',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    status: text('status').notNull().default('inactive'),
    config: jsonb('config')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    keyIdx: index('payment_provider_key_idx').on(table.key),
  }),
)

export const subscriptionPlan = pgTable(
  'subscription_plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceMonthlyCents: integer('priceMonthlyCents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    features: jsonb('features')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    limits: jsonb('limits')
      .$type<Record<string, number | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    trialDays: integer('trialDays').notNull().default(7),
    isActive: boolean('isActive').notNull().default(true),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    keyIdx: index('subscription_plan_key_idx').on(table.key),
    activeIdx: index('subscription_plan_active_idx').on(table.isActive),
  }),
)

export const subscription = pgTable(
  'subscription',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    planKey: text('planKey').notNull().default('free'),
    status: text('status').notNull().default('active'),
    providerKey: text('providerKey').notNull().default('manual'),
    providerCustomerId: text('providerCustomerId'),
    providerSubscriptionId: text('providerSubscriptionId'),
    trialStartedAt: timestamp('trialStartedAt'),
    trialEndsAt: timestamp('trialEndsAt'),
    currentPeriodStart: timestamp('currentPeriodStart'),
    currentPeriodEnd: timestamp('currentPeriodEnd'),
    cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').notNull().default(false),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('subscription_user_id_idx').on(table.userId),
    userStatusIdx: index('subscription_user_status_idx').on(
      table.userId,
      table.status,
    ),
    providerSubscriptionIdx: index('subscription_provider_subscription_idx').on(
      table.providerKey,
      table.providerSubscriptionId,
    ),
  }),
)

export const subscriptionUsage = pgTable(
  'subscription_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    subscriptionId: uuid('subscriptionId'),
    featureKey: text('featureKey').notNull(),
    periodStart: timestamp('periodStart').notNull(),
    periodEnd: timestamp('periodEnd').notNull(),
    used: integer('used').notNull().default(0),
    limitValue: integer('limitValue'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userFeaturePeriodIdx: index(
      'subscription_usage_user_feature_period_idx',
    ).on(table.userId, table.featureKey, table.periodStart),
    subscriptionIdx: index('subscription_usage_subscription_idx').on(
      table.subscriptionId,
    ),
  }),
)

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: text('actorUserId'),
    targetUserId: text('targetUserId'),
    action: text('action').notNull(),
    entityType: text('entityType').notNull(),
    entityId: text('entityId'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    actorCreatedAtIdx: index('audit_log_actor_created_at_idx').on(
      table.actorUserId,
      table.createdAt,
    ),
    actionCreatedAtIdx: index('audit_log_action_created_at_idx').on(
      table.action,
      table.createdAt,
    ),
  }),
)

export const securityEvent = pgTable(
  'security_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId'),
    email: text('email'),
    eventType: text('eventType').notNull(),
    severity: text('severity').notNull().default('info'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    eventCreatedAtIdx: index('security_event_type_created_at_idx').on(
      table.eventType,
      table.createdAt,
    ),
    userCreatedAtIdx: index('security_event_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    emailCreatedAtIdx: index('security_event_email_created_at_idx').on(
      table.email,
      table.createdAt,
    ),
  }),
)

export const accountRecoveryToken = pgTable(
  'account_recovery_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    tokenHash: text('tokenHash').notNull().unique(),
    purpose: text('purpose').notNull(),
    expiresAt: timestamp('expiresAt').notNull(),
    consumedAt: timestamp('consumedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userPurposeIdx: index('account_recovery_token_user_purpose_idx').on(
      table.userId,
      table.purpose,
    ),
    expiresAtIdx: index('account_recovery_token_expires_at_idx').on(
      table.expiresAt,
    ),
  }),
)

export const emailVerificationRequest = pgTable(
  'email_verification_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    email: text('email').notNull(),
    tokenHash: text('tokenHash').notNull().unique(),
    expiresAt: timestamp('expiresAt').notNull(),
    verifiedAt: timestamp('verifiedAt'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index(
      'email_verification_request_user_created_at_idx',
    ).on(table.userId, table.createdAt),
    tokenHashIdx: index('email_verification_request_token_hash_idx').on(
      table.tokenHash,
    ),
  }),
)

export const outfitCollection = pgTable(
  'outfit_collection',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('outfit_collection_user_id_idx').on(table.userId),
  }),
)

export const outfitRequest = pgTable(
  'outfit_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    locale: text('locale').notNull(),
    prompt: text('prompt').notNull(),
    quickRequest: text('quickRequest'),
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull().default('completed'),
    missingItems: jsonb('missingItems').$type<string[]>().notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index('outfit_request_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
  }),
)

export const outfitGenerationBatch = pgTable(
  'outfit_generation_batch',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    requestId: uuid('requestId'),
    status: text('status').notNull().default('completed'),
    candidateCount: integer('candidateCount').notNull().default(0),
    providerRequestCount: integer('providerRequestCount').notNull().default(1),
    retryCount: integer('retryCount').notNull().default(0),
    durationMs: integer('durationMs').notNull().default(0),
    modelId: text('modelId'),
    promptVersion: text('promptVersion').notNull().default('stylist-batch-v1'),
    schemaVersion: text('schemaVersion').notNull().default('stylist-batch-v1'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index('outfit_generation_batch_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    requestIdx: index('outfit_generation_batch_request_idx').on(
      table.requestId,
    ),
  }),
)

export const outfit = pgTable(
  'outfit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    requestId: uuid('requestId'),
    generationBatchId: uuid('generationBatchId'),
    collectionId: uuid('collectionId'),
    title: text('title').notNull(),
    occasion: text('occasion').notNull().default(''),
    styleDirection: text('styleDirection').notNull().default(''),
    seasonLabel: text('seasonLabel').notNull().default(''),
    formalityLabel: text('formalityLabel').notNull().default(''),
    overallExplanation: text('overallExplanation').notNull(),
    confidenceScore: text('confidenceScore').notNull(),
    alternativeSuggestions: jsonb('alternativeSuggestions')
      .$type<Array<{ title: string; itemIds: string[]; explanation: string }>>()
      .notNull(),
    missingItems: jsonb('missingItems').$type<string[]>().notNull(),
    isSaved: boolean('isSaved').notNull().default(false),
    isFavorite: boolean('isFavorite').notNull().default(false),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userCreatedAtIdx: index('outfit_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    userSavedIdx: index('outfit_user_saved_idx').on(
      table.userId,
      table.isSaved,
    ),
    userFavoriteIdx: index('outfit_user_favorite_idx').on(
      table.userId,
      table.isFavorite,
    ),
    userBatchIdx: index('outfit_user_batch_idx').on(
      table.userId,
      table.generationBatchId,
    ),
  }),
)

export const outfitItem = pgTable(
  'outfit_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    outfitId: uuid('outfitId').notNull(),
    wardrobeItemId: uuid('wardrobeItemId').notNull(),
    role: text('role').notNull(),
    explanation: text('explanation').notNull(),
    position: text('position').notNull(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    outfitIdx: index('outfit_item_outfit_idx').on(table.outfitId),
    wardrobeItemIdx: index('outfit_item_wardrobe_item_idx').on(
      table.wardrobeItemId,
    ),
  }),
)

export const outfitFeedback = pgTable(
  'outfit_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    outfitId: uuid('outfitId').notNull(),
    generationBatchId: uuid('generationBatchId'),
    rating: text('rating').notNull(),
    reasonTags: jsonb('reasonTags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    comment: text('comment').notNull().default(''),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    userOutfitIdx: index('outfit_feedback_user_outfit_idx').on(
      table.userId,
      table.outfitId,
    ),
    userBatchIdx: index('outfit_feedback_user_batch_idx').on(
      table.userId,
      table.generationBatchId,
    ),
  }),
)

export const outfitPlan = pgTable(
  'outfit_plan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId').notNull(),
    outfitId: uuid('outfitId'),
    generationBatchId: uuid('generationBatchId'),
    title: text('title').notNull(),
    occasion: text('occasion'),
    startAt: timestamp('startAt').notNull(),
    endAt: timestamp('endAt'),
    allDay: boolean('allDay').notNull().default(false),
    timezone: text('timezone').notNull().default('UTC'),
    locationName: text('locationName'),
    latitude: text('latitude'),
    longitude: text('longitude'),
    note: text('note'),
    status: text('status').notNull().default('planned'),
    source: text('source').notNull().default('manual'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userStartAtIdx: index('outfit_plan_user_start_at_idx').on(
      table.userId,
      table.startAt,
    ),
    userStatusIdx: index('outfit_plan_user_status_idx').on(
      table.userId,
      table.status,
    ),
    userOutfitIdx: index('outfit_plan_user_outfit_idx').on(
      table.userId,
      table.outfitId,
    ),
    userDateRangeIdx: index('outfit_plan_user_date_range_idx').on(
      table.userId,
      table.startAt,
      table.endAt,
    ),
    generationBatchIdx: index('outfit_plan_generation_batch_idx').on(
      table.generationBatchId,
    ),
  }),
)

export const stylistPreferenceProfile = pgTable(
  'stylist_preference_profile',
  {
    userId: text('userId').primaryKey(),
    preferredStyles: jsonb('preferredStyles')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dislikedStyles: jsonb('dislikedStyles')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    preferredColors: jsonb('preferredColors')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    avoidedColors: jsonb('avoidedColors')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    preferredFormality: text('preferredFormality').notNull().default(''),
    preferredFit: text('preferredFit').notNull().default(''),
    preferredWardrobeItemIds: jsonb('preferredWardrobeItemIds')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    dislikedWardrobeItemIds: jsonb('dislikedWardrobeItemIds')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    updatedAtIdx: index('stylist_preference_profile_updated_at_idx').on(
      table.updatedAt,
    ),
  }),
)

export const wearLog = pgTable(
  'wear_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    outfitId: uuid('outfitId').references(() => outfit.id, {
      onDelete: 'set null',
    }),
    wornAt: timestamp('wornAt').notNull(),
    source: text('source').notNull(),
    note: text('note'),
    idempotencyKey: text('idempotencyKey'),
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
    updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  },
  (table) => ({
    userWornAtIdx: index('wear_log_user_worn_at_idx').on(
      table.userId,
      table.wornAt,
    ),
    userOutfitIdx: index('wear_log_user_outfit_idx').on(
      table.userId,
      table.outfitId,
    ),
    userIdempotencyIdx: uniqueIndex('wear_log_user_idempotency_idx')
      .on(table.userId, table.idempotencyKey)
      .where(sql`"idempotencyKey" is not null`),
  }),
)

export const wearLogItem = pgTable(
  'wear_log_item',
  {
    wearLogId: uuid('wearLogId')
      .notNull()
      .references(() => wearLog.id, { onDelete: 'cascade' }),
    wardrobeItemId: uuid('wardrobeItemId')
      .notNull()
      .references(() => wardrobeItem.id, { onDelete: 'cascade' }),
    role: text('role'),
    createdAt: timestamp('createdAt').notNull().defaultNow(),
  },
  (table) => ({
    wearLogIdx: index('wear_log_item_wear_log_idx').on(table.wearLogId),
    wardrobeItemIdx: index('wear_log_item_wardrobe_item_idx').on(
      table.wardrobeItemId,
    ),
  }),
)
