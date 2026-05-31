'use client'

import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient, ApiClientError } from '@/lib/api-client'
import { getTodayJst } from '@/lib/format'
import type { PaginatedResponse } from '@/types'

interface CustomerOption {
  id: string
  name: string
  company: string | null
}

const visitRecordFormSchema = z.object({
  customer_id: z.string().min(1, '顧客を選択してください'),
  content: z
    .string()
    .min(1, '訪問内容を入力してください')
    .max(1000, '訪問内容は1000文字以内で入力してください'),
})

const reportFormSchema = z.object({
  report_date: z
    .string()
    .min(1, '対象日を入力してください')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '対象日はYYYY-MM-DD形式で入力してください')
    .refine((val) => {
      const date = new Date(val)
      return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === val
    }, '存在しない日付は指定できません')
    .refine((val) => val <= getTodayJst(), '未来の日付は指定できません'),
  problem: z
    .string()
    .min(1, '課題・相談を入力してください')
    .max(2000, '課題・相談は2000文字以内で入力してください'),
  plan: z
    .string()
    .min(1, '明日やることを入力してください')
    .max(2000, '明日やることは2000文字以内で入力してください'),
  visit_records: z
    .array(visitRecordFormSchema)
    .min(1, '訪問記録は1件以上追加してください'),
})

export type ReportFormValues = z.infer<typeof reportFormSchema>

interface ReportFormProps {
  onSubmit: (values: ReportFormValues) => Promise<void>
  onCancel: () => void
  serverError?: string | null
}

export function ReportForm({ onSubmit, onCancel, serverError }: ReportFormProps) {
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [customersError, setCustomersError] = useState<string | null>(null)

  const todayJst = getTodayJst()

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      report_date: todayJst,
      problem: '',
      plan: '',
      visit_records: [{ customer_id: '', content: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'visit_records',
  })

  const { isSubmitting } = form.formState

  useEffect(() => {
    async function fetchAllCustomers() {
      setCustomersLoading(true)
      setCustomersError(null)
      try {
        const allCustomers: CustomerOption[] = []
        let page = 1
        while (true) {
          const res = await apiClient.get<PaginatedResponse<CustomerOption>>(
            `/api/customers?per_page=100&page=${page}`,
          )
          allCustomers.push(...res.data)
          if (allCustomers.length >= res.meta.total) break
          page++
        }
        setCustomers(allCustomers)
      } catch (err) {
        if (err instanceof ApiClientError) {
          setCustomersError(err.message)
        } else {
          setCustomersError('顧客一覧の取得に失敗しました')
        }
      } finally {
        setCustomersLoading(false)
      }
    }
    void fetchAllCustomers()
  }, [])

  function handleAddVisitRecord() {
    append({ customer_id: '', content: '' })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="space-y-6"
      >
        {serverError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}

        <FormField
          control={form.control}
          name="report_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                対象日 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="date"
                  max={todayJst}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              訪問記録 <span className="text-destructive">*</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVisitRecord}
              disabled={isSubmitting}
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              訪問先を追加
            </Button>
          </div>

          {(form.formState.errors.visit_records?.root?.message ??
            form.formState.errors.visit_records?.message) && (
            <p className="text-sm text-destructive">
              {form.formState.errors.visit_records?.root?.message ??
                form.formState.errors.visit_records?.message}
            </p>
          )}

          {customersError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {customersError}
            </div>
          )}

          {fields.map((fieldItem, index) => (
            <div
              key={fieldItem.id}
              className="rounded-md border bg-muted/30 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  訪問先 {index + 1}
                </span>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => remove(index)}
                    disabled={isSubmitting}
                    aria-label={`訪問先 ${index + 1} を削除`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    削除
                  </Button>
                )}
              </div>

              <FormField
                control={form.control}
                name={`visit_records.${index}.customer_id`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>顧客 <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isSubmitting || customersLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              customersLoading ? '読み込み中...' : '顧客を選択してください'
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                            {customer.company ? `（${customer.company}）` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`visit_records.${index}.content`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      訪問内容 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="訪問内容を入力してください（1000文字以内）"
                        className="min-h-[100px]"
                        maxLength={1000}
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>

        <FormField
          control={form.control}
          name="problem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Problem（課題・相談） <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="課題・相談を入力してください（2000文字以内）"
                  className="min-h-[120px]"
                  maxLength={2000}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Plan（明日やること） <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="明日やることを入力してください（2000文字以内）"
                  className="min-h-[120px]"
                  maxLength={2000}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '提出中...' : '提出'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
