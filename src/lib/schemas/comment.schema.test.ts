import { describe, it, expect } from 'vitest'
import { createCommentSchema } from './comment.schema'

describe('createCommentSchema', () => {
  describe('正常系', () => {
    it('有効なコメント本文でパースできる', () => {
      const result = createCommentSchema.safeParse({ body: '良い日報です' })
      expect(result.success).toBe(true)
    })

    it('2000 文字ちょうどはパースできる', () => {
      const result = createCommentSchema.safeParse({ body: 'a'.repeat(2000) })
      expect(result.success).toBe(true)
    })
  })

  describe('body フィールド', () => {
    it('body が空の場合はエラーになる', () => {
      const result = createCommentSchema.safeParse({ body: '' })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'body')
      expect(issue?.message).toBe('コメント内容は必須です')
    })

    it('body が未指定の場合はエラーになる', () => {
      const result = createCommentSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('2001 文字以上はエラーになる', () => {
      const result = createCommentSchema.safeParse({ body: 'a'.repeat(2001) })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'body')
      expect(issue?.message).toBe('コメントは2000文字以内で入力してください')
    })
  })
})
