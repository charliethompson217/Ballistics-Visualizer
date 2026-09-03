import type { Shot } from '../../ballistics/types'
import { unitLabel, type UnitSystem } from '../../units/conversions'
import type { ShotErrors } from '../../validation/shotSchema'
import { NumberField } from './NumberField'

interface PowderTemperatureEditorProps {
  shot: Shot
  units: UnitSystem
  errors: ShotErrors
  onChange: (shot: Shot) => void
}

export function PowderTemperatureEditor({ shot, units, errors, onChange }: PowderTemperatureEditorProps) {
  const powder = shot.environment.powderTemperature
  const completePoints = powder.points.filter((point) => point.temperatureF !== undefined && point.velocityFps !== undefined)
  const uniqueTemperatures = new Set(completePoints.map((point) => point.temperatureF)).size === completePoints.length
  const linearReady = powder.sensitivityFpsPerDegree !== undefined && powder.referenceTemperatureF !== undefined && shot.environment.temperatureF !== undefined
  const curveReady = completePoints.length >= 2 && uniqueTemperatures && (powder.currentTemperatureF !== undefined || shot.environment.temperatureF !== undefined)
  const update = (recipe: (draft: Shot) => void) => {
    const next = structuredClone(shot)
    recipe(next)
    onChange(next)
  }
  const setMode = (mode: 'none' | 'linear' | 'curve') => update((draft) => {
    const next = draft.environment.powderTemperature
    next.mode = mode
    if (mode === 'linear') {
      next.sensitivityFpsPerDegree ??= 1
      next.referenceTemperatureF ??= 70
    }
    if (mode === 'curve' && next.points.length < 2) next.points = [{}, {}]
  })

  return (
    <div className="advanced-feature powder-editor">
      <div className="advanced-feature__heading advanced-feature__heading--stacked">
        <span><strong>Powder temperature</strong><small>Optional muzzle-velocity correction for ammunition temperature.</small></span>
        <div className="mode-switch" aria-label="Powder temperature model">
          <button className={powder.mode === 'none' ? 'is-active' : ''} type="button" onClick={() => setMode('none')}>Off</button>
          <button className={powder.mode === 'linear' ? 'is-active' : ''} type="button" onClick={() => setMode('linear')}>Linear</button>
          <button className={powder.mode === 'curve' ? 'is-active' : ''} type="button" onClick={() => setMode('curve')}>Measured curve</button>
        </div>
      </div>
      {powder.mode === 'linear' && (
        <>
          <p className="derived-editor__intro">Enter how much velocity changes per degree and the powder temperature at which the listed muzzle velocity was measured.</p>
          <div className="field-grid">
            <NumberField label="Velocity change" unit={unitLabel('velocityTemperatureSensitivity', units)} units={units} quantity="velocityTemperatureSensitivity" required value={powder.sensitivityFpsPerDegree} error={errors['environment.powderTemperature.sensitivityFpsPerDegree']} message="Positive means warmer ammunition produces more velocity." onChange={(value) => update((draft) => { draft.environment.powderTemperature.sensitivityFpsPerDegree = value })} />
            <NumberField label="Reference temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" required value={powder.referenceTemperatureF} error={errors['environment.powderTemperature.referenceTemperatureF']} message="Temperature when muzzle velocity was measured." onChange={(value) => update((draft) => { draft.environment.powderTemperature.referenceTemperatureF = value })} />
            {shot.environment.mode === 'densityAltitude' && <NumberField label="Current air temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" required value={shot.environment.temperatureF} error={errors['environment.temperatureF']} message="Used as current ammunition temperature by the linear model." onChange={(value) => update((draft) => { draft.environment.temperatureF = value })} />}
          </div>
          {!linearReady && <p className="feature-status">Powder correction is not applied yet. Complete the fields above to enable it.</p>}
        </>
      )}
      {powder.mode === 'curve' && (
        <>
          <p className="derived-editor__intro">Add chronograph measurements at two or more ammunition temperatures. The engine interpolates between them.</p>
          <div className="field-grid powder-editor__current">
            <NumberField label="Current powder temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" optional value={powder.currentTemperatureF} error={errors['environment.powderTemperature.currentTemperatureF']} message="Leave blank to use current air temperature." onChange={(value) => update((draft) => { draft.environment.powderTemperature.currentTemperatureF = value })} />
            {shot.environment.mode === 'densityAltitude' && powder.currentTemperatureF === undefined && <NumberField label="Current air temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" required value={shot.environment.temperatureF} error={errors['environment.temperatureF']} onChange={(value) => update((draft) => { draft.environment.temperatureF = value })} />}
          </div>
          <div className="measurement-table powder-points">
            {powder.points.map((point, index) => (
              <div className="measurement-row" key={index}>
                <span className="measurement-row__index">{index + 1}</span>
                <NumberField label="Temperature" unit={unitLabel('temperature', units)} units={units} quantity="temperature" required={index < 2} optional={index >= 2} value={point.temperatureF} error={errors[`environment.powderTemperature.points.${index}.temperatureF`]} onChange={(value) => update((draft) => { draft.environment.powderTemperature.points[index].temperatureF = value })} />
                <NumberField label="Velocity" unit={unitLabel('velocity', units)} units={units} quantity="velocity" required={index < 2} optional={index >= 2} value={point.velocityFps} error={errors[`environment.powderTemperature.points.${index}.velocityFps`]} onChange={(value) => update((draft) => { draft.environment.powderTemperature.points[index].velocityFps = value })} />
                {powder.points.length > 2 && <button className="measurement-row__remove" type="button" aria-label={`Remove measurement ${index + 1}`} onClick={() => update((draft) => { draft.environment.powderTemperature.points.splice(index, 1) })}>×</button>}
              </div>
            ))}
          </div>
          {powder.points.length < 6 && <button className="secondary-action" type="button" onClick={() => update((draft) => { draft.environment.powderTemperature.points.push({}) })}>Add measurement</button>}
          {!curveReady && <p className="feature-status">The measured curve is not applied yet. Add two temperatures with different values and a current powder or air temperature.</p>}
        </>
      )}
    </div>
  )
}
