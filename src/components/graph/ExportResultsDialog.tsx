import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CalculationQuality, Shot, ShotTrajectory } from '../../ballistics/types'
import {
  prepareTrajectoryResults, downloadTrajectoryResults, MAX_EXPORT_ROWS, resultRanges,
  CSV_COLUMNS, DEFAULT_CSV_COLUMNS, csvColumnLabels, resultsUnitLabels,
  type CsvColumn, type ResultsFormat, type ResultsOptions,
} from '../../exports/trajectoryResults'
import { axisRangeLabel, fromAxisRange, toAxisRange, type ImperialRangeUnit, type UnitSystem } from '../../units/conversions'

interface ExportResultsDialogProps {
  shots: Shot[]
  trajectories: ShotTrajectory[]
  range: { minX: number; maxX: number }
  calculationQuality: CalculationQuality
  units: UnitSystem
  rangeUnit: ImperialRangeUnit
  onClose: () => void
}

const FORMATS: Array<{ value: ResultsFormat; label: string; detail: string }> = [
  { value: 'csv', label: 'CSV', detail: 'Spreadsheet table' },
  { value: 'json', label: 'JSON', detail: 'Structured results' },
  { value: 'pdf', label: 'PDF', detail: 'Settings, graph & table' },
]

export function ExportResultsDialog({ shots, trajectories, range, calculationQuality, units, rangeUnit, onClose }: ExportResultsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const activeShots = shots.filter((shot) => shot.visible)
  const errorFor = (shot: Shot) => {
    const trajectory = trajectories.find((item) => item.shotId === shot.id)
    return trajectory?.error ?? (!trajectory?.points.length ? 'No calculated results available' : undefined)
  }
  const availableIds = activeShots.filter((shot) => !errorFor(shot)).map((shot) => shot.id)
  const [selectedIds, setSelectedIds] = useState(availableIds)
  const [format, setFormat] = useState<ResultsFormat>('csv')
  const [interval, setInterval] = useState('10')
  const [csvColumns, setCsvColumns] = useState<CsvColumn[]>(DEFAULT_CSV_COLUMNS)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const selectedShots = activeShots.filter((shot) => selectedIds.includes(shot.id))
  const options: ResultsOptions = {
    minRangeYards: range.minX, maxRangeYards: range.maxX,
    intervalYards: fromAxisRange(Number(interval), units, rangeUnit), calculationQuality, units, rangeUnit,
  }
  const labels = resultsUnitLabels(options)
  const columnLabels = csvColumnLabels(options)
  const distanceUnit = axisRangeLabel(units, rangeUnit)
  const distanceName = units === 'metric' ? 'meters' : rangeUnit
  const csvError = format === 'csv' && csvColumns.length === 0 ? 'Select at least one CSV column.' : ''
  let rangeCount = 0
  let intervalError = ''
  try {
    rangeCount = resultRanges(options).length
    if (rangeCount * selectedShots.length > MAX_EXPORT_ROWS) {
      intervalError = 'Increase the interval or select fewer trajectories to export at most 10,000 rows.'
    }
  } catch (error) {
    intervalError = error instanceof Error ? error.message : 'Enter a valid interval.'
  }

  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (exporting || intervalError || csvError || selectedShots.length === 0) return
    setExportError('')
    setExporting(true)
    try {
      const results = prepareTrajectoryResults(shots, trajectories, selectedIds, options)
      await downloadTrajectoryResults(results, format, csvColumns)
      onClose()
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Could not export results. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="export-dialog"
      aria-labelledby="export-results-title"
      aria-describedby="export-results-description"
      onCancel={(event) => {
        event.preventDefault()
        if (!exporting) onClose()
      }}
    >
      <form onSubmit={(event) => { void submit(event) }}>
        <header className="export-dialog__heading">
          <div>
            <h2 id="export-results-title">Export results</h2>
            <p id="export-results-description">Download calculated data for your active trajectories.</p>
          </div>
          <button type="button" aria-label="Close export results" disabled={exporting} onClick={onClose}>×</button>
        </header>

        <fieldset disabled={exporting} className="export-dialog__formats">
          <legend>File format</legend>
          {FORMATS.map((item) => (
            <label key={item.value} className={format === item.value ? 'is-selected' : ''}>
              <input type="radio" name="results-format" value={item.value} checked={format === item.value} onChange={() => setFormat(item.value)} />
              <strong>{item.label}</strong><small>{item.detail}</small>
            </label>
          ))}
        </fieldset>

        {format === 'csv' && (
          <fieldset disabled={exporting} className="export-dialog__columns">
            <legend>CSV columns</legend>
            <div>
              {CSV_COLUMNS.map((column) => (
                <label key={column}>
                  <input type="checkbox" checked={csvColumns.includes(column)} onChange={(event) => {
                    const checked = event.target.checked
                    setCsvColumns((current) => checked ? [...current, column] : current.filter((item) => item !== column))
                  }} />
                  <span>{columnLabels[column]}</span>
                </label>
              ))}
            </div>
            {selectedShots.length > 1 && !csvColumns.includes('trajectory') && !csvColumns.includes('trajectoryId') && (
              <p className="export-dialog__note">Rows are grouped by trajectory in the order below. Include Trajectory to identify each group.</p>
            )}
            {csvError && <p className="export-dialog__error" role="alert">{csvError}</p>}
          </fieldset>
        )}

        <div className="export-dialog__sampling">
          <label className="field">
            <span className="field__label">Sample every</span>
            <span className="field__control">
              <input
                type="number" min="0" step="any" required value={interval} disabled={exporting}
                aria-label={`Sampling interval in ${distanceName}`} aria-invalid={!!intervalError}
                aria-describedby={intervalError ? 'export-interval-error' : 'export-range-note'}
                onChange={(event) => { setInterval(event.target.value); setExportError('') }}
              />
              <span>{distanceName}</span>
            </span>
          </label>
          <p id="export-range-note">
            Range: <strong>{toAxisRange(range.minX, units, rangeUnit)}–{toAxisRange(range.maxX, units, rangeUnit)} {distanceUnit}</strong><br />
            Uses the configured graph range, including both endpoints.
          </p>
        </div>
        {intervalError && <p id="export-interval-error" className="export-dialog__error" role="alert">{intervalError}</p>}

        <fieldset disabled={exporting} className="export-dialog__trajectories">
          <legend>Active trajectories</legend>
          {activeShots.length > 0 && (
            <div className="export-dialog__selection-actions">
              <button type="button" onClick={() => setSelectedIds(availableIds)}>Select all</button>
              <button type="button" onClick={() => setSelectedIds([])}>Clear</button>
              <span>{selectedShots.length} selected</span>
            </div>
          )}
          <div className="export-dialog__shot-list">
            {activeShots.map((shot) => {
              const error = errorFor(shot)
              return (
                <label key={shot.id} className={error ? 'is-unavailable' : ''}>
                  <input type="checkbox" disabled={!!error} checked={selectedIds.includes(shot.id)} onChange={(event) => {
                    setSelectedIds((current) => event.target.checked ? [...current, shot.id] : current.filter((id) => id !== shot.id))
                    setExportError('')
                  }} />
                  <span className="export-dialog__color" style={{ backgroundColor: shot.color }} />
                  <span>{shot.name || 'Untitled trajectory'}{error && <small>{error}</small>}</span>
                </label>
              )
            })}
            {activeShots.length === 0 && <p>Enable a trajectory in the editor to export its results.</p>}
          </div>
        </fieldset>

        <p className="export-dialog__note">
          Vertical offset is relative to the line of sight (positive above, negative below).
          {' '}Exports match your graph units: {labels.range}, {labels.verticalOffset}, {labels.velocity}, and {labels.energy}.
          {selectedShots.some((shot) => shot.projectile.weightGrains === undefined) && ' Energy is unavailable for trajectories without a bullet weight.'}
        </p>
        {exportError && <p className="export-dialog__error" role="alert">{exportError}</p>}
        <footer className="export-dialog__footer">
          <span aria-live="polite">{intervalError ? 'Adjust sampling to continue' : `${rangeCount} rows per trajectory`}</span>
          <button type="button" disabled={exporting} onClick={onClose}>Cancel</button>
          <button className="export-dialog__download" type="submit" disabled={exporting || !!intervalError || !!csvError || selectedShots.length === 0}>
            {exporting ? 'Exporting…' : `Download ${format.toUpperCase()}`}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
