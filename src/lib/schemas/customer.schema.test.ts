import { describe, it, expect } from 'vitest'
import { createCustomerSchema, updateCustomerSchema } from './customer.schema'

describe('createCustomerSchema', () => {
  describe('正常系', () => {
    it('必須フィールドのみでパースできる', () => {
      const result = createCustomerSchema.safeParse({ name: '佐藤 健' })
      expect(result.success).toBe(true)
    })

    it('全フィールドを指定してパースできる', () => {
      const result = createCustomerSchema.safeParse({
        name: '佐藤 健',
        company: '株式会社A',
        phone: '03-1234-5678',
        email: 'sato@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('email が空文字の場合もパースできる', () => {
      const result = createCustomerSchema.safeParse({ name: '佐藤 健', email: '' })
      expect(result.success).toBe(true)
    })

    it('company が省略可能である', () => {
      const result = createCustomerSchema.safeParse({ name: '佐藤 健' })
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.company).toBeUndefined()
    })
  })

  describe('name フィールド', () => {
    it('name が空の場合はエラーになる', () => {
      const result = createCustomerSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'name')
      expect(issue?.message).toBe('顧客名は必須です')
    })

    it('name が 100 文字ちょうどはパースできる', () => {
      const result = createCustomerSchema.safeParse({ name: 'a'.repeat(100) })
      expect(result.success).toBe(true)
    })

    it('name が 101 文字以上はエラーになる', () => {
      const result = createCustomerSchema.safeParse({ name: 'a'.repeat(101) })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'name')
      expect(issue?.message).toBe('顧客名は100文字以内で入力してください')
    })
  })

  describe('company フィールド', () => {
    it('company が 200 文字ちょうどはパースできる', () => {
      const result = createCustomerSchema.safeParse({
        name: '佐藤 健',
        company: 'a'.repeat(200),
      })
      expect(result.success).toBe(true)
    })

    it('company が 201 文字以上はエラーになる', () => {
      const result = createCustomerSchema.safeParse({
        name: '佐藤 健',
        company: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'company')
      expect(issue?.message).toBe('会社名は200文字以内で入力してください')
    })
  })

  describe('email フィールド', () => {
    it('有効な email 形式はパースできる', () => {
      const result = createCustomerSchema.safeParse({
        name: '佐藤 健',
        email: 'sato@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('email 形式でない場合はエラーになる', () => {
      const result = createCustomerSchema.safeParse({
        name: '佐藤 健',
        email: 'invalid-email',
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'email')
      expect(issue?.message).toBe('メール形式で入力してください')
    })
  })
})

describe('updateCustomerSchema', () => {
  it('createCustomerSchema と同じバリデーションルールを持つ', () => {
    const result = updateCustomerSchema.safeParse({ name: '伊藤 恵子' })
    expect(result.success).toBe(true)
  })
})
