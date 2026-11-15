/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import initBallistics from 'ballistics-engine'
import { calculateTrajectory } from '../ballistics/engine'
import type { ShotTrajectory, TrajectoryPoint } from '../ballistics/types'
import { defaultShots } from '../state/shots'
import { parseShotFile, serializeShotFile } from '../state/shotFiles'
import { fromAxisRange } from '../units/conversions'
import { buildTrajectoryResults, prepareTrajectoryResults, resultRanges, serializeResultsCsv, serializeResultsJson, type ResultsOptions } from './trajectoryResults'

const options: ResultsOptions = { minRangeYards: 0, maxRangeYards: 25, intervalYards: 10, calculationQuality: 'detailed', units: 'imperial', rangeUnit: 'yards' }
const shot = { ...structuredClone(defaultShots[0]), id: 'selected', name: 'Selected', visible: true }
const points: TrajectoryPoint[] = [
  { rangeYards: 0, pathInches: -1.5, dropInches: 1.5, velocityFps: 3000, energyFtLb: 2000, timeSeconds: 0 },
  { rangeYards: 30, pathInches: 1.5, dropInches: -1.5, velocityFps: 2700, energyFtLb: 1600, timeSeconds: 0.03 },
]
const trajectories: ShotTrajectory[] = [{ shotId: shot.id, points }]

