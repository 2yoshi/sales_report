import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listReports, POST as createReport } from '@/app/api/reports/route'
import {
  GET as getReport,
  PUT as updateReport,
  DELETE as deleteReport,
} from '@/app/api/reports/[id]/route'
import {
  GET as listComments,
  POST as createComment,
} from '@/app/api/reports/[id]/comments/route'
import { DELETE as deleteComment } from '@/app/api/reports/[id]/comments/[commentId]/route'
import { GET as listCustomers, POST as createCustomer } from '@/app/api/customers/route'
import {
  PUT as updateCustomer,
  DELETE as deleteCustomer,
} from '@/app/api/customers/[id]/route'
import { GET as listUsers, POST as createUser } from '@/app/api/users/route'
import {
  PUT as updateUser,
  DELETE as deleteUser,
} from '@/app/api/users/[id]/route'
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

const YAMADA = TEST_USERS.yamada  // sales (USER-01)
const SUZUKI = TEST_USERS.suzuki  // sales (USER-02)
const TANAKA = TEST_USERS.tanaka  // manager (USER-03)
const ADMIN = TEST_USERS.admin    // admin (USER-04)

const CUST01 = TEST_CUSTOMERS.cust01

const REPORTS_BASE = 'http://localhost/api/reports'
const CUSTOMERS_BASE = 'http://localhost/api/customers'
const USERS_BASE = 'http://localhost/api/users'

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

function reportIdContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function commentContext(id: string, commentId: string) {
  return { params: Promise.resolve({ id, commentId }) }
}

function customerIdContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function userIdContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('権限テスト（全ロール × 全操作）', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ─── AUTH-P01: 日報一覧（全員分）閲覧 ────────────────────────────────────────
  // sales: ✕（自分の分しか見えない）, manager: ○, admin: ○

  describe('AUTH-P01: 日報一覧（全員分）閲覧', () => {
    it('manager は全ユーザーの日報を閲覧できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '鈴木訪問', sortOrder: 1 }],
      })

      const req = makeRequest(REPORTS_BASE, 'GET', TANAKA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it('admin は全ユーザーの日報を閲覧できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '鈴木訪問', sortOrder: 1 }],
      })

      const req = makeRequest(REPORTS_BASE, 'GET', ADMIN)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
    })

    it('sales は自分の日報しか閲覧できない（全員分は見えない）', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '鈴木訪問', sortOrder: 1 }],
      })

      const req = makeRequest(REPORTS_BASE, 'GET', YAMADA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      // sales は自分の分しか返らない
      expect(body.data).toHaveLength(1)
      expect(body.data[0].user.id).toBe(YAMADA.id)
    })
  })

  // ─── AUTH-P02: 日報一覧（自分分）閲覧 ────────────────────────────────────────
  // sales本人: ○, sales他人: ✕, manager: ○, admin: ○

  describe('AUTH-P02: 日報一覧（自分分）閲覧', () => {
    it('sales は自分の日報一覧を閲覧できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}?user_id=${YAMADA.id}`, 'GET', YAMADA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].user.id).toBe(YAMADA.id)
    })

    it('sales が他人の user_id でフィルタしても自分の分しか返らない', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '鈴木訪問', sortOrder: 1 }],
      })

      // YAMADA が SUZUKI の日報を user_id フィルタで取得しようとする
      const req = makeRequest(`${REPORTS_BASE}?user_id=${SUZUKI.id}`, 'GET', YAMADA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      // sales は他人の user_id フィルタ結果を得られない（空 or 自分の分だけ）
      expect(body.data.every((r: { user: { id: string } }) => r.user.id === YAMADA.id)).toBe(true)
    })

    it('manager は特定 user_id でフィルタして他ユーザーの日報を閲覧できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}?user_id=${YAMADA.id}`, 'GET', TANAKA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].user.id).toBe(YAMADA.id)
    })
  })

  // ─── AUTH-P03: 日報作成 ────────────────────────────────────────────────────────
  // sales本人: ○, manager: ✕, admin: ✕

  describe('AUTH-P03: 日報作成', () => {
    const reportBody = {
      report_date: '2026-05-01',
      problem: 'テスト課題',
      plan: 'テスト計画',
      visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
    }

    it('sales は日報を作成できる（201）', async () => {
      const req = makeRequest(REPORTS_BASE, 'POST', YAMADA, reportBody)
      const res = await createReport(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.user.id).toBe(YAMADA.id)
    })

    it('manager は日報を作成できない（403）', async () => {
      const req = makeRequest(REPORTS_BASE, 'POST', TANAKA, reportBody)
      const res = await createReport(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin は日報を作成できない（403）', async () => {
      const req = makeRequest(REPORTS_BASE, 'POST', ADMIN, reportBody)
      const res = await createReport(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── AUTH-P04: 日報詳細閲覧 ──────────────────────────────────────────────────
  // sales本人: ○, sales他人: ✕, manager: ○, admin: ○

  describe('AUTH-P04: 日報詳細閲覧', () => {
    it('sales は自分の日報詳細を閲覧できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'GET', YAMADA)
      const res = await getReport(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(reportId)
    })

    it('sales は他人の日報詳細を閲覧できない（403）', async () => {
      const reportId = await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'GET', YAMADA)
      const res = await getReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager は任意のユーザーの日報詳細を閲覧できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'GET', TANAKA)
      const res = await getReport(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
    })

    it('admin は任意のユーザーの日報詳細を閲覧できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'GET', ADMIN)
      const res = await getReport(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
    })
  })

  // ─── AUTH-P05: 日報編集 ────────────────────────────────────────────────────────
  // sales本人: ○, sales他人: ✕, manager: ✕, admin: ✕

  describe('AUTH-P05: 日報編集', () => {
    const updateBody = {
      problem: '更新後課題',
      plan: '更新後計画',
      visit_records: [{ customer_id: CUST01.id, content: '更新後訪問内容', sort_order: 1 }],
    }

    it('sales は自分の日報を編集できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '元の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'PUT', YAMADA, updateBody)
      const res = await updateReport(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.problem).toBe('更新後課題')
    })

    it('sales は他人の日報を編集できない（403）', async () => {
      const reportId = await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '元の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'PUT', YAMADA, updateBody)
      const res = await updateReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager は日報を編集できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '元の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'PUT', TANAKA, updateBody)
      const res = await updateReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin は日報を編集できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '元の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'PUT', ADMIN, updateBody)
      const res = await updateReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── AUTH-P06: 日報削除 ────────────────────────────────────────────────────────
  // sales本人: ○, sales他人: ✕, manager: ✕, admin: ✕

  describe('AUTH-P06: 日報削除', () => {
    it('sales は自分の日報を削除できる（204）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'DELETE', YAMADA)
      const res = await deleteReport(req, reportIdContext(reportId))

      expect(res.status).toBe(204)
    })

    it('sales は他人の日報を削除できない（403）', async () => {
      const reportId = await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'DELETE', YAMADA)
      const res = await deleteReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager は日報を削除できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'DELETE', TANAKA)
      const res = await deleteReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin は日報を削除できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'DELETE', ADMIN)
      const res = await deleteReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── AUTH-P11: コメント閲覧 ───────────────────────────────────────────────────
  // sales: ○, manager: ○, admin: ○

  describe('AUTH-P11: コメント閲覧', () => {
    it('sales は日報のコメントを閲覧できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestComment({ reportId, commenterId: TANAKA.id, body: '良い日報です' })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}/comments`, 'GET', YAMADA)
      const res = await listComments(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
    })

    it('manager は日報のコメントを閲覧できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestComment({ reportId, commenterId: TANAKA.id, body: '良い日報です' })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}/comments`, 'GET', TANAKA)
      const res = await listComments(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
    })

    it('admin は日報のコメントを閲覧できる（200）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestComment({ reportId, commenterId: TANAKA.id, body: '良い日報です' })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}/comments`, 'GET', ADMIN)
      const res = await listComments(req, reportIdContext(reportId))

      expect(res.status).toBe(200)
    })
  })

  // ─── AUTH-P12: コメント投稿 ───────────────────────────────────────────────────
  // sales: ✕, manager: ○, admin: ○

  describe('AUTH-P12: コメント投稿', () => {
    it('sales はコメントを投稿できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments`,
        'POST',
        YAMADA,
        { body: 'コメントしたい' },
      )
      const res = await createComment(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })

    it('manager はコメントを投稿できる（201）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments`,
        'POST',
        TANAKA,
        { body: '管理職コメント' },
      )
      const res = await createComment(req, reportIdContext(reportId))

      expect(res.status).toBe(201)
      const resBody = await res.json()
      expect(resBody.data.commenter.id).toBe(TANAKA.id)
    })

    it('admin はコメントを投稿できる（201）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments`,
        'POST',
        ADMIN,
        { body: '管理者コメント' },
      )
      const res = await createComment(req, reportIdContext(reportId))

      expect(res.status).toBe(201)
      const resBody = await res.json()
      expect(resBody.data.commenter.id).toBe(ADMIN.id)
    })
  })

  // ─── AUTH-P13: コメント削除（自分） ───────────────────────────────────────────
  // sales: ✕, manager: ○, admin: ○

  describe('AUTH-P13: コメント削除（自分のコメント）', () => {
    it('sales は自分以外の投稿したコメントを削除できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        YAMADA,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })

    it('manager は自分のコメントを削除できる（204）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        TANAKA,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(204)
    })

    it('admin は自分のコメントを削除できる（204）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: ADMIN.id })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        ADMIN,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(204)
    })
  })

  // ─── AUTH-P14: コメント削除（他人） ───────────────────────────────────────────
  // sales: ✕, manager: ✕, admin: ○

  describe('AUTH-P14: コメント削除（他人のコメント）', () => {
    it('sales は他人のコメントを削除できない（403）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        YAMADA,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })

    it('manager は他の manager のコメントを削除できない（403）', async () => {
      const otherManagerId = '00000000-0000-0000-0000-000000000088'
      await prisma.user.create({
        data: {
          id: otherManagerId,
          name: '別の部長',
          email: 'other-manager2@test.com',
          passwordHash: PASSWORD_HASH,
          role: 'manager',
        },
      })
      const otherManager: AuthUser = {
        id: otherManagerId,
        name: '別の部長',
        email: 'other-manager2@test.com',
        role: 'manager',
      }

      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      // TANAKA のコメントを otherManager が削除しようとする
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        otherManager,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(403)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('FORBIDDEN')
    })

    it('admin は他人のコメントを削除できる（204）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      const commentId = await createTestComment({ reportId, commenterId: TANAKA.id })

      const req = makeRequest(
        `${REPORTS_BASE}/${reportId}/comments/${commentId}`,
        'DELETE',
        ADMIN,
      )
      const res = await deleteComment(req, commentContext(reportId, commentId))

      expect(res.status).toBe(204)
    })
  })

  // ─── AUTH-P21: 顧客一覧閲覧 ──────────────────────────────────────────────────
  // sales: ○, manager: ○, admin: ○

  describe('AUTH-P21: 顧客一覧閲覧', () => {
    it('sales は顧客一覧を閲覧できる（200）', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'GET', YAMADA)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('manager は顧客一覧を閲覧できる（200）', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'GET', TANAKA)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(200)
    })

    it('admin は顧客一覧を閲覧できる（200）', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'GET', ADMIN)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(200)
    })
  })

  // ─── AUTH-P22: 顧客登録・編集 ────────────────────────────────────────────────
  // sales: ○, manager: ○, admin: ○

  describe('AUTH-P22: 顧客登録・編集', () => {
    it('sales は顧客を登録できる（201）', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'POST', YAMADA, {
        name: '新規顧客（sales）',
        company: '株式会社テスト',
      })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
    })

    it('manager は顧客を登録できる（201）', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'POST', TANAKA, {
        name: '新規顧客（manager）',
        company: '株式会社テスト',
      })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
    })

    it('admin は顧客を登録できる（201）', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'POST', ADMIN, {
        name: '新規顧客（admin）',
        company: '株式会社テスト',
      })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
    })

    it('sales は顧客を編集できる（200）', async () => {
      const req = makeRequest(`${CUSTOMERS_BASE}/${CUST01.id}`, 'PUT', YAMADA, {
        name: '佐藤 健（sales更新）',
      })
      const res = await updateCustomer(req, customerIdContext(CUST01.id))

      expect(res.status).toBe(200)
    })

    it('manager は顧客を編集できる（200）', async () => {
      const req = makeRequest(`${CUSTOMERS_BASE}/${CUST01.id}`, 'PUT', TANAKA, {
        name: '佐藤 健（manager更新）',
      })
      const res = await updateCustomer(req, customerIdContext(CUST01.id))

      expect(res.status).toBe(200)
    })

    it('admin は顧客を編集できる（200）', async () => {
      const req = makeRequest(`${CUSTOMERS_BASE}/${CUST01.id}`, 'PUT', ADMIN, {
        name: '佐藤 健（admin更新）',
      })
      const res = await updateCustomer(req, customerIdContext(CUST01.id))

      expect(res.status).toBe(200)
    })
  })

  // ─── AUTH-P23: 顧客削除 ────────────────────────────────────────────────────────
  // sales: ✕, manager: ✕, admin: ○

  describe('AUTH-P23: 顧客削除', () => {
    it('sales は顧客を削除できない（403）', async () => {
      const req = makeRequest(`${CUSTOMERS_BASE}/${CUST01.id}`, 'DELETE', YAMADA)
      const res = await deleteCustomer(req, customerIdContext(CUST01.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager は顧客を削除できない（403）', async () => {
      const req = makeRequest(`${CUSTOMERS_BASE}/${CUST01.id}`, 'DELETE', TANAKA)
      const res = await deleteCustomer(req, customerIdContext(CUST01.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin は顧客を削除できる（204）', async () => {
      const req = makeRequest(`${CUSTOMERS_BASE}/${CUST01.id}`, 'DELETE', ADMIN)
      const res = await deleteCustomer(req, customerIdContext(CUST01.id))

      expect(res.status).toBe(204)
    })
  })

  // ─── AUTH-P24: ユーザー一覧閲覧 ──────────────────────────────────────────────
  // sales: ✕, manager: ✕, admin: ○

  describe('AUTH-P24: ユーザー一覧閲覧', () => {
    it('sales はユーザー一覧を閲覧できない（403）', async () => {
      const req = makeRequest(USERS_BASE, 'GET', YAMADA)
      const res = await listUsers(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager はユーザー一覧を閲覧できない（403）', async () => {
      const req = makeRequest(USERS_BASE, 'GET', TANAKA)
      const res = await listUsers(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin はユーザー一覧を閲覧できる（200）', async () => {
      const req = makeRequest(USERS_BASE, 'GET', ADMIN)
      const res = await listUsers(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ─── AUTH-P25: ユーザー登録・編集・削除 ───────────────────────────────────────
  // sales: ✕, manager: ✕, admin: ○

  describe('AUTH-P25: ユーザー登録・編集・削除', () => {
    const newUserBody = {
      name: '新規ユーザー',
      email: 'new-user-perm@test.com',
      password: 'NewPass1234!',
      role: 'sales' as const,
    }

    it('sales はユーザーを登録できない（403）', async () => {
      const req = makeRequest(USERS_BASE, 'POST', YAMADA, newUserBody)
      const res = await createUser(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager はユーザーを登録できない（403）', async () => {
      const req = makeRequest(USERS_BASE, 'POST', TANAKA, newUserBody)
      const res = await createUser(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin はユーザーを登録できる（201）', async () => {
      const req = makeRequest(USERS_BASE, 'POST', ADMIN, newUserBody)
      const res = await createUser(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.email).toBe(newUserBody.email)
    })

    it('sales はユーザーを編集できない（403）', async () => {
      const req = makeRequest(`${USERS_BASE}/${SUZUKI.id}`, 'PUT', YAMADA, {
        name: SUZUKI.name,
        email: SUZUKI.email,
        role: 'sales',
      })
      const res = await updateUser(req, userIdContext(SUZUKI.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager はユーザーを編集できない（403）', async () => {
      const req = makeRequest(`${USERS_BASE}/${YAMADA.id}`, 'PUT', TANAKA, {
        name: YAMADA.name,
        email: YAMADA.email,
        role: 'sales',
      })
      const res = await updateUser(req, userIdContext(YAMADA.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin はユーザーを編集できる（200）', async () => {
      const req = makeRequest(`${USERS_BASE}/${YAMADA.id}`, 'PUT', ADMIN, {
        name: '山田 太郎（更新）',
        email: YAMADA.email,
        role: 'sales',
      })
      const res = await updateUser(req, userIdContext(YAMADA.id))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.name).toBe('山田 太郎（更新）')
    })

    it('sales はユーザーを削除できない（403）', async () => {
      const req = makeRequest(`${USERS_BASE}/${SUZUKI.id}`, 'DELETE', YAMADA)
      const res = await deleteUser(req, userIdContext(SUZUKI.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('manager はユーザーを削除できない（403）', async () => {
      const req = makeRequest(`${USERS_BASE}/${YAMADA.id}`, 'DELETE', TANAKA)
      const res = await deleteUser(req, userIdContext(YAMADA.id))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('admin はユーザーを削除できる（204）', async () => {
      // SUZUKI は日報なしなので削除可能
      const req = makeRequest(`${USERS_BASE}/${SUZUKI.id}`, 'DELETE', ADMIN)
      const res = await deleteUser(req, userIdContext(SUZUKI.id))

      expect(res.status).toBe(204)
    })
  })
})
