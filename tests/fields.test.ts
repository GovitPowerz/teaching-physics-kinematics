import { describe, expect, it } from 'vitest'
import { equipotentials, fieldAt, fieldLines, potentialAt } from '../src/physics/fields'
import { SOFTENING } from '../src/physics/forces'
import { len, v } from '../src/physics/vec2'

const BOUNDS = { xMin: -4, xMax: 4, yMin: -4, yMax: 4 }

describe('fields', () => {
  it('fieldAt matches softened Coulomb for one charge', () => {
    const E = fieldAt([{ pos: v(0, 0), q: 2 }], v(1, 0))
    expect(E.x).toBeCloseTo(2 / Math.pow(1 + SOFTENING * SOFTENING, 1.5), 12)
    expect(E.y).toBeCloseTo(0, 12)
  })
  it('potentialAt is softened 1/r', () => {
    expect(potentialAt([{ pos: v(0, 0), q: 1 }], v(1, 0)))
      .toBeCloseTo(1 / Math.sqrt(1 + SOFTENING * SOFTENING), 12)
  })
  it('seed count scales with |q|', () => {
    const one = fieldLines([{ pos: v(0, 0), q: 1 }], { bounds: BOUNDS })
    const three = fieldLines([{ pos: v(0, 0), q: 3 }], { bounds: BOUNDS })
    expect(one.length).toBe(8)
    expect(three.length).toBe(24)
  })
  it('field lines of a lone positive charge march outward to the bounds', () => {
    const lines = fieldLines([{ pos: v(0, 0), q: 1 }], { bounds: BOUNDS })
    for (const line of lines) {
      const end = line[line.length - 1]
      expect(len(end)).toBeGreaterThan(3.5)
    }
  })
  it('equipotential of a single charge is a circle', () => {
    const charges = [{ pos: v(0, 0), q: 1 }]
    const level = potentialAt(charges, v(1, 0))
    const segs = equipotentials(charges, [level],
      { xMin: -2, xMax: 2, yMin: -2, yMax: 2, nx: 120, ny: 120 })
    expect(segs.length).toBeGreaterThan(40)
    const radii = segs.flat().map((p) => len(p))
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length
    for (const r of radii) expect(Math.abs(r - mean) / mean).toBeLessThan(0.02)
    expect(mean).toBeCloseTo(1, 1)
  })

  const countLoops = (segs: Array<[ReturnType<typeof v>, ReturnType<typeof v>]>): number => {
    const eq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6
    const used = new Array(segs.length).fill(false)
    let loops = 0
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue
      used[i] = true
      loops++
      let end = segs[i][1]
      let progress = true
      while (progress) {
        progress = false
        for (let j = 0; j < segs.length; j++) {
          if (used[j]) continue
          if (eq(segs[j][0], end)) { used[j] = true; end = segs[j][1]; progress = true }
          else if (eq(segs[j][1], end)) { used[j] = true; end = segs[j][0]; progress = true }
        }
      }
    }
    return loops
  }

  it('saddle disambiguation: level just below the saddle gives one connected contour', () => {
    const charges = [{ pos: v(-1, -1), q: 1 }, { pos: v(1, 1), q: 1 }]
    const saddleV = potentialAt(charges, v(0, 0))
    const grid = { xMin: -2, xMax: 2, yMin: -2, yMax: 2, nx: 121, ny: 121 }
    expect(countLoops(equipotentials(charges, [saddleV - 0.01], grid))).toBe(1)
    expect(countLoops(equipotentials(charges, [saddleV + 0.01], grid))).toBe(2)
  })
})
