# Roadmap

Completed through M6.2. The next milestone is the next approved M6.x slice.

## M6.1: Wear Tracking And Wardrobe Insights

Status: completed.

- Added immutable wear logs for single items, multiple items, and outfits.
- Added wardrobe utilization, recent activity, never-worn, long-unused, and
  category usage insights.
- Added in-app mark-as-worn actions and undo for the latest newly created log.
- Kept weather, calendar, shopping, payments, and money-saved counters out of
  scope.

## M6.2: Multi-Outfit Generation And Explicit Preferences

Status: completed.

- Generate multiple outfit candidates from owned active wardrobe items.
- Group candidates in a generation batch while preserving existing saved outfit
  compatibility.
- Add deterministic candidate diversity checks.
- Add same-role item replacement.
- Store explicit feedback and editable stylist preferences.
- Keep M6.3 weather/calendar/shopping features out of scope.

## M6: Wardrobe Intelligence And Lifecycle

Goal: turn the wardrobe from a catalog into an intelligent clothing system.

- Persist wardrobe item favorite state.
- Add item statuses: new, often worn, not worn for a long time, in laundry, archived.
- Expand wear history into deeper lifecycle workflows.
- Add laundry tracking.
- Build on the M6.1 item usage frequency foundation.
- Add cost-per-wear calculations.
- Add wardrobe completeness score.
- Add duplicate/similar item detection.
- Add underused item recommendations.
- Add missing essentials recommendations.
- Add seasonal readiness view.
- Add wardrobe health dashboard.
- Add bulk edit and bulk delete.
- Add advanced filters for color, material, formality, warmth, and AI confidence.

Exit criteria:

- Vestra can explain what the user owns, what they use, what they ignore, and what they may be missing.

## M7: AI Stylist v2 And Outfit Planning

Goal: make the stylist proactive, contextual, and repeat-use friendly.

- Add persistent conversation threads.
- Add outfit calendar.
- Add daily outfit suggestions.
- Add weather-aware suggestions.
- Add location-aware climate assumptions where user permits.
- Add wardrobe availability checks using laundry and wear state.
- Add outfit regeneration controls by style, formality, weather, and color.
- Add "complete this outfit" with selected base item.
- Add outfit collections.
- Add packing list generator for trips.
- Add event-based planning: work week, vacation, wedding, university week.
- Add feedback learning loop.
- Add "why not" explanations for rejected items.
- Add outfit comparison view.

Exit criteria:

- A user can plan what to wear for today, the week, and a trip using only owned clothing.

## M8: Real Payments, Billing And Launch Monetization

Goal: connect the subscription architecture to real payment providers.

- Implement Stripe checkout and billing portal.
- Evaluate Payriff and Epoint for Azerbaijan-focused payments.
- Add webhook processing.
- Add subscription reconciliation jobs.
- Add invoice/payment history UI.
- Enforce premium feature gates with production-grade checks.
- Add billing audit logs.
- Add refund/cancel flows.
- Add affiliate disclosure foundation.
- Add revenue analytics.

Exit criteria:

- Vestra can charge for Premium safely while preserving the Free plan.

## M9: Marketplace, Local Brands And Second-Hand Integration

Goal: help users buy fewer, better, and more compatible items.

- Add wardrobe gap recommendations tied to real partner inventory.
- Add local brand discovery.
- Add second-hand item recommendations.
- Add size/profile compatibility checks.
- Add color and style compatibility checks against the user's wardrobe.
- Add "works with X items you own" explanation.
- Add affiliate disclosure UI.
- Add save-for-later shopping list.
- Add partner admin/import workflow.
- Add inventory freshness checks.
- Add abuse prevention for low-quality partner listings.

Exit criteria:

- Vestra can recommend items responsibly, prioritizing compatibility, sustainability, and local/second-hand options.

## M10: Virtual Try-On And Advanced Visual AI

Goal: move from wardrobe intelligence into visual confidence.

- Add mirror selfie mode.
- Add full outfit segmentation.
- Add body-aware fit notes without sensitive body scoring.
- Add virtual try-on provider abstraction.
- Add production virtual try-on provider.
- Add side-by-side try-on comparison.
- Add outfit board exports.
- Add shareable look links with privacy controls.
- Add advanced background replacement for editorial outfit boards.
- Add visual consistency checks for generated try-on images.
- Add safety guardrails for image handling and user consent.

Exit criteria:

- Users can preview outfit ideas visually while retaining control over privacy and realism.

## Recently Completed: M6.3 Weather-Aware Outfit Planner

- Internal `outfit_plan` table and authenticated planner CRUD APIs.
- Weather provider abstraction with explicit mock mode, real adapter, TTL cache,
  timeout handling, and stale fallback.
- Weather-aware stylist request context and deterministic suitability filtering.
- Today planner UI, 7-day list, mark worn/skipped actions, and dashboard access.
