import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from './route'
import * as commentsService from '@/lib/reports/comments.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

vi.mock('@/lib/reports/comments.service', () => ({
  deleteComment: vi.fn(),
}))

vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockDeleteComment = vi.mocked(commentsService.deleteComment)

// ─── Test users ───────────────────────────────────────────────────────────────

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

const managerUser2: AuthUser = {
  id: '55555555-5555-5555-5555-555555555555',
  name: '佐藤 部長',
  email: 'sato@test.com',
  role: 'manager',
}

const adminUser: AuthUser = {
  id: '44444444-4444-4444-4444-444444444444',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

// ─── Sample IDs ───────────────────────────────────────────────────────────────

const REPORT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const COMMENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  user: AuthUser,
  reportId = REPORT_ID,
  commentId = COMMENT_ID,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/reports/${reportId}/comments/${commentId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${generateToken(user)}`,
      },
    },
  )
}

function makeRequestWithoutAuth(
  reportId = REPORT_ID,
  commentId = COMMENT_ID,
): NextRequest {
  return new NextRequest(
    `http://localhost/api/reports/${reportId}/comments/${commentId}`,
    { method: 'DELETE' },
  )
}

function makeContext(
  reportId = REPORT_ID,
  commentId = COMMENT_ID,
): Record<string, unknown> {
  return { params: { id: reportId, commentId } }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DELETE /api/reports/:id/comments/:commentId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Authentication ──────────────────────────────────────────────────────────

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = makeRequestWithoutAuth()
      const res = await DELETE(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // ── UUID validation ─────────────────────────────────────────────────────────

  describe('IDバリデーション', () => {
    it('reportIdがUUID形式でない場合は404を返す', async () => {
      const req = makeRequest(managerUser, 'not-a-uuid', COMMENT_ID)
      const res = await DELETE(req, makeContext('not-a-uuid', COMMENT_ID))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockDeleteComment).not.toHaveBeenCalled()
    })

    it('commentIdがUUID形式でない場合は404を返す', async () => {
      const req = makeRequest(managerUser, REPORT_ID, 'not-a-uuid')
      const res = await DELETE(req, makeContext(REPORT_ID, 'not-a-uuid'))
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockDeleteComment).not.toHaveBeenCalled()
    })
  })

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('正常系', () => {
    it('managerユーザーが自分のコメントを削除すると204を返す', async () => {
      mockDeleteComment.mockResolvedValue(undefined)

      const req = makeRequest(managerUser)
      const res = await DELETE(req, makeContext())

      expect(res.status).toBe(204)
      expect(mockDeleteComment).toHaveBeenCalledWith(managerUser, REPORT_ID, COMMENT_ID)
    })

    it('adminユーザーが任意のコメントを削除すると204を返す', async () => {
      mockDeleteComment.mockResolvedValue(undefined)

      const req = makeRequest(adminUser)
      const res = await DELETE(req, makeContext())

      expect(res.status).toBe(204)
      expect(mockDeleteComment).toHaveBeenCalledWith(adminUser, REPORT_ID, COMMENT_ID)
    })
  })

  // ── Error cases ─────────────────────────────────────────────────────────────

  describe('異常系', () => {
    it('コメントが存在しない場合は404を返す', async () => {
      mockDeleteComment.mockRejectedValue(AppError.notFound('コメント'))

      const req = makeRequest(managerUser)
      const res = await DELETE(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('salesユーザーがコメントを削除しようとすると403を返す', async () => {
      mockDeleteComment.mockRejectedValue(AppError.forbidden())

      const req = makeRequest(salesUser)
      const res = await DELETE(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('他人のコメントをmanagerが削除しようとすると403を返す', async () => {
      mockDeleteComment.mockRejectedValue(AppError.forbidden())

      const req = makeRequest(managerUser2)
      const res = await DELETE(req, makeContext())
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })
})
