import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'メールアドレスは必須です' })
    .min(1, 'メールアドレスは必須です')
    .email('メール形式で入力してください'),
  password: z
    .string({ required_error: 'パスワードは必須です' })
    .min(1, 'パスワードは必須です'),
})

export type LoginInput = z.infer<typeof loginSchema>
