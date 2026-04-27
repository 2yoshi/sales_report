import { NextRequest } from 'next/server'
import { loginSchema } from '@/lib/schemas/auth.schema'
import { loginUser } from '@/lib/auth/login.service'
import { ok } from '@/lib/response'
import { handleError } from '@/lib/errors'

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const input = loginSchema.parse(body)
    const result = await loginUser(input)
    return ok(result)
  } catch (err) {
    return handleError(err)
  }
}
