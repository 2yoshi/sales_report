/**
 * 訪問先顧客名の省略表示ロジック
 * - 1社: 顧客名をそのまま表示
 * - 2社: 「顧客A、顧客B」
 * - 3社以上: 「顧客A、顧客B 他N社」
 */
export function formatVisitCustomers(
  customers: { name: string }[],
): string {
  if (customers.length === 0) return '-'
  if (customers.length === 1) return customers[0].name
  if (customers.length === 2) return `${customers[0].name}、${customers[1].name}`

  const rest = customers.length - 2
  return `${customers[0].name}、${customers[1].name} 他${rest}社`
}

/**
 * 日付文字列をYYYY/MM/DD形式に変換
 */
export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}/${month}/${day}`
}

/**
 * JST基準で今日の日付を返す（YYYY-MM-DD形式）
 */
export function getTodayJst(): string {
  const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return nowJst.toISOString().slice(0, 10)
}

/**
 * UTC の ISO 文字列を JST 基準の「YYYY-MM-DD HH:MM」形式に変換
 */
export function formatDateTimeJst(isoString: string): string {
  const jst = new Date(new Date(isoString).getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * 直近N日の開始日と終了日を返す（YYYY-MM-DD形式）
 */
export function getDateRangeForLastDays(days: number): { startDate: string; endDate: string } {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - (days - 1))

  const format = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    startDate: format(start),
    endDate: format(today),
  }
}
