import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser, UserRole } from '@/types'
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from '@/lib/schemas/user.schema'

export interface UserItem {
  id: string
  name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface ListUsersResult {
  data: UserItem[]
  meta: {
    total: number
    page: number
    per_page: number
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const

function formatUser(user: {
  id: string
  name: string
  email: string
  role: string
  createdAt: Date
  updatedAt: Date
}): UserItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  }
}

export async function listUsers(query: ListUsersQuery): Promise<ListUsersResult> {
  const { role, page, per_page } = query
  const skip = (page - 1) * per_page
  const where = role ? { role } : {}

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: per_page,
      orderBy: { createdAt: 'asc' },
      select: userSelect,
    }),
  ])

  return {
    data: users.map(formatUser),
    meta: { total, page, per_page },
  }
}

export async function createUser(input: CreateUserInput): Promise<UserItem> {
  const passwordHash = await bcrypt.hash(input.password, 10)

  try {
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
      },
      select: userSelect,
    })
    return formatUser(user)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw AppError.emailAlreadyExists()
    }
    throw err
  }
}

export async function getUser(userId: string, requester: AuthUser): Promise<UserItem> {
  // admin can access any user; non-admin users can only access their own profile
  if (requester.role !== 'admin' && requester.id !== userId) {
    throw AppError.forbidden()
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  })

  if (!user) {
    throw AppError.notFound('ユーザー')
  }

  return formatUser(user)
}

export async function updateUser(userId: string, input: UpdateUserInput): Promise<UserItem> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!existing) {
    throw AppError.notFound('ユーザー')
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        email: input.email,
        role: input.role,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: userSelect,
    })
    return formatUser(user)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') throw AppError.notFound('ユーザー')
      if (err.code === 'P2002') throw AppError.emailAlreadyExists()
    }
    throw err
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    throw AppError.notFound('ユーザー')
  }

  const reportCount = await prisma.dailyReport.count({
    where: { userId },
  })

  if (reportCount > 0) {
    throw AppError.userInUse()
  }

  try {
    await prisma.user.delete({ where: { id: userId } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') throw AppError.notFound('ユーザー')
    }
    throw err
  }
}
