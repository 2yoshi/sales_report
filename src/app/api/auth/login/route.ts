import { NextRequest } from 'next/server'
import { loginSchema } from '@/lib/schemas/auth.schema'
import { loginUser } from '@/lib/auth/login.service'
import { ok } from '@/lib/response'
import { handleError } from '@/lib/errors'
import { AppError } from '@/lib/errors/AppError'

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return handleError(AppError.validationError('リクエストボディが不正なJSON形式です'))
    }
    const input = loginSchema.parse(body)
    const result = await loginUser(input)
    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}
