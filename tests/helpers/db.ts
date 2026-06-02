import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

export const prisma = new PrismaClient()

// Password hash for 'Test1234!' — computed synchronously once per process
const PASSWORD_HASH = bcrypt.hashSync('Test1234!', 10)

// ─── Test fixtures ────────────────────────────────────────────────────────────

export const TEST_USERS = {
  yamada: {
    id: '00000000-0000-0000-0000-000000000001',
    name: '山田 太郎',
    email: 'yamada@test.com',
    role: 'sales' as const,
  },
  suzuki: {
    id: '00000000-0000-0000-0000-000000000002',
    name: '鈴木 一郎',
    email: 'suzuki@test.com',
    role: 'sales' as const,
  },
  tanaka: {
    id: '00000000-0000-0000-0000-000000000003',
    name: '田中 部長',
    email: 'tanaka@test.com',
    role: 'manager' as const,
  },
  admin: {
    id: '00000000-0000-0000-0000-000000000004',
    name: '管理 太郎',
    email: 'admin@test.com',
    role: 'admin' as const,
  },
} as const

export const TEST_CUSTOMERS = {
  cust01: {
    id: '00000000-0000-0000-0001-000000000001',
    name: '佐藤 健',
    company: '株式会社サンプル商事',
  },
  cust02: {
    id: '00000000-0000-0000-0001-000000000002',
    name: '伊藤 美咲',
    company: '株式会社テスト産業',
  },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Remove all rows in FK-safe order. */
export async function clearDatabase(): Promise<void> {
  await prisma.comment.deleteMany()
  await prisma.visitRecord.deleteMany()
  await prisma.dailyReport.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.tokenBlacklist.deleteMany()
  await prisma.user.deleteMany()
}

export async function seedTestUsers(): Promise<void> {
  await prisma.user.createMany({
    data: Object.values(TEST_USERS).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: PASSWORD_HASH,
      role: user.role as Role,
    })),
  })
}

export async function seedTestCustomers(): Promise<void> {
  for (const cust of Object.values(TEST_CUSTOMERS)) {
    await prisma.customer.create({
      data: { id: cust.id, name: cust.name, company: cust.company },
    })
  }
}

export async function createTestComment(params: {
  reportId: string
  commenterId: string
  body?: string
}): Promise<string> {
  const comment = await prisma.comment.create({
    data: {
      dailyReportId: params.reportId,
      commenterId: params.commenterId,
      body: params.body ?? 'テストコメント',
    },
  })
  return comment.id
}

export async function createTestReport(params: {
  id?: string
  userId: string
  reportDate: string // YYYY-MM-DD
  problem?: string
  plan?: string
  visitRecords?: Array<{ customerId: string; content: string; sortOrder: number }>
}): Promise<string> {
  const reportId = params.id ?? crypto.randomUUID()
  await prisma.dailyReport.create({
    data: {
      id: reportId,
      userId: params.userId,
      reportDate: new Date(params.reportDate),
      problem: params.problem ?? 'テスト課題',
      plan: params.plan ?? 'テスト計画',
      visitRecords: params.visitRecords
        ? {
            create: params.visitRecords.map((vr) => ({
              customerId: vr.customerId,
              content: vr.content,
              sortOrder: vr.sortOrder,
            })),
          }
        : undefined,
    },
  })
  return reportId
}
