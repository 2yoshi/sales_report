import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listUsers, POST as createUser } from '@/app/api/users/route'
import { PUT as updateUser, DELETE as deleteUser } from '@/app/api/users/[id]/route'
import {
  clearDatabase,
  seedTestUsers,
  seedTestCustomers,
  createTestReport,
  prisma,
  TEST_USERS,
  TEST_CUSTOMERS,
} from '../helpers/db'
import { makeToken } from '../helpers/auth'

const YAMADA = TEST_USERS.yamada   // sales
const ADMIN = TEST_USERS.admin     // admin
const CUST01 = TEST_CUSTOMERS.cust01

const BASE = 'http://localhost/api/users'

type TestUser = (typeof TEST_USERS)[keyof typeof TEST_USERS]

function makeRequest(
  url: string,
  method: string,
  user: TestUser,
  body?: unknown,
): NextRequest {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${makeToken(user)}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('ユーザーAPI', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ─── USR-001: GET /users admin → 200, 全ユーザー ─────────────────────────────

  describe('USR-001: GET /users admin → 200, 全ユーザー', () => {
    it('adminが全ユーザー一覧を取得すると200とユーザー配列を返す', async () => {
      const req = makeRequest(BASE, 'GET', ADMIN)
      const res = await listUsers(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(4) // yamada, suzuki, tanaka, admin
      expect(body.meta).toHaveProperty('total', 4)
    })

    it('salesがユーザー一覧を取得しようとすると403を返す', async () => {
      const req = makeRequest(BASE, 'GET', YAMADA)
      const res = await listUsers(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── USR-002: POST /users 正常 → 201 ─────────────────────────────────────────

  describe('USR-002: POST /users 正常 → 201', () => {
    it('adminが新規ユーザーを作成すると201と作成ユーザーを返す', async () => {
      const req = makeRequest(BASE, 'POST', ADMIN, {
        name: '新規 ユーザー',
        email: 'new-user@test.com',
        password: 'NewPass1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toHaveProperty('id')
      expect(body.data.name).toBe('新規 ユーザー')
      expect(body.data.email).toBe('new-user@test.com')
      expect(body.data.role).toBe('sales')
      // パスワードハッシュが返らないことを確認
      expect(body.data).not.toHaveProperty('passwordHash')
      expect(body.data).not.toHaveProperty('password')
    })
  })

  // ─── USR-003: PUT /users/:id ロール変更 → 200 ────────────────────────────────

  describe('USR-003: PUT /users/:id ロール変更 → 200', () => {
    it('adminがユーザーのロールを変更すると200と更新後データを返す', async () => {
      const req = makeRequest(`${BASE}/${YAMADA.id}`, 'PUT', ADMIN, {
        name: YAMADA.name,
        email: YAMADA.email,
        role: 'manager',
      })
      const res = await updateUser(req, idContext(YAMADA.id))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(YAMADA.id)
      expect(body.data.role).toBe('manager')
    })

    it('adminでない場合(sales)はユーザー更新で403を返す', async () => {
      const req = makeRequest(`${BASE}/${YAMADA.id}`, 'PUT', YAMADA, {
        name: YAMADA.name,
        email: YAMADA.email,
        role: 'manager',
      })
      const res = await updateUser(req, idContext(YAMADA.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── USR-004: DELETE /users/:id 日報なし → 204 ───────────────────────────────

  describe('USR-004: DELETE /users/:id 日報なし → 204', () => {
    it('日報を持たないユーザーをadminが削除すると204を返す', async () => {
      // YAMADA は日報なしの状態（beforeEachでclearDatabase済み）
      const req = makeRequest(`${BASE}/${YAMADA.id}`, 'DELETE', ADMIN)
      const res = await deleteUser(req, idContext(YAMADA.id))

      expect(res.status).toBe(204)

      // DBに存在しないことを確認
      const deleted = await prisma.user.findUnique({ where: { id: YAMADA.id } })
      expect(deleted).toBeNull()
    })
  })

  // ─── USR-005: DELETE /users/:id 日報あり → 409, USER_IN_USE ─────────────────

  describe('USR-005: DELETE /users/:id 日報あり → 409, USER_IN_USE', () => {
    it('日報を持つユーザーを削除しようとすると409とUSER_IN_USEを返す', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${YAMADA.id}`, 'DELETE', ADMIN)
      const res = await deleteUser(req, idContext(YAMADA.id))

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('USER_IN_USE')
    })
  })

  // ─── USR-006: POST /users 重複メール → 409, EMAIL_ALREADY_EXISTS ─────────────

  describe('USR-006: POST /users 重複メール → 409, EMAIL_ALREADY_EXISTS', () => {
    it('既存ユーザーと同じメールで作成しようとすると409とEMAIL_ALREADY_EXISTSを返す', async () => {
      const req = makeRequest(BASE, 'POST', ADMIN, {
        name: '重複 ユーザー',
        email: YAMADA.email, // 既存のメールアドレス
        password: 'Test1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS')
    })
  })
})
