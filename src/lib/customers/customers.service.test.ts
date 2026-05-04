import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { listCustomers, createCustomer, getCustomer, updateCustomer, deleteCustomer } from './customers.service'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    visitRecord: {
      count: vi.fn(),
    },
  },
}))

const mockCount = vi.mocked(prisma.customer.count)
const mockFindMany = vi.mocked(prisma.customer.findMany)
const mockCreate = vi.mocked(prisma.customer.create)
const mockFindUnique = vi.mocked(prisma.customer.findUnique)
const mockUpdate = vi.mocked(prisma.customer.update)
const mockDelete = vi.mocked(prisma.customer.delete)
const mockVisitRecordCount = vi.mocked(prisma.visitRecord.count)

const now = new Date('2026-04-29T09:00:00.000Z')

const customerRecord = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: '佐藤 健',
  company: '株式会社A',
  phone: '03-1234-5678',
  email: 'sato@example.com',
  createdAt: now,
  updatedAt: now,
}

const customerItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: '佐藤 健',
  company: '株式会社A',
  phone: '03-1234-5678',
  email: 'sato@example.com',
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── listCustomers ──────────────────────────────────────────────────────────

describe('listCustomers', () => {
  it('顧客一覧を返す', async () => {
    mockCount.mockResolvedValueOnce(1)
    mockFindMany.mockResolvedValueOnce([customerRecord] as never)

    const result = await listCustomers({ q: undefined, page: 1, per_page: 20 })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual(customerItem)
    expect(result.meta).toEqual({ total: 1, page: 1, per_page: 20 })
  })

  it('qパラメータでname/company部分一致検索する', async () => {
    mockCount.mockResolvedValueOnce(1)
    mockFindMany.mockResolvedValueOnce([customerRecord] as never)

    await listCustomers({ q: '佐藤', page: 1, per_page: 20 })

    expect(mockCount).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: '佐藤', mode: 'insensitive' } },
          { company: { contains: '佐藤', mode: 'insensitive' } },
        ],
      },
    })
  })

  it('qパラメータなしの場合は全件取得する', async () => {
    mockCount.mockResolvedValueOnce(0)
    mockFindMany.mockResolvedValueOnce([] as never)

    await listCustomers({ q: undefined, page: 1, per_page: 20 })

    expect(mockCount).toHaveBeenCalledWith({ where: {} })
  })

  it('ページネーションのskipが正しく計算される', async () => {
    mockCount.mockResolvedValueOnce(50)
    mockFindMany.mockResolvedValueOnce([] as never)

    await listCustomers({ q: undefined, page: 3, per_page: 10 })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    )
  })

  it('空の場合は空配列とtotal=0を返す', async () => {
    mockCount.mockResolvedValueOnce(0)
    mockFindMany.mockResolvedValueOnce([] as never)

    const result = await listCustomers({ q: undefined, page: 1, per_page: 20 })

    expect(result.data).toEqual([])
    expect(result.meta.total).toBe(0)
  })
})

// ─── createCustomer ─────────────────────────────────────────────────────────

describe('createCustomer', () => {
  it('顧客を作成して返す', async () => {
    mockCreate.mockResolvedValueOnce(customerRecord as never)

    const result = await createCustomer({
      name: '佐藤 健',
      company: '株式会社A',
      phone: '03-1234-5678',
      email: 'sato@example.com',
    })

    expect(result).toEqual(customerItem)
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: '佐藤 健',
        company: '株式会社A',
        phone: '03-1234-5678',
        email: 'sato@example.com',
      },
    })
  })

  it('オプションフィールドが未指定の場合もcreateを呼ぶ', async () => {
    const minimalRecord = { ...customerRecord, company: null, phone: null, email: null }
    mockCreate.mockResolvedValueOnce(minimalRecord as never)

    const result = await createCustomer({ name: '佐藤 健' })

    expect(result.company).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.email).toBeNull()
  })
})

