import { uniformGravity } from '../physics/forces'
import { simulate, type SimResult } from '../physics/trajectory'
import { add, sub, v } from '../physics/vec2'
import { DOMAINS } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { fmt } from '../ui/panel'
import { attachDrag, buttonRow, sliderRow, vecRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import { arrow, COLORS, drawCurrentMarker, drawTrail, type TrailCache } from './draw'

export const createProjectileScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let idealCache: { rev: number; sim: SimResult } | null = null
  let refreshRows: () => void = () => {}
  const trailCache: { current: TrailCache | null } = { current: null }
  const idealTrailCache: { current: TrailCache | null } = { current: null }

  const vp = (): Viewport =>
    ({ world: DOMAINS.projectile, w: canvas.clientWidth, h: canvas.clientHeight })

  const handles = (): Handle[] => {
    const p = store.get().projectile
    return [
      { id: 'launch', pos: toScreen(vp(), p.launch), radius: 10 },
      { id: 'v0', pos: toScreen(vp(), add(p.launch, p.v0)), radius: 12 },
    ]
  }

  const idealSim = (): SimResult => {
    const s = store.get()
    if (!idealCache || idealCache.rev !== s.revision) {
      const p = s.projectile
      idealCache = {
        rev: s.revision,
        sim: simulate({ pos: p.launch, vel: p.v0 }, uniformGravity(p.g),
          { dt: 1 / 240, tMax: 30, groundY: 0, restitution: p.restitution, maxBounces: 5 }),
      }
    }
    return idealCache.sim
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const p = s.projectile
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1
    for (let x = 0; x <= 60; x += 10) {
      const a = toScreen(vp(), v(x, 0)); const b = toScreen(vp(), v(x, 30))
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    for (let y = 0; y <= 30; y += 10) {
      const a = toScreen(vp(), v(0, y)); const b = toScreen(vp(), v(60, y))
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    }
    const g0 = toScreen(vp(), v(0, 0)); const g1 = toScreen(vp(), v(60, 0))
    ctx.strokeStyle = COLORS.dim; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke()

    if (p.dragK > 0) {
      drawTrail(ctx, vp(), idealSim(), s.revision,
        { color: COLORS.ghostRef, tickStep: 0, tickRadius: 0, dashed: true }, idealTrailCache)
    }
    drawTrail(ctx, vp(), s.sim, s.revision,
      { color: COLORS.ghost, tickStep: 0.5, tickRadius: 2.5 }, trailCache)

    let apex = s.sim.samples[0]
    for (const smp of s.sim.samples) if (smp.pos.y > apex.pos.y) apex = smp
    const apexPx = toScreen(vp(), apex.pos)
    ctx.fillStyle = COLORS.dim
    ctx.fillText(`apex ${fmt(apex.pos.y)} m`, apexPx.x + 6, apexPx.y - 6)
    if (s.sim.stopReason === 'ground') {
      const last = s.sim.samples[s.sim.samples.length - 1]
      const lp = toScreen(vp(), last.pos)
      ctx.fillText(`range ${fmt(last.pos.x - p.launch.x)} m`, lp.x - 30, lp.y - 8)
    }

    const launchPx = toScreen(vp(), p.launch)
    arrow(ctx, launchPx, toScreen(vp(), add(p.launch, p.v0)), COLORS.accent)
    ctx.fillStyle = COLORS.fg
    ctx.beginPath(); ctx.arc(launchPx.x, launchPx.y, 5, 0, 2 * Math.PI); ctx.fill()

    drawCurrentMarker(ctx, vp(), s)
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        sliderRow('gravity g (m/s\u00b2)', 1, 25, 0.01,
          () => store.get().projectile.g, (g) => store.patchProjectile({ g })),
        sliderRow('drag k (1/s)', 0, 2, 0.01,
          () => store.get().projectile.dragK, (dragK) => store.patchProjectile({ dragK })),
        sliderRow('restitution e', 0, 0.95, 0.05,
          () => store.get().projectile.restitution,
          (restitution) => store.patchProjectile({ restitution })),
        vecRow('launch (x, y)', () => store.get().projectile.launch,
          (launch) => store.patchProjectile({ launch })),
        vecRow('v0 (vx, vy)', () => store.get().projectile.v0,
          (v0) => store.patchProjectile({ v0 })),
      ]
      controls.append(rows[0].el,
        buttonRow(['Moon', 'Earth', 'Jupiter'],
          (i) => store.patchProjectile({ g: [1.62, 9.81, 24.79][i] })),
        ...rows.slice(1).map((r) => r.el))
      refreshRows = () => rows.forEach((r) => r.refresh())
      root.append(canvas, controls)
      attachDrag(canvas, handles, (id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        if (id === 'launch')
          store.patchProjectile({ launch: v(Math.max(0, w.x), Math.max(0, w.y)) })
        else {
          const p = store.get().projectile
          store.patchProjectile({ v0: sub(w, p.launch) })
        }
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
