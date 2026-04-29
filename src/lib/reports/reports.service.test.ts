import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listReports, getReport, createReport, updateReport } from './reports.service'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import { Prisma } from '@prisma/client'
import type { AuthUser } from '@/types'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    dailyReport: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    visitRecord: {
      deleteMany: vi.fn(),
    },
  },
}))

const mockCount = vi.mocked(prisma.dailyReport.count)
const mockFindMany = vi.mocked(prisma.dailyReport.findMany)
const mockFindUnique = vi.mocked(prisma.dailyReport.findUnique)
const mockCreate = vi.mocked(prisma.dailyReport.create)
const mockUpdate = vi.mocked(prisma.dailyReport.update)
const mockDeleteMany = vi.mocked(prisma.visitRecord.deleteMany)
const mockTransaction = vi.mocked(prisma.$transaction)

// ─── Test users ───────────────────────────────────────────────────────────────

const salesUser: AuthUser = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

const salesUser2: AuthUser = {
  id: '22222222-2222-2222-2222-222222222222',
  name: '鈴木 一郎',
  email: 'suzuki@test.com',
  role: 'sales',
}

const managerUser: AuthUser = {
  id: '33333333-3333-3333-3333-333333333333',
  name: '田中 部長',
  email: 'tanaka@test.com',
  role: 'manager',
}

const adminUser: AuthUser = {
  id: '44444444-4444-4444-4444-444444444444',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

// ─── Sample Prisma records ────────────────────────────────────────────────────

function makePrismaReport(overrides: Partial<{
  id: string
  userId: string
  reportDate: Date
  userName: string
}> = {}) {
  const userId = overrides.userId ?? salesUser.id
  return {
    id: overrides.id ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId,
    reportDate: overrides.reportDate ?? new Date('2026-04-18'),
    problem: '課題テキスト',
    plan: '翌日予定テキスト',
    createdAt: new Date('2026-04-18T09:00:00.000Z'),
    updatedAt: new Date('2026-04-18T09:00:00.000Z'),
    user: {
      id: userId,
      name: overrides.userName ?? salesUser.name,
    },
    visitRecords: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        content: '商談内容',
        sortOrder: 1,
        customer: {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: '佐藤 健',
          company: '株式会社A',
        },
      },
    ],
    _count: { comments: 0 },
  }
}

