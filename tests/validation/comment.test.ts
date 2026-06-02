import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createComment } from '@/app/api/reports/[id]/comments/route'
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

const TANAKA = TEST_USERS.tanaka // manager
const YAMADA = TEST_USERS.yamada // sales（日報作成用）
const CUST01 = TEST_CUSTOMERS.cust01

const BASE = 'http://localhost/api/reports'

function makeRequest(reportId: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${makeToken(TANAKA)}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(`${BASE}/${reportId}/comments`, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function reportContext(reportId: string) {
  return { params: Promise.resolve({ id: reportId }) }
}

describe('コメントバリデーション', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // VAL-041: コメント本文空欄 → 400, VALIDATION_ERROR
  describe('VAL-041: コメント本文空欄 → 400, VALIDATION_ERROR', () => {
    it('コメント本文が空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(reportId, { body: '' })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(400)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-042: コメント本文2001文字 → 400, VALIDATION_ERROR
  describe('VAL-042: コメント本文2001文字 → 400, VALIDATION_ERROR', () => {
    it('コメント本文が2001文字の場合400とVALIDATION_ERRORを返す', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(reportId, { body: 'あ'.repeat(2001) })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(400)
      const resBody = await res.json()
      expect(resBody.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-043: コメント本文2000文字 → 201（正常・境界値）
  describe('VAL-043: コメント本文2000文字 → 201（正常）', () => {
    it('コメント本文が2000文字の場合201と作成コメントを返す（境界値）', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const body2000 = 'あ'.repeat(2000)
      const req = makeRequest(reportId, { body: body2000 })
      const res = await createComment(req, reportContext(reportId))

      expect(res.status).toBe(201)
      const resBody = await res.json()
      expect(resBody.data).toHaveProperty('id')
      expect(resBody.data.body).toBe(body2000)
      expect(resBody.data.commenter.id).toBe(TANAKA.id)
    })
  })
})
