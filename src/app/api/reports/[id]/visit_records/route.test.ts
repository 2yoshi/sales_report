import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import * as reportsService from '@/lib/reports/reports.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { VisitRecordItem } from '@/lib/reports/reports.service'

vi.mock('@/lib/reports/reports.service', () => ({
  getVisitRecords: vi.fn(),
}))

vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockGetVisitRecords = vi.mocked(reportsService.getVisitRecords)

// ─── Test users ───────────────────────────────────────────────────────────────

const salesUser: AuthUser = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

const salesUser2: AuthUser = {
  id: '22222222-2222-2222-2222-222222222222',
  name: '鈴木 一郎',
  email: 'suzuki@test.com',
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

// ─── Sample data ──────────────────────────────────────────────────────────────

const REPORT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const sampleVisitRecords: VisitRecordItem[] = [
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    customer: {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      name: '佐藤 健',
      company: '株式会社A',
    },
    content: '商談内容',
    sort_order: 1,
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    customer: {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      name: '田中 花子',
      company: null,
    },
    content: '定例ミーティング',
    sort_order: 2,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(user: AuthUser, reportId = REPORT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/reports/${reportId}/visit_records`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
    },
  })
}

function makeRequestWithoutAuth(reportId = REPORT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/reports/${reportId}/visit_records`, {
    method: 'GET',
  })
}

function makeContext(reportId = REPORT_ID): Record<string, unknown> {
  return { params: { id: reportId } }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reports/:id/visit_records', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Authentication ──────────────────────────────────────────────────────────

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = makeRequestWithoutAuth()
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // ── UUID validation ─────────────────────────────────────────────────────────

  describe('IDバリデーション', () => {
    it('UUID形式でないIDは404を返す', async () => {
      const req = makeRequest(salesUser, 'not-a-uuid')
      const res = await GET(req, makeContext('not-a-uuid'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockGetVisitRecords).not.toHaveBeenCalled()
    })
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('正常系', () => {
    it('salesユーザーが自分の日報の訪問記録一覧を取得できる', async () => {
      mockGetVisitRecords.mockResolvedValue(sampleVisitRecords)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toEqual(sampleVisitRecords)
      expect(mockGetVisitRecords).toHaveBeenCalledWith(salesUser, REPORT_ID)
    })

    it('managerユーザーが任意の日報の訪問記録一覧を取得できる', async () => {
      mockGetVisitRecords.mockResolvedValue(sampleVisitRecords)

      const req = makeRequest(managerUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toEqual(sampleVisitRecords)
      expect(mockGetVisitRecords).toHaveBeenCalledWith(managerUser, REPORT_ID)
    })

    it('adminユーザーが任意の日報の訪問記録一覧を取得できる', async () => {
      mockGetVisitRecords.mockResolvedValue(sampleVisitRecords)

      const req = makeRequest(adminUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toEqual(sampleVisitRecords)
      expect(mockGetVisitRecords).toHaveBeenCalledWith(adminUser, REPORT_ID)
    })

    it('訪問記録が空の場合は空配列を返す', async () => {
      mockGetVisitRecords.mockResolvedValue([])

      const req = makeRequest(managerUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toEqual([])
    })
  })

  // ── Error cases ─────────────────────────────────────────────────────────────

  describe('異常系', () => {
    it('日報が存在しない場合は404を返す', async () => {
      mockGetVisitRecords.mockRejectedValue(AppError.notFound('日報'))

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('salesユーザーが他人の日報にアクセスした場合は403を返す', async () => {
      mockGetVisitRecords.mockRejectedValue(AppError.forbidden())

      const req = makeRequest(salesUser2)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })
})
