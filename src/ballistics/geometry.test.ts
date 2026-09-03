import { describe, expect, it } from 'vitest'
import { calculateShootingAngleDegrees } from './geometry'

describe('shooting angle geometry', () => {
  it('returns zero for a level target', () => {
    expect(calculateShootingAngleDegrees(100, 0)).toBe(0)
  })

  it('calculates positive and negative target angles', () => {
    expect(calculateShootingAngleDegrees(100, 100)).toBeCloseTo(18.4349, 4)
    expect(calculateShootingAngleDegrees(100, -100)).toBeCloseTo(-18.4349, 4)
  })

  it('rejects a non-positive horizontal range', () => {
    expect(() => calculateShootingAngleDegrees(0, 10)).toThrow('greater than zero')
  })
})
