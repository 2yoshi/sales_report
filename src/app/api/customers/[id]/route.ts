import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { updateCustomerSchema } from '@/lib/schemas/customer.schema'
import { getCustomer, updateCustomer } from '@/lib/customers/customers.service'
import { handleError } from '@/lib/errors'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleGetCustomer(
  _req: NextRequest,
  context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const { id } = context.params as { id: string }

    if (!UUID_REGEX.test(id)) {
      throw AppError.notFound('顧客')
    }

    const customer = await getCustomer(id)
    return NextResponse.json({ data: customer })
  } catch (err) {
    return handleError(err)
  }
}

export const GET = withAuth(handleGetCustomer)

async function handlePutCustomer(
  req: NextRequest,
  context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const { id } = context.params as { id: string }

    if (!UUID_REGEX.test(id)) {
      throw AppError.notFound('顧客')
    }

    const body: unknown = await req.json()
    const input = updateCustomerSchema.parse(body)
    const customer = await updateCustomer(id, input)
    return NextResponse.json({ data: customer })
  } catch (err) {
    return handleError(err)
  }
}

export const PUT = withAuth(handlePutCustomer)
