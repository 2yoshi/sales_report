import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { listUsers, createUser, getUser, updateUser, deleteUser } from './users.service'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    dailyReport: {
      count: vi.fn(),
    },
  },
}))

// vi.hoisted で bcrypt mock 関数を作成し、restoreMocks: true で毎テスト後にリセットされた
// 実装を beforeEach で再設定できるようにする
const bcryptHashMock = vi.hoisted(() => vi.fn())

vi.mock('bcryptjs', () => ({
  default: {
    hash: bcryptHashMock,
    compare: vi.fn(),
  },
}))

const mockCount = vi.mocked(prisma.user.count)
const mockFindMany = vi.mocked(prisma.user.findMany)
const mockCreate = vi.mocked(prisma.user.create)
const mockFindUnique = vi.mocked(prisma.user.findUnique)
const mockUpdate = vi.mocked(prisma.user.update)
const mockDelete = vi.mocked(prisma.user.delete)
const mockReportCount = vi.mocked(prisma.dailyReport.count)

const now = new Date('2026-04-29T09:00:00.000Z')

const userRecord = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
  createdAt: now,
  updatedAt: now,
}

const userItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

const adminUser: AuthUser = {
  id: '44444444-4444-4444-4444-444444444444',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

const salesUser: AuthUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
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

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

beforeEach(() => {
  vi.clearAllMocks()
  // restoreMocks: true でリセットされるため毎テスト前に再設定する
  bcryptHashMock.mockResolvedValue('hashed_password')
})

// ─── listUsers ───────────────────────────────────────────────────────────────

describe('listUsers', () => {
  it('ユーザー一覧を返す', async () => {
    mockCount.mockResolvedValueOnce(1)
    mockFindMany.mockResolvedValueOnce([userRecord] as never)

    const result = await listUsers({ role: undefined, page: 1, per_page: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual(userItem)
    expect(result.meta).toEqual({ total: 1, page: 1, per_page: 20 })
  })

  it('roleパラメータで絞り込みできる', async () => {
    mockCount.mockResolvedValueOnce(1)
    mockFindMany.mockResolvedValueOnce([userRecord] as never)

    await listUsers({ role: 'sales', page: 1, per_page: 20 })

    expect(mockCount).toHaveBeenCalledWith({ where: { role: 'sales' } })
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: 'sales' } }),
    )
  })

  it('roleパラメータなしの場合は全件取得する', async () => {
    mockCount.mockResolvedValueOnce(0)
    mockFindMany.mockResolvedValueOnce([] as never)

    await listUsers({ role: undefined, page: 1, per_page: 20 })

    expect(mockCount).toHaveBeenCalledWith({ where: {} })
  })

  it('ページネーションのskipが正しく計算される', async () => {
    mockCount.mockResolvedValueOnce(50)
    mockFindMany.mockResolvedValueOnce([] as never)

    await listUsers({ role: undefined, page: 3, per_page: 10 })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    )
  })

  it('パスワードハッシュが含まれない', async () => {
    mockCount.mockResolvedValueOnce(1)
    mockFindMany.mockResolvedValueOnce([userRecord] as never)

    const result = await listUsers({ role: undefined, page: 1, per_page: 20 })

    expect(result.data[0]).not.toHaveProperty('password_hash')
    expect(result.data[0]).not.toHaveProperty('passwordHash')
  })
})

// ─── createUser ─────────────────────────────────────────────────────────────

describe('createUser', () => {
  const createInput = {
    name: '山田 太郎',
    email: 'yamada@test.com',
    password: 'Test1234!',
    role: 'sales' as const,
  }

  it('ユーザーを作成して返す（パスワードはハッシュ化される）', async () => {
    mockCreate.mockResolvedValueOnce(userRecord as never)

    const result = await createUser(createInput)

    expect(result).toEqual(userItem)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: '山田 太郎',
          email: 'yamada@test.com',
          passwordHash: 'hashed_password',
          role: 'sales',
        }),
      }),
    )
  })

  it('レスポンスにパスワードハッシュが含まれない', async () => {
    mockCreate.mockResolvedValueOnce(userRecord as never)

    const result = await createUser(createInput)

    expect(result).not.toHaveProperty('password_hash')
    expect(result).not.toHaveProperty('passwordHash')
  })

  it('メールアドレスが重複している場合はEMAIL_ALREADY_EXISTSをスローする', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockCreate.mockRejectedValueOnce(p2002)

    await expect(createUser(createInput)).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' })
  })

  it('P2002以外のPrismaエラーはそのまま再スローされる', async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockCreate.mockRejectedValueOnce(p2025)

    await expect(createUser(createInput)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    )
  })
})

