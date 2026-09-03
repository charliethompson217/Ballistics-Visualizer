import { describe, expect, it } from 'vitest'
import { defaultShots } from './shots'
import { copySharedConditions, shareConditionsAcrossShots } from './sharedConditions'

describe('shared trajectory conditions', () => {
  it('copies rifle and range-day conditions while preserving ammunition inputs', () => {
    const source = structuredClone(defaultShots[0])
    const target = structuredClone(defaultShots[1])
    source.scope.zeroDistanceYards = 200
    source.scope.zeroConditions.muzzleVelocityFps = 2500
    source.scope.zeroConditions.powderTemperatureF = 45
    source.environment.temperatureF = 88
    source.environment.powderTemperature = {
      mode: 'linear',
      sensitivityFpsPerDegree: 1.1,
      referenceTemperatureF: 70,
      points: [{}, {}],
    }
    source.windAndAngle.windSpeedMph = 14
    source.projectile.spinDrift.enabled = true
    source.projectile.spinDrift.twistRateInches = 8

    target.scope.zeroConditions.muzzleVelocityFps = 2600
    target.scope.zeroConditions.powderTemperatureF = 55
    target.environment.powderTemperature = {
      mode: 'linear',
      sensitivityFpsPerDegree: 0.8,
      referenceTemperatureF: 65,
      points: [{}, {}],
    }
    source.scope.zeroConditions.atmosphereMode = 'densityAltitude'
    source.scope.zeroConditions.temperatureF = 35
    target.scope.zeroConditions.temperatureF = 50
    const originalProjectile = structuredClone(target.projectile)

    const result = copySharedConditions(source, target)

    expect(result.scope.zeroDistanceYards).toBe(200)
    expect(result.environment.temperatureF).toBe(88)
    expect(result.windAndAngle.windSpeedMph).toBe(14)
    expect(result.projectile.spinDrift).toEqual(source.projectile.spinDrift)
    expect(result.muzzleVelocityFps).toBe(target.muzzleVelocityFps)
    expect(result.projectile.ballisticCoefficient).toBe(originalProjectile.ballisticCoefficient)
    expect(result.projectile.weightGrains).toBe(originalProjectile.weightGrains)
    expect(result.environment.powderTemperature).toEqual(target.environment.powderTemperature)
    expect(result.scope.zeroConditions.muzzleVelocityFps).toBe(2600)
    expect(result.scope.zeroConditions.powderTemperatureF).toBe(55)
    expect(result.scope.zeroConditions.temperatureF).toBe(50)
    expect(result.name).toBe(target.name)
    expect(result.color).toBe(target.color)
  })

  it('uses the selected trajectory as the source for every other trajectory', () => {
    const shots = defaultShots.slice(0, 3).map((shot) => structuredClone(shot))
    shots[1].environment.temperatureF = 72
    const result = shareConditionsAcrossShots(shots, shots[1].id)

    expect(result.map((shot) => shot.environment.temperatureF)).toEqual([72, 72, 72])
    expect(result.map((shot) => shot.muzzleVelocityFps)).toEqual(shots.map((shot) => shot.muzzleVelocityFps))
  })
})
