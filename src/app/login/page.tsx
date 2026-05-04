'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { ApiResponse, AuthUser } from '@/types'

interface LoginResponse {
  access_token: string
  user: AuthUser
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // すでに認証済みならダッシュボードへ
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/')
    }
  }, [isLoading, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await apiClient.post<ApiResponse<LoginResponse>>(
        '/api/auth/login',
        { email, password },
      )
      login(res.data.access_token, res.data.user)
      router.push('/')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('メールアドレスまたはパスワードが正しくありません')
        } else {
          setError(err.message)
        }
      } else {
        setError('ログインに失敗しました。しばらく経ってから再度お試しください。')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* ロゴ */}
        <div className="flex flex-col items-center gap-2 text-center">
          <ClipboardList className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold">営業日報システム</h1>
          <p className="text-sm text-muted-foreground">アカウントにログインしてください</p>
        </div>

        {/* フォーム */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* エラーメッセージ */}
            {error && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {/* メールアドレス */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="例: yamada@example.com"
              />
            </div>

            {/* パスワード */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="パスワードを入力"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
