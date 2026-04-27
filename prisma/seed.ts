import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('Test1234!', 10)

  // Users (USER-01〜04)
  const yamada = await prisma.user.upsert({
    where: { email: 'yamada@test.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: '山田 太郎',
      email: 'yamada@test.com',
      passwordHash,
      role: Role.sales,
    },
  })

  const suzuki = await prisma.user.upsert({
    where: { email: 'suzuki@test.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: '鈴木 一郎',
      email: 'suzuki@test.com',
      passwordHash,
      role: Role.sales,
    },
  })

  const tanaka = await prisma.user.upsert({
    where: { email: 'tanaka@test.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: '田中 部長',
      email: 'tanaka@test.com',
      passwordHash,
      role: Role.manager,
    },
  })

  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: '管理 太郎',
      email: 'admin@test.com',
      passwordHash,
      role: Role.admin,
    },
  })

  // Customers (CUST-01〜03)
  const cust01 = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0001-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000001',
      name: '佐藤 健',
      company: '株式会社サンプル商事',
      phone: '03-1234-5678',
      email: 'sato@sample.co.jp',
    },
  })

  const cust02 = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0001-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000002',
      name: '伊藤 美咲',
      company: '株式会社テスト産業',
      phone: '06-9876-5432',
      email: 'ito@test-industry.co.jp',
    },
  })

  const cust03 = await prisma.customer.upsert({
    where: { id: '00000000-0000-0000-0001-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0001-000000000003',
      name: '渡辺 隆',
      company: '渡辺商店',
      phone: null,
      email: null,
    },
  })

  // DailyReports (RPT-01: yamada, RPT-02: suzuki)
  const rpt01 = await prisma.dailyReport.upsert({
    where: {
      userId_reportDate: {
        userId: yamada.id,
        reportDate: new Date('2026-04-25'),
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-000000000001',
      userId: yamada.id,
      reportDate: new Date('2026-04-25'),
      problem: '顧客のニーズ把握が不十分だった。',
      plan: '次回訪問前に事前調査を行う。',
    },
  })

  const rpt02 = await prisma.dailyReport.upsert({
    where: {
      userId_reportDate: {
        userId: suzuki.id,
        reportDate: new Date('2026-04-25'),
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-000000000002',
      userId: suzuki.id,
      reportDate: new Date('2026-04-25'),
      problem: '競合他社との価格差が課題。',
      plan: '価値訴求の資料を作成する。',
    },
  })

  // VisitRecords for RPT-01
  await prisma.visitRecord.upsert({
    where: { id: '00000000-0000-0000-0003-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0003-000000000001',
      dailyReportId: rpt01.id,
      customerId: cust01.id,
      content: '新製品の提案を行った。興味を持ってもらえた。',
      sortOrder: 1,
    },
  })

  await prisma.visitRecord.upsert({
    where: { id: '00000000-0000-0000-0003-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0003-000000000002',
      dailyReportId: rpt01.id,
      customerId: cust02.id,
      content: '既存契約の更新について確認した。',
      sortOrder: 2,
    },
  })

  // VisitRecords for RPT-02
  await prisma.visitRecord.upsert({
    where: { id: '00000000-0000-0000-0003-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0003-000000000003',
      dailyReportId: rpt02.id,
      customerId: cust03.id,
      content: '価格交渉を実施した。持ち帰り検討となった。',
      sortOrder: 1,
    },
  })

  // Comment from tanaka on RPT-01
  await prisma.comment.upsert({
    where: { id: '00000000-0000-0000-0004-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0004-000000000001',
      dailyReportId: rpt01.id,
      commenterId: tanaka.id,
      body: 'よい提案でした。次回はデモを用意してください。',
    },
  })

  console.log('Seed completed successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
