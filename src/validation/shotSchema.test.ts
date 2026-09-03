import { describe, expect, it } from 'vitest'
import { defaultShots } from '../state/shots'
import { validateShot } from './shotSchema'

describe('shot input validation', () => {
  it('keeps a cleared required field invalid without replacing its value', () => {
    const shot = structuredClone(defaultShots[0])
    shot.muzzleVelocityFps = undefined

    const result = validateShot(shot)
    expect(result.errors.muzzleVelocityFps).toBe('Muzzle velocity is required')
    expect(shot.muzzleVelocityFps).toBeUndefined()
  })

  it('requires projectile data while estimating BC', () => {
    const shot = structuredClone(defaultShots[0])
    shot.projectile.bcEstimation.mode = 'estimated'
    shot.projectile.spinDrift.enabled = false
    shot.projectile.weightGrains = undefined
    shot.projectile.diameterInches = undefined

    const result = validateShot(shot)
    expect(result.errors['projectile.weightGrains']).toContain('estimate BC')
    expect(result.errors['projectile.diameterInches']).toContain('estimate BC')
  })

  it('requires spin inputs only when spin drift is enabled', () => {
    const shot = structuredClone(defaultShots[0])
    shot.projectile.spinDrift.enabled = false
    shot.projectile.spinDrift.twistRateInches = undefined
    expect(validateShot(shot).errors['projectile.spinDrift.twistRateInches']).toBeUndefined()

    shot.projectile.spinDrift.enabled = true
    expect(validateShot(shot).errors['projectile.spinDrift.twistRateInches']).toContain('spin drift')
  })

  it('accepts an unfinished optional compass and Coriolis setup', () => {
    const shot = structuredClone(defaultShots[0])
    shot.windAndAngle.windReference = 'compass'
    shot.windAndAngle.coriolisEnabled = true
    shot.windAndAngle.compassWindDirectionDegrees = undefined
    shot.windAndAngle.shotDirectionDegrees = undefined
    shot.windAndAngle.latitudeDegrees = undefined

    expect(validateShot(shot).valid).toBe(true)
  })

  it('requires only the active atmosphere input mode', () => {
    const shot = structuredClone(defaultShots[0])
    shot.environment.mode = 'densityAltitude'
    shot.environment.densityAltitudeFeet = 3000
    shot.environment.pressureInHg = undefined
    shot.environment.relativeHumidity = undefined
    shot.environment.altitudeFeet = undefined

    expect(validateShot(shot).valid).toBe(true)
    shot.environment.densityAltitudeFeet = undefined
    expect(validateShot(shot).errors['environment.densityAltitudeFeet']).toContain('required')
  })

  it('keeps an unfinished optional powder model from invalidating the shot', () => {
    const shot = structuredClone(defaultShots[0])
    shot.environment.powderTemperature = { mode: 'curve', points: [{}, {}] }
    expect(validateShot(shot).valid).toBe(true)
  })
})
