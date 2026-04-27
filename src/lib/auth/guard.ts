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

type RouteHandler = (
  req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
) => Promise<NextResponse>

type UnauthRouteHandler = (
  req: NextRequest,
  context: Record<string, unknown>,
) => Promise<NextResponse>

export function withAuth(handler: RouteHandler, roles?: UserRole[]): UnauthRouteHandler {
  return async (req, context) => {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    const token = authHeader.slice(7)

    let user: AuthUser
    try {
      user = verifyToken(token)
    } catch {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 },
      )
    }

    if (isBlacklisted(token)) {
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
