import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { getReport, updateReport } from '@/lib/reports/reports.service'
import { handleError } from '@/lib/errors'
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw AppError.validationError('リクエストボディが不正なJSON形式です')
    }

    const input = updateReportSchema.parse(body)
    const data = await updateReport(user, reportId, input)
    return NextResponse.json({ data })
  } catch (err) {
    return handleError(err)
  }
}

export const PUT = withAuth(handlePutReport)
