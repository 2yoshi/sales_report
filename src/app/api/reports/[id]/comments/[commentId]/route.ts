import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { deleteComment } from '@/lib/reports/comments.service'
import { handleError } from '@/lib/errors'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleDeleteComment(
  _req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = await (context.params as Promise<{ id: string; commentId: string }>)
    const reportId = params.id
    const commentId = params.commentId

    if (!UUID_REGEX.test(reportId)) {
      throw AppError.notFound('日報')
    }

    if (!UUID_REGEX.test(commentId)) {
      throw AppError.notFound('コメント')
    }

    await deleteComment(user, reportId, commentId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}

export const DELETE = withAuth(handleDeleteComment)
