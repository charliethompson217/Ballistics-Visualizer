import { WasmBallistics } from 'ballistics-engine'
import type { CalculationQuality, Shot, TrajectoryPoint } from './types'
import { applyScopeAdjustment } from './scope'

interface EnginePoint {
  range_yards?: number
  drop_inches?: number
  drift_inches?: number
  windage_inches?: number
  velocity_fps?: number
  energy_ftlb?: number
  energy_ft_lbs?: number
  time_seconds?: number
  time_sec?: number
}

interface EngineResponse {
  trajectory?: EnginePoint[]
}

export interface BcMeasurement {
  rangeYards?: number
  dropInches?: number
}

const trajectoryCache = new Map<string, TrajectoryPoint[]>()
const MAX_CACHE_ENTRIES = 80
const QUALITY_TIME_STEPS: Record<CalculationQuality, number> = {
  fast: 0.001,
  detailed: 0.0005,
  maximum: 0.00025,
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function calculationRangeForView(maxVisibleRangeYards: number, zeroDistanceYards: number | undefined) {
  return Math.max(
    1,
    finite(maxVisibleRangeYards, 100),
    finite(zeroDistanceYards, 0) + 5,
  )
}

function cacheKey(shot: Shot, maxRangeYards: number, quality: CalculationQuality) {
  return JSON.stringify({
    muzzleVelocityFps: shot.muzzleVelocityFps,
    projectile: shot.projectile,
    scope: shot.scope,
    environment: shot.environment,
    windAndAngle: shot.windAndAngle,
    maxRangeYards,
    quality,
  })
}

function normalizePoint(point: EnginePoint, temperatureF: number | undefined): TrajectoryPoint | null {
  const rangeYards = point.range_yards
  const dropInches = point.drop_inches
  const velocityFps = point.velocity_fps

  if (
    typeof rangeYards !== 'number' ||
    typeof dropInches !== 'number' ||
    typeof velocityFps !== 'number'
  ) {
    return null
  }

  const speedOfSoundFps = 49.02 * Math.sqrt(finite(temperatureF, 59) + 459.67)

  return {
    rangeYards,
    // The engine reports vertical miss as positive down. The graph's path uses
    // the conventional positive-up line-of-sight reference.
    pathInches: -dropInches,
    dropInches,
    velocityFps,
    timeSeconds: point.time_seconds ?? point.time_sec ?? 0,
    windageInches: point.drift_inches ?? point.windage_inches ?? 0,
    energyFtLb: point.energy_ftlb ?? point.energy_ft_lbs,
    mach: velocityFps / speedOfSoundFps,
  }
}

export function buildTrajectoryCommand(shot: Shot, maxRangeYards: number, quality: CalculationQuality = 'detailed') {
  const projectile = shot.projectile
  const environment = shot.environment
  const wind = shot.windAndAngle
  const mass = projectile.weightGrains ?? 168
  const diameter = projectile.diameterInches ?? 0.308
  const compassWindReady = wind.windReference === 'compass'
    && wind.compassWindDirectionDegrees !== undefined
    && wind.shotDirectionDegrees !== undefined
  const coriolisReady = wind.coriolisEnabled
    && wind.latitudeDegrees !== undefined
    && wind.shotDirectionDegrees !== undefined
  const command: Array<string | number> = [
    'trajectory',
    '-v', finite(shot.muzzleVelocityFps, 2700),
    '-b', finite(projectile.ballisticCoefficient, 0.475),
    '-m', finite(mass, 168),
    '-d', finite(diameter, 0.308),
    '--drag-model', projectile.dragModel,
    '--max-range', maxRangeYards,
    '--auto-zero', finite(shot.scope.zeroDistanceYards, 100),
    '--sight-height', finite(shot.scope.sightHeightInches, 1.5),
    '--shooting-angle', finite(wind.shootingAngle.degrees, 0),
    '--wind-speed', finite(wind.windSpeedMph, 0),
    '--wind-direction', compassWindReady
      ? finite(wind.compassWindDirectionDegrees, 0)
      : finite(wind.windDirectionDegrees, 90),
    '--temperature', finite(environment.temperatureF, 59),
    // Adaptive RK45 returns only a sparse subset of its internally accurate steps.
    // Fixed-step RK4 exposes every step, keeping the graph dense without inventing
    // intermediate trajectory values in the UI.
    '--use-rk4-fixed',
    '--time-step', QUALITY_TIME_STEPS[quality],
    '--ignore-ground-impact',
    '--output', 'json',
  ]

  if (environment.mode === 'densityAltitude' && environment.densityAltitudeFeet !== undefined) {
    command.push('--density-altitude', environment.densityAltitudeFeet)
  } else {
    command.push(
      '--pressure', finite(environment.pressureInHg, 29.92),
      '--pressure-type', environment.pressureType,
      '--humidity', finite(environment.relativeHumidity, 50),
      '--altitude', finite(environment.altitudeFeet, 0),
    )
  }

  if (compassWindReady) command.push('--wind-ref', 'compass')
  if ((compassWindReady || coriolisReady) && wind.shotDirectionDegrees !== undefined) {
    command.push('--shot-direction', wind.shotDirectionDegrees)
  }
  if (wind.verticalWindSpeedMph !== undefined && wind.verticalWindSpeedMph > 0) {
    command.push(
      '--wind-vertical',
      wind.verticalWindDirection === 'downdraft' ? -wind.verticalWindSpeedMph : wind.verticalWindSpeedMph,
    )
  }
  if (coriolisReady && wind.latitudeDegrees !== undefined) {
    command.push('--enable-coriolis', '--latitude', wind.latitudeDegrees)
  }
  if (wind.cantDegrees !== undefined && wind.cantDegrees > 0) {
    command.push('--cant', wind.cantDirection === 'counterclockwise' ? -wind.cantDegrees : wind.cantDegrees)
  }

  const zero = shot.scope.zeroConditions
  if (zero.mode === 'custom') {
    if (zero.muzzleVelocityFps !== undefined) command.push('--zero-velocity', zero.muzzleVelocityFps)
    if (zero.temperatureF !== undefined) command.push('--zero-temperature', zero.temperatureF)
    if (zero.relativeHumidity !== undefined) command.push('--zero-humidity', zero.relativeHumidity)
    if (zero.powderTemperatureF !== undefined) command.push('--zero-powder-temp', zero.powderTemperatureF)
    if (zero.atmosphereMode === 'densityAltitude' && zero.densityAltitudeFeet !== undefined) {
      command.push('--zero-density-altitude', zero.densityAltitudeFeet)
    } else {
      if (zero.pressureInHg !== undefined) {
        command.push('--zero-pressure', zero.pressureInHg, '--zero-pressure-type', zero.pressureType)
      }
      if (zero.altitudeFeet !== undefined) command.push('--zero-altitude', zero.altitudeFeet)
    }
  }

  const powder = environment.powderTemperature
  if (
    powder.mode === 'linear'
    && powder.sensitivityFpsPerDegree !== undefined
    && powder.referenceTemperatureF !== undefined
    && environment.temperatureF !== undefined
  ) {
    command.push(
      '--use-powder-sensitivity',
      '--powder-temp-sensitivity', powder.sensitivityFpsPerDegree,
      '--powder-temp', powder.referenceTemperatureF,
    )
  }
  if (powder.mode === 'curve') {
    const points = powder.points
      .filter(
        (point): point is { temperatureF: number; velocityFps: number } =>
          point.temperatureF !== undefined && point.velocityFps !== undefined,
      )
      .sort((a, b) => a.temperatureF - b.temperatureF)
    const temperaturesAreUnique = points.every((point, index) => index === 0 || point.temperatureF !== points[index - 1].temperatureF)
    const hasEvaluationTemperature = powder.currentTemperatureF !== undefined || environment.temperatureF !== undefined
    if (points.length >= 2 && temperaturesAreUnique && hasEvaluationTemperature) {
      command.push(
        '--powder-temp-curve',
        points.map((point) => `${point.temperatureF}:${point.velocityFps}`).join(','),
      )
      if (powder.currentTemperatureF !== undefined) command.push('--powder-temp', powder.currentTemperatureF)
    }
  }

  if (projectile.spinDrift.enabled && projectile.spinDrift.twistRateInches !== undefined) {
    command.push(
      '--twist-rate', finite(projectile.spinDrift.twistRateInches, 10),
      '--twist-right', projectile.spinDrift.twistDirection === 'left' ? 'false' : 'true',
      '--enable-spin-drift',
    )
  }

  return command.join(' ')
}

export function calculateTrajectory(shot: Shot, requestedMaxRangeYards: number, quality: CalculationQuality = 'detailed'): TrajectoryPoint[] {
  const maxRangeYards = Math.max(1, finite(requestedMaxRangeYards, 100))
  const key = cacheKey(shot, maxRangeYards, quality)
  const cached = trajectoryCache.get(key)
  if (cached) return cached

  const command = buildTrajectoryCommand(shot, maxRangeYards, quality)

  const engine = new WasmBallistics()

  try {
    const raw = engine.runCommand(command)
    if (raw.startsWith('Error')) throw new Error(raw)

    const jsonStart = raw.indexOf('{')
    if (jsonStart < 0) throw new Error('The ballistic engine returned an unexpected response.')

    const parsed = JSON.parse(raw.slice(jsonStart)) as EngineResponse
    const points = (parsed.trajectory ?? [])
      .map((point) => normalizePoint(point, shot.environment.temperatureF))
      .filter((point): point is TrajectoryPoint => point !== null)
      .map((point) => applyScopeAdjustment(point, shot.scope.adjustment))
      .sort((a, b) => a.rangeYards - b.rangeYards)

    if (points.length < 2) throw new Error('The ballistic engine did not return enough trajectory points.')

    trajectoryCache.set(key, points)
    if (trajectoryCache.size > MAX_CACHE_ENTRIES) {
      const oldest = trajectoryCache.keys().next().value
      if (typeof oldest === 'string') trajectoryCache.delete(oldest)
    }
    return points
  } finally {
    engine.free()
  }
}

export function parseEstimatedBallisticCoefficient(output: string, dragModel: 'G1' | 'G7') {
  if (/\bunreliable\b|search limit/i.test(output)) {
    throw new Error('The measurements did not determine a reliable BC. Add longer-range points and verify the zero, atmosphere, and measured drops.')
  }
  if (/\b(?:error|unable)\b/i.test(output)) {
    const firstLine = output.split('\n').find((line) => /\b(?:error|unable)\b/i.test(line))
    throw new Error((firstLine ?? output).replace(/^Error:\s*/i, '').trim())
  }

  const explicit = output.match(/Estimated BC\s*[:=]\s*(0?\.\d+|1(?:\.0+)?)/i)
  if (explicit) return Number(explicit[1])

  const modelLine = output.split('\n').find((line) => {
    const normalized = line.trim().toUpperCase()
    return normalized.startsWith(dragModel) && /\d/.test(normalized)
  })
  const candidates = modelLine?.match(/(?:^|\s)(0?\.\d+|1(?:\.0+)?)(?=\s|$)/g)
    ?.map((value) => Number(value.trim()))
    .filter((value) => value > 0 && value <= 1)

  if (candidates?.[0]) return candidates[0]
  throw new Error('The ballistic engine did not return a usable BC estimate.')
}

export function estimateBallisticCoefficient(shot: Shot, measurements: BcMeasurement[]) {
  const { projectile } = shot
  if (projectile.weightGrains === undefined || projectile.diameterInches === undefined) {
    throw new Error('Bullet weight and diameter are required to estimate BC.')
  }
  if (measurements.length < 2) throw new Error('Enter at least two measured range/drop points.')
  if (shot.muzzleVelocityFps === undefined) throw new Error('Muzzle velocity is required to estimate BC.')
  if (shot.scope.zeroDistanceYards === undefined) throw new Error('Zero distance is required to estimate BC.')
  if (shot.scope.sightHeightInches === undefined) throw new Error('Sight height is required to estimate BC.')
  if (measurements.some((point) => point.rangeYards === undefined || point.dropInches === undefined)) {
    throw new Error('Both measured ranges and drops are required to estimate BC.')
  }

  const data = measurements.map((point) => `${point.rangeYards as number},${point.dropInches as number}`).join(';')
  const command = [
    'estimate-bc',
    '-v', shot.muzzleVelocityFps,
    '-m', projectile.weightGrains,
    '-d', projectile.diameterInches,
    '--drag-model', projectile.dragModel.toLowerCase(),
    '--data', `"${data}"`,
    '--zero-range', shot.scope.zeroDistanceYards,
    '--sight-height', shot.scope.sightHeightInches,
    '--temperature', finite(shot.environment.temperatureF, 59),
    '--pressure', finite(shot.environment.pressureInHg, 29.92),
    '--humidity', finite(shot.environment.relativeHumidity, 50),
    '--altitude', finite(shot.environment.altitudeFeet, 0),
  ].join(' ')

  const engine = new WasmBallistics()
  try {
    return parseEstimatedBallisticCoefficient(engine.runCommand(command), projectile.dragModel)
  } finally {
    engine.free()
  }
}

export function interpolatePoint(points: TrajectoryPoint[], rangeYards: number): TrajectoryPoint | null {
  if (points.length === 0 || rangeYards < points[0].rangeYards) return null
  if (rangeYards > points[points.length - 1].rangeYards) return null

  let low = 0
  let high = points.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = points[mid].rangeYards
    if (value < rangeYards) low = mid + 1
    else if (value > rangeYards) high = mid - 1
    else return points[mid]
  }

  const before = points[Math.max(0, high)]
  const after = points[Math.min(points.length - 1, low)]
  if (before === after) return before
  const ratio = (rangeYards - before.rangeYards) / (after.rangeYards - before.rangeYards)
  const interpolate = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? undefined : a + (b - a) * ratio

  return {
    rangeYards,
    pathInches: interpolate(before.pathInches, after.pathInches) ?? 0,
    dropInches: interpolate(before.dropInches, after.dropInches) ?? 0,
    velocityFps: interpolate(before.velocityFps, after.velocityFps) ?? 0,
    timeSeconds: interpolate(before.timeSeconds, after.timeSeconds) ?? 0,
    windageInches: interpolate(before.windageInches, after.windageInches),
    mach: interpolate(before.mach, after.mach),
    energyFtLb: interpolate(before.energyFtLb, after.energyFtLb),
  }
}
