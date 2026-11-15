import type { Shot } from '../ballistics/types'
import { toDisplayUnit, unitLabel, type Quantity, type UnitSystem } from '../units/conversions'

const NUMERIC_SETTINGS: Record<string, { name: string; quantity: Quantity }> = {
  muzzleVelocityFps: { name: 'muzzleVelocity', quantity: 'velocity' },
  velocityFps: { name: 'velocity', quantity: 'velocity' },
  weightGrains: { name: 'weight', quantity: 'weight' },
  diameterInches: { name: 'diameter', quantity: 'length' },
  lengthInches: { name: 'length', quantity: 'length' },
  twistRateInches: { name: 'twistRate', quantity: 'length' },
  sightHeightInches: { name: 'sightHeight', quantity: 'length' },
  rangeYards: { name: 'range', quantity: 'range' },
  zeroDistanceYards: { name: 'zeroDistance', quantity: 'range' },
  targetDistanceYards: { name: 'targetDistance', quantity: 'range' },
  dropInches: { name: 'drop', quantity: 'path' },
  temperatureF: { name: 'temperature', quantity: 'temperature' },
  referenceTemperatureF: { name: 'referenceTemperature', quantity: 'temperature' },
  currentTemperatureF: { name: 'currentTemperature', quantity: 'temperature' },
  powderTemperatureF: { name: 'powderTemperature', quantity: 'temperature' },
  pressureInHg: { name: 'pressure', quantity: 'pressure' },
  altitudeFeet: { name: 'altitude', quantity: 'altitude' },
  densityAltitudeFeet: { name: 'densityAltitude', quantity: 'altitude' },
  elevationDifferenceFeet: { name: 'elevationDifference', quantity: 'altitude' },
  sensitivityFpsPerDegree: { name: 'sensitivity', quantity: 'velocityTemperatureSensitivity' },
  windSpeedMph: { name: 'windSpeed', quantity: 'windSpeed' },
  verticalWindSpeedMph: { name: 'verticalWindSpeed', quantity: 'windSpeed' },
}

/** Results settings carry explicit units; configuration-file serialization stays separate. */
export function exportShotSettings(shot: Shot, units: UnitSystem): unknown {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert)
    if (value === null || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      const setting = NUMERIC_SETTINGS[key]
      if (setting && typeof entry === 'number') {
        return [setting.name, {
          value: toDisplayUnit(entry, setting.quantity, units, false), unit: unitLabel(setting.quantity, units),
        }]
      }
      return [key, convert(entry)]
    }))
  }
  return convert(shot)
}
