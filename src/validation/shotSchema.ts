import { z } from 'zod'
import type { Shot } from '../ballistics/types'

const positive = (label: string) => z.number().finite().positive(`${label} must be greater than 0`)
const optionalPositive = (label: string) => positive(label).optional()
const requiredPaths: Array<{ path: (string | number)[]; label: string }> = [
  { path: ['muzzleVelocityFps'], label: 'Muzzle velocity' },
  { path: ['projectile', 'ballisticCoefficient'], label: 'Ballistic coefficient' },
  { path: ['scope', 'sightHeightInches'], label: 'Sight height' },
  { path: ['scope', 'zeroDistanceYards'], label: 'Zero distance' },
  { path: ['windAndAngle', 'windSpeedMph'], label: 'Wind speed' },
]

export const editableShotSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Give this shot a name').max(80),
  color: z.string(),
  visible: z.boolean(),
  muzzleVelocityFps: optionalPositive('Muzzle velocity').refine((value) => value === undefined || value <= 6000, 'Use 6,000 fps or less'),
  projectile: z.object({
    ballisticCoefficient: optionalPositive('Ballistic coefficient').refine((value) => value === undefined || value <= 2, 'Use a BC of 2 or less'),
    dragModel: z.enum(['G1', 'G7']),
    weightGrains: optionalPositive('Bullet weight').refine((value) => value === undefined || value <= 2000, 'Use 2,000 grains or less'),
    diameterInches: optionalPositive('Diameter').refine((value) => value === undefined || value <= 2, 'Use 2 inches or less'),
    lengthInches: optionalPositive('Length').refine((value) => value === undefined || value <= 5, 'Use 5 inches or less'),
    bcEstimation: z.object({
      mode: z.enum(['known', 'estimated']),
      points: z.array(z.object({
        rangeYards: optionalPositive('Measured range').refine((value) => value === undefined || value <= 5000, 'Use 5,000 yards or less'),
        dropInches: z.number().finite().optional(),
      })).min(2).max(8),
    }),
    spinDrift: z.object({
      enabled: z.boolean(),
      twistRateInches: optionalPositive('Twist rate').refine((value) => value === undefined || value <= 100, 'Use 100 inches or less'),
      twistDirection: z.enum(['left', 'right']),
    }),
  }),
  scope: z.object({
    zeroDistanceYards: optionalPositive('Zero distance').refine((value) => value === undefined || value <= 3000, 'Use 3,000 yards or less'),
    sightHeightInches: optionalPositive('Sight height').refine((value) => value === undefined || value <= 12, 'Use 12 inches or less'),
    adjustment: z.object({
      unit: z.enum(['moa', 'mrad']),
      vertical: z.number().finite().min(-1000).max(1000).optional(),
      horizontal: z.number().finite().min(-1000).max(1000).optional(),
    }),
    zeroConditions: z.object({
      mode: z.enum(['current', 'custom']),
      atmosphereMode: z.enum(['weather', 'densityAltitude']),
      muzzleVelocityFps: optionalPositive('Zero-day muzzle velocity').refine((value) => value === undefined || value <= 6000, 'Use 6,000 fps or less'),
      temperatureF: z.number().finite().min(-100).max(180).optional(),
      pressureInHg: z.number().finite().min(15).max(35).optional(),
      pressureType: z.enum(['absolute', 'qnh']),
      relativeHumidity: z.number().finite().min(0).max(100).optional(),
      altitudeFeet: z.number().finite().min(-1500).max(30000).optional(),
      densityAltitudeFeet: z.number().finite().min(-15000).max(50000).optional(),
      powderTemperatureF: z.number().finite().min(-100).max(250).optional(),
    }).default({ mode: 'current', atmosphereMode: 'weather', pressureType: 'absolute' }),
  }),
  environment: z.object({
    mode: z.enum(['weather', 'densityAltitude']).default('weather'),
    temperatureF: z.number().finite().min(-100).max(180).optional(),
    pressureInHg: z.number().finite().min(15).max(35).optional(),
    pressureType: z.enum(['absolute', 'qnh']).default('absolute'),
    relativeHumidity: z.number().finite().min(0).max(100).optional(),
    altitudeFeet: z.number().finite().min(-1500).max(30000).optional(),
    densityAltitudeFeet: z.number().finite().min(-15000).max(50000).optional(),
    powderTemperature: z.object({
      mode: z.enum(['none', 'linear', 'curve']),
      sensitivityFpsPerDegree: z.number().finite().min(-20).max(20).optional(),
      referenceTemperatureF: z.number().finite().min(-100).max(250).optional(),
      currentTemperatureF: z.number().finite().min(-100).max(250).optional(),
      points: z.array(z.object({
        temperatureF: z.number().finite().min(-100).max(250).optional(),
        velocityFps: optionalPositive('Measured velocity').refine((value) => value === undefined || value <= 6000, 'Use 6,000 fps or less'),
      })).min(2).max(6),
    }).default({ mode: 'none', points: [{}, {}] }),
  }),
  windAndAngle: z.object({
    windSpeedMph: z.number().finite().min(0).max(250).optional(),
    windDirectionDegrees: z.number().finite().min(0).max(360).optional(),
    windReference: z.enum(['relative', 'compass']).default('relative'),
    compassWindDirectionDegrees: z.number().finite().min(0).max(360).optional(),
    verticalWindSpeedMph: z.number().finite().min(0).max(250).optional(),
    verticalWindDirection: z.enum(['updraft', 'downdraft']).default('updraft'),
    shotDirectionDegrees: z.number().finite().min(0).max(360).optional(),
    coriolisEnabled: z.boolean().default(false),
    latitudeDegrees: z.number().finite().min(-90).max(90).optional(),
    cantDegrees: z.number().finite().min(0).max(90).optional(),
    cantDirection: z.enum(['clockwise', 'counterclockwise']).default('clockwise'),
    shootingAngle: z.object({
      mode: z.enum(['direct', 'calculated']),
      degrees: z.number().finite().min(-89).max(89).optional(),
      targetDistanceYards: optionalPositive('Target distance').refine((value) => value === undefined || value <= 5000, 'Use 5,000 yards or less'),
      elevationDifferenceFeet: z.number().finite().min(-30000).max(30000).optional(),
    }),
  }),
}) satisfies z.ZodType<Shot>

