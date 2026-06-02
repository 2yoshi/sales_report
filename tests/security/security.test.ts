import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as listReports, POST as createReport } from '@/app/api/reports/route'
import { GET as getReport } from '@/app/api/reports/[id]/route'
import { GET as listCustomers, POST as createCustomer } from '@/app/api/customers/route'
import { GET as getCustomer } from '@/app/api/customers/[id]/route'
import { POST as createUser } from '@/app/api/users/route'
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
import type { AuthUser } from '@/types'

const YAMADA = TEST_USERS.yamada  // sales
const TANAKA = TEST_USERS.tanaka  // manager
const ADMIN = TEST_USERS.admin    // admin

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

function makeRequestNoAuth(url: string, method: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function makeRequestWithToken(url: string, method: string, token: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
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

function customerIdContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('セキュリティテスト', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // ─── SEC-001: トークンなしアクセス → 401 ─────────────────────────────────────

  describe('SEC-001: トークンなしアクセス → 401 UNAUTHORIZED', () => {
    it('GET /reports にトークンなしでアクセスすると 401 を返す', async () => {
      const req = makeRequestNoAuth(REPORTS_BASE, 'GET')
      const res = await listReports(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('GET /customers にトークンなしでアクセスすると 401 を返す', async () => {
      const req = makeRequestNoAuth(CUSTOMERS_BASE, 'GET')
      const res = await listCustomers(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('POST /users にトークンなしでアクセスすると 401 を返す', async () => {
      const req = makeRequestNoAuth(USERS_BASE, 'POST', {
        name: 'テスト',
        email: 'test@test.com',
        password: 'Test1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // ─── SEC-002: 不正トークン → 401 ──────────────────────────────────────────────

  describe('SEC-002: 不正トークン → 401 UNAUTHORIZED', () => {
    it('改ざんされたトークンで GET /reports にアクセスすると 401 を返す', async () => {
      const req = makeRequestWithToken(REPORTS_BASE, 'GET', 'invalid.token.here')
      const res = await listReports(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('有効期限切れトークン形式で GET /customers にアクセスすると 401 を返す', async () => {
      // JWT の構造を持つが署名が不正なトークン
      const fakeToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
        '.eyJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ' +
        '.invalid_signature_here'

      const req = makeRequestWithToken(CUSTOMERS_BASE, 'GET', fakeToken)
      const res = await listCustomers(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('空文字列トークンで GET /reports にアクセスすると 401 を返す', async () => {
      const req = makeRequestWithToken(REPORTS_BASE, 'GET', '')
      const res = await listReports(req, {})

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // ─── SEC-003: 他人の日報アクセス（sales） → 403 ──────────────────────────────

  describe('SEC-003: 他人の日報アクセス（sales） → 403 FORBIDDEN', () => {
    it('sales（YAMADA）が sales（SUZUKI）の日報詳細にアクセスすると 403 を返す', async () => {
      const suzuki = TEST_USERS.suzuki
      const reportId = await createTestReport({
        userId: suzuki.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '鈴木の訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${REPORTS_BASE}/${reportId}`, 'GET', YAMADA)
      const res = await getReport(req, reportIdContext(reportId))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('sales（YAMADA）の日報一覧にはYAMADA自身の日報のみ含まれる', async () => {
      const suzuki = TEST_USERS.suzuki

      await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '山田訪問', sortOrder: 1 }],
      })
      await createTestReport({
        userId: suzuki.id,
        reportDate: '2026-04-25',
        visitRecords: [{ customerId: CUST01.id, content: '鈴木訪問', sortOrder: 1 }],
      })

      const req = makeRequest(REPORTS_BASE, 'GET', YAMADA)
      const res = await listReports(req, {})

      expect(res.status).toBe(200)
      const body = await res.json()
      // sales は自分の分しか返らない
      body.data.forEach((report: { user: { id: string } }) => {
        expect(report.user.id).toBe(YAMADA.id)
      })
    })
  })

  // ─── SEC-004: SQL インジェクション → エラーなし ───────────────────────────────

  describe('SEC-004: SQL インジェクション → 500 にならない（正常または 400）', () => {
    it('顧客名に SQL インジェクションパターンを含めても 500 にならない', async () => {
      const req = makeRequest(CUSTOMERS_BASE, 'POST', YAMADA, {
        name: "'; DROP TABLE users; --",
        company: '株式会社テスト',
      })
      const res = await createCustomer(req, {})

      // 500 (Internal Server Error) にならないこと
      expect(res.status).not.toBe(500)
      // 作成成功（201）または バリデーションエラー（400）のいずれか
      expect([200, 201, 400, 422]).toContain(res.status)
    })

    it('顧客検索クエリに SQL インジェクションパターンを含めても 500 にならない', async () => {
      const injectionQuery = encodeURIComponent("'; DROP TABLE customers; --")
      const req = makeRequest(`${CUSTOMERS_BASE}?q=${injectionQuery}`, 'GET', YAMADA)
      const res = await listCustomers(req, {})

      // 500 (Internal Server Error) にならないこと
      expect(res.status).not.toBe(500)
      expect(res.status).toBe(200)
    })

    it('日報作成の problem フィールドに SQL インジェクションパターンを含めても 500 にならない', async () => {
      const req = makeRequest(REPORTS_BASE, 'POST', YAMADA, {
        report_date: '2026-05-01',
        problem: "'; DELETE FROM daily_reports WHERE '1'='1",
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      // 500 (Internal Server Error) にならないこと
      expect(res.status).not.toBe(500)
      expect([200, 201, 400]).toContain(res.status)
    })
  })

  // ─── SEC-005: XSS → エスケープ表示（API は保存・取得が正常に動作） ────────────

  describe('SEC-005: XSS → API は入力をそのまま保存・取得（フロントでエスケープ）', () => {
    it('顧客名に XSS スクリプトを含めて作成・取得しても同じ文字列が返る', async () => {
      const xssPayload = '<script>alert(1)</script>'

      const createReq = makeRequest(CUSTOMERS_BASE, 'POST', YAMADA, {
        name: xssPayload,
        company: '株式会社XSSテスト',
      })
      const createRes = await createCustomer(createReq, {})

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      const customerId: string = createBody.data.id

      // 取得して同じ文字列が返ること（API レイヤーでの変換なし）
      const getReq = makeRequest(`${CUSTOMERS_BASE}/${customerId}`, 'GET', YAMADA)
      const getRes = await getCustomer(getReq, customerIdContext(customerId))

      expect(getRes.status).toBe(200)
      const getBody = await getRes.json()
      expect(getBody.data.name).toBe(xssPayload)
    })

    it('日報の problem フィールドに XSS スクリプトを含めて作成・取得しても同じ文字列が返る', async () => {
      const xssPayload = '<img src=x onerror=alert(1)>'

      const createReq = makeRequest(REPORTS_BASE, 'POST', YAMADA, {
        report_date: '2026-05-02',
        problem: xssPayload,
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const createRes = await createReport(createReq, {})

      expect(createRes.status).toBe(201)
      const createBody = await createRes.json()
      const reportId: string = createBody.data.id

      // 取得して同じ文字列が返ること（API レイヤーでの変換なし）
      const getReq = makeRequest(`${REPORTS_BASE}/${reportId}`, 'GET', YAMADA)
      const getRes = await getReport(getReq, reportIdContext(reportId))

      expect(getRes.status).toBe(200)
      const getBody = await getRes.json()
      expect(getBody.data.problem).toBe(xssPayload)
    })
  })

  // ─── SEC-006: パスワードハッシュ保存確認 ─────────────────────────────────────

  describe('SEC-006: パスワードはハッシュ化されて保存される', () => {
    it('ユーザー作成後、DB の passwordHash が bcrypt ハッシュ形式で保存される', async () => {
      const plainPassword = 'SecurePass1234!'

      const req = makeRequest(USERS_BASE, 'POST', ADMIN, {
        name: 'ハッシュテスト',
        email: 'hashtest@test.com',
        password: plainPassword,
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      const userId: string = body.data.id

      // DB から直接 passwordHash を取得
      const userInDb = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      })

      expect(userInDb).not.toBeNull()
      expect(userInDb!.passwordHash).not.toBe(plainPassword)
      // bcrypt ハッシュ形式（$2a$ または $2b$ で始まる）であることを確認
      expect(userInDb!.passwordHash).toMatch(/^\$2[ab]\$/)
    })

    it('ユーザー作成 API のレスポンスにパスワードハッシュが含まれない', async () => {
      const req = makeRequest(USERS_BASE, 'POST', ADMIN, {
        name: 'パスワード非公開テスト',
        email: 'nopwdhash@test.com',
        password: 'SecurePass1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()

      // レスポンスにパスワード関連フィールドが含まれないこと
      expect(body.data).not.toHaveProperty('passwordHash')
      expect(body.data).not.toHaveProperty('password')
      expect(body.data).not.toHaveProperty('password_hash')
    })
  })
})
