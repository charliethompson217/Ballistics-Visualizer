import type { CalculationQuality, Shot, ShotInputMode } from '../ballistics/types'
import { editableShotSchema } from '../validation/shotSchema'
import { SHOT_COLORS } from './shots'
import type { ImperialRangeUnit, UnitSystem } from '../units/conversions'

const STORAGE_KEY = 'trajectory-lab:shots:v1'
const UNITS_STORAGE_KEY = 'trajectory-lab:units:v1'
const RANGE_UNITS_STORAGE_KEY = 'trajectory-lab:range-units:v1'
const CALCULATION_QUALITY_STORAGE_KEY = 'trajectory-lab:calculation-quality:v1'
const SHOT_INPUT_MODE_STORAGE_KEY = 'trajectory-lab:shot-input-mode:v1'

export function loadShots(): Shot[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const valid = parsed.map((shot) => editableShotSchema.safeParse(shot)).filter((result) => result.success)
    return valid.length > 0
      ? valid.map((result, index) => ({ ...result.data, color: SHOT_COLORS[index % SHOT_COLORS.length] }))
      : null
  } catch {
    return null
  }
}

export function saveShots(shots: Shot[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shots))
  } catch {
    // Persistence is a convenience; calculation should still work when storage is unavailable.
  }
}

export function loadUnitSystem(): UnitSystem {
  try {
    const requested = new URLSearchParams(window.location.search).get('units')
    if (requested === 'metric' || requested === 'imperial') return requested
    return localStorage.getItem(UNITS_STORAGE_KEY) === 'metric' ? 'metric' : 'imperial'
  } catch {
    return 'imperial'
  }
}

export function saveUnitSystem(units: UnitSystem) {
  try {
    localStorage.setItem(UNITS_STORAGE_KEY, units)
  } catch {
    // Unit preference can safely fall back to imperial when storage is unavailable.
  }
}

export function loadRangeUnit(): ImperialRangeUnit {
  try {
    const requested = new URLSearchParams(window.location.search).get('range')
    if (requested === 'feet' || requested === 'yards') return requested
    return localStorage.getItem(RANGE_UNITS_STORAGE_KEY) === 'feet' ? 'feet' : 'yards'
  } catch {
    return 'yards'
  }
}

export function saveRangeUnit(unit: ImperialRangeUnit) {
  try {
    localStorage.setItem(RANGE_UNITS_STORAGE_KEY, unit)
  } catch {
    // Range display preference can safely fall back to yards.
  }
}

export function loadCalculationQuality(): CalculationQuality {
  try {
    const value = localStorage.getItem(CALCULATION_QUALITY_STORAGE_KEY)
    return value === 'fast' || value === 'maximum' ? value : 'detailed'
  } catch {
    return 'detailed'
  }
}

export function saveCalculationQuality(quality: CalculationQuality) {
  try {
    localStorage.setItem(CALCULATION_QUALITY_STORAGE_KEY, quality)
  } catch {
    // Calculation quality can safely fall back to the detailed preset.
  }
}

export function loadShotInputMode(): ShotInputMode {
  try {
    return localStorage.getItem(SHOT_INPUT_MODE_STORAGE_KEY) === 'sharedConditions'
      ? 'sharedConditions'
      : 'independent'
  } catch {
    return 'independent'
  }
}

export function saveShotInputMode(mode: ShotInputMode) {
  try {
    localStorage.setItem(SHOT_INPUT_MODE_STORAGE_KEY, mode)
  } catch {
    // Input mode can safely fall back to independent trajectories.
  }
}
