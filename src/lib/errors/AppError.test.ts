import { describe, it, expect } from 'vitest'
import { AppError } from './AppError'
import { ERROR_CODES } from './codes'

describe('AppError', () => {
  describe('コンストラクタ', () => {
    it('コードとメッセージを設定する', () => {
      const err = new AppError(ERROR_CODES.NOT_FOUND, 'リソースが見つかりません')
      expect(err.code).toBe(ERROR_CODES.NOT_FOUND)
      expect(err.message).toBe('リソースが見つかりません')
      expect(err.statusCode).toBe(404)
      expect(err.details).toBeUndefined()
    })

    it('details を設定できる', () => {
      const details = [{ field: 'email', message: 'メール形式で入力してください' }]
      const err = new AppError(ERROR_CODES.VALIDATION_ERROR, '入力値が不正です', details)
      expect(err.details).toEqual(details)
    })

    it('name が AppError である', () => {
      const err = new AppError(ERROR_CODES.FORBIDDEN, '権限がありません')
      expect(err.name).toBe('AppError')
    })

    it('Error のインスタンスである', () => {
      const err = new AppError(ERROR_CODES.NOT_FOUND, 'not found')
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe('static factory: validationError', () => {
    it('VALIDATION_ERROR コードで 400 ステータスになる', () => {
      const err = AppError.validationError('入力値が不正です')
      expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR)
      expect(err.statusCode).toBe(400)
    })

    it('details を受け取れる', () => {
      const details = [{ field: 'name', message: '必須です' }]
      const err = AppError.validationError('入力値が不正です', details)
      expect(err.details).toEqual(details)
    })
  })

  describe('static factory: invalidCredentials', () => {
    it('INVALID_CREDENTIALS コードで 401 ステータスになる', () => {
      const err = AppError.invalidCredentials()
      expect(err.code).toBe(ERROR_CODES.INVALID_CREDENTIALS)
      expect(err.statusCode).toBe(401)
      expect(err.message).toBe('メールアドレスまたはパスワードが正しくありません')
    })
  })

  describe('static factory: unauthorized', () => {
    it('デフォルトメッセージで UNAUTHORIZED を生成する', () => {
      const err = AppError.unauthorized()
      expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED)
      expect(err.statusCode).toBe(401)
      expect(err.message).toBe('認証が必要です')
    })

    it('カスタムメッセージを受け取れる', () => {
      const err = AppError.unauthorized('トークンが無効です')
      expect(err.message).toBe('トークンが無効です')
    })
  })

  describe('static factory: forbidden', () => {
    it('FORBIDDEN コードで 403 ステータスになる', () => {
      const err = AppError.forbidden()
      expect(err.code).toBe(ERROR_CODES.FORBIDDEN)
      expect(err.statusCode).toBe(403)
    })
  })

  describe('static factory: notFound', () => {
    it('デフォルトリソース名で NOT_FOUND を生成する', () => {
      const err = AppError.notFound()
      expect(err.code).toBe(ERROR_CODES.NOT_FOUND)
      expect(err.statusCode).toBe(404)
      expect(err.message).toBe('リソースが見つかりません')
    })

    it('カスタムリソース名を受け取れる', () => {
      const err = AppError.notFound('日報')
      expect(err.message).toBe('日報が見つかりません')
    })
  })

  describe('static factory: duplicateReport', () => {
    it('DUPLICATE_REPORT コードで 409 ステータスになる', () => {
      const err = AppError.duplicateReport()
      expect(err.code).toBe(ERROR_CODES.DUPLICATE_REPORT)
      expect(err.statusCode).toBe(409)
      expect(err.message).toBe('この日付の日報は既に存在します')
    })
  })

  describe('static factory: emailAlreadyExists', () => {
    it('EMAIL_ALREADY_EXISTS コードで 409 ステータスになる', () => {
      const err = AppError.emailAlreadyExists()
      expect(err.code).toBe(ERROR_CODES.EMAIL_ALREADY_EXISTS)
      expect(err.statusCode).toBe(409)
      expect(err.message).toBe('このメールアドレスは既に使用されています')
    })
  })

  describe('static factory: customerInUse', () => {
    it('CUSTOMER_IN_USE コードで 409 ステータスになる', () => {
      const err = AppError.customerInUse()
      expect(err.code).toBe(ERROR_CODES.CUSTOMER_IN_USE)
      expect(err.statusCode).toBe(409)
      expect(err.message).toBe('訪問記録に紐づいているため削除できません')
    })
  })

  describe('static factory: userInUse', () => {
    it('USER_IN_USE コードで 409 ステータスになる', () => {
      const err = AppError.userInUse()
      expect(err.code).toBe(ERROR_CODES.USER_IN_USE)
      expect(err.statusCode).toBe(409)
      expect(err.message).toBe('日報に紐づいているため削除できません')
    })
  })

  describe('static factory: internalServerError', () => {
    it('INTERNAL_SERVER_ERROR コードで 500 ステータスになる', () => {
      const err = AppError.internalServerError()
      expect(err.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR)
      expect(err.statusCode).toBe(500)
    })

    it('カスタムメッセージを受け取れる', () => {
      const err = AppError.internalServerError('DBエラー')
      expect(err.message).toBe('DBエラー')
    })
  })
})
