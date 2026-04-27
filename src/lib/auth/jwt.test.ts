import { describe, it, expect } from 'vitest'
import { generateToken, verifyToken } from './jwt'
import type { AuthUser } from '@/types'
import jwt from 'jsonwebtoken'

const testUser: AuthUser = {
  id: 'user-001',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

describe('generateToken', () => {
  it('generates a token that can be verified and returns the original payload', () => {
    const token = generateToken(testUser)
    const decoded = verifyToken(token)

    expect(decoded.id).toBe(testUser.id)
    expect(decoded.name).toBe(testUser.name)
    expect(decoded.email).toBe(testUser.email)
    expect(decoded.role).toBe(testUser.role)
  })

  it('generates a non-empty string token', () => {
    const token = generateToken(testUser)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })
})

describe('verifyToken', () => {
  it('throws on an invalid token string', () => {
    expect(() => verifyToken('not-a-valid-token')).toThrow()
  })

  it('throws on an expired token', () => {
    const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
    const expiredToken = jwt.sign({ ...testUser }, secret, { expiresIn: -1 })
    expect(() => verifyToken(expiredToken)).toThrow()
  })

  it('throws on a token signed with a different secret', () => {
    const wrongToken = jwt.sign({ ...testUser }, 'wrong-secret', { expiresIn: '1h' })
    expect(() => verifyToken(wrongToken)).toThrow()
  })

  it('decoded payload contains all required user fields', () => {
    const adminUser: AuthUser = {
      id: 'user-004',
      name: '管理 太郎',
      email: 'admin@test.com',
      role: 'admin',
    }
    const token = generateToken(adminUser)
    const decoded = verifyToken(token)

    expect(decoded.id).toBe('user-004')
    expect(decoded.name).toBe('管理 太郎')
    expect(decoded.email).toBe('admin@test.com')
    expect(decoded.role).toBe('admin')
  })

  it('decoded payload does not include JWT internal fields like iat/exp', () => {
    const token = generateToken(testUser)
    const decoded = verifyToken(token)

    // verifyToken should return only AuthUser fields
    expect(decoded).toEqual({
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
    })
  })
})
