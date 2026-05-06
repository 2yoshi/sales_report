'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { PaginatedResponse } from '@/types'

interface CustomerItem {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
}

const PER_PAGE = 20

export default function CustomersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1)
  const currentQ = searchParams.get('q') ?? ''

  const [searchInput, setSearchInput] = useState(currentQ)

  // URL の q パラメータが変わったら検索ボックスも同期する（ブラウザ戻る/進む対応）
  useEffect(() => {
    setSearchInput(currentQ)
  }, [currentQ])
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: PER_PAGE })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async (q: string, page: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) })
      if (q) params.set('q', q)
      const res = await apiClient.get<PaginatedResponse<CustomerItem>>(
        `/api/customers?${params.toString()}`,
      )
      setCustomers(res.data)
      setMeta(res.meta)
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message)
      } else {
        setError('データの取得に失敗しました')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCustomers(currentQ, currentPage)
  }, [fetchCustomers, currentQ, currentPage])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchInput) params.set('q', searchInput)
    params.set('page', '1')
    router.push(`/customers?${params.toString()}`)
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams()
    if (currentQ) params.set('q', currentQ)
    params.set('page', String(page))
    router.push(`/customers?${params.toString()}`)
  }

  const totalPages = Math.ceil(meta.total / meta.per_page) || 1

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">顧客マスタ</h1>
        <Button asChild>
          <Link href="/customers/new">+ 新規登録</Link>
        </Button>
      </div>

      {/* 検索 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="顧客名・会社名で検索"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          検索
        </Button>
      </form>

      {/* エラー */}
      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* テーブル */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>顧客名</TableHead>
              <TableHead>会社名</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  顧客が見つかりません
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.company ?? '—'}</TableCell>
                  <TableCell>{customer.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/customers/${customer.id}/edit`}>編集</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ページネーション */}
      {!isLoading && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            &lt; 前へ
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            次へ &gt;
          </Button>
        </div>
      )}
    </div>
  )
}
