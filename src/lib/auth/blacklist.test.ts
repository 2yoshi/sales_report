import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so the mock fns are available inside the vi.mock factory
const { mockUpsert, mockFindFirst } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tokenBlacklist: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

import { addToBlacklist, isBlacklisted } from './blacklist'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('addToBlacklist', () => {
  it('calls prisma.tokenBlacklist.upsert with the token and an expiresAt in the future', async () => {
    mockUpsert.mockResolvedValueOnce({})
    const before = new Date()

    await addToBlacklist('some-token')

    expect(mockUpsert).toHaveBeenCalledOnce()
    const [call] = mockUpsert.mock.calls
    expect(call[0].where).toEqual({ token: 'some-token' })
    expect(call[0].create.token).toBe('some-token')
    expect(call[0].create.expiresAt).toBeInstanceOf(Date)
    expect(call[0].create.expiresAt > before).toBe(true)
  })

  it('calling addToBlacklist twice with the same token is idempotent (upsert, not insert)', async () => {
    mockUpsert.mockResolvedValue({})

    await addToBlacklist('idempotent-token')
    await addToBlacklist('idempotent-token')

    expect(mockUpsert).toHaveBeenCalledTimes(2)
    // Both calls target the same token — the DB upsert handles deduplication
    expect(mockUpsert.mock.calls[0][0].where).toEqual({ token: 'idempotent-token' })
    expect(mockUpsert.mock.calls[1][0].where).toEqual({ token: 'idempotent-token' })
  })
})

describe('isBlacklisted', () => {
  it('returns true when prisma finds a matching non-expired entry', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'some-id', token: 'blacklisted-token' })

    const result = await isBlacklisted('blacklisted-token')

    expect(result).toBe(true)
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ token: 'blacklisted-token' }),
      }),
    )
  })

  it('returns false when prisma finds no matching entry', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const result = await isBlacklisted('clean-token')

    expect(result).toBe(false)
  })

  it('passes an expiresAt gt filter so expired entries are ignored', async () => {
    mockFindFirst.mockResolvedValueOnce(null)
    const before = new Date()

    await isBlacklisted('any-token')

    const where = mockFindFirst.mock.calls[0][0].where
    expect(where.expiresAt.gt).toBeInstanceOf(Date)
    expect(where.expiresAt.gt >= before).toBe(true)
  })
})
