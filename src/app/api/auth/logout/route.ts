import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { logoutUser } from '@/lib/auth/logout.service'
import { ok } from '@/lib/response'
import { handleError } from '@/lib/errors'

export const POST = withAuth(async (req: NextRequest) => {
  try {
    const authHeader = req.headers.get('authorization')
    // withAuth guarantees the header is present and valid, so this is safe.
    const token = authHeader!.slice(7)
    const result = logoutUser(token)
    return ok(result)
  } catch (err) {
    return handleError(err)
  }
})
