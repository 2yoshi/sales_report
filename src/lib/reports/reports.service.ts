import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { ListReportsQuery, CreateReportInput } from '@/lib/schemas/report.schema'

export interface ReportListItem {
  id: string
  report_date: string
  problem: string
  plan: string
  user: {
    id: string
    name: string
  }
  visit_records: {
    id: string
    customer: {
      id: string
      name: string
      company: string | null
    }
    content: string
    sort_order: number
  }[]
  comments_count: number
  created_at: string
  updated_at: string
}

// ReportDetail is the same shape as ReportListItem — reused for single-resource responses
export type ReportDetail = ReportListItem

export interface ListReportsResult {
  data: ReportListItem[]
  meta: {
    total: number
    page: number
    per_page: number
  }
}

export async function listReports(
  user: AuthUser,
  query: ListReportsQuery,
): Promise<ListReportsResult> {
  const { page, per_page, user_id, date_from, date_to } = query
  const skip = (page - 1) * per_page

  // Build the WHERE clause based on role
  const where: {
    userId?: string
    reportDate?: { gte?: Date; lte?: Date }
  } = {}

  // sales role: always scoped to own reports; user_id filter is ignored
  if (user.role === 'sales') {
    where.userId = user.id
  } else if (user_id) {
    // manager/admin: user_id filter is effective
    where.userId = user_id
  }

  // Date range filters
  if (date_from || date_to) {
    where.reportDate = {}
    if (date_from) {
      where.reportDate.gte = new Date(date_from)
    }
    if (date_to) {
      // reportDate is @db.Date (date-only), so lte comparison works at date level
      where.reportDate.lte = new Date(date_to)
    }
  }

  const [total, reports] = await Promise.all([
    prisma.dailyReport.count({ where }),
    prisma.dailyReport.findMany({
      where,
      skip,
      take: per_page,
      orderBy: { reportDate: 'desc' },
      include: {
        user: {
          select: { id: true, name: true },
        },
        visitRecords: {
          orderBy: { sortOrder: 'asc' },
          include: {
            customer: {
              select: { id: true, name: true, company: true },
            },
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    }),
  ])

  const data: ReportListItem[] = reports.map((report) => ({
    id: report.id,
    report_date: report.reportDate.toISOString().slice(0, 10),
    problem: report.problem,
    plan: report.plan,
    user: {
      id: report.user.id,
      name: report.user.name,
    },
    visit_records: report.visitRecords.map((vr) => ({
      id: vr.id,
      customer: {
        id: vr.customer.id,
        name: vr.customer.name,
        company: vr.customer.company,
      },
      content: vr.content,
      sort_order: vr.sortOrder,
    })),
    comments_count: report._count.comments,
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
  }))

  return {
    data,
    meta: { total, page, per_page },
  }
}

export async function createReport(
  user: AuthUser,
  input: CreateReportInput,
): Promise<ReportDetail> {
  const reportDate = new Date(input.report_date)

  // Check for duplicate: same user + same date
  const existing = await prisma.dailyReport.findUnique({
    where: {
      userId_reportDate: {
        userId: user.id,
        reportDate,
      },
    },
  })
  if (existing) {
    throw AppError.duplicateReport()
  }

  // Create report and all visit_records atomically
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.dailyReport.create({
      data: {
        userId: user.id,
        reportDate,
        problem: input.problem,
        plan: input.plan,
        visitRecords: {
          create: input.visit_records.map((vr) => ({
            customerId: vr.customer_id,
            content: vr.content,
            sortOrder: vr.sort_order,
          })),
        },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        visitRecords: {
          orderBy: { sortOrder: 'asc' },
          include: {
            customer: {
              select: { id: true, name: true, company: true },
            },
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    })
    return created
  })

  return {
    id: report.id,
    report_date: report.reportDate.toISOString().slice(0, 10),
    problem: report.problem,
    plan: report.plan,
    user: {
      id: report.user.id,
      name: report.user.name,
    },
    visit_records: report.visitRecords.map((vr) => ({
      id: vr.id,
      customer: {
        id: vr.customer.id,
        name: vr.customer.name,
        company: vr.customer.company,
      },
      content: vr.content,
      sort_order: vr.sortOrder,
    })),
    comments_count: report._count.comments,
    created_at: report.createdAt.toISOString(),
    updated_at: report.updatedAt.toISOString(),
  }
}
