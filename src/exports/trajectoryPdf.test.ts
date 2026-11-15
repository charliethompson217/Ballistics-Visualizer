import { describe, expect, it } from 'vitest'
import type { ShotTrajectory, TrajectoryPoint } from '../ballistics/types'
import { defaultShots } from '../state/shots'
import { buildTrajectoryResults, type ResultsOptions } from './trajectoryResults'
import { createResultsPdf, trajectorySettings } from './trajectoryPdf'

const shot = { ...structuredClone(defaultShots[0]), visible: true }
const points: TrajectoryPoint[] = [
  { rangeYards: 0, pathInches: -1.5, dropInches: 1.5, velocityFps: 3000, energyFtLb: 2000, timeSeconds: 0 },
  { rangeYards: 1000, pathInches: -300, dropInches: 300, velocityFps: 1200, energyFtLb: 400, timeSeconds: 1 },
]
const trajectories: ShotTrajectory[] = [{ shotId: shot.id, points }]
const options: ResultsOptions = {
  minRangeYards: 0, maxRangeYards: 100, intervalYards: 10, calculationQuality: 'detailed', units: 'imperial', rangeUnit: 'yards',
}

describe('results PDF layout', () => {
  it('puts settings and table on portrait pages before the final landscape graph', () => {
    const results = buildTrajectoryResults([shot], trajectories, [shot.id], options)
    const pdf = createResultsPdf(results)
    expect(pdf.getNumberOfPages()).toBe(3)
    for (let page = 1; page <= 3; page++) {
      pdf.setPage(page)
      expect(pdf.internal.pageSize.getWidth()).toBe(page === 3 ? 792 : 612)
      expect(pdf.internal.pageSize.getHeight()).toBe(page === 3 ? 612 : 792)
    }
  })

  it('keeps long-table continuation pages portrait before the next landscape graph', () => {
    const second = { ...shot, id: 'second' }
    const results = buildTrajectoryResults([shot, second], [...trajectories, { shotId: second.id, points }], [shot.id, second.id], { ...options, maxRangeYards: 1000 })
    const pdf = createResultsPdf(results)
    const graphPages: number[] = []
    for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
      pdf.setPage(page)
      if (pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight()) graphPages.push(page)
    }
    expect(graphPages).toHaveLength(2)
    expect(graphPages[0]).toBeGreaterThan(3)
    expect(graphPages[1]).toBe(pdf.getNumberOfPages())
    expect(pdf.getNumberOfPages()).toBeGreaterThan(6)
  })

  it('converts readable settings to the UI units, including scope and atmosphere', () => {
    const settings = Object.fromEntries(trajectorySettings(shot, 'metric'))
    expect(settings.Ammunition).toContain('Muzzle velocity: 902.2 m/s')
    expect(settings.Scope).toContain('Sight height: 38.1 mm')
    expect(settings.Atmosphere).toContain('Temperature: 15 deg C')
    expect(settings.Atmosphere).toContain('Pressure: 1013.2 hPa')
  })
})
