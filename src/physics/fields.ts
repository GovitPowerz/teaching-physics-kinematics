import { SOFTENING, type Charge } from './forces'
import { add, len, norm, scale, sub, v, type Vec2 } from './vec2'

export const fieldAt = (charges: Charge[], p: Vec2): Vec2 =>
  charges.reduce((acc, c) => {
    const r = sub(p, c.pos)
    const d2 = r.x * r.x + r.y * r.y + SOFTENING * SOFTENING
    return add(acc, scale(r, c.q / Math.pow(d2, 1.5)))
  }, v(0, 0))

export const potentialAt = (charges: Charge[], p: Vec2): number =>
  charges.reduce((acc, c) => {
    const r = sub(p, c.pos)
    return acc + c.q / Math.sqrt(r.x * r.x + r.y * r.y + SOFTENING * SOFTENING)
  }, 0)

export interface FieldLineOpts {
  step?: number
  maxSteps?: number
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number }
  seedsPerUnitCharge?: number
  seedRadius?: number
}

export const fieldLines = (charges: Charge[], opts: FieldLineOpts): Vec2[][] => {
  const step = opts.step ?? 0.02
  const maxSteps = opts.maxSteps ?? 1500
  const perUnit = opts.seedsPerUnitCharge ?? 8
  const seedR = opts.seedRadius ?? 0.15
  const b = opts.bounds
  const inBounds = (p: Vec2) =>
    p.x >= b.xMin && p.x <= b.xMax && p.y >= b.yMin && p.y <= b.yMax
  const nearCharge = (p: Vec2, exclude: Charge) =>
    charges.some((c) => c !== exclude && len(sub(p, c.pos)) < seedR)
  const lines: Vec2[][] = []

  for (const c of charges) {
    const n = perUnit * Math.max(1, Math.round(Math.abs(c.q)))
    const dir = Math.sign(c.q) || 1
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * i) / n
      let p = add(c.pos, v(seedR * Math.cos(ang), seedR * Math.sin(ang)))
      const line: Vec2[] = [p]
      for (let k = 0; k < maxSteps; k++) {
        const e1 = norm(fieldAt(charges, p))
        if (e1.x === 0 && e1.y === 0) break
        const mid = add(p, scale(e1, dir * step * 0.5))
        const e2 = norm(fieldAt(charges, mid))
        p = add(p, scale(e2, dir * step))
        line.push(p)
        if (!inBounds(p) || nearCharge(p, c)) break
      }
      lines.push(line)
    }
  }
  return lines
}

export type Segment = [Vec2, Vec2]

export const equipotentials = (
  charges: Charge[],
  levels: number[],
  grid: { xMin: number; xMax: number; yMin: number; yMax: number; nx: number; ny: number },
): Segment[] => {
  const { xMin, xMax, yMin, yMax, nx, ny } = grid
  const dx = (xMax - xMin) / nx
  const dy = (yMax - yMin) / ny
  const val: number[][] = []
  for (let j = 0; j <= ny; j++) {
    const row: number[] = []
    for (let i = 0; i <= nx; i++)
      row.push(potentialAt(charges, v(xMin + i * dx, yMin + j * dy)))
    val.push(row)
  }
  const segs: Segment[] = []
  const lerp = (pa: Vec2, pb: Vec2, va: number, vb: number, lv: number): Vec2 => {
    const f = (lv - va) / (vb - va)
    return v(pa.x + f * (pb.x - pa.x), pa.y + f * (pb.y - pa.y))
  }
  for (const lv of levels) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x0 = xMin + i * dx, y0 = yMin + j * dy
        const p = [v(x0, y0), v(x0 + dx, y0), v(x0 + dx, y0 + dy), v(x0, y0 + dy)]
        const c = [val[j][i], val[j][i + 1], val[j + 1][i + 1], val[j + 1][i]]
        let idx = 0
        for (let k = 0; k < 4; k++) if (c[k] > lv) idx |= 1 << k
        if (idx === 0 || idx === 15) continue
        const edge = (k: number): Vec2 =>
          lerp(p[k], p[(k + 1) % 4], c[k], c[(k + 1) % 4], lv)
        const table: Record<number, [number, number][]> = {
          1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]],
          7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 11: [[2, 1]], 12: [[1, 3]],
          13: [[1, 0]], 14: [[0, 3]],
        }
        if (idx === 5 || idx === 10) {
          const center = (c[0] + c[1] + c[2] + c[3]) / 4
          const pairs: [number, number][] =
            (idx === 5) === (center > lv) ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]
          for (const [a, bb] of pairs) segs.push([edge(a), edge(bb)])
        } else {
          for (const [a, bb] of table[idx]) segs.push([edge(a), edge(bb)])
        }
      }
    }
  }
  return segs
}
