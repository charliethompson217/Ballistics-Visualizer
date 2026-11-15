import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { Shot } from '../ballistics/types'
import { csvColumnLabels, displayResultSample, resultsUnitLabels, type ExportTrajectory, type ResultsOptions, type TrajectoryResults } from './trajectoryResults'
import { toAxisRange, toDisplayUnit, unitLabel, type Quantity, type UnitSystem } from '../units/conversions'

// Standard PDF fonts support Latin-1. Normalize common punctuation in names.
function pdfText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[–—−‑]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
}

/** Explicit labels keep the report readable and include every configured input. */
export function trajectorySettings(shot: Shot, units: UnitSystem): Array<[string, string]> {
  const quantities: Record<string, Quantity> = {
    fps: 'velocity', gr: 'weight', in: 'length', yd: 'range', 'in/turn': 'length',
    'deg F': 'temperature', inHg: 'pressure', ft: 'altitude', 'fps/deg F': 'velocityTemperatureSensitivity', mph: 'windSpeed',
  }
  const setting = (label: string, value: string | number | boolean | undefined, unit = '') => {
    const quantity = label === 'Drop' ? 'path' : quantities[unit]
    if (typeof value === 'number' && quantity) {
      value = toDisplayUnit(value, quantity, units)
      unit = unitLabel(quantity, units).replaceAll('°', 'deg ')
      if (label === 'Twist rate') unit += '/turn'
    }
    return `${label}: ${value === undefined ? 'Not set' : typeof value === 'boolean' ? (value ? 'Enabled' : 'Disabled') : `${value}${unit ? ` ${unit}` : ''}`}`
  }
  const p = shot.projectile
  const s = shot.scope
  const z = s.zeroConditions
  const e = shot.environment
  const t = e.powderTemperature
  const w = shot.windAndAngle
  const a = w.shootingAngle
  const sections: Array<[string, string[]]> = [
    ['Trajectory', [setting('Name', shot.name || 'Untitled trajectory'), setting('ID', shot.id), setting('Color', shot.color), setting('Active', shot.visible)]],
    ['Ammunition', [setting('Muzzle velocity', shot.muzzleVelocityFps, 'fps'), setting('Bullet weight', p.weightGrains, 'gr'), setting('Diameter', p.diameterInches, 'in'), setting('Length', p.lengthInches, 'in'), setting('Ballistic coefficient', p.ballisticCoefficient), setting('Drag model', p.dragModel)]],
    ['BC estimation', [setting('Mode', p.bcEstimation.mode), ...p.bcEstimation.points.map((point, i) => `Measurement ${i + 1}: ${setting('Range', point.rangeYards, 'yd')}, ${setting('Drop', point.dropInches, 'in')}`)]],
    ['Spin drift', [setting('Spin drift', p.spinDrift.enabled), setting('Twist rate', p.spinDrift.twistRateInches, 'in/turn'), setting('Twist direction', p.spinDrift.twistDirection)]],
    ['Scope', [setting('Zero distance', s.zeroDistanceYards, 'yd'), setting('Sight height', s.sightHeightInches, 'in'), setting('Adjustment unit', s.adjustment.unit.toUpperCase()), setting('Vertical adjustment', s.adjustment.vertical, s.adjustment.unit.toUpperCase()), setting('Horizontal adjustment', s.adjustment.horizontal, s.adjustment.unit.toUpperCase())]],
    ['Zero conditions', [setting('Mode', z.mode === 'current' ? 'Current conditions' : 'Custom conditions'), setting('Atmosphere mode', z.atmosphereMode === 'weather' ? 'Weather' : 'Density altitude'), setting('Muzzle velocity', z.muzzleVelocityFps, 'fps'), setting('Temperature', z.temperatureF, 'deg F'), setting('Pressure', z.pressureInHg, 'inHg'), setting('Pressure type', z.pressureType), setting('Humidity', z.relativeHumidity, '%'), setting('Altitude', z.altitudeFeet, 'ft'), setting('Density altitude', z.densityAltitudeFeet, 'ft'), setting('Powder temperature', z.powderTemperatureF, 'deg F')]],
    ['Atmosphere', [setting('Mode', e.mode === 'weather' ? 'Weather' : 'Density altitude'), setting('Temperature', e.temperatureF, 'deg F'), setting('Pressure', e.pressureInHg, 'inHg'), setting('Pressure type', e.pressureType), setting('Humidity', e.relativeHumidity, '%'), setting('Altitude', e.altitudeFeet, 'ft'), setting('Density altitude', e.densityAltitudeFeet, 'ft')]],
    ['Powder temperature', [setting('Mode', t.mode === 'none' ? 'No correction' : t.mode === 'linear' ? 'Linear correction' : 'Measured curve'), setting('Sensitivity', t.sensitivityFpsPerDegree, 'fps/deg F'), setting('Reference temperature', t.referenceTemperatureF, 'deg F'), setting('Current temperature', t.currentTemperatureF, 'deg F'), ...t.points.map((point, i) => `Measurement ${i + 1}: ${setting('Temperature', point.temperatureF, 'deg F')}, ${setting('Velocity', point.velocityFps, 'fps')}`)]],
    ['Wind and orientation', [setting('Wind speed', w.windSpeedMph, 'mph'), setting('Relative wind direction', w.windDirectionDegrees, 'deg'), setting('Wind reference', w.windReference), setting('Compass wind direction', w.compassWindDirectionDegrees, 'deg'), setting('Vertical wind speed', w.verticalWindSpeedMph, 'mph'), setting('Vertical wind direction', w.verticalWindDirection), setting('Shot direction', w.shotDirectionDegrees, 'deg'), setting('Coriolis', w.coriolisEnabled), setting('Latitude', w.latitudeDegrees, 'deg'), setting('Cant', w.cantDegrees, 'deg'), setting('Cant direction', w.cantDirection)]],
    ['Shooting angle', [setting('Mode', a.mode), setting('Angle', a.degrees, 'deg'), setting('Target distance', a.targetDistanceYards, 'yd'), setting('Elevation difference', a.elevationDifferenceFeet, 'ft')]],
  ]
  return sections.map(([label, values]) => [label, pdfText(values.join('; '))])
}

