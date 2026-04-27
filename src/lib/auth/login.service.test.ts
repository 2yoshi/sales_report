import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { loginUser } from './login.service'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'

// Mock Prisma to avoid real DB calls in unit tests
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

const mockFindUnique = vi.mocked(prisma.user.findUnique)

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AUTH-001: 正常ログイン', () => {
    it('salesロールのユーザーが正しい認証情報でログインできる', async () => {
      const passwordHash = await hashPassword('Test1234!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-001',
        name: '山田 太郎',
        email: 'yamada@test.com',
        role: 'sales',
        passwordHash,
      })

      const result = await loginUser({ email: 'yamada@test.com', password: 'Test1234!' })

      expect(result.access_token).toBeTruthy()
      expect(result.token_type).toBe('Bearer')
      expect(result.expires_in).toBe(86400)
      expect(result.user.id).toBe('user-001')
      expect(result.user.name).toBe('山田 太郎')
      expect(result.user.email).toBe('yamada@test.com')
      expect(result.user.role).toBe('sales')
    })

    it('managerロールのユーザーが正しい認証情報でログインできる', async () => {
      const passwordHash = await hashPassword('Test1234!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-003',
        name: '田中 部長',
        email: 'tanaka@test.com',
        role: 'manager',
        passwordHash,
      })

      const result = await loginUser({ email: 'tanaka@test.com', password: 'Test1234!' })

      expect(result.user.role).toBe('manager')
      expect(result.user.email).toBe('tanaka@test.com')
    })

    it('adminロールのユーザーが正しい認証情報でログインできる', async () => {
      const passwordHash = await hashPassword('Test1234!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-004',
        name: '管理 太郎',
        email: 'admin@test.com',
        role: 'admin',
        passwordHash,
      })

      const result = await loginUser({ email: 'admin@test.com', password: 'Test1234!' })

      expect(result.user.role).toBe('admin')
    })

    it('レスポンスにはpasswordHashが含まれない', async () => {
      const passwordHash = await hashPassword('Test1234!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-001',
        name: '山田 太郎',
        email: 'yamada@test.com',
        role: 'sales',
        passwordHash,
      })

      const result = await loginUser({ email: 'yamada@test.com', password: 'Test1234!' })

      expect(result.user).not.toHaveProperty('passwordHash')
      expect(result.user).not.toHaveProperty('password_hash')
    })
  })

  describe('API-001: access_tokenが返される', () => {
    it('ログイン成功時にaccess_tokenを含むレスポンスが返される', async () => {
      const passwordHash = await hashPassword('Test1234!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-001',
        name: '山田 太郎',
        email: 'yamada@test.com',
        role: 'sales',
        passwordHash,
      })

      const result = await loginUser({ email: 'yamada@test.com', password: 'Test1234!' })

      // JWT形式 (header.payload.signature)
      expect(result.access_token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
      expect(result.token_type).toBe('Bearer')
      expect(result.expires_in).toBe(86400)
    })
  })

  describe('AUTH-004 / API-002: パスワード誤り → 401', () => {
    it('パスワードが間違っている場合はINVALID_CREDENTIALSエラーを投げる', async () => {
      const passwordHash = await hashPassword('CorrectPassword!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-001',
        name: '山田 太郎',
        email: 'yamada@test.com',
        role: 'sales',
        passwordHash,
      })

      await expect(
        loginUser({ email: 'yamada@test.com', password: 'WrongPassword!' }),
      ).rejects.toThrow(AppError)

      try {
        await loginUser({ email: 'yamada@test.com', password: 'WrongPassword!' })
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        const appErr = err as AppError
        expect(appErr.code).toBe('INVALID_CREDENTIALS')
        expect(appErr.statusCode).toBe(401)
      }
    })
  })

  describe('AUTH-005: 存在しないメールアドレス → 401', () => {
    it('メールアドレスが存在しない場合はINVALID_CREDENTIALSエラーを投げる', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      await expect(
        loginUser({ email: 'nonexistent@test.com', password: 'Test1234!' }),
      ).rejects.toThrow(AppError)

      try {
        await loginUser({ email: 'nonexistent@test.com', password: 'Test1234!' })
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        const appErr = err as AppError
        expect(appErr.code).toBe('INVALID_CREDENTIALS')
        expect(appErr.statusCode).toBe(401)
      }
    })

    it('存在しないメールと誤ったパスワードで同じエラーコードを返す（情報漏洩防止）', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      let nonExistentError: AppError | null = null
      try {
        await loginUser({ email: 'nonexistent@test.com', password: 'wrong' })
      } catch (err) {
        nonExistentError = err as AppError
      }

      const passwordHash = await hashPassword('Test1234!')
      mockFindUnique.mockResolvedValueOnce({
        id: 'user-001',
        name: '山田 太郎',
        email: 'yamada@test.com',
        role: 'sales',
        passwordHash,
      })

      let wrongPasswordError: AppError | null = null
      try {
        await loginUser({ email: 'yamada@test.com', password: 'WrongPassword!' })
      } catch (err) {
        wrongPasswordError = err as AppError
      }

      expect(nonExistentError).not.toBeNull()
      expect(wrongPasswordError).not.toBeNull()
      expect(nonExistentError!.code).toBe(wrongPasswordError!.code)
      expect(nonExistentError!.statusCode).toBe(wrongPasswordError!.statusCode)
    })
  })
})
