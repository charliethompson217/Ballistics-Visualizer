import type { Shot } from '../ballistics/types'

/**
 * Copy range-day and rifle settings while preserving the target trajectory's
 * ammunition/load inputs and presentation state.
 */
export function copySharedConditions(source: Shot, target: Shot): Shot {
  const next = structuredClone(target)
  const targetPowderTemperature = structuredClone(target.environment.powderTemperature)
  const targetZeroVelocity = target.scope.zeroConditions.muzzleVelocityFps
  const targetZeroPowderTemperature = target.scope.zeroConditions.powderTemperatureF
  const preserveTargetZeroTemperature = target.environment.powderTemperature.mode === 'linear'
    && source.scope.zeroConditions.atmosphereMode === 'densityAltitude'
  const targetZeroLinearTemperature = target.scope.zeroConditions.temperatureF

  next.scope = structuredClone(source.scope)
  next.scope.zeroConditions.muzzleVelocityFps = targetZeroVelocity
  next.scope.zeroConditions.powderTemperatureF = targetZeroPowderTemperature
  if (preserveTargetZeroTemperature) {
    next.scope.zeroConditions.temperatureF = targetZeroLinearTemperature
  }

  next.environment = structuredClone(source.environment)
  next.environment.powderTemperature = targetPowderTemperature

  next.windAndAngle = structuredClone(source.windAndAngle)
  next.projectile.spinDrift = structuredClone(source.projectile.spinDrift)

  return next
}

export function shareConditionsAcrossShots(shots: Shot[], sourceId: string): Shot[] {
  const source = shots.find((shot) => shot.id === sourceId)
  if (!source) return shots
  return shots.map((shot) => shot.id === sourceId ? shot : copySharedConditions(source, shot))
}
