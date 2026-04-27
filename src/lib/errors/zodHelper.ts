import { ZodError } from 'zod'
import { AppError } from './AppError'
import type { ErrorDetail } from './AppError'

/**
 * Converts a ZodError into an AppError with code VALIDATION_ERROR.
 *
 * Each Zod issue is mapped to an `{ field, message }` detail entry.
 * Nested field paths (e.g. `visit_records.0.content`) are joined with `.`.
 */
export function formatZodError(error: ZodError): AppError {
  const details: ErrorDetail[] = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }))

  return AppError.validationError('入力値が不正です', details)
}
