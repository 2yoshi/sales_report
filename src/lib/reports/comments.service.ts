import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser, UserRole } from '@/types'

export interface CommentItem {
  id: string
  body: string
  commenter: {
    id: string
    name: string
    role: UserRole
  }
  created_at: string
  updated_at: string
}

export async function listComments(user: AuthUser, reportId: string): Promise<CommentItem[]> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: { userId: true },
  })

  if (!report) {
    throw AppError.notFound('日報')
  }

  // sales role can only view comments on their own reports
  if (user.role === 'sales' && report.userId !== user.id) {
    throw AppError.forbidden()
  }

  const comments = await prisma.comment.findMany({
    where: { dailyReportId: reportId },
    orderBy: { createdAt: 'desc' },
    include: {
      commenter: {
        select: { id: true, name: true, role: true },
      },
    },
  })

  return comments.map((c) => ({
    id: c.id,
    body: c.body,
    commenter: {
      id: c.commenter.id,
      name: c.commenter.name,
      role: c.commenter.role,
    },
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  }))
}

export async function deleteComment(
  user: AuthUser,
  reportId: string,
  commentId: string,
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { commenterId: true, dailyReportId: true },
  })

  if (!comment || comment.dailyReportId !== reportId) {
    throw AppError.notFound('コメント')
  }

  // sales cannot delete any comment
  if (user.role === 'sales') {
    throw AppError.forbidden()
  }

  // admin can delete any comment; manager can only delete their own
  if (user.role !== 'admin' && comment.commenterId !== user.id) {
    throw AppError.forbidden()
  }

  try {
    await prisma.comment.delete({ where: { id: commentId } })
  } catch (err) {
    // Race condition: another request deleted the comment between our check and delete
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw AppError.notFound('コメント')
    }
    throw err
  }
}
