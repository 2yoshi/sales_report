import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { clearDatabase, seedTestUsers, prisma } from '../helpers/db'

const BASE = 'http://localhost/api/auth/login'

function makeRequest(body?: unknown): NextRequest {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(BASE, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('ログインAPIバリデーション', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // VAL-001: メールアドレス空欄 → 400, VALIDATION_ERROR
  describe('VAL-001: メールアドレス空欄 → 400, VALIDATION_ERROR', () => {
    it('メールアドレスが空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ email: '', password: 'Test1234!' })
      const res = await loginPost(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-002: メールアドレスが plain text（メール形式でない） → 400, VALIDATION_ERROR
  describe('VAL-002: メールアドレスが不正形式 → 400, VALIDATION_ERROR', () => {
    it('メールアドレスがメール形式でない場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ email: 'not-an-email', password: 'Test1234!' })
      const res = await loginPost(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-003: パスワード空欄 → 400, VALIDATION_ERROR
  describe('VAL-003: パスワード空欄 → 400, VALIDATION_ERROR', () => {
    it('パスワードが空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ email: 'yamada@test.com', password: '' })
      const res = await loginPost(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
