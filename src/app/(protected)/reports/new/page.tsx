'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { CreateReportInput } from '@/lib/schemas'
import { ReportForm, type ReportFormValues } from '@/components/reports/ReportForm'

export default function NewReportPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user && user.role !== 'sales') {
      router.replace('/')
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  if (!user || user.role !== 'sales') {
    return null
  }

  async function handleSubmit(values: ReportFormValues) {
    setServerError(null)

    const body: CreateReportInput = {
      report_date: values.report_date,
      problem: values.problem,
      plan: values.plan,
      visit_records: values.visit_records.map((rec, index) => ({
        customer_id: rec.customer_id,
        content: rec.content,
        sort_order: index + 1,
      })),
    }

    try {
      await apiClient.post('/api/reports', body)
      router.push('/')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'DUPLICATE_REPORT') {
          setServerError('同じ日付の日報がすでに存在します。別の日付を選択してください。')
        } else {
          setServerError(err.message)
        }
      } else {
        setServerError('日報の提出に失敗しました。しばらく経ってから再度お試しください。')
      }
    }
  }

  function handleCancel() {
    if (window.confirm('入力内容が破棄されます。キャンセルしてもよいですか？')) {
      router.push('/')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">日報作成</h1>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <ReportForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          serverError={serverError}
        />
      </div>
    </div>
  )
}
