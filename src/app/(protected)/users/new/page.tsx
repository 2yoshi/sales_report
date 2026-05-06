'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserForm, type UserFormValues } from '@/components/users/UserForm'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

export default function NewUserPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  // admin 以外はトップへリダイレクト
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      router.replace('/')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) return null
  if (user.role !== 'admin') return null

  async function handleSubmit(values: UserFormValues) {
    setServerError(null)
    try {
      await apiClient.post('/api/users', {
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">ユーザー登録</h1>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <UserForm
          mode="create"
          onSubmit={handleSubmit}
          submitLabel="登録"
          serverError={serverError}
        />
      </div>
    </div>
  )
}
