import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listComments } from './comments.service'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dailyReport: {
      findUnique: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
    },
  },
}))

const mockFindUniqueReport = vi.mocked(prisma.dailyReport.findUnique)
const mockFindManyComments = vi.mocked(prisma.comment.findMany)

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

// ─── Sample data ──────────────────────────────────────────────────────────────

const REPORT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const sampleReport = {
  id: REPORT_ID,
  userId: salesUser.id,
}

function makePrismaComment(overrides: Partial<{
  id: string
  body: string
  createdAt: Date
  updatedAt: Date
  commenter: { id: string; name: string; role: string }
}> = {}) {
  return {
    id: overrides.id ?? 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    dailyReportId: REPORT_ID,
    commenterId: managerUser.id,
    body: overrides.body ?? 'コメント本文',
    createdAt: overrides.createdAt ?? new Date('2026-04-19T18:32:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-04-19T18:32:00.000Z'),
    commenter: overrides.commenter ?? {
      id: managerUser.id,
      name: managerUser.name,
      role: 'manager',
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('listComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── API-031: happy path ─────────────────────────────────────────────────────

  describe('API-031: コメント一覧を取得できる', () => {
    it('managerが日報のコメント一覧を取得できる', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      const comment = makePrismaComment()
      mockFindManyComments.mockResolvedValueOnce([comment] as never)

      const result = await listComments(managerUser, REPORT_ID)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
      expect(result[0].body).toBe('コメント本文')
      expect(result[0].commenter.id).toBe(managerUser.id)
      expect(result[0].commenter.name).toBe(managerUser.name)
      expect(result[0].commenter.role).toBe('manager')
      expect(result[0].created_at).toBe('2026-04-19T18:32:00.000Z')
      expect(result[0].updated_at).toBe('2026-04-19T18:32:00.000Z')
    })

    it('salesユーザーが自分の日報のコメント一覧を取得できる', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      const comment = makePrismaComment()
      mockFindManyComments.mockResolvedValueOnce([comment] as never)

      const result = await listComments(salesUser, REPORT_ID)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')
    })

    it('adminが任意の日報のコメント一覧を取得できる', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      const comment = makePrismaComment()
      mockFindManyComments.mockResolvedValueOnce([comment] as never)

      const result = await listComments(adminUser, REPORT_ID)

      expect(result).toHaveLength(1)
    })

    it('コメントが0件の場合は空配列を返す', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      mockFindManyComments.mockResolvedValueOnce([] as never)

      const result = await listComments(managerUser, REPORT_ID)

      expect(result).toHaveLength(0)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // ── UI-022: 投稿日時の新しい順（DESC）でソート ──────────────────────────────

  describe('UI-022: コメントが投稿日時の新しい順（DESC）に返される', () => {
    it('findManyにcreatedAt: descのorderByが渡される', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      mockFindManyComments.mockResolvedValueOnce([] as never)

      await listComments(managerUser, REPORT_ID)

      expect(mockFindManyComments).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      )
    })

    it('新しい順に並んだコメントをそのまま返す', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      const newerComment = makePrismaComment({
        id: 'comment-newer',
        createdAt: new Date('2026-04-19T20:00:00.000Z'),
        updatedAt: new Date('2026-04-19T20:00:00.000Z'),
      })
      const olderComment = makePrismaComment({
        id: 'comment-older',
        createdAt: new Date('2026-04-19T10:00:00.000Z'),
        updatedAt: new Date('2026-04-19T10:00:00.000Z'),
      })
      // Prismaは既にDESCでソートされた結果を返す想定
      mockFindManyComments.mockResolvedValueOnce([newerComment, olderComment] as never)

      const result = await listComments(managerUser, REPORT_ID)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('comment-newer')
      expect(result[1].id).toBe('comment-older')
    })
  })

  // ── 日報が存在しない場合 → NOT_FOUND ───────────────────────────────────────

  describe('NOT_FOUND: 存在しない日報IDを指定すると404エラーをスローする', () => {
    it('日報が見つからない場合はAppError.notFoundをスローする', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(null as never)

      await expect(listComments(managerUser, REPORT_ID)).rejects.toThrow(AppError)

      try {
        await listComments(managerUser, REPORT_ID)
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        const appError = err as AppError
        expect(appError.code).toBe('NOT_FOUND')
        expect(appError.statusCode).toBe(404)
      }
    })

    it('日報が見つからない場合はfindManyが呼ばれない', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(null as never)

      await expect(listComments(managerUser, REPORT_ID)).rejects.toThrow(AppError)
      expect(mockFindManyComments).not.toHaveBeenCalled()
    })
  })

  // ── salesが他人の日報のコメントを取得 → FORBIDDEN ─────────────────────────

  describe('FORBIDDEN: salesユーザーが他人の日報のコメントを取得しようとすると403エラーをスローする', () => {
    it('他人の日報に対してAppError.forbiddenをスローする', async () => {
      // salesUser2が所有する日報（userId !== salesUser.id）
      const otherUsersReport = {
        id: REPORT_ID,
        userId: salesUser2.id,
      }
      mockFindUniqueReport.mockResolvedValueOnce(otherUsersReport as never)

      await expect(listComments(salesUser, REPORT_ID)).rejects.toThrow(AppError)

      mockFindUniqueReport.mockResolvedValueOnce(otherUsersReport as never)
      try {
        await listComments(salesUser, REPORT_ID)
      } catch (err) {
        expect(err).toBeInstanceOf(AppError)
        const appError = err as AppError
        expect(appError.code).toBe('FORBIDDEN')
        expect(appError.statusCode).toBe(403)
      }
    })

    it('salesユーザーが他人の日報を指定した場合はfindManyが呼ばれない', async () => {
      const otherUsersReport = {
        id: REPORT_ID,
        userId: salesUser2.id,
      }
      mockFindUniqueReport.mockResolvedValueOnce(otherUsersReport as never)

      await expect(listComments(salesUser, REPORT_ID)).rejects.toThrow(AppError)
      expect(mockFindManyComments).not.toHaveBeenCalled()
    })
  })

  // ── manager/adminは全日報にアクセス可能 ────────────────────────────────────

  describe('managerは他のユーザーの日報のコメントを取得できる', () => {
    it('managerが他salesユーザーの日報のコメントを取得できる', async () => {
      // salesUser2が所有する日報でも、managerはアクセス可能
      const otherUsersReport = {
        id: REPORT_ID,
        userId: salesUser2.id,
      }
      mockFindUniqueReport.mockResolvedValueOnce(otherUsersReport as never)
      mockFindManyComments.mockResolvedValueOnce([makePrismaComment()] as never)

      const result = await listComments(managerUser, REPORT_ID)

      expect(result).toHaveLength(1)
      expect(mockFindManyComments).toHaveBeenCalled()
    })

    it('adminが他salesユーザーの日報のコメントを取得できる', async () => {
      const otherUsersReport = {
        id: REPORT_ID,
        userId: salesUser.id,
      }
      mockFindUniqueReport.mockResolvedValueOnce(otherUsersReport as never)
      mockFindManyComments.mockResolvedValueOnce([makePrismaComment()] as never)

      const result = await listComments(adminUser, REPORT_ID)

      expect(result).toHaveLength(1)
    })
  })

  // ── Prismaクエリの正確性 ────────────────────────────────────────────────────

  describe('Prismaクエリ', () => {
    it('正しいreportIdでdailyReport.findUniqueを呼ぶ', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      mockFindManyComments.mockResolvedValueOnce([] as never)

      await listComments(managerUser, REPORT_ID)

      expect(mockFindUniqueReport).toHaveBeenCalledWith({
        where: { id: REPORT_ID },
        select: { id: true, userId: true },
      })
    })

    it('正しいreportIdとcommentor includeでcomment.findManyを呼ぶ', async () => {
      mockFindUniqueReport.mockResolvedValueOnce(sampleReport as never)
      mockFindManyComments.mockResolvedValueOnce([] as never)

      await listComments(managerUser, REPORT_ID)

      expect(mockFindManyComments).toHaveBeenCalledWith({
        where: { dailyReportId: REPORT_ID },
        orderBy: { createdAt: 'desc' },
        include: {
          commenter: {
            select: { id: true, name: true, role: true },
          },
        },
      })
    })
  })
})
