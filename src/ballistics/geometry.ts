/**
 * Returns the line-of-sight shooting angle from horizontal range and vertical offset.
 * Positive elevation means the target is above the shooter; negative is below.
 */
export function calculateShootingAngleDegrees(horizontalRangeYards: number, elevationDifferenceFeet: number) {
  if (!Number.isFinite(horizontalRangeYards) || horizontalRangeYards <= 0) {
    throw new Error('Target distance must be greater than zero.')
  }
  if (!Number.isFinite(elevationDifferenceFeet)) {
    throw new Error('Elevation difference must be a valid number.')
  }
  return Math.atan2(elevationDifferenceFeet, horizontalRangeYards * 3) * 180 / Math.PI
}
