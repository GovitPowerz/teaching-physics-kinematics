import { v, type Vec2 } from '../physics/vec2'

export interface Handle { id: string; pos: Vec2; radius: number }

export const hitTest = (handles: Handle[], p: Vec2): string | null => {
  let best: string | null = null
  let bestD = Infinity
  for (const h of handles) {
    const d = Math.hypot(h.pos.x - p.x, h.pos.y - p.y)
    if (d <= h.radius && d < bestD) { best = h.id; bestD = d }
  }
  return best
}

export const attachDrag = (
  canvas: HTMLCanvasElement,
  getHandles: () => Handle[],
  onDrag: (id: string, screenPos: Vec2) => void,
  onTapEmpty?: (screenPos: Vec2) => void,
): void => {
  let dragging: string | null = null
  const local = (ev: PointerEvent): Vec2 => {
    const r = canvas.getBoundingClientRect()
    return v(ev.clientX - r.left, ev.clientY - r.top)
  }
  canvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev)
    dragging = hitTest(getHandles(), p)
    if (dragging) { canvas.setPointerCapture(ev.pointerId); onDrag(dragging, p) }
    else onTapEmpty?.(p)
  })
  canvas.addEventListener('pointermove', (ev) => {
    if (dragging) onDrag(dragging, local(ev))
  })
  canvas.addEventListener('pointerup', () => { dragging = null })
}

export interface ControlRow { el: HTMLElement; refresh: () => void }

export const sliderRow = (
  label: string, min: number, max: number, step: number,
  get: () => number, set: (val: number) => void,
): ControlRow => {
  const wrap = document.createElement('div')
  const lab = document.createElement('label')
  lab.textContent = label
  const row = document.createElement('div')
  row.className = 'row'
  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(min); range.max = String(max); range.step = String(step)
  const text = document.createElement('input')
  text.type = 'text'
  const refresh = () => {
    if (document.activeElement !== range) range.value = String(get())
    if (document.activeElement !== text) text.value = String(get())
  }
  range.addEventListener('input', () => { set(Number(range.value)) })
  const commit = () => {
    const n = Number(text.value)
    if (Number.isFinite(n)) { set(Math.min(max, Math.max(min, n))); refresh() }
    else text.value = String(get())
  }
  text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit() })
  text.addEventListener('blur', commit)
  refresh()
  wrap.append(lab, row)
  row.append(range, text)
  return { el: wrap, refresh }
}

export const vecRow = (
  label: string, get: () => Vec2, set: (val: Vec2) => void,
): ControlRow => {
  const wrap = document.createElement('div')
  const lab = document.createElement('label')
  lab.textContent = label
  const row = document.createElement('div')
  row.className = 'row'
  const inputs: Array<['x' | 'y', HTMLInputElement]> = []
  const refresh = () => {
    for (const [axis, t] of inputs)
      if (document.activeElement !== t) t.value = get()[axis].toFixed(2)
  }
  for (const axis of ['x', 'y'] as const) {
    const t = document.createElement('input')
    t.type = 'text'
    const commit = () => {
      const n = Number(t.value)
      if (Number.isFinite(n)) { set({ ...get(), [axis]: n }); refresh() }
      else t.value = get()[axis].toFixed(2)
    }
    t.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit() })
    t.addEventListener('blur', commit)
    inputs.push([axis, t])
    row.appendChild(t)
  }
  refresh()
  wrap.append(lab, row)
  return { el: wrap, refresh }
}

export const buttonRow = (labels: string[], onClick: (i: number) => void): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'row'
  labels.forEach((l, i) => {
    const b = document.createElement('button')
    b.textContent = l
    b.addEventListener('click', () => onClick(i))
    row.appendChild(b)
  })
  return row
}
