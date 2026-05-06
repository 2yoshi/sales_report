import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ダッシュボード | 営業日報システム',
}

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">ダッシュボード</h1>
      <p className="mt-2 text-muted-foreground">日報の一覧がここに表示されます。</p>
    </div>
  )
}
