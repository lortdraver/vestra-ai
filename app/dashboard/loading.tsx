export default function DashboardLoading() {
  return (
    <div
      className="grid gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="grid gap-3">
        <div className="h-8 w-2/3 max-w-sm animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-1/2 max-w-xs animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="aspect-[4/5] animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    </div>
  )
}
