import { NextRequest, NextResponse } from 'next/server'
import { extractBearerAuth } from '@/lib/auth/guard'

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Skip authentication for the login endpoint.
  // API routes are mounted under /api/, so the login path is /api/auth/login.
  if (pathname.startsWith('/api/auth/login')) {
    return NextResponse.next()
  }

  const result = extractBearerAuth(request.headers.get('authorization'))
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: 401 },
    )
  }

  // Forward verified user info to route handlers via request headers.
  // Use NextResponse.next({ request }) so the modified headers are visible
  // to downstream route handlers, not just the HTTP response.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', result.user.id)
  requestHeaders.set('x-user-role', result.user.role)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: '/api/:path*',
}
