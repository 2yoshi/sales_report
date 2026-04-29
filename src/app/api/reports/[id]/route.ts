import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { getReport, updateReport } from '@/lib/reports/reports.service'
import { handleError, formatZodError } from '@/lib/errors'
import { AppError } from '@/lib/errors/AppError'
import { updateReportSchema } from '@/lib/schemas/report.schema'
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

async function handlePutReport(
  req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = await (context.params as Promise<{ id: string }>)
    const reportId = params.id

    if (!UUID_REGEX.test(reportId)) {
      throw AppError.notFound('日報')
    }

    const body: unknown = await req.json()
    const parsed = updateReportSchema.safeParse(body)
    if (!parsed.success) {
      throw formatZodError(parsed.error)
    }

    const data = await updateReport(user, reportId, parsed.data)
    return NextResponse.json({ data })
  } catch (err) {
    return handleError(err)
  }
}

export const PUT = withAuth(handlePutReport)
