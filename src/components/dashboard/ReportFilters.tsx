'use client'

import { Button } from '@/components/ui/button'
import type { UserListItemClient } from '@/lib/api/users'

interface ReportFiltersProps {
  startDate: string
  endDate: string
  selectedUserId: string
  salesUsers: UserListItemClient[]
  showUserFilter: boolean
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onUserIdChange: (value: string) => void
  onSearch: () => void
}

export function ReportFilters({
  startDate,
  endDate,
  selectedUserId,
  salesUsers,
  showUserFilter,
  onStartDateChange,
  onEndDateChange,
  onUserIdChange,
  onSearch,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      {/* 担当者フィルタ（manager/admin のみ表示） */}
      {showUserFilter && (
        <div className="flex flex-col gap-1">
          <label
            htmlFor="user-filter"
            className="text-sm font-medium text-foreground"
          >
            担当者
          </label>
          <select
            id="user-filter"
            value={selectedUserId}
            onChange={(e) => onUserIdChange(e.target.value)}
            className="h-10 min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">全員</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 開始日 */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="start-date"
          className="text-sm font-medium text-foreground"
        >
          開始日
        </label>
        <input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      {/* 終了日 */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="end-date"
          className="text-sm font-medium text-foreground"
        >
          終了日
        </label>
        <input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      </div>

      <Button onClick={onSearch} size="sm">
        絞り込み
      </Button>
    </div>
  )
}
