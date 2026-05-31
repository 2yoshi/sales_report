'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { ReportForm, type ReportFormValues } from '@/components/reports/ReportForm'
import { CommentSection, type Comment } from '@/components/reports/CommentSection'
import type { ApiResponse } from '@/types'
import type { UpdateReportInput } from '@/lib/schemas'

interface VisitRecord {
  id: string
  sort_order: number
  customer: { id: string; name: string; company: string | null }
  content: string
}

interface Report {
  id: string
  report_date: string
  problem: string
  plan: string
  user: { id: string; name: string }
  visit_records: VisitRecord[]
  created_at: string
  updated_at: string
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>()
  const reportId = params.id
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  const [report, setReport] = useState<Report | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const [reportRes, commentsRes] = await Promise.all([
        apiClient.get<ApiResponse<Report>>(`/api/reports/${reportId}`),
        apiClient.get<ApiResponse<Comment[]>>(`/api/reports/${reportId}/comments`),
      ])
      setReport(reportRes.data)
      // コメントは新しい順に表示
      const sorted = [...commentsRes.data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      setComments(sorted)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          setFetchError('日報が見つかりませんでした')
        } else if (err.status === 403) {
          setFetchError('この日報を閲覧する権限がありません')
        } else {
          setFetchError(err.message)
        }
      } else {
        setFetchError('日報の取得に失敗しました')
      }
    } finally {
      setIsLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    if (!authLoading) {
      void fetchReport()
    }
  }, [authLoading, fetchReport])

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {fetchError}
        </div>
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            一覧へ戻る
          </Link>
        </Button>
      </div>
    )
  }

  if (!report || !user) {
    return null
  }

  const isAuthor = report.user.id === user.id
  const sortedVisitRecords = [...report.visit_records].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  async function handleUpdate(values: ReportFormValues) {
    setUpdateError(null)
    const body: UpdateReportInput = {
      problem: values.problem,
      plan: values.plan,
      visit_records: values.visit_records.map((rec, index) => ({
        customer_id: rec.customer_id,
        content: rec.content,
        sort_order: index + 1,
      })),
    }
    try {
      const res = await apiClient.put<ApiResponse<Report>>(
        `/api/reports/${reportId}`,
        body,
      )
      setReport(res.data)
      setIsEditMode(false)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setUpdateError(err.message)
      } else {
        setUpdateError('日報の更新に失敗しました')
      }
    }
  }

  function handleEditCancel() {
    if (window.confirm('編集内容が破棄されます。キャンセルしてもよいですか？')) {
      setIsEditMode(false)
      setUpdateError(null)
    }
  }

  async function handleDelete() {
    if (!window.confirm('この日報を削除してもよいですか？この操作は取り消せません。')) return
    setDeleteError(null)
    try {
      await apiClient.delete(`/api/reports/${reportId}`)
      router.push('/')
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteError(`削除に失敗しました: ${err.message}`)
      } else {
        setDeleteError('削除に失敗しました')
      }
    }
  }

  // 編集フォームに渡すdefaultValues
  const editDefaultValues: ReportFormValues = {
    report_date: report.report_date,
    problem: report.problem,
    plan: report.plan,
    visit_records: sortedVisitRecords.map((vr) => ({
      customer_id: vr.customer.id,
      content: vr.content,
    })),
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">日報詳細</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              一覧へ
            </Link>
          </Button>
          {isAuthor && !isEditMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
              >
                <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />
                編集
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDelete()}
              >
                <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                削除
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 削除エラー */}
      {deleteError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {deleteError}
        </div>
      )}

      {/* 担当者・対象日 */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground">担当者</dt>
            <dd className="mt-1 font-semibold">{report.user.name}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">対象日</dt>
            <dd className="mt-1 font-semibold">{formatDate(report.report_date)}</dd>
          </div>
        </dl>
      </div>

      {/* 編集モード */}
      {isEditMode ? (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <ReportForm
            onSubmit={handleUpdate}
            onCancel={handleEditCancel}
            serverError={updateError}
            defaultValues={editDefaultValues}
            isEditMode={true}
          />
        </div>
      ) : (
        <>
          {/* 訪問記録 */}
          <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">訪問記録</h2>
            {sortedVisitRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">訪問記録がありません</p>
            ) : (
              <ol className="space-y-4">
                {sortedVisitRecords.map((vr, index) => (
                  <li key={vr.id} className="space-y-1">
                    <div className="text-sm font-medium">
                      {index + 1}.{' '}
                      <span className="font-semibold">{vr.customer.name}</span>
                      {vr.customer.company && (
                        <span className="text-muted-foreground ml-1">
                          （{vr.customer.company}）
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap pl-4">
                      {vr.content}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Problem */}
          <div className="rounded-lg border bg-card p-6 shadow-sm space-y-2">
            <h2 className="text-lg font-semibold border-b pb-2">
              Problem（課題・相談）
            </h2>
            <p className="text-sm whitespace-pre-wrap">{report.problem}</p>
          </div>

          {/* Plan */}
          <div className="rounded-lg border bg-card p-6 shadow-sm space-y-2">
            <h2 className="text-lg font-semibold border-b pb-2">
              Plan（明日やること）
            </h2>
            <p className="text-sm whitespace-pre-wrap">{report.plan}</p>
          </div>

          {/* コメントセクション */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <CommentSection
              reportId={reportId}
              comments={comments}
              currentUser={user}
              onCommentsChange={setComments}
            />
          </div>
        </>
      )}
    </div>
  )
}