const defaultQuery = { page: 1, per_page: 20 } as const

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Role-based scoping ────────────────────────────────────────────────────

  describe('ロールによるスコープ制御', () => {
    it('salesロールは常に自分のuserId でフィルタされる', async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([makePrismaReport()])

      await listReports(salesUser, defaultQuery)

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: salesUser.id }) }),
      )
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: salesUser.id }) }),
      )
    })

    it('salesロールにuser_idクエリを渡してもスコープは本人IDに固定される', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(salesUser, { ...defaultQuery, user_id: salesUser2.id })

      // user_id クエリは無視され、where.userId は本人IDになる
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: salesUser.id } }),
      )
    })

    it('managerロールはuser_idフィルタなしで全件取得できる（userIdフィルタなし）', async () => {
      mockCount.mockResolvedValueOnce(2)
      mockFindMany.mockResolvedValueOnce([
        makePrismaReport(),
        makePrismaReport({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', userId: salesUser2.id }),
      ])

      await listReports(managerUser, defaultQuery)

      // userId フィルタが付かないこと
      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })

    it('managerロールにuser_idを指定するとそのIDでフィルタされる', async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([makePrismaReport()])

      await listReports(managerUser, { ...defaultQuery, user_id: salesUser.id })

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: salesUser.id }) }),
      )
    })

    it('adminロールはuser_idフィルタなしで全件取得できる', async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([makePrismaReport()])

      await listReports(adminUser, defaultQuery)

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })
  })

  // ── Date range filters ────────────────────────────────────────────────────

  describe('日付フィルタ', () => {
    it('date_fromを指定するとreportDate.gteに設定される', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(managerUser, { ...defaultQuery, date_from: '2026-04-01' })

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportDate: expect.objectContaining({ gte: new Date('2026-04-01') }),
          }),
        }),
      )
    })

    it('date_toを指定するとreportDate.lteに設定される', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(managerUser, { ...defaultQuery, date_to: '2026-04-18' })

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportDate: expect.objectContaining({ lte: new Date('2026-04-18') }),
          }),
        }),
      )
    })

    it('date_fromとdate_toを両方指定するとgte/lteが両方設定される', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(managerUser, {
        ...defaultQuery,
        date_from: '2026-04-01',
        date_to: '2026-04-30',
      })

      expect(mockCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reportDate: {
              gte: new Date('2026-04-01'),
              lte: new Date('2026-04-30'),
            },
          }),
        }),
      )
    })

    it('日付フィルタなしの場合はreportDateフィルタが設定されない', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(salesUser, defaultQuery)

      // where に reportDate が含まれないこと
      const calledArgs = mockCount.mock.calls[0]?.[0]
      const calledWhere = (calledArgs?.where ?? {}) as Record<string, unknown>
      expect(calledWhere).not.toHaveProperty('reportDate')
    })
  })

  // ── Pagination ────────────────────────────────────────────────────────────

  describe('ページネーション', () => {
    it('page=2, per_page=10のとき skip=10, take=10 でfindManyが呼ばれる', async () => {
      mockCount.mockResolvedValueOnce(25)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(managerUser, { page: 2, per_page: 10 })

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      )
    })

    it('page=1, per_page=20（デフォルト）のとき skip=0, take=20 でfindManyが呼ばれる', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(salesUser, defaultQuery)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      )
    })

    it('レスポンスのmetaにtotal・page・per_pageが反映される', async () => {
      mockCount.mockResolvedValueOnce(45)
      mockFindMany.mockResolvedValueOnce([])

      const result = await listReports(managerUser, { page: 3, per_page: 10 })

      expect(result.meta).toEqual({ total: 45, page: 3, per_page: 10 })
    })
  })

  // ── Response shape ────────────────────────────────────────────────────────

  describe('レスポンス形式', () => {
    it('report_dateがYYYY-MM-DD形式の文字列に変換される', async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([makePrismaReport({ reportDate: new Date('2026-04-18') })])

      const result = await listReports(salesUser, defaultQuery)

      expect(result.data[0].report_date).toBe('2026-04-18')
    })

    it('visit_recordsにcustomer情報とsort_orderが含まれる', async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([makePrismaReport()])

      const result = await listReports(salesUser, defaultQuery)

      const vr = result.data[0].visit_records[0]
      expect(vr.customer.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
      expect(vr.customer.name).toBe('佐藤 健')
      expect(vr.customer.company).toBe('株式会社A')
      expect(vr.content).toBe('商談内容')
      expect(vr.sort_order).toBe(1)
    })

    it('comments_countが_count.commentsから正しくマッピングされる', async () => {
      const reportWithComments = makePrismaReport()
      reportWithComments._count.comments = 3

      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([reportWithComments])

      const result = await listReports(managerUser, defaultQuery)

      expect(result.data[0].comments_count).toBe(3)
    })

    it('created_atとupdated_atがISO 8601文字列に変換される', async () => {
      mockCount.mockResolvedValueOnce(1)
      mockFindMany.mockResolvedValueOnce([makePrismaReport()])

      const result = await listReports(salesUser, defaultQuery)

      expect(result.data[0].created_at).toBe('2026-04-18T09:00:00.000Z')
      expect(result.data[0].updated_at).toBe('2026-04-18T09:00:00.000Z')
    })

    it('件数が0件の場合はdataが空配列でtotal=0が返る', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      const result = await listReports(salesUser, defaultQuery)

      expect(result.data).toEqual([])
      expect(result.meta.total).toBe(0)
    })

    it('findManyはreportDateの降順で呼ばれる', async () => {
      mockCount.mockResolvedValueOnce(0)
      mockFindMany.mockResolvedValueOnce([])

      await listReports(managerUser, defaultQuery)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { reportDate: 'desc' } }),
      )
    })
  })
})

// ─── createReport ─────────────────────────────────────────────────────────────

const createInput = {
  report_date: '2026-04-18',
  problem: '課題テキスト',
  plan: '明日やること',
  visit_records: [
    {
      customer_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      content: '商談内容',
      sort_order: 1,
    },
  ],
}

