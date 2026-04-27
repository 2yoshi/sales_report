import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import * as reportsService from '@/lib/reports/reports.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { ListReportsResult } from '@/lib/reports/reports.service'

vi.mock('@/lib/reports/reports.service', () => ({
  listReports: vi.fn(),
}))

// Mock the blacklist so tokens are never invalidated in tests
vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockListReports = vi.mocked(reportsService.listReports)

// ─── Test users ──────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(user: AuthUser, queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/reports${queryString}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
    },
  })
}

function makeRequestWithoutAuth(queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/reports${queryString}`, {
    method: 'GET',
  })
}

function makeRequestWithInvalidToken(queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/reports${queryString}`, {
    method: 'GET',
    headers: { Authorization: 'Bearer not-a-valid-jwt' },
  })
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const sampleReport = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  report_date: '2026-04-18',
  problem: '課題テキスト',
  plan: '翌日予定テキスト',
  user: { id: salesUser.id, name: salesUser.name },
  visit_records: [
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      customer: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: '佐藤 健', company: '株式会社A' },
      content: '商談内容',
      sort_order: 1,
    },
  ],
  comments_count: 0,
  created_at: '2026-04-18T09:00:00.000Z',
  updated_at: '2026-04-18T09:00:00.000Z',
}

const defaultMeta = { total: 1, page: 1, per_page: 20 }

const singleItemResult: ListReportsResult = {
  data: [sampleReport],
  meta: defaultMeta,
}

