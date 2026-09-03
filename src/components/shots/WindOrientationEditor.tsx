import type { Shot } from '../../ballistics/types'
import { unitLabel, type UnitSystem } from '../../units/conversions'
import type { ShotErrors } from '../../validation/shotSchema'
import { AngleEditor } from './AngleEditor'
import { NumberField } from './NumberField'

interface WindOrientationEditorProps {
  shot: Shot
  units: UnitSystem
  errors: ShotErrors
  onChange: (shot: Shot) => void
}

function compassPoint(degrees: number | undefined) {
  if (degrees === undefined) return ''
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return points[Math.round(((degrees % 360) + 360) % 360 / 45) % 8]
}

export function WindOrientationEditor({ shot, units, errors, onChange }: WindOrientationEditorProps) {
  const wind = shot.windAndAngle
  const update = (recipe: (draft: Shot) => void) => {
    const next = structuredClone(shot)
    recipe(next)
    onChange(next)
  }
  const compassReady = wind.compassWindDirectionDegrees !== undefined && wind.shotDirectionDegrees !== undefined
  const coriolisReady = wind.latitudeDegrees !== undefined && wind.shotDirectionDegrees !== undefined
  const needsBearing = wind.windReference === 'compass' || wind.coriolisEnabled

  return (
    <>
      <div className="derived-editor__heading editor-heading--top">
        <span>Wind direction reference</span>
        <div className="mode-switch" aria-label="Wind direction reference">
          <button className={wind.windReference === 'relative' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.windAndAngle.windReference = 'relative' })}>Relative</button>
          <button className={wind.windReference === 'compass' ? 'is-active' : ''} type="button" onClick={() => update((draft) => { draft.windAndAngle.windReference = 'compass' })}>Compass</button>
        </div>
      </div>
      <p className="derived-editor__intro">
        {wind.windReference === 'relative'
          ? 'Enter the wind angle relative to the rifle. No compass bearing is needed.'
          : 'Enter where the wind comes from on a compass. The shot bearing converts it to the rifle-relative wind.'}
      </p>
      <div className="field-grid">
        <NumberField label="Wind speed" unit={unitLabel('windSpeed', units)} units={units} quantity="windSpeed" min={0} required value={wind.windSpeedMph} error={errors['windAndAngle.windSpeedMph']} onChange={(value) => update((draft) => { draft.windAndAngle.windSpeedMph = value })} />
        {wind.windReference === 'relative' ? (
          <NumberField label="Wind from" unit="deg" units={units} min={0} max={360} required value={wind.windDirectionDegrees} error={errors['windAndAngle.windDirectionDegrees']} message="0° headwind · 90° from right · 180° tailwind · 270° from left." onChange={(value) => update((draft) => { draft.windAndAngle.windDirectionDegrees = value })} />
        ) : (
          <NumberField label="Wind from bearing" unit="deg" units={units} min={0} max={360} optional value={wind.compassWindDirectionDegrees} error={errors['windAndAngle.compassWindDirectionDegrees']} message={wind.compassWindDirectionDegrees === undefined ? 'Compass direction the wind comes from.' : `${compassPoint(wind.compassWindDirectionDegrees)} · compass bearing`} onChange={(value) => update((draft) => { draft.windAndAngle.compassWindDirectionDegrees = value })} />
        )}
        {needsBearing && (
          <NumberField label="Shot bearing" unit="deg" units={units} min={0} max={360} optional value={wind.shotDirectionDegrees} error={errors['windAndAngle.shotDirectionDegrees']} message={wind.shotDirectionDegrees === undefined ? '0° north · 90° east · 180° south · 270° west.' : `${compassPoint(wind.shotDirectionDegrees)} · direction the rifle points`} onChange={(value) => update((draft) => { draft.windAndAngle.shotDirectionDegrees = value })} />
        )}
      </div>
      {wind.windReference === 'compass' && !compassReady && (
        <p className="feature-status">Compass wind is not applied yet. Enter both wind and shot bearings; the saved relative wind remains active meanwhile.</p>
      )}

      <AngleEditor shot={shot} units={units} errors={errors} onChange={onChange} />

      <div className="advanced-feature">
        <div className="advanced-feature__heading">
          <span><strong>Earth rotation (Coriolis)</strong><small>Optional. Requires both latitude and shot bearing.</small></span>
          <button className={`toggle-switch ${wind.coriolisEnabled ? 'is-active' : ''}`} type="button" role="switch" aria-checked={wind.coriolisEnabled} onClick={() => update((draft) => { draft.windAndAngle.coriolisEnabled = !draft.windAndAngle.coriolisEnabled })}><span /></button>
        </div>
        {wind.coriolisEnabled && (
          <>
            <div className="field-grid">
              <NumberField
                label="Latitude"
                unit="deg"
                units={units}
                min={0}
                max={90}
                optional
                value={wind.latitudeDegrees === undefined ? undefined : Math.abs(wind.latitudeDegrees)}
                error={errors['windAndAngle.latitudeDegrees']}
                endControl={(
                  <select aria-label="Latitude hemisphere" value={(wind.latitudeDegrees ?? 0) < 0 ? 'south' : 'north'} onChange={(event) => update((draft) => {
                    if (draft.windAndAngle.latitudeDegrees !== undefined) draft.windAndAngle.latitudeDegrees = Math.abs(draft.windAndAngle.latitudeDegrees) * (event.target.value === 'south' ? -1 : 1)
                  })}>
                    <option value="north">N</option>
                    <option value="south">S</option>
                  </select>
                )}
                message="Your firing location, not the target location."
                onChange={(value) => update((draft) => { draft.windAndAngle.latitudeDegrees = value === undefined ? undefined : value * ((draft.windAndAngle.latitudeDegrees ?? 0) < 0 ? -1 : 1) })}
              />
              {wind.windReference !== 'compass' && <NumberField label="Shot bearing" unit="deg" units={units} min={0} max={360} optional value={wind.shotDirectionDegrees} message={wind.shotDirectionDegrees === undefined ? '0° north · 90° east · 180° south · 270° west.' : `${compassPoint(wind.shotDirectionDegrees)} · direction the rifle points`} onChange={(value) => update((draft) => { draft.windAndAngle.shotDirectionDegrees = value })} />}
            </div>
            {!coriolisReady && <p className="feature-status">Earth rotation is not applied yet. Enter latitude and shot bearing to enable it.</p>}
          </>
        )}
      </div>

      <div className="advanced-feature">
        <div className="advanced-feature__heading">
          <span><strong>Cant &amp; vertical wind</strong><small>Optional corrections for rifle roll and updrafts or downdrafts.</small></span>
        </div>
        <div className="field-grid">
          <NumberField label="Rifle cant" unit="deg" units={units} min={0} max={90} optional value={wind.cantDegrees} error={errors['windAndAngle.cantDegrees']} endControl={<select aria-label="Cant direction" value={wind.cantDirection} onChange={(event) => update((draft) => { draft.windAndAngle.cantDirection = event.target.value as 'clockwise' | 'counterclockwise' })}><option value="clockwise">Right</option><option value="counterclockwise">Left</option></select>} message="Viewed from behind the rifle." onChange={(value) => update((draft) => { draft.windAndAngle.cantDegrees = value })} />
          <NumberField label="Vertical wind" unit={unitLabel('windSpeed', units)} units={units} quantity="windSpeed" min={0} optional value={wind.verticalWindSpeedMph} error={errors['windAndAngle.verticalWindSpeedMph']} endControl={<select aria-label="Vertical wind direction" value={wind.verticalWindDirection} onChange={(event) => update((draft) => { draft.windAndAngle.verticalWindDirection = event.target.value as 'updraft' | 'downdraft' })}><option value="updraft">Up</option><option value="downdraft">Down</option></select>} onChange={(value) => update((draft) => { draft.windAndAngle.verticalWindSpeedMph = value })} />
        </div>
      </div>
    </>
  )
}
