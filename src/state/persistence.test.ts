import { afterEach, expect, it, vi } from 'vitest'
import { loadShots, saveShots } from './persistence'
import { parseShotFile, serializeShotFile } from './shotFiles'
import { defaultShots, reorderShot } from './shots'

afterEach(() => vi.unstubAllGlobals())

it('preserves custom colors and trajectory order across storage and JSON round trips', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  const shots = structuredClone(defaultShots)
  shots[0].color = '#123abc'
  const reordered = reorderShot(shots, shots[0].id, shots[shots.length - 1].id, 'after')

  expect(reordered.map((shot) => shot.id)).toEqual([...shots.slice(1).map((shot) => shot.id), shots[0].id])
  expect(shots[0].id).toBe(defaultShots[0].id)
  saveShots(reordered)

  expect(loadShots()).toEqual(reordered)
  expect(parseShotFile(serializeShotFile(reordered))).toEqual(reordered)
  expect(reorderShot(reordered, shots[0].id, reordered[0].id, 'before')).toEqual(shots)
})
