import { duration, sampleAt } from '../physics/trajectory'
import { add, dot, scale, sub, v, type Vec2 } from '../physics/vec2'
import { DOMAINS, INCLINE } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, sliderRow, type Handle } from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'
import { arrow, COLORS } from './draw'

// sim samples are the 1D embedding (pos.x = s, pos.y = 0); every world point
// derived from a sample must go through worldOf(s, theta) first.
const worldOf = (s: number, th: number): Vec2 => v(s * Math.cos(th), s * Math.sin(th))

// the puck's CENTER rides one radius above the contact surface; lifting all
// puck-anchored geometry (trail, arrows, marker) by this screen offset keeps
// it visually separated from the ramp edge, which everything is otherwise
// collinear with by construction
const PUCK_R = 9

const label = (
  ctx: CanvasRenderingContext2D, text: string, at: Vec2, color: string,
): void => {
  ctx.font = 'bold 14px ui-monospace, monospace'
  ctx.strokeStyle = COLORS.bg
  ctx.lineWidth = 3
  ctx.strokeText(text, at.x + 5, at.y - 5)
  ctx.fillStyle = color
  ctx.fillText(text, at.x + 5, at.y - 5)
}

// arrow() (draw.ts) hardcodes lineWidth 2; the resultant a vector needs the
// spec's 3px emphasis and draw.ts is out of scope for this change, so this
// is a thin local copy of arrow() with a configurable width.
const thickArrow = (
  ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string,
): void => {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3
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

export const createInclineScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let refreshRows: () => void = () => {}

  const vp = (): Viewport =>
    ({ world: DOMAINS.incline, w: canvas.clientWidth, h: canvas.clientHeight })

  // screen-space lift along the up-normal (screen y is flipped vs world y)
  const liftPx = (th: number): Vec2 =>
    v(-Math.sin(th) * PUCK_R, -Math.cos(th) * PUCK_R)
  const lifted = (wpt: Vec2, th: number): Vec2 => add(toScreen(vp(), wpt), liftPx(th))

  const handles = (): Handle[] => {
    const i = store.get().incline
    const th = i.theta
    const tan = v(Math.cos(th), Math.sin(th))
    const puckW = worldOf(i.s0, th)
    const v0TipW = add(puckW, scale(tan, i.v0))
    return [
      { id: 'puck', pos: lifted(puckW, th), radius: 12 },
      { id: 'v0', pos: lifted(v0TipW, th), radius: 12 },
      { id: 'angle', pos: toScreen(vp(), worldOf(INCLINE.rampLength - 0.5, th)), radius: 14 },
    ]
  }

  // Hand-rolled trail: drawTrail (draw.ts) maps sample.pos straight to
  // screen space with no rotation, so a projectile-style trail would run
  // flat along y = 0 instead of up the ramp. Samples are capped at 7200
  // (30s / dt = 1/240s), so redrawing from scratch every frame - no
  // revision-keyed Path2D cache - is cheap enough.
  const drawGhost = (vpp: Viewport, th: number) => {
    const s = store.get()
    const lift = liftPx(th)
    ctx.strokeStyle = COLORS.ghost
    ctx.lineWidth = 2
    ctx.beginPath()
    s.sim.samples.forEach((smp, idx) => {
      const p = add(toScreen(vpp, worldOf(smp.pos.x, th)), lift)
      if (idx === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = COLORS.ghost
    const dur = duration(s.sim)
    for (let t = 0; t <= dur; t += 0.5) {
      const p = add(toScreen(vpp, worldOf(sampleAt(s.sim.samples, t).pos.x, th)), lift)
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI); ctx.fill()
    }
  }

  const render = () => {
    refreshRows()
    const s = store.get()
    const i = s.incline
    const th = i.theta
    const mu = i.mu
    const g = INCLINE.g
    const tan = v(Math.cos(th), Math.sin(th))
    const normalDir = v(-Math.sin(th), Math.cos(th))

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const gnd0 = toScreen(vp(), v(0, 0)); const gnd1 = toScreen(vp(), v(10, 0))
    ctx.strokeStyle = COLORS.dim; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(gnd0.x, gnd0.y); ctx.lineTo(gnd1.x, gnd1.y); ctx.stroke()

    const L = INCLINE.rampLength
    const top = worldOf(L, th)
    const foot = v(L * Math.cos(th), 0)
    const oPx = toScreen(vp(), v(0, 0))
    const topPx = toScreen(vp(), top)
    const footPx = toScreen(vp(), foot)
    ctx.fillStyle = COLORS.ramp
    ctx.beginPath()
    ctx.moveTo(oPx.x, oPx.y); ctx.lineTo(topPx.x, topPx.y); ctx.lineTo(footPx.x, footPx.y)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = COLORS.fg; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(oPx.x, oPx.y); ctx.lineTo(topPx.x, topPx.y); ctx.stroke()

    const arcR = 1
    const steps = 20
    ctx.strokeStyle = COLORS.dim; ctx.lineWidth = 1
    ctx.beginPath()
    for (let k = 0; k <= steps; k++) {
      const a = (k / steps) * th
      const p = toScreen(vp(), v(arcR * Math.cos(a), arcR * Math.sin(a)))
      if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    }
    ctx.stroke()
    const thLabelPx =
      toScreen(vp(), v(1.3 * Math.cos(th / 2), 1.3 * Math.sin(th / 2)))
    label(ctx, '\u03b8', thLabelPx, COLORS.fg)

    const ahPx = toScreen(vp(), worldOf(INCLINE.rampLength - 0.5, th))
    ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(ahPx.x, ahPx.y, 6, 0, 2 * Math.PI); ctx.stroke()

    drawGhost(vp(), th)

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const puckWorld = worldOf(cur.pos.x, th)
    const puckPx = lifted(puckWorld, th)
    const lift = liftPx(th)

    const vel = cur.vel.x
    const atRest = Math.abs(vel) < INCLINE.vRest
    // stuck (truly static) requires both near-zero velocity AND enough
    // friction capacity to hold the puck (tan theta <= mu) - matches the
    // sim's own stopWhen condition in scenes.ts. atRest alone is not enough:
    // on a slope that cannot hold statically, the puck passes through
    // atRest at the turnaround instant but keeps accelerating.
    const stuck = atRest && Math.tan(th) <= mu
    const FS = INCLINE.FORCE_SCALE

    const wTip = add(toScreen(vp(), add(puckWorld, v(0, -g * FS))), lift)
    arrow(ctx, puckPx, wTip, COLORS.danger)
    label(ctx, 'W', wTip, COLORS.danger)

    const nTip =
      add(toScreen(vp(), add(puckWorld, scale(normalDir, g * Math.cos(th) * FS))), lift)
    arrow(ctx, puckPx, nTip, COLORS.accent)
    label(ctx, 'N', nTip, COLORS.accent)

    // friction: static value (balancing) at rest, else kinetic opposing motion
    if (mu > 0) {
      const fMag = stuck ? g * Math.sin(th) : -Math.sign(vel) * mu * g * Math.cos(th)
      const fTip = add(toScreen(vp(), add(puckWorld, scale(tan, fMag * FS))), lift)
      arrow(ctx, puckPx, fTip, COLORS.friction)
      label(ctx, 'f', fTip, COLORS.friction)
    }

    // resultant a: zero (nothing drawn) only when truly stuck
    if (s.overlays.a && !stuck) {
      const aVal = atRest ? -g * Math.sin(th) : cur.acc.x
      const aTip = add(toScreen(vp(), add(puckWorld, scale(tan, aVal * FS))), lift)
      thickArrow(ctx, puckPx, aTip, COLORS.fg)
      label(ctx, 'a', aTip, COLORS.fg)
    }

    const s0World = worldOf(i.s0, th)
    arrow(ctx, lifted(s0World, th),
      lifted(add(s0World, scale(tan, i.v0)), th), COLORS.accent)

    if (s.overlays.v) {
      const velTip = add(toScreen(vp(), add(puckWorld, scale(tan, vel))), lift)
      arrow(ctx, puckPx, velTip, COLORS.accent)
    }

    // puck last, on top of the arrow tails converging at its center
    ctx.fillStyle = COLORS.fg
    ctx.strokeStyle = COLORS.bg
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(puckPx.x, puckPx.y, PUCK_R, 0, 2 * Math.PI)
    ctx.fill(); ctx.stroke()
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      const rows = [
        sliderRow('angle \u03b8 (\u00b0)', 5, 45, 0.5,
          () => store.get().incline.theta * 180 / Math.PI,
          (deg) => store.patchIncline({ theta: deg * Math.PI / 180 })),
        sliderRow('friction \u03bc', 0, 1, 0.01,
          () => store.get().incline.mu, (mu) => store.patchIncline({ mu })),
        sliderRow('v0 along plane (m/s)', -8, 8, 0.1,
          () => store.get().incline.v0, (v0) => store.patchIncline({ v0 })),
      ]
      controls.append(...rows.map((r) => r.el))
      refreshRows = () => rows.forEach((r) => r.refresh())
      const hint = document.createElement('label')
      hint.textContent = 'drag the puck, its velocity arrow, and the ramp edge'
      controls.appendChild(hint)
      root.append(canvas, controls)
      attachDrag(canvas, handles, (id, screenPos) => {
        const w = toWorld(vp(), screenPos)
        const i = store.get().incline
        const th = i.theta
        const tan = v(Math.cos(th), Math.sin(th))
        if (id === 'puck') {
          store.patchIncline(
            { s0: Math.min(INCLINE.rampLength - 0.2, Math.max(0.2, dot(w, tan))) })
        } else if (id === 'v0') {
          const puckW = worldOf(i.s0, th)
          store.patchIncline({ v0: Math.min(8, Math.max(-8, dot(sub(w, puckW), tan))) })
        } else if (id === 'angle') {
          const deg = Math.min(45, Math.max(5, Math.atan2(w.y, w.x) * 180 / Math.PI))
          store.patchIncline({ theta: deg * Math.PI / 180 })
        }
      })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
