import { describe, expect, it } from 'vitest'
import { calculateGyroscopicStability, describeStability } from './stability'

describe('gyroscopic stability', () => {
  it('calculates a plausible Miller stability factor', () => {
    const stability = calculateGyroscopicStability({
      weightGrains: 168,
      diameterInches: 0.308,
      lengthInches: 1.24,
      twistRateInches: 12,
      muzzleVelocityFps: 2700,
      temperatureF: 59,
      pressureInHg: 29.92,
    })
    expect(stability).toBeCloseTo(1.61, 1)
  })

  it('describes common stability bands', () => {
    expect(describeStability(0.9).label).toBe('Unstable')
    expect(describeStability(1.3).label).toBe('Marginal')
    expect(describeStability(1.7).label).toBe('Stable')
  })
})
