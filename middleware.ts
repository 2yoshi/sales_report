import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/jwt'
import { isBlacklisted } from '@/lib/auth/blacklist'

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Skip authentication for login endpoint
  if (pathname === '/auth/login' || pathname.startsWith('/auth/login')) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  const token = authHeader.slice(7)

  try {
    verifyToken(token)
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

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
