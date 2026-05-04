import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import type { CreateCustomerInput, UpdateCustomerInput, ListCustomersQuery } from '@/lib/schemas/customer.schema'

export interface CustomerItem {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export interface ListCustomersResult {
  data: CustomerItem[]
  meta: {
    total: number
    page: number
    per_page: number
  }
}

function formatCustomer(customer: {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  createdAt: Date
  updatedAt: Date
}): CustomerItem {
  return {
    id: customer.id,
    name: customer.name,
    company: customer.company,
    phone: customer.phone,
    email: customer.email,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
  }
}

export async function listCustomers(query: ListCustomersQuery): Promise<ListCustomersResult> {
  const { q, page, per_page } = query
  const skip = (page - 1) * per_page

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { company: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      skip,
      take: per_page,
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    data: customers.map(formatCustomer),
    meta: { total, page, per_page },
  }
}

export async function createCustomer(input: CreateCustomerInput): Promise<CustomerItem> {
  const customer = await prisma.customer.create({
    data: {
      name: input.name,
      company: input.company,
      phone: input.phone,
      email: input.email,
    },
  })
  return formatCustomer(customer)
}

export async function getCustomer(customerId: string): Promise<CustomerItem> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  })

  if (!customer) {
    throw AppError.notFound('顧客')
  }

  return formatCustomer(customer)
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput,
): Promise<CustomerItem> {
  const existing = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  })

  if (!existing) {
    throw AppError.notFound('顧客')
  }

  try {
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: input.name,
        company: input.company,
        phone: input.phone,
        email: input.email,
      },
    })
    return formatCustomer(customer)
  } catch (err) {
    // Race condition: customer was deleted between the existence check and the update
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw AppError.notFound('顧客')
    }
    throw err
  }
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  })

  if (!customer) {
    throw AppError.notFound('顧客')
  }

  const visitRecordCount = await prisma.visitRecord.count({
    where: { customerId },
  })

  if (visitRecordCount > 0) {
    throw AppError.customerInUse()
  }

  try {
    await prisma.customer.delete({ where: { id: customerId } })
  } catch (err) {
    // Race condition: customer was deleted between our check and delete
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw AppError.notFound('顧客')
    }
    throw err
  }
}
