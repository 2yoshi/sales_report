export type UserRole = 'sales' | 'manager' | 'admin'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface ApiResponse<T> {
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    per_page: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown[]
  }
}
