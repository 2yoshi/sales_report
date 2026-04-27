import { describe, it, expect } from 'vitest'
import { requireRole, ApiError } from './guard'
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
