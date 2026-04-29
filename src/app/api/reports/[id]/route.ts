import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { getReport } from '@/lib/reports/reports.service'
import { handleError } from '@/lib/errors'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleGetReport(
  _req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = await (context.params as Promise<{ id: string }>)
    const reportId = params.id

    if (!UUID_REGEX.test(reportId)) {
      throw AppError.notFound('日報')
    }

    const data = await getReport(user, reportId)
    return NextResponse.json({ data })
  } catch (err) {
    return handleError(err)
  }
}

export const GET = withAuth(handleGetReport)