function makePrismaCreatedReport() {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: salesUser.id,
    reportDate: new Date('2026-04-18'),
    problem: '課題テキスト',
    plan: '明日やること',
    createdAt: new Date('2026-04-18T09:00:00.000Z'),
    updatedAt: new Date('2026-04-18T09:00:00.000Z'),
    user: { id: salesUser.id, name: salesUser.name },
    visitRecords: [
      {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        content: '商談内容',
        sortOrder: 1,
        customer: {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: '佐藤 健',
          company: '株式会社A',
        },
      },
    ],
    _count: { comments: 0 },
  }
}

describe('createReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('正常系', () => {
    it('重複がない場合はDailyReportとVisitRecordsを作成し結果を返す', async () => {
      const prismaReport = makePrismaCreatedReport()
      mockFindUnique.mockResolvedValueOnce(null)
      mockCreate.mockResolvedValueOnce(prismaReport as never)

      const result = await createReport(salesUser, createInput)

      expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      expect(result.report_date).toBe('2026-04-18')
      expect(result.problem).toBe('課題テキスト')
      expect(result.plan).toBe('明日やること')
      expect(result.user.id).toBe(salesUser.id)
      expect(result.visit_records).toHaveLength(1)
      expect(result.comments_count).toBe(0)
    })

    it('findUniqueはuserId + reportDateの複合ユニークキーで呼ばれる', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      mockCreate.mockResolvedValueOnce(makePrismaCreatedReport() as never)

      await createReport(salesUser, createInput)

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: {
          userId_reportDate: {
            userId: salesUser.id,
            reportDate: new Date('2026-04-18'),
          },
        },
      })
    })

    it('createにvisitRecords.createで正しくマッピングされたデータが渡される', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      mockCreate.mockResolvedValueOnce(makePrismaCreatedReport() as never)

      await createReport(salesUser, createInput)

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: salesUser.id,
            reportDate: new Date('2026-04-18'),
            visitRecords: {
              create: [
                {
                  customerId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
                  content: '商談内容',
                  sortOrder: 1,
                },
              ],
            },
          }),
        }),
      )
    })

    it('レスポンスのvisit_recordsにcustomer情報・content・sort_orderが含まれる', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      mockCreate.mockResolvedValueOnce(makePrismaCreatedReport() as never)

      const result = await createReport(salesUser, createInput)

      const vr = result.visit_records[0]
      expect(vr.id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
      expect(vr.customer.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
      expect(vr.customer.name).toBe('佐藤 健')
      expect(vr.customer.company).toBe('株式会社A')
      expect(vr.content).toBe('商談内容')
      expect(vr.sort_order).toBe(1)
    })

    it('created_atとupdated_atがISO 8601文字列に変換される', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      mockCreate.mockResolvedValueOnce(makePrismaCreatedReport() as never)

      const result = await createReport(salesUser, createInput)

      expect(result.created_at).toBe('2026-04-18T09:00:00.000Z')
      expect(result.updated_at).toBe('2026-04-18T09:00:00.000Z')
    })
  })

  // ── Duplicate check ───────────────────────────────────────────────────────

  describe('重複チェック', () => {
    it('findUniqueで重複が見つかった場合はDUPLICATE_REPORTをスローする', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaCreatedReport() as never)

      await expect(createReport(salesUser, createInput)).rejects.toMatchObject({
        code: 'DUPLICATE_REPORT',
      })
    })

    it('findUniqueで重複が見つかった場合はcreateが呼ばれない', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaCreatedReport() as never)

      await expect(createReport(salesUser, createInput)).rejects.toBeInstanceOf(AppError)

      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('P2002（DB unique制約違反）が発生した場合もDUPLICATE_REPORTをスローする（競合状態対応）', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`user_id`,`report_date`)',
        { code: 'P2002', clientVersion: '5.0.0' },
      )
      mockCreate.mockRejectedValueOnce(p2002)

      await expect(createReport(salesUser, createInput)).rejects.toMatchObject({
        code: 'DUPLICATE_REPORT',
      })
    })

    it('P2002以外のPrismaエラーはそのまま再スローされる', async () => {
      mockFindUnique.mockResolvedValueOnce(null)
      const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      })
      mockCreate.mockRejectedValueOnce(p2025)

      await expect(createReport(salesUser, createInput)).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      )
    })
  })
})

// ─── getReport tests ──────────────────────────────────────────────────────────

