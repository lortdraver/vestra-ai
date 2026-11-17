import { describe, expect, it } from 'vitest'
import {
  SUPPORT_MESSAGE_MAX_LENGTH,
  cleanSupportBody,
} from '@/lib/support/service'

describe('support chat messages', () => {
  it('trims text and normalises line breaks', () => {
    expect(cleanSupportBody('  Hello\r\nthere  ')).toBe('Hello\nthere')
  })

  it('rejects empty, non-text and over-long messages', () => {
    expect(cleanSupportBody('   ')).toBeNull()
    expect(cleanSupportBody(42)).toBeNull()
    expect(
      cleanSupportBody('x'.repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1)),
    ).toBeNull()
    expect(
      cleanSupportBody('x'.repeat(SUPPORT_MESSAGE_MAX_LENGTH)),
    ).not.toBeNull()
  })
})
