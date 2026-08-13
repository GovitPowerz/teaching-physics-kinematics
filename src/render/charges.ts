import { equipotentials, fieldLines, type Segment } from '../physics/fields'
import { duration, sampleAt } from '../physics/trajectory'
import { add, v, type Vec2 } from '../physics/vec2'
import { DOMAINS } from '../scenes'
import type { Store } from '../state'
import type { SceneRenderer } from '../main'
import { attachDrag, buttonRow, sliderRow, vecRow, type ControlRow, type Handle }
  from '../ui/controls'
import { toScreen, toWorld, type Viewport } from './viewport'

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const LEVELS = [-2, -1, -0.5, -0.25, 0.25, 0.5, 1, 2]

export const createChargesScene = (store: Store): SceneRenderer => {
  let canvas: HTMLCanvasElement
  let ctx: CanvasRenderingContext2D
  let controls: HTMLElement
  let nextSign: 1 | -1 = 1
  let lastSelected: number | null | undefined
  let cache: { rev: number; lines: Vec2[][]; equis: Segment[] } | null = null

  const vp = (): Viewport =>
    ({ world: DOMAINS.charges, w: canvas.clientWidth, h: canvas.clientHeight })

  const fieldCache = () => {
    const s = store.get()
    if (!cache || cache.rev !== s.revision) {
      cache = {
        rev: s.revision,
        lines: fieldLines(s.charges.charges, { bounds: DOMAINS.charges }),
        equis: equipotentials(s.charges.charges, LEVELS,
          { ...DOMAINS.charges, nx: 120, ny: 120 }),
      }
    }
    return cache
  }

  const handles = (): Handle[] => {
    const c = store.get().charges
    const hs: Handle[] = c.charges.map((ch, i) =>
      ({ id: `charge:${i}`, pos: toScreen(vp(), ch.pos), radius: 14 }))
    hs.push({ id: 'testPos', pos: toScreen(vp(), c.testPos), radius: 10 })
    hs.push({ id: 'testVel', pos: toScreen(vp(), add(c.testPos, c.testVel)), radius: 12 })
    return hs
  }

  const arrow = (from: Vec2, to: Vec2, color: string) => {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    const ang = Math.atan2(to.y - from.y, to.x - from.x)
    ctx.beginPath()
    ctx.moveTo(to.x, to.y)
    ctx.lineTo(to.x - 9 * Math.cos(ang - 0.4), to.y - 9 * Math.sin(ang - 0.4))
    ctx.lineTo(to.x - 9 * Math.cos(ang + 0.4), to.y - 9 * Math.sin(ang + 0.4))
    ctx.closePath(); ctx.fill()
  }

  let rows: ControlRow[] = []
  const rebuildControls = () => {
    const c = store.get().charges
    controls.innerHTML = ''
    rows = [
      vecRow('test start (x, y)', () => store.get().charges.testPos,
        (testPos) => store.setTestCharge({ testPos })),
      vecRow('test velocity (vx, vy)', () => store.get().charges.testVel,
        (testVel) => store.setTestCharge({ testVel })),
    ]
    controls.append(
      buttonRow(['add +', 'add -'], (i) => { nextSign = i === 0 ? 1 : -1 }),
      buttonRow(['flip test charge'], () =>
        store.setTestCharge({ testSign: store.get().charges.testSign > 0 ? -1 : 1 })),
      ...rows.map((r) => r.el),
    )
    if (c.selected !== null && c.charges[c.selected]) {
      const i = c.selected
      const qRow = sliderRow('|q| of selected', 1, 5, 1,
        () => Math.abs(store.get().charges.charges[i].q),
        (q) => store.setChargeQ(i, Math.sign(store.get().charges.charges[i].q) * q))
      rows.push(qRow)
      controls.append(qRow.el,
        buttonRow(['delete charge'], () => store.deleteCharge(i)))
    }
    const hint = document.createElement('label')
    hint.textContent = 'tap empty space to add, drag charges to move'
    controls.appendChild(hint)
  }

  const render = () => {
    const s = store.get()
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight
    }
    if (lastSelected !== s.charges.selected) {
      lastSelected = s.charges.selected
      rebuildControls()
    }
    rows.forEach((r) => r.refresh())
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const fc = fieldCache()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = css('--dim'); ctx.lineWidth = 1
    for (const [a, b] of fc.equis) {
      const pa = toScreen(vp(), a); const pb = toScreen(vp(), b)
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
    }
    ctx.globalAlpha = 0.8
    for (const line of fc.lines) {
      ctx.beginPath()
      line.forEach((p, i) => {
        const q = toScreen(vp(), p)
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y)
      })
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    ctx.strokeStyle = css('--ghost'); ctx.lineWidth = 2
    ctx.beginPath()
    s.sim.samples.forEach((smp, i) => {
      const p = toScreen(vp(), smp.pos)
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = css('--ghost')
    for (let t = 0; t <= duration(s.sim); t += 0.5) {
      const q = toScreen(vp(), sampleAt(s.sim.samples, t).pos)
      ctx.beginPath(); ctx.arc(q.x, q.y, 2.5, 0, 2 * Math.PI); ctx.fill()
    }

    s.charges.charges.forEach((ch, i) => {
      const p = toScreen(vp(), ch.pos)
      ctx.fillStyle = ch.q > 0 ? css('--danger') : css('--accent')
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 2 * Math.PI); ctx.fill()
      ctx.fillStyle = css('--bg')
      ctx.font = 'bold 13px system-ui'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText((ch.q > 0 ? '+' : '\u2212') + Math.abs(ch.q), p.x, p.y)
      if (s.charges.selected === i) {
        ctx.strokeStyle = css('--fg'); ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, 2 * Math.PI); ctx.stroke()
      }
    })
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'

    const tp = toScreen(vp(), s.charges.testPos)
    arrow(tp, toScreen(vp(), add(s.charges.testPos, s.charges.testVel)), css('--accent'))
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 5, 0, 2 * Math.PI); ctx.fill()

    const cur = sampleAt(s.sim.samples, s.playback.t)
    const curPx = toScreen(vp(), cur.pos)
    ctx.fillStyle = css('--fg')
    ctx.beginPath(); ctx.arc(curPx.x, curPx.y, 6, 0, 2 * Math.PI); ctx.fill()
    if (s.overlays.v) arrow(curPx, toScreen(vp(), add(cur.pos, cur.vel)), css('--accent'))
    if (s.overlays.a) arrow(curPx, toScreen(vp(), add(cur.pos, cur.acc)), css('--danger'))
  }

  return {
    mount: (root) => {
      canvas = document.createElement('canvas')
      ctx = canvas.getContext('2d')!
      controls = document.createElement('div')
      controls.className = 'controls'
      rebuildControls()
      root.append(canvas, controls)
      attachDrag(canvas, handles,
        (id, screenPos) => {
          const w = toWorld(vp(), screenPos)
          if (id.startsWith('charge:')) {
            const i = Number(id.slice(7))
            if (store.get().charges.selected !== i) store.selectCharge(i)
            store.moveCharge(i, w)
          } else if (id === 'testPos') store.setTestCharge({ testPos: w })
          else if (id === 'testVel') {
            const c = store.get().charges
            store.setTestCharge({ testVel: v(w.x - c.testPos.x, w.y - c.testPos.y) })
          }
        },
        (screenPos) => {
          const w = toWorld(vp(), screenPos)
          store.selectCharge(null)
          store.addCharge(w, nextSign)
        })
    },
    unmount: () => { canvas.remove(); controls.remove() },
    render,
  }
}