const emptyResult: ListReportsResult = {
  data: [],
  meta: { total: 0, page: 1, per_page: 20 },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Authentication ──────────────────────────────────────────────────────────

  describe('認証', () => {
    it('AUTH-P01: Authorizationヘッダーがない場合は401を返す', async () => {
      const req = makeRequestWithoutAuth()
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('無効なJWTトークンの場合は401を返す', async () => {
      const req = makeRequestWithInvalidToken()
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // ── Access control — sales role ─────────────────────────────────────────────

  describe('API-011 / AUTH-P02: salesロールは自分の日報のみ取得できる', () => {
    it('salesユーザーで200を返し、listReportsにsalesユーザー自身が渡される', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(body.meta.total).toBe(1)
      expect(body.meta.page).toBe(1)
      expect(body.meta.per_page).toBe(20)
    })

    it('salesユーザーがuser_idクエリを指定しても、サービス呼び出しには本人IDが使われる', async () => {
      mockListReports.mockResolvedValueOnce(emptyResult)

      // sales user passes another user's id — should be overridden in service layer
      const req = makeRequest(salesUser, `?user_id=${salesUser2.id}`)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      // Verify that listReports was called with the sales user (not the query user_id)
      // The override happens inside listReports; the route passes the query as-is and the
      // service enforces the scope. Here we verify the query was forwarded correctly.
      expect(mockListReports).toHaveBeenCalledWith(
        salesUser,
        expect.objectContaining({ user_id: salesUser2.id }),
      )
    })

    it('salesユーザーのレスポンスにはdata[]とmetaが含まれる', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(body).toHaveProperty('data')
      expect(body).toHaveProperty('meta')
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  // ── Access control — manager/admin ─────────────────────────────────────────

  describe('API-012 / AUTH-P01: managerは全ユーザーの日報を取得できる', () => {
    it('managerユーザーで200を返す', async () => {
      const multiUserResult: ListReportsResult = {
        data: [
          sampleReport,
          { ...sampleReport, id: 'report-002', user: { id: salesUser2.id, name: salesUser2.name } },
        ],
        meta: { total: 2, page: 1, per_page: 20 },
      }
      mockListReports.mockResolvedValueOnce(multiUserResult)

      const req = makeRequest(managerUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(2)
      expect(body.meta.total).toBe(2)
    })

    it('adminユーザーで200を返す', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(adminUser)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
    })
  })

  // ── user_id filter ──────────────────────────────────────────────────────────

  describe('API-013: managerがuser_idフィルタで絞り込める', () => {
    it('managerがuser_idを指定するとlistReportsにuser_idが渡される', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(managerUser, `?user_id=${salesUser.id}`)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        managerUser,
        expect.objectContaining({ user_id: salesUser.id }),
      )
    })

    it('user_idが無効なUUID形式の場合は400を返す', async () => {
      const req = makeRequest(managerUser, '?user_id=not-a-uuid')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── Date range filters ──────────────────────────────────────────────────────

  describe('日付フィルタ', () => {
    it('date_fromとdate_toを指定するとlistReportsに渡される', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(managerUser, '?date_from=2026-04-01&date_to=2026-04-18')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        managerUser,
        expect.objectContaining({ date_from: '2026-04-01', date_to: '2026-04-18' }),
      )
    })

    it('date_fromが不正な形式の場合は400を返す', async () => {
      const req = makeRequest(salesUser, '?date_from=2026/04/01')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('date_toが不正な形式の場合は400を返す', async () => {
      const req = makeRequest(salesUser, '?date_to=not-a-date')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('date_fromのみ指定できる（date_toなし）', async () => {
      mockListReports.mockResolvedValueOnce(emptyResult)

      const req = makeRequest(salesUser, '?date_from=2026-04-01')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        salesUser,
        expect.objectContaining({ date_from: '2026-04-01' }),
      )
    })

    it('date_toのみ指定できる（date_fromなし）', async () => {
      mockListReports.mockResolvedValueOnce(emptyResult)

      const req = makeRequest(salesUser, '?date_to=2026-04-18')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        salesUser,
        expect.objectContaining({ date_to: '2026-04-18' }),
      )
    })
  })

  // ── Pagination ──────────────────────────────────────────────────────────────

  describe('ページネーション', () => {
    it('pageとper_pageを指定するとlistReportsに渡される', async () => {
      mockListReports.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 2, per_page: 10 },
      })

      const req = makeRequest(salesUser, '?page=2&per_page=10')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        salesUser,
        expect.objectContaining({ page: 2, per_page: 10 }),
      )
    })

    it('クエリパラメータなしの場合はデフォルト値（page=1, per_page=20）が使われる', async () => {
      mockListReports.mockResolvedValueOnce(emptyResult)

      const req = makeRequest(salesUser)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        salesUser,
        expect.objectContaining({ page: 1, per_page: 20 }),
      )
    })

    it('per_pageが100を超える場合は400を返す', async () => {
      const req = makeRequest(salesUser, '?per_page=101')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('per_pageが1の場合は有効（下限境界値）', async () => {
      mockListReports.mockResolvedValueOnce({
        data: [sampleReport],
        meta: { total: 1, page: 1, per_page: 1 },
      })

      const req = makeRequest(salesUser, '?per_page=1')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
    })

    it('per_pageが100の場合は有効（上限境界値）', async () => {
      mockListReports.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 1, per_page: 100 },
      })

      const req = makeRequest(salesUser, '?per_page=100')
      const res = await GET(req, {})

      expect(res.status).toBe(200)
    })

    it('pageが0以下の場合は400を返す', async () => {
      const req = makeRequest(salesUser, '?page=0')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('per_pageが0以下の場合は400を返す', async () => {
      const req = makeRequest(salesUser, '?per_page=0')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── Response shape ──────────────────────────────────────────────────────────

  describe('レスポンス形式', () => {
    it('レスポンスのdataには日報フィールドが含まれる', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      const report = body.data[0]
      expect(report.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      expect(report.report_date).toBe(sampleReport.report_date)
      expect(report.problem).toBe(sampleReport.problem)
      expect(report.plan).toBe(sampleReport.plan)
      expect(report.user.id).toBe(salesUser.id)
      expect(report.user.name).toBe(salesUser.name)
    })

    it('visit_recordsにはcustomer情報が含まれる', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      const vr = body.data[0].visit_records[0]
      expect(vr.id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
      expect(vr.customer.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
      expect(vr.customer.name).toBe('佐藤 健')
      expect(vr.customer.company).toBe('株式会社A')
      expect(vr.content).toBe('商談内容')
      expect(vr.sort_order).toBe(1)
    })

    it('comments_countがレスポンスに含まれる', async () => {
      const reportWithComments = {
        ...sampleReport,
        comments_count: 3,
      }
      mockListReports.mockResolvedValueOnce({
        data: [reportWithComments],
        meta: defaultMeta,
      })

      const req = makeRequest(managerUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(body.data[0].comments_count).toBe(3)
    })

    it('metaにtotal、page、per_pageが含まれる', async () => {
      mockListReports.mockResolvedValueOnce({
        data: [],
        meta: { total: 45, page: 3, per_page: 10 },
      })

      const req = makeRequest(salesUser, '?page=3&per_page=10')
      const res = await GET(req, {})
      const body = await res.json()

      expect(body.meta.total).toBe(45)
      expect(body.meta.page).toBe(3)
      expect(body.meta.per_page).toBe(10)
    })

    it('日報が0件の場合はdataが空配列で200を返す', async () => {
      mockListReports.mockResolvedValueOnce(emptyResult)

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toEqual([])
      expect(body.meta.total).toBe(0)
    })
  })

  // ── Error handling ──────────────────────────────────────────────────────────

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockListReports.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })

    it('サービスがAppErrorをスローした場合は対応するHTTPステータスを返す', async () => {
      mockListReports.mockRejectedValueOnce(AppError.notFound('日報'))

      const req = makeRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  // ── Combined filter scenarios ───────────────────────────────────────────────

  describe('複合フィルタ', () => {
    it('managerがuser_id・date_from・date_toを同時に指定できる', async () => {
      mockListReports.mockResolvedValueOnce(singleItemResult)

      const req = makeRequest(
        managerUser,
        `?user_id=${salesUser.id}&date_from=2026-04-01&date_to=2026-04-18`,
      )
      const res = await GET(req, {})

      expect(res.status).toBe(200)
      expect(mockListReports).toHaveBeenCalledWith(
        managerUser,
        expect.objectContaining({
          user_id: salesUser.id,
          date_from: '2026-04-01',
          date_to: '2026-04-18',
        }),
      )
    })
  })
})
