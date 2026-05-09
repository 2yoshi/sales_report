import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportForm } from './ReportForm'
import { apiClient } from '@/lib/api-client'

// apiClient をモック
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
      this.name = 'ApiClientError'
    }
  },
}))

const mockCustomers = [
  { id: '550e8400-e29b-41d4-a716-446655440001', name: '株式会社A', company: '株式会社A' },
  { id: '550e8400-e29b-41d4-a716-446655440002', name: '株式会社B', company: null },
]

const mockOnSubmit = vi.fn()
const mockOnCancel = vi.fn()

function renderReportForm(props?: { serverError?: string | null }) {
  return render(
    <ReportForm
      onSubmit={mockOnSubmit}
      onCancel={mockOnCancel}
      serverError={props?.serverError}
    />,
  )
}

// 顧客一覧のロード完了を待つヘルパー
async function waitForCustomersLoaded() {
  // 顧客セレクトがロード中でなくなるまで待つ（Select が有効化される）
  await waitFor(() => {
    expect(apiClient.get).toHaveBeenCalledWith('/api/customers?per_page=100')
  })
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({
    data: mockCustomers,
    meta: { total: 2, page: 1, per_page: 100 },
  })
  mockOnSubmit.mockReset()
  mockOnCancel.mockReset()
})

