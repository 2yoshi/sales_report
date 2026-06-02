import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import {
  GET as listComments,
  POST as createComment,
} from '@/app/api/reports/[id]/comments/route'
import { DELETE as deleteComment } from '@/app/api/reports/[id]/comments/[commentId]/route'
import {
  clearDatabase,
  seedTestUsers,
  seedTestCustomers,
  createTestReport,
  createTestComment,
  prisma,
  TEST_USERS,
  TEST_CUSTOMERS,
  PASSWORD_HASH,
} from '../helpers/db'
import { makeToken } from '../helpers/auth'
import type { AuthUser } from '@/types'

const YAMADA = TEST_USERS.yamada   // sales
const TANAKA = TEST_USERS.tanaka   // manager
const ADMIN = TEST_USERS.admin     // admin
const CUST01 = TEST_CUSTOMERS.cust01

const BASE = 'http://localhost/api/reports'

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

function reportContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}

function commentContext(reportId: string, commentId: string) {
  return { params: Promise.resolve({ id: reportId, commentId }) }
}

describe('コメントAPI', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ─── API-031: GET /reports/:id/comments → 200, コメント一覧 ─────────────────

  describe('API-031: GET /reports/:id/comments → 200, コメント一覧', () => {
    it('コメント一覧を取得すると200とコメント配列を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestComment({ reportId, commenterId: TANAKA.id, body: '良い日報です' })

      const req = makeRequest(`${BASE}/${reportId}/comments`, 'GET', YAMADA)
      const res = await listComments(req, reportContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].body).toBe('良い日報です')
      expect(body.data[0].commenter.id).toBe(TANAKA.id)
      expect(body.data[0].commenter.role).toBe('manager')
    })

    it('コメントがない日報では空配列を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}/comments`, 'GET', TANAKA)
      const res = await listComments(req, reportContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(0)
    })
  })

  // ─── API-032: POST /reports/:id/comments manager → 201 ──────────────────────

  describe('API-032: POST /reports/:id/comments manager → 201', () => {
    it('managerがコメントを投稿すると201と作成コメントを返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}/comments`, 'POST', TANAKA, {
        body: '良い日報です',
      })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(201)
      const resBody = await res.json()
      expect(resBody.data).toHaveProperty('id')
      expect(resBody.data.body).toBe('良い日報です')
      expect(resBody.data.commenter.id).toBe(TANAKA.id)
      expect(resBody.data.commenter.role).toBe('manager')
    })

    it('adminがコメントを投稿すると201を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}/comments`, 'POST', ADMIN, {
        body: '管理者コメント',
      })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(201)
      const resBody = await res.json()
      expect(resBody.data.commenter.role).toBe('admin')
    })
  })

  // ─── POST /reports/:id/comments body 2001文字 → 400, VALIDATION_ERROR ────────

  describe('POST /reports/:id/comments body が2001文字 → 400, VALIDATION_ERROR', () => {
    it('bodyが2001文字のコメントを投稿すると400とVALIDATION_ERRORを返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}/comments`, 'POST', TANAKA, {
        body: 'あ'.repeat(2001),
      })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(400)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ─── API-033: POST /reports/:id/comments sales → 403, FORBIDDEN ─────────────

  describe('API-033: POST /reports/:id/comments sales → 403, FORBIDDEN', () => {
    it('salesがコメント投稿しようとすると403とFORBIDDENを返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}/comments`, 'POST', YAMADA, {
        body: 'コメントしたい',
      })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── API-034: DELETE /reports/:id/comments/:id 投稿者本人 → 204 ──────────────

  describe('API-034: DELETE /reports/:id/comments/:id 投稿者本人 → 204', () => {
    it('managerが自分のコメントを削除すると204を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        TANAKA,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(204)
    })

    it('adminが任意のコメントを削除すると204を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        ADMIN,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(204)
    })
  })

  // ─── API-035: DELETE /reports/:id/comments/:id 他人 → 403 ───────────────────

  describe('API-035: DELETE /reports/:id/comments/:id 他人 → 403', () => {
    it('salesがコメントを削除しようとすると403を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        YAMADA,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })

    it('別のmanagerが他人のコメントを削除しようとすると403を返す', async () => {
      // 別のmanagerユーザーを直接作成
      const otherManagerId = '00000000-0000-0000-0000-000000000099'
      await prisma.user.create({
        data: {
          id: otherManagerId,
          name: '別の部長',
          email: 'other-manager@test.com',
          passwordHash: PASSWORD_HASH,
          role: 'manager',
        },
      })
      const otherManager = { id: otherManagerId, name: '別の部長', email: 'other-manager@test.com', role: 'manager' as const }

      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      // TANAKA のコメントを別のmanagerが削除しようとする
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        otherManager,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })
  })
})
