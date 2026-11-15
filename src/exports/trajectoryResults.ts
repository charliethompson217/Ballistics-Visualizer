import { calculateTrajectory, calculationRangeForView, interpolatePoint } from '../ballistics/engine'
import type { CalculationQuality, Shot, ShotTrajectory, TrajectoryPoint } from '../ballistics/types'
import { axisRangeLabel, fromAxisRange, toAxisRange, toDisplayUnit, unitLabel, type ImperialRangeUnit, type UnitSystem } from '../units/conversions'
import { exportShotSettings } from './trajectorySettings'

export type ResultsFormat = 'csv' | 'json' | 'pdf'

export interface ResultsOptions {
  minRangeYards: number
  maxRangeYards: number
  intervalYards: number
  calculationQuality: CalculationQuality
  units: UnitSystem
  rangeUnit: ImperialRangeUnit
}

export interface ResultSample {
  rangeYards: number
  pathInches: number
  velocityFps: number
  energyFtLb: number | null
}

export interface ExportTrajectory {
  shot: Shot
  samples: ResultSample[]
  graphPoints: TrajectoryPoint[]
}

export interface TrajectoryResults {
  options: ResultsOptions
  trajectories: ExportTrajectory[]
}

export const MAX_EXPORT_ROWS = 10_000
export const CSV_COLUMNS = ['trajectoryId', 'trajectory', 'range', 'verticalOffset', 'velocity', 'energy'] as const
export type CsvColumn = typeof CSV_COLUMNS[number]
export const DEFAULT_CSV_COLUMNS: CsvColumn[] = ['range', 'verticalOffset', 'velocity', 'energy']

export function resultsUnitLabels(options: ResultsOptions) {
  return {
    range: axisRangeLabel(options.units, options.rangeUnit),
    verticalOffset: unitLabel('path', options.units),
    velocity: unitLabel('velocity', options.units),
    energy: unitLabel('energy', options.units),
  }
}

export function csvColumnLabels(options: ResultsOptions): Record<CsvColumn, string> {
  const labels = resultsUnitLabels(options)
  return {
    trajectoryId: 'Trajectory ID', trajectory: 'Trajectory', range: `Range (${labels.range})`,
    verticalOffset: `Vertical offset (${labels.verticalOffset})`, velocity: `Velocity (${labels.velocity})`, energy: `Energy (${labels.energy})`,
  }
}

export function displayResultSample(sample: ResultSample, options: ResultsOptions) {
  return {
    range: toAxisRange(sample.rangeYards, options.units, options.rangeUnit, false),
    verticalOffset: toDisplayUnit(sample.pathInches, 'path', options.units, false),
    velocity: toDisplayUnit(sample.velocityFps, 'velocity', options.units, false),
    energy: sample.energyFtLb === null ? null : toDisplayUnit(sample.energyFtLb, 'energy', options.units, false),
  }
}

/** Include both range boundaries and every interval multiple between them. */
export function resultRanges(options: ResultsOptions): number[] {
  const { units, rangeUnit } = options
  const min = toAxisRange(options.minRangeYards, units, rangeUnit, false)
  const max = toAxisRange(options.maxRangeYards, units, rangeUnit, false)
  const interval = toAxisRange(options.intervalYards, units, rangeUnit, false)
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('Enter an interval greater than zero.')
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max <= min) {
    throw new Error('Choose a valid graph range before exporting.')
  }
  const first = Math.floor(min / interval) + 1
  const last = Math.ceil(max / interval) - 1
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last - first + 3 > MAX_EXPORT_ROWS) {
    throw new Error('Increase the interval to export at most 10,000 rows.')
  }
  const ranges = [options.minRangeYards]
  const tolerance = Math.max(1, Math.abs(min), Math.abs(max)) * Number.EPSILON * 8
  for (let index = first; index <= last; index++) {
    const range = Number((index * interval).toFixed(10))
    if (range - min > tolerance && max - range > tolerance) ranges.push(fromAxisRange(range, units, rangeUnit))
  }
  ranges.push(options.maxRangeYards)
  return ranges
}