// ─── getCustomer ────────────────────────────────────────────────────────────

describe('getCustomer', () => {
  it('存在する顧客を返す', async () => {
    mockFindUnique.mockResolvedValueOnce(customerRecord as never)

    const result = await getCustomer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')

    expect(result).toEqual(customerItem)
  })

  it('存在しないIDの場合は404 AppErrorをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(getCustomer('ffffffff-ffff-ffff-ffff-ffffffffffff')).rejects.toThrow(AppError)
    await expect(getCustomer('ffffffff-ffff-ffff-ffff-ffffffffffff')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

// ─── updateCustomer ─────────────────────────────────────────────────────────

describe('updateCustomer', () => {
  it('顧客を更新して返す', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: customerRecord.id } as never)
    const updated = { ...customerRecord, name: '佐藤 次郎' }
    mockUpdate.mockResolvedValueOnce(updated as never)

    const result = await updateCustomer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
      name: '佐藤 次郎',
      company: '株式会社A',
      phone: '03-1234-5678',
      email: 'sato@example.com',
    })

    expect(result.name).toBe('佐藤 次郎')
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      data: {
        name: '佐藤 次郎',
        company: '株式会社A',
        phone: '03-1234-5678',
        email: 'sato@example.com',
      },
    })
  })

  it('存在しないIDの場合は404 AppErrorをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(
      updateCustomer('ffffffff-ffff-ffff-ffff-ffffffffffff', { name: '佐藤 次郎' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('レースコンディション: findUniqueとupdateの間に削除された場合は404をスローする', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: customerRecord.id } as never)
    const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockUpdate.mockRejectedValueOnce(p2025Error)

    await expect(
      updateCustomer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', { name: '佐藤 次郎' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('deleteCustomer', () => {
  const CUSTOMER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('顧客が存在しない場合はNOT_FOUNDをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    await expect(deleteCustomer(CUSTOMER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(mockVisitRecordCount).not.toHaveBeenCalled()
  })

  it('訪問記録に紐づいている場合はCUSTOMER_IN_USEをスローする', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: CUSTOMER_ID } as never)
    mockVisitRecordCount.mockResolvedValueOnce(3)

    await expect(deleteCustomer(CUSTOMER_ID)).rejects.toMatchObject({ code: 'CUSTOMER_IN_USE' })
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('参照のない顧客を正常に削除できる', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: CUSTOMER_ID } as never)
    mockVisitRecordCount.mockResolvedValueOnce(0)
    mockDelete.mockResolvedValueOnce({} as never)

    await expect(deleteCustomer(CUSTOMER_ID)).resolves.toBeUndefined()
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: CUSTOMER_ID } })
  })

  it('visitRecord.countに正しいcustomerIdが渡される', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: CUSTOMER_ID } as never)
    mockVisitRecordCount.mockResolvedValueOnce(0)
    mockDelete.mockResolvedValueOnce({} as never)

    await deleteCustomer(CUSTOMER_ID)

    expect(mockVisitRecordCount).toHaveBeenCalledWith({ where: { customerId: CUSTOMER_ID } })
  })

  it('削除時にP2025が発生した場合はNOT_FOUNDをスローする（レースコンディション）', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: CUSTOMER_ID } as never)
    mockVisitRecordCount.mockResolvedValueOnce(0)
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record not found.', {
      code: 'P2025',
      clientVersion: '5.0.0',
    })
    mockDelete.mockRejectedValueOnce(p2025)

    await expect(deleteCustomer(CUSTOMER_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('P2025以外のPrismaエラーはそのまま再スローされる', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: CUSTOMER_ID } as never)
    mockVisitRecordCount.mockResolvedValueOnce(0)
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed.', {
      code: 'P2002',
      clientVersion: '5.0.0',
    })
    mockDelete.mockRejectedValueOnce(p2002)

    await expect(deleteCustomer(CUSTOMER_ID)).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    )
  })
})
