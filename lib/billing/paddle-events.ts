export const supportedPaddleWebhookEvents = new Set([
  'transaction.completed',
  'transaction.payment_failed',
  'subscription.created',
  'subscription.activated',
  'subscription.updated',
  'subscription.canceled',
  'subscription.past_due',
  'subscription.paused',
  'subscription.resumed',
  'subscription.trialing',
])

export function isSubscriptionLifecycleEvent(eventType: string) {
  return eventType.startsWith('subscription.')
}
