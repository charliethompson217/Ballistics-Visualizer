import { describe, expect, it } from 'vitest'
import type { Shot } from './types'
import { buildTrajectoryCommand, calculationRangeForView, parseEstimatedBallisticCoefficient } from './engine'
import { defaultShots } from '../state/shots'

describe('BC estimator output normalization', () => {
  it('parses a labeled estimate', () => {
    expect(parseEstimatedBallisticCoefficient('Estimated BC: 0.475', 'G1')).toBe(0.475)
  })

  it('parses the engine table row for the requested model', () => {
    const output = 'Model  Fit basis  Estimated BC  Fit RMS\nG7     drop       0.243         0.8 in'
    expect(parseEstimatedBallisticCoefficient(output, 'G7')).toBe(0.243)
  })

  it('rejects unreliable estimates', () => {
    expect(() => parseEstimatedBallisticCoefficient('G1 0.010 UNRELIABLE (hit BC limit)', 'G1')).toThrow('reliable BC')
  })
})

describe('trajectory command', () => {
  it('enables spin drift with the selected twist direction', () => {
    const shot: Shot = structuredClone(defaultShots[0])
    shot.projectile.spinDrift.enabled = true
    shot.projectile.spinDrift.twistRateInches = 10
    shot.projectile.spinDrift.twistDirection = 'left'
    const command = buildTrajectoryCommand(shot, 500)

    expect(command).toContain('--twist-rate 10')
    expect(command).toContain('--twist-right false')
    expect(command).toContain('--enable-spin-drift')
  })

  it('supports an inclined shot over the visible default range', () => {
    const shot: Shot = structuredClone(defaultShots[0])
    shot.windAndAngle.shootingAngle.degrees = 45
    const command = buildTrajectoryCommand(
      shot,
      calculationRangeForView(100, shot.scope.zeroDistanceYards),
    )

    expect(command).toContain('--max-range 105')
    expect(command).toContain('--shooting-angle 45')
    expect(command).toContain('--use-rk4-fixed')
    expect(command).toContain('--time-step 0.0005')
  })

  it('maps calculation detail to fixed integration sample spacing', () => {
    const shot = structuredClone(defaultShots[0])
    expect(buildTrajectoryCommand(shot, 100, 'fast')).toContain('--time-step 0.001')
    expect(buildTrajectoryCommand(shot, 100, 'detailed')).toContain('--time-step 0.0005')
    expect(buildTrajectoryCommand(shot, 100, 'maximum')).toContain('--time-step 0.00025')
  })

  it('only applies compass wind and Coriolis when their inputs are complete', () => {
    const shot = structuredClone(defaultShots[0])
    shot.windAndAngle.windSpeedMph = 10
    shot.windAndAngle.windReference = 'compass'
    shot.windAndAngle.compassWindDirectionDegrees = 270
    shot.windAndAngle.coriolisEnabled = true
    let command = buildTrajectoryCommand(shot, 500)

    expect(command).not.toContain('--wind-ref compass')
    expect(command).not.toContain('--enable-coriolis')
    expect(command).toContain('--wind-direction 90')

    shot.windAndAngle.shotDirectionDegrees = 45
    shot.windAndAngle.latitudeDegrees = 40
    command = buildTrajectoryCommand(shot, 500)

    expect(command).toContain('--wind-direction 270')
    expect(command).toContain('--wind-ref compass')
    expect(command).toContain('--shot-direction 45')
    expect(command).toContain('--enable-coriolis --latitude 40')
  })

  it('maps vertical wind, cant, density altitude, zero-day, and powder settings', () => {
    const shot = structuredClone(defaultShots[0])
    shot.environment.mode = 'densityAltitude'
    shot.environment.densityAltitudeFeet = 4200
    shot.environment.powderTemperature = {
      mode: 'curve',
      currentTemperatureF: 60,
      points: [
        { temperatureF: 30, velocityFps: 2600 },
        { temperatureF: 80, velocityFps: 2710 },
      ],
    }
    shot.scope.zeroConditions = {
      mode: 'custom',
      atmosphereMode: 'weather',
      muzzleVelocityFps: 2650,
      temperatureF: 40,
      pressureInHg: 29.5,
      pressureType: 'qnh',
      relativeHumidity: 30,
      altitudeFeet: 1200,
      powderTemperatureF: 45,
    }
    shot.windAndAngle.verticalWindSpeedMph = 3
    shot.windAndAngle.verticalWindDirection = 'downdraft'
    shot.windAndAngle.cantDegrees = 2
    shot.windAndAngle.cantDirection = 'counterclockwise'

    const command = buildTrajectoryCommand(shot, 500)
    expect(command).toContain('--density-altitude 4200')
    expect(command).toContain('--wind-vertical -3')
    expect(command).toContain('--cant -2')
    expect(command).toContain('--zero-velocity 2650')
    expect(command).toContain('--zero-pressure 29.5 --zero-pressure-type qnh')
    expect(command).toContain('--powder-temp-curve 30:2600,80:2710')
    expect(command).toContain('--powder-temp 60')
  })

  it('leaves unfinished powder models inactive and sorts completed curve points', () => {
    const shot = structuredClone(defaultShots[0])
    shot.environment.mode = 'densityAltitude'
    shot.environment.densityAltitudeFeet = 2000
    shot.environment.temperatureF = undefined
    shot.environment.powderTemperature = {
      mode: 'curve',
      points: [
        { temperatureF: 80, velocityFps: 2710 },
        { temperatureF: 30, velocityFps: 2600 },
      ],
    }
    expect(buildTrajectoryCommand(shot, 100)).not.toContain('--powder-temp-curve')

    shot.environment.powderTemperature.currentTemperatureF = 60
    expect(buildTrajectoryCommand(shot, 100)).toContain('--powder-temp-curve 30:2600,80:2710')
  })
})
