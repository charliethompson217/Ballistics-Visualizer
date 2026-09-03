export interface StabilityInputs {
  weightGrains: number
  diameterInches: number
  lengthInches: number
  twistRateInches: number
  muzzleVelocityFps: number
  temperatureF: number
  pressureInHg: number
}

/**
 * Estimates gyroscopic stability with the original Miller twist rule.
 * Bullet length and twist are expressed in calibers inside the equation.
 */
export function calculateGyroscopicStability(inputs: StabilityInputs) {
  const {
    weightGrains,
    diameterInches,
    lengthInches,
    twistRateInches,
    muzzleVelocityFps,
    temperatureF,
    pressureInHg,
  } = inputs
  const values = Object.values(inputs)
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null

  const lengthCalibers = lengthInches / diameterInches
  const twistCalibers = twistRateInches / diameterInches
  const standardStability = (30 * weightGrains) / (
    twistCalibers ** 2
    * diameterInches ** 3
    * lengthCalibers
    * (1 + lengthCalibers ** 2)
  )
  const velocityCorrection = (muzzleVelocityFps / 2800) ** (1 / 3)
  const atmosphereCorrection = ((temperatureF + 460) / 519) * (29.92 / pressureInHg)
  const result = standardStability * velocityCorrection * atmosphereCorrection
  return Number.isFinite(result) ? result : null
}

export function describeStability(stability: number) {
  if (stability < 1) return { label: 'Unstable', tone: 'danger' as const }
  if (stability < 1.5) return { label: 'Marginal', tone: 'warning' as const }
  if (stability <= 2) return { label: 'Stable', tone: 'success' as const }
  return { label: 'High stability', tone: 'neutral' as const }
}