export function buildTrajectoryResults(
  shots: Shot[], trajectories: ShotTrajectory[], selectedIds: string[], options: ResultsOptions,
): TrajectoryResults {
  const selected = shots.filter((shot) => shot.visible && selectedIds.includes(shot.id))
  if (selected.length === 0) throw new Error('Select at least one active trajectory.')
  const ranges = resultRanges(options)
  if (ranges.length * selected.length > MAX_EXPORT_ROWS) {
    throw new Error('Increase the interval or select fewer trajectories to export at most 10,000 rows.')
  }
  return {
    options,
    trajectories: selected.map((shot) => {
      const trajectory = trajectories.find((item) => item.shotId === shot.id)
      const name = shot.name || 'Untitled trajectory'
      if (trajectory?.error || !trajectory?.points.length) {
        throw new Error(`${name}: ${trajectory?.error ?? 'No calculated results available.'}`)
      }
      const samples = ranges.map((rangeYards) => {
        const point = interpolatePoint(trajectory.points, rangeYards)
        if (!point || ![point.pathInches, point.velocityFps].every(Number.isFinite)) {
          throw new Error(`${name}: calculated results do not cover ${rangeYards} yd. Reduce the graph range.`)
        }
        return {
          rangeYards,
          pathInches: point.pathInches,
          velocityFps: point.velocityFps,
          energyFtLb: shot.projectile.weightGrains !== undefined && Number.isFinite(point.energyFtLb)
            ? point.energyFtLb! : null,
        }
      })
      const start = interpolatePoint(trajectory.points, options.minRangeYards)!
      const end = interpolatePoint(trajectory.points, options.maxRangeYards)!
      return {
        shot,
        samples,
        graphPoints: [start, ...trajectory.points.filter((point) =>
          point.rangeYards > options.minRangeYards && point.rangeYards < options.maxRangeYards,
        ), end],
      }
    }),
  }
}

/** Fixed-step engine output can stop just before its requested limit. Calculate
 * beyond that limit when needed so endpoint rows are interpolated, never extrapolated. */
export function prepareTrajectoryResults(
  shots: Shot[], trajectories: ShotTrajectory[], selectedIds: string[], options: ResultsOptions,
): TrajectoryResults {
  const complete = trajectories.map((trajectory) => {
    const shot = shots.find((item) => item.id === trajectory.shotId)
    if (!shot?.visible || !selectedIds.includes(shot.id) || trajectory.error || !trajectory.points.length) return trajectory
    if (trajectory.points[trajectory.points.length - 1].rangeYards >= options.maxRangeYards) return trajectory
    return {
      shotId: shot.id,
      points: calculateTrajectory(shot, calculationRangeForView(options.maxRangeYards + 5, shot.scope.zeroDistanceYards), options.calculationQuality),
    }
  })
  return buildTrajectoryResults(shots, complete, selectedIds, options)
}

function csvText(value: string): string {
  // Keep names as text when the CSV is opened in a spreadsheet.
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function serializeResultsCsv(results: TrajectoryResults, selectedColumns: CsvColumn[] = DEFAULT_CSV_COLUMNS): string {
  const columns = CSV_COLUMNS.filter((column) => selectedColumns.includes(column))
  if (columns.length === 0) throw new Error('Select at least one CSV column.')
  const labels = csvColumnLabels(results.options)
  const rows = [columns.map((column) => labels[column]).join(',')]
  for (const { shot, samples } of results.trajectories) {
    for (const sample of samples) {
      const display = displayResultSample(sample, results.options)
      const values: Record<CsvColumn, string> = {
        trajectoryId: csvText(shot.id), trajectory: csvText(shot.name || 'Untitled trajectory'),
        range: Number(display.range.toFixed(10)).toString(), verticalOffset: display.verticalOffset.toFixed(4),
        velocity: display.velocity.toFixed(2), energy: display.energy?.toFixed(2) ?? '',
      }
      rows.push(columns.map((column) => values[column]).join(','))
    }
  }
  return `${rows.join('\r\n')}\r\n`
}

export function serializeResultsJson(results: TrajectoryResults): string {
  return JSON.stringify({
    format: 'ballistics-visualizer-results',
    version: 2,
    unitSystem: results.options.units,
    range: {
      min: toAxisRange(results.options.minRangeYards, results.options.units, results.options.rangeUnit, false),
      max: toAxisRange(results.options.maxRangeYards, results.options.units, results.options.rangeUnit, false),
      interval: toAxisRange(results.options.intervalYards, results.options.units, results.options.rangeUnit, false),
    },
    calculationQuality: results.options.calculationQuality,
    verticalReference: 'Line of sight; positive is above, negative is below.',
    units: resultsUnitLabels(results.options),
    trajectories: results.trajectories.map(({ shot, samples }) => ({
      shotId: shot.id, name: shot.name, settings: exportShotSettings(shot, results.options.units),
      samples: samples.map((sample) => displayResultSample(sample, results.options)),
    })),
  }, null, 2)
}

export async function downloadTrajectoryResults(results: TrajectoryResults, format: ResultsFormat, columns: CsvColumn[] = DEFAULT_CSV_COLUMNS): Promise<void> {
  const filename = `ballistics-results-${new Date().toISOString().slice(0, 10)}.${format}`
  if (format === 'pdf') {
    const { createResultsPdf } = await import('./trajectoryPdf')
    await createResultsPdf(results).save(filename, { returnPromise: true })
    return
  }
  const contents = format === 'csv' ? `\uFEFF${serializeResultsCsv(results, columns)}` : serializeResultsJson(results)
  const blob = new Blob([contents], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
