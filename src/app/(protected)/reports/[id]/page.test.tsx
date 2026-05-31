import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportDetailPage from './page'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'

// Next.js のルーターをモック
const mockPush = vi.fn()
const mockParams = vi.fn(() => ({ id: 'report-id-1' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    code: string
    status?: number
    constructor(code: string, message: string, details?: unknown, status?: number) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiClientError'
    }
  },
}))

// ReportForm をモックして、テストを単純化
vi.mock('@/components/reports/ReportForm', () => ({
  ReportForm: ({
    onSubmit,
    onCancel,
    serverError,
    isEditMode,
  }: {
    onSubmit: (values: unknown) => Promise<void>
    onCancel: () => void
    serverError?: string | null
    isEditMode?: boolean
  }) => (
    <div data-testid="report-form">
      {serverError && <div role="alert">{serverError}</div>}
      <span>{isEditMode ? '編集フォーム' : '新規フォーム'}</span>
      <button
        onClick={() =>
          void onSubmit({
            report_date: '2026-05-01',
            problem: '課題テスト',
            plan: '明日の計画',
            visit_records: [{ customer_id: 'customer-1', content: '訪問内容' }],
          })
        }
      >
        更新
      </button>
      <button onClick={onCancel}>キャンセル</button>
    </div>
  ),
}))

const salesUser = {
  id: 'user-sales-1',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales' as const,
}

const managerUser = {
  id: 'user-manager-1',
  name: '田中 部長',
  email: 'tanaka@test.com',
  role: 'manager' as const,
}

const adminUser = {
  id: 'user-admin-1',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin' as const,
}

const mockReport = {
  id: 'report-id-1',
  report_date: '2026-05-01',
  problem: '課題・相談の内容',
  plan: '明日やること',
  user: { id: 'user-sales-1', name: '山田 太郎' },
  visit_records: [
    {
      id: 'vr-1',
      sort_order: 1,
      customer: { id: 'customer-1', name: '株式会社A', company: '株式会社A' },
      content: '訪問内容1',
    },
    {
      id: 'vr-2',
      sort_order: 2,
      customer: { id: 'customer-2', name: '有限会社B', company: null },
      content: '訪問内容2',
    },
  ],
  created_at: '2026-05-01T09:00:00Z',
  updated_at: '2026-05-01T09:00:00Z',
}

const mockComments = [
  {
    id: 'comment-1',
    body: 'コメント本文',
    user: { id: 'user-manager-1', name: '田中 部長' },
    created_at: '2026-05-01T18:00:00Z',
  },
]

function setupAuthAs(user: typeof salesUser | typeof managerUser | typeof adminUser) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    token: 'test-token',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })
}

function setupApiSuccess() {
  vi.mocked(apiClient.get).mockImplementation((path: string) => {
    if (path.includes('/comments')) {
      return Promise.resolve({ data: mockComments })
    }
    return Promise.resolve({ data: mockReport })
  })
}

