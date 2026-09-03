import type { AngularUnit, TrajectoryPoint } from './types'

const MOA_PER_MRAD = 3.4377467708

export function convertAngularAdjustment(value: number | undefined, from: AngularUnit, to: AngularUnit) {
  if (value === undefined || from === to) return value
  const converted = from === 'moa' ? value / MOA_PER_MRAD : value * MOA_PER_MRAD
  return Math.round(converted * 1_000_000) / 1_000_000
}

export function angularAdjustmentInches(rangeYards: number, adjustment: number, unit: AngularUnit) {
  if (!Number.isFinite(rangeYards) || !Number.isFinite(adjustment)) return 0
  const angleRadians = unit === 'moa'
    ? adjustment * Math.PI / (180 * 60)
    : adjustment / 1000
  return Math.tan(angleRadians) * rangeYards * 36
}

export function applyScopeAdjustment(
  point: TrajectoryPoint,
  adjustment: { unit: AngularUnit; vertical?: number; horizontal?: number } | undefined,
): TrajectoryPoint {
  if (!adjustment) return point
  const verticalOffset = angularAdjustmentInches(point.rangeYards, adjustment.vertical ?? 0, adjustment.unit)
  const horizontalOffset = angularAdjustmentInches(point.rangeYards, adjustment.horizontal ?? 0, adjustment.unit)

  return {
    ...point,
    pathInches: point.pathInches + verticalOffset,
    dropInches: point.dropInches - verticalOffset,
    windageInches: (point.windageInches ?? 0) + horizontalOffset,
  }
}
