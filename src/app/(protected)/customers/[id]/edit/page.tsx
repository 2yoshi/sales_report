'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { ApiResponse } from '@/types'

interface CustomerItem {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
}

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const customerId = params.id

  const [defaultValues, setDefaultValues] = useState<CustomerFormValues | null>(null)
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await apiClient.get<ApiResponse<CustomerItem>>(
          `/api/customers/${customerId}`,
        )
        const c = res.data
        setDefaultValues({
          name: c.name,
          company: c.company ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
        })
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          setLoadError('顧客が見つかりません')
        } else {
          setLoadError('データの取得に失敗しました')
        }
      } finally {
        setIsLoadingCustomer(false)
      }
    }
    void fetchCustomer()
  }, [customerId])

  async function handleSubmit(values: CustomerFormValues) {
    setServerError(null)
    try {
      await apiClient.put(`/api/customers/${customerId}`, {
        name: values.name,
        company: values.company || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
      })
      router.push('/customers')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message)
      } else {
        setServerError('保存に失敗しました。しばらく経ってから再度お試しください。')
      }
    }
  }

  if (isLoadingCustomer) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (loadError || !defaultValues) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">顧客編集</h1>
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {loadError ?? 'データの取得に失敗しました'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">顧客編集</h1>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <CustomerForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          submitLabel="保存"
          serverError={serverError}
        />
      </div>
    </div>
  )
}