function makePrismaReportDetail(overrides: Partial<{
  id: string
  userId: string
  reportDate: Date
}> = {}) {
  const userId = overrides.userId ?? salesUser.id
  return {
    id: overrides.id ?? 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId,
    reportDate: overrides.reportDate ?? new Date('2026-04-19'),
    problem: '課題テキスト',
    plan: '翌日予定テキスト',
    createdAt: new Date('2026-04-19T09:00:00.000Z'),
    updatedAt: new Date('2026-04-19T09:00:00.000Z'),
    user: {
      id: userId,
      name: salesUser.name,
      role: 'sales' as const,
    },
    visitRecords: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        content: '商談内容',
        sortOrder: 1,
        customer: {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: '佐藤 健',
          company: '株式会社A',
        },
      },
    ],
    comments: [
      {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        body: 'コメント本文',
        createdAt: new Date('2026-04-19T18:32:00.000Z'),
        commenter: {
          id: managerUser.id,
          name: managerUser.name,
        },
      },
    ],
  }
}

describe('getReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Not found ─────────────────────────────────────────────────────────────

  describe('存在しないID', () => {
    it('存在しないIDに対してAppError(NOT_FOUND)をスローする', async () => {
      mockFindUnique.mockResolvedValue(null)

      await expect(
        getReport(salesUser, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
      ).rejects.toThrow(AppError)

      await expect(
        getReport(salesUser, 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  // ── Role-based access control ─────────────────────────────────────────────

  describe('アクセス制御', () => {
    it('salesユーザーは自分の日報を取得できる', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail({ userId: salesUser.id }))

      const result = await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      expect(result.user.id).toBe(salesUser.id)
    })

    it('salesユーザーが他人の日報を取得しようとするとAppError(FORBIDDEN)をスローする', async () => {
      // Report belongs to salesUser2, but salesUser is the requester
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail({ userId: salesUser2.id }))

      await expect(
        getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('managerは他のユーザーの日報を取得できる', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail({ userId: salesUser.id }))

      const result = await getReport(managerUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    })

    it('adminは他のユーザーの日報を取得できる', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail({ userId: salesUser.id }))

      const result = await getReport(adminUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    })
  })

  // ── Response shape ────────────────────────────────────────────────────────

  describe('レスポンス形式', () => {
    it('report_dateがYYYY-MM-DD形式の文字列に変換される', async () => {
      mockFindUnique.mockResolvedValueOnce(
        makePrismaReportDetail({ reportDate: new Date('2026-04-19') }),
      )

      const result = await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(result.report_date).toBe('2026-04-19')
    })

    it('userフィールドにid・name・roleが含まれる', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail())

      const result = await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(result.user.id).toBe(salesUser.id)
      expect(result.user.name).toBe(salesUser.name)
      expect(result.user.role).toBe('sales')
    })

    it('visit_recordsにcustomer情報・content・sort_orderが含まれる', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail())

      const result = await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      const vr = result.visit_records[0]
      expect(vr.id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
      expect(vr.customer.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc')
      expect(vr.customer.name).toBe('佐藤 健')
      expect(vr.customer.company).toBe('株式会社A')
      expect(vr.content).toBe('商談内容')
      expect(vr.sort_order).toBe(1)
    })

    it('commentsにid・body・commenter・created_atが含まれる', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail())

      const result = await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      const comment = result.comments[0]
      expect(comment.id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
      expect(comment.body).toBe('コメント本文')
      expect(comment.commenter.id).toBe(managerUser.id)
      expect(comment.commenter.name).toBe(managerUser.name)
      expect(comment.created_at).toBe('2026-04-19T18:32:00.000Z')
    })

    it('created_atとupdated_atがISO 8601文字列に変換される', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail())

      const result = await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(result.created_at).toBe('2026-04-19T09:00:00.000Z')
      expect(result.updated_at).toBe('2026-04-19T09:00:00.000Z')
    })

    it('visit_recordsをsortOrder昇順で取得するクエリが発行される', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail())

      await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            visitRecords: expect.objectContaining({
              orderBy: { sortOrder: 'asc' },
            }),
          }),
        }),
      )
    })

    it('commentsをcreatedAt昇順で取得するクエリが発行される', async () => {
      mockFindUnique.mockResolvedValueOnce(makePrismaReportDetail())

      await getReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

      expect(mockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            comments: expect.objectContaining({
              orderBy: { createdAt: 'asc' },
            }),
          }),
        }),
      )
    })
  })
})

