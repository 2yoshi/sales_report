import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { listCustomersQuerySchema, createCustomerSchema } from '@/lib/schemas/customer.schema'
import { listCustomers, createCustomer } from '@/lib/customers/customers.service'
import { handleError } from '@/lib/errors'
import type { AuthUser } from '@/types'

async function handleGetCustomers(
  req: NextRequest,
  _context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams

    const rawQuery: Record<string, string | undefined> = {
      q: searchParams.get('q') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      per_page: searchParams.get('per_page') ?? undefined,
    }

    Object.keys(rawQuery).forEach((key) => {
      if (rawQuery[key] === undefined) {
        delete rawQuery[key]
      }
    })

    const query = listCustomersQuerySchema.parse(rawQuery)
    const result = await listCustomers(query)

    return NextResponse.json(result)
  } catch (err) {
    return handleError(err)
  }
}

export const GET = withAuth(handleGetCustomers)

async function handlePostCustomer(
  req: NextRequest,
  _context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const body: unknown = await req.json()
    const input = createCustomerSchema.parse(body)
    const customer = await createCustomer(input)
    return NextResponse.json({ data: customer }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}

export const POST = withAuth(handlePostCustomer)
