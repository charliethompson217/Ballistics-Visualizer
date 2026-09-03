import { useState } from 'react'
import { convertAngularAdjustment } from '../../ballistics/scope'
import { calculateGyroscopicStability, describeStability, type StabilityInputs } from '../../ballistics/stability'
import type { Shot } from '../../ballistics/types'
import type { ShotErrors } from '../../validation/shotSchema'
import { toDisplayUnit, unitLabel, type UnitSystem } from '../../units/conversions'
import { Icon } from '../Icon'
import { BcEstimator } from './BcEstimator'
import { EnvironmentEditor } from './EnvironmentEditor'
import { NumberField } from './NumberField'
import { PowderTemperatureEditor } from './PowderTemperatureEditor'
import { WindOrientationEditor } from './WindOrientationEditor'
import { ZeroConditionsEditor } from './ZeroConditionsEditor'

interface ShotCardProps {
  shot: Shot
  index: number
  errors: ShotErrors
  units: UnitSystem
  energyRequested: boolean
  expanded: boolean
  sharedConditions: boolean
  onExpand: () => void
  onChange: (shot: Shot) => void
  onDuplicate: () => void
  onDelete: () => void
}

function Disclosure({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`disclosure ${open ? 'disclosure--open' : ''}`}>
      <button className="disclosure__trigger" type="button" onClick={onToggle} aria-expanded={open}>
        <span>{title}</span>
        <span className="disclosure__summary">{summary}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && <div className="disclosure__content">{children}</div>}
    </div>
  )
}

function windSummary(shot: Shot, units: UnitSystem) {
  const wind = shot.windAndAngle
  if (wind.windSpeedMph === undefined) return 'Needs wind speed'
  const speed = `${toDisplayUnit(wind.windSpeedMph, 'windSpeed', units)} ${unitLabel('windSpeed', units)}`
  if (wind.windReference === 'compass') {
    return wind.compassWindDirectionDegrees === undefined ? `${speed} · Compass` : `${speed} · compass ${wind.compassWindDirectionDegrees}°`
  }
  return wind.windDirectionDegrees === undefined ? `${speed} · Relative` : `${speed} · ${wind.windDirectionDegrees}° relative`
}

