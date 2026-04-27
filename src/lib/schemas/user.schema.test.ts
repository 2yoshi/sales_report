import { describe, it, expect } from 'vitest'
import { createUserSchema, updateUserSchema } from './user.schema'

const validCreateInput = {
  name: '山田 太郎',
  email: 'yamada@test.com',
  password: 'Test1234!',
  role: 'sales' as const,
}

describe('createUserSchema', () => {
  describe('正常系', () => {
    it('有効なデータでパースできる（sales）', () => {
      const result = createUserSchema.safeParse(validCreateInput)
      expect(result.success).toBe(true)
    })

    it('有効なデータでパースできる（manager）', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, role: 'manager' })
      expect(result.success).toBe(true)
    })

    it('有効なデータでパースできる（admin）', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, role: 'admin' })
      expect(result.success).toBe(true)
    })
  })

  describe('name フィールド', () => {
    it('name が空の場合はエラーになる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, name: '' })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'name')
      expect(issue?.message).toBe('氏名は必須です')
    })

    it('name が 100 文字ちょうどはパースできる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, name: 'a'.repeat(100) })
      expect(result.success).toBe(true)
    })

    it('name が 101 文字以上はエラーになる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, name: 'a'.repeat(101) })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'name')
      expect(issue?.message).toBe('氏名は100文字以内で入力してください')
    })
  })

  describe('email フィールド', () => {
    it('email が空の場合はエラーになる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, email: '' })
      expect(result.success).toBe(false)
    })

    it('email 形式でない場合はエラーになる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, email: 'not-email' })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'email')
      expect(issue?.message).toBe('メール形式で入力してください')
    })
  })

  describe('password フィールド', () => {
    it('8 文字のパスワードはパースできる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, password: '12345678' })
      expect(result.success).toBe(true)
    })

    it('7 文字のパスワードはエラーになる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, password: '1234567' })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('パスワードは8文字以上で入力してください')
    })

    it('password が未指定の場合はエラーになる', () => {
      const { password: _, ...rest } = validCreateInput
      const result = createUserSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })

  describe('role フィールド', () => {
    it('無効なロールはエラーになる', () => {
      const result = createUserSchema.safeParse({ ...validCreateInput, role: 'superadmin' })
      expect(result.success).toBe(false)
    })

    it('role が未指定の場合はエラーになる', () => {
      const { role: _, ...rest } = validCreateInput
      const result = createUserSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })
})

describe('updateUserSchema', () => {
  const validUpdateInput = {
    name: '山田 太郎',
    email: 'yamada@test.com',
    role: 'manager' as const,
  }

  describe('正常系', () => {
    it('password なしでパースできる', () => {
      const result = updateUserSchema.safeParse(validUpdateInput)
      expect(result.success).toBe(true)
    })

    it('password ありでパースできる', () => {
      const result = updateUserSchema.safeParse({ ...validUpdateInput, password: 'NewPass123' })
      expect(result.success).toBe(true)
    })
  })

  describe('password フィールド（任意）', () => {
    it('password が 7 文字以下の場合はエラーになる', () => {
      const result = updateUserSchema.safeParse({ ...validUpdateInput, password: '1234567' })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'password')
      expect(issue?.message).toBe('パスワードは8文字以上で入力してください')
    })
  })
})
