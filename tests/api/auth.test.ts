import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'
import { clearDatabase, seedTestUsers, prisma, TEST_USERS } from '../helpers/db'
import { makeToken } from '../helpers/auth'

function makeLoginRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeLogoutRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return new NextRequest('http://localhost/api/auth/logout', {
    method: 'POST',
    headers,
  })
}

describe('認証API', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('API-001: POST /auth/login 正しい認証情報 → 200', () => {
    it('正しいメールアドレスとパスワードで200とaccess_tokenを返す', async () => {
      const req = makeLoginRequest({ email: TEST_USERS.yamada.email, password: 'Test1234!' })
      const res = await loginHandler(req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveProperty('access_token')
      expect(typeof body.data.access_token).toBe('string')
      expect(body.data.token_type).toBe('Bearer')
      expect(body.data.user.email).toBe(TEST_USERS.yamada.email)
      expect(body.data.user.role).toBe('sales')
    })
  })

  describe('API-002: POST /auth/login 誤ったパスワード → 401, INVALID_CREDENTIALS', () => {
    it('誤ったパスワードで401とINVALID_CREDENTIALSを返す', async () => {
      const req = makeLoginRequest({ email: TEST_USERS.yamada.email, password: 'WrongPass999!' })
      const res = await loginHandler(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_CREDENTIALS')
    })

    it('存在しないメールアドレスでも401とINVALID_CREDENTIALSを返す（情報漏洩防止）', async () => {
      const req = makeLoginRequest({ email: 'notexist@test.com', password: 'Test1234!' })
      const res = await loginHandler(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('API-003: POST /auth/logout 有効なトークン → 200', () => {
    it('有効なトークンで200を返す', async () => {
      const token = makeToken(TEST_USERS.yamada)
      const req = makeLogoutRequest(token)
      const res = await logoutHandler(req, {})

      expect(res.status).toBe(200)
    })
  })

  describe('API-004: POST /auth/logout トークンなし → 401, UNAUTHORIZED', () => {
    it('Authorizationヘッダーなしで401とUNAUTHORIZEDを返す', async () => {
      const req = makeLogoutRequest()
      const res = await logoutHandler(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })
})
