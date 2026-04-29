import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { getReport } from '@/lib/reports/reports.service'
import { handleError } from '@/lib/errors'
import type { AuthUser } from '@/types'

async function handleGetReport(
  _req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = context.params as { id: string }
    const reportId = params.id

    const data = await getReport(user, reportId)
    return NextResponse.json({ data })
  } catch (err) {
    return handleError(err)
  }
}

export const GET = withAuth(handleGetReport)