beforeEach(() => {
  mockPush.mockReset()
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.put).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('ReportDetailPage', () => {
  describe('ローディング状態', () => {
    it('認証ロード中はローディング表示になる', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        token: null,
        isLoading: true,
        login: vi.fn(),
        logout: vi.fn(),
      })
      render(<ReportDetailPage />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })

    it('データ取得中はローディング表示になる', async () => {
      setupAuthAs(salesUser)
      vi.mocked(apiClient.get).mockImplementation(
        () => new Promise(() => {}), // resolve しない
      )
      render(<ReportDetailPage />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })
  })

  describe('エラー状態', () => {
    it('404エラー時は「日報が見つかりませんでした」と表示される', async () => {
      setupAuthAs(salesUser)
      vi.mocked(apiClient.get).mockRejectedValue(
        new ApiClientError('NOT_FOUND', '日報が見つかりません', undefined, 404),
      )
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByText('日報が見つかりませんでした')).toBeInTheDocument()
      })
    })

    it('エラー時は「一覧へ戻る」リンクが表示される', async () => {
      setupAuthAs(salesUser)
      vi.mocked(apiClient.get).mockRejectedValue(
        new ApiClientError('SERVER_ERROR', 'サーバーエラー', undefined, 500),
      )
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByText('一覧へ戻る')).toBeInTheDocument()
      })
    })
  })

  describe('正常表示', () => {
    it('担当者名と対象日が表示される', async () => {
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByText('山田 太郎')).toBeInTheDocument()
        expect(screen.getByText('2026/05/01')).toBeInTheDocument()
      })
    })

    it('訪問記録がsort_order順に表示される', async () => {
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByText('株式会社A')).toBeInTheDocument()
        expect(screen.getByText('有限会社B')).toBeInTheDocument()
        expect(screen.getByText('訪問内容1')).toBeInTheDocument()
        expect(screen.getByText('訪問内容2')).toBeInTheDocument()
      })
    })

    it('Problem・Plan が表示される', async () => {
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByText('課題・相談の内容')).toBeInTheDocument()
        expect(screen.getByText('明日やること')).toBeInTheDocument()
      })
    })

    it('「一覧へ」リンクが表示される', async () => {
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('link', { name: /一覧へ/ })).toBeInTheDocument()
      })
    })
  })

  describe('権限別UI制御', () => {
    it('日報作成者（sales本人）には編集・削除ボタンが表示される', async () => {
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument()
      })
    })

    it('manager には編集・削除ボタンが表示されない', async () => {
      setupAuthAs(managerUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument()
      })
    })

    it('admin には編集・削除ボタンが表示されない（作成者でないため）', async () => {
      setupAuthAs(adminUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument()
      })
    })
  })

  describe('編集モード', () => {
    it('編集ボタンをクリックすると編集フォームが表示される', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /編集/ }))

      expect(screen.getByTestId('report-form')).toBeInTheDocument()
      expect(screen.getByText('編集フォーム')).toBeInTheDocument()
    })

    it('編集モード中は編集・削除ボタンが非表示になる', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /編集/ }))

      expect(screen.queryByRole('button', { name: /編集/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /削除/ })).not.toBeInTheDocument()
    })

    it('更新成功後、詳細表示モードに戻る', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      vi.mocked(apiClient.put).mockResolvedValue({ data: mockReport })
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /編集/ }))
      await user.click(screen.getByRole('button', { name: '更新' }))

      await waitFor(() => {
        expect(screen.queryByTestId('report-form')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })
    })

    it('更新失敗時にエラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      vi.mocked(apiClient.put).mockRejectedValue(
        new ApiClientError('SERVER_ERROR', '更新に失敗しました'),
      )
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /編集/ }))
      await user.click(screen.getByRole('button', { name: '更新' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('更新に失敗しました')
      })
    })

    it('キャンセル確認で承認すると詳細表示に戻る', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /編集/ }))
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(screen.queryByTestId('report-form')).not.toBeInTheDocument()
    })

    it('キャンセル確認で拒否すると編集モードのまま', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /編集/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /編集/ }))
      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(screen.getByTestId('report-form')).toBeInTheDocument()
    })
  })

  describe('削除機能', () => {
    it('削除ボタンをクリックして確認ダイアログを承認すると DELETE が呼ばれて一覧に遷移する', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(apiClient.delete).toHaveBeenCalledWith('/api/reports/report-id-1')
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })

    it('削除ボタンをクリックして確認ダイアログをキャンセルすると削除されない', async () => {
      const user = userEvent.setup()
      setupAuthAs(salesUser)
      setupApiSuccess()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /削除/ }))

      expect(apiClient.delete).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('APIコール', () => {
    it('ページロード時に GET /api/reports/:id と GET /api/reports/:id/comments が呼ばれる', async () => {
      setupAuthAs(salesUser)
      setupApiSuccess()
      render(<ReportDetailPage />)
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/reports/report-id-1')
        expect(apiClient.get).toHaveBeenCalledWith('/api/reports/report-id-1/comments')
      })
    })
  })
})
