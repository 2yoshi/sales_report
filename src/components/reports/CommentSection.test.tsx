import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentSection, type Comment } from './CommentSection'
import { apiClient, ApiClientError } from '@/lib/api-client'
import type { AuthUser } from '@/types'

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

const reportId = '550e8400-e29b-41d4-a716-446655440000'

const managerUser: AuthUser = {
  id: 'user-manager-1',
  name: '田中 部長',
  email: 'tanaka@test.com',
  role: 'manager',
}

const adminUser: AuthUser = {
  id: 'user-admin-1',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

const salesUser: AuthUser = {
  id: 'user-sales-1',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

const mockComments: Comment[] = [
  {
    id: 'comment-1',
    body: 'コメント本文1',
    commenter: { id: 'user-manager-1', name: '田中 部長', role: 'manager' },
    created_at: '2026-05-01T10:00:00Z',
  },
  {
    id: 'comment-2',
    body: 'コメント本文2',
    commenter: { id: 'user-manager-2', name: '佐藤 部長', role: 'manager' },
    created_at: '2026-05-01T09:00:00Z',
  },
]

const mockOnCommentsChange = vi.fn()

function renderCommentSection(
  currentUser: AuthUser,
  comments: Comment[] = [],
) {
  return render(
    <CommentSection
      reportId={reportId}
      comments={comments}
      currentUser={currentUser}
      onCommentsChange={mockOnCommentsChange}
    />,
  )
}

beforeEach(() => {
  mockOnCommentsChange.mockReset()
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('CommentSection', () => {
  describe('コメント一覧表示', () => {
    it('コメントがない場合、「コメントはまだありません」と表示される', () => {
      renderCommentSection(managerUser, [])
      expect(screen.getByText('コメントはまだありません')).toBeInTheDocument()
    })

    it('コメントが存在する場合、投稿者名・本文が表示される', () => {
      renderCommentSection(managerUser, mockComments)
      expect(screen.getByText('田中 部長')).toBeInTheDocument()
      expect(screen.getByText('コメント本文1')).toBeInTheDocument()
      expect(screen.getByText('佐藤 部長')).toBeInTheDocument()
      expect(screen.getByText('コメント本文2')).toBeInTheDocument()
    })
  })

  describe('権限別UI制御', () => {
    it('manager はコメント投稿フォームが表示される', () => {
      renderCommentSection(managerUser, [])
      expect(screen.getByRole('button', { name: 'コメントを投稿' })).toBeInTheDocument()
    })

    it('admin はコメント投稿フォームが表示される', () => {
      renderCommentSection(adminUser, [])
      expect(screen.getByRole('button', { name: 'コメントを投稿' })).toBeInTheDocument()
    })

    it('sales はコメント投稿フォームが表示されない', () => {
      renderCommentSection(salesUser, [])
      expect(screen.queryByRole('button', { name: 'コメントを投稿' })).not.toBeInTheDocument()
    })

    it('manager は自分のコメントの削除ボタンが表示される', () => {
      renderCommentSection(managerUser, mockComments)
      expect(screen.getByLabelText('田中 部長のコメントを削除')).toBeInTheDocument()
    })

    it('manager は他人のコメントの削除ボタンが表示されない', () => {
      renderCommentSection(managerUser, mockComments)
      expect(screen.queryByLabelText('佐藤 部長のコメントを削除')).not.toBeInTheDocument()
    })

    it('admin は全コメントの削除ボタンが表示される', () => {
      renderCommentSection(adminUser, mockComments)
      expect(screen.getByLabelText('田中 部長のコメントを削除')).toBeInTheDocument()
      expect(screen.getByLabelText('佐藤 部長のコメントを削除')).toBeInTheDocument()
    })

    it('sales はコメントの削除ボタンが表示されない', () => {
      renderCommentSection(salesUser, mockComments)
      expect(screen.queryByLabelText(/のコメントを削除/)).not.toBeInTheDocument()
    })
  })

  describe('コメント投稿', () => {
    it('コメントを入力して投稿すると POST /api/reports/:id/comments が呼ばれる', async () => {
      const user = userEvent.setup()
      const newComment: Comment = {
        id: 'comment-new',
        body: '新しいコメント',
        commenter: { id: 'user-manager-1', name: '田中 部長', role: 'manager' },
        created_at: '2026-05-02T10:00:00Z',
      }
      vi.mocked(apiClient.post).mockResolvedValue({ data: newComment })

      renderCommentSection(managerUser, mockComments)

      const textarea = screen.getByPlaceholderText(/コメントを入力してください/)
      await user.type(textarea, '新しいコメント')

      await user.click(screen.getByRole('button', { name: 'コメントを投稿' }))

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalledWith(
          `/api/reports/${reportId}/comments`,
          { body: '新しいコメント' },
        )
      })
    })

    it('投稿成功後、コメント一覧が更新され、フォームがリセットされる', async () => {
      const user = userEvent.setup()
      const newComment: Comment = {
        id: 'comment-new',
        body: '新しいコメント',
        commenter: { id: 'user-manager-1', name: '田中 部長', role: 'manager' },
        created_at: '2026-05-02T10:00:00Z',
      }
      vi.mocked(apiClient.post).mockResolvedValue({ data: newComment })

      renderCommentSection(managerUser, mockComments)

      const textarea = screen.getByPlaceholderText(/コメントを入力してください/)
      await user.type(textarea, '新しいコメント')
      await user.click(screen.getByRole('button', { name: 'コメントを投稿' }))

      await waitFor(() => {
        expect(mockOnCommentsChange).toHaveBeenCalledWith([newComment, ...mockComments])
      })

      // フォームがリセットされている
      expect((textarea as HTMLTextAreaElement).value).toBe('')
    })

    it('コメントが空のまま投稿するとバリデーションエラーが表示される', async () => {
      const user = userEvent.setup()
      renderCommentSection(managerUser, [])

      await user.click(screen.getByRole('button', { name: 'コメントを投稿' }))

      await waitFor(() => {
        expect(screen.getByText('コメントを入力してください')).toBeInTheDocument()
      })
    })

    it('コメントが2000文字を超えるとバリデーションエラーが表示される', async () => {
      const user = userEvent.setup()
      renderCommentSection(managerUser, [])

      const textarea = screen.getByPlaceholderText(/コメントを入力してください/) as HTMLTextAreaElement
      fireEvent.change(textarea, { target: { value: 'a'.repeat(2001) } })

      await user.click(screen.getByRole('button', { name: 'コメントを投稿' }))

      await waitFor(() => {
        expect(screen.getByText('コメントは2000文字以内で入力してください')).toBeInTheDocument()
      })
    })

    it('投稿失敗時にエラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      vi.mocked(apiClient.post).mockRejectedValue(
        new ApiClientError('SERVER_ERROR', 'サーバーエラーが発生しました'),
      )

      renderCommentSection(managerUser, [])

      const textarea = screen.getByPlaceholderText(/コメントを入力してください/)
      await user.type(textarea, 'テストコメント')
      await user.click(screen.getByRole('button', { name: 'コメントを投稿' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('サーバーエラーが発生しました')
      })
    })
  })

  describe('コメント削除', () => {
    it('削除ボタンをクリックして確認ダイアログを承認するとコメントが削除される', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      renderCommentSection(adminUser, mockComments)

      await user.click(screen.getByLabelText('田中 部長のコメントを削除'))

      await waitFor(() => {
        expect(apiClient.delete).toHaveBeenCalledWith(
          `/api/reports/${reportId}/comments/comment-1`,
        )
        expect(mockOnCommentsChange).toHaveBeenCalledWith(
          mockComments.filter((c) => c.id !== 'comment-1'),
        )
      })
    })

    it('削除ボタンをクリックして確認ダイアログをキャンセルすると削除されない', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderCommentSection(adminUser, mockComments)

      await user.click(screen.getByLabelText('田中 部長のコメントを削除'))

      expect(apiClient.delete).not.toHaveBeenCalled()
    })

    it('削除失敗時にエラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      vi.mocked(apiClient.delete).mockRejectedValue(
        new ApiClientError('SERVER_ERROR', '削除に失敗しました'),
      )

      renderCommentSection(adminUser, mockComments)

      await user.click(screen.getByLabelText('田中 部長のコメントを削除'))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('削除に失敗しました')
      })
    })
  })
})
