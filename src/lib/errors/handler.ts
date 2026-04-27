import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from './AppError'
import { ERROR_CODES } from './codes'
import { formatZodError } from './zodHelper'

/**
 * Converts any thrown value into a NextResponse with the correct HTTP status
 * and the standard `{ error: { code, message, details? } }` envelope.
 *
 * Usage inside a route handler:
 *
 *   try {
 *     // …
 *   } catch (err) {
 *     return handleError(err)
 *   }
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const body: {
      error: {
        code: string
        message: string
        details?: { field: string; message: string }[]
      }
    } = {
      error: {
        code: err.code,
        message: err.message,
      },
    }
    if (err.details && err.details.length > 0) {
      body.error.details = err.details
    }
    return NextResponse.json(body, { status: err.statusCode })
  }

  if (err instanceof ZodError) {
    const appError = formatZodError(err)
    const body: {
      error: {
        code: string
        message: string
        details?: { field: string; message: string }[]
      }
    } = {
      error: {
        code: appError.code,
        message: appError.message,
      },
    }
    if (appError.details && appError.details.length > 0) {
      body.error.details = appError.details
    }
    return NextResponse.json(body, { status: appError.statusCode })
  }

  // Unexpected errors — do not leak internal details in production
  const message =
    process.env.NODE_ENV !== 'production' && err instanceof Error
      ? err.message
      : 'サーバーエラーが発生しました'

  return NextResponse.json(
    { error: { code: ERROR_CODES.INTERNAL_SERVER_ERROR, message } },
    { status: 500 },
  )
}