function drawVerticalPath(doc: jsPDF, trajectory: ExportTrajectory, options: ResultsOptions): void {
  const labels = resultsUnitLabels(options)
  const points = trajectory.graphPoints.map((point) => ({
    range: toAxisRange(point.rangeYards, options.units, options.rangeUnit, false),
    path: toDisplayUnit(point.pathInches, 'path', options.units, false),
  }))
  const xMin = points[0].range
  const xMax = points[points.length - 1].range
  let minPath = 0
  let maxPath = 0
  for (const point of points) {
    minPath = Math.min(minPath, point.path)
    maxPath = Math.max(maxPath, point.path)
  }
  const padding = Math.max(0.5, (maxPath - minPath) * 0.12)
  const yMin = minPath - padding
  const yMax = maxPath + padding
  const tickLabel = (path: number) => {
    const label = path.toFixed(Math.abs(yMax - yMin) < 0.1 ? 3 : 2)
    return label === '-0.00' ? '0.00' : label
  }
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(85)
  const tickWidth = Math.max(...Array.from({ length: 6 }, (_, i) => doc.getTextWidth(tickLabel(yMin + (yMax - yMin) * i / 5))))
  const left = Math.max(48, tickWidth + 34)
  const top = 18
  const width = doc.internal.pageSize.getWidth() - left - 18
  const height = doc.internal.pageSize.getHeight() - top - 38
  const x = (range: number) => left + (range - xMin) / (xMax - xMin) * width
  const y = (path: number) => top + (yMax - path) / (yMax - yMin) * height

  const verticalLabel = `Vertical offset (${labels.verticalOffset})`
  doc.text(verticalLabel, 14, top + height / 2 + doc.getTextWidth(verticalLabel) / 2, { angle: 90 })
  for (let i = 0; i <= 5; i++) {
    const range = xMin + (xMax - xMin) * i / 5
    const path = yMin + (yMax - yMin) * i / 5
    doc.setDrawColor(225).setLineWidth(0.4)
    doc.line(x(range), top, x(range), top + height)
    doc.line(left, y(path), left + width, y(path))
    doc.text(Number(range.toFixed(2)).toString(), x(range), top + height + 14, { align: 'center' })
    doc.text(tickLabel(path), left - 8, y(path) + 3, { align: 'right' })
  }
  doc.setDrawColor(120).setLineDashPattern([3, 3], 0).setLineWidth(0.7)
  doc.line(left, y(0), left + width, y(0))
  doc.setLineDashPattern([], 0)
  // A dark blue curve stays legible in color and grayscale printing.
  doc.setDrawColor(24, 82, 133).setLineWidth(1.6)
  // Bound PDF size to the resolution of the printed chart without using table samples.
  const stride = Math.max(1, Math.ceil(points.length / 1500))
  let previous = points[0]
  for (let i = stride; i < points.length + stride; i += stride) {
    const point = points[Math.min(i, points.length - 1)]
    doc.line(x(previous.range), y(previous.path), x(point.range), y(point.path))
    previous = point
  }
  doc.setTextColor(85).text(`Range (${labels.range})`, left + width / 2, top + height + 30, { align: 'center' })
  // Identify the trajectory inside the plot so long names do not shrink it.
  const name = pdfText(trajectory.shot.name || 'Untitled trajectory')
  doc.setFillColor(255, 255, 255).rect(left + 5, top + 5, doc.getTextWidth(name) + 8, 14, 'F')
  doc.text(name, left + 9, top + 15)
}

