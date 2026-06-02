import { generateToken } from '@/lib/auth/jwt'
import type { AuthUser } from '@/types'

/** Generate a JWT token for the given user fixture. */
export function makeToken(user: AuthUser): string {
  return generateToken(user)
}

/** Return an Authorization header object for the given user. */
export function bearerHeader(user: AuthUser): { Authorization: string } {
  return { Authorization: `Bearer ${makeToken(user)}` }
}
