import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createCustomer } from '@/app/api/customers/route'
import {
  clearDatabase,
  seedTestUsers,
  seedTestCustomers,
  prisma,
  TEST_USERS,
} from '../helpers/db'
import { makeToken } from '../helpers/auth'

const YAMADA = TEST_USERS.yamada // sales

const BASE = 'http://localhost/api/customers'

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

describe('顧客マスタバリデーション', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // VAL-021: 顧客名空欄 → 400, VALIDATION_ERROR
  describe('VAL-021: 顧客名空欄 → 400, VALIDATION_ERROR', () => {
    it('顧客名が空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ name: '' })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-022: 顧客名101文字 → 400, VALIDATION_ERROR
  describe('VAL-022: 顧客名101文字 → 400, VALIDATION_ERROR', () => {
    it('顧客名が101文字の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ name: 'あ'.repeat(101) })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-023: 顧客名1文字 → 201（正常）
  describe('VAL-023: 顧客名1文字 → 201（正常）', () => {
    it('顧客名が1文字の場合201と作成データを返す', async () => {
      const req = makeRequest({ name: 'あ' })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe('あ')
    })
  })

  // VAL-024: 顧客名100文字 → 201（正常）
  describe('VAL-024: 顧客名100文字 → 201（正常）', () => {
    it('顧客名が100文字の場合201と作成データを返す', async () => {
      const name = 'あ'.repeat(100)
      const req = makeRequest({ name })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe(name)
    })
  })

  // VAL-025: メールアドレスが不正形式 → 400, VALIDATION_ERROR
  describe('VAL-025: メールアドレスが不正形式 → 400, VALIDATION_ERROR', () => {
    it('メールアドレスが不正形式の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ name: '正常な顧客名', email: 'not-an-email' })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-026: メールアドレス空欄 → 201（任意項目なので正常）
  describe('VAL-026: メールアドレス空欄 → 201（任意項目）', () => {
    it('メールアドレスが指定されない場合も201と作成データを返す（任意項目）', async () => {
      const req = makeRequest({ name: 'メールなし顧客' })
      const res = await createCustomer(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe('メールなし顧客')
    })
  })
})
