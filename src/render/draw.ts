import { duration, sampleAt, type SimResult } from '../physics/trajectory'
import { add, type Vec2 } from '../physics/vec2'
import type { AppState } from '../state'
import { toScreen, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

export const COLORS = {
  bg: css('--bg'),
  fg: css('--fg'),
  dim: css('--dim'),
  accent: css('--accent'),
  ghost: css('--ghost'),
  ghostRef: css('--ghost-ref'),
  danger: css('--danger'),
  grid: css('--grid'),
  ramp: css('--ramp'),
  friction: css('--friction'),
}

export const arrow = (
  ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string,
): void => {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  const ang = Math.atan2(to.y - from.y, to.x - from.x)
  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
  ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
  ctx.closePath()
  ctx.fill()
}

export interface TrailCache { rev: number; w: number; h: number; line: Path2D; ticks: Path2D }

// tickStep <= 0 means "no ticks" (used by the projectile scene's dashed ideal
// reference trail, which never had tick marks).
export const drawTrail = (
  ctx: CanvasRenderingContext2D,
  vp: Viewport,
  sim: SimResult,
  revision: number,
  opts: { color: string; tickStep: number; tickRadius: number; dashed?: boolean },
  cache: { current: TrailCache | null },
): void => {
  let c = cache.current
  if (!c || c.rev !== revision || c.w !== vp.w || c.h !== vp.h) {
    const line = new Path2D()
    sim.samples.forEach((s, i) => {
      const p = toScreen(vp, s.pos)
      if (i === 0) line.moveTo(p.x, p.y)
      else line.lineTo(p.x, p.y)
    })
    const ticks = new Path2D()
    if (opts.tickStep > 0) {
      for (let t = 0; t <= duration(sim); t += opts.tickStep) {
        const q = toScreen(vp, sampleAt(sim.samples, t).pos)
        ticks.moveTo(q.x + opts.tickRadius, q.y)
        ticks.arc(q.x, q.y, opts.tickRadius, 0, 2 * Math.PI)
      }
    }
    c = { rev: revision, w: vp.w, h: vp.h, line, ticks }
    cache.current = c
  }
  ctx.strokeStyle = opts.color
  ctx.lineWidth = opts.dashed ? 1 : 2
  ctx.setLineDash(opts.dashed ? [6, 6] : [])
  ctx.stroke(c.line)
  ctx.setLineDash([])
  ctx.fillStyle = opts.color
  ctx.fill(c.ticks)
}

export const drawCurrentMarker = (
  ctx: CanvasRenderingContext2D, vp: Viewport, s: AppState,
): void => {
  const cur = sampleAt(s.sim.samples, s.playback.t)
  const curPx = toScreen(vp, cur.pos)
  ctx.fillStyle = COLORS.fg
  ctx.beginPath()
  ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI)
  ctx.fill()
  if (s.overlays.v) arrow(ctx, curPx, toScreen(vp, add(cur.pos, cur.vel)), COLORS.accent)
  if (s.overlays.a) arrow(ctx, curPx, toScreen(vp, add(cur.pos, cur.acc)), COLORS.danger)
}
