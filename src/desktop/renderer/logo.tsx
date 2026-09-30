import React, {useEffect, useMemo, useState} from 'react'

// same glyph art as the terminal logo — each cell is drawn as a 10×20 block,
// so ▀/▄ become half-height rects and the shade glyphs become checkers
const ART = [
  '▓ ▓ █▀█ ▀█▀ █▀▄█ █ █ █▀▀',
  '▀█▀ █ ▓  ▓  █  ▓ ▓▀▄ ▀▀▓',
  ' ▀  ▀▀▀ ▀▀▀ ▀  ▀ ▀ ▀ ▀▀▀',
]
const GRID = ART.map(line => [...line])
const ROWS = GRID.length
const COLS = GRID[0]!.length
const CELL_W = 10
const CELL_H = 20

// intro: each glyph flickers in as ░, sharpens to ▒, then resolves
const INTRO_MS = 900
const INTRO_SPREAD_MS = 550
// shimmer: a tilted beam crosses the glyphs, thinning them one density step
const SWEEP_MS = 1000
const SWEEP_EVERY_MS = 7_000
const TILT = 2
const HALF = 2.4
const LIGHTER: Record<string, string> = {'█': '▒', '▓': '░'}
const HALF_BLOCKS = new Set(['▀', '▄'])

const ease = (t: number) => 1 - Math.pow(1 - t, 3)

type Phase = 'intro' | 'idle' | 'sweep'
type Tone = 'primary' | 'gray'
type Cell = {ch: string; tone: Tone}

function cellAt(ch: string, row: number, col: number, phase: Phase, t: number, delay: number): Cell {
  if (ch === ' ' || phase === 'idle') return {ch, tone: 'primary'}
  if (phase === 'intro') {
    const dt = t - delay
    if (dt < 0) return {ch: ' ', tone: 'primary'}
    if (dt < 110) return {ch: HALF_BLOCKS.has(ch) ? ch : '░', tone: 'gray'}
    if (dt < 220) return {ch: HALF_BLOCKS.has(ch) ? ch : '▒', tone: 'gray'}
    return {ch, tone: 'primary'}
  }
  const pMin = -TILT * ROWS - HALF
  const pMax = COLS + HALF
  const p = pMin + ease(t / SWEEP_MS) * (pMax - pMin)
  const d = Math.abs(col - (ROWS - 1 - row) * TILT - p)
  if (d <= HALF && 1 - d / HALF > 0.35) {
    if (HALF_BLOCKS.has(ch)) return {ch, tone: 'gray'}
    return {ch: LIGHTER[ch] ?? ch, tone: 'primary'}
  }
  return {ch, tone: 'primary'}
}

function CellRect({cell, row, col}: {cell: Cell; row: number; col: number}) {
  const x = col * CELL_W
  const y = row * CELL_H
  const fill = `var(--${cell.tone})`
  switch (cell.ch) {
    case '█':
      return <rect x={x} y={y} width={CELL_W} height={CELL_H} style={{fill}} />
    case '▀':
      return <rect x={x} y={y} width={CELL_W} height={CELL_H / 2} style={{fill}} />
    case '▄':
      return <rect x={x} y={y + CELL_H / 2} width={CELL_W} height={CELL_H / 2} style={{fill}} />
    case '▓':
      return <rect x={x} y={y} width={CELL_W} height={CELL_H} fill={`url(#shade-${cell.tone})`} />
    case '▒':
      return <rect x={x} y={y} width={CELL_W} height={CELL_H} fill={`url(#shade-${cell.tone})`} opacity={0.6} />
    case '░':
      return <rect x={x} y={y} width={CELL_W} height={CELL_H} fill={`url(#shade-${cell.tone})`} opacity={0.3} />
    default:
      return null
  }
}

export function Logo({onClick, title}: {onClick?: () => void; title?: string}) {
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const delays = useMemo(() => GRID.map(row => row.map(() => Math.random() * INTRO_SPREAD_MS)), [])
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'idle' : 'intro')
  const [t, setT] = useState(0)

  useEffect(() => {
    if (reducedMotion) return
    if (phase === 'idle') {
      const id = setTimeout(() => {
        setT(0)
        setPhase('sweep')
      }, SWEEP_EVERY_MS)
      return () => clearTimeout(id)
    }
    const duration = phase === 'intro' ? INTRO_MS : SWEEP_MS
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed >= duration) {
        setT(0)
        setPhase('idle')
        return
      }
      setT(elapsed)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, reducedMotion])

  return (
    <svg
      className="logo"
      viewBox={`0 0 ${COLS * CELL_W} ${ROWS * CELL_H}`}
      role="img"
      aria-label="yoinks"
      onClick={onClick}
      style={{cursor: onClick ? 'pointer' : undefined}}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        {(['primary', 'gray'] as const).map(tone => (
          <pattern key={tone} id={`shade-${tone}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="2.5" height="2.5" style={{fill: `var(--${tone})`}} />
            <rect x="2.5" y="2.5" width="2.5" height="2.5" style={{fill: `var(--${tone})`}} />
          </pattern>
        ))}
      </defs>
      {GRID.map((cells, row) =>
        cells.map((ch, col) => (
          <CellRect key={`${row}-${col}`} cell={cellAt(ch, row, col, phase, t, delays[row]![col]!)} row={row} col={col} />
        )),
      )}
    </svg>
  )
}