describe('results export sampling', () => {
  it('defaults to ten-yard spacing and includes a non-multiple endpoint', () => {
    expect(resultRanges(options)).toEqual([0, 10, 20, 25])
  })

  it('includes custom boundaries and zero-based interval multiples without duplicates', () => {
    expect(resultRanges({ ...options, minRangeYards: 5, maxRangeYards: 30 })).toEqual([5, 10, 20, 30])
    expect(resultRanges({ ...options, maxRangeYards: 0.5, intervalYards: 0.1 })).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    expect(resultRanges({ ...options, intervalYards: 100 })).toEqual([0, 25])
  })

  it('interpolates exact distances using the signed line-of-sight path', () => {
    const results = buildTrajectoryResults([shot], trajectories, [shot.id], options)
    expect(results.trajectories[0].samples[1]).toEqual({
      rangeYards: 10, pathInches: -0.5, velocityFps: 2900, energyFtLb: 2000 - 400 / 3,
    })
    expect(results.trajectories[0].graphPoints.map((point) => point.rangeYards)).toEqual([0, 25])
  })

  it('covers the configured endpoint with real fixed-step engine results', async () => {
    await initBallistics({ module_or_path: readFileSync('node_modules/ballistics-engine/ballistics_engine_bg.wasm') })
    const calculated = [{ shotId: shot.id, points: calculateTrajectory(shot, 1000, 'fast') }]
    const results = prepareTrajectoryResults([shot], calculated, [shot.id], {
      ...options, maxRangeYards: 1000, calculationQuality: 'fast',
    })
    const last = results.trajectories[0].samples.at(-1)!
    expect(last.rangeYards).toBe(1000)
    expect(last.velocityFps).toBeGreaterThan(0)
    expect(last.energyFtLb).toBeGreaterThan(0)
  })

  it('excludes hidden and unselected trajectories from every format', () => {
    const hidden = { ...shot, id: 'hidden', visible: false }
    const other = { ...shot, id: 'unselected' }
    const results = buildTrajectoryResults([shot, hidden, other], trajectories, [shot.id, hidden.id], options)
    expect(results.trajectories.map(({ shot }) => shot.id)).toEqual(['selected'])
    expect(serializeResultsCsv(results)).not.toContain('hidden')
    expect(serializeResultsJson(results)).not.toContain('unselected')
    expect(() => buildTrajectoryResults([hidden], trajectories, [hidden.id], options)).toThrow('Select at least one')
  })

  it('does not substitute an engine default mass when bullet weight is missing', () => {
    const noWeight = structuredClone(shot)
    delete noWeight.projectile.weightGrains
    const results = buildTrajectoryResults([noWeight], trajectories, [shot.id], options)
    expect(results.trajectories[0].samples.every((row) => row.energyFtLb === null)).toBe(true)
    expect(serializeResultsCsv(results).split('\r\n')[1]).toMatch(/,\r?$/)
    expect(serializeResultsJson(results)).toContain('"energy": null')
  })

  it('rejects invalid spacing, excessive exports, and incomplete calculation coverage', () => {
    for (const intervalYards of [0, -1, NaN, Infinity]) {
      expect(() => resultRanges({ ...options, intervalYards })).toThrow('greater than zero')
    }
    expect(() => resultRanges({ ...options, intervalYards: 0.0001 })).toThrow('10,000')
    expect(() => resultRanges({ ...options, minRangeYards: 5, intervalYards: Number.MIN_VALUE })).toThrow('10,000')
    expect(() => buildTrajectoryResults([shot], trajectories, [shot.id], { ...options, maxRangeYards: 40 })).toThrow('do not cover')
    expect(() => buildTrajectoryResults([shot], [{ ...trajectories[0], error: 'Fix invalid inputs' }], [shot.id], options)).toThrow('Fix invalid inputs')
    const other = { ...shot, id: 'second' }
    expect(() => buildTrajectoryResults([shot, other], trajectories, [shot.id, other.id], { ...options, intervalYards: 0.004 })).toThrow('select fewer')
  })

  it('escapes CSV names, quotes, line breaks, and spreadsheet formula prefixes', () => {
    const named = { ...shot, name: '=SUM(1,2) "test"\nline' }
    const results = buildTrajectoryResults([named], trajectories, [shot.id], options)
    expect(serializeResultsCsv(results, ['trajectory'])).toContain('"\'=SUM(1,2) ""test""\nline"')
    expect(serializeResultsCsv(results)).toContain('Vertical offset (in),Velocity (fps),Energy (ft-lb)')
  })

  it('keeps results JSON separate from the existing unchanged settings format', () => {
    const results = buildTrajectoryResults([shot], trajectories, [shot.id], options)
    const json = JSON.parse(serializeResultsJson(results)) as { format: string; trajectories: Array<{ settings: unknown; samples: unknown[] }> }
    expect(json.format).toBe('ballistics-visualizer-results')
    expect(json.trajectories[0].settings).toMatchObject({
      id: shot.id, muzzleVelocity: { value: shot.muzzleVelocityFps, unit: 'fps' },
    })
    expect(json.trajectories[0].samples).toHaveLength(4)
    expect(() => parseShotFile(serializeResultsJson(results))).toThrow()
    expect(parseShotFile(serializeShotFile([shot]))).toEqual([shot])
  })

  it('defaults to measurement columns and exports only the selected CSV columns', () => {
    const results = buildTrajectoryResults([shot], trajectories, [shot.id], options)
    expect(serializeResultsCsv(results).split('\r\n')[0]).toBe('Range (yd),Vertical offset (in),Velocity (fps),Energy (ft-lb)')
    expect(serializeResultsCsv(results, ['trajectoryId', 'velocity']).split('\r\n')).toEqual([
      'Trajectory ID,Velocity (fps)', '"selected",3000.00', '"selected",2900.00', '"selected",2800.00', '"selected",2750.00', '',
    ])
    expect(() => serializeResultsCsv(results, [])).toThrow('Select at least one CSV column')
  })

  it('samples in meters and converts CSV, JSON, and JSON settings to metric', () => {
    const metricOptions: ResultsOptions = {
      ...options, units: 'metric', maxRangeYards: fromAxisRange(25, 'metric', 'yards'),
      intervalYards: fromAxisRange(10, 'metric', 'yards'),
    }
    const results = buildTrajectoryResults([shot], trajectories, [shot.id], metricOptions)
    const csv = serializeResultsCsv(results).split('\r\n')
    expect(csv[0]).toBe('Range (m),Vertical offset (cm),Velocity (m/s),Energy (J)')
    expect(csv[1]).toBe('0,-3.8100,914.40,2711.64')
    expect(csv.slice(1, -1).map((row) => Number(row.split(',')[0]))).toEqual([0, 10, 20, 25])
    const json = JSON.parse(serializeResultsJson(results)) as {
      units: Record<string, string>; range: { interval: number };
      trajectories: Array<{ samples: Array<{ range: number; verticalOffset: number; velocity: number; energy: number }>; settings: { muzzleVelocity: { value: number; unit: string }; scope: { sightHeight: { value: number; unit: string } } } }>;
    }
    expect(json.units).toEqual({ range: 'm', verticalOffset: 'cm', velocity: 'm/s', energy: 'J' })
    expect(json.range.interval).toBeCloseTo(10)
    expect(json.trajectories[0].samples[0].range).toBe(0)
    expect(json.trajectories[0].samples[0].verticalOffset).toBeCloseTo(-3.81)
    expect(json.trajectories[0].samples[0].velocity).toBeCloseTo(914.4)
    expect(json.trajectories[0].settings.muzzleVelocity.unit).toBe('m/s')
    expect(json.trajectories[0].settings.muzzleVelocity.value).toBeCloseTo(shot.muzzleVelocityFps! * 0.3048)
    expect(json.trajectories[0].settings.scope.sightHeight.unit).toBe('mm')
    expect(json.trajectories[0].settings.scope.sightHeight.value).toBeCloseTo(38.1)
  })

  it('matches a feet range axis without changing the underlying trajectory', () => {
    const feetOptions: ResultsOptions = { ...options, rangeUnit: 'feet', intervalYards: 10 / 3, maxRangeYards: 25 / 3 }
    const results = buildTrajectoryResults([shot], trajectories, [shot.id], feetOptions)
    const rows = serializeResultsCsv(results).split('\r\n')
    expect(rows[0]).toContain('Range (ft),Vertical offset (in)')
    expect(rows.slice(1, -1).map((row) => Number(row.split(',')[0]))).toEqual([0, 10, 20, 25])
  })
})
