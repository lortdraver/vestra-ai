/**
 * An `analyzing` status is a lease, not a permanent lock. If the request that
 * claimed it dies (timeout, deploy, crash), the lease expires and the item can
 * be analyzed again. `updatedAt` is set when the lease is claimed.
 */
export const ANALYSIS_LEASE_MS = 3 * 60_000

export function getAnalysisLeaseCutoff(now = new Date()) {
  return new Date(now.getTime() - ANALYSIS_LEASE_MS)
}

export function isAnalysisLeaseStale(
  status: string,
  updatedAt: Date | string,
  now = new Date(),
) {
  if (status !== 'analyzing') return false
  return new Date(updatedAt).getTime() < getAnalysisLeaseCutoff(now).getTime()
}

export function resolveAnalysisDisplayState(
  item: {
    analysisStatus: string
    analysisError: string | null
    updatedAt: Date | string
  },
  now = new Date(),
) {
  if (isAnalysisLeaseStale(item.analysisStatus, item.updatedAt, now)) {
    return {
      analysisStatus: 'failed' as const,
      analysisError: 'ai_provider_timeout',
    }
  }

  return {
    analysisStatus: item.analysisStatus,
    analysisError: item.analysisError,
  }
}
