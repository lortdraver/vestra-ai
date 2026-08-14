import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  adminRangePresets,
  type AdminAnalyticsSnapshot,
  type AdminRangePreset,
} from '@/lib/analytics/admin'
import { getAdminAnalyticsCopy } from '@/lib/analytics/admin-copy'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AdminAnalyticsDashboard({
  snapshot,
  preset,
  locale,
  dictionary,
  securityEvents,
  auditEvents,
}: {
  snapshot: AdminAnalyticsSnapshot
  preset: AdminRangePreset
  locale: Locale
  dictionary: Dictionary
  securityEvents: Array<{ id: string; eventType: string; severity: string }>
  auditEvents: Array<{ id: string; action: string; entityType: string }>
}) {
  const copy = getAdminAnalyticsCopy(locale)
  const numberFormatter = new Intl.NumberFormat(toIntlLocale(locale))
  const percentFormatter = new Intl.NumberFormat(toIntlLocale(locale), {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })
  const dateFormatter = new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: 'medium',
  })

  return (
    <div className="grid gap-6">
      <Card className="border-foreground/10">
        <CardHeader className="gap-4 lg:flex lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="font-serif text-3xl font-medium">
              {copy.title}
            </CardTitle>
            <CardDescription className="max-w-3xl">
              {copy.subtitle}
            </CardDescription>
          </div>
          <div className="grid gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {copy.rangeLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {adminRangePresets.map((rangeOption) => (
                <Link
                  key={rangeOption}
                  href={`/dashboard/admin?range=${rangeOption}`}
                  className={cn(
                    buttonVariants({
                      variant: rangeOption === preset ? 'default' : 'outline',
                      size: 'sm',
                    }),
                    'min-h-11 rounded-full px-4',
                  )}
                  aria-current={rangeOption === preset ? 'true' : undefined}
                >
                  {copy.rangeOptions[rangeOption]}
                </Link>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <MetricsSection
        title={copy.sections.users}
        icon={Users}
        items={[
          {
            label: copy.labels.totalUsers,
            value: numberFormatter.format(snapshot.overview.totalUsers),
          },
          {
            label: copy.labels.verifiedUsers,
            value: numberFormatter.format(snapshot.overview.verifiedUsers),
          },
          {
            label: copy.labels.newUsersToday,
            value: numberFormatter.format(snapshot.overview.newUsersToday),
          },
          {
            label: copy.labels.newUsers7d,
            value: numberFormatter.format(snapshot.overview.newUsersLast7Days),
          },
          {
            label: copy.labels.newUsers30d,
            value: numberFormatter.format(snapshot.overview.newUsersLast30Days),
          },
        ]}
      />

      <MetricsSection
        title={copy.sections.activity}
        icon={Activity}
        items={[
          {
            label: copy.labels.dau,
            value: numberFormatter.format(snapshot.activity.dau),
          },
          {
            label: copy.labels.wau,
            value: numberFormatter.format(snapshot.activity.wau),
          },
          {
            label: copy.labels.mau,
            value: numberFormatter.format(snapshot.activity.mau),
          },
          {
            label: copy.labels.dauMau,
            value: formatPercent(
              snapshot.activity.dauMauRatio,
              percentFormatter,
            ),
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1.8fr]">
        <MetricsSection
          title={copy.sections.activation}
          icon={CheckCircle2}
          items={[
            {
              label: copy.labels.activatedUsers,
              value: numberFormatter.format(snapshot.activation.activatedUsers),
            },
            {
              label: copy.labels.activationRate,
              value: formatPercent(
                snapshot.activation.activationRate,
                percentFormatter,
              ),
            },
          ]}
          compact
        />
        <MetricsSection
          title={copy.sections.product}
          icon={Sparkles}
          items={[
            {
              label: copy.labels.totalActiveWardrobeItems,
              value: numberFormatter.format(
                snapshot.product.totalActiveWardrobeItems,
              ),
            },
            {
              label: copy.labels.averageWardrobeSize,
              value: numberFormatter.format(
                Number(snapshot.product.averageWardrobeSize.toFixed(1)),
              ),
            },
            {
              label: copy.labels.wardrobeItems7d,
              value: numberFormatter.format(
                snapshot.product.wardrobeItemsCreatedLast7Days,
              ),
            },
            {
              label: copy.labels.wardrobeItems30d,
              value: numberFormatter.format(
                snapshot.product.wardrobeItemsCreatedLast30Days,
              ),
            },
            {
              label: copy.labels.stylistGenerations,
              value: numberFormatter.format(
                snapshot.product.stylistGenerationsInRange,
              ),
            },
            {
              label: copy.labels.stylistFailureRate,
              value: formatPercent(
                snapshot.product.stylistFailureRate,
                percentFormatter,
              ),
            },
            {
              label: copy.labels.aiFailureRate,
              value: formatPercent(
                snapshot.product.aiAnalysisFailureRate,
                percentFormatter,
              ),
            },
            {
              label: copy.labels.outfitsCreated,
              value: numberFormatter.format(
                snapshot.product.outfitsCreatedInRange,
              ),
            },
            {
              label: copy.labels.plannerSchedules,
              value: numberFormatter.format(
                snapshot.product.plannerSchedulesInRange,
              ),
            },
            {
              label: copy.labels.wearLogs,
              value: numberFormatter.format(snapshot.product.wearLogsInRange),
            },
          ]}
        />
      </div>

      <MetricsSection
        title={copy.sections.subscriptions}
        icon={CalendarRange}
        items={[
          {
            label: copy.labels.freeUsers,
            value: numberFormatter.format(snapshot.subscriptions.freeUsers),
          },
          {
            label: copy.labels.premiumUsers,
            value: numberFormatter.format(snapshot.subscriptions.premiumUsers),
          },
          {
            label: copy.labels.trialUsers,
            value: numberFormatter.format(snapshot.subscriptions.trialUsers),
          },
          {
            label: copy.labels.monthlyProUsers,
            value: numberFormatter.format(
              snapshot.subscriptions.monthlyProUsers,
            ),
          },
          {
            label: copy.labels.annualProUsers,
            value: numberFormatter.format(
              snapshot.subscriptions.annualProUsers,
            ),
          },
          {
            label: copy.labels.pastDueUsers,
            value: numberFormatter.format(snapshot.subscriptions.pastDueUsers),
          },
          {
            label: copy.labels.canceledUsers,
            value: numberFormatter.format(snapshot.subscriptions.canceledUsers),
          },
        ]}
        compact
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={copy.charts.newUsers}
          points={snapshot.charts.newUsers}
          locale={locale}
          emptyLabel={copy.states.noData}
        />
        <ChartCard
          title={copy.charts.activeUsers}
          points={snapshot.charts.activeUsers}
          locale={locale}
          emptyLabel={copy.states.noData}
        />
        <ChartCard
          title={copy.charts.stylistGenerations}
          points={snapshot.charts.stylistGenerations}
          locale={locale}
          emptyLabel={copy.states.noData}
        />
        <ChartCard
          title={copy.charts.wardrobeItems}
          points={snapshot.charts.wardrobeItemsCreated}
          locale={locale}
          emptyLabel={copy.states.noData}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle>{copy.sections.funnel}</CardTitle>
            <CardDescription>{copy.states.approximation}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {snapshot.funnel.stages.map((stage, index) => (
              <div
                key={stage.key}
                className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {getFunnelStageLabel(copy, stage.key)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {index === 0
                      ? copy.states.operational
                      : formatPercent(
                          stage.conversionFromPrevious,
                          percentFormatter,
                        )}
                  </p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {numberFormatter.format(stage.count)}
                </p>
                <div className="h-2 self-center rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-foreground/80 transition-[width]"
                    style={{
                      width: `${Math.max(
                        8,
                        Math.round(
                          (stage.count /
                            Math.max(
                              snapshot.funnel.stages[0]?.count ?? 1,
                              1,
                            )) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle>{copy.sections.retention}</CardTitle>
            <CardDescription
              title={copy.labels.retentionExplanation}
              aria-label={copy.labels.retentionExplanation}
            >
              {copy.labels.activeDefinition}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <RetentionRow
              label="D1"
              metric={snapshot.retention.d1}
              percentFormatter={percentFormatter}
              copy={copy}
            />
            <RetentionRow
              label="D7"
              metric={snapshot.retention.d7}
              percentFormatter={percentFormatter}
              copy={copy}
            />
            <RetentionRow
              label="D30"
              metric={snapshot.retention.d30}
              percentFormatter={percentFormatter}
              copy={copy}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-foreground/10">
          <CardHeader>
            <CardTitle>{copy.sections.insights}</CardTitle>
            <CardDescription>{copy.states.operational}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <InsightList
              title={copy.labels.topCategories}
              items={snapshot.fashionInsights.categories}
              emptyLabel={copy.states.noData}
            />
            <InsightList
              title={copy.labels.topSubtypes}
              items={snapshot.fashionInsights.subtypes}
              emptyLabel={copy.states.noData}
            />
            <InsightList
              title={copy.labels.topColors}
              items={snapshot.fashionInsights.colors}
              emptyLabel={copy.states.noData}
            />
            <InsightList
              title={copy.labels.topStyles}
              items={snapshot.fashionInsights.styles}
              emptyLabel={copy.states.noData}
            />
            <InsightList
              title={copy.labels.topSeasons}
              items={snapshot.fashionInsights.seasons}
              emptyLabel={copy.states.noData}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <MetricsSection
            title={copy.sections.health}
            icon={Shield}
            items={[
              {
                label: copy.labels.stylistSuccessRate,
                value: formatPercent(
                  snapshot.health.stylistSuccessRate,
                  percentFormatter,
                ),
              },
              {
                label: copy.labels.aiSuccessRate,
                value: formatPercent(
                  snapshot.health.aiAnalysisSuccessRate,
                  percentFormatter,
                ),
              },
              {
                label: copy.labels.backgroundSuccessRate,
                value: formatPercent(
                  snapshot.health.backgroundRemovalSuccessRate,
                  percentFormatter,
                ),
              },
            ]}
            compact
          />

          <Card className="border-foreground/10">
            <CardHeader>
              <CardTitle>{copy.sections.externalTools}</CardTitle>
              <CardDescription>{copy.states.operational}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <ExternalToolLink
                href={snapshot.externalTools.gaUrl}
                title={copy.labels.googleAnalytics}
                cta={copy.states.openGoogleAnalytics}
              />
              <ExternalToolLink
                href={snapshot.externalTools.clarityUrl}
                title={copy.labels.clarity}
                cta={copy.states.openClarity}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-foreground/10">
        <CardHeader>
          <CardTitle>{copy.sections.userTable}</CardTitle>
          <CardDescription>{dictionary.admin.users}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">{dictionary.auth.email}</th>
                <th className="py-2 pr-4">{copy.labels.registrationDate}</th>
                <th className="py-2 pr-4">{copy.labels.verifiedState}</th>
                <th className="py-2 pr-4">{copy.labels.plan}</th>
                <th className="py-2 pr-4">{copy.labels.wardrobeCount}</th>
                <th className="py-2 pr-4">{copy.labels.lastActivity}</th>
                <th className="py-2">{copy.labels.stylistCount}</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="border-t border-border py-6 text-center text-sm text-muted-foreground"
                  >
                    {copy.states.noData}
                  </td>
                </tr>
              ) : (
                snapshot.users.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-border align-top"
                  >
                    <td className="py-3 pr-4 text-foreground">{entry.email}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatDate(entry.registeredAt, dateFormatter)}
                    </td>
                    <td className="py-3 pr-4">
                      <StateBadge
                        positive={entry.isVerified}
                        label={
                          entry.isVerified
                            ? copy.states.verified
                            : copy.states.unverified
                        }
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <PlanBadge plan={entry.plan} copy={copy} />
                    </td>
                    <td className="py-3 pr-4">
                      {numberFormatter.format(entry.wardrobeItemCount)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {entry.lastMeaningfulActivityAt
                        ? formatDate(
                            entry.lastMeaningfulActivityAt,
                            dateFormatter,
                          )
                        : copy.states.noActivity}
                    </td>
                    <td className="py-3">
                      {numberFormatter.format(entry.stylistGenerationCount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <LogsCard
          title={copy.sections.securityLogs}
          emptyLabel={copy.states.noLogs}
          rows={securityEvents.map((event) => ({
            id: event.id,
            label: event.eventType,
            value: event.severity,
          }))}
        />
        <LogsCard
          title={copy.sections.auditLogs}
          emptyLabel={copy.states.noLogs}
          rows={auditEvents.map((event) => ({
            id: event.id,
            label: event.action,
            value: event.entityType,
          }))}
        />
      </section>
    </div>
  )
}

function MetricsSection({
  title,
  icon: Icon,
  items,
  compact = false,
}: {
  title: string
  icon: typeof Activity
  items: Array<{ label: string; value: string }>
  compact?: boolean
}) {
  return (
    <Card className="border-foreground/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent
        className={cn(
          'grid gap-3 sm:grid-cols-2 xl:grid-cols-4',
          compact && 'xl:grid-cols-3',
        )}
      >
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-muted/20 p-4"
          >
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  points,
  locale,
  emptyLabel,
}: {
  title: string
  points: AdminAnalyticsSnapshot['charts']['newUsers']
  locale: Locale
  emptyLabel: string
}) {
  const dateFormatter = new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: 'short',
    day: 'numeric',
  })
  const maxValue = Math.max(...points.map((point) => point.value), 0)

  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {maxValue === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="flex h-36 min-w-[320px] items-end gap-1">
                {points.map((point) => {
                  const height = Math.max(
                    10,
                    Math.round((point.value / maxValue) * 100),
                  )

                  return (
                    <div
                      key={point.date}
                      title={`${formatChartDate(point.date, dateFormatter)}: ${point.value}`}
                      className="flex flex-1 items-end"
                    >
                      <div
                        className="w-full rounded-t-full bg-foreground/80 transition-[height]"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatChartDate(points[0]?.date, dateFormatter)}</span>
              <span>{formatChartDate(points.at(-1)?.date, dateFormatter)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RetentionRow({
  label,
  metric,
  percentFormatter,
  copy,
}: {
  label: string
  metric: AdminAnalyticsSnapshot['retention']['d1']
  percentFormatter: Intl.NumberFormat
  copy: ReturnType<typeof getAdminAnalyticsCopy>
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">
          {metric.state === 'ready'
            ? formatPercent(metric.rate, percentFormatter)
            : copy.states.notEnoughData}
        </p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {metric.state === 'ready'
          ? `${metric.retainedUsers} / ${metric.eligibleCohortSize}`
          : copy.states.notEnoughData}
      </p>
    </div>
  )
}

function InsightList({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: Array<{ key: string; count: number }>
  emptyLabel: string
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={`${title}-${item.key}`}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
            >
              {item.key}{' '}
              <span className="text-muted-foreground">{item.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ExternalToolLink({
  href,
  title,
  cta,
}: {
  href: string
  title: string
  cta: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
    >
      <span className="font-medium text-foreground">{title}</span>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        {cta}
        <ArrowUpRight className="size-4" />
      </span>
    </a>
  )
}

function LogsCard({
  title,
  emptyLabel,
  rows,
}: {
  title: string
  emptyLabel: string
  rows: Array<{ id: string; label: string; value: string }>
}) {
  return (
    <Card className="border-foreground/10">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm"
            >
              <span>{row.label}</span>
              <span className="font-medium text-foreground">{row.value}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function PlanBadge({
  plan,
  copy,
}: {
  plan: AdminAnalyticsSnapshot['users'][number]['plan']
  copy: ReturnType<typeof getAdminAnalyticsCopy>
}) {
  const label =
    plan === 'premium'
      ? copy.plans.premium
      : plan === 'trial'
        ? copy.plans.trial
        : copy.plans.free

  return (
    <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  )
}

function StateBadge({ label, positive }: { label: string; positive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        positive
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      )}
    >
      {positive ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <CircleAlert className="size-3.5" />
      )}
      {label}
    </span>
  )
}

function formatPercent(value: number | null, formatter: Intl.NumberFormat) {
  return value == null ? '—' : formatter.format(value)
}

function formatDate(value: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(value))
}

function formatChartDate(
  value: string | undefined,
  formatter: Intl.DateTimeFormat,
) {
  if (!value) return '—'
  return formatter.format(new Date(value))
}

function getFunnelStageLabel(
  copy: ReturnType<typeof getAdminAnalyticsCopy>,
  key: AdminAnalyticsSnapshot['funnel']['stages'][number]['key'],
) {
  switch (key) {
    case 'registered':
      return copy.labels.registered
    case 'verified':
      return copy.labels.emailVerified
    case 'first_wardrobe':
      return copy.labels.firstWardrobe
    case 'first_stylist':
      return copy.labels.firstStylist
    case 'first_saved':
      return copy.labels.firstSaved
  }
}

function toIntlLocale(locale: Locale) {
  switch (locale) {
    case 'az':
      return 'az-Latn-AZ'
    case 'ru':
      return 'ru-RU'
    case 'en':
    default:
      return 'en-US'
  }
}
