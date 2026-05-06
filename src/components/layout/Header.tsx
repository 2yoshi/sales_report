'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  href: string
  roles: UserRole[] | 'all'
}

const NAV_ITEMS: NavItem[] = [
  { label: 'ダッシュボード', href: '/', roles: 'all' },
  { label: '顧客マスタ', href: '/customers', roles: 'all' },
  { label: '営業マスタ', href: '/users', roles: ['admin'] },
]

export function Header() {
  const { user, token, logout } = useAuth()
  const router = useRouter()

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.roles === 'all') return true
    if (!user) return false
    return item.roles.includes(user.role)
  })

  async function handleLogout() {
    try {
      if (token) {
        await apiClient.post('/api/auth/logout')
      }
    } catch {
      // ログアウトAPIが失敗してもローカル状態はクリアする
    } finally {
      logout()
      router.push('/login')
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* ロゴ */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity"
        >
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
          <span>営業日報システム</span>
        </Link>

        {/* ナビゲーション */}
        {user && (
          <nav aria-label="メインナビゲーション">
            <ul className="flex items-center gap-1">
              {visibleNavItems.map((item) => (
                <li key={item.href}>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* ユーザーメニュー */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
                aria-label={`ユーザーメニュー: ${user.name}`}
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}
