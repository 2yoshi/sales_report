import { z } from 'zod'

const userRoleSchema = z.enum(['sales', 'manager', 'admin'], {
  required_error: 'ロールは必須です',
  invalid_type_error: 'ロールはsales、manager、adminのいずれかで入力してください',
})

export const createUserSchema = z.object({
  name: z
    .string({ required_error: '氏名は必須です' })
    .min(1, '氏名は必須です')
    .max(100, '氏名は100文字以内で入力してください'),
  email: z
    .string({ required_error: 'メールアドレスは必須です' })
    .min(1, 'メールアドレスは必須です')
    .email('メール形式で入力してください'),
  password: z
    .string({ required_error: 'パスワードは必須です' })
    .min(8, 'パスワードは8文字以上で入力してください'),
  role: userRoleSchema,
})

export const updateUserSchema = createUserSchema.omit({ password: true }).extend({
  password: z
    .string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const listUsersQuerySchema = z.object({
  role: z.enum(['sales', 'manager', 'admin']).optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'pageは1以上で指定してください')),
  per_page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 20))
    .pipe(
      z
        .number()
        .int()
        .min(1, 'per_pageは1以上で指定してください')
        .max(100, 'per_pageは100以下で指定してください'),
    ),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>
