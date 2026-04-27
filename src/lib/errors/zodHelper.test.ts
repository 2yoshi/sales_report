import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { formatZodError } from './zodHelper'
import { ERROR_CODES } from './codes'

describe('formatZodError', () => {
  it('ZodError を VALIDATION_ERROR の AppError に変換する', () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    })

    const result = schema.safeParse({ email: 'not-an-email', name: '' })
    expect(result.success).toBe(false)
    if (result.success) return

    const appError = formatZodError(result.error)
    expect(appError.code).toBe(ERROR_CODES.VALIDATION_ERROR)
    expect(appError.statusCode).toBe(400)
    expect(appError.message).toBe('入力値が不正です')
    expect(appError.details).toBeDefined()
    expect(appError.details!.length).toBeGreaterThan(0)
  })

  it('各フィールドの details が field と message を含む', () => {
    const schema = z.object({ email: z.string().email('メール形式で入力してください') })
    const result = schema.safeParse({ email: 'bad-email' })
    expect(result.success).toBe(false)
    if (result.success) return

    const appError = formatZodError(result.error)
    expect(appError.details).toEqual([
      { field: 'email', message: 'メール形式で入力してください' },
    ])
  })

  it('ネストされたフィールドのパスをドット区切りで結合する', () => {
    const schema = z.object({
      visit_records: z.array(
        z.object({ content: z.string().max(10, '最大10文字') }),
      ),
    })
    const result = schema.safeParse({
      visit_records: [{ content: 'a'.repeat(11) }],
    })
    expect(result.success).toBe(false)
    if (result.success) return

    const appError = formatZodError(result.error)
    expect(appError.details).toEqual([
      { field: 'visit_records.0.content', message: '最大10文字' },
    ])
  })

  it('複数フィールドのエラーを全て details に含む', () => {
    const schema = z.object({
      name: z.string().min(1, '必須です'),
      email: z.string().email('メール形式で入力してください'),
    })
    const result = schema.safeParse({ name: '', email: 'bad' })
    expect(result.success).toBe(false)
    if (result.success) return

    const appError = formatZodError(result.error)
    expect(appError.details).toHaveLength(2)
    const fields = appError.details!.map((d) => d.field)
    expect(fields).toContain('name')
    expect(fields).toContain('email')
  })
})
