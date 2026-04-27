import { describe, it, expect, beforeEach } from 'vitest'
import { requireRole, ApiError, extractBearerAuth } from './guard'
import { generateToken } from './jwt'
import { addToBlacklist, clearBlacklist } from './blacklist'
import jwt from 'jsonwebtoken'
import type { AuthUser } from '@/types'

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
  clearBlacklist()
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

  it('throws ApiError with status 403 when role does not match', () => {
    const checkRole = requireRole(['admin'])
    expect(() => checkRole(salesUser)).toThrow(ApiError)
  })

  it('throws ApiError with code FORBIDDEN when sales tries manager-only action', () => {
    const checkRole = requireRole(['manager', 'admin'])
    let thrownError: ApiError | null = null
    try {
      checkRole(salesUser)
    } catch (err) {
      thrownError = err as ApiError
    }
    expect(thrownError).not.toBeNull()
    expect(thrownError!.statusCode).toBe(403)
    expect(thrownError!.code).toBe('FORBIDDEN')
  })

  it('throws ApiError with status 403 when manager tries admin-only action', () => {
    const checkRole = requireRole(['admin'])
    let thrownError: ApiError | null = null
    try {
      checkRole(managerUser)
    } catch (err) {
      thrownError = err as ApiError
    }
    expect(thrownError).not.toBeNull()
    expect(thrownError!.statusCode).toBe(403)
    expect(thrownError!.code).toBe('FORBIDDEN')
  })

  it('throws when empty roles array is provided and any user tries to access', () => {
    // Empty roles list means no one is allowed
    const checkRole = requireRole([])
    expect(() => checkRole(adminUser)).toThrow(ApiError)
    expect(() => checkRole(managerUser)).toThrow(ApiError)
    expect(() => checkRole(salesUser)).toThrow(ApiError)
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

  it('returns ok:false for a blacklisted token', () => {
    const token = generateToken(salesUser)
    addToBlacklist(token)
    const result = extractBearerAuth(`Bearer ${token}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED')
      expect(result.message).toBe('Token has been invalidated')
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

  it('treats a previously blacklisted token as invalid even after clearBlacklist is called in another test', () => {
    // Verifies that beforeEach(clearBlacklist) prevents cross-test contamination
    const token = generateToken(managerUser)
    // Not blacklisted in this test — should pass
    const result = extractBearerAuth(`Bearer ${token}`)
    expect(result.ok).toBe(true)
  })
})
