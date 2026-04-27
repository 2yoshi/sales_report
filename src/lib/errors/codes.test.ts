import { describe, it, expect } from 'vitest'
import { ERROR_CODES, HTTP_STATUS } from './codes'

describe('ERROR_CODES', () => {
  it('全エラーコードが定義されている', () => {
    expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ERROR_CODES.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
    expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED')
    expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN')
    expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND')
    expect(ERROR_CODES.DUPLICATE_REPORT).toBe('DUPLICATE_REPORT')
    expect(ERROR_CODES.EMAIL_ALREADY_EXISTS).toBe('EMAIL_ALREADY_EXISTS')
    expect(ERROR_CODES.CUSTOMER_IN_USE).toBe('CUSTOMER_IN_USE')
    expect(ERROR_CODES.USER_IN_USE).toBe('USER_IN_USE')
    expect(ERROR_CODES.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR')
  })
})

describe('HTTP_STATUS', () => {
  it('VALIDATION_ERROR は 400 を返す', () => {
    expect(HTTP_STATUS.VALIDATION_ERROR).toBe(400)
  })

  it('INVALID_CREDENTIALS は 401 を返す', () => {
    expect(HTTP_STATUS.INVALID_CREDENTIALS).toBe(401)
  })

  it('UNAUTHORIZED は 401 を返す', () => {
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401)
  })

  it('FORBIDDEN は 403 を返す', () => {
    expect(HTTP_STATUS.FORBIDDEN).toBe(403)
  })

  it('NOT_FOUND は 404 を返す', () => {
    expect(HTTP_STATUS.NOT_FOUND).toBe(404)
  })

  it('DUPLICATE_REPORT は 409 を返す', () => {
    expect(HTTP_STATUS.DUPLICATE_REPORT).toBe(409)
  })

  it('EMAIL_ALREADY_EXISTS は 409 を返す', () => {
    expect(HTTP_STATUS.EMAIL_ALREADY_EXISTS).toBe(409)
  })

  it('CUSTOMER_IN_USE は 409 を返す', () => {
    expect(HTTP_STATUS.CUSTOMER_IN_USE).toBe(409)
  })

  it('USER_IN_USE は 409 を返す', () => {
    expect(HTTP_STATUS.USER_IN_USE).toBe(409)
  })

  it('INTERNAL_SERVER_ERROR は 500 を返す', () => {
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500)
  })
})
