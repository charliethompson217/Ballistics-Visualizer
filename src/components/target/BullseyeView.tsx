import { interpolatePoint } from '../../ballistics/engine'
import { calculateBullseyeRadius } from '../../ballistics/target'
import type { GraphBounds, Shot, ShotTrajectory } from '../../ballistics/types'
import {
  axisRangeLabel,
  fromAxisRange,
  toAxisRange,
  toDisplayUnit,
  unitLabel,
  type ImperialRangeUnit,
  type UnitSystem,
} from '../../units/conversions'
import { signed } from '../../units/formatting'

interface BullseyeViewProps {
  height: number
  range: number
  bounds: GraphBounds
  shots: Shot[]
  trajectories: ShotTrajectory[]
  units: UnitSystem
  rangeUnit: ImperialRangeUnit
  onRangeChange: (rangeYards: number) => void
}

export function BullseyeView({ height, range, bounds, shots, trajectories, units, rangeUnit, onRangeChange }: BullseyeViewProps) {
  const impacts = shots
    .filter((shot) => shot.visible)
    .map((shot) => {
      const trajectory = trajectories.find((item) => item.shotId === shot.id)
      const point = trajectory?.error ? null : interpolatePoint(trajectory?.points ?? [], range)
      return point ? { shot, point } : null
    })
    .filter((impact): impact is NonNullable<typeof impact> => impact !== null)

  const targetScalePoints = trajectories
    .filter((trajectory) => shots.some((shot) => shot.visible && shot.id === trajectory.shotId))
    .flatMap((trajectory) => trajectory.error
      ? []
      : trajectory.points.filter((point) => point.rangeYards >= bounds.minX && point.rangeYards <= bounds.maxX))
  const radiusInches = calculateBullseyeRadius(targetScalePoints)
  const ringStep = radiusInches / 5
  const center = 200
  const plotRadius = 174
  const scale = plotRadius / radiusInches
  const displayRange = toAxisRange(range, units, rangeUnit)
  const displayMin = toAxisRange(bounds.minX, units, rangeUnit, false)
  const displayMax = toAxisRange(bounds.maxX, units, rangeUnit, false)
  const pathUnit = unitLabel('path', units)

  return (
    <section className={`target-panel ${height < 380 ? 'target-panel--compact' : ''}`} style={{ height }}>
      <header className="target-panel__header">
        <span>
          <strong>Bullseye impact</strong>
          <small>Point of impact relative to your line of sight</small>
        </span>
        <span className="target-panel__range">{displayRange} {axisRangeLabel(units, rangeUnit)}</span>
      </header>

      <div className="target-panel__body">
        <div className="bullseye-wrap">
          <svg className="bullseye" viewBox="0 0 400 400" role="img" aria-label={`Impact target at ${displayRange} ${axisRangeLabel(units, rangeUnit)}`}>
            <circle cx={center} cy={center} r={plotRadius + 8} className="bullseye__back" />
            {[5, 4, 3, 2, 1].map((ring) => (
              <circle
                key={ring}
                cx={center}
                cy={center}
                r={(plotRadius / 5) * ring}
                className={`bullseye__ring bullseye__ring--${ring % 2 === 0 ? 'even' : 'odd'}`}
              />
            ))}
            <line x1={center - plotRadius} y1={center} x2={center + plotRadius} y2={center} className="bullseye__axis" />
            <line x1={center} y1={center - plotRadius} x2={center} y2={center + plotRadius} className="bullseye__axis" />
            <circle cx={center} cy={center} r="4" className="bullseye__center" />

            {impacts.map(({ shot, point }) => {
              const x = center + (point.windageInches ?? 0) * scale
              const y = center - point.pathInches * scale
              return (
                <g key={shot.id} className="bullseye__impact" style={{ '--impact-color': shot.color } as React.CSSProperties}>
                  <circle cx={x} cy={y} r="8" />
                  <line x1={x - 12} y1={y} x2={x + 12} y2={y} />
                  <line x1={x} y1={y - 12} x2={x} y2={y + 12} />
                </g>
              )
            })}
          </svg>
          <span className="bullseye-scale">Each ring ≈ {toDisplayUnit(ringStep, 'path', units)} {pathUnit}</span>
        </div>

        <div className="target-readout">
          {impacts.length === 0 ? (
            <div className="target-readout__empty">No valid trajectory reaches this range.</div>
          ) : impacts.map(({ shot, point }) => (
            <div className="target-impact-row" key={shot.id}>
              <span className="target-impact-row__dot" style={{ background: shot.color }} />
              <strong>{shot.name || 'Untitled trajectory'}</strong>
              {shot.scope.zeroDistanceYards !== undefined && Math.abs(range - shot.scope.zeroDistanceYards) < 0.51 && <em>ZERO</em>}
              <span>Vertical <b>{signed(toDisplayUnit(point.pathInches, 'path', units), 2)} {pathUnit}</b></span>
              <span>Horizontal <b>{signed(toDisplayUnit(point.windageInches ?? 0, 'path', units), 2)} {pathUnit}</b></span>
            </div>
          ))}
        </div>
      </div>

      <label className="target-range-slider">
        <span>{toAxisRange(bounds.minX, units, rangeUnit)} {axisRangeLabel(units, rangeUnit)}</span>
        <input
          type="range"
          min={displayMin}
          max={displayMax}
          step="any"
          value={toAxisRange(range, units, rangeUnit, false)}
          onChange={(event) => onRangeChange(fromAxisRange(Number(event.target.value), units, rangeUnit))}
        />
        <span>{toAxisRange(bounds.maxX, units, rangeUnit)} {axisRangeLabel(units, rangeUnit)}</span>
      </label>
    </section>
  )
}
