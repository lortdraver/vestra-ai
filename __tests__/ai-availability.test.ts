import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAiAvailability } from '@/lib/ai/availability'

describe('getAiAvailability', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports both features available when real credentials are set', () => {
    vi.stubEnv('AI_PROVIDER', 'openai-compatible')
    vi.stubEnv('AI_API_KEY', 'key')
    vi.stubEnv('AI_API_BASE_URL', 'https://example.test/v1')
    vi.stubEnv('AI_MODEL_ID', 'model')
    vi.stubEnv('STYLIST_AI_PROVIDER', '')
    vi.stubEnv('AI_FEATURES_DISABLED', '')

    expect(getAiAvailability()).toEqual({ analysis: true, stylist: true })
  })

  it('reports features off when the API key is removed', () => {
    vi.stubEnv('AI_PROVIDER', 'openai-compatible')
    vi.stubEnv('AI_API_KEY', '')
    vi.stubEnv('AI_API_BASE_URL', 'https://example.test/v1')
    vi.stubEnv('AI_MODEL_ID', 'model')
    vi.stubEnv('STYLIST_AI_PROVIDER', '')
    vi.stubEnv('STYLIST_AI_API_KEY', '')

    expect(getAiAvailability()).toEqual({ analysis: false, stylist: false })
  })

  it('honours the explicit AI_FEATURES_DISABLED switch', () => {
    vi.stubEnv('AI_PROVIDER', 'openai-compatible')
    vi.stubEnv('AI_API_KEY', 'key')
    vi.stubEnv('AI_API_BASE_URL', 'https://example.test/v1')
    vi.stubEnv('AI_MODEL_ID', 'model')
    vi.stubEnv('AI_FEATURES_DISABLED', 'true')

    expect(getAiAvailability()).toEqual({ analysis: false, stylist: false })
  })
})
