'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm'
import { apiClient, ApiClientError } from '@/lib/api-client'

export default function NewCustomerPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleSubmit(values: CustomerFormValues) {
    setServerError(null)
    try {
      await apiClient.post('/api/customers', {
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">顧客登録</h1>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <CustomerForm
          onSubmit={handleSubmit}
          submitLabel="登録"
          serverError={serverError}
        />
      </div>
    </div>
  )
}