function valueAtPath(input: unknown, path: (string | number)[]) {
  return path.reduce<unknown>((value, part) => {
    if (typeof value !== 'object' || value === null) return undefined
    return (value as Record<string | number, unknown>)[part]
  }, input)
}

export const shotSchema = editableShotSchema.superRefine((shot, context) => {
  for (const field of requiredPaths) {
    if (valueAtPath(shot, field.path) === undefined) {
      context.addIssue({ code: 'custom', path: field.path, message: `${field.label} is required` })
    }
  }

  if (shot.environment.mode === 'weather') {
    const weatherFields = [
      ['temperatureF', 'Temperature'],
      ['pressureInHg', 'Pressure'],
      ['relativeHumidity', 'Humidity'],
      ['altitudeFeet', 'Altitude'],
    ] as const
    for (const [field, label] of weatherFields) {
      if (shot.environment[field] === undefined) {
        context.addIssue({ code: 'custom', path: ['environment', field], message: `${label} is required` })
      }
    }
  } else if (shot.environment.densityAltitudeFeet === undefined) {
    context.addIssue({ code: 'custom', path: ['environment', 'densityAltitudeFeet'], message: 'Density altitude is required' })
  }

  if (shot.windAndAngle.windReference === 'relative' && shot.windAndAngle.windDirectionDegrees === undefined) {
    context.addIssue({ code: 'custom', path: ['windAndAngle', 'windDirectionDegrees'], message: 'Wind direction is required' })
  }

  if (shot.windAndAngle.shootingAngle.mode === 'calculated') {
    if (shot.windAndAngle.shootingAngle.targetDistanceYards === undefined) {
      context.addIssue({ code: 'custom', path: ['windAndAngle', 'shootingAngle', 'targetDistanceYards'], message: 'Horizontal distance is required' })
    }
    if (shot.windAndAngle.shootingAngle.elevationDifferenceFeet === undefined) {
      context.addIssue({ code: 'custom', path: ['windAndAngle', 'shootingAngle', 'elevationDifferenceFeet'], message: 'Target elevation is required' })
    }
  } else if (shot.windAndAngle.shootingAngle.degrees === undefined) {
    context.addIssue({ code: 'custom', path: ['windAndAngle', 'shootingAngle', 'degrees'], message: 'Shooting angle is required' })
  }

  const estimation = shot.projectile.bcEstimation
  if (estimation.mode === 'estimated') {
    if (shot.projectile.weightGrains === undefined) {
      context.addIssue({ code: 'custom', path: ['projectile', 'weightGrains'], message: 'Bullet weight is required to estimate BC' })
    }
    if (shot.projectile.diameterInches === undefined) {
      context.addIssue({ code: 'custom', path: ['projectile', 'diameterInches'], message: 'Diameter is required to estimate BC' })
    }
    estimation.points.slice(0, 2).forEach((point, index) => {
      if (point.rangeYards === undefined) {
        context.addIssue({ code: 'custom', path: ['projectile', 'bcEstimation', 'points', index, 'rangeYards'], message: 'Measured range is required' })
      }
      if (point.dropInches === undefined) {
        context.addIssue({ code: 'custom', path: ['projectile', 'bcEstimation', 'points', index, 'dropInches'], message: 'Measured drop is required' })
      }
    })
  }

  if (shot.projectile.spinDrift.enabled) {
    if (shot.projectile.weightGrains === undefined) {
      context.addIssue({ code: 'custom', path: ['projectile', 'weightGrains'], message: 'Bullet weight is required for spin drift' })
    }
    if (shot.projectile.diameterInches === undefined) {
      context.addIssue({ code: 'custom', path: ['projectile', 'diameterInches'], message: 'Diameter is required for spin drift' })
    }
    if (shot.projectile.spinDrift.twistRateInches === undefined) {
      context.addIssue({ code: 'custom', path: ['projectile', 'spinDrift', 'twistRateInches'], message: 'Twist rate is required for spin drift' })
    }
  }
})

export type ShotErrors = Record<string, string>

export function validateShot(shot: Shot): { valid: boolean; errors: ShotErrors } {
  const result = shotSchema.safeParse(shot)
  if (result.success) return { valid: true, errors: {} }

  const errors: ShotErrors = {}
  for (const issue of result.error.issues) errors[issue.path.join('.')] = issue.message
  return { valid: false, errors }
}
