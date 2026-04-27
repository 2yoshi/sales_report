import { describe, it, expect } from 'vitest'
import { ok, okList, created, noContent, parsePagination } from './response'

async function jsonBody(res: Response): Promise<unknown> {
  return res.json()
}

describe('ok', () => {
  it('data を { data } でラップして 200 を返す', async () => {
    const res = ok({ id: '1', name: 'test' })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body).toEqual({ data: { id: '1', name: 'test' } })
  })

  it('カスタムステータスコードを受け取れる', async () => {
    const res = ok({ message: 'ok' }, 202)
    expect(res.status).toBe(202)
  })
})

describe('okList', () => {
  it('data と meta を含むレスポンスを返す', async () => {
    const res = okList([{ id: '1' }], { total: 1, page: 1, per_page: 20 })
    expect(res.status).toBe(200)
    const body = await jsonBody(res)
    expect(body).toEqual({
      data: [{ id: '1' }],
      meta: { total: 1, page: 1, per_page: 20 },
    })
  })
})

describe('created', () => {
  it('data を { data } でラップして 201 を返す', async () => {
    const res = created({ id: '123' })
    expect(res.status).toBe(201)
    const body = await jsonBody(res)
    expect(body).toEqual({ data: { id: '123' } })
  })
})

describe('noContent', () => {
  it('204 ステータスを返す', () => {
    const res = noContent()
    expect(res.status).toBe(204)
  })

  it('レスポンスボディが null である', async () => {
    const res = noContent()
    const text = await res.text()
    expect(text).toBe('')
  })
})

describe('parsePagination', () => {
  it('デフォルト値は page=1, perPage=20 になる', () => {
    const params = new URLSearchParams()
    const result = parsePagination(params)
    expect(result).toEqual({ page: 1, perPage: 20, skip: 0 })
  })

  it('指定した page と per_page を使用する', () => {
    const params = new URLSearchParams({ page: '3', per_page: '50' })
    const result = parsePagination(params)
    expect(result).toEqual({ page: 3, perPage: 50, skip: 100 })
  })

  it('per_page が最大値 100 を超えた場合は 100 に丸める', () => {
    const params = new URLSearchParams({ per_page: '200' })
    const result = parsePagination(params)
    expect(result.perPage).toBe(100)
  })

  it('page が 0 以下の場合は 1 にフォールバックする', () => {
    const params = new URLSearchParams({ page: '0' })
    const result = parsePagination(params)
    expect(result.page).toBe(1)
  })

  it('page が負の場合は 1 にフォールバックする', () => {
    const params = new URLSearchParams({ page: '-5' })
    const result = parsePagination(params)
    expect(result.page).toBe(1)
  })

  it('非数値の場合はデフォルト値を使用する', () => {
    const params = new URLSearchParams({ page: 'abc', per_page: 'xyz' })
    const result = parsePagination(params)
    expect(result).toEqual({ page: 1, perPage: 20, skip: 0 })
  })

  it('skip は (page - 1) * perPage で計算される', () => {
    const params = new URLSearchParams({ page: '4', per_page: '10' })
    const result = parsePagination(params)
    expect(result.skip).toBe(30)
  })
})
