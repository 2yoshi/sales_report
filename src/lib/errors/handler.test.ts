import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { handleError } from './handler'
import { AppError } from './AppError'
import { ERROR_CODES } from './codes'

// NextResponse.json は Node.js 環境では Web API として動作する。
// vitest の jsdom 環境では Response が利用可能なので直接テストできる。

async function jsonBody(res: Response): Promise<unknown> {
  return res.json()
}

describe('handleError', () => {
  describe('AppError の場合', () => {
    it('AppError のコード・ステータスで正しいレスポンスを返す', async () => {
      const err = AppError.notFound('日報')
      const res = handleError(err)
      expect(res.status).toBe(404)
      const body = await jsonBody(res)
      expect(body).toEqual({
        error: { code: ERROR_CODES.NOT_FOUND, message: '日報が見つかりません' },
      })
    })

    it('details がある場合は details を含む', async () => {
      const details = [{ field: 'email', message: 'メール形式で入力してください' }]
      const err = AppError.validationError('入力値が不正です', details)
      const res = handleError(err)
      expect(res.status).toBe(400)
      const body = await jsonBody(res)
      expect(body).toEqual({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '入力値が不正です',
          details,
        },
      })
    })

    it('details が空の場合は details を含まない', async () => {
      const err = AppError.forbidden()
      const res = handleError(err)
      expect(res.status).toBe(403)
      const body = await jsonBody(res) as { error: Record<string, unknown> }
      expect(body.error).not.toHaveProperty('details')
    })

    it('DUPLICATE_REPORT は 409 を返す', async () => {
      const res = handleError(AppError.duplicateReport())
      expect(res.status).toBe(409)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.DUPLICATE_REPORT)
    })

    it('EMAIL_ALREADY_EXISTS は 409 を返す', async () => {
      const res = handleError(AppError.emailAlreadyExists())
      expect(res.status).toBe(409)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.EMAIL_ALREADY_EXISTS)
    })

    it('CUSTOMER_IN_USE は 409 を返す', async () => {
      const res = handleError(AppError.customerInUse())
      expect(res.status).toBe(409)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.CUSTOMER_IN_USE)
    })

    it('USER_IN_USE は 409 を返す', async () => {
      const res = handleError(AppError.userInUse())
      expect(res.status).toBe(409)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.USER_IN_USE)
    })

    it('UNAUTHORIZED は 401 を返す', async () => {
      const res = handleError(AppError.unauthorized())
      expect(res.status).toBe(401)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED)
    })
  })

  describe('ZodError の場合', () => {
    it('ZodError を 400 VALIDATION_ERROR に変換する', async () => {
      const schema = z.object({ email: z.string().email('メール形式で入力してください') })
      const result = schema.safeParse({ email: 'bad' })
      expect(result.success).toBe(false)
      if (result.success) return

      const res = handleError(result.error)
      expect(res.status).toBe(400)
      const body = await jsonBody(res) as {
        error: { code: string; message: string; details: unknown[] }
      }
      expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
      expect(body.error.details).toHaveLength(1)
    })
  })

  describe('予期しないエラーの場合', () => {
    it('未知の Error は 500 INTERNAL_SERVER_ERROR を返す', async () => {
      const res = handleError(new Error('予期しないエラー'))
      expect(res.status).toBe(500)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR)
    })

    it('非 Error 値は 500 INTERNAL_SERVER_ERROR を返す', async () => {
      const res = handleError('something went wrong')
      expect(res.status).toBe(500)
      const body = await jsonBody(res) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR)
    })
  })
})
