import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import * as reportsService from '@/lib/reports/reports.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { ReportDetail } from '@/lib/reports/reports.service'

vi.mock('@/lib/reports/reports.service', () => ({
  listReports: vi.fn(),
  getReport: vi.fn(),
}))

// Mock the blacklist so tokens are never invalidated in tests
vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockGetReport = vi.mocked(reportsService.getReport)

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

const sampleReportDetail: ReportDetail = {
  id: REPORT_ID,
  report_date: '2026-04-19',
  problem: '課題テキスト',
  plan: '翌日予定テキスト',
  user: {
    id: salesUser.id,
    name: salesUser.name,
    role: 'sales',
  },
  visit_records: [
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
  ],
  comments: [
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      body: 'コメント本文',
      commenter: {
        id: managerUser.id,
        name: managerUser.name,
      },
      created_at: '2026-04-19T18:32:00.000Z',
    },
  ],
  created_at: '2026-04-19T09:00:00.000Z',
  updated_at: '2026-04-19T09:00:00.000Z',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(user: AuthUser, reportId = REPORT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/reports/${reportId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
    },
  })
}

function makeRequestWithoutAuth(reportId = REPORT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/reports/${reportId}`, {
    method: 'GET',
  })
}

function makeContext(reportId = REPORT_ID): Record<string, unknown> {
  return { params: { id: reportId } }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reports/:id', () => {
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

  // ── API-017: 存在するID → 200, data に全フィールド含む ──────────────────────

  describe('API-017: 存在する日報IDを指定すると全フィールドを含む200レスポンスを返す', () => {
    it('200とdataに全フィールドが含まれること', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.id).toBe(REPORT_ID)
      expect(body.data.report_date).toBe('2026-04-19')
      expect(body.data.problem).toBe('課題テキスト')
      expect(body.data.plan).toBe('翌日予定テキスト')
      expect(body.data.created_at).toBe('2026-04-19T09:00:00.000Z')
      expect(body.data.updated_at).toBe('2026-04-19T09:00:00.000Z')
    })

    it('userフィールドにid・name・roleが含まれること', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(body.data.user.id).toBe(salesUser.id)
      expect(body.data.user.name).toBe(salesUser.name)
      expect(body.data.user.role).toBe('sales')
    })

    it('visit_recordsにcustomer情報・content・sort_orderが含まれること', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      const vr = body.data.visit_records[0]
      expect(vr.id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
      expect(vr.customer.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
      expect(vr.customer.name).toBe('佐藤 健')
      expect(vr.customer.company).toBe('株式会社A')
      expect(vr.content).toBe('商談内容')
      expect(vr.sort_order).toBe(1)
    })

    it('commentsにid・body・commenter・created_atが含まれること', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      const comment = body.data.comments[0]
      expect(comment.id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
      expect(comment.body).toBe('コメント本文')
      expect(comment.commenter.id).toBe(managerUser.id)
      expect(comment.commenter.name).toBe(managerUser.name)
      expect(comment.created_at).toBe('2026-04-19T18:32:00.000Z')
    })
  })

  // ── API-018: 存在しないID → 404 NOT_FOUND ──────────────────────────────────

  describe('API-018: 存在しない日報IDを指定すると404を返す', () => {
    it('存在しないIDに対して404とNOT_FOUNDコードを返す', async () => {
      mockGetReport.mockRejectedValueOnce(AppError.notFound('日報'))

      const req = makeRequest(salesUser, 'ffffffff-ffff-ffff-ffff-ffffffffffff')
      const res = await GET(req, makeContext('ffffffff-ffff-ffff-ffff-ffffffffffff'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  // ── RPT-021: salesユーザーが自分の日報を取得 → 200 ─────────────────────────

  describe('RPT-021: salesユーザーは自分の日報を取得できる', () => {
    it('自分の日報に対して200を返す', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.user.id).toBe(salesUser.id)
      expect(mockGetReport).toHaveBeenCalledWith(salesUser, REPORT_ID)
    })
  })

  // ── RPT-022: managerが任意の日報を取得 → 200 ─────────────────────────────

  describe('RPT-022: managerは任意の日報を取得できる', () => {
    it('他のユーザーの日報に対して200を返す', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(managerUser)
      const res = await GET(req, makeContext())

      expect(res.status).toBe(200)
      expect(mockGetReport).toHaveBeenCalledWith(managerUser, REPORT_ID)
    })
  })

  // ── SEC-003: salesユーザーが他人の日報を取得 → 403 FORBIDDEN ──────────────

  describe('SEC-003: salesユーザーが他人の日報を取得しようとすると403を返す', () => {
    it('他人の日報に対して403とFORBIDDENコードを返す', async () => {
      mockGetReport.mockRejectedValueOnce(AppError.forbidden())

      const req = makeRequest(salesUser2)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ── adminが任意の日報を取得 → 200 ────────────────────────────────────────

  describe('adminは任意の日報を取得できる', () => {
    it('adminユーザーで200を返す', async () => {
      mockGetReport.mockResolvedValueOnce(sampleReportDetail)

      const req = makeRequest(adminUser)
      const res = await GET(req, makeContext())

      expect(res.status).toBe(200)
      expect(mockGetReport).toHaveBeenCalledWith(adminUser, REPORT_ID)
    })
  })

  // ── visit_records が sort_order 昇順で返る ────────────────────────────────

  describe('visit_records は sort_order 昇順で返る', () => {
    it('sort_orderが昇順に並んだvisit_recordsを返す', async () => {
      const detailWithMultipleVR: ReportDetail = {
        ...sampleReportDetail,
        visit_records: [
          {
            id: 'vr-001',
            customer: { id: 'cust-001', name: '顧客A', company: null },
            content: '内容1',
            sort_order: 1,
          },
          {
            id: 'vr-002',
            customer: { id: 'cust-002', name: '顧客B', company: '会社B' },
            content: '内容2',
            sort_order: 2,
          },
          {
            id: 'vr-003',
            customer: { id: 'cust-003', name: '顧客C', company: null },
            content: '内容3',
            sort_order: 3,
          },
        ],
      }
      mockGetReport.mockResolvedValueOnce(detailWithMultipleVR)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(body.data.visit_records).toHaveLength(3)
      expect(body.data.visit_records[0].sort_order).toBe(1)
      expect(body.data.visit_records[1].sort_order).toBe(2)
      expect(body.data.visit_records[2].sort_order).toBe(3)
    })
  })

  // ── comments が created_at 昇順で含まれる ─────────────────────────────────

  describe('comments は created_at 昇順で含まれる', () => {
    it('created_atが昇順に並んだcommentsを返す', async () => {
      const detailWithMultipleComments: ReportDetail = {
        ...sampleReportDetail,
        comments: [
          {
            id: 'comment-001',
            body: '最初のコメント',
            commenter: { id: managerUser.id, name: managerUser.name },
            created_at: '2026-04-19T10:00:00.000Z',
          },
          {
            id: 'comment-002',
            body: '2番目のコメント',
            commenter: { id: managerUser.id, name: managerUser.name },
            created_at: '2026-04-19T11:00:00.000Z',
          },
          {
            id: 'comment-003',
            body: '3番目のコメント',
            commenter: { id: adminUser.id, name: adminUser.name },
            created_at: '2026-04-19T12:00:00.000Z',
          },
        ],
      }
      mockGetReport.mockResolvedValueOnce(detailWithMultipleComments)

      const req = makeRequest(managerUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(body.data.comments).toHaveLength(3)
      expect(body.data.comments[0].created_at).toBe('2026-04-19T10:00:00.000Z')
      expect(body.data.comments[1].created_at).toBe('2026-04-19T11:00:00.000Z')
      expect(body.data.comments[2].created_at).toBe('2026-04-19T12:00:00.000Z')
    })
  })

  // ── Error handling ────────────────────────────────────────────────────────

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockGetReport.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})
