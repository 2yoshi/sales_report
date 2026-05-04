import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { listCustomers, createCustomer, getCustomer, updateCustomer } from './customers.service'
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
    },
  },
}))

const mockCount = vi.mocked(prisma.customer.count)
const mockFindMany = vi.mocked(prisma.customer.findMany)
const mockCreate = vi.mocked(prisma.customer.create)
const mockFindUnique = vi.mocked(prisma.customer.findUnique)
const mockUpdate = vi.mocked(prisma.customer.update)

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
