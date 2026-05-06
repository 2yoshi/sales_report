import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/types'

export interface ReportListItemClient {
  id: string
  report_date: string
  user: {
    id: string
    name: string
  }
  visit_records: {
    id: string
    customer: {
      id: string
      name: string
    }
    content: string
    sort_order: number
  }[]
  comments_count: number
  created_at: string
  updated_at: string
}

export interface ListReportsParams {
  user_id?: string
  start_date?: string
  end_date?: string
  page?: number
  per_page?: number
}

export async function fetchReports(
  params: ListReportsParams,
): Promise<PaginatedResponse<ReportListItemClient>> {
  const searchParams = new URLSearchParams()
  if (params.user_id) searchParams.set('user_id', params.user_id)
  if (params.start_date) searchParams.set('date_from', params.start_date)
  if (params.end_date) searchParams.set('date_to', params.end_date)
  if (params.page != null) searchParams.set('page', String(params.page))
  if (params.per_page != null) searchParams.set('per_page', String(params.per_page))

  const query = searchParams.toString()
  const path = query ? `/api/reports?${query}` : '/api/reports'

  return apiClient.get<PaginatedResponse<ReportListItemClient>>(path)
}
