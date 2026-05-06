import { apiClient } from '@/lib/api-client'
import type { PaginatedResponse } from '@/types'

export interface UserListItemClient {
  id: string
  name: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

export async function fetchSalesUsers(): Promise<PaginatedResponse<UserListItemClient>> {
  return apiClient.get<PaginatedResponse<UserListItemClient>>('/api/users?role=sales&per_page=100')
}
