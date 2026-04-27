import { describe, it, expect, beforeEach, vi } from 'vitest'
import { logoutUser } from './logout.service'

// Use the same mock pattern as guard.test.ts to control the blacklist state
const blacklistedSet = new Set<string>()

vi.mock('./blacklist', () => ({
  addToBlacklist: (token: string) => blacklistedSet.add(token),
  isBlacklisted: (token: string) => blacklistedSet.has(token),
}))

beforeEach(() => {
  blacklistedSet.clear()
})

describe('logoutUser', () => {
  it('returns the expected success message', () => {
    const result = logoutUser('some-token')
    expect(result.message).toBe('ログアウトしました')
  })

  it('adds the token to the blacklist so subsequent requests are rejected', async () => {
    const { isBlacklisted } = await import('./blacklist')
    const token = 'valid-jwt-token-abc123'

    expect(isBlacklisted(token)).toBe(false)
    logoutUser(token)
    expect(isBlacklisted(token)).toBe(true)
  })

  it('calling logoutUser twice with the same token is idempotent', async () => {
    const { isBlacklisted } = await import('./blacklist')
    const token = 'idempotent-token-xyz'

    logoutUser(token)
    logoutUser(token)
    expect(isBlacklisted(token)).toBe(true)
  })

  it('blacklisting one token does not affect other tokens', async () => {
    const { isBlacklisted } = await import('./blacklist')
    const tokenA = 'token-user-001'
    const tokenB = 'token-user-002'

    logoutUser(tokenA)
    expect(isBlacklisted(tokenB)).toBe(false)
  })
})
