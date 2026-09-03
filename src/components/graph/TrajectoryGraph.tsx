import { useEffect, useMemo, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { GraphBounds, GraphMetric, Shot, ShotTrajectory } from '../../ballistics/types'
import { interpolatePoint } from '../../ballistics/engine'
import {
  axisRangeLabel,
  fromAxisRange,
  toAxisRange,
  toDisplayUnit,
  unitLabel,
  type ImperialRangeUnit,
  type Quantity,
  type UnitSystem,
} from '../../units/conversions'
import { formatAxisTicks } from '../../units/formatting'

const METRIC_LABELS: Record<GraphMetric, { axis: string; quantity: Quantity }> = {
  pathInches: { axis: 'PATH', quantity: 'path' },
  velocityFps: { axis: 'VELOCITY', quantity: 'velocity' },
  windageInches: { axis: 'WIND DRIFT', quantity: 'path' },
  energyFtLb: { axis: 'ENERGY', quantity: 'energy' },
}

interface TrajectoryGraphProps {
  shots: Shot[]
  trajectories: ShotTrajectory[]
  metric: GraphMetric
  bounds: GraphBounds
  units: UnitSystem
  rangeUnit: ImperialRangeUnit
  inspectionRange: number
  zoomLocked: boolean
  onInspectRange: (range: number, metric: GraphMetric) => void
  onViewChange: (min: number, max: number) => void
}

function makeData(shots: Shot[], trajectories: ShotTrajectory[], metric: GraphMetric, bounds: GraphBounds, units: UnitSystem, rangeUnit: ImperialRangeUnit): uPlot.AlignedData {
  const width = Math.max(0.1, bounds.maxX - bounds.minX)
  const sampleCount = 500
  const internalRanges = Array.from({ length: sampleCount + 1 }, (_, index) => bounds.minX + (index / sampleCount) * width)
  const ranges = internalRanges.map((range) => toAxisRange(range, units, rangeUnit, false))
  const series = shots.filter((shot) => shot.visible).map((shot) => {
    const trajectory = trajectories.find((item) => item.shotId === shot.id)
    if (!trajectory || trajectory.error) return ranges.map(() => null)
    return internalRanges.map((range) => {
      const point = interpolatePoint(trajectory.points, range)
      const value = point?.[metric]
      return typeof value === 'number' && Number.isFinite(value)
        ? toDisplayUnit(value, METRIC_LABELS[metric].quantity, units, false)
        : null
    })
  })
  return [ranges, ...series] as uPlot.AlignedData
}

function wheelZoomPlugin(onViewChange: (min: number, max: number) => void, zoomLocked: boolean): uPlot.Plugin {
  return {
    hooks: {
      ready: [
        (plot) => {
          const handler = (event: WheelEvent) => {
            if (zoomLocked) return
            event.preventDefault()
            const scale = plot.scales.x
            if (scale.min === undefined || scale.max === undefined) return
            const width = scale.max - scale.min

            if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
              const shift = (event.deltaX || event.deltaY) * width * 0.00075
              const min = Math.max(0, scale.min + shift)
              onViewChange(min, min + width)
              return
            }

            const cursorPosition = event.clientX - plot.over.getBoundingClientRect().left
            const cursorValue = plot.posToVal(cursorPosition, 'x')
            const factor = event.deltaY > 0 ? 1.07 : 0.93
            const nextWidth = Math.max(0.25, width * factor)
            const ratio = (cursorValue - scale.min) / width
            const min = Math.max(0, cursorValue - nextWidth * ratio)
            onViewChange(min, min + nextWidth)
          }
          plot.over.addEventListener('wheel', handler, { passive: false })
        },
      ],
    },
  }
}

