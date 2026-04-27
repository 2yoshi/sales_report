import { z } from 'zod'

const customerBaseSchema = z.object({
  name: z
    .string({ required_error: '顧客名は必須です' })
    .min(1, '顧客名は必須です')
    .max(100, '顧客名は100文字以内で入力してください'),
  company: z
    .string()
    .max(200, '会社名は200文字以内で入力してください')
    .optional(),
  phone: z
    .string()
    .max(20, '電話番号は20文字以内で入力してください')
    .optional(),
  email: z
    .string()
    .email('メール形式で入力してください')
    .optional()
    .or(z.literal('')),
})

export const createCustomerSchema = customerBaseSchema
export const updateCustomerSchema = customerBaseSchema

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
