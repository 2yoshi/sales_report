import { describe, it, expect } from 'vitest'
import { loginSchema } from './auth.schema'

describe('loginSchema', () => {
  describe('正常系', () => {
    it('有効なメールアドレスとパスワードでパースできる', () => {
      const result = loginSchema.safeParse({
        email: 'yamada@test.com',
        password: 'Test1234!',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('email フィールド', () => {
    it('email が空の場合は必須エラーになる', () => {
      const result = loginSchema.safeParse({ email: '', password: 'password' })
      expect(result.success).toBe(false)
      if (result.success) return
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email')
      expect(emailIssue).toBeDefined()
    })

    it('email が未指定の場合は必須エラーになる', () => {
      const result = loginSchema.safeParse({ password: 'password' })
      expect(result.success).toBe(false)
    })

    it('email 形式でない場合はエラーになる', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password' })
      expect(result.success).toBe(false)
      if (result.success) return
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email')
      expect(emailIssue?.message).toBe('メール形式で入力してください')
    })
  })

  describe('password フィールド', () => {
    it('password が空の場合は必須エラーになる', () => {
      const result = loginSchema.safeParse({ email: 'user@test.com', password: '' })
      expect(result.success).toBe(false)
    })

    it('password が未指定の場合は必須エラーになる', () => {
      const result = loginSchema.safeParse({ email: 'user@test.com' })
      expect(result.success).toBe(false)
    })
  })
})
