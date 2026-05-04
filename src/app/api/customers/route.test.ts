import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import * as customersService from '@/lib/customers/customers.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { ListCustomersResult, CustomerItem } from '@/lib/customers/customers.service'

vi.mock('@/lib/customers/customers.service', () => ({
  listCustomers: vi.fn(),
  createCustomer: vi.fn(),
}))

vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockListCustomers = vi.mocked(customersService.listCustomers)
const mockCreateCustomer = vi.mocked(customersService.createCustomer)

// ─── Test users ──────────────────────────────────────────────────────────────

const salesUser: AuthUser = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

const managerUser: AuthUser = {
  id: '33333333-3333-3333-3333-333333333333',
  name: '田中 部長',
  email: 'tanaka@test.com',
  role: 'manager',
}

const adminUser: AuthUser = {
  id: '44444444-4444-4444-4444-444444444444',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const sampleCustomer: CustomerItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: '佐藤 健',
  company: '株式会社A',
  phone: '03-1234-5678',
  email: 'sato@example.com',
  created_at: '2026-04-29T09:00:00.000Z',
  updated_at: '2026-04-29T09:00:00.000Z',
}

const defaultListResult: ListCustomersResult = {
  data: [sampleCustomer],
  meta: { total: 1, page: 1, per_page: 20 },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(user: AuthUser, queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/customers${queryString}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${generateToken(user)}` },
  })
}

function makePostRequest(user: AuthUser, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/customers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function makeRequestWithoutAuth(path = '/api/customers'): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'GET' })
}

// ─── GET /api/customers ───────────────────────────────────────────────────────

describe('GET /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = makeRequestWithoutAuth()
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('API-041: 全ロールが顧客一覧を取得できる', () => {
    it('salesユーザーで200を返す', async () => {
      mockListCustomers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(body.meta.total).toBe(1)
    })

    it('managerユーザーで200を返す', async () => {
      mockListCustomers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(managerUser)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
    })

    it('adminユーザーで200を返す', async () => {
      mockListCustomers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(adminUser)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
    })
  })

  describe('API-042: qパラメータで部分一致検索できる', () => {
    it('qパラメータがlistCustomersに渡される', async () => {
      mockListCustomers.mockResolvedValueOnce({ data: [], meta: { total: 0, page: 1, per_page: 20 } })

      const req = makeGetRequest(salesUser, '?q=佐藤')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ q: '佐藤' }),
      )
    })
  })

  describe('ページネーション', () => {
    it('デフォルト値（page=1, per_page=20）が使われる', async () => {
      mockListCustomers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(salesUser)
      await GET(req, {})

      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, per_page: 20 }),
      )
    })

    it('page・per_pageを指定できる', async () => {
      mockListCustomers.mockResolvedValueOnce({ data: [], meta: { total: 0, page: 2, per_page: 10 } })

      const req = makeGetRequest(salesUser, '?page=2&per_page=10')
      await GET(req, {})

      expect(mockListCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, per_page: 10 }),
      )
    })

    it('per_pageが101の場合は400を返す', async () => {
      const req = makeGetRequest(salesUser, '?per_page=101')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('pageが0の場合は400を返す', async () => {
      const req = makeGetRequest(salesUser, '?page=0')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('レスポンス形式', () => {
    it('顧客フィールドが正しく返る', async () => {
      mockListCustomers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(body.data[0]).toMatchObject({
        id: sampleCustomer.id,
        name: sampleCustomer.name,
        company: sampleCustomer.company,
        phone: sampleCustomer.phone,
        email: sampleCustomer.email,
      })
    })

    it('metaにtotal・page・per_pageが含まれる', async () => {
      mockListCustomers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(body.meta).toEqual({ total: 1, page: 1, per_page: 20 })
    })
  })

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockListCustomers.mockRejectedValueOnce(new Error('DB error'))

      const req = makeGetRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})

// ─── POST /api/customers ──────────────────────────────────────────────────────

const validBody = {
  name: '佐藤 健',
  company: '株式会社A',
  phone: '03-1234-5678',
  email: 'sato@example.com',
}

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest('http://localhost/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('API-043: 全ロールが顧客を作成できる', () => {
    it('salesユーザーで201を返す', async () => {
      mockCreateCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makePostRequest(salesUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.data).toMatchObject({ name: '佐藤 健', company: '株式会社A' })
    })

    it('managerユーザーで201を返す', async () => {
      mockCreateCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makePostRequest(managerUser, validBody)
      const res = await POST(req, {})

      expect(res.status).toBe(201)
    })

    it('adminユーザーで201を返す', async () => {
      mockCreateCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makePostRequest(adminUser, validBody)
      const res = await POST(req, {})

      expect(res.status).toBe(201)
    })
  })

  describe('バリデーション', () => {
    it('nameが未指定の場合は400を返す', async () => {
      const { name: _omit, ...bodyWithout } = validBody
      const req = makePostRequest(salesUser, bodyWithout)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('nameが101文字の場合は400を返す', async () => {
      const req = makePostRequest(salesUser, { ...validBody, name: 'a'.repeat(101) })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('emailが不正な形式の場合は400を返す', async () => {
      const req = makePostRequest(salesUser, { ...validBody, email: 'invalid-email' })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('必須フィールド(name)のみでも201を返す', async () => {
      const minimalCustomer = { ...sampleCustomer, company: null, phone: null, email: null }
      mockCreateCustomer.mockResolvedValueOnce(minimalCustomer)

      const req = makePostRequest(salesUser, { name: '佐藤 健' })
      const res = await POST(req, {})

      expect(res.status).toBe(201)
    })
  })

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockCreateCustomer.mockRejectedValueOnce(new Error('DB error'))

      const req = makePostRequest(salesUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('AppErrorをスローした場合は対応するHTTPステータスを返す', async () => {
      mockCreateCustomer.mockRejectedValueOnce(AppError.forbidden())

      const req = makePostRequest(salesUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })
})
