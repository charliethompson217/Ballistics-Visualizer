import type { Shot } from '../../ballistics/types'
import { calculateShootingAngleDegrees } from '../../ballistics/geometry'
import { unitLabel, type UnitSystem } from '../../units/conversions'
import type { ShotErrors } from '../../validation/shotSchema'
import { NumberField } from './NumberField'

interface AngleEditorProps {
  shot: Shot
  units: UnitSystem
  errors: ShotErrors
  onChange: (shot: Shot) => void
}

export function AngleEditor({ shot, units, errors, onChange }: AngleEditorProps) {
  const shootingAngle = shot.windAndAngle.shootingAngle

  const updateCalculation = (targetDistanceYards: number | undefined, elevationDifferenceFeet: number | undefined) => {
    const next = structuredClone(shot)
    next.windAndAngle.shootingAngle = { ...shootingAngle, mode: 'calculated', targetDistanceYards, elevationDifferenceFeet }
    if (targetDistanceYards !== undefined && targetDistanceYards > 0 && elevationDifferenceFeet !== undefined) {
      next.windAndAngle.shootingAngle.degrees = calculateShootingAngleDegrees(targetDistanceYards, elevationDifferenceFeet)
    } else {
      next.windAndAngle.shootingAngle.degrees = undefined
    }
    onChange(next)
  }

  const setMode = (mode: 'direct' | 'calculated') => {
    const next = structuredClone(shot)
    next.windAndAngle.shootingAngle = { ...shootingAngle, mode }
    if (mode === 'calculated' && shootingAngle.targetDistanceYards !== undefined && shootingAngle.targetDistanceYards > 0 && shootingAngle.elevationDifferenceFeet !== undefined) {
      next.windAndAngle.shootingAngle.degrees = calculateShootingAngleDegrees(
        shootingAngle.targetDistanceYards,
        shootingAngle.elevationDifferenceFeet,
      )
    }
    onChange(next)
  }

  return (
    <div className="derived-editor">
      <div className="derived-editor__heading">
        <span>Shooting angle</span>
        <div className="mode-switch" aria-label="Shooting angle input method">
          <button className={shootingAngle.mode === 'direct' ? 'is-active' : ''} type="button" onClick={() => setMode('direct')}>Degrees</button>
          <button className={shootingAngle.mode === 'calculated' ? 'is-active' : ''} type="button" onClick={() => setMode('calculated')}>Elevation</button>
        </div>
      </div>

      {shootingAngle.mode === 'direct' ? (
        <NumberField
          label="Angle"
          unit="deg"
          units={units}
          min={-89}
          max={89}
          value={shootingAngle.degrees}
          error={errors['windAndAngle.shootingAngle.degrees']}
          onChange={(value) => {
            const next = structuredClone(shot)
            next.windAndAngle.shootingAngle.degrees = value
            onChange(next)
          }}
        />
      ) : (
        <>
          <div className="field-grid">
            <NumberField
              label="Horizontal distance"
              unit={unitLabel('range', units)}
              units={units}
              quantity="range"
              min={0.1}
              value={shootingAngle.targetDistanceYards}
              error={errors['windAndAngle.shootingAngle.targetDistanceYards']}
              required
              onChange={(value) => updateCalculation(value, shootingAngle.elevationDifferenceFeet)}
            />
            <NumberField
              label="Target elevation"
              unit={unitLabel('altitude', units)}
              units={units}
              quantity="altitude"
              value={shootingAngle.elevationDifferenceFeet}
              error={errors['windAndAngle.shootingAngle.elevationDifferenceFeet']}
              required
              message="Relative to the shooter: positive above, negative below."
              onChange={(value) => updateCalculation(shootingAngle.targetDistanceYards, value)}
            />
          </div>
          {shootingAngle.degrees !== undefined && (
            <div className="derived-result">
              <span>Calculated angle</span>
              <strong>{shootingAngle.degrees >= 0 ? '+' : ''}{shootingAngle.degrees.toFixed(2)}°</strong>
            </div>
          )}
        </>
      )}
    </div>
  )
}
