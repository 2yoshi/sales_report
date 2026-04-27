import { withAuth } from '@/lib/auth/guard'
import { logoutUser } from '@/lib/auth/logout.service'
import { ok } from '@/lib/response'

export const POST = withAuth(async (_req, _context, _user, token) => {
  const result = await logoutUser(token)
  return ok(result)
})
