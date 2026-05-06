'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportFilters } from './ReportFilters'
import { ReportTable } from './ReportTable'
import { Pagination } from './Pagination'
import { fetchReports, type ReportListItemClient } from '@/lib/api/reports'
import { fetchSalesUsers, type UserListItemClient } from '@/lib/api/users'
import { getDateRangeForLastDays } from '@/lib/format'
import { ApiClientError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

const PER_PAGE = 20

export function DashboardClient() {
  const { user } = useAuth()

  const defaultDates = getDateRangeForLastDays(30)
  const [startDate, setStartDate] = useState(defaultDates.startDate)
  const [endDate, setEndDate] = useState(defaultDates.endDate)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [page, setPage] = useState(1)

  const [reports, setReports] = useState<ReportListItemClient[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [salesUsers, setSalesUsers] = useState<UserListItemClient[]>([])

  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin'

  // manager/admin のみ担当者一覧を取得
  useEffect(() => {
    if (!isManagerOrAdmin) return

    fetchSalesUsers()
      .then((res) => setSalesUsers(res.data))
      .catch(() => {
        // 担当者一覧の取得失敗は無視（フィルタなしで動作継続）
      })
  }, [isManagerOrAdmin])

  const loadReports = useCallback(
    async (currentPage: number) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetchReports({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          user_id: isManagerOrAdmin && selectedUserId ? selectedUserId : undefined,
          page: currentPage,
          per_page: PER_PAGE,
        })
        setReports(result.data)
        setTotal(result.meta.total)
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message)
        } else {
          setError('日報の取得中にエラーが発生しました')
        }
      } finally {
        setIsLoading(false)
      }
    },
    [startDate, endDate, selectedUserId, isManagerOrAdmin],
  )

  useEffect(() => {
    void loadReports(page)
  }, [loadReports, page])

  function handleSearch() {
    setPage(1)
    void loadReports(1)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        {/* 新規作成ボタン: sales のみ表示 */}
        {user.role === 'sales' && (
          <Button asChild>
            <Link href="/reports/new">
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              新規作成
            </Link>
          </Button>
        )}
      </div>

      {/* フィルタ */}
      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        selectedUserId={selectedUserId}
        salesUsers={salesUsers}
        showUserFilter={isManagerOrAdmin}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onUserIdChange={setSelectedUserId}
        onSearch={handleSearch}
      />

      {/* エラー表示 */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* 日報テーブル */}
      <div className="rounded-lg border">
        <ReportTable
          reports={reports}
          showUserColumn={isManagerOrAdmin}
          isLoading={isLoading}
        />
      </div>

      {/* ページネーション */}
      {!isLoading && !error && (
        <Pagination
          page={page}
          perPage={PER_PAGE}
          total={total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  )
}
