import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import * as loginService from '@/lib/auth/login.service'
import { AppError } from '@/lib/errors/AppError'
import { AUTH_TOKEN_EXPIRES_SECONDS } from '@/lib/auth/jwt'

vi.mock('@/lib/auth/login.service', () => ({
  loginUser: vi.fn(),
}))

const mockLoginUser = vi.mocked(loginService.loginUser)

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockLoginResult: loginService.LoginResult = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
  token_type: 'Bearer',
  expires_in: AUTH_TOKEN_EXPIRES_SECONDS,
  user: {
    id: 'user-001',
    name: '山田 太郎',
    email: 'yamada@test.com',
    role: 'sales',
  },
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AUTH-001 / API-001: 正常ログイン → 200', () => {
    it('正しい認証情報で200とアクセストークンを返す', async () => {
      mockLoginUser.mockResolvedValueOnce(mockLoginResult)

      const req = makeRequest({ email: 'yamada@test.com', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toBeDefined()
      expect(body.data.access_token).toBe(mockLoginResult.access_token)
      expect(body.data.token_type).toBe('Bearer')
      expect(body.data.expires_in).toBe(AUTH_TOKEN_EXPIRES_SECONDS)
      expect(body.data.user.id).toBe('user-001')
      expect(body.data.user.name).toBe('山田 太郎')
      expect(body.data.user.email).toBe('yamada@test.com')
      expect(body.data.user.role).toBe('sales')
    })

    it('レスポンスボディはdata配下にネストされている', async () => {
      mockLoginUser.mockResolvedValueOnce(mockLoginResult)

      const req = makeRequest({ email: 'yamada@test.com', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      // 標準APIレスポンス形式 { data: ... }
      expect(Object.keys(body)).toEqual(['data'])
    })

    it('レスポンスにpasswordHashは含まれない', async () => {
      mockLoginUser.mockResolvedValueOnce(mockLoginResult)

      const req = makeRequest({ email: 'yamada@test.com', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      expect(body.data.user).not.toHaveProperty('passwordHash')
      expect(body.data.user).not.toHaveProperty('password_hash')
    })
  })

  describe('AUTH-004 / API-002: パスワード誤り → 401', () => {
    it('パスワードが間違っている場合は401とINVALID_CREDENTIALSを返す', async () => {
      mockLoginUser.mockRejectedValueOnce(AppError.invalidCredentials())

      const req = makeRequest({ email: 'yamada@test.com', password: 'WrongPassword' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('INVALID_CREDENTIALS')
      expect(body.error.message).toBeTruthy()
    })
  })

  describe('AUTH-005: 存在しないメールアドレス → 401', () => {
    it('存在しないメールアドレスの場合は401とINVALID_CREDENTIALSを返す', async () => {
      mockLoginUser.mockRejectedValueOnce(AppError.invalidCredentials())

      const req = makeRequest({ email: 'nonexistent@test.com', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('AUTH-006: バリデーションエラー → 400', () => {
    it('emailが空の場合は400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ email: '', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details).toBeDefined()
      const emailDetail = body.error.details.find(
        (d: { field: string; message: string }) => d.field === 'email',
      )
      expect(emailDetail).toBeDefined()
    })

    it('passwordが空の場合は400とVALIDATION_ERRORを返す', async () => {
      const req = makeRequest({ email: 'yamada@test.com', password: '' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details).toBeDefined()
      const passwordDetail = body.error.details.find(
        (d: { field: string; message: string }) => d.field === 'password',
      )
      expect(passwordDetail).toBeDefined()
    })

    it('emailとpasswordが両方未指定の場合は400を返す', async () => {
      const req = makeRequest({})
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('emailがメール形式でない場合は400を返す', async () => {
      const req = makeRequest({ email: 'not-an-email', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      const emailDetail = body.error.details.find(
        (d: { field: string; message: string }) => d.field === 'email',
      )
      expect(emailDetail?.message).toBe('メール形式で入力してください')
    })

    it('リクエストボディが空の場合は400を返す', async () => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('不正なリクエストボディ → 400', () => {
    it('JSONとして解析できないボディは400とVALIDATION_ERRORを返す', async () => {
      const req = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'this is not json',
      })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('サービス層からの予期しないエラー → 500', () => {
    it('予期しないエラーが発生した場合は500を返す', async () => {
      mockLoginUser.mockRejectedValueOnce(new Error('Database connection failed'))

      const req = makeRequest({ email: 'yamada@test.com', password: 'Test1234!' })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})
