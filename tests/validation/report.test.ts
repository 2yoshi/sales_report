import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createReport } from '@/app/api/reports/route'
import {
  clearDatabase,
  seedTestUsers,
  seedTestCustomers,
  prisma,
  TEST_USERS,
  TEST_CUSTOMERS,
} from '../helpers/db'
import { makeToken } from '../helpers/auth'

const YAMADA = TEST_USERS.yamada // sales
const CUST01 = TEST_CUSTOMERS.cust01

const BASE = 'http://localhost/api/reports'

function makeRequest(body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${makeToken(YAMADA)}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(BASE, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('日報作成バリデーション', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // VAL-011: 対象日空欄 → 400, VALIDATION_ERROR
  describe('VAL-011: 対象日空欄 → 400, VALIDATION_ERROR', () => {
    it('対象日が空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        report_date: '',
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

  // VAL-012: 対象日が未来日（2099-12-31） → 400, VALIDATION_ERROR（今日以前の日付）
  describe('VAL-012: 対象日が未来日 → 400, VALIDATION_ERROR', () => {
    it('対象日が未来日の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
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

  // VAL-013: 顧客未選択（visit_records が空配列） → 400, VALIDATION_ERROR
  describe('VAL-013: 顧客未選択 → 400, VALIDATION_ERROR', () => {
    it('visit_recordsが空配列の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
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
  })

  // VAL-014: 訪問内容空欄 → 400, VALIDATION_ERROR
  describe('VAL-014: 訪問内容空欄 → 400, VALIDATION_ERROR', () => {
    it('訪問内容が空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-015: 訪問内容1001文字 → 400, VALIDATION_ERROR（1000文字以内）
  describe('VAL-015: 訪問内容1001文字 → 400, VALIDATION_ERROR', () => {
    it('訪問内容が1001文字の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: 'あ'.repeat(1001), sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-016: Problem空欄 → 400, VALIDATION_ERROR
  describe('VAL-016: Problem空欄 → 400, VALIDATION_ERROR', () => {
    it('problemが空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        report_date: '2026-05-01',
        problem: '',
        plan: 'テスト計画',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-017: Problem 2001文字 → 400, VALIDATION_ERROR（2000文字以内）
  describe('VAL-017: Problem 2001文字 → 400, VALIDATION_ERROR', () => {
    it('problemが2001文字の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
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
  })

  // VAL-018: Plan空欄 → 400, VALIDATION_ERROR
  describe('VAL-018: Plan空欄 → 400, VALIDATION_ERROR', () => {
    it('planが空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: '',
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-019: Plan 2001文字 → 400, VALIDATION_ERROR（2000文字以内）
  describe('VAL-019: Plan 2001文字 → 400, VALIDATION_ERROR', () => {
    it('planが2001文字の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        report_date: '2026-05-01',
        problem: 'テスト課題',
        plan: 'あ'.repeat(2001),
        visit_records: [{ customer_id: CUST01.id, content: '訪問内容', sort_order: 1 }],
      })
      const res = await createReport(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
