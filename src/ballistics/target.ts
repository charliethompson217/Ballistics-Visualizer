import type { TrajectoryPoint } from './types'

const NICE_RADIUS_MULTIPLIERS = [1, 1.5, 2, 3, 5, 7.5, 10]

/** Chooses one fixed, readable target radius for a complete set of trajectory points. */
export function calculateBullseyeRadius(points: TrajectoryPoint[]) {
  const maximumOffset = points.reduce((maximum, point) => Math.max(
    maximum,
    Math.abs(point.pathInches),
    Math.abs(point.windageInches ?? 0),
  ), 0)
  const paddedOffset = Math.max(3, maximumOffset * 1.15)
  const magnitude = 10 ** Math.floor(Math.log10(paddedOffset))
  const normalized = paddedOffset / magnitude
  const multiplier = NICE_RADIUS_MULTIPLIERS.find((candidate) => candidate >= normalized) ?? 10
  return multiplier * magnitude
}
