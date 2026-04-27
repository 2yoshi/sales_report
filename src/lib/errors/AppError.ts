import { ERROR_CODES, HTTP_STATUS } from './codes'
import type { ErrorCode } from './codes'

export interface ErrorDetail {
  field: string
  message: string
}

/**
 * Domain-level application error that carries a typed error code,
 * HTTP status, and optional field-level validation details.
 *
 * All service-layer errors should be thrown as AppError so that
 * the route handler can serialise them uniformly.
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: ErrorDetail[]

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = HTTP_STATUS[code]
    this.details = details
  }

  // ─── Static factory helpers ───────────────────────────────────────────

  static validationError(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, details)
  }

  static invalidCredentials(): AppError {
    return new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      'メールアドレスまたはパスワードが正しくありません',
    )
  }

  static unauthorized(message = '認証が必要です'): AppError {
    return new AppError(ERROR_CODES.UNAUTHORIZED, message)
  }

  static forbidden(message = 'この操作を行う権限がありません'): AppError {
    return new AppError(ERROR_CODES.FORBIDDEN, message)
  }

  static notFound(resource = 'リソース'): AppError {
    return new AppError(ERROR_CODES.NOT_FOUND, `${resource}が見つかりません`)
  }

  static duplicateReport(): AppError {
    return new AppError(ERROR_CODES.DUPLICATE_REPORT, 'この日付の日報は既に存在します')
  }

  static emailAlreadyExists(): AppError {
    return new AppError(
      ERROR_CODES.EMAIL_ALREADY_EXISTS,
      'このメールアドレスは既に使用されています',
    )
  }

  static customerInUse(): AppError {
    return new AppError(
      ERROR_CODES.CUSTOMER_IN_USE,
      '訪問記録に紐づいているため削除できません',
    )
  }

  static userInUse(): AppError {
    return new AppError(
      ERROR_CODES.USER_IN_USE,
      '日報に紐づいているため削除できません',
    )
  }

  static internalServerError(message = 'サーバーエラーが発生しました'): AppError {
    return new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, message)
  }
}
