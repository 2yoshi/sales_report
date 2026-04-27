import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('単一クラス名を返す', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('複数クラス名を結合する', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('重複するTailwindクラスを後勝ちでマージする', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('undefined や空文字を無視する', () => {
    expect(cn('foo', undefined, '')).toBe('foo')
  })

  it('条件付きクラスを適用する', () => {
    const applyActive = (active: boolean) => cn('base', active && 'active')
    expect(applyActive(true)).toBe('base active')
    expect(applyActive(false)).toBe('base')
  })
})
