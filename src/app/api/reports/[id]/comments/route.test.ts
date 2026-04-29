import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'
import * as commentsService from '@/lib/reports/comments.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { CommentItem } from '@/lib/reports/comments.service'

vi.mock('@/lib/reports/comments.service', () => ({
  listComments: vi.fn(),
}))

// Mock the blacklist so tokens are never invalidated in tests
vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockListComments = vi.mocked(commentsService.listComments)

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

const sampleComments: CommentItem[] = [
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    body: 'コメント本文',
    commenter: {
      id: managerUser.id,
      name: managerUser.name,
      role: 'manager',
    },
    created_at: '2026-04-19T18:32:00.000Z',
    updated_at: '2026-04-19T18:32:00.000Z',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(user: AuthUser, reportId = REPORT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/reports/${reportId}/comments`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
    },
  })
}

function makeRequestWithoutAuth(reportId = REPORT_ID): NextRequest {
  return new NextRequest(`http://localhost/api/reports/${reportId}/comments`, {
    method: 'GET',
  })
}

function makeContext(reportId = REPORT_ID): Record<string, unknown> {
  return { params: { id: reportId } }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/reports/:id/comments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 認証 ──────────────────────────────────────────────────────────────────

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = makeRequestWithoutAuth()
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
      expect(mockListComments).not.toHaveBeenCalled()
    })
  })

  // ── API-031: 任意のトークン → 200, コメント一覧 ──────────────────────────

  describe('API-031: salesユーザーが自分の日報のコメント一覧を取得できる', () => {
    it('200とdataにコメント一覧が含まれること', async () => {
      mockListComments.mockResolvedValueOnce(sampleComments)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
      expect(body.data[0].body).toBe('コメント本文')
      expect(mockListComments).toHaveBeenCalledWith(salesUser, REPORT_ID)
    })

    it('commenterにid・name・roleが含まれること', async () => {
      mockListComments.mockResolvedValueOnce(sampleComments)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(body.data[0].commenter.id).toBe(managerUser.id)
      expect(body.data[0].commenter.name).toBe(managerUser.name)
      expect(body.data[0].commenter.role).toBe('manager')
    })

    it('created_atとupdated_atがISO 8601形式で含まれること', async () => {
      mockListComments.mockResolvedValueOnce(sampleComments)

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(body.data[0].created_at).toBe('2026-04-19T18:32:00.000Z')
      expect(body.data[0].updated_at).toBe('2026-04-19T18:32:00.000Z')
    })
  })

  describe('API-031: managerが任意の日報のコメント一覧を取得できる', () => {
    it('managerが200とコメント一覧を返す', async () => {
      mockListComments.mockResolvedValueOnce(sampleComments)

      const req = makeRequest(managerUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(mockListComments).toHaveBeenCalledWith(managerUser, REPORT_ID)
    })
  })

  describe('API-031: adminが任意の日報のコメント一覧を取得できる', () => {
    it('adminが200とコメント一覧を返す', async () => {
      mockListComments.mockResolvedValueOnce(sampleComments)

      const req = makeRequest(adminUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(mockListComments).toHaveBeenCalledWith(adminUser, REPORT_ID)
    })
  })

  describe('コメントが0件の場合は空配列を返す', () => {
    it('200と空のdataを返す', async () => {
      mockListComments.mockResolvedValueOnce([])

      const req = makeRequest(managerUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(0)
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  // ── NOT_FOUND ──────────────────────────────────────────────────────────────

  describe('NOT_FOUND: 存在しない日報IDを指定すると404を返す', () => {
    it('存在しない日報IDで404とNOT_FOUNDコードを返す', async () => {
      mockListComments.mockRejectedValueOnce(AppError.notFound('日報'))

      const req = makeRequest(salesUser, 'ffffffff-ffff-ffff-ffff-ffffffffffff')
      const res = await GET(req, makeContext('ffffffff-ffff-ffff-ffff-ffffffffffff'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('UUID形式でないIDを指定すると404を返し、サービスは呼ばれない', async () => {
      const req = makeRequest(salesUser, 'not-a-uuid')
      const res = await GET(req, makeContext('not-a-uuid'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockListComments).not.toHaveBeenCalled()
    })
  })

  // ── FORBIDDEN: salesが他人の日報 → 403 ────────────────────────────────────

  describe('FORBIDDEN: salesユーザーが他人の日報のコメントを取得しようとすると403を返す', () => {
    it('他人の日報に対して403とFORBIDDENコードを返す', async () => {
      mockListComments.mockRejectedValueOnce(AppError.forbidden())

      const req = makeRequest(salesUser2)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ── エラーハンドリング ────────────────────────────────────────────────────

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockListComments.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = makeRequest(salesUser)
      const res = await GET(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})
