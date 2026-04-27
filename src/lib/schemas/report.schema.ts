import { z } from 'zod'

const visitRecordSchema = z.object({
  customer_id: z
    .string({ required_error: '顧客IDは必須です' })
    .uuid('顧客IDはUUID形式で入力してください'),
  content: z
    .string({ required_error: '訪問内容は必須です' })
    .min(1, '訪問内容は必須です')
    .max(1000, '訪問内容は1000文字以内で入力してください'),
  sort_order: z
    .number({ required_error: '並び順は必須です' })
    .int('並び順は整数で入力してください')
    .min(0, '並び順は0以上で入力してください'),
})

export type VisitRecordInput = z.infer<typeof visitRecordSchema>

const reportBaseSchema = z.object({
  problem: z
    .string({ required_error: '課題は必須です' })
    .min(1, '課題は必須です')
    .max(2000, '課題は2000文字以内で入力してください'),
  plan: z
    .string({ required_error: '翌日の予定は必須です' })
    .min(1, '翌日の予定は必須です')
    .max(2000, '翌日の予定は2000文字以内で入力してください'),
  visit_records: z
    .array(visitRecordSchema)
    .min(1, '訪問記録は1件以上必要です'),
})

export const createReportSchema = reportBaseSchema.extend({
  report_date: z
    .string({ required_error: '対象日は必須です' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, '対象日はYYYY-MM-DD形式で入力してください')
    .refine((val) => {
      // 存在しない日付（例: 2026-02-30）を弾く
      const date = new Date(val)
      return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === val
    }, '対象日に存在しない日付は指定できません')
    .refine((val) => {
      // JST基準（Asia/Tokyo, UTC+9）で「今日」を取得して比較する
      const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
      const todayJst = nowJst.toISOString().slice(0, 10)
      return val <= todayJst
    }, '対象日に未来の日付は指定できません'),
})

export const updateReportSchema = reportBaseSchema

export type CreateReportInput = z.infer<typeof createReportSchema>
export type UpdateReportInput = z.infer<typeof updateReportSchema>