// ─── updateReport ─────────────────────────────────────────────────────────────

const updateInput = {
  problem: '更新後課題',
  plan: '更新後予定',
  visit_records: [
    {
      customer_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      content: '更新後訪問内容',
      sort_order: 1,
    },
  ],
}

function makePrismaUpdatedReport() {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: salesUser.id,
    reportDate: new Date('2026-04-19'),
    problem: '更新後課題',
    plan: '更新後予定',
    createdAt: new Date('2026-04-19T09:00:00.000Z'),
    updatedAt: new Date('2026-04-19T12:00:00.000Z'),
    user: { id: salesUser.id, name: salesUser.name, role: 'sales' as const },
    visitRecords: [
      {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        content: '更新後訪問内容',
        sortOrder: 1,
        customer: {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          name: '佐藤 健',
          company: '株式会社A',
        },
      },
    ],
    comments: [],
  }
}

describe('updateReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  describe('正常系', () => {
    it('作成者が更新するとトランザクション内でdeleteMany+updateが実行されReportDetailを返す', async () => {
      mockFindUnique.mockResolvedValueOnce({ userId: salesUser.id } as never)
      mockTransaction.mockImplementation(async (fn) => fn(prisma))
      mockDeleteMany.mockResolvedValueOnce({ count: 1 })
      mockUpdate.mockResolvedValueOnce(makePrismaUpdatedReport() as never)

      const result = await updateReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', updateInput)

      expect(mockTransaction).toHaveBeenCalledOnce()
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { dailyReportId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      })
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
          data: expect.objectContaining({
            problem: '更新後課題',
            plan: '更新後予定',
          }),
        }),
      )
      expect(result.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      expect(result.problem).toBe('更新後課題')
      expect(result.plan).toBe('更新後予定')
      expect(result.visit_records).toHaveLength(1)
      expect(result.visit_records[0].content).toBe('更新後訪問内容')
    })

    it('レスポンスにuser.roleが含まれる', async () => {
      mockFindUnique.mockResolvedValueOnce({ userId: salesUser.id } as never)
      mockTransaction.mockImplementation(async (fn) => fn(prisma))
      mockDeleteMany.mockResolvedValueOnce({ count: 1 })
      mockUpdate.mockResolvedValueOnce(makePrismaUpdatedReport() as never)

      const result = await updateReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', updateInput)

      expect(result.user.role).toBe('sales')
    })

    it('updated_atがISO 8601文字列に変換される', async () => {
      mockFindUnique.mockResolvedValueOnce({ userId: salesUser.id } as never)
      mockTransaction.mockImplementation(async (fn) => fn(prisma))
      mockDeleteMany.mockResolvedValueOnce({ count: 1 })
      mockUpdate.mockResolvedValueOnce(makePrismaUpdatedReport() as never)

      const result = await updateReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', updateInput)

      expect(result.updated_at).toBe('2026-04-19T12:00:00.000Z')
    })
  })

  // ── Not found ─────────────────────────────────────────────────────────────

  describe('存在しないID', () => {
    it('findUniqueがnullを返す場合はNOT_FOUNDをスローする', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      await expect(
        updateReport(salesUser, 'ffffffff-ffff-ffff-ffff-ffffffffffff', updateInput),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })

      expect(mockTransaction).not.toHaveBeenCalled()
    })
  })

  // ── Forbidden ─────────────────────────────────────────────────────────────

  describe('権限チェック', () => {
    it('作成者以外がリクエストするとFORBIDDENをスローする', async () => {
      // Report belongs to salesUser2, but salesUser is the requester
      mockFindUnique.mockResolvedValueOnce({ userId: salesUser2.id } as never)

      await expect(
        updateReport(salesUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', updateInput),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })

      expect(mockTransaction).not.toHaveBeenCalled()
    })

    it('managerロールが他人の日報を更新しようとするとFORBIDDENをスローする', async () => {
      mockFindUnique.mockResolvedValueOnce({ userId: salesUser.id } as never)

      await expect(
        updateReport(managerUser, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', updateInput),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })

      expect(mockTransaction).not.toHaveBeenCalled()
    })
  })
})
