'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_LABELS } from '@/lib/users/constants'
import type { PaginatedResponse, UserRole } from '@/types'

interface UserItem {
  id: string
  name: string
  email: string
  role: UserRole
}

export default function UsersPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<UserItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // admin 以外はトップへリダイレクト
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      router.replace('/')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') return

    async function fetchUsers() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await apiClient.get<PaginatedResponse<UserItem>>(
          '/api/users?per_page=100',
        )
        setUsers(res.data)
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message)
        } else {
          setError('データの取得に失敗しました')
        }
      } finally {
        setIsLoading(false)
      }
    }
    void fetchUsers()
  }, [authLoading, user])

  if (authLoading || !user) return null

  if (user.role !== 'admin') return null

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">営業マスタ</h1>
        <Button asChild>
          <Link href="/users/new">+ 新規登録</Link>
        </Button>
      </div>

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
              <TableHead>氏名</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>ロール</TableHead>
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
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  ユーザーが見つかりません
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/users/${u.id}/edit`}>編集</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
