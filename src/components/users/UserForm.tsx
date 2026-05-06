'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ROLE_LABELS } from '@/lib/users/constants'
import type { UserRole } from '@/types'

const createUserSchema = z.object({
  name: z.string().min(1, '氏名は必須です').max(100, '100文字以内で入力してください'),
  email: z.string().min(1, 'メールアドレスは必須です').email('メール形式で入力してください'),
  password: z.string().min(8, '8文字以上で入力してください'),
  role: z.enum(['sales', 'manager', 'admin'], { required_error: 'ロールを選択してください' }),
})

const updateUserSchema = z.object({
  name: z.string().min(1, '氏名は必須です').max(100, '100文字以内で入力してください'),
  email: z.string().min(1, 'メールアドレスは必須です').email('メール形式で入力してください'),
  password: z.string().min(8, '8文字以上で入力してください').or(z.literal('')),
  role: z.enum(['sales', 'manager', 'admin'], { required_error: 'ロールを選択してください' }),
})

export type UserFormValues = {
  name: string
  email: string
  password: string
  role: UserRole
}

interface UserFormProps {
  mode: 'create' | 'edit'
  defaultValues?: UserFormValues
  onSubmit: (values: UserFormValues) => Promise<void>
  onCancel?: () => void
  submitLabel: string
  serverError?: string | null
}

export function UserForm({
  mode,
  defaultValues = { name: '', email: '', password: '', role: 'sales' },
  onSubmit,
  onCancel,
  submitLabel,
  serverError,
}: UserFormProps) {
  const router = useRouter()
  const schema = mode === 'create' ? createUserSchema : updateUserSchema

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const { isSubmitting } = form.formState

  function handleCancel() {
    if (onCancel) {
      onCancel()
    } else {
      router.push('/users')
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        {/* 氏名 */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                氏名 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="例: 山田 太郎" disabled={isSubmitting} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* メールアドレス */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                メールアドレス <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="例: yamada@example.com"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* パスワード */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                パスワード{' '}
                {mode === 'create' ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs text-muted-foreground">（変更する場合のみ入力）</span>
                )}
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={mode === 'create' ? '8文字以上' : '変更しない場合は空欄'}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ロール */}
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                ロール <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex gap-6"
                  disabled={isSubmitting}
                >
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                    <div key={role} className="flex items-center gap-2">
                      <RadioGroupItem value={role} id={`role-${role}`} />
                      <label htmlFor={`role-${role}`} className="cursor-pointer text-sm">
                        {label}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleCancel}>
            キャンセル
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}
