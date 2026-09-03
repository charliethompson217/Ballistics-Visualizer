export type DragModel = 'G1' | 'G7'
export type AngularUnit = 'moa' | 'mrad'
export type CalculationQuality = 'fast' | 'detailed' | 'maximum'
export type ShotInputMode = 'independent' | 'sharedConditions'
export type PressureType = 'absolute' | 'qnh'

export interface BcMeasurementPoint {
  rangeYards?: number
  dropInches?: number
}

export interface BcEstimation {
  mode: 'known' | 'estimated'
  points: BcMeasurementPoint[]
}

export interface SpinDrift {
  enabled: boolean
  twistRateInches?: number
  twistDirection: 'left' | 'right'
}

export interface Projectile {
  ballisticCoefficient?: number
  dragModel: DragModel
  weightGrains?: number
  diameterInches?: number
  lengthInches?: number
  bcEstimation: BcEstimation
  spinDrift: SpinDrift
}

export interface Environment {
  mode: 'weather' | 'densityAltitude'
  temperatureF?: number
  pressureInHg?: number
  pressureType: PressureType
  relativeHumidity?: number
  altitudeFeet?: number
  densityAltitudeFeet?: number
  powderTemperature: PowderTemperature
}

export interface PowderTemperaturePoint {
  temperatureF?: number
  velocityFps?: number
}

export interface PowderTemperature {
  mode: 'none' | 'linear' | 'curve'
  sensitivityFpsPerDegree?: number
  referenceTemperatureF?: number
  currentTemperatureF?: number
  points: PowderTemperaturePoint[]
}

export interface ScopeAdjustment {
  unit: AngularUnit
  vertical?: number
  horizontal?: number
}

export interface Scope {
  zeroDistanceYards?: number
  sightHeightInches?: number
  adjustment: ScopeAdjustment
  zeroConditions: ZeroConditions
}

export interface ZeroConditions {
  mode: 'current' | 'custom'
  atmosphereMode: 'weather' | 'densityAltitude'
  muzzleVelocityFps?: number
  temperatureF?: number
  pressureInHg?: number
  pressureType: PressureType
  relativeHumidity?: number
  altitudeFeet?: number
  densityAltitudeFeet?: number
  powderTemperatureF?: number
}

export interface ShootingAngle {
  mode: 'direct' | 'calculated'
  degrees?: number
  targetDistanceYards?: number
  elevationDifferenceFeet?: number
}

export interface WindAndAngle {
  windSpeedMph?: number
  windDirectionDegrees?: number
  windReference: 'relative' | 'compass'
  compassWindDirectionDegrees?: number
  verticalWindSpeedMph?: number
  verticalWindDirection: 'updraft' | 'downdraft'
  shotDirectionDegrees?: number
  coriolisEnabled: boolean
  latitudeDegrees?: number
  cantDegrees?: number
  cantDirection: 'clockwise' | 'counterclockwise'
  shootingAngle: ShootingAngle
}

export interface Shot {
  id: string
  name: string
  muzzleVelocityFps?: number
  projectile: Projectile
  scope: Scope
  environment: Environment
  windAndAngle: WindAndAngle
  visible: boolean
  color: string
}

export interface TrajectoryPoint {
  rangeYards: number
  pathInches: number
  dropInches: number
  velocityFps: number
  timeSeconds: number
  windageInches?: number
  mach?: number
  energyFtLb?: number
}

export interface ShotTrajectory {
  shotId: string
  points: TrajectoryPoint[]
  error?: string
}

export type GraphMetric = 'pathInches' | 'velocityFps' | 'windageInches' | 'energyFtLb'
export type GraphView = GraphMetric | 'bullseye'

export interface GraphBounds {
  minX: number
  maxX: number
  autoY: boolean
  minY: number
  maxY: number
}
