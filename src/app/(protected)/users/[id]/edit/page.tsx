'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { UserForm, type UserFormValues } from '@/components/users/UserForm'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import type { ApiResponse, UserRole } from '@/types'

interface UserItem {
  id: string
  name: string
  email: string
  role: UserRole
}

export default function EditUserPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const userId = params.id

  const [defaultValues, setDefaultValues] = useState<UserFormValues | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  // admin 以外はトップへリダイレクト
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      router.replace('/')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') return

    async function fetchUser() {
      try {
        const res = await apiClient.get<ApiResponse<UserItem>>(`/api/users/${userId}`)
        const u = res.data
        setDefaultValues({ name: u.name, email: u.email, password: '', role: u.role })
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          setLoadError('ユーザーが見つかりません')
        } else {
          setLoadError('データの取得に失敗しました')
        }
      } finally {
        setIsLoadingUser(false)
      }
    }
    void fetchUser()
  }, [authLoading, user, userId])

  async function handleSubmit(values: UserFormValues) {
    setServerError(null)
    try {
      await apiClient.put(`/api/users/${userId}`, {
        name: values.name,
        email: values.email,
        role: values.role,
        ...(values.password ? { password: values.password } : {}),
      })
      router.push('/users')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS') {
          setServerError('このメールアドレスはすでに使用されています')
        } else {
          setServerError(err.message)
        }
      } else {
        setServerError('保存に失敗しました。しばらく経ってから再度お試しください。')
      }
    }
  }

  if (authLoading || !user) return null
  if (user.role !== 'admin') return null

  if (isLoadingUser) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (loadError || !defaultValues) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold">ユーザー編集</h1>
        <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError ?? 'データの取得に失敗しました'}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">ユーザー編集</h1>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <UserForm
          mode="edit"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          submitLabel="保存"
          serverError={serverError}
        />
      </div>
    </div>
  )
}
