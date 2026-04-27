import { z } from 'zod'

export const createCommentSchema = z.object({
  body: z
    .string({ required_error: 'コメント内容は必須です' })
    .min(1, 'コメント内容は必須です')
    .max(2000, 'コメントは2000文字以内で入力してください'),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
