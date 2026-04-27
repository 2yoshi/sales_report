import { describe, it, expect, beforeEach } from 'vitest'
import { addToBlacklist, isBlacklisted, clearBlacklist } from './blacklist'

beforeEach(() => {
  clearBlacklist()
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
