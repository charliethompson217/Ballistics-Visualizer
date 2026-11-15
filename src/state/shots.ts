import defaultShotFile from '../assets/default-shots.json?raw'
import type { Shot } from '../ballistics/types'
import { parseShotFile } from './shotFiles'

export const SHOT_COLORS = ['#ff6b2c', '#2cc5ff', '#a87cff', '#3ee69a', '#ffd23f', '#ff5db1', '#ff5364']

export const defaultShots: Shot[] = parseShotFile(defaultShotFile)

export function reorderShot(shots: Shot[], sourceId: string, targetId: string, position: 'before' | 'after'): Shot[] {
  const source = shots.find((shot) => shot.id === sourceId)
  if (!source || sourceId === targetId || !shots.some((shot) => shot.id === targetId)) return shots

  const next = shots.filter((shot) => shot.id !== sourceId)
  const targetIndex = next.findIndex((shot) => shot.id === targetId)
  next.splice(targetIndex + (position === 'after' ? 1 : 0), 0, source)
  return next
}

export function createShot(index: number, source?: Shot): Shot {
  const base = source ?? defaultShots[0]
  return {
    ...structuredClone(base),
    id: crypto.randomUUID(),
    name: source ? `${source.name} copy` : `New trajectory ${index + 1}`,
    color: SHOT_COLORS[index % SHOT_COLORS.length],
    visible: true,
  }
}
