import { describe, it, expect, beforeEach, vi } from 'vitest'

// clearBlacklist() は公開 API ではないため、各テスト前にモジュールを再ロードして
// インメモリ Set をリセットする。これにより テスト間の状態汚染を防ぐ。
let addToBlacklist: (token: string) => void
let isBlacklisted: (token: string) => boolean

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('./blacklist')
  addToBlacklist = mod.addToBlacklist
  isBlacklisted = mod.isBlacklisted
})

describe('isBlacklisted', () => {
  it('returns false for a token that has not been blacklisted', () => {
    const token = 'token-that-was-never-added'
    expect(isBlacklisted(token)).toBe(false)
  })

  it('returns true for a token that has been added to the blacklist', () => {
    const token = 'blacklisted-token-abc123'
    addToBlacklist(token)
    expect(isBlacklisted(token)).toBe(true)
  })
})

describe('addToBlacklist', () => {
  it('adding the same token twice is idempotent — isBlacklisted still returns true', () => {
    const token = 'idempotent-token-xyz789'
    addToBlacklist(token)
    addToBlacklist(token)
    expect(isBlacklisted(token)).toBe(true)
  })

  it('blacklisting one token does not affect other tokens', () => {
    const tokenA = 'token-aaa'
    const tokenB = 'token-bbb'
    addToBlacklist(tokenA)
    expect(isBlacklisted(tokenB)).toBe(false)
  })
})