export function TrajectoryGraph({ shots, trajectories, metric, bounds, units, rangeUnit, inspectionRange, zoomLocked, onInspectRange, onViewChange }: TrajectoryGraphProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)
  const inspectionLineRef = useRef<HTMLDivElement | null>(null)
  const visibleShots = useMemo(() => shots.filter((shot) => shot.visible), [shots])
  const data = useMemo(() => makeData(shots, trajectories, metric, bounds, units, rangeUnit), [shots, trajectories, metric, bounds, units, rangeUnit])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const metricInfo = METRIC_LABELS[metric]
    const displayMinX = toAxisRange(bounds.minX, units, rangeUnit, false)
    const displayMaxX = toAxisRange(bounds.maxX, units, rangeUnit, false)
    const handleDisplayViewChange = (min: number, max: number) => {
      onViewChange(fromAxisRange(min, units, rangeUnit), fromAxisRange(max, units, rangeUnit))
    }
    const options: uPlot.Options = {
      width: Math.max(320, host.clientWidth),
      height: Math.max(140, host.clientHeight || 500),
      padding: [18, 20, 4, 4],
      legend: { show: false },
      cursor: {
        drag: { x: !zoomLocked, y: false, setScale: !zoomLocked },
        points: { size: 7, width: 2 },
      },
      scales: {
        x: { time: false, min: displayMinX, max: displayMaxX },
        y: bounds.autoY
          ? {
              auto: true,
              range: metric === 'windageInches'
                ? (_plot, minimum, maximum) => {
                    const extent = Math.max(Math.abs(minimum), Math.abs(maximum), 0.5)
                    return [-extent * 1.12, extent * 1.12]
                  }
                : undefined,
            }
          : { auto: false, min: bounds.minY, max: bounds.maxY },
      },
      axes: [
        {
          stroke: '#969696',
          grid: { show: true, stroke: '#303030', width: 1 },
          ticks: { show: false },
          size: 48,
          label: `RANGE · ${axisRangeLabel(units, rangeUnit) === 'yd' ? 'YARDS' : axisRangeLabel(units, rangeUnit) === 'ft' ? 'FEET' : 'METERS'}`,
          labelSize: 24,
          labelFont: '600 10px Inter, sans-serif',
          font: '11px Inter, sans-serif',
        },
        {
          stroke: '#969696',
          grid: { show: true, stroke: '#303030', width: 1 },
          ticks: { show: false },
          size: 62,
          label: `${metricInfo.axis} · ${unitLabel(metricInfo.quantity, units).toUpperCase()}`,
          labelSize: 22,
          labelFont: '600 10px Inter, sans-serif',
          font: '11px Inter, sans-serif',
          values: (_plot, values) => formatAxisTicks(values),
        },
      ],
      series: [
        { label: 'Range' },
        ...visibleShots.map((shot) => ({
          label: shot.name,
          stroke: shot.color,
          width: 2.8,
          points: { show: false },
          spanGaps: true,
        })),
      ],
      hooks: {
        ready: [
          (plot) => {
            const line = document.createElement('div')
            line.className = 'graph-inspection-line'
            plot.over.append(line)
            inspectionLineRef.current = line

            const lineLabel = document.createElement('div')
            lineLabel.className = 'graph-line-label'
            plot.over.append(lineLabel)

            plot.over.addEventListener('pointermove', (event) => {
              const rect = plot.over.getBoundingClientRect()
              const localX = Math.min(rect.width, Math.max(0, event.clientX - rect.left))
              const localY = Math.min(rect.height, Math.max(0, event.clientY - rect.top))
              const ratio = localX / rect.width
              onInspectRange(bounds.minX + ratio * (bounds.maxX - bounds.minX), metric)

              const dataIndex = plot.posToIdx(localX)
              let closest: { shot: Shot; y: number; distance: number } | null = null
              for (let shotIndex = 0; shotIndex < visibleShots.length; shotIndex += 1) {
                const shot = visibleShots[shotIndex]
                const value = data[shotIndex + 1]?.[dataIndex]
                if (typeof value !== 'number' || !Number.isFinite(value)) continue
                const y = plot.valToPos(value, 'y')
                const distance = Math.abs(y - localY)
                if (!closest || distance < closest.distance) closest = { shot, y, distance }
              }

              if (!closest || closest.distance > 14) {
                lineLabel.style.display = 'none'
                return
              }

              lineLabel.textContent = closest.shot.name || 'Untitled trajectory'
              lineLabel.style.setProperty('--line-color', closest.shot.color)
              lineLabel.style.display = 'flex'
              const left = localX + 13 + lineLabel.offsetWidth > rect.width
                ? localX - lineLabel.offsetWidth - 13
                : localX + 13
              const top = Math.min(rect.height - lineLabel.offsetHeight - 4, Math.max(4, closest.y - lineLabel.offsetHeight / 2))
              lineLabel.style.left = `${Math.max(4, left)}px`
              lineLabel.style.top = `${top}px`
            })
            plot.over.addEventListener('pointerleave', () => { lineLabel.style.display = 'none' })
          },
        ],
        setScale: [
          (plot, scaleKey) => {
            if (scaleKey !== 'x' || plot.status !== 1) return
            const { min, max } = plot.scales.x
            if (min === undefined || max === undefined) return
            if (Math.abs(min - displayMinX) > 0.001 || Math.abs(max - displayMaxX) > 0.001) {
              handleDisplayViewChange(min, max)
            }
          },
        ],
      },
      plugins: [wheelZoomPlugin(handleDisplayViewChange, zoomLocked)],
    }

    const plot = new uPlot(options, data, host)
    plotRef.current = plot
    const observer = new ResizeObserver(([entry]) => {
      plot.setSize({ width: Math.max(320, entry.contentRect.width), height: Math.max(140, entry.contentRect.height || 500) })
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      plot.destroy()
      plotRef.current = null
      inspectionLineRef.current = null
    }
  }, [bounds, data, metric, onInspectRange, onViewChange, rangeUnit, units, visibleShots, zoomLocked])

  useEffect(() => {
    const line = inspectionLineRef.current
    if (!line) return
    const width = Math.max(0.0001, bounds.maxX - bounds.minX)
    const ratio = Math.min(1, Math.max(0, (inspectionRange - bounds.minX) / width))
    line.style.left = `${ratio * 100}%`
  }, [bounds.maxX, bounds.minX, inspectionRange])

  if (visibleShots.length === 0) {
    return (
      <div className="graph-empty">
        <span className="graph-empty__target" />
        <strong>No trajectories visible</strong>
        <p>Turn on the eye icon beside a trajectory to draw it here.</p>
      </div>
    )
  }

  return <div className="trajectory-plot" ref={hostRef} />
}
