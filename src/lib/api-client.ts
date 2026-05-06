import type { ApiError } from '@/types'

export const TOKEN_KEY = 'auth_token'

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: ApiError['error']['details'],
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

type OnUnauthorized = () => void
let onUnauthorizedCallback: OnUnauthorized | null = null

export function setOnUnauthorized(cb: OnUnauthorized) {
  onUnauthorizedCallback = cb
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(path, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    onUnauthorizedCallback?.()
    throw new ApiClientError('UNAUTHORIZED', '認証が必要です。再度ログインしてください。', undefined, 401)
  }

  if (!response.ok) {
    let errorBody: ApiError | null = null
    try {
      errorBody = (await response.json()) as ApiError
    } catch {
      // JSONパース失敗
    }

    if (errorBody?.error) {
      throw new ApiClientError(
        errorBody.error.code,
        errorBody.error.message,
        errorBody.error.details,
        response.status,
      )
    }

    throw new ApiClientError(
      'UNKNOWN_ERROR',
      `サーバーエラーが発生しました (${response.status})`,
      undefined,
      response.status,
    )
  }

  // 204 No Content など body が空の場合
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path)
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
}