// ─── getUser ────────────────────────────────────────────────────────────────

describe('getUser', () => {
  it('adminは任意のユーザーを取得できる', async () => {
    mockFindUnique.mockResolvedValueOnce(userRecord as never)

    const result = await getUser(USER_ID, adminUser)

    expect(result).toEqual(userItem)
  })

  it('ユーザーは自分自身のプロフィールを取得できる', async () => {
    mockFindUnique.mockResolvedValueOnce(userRecord as never)

    const result = await getUser(USER_ID, salesUser)

    expect(result).toEqual(userItem)
  })

  it('non-adminが他のユーザーを取得しようとするとFORBIDDENをスローする', async () => {
    await expect(getUser(USER_ID, salesUser2)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('存在しないIDの場合はNOT_FOUNDをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(getUser(USER_ID, adminUser)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('レスポンスにパスワードハッシュが含まれない', async () => {
    mockFindUnique.mockResolvedValueOnce(userRecord as never)

    const result = await getUser(USER_ID, adminUser)

    expect(result).not.toHaveProperty('password_hash')
    expect(result).not.toHaveProperty('passwordHash')
  })
})

// ─── updateUser ─────────────────────────────────────────────────────────────

describe('updateUser', () => {
  const updateInput = {
    name: '山田 次郎',
    email: 'yamada2@test.com',
    role: 'manager' as const,
  }

  it('ユーザーを更新して返す', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    const updated = { ...userRecord, name: '山田 次郎' }
    mockUpdate.mockResolvedValueOnce(updated as never)

    const result = await updateUser(USER_ID, updateInput)

    expect(result.name).toBe('山田 次郎')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({
          name: '山田 次郎',
          email: 'yamada2@test.com',
          role: 'manager',
        }),
      }),
    )
  })

  it('パスワードが指定された場合はハッシュ化して更新する', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockUpdate.mockResolvedValueOnce(userRecord as never)

    await updateUser(USER_ID, { ...updateInput, password: 'NewPass123!' })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'hashed_password' }),
      }),
    )
  })

  it('パスワードが省略された場合はpasswordHashを更新しない', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockUpdate.mockResolvedValueOnce(userRecord as never)

    await updateUser(USER_ID, updateInput)

    const callArg = mockUpdate.mock.calls[0][0]
    expect(callArg.data).not.toHaveProperty('passwordHash')
  })

  it('存在しないIDの場合はNOT_FOUNDをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(updateUser(USER_ID, updateInput)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('レースコンディション P2025 → NOT_FOUND', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockUpdate.mockRejectedValueOnce(p2025)

    await expect(updateUser(USER_ID, updateInput)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('メールアドレス重複 P2002 → EMAIL_ALREADY_EXISTS', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockUpdate.mockRejectedValueOnce(p2002)

    await expect(updateUser(USER_ID, updateInput)).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
    })
  })
})

// ─── deleteUser ─────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  it('ユーザーを正常に削除できる', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockReportCount.mockResolvedValueOnce(0)
    mockDelete.mockResolvedValueOnce({} as never)

    await expect(deleteUser(USER_ID)).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: USER_ID } })
  })

  it('存在しないIDの場合はNOT_FOUNDをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(mockReportCount).not.toHaveBeenCalled()
  })

  it('日報に紐づいているユーザーはUSER_IN_USEをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockReportCount.mockResolvedValueOnce(3)

    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ code: 'USER_IN_USE' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('dailyReport.countに正しいuserIdが渡される', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockReportCount.mockResolvedValueOnce(0)
    mockDelete.mockResolvedValueOnce({} as never)

    await deleteUser(USER_ID)

    expect(mockReportCount).toHaveBeenCalledWith({ where: { userId: USER_ID } })
  })

  it('レースコンディション P2025 → NOT_FOUND', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockReportCount.mockResolvedValueOnce(0)
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockDelete.mockRejectedValueOnce(p2025)

    await expect(deleteUser(USER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('P2025以外のPrismaエラーはそのまま再スローされる', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: USER_ID } as never)
    mockReportCount.mockResolvedValueOnce(0)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockDelete.mockRejectedValueOnce(p2002)

    await expect(deleteUser(USER_ID)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    )
  })
})

// ─── AppError instances ─────────────────────────────────────────────────────

describe('AppError static factories', () => {
  it('getUser: forbiddenはAppError', async () => {
    await expect(getUser(USER_ID, salesUser2)).rejects.toBeInstanceOf(AppError)
  })
})
