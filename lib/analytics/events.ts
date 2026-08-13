import { z } from 'zod'
import type { Locale } from '@/lib/i18n/config'

export const analyticsEventNames = [
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
  'stylist_generation_requested',
  'stylist_generation_completed',
  'stylist_generation_failed',
  'stylist_outfit_saved',
  'stylist_feedback_submitted',
  'stylist_preferences_updated',
  'outfit_created',
  'outfit_deleted',
  'outfit_worn',
  'planner_day_opened',
  'planner_weather_loaded',
  'planner_weather_failed',
  'planner_outfit_generated',
  'planner_outfit_scheduled',
  'planner_outfit_changed',
  'planner_outfit_deleted',
  'planner_weather_change_detected',
  'planner_outfit_adapted',
  'planner_outfit_marked_worn',
  'upgrade_viewed',
  'checkout_started',
  'subscription_started',
  'subscription_trial_started',
  'subscription_cancelled',
  'subscription_plan_changed',
] as const

export type AnalyticsEventName = (typeof analyticsEventNames)[number]
export type AnalyticsLocale = Locale

const scalar = z.union([z.string().max(200), z.number().finite(), z.boolean()])
const propertySchema = z.record(z.string(), scalar.or(z.array(scalar).max(32)))

export const analyticsEventPropertySchemas: Record<
  AnalyticsEventName,
  typeof propertySchema
> = Object.fromEntries(
  analyticsEventNames.map((eventName) => [eventName, propertySchema]),
) as Record<AnalyticsEventName, typeof propertySchema>

export type AnalyticsProperties = z.infer<typeof propertySchema>

export type AnalyticsEventInput = {
  [Name in AnalyticsEventName]: {
    eventName: Name
    properties?: AnalyticsProperties
    userId?: string | null
    anonymousId?: string | null
    sessionId?: string | null
    locale?: AnalyticsLocale | null
    path?: string | null
    planKey?: string | null
    dedupeKey?: string | null
    occurredAt?: Date
    context?: AnalyticsProperties
  }
}[AnalyticsEventName]
