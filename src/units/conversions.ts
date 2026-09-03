export const feetToYards = (feet: number) => feet / 3
export const yardsToFeet = (yards: number) => yards * 3
export const yardsToMeters = (yards: number) => yards * 0.9144
export const metersToYards = (meters: number) => meters / 0.9144
export const inchesToCentimeters = (inches: number) => inches * 2.54
export const centimetersToInches = (centimeters: number) => centimeters / 2.54
export const fpsToMetersPerSecond = (fps: number) => fps * 0.3048
export const metersPerSecondToFps = (metersPerSecond: number) => metersPerSecond / 0.3048

export const inchesToMillimeters = (inches: number) => inches * 25.4
export const millimetersToInches = (millimeters: number) => millimeters / 25.4
export const feetToMeters = (feet: number) => feet * 0.3048
export const metersToFeet = (meters: number) => meters / 0.3048
export const mphToMetersPerSecond = (mph: number) => mph * 0.44704
export const metersPerSecondToMph = (metersPerSecond: number) => metersPerSecond / 0.44704
export const grainsToGrams = (grains: number) => grains * 0.06479891
export const gramsToGrains = (grams: number) => grams / 0.06479891
export const fahrenheitToCelsius = (fahrenheit: number) => (fahrenheit - 32) * 5 / 9
export const celsiusToFahrenheit = (celsius: number) => celsius * 9 / 5 + 32
export const inHgToHpa = (inHg: number) => inHg * 33.8638866667
export const hpaToInHg = (hpa: number) => hpa / 33.8638866667
export const footPoundsToJoules = (footPounds: number) => footPounds * 1.3558179483

export type UnitSystem = 'imperial' | 'metric'
export type ImperialRangeUnit = 'yards' | 'feet'

export type Quantity =
  | 'range'
  | 'path'
  | 'length'
  | 'velocity'
  | 'velocityTemperatureSensitivity'
  | 'windSpeed'
  | 'temperature'
  | 'pressure'
  | 'altitude'
  | 'weight'
  | 'energy'

const precision: Record<Quantity, number> = {
  range: 2,
  path: 2,
  length: 2,
  velocity: 1,
  velocityTemperatureSensitivity: 2,
  windSpeed: 1,
  temperature: 1,
  pressure: 1,
  altitude: 1,
  weight: 2,
  energy: 1,
}

function rounded(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function toDisplayUnit(value: number, quantity: Quantity, units: UnitSystem, round = true) {
  if (units === 'imperial') return value

  const converted = (() => {
    switch (quantity) {
      case 'range': return yardsToMeters(value)
      case 'path': return inchesToCentimeters(value)
      case 'length': return inchesToMillimeters(value)
      case 'velocity': return fpsToMetersPerSecond(value)
      case 'velocityTemperatureSensitivity': return value * 0.3048 * 9 / 5
      case 'windSpeed': return mphToMetersPerSecond(value)
      case 'temperature': return fahrenheitToCelsius(value)
      case 'pressure': return inHgToHpa(value)
      case 'altitude': return feetToMeters(value)
      case 'weight': return grainsToGrams(value)
      case 'energy': return footPoundsToJoules(value)
    }
  })()

  return round ? rounded(converted, precision[quantity]) : converted
}

export function fromDisplayUnit(value: number, quantity: Quantity, units: UnitSystem) {
  if (units === 'imperial') return value

  switch (quantity) {
    case 'range': return metersToYards(value)
    case 'path': return centimetersToInches(value)
    case 'length': return millimetersToInches(value)
    case 'velocity': return metersPerSecondToFps(value)
    case 'velocityTemperatureSensitivity': return value / (0.3048 * 9 / 5)
    case 'windSpeed': return metersPerSecondToMph(value)
    case 'temperature': return celsiusToFahrenheit(value)
    case 'pressure': return hpaToInHg(value)
    case 'altitude': return metersToFeet(value)
    case 'weight': return gramsToGrains(value)
    case 'energy': return value / 1.3558179483
  }
}

export function unitLabel(quantity: Quantity, units: UnitSystem) {
  const labels: Record<UnitSystem, Record<Quantity, string>> = {
    imperial: {
      range: 'yd', path: 'in', length: 'in', velocity: 'fps', windSpeed: 'mph',
      velocityTemperatureSensitivity: 'fps/°F', temperature: '°F', pressure: 'inHg', altitude: 'ft', weight: 'gr', energy: 'ft-lb',
    },
    metric: {
      range: 'm', path: 'cm', length: 'mm', velocity: 'm/s', windSpeed: 'm/s',
      velocityTemperatureSensitivity: 'm/s/°C', temperature: '°C', pressure: 'hPa', altitude: 'm', weight: 'g', energy: 'J',
    },
  }
  return labels[units][quantity]
}

export function toAxisRange(yards: number, units: UnitSystem, imperialRangeUnit: ImperialRangeUnit, round = true) {
  const converted = units === 'metric'
    ? yardsToMeters(yards)
    : imperialRangeUnit === 'feet' ? yardsToFeet(yards) : yards
  return round ? rounded(converted, 2) : converted
}

export function fromAxisRange(value: number, units: UnitSystem, imperialRangeUnit: ImperialRangeUnit) {
  if (units === 'metric') return metersToYards(value)
  return imperialRangeUnit === 'feet' ? feetToYards(value) : value
}

export function axisRangeLabel(units: UnitSystem, imperialRangeUnit: ImperialRangeUnit) {
  if (units === 'metric') return 'm'
  return imperialRangeUnit === 'feet' ? 'ft' : 'yd'
}
