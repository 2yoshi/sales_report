'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/layout/Header'
import { setOnUnauthorized } from '@/lib/api-client'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()

  // 401 時のコールバックを登録
  useEffect(() => {
    setOnUnauthorized(() => {
      logout()
      router.push('/login')
    })
    return () => setOnUnauthorized(() => {})
  }, [logout, router])

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">読み込み中...</div>
      </div>
    )
  }

  if (!user) {
    // リダイレクト中は何も表示しない
    return null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
