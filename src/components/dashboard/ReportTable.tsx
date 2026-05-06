'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatVisitCustomers, formatDate } from '@/lib/format'
import type { ReportListItemClient } from '@/lib/api/reports'

interface ReportTableProps {
  reports: ReportListItemClient[]
  showUserColumn: boolean
  isLoading: boolean
}

export function ReportTable({ reports, showUserColumn, isLoading }: ReportTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        読み込み中...
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        該当する日報はありません
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日付</TableHead>
          {showUserColumn && <TableHead>担当者</TableHead>}
          <TableHead>訪問先</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead className="w-24">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => {
          const customers = report.visit_records.map((vr) => vr.customer)
          const hasComments = report.comments_count > 0

          return (
            <TableRow key={report.id}>
              <TableCell className="font-medium">
                {formatDate(report.report_date)}
              </TableCell>
              {showUserColumn && (
                <TableCell>{report.user.name}</TableCell>
              )}
              <TableCell>{formatVisitCustomers(customers)}</TableCell>
              <TableCell>
                {hasComments ? (
                  <Badge variant="default">コメント済</Badge>
                ) : (
                  <Badge variant="outline">未コメント</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/reports/${report.id}`}>詳細</Link>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