describe('ReportForm', () => {
  describe('初期表示', () => {
    it('対象日フィールドがデフォルトで今日の日付になっている', async () => {
      renderReportForm()
      await waitForCustomersLoaded()

      // JST基準で今日の日付を算出
      const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const todayJst = nowJst.toISOString().slice(0, 10)

      const dateInput = screen.getByLabelText(/対象日/) as HTMLInputElement
      expect(dateInput.value).toBe(todayJst)
    })

    it('初期状態で訪問記録が1件表示されている', async () => {
      renderReportForm()
      await waitForCustomersLoaded()

      expect(screen.getByText('訪問先 1')).toBeInTheDocument()
    })

    it('訪問記録が1件のときは削除ボタンが表示されない', async () => {
      renderReportForm()
      await waitForCustomersLoaded()

      expect(screen.queryByLabelText(/訪問先 1 を削除/)).not.toBeInTheDocument()
    })

    it('"訪問先を追加" ボタンが表示されている', async () => {
      renderReportForm()
      await waitForCustomersLoaded()

      expect(screen.getByRole('button', { name: /訪問先を追加/ })).toBeInTheDocument()
    })

    it('"提出" ボタンが表示されている', async () => {
      renderReportForm()
      await waitForCustomersLoaded()

      expect(screen.getByRole('button', { name: '提出' })).toBeInTheDocument()
    })

    it('"キャンセル" ボタンが表示されている', async () => {
      renderReportForm()
      await waitForCustomersLoaded()

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })
  })

  describe('顧客一覧の読み込み', () => {
    it('顧客一覧が /api/customers?per_page=100 から取得される', async () => {
      renderReportForm()
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/api/customers?per_page=100')
      })
    })

    it('顧客一覧の取得失敗時にエラーメッセージが表示される', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'))
      renderReportForm()
      await waitFor(() => {
        expect(screen.getByText('顧客一覧の取得に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('訪問記録の動的追加・削除', () => {
    it('"訪問先を追加" ボタンをクリックすると訪問記録が増える', async () => {
      const user = userEvent.setup()
      renderReportForm()
      await waitForCustomersLoaded()

      await user.click(screen.getByRole('button', { name: /訪問先を追加/ }))

      expect(screen.getByText('訪問先 1')).toBeInTheDocument()
      expect(screen.getByText('訪問先 2')).toBeInTheDocument()
    })

    it('訪問記録が2件以上のとき削除ボタンが表示される', async () => {
      const user = userEvent.setup()
      renderReportForm()
      await waitForCustomersLoaded()

      await user.click(screen.getByRole('button', { name: /訪問先を追加/ }))

      expect(screen.getByLabelText('訪問先 1 を削除')).toBeInTheDocument()
      expect(screen.getByLabelText('訪問先 2 を削除')).toBeInTheDocument()
    })

    it('削除ボタンをクリックすると該当行が削除される', async () => {
      const user = userEvent.setup()
      renderReportForm()
      await waitForCustomersLoaded()

      await user.click(screen.getByRole('button', { name: /訪問先を追加/ }))
      expect(screen.getByText('訪問先 2')).toBeInTheDocument()

      await user.click(screen.getByLabelText('訪問先 2 を削除'))

      expect(screen.queryByText('訪問先 2')).not.toBeInTheDocument()
      expect(screen.getByText('訪問先 1')).toBeInTheDocument()
    })

    it('削除後に1件になると削除ボタンが非表示になる', async () => {
      const user = userEvent.setup()
      renderReportForm()
      await waitForCustomersLoaded()

      await user.click(screen.getByRole('button', { name: /訪問先を追加/ }))
      await user.click(screen.getByLabelText('訪問先 2 を削除'))

      expect(screen.queryByLabelText(/を削除/)).not.toBeInTheDocument()
    })
  })

  describe('バリデーション', () => {
    it('必須フィールドが空のまま提出するとエラーが表示される', async () => {
      const user = userEvent.setup()
      renderReportForm()
      await waitForCustomersLoaded()

      await user.click(screen.getByRole('button', { name: '提出' }))

      await waitFor(() => {
        expect(screen.getByText('課題・相談を入力してください')).toBeInTheDocument()
      })
      expect(screen.getByText('明日やることを入力してください')).toBeInTheDocument()
    })

    it('訪問内容が1000文字を超えた場合はエラーが表示される', async () => {
      const user = userEvent.setup()
      const { container } = renderReportForm()
      await waitForCustomersLoaded()

      // textarea に直接 1001文字を input イベントで設定する
      const contentField = container.querySelector('textarea[name="visit_records.0.content"]') as HTMLTextAreaElement
      await user.click(contentField)
      // fireEvent.change で直接設定
      const { fireEvent } = await import('@testing-library/react')
      fireEvent.change(contentField, { target: { value: 'a'.repeat(1001) } })

      await user.click(screen.getByRole('button', { name: '提出' }))

      await waitFor(() => {
        expect(screen.getByText('訪問内容は1000文字以内で入力してください')).toBeInTheDocument()
      })
    })

    it('課題・相談が2000文字を超えた場合はエラーが表示される', async () => {
      const user = userEvent.setup()
      const { container } = renderReportForm()
      await waitForCustomersLoaded()

      const { fireEvent } = await import('@testing-library/react')
      const problemField = container.querySelector('textarea[name="problem"]') as HTMLTextAreaElement
      fireEvent.change(problemField, { target: { value: 'a'.repeat(2001) } })

      await user.click(screen.getByRole('button', { name: '提出' }))

      await waitFor(() => {
        expect(
          screen.getByText('課題・相談は2000文字以内で入力してください'),
        ).toBeInTheDocument()
      })
    })

    it('明日やることが2000文字を超えた場合はエラーが表示される', async () => {
      const user = userEvent.setup()
      const { container } = renderReportForm()
      await waitForCustomersLoaded()

      const { fireEvent } = await import('@testing-library/react')
      const planField = container.querySelector('textarea[name="plan"]') as HTMLTextAreaElement
      fireEvent.change(planField, { target: { value: 'a'.repeat(2001) } })

      await user.click(screen.getByRole('button', { name: '提出' }))

      await waitFor(() => {
        expect(
          screen.getByText('明日やることは2000文字以内で入力してください'),
        ).toBeInTheDocument()
      })
    })
  })

  describe('キャンセルボタン', () => {
    it('キャンセルボタンをクリックすると onCancel が呼ばれる', async () => {
      const user = userEvent.setup()
      renderReportForm()
      await waitForCustomersLoaded()

      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('サーバーエラー表示', () => {
    it('serverError が渡された場合はアラートとして表示される', async () => {
      renderReportForm({ serverError: '同じ日付の日報がすでに存在します。' })
      await waitForCustomersLoaded()

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('同じ日付の日報がすでに存在します。')
    })

    it('serverError が null の場合はアラートが表示されない', async () => {
      renderReportForm({ serverError: null })
      await waitForCustomersLoaded()

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
