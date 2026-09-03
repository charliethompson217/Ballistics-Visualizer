import { useState } from 'react'
import { estimateBallisticCoefficient } from '../../ballistics/engine'
import type { Shot } from '../../ballistics/types'
import { unitLabel, type UnitSystem } from '../../units/conversions'
import type { ShotErrors } from '../../validation/shotSchema'
import { NumberField } from './NumberField'

interface BcEstimatorProps {
  shot: Shot
  units: UnitSystem
  errors: ShotErrors
  energyRequested: boolean
  onChange: (shot: Shot) => void
}

export function BcEstimator({ shot, units, errors, energyRequested, onChange }: BcEstimatorProps) {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const estimation = shot.projectile.bcEstimation

  const setMode = (mode: 'known' | 'estimated') => {
    const next = structuredClone(shot)
    next.projectile.bcEstimation = { ...estimation, mode }
    setStatus(null)
    onChange(next)
  }

  const updatePoint = (index: number, field: 'rangeYards' | 'dropInches', value: number | undefined) => {
    const next = structuredClone(shot)
    const points = estimation.points.map((point, pointIndex) =>
      pointIndex === index ? { ...point, [field]: value } : point,
    )
    next.projectile.bcEstimation = { mode: 'estimated', points }
    setStatus(null)
    onChange(next)
  }

  const estimate = () => {
    try {
      if (estimation.points[0]?.rangeYards !== undefined && estimation.points[0]?.rangeYards === estimation.points[1]?.rangeYards) {
        throw new Error('Measured ranges must be different.')
      }
      const value = estimateBallisticCoefficient(shot, estimation.points)
      const next = structuredClone(shot)
      next.projectile.ballisticCoefficient = Math.round(value * 10000) / 10000
      next.projectile.bcEstimation = { ...estimation, mode: 'estimated' }
      onChange(next)
      setStatus({ type: 'success', message: `${shot.projectile.dragModel} BC updated to ${next.projectile.ballisticCoefficient}` })
    } catch (error) {
      setStatus({ type: 'error', message: error instanceof Error ? error.message : 'BC estimation failed.' })
    }
  }

  const estimationRequired = estimation.mode === 'estimated'
  const spinRequired = shot.projectile.spinDrift.enabled
  const showDiameter = estimationRequired || spinRequired
  const weightError = errors['projectile.weightGrains']
    ?? (energyRequested && shot.projectile.weightGrains === undefined ? 'Enter bullet weight to plot kinetic energy' : undefined)

  return (
    <div className="bc-estimator">
      <div className="derived-editor__heading">
        <span>Ballistic coefficient</span>
        <div className="mode-switch" aria-label="Ballistic coefficient input method">
          <button className={estimation.mode === 'known' ? 'is-active' : ''} type="button" onClick={() => setMode('known')}>Known</button>
          <button className={estimation.mode === 'estimated' ? 'is-active' : ''} type="button" onClick={() => setMode('estimated')}>Estimate</button>
        </div>
      </div>

      {estimation.mode === 'known' ? (
        <NumberField
          label="Ballistic coefficient"
          units={units}
          min={0.001}
          value={shot.projectile.ballisticCoefficient}
          error={errors['projectile.ballisticCoefficient']}
          required
          endControl={(
            <select
              aria-label="Drag model"
              value={shot.projectile.dragModel}
              onChange={(event) => {
                const next = structuredClone(shot)
                next.projectile.dragModel = event.target.value as 'G1' | 'G7'
                setStatus(null)
                onChange(next)
              }}
            >
              <option>G1</option>
              <option>G7</option>
            </select>
          )}
          message="Enter the published BC and choose its matching drag model."
          onChange={(value) => {
            const next = structuredClone(shot)
            next.projectile.ballisticCoefficient = value
            setStatus(null)
            onChange(next)
          }}
        />
      ) : (
        <label className="field bc-drag-model">
          <span className="field__label"><span>Drag model</span><em className="field__requirement">required</em></span>
          <span className="field__control field__control--select">
            <select
              value={shot.projectile.dragModel}
              onChange={(event) => {
                const next = structuredClone(shot)
                next.projectile.dragModel = event.target.value as 'G1' | 'G7'
                setStatus(null)
                onChange(next)
              }}
            >
              <option>G1</option>
              <option>G7</option>
            </select>
          </span>
          <span className="field__message">The estimator returns a coefficient for this drag model.</span>
        </label>
      )}

      {estimationRequired && (
        <p className="derived-editor__intro">Weight, diameter, and two observed drops are required. The current velocity, zero, sight height, and atmosphere are used automatically.</p>
      )}

      <div className="field-grid">
        <NumberField
          label="Bullet weight"
          unit={unitLabel('weight', units)}
          units={units}
          quantity="weight"
          optional={!estimationRequired && !spinRequired && !energyRequested}
          required={estimationRequired || spinRequired || energyRequested}
          min={0.1}
          value={shot.projectile.weightGrains}
          error={weightError}
          message="Used for kinetic energy, BC estimation, and spin drift."
          onChange={(value) => {
            const next = structuredClone(shot)
            next.projectile.weightGrains = value
            setStatus(null)
            onChange(next)
          }}
        />
        {showDiameter && (
          <NumberField
            label="Diameter"
            unit={units === 'imperial' ? 'in' : 'mm'}
            units={units}
            quantity="length"
            required
            min={0.01}
            value={shot.projectile.diameterInches}
            error={errors['projectile.diameterInches']}
            message="Used by BC estimation, spin drift, and stability."
            onChange={(value) => {
              const next = structuredClone(shot)
              next.projectile.diameterInches = value
              setStatus(null)
              onChange(next)
            }}
          />
        )}
      </div>

      {estimation.mode === 'estimated' && (
        <>
          <div className="measurement-table">
            {estimation.points.slice(0, 2).map((point, index) => (
              <div className="measurement-row" key={index}>
                <span className="measurement-row__index">{index + 1}</span>
                <NumberField
                  label="Range"
                  unit={unitLabel('range', units)}
                  units={units}
                  quantity="range"
                  min={0.1}
                  value={point.rangeYards}
                  required
                  error={errors[`projectile.bcEstimation.points.${index}.rangeYards`]}
                  onChange={(value) => updatePoint(index, 'rangeYards', value)}
                />
                <NumberField
                  label="Drop"
                  unit={unitLabel('path', units)}
                  units={units}
                  quantity="path"
                  value={point.dropInches}
                  required
                  error={errors[`projectile.bcEstimation.points.${index}.dropInches`]}
                  onChange={(value) => updatePoint(index, 'dropInches', value)}
                />
              </div>
            ))}
          </div>
          <button className="estimate-button" type="button" onClick={estimate}>Estimate and apply BC</button>
          {!status && errors['projectile.ballisticCoefficient'] && (
            <p className="estimator-status estimator-status--error">Estimate and apply a BC to calculate the trajectory.</p>
          )}
          {status && <p className={`estimator-status estimator-status--${status.type}`}>{status.message}</p>}
        </>
      )}
    </div>
  )
}
