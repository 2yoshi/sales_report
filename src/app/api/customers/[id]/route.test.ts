import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT } from './route'
import * as customersService from '@/lib/customers/customers.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { CustomerItem } from '@/lib/customers/customers.service'

vi.mock('@/lib/customers/customers.service', () => ({
  getCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}))

vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockGetCustomer = vi.mocked(customersService.getCustomer)
const mockUpdateCustomer = vi.mocked(customersService.updateCustomer)

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

const CUSTOMER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const sampleCustomer: CustomerItem = {
  id: CUSTOMER_ID,
  name: '佐藤 健',
  company: '株式会社A',
  phone: '03-1234-5678',
  email: 'sato@example.com',
  created_at: '2026-04-29T09:00:00.000Z',
  updated_at: '2026-04-29T09:00:00.000Z',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(user: AuthUser, id: string): NextRequest {
  return new NextRequest(`http://localhost/api/customers/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${generateToken(user)}` },
  })
}

function makePutRequest(user: AuthUser, id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/customers/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const validUpdateBody = {
  name: '佐藤 次郎',
  company: '株式会社B',
  phone: '03-9999-9999',
  email: 'sato2@example.com',
}

// ─── GET /api/customers/[id] ─────────────────────────────────────────────────

describe('GET /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest(`http://localhost/api/customers/${CUSTOMER_ID}`, {
        method: 'GET',
      })
      const res = await GET(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('全ロールが顧客詳細を取得できる', () => {
    it('salesユーザーで200を返す', async () => {
      mockGetCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makeGetRequest(salesUser, CUSTOMER_ID)
      const res = await GET(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toMatchObject({ id: CUSTOMER_ID, name: '佐藤 健' })
    })

    it('managerユーザーで200を返す', async () => {
      mockGetCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makeGetRequest(managerUser, CUSTOMER_ID)
      const res = await GET(req, { params: { id: CUSTOMER_ID } })

      expect(res.status).toBe(200)
    })

    it('adminユーザーで200を返す', async () => {
      mockGetCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makeGetRequest(adminUser, CUSTOMER_ID)
      const res = await GET(req, { params: { id: CUSTOMER_ID } })

      expect(res.status).toBe(200)
    })
  })

  describe('404ケース', () => {
    it('存在しないIDの場合は404を返す', async () => {
      mockGetCustomer.mockRejectedValueOnce(AppError.notFound('顧客'))

      const req = makeGetRequest(salesUser, CUSTOMER_ID)
      const res = await GET(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('UUID形式でないIDの場合は404を返す', async () => {
      const req = makeGetRequest(salesUser, 'not-a-uuid')
      const res = await GET(req, { params: { id: 'not-a-uuid' } })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockGetCustomer).not.toHaveBeenCalled()
    })
  })
})

// ─── PUT /api/customers/[id] ─────────────────────────────────────────────────

describe('PUT /api/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest(`http://localhost/api/customers/${CUSTOMER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateBody),
      })
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('API-044: 全ロールが顧客を更新できる', () => {
    it('salesユーザーで200を返す', async () => {
      const updatedCustomer = { ...sampleCustomer, name: '佐藤 次郎' }
      mockUpdateCustomer.mockResolvedValueOnce(updatedCustomer)

      const req = makePutRequest(salesUser, CUSTOMER_ID, validUpdateBody)
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.name).toBe('佐藤 次郎')
    })

    it('managerユーザーで200を返す', async () => {
      mockUpdateCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makePutRequest(managerUser, CUSTOMER_ID, validUpdateBody)
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })

      expect(res.status).toBe(200)
    })

    it('adminユーザーで200を返す', async () => {
      mockUpdateCustomer.mockResolvedValueOnce(sampleCustomer)

      const req = makePutRequest(adminUser, CUSTOMER_ID, validUpdateBody)
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })

      expect(res.status).toBe(200)
    })
  })

  describe('バリデーション', () => {
    it('nameが未指定の場合は400を返す', async () => {
      const { name: _omit, ...bodyWithout } = validUpdateBody
      const req = makePutRequest(salesUser, CUSTOMER_ID, bodyWithout)
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('emailが不正な形式の場合は400を返す', async () => {
      const req = makePutRequest(salesUser, CUSTOMER_ID, { ...validUpdateBody, email: 'invalid' })
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('404ケース', () => {
    it('存在しないIDの場合は404を返す', async () => {
      mockUpdateCustomer.mockRejectedValueOnce(AppError.notFound('顧客'))

      const req = makePutRequest(salesUser, CUSTOMER_ID, validUpdateBody)
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('UUID形式でないIDの場合は404を返す', async () => {
      const req = makePutRequest(salesUser, 'not-a-uuid', validUpdateBody)
      const res = await PUT(req, { params: { id: 'not-a-uuid' } })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockUpdateCustomer).not.toHaveBeenCalled()
    })
  })

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockUpdateCustomer.mockRejectedValueOnce(new Error('DB error'))

      const req = makePutRequest(salesUser, CUSTOMER_ID, validUpdateBody)
      const res = await PUT(req, { params: { id: CUSTOMER_ID } })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})
