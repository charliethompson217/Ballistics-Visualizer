import type { Shot } from '../../ballistics/types'
import { unitLabel, type UnitSystem } from '../../units/conversions'
import type { ShotErrors } from '../../validation/shotSchema'
import { NumberField } from './NumberField'

interface EnvironmentEditorProps {
  shot: Shot
  units: UnitSystem
  errors: ShotErrors
  onChange: (shot: Shot) => void
}

export function EnvironmentEditor({ shot, units, errors, onChange }: EnvironmentEditorProps) {
  const update = (recipe: (draft: Shot) => void) => {
    const next = structuredClone(shot)
    recipe(next)
    onChange(next)
  }

  return (
    <>
      <div className="derived-editor__heading editor-heading--top">
        <span>Atmosphere input</span>
        <div className="mode-switch" aria-label="Atmosphere input mode">
          <button className={shot.environment.mode === 'weather' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.environment.mode = 'weather' })}>Weather</button>
          <button className={shot.environment.mode === 'densityAltitude' ? 'is-active' : ''} type="button" onClick={() => update((draft) => {
            draft.environment.mode = 'densityAltitude'
            draft.environment.densityAltitudeFeet ??= draft.environment.altitudeFeet ?? 0
          })}>Density altitude</button>
        </div>
      </div>

      {shot.environment.mode === 'weather' ? (
        <div className="field-grid">
          <NumberField label="Temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" required value={shot.environment.temperatureF} error={errors['environment.temperatureF']} onChange={(value) => update((draft) => { draft.environment.temperatureF = value })} />
          <NumberField
            label="Pressure"
            unit={unitLabel('pressure', units)}
            units={units}
            quantity="pressure"
            required
            value={shot.environment.pressureInHg}
            error={errors['environment.pressureInHg']}
            endControl={(
              <select aria-label="Pressure type" value={shot.environment.pressureType} onChange={(event) => update((draft) => { draft.environment.pressureType = event.target.value as 'absolute' | 'qnh' })}>
                <option value="absolute">Station</option>
                <option value="qnh">Altimeter</option>
              </select>
            )}
            message={shot.environment.pressureType === 'absolute' ? 'Station pressure is the pressure measured at your location.' : 'Altimeter (QNH) pressure is corrected to sea level.'}
            onChange={(value) => update((draft) => { draft.environment.pressureInHg = value })}
          />
          <NumberField label="Humidity" unit="%" units={units} min={0} max={100} required value={shot.environment.relativeHumidity} error={errors['environment.relativeHumidity']} onChange={(value) => update((draft) => { draft.environment.relativeHumidity = value })} />
          <NumberField label="Altitude" unit={unitLabel('altitude', units)} units={units} quantity="altitude" required value={shot.environment.altitudeFeet} error={errors['environment.altitudeFeet']} message="Required with altimeter pressure; useful with station pressure." onChange={(value) => update((draft) => { draft.environment.altitudeFeet = value })} />
        </div>
      ) : (
        <>
          <p className="derived-editor__intro">Use one density-altitude reading instead of entering pressure, humidity, and station altitude separately.</p>
          <div className="field-grid">
            <NumberField label="Density altitude" unit={unitLabel('altitude', units)} units={units} quantity="altitude" required value={shot.environment.densityAltitudeFeet} error={errors['environment.densityAltitudeFeet']} onChange={(value) => update((draft) => { draft.environment.densityAltitudeFeet = value })} />
          </div>
        </>
      )}
    </>
  )
}
