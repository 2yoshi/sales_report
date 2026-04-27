import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { listReportsQuerySchema } from '@/lib/schemas/report.schema'
import { listReports } from '@/lib/reports/reports.service'
import { handleError } from '@/lib/errors'
import type { AuthUser } from '@/types'

async function handleGetReports(
  req: NextRequest,
  _context: Record<string, unknown>,
  user: AuthUser,
): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams

    // Build raw query object from search params for Zod parsing
    const rawQuery: Record<string, string | undefined> = {
      user_id: searchParams.get('user_id') ?? undefined,
      date_from: searchParams.get('date_from') ?? undefined,
      date_to: searchParams.get('date_to') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      per_page: searchParams.get('per_page') ?? undefined,
    }

    // Remove undefined keys so Zod optional() works correctly
    Object.keys(rawQuery).forEach((key) => {
      if (rawQuery[key] === undefined) {
        delete rawQuery[key]
      }
    })

    const query = listReportsQuerySchema.parse(rawQuery)
    const result = await listReports(user, query)

    return NextResponse.json(result)
  } catch (err) {
    return handleError(err)
  }
}

export const GET = withAuth(handleGetReports)
