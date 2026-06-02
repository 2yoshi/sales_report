import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listReports, POST as createReport } from '@/app/api/reports/route'
import { GET as getReport, PUT as updateReport, DELETE as deleteReport } from '@/app/api/reports/[id]/route'
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

const YAMADA = TEST_USERS.yamada
const SUZUKI = TEST_USERS.suzuki
const TANAKA = TEST_USERS.tanaka

const CUST01 = TEST_CUSTOMERS.cust01
const CUST02 = TEST_CUSTOMERS.cust02

type TestUser = (typeof TEST_USERS)[keyof typeof TEST_USERS]

function makeRequest(
  url: string,
  method: string,
  user: TestUser,
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

const BASE = 'http://localhost/api/reports'
const NON_EXISTENT_ID = '99999999-9999-9999-9999-999999999999'

describe('日報API', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ─── 一覧取得 ───────────────────────────────────────────────────────────────

  describe('API-011: GET /reports USER-01(sales) → 自分の日報のみ', () => {
    it('salesロールは自分の日報だけを取得できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容2', sortOrder: 1 }],
      })

      const req = makeRequest(BASE, 'GET', YAMADA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].user.id).toBe(YAMADA.id)
    })
  })

  describe('API-012: GET /reports USER-03(manager) → 全ユーザー分', () => {
    it('managerロールは全ユーザーの日報を取得できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容2', sortOrder: 1 }],
      })

      const req = makeRequest(BASE, 'GET', TANAKA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta).toHaveProperty('total', 2)
    })
  })

  describe('API-013: GET /reports?user_id=... → 指定ユーザーのみ', () => {
    it('user_id クエリで特定ユーザーの日報のみ取得できる（manager視点）', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })
      await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容2', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}?user_id=${YAMADA.id}`, 'GET', TANAKA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.every((r: { user: { id: string } }) => r.user.id === YAMADA.id)).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })

  // ─── 作成 ───────────────────────────────────────────────────────────────────

  describe('API-014: POST /reports 正常作成 → 201', () => {
    it('salesロールが正しいデータで日報を作成すると201を返す', async () => {
      const req = makeRequest(BASE, 'POST', YAMADA, {
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data).toHaveProperty('id')
      expect(body.data.report_date).toBe('2026-05-01')
      expect(body.data.user.id).toBe(YAMADA.id)
    })
  })

  describe('API-015: POST /reports manager ロール → 403', () => {
    it('managerロールが日報作成しようとすると403を返す', async () => {
      const req = makeRequest(BASE, 'POST', TANAKA, {
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('API-016: POST /reports 重複日付 → 409, DUPLICATE_REPORT', () => {
    it('同じ日付の日報が既に存在する場合409とDUPLICATE_REPORTを返す', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '既存訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(BASE, 'POST', YAMADA, {
        report_date: '2026-05-01',
        problem: '重複テスト',
        plan: '重複テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('DUPLICATE_REPORT')
    })
  })

  // ─── 個別取得 ───────────────────────────────────────────────────────────────

  describe('API-017: GET /reports/:id 存在するID → 200', () => {
    it('存在する日報IDで200と日報データを返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'GET', YAMADA)
      const res = await getReport(req, idContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.id).toBe(reportId)
      expect(body.data.user.id).toBe(YAMADA.id)
    })
  })

  describe('API-018: GET /reports/:id 存在しないID → 404, NOT_FOUND', () => {
    it('存在しない日報IDで404とNOT_FOUNDを返す', async () => {
      const req = makeRequest(`${BASE}/${NON_EXISTENT_ID}`, 'GET', YAMADA)
      const res = await getReport(req, idContext(NON_EXISTENT_ID))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })

  // ─── 更新 ───────────────────────────────────────────────────────────────────

  describe('API-019: PUT /reports/:id 本人 → 200', () => {
    it('日報作成者本人が更新すると200を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '元の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'PUT', YAMADA, {
        problem: '更新後の課題',
        plan: '更新後の計画',
        visit_records: [
          { customer_id: CUST01.id, content: '更新後の訪問内容', sort_order: 1 },
          { customer_id: CUST02.id, content: '追加訪問内容', sort_order: 2 },
        ],
      })
      const res = await updateReport(req, idContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.problem).toBe('更新後の課題')
      expect(body.data.visit_records).toHaveLength(2)
    })
  })

  describe('API-020: PUT /reports/:id 他人 → 403', () => {
    it('日報作成者以外が更新しようとすると403を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'PUT', SUZUKI, {
        problem: '不正更新',
        plan: '不正計画',
        visit_records: [{ customer_id: CUST01.id, content: '不正訪問内容', sort_order: 1 }],
      })
      const res = await updateReport(req, idContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── 削除 ───────────────────────────────────────────────────────────────────

  describe('API-021: DELETE /reports/:id 本人 → 204', () => {
    it('日報作成者本人が削除すると204を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'DELETE', YAMADA)
      const res = await deleteReport(req, idContext(reportId))

      expect(res.status).toBe(204)
    })
  })

  describe('API-022: DELETE /reports/:id 他人 → 403', () => {
    it('日報作成者以外が削除しようとすると403を返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'DELETE', SUZUKI)
      const res = await deleteReport(req, idContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── 日付フィルタ ────────────────────────────────────────────────────────────

  describe('GET /reports?date_from&date_to → 日付範囲フィルタ', () => {
    it('date_from・date_to で範囲内の日報のみ取得できる', async () => {
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-01',
        visitRecords: [{ customerId: CUST01.id, content: '4月1日訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-15',
        visitRecords: [{ customerId: CUST01.id, content: '4月15日訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '5月1日訪問', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}?date_from=2026-04-10&date_to=2026-04-30`, 'GET', YAMADA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].report_date).toBe('2026-04-15')
    })
  })

  // ─── 権限: sales が他人の日報を参照 ─────────────────────────────────────────

  describe('GET /reports/:id sales が他人の日報 → 403', () => {
    it('salesロールは他ユーザーの日報を取得しようとすると403を返す', async () => {
      const reportId = await createTestReport({
        userId: SUZUKI.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'GET', YAMADA)
      const res = await getReport(req, idContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  // ─── PUT: report_date 変更不可 ───────────────────────────────────────────────

  describe('PUT /reports/:id report_date を送っても変更されない', () => {
    it('更新時に report_date を送っても対象日は変わらない', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '元の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}`, 'PUT', YAMADA, {
        report_date: '2026-01-01', // 変更しようとする
        problem: '更新後の課題',
        plan: '更新後の計画',
        visit_records: [{ customer_id: CUST01.id, content: '更新後の訪問内容', sort_order: 1 }],
      })
      const res = await updateReport(req, idContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.report_date).toBe('2026-05-01') // 元の日付のまま
    })
  })

  // ─── バリデーション ──────────────────────────────────────────────────────────

  describe('POST /reports バリデーション', () => {
    it('visit_records が空配列の場合 400 と VALIDATION_ERROR を返す', async () => {
      const req = makeRequest(BASE, 'POST', YAMADA, {
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: 'テスト計画',
        visit_records: [],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('problem が 2001 文字の場合 400 と VALIDATION_ERROR を返す', async () => {
      const req = makeRequest(BASE, 'POST', YAMADA, {
        report_date: '2026-05-01',
        problem: 'あ'.repeat(2001),
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('report_date が未来日付の場合 400 と VALIDATION_ERROR を返す', async () => {
      const req = makeRequest(BASE, 'POST', YAMADA, {
        report_date: '2099-12-31',
        problem: 'テスト課題',
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
