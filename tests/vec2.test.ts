import { describe, expect, it } from 'vitest'
import { add, cross, dot, len, norm, scale, sub, v } from '../src/physics/vec2'

describe('vec2', () => {
  it('add/sub/scale', () => {
    expect(add(v(1, 2), v(3, 4))).toEqual(v(4, 6))
    expect(sub(v(1, 2), v(3, 4))).toEqual(v(-2, -2))
    expect(scale(v(1, -2), 3)).toEqual(v(3, -6))
  })
  it('dot/cross/len', () => {
    expect(dot(v(1, 2), v(3, 4))).toBe(11)
    expect(cross(v(1, 0), v(0, 1))).toBe(1)
    expect(len(v(3, 4))).toBe(5)
  })
  it('norm is zero-safe', () => {
    expect(norm(v(3, 4))).toEqual(v(0.6, 0.8))
    expect(norm(v(0, 0))).toEqual(v(0, 0))
  })
})
