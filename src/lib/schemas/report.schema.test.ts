import { describe, it, expect } from 'vitest'
import { createReportSchema, updateReportSchema } from './report.schema'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const TODAY = new Date().toISOString().slice(0, 10)
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
const FUTURE_DATE = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

const validVisitRecord = {
  customer_id: VALID_UUID,
  content: '商談内容',
  sort_order: 0,
}

const validCreateInput = {
  report_date: TODAY,
  problem: '課題内容',
  plan: '翌日の予定',
  visit_records: [validVisitRecord],
}

describe('createReportSchema', () => {
  describe('正常系', () => {
    it('有効なデータでパースできる', () => {
      const result = createReportSchema.safeParse(validCreateInput)
      expect(result.success).toBe(true)
    })

    it('複数の訪問記録でパースできる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        visit_records: [
          { customer_id: VALID_UUID, content: '訪問A', sort_order: 0 },
          { customer_id: VALID_UUID, content: '訪問B', sort_order: 1 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('昨日の日付を使用できる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        report_date: YESTERDAY,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('report_date フィールド', () => {
    it('report_date が未来の日付の場合はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        report_date: FUTURE_DATE,
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'report_date')
      expect(issue?.message).toBe('対象日に未来の日付は指定できません')
    })

    it('report_date が YYYY-MM-DD 形式でない場合はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        report_date: '2026/04/27',
      })
      expect(result.success).toBe(false)
    })

    it('report_date が未指定の場合はエラーになる', () => {
      const { report_date: _, ...rest } = validCreateInput
      const result = createReportSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('存在しない日付（2026-02-30）はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        report_date: '2026-02-30',
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'report_date')
      expect(issue?.message).toBe('対象日に存在しない日付は指定できません')
    })

    it('存在しない日付（2026-13-01）はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        report_date: '2026-13-01',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('problem フィールド', () => {
    it('2000 文字以内ならパースできる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        problem: 'a'.repeat(2000),
      })
      expect(result.success).toBe(true)
    })

    it('2001 文字以上はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        problem: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'problem')
      expect(issue?.message).toBe('課題は2000文字以内で入力してください')
    })

    it('problem が空の場合はエラーになる', () => {
      const result = createReportSchema.safeParse({ ...validCreateInput, problem: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('plan フィールド', () => {
    it('2000 文字以内ならパースできる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        plan: 'a'.repeat(2000),
      })
      expect(result.success).toBe(true)
    })

    it('2001 文字以上はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        plan: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'plan')
      expect(issue?.message).toBe('翌日の予定は2000文字以内で入力してください')
    })
  })

  describe('visit_records フィールド', () => {
    it('visit_records が空配列の場合はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        visit_records: [],
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find((i) => i.path[0] === 'visit_records')
      expect(issue?.message).toBe('訪問記録は1件以上必要です')
    })

    it('visit_records の content が 1000 文字超はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        visit_records: [{ ...validVisitRecord, content: 'a'.repeat(1001) }],
      })
      expect(result.success).toBe(false)
      if (result.success) return
      const issue = result.error.issues.find(
        (i) => i.path[0] === 'visit_records' && i.path[2] === 'content',
      )
      expect(issue?.message).toBe('訪問内容は1000文字以内で入力してください')
    })

    it('visit_records の customer_id が UUID 形式でない場合はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        visit_records: [{ ...validVisitRecord, customer_id: 'not-a-uuid' }],
      })
      expect(result.success).toBe(false)
    })

    it('visit_records の content が空の場合はエラーになる', () => {
      const result = createReportSchema.safeParse({
        ...validCreateInput,
        visit_records: [{ ...validVisitRecord, content: '' }],
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('updateReportSchema', () => {
  const validUpdateInput = {
    problem: '課題内容',
    plan: '翌日の予定',
    visit_records: [validVisitRecord],
  }

  it('report_date を含まない有効なデータでパースできる', () => {
    const result = updateReportSchema.safeParse(validUpdateInput)
    expect(result.success).toBe(true)
  })

  it('report_date を含んでいても問題なくパースできる（スキーマは strip する）', () => {
    // updateReportSchema は report_date を持たないが、
    // Zod のデフォルト挙動 (strip) により余分なフィールドは無視される
    const result = updateReportSchema.safeParse({
      ...validUpdateInput,
      report_date: TODAY,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect((result.data as Record<string, unknown>).report_date).toBeUndefined()
  })

  it('visit_records が空の場合はエラーになる', () => {
    const result = updateReportSchema.safeParse({ ...validUpdateInput, visit_records: [] })
    expect(result.success).toBe(false)
  })
})
