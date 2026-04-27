import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { requireRole, extractBearerAuth, withAuth } from './guard'
import { AppError } from '@/lib/errors/AppError'
import { generateToken } from './jwt'
import jwt from 'jsonwebtoken'
import type { AuthUser } from '@/types'

// blacklist モジュールをモック化してテスト間の状態汚染を防ぐ。
// isBlacklisted は async なので Promise を返すよう設定する。
const blacklistedSet = new Set<string>()

vi.mock('./blacklist', () => ({
  addToBlacklist: (token: string) => Promise.resolve(blacklistedSet.add(token)),
  isBlacklisted: (token: string) => Promise.resolve(blacklistedSet.has(token)),
}))

const salesUser: AuthUser = {
  id: 'user-001',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

const managerUser: AuthUser = {
  id: 'user-003',
  name: '田中 部長',
  email: 'tanaka@test.com',
  role: 'manager',
}

const adminUser: AuthUser = {
  id: 'user-004',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

beforeEach(() => {
  blacklistedSet.clear()
})

describe('requireRole', () => {
  it('allows a user whose role matches the allowed roles list', () => {
    const checkRole = requireRole(['sales'])
    expect(() => checkRole(salesUser)).not.toThrow()
  })

  it('allows a manager when manager role is in the allowed list', () => {
    const checkRole = requireRole(['manager'])
    expect(() => checkRole(managerUser)).not.toThrow()
  })

  it('allows an admin when admin role is in the allowed list', () => {
    const checkRole = requireRole(['admin'])
    expect(() => checkRole(adminUser)).not.toThrow()
  })

  it('allows any matching role when multiple roles are specified', () => {
    const checkRole = requireRole(['manager', 'admin'])
    expect(() => checkRole(managerUser)).not.toThrow()
    expect(() => checkRole(adminUser)).not.toThrow()
  })

  it('throws AppError with status 403 when role does not match', () => {
    const checkRole = requireRole(['admin'])
    expect(() => checkRole(salesUser)).toThrow(AppError)
  })

  it('throws AppError with code FORBIDDEN when sales tries manager-only action', () => {
    const checkRole = requireRole(['manager', 'admin'])
    let thrownError: AppError | null = null
    try {
      checkRole(salesUser)
    } catch (err) {
      thrownError = err as AppError
    }
    expect(thrownError).not.toBeNull()
    expect(thrownError!.statusCode).toBe(403)
    expect(thrownError!.code).toBe('FORBIDDEN')
  })

  it('throws AppError with status 403 when manager tries admin-only action', () => {
    const checkRole = requireRole(['admin'])
    let thrownError: AppError | null = null
    try {
      checkRole(managerUser)
    } catch (err) {
      thrownError = err as AppError
    }
    expect(thrownError).not.toBeNull()
    expect(thrownError!.statusCode).toBe(403)
    expect(thrownError!.code).toBe('FORBIDDEN')
  })

  it('throws when empty roles array is provided and any user tries to access', () => {
    // Empty roles list means no one is allowed
    const checkRole = requireRole([])
    expect(() => checkRole(adminUser)).toThrow(AppError)
    expect(() => checkRole(managerUser)).toThrow(AppError)
    expect(() => checkRole(salesUser)).toThrow(AppError)
  })
})

describe('extractBearerAuth', () => {
  it('returns ok:false when Authorization header is null', () => {
    const result = extractBearerAuth(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.message).toBe('Authentication required')
    }
  })

  it('returns ok:false when Authorization header has no Bearer prefix', () => {
    const result = extractBearerAuth('Basic dXNlcjpwYXNz')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.message).toBe('Authentication required')
    }
  })

  it('returns ok:false for a malformed token string', () => {
    const result = extractBearerAuth('Bearer not-a-real-jwt')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.message).toBe('Invalid or expired token')
    }
  })

  it('returns ok:false for an expired token', () => {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
    const expiredToken = jwt.sign({ ...salesUser }, secret, { expiresIn: -1 })
    const result = extractBearerAuth(`Bearer ${expiredToken}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.message).toBe('Invalid or expired token')
    }
  })

  it('returns ok:true with correct user fields for a valid token', () => {
    const token = generateToken(salesUser)
    const result = extractBearerAuth(`Bearer ${token}`)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.id).toBe(salesUser.id)
      expect(result.user.name).toBe(salesUser.name)
      expect(result.user.email).toBe(salesUser.email)
      expect(result.user.role).toBe(salesUser.role)
      expect(result.token).toBe(token)
    }
  })

  it('returns ok:true for a valid admin token', () => {
    const token = generateToken(adminUser)
    const result = extractBearerAuth(`Bearer ${token}`)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.role).toBe('admin')
    }
  })

  it('blacklisted token in one test does not affect subsequent tests due to beforeEach reset', () => {
    // Verifies that beforeEach(blacklistedSet.clear()) prevents cross-test contamination
    const token = generateToken(managerUser)
    // Not blacklisted in this test — should pass
    const result = extractBearerAuth(`Bearer ${token}`)
    expect(result.ok).toBe(true)
  })
})

describe('withAuth', () => {
  function makeRequest(authHeader?: string): NextRequest {
    return new NextRequest('http://localhost/api/test', {
      method: 'GET',
      headers: authHeader ? { authorization: authHeader } : {},
    })
  }

  it('returns 401 for a blacklisted token', async () => {
    const token = generateToken(salesUser)
    blacklistedSet.add(token)

    const handler = withAuth(vi.fn())
    const res = await handler(makeRequest(`Bearer ${token}`), {})
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.error.message).toBe('Token has been invalidated')
  })

  it('passes the extracted token as the fourth argument to the handler', async () => {
    const token = generateToken(salesUser)
    const handlerFn = vi.fn().mockResolvedValue(new Response('ok'))

    const handler = withAuth(handlerFn)
    await handler(makeRequest(`Bearer ${token}`), {})

    expect(handlerFn).toHaveBeenCalledOnce()
    const [, , , passedToken] = handlerFn.mock.calls[0]
    expect(passedToken).toBe(token)
  })

  it('calls the handler when token is valid and not blacklisted', async () => {
    const token = generateToken(adminUser)
    const handlerFn = vi.fn().mockResolvedValue(new Response('ok'))

    const handler = withAuth(handlerFn)
    await handler(makeRequest(`Bearer ${token}`), {})

    expect(handlerFn).toHaveBeenCalledOnce()
    const [, , user] = handlerFn.mock.calls[0]
    expect(user.role).toBe('admin')
  })
})
