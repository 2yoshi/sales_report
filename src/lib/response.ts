import { NextResponse } from 'next/server'

/**
 * Wraps a single resource in the standard `{ data }` envelope.
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

/**
 * Wraps a list resource in the standard `{ data, meta }` pagination envelope.
 */
export function okList<T>(
  data: T[],
  meta: { total: number; page: number; per_page: number },
): NextResponse {
  return NextResponse.json({ data, meta })
}

/**
 * Returns a 201 Created response with the created resource wrapped in `{ data }`.
 */
export function created<T>(data: T): NextResponse {
  return ok(data, 201)
}

/**
 * Returns a 204 No Content response.
 * Use for DELETE operations that return no body.
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Parses and clamps pagination query parameters.
 *
 * @param searchParams - URL search params from `req.nextUrl.searchParams`
 * @returns Validated `{ page, perPage, skip }` ready for Prisma
 */
export function parsePagination(searchParams: URLSearchParams): {
  page: number
  perPage: number
  skip: number
} {
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10)
  const rawPerPage = parseInt(searchParams.get('per_page') ?? '20', 10)

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage >= 1 ? Math.min(rawPerPage, 100) : 20

  return { page, perPage, skip: (page - 1) * perPage }
}
