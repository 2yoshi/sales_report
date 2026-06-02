import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getVisitRecords } from '@/app/api/reports/[id]/visit_records/route'
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
const TANAKA = TEST_USERS.tanaka
const CUST01 = TEST_CUSTOMERS.cust01
const CUST02 = TEST_CUSTOMERS.cust02

const BASE = 'http://localhost/api/reports'

function makeRequest(url: string, user: typeof YAMADA | typeof TANAKA): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${makeToken(user)}` },
  })
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('訪問記録API', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('GET /reports/:id/visit_records → sort_order 昇順で返す', () => {
    it('訪問記録が sort_order 昇順で返される', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [
          { customerId: CUST02.id, content: '2番目の訪問', sortOrder: 2 },
          { customerId: CUST01.id, content: '1番目の訪問', sortOrder: 1 },
        ],
      })

      const req = makeRequest(`${BASE}/${reportId}/visit_records`, YAMADA)
      const res = await getVisitRecords(req, idContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(2)
      expect(body.data[0].sort_order).toBe(1)
      expect(body.data[0].content).toBe('1番目の訪問')
      expect(body.data[1].sort_order).toBe(2)
      expect(body.data[1].content).toBe('2番目の訪問')
    })

    it('manager は他ユーザーの日報の訪問記録を取得できる', async () => {
      const reportId = await createTestReport({
        userId: YAMADA.id,
        reportDate: '2026-05-01',
        visitRecords: [{ customerId: CUST01.id, content: '訪問内容', sortOrder: 1 }],
      })

      const req = makeRequest(`${BASE}/${reportId}/visit_records`, TANAKA)
      const res = await getVisitRecords(req, idContext(reportId))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].customer.id).toBe(CUST01.id)
    })

    it('存在しない日報IDで404を返す', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999'
      const req = makeRequest(`${BASE}/${nonExistentId}/visit_records`, YAMADA)
      const res = await getVisitRecords(req, idContext(nonExistentId))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })
  })
})
