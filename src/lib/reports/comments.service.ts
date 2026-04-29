import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

export interface CommentItem {
  id: string
  body: string
  commenter: {
    id: string
    name: string
    role: string
  }
  created_at: string
  updated_at: string
}

export async function listComments(user: AuthUser, reportId: string): Promise<CommentItem[]> {
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: { id: true, userId: true },
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
