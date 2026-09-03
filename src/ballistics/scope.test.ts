import { describe, expect, it } from 'vitest'
import { angularAdjustmentInches, applyScopeAdjustment, convertAngularAdjustment } from './scope'

describe('scope adjustments', () => {
  it('converts true MOA to linear offset', () => {
    expect(angularAdjustmentInches(100, 1, 'moa')).toBeCloseTo(1.0472, 3)
  })

  it('converts milliradians to linear offset', () => {
    expect(angularAdjustmentInches(100, 1, 'mrad')).toBeCloseTo(3.6, 3)
  })

  it('preserves the angle when switching display units', () => {
    const milliradians = convertAngularAdjustment(3.4377467708, 'moa', 'mrad')
    expect(milliradians).toBeCloseTo(1, 8)
    expect(convertAngularAdjustment(milliradians, 'mrad', 'moa')).toBeCloseTo(3.4377467708, 5)
  })

  it('moves impact up and right for positive adjustments', () => {
    const adjusted = applyScopeAdjustment({
      rangeYards: 100,
      pathInches: -2,
      dropInches: 2,
      windageInches: -1,
      velocityFps: 2500,
      timeSeconds: 0.1,
    }, { unit: 'moa', vertical: 1, horizontal: 2 })

    expect(adjusted.pathInches).toBeCloseTo(-0.9528, 3)
    expect(adjusted.dropInches).toBeCloseTo(0.9528, 3)
    expect(adjusted.windageInches).toBeCloseTo(1.0944, 3)
  })
})