export function ShotCard({
  shot,
  index,
  errors,
  units,
  energyRequested,
  expanded,
  sharedConditions,
  onExpand,
  onChange,
  onDuplicate,
  onDelete,
}: ShotCardProps) {
  const [openSection, setOpenSection] = useState<'scope' | 'environment' | 'wind' | 'advanced' | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(shot.name)
  const update = (recipe: (draft: Shot) => void) => {
    const next = structuredClone(shot)
    recipe(next)
    onChange(next)
  }
  const estimationMode = shot.projectile.bcEstimation.mode
  const needsWeight = energyRequested || estimationMode === 'estimated' || shot.projectile.spinDrift.enabled
  const stabilityInputs = {
    weightGrains: shot.projectile.weightGrains,
    diameterInches: shot.projectile.diameterInches,
    lengthInches: shot.projectile.lengthInches,
    twistRateInches: shot.projectile.spinDrift.twistRateInches,
    muzzleVelocityFps: shot.muzzleVelocityFps,
    temperatureF: shot.environment.temperatureF,
    pressureInHg: shot.environment.pressureInHg,
  }
  const stability = Object.values(stabilityInputs).every((value) => typeof value === 'number')
    ? calculateGyroscopicStability(stabilityInputs as StabilityInputs)
    : null
  const stabilityDescription = stability === null ? null : describeStability(stability)
  const velocitySummary = shot.muzzleVelocityFps === undefined
    ? 'Velocity required'
    : `${toDisplayUnit(shot.muzzleVelocityFps, 'velocity', units)} ${unitLabel('velocity', units)}`
  const bcSummary = shot.projectile.ballisticCoefficient === undefined
    ? 'BC required'
    : `${estimationMode === 'estimated' ? 'Estimated BC' : 'BC'} ${shot.projectile.ballisticCoefficient} ${shot.projectile.dragModel}`
  const commitName = () => {
    if (!editingName) return
    update((draft) => { draft.name = nameDraft })
    setEditingName(false)
  }

  return (
    <article className={`shot-card ${expanded ? 'shot-card--expanded' : ''}`} style={{ '--shot-color': shot.color } as React.CSSProperties}>
      <header className="shot-card__header">
        <span className="shot-card__index">{String(index + 1).padStart(2, '0')}</span>
        <span className="shot-card__dot" />
        <span className="shot-card__heading">
          {editingName ? (
            <span className={`shot-card__name-editor ${errors.name ? 'field--error' : ''}`}>
              <input
                aria-label="Trajectory name"
                autoFocus
                value={nameDraft}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    setNameDraft(shot.name)
                    setEditingName(false)
                  }
                }}
              />
              <button type="button" title="Save name" aria-label="Save trajectory name" onMouseDown={(event) => event.preventDefault()} onClick={commitName}>
                <Icon name="check" size={14} />
              </button>
            </span>
          ) : (
            <button
              className={`shot-card__name ${errors.name ? 'shot-card__name--error' : ''}`}
              type="button"
              title="Edit trajectory name"
              onClick={() => {
                setNameDraft(shot.name)
                setEditingName(true)
              }}
            >
              <strong>{shot.name || 'Untitled trajectory'}</strong>
              <Icon name="edit" size={12} />
            </button>
          )}
          <button className={`shot-card__summary ${errors.name ? 'shot-card__summary--error' : ''}`} type="button" onClick={onExpand} aria-expanded={expanded}>
            <small>{errors.name ? errors.name : `${velocitySummary} · ${bcSummary}`}</small>
          </button>
        </span>
        <button className="shot-card__expand" type="button" onClick={onExpand} aria-expanded={expanded} title={expanded ? 'Collapse trajectory' : 'Expand trajectory'}>
          <Icon name="chevron" className="shot-card__chevron" size={18} />
        </button>
        <button
          className={`icon-button ${shot.visible ? 'icon-button--active' : ''}`}
          type="button"
          title={shot.visible ? 'Hide trajectory' : 'Show trajectory'}
          aria-label={shot.visible ? 'Hide trajectory' : 'Show trajectory'}
          onClick={() => update((draft) => { draft.visible = !draft.visible })}
        >
          <Icon name={shot.visible ? 'eye' : 'eyeOff'} />
        </button>
      </header>

      {expanded && (
        <div className="shot-card__body">
          <div className="field-grid">
            <NumberField
              label="Muzzle velocity"
              unit={unitLabel('velocity', units)}
              units={units}
              quantity="velocity"
              min={1}
              value={shot.muzzleVelocityFps}
              error={errors.muzzleVelocityFps}
              required
              onChange={(value) => update((draft) => { draft.muzzleVelocityFps = value })}
            />
          </div>

          {energyRequested && shot.projectile.weightGrains === undefined && (
            <button className="shot-card__notice" type="button" onClick={() => setOpenSection('advanced')}>
              Kinetic energy needs bullet weight. Add it under Projectile &amp; BC.
            </button>
          )}

          {sharedConditions && (
            <p className="shot-card__shared-note"><Icon name="lock" size={13} />Scope, environment, wind, angle, and rifle twist sync across every trajectory. Load inputs stay independent.</p>
          )}

          <div className="shot-card__sections">
            <Disclosure
              title="Scope adjustments"
              summary={shot.scope.zeroDistanceYards === undefined
                ? 'Zero required'
                : `${toDisplayUnit(shot.scope.zeroDistanceYards, 'range', units)} ${unitLabel('range', units)} zero · ${shot.scope.adjustment.unit.toUpperCase()}`}
              open={openSection === 'scope'}
              onToggle={() => setOpenSection(openSection === 'scope' ? null : 'scope')}
            >
              <div className="field-grid">
                <NumberField
                  label="Zero distance"
                  unit={unitLabel('range', units)}
                  units={units}
                  quantity="range"
                  min={1}
                  value={shot.scope.zeroDistanceYards}
                  error={errors['scope.zeroDistanceYards']}
                  required
                  message="With no dialed elevation, the vertical path intersects the bullseye here."
                  onChange={(value) => update((draft) => { draft.scope.zeroDistanceYards = value })}
                />
                <NumberField
                  label="Sight height"
                  unit={units === 'imperial' ? 'in' : 'mm'}
                  units={units}
                  quantity="length"
                  min={0.01}
                  value={shot.scope.sightHeightInches}
                  error={errors['scope.sightHeightInches']}
                  required
                  message="Centerline distance between the optic and bore."
                  onChange={(value) => update((draft) => { draft.scope.sightHeightInches = value })}
                />
              </div>

              <div className="derived-editor scope-editor">
                <div className="derived-editor__heading">
                  <span>Dialed correction</span>
                  <div className="mode-switch" aria-label="Scope adjustment unit">
                    {(['moa', 'mrad'] as const).map((unit) => (
                      <button
                        className={shot.scope.adjustment.unit === unit ? 'is-active' : ''}
                        type="button"
                        key={unit}
                        onClick={() => update((draft) => {
                          const current = draft.scope.adjustment
                          draft.scope.adjustment = {
                            unit,
                            vertical: convertAngularAdjustment(current.vertical, current.unit, unit),
                            horizontal: convertAngularAdjustment(current.horizontal, current.unit, unit),
                          }
                        })}
                      >{unit.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
                <div className="field-grid">
                  <NumberField
                    label="Elevation"
                    unit={shot.scope.adjustment.unit.toUpperCase()}
                    units={units}
                    optional
                    value={shot.scope.adjustment.vertical}
                    error={errors['scope.adjustment.vertical']}
                    message="Positive moves impact up; negative moves it down."
                    onChange={(value) => update((draft) => {
                      draft.scope.adjustment.vertical = value
                    })}
                  />
                  <NumberField
                    label="Windage"
                    unit={shot.scope.adjustment.unit.toUpperCase()}
                    units={units}
                    optional
                    value={shot.scope.adjustment.horizontal}
                    error={errors['scope.adjustment.horizontal']}
                    message="Positive moves impact right; negative moves it left."
                    onChange={(value) => update((draft) => {
                      draft.scope.adjustment.horizontal = value
                    })}
                  />
                </div>
              </div>
              <ZeroConditionsEditor shot={shot} units={units} errors={errors} onChange={onChange} />
            </Disclosure>
            <Disclosure
              title="Environment"
              summary={shot.environment.mode === 'densityAltitude'
                ? shot.environment.densityAltitudeFeet === undefined ? 'Density altitude needed' : `DA ${toDisplayUnit(shot.environment.densityAltitudeFeet, 'altitude', units)} ${unitLabel('altitude', units)}`
                : shot.environment.temperatureF === undefined || shot.environment.pressureInHg === undefined
                  ? 'Weather input needed'
                  : `${toDisplayUnit(shot.environment.temperatureF, 'temperature', units)}${unitLabel('temperature', units)} · ${toDisplayUnit(shot.environment.pressureInHg, 'pressure', units)} ${unitLabel('pressure', units)}`}
              open={openSection === 'environment'}
              onToggle={() => setOpenSection(openSection === 'environment' ? null : 'environment')}
            >
              <EnvironmentEditor shot={shot} units={units} errors={errors} onChange={onChange} />
            </Disclosure>
            <Disclosure
              title="Wind & angle"
              summary={windSummary(shot, units)}
              open={openSection === 'wind'}
              onToggle={() => setOpenSection(openSection === 'wind' ? null : 'wind')}
            >
              <WindOrientationEditor shot={shot} units={units} errors={errors} onChange={onChange} />
            </Disclosure>
            <Disclosure
              title="Projectile & BC"
              summary={needsWeight && shot.projectile.weightGrains === undefined
                ? 'Weight required'
                : `${estimationMode === 'estimated' ? 'Estimate BC' : 'Known BC'} · ${shot.projectile.spinDrift.enabled ? 'Spin on' : 'Spin off'}`}
              open={openSection === 'advanced'}
              onToggle={() => setOpenSection(openSection === 'advanced' ? null : 'advanced')}
            >
              <BcEstimator shot={shot} units={units} errors={errors} energyRequested={energyRequested} onChange={onChange} />

              <PowderTemperatureEditor shot={shot} units={units} errors={errors} onChange={onChange} />

              <div className="advanced-feature">
                <div className="advanced-feature__heading">
                  <span>
                    <strong>Spin drift</strong>
                    <small>Add empirical Litz spin drift to horizontal trajectory.</small>
                  </span>
                  <button
                    className={`toggle-switch ${shot.projectile.spinDrift.enabled ? 'is-active' : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={shot.projectile.spinDrift.enabled}
                    onClick={() => update((draft) => {
                      draft.projectile.spinDrift.enabled = !draft.projectile.spinDrift.enabled
                    })}
                  ><span /></button>
                </div>

                {shot.projectile.spinDrift.enabled && (
                  <>
                    <div className="field-grid">
                      <NumberField
                        label="Twist rate"
                        unit={units === 'imperial' ? 'in/turn' : 'mm/turn'}
                        units={units}
                        quantity="length"
                        required
                        min={1}
                        value={shot.projectile.spinDrift.twistRateInches}
                        error={errors['projectile.spinDrift.twistRateInches']}
                        message="Example: enter 10 for a 1:10-inch twist."
                        onChange={(value) => update((draft) => { draft.projectile.spinDrift.twistRateInches = value })}
                      />
                      <label className="field">
                        <span className="field__label"><span>Twist direction</span><em className="field__requirement">required</em></span>
                        <span className="field__control field__control--select">
                          <select value={shot.projectile.spinDrift.twistDirection} onChange={(event) => update((draft) => { draft.projectile.spinDrift.twistDirection = event.target.value as 'left' | 'right' })}>
                            <option value="right">Right-hand</option>
                            <option value="left">Left-hand</option>
                          </select>
                        </span>
                        <span className="field__message">Controls the direction of spin drift.</span>
                      </label>
                      <NumberField
                        label="Bullet length"
                        unit={units === 'imperial' ? 'in' : 'mm'}
                        units={units}
                        quantity="length"
                        optional
                        min={0.01}
                        value={shot.projectile.lengthInches}
                        error={errors['projectile.lengthInches']}
                        message="Add length to calculate Miller gyroscopic stability (SG)."
                        onChange={(value) => update((draft) => { draft.projectile.lengthInches = value })}
                      />
                    </div>
                    {stability !== null && stabilityDescription && (
                      <div className={`stability-result stability-result--${stabilityDescription.tone}`}>
                        <span>Gyroscopic stability</span>
                        <strong>SG {stability.toFixed(2)} · {stabilityDescription.label}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Disclosure>
          </div>

          <footer className="shot-card__footer">
            <button className="text-button" type="button" onClick={onDuplicate}><Icon name="copy" size={16} />Duplicate</button>
            <button className="text-button text-button--danger" type="button" onClick={onDelete}><Icon name="trash" size={16} />Delete</button>
          </footer>
        </div>
      )}
    </article>
  )
}
