import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser, UserRole } from '@/types'
import type { CreateCommentInput } from '@/lib/schemas/comment.schema'

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

export async function createComment(
  user: AuthUser,
  reportId: string,
  input: CreateCommentInput,
): Promise<CommentItem> {
  // Verify the report exists
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    select: { userId: true },
  })

  if (!report) {
    throw AppError.notFound('日報')
  }

  let comment
  try {
    comment = await prisma.comment.create({
      data: {
        dailyReportId: reportId,
        commenterId: user.id,
        body: input.body,
      },
      include: {
        commenter: {
          select: { id: true, name: true, role: true },
        },
      },
    })
  } catch (err) {
    // Race condition: report was deleted between our check and the insert
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw AppError.notFound('日報')
    }
    throw err
  }

  return {
    id: comment.id,
    body: comment.body,
    commenter: {
      id: comment.commenter.id,
      name: comment.commenter.name,
      role: comment.commenter.role,
    },
    created_at: comment.createdAt.toISOString(),
    updated_at: comment.updatedAt.toISOString(),
  }
}
