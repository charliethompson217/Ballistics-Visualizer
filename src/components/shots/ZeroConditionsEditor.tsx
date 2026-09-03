import type { Shot } from '../../ballistics/types'
import { unitLabel, type UnitSystem } from '../../units/conversions'
import type { ShotErrors } from '../../validation/shotSchema'
import { NumberField } from './NumberField'

interface ZeroConditionsEditorProps {
  shot: Shot
  units: UnitSystem
  errors: ShotErrors
  onChange: (shot: Shot) => void
}

export function ZeroConditionsEditor({ shot, units, errors, onChange }: ZeroConditionsEditorProps) {
  const zero = shot.scope.zeroConditions
  const update = (recipe: (draft: Shot) => void) => {
    const next = structuredClone(shot)
    recipe(next)
    onChange(next)
  }
  const copyCurrent = () => update((draft) => {
    const environment = draft.environment
    draft.scope.zeroConditions = {
      ...draft.scope.zeroConditions,
      mode: 'custom',
      atmosphereMode: environment.mode,
      muzzleVelocityFps: draft.muzzleVelocityFps,
      temperatureF: environment.temperatureF,
      pressureInHg: environment.pressureInHg,
      pressureType: environment.pressureType,
      relativeHumidity: environment.relativeHumidity,
      altitudeFeet: environment.altitudeFeet,
      densityAltitudeFeet: environment.densityAltitudeFeet,
      powderTemperatureF: environment.powderTemperature.mode === 'curve'
        ? environment.powderTemperature.currentTemperatureF
        : environment.powderTemperature.referenceTemperatureF,
    }
  })

  return (
    <div className="derived-editor zero-editor">
      <div className="derived-editor__heading">
        <span>Conditions when zeroed</span>
        <div className="mode-switch" aria-label="Zero-day conditions">
          <button className={zero.mode === 'current' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.scope.zeroConditions.mode = 'current' })}>Same as shot</button>
          <button className={zero.mode === 'custom' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.scope.zeroConditions.mode = 'custom' })}>Custom</button>
        </div>
      </div>
      {zero.mode === 'current' ? (
        <p className="derived-editor__intro">The rifle is treated as zeroed in the current atmosphere, with the current muzzle velocity.</p>
      ) : (
        <>
          <p className="derived-editor__intro">Only filled fields override the current shot. This models a zero established on a different day.</p>
          <button className="secondary-action" type="button" onClick={copyCurrent}>Copy current conditions</button>
          <div className="field-grid zero-editor__fields">
            <NumberField label="Muzzle velocity" unit={unitLabel('velocity', units)} units={units} quantity="velocity" optional value={zero.muzzleVelocityFps} error={errors['scope.zeroConditions.muzzleVelocityFps']} onChange={(value) => update((draft) => { draft.scope.zeroConditions.muzzleVelocityFps = value })} />
            {shot.environment.powderTemperature.mode === 'curve' && <NumberField label="Powder temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" optional value={zero.powderTemperatureF} error={errors['scope.zeroConditions.powderTemperatureF']} message="Used to look up zero-day velocity on the measured curve." onChange={(value) => update((draft) => { draft.scope.zeroConditions.powderTemperatureF = value })} />}
          </div>
          <div className="derived-editor__heading compact-heading">
            <span>Zero-day atmosphere</span>
            <div className="mode-switch" aria-label="Zero-day atmosphere mode">
              <button className={zero.atmosphereMode === 'weather' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.scope.zeroConditions.atmosphereMode = 'weather' })}>Weather</button>
              <button className={zero.atmosphereMode === 'densityAltitude' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.scope.zeroConditions.atmosphereMode = 'densityAltitude' })}>Density altitude</button>
            </div>
          </div>
          {zero.atmosphereMode === 'weather' ? (
            <div className="field-grid">
              <NumberField label="Temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" optional value={zero.temperatureF} error={errors['scope.zeroConditions.temperatureF']} onChange={(value) => update((draft) => { draft.scope.zeroConditions.temperatureF = value })} />
              <NumberField label="Pressure" unit={unitLabel('pressure', units)} units={units} quantity="pressure" optional value={zero.pressureInHg} error={errors['scope.zeroConditions.pressureInHg']} endControl={<select aria-label="Zero-day pressure type" value={zero.pressureType} onChange={(event) => update((draft) => { draft.scope.zeroConditions.pressureType = event.target.value as 'absolute' | 'qnh' })}><option value="absolute">Station</option><option value="qnh">Altimeter</option></select>} onChange={(value) => update((draft) => { draft.scope.zeroConditions.pressureInHg = value })} />
              <NumberField label="Humidity" unit="%" units={units} min={0} max={100} optional value={zero.relativeHumidity} error={errors['scope.zeroConditions.relativeHumidity']} onChange={(value) => update((draft) => { draft.scope.zeroConditions.relativeHumidity = value })} />
              <NumberField label="Altitude" unit={unitLabel('altitude', units)} units={units} quantity="altitude" optional value={zero.altitudeFeet} error={errors['scope.zeroConditions.altitudeFeet']} onChange={(value) => update((draft) => { draft.scope.zeroConditions.altitudeFeet = value })} />
            </div>
          ) : (
            <div className="field-grid">
              <NumberField label="Density altitude" unit={unitLabel('altitude', units)} units={units} quantity="altitude" optional value={zero.densityAltitudeFeet} error={errors['scope.zeroConditions.densityAltitudeFeet']} onChange={(value) => update((draft) => { draft.scope.zeroConditions.densityAltitudeFeet = value })} />
              {shot.environment.powderTemperature.mode === 'linear' && <NumberField label="Ammunition temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" optional value={zero.temperatureF} error={errors['scope.zeroConditions.temperatureF']} message="Zero-day temperature used by the linear powder model." onChange={(value) => update((draft) => { draft.scope.zeroConditions.temperatureF = value })} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}
