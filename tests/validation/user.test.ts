import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as createUser } from '@/app/api/users/route'
import {
  clearDatabase,
  seedTestUsers,
  seedTestCustomers,
  prisma,
  TEST_USERS,
} from '../helpers/db'
import { makeToken } from '../helpers/auth'

const ADMIN = TEST_USERS.admin // admin

const BASE = 'http://localhost/api/users'

function makeRequest(body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${makeToken(ADMIN)}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(BASE, {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('ユーザー登録バリデーション', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedTestUsers()
    await seedTestCustomers()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  // VAL-031: 氏名空欄 → 400, VALIDATION_ERROR
  describe('VAL-031: 氏名空欄 → 400, VALIDATION_ERROR', () => {
    it('氏名が空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        name: '',
        email: 'newuser@test.com',
        password: 'Test1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-032: メールアドレス空欄 → 400, VALIDATION_ERROR
  describe('VAL-032: メールアドレス空欄 → 400, VALIDATION_ERROR', () => {
    it('メールアドレスが空欄の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        name: '新規ユーザー',
        email: '',
        password: 'Test1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-033: 既存メールアドレス → 409, EMAIL_ALREADY_EXISTS
  describe('VAL-033: 既存メールアドレス → 409, EMAIL_ALREADY_EXISTS', () => {
    it('既存ユーザーと同じメールアドレスで登録すると409とEMAIL_ALREADY_EXISTSを返す', async () => {
      const req = makeRequest({
        name: '重複ユーザー',
        email: TEST_USERS.yamada.email, // 既存のメールアドレス
        password: 'Test1234!',
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS')
    })
  })

  // VAL-034: パスワード7文字 → 400, VALIDATION_ERROR（8文字以上）
  describe('VAL-034: パスワード7文字 → 400, VALIDATION_ERROR', () => {
    it('パスワードが7文字の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        name: '新規ユーザー',
        email: 'newuser@test.com',
        password: '1234567', // 7文字
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // VAL-035: パスワード8文字 → 201（正常）
  describe('VAL-035: パスワード8文字 → 201（正常）', () => {
    it('パスワードが8文字の場合201と作成ユーザーを返す', async () => {
      const req = makeRequest({
        name: '新規ユーザー',
        email: 'newuser@test.com',
        password: '12345678', // 8文字（境界値）
        role: 'sales',
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.data.name).toBe('新規ユーザー')
      expect(body.data.email).toBe('newuser@test.com')
      expect(body.data.role).toBe('sales')
      // パスワードハッシュが返らないことを確認
      expect(body.data).not.toHaveProperty('passwordHash')
      expect(body.data).not.toHaveProperty('password')
    })
  })

  // VAL-036: ロール未指定 → 400, VALIDATION_ERROR
  describe('VAL-036: ロール未指定 → 400, VALIDATION_ERROR', () => {
    it('ロールが未指定の場合400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({
        name: '新規ユーザー',
        email: 'newuser@test.com',
        password: 'Test1234!',
        // role を省略
      })
      const res = await createUser(req, {})

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })
})
