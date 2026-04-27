import { NextRequest, NextResponse } from 'next/server'
import type { AuthUser, UserRole } from '@/types'
import { verifyToken } from './jwt'
import { isBlacklisted } from './blacklist'
import { AppError } from '@/lib/errors/AppError'

export function requireRole(roles: UserRole[]): (user: AuthUser) => void {
  return (user: AuthUser) => {
    if (!roles.includes(user.role)) {
      throw AppError.forbidden()
    }
  }
}

type AuthExtractResult =
  | { ok: true; user: AuthUser; token: string }
  | { ok: false; code: 'UNAUTHORIZED'; message: string }

/**
 * Extracts and validates a Bearer token from an Authorization header value.
 * This function is Edge-compatible (no Prisma/Node.js-only APIs) and is shared
 * by the Next.js middleware and withAuth.
 *
 * NOTE: Blacklist checking requires Prisma and is intentionally omitted here.
 * It is performed inside withAuth, which runs in the Node.js runtime.
 */
export function extractBearerAuth(authHeader: string | null): AuthExtractResult {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Authentication required' }
  }
  const token = authHeader.slice(7)
  let user: AuthUser
  try {
    user = verifyToken(token)
  } catch {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
  }
  return { ok: true, user, token }
}

type AuthedRouteHandler = (
  req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
  token: string,
) => Promise<NextResponse>

type WrappedRouteHandler = (
  req: NextRequest,
  context: Record<string, unknown>,
) => Promise<NextResponse>

export function withAuth(handler: AuthedRouteHandler, roles?: UserRole[]): WrappedRouteHandler {
  return async (req, context) => {
    const result = extractBearerAuth(req.headers.get('authorization'))
    if (!result.ok) {
      return NextResponse.json(
        { error: { code: result.code, message: result.message } },
        { status: 401 },
      )
    }

    const { user, token } = result

    if (await isBlacklisted(token)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Token has been invalidated' } },
        { status: 401 },
      )
    }

    if (roles && roles.length > 0) {
      const checkRole = requireRole(roles)
      try {
        checkRole(user)
      } catch (err) {
        if (err instanceof AppError) {
          return NextResponse.json(
            { error: { code: err.code, message: err.message } },
            { status: err.statusCode },
          )
        }
        throw err
      }
    }

    return handler(req, context, user, token)
  }
}
