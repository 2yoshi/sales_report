import type { Metadata } from 'next'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export const metadata: Metadata = {
  title: 'ダッシュボード | 営業日報システム',
}

export default function DashboardPage() {
  return <DashboardClient />
}
