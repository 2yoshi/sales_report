import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { generateToken } from '@/lib/auth/jwt'
import type { AuthUser } from '@/types'

// Control the blacklist state; mock returns Promises since blacklist is now async.
const blacklistedSet = new Set<string>()

vi.mock('@/lib/auth/blacklist', () => ({
  addToBlacklist: (token: string) => Promise.resolve(blacklistedSet.add(token)),
  isBlacklisted: (token: string) => Promise.resolve(blacklistedSet.has(token)),
}))

import { POST } from './route'

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

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

beforeEach(() => {
  blacklistedSet.clear()
})

describe('POST /api/auth/logout', () => {
  describe('API-003: 有効なトークン付きリクエスト → 200', () => {
    it('salesユーザーの有効なトークンでログアウトすると200とメッセージが返る', async () => {
      const token = generateToken(salesUser)
      const req = makeRequest(`Bearer ${token}`)

      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.message).toBe('ログアウトしました')
    })

    it('managerユーザーの有効なトークンでログアウトすると200が返る', async () => {
      const token = generateToken(managerUser)
      const req = makeRequest(`Bearer ${token}`)

      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.message).toBe('ログアウトしました')
    })

    it('adminユーザーの有効なトークンでログアウトすると200が返る', async () => {
      const token = generateToken(adminUser)
      const req = makeRequest(`Bearer ${token}`)

      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.message).toBe('ログアウトしました')
    })

    it('ログアウト後にそのトークンはブラックリストに登録される', async () => {
      const token = generateToken(salesUser)
      const req = makeRequest(`Bearer ${token}`)

      await POST(req, {})

      expect(blacklistedSet.has(token)).toBe(true)
    })

    it('ログアウト済みトークンで再度リクエストすると401が返る', async () => {
      const token = generateToken(salesUser)

      // First logout
      await POST(makeRequest(`Bearer ${token}`), {})

      // Second request with same token — now blacklisted
      const res = await POST(makeRequest(`Bearer ${token}`), {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('API-004: トークンなし → 401 UNAUTHORIZED', () => {
    it('Authorizationヘッダーが存在しない場合は401を返す', async () => {
      const req = makeRequest()

      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('BearerプレフィックスなしのAuthorizationヘッダーは401を返す', async () => {
      const req = makeRequest('Basic dXNlcjpwYXNz')

      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('不正なJWTトークンは401を返す', async () => {
      const req = makeRequest('Bearer not-a-real-jwt')

      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })
})
