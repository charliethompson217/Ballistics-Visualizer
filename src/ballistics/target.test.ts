import { describe, expect, it } from 'vitest'
import type { TrajectoryPoint } from './types'
import { calculateBullseyeRadius } from './target'

const point = (pathInches: number, windageInches = 0): TrajectoryPoint => ({
  rangeYards: 100,
  pathInches,
  dropInches: -pathInches,
  windageInches,
  velocityFps: 2000,
  timeSeconds: 0.1,
})

describe('bullseye scale', () => {
  it('uses a useful minimum target radius', () => {
    expect(calculateBullseyeRadius([point(0.5)])).toBe(3)
  })

  it('fits every point with padding using a readable fixed scale', () => {
    expect(calculateBullseyeRadius([point(-10.3), point(2, 4)])).toBe(15)
  })
})
