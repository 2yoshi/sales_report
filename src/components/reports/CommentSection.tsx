'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { formatDateTimeJst } from '@/lib/format'
import type { AuthUser } from '@/types'

export interface Comment {
  id: string
  body: string
  user: { id: string; name: string }
  created_at: string
}

interface CommentSectionProps {
  reportId: string
  comments: Comment[]
  currentUser: AuthUser
  onCommentsChange: (comments: Comment[]) => void
}

const commentFormSchema = z.object({
  body: z
    .string()
    .min(1, 'コメントを入力してください')
    .max(2000, 'コメントは2000文字以内で入力してください'),
})

type CommentFormValues = z.infer<typeof commentFormSchema>


export function CommentSection({
  reportId,
  comments,
  currentUser,
  onCommentsChange,
}: CommentSectionProps) {
  const [postError, setPostError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canPost = currentUser.role === 'manager' || currentUser.role === 'admin'

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { body: '' },
  })

  const { isSubmitting } = form.formState

  async function handlePost(values: CommentFormValues) {
    setPostError(null)
    try {
      const res = await apiClient.post<{ data: Comment }>(
        `/api/reports/${reportId}/comments`,
        { body: values.body },
      )
      // 新しいコメントを先頭に追加（新しい順）
      onCommentsChange([res.data, ...comments])
      form.reset()
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPostError(err.message)
      } else {
        setPostError('コメントの投稿に失敗しました')
      }
    }
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('このコメントを削除してもよいですか？')) return
    setDeleteError(null)
    try {
      await apiClient.delete(`/api/reports/${reportId}/comments/${commentId}`)
      onCommentsChange(comments.filter((c) => c.id !== commentId))
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteError(err.message)
      } else {
        setDeleteError('コメントの削除に失敗しました')
      }
    }
  }

  function canDeleteComment(comment: Comment): boolean {
    if (currentUser.role === 'admin') return true
    return comment.user.id === currentUser.id
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold border-b pb-2">コメント</h2>

      {deleteError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {deleteError}
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">コメントはまだありません</p>
      ) : (
        <ul className="space-y-3" aria-label="コメント一覧">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-md border bg-muted/30 p-4 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {comment.user.name}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {formatDateTimeJst(comment.created_at)}
                  </span>
                </span>
                {canDeleteComment(comment) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => void handleDelete(comment.id)}
                    aria-label={`${comment.user.name}のコメントを削除`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    削除
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canPost && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handlePost)}
            noValidate
            className="space-y-3 pt-2"
          >
            {postError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {postError}
              </div>
            )}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>コメントを追加</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="コメントを入力してください（2000文字以内）"
                      className="min-h-[100px]"
                      maxLength={2000}
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '投稿中...' : 'コメントを投稿'}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
