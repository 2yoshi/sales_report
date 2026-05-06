'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { ApiResponse, AuthUser } from '@/types'

const loginSchema = z.object({
  email: z.string().email('メール形式で入力してください'),
  password: z.string().min(8, '8文字以上で入力してください'),
})

type LoginFormValues = z.infer<typeof loginSchema>

interface LoginResponse {
  access_token: string
  user: AuthUser
}

export default function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const router = useRouter()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const { isSubmitting } = form.formState

  // すでに認証済みならダッシュボードへ
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/')
    }
  }, [isLoading, user, router])

  async function onSubmit(values: LoginFormValues) {
    try {
      const res = await apiClient.post<ApiResponse<LoginResponse>>(
        '/api/auth/login',
        { email: values.email, password: values.password },
      )
      login(res.data.access_token, res.data.user)
      router.push('/')
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'INVALID_CREDENTIALS') {
        form.setError('root', {
          message: 'メールアドレスまたはパスワードが正しくありません',
        })
      } else {
        form.setError('root', {
          message: 'ログインに失敗しました。しばらく経ってから再度お試しください。',
        })
      }
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* サーバーエラー */}
              {form.formState.errors.root && (
                <div
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {form.formState.errors.root.message}
                </div>
              )}

              {/* メールアドレス */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メールアドレス</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="例: yamada@example.com"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* パスワード */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="パスワードを入力"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}
