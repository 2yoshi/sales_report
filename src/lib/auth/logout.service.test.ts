import { describe, it, expect, beforeEach, vi } from 'vitest'

const blacklistedSet = new Set<string>()

vi.mock('./blacklist', () => ({
  addToBlacklist: (token: string) => Promise.resolve(blacklistedSet.add(token)),
  isBlacklisted: (token: string) => Promise.resolve(blacklistedSet.has(token)),
}))

import { logoutUser } from './logout.service'

beforeEach(() => {
  blacklistedSet.clear()
})

describe('logoutUser', () => {
  it('returns the expected success message', async () => {
    const result = await logoutUser('some-token')
    expect(result.message).toBe('ログアウトしました')
  })

  it('adds the token to the blacklist so subsequent requests are rejected', async () => {
    const token = 'valid-jwt-token-abc123'

    expect(blacklistedSet.has(token)).toBe(false)
    await logoutUser(token)
    expect(blacklistedSet.has(token)).toBe(true)
  })

  it('calling logoutUser twice with the same token is idempotent', async () => {
    const token = 'idempotent-token-xyz'

    await logoutUser(token)
    await logoutUser(token)
    expect(blacklistedSet.has(token)).toBe(true)
  })

  it('blacklisting one token does not affect other tokens', async () => {
    const tokenA = 'token-user-001'
    const tokenB = 'token-user-002'

    await logoutUser(tokenA)
    expect(blacklistedSet.has(tokenB)).toBe(false)
  })
})
