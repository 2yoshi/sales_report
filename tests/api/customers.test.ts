import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listCustomers, POST as createCustomer } from '@/app/api/customers/route'
import {
  GET as getCustomer,
  PUT as updateCustomer,
  DELETE as deleteCustomer,
} from '@/app/api/customers/[id]/route'
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
import type { AuthUser } from '@/types'

const YAMADA = TEST_USERS.yamada   // sales
const ADMIN = TEST_USERS.admin     // admin
const CUST01 = TEST_CUSTOMERS.cust01
const CUST02 = TEST_CUSTOMERS.cust02

const BASE = 'http://localhost/api/customers'

function makeRequest(
  url: string,
  method: string,
  user: AuthUser,
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

describe('顧客API', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ─── API-041: GET /customers → 200, 顧客一覧 ────────────────────────────────

  describe('API-041: GET /customers → 200, 顧客一覧', () => {
    it('顧客一覧を取得すると200と顧客配列・メタ情報を返す', async () => {
      const req = makeRequest(BASE, 'GET', YAMADA)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta).toHaveProperty('total', 2)
    })
  })

  // ─── API-042: GET /customers?q=佐藤 → 佐藤を含む顧客のみ ───────────────────

  describe('API-042: GET /customers?q=佐藤 → 名前検索', () => {
    it('q=佐藤 で佐藤を含む顧客のみ返す', async () => {
      const req = makeRequest(`${BASE}?q=佐藤`, 'GET', YAMADA)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].name).toBe(CUST01.name) // '佐藤 健'
    })

    it('q=株式会社 で社名検索ができる', async () => {
      const req = makeRequest(`${BASE}?q=株式会社`, 'GET', YAMADA)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2) // 両方が株式会社を含む
    })
  })

  // ─── API-043: POST /customers 正常 → 201 ────────────────────────────────────

  describe('API-043: POST /customers 正常 → 201', () => {
    it('新規顧客を作成すると201と作成した顧客データを返す', async () => {
      const req = makeRequest(BASE, 'POST', YAMADA, {
        name: '新規 顧客',
        company: '株式会社新規',
        email: 'new@example.com',
      })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toHaveProperty('id')
      expect(body.data.name).toBe('新規 顧客')
      expect(body.data.company).toBe('株式会社新規')
      expect(body.data.email).toBe('new@example.com')
    })

    it('company・email は省略可能で201を返す', async () => {
      const req = makeRequest(BASE, 'POST', YAMADA, { name: '最小顧客' })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe('最小顧客')
    })
  })

  // ─── GET /customers/:id 存在しない → 404 ───────────────────────────────────

  describe('GET /customers/:id → 404, 存在しないID', () => {
    it('存在しない顧客IDを指定すると404を返す', async () => {
      const nonExistentId = '00000000-0000-0000-0000-999999999999'
      const req = makeRequest(`${BASE}/${nonExistentId}`, 'GET', YAMADA)
      const res = await getCustomer(req, idContext(nonExistentId))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  // ─── API-044: PUT /customers/:id → 200, 更新後 ──────────────────────────────

  describe('API-044: PUT /customers/:id → 200, 更新後', () => {
    it('顧客情報を更新すると200と更新後のデータを返す', async () => {
      const req = makeRequest(`${BASE}/${CUST01.id}`, 'PUT', YAMADA, {
        name: '佐藤 健（更新）',
        company: '株式会社更新商事',
      })
      const res = await updateCustomer(req, idContext(CUST01.id))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('佐藤 健（更新）')
      expect(body.data.company).toBe('株式会社更新商事')
    })
  })

  // ─── API-045: DELETE /customers/:id admin + 参照なし → 204 ─────────────────

  describe('API-045: DELETE /customers/:id admin + 参照なし → 204', () => {
    it('adminが訪問記録に使われていない顧客を削除すると204を返す', async () => {
      const req = makeRequest(`${BASE}/${CUST02.id}`, 'DELETE', ADMIN)
      const res = await deleteCustomer(req, idContext(CUST02.id))

      expect(res.status).toBe(204)

      // DBに存在しないことを確認
      const deleted = await prisma.customer.findUnique({ where: { id: CUST02.id } })
      expect(deleted).toBeNull()
    })

    it('adminでない場合(sales)は403を返す', async () => {
      const req = makeRequest(`${BASE}/${CUST02.id}`, 'DELETE', YAMADA)
      const res = await deleteCustomer(req, idContext(CUST02.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── API-046: DELETE /customers/:id admin + 訪問記録あり → 409 ──────────────

  describe('API-046: DELETE /customers/:id admin + 訪問記録あり → 409, CUSTOMER_IN_USE', () => {
    it('訪問記録に使われている顧客を削除しようとすると409とCUSTOMER_IN_USEを返す', async () => {
      // CUST01 を含む日報を作成
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${CUST01.id}`, 'DELETE', ADMIN)
      const res = await deleteCustomer(req, idContext(CUST01.id))

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('CUSTOMER_IN_USE')
    })
  })
})
