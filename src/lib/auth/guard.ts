import { NextRequest, NextResponse } from 'next/server'
import type { AuthUser, UserRole } from '@/types'
import { verifyToken } from './jwt'
import { isBlacklisted } from './blacklist'

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function requireRole(roles: UserRole[]): (user: AuthUser) => void {
  return (user: AuthUser) => {
    if (!roles.includes(user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'Insufficient permissions')
    }
  }
}

type AuthExtractResult =
  | { ok: true; user: AuthUser; token: string }
  | { ok: false; code: 'UNAUTHORIZED'; message: string }

/**
 * Extracts and validates a Bearer token from an Authorization header value.
 * Shared by middleware and withAuth to avoid duplicating auth logic.
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
  if (isBlacklisted(token)) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Token has been invalidated' }
  }
  return { ok: true, user, token }
}

type AuthedRouteHandler = (
  req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
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

    const { user } = result

    if (roles && roles.length > 0) {
      const checkRole = requireRole(roles)
      try {
        checkRole(user)
      } catch (err) {
        if (err instanceof ApiError) {
          return NextResponse.json(
            { error: { code: err.code, message: err.message } },
            { status: err.statusCode },
          )
        }
        throw err
      }
    }

    return handler(req, context, user)
  }
}