export function createResultsPdf(results: TrajectoryResults): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true })
  doc.setProperties({ title: 'Ballistics trajectory results', subject: 'Vertical path, velocity, energy, and trajectory settings', creator: 'Ballistics Visualizer' })
  const margin = 42
  const pageHeaders: string[] = []
  const graphPages = new Set<number>()
  const { options } = results
  const labels = resultsUnitLabels(options)
  const columns = csvColumnLabels(options)
  const range = (value: number) => Number(toAxisRange(value, options.units, options.rangeUnit, false).toFixed(4))
  const summary = `Range: ${range(options.minRangeYards)}-${range(options.maxRangeYards)} ${labels.range} | Sampling: ${range(options.intervalYards)} ${labels.range} | Detail: ${options.calculationQuality}`

  results.trajectories.forEach((trajectory, index) => {
    if (index > 0) doc.addPage('letter', 'portrait')
    const name = pdfText(trajectory.shot.name || 'Untitled trajectory')
    const firstSettingsPage = doc.getNumberOfPages()
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(25)
    doc.text('Trajectory settings', margin, 68)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(85)
    doc.text('All configured inputs. Optional values marked "Not set" may use engine defaults.', margin, 87)
    doc.setFontSize(8)
    doc.text('Graph offset: positive above line of sight, negative below. Dashed line = line of sight.', margin, 103)
    autoTable(doc, {
      startY: 120,
      margin: { top: 62, bottom: 46, left: margin, right: margin },
      head: [['Setting group', 'Configuration']],
      body: trajectorySettings(trajectory.shot, options.units),
      styles: { fontSize: 9, cellPadding: 7, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 48, 65] },
      columnStyles: { 0: { cellWidth: 105, fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [244, 247, 249] },
      rowPageBreak: 'avoid',
    })
    for (let page = firstSettingsPage; page <= doc.getNumberOfPages(); page++) {
      pageHeaders[page] = `${name} / Settings`
    }

    doc.addPage('letter', 'portrait')
    const firstTablePage = doc.getNumberOfPages()
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(25)
    doc.text('Trajectory table', margin, 68)
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(85)
    doc.text(summary, margin, 88)
    doc.setFontSize(8)
    doc.text('Energy requires bullet weight. N/A = unavailable. Range endpoints are included.', margin, 105)
    autoTable(doc, {
      startY: 123,
      margin: { top: 62, bottom: 46, left: margin, right: margin },
      head: [[columns.range, columns.verticalOffset, columns.velocity, columns.energy]],
      body: trajectory.samples.map((sample) => {
        const display = displayResultSample(sample, options)
        return [
          Number(display.range.toFixed(6)).toString(), display.verticalOffset.toFixed(3),
          display.velocity.toFixed(1), display.energy?.toFixed(1) ?? 'N/A',
        ]
      }),
      styles: { fontSize: 9, cellPadding: 4, halign: 'right' },
      headStyles: { fillColor: [30, 48, 65], halign: 'right' },
      alternateRowStyles: { fillColor: [244, 247, 249] },
      rowPageBreak: 'avoid',
    })
    for (let page = firstTablePage; page <= doc.getNumberOfPages(); page++) {
      pageHeaders[page] = `${name} / Table`
    }
    doc.addPage('letter', 'landscape')
    graphPages.add(doc.getNumberOfPages())
    drawVerticalPath(doc, trajectory, options)
  })

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    if (graphPages.has(page)) continue
    doc.setPage(page)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(100)
    const header = pageHeaders[page] ?? 'Ballistics results'
    let trimmed = header
    while (doc.getTextWidth(trimmed) > pageWidth - margin * 2 && trimmed.length > 1) trimmed = trimmed.slice(0, -1)
    doc.text(trimmed === header ? header : `${trimmed.slice(0, -3)}...`, margin, 26)
    doc.setDrawColor(215).setLineWidth(0.5).line(margin, pageHeight - 38, pageWidth - margin, pageHeight - 38)
    doc.text('Ballistics Visualizer', margin, pageHeight - 22)
    doc.text(`${page} / ${pages}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }
  return doc
}
